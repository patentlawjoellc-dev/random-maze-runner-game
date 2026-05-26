# Arcade Chomp — Project Context

## Purpose
A standalone React + Vite Pac-Man-style arcade chase game. The player clears pellets, avoids ghosts, eats power pellets, advances through levels, and records high scores locally.

## Important IP Note
Keep this as an original arcade-chase game. Do not copy Pac-Man/Ms. Pac-Man copyrighted assets, exact level art, names, logos, sounds, or sprites. Use original names, CSS shapes, and mechanics inspired by the genre.

## Architecture
- `src/main.jsx`: React app, board map, player movement, ghost AI, score/lives/level progression, localStorage scoreboard.
- `src/styles.css`: arcade visual design, board, pellets, player, ghosts, mobile controls, scoreboard.
- Static/client-side only; no backend.

## Commands
- `npm install` — install dependencies.
- `npm run dev` — local Vite development server.
- `npm run build` — production build.

## Future-Agent Notes
- Preserve keyboard controls: arrow keys and WASD.
- Preserve touch/mobile directional controls.
- Preserve high-score entry and localStorage scoreboard.
- The user wants project-specific context retained in this file and mirrored via `CLOUDCODE.md`.
