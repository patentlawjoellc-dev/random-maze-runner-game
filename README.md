# Arcade Chomp

A Pac-Man-style browser arcade game built with React + Vite. Clear pellets, use power pellets, avoid ghosts, enter your name, and climb the local high-score scoreboard.

This is an original arcade-chase implementation inspired by classic maze-chase mechanics. It does not use copyrighted Pac-Man or Ms. Pac-Man art/audio/assets.

## Gameplay

- Use arrow keys or WASD to move one tile at a time; the character stays still when no key is pressed.
- Eat pellets for points.
- Eat power pellets to turn ghosts blue and make them edible for a short time.
- Use side tunnels to wrap from one side of the board to the other.
- Clear all reachable pellets to advance to the next level.
- Levels increase speed/difficulty.
- You have 3 lives; dying triggers a sound and respawns you at a random safe location.
- Game over has a separate sound.
- On game over, enter your name to save a local high score in browser localStorage.

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

This is a static client-side React/Vite app deployable to Vercel.
