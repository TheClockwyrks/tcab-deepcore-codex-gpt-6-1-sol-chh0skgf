import { afterEach, describe, expect, it, vi } from "vitest";
import { createCanvas } from "@napi-rs/canvas";
import {
  ConstantClock,
  createEngine,
  type InitApi,
} from "@clockwyrks/simple-2d";
import * as C from "./constants";
import { game } from "./game";
import * as M from "./model";
import { debug } from "./debug";
import { simulate } from "./simulation";
import { choose, controls, menu } from "./interface";
vi.mock("./visuals", async (importOriginal) => {
  const original = await importOriginal<typeof import("./visuals")>();
  return {
    ...original,
    loadAssets: async (api: InitApi<M.DeepcoreState>) => {
      for (const cue of Object.values(C.CUES))
        api.audio.define(cue, { freq: 100, durationMs: 20 });
    },
  };
});
const engines: ReturnType<
  typeof createEngine<M.DeepcoreState, typeof debug>
>[] = [];
afterEach(() => {
  engines.splice(0).forEach((e) => e.destroy());
});
async function harness(step = 1000 / 60) {
  const events = new EventTarget();
  const canvas = createCanvas(
    C.STAGE_W,
    C.STAGE_H,
  ) as unknown as HTMLCanvasElement;
  const engine = createEngine({
    canvas,
    width: C.STAGE_W,
    height: C.STAGE_H,
    game,
    clock: new ConstantClock(step),
    surface: {
      cssWidth: () => 1280,
      cssHeight: () => 720,
      dpr: () => 1,
      events: () => events,
    },
  });
  engines.push(engine);
  await engine.initialize();
  const key = (code: string, down = true) => {
    const event = new Event(down ? "keydown" : "keyup");
    Object.assign(event, { code, repeat: false });
    events.dispatchEvent(event);
  };
  return { engine, key };
}
function live() {
  const s = M.initial();
  s.screen = "in-mine";
  s.grid = M.emptyGrid(s.coreRow);
  return s;
}
const held = { left: 0, right: 0, down: 0, up: 0 };
function advance(s: M.DeepcoreState, seconds: number, input = held) {
  for (let i = 0; i < Math.round(seconds * 120); i++)
    simulate(s, input, 1 / 120);
}
describe("engine integration", () => {
  it("starts at the title and follows the registered menu keys", async () => {
    const { engine, key } = await harness();
    expect(engine.debug.version).toBe(1);
    expect(engine.state.screen).toBe("title");
    for (let i = 0; i < 3; i++) {
      key("Enter");
      await engine.advance(1);
      key("Enter", false);
      await engine.advance(1);
    }
    expect(engine.state.screen).toBe("in-mine");
    expect(engine.state.worldSize).toBe("quick");
    await engine.advance(60);
    expect(M.depth(engine.state)).toBe(0);
    expect(engine.state.miner.fuel).toBe(100);
    expect(engine.diagnostics().every((d) => !d.error)).toBe(true);
  });
  it("drills through a posed ore using real engine input without mutating the old state", async () => {
    const { engine, key } = await harness();
    engine.apply((s) => debug.setScreen(s, "in-mine"));
    engine.apply((s) => debug.setOreTile(s, 4, 1, "ferron"));
    engine.apply((s) => debug.setTile(s, 4, 2, "rock"));
    engine.apply((s) => debug.setMinerTravel(s, false));
    const before = engine.state;
    key("KeyS");
    await engine.advance(30);
    key("KeyS", false);
    expect(debug.tileAt(engine.state, 4, 1).kind).toBe("tunnel");
    expect(engine.state.cargo.ferron).toBe(1);
    expect(debug.tileAt(before, 4, 1).kind).toBe("ore");
    expect(engine.state.miner.y).toBe(before.miner.y);
  });
  it("pauses the timer, but simTime continues on all screens", async () => {
    const { engine, key } = await harness();
    engine.apply((s) => debug.setScreen(s, "in-mine"));
    engine.apply((s) => debug.setCoreCarried(s, true));
    engine.apply((s) => debug.setPanel(s, "inventory"));
    await engine.advance(60);
    expect(engine.state.coreTimer).toBeCloseTo(89, 4);
    key("Escape");
    await engine.advance(1);
    key("Escape", false);
    key("Escape");
    await engine.advance(1);
    key("Escape", false);
    const timer = engine.state.coreTimer;
    await engine.advance(60);
    expect(engine.state.screen).toBe("paused");
    expect(engine.state.coreTimer).toBe(timer);
    expect(engine.state.simTime).toBeGreaterThan(2);
  });
});
describe("mine and simulation", () => {
  it.each(C.WORLD_SIZES)(
    "generates a %s mine with exact unique materials and a safe spine",
    (size) => {
      let s = debug.setWorldSize(M.initial(), size);
      s = debug.generateMine(s);
      expect(s.coreRow).toBe(C.STANDARD_ROWS * C.WORLD_SIZE_SCALE[size]);
      for (const m of C.MATERIALS)
        expect(s.grid.filter((v) => v.material === m)).toHaveLength(1);
      for (let r = 1; r < s.coreRow; r++)
        expect(["lava", "stone"]).not.toContain(
          M.at(s, C.CAVE_MOUTH_COL, r).kind,
        );
      expect(M.at(s, C.CORE_COL, s.coreRow).kind).toBe("core");
      for (const b of C.BANDS) {
        const v = s.grid.filter((v) => v.band === b && v.kind !== "bedrock");
        expect(v.filter((v) => v.kind === "ore").length / v.length).toBeCloseTo(
          C.ORE_DENSITY,
          2,
        );
      }
    },
  );
  it("lands once, loses the expected hull, and never sinks through solid ground", () => {
    const s = live();
    s.miner.y = -100;
    s.miner.vy = 900;
    s.grid[32 + 4] = M.cell("rock", "topsoil");
    advance(s, 1);
    expect(s.miner.y).toBe(8);
    expect(s.miner.hull).toBeLessThan(100);
    const hull = s.miner.hull;
    advance(s, 1);
    expect(s.miner.hull).toBe(hull);
    expect(M.grounded(s)).toBe(true);
  });
  it("respects health and fuel per hit, and smooth downward travel", () => {
    const s = live();
    s.grid[36] = M.cell("ore", "topsoil", "marlite");
    s.grid[68] = M.cell("rock", "topsoil");
    advance(s, 0.25, { ...held, down: 1 });
    expect(M.at(s, 4, 1).health).toBe(2);
    expect(s.miner.y).toBeGreaterThan(8);
    advance(s, 0.25, { ...held, down: 1 });
    expect(M.at(s, 4, 1).kind).toBe("tunnel");
    expect(s.cargo.marlite).toBe(1);
    expect(s.miner.y).toBeCloseTo(88, 1);
  });
  it("overload prevents ascent and dropping cargo restores lift", () => {
    const s = live();
    s.miner.y = 1000;
    s.cargo.adamite = 5;
    advance(s, 0.2, { ...held, up: 1 });
    expect(s.miner.vy).toBeGreaterThanOrEqual(0);
    M.transact(s, "drop-ore", "adamite");
    M.transact(s, "drop-ore", "adamite");
    s.miner.vy = 0;
    advance(s, 0.2, { ...held, up: 1 });
    expect(s.miner.vy).toBeLessThan(0);
  });
  it("a gas blast scales with depth and raises a delayed notice", () => {
    const s = live();
    s.miner.x = 4 * 80;
    s.miner.y = 125 * 80;
    s.miner.hull = 450;
    M.gas(s, 4, 126);
    expect(s.miner.hull).toBeLessThan(390);
    expect(s.noticesFired.gas).toBe(true);
    expect(M.snapshot(s).notice?.shown).toBe(false);
    s.miner.travel = false;
    advance(s, 1.6);
    expect(M.snapshot(s).notice?.shown).toBe(true);
  });
  it("carried and ground sample explosions are location aware", () => {
    const near = live();
    near.miner.travel = false;
    near.satchel.coreSample = true;
    near.coreTimer = 0.02;
    advance(near, 0.05);
    expect(near.summary?.deathCause).toBe("core-detonation");
    const far = live();
    far.miner.travel = false;
    far.coreGround = { col: 25, row: 100 };
    far.coreTimer = 0.02;
    advance(far, 0.05);
    expect(far.screen).toBe("in-mine");
    expect(far.coreTimer).toBeNull();
  });
  it("travel and drill gates operate independently", () => {
    const s = live();
    s.grid[36] = M.cell("rock", "topsoil");
    s.miner.travel = false;
    s.miner.drill = false;
    advance(s, 0.5, { ...held, down: 1 });
    expect(M.at(s, 4, 1).health).toBe(4);
    s.miner.drill = true;
    advance(s, 0.5, { ...held, down: 1 });
    expect(M.at(s, 4, 1).kind).toBe("tunnel");
    expect(s.miner.y).toBe(8);
  });
  it("scanner locks only within range and only on missing materials", () => {
    let s = live();
    s = debug.setMaterialTile(s, 5, 3, "resonite");
    s = debug.setTier(s, "scanner", 2);
    expect(M.scanner(s).target).toBe("resonite");
    s = debug.setMaterial(s, "resonite", 1);
    expect(M.scanner(s).locked).toBe(false);
  });
  it("resizing preserves existing health and cell bands", () => {
    let s = live();
    s = debug.setOreTile(s, 5, 200, "voltite");
    s = debug.setTileHealth(s, 5, 200, 3);
    const before = M.at(s, 5, 200);
    s = debug.setWorldSize(s, "marathon");
    expect(M.at(s, 5, 200)).toEqual(before);
    expect(M.at(s, 5, 700).kind).toBe("tunnel");
    expect(M.at(s, 16, 1000).kind).toBe("core");
  });
});
describe("transactions and debug contracts", () => {
  it("sells at mineral prices and buys only what can be afforded", () => {
    const s = live();
    s.cargo.ferron = 10;
    M.transact(s, "sell");
    expect(s.credits).toBe(280);
    expect(s.creditsEarned).toBe(280);
    expect(M.slots(s)).toBe(0);
    s.miner.fuel = 40;
    M.transact(s, "buy-fuel");
    expect(s.miner.fuel).toBe(65);
    expect(s.credits).toBe(255);
    s.miner.hull = 5;
    s.credits = 5;
    M.transact(s, "repair-full");
    expect(s.miner.hull).toBe(7.5);
    expect(s.credits).toBe(0);
  });
  it("upgrades, supplies and fabrication consume their own costs", () => {
    let s = debug.setCredits(live(), 100000);
    s = debug.buyUpgrade(s, "fuel");
    expect(s.tiers.fuel).toBe(2);
    s = debug.buyItem(s, "emergency-fuel");
    s = debug.setFuel(s, 50);
    s = debug.useItem(s, "emergency-fuel");
    expect(s.miner.fuel).toBe(80);
    expect(s.items["emergency-fuel"]).toBe(0);
    s = debug.fabricate(s);
    s = debug.fabricate(s);
    expect(s.installed).toBe(2);
    const before = s.credits;
    s = debug.fabricate(s);
    expect(s.credits).toBe(before);
    s = debug.setMaterial(s, "resonite", 1);
    s = debug.fabricate(s);
    expect(s.installed).toBe(3);
    expect(s.satchel.resonite).toBe(0);
  });
  it("explosives destroy ore and boulders but preserve materials", () => {
    let s = live();
    s = debug.setOreTile(s, 4, 1, "ferron");
    s = debug.setTile(s, 5, 1, "stone");
    s = debug.setMaterialTile(s, 3, 1, "resonite");
    s = debug.setItemCount(s, "dynamite", 1);
    s = debug.useItem(s, "dynamite");
    expect(M.at(s, 4, 1).kind).toBe("tunnel");
    expect(M.at(s, 5, 1).kind).toBe("tunnel");
    expect(M.at(s, 3, 1).kind).toBe("material");
    expect(M.slots(s)).toBe(0);
  });
  it("poses fail loudly and reconciliation does not advance any clock", () => {
    const s = live();
    expect(() => debug.setTier(s, "hull", 7)).toThrow();
    expect(() => debug.setCoreTimer(s, 10)).toThrow();
    expect(() => debug.setTileHealth(s, 3, 3, 2)).toThrow();
    expect(debug.reconcile(s)).toEqual(s);
    expect(debug.reset(debug.setCredits(s, 300))).toMatchObject({
      screen: "title",
      credits: 0,
      simTime: 0,
    });
  });
  it("menus and control geometry match current state", () => {
    let s = M.initial();
    expect(menu(s)).toEqual(["NEW EXPEDITION", "HOW TO PLAY"]);
    s = choose(s);
    expect(s.screen).toBe("mode-select");
    s = choose(s);
    expect(s.screen).toBe("size-select");
    s = choose(s);
    s.panel = "upgrade-shop";
    expect(controls(s).filter((c) => c.op === "buy-upgrade")).toHaveLength(7);
    expect(debug.menuItemRect(s, 0)).toBeNull();
    expect(debug.controlRect(s, "buy-upgrade", "fuel")).not.toBeNull();
  });
  it("quantum teleport consumes posed outcomes only on use", () => {
    let s = live();
    s = debug.setItemCount(s, "quantum-teleporter", 1);
    s = debug.setNextTeleportHeight(s, 3);
    s = debug.setNextTeleportSpeed(s, 400);
    s = debug.useItem(s, "quantum-teleporter");
    expect(s.miner.y + C.MINER_H).toBe(C.SURFACE_Y - 3 * C.TILE);
    expect(s.miner.vy).toBe(400);
    expect(s.nextTeleportHeight).toBeNull();
    expect(s.nextTeleportSpeed).toBeNull();
  });
});

