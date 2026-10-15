import type { InitApi, RenderApi } from "@clockwyrks/simple-2d";
import { ParticleCanvasPlayer } from "@clockwyrks/particle-runtime/canvas";
import type { ParticleSystem } from "@clockwyrks/particle-runtime";
import * as C from "./constants";
import * as M from "./model";
import { controls, menu, menuRect, cargoLabel } from "./interface";
const images = new Map<string, ImageBitmap>();
const systems = new Map<string, ParticleSystem>();
const files = import.meta.glob("../assets/**/*", {
  query: "?url&no-inline",
  import: "default",
  eager: true,
}) as Record<string, string>;
export async function loadAssets(api: InitApi<M.DeepcoreState>) {
  await Promise.all(
    Object.entries(files)
      .filter(([p]) => /\.(png|wav|json)$/.test(p) && !p.includes(".config."))
      .map(async ([path, url]) => {
        // Vite emits absolute module-relative URLs in production. Convert them
        // back into the engine loader's paths under the page-relative asset root.
        const relative = url.slice(url.lastIndexOf("/assets/") + 8);
        const name = path.replace("../assets/", "");
        if (name.endsWith(".png"))
          images.set(name, await api.assets.loadImage(relative));
        else if (name.endsWith(".wav"))
          await api.audio.load(name.slice(6, -4), relative);
        else
          systems.set(
            name.slice(3, -5),
            JSON.parse(
              await (await api.assets.load(relative)).text(),
            ) as ParticleSystem,
          );
      }),
  );
}
const ink = "#dce5da",
  muted = "#91a6a8",
  accent = "#edbd73";
