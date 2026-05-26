# Random Maze Runner — Project Context

## Purpose
A standalone React + Vite browser game where the player navigates a randomly generated 2D maze from Start to End. Completing a level shows a congratulations message and advances to a harder randomly generated level.

## Architecture
- `src/main.jsx`: React app, maze generation, player movement, level progression, localStorage best moves.
- `src/styles.css`: dark arcade visual design and responsive maze layout.
- Static/client-side only; no backend.

## Commands
- `npm install` — install dependencies.
- `npm run dev` — local Vite development server.
- `npm run build` — production build.

## Future-Agent Notes
- Preserve arrow-key and WASD controls.
- Maze generation must always produce solvable mazes; current implementation uses recursive backtracking/DFS.
- Keep the UI responsive and touch-friendly.
- User wants each project to retain its own context in this file.