describe("persistence and expedition endings", () => {
  it("saves a mine, restores at camp, and refuses a live sample", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => values.get(k) ?? null,
      setItem: (k: string, v: string) => values.set(k, v),
      removeItem: (k: string) => values.delete(k),
    });
    try {
      let s = debug.setCredits(live(), 321);
      s = debug.setOreTile(s, 7, 20, "cuprite");
      s = debug.save(s);
      expect(s.hasSave).toBe(true);
      const restored = M.resume(s);
      expect(restored.credits).toBe(321);
      expect(M.at(restored, 7, 20).ore).toBe("cuprite");
      expect(restored.miner.y).toBe(8);
      s = debug.setCoreCarried(s, true);
      s = debug.setCredits(s, 900);
      s = debug.save(s);
      expect(M.readSave()?.credits).toBe(321);
      s = debug.setMode(s, "hardcore");
      M.end(s, "hull-destroyed");
      expect(M.readSave()).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it("fabricates ignition, consumes its timer, and launches with a summary", () => {
    let s = debug.setCredits(live(), 10000);
    s = debug.setRocketInstalled(s, 4);
    s = debug.setCoreCarried(s, true);
    s = debug.fabricate(s);
    expect(s.installed).toBe(5);
    expect(s.coreTimer).toBeNull();
    s = debug.launch(s);
    expect(s.screen).toBe("victory");
    expect(s.summary?.componentsInstalled).toBe(5);
  });
  it("a panel does not protect against a nearby ground sample explosion", async () => {
    const { engine } = await harness();
    engine.apply((s) => debug.setScreen(s, "in-mine"));
    engine.apply((s) => debug.placeCoreSample(s, 4, 1));
    engine.apply((s) => debug.setCoreTimer(s, 0.01));
    engine.apply((s) => debug.setPanel(s, "inventory"));
    await engine.advance(1);
    expect(engine.state.summary?.deathCause).toBe("core-detonation");
  });
  it("a released partial cut cannot push the miner below solid rock", () => {
    const s = live();
    s.tiers.drill = 3;
    s.grid[36] = M.cell("rock", "rockbed");
    s.grid[68] = M.cell("rock", "rockbed");
    advance(s, 0.45, { ...held, down: 1 });
    advance(s, 0.05);
    expect(s.miner.y + C.MINER_H).toBeLessThanOrEqual(80);
    expect(M.at(s, 4, 1).health).toBe(0.5);
  });
});
