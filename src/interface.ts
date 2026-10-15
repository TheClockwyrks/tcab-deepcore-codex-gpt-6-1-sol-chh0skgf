import * as C from "./constants";
import {
  type ReadState,
  type Rect,
  clone,
  start,
  resume,
  transact,
  slots,
  load,
  maxFuel,
  maxHull,
  jet,
} from "./model";
export function menu(s: ReadState): readonly string[] {
  switch (s.screen) {
    case "title":
      return s.hasSave ? C.TITLE_ITEMS : C.TITLE_ITEMS.slice(1);
    case "mode-select":
      return C.MODE_ITEMS;
    case "size-select":
      return C.SIZE_ITEMS;
    case "how-to-play":
      return C.HOW_TO_PLAY_ITEMS;
    case "paused":
      return C.PAUSE_ITEMS;
    case "victory":
      return C.VICTORY_ITEMS;
    case "game-over":
      return s.hasSave && s.mode === "standard"
        ? C.GAME_OVER_SAVE_ITEMS
        : C.GAME_OVER_ITEMS;
    default:
      return [];
  }
}
export function menuRect(s: ReadState, index: number): Rect | null {
  return index >= 0 && index < menu(s).length
    ? {
        x: 100,
        y: (s.screen === "how-to-play" ? 605 : 382) + index * 62,
        w: 410,
        h: 48,
      }
    : null;
}
export function choose(state: ReadState) {
  const s = clone(state),
    item = menu(s)[s.menuIndex];
  s.menuIndex = 0;
  if (s.screen === "title") {
    if (item === "CONTINUE") return resume(s);
    s.screen = item === "HOW TO PLAY" ? "how-to-play" : "mode-select";
  } else if (s.screen === "mode-select") {
    if (item === "BACK") {
      s.screen = "title";
      s.menuIndex = s.hasSave ? 1 : 0;
    } else {
      s.mode = item === "HARDCORE" ? "hardcore" : "standard";
      s.screen = "size-select";
    }
  } else if (s.screen === "size-select") {
    if (item === "BACK") {
      s.screen = "mode-select";
      s.menuIndex = C.MODES.indexOf(s.mode);
    } else {
      s.worldSize =
        C.WORLD_SIZES[
          C.SIZE_ITEMS.indexOf(item as (typeof C.SIZE_ITEMS)[number])
        ];
      return start(s);
    }
  } else if (s.screen === "how-to-play") {
    s.screen = "title";
    s.menuIndex = s.hasSave ? 2 : 1;
  } else if (s.screen === "paused") {
    if (item === "RESUME") s.screen = "in-mine";
    else if (item === "RESTART") return start(s);
    else {
      s.screen = "title";
      s.menuIndex = s.hasSave ? 1 : 0;
    }
  } else if (s.screen === "game-over" || s.screen === "victory") {
    if (item === "CONTINUE FROM SAVE") return resume(s);
    if (item === "PLAY AGAIN") return start(s);
    s.screen = "title";
    s.menuIndex = s.hasSave ? 1 : 0;
  }
  return s;
}
export interface Control extends Rect {
  op: string;
  subject: string | null;
  label: string;
  enabled: boolean;
}
export function controls(s: ReadState): Control[] {
  const list: Control[] = [];
  const add = (
    op: string,
    subject: string | null,
    label: string,
    x: number,
    y: number,
    w = 140,
    enabled = true,
  ) => list.push({ op, subject, label, x, y, w, h: 32, enabled });
  if (s.screen !== "in-mine") return list;
  add("inventory", null, "[I] CARGO", 1010, 12, 110);
  add("pause", null, "Ⅱ", 1130, 12, 45);
  add("mute", null, s.muted ? "♪ OFF" : "♪", 1186, 12, 70);
  if (s.notice && s.notice.age >= C.NOTICE_DELAY)
    add("dismiss-notice", null, "DISMISS", 980, 620, 130);
  if (s.panel) add("close-panel", null, "×", 1045, 150, 32);
  const x = 850;
  if (s.panel === "fuel-depot") {
    add(
      "buy-fuel",
      null,
      "+25 FUEL",
      x,
      270,
      190,
      s.credits > 0 && s.miner.fuel < maxFuel(s),
    );
    add(
      "fill-fuel",
      null,
      "FILL TANK",
      x,
      318,
      190,
      s.credits > 0 && s.miner.fuel < maxFuel(s),
    );
    add(
      "buy-repair",
      null,
      "+25 HULL",
      x,
      390,
      190,
      s.credits > 0 && s.miner.hull < maxHull(s),
    );
    add(
      "repair-full",
      null,
      "FULL REPAIR",
      x,
      438,
      190,
      s.credits > 0 && s.miner.hull < maxHull(s),
    );
  }
  if (s.panel === "ore-market")
    add("sell", null, C.SELL, x, 560, 190, slots(s) > 0);
  if (s.panel === "upgrade-shop")
    C.TRACKS.forEach((t, i) =>
      add(
        "buy-upgrade",
        t,
        `BUY · ${C.UPGRADE_PRICES[s.tiers[t] - 1] ?? "MAX"}`,
        x,
        235 + i * 51,
        190,
        s.tiers[t] < C.MAX_TIER[t] &&
          s.credits >= C.UPGRADE_PRICES[s.tiers[t] - 1],
      ),
    );
  if (s.panel === "supply-depot")
    C.ITEMS.forEach((t, i) =>
      add(
        "buy-item",
        t.id,
        `BUY · ${t.price}`,
        x,
        245 + i * 56,
        190,
        s.credits >= t.price,
      ),
    );
  if (s.panel === "launch-pad") {
    const c = C.ROCKET_COMPONENTS[s.installed];
    add(
      c ? "fabricate" : "launch",
      null,
      c ? C.FABRICATE : C.LAUNCH,
      x,
      560,
      190,
      !c ||
        (s.credits >= c.credits &&
          (!c.material ||
            (c.material === "core-sample"
              ? s.satchel.coreSample
              : s.satchel[c.material] > 0))),
    );
  }
  if (s.panel === "inventory") {
    C.MINERALS.filter((m) => s.cargo[m.id]).forEach((m, i) =>
      add("drop-ore", m.id, "DROP", 600, 230 + i * 25, 70),
    );
    C.ITEMS.forEach((m, i) => {
      if (s.items[m.id]) add("use-item", m.id, C.USE, 965, 270 + i * 40, 75);
    });
    if (s.satchel.coreSample) add("jettison", null, C.JETTISON, 820, 560, 210);
  }
  return list;
}
export function act(
  s: ReturnType<typeof clone>,
  op: string,
  subject: string | null,
) {
  if (op === "close-panel") s.panel = null;
  else if (op === "inventory")
    s.panel = s.panel === "inventory" ? null : "inventory";
  else if (op === "pause") {
    s.screen = "paused";
    s.menuIndex = 0;
  } else transact(s, op, subject);
}
export function cargoLabel(s: ReadState) {
  return `${slots(s)}/${C.CARGO_TIERS[s.tiers.cargo - 1]}  ·  ${load(s)} kg${load(s) >= jet(s).liftLimitKg ? "  " + C.OVERLOAD : ""}`;
}
