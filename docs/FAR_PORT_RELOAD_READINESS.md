# Far-port reload pixel regression

The failed CI assertion combined world-state and canvas equality after a fixed
70 ms delay. Canvas attachment is not Phaser scene or raster readiness: the
canvas can exist while prop textures are still loading. A controlled real-browser
reproduction holds those requests, keeps the world state byte-identical, and
makes the old sample capture different (unfinished) pixels.

`scripts/helpers/board-readiness.mjs` adds a test-server-only Vite probe exposing
the existing game instance. It does not replace application code or rendering.
The helper waits for fonts, the current attached canvas, an active populated
scene with its loader finished, and then captures the canvas in the next actual
Phaser `postrender` event. It never waits for expected pixels or relaxes equality.
World facts and exact pixel failures have separate assertion messages.

Run:

- `node scripts/board-readiness-test.mjs`
- `node scripts/far-port-visuals-test.mjs`

The focused readiness regression covers delayed asset loading, independently
paused rendering, changed world facts, and a fully rendered but wrong raster.
Only the reproduction of the old bug uses the old 70 ms delay; the repaired
readiness path uses lifecycle conditions and events, with bounded failure timeouts.
The original undelayed script can pass locally, so this is a deterministic
reproduction of the lifecycle race, not a claim to have replayed CI's exact CPU
and network scheduling.
