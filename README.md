# Shardwake

A mobile-first, low-poly survival game built with the Canvas 2D API and no external dependencies.

## Files

- `index.html` — accessible interface and screens
- `styles.css` — responsive visual system and touch controls
- `game.js` — gameplay loop, rendering, enemies, boss, upgrades and input
- `storage.js` — persistent profile, ranks and achievements
- `meta.js` — hangar, missions, settings and menu interactions
- `manifest.json` / `sw.js` — installable, offline-capable PWA
- The game background is a coherent animated triangular ocean mesh rendered directly by Canvas.
- The player craft is a custom faceted vector model rendered directly by Canvas in gameplay and Hangar.
- `assets/shardwake-mark.svg` — scalable game mark used by the home title lockup and browser favicon
- `assets/icons/` — 180, 192, 512 and maskable PWA icon exports

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
Pulse uses layered polygon shock fronts; Dash uses directional streaks and ship
afterimages. The interface follows an opaque naval-instrument design system with
cut corners, technical linework, cyan controls, and orange signal accents.
Multi-touch input uses one pointer owner for steering and global release/cancel
recovery, preventing movement from remaining latched after Pulse or Dash.

Serve the folder over HTTP for local development. GitHub Pages deploys `main` automatically.
