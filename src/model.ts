import * as C from "./constants";
import type { DeepReadonly } from "ts-essentials";
export interface Cell {
  kind: C.TileKind;
  band: C.BandName | null;
  ore: C.OreId | null;
  material: C.MaterialId | null;
  health: number | null;
  maxHealth: number | null;
}
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface DeepcoreState {
  screen: C.ScreenName;
  panel: C.PanelId | null;
  mode: C.Mode;
  worldSize: C.WorldSize;
  coreRow: number;
  menuIndex: number;
  muted: boolean;
  simTime: number;
  elapsedSeconds: number;
  hasSave: boolean;
  credits: number;
  creditsEarned: number;
  deepestDepthMeters: number;
  coreTimer: number | null;
  coreGround: { col: number; row: number } | null;
  camera: { x: number; y: number; lead: number };
  miner: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    facing: C.Facing;
    state: C.MinerState;
    travel: boolean;
    drill: boolean;
    fuel: number;
    hull: number;
    drilling: {
      col: number;
      row: number;
      dir: "down" | "left" | "right";
    } | null;
  };
  cargo: Partial<Record<C.OreId, number>>;
  satchel: { resonite: number; cryenite: number; coreSample: boolean };
  tiers: Record<C.TrackName, number>;
  items: Record<C.ItemId, number>;
  nextTeleportHeight: number | null;
  nextTeleportSpeed: number | null;
  installed: number;
  noticesFired: { gas: boolean; lava: boolean };
  notice: { hazard: C.NoticeHazard; age: number } | null;
  summary: {
    deepestDepthMeters: number;
    creditsEarned: number;
    elapsedSeconds: number;
    mode: C.Mode;
    componentsInstalled: number;
    deathCause: C.DeathCause | null;
  } | null;
  grid: Cell[];
  hitClock: number;
  hurt: number;
  animTime: number;
  note: string;
  noteTime: number;
  shake: number;
  effects: { name: string; x: number; y: number; age: number; seed: number }[];
  press: { x: number; y: number } | null;
}
export type ReadState = DeepReadonly<DeepcoreState>;
export const clone = (s: ReadState): DeepcoreState =>
  structuredClone(s) as DeepcoreState;
export const clamp = (v: number, a: number, b: number) =>
  Math.max(a, Math.min(b, v));
export const bandAt = (r: number, n: number) =>
  C.BANDS[Math.min(3, Math.floor((4 * (r - 1)) / (n - 1)))];
export function cell(
  kind: C.TileKind,
  band: C.BandName | null = null,
  ore: C.OreId | null = null,
  material: C.MaterialId | null = null,
): Cell {
  const hp =
    ["rock", "ore", "material", "gas", "lava"].includes(kind) && band
      ? C.BAND_HEALTH[band]
      : null;
  return { kind, band, ore, material, health: hp, maxHealth: hp };
}
export function at(s: ReadState, col: number, row: number): Cell {
  if (col < 0 || col >= C.WORLD_COLS || row < 0 || row > s.coreRow)
    return cell("bedrock");
  return s.grid[row * C.WORLD_COLS + col] ?? cell("bedrock");
}
export const minerCell = (s: ReadState) => ({
  col: Math.floor((s.miner.x + C.MINER_W / 2) / C.TILE),
  row: Math.max(0, Math.floor((s.miner.y + C.MINER_H / 2) / C.TILE)),
});
export const depth = (s: ReadState) =>
  Math.max(
    0,
    ((s.miner.y + C.MINER_H - C.SURFACE_Y) / C.TILE) * C.METERS_PER_ROW,
  );
export const maxFuel = (s: ReadState) => C.FUEL_TIERS[s.tiers.fuel - 1];
export const maxHull = (s: ReadState) => C.HULL_TIERS[s.tiers.hull - 1];
export const slots = (s: ReadState) =>
  Object.values(s.cargo).reduce((a, v) => a + (v ?? 0), 0);
export const load = (s: ReadState) =>
  C.MINERALS.reduce((a, m) => a + (s.cargo[m.id] ?? 0) * m.weightKg, 0);
