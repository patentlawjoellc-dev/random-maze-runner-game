import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const RAW_MAP = [
  '###################',
  '#........#........#',
  '#.###.##.#.##.###.#',
  '#o#.....P.....#o#.#',
  '#.###.#.###.#.###.#',
  '#.....#..#..#.....#',
  '#####.## # ##.#####',
  '    #.#     #.#    ',
  '#####.# ### #.#####',
  '     .  # #  .     ',
  '#####.# ### #.#####',
  '    #.#     #.#    ',
  '#####.# ### #.#####',
  '#........#........#',
  '#.###.##.#.##.###.#',
  '#o..#....G....#..o#',
  '###.#.#.###.#.#.###',
  '#.....#..#..#.....#',
  '#.#######.#######.#',
  '#.................#',
  '###################',
];

const DIRS = {
  up: { r: -1, c: 0 },
  down: { r: 1, c: 0 },
  left: { r: 0, c: -1 },
  right: { r: 0, c: 1 },
};

const KEY_TO_DIR = {
  ArrowUp: 'up', w: 'up', W: 'up',
  ArrowDown: 'down', s: 'down', S: 'down',
  ArrowLeft: 'left', a: 'left', A: 'left',
  ArrowRight: 'right', d: 'right', D: 'right',
};

const GHOST_COLORS = ['#ff4d6d', '#4dd8ff', '#ffb84d', '#c084fc'];
const BOARD_KEY = 'arcadeChompHighScores';

function clonePos(pos) { return { r: pos.r, c: pos.c }; }
function posKey(pos) { return `${pos.r},${pos.c}`; }
function samePos(a, b) { return a.r === b.r && a.c === b.c; }
function distance(a, b) { return Math.abs(a.r - b.r) + Math.abs(a.c - b.c); }

function normalizeHorizontal(board, pos) {
  if (pos.c < 0) return { r: pos.r, c: board.cols - 1 };
  if (pos.c >= board.cols) return { r: pos.r, c: 0 };
  return pos;
}

function canMove(board, pos) {
  const normalized = normalizeHorizontal(board, pos);
  if (normalized.r < 0 || normalized.r >= board.rows) return false;
  return !board.walls.has(posKey(normalized));
}

function moveWithWrap(board, pos, dir) {
  const delta = DIRS[dir];
  const candidate = normalizeHorizontal(board, { r: pos.r + delta.r, c: pos.c + delta.c });
  return canMove(board, candidate) ? candidate : pos;
}

function reachableFrom(board, start) {
  const seen = new Set([posKey(start)]);
  const queue = [start];
  while (queue.length) {
    const current = queue.shift();
    Object.keys(DIRS).forEach((dir) => {
      const next = moveWithWrap(board, current, dir);
      const key = posKey(next);
      if (!seen.has(key)) {
        seen.add(key);
        queue.push(next);
      }
    });
  }
  return seen;
}

function parseBoard() {
  const walls = new Set();
  const pellets = new Set();
  const powerPellets = new Set();
  let playerStart = { r: 3, c: 9 };
  const ghostStarts = [];

  RAW_MAP.forEach((row, r) => {
    [...row].forEach((char, c) => {
      if (char === '#') walls.add(`${r},${c}`);
      if (char === '.') pellets.add(`${r},${c}`);
      if (char === 'o') powerPellets.add(`${r},${c}`);
      if (char === 'P') playerStart = { r, c };
      if (char === 'G') ghostStarts.push({ r, c });
    });
  });

  const extraGhosts = [
    { r: 9, c: 8 },
    { r: 9, c: 10 },
    { r: 7, c: 9 },
  ];

  const board = {
    rows: RAW_MAP.length,
    cols: RAW_MAP[0].length,
    walls,
    pellets,
    powerPellets,
    playerStart,
    ghostStarts: [...ghostStarts, ...extraGhosts],
    reachable: new Set(),
    openCells: [],
  };

  board.reachable = reachableFrom(board, playerStart);
  board.pellets = new Set([...pellets].filter((key) => board.reachable.has(key)));
  board.powerPellets = new Set([...powerPellets].filter((key) => board.reachable.has(key)));
  board.openCells = [...board.reachable].map((key) => {
    const [r, c] = key.split(',').map(Number);
    return { r, c };
  });

  return board;
}

