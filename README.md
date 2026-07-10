# Shardwake

A mobile-first, low-poly survival game built with the Canvas 2D API and no external dependencies.

## Files

- `index.html` — accessible interface and screens
- `styles.css` — responsive visual system and touch controls
- `game.js` — gameplay loop, rendering, enemies, boss, upgrades and input
- `storage.js` — persistent profile, ranks and achievements
- `meta.js` — hangar, missions, settings and menu interactions
- `manifest.json` / `sw.js` — installable, offline-capable PWA

## Game systems

The game includes persistent core upgrades, claimable daily missions, achievements,
five wake signatures, three procedural biomes, weather, ranged enemies, hostile
projectiles with a graze mechanic, relic drops, and a three-phase Leviathan boss.

Serve the folder over HTTP for local development. GitHub Pages deploys `main` automatically.