export const jet = (s: ReadState) => C.JETPACK_TIERS[s.tiers.jetpack - 1];
export function grounded(s: ReadState) {
  const m = s.miner,
    d = m.drilling;
  if (
    d?.dir === "down" &&
    at(s, d.col, d.row).health !== null &&
    m.y + C.MINER_H >= d.row * C.TILE - 0.1 &&
    m.y + C.MINER_H <= (d.row + 1) * C.TILE + 0.1
  )
    return true;
  const r = Math.floor((m.y + C.MINER_H + 0.1) / C.TILE);
  return (
    [m.x + 2, m.x + C.MINER_W - 2].some(
      (x) => at(s, Math.floor(x / C.TILE), r).kind !== "tunnel",
    ) && Math.abs((m.y + C.MINER_H) / C.TILE - r) < 0.02
  );
}
export const buildings = C.BUILDINGS.map((id, i) => ({
  id,
  x: 120 + i * 325,
  y: -20,
  w: 220,
  h: 100,
}));
export function emptyGrid(n: number): Cell[] {
  return Array.from({ length: (n + 1) * C.WORLD_COLS }, (_, i) => {
    const r = Math.floor(i / C.WORLD_COLS),
      c = i % C.WORLD_COLS;
    return r === n
      ? cell(c === C.CORE_COL ? "core" : "bedrock")
      : c === 0 || c === 31
        ? cell("bedrock")
        : cell("tunnel", r ? bandAt(r, n) : null);
  });
}
export function initial(): DeepcoreState {
  return {
    screen: "title",
    panel: null,
    mode: "standard",
    worldSize: "standard",
    coreRow: C.STANDARD_ROWS,
    menuIndex: 0,
    muted: false,
    simTime: 0,
    elapsedSeconds: 0,
    hasSave: false,
    credits: 0,
    creditsEarned: 0,
    deepestDepthMeters: 0,
    coreTimer: null,
    coreGround: null,
    camera: { x: 0, y: -C.VIEW_H / 2, lead: 0 },
    miner: {
      x: C.SPAWN_COL * C.TILE,
      y: C.SURFACE_Y - C.MINER_H,
      vx: 0,
      vy: 0,
      facing: "east",
      state: "idle",
      travel: true,
      drill: true,
      fuel: C.FUEL_TIERS[0],
      hull: C.HULL_TIERS[0],
      drilling: null,
    },
    cargo: {},
    satchel: { resonite: 0, cryenite: 0, coreSample: false },
    tiers: Object.fromEntries(C.TRACKS.map((k) => [k, 1])) as Record<
      C.TrackName,
      number
    >,
    items: Object.fromEntries(C.ITEM_IDS.map((k) => [k, 0])) as Record<
      C.ItemId,
      number
    >,
    nextTeleportHeight: null,
    nextTeleportSpeed: null,
    installed: 0,
    noticesFired: { gas: false, lava: false },
    notice: null,
    summary: null,
    grid: emptyGrid(C.STANDARD_ROWS),
    hitClock: 0,
    hurt: 0,
    animTime: 0,
    note: "",
    noteTime: 0,
    shake: 0,
    effects: [],
    press: null,
  };
}
export function generate(s: DeepcoreState) {
  s.grid = emptyGrid(s.coreRow);
  const reserved = new Set<number>();
  for (let r = 1; r < s.coreRow; r++)
    reserved.add(r * C.WORLD_COLS + C.CAVE_MOUTH_COL);
  const materialPositions = C.MATERIALS.map((material) => {
    const b = C.BANDS.indexOf(C.MATERIAL_BAND[material]);
    const row =
      Math.floor(((b + 0.2 + Math.random() * 0.6) * (s.coreRow - 1)) / 4) + 1;
    const col = 2 + Math.floor(Math.random() * 28);
    for (
      let c = Math.min(col, C.CAVE_MOUTH_COL);
      c <= Math.max(col, C.CAVE_MOUTH_COL);
      c++
    )
      reserved.add(row * 32 + c);
    return { material, row, col };
  });
  for (let c = C.CORE_COL; c <= C.CAVE_MOUTH_COL; c++)
    reserved.add((s.coreRow - 1) * 32 + c);
  for (let r = 1; r < s.coreRow; r++)
    for (let c = 1; c < 31; c++)
      s.grid[r * 32 + c] = cell("rock", bandAt(r, s.coreRow));
  function shuffle<T>(values: T[]) {
    for (let i = values.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [values[i], values[j]] = [values[j], values[i]];
    }
    return values;
  }
  for (let b = 0; b < 4; b++) {
    const indices = s.grid.flatMap((v, i) =>
      v.band === C.BANDS[b] && i % 32 > 0 && i % 32 < 31 ? [i] : [],
    );
    const mean =
      indices.reduce(
        (a, i) => a + (Math.floor(i / 32) - 1) / (s.coreRow - 1),
        0,
      ) / indices.length;
    const oreIndices = shuffle(
      indices.filter((i) => Math.floor(i / 32) >= C.ORE_MIN_ROW),
    );
    for (const i of oreIndices.slice(
      0,
      Math.round(indices.length * C.ORE_DENSITY),
    )) {
      const f = (Math.floor(i / 32) - 1) / (s.coreRow - 1),
        weights = C.MINERALS.map(
          (m) => m.pick * Math.max(0, 1 - Math.abs(f - m.peak) / m.spread),
        );
      let roll = Math.random() * weights.reduce((a, b) => a + b, 0);
      const ore =
        C.MINERALS[weights.findIndex((w) => (roll -= w) <= 0)]?.id ?? "ferron";
      s.grid[i] = cell("ore", C.BANDS[b], ore);
    }
    const hazards = shuffle(
      indices.filter((i) => !reserved.has(i) && s.grid[i].kind === "rock"),
    );
    const take = (kind: C.TileKind, count: number) => {
      for (let k = 0; k < count && hazards.length; k++) {
        const i = hazards.pop()!;
        s.grid[i] = cell(kind, C.BANDS[b]);
      }
    };
    if (b > 0) {
      take(
        "stone",
        Math.round(
          indices.length *
            (C.STONE_DENSITY_MIN +
              ((C.STONE_DENSITY_MAX - C.STONE_DENSITY_MIN) * (mean - 0.25)) /
                0.75),
        ),
      );
      take(
        "gas",
        Math.round(
          indices.length *
            (C.GAS_DENSITY_MIN +
              ((C.GAS_DENSITY_MAX - C.GAS_DENSITY_MIN) * (mean - 0.25)) / 0.75),
        ),
      );
    }
    if (b > 1) {
      let count = Math.round(
        indices.length *
          (C.LAVA_DENSITY_MIN +
            ((C.LAVA_DENSITY_MAX - C.LAVA_DENSITY_MIN) * (mean - 0.5)) / 0.5),
      );
      for (const seed of hazards) {
        if (count <= 0) break;
        const length = 2 + Math.floor(Math.random() * 4);
        for (let d = 0; d < length && count > 0; d++) {
          const i = seed + d;
          if (
            i % 32 < 1 ||
            i % 32 > 30 ||
            reserved.has(i) ||
            s.grid[i]?.band !== C.BANDS[b] ||
            s.grid[i].kind !== "rock"
          )
            break;
          s.grid[i] = cell("lava", C.BANDS[b]);
          count--;
        }
      }
    }
  }
  s.grid[32 + C.CAVE_MOUTH_COL] = cell("tunnel", "topsoil");
  for (const { material, row, col } of materialPositions)
    s.grid[row * 32 + col] = cell(
      "material",
      bandAt(row, s.coreRow),
      null,
      material,
    );
}
export function start(s: ReadState): DeepcoreState {
  const n = initial();
  n.mode = s.mode;
  n.worldSize = s.worldSize;
  n.coreRow = Math.round(C.STANDARD_ROWS * C.WORLD_SIZE_SCALE[n.worldSize]);
  n.screen = "in-mine";
  n.muted = s.muted;
  generate(n);
  clearStorage();
  return n;
}
const SAVE = "deepcore-expedition-v1";
export function clearStorage() {
  try {
    localStorage.removeItem(SAVE);
  } catch {
    /* Storage is optional. */
  }
}
export function readSave(): DeepcoreState | null {
  try {
    const text = localStorage.getItem(SAVE);
    return text ? (JSON.parse(text) as DeepcoreState) : null;
  } catch {
    return null;
  }
}
export function note(s: DeepcoreState, text: string) {
  s.note = text;
  s.noteTime = 3;
}
export function save(s: DeepcoreState) {
  if (s.coreTimer !== null) {
    note(s, "Cannot save an unstable Core Sample.");
    return;
  }
  try {
    localStorage.setItem(SAVE, JSON.stringify(s));
    s.hasSave = true;
    note(s, "Expedition saved.");
  } catch {
    note(s, "Storage unavailable.");
  }
}
export function resume(s: ReadState) {
  const n = readSave() ?? clone(s);
  n.screen = "in-mine";
  n.panel = null;
  n.menuIndex = 0;
  n.miner.x = C.SPAWN_COL * C.TILE;
  n.miner.y = C.SURFACE_Y - C.MINER_H;
  n.miner.vx = 0;
  n.miner.vy = 0;
  n.muted = s.muted;
  return n;
}
export function effect(
  s: DeepcoreState,
  name: string,
  x = s.miner.x + 28,
  y = s.miner.y + 60,
) {
  s.effects.push({
    name,
    x,
    y,
    age: 0,
    seed: Math.floor(Math.random() * 100000),
  });
}
export function damage(s: DeepcoreState, v: number, hazard?: C.NoticeHazard) {
  s.miner.hull -= v;
  s.hurt = C.HURT_TIME;
  if (hazard && !s.noticesFired[hazard]) {
    s.noticesFired[hazard] = true;
    s.notice = { hazard, age: 0 };
  }
}
export function end(s: DeepcoreState, cause: C.DeathCause | null) {
  s.screen = cause ? "game-over" : "victory";
  s.animTime = 0;
  s.panel = null;
  s.menuIndex = 0;
  s.summary = {
    deepestDepthMeters: s.deepestDepthMeters,
    creditsEarned: s.creditsEarned,
    elapsedSeconds: s.elapsedSeconds,
    mode: s.mode,
    componentsInstalled: s.installed,
    deathCause: cause,
  };
  s.coreTimer = null;
  s.coreGround = null;
  s.satchel.coreSample = false;
  if (!cause || s.mode === "hardcore") {
    clearStorage();
    s.hasSave = false;
  }
  effect(s, cause ? "death-burst" : "launch-exhaust");
}
export function gas(s: DeepcoreState, c: number, r: number) {
  effect(s, "gas-explosion", c * 80 + 40, r * 80 + 40);
  s.shake = 1;
  const dx = s.miner.x + 28 - (c * 80 + 40),
    dy = s.miner.y + 36 - (r * 80 + 40),
    d = Math.hypot(dx, dy);
  if (d <= C.GAS_BLAST_TILES * C.TILE) {
    damage(
      s,
      C.GAS_DAMAGE_MIN +
        ((C.GAS_DAMAGE_MAX - C.GAS_DAMAGE_MIN) *
          Math.max(0, (r - 1) / (s.coreRow - 1) - 0.25)) /
          0.75,
      "gas",
    );
    if (s.miner.travel) {
      s.miner.vx = (dx / (d || 1)) * C.GAS_KNOCKBACK;
      s.miner.vy = (dy / (d || 1)) * C.GAS_KNOCKBACK;
    }
  }
}
export function transact(
  s: DeepcoreState,
  op: string,
  subject: string | null = null,
) {
  const m = s.miner;
  if (op === "sell") {
    const value = C.MINERALS.reduce(
      (a, o) => a + (s.cargo[o.id] ?? 0) * o.value,
      0,
    );
    s.credits += value;
    s.creditsEarned += value;
    s.cargo = {};
    note(s, `Sold cargo for ${value} Credits`);
  }
  if (["buy-fuel", "fill-fuel", "buy-repair", "repair-full"].includes(op)) {
    const fuel = op.includes("fuel"),
      max = fuel ? maxFuel(s) : maxHull(s),
      current = fuel ? m.fuel : m.hull,
      price = fuel ? C.FUEL_PRICE : C.REPAIR_PRICE;
    const amount = Math.max(
      0,
      Math.min(
        max - current,
        s.credits / price,
        op.startsWith("buy")
          ? fuel
            ? C.FUEL_BUY_INCREMENT
            : C.REPAIR_BUY_INCREMENT
          : Infinity,
      ),
    );
    if (fuel) m.fuel += amount;
    else m.hull += amount;
    s.credits -= amount * price;
  }
  if (op === "buy-upgrade") {
    const track = subject as C.TrackName;
    if (!C.TRACKS.includes(track)) throw Error("Unknown track");
    const tier = s.tiers[track],
      cost = C.UPGRADE_PRICES[tier - 1];
    if (tier < C.MAX_TIER[track] && s.credits >= cost) {
      s.credits -= cost;
      s.tiers[track]++;
      note(s, `${track.toUpperCase()} upgraded`);
    }
  }
  if (op === "drop-ore") {
    const id = subject as C.OreId;
    if (!C.MINERALS.some((o) => o.id === id)) throw Error("Unknown ore");
    s.cargo[id] = Math.max(0, (s.cargo[id] ?? 0) - 1);
  }
  if (op === "buy-item") {
    const item = C.ITEMS.find((i) => i.id === subject);
    if (!item) throw Error("Unknown item");
    if (s.credits >= item.price) {
      s.credits -= item.price;
      s.items[item.id]++;
    }
  }
  if (op === "use-item") {
    const id = subject as C.ItemId;
    if (!C.ITEM_IDS.includes(id)) throw Error("Unknown item");
    if (!s.items[id]) {
      note(s, "No supply held");
      return;
    }
    if (
      (id === "nanobots" && m.hull >= maxHull(s)) ||
      (id === "emergency-fuel" && m.fuel >= maxFuel(s))
    )
      return;
    s.items[id]--;
    if (id === "nanobots") {
      m.hull = Math.min(maxHull(s), m.hull + C.NANOBOT_HULL);
      effect(s, "material-shimmer");
    }
    if (id === "emergency-fuel") {
      m.fuel = Math.min(maxFuel(s), m.fuel + C.EMERGENCY_FUEL);
      effect(s, "material-shimmer");
    }
    if (id === "matter-transmitter" || id === "quantum-teleporter") {
      m.x = C.SPAWN_COL * C.TILE;
      m.y = C.SURFACE_Y - C.MINER_H;
      m.vx = 0;
      m.vy = 0;
      if (id === "quantum-teleporter") {
        m.y -=
          (s.nextTeleportHeight ??
            C.TELEPORT_HEIGHT_TILES_MIN +
              Math.random() *
                (C.TELEPORT_HEIGHT_TILES_MAX - C.TELEPORT_HEIGHT_TILES_MIN)) *
          C.TILE;
        m.vy =
          s.nextTeleportSpeed ??
          C.TELEPORT_SPEED_MIN +
            Math.random() * (C.TELEPORT_SPEED_MAX - C.TELEPORT_SPEED_MIN);
        s.nextTeleportHeight = null;
        s.nextTeleportSpeed = null;
      }
      effect(s, "core-extract");
    }
    if (id === "dynamite" || id === "plastic-explosives") {
      const pos = minerCell(s),
        rad =
          id === "dynamite" ? C.DYNAMITE_RADIUS : C.PLASTIC_EXPLOSIVES_RADIUS;
      for (let r = pos.row - rad; r <= pos.row + rad; r++)
        for (let c = pos.col - rad; c <= pos.col + rad; c++) {
          const v = at(s, c, r);
          if (
            r > 0 &&
            c > 0 &&
            c < 31 &&
            !["bedrock", "core", "material", "tunnel"].includes(v.kind)
          ) {
            if (v.kind === "gas") gas(s, c, r);
            s.grid[r * 32 + c] = cell("tunnel", v.band);
          }
        }
      s.shake = 1;
      effect(s, "gas-explosion");
    }
  }
  if (op === "jettison" && s.satchel.coreSample) {
    s.satchel.coreSample = false;
    s.coreGround = minerCell(s);
  }
  if (op === "fabricate") {
    const comp = C.ROCKET_COMPONENTS[s.installed];
    if (
      comp &&
      s.credits >= comp.credits &&
      (!comp.material ||
        (comp.material === "core-sample"
          ? s.satchel.coreSample
          : s.satchel[comp.material] > 0))
    ) {
      s.credits -= comp.credits;
      s.installed++;
      if (comp.material === "core-sample") {
        s.satchel.coreSample = false;
        s.coreTimer = null;
      } else if (comp.material) s.satchel[comp.material]--;
      note(s, `${comp.name} installed`);
    }
  }
  if (op === "launch" && s.installed === 5) end(s, null);
  if (op === "dismiss-notice") s.notice = null;
  if (op === "save") save(s);
  if (m.hull <= 0 && s.screen === "in-mine") end(s, "hull-destroyed");
}
export function scanner(s: ReadState) {
  const pos = minerCell(s),
    range = C.SCANNER_TIERS[s.tiers.scanner - 1];
  const targets = s.grid
    .flatMap((v, i) =>
      v.material && !s.satchel[v.material]
        ? [{ target: v.material, c: i % 32, r: Math.floor(i / 32) }]
        : [],
    )
    .sort(
      (a, b) =>
        Math.hypot(a.c - pos.col, a.r - pos.row) -
        Math.hypot(b.c - pos.col, b.r - pos.row),
    );
  const t = targets[0],
    d = t ? Math.hypot(t.c - pos.col, t.r - pos.row) : Infinity;
  if (range && t && d <= range)
    return {
      locked: true,
      target: t.target,
      dirX: (t.c - pos.col) / (d || 1),
      dirY: (t.r - pos.row) / (d || 1),
      distanceTiles: d,
    };
  return { locked: false, target: null, dirX: 0, dirY: 0, distanceTiles: null };
}
export function snapshot(s: ReadState) {
  const pos = minerCell(s),
    dr = s.miner.drilling,
    v = dr ? at(s, dr.col, dr.row) : null;
  return {
    version: C.DEEPCORE_DEBUG_VERSION,
    screen: s.screen,
    panel: s.panel,
    mode: s.mode,
    worldSize: s.worldSize,
    coreRow: s.coreRow,
    menuIndex: s.menuIndex,
    muted: s.muted,
    simTime: s.simTime,
    elapsedSeconds: s.elapsedSeconds,
    hasSave: s.hasSave,
    credits: s.credits,
    creditsEarned: s.creditsEarned,
    depthMeters: depth(s),
    deepestDepthMeters: s.deepestDepthMeters,
    coreTimer: s.coreTimer,
    coreGround: s.coreGround,
    camera: s.camera,
    miner: {
      ...s.miner,
      ...pos,
      grounded: grounded(s),
      maxFuel: maxFuel(s),
      maxHull: maxHull(s),
      overloaded: load(s) >= jet(s).liftLimitKg,
      drilling: dr
        ? {
            ...dr,
            progress: v?.health && v.maxHealth ? 1 - v.health / v.maxHealth : 0,
          }
        : null,
    },
    cargo: {
      slotsUsed: slots(s),
      slotCap: C.CARGO_TIERS[s.tiers.cargo - 1],
      loadKg: load(s),
      liftLimitKg: jet(s).liftLimitKg,
      ore: Object.fromEntries(Object.entries(s.cargo).filter(([, v]) => v)),
    },
    satchel: s.satchel,
    tiers: s.tiers,
    items: s.items,
    nextTeleportHeight: s.nextTeleportHeight,
    nextTeleportSpeed: s.nextTeleportSpeed,
    rocket: {
      installed: C.ROCKET_COMPONENT_IDS.slice(0, s.installed),
      nextComponent: C.ROCKET_COMPONENT_IDS[s.installed] ?? null,
    },
    scanner: scanner(s),
    notice: s.notice
      ? { hazard: s.notice.hazard, shown: s.notice.age >= C.NOTICE_DELAY }
      : null,
    noticesFired: s.noticesFired,
    summary: s.summary,
  };
}