function makeGhosts(level, board) {
  return board.ghostStarts.map((start, index) => ({
    id: index,
    pos: clonePos(start),
    start: clonePos(start),
    dir: ['left', 'right', 'up', 'down'][index % 4],
    color: GHOST_COLORS[index % GHOST_COLORS.length],
    speedBias: Math.min(0.24 + level * 0.022, 0.5),
  }));
}

function randomSpawn(board, ghosts = []) {
  const safe = board.openCells.filter((cell) => (
    distance(cell, board.playerStart) > 2 &&
    ghosts.every((ghost) => distance(cell, ghost.pos) > 5) &&
    board.ghostStarts.every((ghostStart) => distance(cell, ghostStart) > 4)
  ));
  const pool = safe.length ? safe : board.openCells;
  return clonePos(pool[Math.floor(Math.random() * pool.length)] || board.playerStart);
}

function loadScores() {
  try { return JSON.parse(localStorage.getItem(BOARD_KEY) || '[]'); }
  catch { return []; }
}

function saveScore(name, score, level) {
  const safeName = (name || 'PLAYER').trim().slice(0, 12).toUpperCase() || 'PLAYER';
  const next = [...loadScores(), { name: safeName, score, level, date: new Date().toISOString() }]
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
  localStorage.setItem(BOARD_KEY, JSON.stringify(next));
  return next;
}

function playToneSequence(notes) {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  const context = new AudioContext();
  let time = context.currentTime;
  notes.forEach(([frequency, duration, type = 'square']) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, time);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.08, time + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(time);
    oscillator.stop(time + duration + 0.02);
    time += duration * 0.88;
  });
  window.setTimeout(() => context.close(), Math.ceil((time - context.currentTime + 0.2) * 1000));
}

function playDeathSound() {
  playToneSequence([[440, .12], [330, .12], [220, .16], [140, .22, 'sawtooth']]);
}

function playGameOverSound() {
  playToneSequence([[220, .18, 'sawtooth'], [185, .2, 'sawtooth'], [146, .24, 'sawtooth'], [98, .36, 'sawtooth']]);
}

function availableDirs(board, pos, currentDir) {
  const reverse = { up: 'down', down: 'up', left: 'right', right: 'left' }[currentDir];
  return Object.keys(DIRS).filter((dir) => dir !== reverse && !samePos(moveWithWrap(board, pos, dir), pos));
}

function chooseGhostDir(board, ghost, player, frightened, tick) {
  const options = availableDirs(board, ghost.pos, ghost.dir);
  const legal = options.length ? options : Object.keys(DIRS).filter((dir) => !samePos(moveWithWrap(board, ghost.pos, dir), ghost.pos));
  if (!legal.length) return ghost.dir;

  if (frightened) {
    return legal.sort((a, b) => distance(moveWithWrap(board, ghost.pos, b), player) - distance(moveWithWrap(board, ghost.pos, a), player))[0];
  }

  if (tick % 5 === ghost.id) return legal[Math.floor(Math.random() * legal.length)];
  return legal.sort((a, b) => distance(moveWithWrap(board, ghost.pos, a), player) - distance(moveWithWrap(board, ghost.pos, b), player))[0];
}

