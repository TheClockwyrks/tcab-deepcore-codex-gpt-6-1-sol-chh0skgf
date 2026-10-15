# One-time asset authoring

These recipes were run during creation of Deepcore. They require the temporary asset-generation CLI tools and Python 3. The application and `npm run build` do not call them.

Run in order from `/work` to author another art pass:

```sh
python3 tools/art.py
python3 tools/refine_art.py
python3 tools/sound.py
python3 tools/effects.py
```

The pixel-art recipes construct tool action logs and render them with `draw` and `draw-sheet`. The audio recipes layer synthesized voices, sampled mechanical transients, and a sequenced D-minor music bed. The effects recipe authors each live particle system with its own emission, lifetime, speed, palette, and plume or blast shape. Intermediate authoring files land in `artwork/`; only the finished assets are required by the game.

`capture.ts` is a development-only browser caller that creates an engine, arranges a mine with the public debug surface, drives keyboard events against a counted clock, and captures a short live replay. It is independent of the production entry point and publishes no debugging handle to the page.
