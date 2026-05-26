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

  return {
    rows: RAW_MAP.length,
    cols: RAW_MAP[0].length,
    walls,
    pellets,
    powerPellets,
    playerStart,
    ghostStarts: [...ghostStarts, ...extraGhosts],
  };
}

function makeGhosts(level, board) {
  return board.ghostStarts.map((start, index) => ({
    id: index,
    pos: clonePos(start),
    start: clonePos(start),
    dir: ['left', 'right', 'up', 'down'][index % 4],
    color: GHOST_COLORS[index % GHOST_COLORS.length],
    mode: 'scatter',
    speedBias: Math.min(0.28 + level * 0.025, 0.55),
  }));
}

function loadScores() {
  try {
    return JSON.parse(localStorage.getItem(BOARD_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveScore(name, score, level) {
  const safeName = (name || 'PLAYER').trim().slice(0, 12).toUpperCase() || 'PLAYER';
  const next = [...loadScores(), { name: safeName, score, level, date: new Date().toISOString() }]
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
  localStorage.setItem(BOARD_KEY, JSON.stringify(next));
  return next;
}

function canMove(board, pos) {
  if (pos.r < 0 || pos.c < 0 || pos.r >= board.rows || pos.c >= board.cols) return false;
  return !board.walls.has(posKey(pos));
}

function nextPos(pos, dir) {
  const delta = DIRS[dir];
  return { r: pos.r + delta.r, c: pos.c + delta.c };
}

function availableDirs(board, pos, currentDir) {
  const reverse = { up: 'down', down: 'up', left: 'right', right: 'left' }[currentDir];
  return Object.keys(DIRS).filter((dir) => dir !== reverse && canMove(board, nextPos(pos, dir)));
}

function chooseGhostDir(board, ghost, player, frightened, tick) {
  const options = availableDirs(board, ghost.pos, ghost.dir);
  const legal = options.length ? options : Object.keys(DIRS).filter((dir) => canMove(board, nextPos(ghost.pos, dir)));
  if (!legal.length) return ghost.dir;

  if (frightened) {
    return legal.sort((a, b) => {
      const pa = nextPos(ghost.pos, a);
      const pb = nextPos(ghost.pos, b);
      const da = Math.abs(pa.r - player.r) + Math.abs(pa.c - player.c);
      const db = Math.abs(pb.r - player.r) + Math.abs(pb.c - player.c);
      return db - da;
    })[0];
  }

  if (tick % 5 === ghost.id) return legal[Math.floor(Math.random() * legal.length)];

  return legal.sort((a, b) => {
    const pa = nextPos(ghost.pos, a);
    const pb = nextPos(ghost.pos, b);
    const da = Math.abs(pa.r - player.r) + Math.abs(pa.c - player.c);
    const db = Math.abs(pb.r - player.r) + Math.abs(pb.c - player.c);
    return da - db;
  })[0];
}

function App() {
  const board = useMemo(parseBoard, []);
  const [level, setLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [player, setPlayer] = useState(board.playerStart);
  const [direction, setDirection] = useState('left');
  const [queuedDirection, setQueuedDirection] = useState('left');
  const [pellets, setPellets] = useState(() => new Set(board.pellets));
  const [powerPellets, setPowerPellets] = useState(() => new Set(board.powerPellets));
  const [ghosts, setGhosts] = useState(() => makeGhosts(1, board));
  const [frightenedUntil, setFrightenedUntil] = useState(0);
  const [status, setStatus] = useState('ready');
  const [message, setMessage] = useState('Press Start or an arrow key to play.');
  const [tick, setTick] = useState(0);
  const [scores, setScores] = useState(loadScores);
  const [initials, setInitials] = useState('PLAYER');
  const [submitted, setSubmitted] = useState(false);
  const tickRef = useRef(0);

  const highScore = scores[0]?.score || 0;
  const remainingDots = pellets.size + powerPellets.size;
  const frightened = frightenedUntil > tick;

  const resetPositions = useCallback((nextLives = lives) => {
    setPlayer(board.playerStart);
    setDirection('left');
    setQueuedDirection('left');
    setGhosts(makeGhosts(level, board));
    setFrightenedUntil(0);
    setLives(nextLives);
  }, [board, level, lives]);

  const startLevel = useCallback((nextLevel) => {
    const freshBoard = parseBoard();
    setLevel(nextLevel);
    setPellets(new Set(freshBoard.pellets));
    setPowerPellets(new Set(freshBoard.powerPellets));
    setPlayer(freshBoard.playerStart);
    setGhosts(makeGhosts(nextLevel, freshBoard));
    setDirection('left');
    setQueuedDirection('left');
    setFrightenedUntil(0);
    setStatus('playing');
    setMessage(`Level ${nextLevel}: clear every dot and dodge the ghosts.`);
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

  const stepGame = useCallback(() => {
    if (status !== 'playing') return;
    const currentTick = tickRef.current + 1;
    tickRef.current = currentTick;
    setTick(currentTick);

    setPlayer((currentPlayer) => {
      let nextDirection = direction;
      if (canMove(board, nextPos(currentPlayer, queuedDirection))) nextDirection = queuedDirection;
      const candidate = nextPos(currentPlayer, nextDirection);
      const movedPlayer = canMove(board, candidate) ? candidate : currentPlayer;
      setDirection(nextDirection);

      const key = posKey(movedPlayer);
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
      return movedPlayer;
    });

    setGhosts((currentGhosts) => currentGhosts.map((ghost) => {
      const shouldMove = Math.random() < ghost.speedBias || currentTick % Math.max(2, 5 - Math.min(level, 3)) === 0;
      if (!shouldMove) return ghost;
      const ghostDir = chooseGhostDir(board, ghost, player, frightenedUntil > currentTick, currentTick);
      const candidate = nextPos(ghost.pos, ghostDir);
      return { ...ghost, dir: ghostDir, pos: canMove(board, candidate) ? candidate : ghost.pos };
    }));
  }, [board, direction, frightenedUntil, level, pellets, player, powerPellets, queuedDirection, status]);

  useEffect(() => {
    if (status !== 'playing') return;
    const speed = Math.max(95, 190 - level * 12);
    const interval = window.setInterval(stepGame, speed);
    return () => window.clearInterval(interval);
  }, [level, status, stepGame]);

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
      setMessage(`Ouch. ${nextLives} ${nextLives === 1 ? 'life' : 'lives'} left.`);
      resetPositions(nextLives);
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
      setQueuedDirection(dir);
      if (status === 'ready') setStatus('playing');
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [status]);

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
          <p className="instructions">Pac-Man-style arcade play: use arrow keys or WASD, eat power pellets, chase blue ghosts, and climb the scoreboard.</p>
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
        <button onClick={() => { setQueuedDirection('up'); if (status === 'ready') setStatus('playing'); }} aria-label="Move up">↑</button>
        <div className="middle-row">
          <button onClick={() => { setQueuedDirection('left'); if (status === 'ready') setStatus('playing'); }} aria-label="Move left">←</button>
          <button onClick={() => { setQueuedDirection('down'); if (status === 'ready') setStatus('playing'); }} aria-label="Move down">↓</button>
          <button onClick={() => { setQueuedDirection('right'); if (status === 'ready') setStatus('playing'); }} aria-label="Move right">→</button>
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
