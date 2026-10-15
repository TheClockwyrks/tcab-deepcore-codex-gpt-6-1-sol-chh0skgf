/** Development-only capture caller. Uses the same engine and public debug surface as tests. */
import { createEngine, ConstantClock } from "@clockwyrks/simple-2d";
import { game, BACKGROUND } from "../src/game";
import * as C from "../src/constants";
export async function capture() {
  const canvas = document.createElement("canvas");
  canvas.style.cssText =
    "position:fixed;inset:0;width:100vw;height:100vh;z-index:10";
  document.body.append(canvas);
  const events = new EventTarget();
  const engine = createEngine({
    canvas,
    width: C.STAGE_W,
    height: C.STAGE_H,
    game,
    background: BACKGROUND,
    clock: new ConstantClock(1000 / 30),
    surface: {
      cssWidth: () => C.STAGE_W,
      cssHeight: () => C.STAGE_H,
      dpr: () => 1,
      events: () => events,
    },
  });
  await engine.initialize();
  const d = engine.debug;
  engine.apply((s) => d.setWorldSize(s, "quick"));
  engine.apply((s) => d.generateMine(s));
  engine.apply((s) => d.setScreen(s, "in-mine"));
  engine.apply((s) => d.setTier(s, "fuel", 5));
  engine.apply((s) => d.setFuel(s, 550));
  engine.apply((s) => d.setTier(s, "drill", 3));
  engine.apply((s) => d.setTier(s, "hull", 5));
  engine.apply((s) => d.setHull(s, 450));
  engine.apply((s) => d.setTier(s, "scanner", 2));
  for (let r = 1; r < 78; r++)
    engine.apply((s) => d.setTile(s, 16, r, "tunnel"));
  for (let c = 13; c < 20; c++)
    for (let r = 74; r < 77; r++)
      engine.apply((s) => d.setTile(s, c, r, "tunnel"));
  engine.apply((s) =>
    d.setMinerPosition(s, 16 * C.TILE + 12, 78 * C.TILE - C.MINER_H),
  );
  engine.apply((s) => d.setOreTile(s, 16, 78, "argenite"));
  engine.apply((s) => d.setOreTile(s, 16, 79, "cobaltine"));
  engine.apply((s) => d.setTile(s, 16, 80, "rock"));
  engine.apply((s) => d.setMaterialTile(s, 19, 80, "resonite"));
  for (const [c, r, o] of [
    [14, 78, "cuprite"],
    [18, 77, "argenite"],
    [19, 79, "verdite"],
    [13, 80, "cobaltine"],
  ] as const)
    engine.apply((s) => d.setOreTile(s, c, r, o));
  const key = (code: string, down: boolean) => {
    const e = new Event(down ? "keydown" : "keyup");
    Object.assign(e, { code, repeat: false });
    events.dispatchEvent(e);
  };
  await engine.advance(1);
  engine.startRecording();
  key("KeyS", true);
  await engine.advance(42);
  key("KeyS", false);
  await engine.advance(4);
  const mine = canvas.toDataURL("image/png");
  key("Space", true);
  await engine.advance(70);
  key("Space", false);
  await engine.advance(10);
  const recording = engine.stopRecording();
  engine.destroy();
  canvas.remove();
  return { recording, mine };
}
