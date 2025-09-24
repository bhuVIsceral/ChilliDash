# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

Project overview
- Static browser game (HTML5 Canvas) with no build toolchain. Everything runs directly in the browser.
- External libraries loaded via CDN in index.html:
  - Tone.js for sound effects
  - Tailwind CSS (utility classes on a few UI elements)
- Source layout:
  - index.html: page shell and UI overlays (start/game-over, score/powerups/flavours)
  - css/styles.css: visual theme, overlays, indicators, and FX (hit pause, screen shake)
  - js/main.js: all game logic (loop, input, physics-ish, spawning, rendering, audio)

How to run
- Easiest: open index.html in a browser (double-click). If you encounter issues with assets or audio, use a local HTTP server instead (recommended).
- Serve locally (pick one, depending on what you have installed):
  - Python 3 (Windows):
    pwsh> py -m http.server 8080
    Then open http://localhost:8080
  - Node.js (npx http-server):
    pwsh> npx http-server -c-1 .
    Then open the printed URL (typically http://127.0.0.1:8080). The -c-1 disables caching while iterating.
  - Node.js (npx serve):
    pwsh> npx serve -l 8080 .
    Then open http://localhost:8080

Build, lint, tests
- There is no build step, no package manager, no linter, and no test suite configured in this repo.

High-level architecture (big picture)
- Game state and loop
  - requestAnimationFrame drives animate(), which calls update() and draw().
  - A separate requestAnimationFrame loop smooths lane transitions in updatePlayerPosition().
  - gameState toggles between 'start', 'playing', and 'gameOver'. startGame()/restartGame() set up state and hide/show overlays.
- Player and lanes
  - Three lanes centered on the canvas; lanes = [-150, 0, 150].
  - Player stores lane index, target x, jump state/timer, and yOffset for jump arc.
  - Smooth horizontal easing towards targetLaneX; jump uses a sine curve over JUMP_DURATION.
- Spawning and progression
  - Obstacles and collectibles spawn on timers (nextObstacleTime/nextCollectibleTime) with randomized intervals.
  - gameSpeed ramps from 240 up to MAX_SPEED over SPEED_RAMP_DURATION, influencing vertical motion.
- Power-ups and flavours
  - powerups map tracks three effects: 'hot-sauce' (speed burst), 'gochujang' (shield), 'chilli-lime' (magnet). Each has duration/cooldown and active flag.
  - Collecting all three flavours grants a chilliTrioBonus. Active power-ups are shown in #powerupDisplay with remaining seconds.
- Input handling
  - Touch and mouse gestures are mapped to left/right swipes (lane change) and up swipe (jump). No keyboard input is wired.
- Rendering
  - draw() clears the canvas, paints lane backgrounds, collectibles (emoji), obstacles (rects), player (emoji), and overlays effects (shield/magnet aura).
  - CSS provides UI overlays (start/game over), score/powerup indicators, and small animations (hit pause, screen shake).
- Audio (Tone.js)
  - Simple synthesizers for SFX: pickup, shield-hit, fail, woosh, with tuned envelopes.

Operational notes and pitfalls
- Audio unlock: Browsers often require a user gesture to start WebAudio. If you hear no sound, click “Start Game” or interact with the canvas first.
- Canvas sizing: resizeCanvas() fits within the container; player position and parallax depend on current canvas dimensions.
- Extending the game: If you split main.js into modules or add assets, remember there is no bundler—include additional <script> tags in index.html or introduce a build step.
