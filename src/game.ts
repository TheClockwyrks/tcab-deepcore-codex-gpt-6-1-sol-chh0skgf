import type { Game } from "@clockwyrks/simple-2d";
import * as C from "./constants";
import * as M from "./model";
import { debug, type DeepcoreDebugApi } from "./debug";
import { act, choose, controls, menu, menuRect } from "./interface";
import { simulate, tickSample } from "./simulation";
import { loadAssets, render } from "./visuals";
export type { DeepcoreState } from "./model";
export type { DeepcoreDebugApi } from "./debug";
export const BACKGROUND = "#0a1c27";
const inside = (p: { x: number; y: number }, r: M.Rect) =>
  p.x >= r.x && p.y >= r.y && p.x < r.x + r.w && p.y < r.y + r.h;
export const game: Game<M.DeepcoreState, DeepcoreDebugApi> = {
  async initialize(api) {
    for (const [name, keys] of Object.entries(C.ACTIONS))
      api.input.register(name, { keys: [...keys] });
    await loadAssets(api);
    const diagnostics: Record<
      string,
      (s: M.ReadState) => string | number | boolean
    > = {
      screen: (s) => s.screen,
      panel: (s) => s.panel ?? "none",
      mode: (s) => s.mode,
      size: (s) => s.worldSize,
      position: (s) => `${s.miner.x.toFixed(1)}, ${s.miner.y.toFixed(1)}`,
      velocity: (s) => `${s.miner.vx.toFixed(1)}, ${s.miner.vy.toFixed(1)}`,
      animation: (s) => s.miner.state,
      facing: (s) => s.miner.facing,
      grounded: M.grounded,
      fuel: (s) => `${s.miner.fuel.toFixed(1)} / ${M.maxFuel(s)}`,
      hull: (s) => `${s.miner.hull.toFixed(1)} / ${M.maxHull(s)}`,
      drill: (s) => {
        const d = M.snapshot(s).miner.drilling;
        return d
          ? `${d.dir} ${d.col},${d.row} ${Math.round(d.progress * 100)}%`
          : "none";
      },
      credits: (s) => s.credits,
      depth: M.depth,
      cargo: (s) =>
        `${M.slots(s)} slots / ${M.load(s)} kg ${M.load(s) >= M.jet(s).liftLimitKg ? "OVERLOAD" : ""}`,
      satchel: (s) =>
        `${s.satchel.resonite} R / ${s.satchel.cryenite} C / core ${s.satchel.coreSample}`,
      tiers: (s) => C.TRACKS.map((t) => `${t}:${s.tiers[t]}`).join(" "),
      coreTimer: (s) => s.coreTimer ?? "none",
      scanner: (s) => {
        const scan = M.scanner(s);
        return `${scan.locked} / ${scan.target ?? "none"}`;
      },
    };
    for (const [name, source] of Object.entries(diagnostics))
      api.diagnostics.register(name, source);
    const s = M.initial();
    s.hasSave = M.readSave() !== null;
    return [s, debug];
  },
  update(state, api, dt) {
    let s = M.clone(state);
    s.simTime += dt;
    const input = api.input;
    const pointer = input.pointer();
    const pressed = Object.fromEntries(
      C.ACTION_NAMES.map((k) => [k, input.pressed(k)]),
    ) as Record<C.ActionName, boolean>;
    if (pressed.mute) api.audio.setMuted(!api.audio.muted());
    s.muted = api.audio.muted();
    api.audio.loop(C.CUES.music);
    const samples = input.pointerSamples();
    for (const p of samples) {
      if (p.type === "down") s.press = { x: p.x, y: p.y };
      if (p.type === "up" && s.press) {
        const region = menu(s).findIndex((_, i) => {
          const r = menuRect(s, i);
          return r && inside(p, r) && inside(s.press!, r);
        });
        if (region >= 0) {
          s.menuIndex = region;
          s = choose(s);
        } else {
          const control = controls(s).find(
            (c) => c.enabled && inside(p, c) && inside(s.press!, c),
          );
          if (control) {
            if (control.op === "mute") api.audio.setMuted(!api.audio.muted());
            else act(s, control.op, control.subject);
            api.audio.play(C.CUES.fabricate);
          } else if (s.screen === "in-mine" && !s.panel) {
            const world = {
              x: p.x + s.camera.x,
              y: p.y - C.HUD_H + s.camera.y,
            };
            const b = M.buildings.find((b) => inside(world, b));
            if (
              b &&
              s.miner.y + C.MINER_H <= C.SURFACE_Y + 1 &&
              s.miner.x + 56 >= b.x &&
              s.miner.x <= b.x + b.w
            ) {
              if (b.id === "save-pad") M.save(s);
              else s.panel = b.id;
            }
          }
        }
        s.press = null;
      }
    }
    if (s.screen !== "in-mine") {
      if (samples.some((p) => p.type === "move")) {
        const i = menu(s).findIndex((_, i) => inside(pointer, menuRect(s, i)!));
        if (i >= 0) s.menuIndex = i;
      }
      if (pressed.down) s.menuIndex = (s.menuIndex + 1) % menu(s).length;
      if (pressed.up)
        s.menuIndex = (s.menuIndex + menu(s).length - 1) % menu(s).length;
      if (pressed.activate) s = choose(s);
      if (pressed.pause) {
        if (s.screen === "paused") s.screen = "in-mine";
        else if (s.screen === "size-select") {
          s.screen = "mode-select";
          s.menuIndex = C.MODES.indexOf(s.mode);
        } else if (s.screen === "mode-select" || s.screen === "how-to-play") {
          const was = s.screen;
          s.screen = "title";
          s.menuIndex = (s.hasSave ? 1 : 0) + (was === "how-to-play" ? 1 : 0);
        }
      }
    } else {
      if (pressed.pause) {
        if (s.panel) s.panel = null;
        else {
          s.screen = "paused";
          s.menuIndex = 0;
        }
      }
      if (pressed.inventory)
        s.panel = s.panel === "inventory" ? null : "inventory";
      if (pressed.jettison) M.transact(s, "jettison");
      C.ITEM_IDS.forEach((id, i) => {
        if (pressed[`supply${i + 1}` as C.ActionName]) {
          M.transact(s, "use-item", id);
          api.audio.play(C.CUES.fabricate);
        }
      });
      if (pressed.activate && !s.panel) {
        const b = M.buildings.find(
          (b) =>
            s.miner.x + 56 >= b.x &&
            s.miner.x <= b.x + b.w &&
            s.miner.y + 72 <= 81,
        );
        if (b) {
          if (b.id === "save-pad") M.save(s);
          else s.panel = b.id;
        }
      }
      if (s.screen === "in-mine") {
        if (!s.panel) {
          const held = {
            left: input.value("left"),
            right: input.value("right"),
            down: input.value("down"),
            up: input.value("up"),
          };
          for (let remaining = dt; remaining > 1e-8;) {
            const step = Math.min(remaining, 1 / 120);
            simulate(s, held, step);
            remaining -= step;
            if (s.screen !== "in-mine") break;
          }
        } else {
          s.elapsedSeconds += dt;
          tickSample(s, dt);
          if (s.miner.hull <= 0) M.end(s, "hull-destroyed");
        }
      }
    }
    for (const [cue, on] of [
      [C.CUES.drill, !!s.miner.drilling && s.screen === "in-mine" && !s.panel],
      [
        C.CUES.thrust,
        s.miner.state === "jetpack" && s.screen === "in-mine" && !s.panel,
      ],
      [
        C.CUES.alarmFuel,
        s.miner.fuel < M.maxFuel(s) * C.LOW_FUEL_FRACTION &&
          s.screen === "in-mine",
      ],
    ] as const) {
      if (on) api.audio.loop(cue);
      else api.audio.stop(cue);
    }
    const cueFor: Record<string, C.CueName> = {
      "ore-sparkle": C.CUES.orePickup,
      "material-shimmer": C.CUES.materialChime,
      "gas-explosion": C.CUES.gasExplosion,
      "impact-dust": C.CUES.impact,
      "lava-embers": C.CUES.lavaSizzle,
      "death-burst": C.CUES.death,
      "launch-exhaust": C.CUES.launch,
      "core-extract": C.CUES.materialChime,
      "core-detonation": C.CUES.gasExplosion,
    };
    for (const e of s.effects)
      if (
        e.age <= dt &&
        cueFor[e.name] &&
        !state.effects.some((old) => old.seed === e.seed)
      )
        api.audio.play(cueFor[e.name]);
    if (
      s.coreTimer !== null &&
      s.screen === "in-mine" &&
      Math.floor(state.simTime * (s.coreTimer < 15 ? 4 : 1)) !==
        Math.floor(s.simTime * (s.coreTimer < 15 ? 4 : 1))
    )
      api.audio.play(C.CUES.alarmCore);
    if (s.screen === "in-mine" && s.miner.fuel <= 0 && M.depth(s) > 0)
      M.end(s, "fuel-out");
    if (s.screen === "victory" || s.screen === "game-over") {
      s.animTime += dt;
      s.shake = Math.max(0, s.shake - dt);
      s.effects = s.effects
        .map((e) => ({ ...e, age: e.age + dt }))
        .filter((e) => e.age < 2);
    }
    s.muted = api.audio.muted();
    return s;
  },
  render,
};