function text(
  ctx: CanvasRenderingContext2D,
  t: string,
  x: number,
  y: number,
  size = 16,
  color = ink,
  font = "monospace",
) {
  ctx.fillStyle = color;
  ctx.font = `${size}px ${font}`;
  ctx.fillText(t, x, y);
}
function image(
  ctx: CanvasRenderingContext2D,
  name: string,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const im = images.get(name);
  if (im) ctx.drawImage(im, x, y, w, h);
}
function box(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  fill = "#122832",
  stroke = "#344b52",
) {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = stroke;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}
function fx(
  ctx: CanvasRenderingContext2D,
  name: string,
  x: number,
  y: number,
  age: number,
  seed = 1,
  size = 180,
) {
  const system = systems.get(name);
  if (!system) return;
  ctx.save();
  ctx.translate(x - size / 2, y - size / 2); // Particle runtime fits to the underlying canvas; scale that fit to the authored effect footprint.
  ctx.scale(size / ctx.canvas.width, size / ctx.canvas.height);
  const p = new ParticleCanvasPlayer(system, ctx, {
    clear: false,
    seed,
    pixelRadius: 1.1,
  });
  p.update(Math.max(0.001, age));
  ctx.restore();
}
export function world(s: M.ReadState, ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, C.HUD_H, C.STAGE_W, C.VIEW_H);
  ctx.clip();
  ctx.translate(-s.camera.x, C.HUD_H - s.camera.y);
  if (s.shake > 0)
    ctx.translate(
      Math.sin(s.simTime * 75) * s.shake * 6,
      Math.cos(s.simTime * 83) * s.shake * 4,
    );
  ctx.fillStyle = "#10232d";
  ctx.fillRect(s.camera.x, s.camera.y, 1280, 664);
  if (s.camera.y < 80) {
    image(ctx, "surface/sky.png", 0, -700, C.WORLD_W, 780);
    for (const b of M.buildings) {
      image(ctx, `surface/${b.id}.png`, b.x, b.y, b.w, b.h);
      text(
        ctx,
        b.id.replace(/-/g, " ").toUpperCase(),
        b.x + 4,
        b.y - 12,
        13,
        accent,
      );
      if (b.id === "launch-pad")
        image(
          ctx,
          `rocket/stage${s.installed}.png`,
          b.x + 50,
          b.y -
            120 -
            (s.screen === "victory" ? Math.min(700, s.animTime * 180) : 0),
          120,
          120,
        );
    }
    for (let c = 1; c < 31; c++)
      if (c !== C.CAVE_MOUTH_COL)
        image(ctx, "surface/ground.png", c * C.TILE, C.SURFACE_Y, 80, 6);
    image(ctx, "surface/cave-mouth.png", C.CAVE_MOUTH_COL * 80, 8, 80, 80);
  }
  const r0 = Math.max(1, Math.floor(s.camera.y / 80)),
    r1 = Math.min(s.coreRow, Math.ceil((s.camera.y + 664) / 80)),
    c0 = Math.max(0, Math.floor(s.camera.x / 80)),
    c1 = Math.min(31, Math.ceil((s.camera.x + 1280) / 80));
  for (let r = r0; r <= r1; r++)
    for (let c = c0; c <= c1; c++) {
      const v = M.at(s, c, r),
        x = c * 80,
        y = r * 80;
      image(
        ctx,
        `tiles/${v.band ?? "coreshell"}-${(c * 17 + r * 7) % C.TILE_VARIANTS}.png`,
        x,
        y,
        80,
        80,
      );
      if (v.kind === "tunnel" || v.kind === "lava") {
        ctx.save();
        ctx.beginPath();
        const open = (dc: number, dr: number) =>
          M.at(s, c + dc, r + dr).kind === v.kind;
        const l = open(-1, 0) ? 0 : 7,
          t = open(0, -1) ? 0 : 7,
          rr = open(1, 0) ? 0 : 7,
          b = open(0, 1) ? 0 : 7;
        ctx.roundRect(x + l, y + t, 80 - l - rr, 80 - t - b, [
          t && l ? 10 : 0,
          t && rr ? 10 : 0,
          b && rr ? 10 : 0,
          b && l ? 10 : 0,
        ]);
        ctx.clip();
        image(
          ctx,
          v.kind === "lava"
            ? `hazards/lava/frame0${Math.floor(s.simTime * 6) % 3}.png`
            : "tiles/tunnel.png",
          x,
          y,
          80,
          80,
        );
        ctx.restore();
        for (const [dx, dy] of [
          [-1, -1],
          [1, -1],
          [1, 1],
          [-1, 1],
        ])
          if (open(dx, 0) && open(0, dy) && !open(dx, dy)) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(x, y, 80, 80);
            ctx.clip();
            ctx.beginPath();
            ctx.arc(
              x + (dx > 0 ? 80 : 0),
              y + (dy > 0 ? 80 : 0),
              9,
              0,
              Math.PI * 2,
            );
            ctx.clip();
            image(
              ctx,
              `tiles/${v.band ?? "coreshell"}-${(c * 17 + r * 7) % C.TILE_VARIANTS}.png`,
              x,
              y,
              80,
              80,
            );
            ctx.restore();
          }
      } else if (v.kind === "bedrock")
        image(ctx, "tiles/bedrock.png", x, y, 80, 80);
      else if (v.kind === "stone")
        image(ctx, `tiles/stone-${(c + r) % 2}.png`, x, y, 80, 80);
      else if (v.kind === "ore") image(ctx, `ore/${v.ore}.png`, x, y, 80, 80);
      else if (v.kind === "material" || v.kind === "core")
        image(ctx, `materials/${v.material ?? "core"}.png`, x, y, 80, 80);
      const cut = s.miner.drilling;
      if (
        cut?.dir === "down" &&
        cut.col === c &&
        cut.row === r &&
        v.health !== null
      ) {
        const h = M.clamp(s.miner.y + C.MINER_H - y, 0, 80);
        if (h > 0) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(x + 7, y, 66, h);
          ctx.clip();
          image(ctx, "tiles/tunnel.png", x, y, 80, 80);
          ctx.restore();
        }
      }
      if (v.kind === "gas")
        fx(
          ctx,
          "gas-seep",
          x + 40,
          y + 40,
          (s.simTime + (c + r) * 0.21) % C.GAS_SEEP_PERIOD,
          c + r,
          100,
        );
      if (v.health && v.maxHealth && v.health < v.maxHealth)
        image(
          ctx,
          `tiles/crack/frame0${Math.min(3, Math.floor((1 - v.health / v.maxHealth) * 4))}.png`,
          x,
          y,
          80,
          80,
        );
      ctx.strokeStyle = "#0a182725";
      ctx.strokeRect(x + 0.5, y + 0.5, 79, 79);
    }
  const m = s.miner,
    n =
      m.state === "walk"
        ? 4
        : ["drill-down", "drill-side", "jetpack"].includes(m.state)
          ? 3
          : 2,
    frame =
      m.state === "hurt"
        ? Math.min(n - 1, Math.floor((C.HURT_TIME - s.hurt) * C.ANIM_FPS))
        : Math.floor(s.animTime * C.ANIM_FPS) % n;
  if (m.drilling)
    fx(
      ctx,
      "drill-debris",
      m.drilling.dir === "down"
        ? m.x + 40
        : m.x + (m.facing === "east" ? 56 : 0),
      m.drilling.dir === "down" ? m.y + C.MINER_H : m.y + 44,
      (s.simTime % 0.5) + 0.02,
      Math.floor(s.simTime * 2),
      140,
    );
  if (m.state === "jetpack")
    fx(
      ctx,
      "jetpack-exhaust",
      m.x + 15,
      m.y + 80,
      (s.simTime % 0.5) + 0.02,
      4,
      120,
    );
  ctx.save();
  ctx.translate(m.x + 28, m.y - 8);
  if (m.facing === "west") ctx.scale(-1, 1);
  image(ctx, `miner/${m.state}/frame0${frame}.png`, -40, 0, 80, 80);
  ctx.restore();
  if (s.coreGround) {
    image(
      ctx,
      "materials/core-sample.png",
      s.coreGround.col * 80,
      s.coreGround.row * 80,
      80,
      80,
    );
    text(
      ctx,
      `${Math.ceil(s.coreTimer ?? 0)}s`,
      s.coreGround.col * 80,
      s.coreGround.row * 80,
      20,
      accent,
    );
  }
  for (const e of s.effects)
    fx(
      ctx,
      e.name,
      e.x,
      e.y,
      e.age,
      e.seed,
      e.name === "core-detonation" ? 600 : 220,
    );
  ctx.restore();
}
function hud(s: M.ReadState, ctx: CanvasRenderingContext2D) {
  box(ctx, 0, 0, 1280, 56, "#10232c", "#3d5255");
  for (const [x, name, value, max, col] of [
    [20, "fuel", s.miner.fuel, M.maxFuel(s), "#dfb36b"],
    [225, "hull", s.miner.hull, M.maxHull(s), "#8dc4b4"],
  ] as const) {
    image(ctx, `icons/${name}.png`, x, 16, 24, 24);
    text(
      ctx,
      `${name.toUpperCase()} ${Math.ceil(value)}/${max}`,
      x + 32,
      22,
      12,
    );
    ctx.fillStyle = "#273e47";
    ctx.fillRect(x + 32, 31, 145, 5);
    ctx.fillStyle = value / max < 0.25 ? "#f18365" : col;
    ctx.fillRect(x + 32, 31, 145 * M.clamp(value / max, 0, 1), 5);
  }
  image(ctx, "icons/cargo.png", 430, 16, 24, 24);
  text(
    ctx,
    cargoLabel(s),
    460,
    30,
    13,
    M.load(s) >= M.jet(s).liftLimitKg ? "#ed8968" : ink,
  );
  image(ctx, "icons/credits.png", 680, 16, 24, 24);
  text(ctx, `${Math.floor(s.credits)}`, 710, 30, 15, accent);
  image(ctx, "icons/depth.png", 795, 16, 24, 24);
  text(ctx, `${Math.floor(M.depth(s))} m`, 824, 30, 15);
  for (const [i, k] of C.MATERIALS.entries()) {
    image(ctx, `icons/${k}.png`, 912 + i * 38, 16, 24, 24);
    if (!s.satchel[k]) {
      ctx.fillStyle = "#10232cbb";
      ctx.fillRect(912 + i * 38, 16, 24, 24);
    }
  }
}
function drawControls(s: M.ReadState, ctx: CanvasRenderingContext2D) {
  for (const c of controls(s)) {
    box(
      ctx,
      c.x,
      c.y,
      c.w,
      c.h,
      c.enabled ? "#29434a" : "#1a2d35",
      c.enabled ? "#759085" : "#34444b",
    );
    text(ctx, c.label, c.x + 12, c.y + 22, 13, c.enabled ? accent : "#60767b");
  }
}
function panel(s: M.ReadState, ctx: CanvasRenderingContext2D) {
  if (!s.panel) return;
  ctx.fillStyle = "#06151bbb";
  ctx.fillRect(0, 56, 1280, 664);
  box(ctx, 180, 130, 920, 510, "#142b35", "#70817a");
  text(ctx, s.panel.replace(/-/g, " ").toUpperCase(), 220, 183, 28);
  text(ctx, "ESC TO CLOSE", 920, 180, 12, muted);
  ctx.fillStyle = "#3b5157";
  ctx.fillRect(220, 202, 840, 1);
  if (s.panel === "fuel-depot") {
    text(
      ctx,
      "Keep enough in the tank for the climb home.",
      230,
      237,
      16,
      muted,
    );
    text(
      ctx,
      `FUEL  ${Math.ceil(s.miner.fuel)} / ${M.maxFuel(s)}   ·   1 CR / unit`,
      230,
      293,
      20,
    );
    text(
      ctx,
      `HULL  ${Math.ceil(s.miner.hull)} / ${M.maxHull(s)}   ·   2 CR / point`,
      230,
      413,
      20,
    );
  }
  if (s.panel === "upgrade-shop")
    C.TRACKS.forEach((t, i) => {
      text(
        ctx,
        `${t.toUpperCase()}   TIER ${s.tiers[t]} / ${C.MAX_TIER[t]}`,
        230,
        257 + i * 51,
        17,
      );
      const effects: Record<C.TrackName, string> = {
        fuel: `Tank ${C.FUEL_TIERS[Math.min(4, s.tiers.fuel)]}`,
        drill: `Damage ${C.DRILL_DAMAGE_TIERS[Math.min(4, s.tiers.drill)]}`,
        cargo: `Slots ${C.CARGO_TIERS[Math.min(4, s.tiers.cargo)]}`,
        hull: `Armor ${C.HULL_TIERS[Math.min(4, s.tiers.hull)]}`,
        jetpack: `Lift ${C.JETPACK_TIERS[Math.min(4, s.tiers.jetpack)].liftLimitKg} kg`,
        radiator: `Heat reduction ${C.RADIATOR_TIERS[Math.min(4, s.tiers.radiator)] * 100}%`,
        scanner: `Range ${C.SCANNER_TIERS[Math.min(2, s.tiers.scanner)]} tiles`,
      };
      text(ctx, effects[t], 560, 257 + i * 51, 14, muted);
    });
  if (s.panel === "supply-depot")
    C.ITEMS.forEach((t, i) => {
      text(ctx, `${i + 1}  ${t.name}`, 230, 267 + i * 56, 17);
      text(ctx, `HELD ${s.items[t.id]}`, 670, 267 + i * 56, 13, muted);
    });
  if (s.panel === "launch-pad") {
    C.ROCKET_COMPONENTS.forEach((c, i) => {
      text(
        ctx,
        `${i < s.installed ? "✓" : "0" + (i + 1)}  ${c.name}`,
        230,
        255 + i * 55,
        20,
        i < s.installed ? "#87cfb1" : ink,
      );
      text(
        ctx,
        `${c.credits} CR${c.material ? " + " + c.material.toUpperCase() : ""}`,
        540,
        255 + i * 55,
        14,
        muted,
      );
    });
  }
  if (s.panel === "ore-market" || s.panel === "inventory") {
    const minerals = C.MINERALS.filter((m) => s.cargo[m.id]);
    if (!minerals.length) text(ctx, "Cargo bay is empty.", 230, 255, 18, muted);
    minerals.forEach((m, i) => {
      image(ctx, `ore/${m.id}.png`, 225, 215 + i * 25, 30, 30);
      text(
        ctx,
        `${m.name.padEnd(10)} ×${s.cargo[m.id]}   ${(s.cargo[m.id] ?? 0) * m.weightKg} kg`,
        263,
        250 + i * 25,
        14,
      );
    });
    text(ctx, cargoLabel(s), 230, 590, 16, accent);
    if (s.panel === "ore-market")
      text(
        ctx,
        `TOTAL  ${C.MINERALS.reduce((a, m) => a + (s.cargo[m.id] ?? 0) * m.value, 0)} CR`,
        710,
        530,
        23,
        accent,
      );
    else {
      text(ctx, "FIELD SUPPLIES", 730, 245, 16, accent);
      C.ITEMS.forEach((t, i) =>
        text(
          ctx,
          `${i + 1} ${t.name.slice(0, 19)} ×${s.items[t.id]}`,
          710,
          292 + i * 40,
          12,
        ),
      );
      text(
        ctx,
        `RESONITE ${s.satchel.resonite}   CRYENITE ${s.satchel.cryenite}`,
        230,
        620,
        13,
        muted,
      );
    }
  }
}
export function render(s: M.ReadState, api: RenderApi) {
  const ctx = api.ctx;
  ctx.imageSmoothingEnabled = false;
  world(s, ctx);
  if (s.screen === "in-mine" || s.screen === "paused") {
    hud(s, ctx);
    if (!s.panel && s.screen === "in-mine") {
      const b = M.buildings.find(
        (b) =>
          s.miner.x + 56 >= b.x &&
          s.miner.x <= b.x + b.w &&
          s.miner.y + 72 <= 81,
      );
      if (b) {
        box(ctx, 390, 635, 500, 42, "#10242de8");
        text(
          ctx,
          `[E] ${b.id.replace(/-/g, " ").toUpperCase()}`,
          420,
          663,
          18,
          accent,
        );
      }
      text(
        ctx,
        "A D  MOVE / DRILL    S  DIG DOWN    W / SPACE  JETPACK",
        20,
        702,
        12,
        muted,
      );
      const scan = M.scanner(s);
      if (scan.locked)
        text(
          ctx,
          `SCANNER  ${scan.target?.toUpperCase()}  ${scan.distanceTiles?.toFixed(1)} tiles  ${scan.dirY > 0 ? "↓" : "↑"}${scan.dirX > 0 ? "→" : "←"}`,
          30,
          98,
          18,
          "#8de5cb",
        );
    }
    panel(s, ctx);
    drawControls(s, ctx);
    if (s.coreTimer !== null && s.satchel.coreSample) {
      box(ctx, 450, 76, 380, 60, "#4d2929", "#ed9673");
      text(
        ctx,
        `UNSTABLE CORE  ${Math.ceil(s.coreTimer)}s`,
        475,
        104,
        23,
        accent,
      );
      text(ctx, "J · JETTISON SAMPLE", 475, 124, 12);
    }
    if (s.notice && s.notice.age >= C.NOTICE_DELAY) {
      box(ctx, 240, 590, 880, 82, "#22383a", "#dca66d");
      text(
        ctx,
        s.notice.hazard === "gas"
          ? "VOLATILE GAS · Look for the faint seep. Upgrade your hull."
          : "MOLTEN ROCK · Find a way around, or upgrade your radiator.",
        265,
        623,
        15,
        accent,
      );
    }
    if (s.noteTime > 0) {
      box(ctx, 390, 100, 500, 42);
      text(ctx, s.note, 410, 128, 15, accent);
    }
  }
  if (s.screen !== "in-mine") {
    ctx.fillStyle = s.screen === "paused" ? "#06151bcc" : "#0a1c27ed";
    ctx.fillRect(0, 56, 1280, 664);
    // Editorial title composition over a framed geological cross section.
    text(ctx, "Nº 07  /  OUTER COLONIES MINING DIVISION", 100, 104, 12, accent);
    text(ctx, "D E E P C O R E", 96, 220, 66, ink, "Impact, sans-serif");
    text(ctx, "THE WAY OUT IS DOWN.", 102, 264, 17, accent);
    ctx.fillStyle = "#57716f";
    ctx.fillRect(100, 293, 410, 1);
    let subtitle = "One prospector. A dead world. One last way home.";
    if (s.screen === "mode-select") subtitle = "CHOOSE YOUR EXPEDITION";
    if (s.screen === "size-select") subtitle = "HOW FAR WILL YOU GO?";
    if (s.screen === "paused") subtitle = "EXPEDITION PAUSED";
    if (s.screen === "game-over")
      subtitle = "SIGNAL LOST · " + (s.summary?.deathCause ?? "");
    if (s.screen === "victory") subtitle = "ESCAPE CONFIRMED";
    text(ctx, subtitle, 100, 338, 14, muted);
    if (s.screen === "mode-select") {
      text(
        ctx,
        "STANDARD · Return to your last save after death.",
        570,
        435,
        15,
      );
      text(ctx, "HARDCORE · Death erases your save.", 570, 485, 15, "#dd9d7a");
    }
    if (s.screen === "size-select") {
      text(ctx, "QUICK       1,250 m  /  A concentrated descent", 570, 425, 16);
      text(ctx, "STANDARD    2,500 m  /  The full expedition", 570, 480, 16);
      text(ctx, "MARATHON    5,000 m  /  Into the long dark", 570, 535, 16);
    }
    if (s.screen === "title") {
      box(ctx, 710, 142, 440, 440, "#152a32", "#56645d");
      text(ctx, "STRATIGRAPHY / SECTOR 07", 735, 175, 12, accent);
      for (let b = 0; b < 4; b++) {
        for (let c = 0; c < 5; c++)
          image(
            ctx,
            `tiles/${C.BANDS[b]}-${c % 3}.png`,
            730 + c * 80,
            198 + b * 80,
            80,
            80,
          );
        image(ctx, `ore/${C.ORE_IDS[b * 3]}.png`, 810, 198 + b * 80, 80, 80);
        image(ctx, "tiles/tunnel.png", 970, 198 + b * 80, 62, 80);
        text(
          ctx,
          `${["I", "II", "III", "IV"][b]}`,
          744,
          225 + b * 80,
          14,
          "#dfd2ac",
        );
      }
      image(ctx, "miner/jetpack/frame01.png", 955, 285, 80, 80);
      image(ctx, "materials/core.png", 965, 498, 80, 80);
      text(ctx, "DRILL. HAUL. BUILD. ESCAPE.", 745, 564, 13, accent);
    }
    if (s.screen === "how-to-play") {
      const lines = [
        "A / D  Walk and drill sideways · S / ↓  Drill down",
        "W / ↑ / SPACE  Jetpack · E  Activate a building",
        "I  Inventory · 1–6  Supplies · J  Jettison · M  Mute",
        "Dig ore. Fly home. Sell, refuel, repair, and upgrade.",
        "Cargo slots fill quickly; heavy ore can exceed your lift.",
        "Watch fuel: gravity is free, the climb home is not.",
        "Gas seeps. Lava burns. Falling fast damages your hull.",
        "Buy a scanner to find Resonite and Cryenite.",
        "Build five rocket components; bring a Core Sample home.",
        "The Sample lasts 90 seconds. Save only at the Save Pad.",
        "Standard keeps your save. Hardcore death erases it.",
      ];
      lines.forEach((l, i) =>
        text(ctx, l, 570, 190 + i * 36, 14, i < 3 ? accent : ink),
      );
    }
    if (s.summary) {
      text(
        ctx,
        `${Math.floor(s.summary.deepestDepthMeters)} m REACHED`,
        650,
        385,
        28,
        accent,
      );
      text(ctx, `${s.summary.creditsEarned} CR EARNED`, 650, 430, 20);
      text(
        ctx,
        `${Math.floor(s.summary.elapsedSeconds / 60)}m ${Math.floor(s.summary.elapsedSeconds % 60)}s  ·  ${s.mode.toUpperCase()}`,
        650,
        470,
        18,
      );
      text(ctx, `${s.installed} / 5 ROCKET COMPONENTS`, 650, 510, 18);
    }
    menu(s).forEach((t, i) => {
      const r = menuRect(s, i)!;
      box(
        ctx,
        r.x,
        r.y,
        r.w,
        r.h,
        i === s.menuIndex ? "#d6b779" : "#17303a",
        i === s.menuIndex ? "#f1d39a" : "#3a5158",
      );
      text(
        ctx,
        `${i === s.menuIndex ? "›" : " "} ${t}`,
        r.x + 18,
        r.y + 31,
        18,
        i === s.menuIndex ? "#172c35" : ink,
      );
    });
    text(ctx, "↑ ↓  SELECT    ENTER  CONFIRM", 100, 692, 12, muted);
    text(ctx, "EST. 2186  ·  NO RESCUE EXPECTED", 925, 692, 11, muted);
  }
}
