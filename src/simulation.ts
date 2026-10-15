import * as C from "./constants";
import {
  at,
  cell,
  clamp,
  damage,
  depth,
  effect,
  end,
  gas,
  grounded,
  jet,
  load,
  slots,
  type DeepcoreState,
} from "./model";
export interface Held {
  left: number;
  right: number;
  down: number;
  up: number;
}
/** Small collision steps prevent tunneling even during long test frames. */
export function simulate(s: DeepcoreState, input: Held, dt: number) {
  s.elapsedSeconds += dt;
  s.hurt = Math.max(0, s.hurt - dt);
  s.shake = Math.max(0, s.shake - dt);
  s.animTime += dt;
  s.effects = s.effects
    .map((e) => ({ ...e, age: e.age + dt }))
    .filter((e) => e.age < 2);
  s.noteTime = Math.max(0, s.noteTime - dt);
  if (s.notice) {
    s.notice.age += dt;
    if (s.notice.age > C.NOTICE_DELAY + C.NOTICE_FADE) s.notice = null;
  }
  const m = s.miner,
    dir = input.right - input.left;
  const isGround = grounded(s),
    j = jet(s),
    fraction = load(s) / j.liftLimitKg,
    thrust = input.up > 0 && m.fuel > 0;
  if (dir) m.facing = dir > 0 ? "east" : "west";
  const previousCut = m.drilling;
  m.drilling = null;
  let target: {
    col: number;
    row: number;
    dir: "down" | "left" | "right";
  } | null = null;
  if (isGround && !thrust && m.drill && m.fuel >= C.DRILL_HIT_FUEL) {
    const row = Math.floor((m.y + C.MINER_H + 0.1) / C.TILE),
      col = Math.floor((m.x + C.MINER_W / 2) / C.TILE);
    if (input.down)
      target =
        previousCut?.dir === "down" &&
        at(s, previousCut.col, previousCut.row).health !== null
          ? { ...previousCut }
          : { col, row, dir: "down" };
    else if (dir) {
      const c = Math.floor(
        (dir > 0 ? m.x + C.MINER_W + 0.1 : m.x - 0.1) / C.TILE,
      );
      if (
        at(s, c, Math.floor((m.y + C.MINER_H / 2) / C.TILE)).kind !== "tunnel"
      )
        target = {
          col: c,
          row: Math.floor((m.y + C.MINER_H / 2) / C.TILE),
          dir: dir > 0 ? "right" : "left",
        };
    }
  }
  if (target) {
    const v = at(s, target.col, target.row);
    if (
      v.health !== null ||
      (v.kind === "core" && target.dir === "down" && s.coreTimer === null)
    ) {
      m.drilling = target;
      s.hitClock += dt;
      while (
        s.hitClock + 1e-9 >= C.DRILL_HIT_INTERVAL &&
        m.fuel >= C.DRILL_HIT_FUEL
      ) {
        s.hitClock -= C.DRILL_HIT_INTERVAL;
        m.fuel -= C.DRILL_HIT_FUEL;
        if (v.kind === "core") {
          s.satchel.coreSample = true;
          s.coreTimer = C.CORE_TIMER;
          effect(s, "core-extract", target.col * 80 + 40, target.row * 80);
          break;
        }
        v.health = (v.health ?? 0) - C.DRILL_DAMAGE_TIERS[s.tiers.drill - 1];
        if (v.health <= 0) {
          if (v.ore) {
            if (slots(s) < C.CARGO_TIERS[s.tiers.cargo - 1]) {
              s.cargo[v.ore] = (s.cargo[v.ore] ?? 0) + 1;
              effect(
                s,
                "ore-sparkle",
                target.col * 80 + 40,
                target.row * 80 + 40,
              );
            } else {
              s.note = "cargo full";
              s.noteTime = 2;
            }
          }
          if (v.material) {
            s.satchel[v.material]++;
            effect(
              s,
              "material-shimmer",
              target.col * 80 + 40,
              target.row * 80 + 40,
            );
          }
          if (v.kind === "gas") gas(s, target.col, target.row);
          if (v.kind === "lava")
            damage(
              s,
              (v.band === "coreshell"
                ? C.LAVA_DRILL_CORESHELL
                : C.LAVA_DRILL_DEEPSTONE) *
                (1 - C.RADIATOR_TIERS[s.tiers.radiator - 1]),
              "lava",
            );
          s.grid[target.row * 32 + target.col] = cell("tunnel", v.band);
          if (
            m.travel &&
            target.dir === "down" &&
            !["tunnel", "lava"].includes(at(s, target.col, target.row + 1).kind)
          )
            m.y = (target.row + 1) * C.TILE - C.MINER_H;
          break;
        }
      }
    } else s.hitClock = 0;
  } else s.hitClock = 0;
  const downCut = m.drilling?.dir === "down" ? m.drilling : null;
  const cutting = downCut ? at(s, downCut.col, downCut.row) : null;
  const sink =
    downCut &&
    cutting?.health !== null &&
    cutting?.maxHealth &&
    !["tunnel", "lava"].includes(at(s, downCut.col, downCut.row + 1).kind);
  if (m.travel && sink && downCut && cutting) {
    const progress = clamp(
      1 -
        (cutting.health ?? 0) / (cutting.maxHealth ?? 1) +
        ((s.hitClock / C.DRILL_HIT_INTERVAL) *
          C.DRILL_DAMAGE_TIERS[s.tiers.drill - 1]) /
          (cutting.maxHealth ?? 1),
      0,
      0.999,
    );
    m.y = (downCut.row + progress) * C.TILE - C.MINER_H;
    m.vy = 0;
  }
  if (m.travel && !sink) {
    m.vx = dir * C.WALK_SPEED * (isGround || m.fuel > 0 ? 1 : 0);
    if (thrust) {
      const f = clamp(fraction, 0, 1),
        cap = j.emptyClimb * (1 - (1 - C.CLIMB_CAP_FLOOR) * f),
        acc = j.emptyAccel * (1 - f);
      m.vy = Math.max(-cap, m.vy - acc * dt);
    } else
      m.vy = Math.min(
        C.FALL_TERMINAL_EMPTY +
          (C.FALL_TERMINAL_LOADED - C.FALL_TERMINAL_EMPTY) *
            clamp(fraction, 0, 1),
        m.vy + C.GRAVITY * dt,
      );
    const steps = Math.max(
      1,
      Math.ceil((Math.max(Math.abs(m.vx), Math.abs(m.vy)) * dt) / 12),
    );
    for (let i = 0; i < steps; i++) {
      let nx = clamp(
        m.x + (m.vx * dt) / steps,
        C.TILE,
        C.WORLD_W - C.TILE - C.MINER_W,
      );
      const r1 = Math.max(1, Math.floor(m.y / C.TILE)),
        r2 = Math.floor((m.y + C.MINER_H - 0.1) / C.TILE);
      for (let r = r1; m.vx !== 0 && r <= r2; r++) {
        const c = Math.floor((m.vx > 0 ? nx + C.MINER_W : nx) / C.TILE);
        if (at(s, c, r).kind !== "tunnel") {
          nx = m.vx > 0 ? c * C.TILE - C.MINER_W : (c + 1) * C.TILE;
          break;
        }
      }
      m.x = nx;
      let ny = m.y + (m.vy * dt) / steps;
      const falling = m.vy >= 0;
      const startRow = Math.floor(
        (falling ? m.y + C.MINER_H + 0.0001 : ny) / C.TILE,
      );
      const endRow = Math.floor((falling ? ny + C.MINER_H : m.y) / C.TILE);
      let collided = false;
      for (let r = startRow; r <= endRow && !collided; r++)
        for (const x of [m.x + 1, m.x + C.MINER_W - 1]) {
          const c = Math.floor(x / C.TILE);
          if (r >= 1 && at(s, c, r).kind !== "tunnel") {
            if (falling) {
              if (m.vy > C.IMPACT_SAFE_SPEED) {
                damage(s, (m.vy - C.IMPACT_SAFE_SPEED) * C.IMPACT_DAMAGE_RATE);
                effect(s, "impact-dust");
                s.shake = 0.5;
              }
              ny = r * C.TILE - C.MINER_H;
            } else ny = (r + 1) * C.TILE;
            m.vy = 0;
            collided = true;
            break;
          }
        }
      m.y = ny;
    }
  }
  if (thrust)
    m.fuel -=
      dt *
      (C.THRUST_BURN_MAX +
        (C.THRUST_BURN_MIN - C.THRUST_BURN_MAX) *
          Math.min(1, Math.max(0, -m.vy) / C.CRUISE_SPEED)) *
      C.THRUST_BURN_SIZE_MULT[s.worldSize];
  if (!isGround && dir) m.fuel -= C.AIR_BURN * dt;
  if (m.y + C.MINER_H > C.SURFACE_Y + 0.1) m.fuel -= C.LIFE_SUPPORT_BURN * dt;
  m.fuel = Math.max(0, m.fuel);
  for (
    let r = Math.max(1, Math.floor(m.y / 80));
    r <= Math.floor((m.y + C.MINER_H - 0.001) / C.TILE);
    r++
  )
    for (
      let c = Math.floor(m.x / 80);
      c <= Math.floor((m.x + C.MINER_W - 0.001) / C.TILE);
      c++
    )
      if (
        at(s, c, r).kind === "lava" &&
        !(m.drilling?.col === c && m.drilling.row === r)
      ) {
        if (!s.effects.some((e) => e.name === "lava-embers" && e.age < 0.15))
          effect(s, "lava-embers");
        damage(
          s,
          C.LAVA_CONTACT_DPS *
            (1 - C.RADIATOR_TIERS[s.tiers.radiator - 1]) *
            dt,
          "lava",
        );
      }
  tickSample(s, dt);
  m.state = m.drilling
    ? m.drilling.dir === "down"
      ? "drill-down"
      : "drill-side"
    : s.hurt > 0
      ? "hurt"
      : m.fuel <= 0 && depth(s) > 0
        ? "fuel-out"
        : thrust
          ? "jetpack"
          : !grounded(s)
            ? "fall"
            : dir
              ? "walk"
              : "idle";
  s.deepestDepthMeters = Math.max(s.deepestDepthMeters, depth(s));
  const targetLead =
    Math.abs(m.vy) <= C.CAM_STILL_SPEED ? 0 : Math.sign(m.vy) * C.CAM_LEAD_MAX;
  const speed =
    (C.CAM_LEAD_MAX / C.CAM_LEAD_RAMP) *
    (Math.abs(targetLead) < Math.abs(s.camera.lead) ||
    targetLead * s.camera.lead < 0
      ? C.CAM_UNWIND_MULT
      : 1);
  s.camera.lead += clamp(targetLead - s.camera.lead, -speed * dt, speed * dt);
  s.camera.x = clamp(
    m.x + C.MINER_W / 2 - C.VIEW_W / 2,
    0,
    C.WORLD_W - C.VIEW_W,
  );
  s.camera.y = Math.min(
    m.y + C.MINER_H / 2 - C.VIEW_H / 2 + s.camera.lead,
    (s.coreRow + 1) * 80 - C.VIEW_H,
  );
  if (s.screen === "in-mine") {
    if (m.hull <= 0) end(s, "hull-destroyed");
    else if (m.fuel <= 0 && depth(s) > 0) end(s, "fuel-out");
  }
}

/** The unstable sample remains live inside every building and inventory panel. */
export function tickSample(s: DeepcoreState, dt: number) {
  const m = s.miner;
  if (s.coreTimer !== null) {
    s.coreTimer -= dt;
    if (s.coreTimer <= 0) {
      const p = s.coreGround;
      effect(
        s,
        "core-detonation",
        p ? p.col * 80 + 40 : m.x,
        p ? p.row * 80 + 40 : m.y,
      );
      s.shake = 2;
      if (
        s.satchel.coreSample ||
        (p &&
          Math.hypot(
            m.x + 28 - (p.col * 80 + 40),
            m.y + 36 - (p.row * 80 + 40),
          ) <=
            C.CORE_BLAST_TILES * 80)
      )
        end(s, "core-detonation");
      s.coreTimer = null;
      s.coreGround = null;
      s.satchel.coreSample = false;
    }
  }
}
