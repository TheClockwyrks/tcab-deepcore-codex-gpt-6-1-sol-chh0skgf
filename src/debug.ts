import * as C from "./constants";
import * as M from "./model";
import { controls, menu, menuRect } from "./interface";
type S = M.ReadState;
function edit(s: S, f: (n: M.DeepcoreState) => void) {
  const n = M.clone(s);
  f(n);
  return n;
}
function valid(value: number, min = 0, max = Infinity) {
  if (!Number.isFinite(value) || value < min || value > max)
    throw Error("Value outside domain");
}
function member<T extends string>(v: T, values: readonly T[]) {
  if (!values.includes(v)) throw Error("Unknown identifier");
}
function put(s: S, c: number, r: number, v: M.Cell) {
  valid(c, 0, 31);
  valid(r, 1, s.coreRow);
  if (!Number.isInteger(c) || !Number.isInteger(r))
    throw Error("Cell coordinates must be integers");
  return edit(s, (n) => {
    n.grid[r * 32 + c] = v;
  });
}
const tx = (op: string) => (s: S) => edit(s, (n) => M.transact(n, op));
export const debug = {
  version: C.DEEPCORE_DEBUG_VERSION,
  snapshot: M.snapshot,
  tileAt: M.at,
  findTile(s: S, kind: C.TileKind) {
    member(kind, C.TILE_KINDS);
    const p = M.minerCell(s);
    return (
      s.grid
        .flatMap((v, i) =>
          v.kind === kind ? [{ col: i % 32, row: Math.floor(i / 32) }] : [],
        )
        .sort(
          (a, b) =>
            Math.hypot(a.col - p.col, a.row - p.row) -
            Math.hypot(b.col - p.col, b.row - p.row),
        )[0] ?? null
    );
  },
  buildings: (_s: S) => M.buildings.map((b) => ({ ...b })),
  menuItemRect: menuRect,
  controlRect(s: S, control: string, subject: string | null) {
    const c = controls(s).find(
      (c) => c.op === control && c.subject === subject,
    );
    return c ? { x: c.x, y: c.y, w: c.w, h: c.h } : null;
  },
  reset(s: S) {
    const n = M.initial();
    n.muted = s.muted;
    n.hasSave = s.hasSave;
    return n;
  },
  reconcile: (s: S) => M.clone(s),
  generateMine: (s: S) => edit(s, M.generate),
  clearMine: (s: S) =>
    edit(s, (n) => {
      n.grid = M.emptyGrid(n.coreRow);
    }),
  clearCargo: (s: S) =>
    edit(s, (n) => {
      n.cargo = {};
    }),
  clearItems: (s: S) =>
    edit(s, (n) => {
      for (const k of C.ITEM_IDS) n.items[k] = 0;
    }),
  setTile(s: S, c: number, r: number, kind: C.TileKind) {
    member(kind, C.TILE_KINDS);
    if (kind === "ore" || kind === "material")
      throw Error("Use the dedicated cell pose");
    return put(s, c, r, M.cell(kind, M.bandAt(r, s.coreRow)));
  },
  setOreTile(s: S, c: number, r: number, ore: C.OreId) {
    member(
      ore,
      C.MINERALS.map((m) => m.id),
    );
    return put(s, c, r, M.cell("ore", M.bandAt(r, s.coreRow), ore));
  },
  setMaterialTile(s: S, c: number, r: number, material: C.MaterialId) {
    member(material, C.MATERIALS);
    return put(
      s,
      c,
      r,
      M.cell("material", M.bandAt(r, s.coreRow), null, material),
    );
  },
  setTileHealth(s: S, c: number, r: number, health: number) {
    const v = M.at(s, c, r);
    if (v.maxHealth === null) throw Error("Not minable");
    valid(health, Number.MIN_VALUE, v.maxHealth);
    return put(s, c, r, { ...v, health });
  },
  placeCoreSample(s: S, col: number, row: number) {
    if (s.coreTimer !== null || M.at(s, col, row).kind !== "tunnel")
      throw Error("Sample needs open cell and no live sample");
    return edit(s, (n) => {
      n.coreGround = { col, row };
      n.coreTimer = C.CORE_TIMER;
    });
  },
  setMinerPosition: (s: S, x: number, y: number) =>
    edit(s, (n) => {
      valid(x, -Infinity);
      valid(y, -Infinity);
      n.miner.x = x;
      n.miner.y = y;
    }),
  setMinerVelocity: (s: S, vx: number, vy: number) =>
    edit(s, (n) => {
      valid(vx, -Infinity);
      valid(vy, -Infinity);
      n.miner.vx = vx;
      n.miner.vy = vy;
    }),
  setFacing: (s: S, facing: C.Facing) =>
    edit(s, (n) => {
      member(facing, C.FACINGS);
      n.miner.facing = facing;
    }),
  setFuel: (s: S, value: number) =>
    edit(s, (n) => {
      valid(value);
      n.miner.fuel = value;
    }),
  setHull: (s: S, value: number) =>
    edit(s, (n) => {
      valid(value);
      n.miner.hull = value;
    }),
  setMinerTravel: (s: S, v: boolean) =>
    edit(s, (n) => {
      n.miner.travel = v;
    }),
  setMinerDrill: (s: S, v: boolean) =>
    edit(s, (n) => {
      n.miner.drill = v;
    }),
  setScreen: (s: S, v: C.ScreenName) =>
    edit(s, (n) => {
      member(v, C.SCREENS);
      n.screen = v;
    }),
  setPanel: (s: S, v: C.PanelId | null) =>
    edit(s, (n) => {
      if (v) member(v, C.PANELS);
      n.panel = v;
    }),
  setMenuIndex: (s: S, v: number) =>
    edit(s, (n) => {
      valid(v, 0, menu(n).length - 1);
      n.menuIndex = v;
    }),
  setMode: (s: S, v: C.Mode) =>
    edit(s, (n) => {
      member(v, C.MODES);
      n.mode = v;
    }),
  setWorldSize: (s: S, v: C.WorldSize) =>
    edit(s, (n) => {
      member(v, C.WORLD_SIZES);
      n.worldSize = v;
      n.coreRow = Math.round(C.STANDARD_ROWS * C.WORLD_SIZE_SCALE[v]);
      const grid = M.emptyGrid(n.coreRow);
      for (let r = 1; r < Math.min(s.coreRow, n.coreRow); r++)
        for (let c = 0; c < 32; c++)
          grid[r * 32 + c] = { ...s.grid[r * 32 + c] };
      n.grid = grid;
    }),
  setCredits: (s: S, v: number) =>
    edit(s, (n) => {
      valid(v);
      n.credits = v;
    }),
  setTier: (s: S, t: C.TrackName, v: number) =>
    edit(s, (n) => {
      member(t, C.TRACKS);
      valid(v, 1, C.MAX_TIER[t]);
      n.tiers[t] = v;
      n.miner.fuel = Math.min(n.miner.fuel, M.maxFuel(n));
      n.miner.hull = Math.min(n.miner.hull, M.maxHull(n));
    }),
  setCargo: (s: S, t: C.OreId, v: number) =>
    edit(s, (n) => {
      member(
        t,
        C.MINERALS.map((o) => o.id),
      );
      valid(v);
      n.cargo[t] = v;
    }),
  setMaterial: (s: S, t: C.MaterialId, v: number) =>
    edit(s, (n) => {
      member(t, C.MATERIALS);
      valid(v);
      n.satchel[t] = v;
    }),
  setCoreCarried: (s: S, v: boolean) =>
    edit(s, (n) => {
      if (v && n.coreTimer !== null) throw Error("Sample already live");
      n.satchel.coreSample = v;
      n.coreTimer = v ? C.CORE_TIMER : null;
    }),
  setCoreTimer: (s: S, v: number) =>
    edit(s, (n) => {
      if (n.coreTimer === null) throw Error("No live sample");
      valid(v, Number.MIN_VALUE);
      n.coreTimer = v;
    }),
  setItemCount: (s: S, t: C.ItemId, v: number) =>
    edit(s, (n) => {
      member(t, C.ITEM_IDS);
      valid(v);
      n.items[t] = v;
    }),
  setRocketInstalled: (s: S, v: number) =>
    edit(s, (n) => {
      valid(v, 0, 5);
      n.installed = v;
    }),
  setNoticeFired: (s: S, h: C.NoticeHazard, v: boolean) =>
    edit(s, (n) => {
      member(h, C.NOTICE_HAZARDS);
      n.noticesFired[h] = v;
    }),
  setCameraLead: (s: S, v: number) =>
    edit(s, (n) => {
      valid(v, -C.CAM_LEAD_MAX, C.CAM_LEAD_MAX);
      n.camera.lead = v;
    }),
  setElapsed: (s: S, v: number) =>
    edit(s, (n) => {
      valid(v);
      n.elapsedSeconds = v;
    }),
  setNextTeleportHeight: (s: S, v: number | null) =>
    edit(s, (n) => {
      if (v !== null)
        valid(v, C.TELEPORT_HEIGHT_TILES_MIN, C.TELEPORT_HEIGHT_TILES_MAX);
      n.nextTeleportHeight = v;
    }),
  setNextTeleportSpeed: (s: S, v: number | null) =>
    edit(s, (n) => {
      if (v !== null) valid(v, C.TELEPORT_SPEED_MIN, C.TELEPORT_SPEED_MAX);
      n.nextTeleportSpeed = v;
    }),
  clearSave: (s: S) =>
    edit(s, (n) => {
      M.clearStorage();
      n.hasSave = false;
    }),
  dropOre: (s: S, o: C.OreId) => edit(s, (n) => M.transact(n, "drop-ore", o)),
  sell: tx("sell"),
  buyFuel: tx("buy-fuel"),
  fillFuel: tx("fill-fuel"),
  buyRepair: tx("buy-repair"),
  repairFull: tx("repair-full"),
  buyUpgrade: (s: S, t: C.TrackName) =>
    edit(s, (n) => M.transact(n, "buy-upgrade", t)),
  buyItem: (s: S, t: C.ItemId) => edit(s, (n) => M.transact(n, "buy-item", t)),
  useItem: (s: S, t: C.ItemId) => edit(s, (n) => M.transact(n, "use-item", t)),
  jettison: tx("jettison"),
  fabricate: tx("fabricate"),
  launch: tx("launch"),
  save: tx("save"),
  dismissNotice: tx("dismiss-notice"),
};
export type DeepcoreDebugApi = typeof debug;
