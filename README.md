# Deepcore

A browser mining expedition on a dead industrial world. Drill through four geological strata, haul thirteen minerals back to camp, and turn the proceeds into a five-part escape rocket. Fuel, cargo weight, volcanic hazards, and the unstable Core Sample make every return trip a decision.

## Run

Requires Node.js 22 or newer.

```sh
npm ci
npm run dev
```

Open the local URL Vite prints. The game runs entirely in the browser and needs no services or credentials. Sound unlocks on your first key or pointer gesture.

## Production

```sh
npm run build
npm run preview
```

Serve the contents of `dist/` with any static web server, including under a nested URL path. The build bundles the committed PNG sprites, live particle systems, and WAV audio; it never runs asset-generation tools.

## Controls

| Input | Action |
| --- | --- |
| A / D or ← / → | Walk; drill into a wall while grounded |
| S or ↓ | Drill downward |
| W, ↑, or Space | Fire the jetpack |
| E or Enter | Activate a surface building; confirm a menu choice |
| I | Open or close cargo inventory |
| 1–6 | Use the corresponding field supply |
| J | Jettison a carried Core Sample |
| Escape or P | Close a panel; pause or resume |
| M | Mute all sound |
| Backtick | Engine diagnostics |

Menus support arrow keys and Enter, mouse, and touch. Panel buttons and the status bar support mouse and touch. The miner uses the keyboard. Save at the Save Pad; a live Core Sample prevents saving. Standard mode retains your save after death; Hardcore deletes it.

## Checks and source

```sh
npm run typecheck
npm run lint
npm run format
npm test
```

`src/model.ts` contains world generation, economy, persistence, and observable state. `src/simulation.ts` integrates movement, collisions, mining, and hazards in small time steps. `src/interface.ts` shares menu and control geometry with rendering and automation. `src/debug.ts` supplies pure state transitions through the engine's debug API. `src/visuals.ts` loads produced resources through the engine and draws the world and interface.

Original pixel art, animation frames, particle effects, effects audio, and music were authored during this build with `draw`, `draw-sheet`, `particle-2d`, `sfx-synth`, `sfx-sample`, and `music`. The optional one-time authoring recipes in `tools/` document that process; they are independent of installation and production builds. No asset tools are required to run or rebuild the game.

The `showcase/` directory contains screenshots and a live draw-command replay captured through the engine recorder.
