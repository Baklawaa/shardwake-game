# Shardwake

A mobile-first, low-poly survival game built with the Canvas 2D API and no external dependencies.

## Files

- `index.html` — accessible interface and screens
- `styles.css` — responsive visual system and touch controls
- `game.js` — gameplay loop, rendering, enemies, boss, upgrades and input
- `storage.js` — persistent profile, ranks and achievements
- `meta.js` — hangar, missions, settings and menu interactions
- `manifest.json` / `sw.js` — installable, offline-capable PWA
- `assets/shardwake-ocean.webp` — optimized generated low-poly ocean artwork used by the canvas renderer
- `assets/shardwake-ship.png` — transparent generated player craft shared by gameplay and Hangar preview

## Game systems

The game includes persistent core upgrades, claimable daily missions, achievements,
five wake signatures, three procedural biomes, weather, ranged enemies, hostile
projectiles with a graze mechanic, relic drops, and a three-phase Leviathan boss.
The interface supports portrait and landscape play, safe-area insets, edge-docked
controls, and blocks accidental text selection or long-press callouts on mobile.
Enemy silhouettes are unlocked permanently in the Codex when first encountered.
Runs begin with a short background title sequence and a safe exploration window
before the first enemy arrives; the end-of-run screen is intentionally compact.
The background renderer deliberately avoids extra procedural islands and polygon
overlays so the authored ocean artwork remains clear and visually coherent.

Serve the folder over HTTP for local development. GitHub Pages deploys `main` automatically.