function App() {
  const board = useMemo(parseBoard, []);
  const [level, setLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [player, setPlayer] = useState(board.playerStart);
  const [direction, setDirection] = useState('right');
  const [pellets, setPellets] = useState(() => new Set(board.pellets));
  const [powerPellets, setPowerPellets] = useState(() => new Set(board.powerPellets));
  const [ghosts, setGhosts] = useState(() => makeGhosts(1, board));
  const [frightenedUntil, setFrightenedUntil] = useState(0);
  const [status, setStatus] = useState('ready');
  const [message, setMessage] = useState('Press Start or an arrow key to play. Pac stays still until you move.');
  const [tick, setTick] = useState(0);
  const [scores, setScores] = useState(loadScores);
  const [initials, setInitials] = useState('PLAYER');
  const [submitted, setSubmitted] = useState(false);
  const tickRef = useRef(0);

  const highScore = scores[0]?.score || 0;
  const remainingDots = pellets.size + powerPellets.size;
  const frightened = frightenedUntil > tick;

  const collectAt = useCallback((pos, currentTick) => {
    const key = posKey(pos);
    if (pellets.has(key)) {
      setPellets((previous) => {
        const next = new Set(previous);
        next.delete(key);
        return next;
      });
      setScore((value) => value + 10);
    }
    if (powerPellets.has(key)) {
      setPowerPellets((previous) => {
        const next = new Set(previous);
        next.delete(key);
        return next;
      });
      setScore((value) => value + 50);
      setFrightenedUntil(currentTick + Math.max(18, 34 - level));
      setMessage('Power pellet! Eat the ghosts while they are blue.');
    }
  }, [level, pellets, powerPellets]);

  const resetPositions = useCallback((nextLives = lives, currentGhosts = ghosts) => {
    setGhosts(makeGhosts(level, board));
    setPlayer(randomSpawn(board, currentGhosts));
    setDirection('right');
    setFrightenedUntil(0);
    setLives(nextLives);
  }, [board, ghosts, level, lives]);

  const startLevel = useCallback((nextLevel) => {
    const freshBoard = parseBoard();
    setLevel(nextLevel);
    setPellets(new Set(freshBoard.pellets));
    setPowerPellets(new Set(freshBoard.powerPellets));
    setPlayer(freshBoard.playerStart);
    setGhosts(makeGhosts(nextLevel, freshBoard));
    setDirection('right');
    setFrightenedUntil(0);
    setStatus('playing');
    setMessage(`Level ${nextLevel}: clear every reachable dot and dodge the ghosts.`);
    setSubmitted(false);
  }, []);

  const newGame = useCallback(() => {
    setScore(0);
    setLives(3);
    setTick(0);
    tickRef.current = 0;
    startLevel(1);
  }, [startLevel]);

  const endGame = useCallback(() => {
    playGameOverSound();
    setStatus('gameover');
    setMessage('Game over. Enter your name for the scoreboard.');
    setSubmitted(false);
  }, []);

  const handleSubmitScore = useCallback((event) => {
    event.preventDefault();
    const updated = saveScore(initials, score, level);
    setScores(updated);
    setSubmitted(true);
    setMessage('Score saved. Start a new game whenever you are ready.');
  }, [initials, level, score]);

  const movePlayer = useCallback((dir) => {
    if (status === 'ready') setStatus('playing');
    if (status !== 'playing' && status !== 'ready') return;
    const currentTick = tickRef.current + 1;
    tickRef.current = currentTick;
    setTick(currentTick);
    setDirection(dir);
    setPlayer((currentPlayer) => {
      const movedPlayer = moveWithWrap(board, currentPlayer, dir);
      collectAt(movedPlayer, currentTick);
      return movedPlayer;
    });
  }, [board, collectAt, status]);

  const stepGhosts = useCallback(() => {
    if (status !== 'playing') return;
    const currentTick = tickRef.current + 1;
    tickRef.current = currentTick;
    setTick(currentTick);
    setGhosts((currentGhosts) => currentGhosts.map((ghost) => {
      const shouldMove = Math.random() < ghost.speedBias || currentTick % Math.max(2, 5 - Math.min(level, 3)) === 0;
      if (!shouldMove) return ghost;
      const ghostDir = chooseGhostDir(board, ghost, player, frightenedUntil > currentTick, currentTick);
      return { ...ghost, dir: ghostDir, pos: moveWithWrap(board, ghost.pos, ghostDir) };
    }));
  }, [board, frightenedUntil, level, player, status]);

  useEffect(() => {
    if (status !== 'playing') return;
    const speed = Math.max(105, 210 - level * 10);
    const interval = window.setInterval(stepGhosts, speed);
    return () => window.clearInterval(interval);
  }, [level, status, stepGhosts]);

  useEffect(() => {
    if (status !== 'playing') return;
    const collision = ghosts.find((ghost) => samePos(ghost.pos, player));
    if (!collision) return;

    if (frightened) {
      setScore((value) => value + 200);
      setGhosts((current) => current.map((ghost) => ghost.id === collision.id ? { ...ghost, pos: clonePos(ghost.start), dir: 'left' } : ghost));
      setMessage('Ghost captured! +200');
      return;
    }

    const nextLives = lives - 1;
    if (nextLives <= 0) {
      setLives(0);
      endGame();
    } else {
      playDeathSound();
      setMessage(`Ouch. Random respawn! ${nextLives} ${nextLives === 1 ? 'life' : 'lives'} left.`);
      resetPositions(nextLives, ghosts);
    }
  }, [endGame, frightened, ghosts, lives, player, resetPositions, status]);

  useEffect(() => {
    if (status === 'playing' && remainingDots === 0) {
      setScore((value) => value + level * 500);
      setStatus('level-complete');
      setMessage(`Level ${level} cleared! Bonus awarded.`);
    }
  }, [level, remainingDots, status]);

  useEffect(() => {
    const onKeyDown = (event) => {
      const dir = KEY_TO_DIR[event.key];
      if (!dir) return;
      event.preventDefault();
      movePlayer(dir);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [movePlayer]);

  const cells = [];
  for (let r = 0; r < board.rows; r++) {
    for (let c = 0; c < board.cols; c++) {
      const pos = { r, c };
      const key = posKey(pos);
      const ghost = ghosts.find((g) => samePos(g.pos, pos));
      const isPlayer = samePos(player, pos);
      const classes = [
        'tile',
        board.walls.has(key) && 'wall',
        !board.walls.has(key) && 'path',
        pellets.has(key) && 'has-pellet',
        powerPellets.has(key) && 'has-power',
      ].filter(Boolean).join(' ');

      cells.push(
        <div className={classes} key={key} role="gridcell">
          {pellets.has(key) && <span className="pellet" />}
          {powerPellets.has(key) && <span className="power-pellet" />}
          {ghost && <span className={`ghost ${frightened ? 'frightened' : ''}`} style={{ '--ghost-color': ghost.color }} />}
          {isPlayer && <span className={`player ${direction}`} />}
        </div>
      );
    }
  }

  return (
    <main className="app-shell">
      <section className="hero-card">
        <div>
          <p className="eyebrow">Arcade Chomp</p>
          <h1>Clear the dots. Dodge the ghosts.</h1>
          <p className="instructions">Use arrow keys or WASD. Pac only moves when you press a key, side tunnels wrap across the board, and every visible pellet is reachable.</p>
        </div>
        <div className="stats" aria-label="Game stats">
          <span>Score <strong>{score}</strong></span>
          <span>High Score <strong>{highScore}</strong></span>
          <span>Level <strong>{level}</strong></span>
          <span>Lives <strong>{'❤'.repeat(lives) || '0'}</strong></span>
        </div>
      </section>

      <section className="game-layout">
        <div className="game-card">
          <div className="board" style={{ gridTemplateColumns: `repeat(${board.cols}, 1fr)` }} role="grid" aria-label="Arcade maze board">
            {cells}
          </div>
          {status !== 'playing' && (
            <div className="overlay" role="status" aria-live="polite">
              <h2>{status === 'level-complete' ? 'Level Complete!' : status === 'gameover' ? 'Game Over' : 'Ready?'}</h2>
              <p>{message}</p>
              {status === 'ready' && <button onClick={() => setStatus('playing')}>Start</button>}
              {status === 'level-complete' && <button onClick={() => startLevel(level + 1)}>Next Level</button>}
              {status === 'gameover' && !submitted && (
                <form onSubmit={handleSubmitScore} className="score-form">
                  <label htmlFor="initials">Name for scoreboard</label>
                  <input id="initials" value={initials} maxLength={12} onChange={(event) => setInitials(event.target.value)} />
                  <button type="submit">Save Score</button>
                </form>
              )}
              {status === 'gameover' && submitted && <button onClick={newGame}>New Game</button>}
            </div>
          )}
        </div>

        <aside className="scoreboard">
          <h2>Scoreboard</h2>
          <ol>
            {scores.length ? scores.map((entry, index) => (
              <li key={`${entry.name}-${entry.score}-${index}`}>
                <span>{entry.name}</span>
                <strong>{entry.score}</strong>
                <em>Lvl {entry.level}</em>
              </li>
            )) : <li className="empty">No scores yet.</li>}
          </ol>
          <div className="legend">
            <p><span className="legend-dot pellet" /> Pellet: 10</p>
            <p><span className="legend-dot power-pellet" /> Power: 50</p>
            <p><span className="legend-ghost" /> Blue ghosts are edible.</p>
          </div>
        </aside>
      </section>

      <section className="controls" aria-label="Game controls">
        <button onClick={() => movePlayer('up')} aria-label="Move up">↑</button>
        <div className="middle-row">
          <button onClick={() => movePlayer('left')} aria-label="Move left">←</button>
          <button onClick={() => movePlayer('down')} aria-label="Move down">↓</button>
          <button onClick={() => movePlayer('right')} aria-label="Move right">→</button>
        </div>
      </section>

      <section className="actions">
        <button className="secondary" onClick={() => startLevel(level)}>Restart Level</button>
        <button className="secondary" onClick={newGame}>New Game</button>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
