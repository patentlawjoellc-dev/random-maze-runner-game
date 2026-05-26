import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const directions = [
  { key: 'top', opposite: 'bottom', dr: -1, dc: 0 },
  { key: 'right', opposite: 'left', dr: 0, dc: 1 },
  { key: 'bottom', opposite: 'top', dr: 1, dc: 0 },
  { key: 'left', opposite: 'right', dr: 0, dc: -1 },
];

const moveMap = {
  ArrowUp: 'top', w: 'top', W: 'top',
  ArrowRight: 'right', d: 'right', D: 'right',
  ArrowDown: 'bottom', s: 'bottom', S: 'bottom',
  ArrowLeft: 'left', a: 'left', A: 'left',
};

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function levelSize(level) {
  const rows = Math.min(9 + level * 2, 23);
  const cols = Math.min(9 + level * 2, 27);
  return { rows: rows % 2 ? rows : rows + 1, cols: cols % 2 ? cols : cols + 1 };
}

function makeMaze(level) {
  const { rows, cols } = levelSize(level);
  const grid = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => ({
      r, c, visited: false,
      walls: { top: true, right: true, bottom: true, left: true },
    }))
  );

  const visit = (cell) => {
    cell.visited = true;
    for (const dir of shuffle(directions)) {
      const nr = cell.r + dir.dr;
      const nc = cell.c + dir.dc;
      if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
      const next = grid[nr][nc];
      if (next.visited) continue;
      cell.walls[dir.key] = false;
      next.walls[dir.opposite] = false;
      visit(next);
    }
  };

  visit(grid[0][0]);
  return { grid, rows, cols, start: { r: 0, c: 0 }, end: { r: rows - 1, c: cols - 1 } };
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
  const secs = (seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

function App() {
  const [level, setLevel] = useState(1);
  const [maze, setMaze] = useState(() => makeMaze(1));
  const [player, setPlayer] = useState({ r: 0, c: 0 });
  const [moves, setMoves] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [complete, setComplete] = useState(false);
  const [best, setBest] = useState(() => JSON.parse(localStorage.getItem('mazeBestMoves') || '{}'));

  const bestForLevel = best[level] ?? '—';

  const restartLevel = useCallback(() => {
    const nextMaze = makeMaze(level);
    setMaze(nextMaze);
    setPlayer(nextMaze.start);
    setMoves(0);
    setSeconds(0);
    setComplete(false);
  }, [level]);

  const newGame = useCallback(() => {
    const nextMaze = makeMaze(1);
    setLevel(1);
    setMaze(nextMaze);
    setPlayer(nextMaze.start);
    setMoves(0);
    setSeconds(0);
    setComplete(false);
  }, []);

  const nextLevel = useCallback(() => {
    const next = level + 1;
    const nextMaze = makeMaze(next);
    setLevel(next);
    setMaze(nextMaze);
    setPlayer(nextMaze.start);
    setMoves(0);
    setSeconds(0);
    setComplete(false);
  }, [level]);

  const move = useCallback((dirKey) => {
    if (complete || !dirKey) return;
    const current = maze.grid[player.r][player.c];
    if (current.walls[dirKey]) return;
    const dir = directions.find((item) => item.key === dirKey);
    const next = { r: player.r + dir.dr, c: player.c + dir.dc };
    setPlayer(next);
    setMoves((count) => count + 1);
    if (next.r === maze.end.r && next.c === maze.end.c) {
      setComplete(true);
      setBest((previous) => {
        const oldBest = previous[level];
        if (oldBest && oldBest <= moves + 1) return previous;
        const updated = { ...previous, [level]: moves + 1 };
        localStorage.setItem('mazeBestMoves', JSON.stringify(updated));
        return updated;
      });
    }
  }, [complete, level, maze, moves, player]);

  useEffect(() => {
    const onKeyDown = (event) => {
      const dir = moveMap[event.key];
      if (!dir) return;
      event.preventDefault();
      move(dir);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [move]);

  useEffect(() => {
    if (complete) return;
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [complete, level]);

  const cells = useMemo(() => maze.grid.flat(), [maze]);

  return (
    <main className="app-shell">
      <section className="hero-card">
        <div>
          <p className="eyebrow">Random Maze Runner</p>
          <h1>Escape the maze.</h1>
          <p className="instructions">Use arrow keys or WASD to move from Start to End.</p>
        </div>
        <div className="stats" aria-label="Game stats">
          <span>Level <strong>{level}</strong></span>
          <span>Moves <strong>{moves}</strong></span>
          <span>Best <strong>{bestForLevel}</strong></span>
          <span>Time <strong>{formatTime(seconds)}</strong></span>
        </div>
      </section>

      <section className="game-card">
        <div
          className="maze"
          style={{ gridTemplateColumns: `repeat(${maze.cols}, minmax(10px, 1fr))` }}
          role="grid"
          aria-label={`Randomly generated maze level ${level}`}
        >
          {cells.map((cell) => {
            const isPlayer = player.r === cell.r && player.c === cell.c;
            const isStart = maze.start.r === cell.r && maze.start.c === cell.c;
            const isEnd = maze.end.r === cell.r && maze.end.c === cell.c;
            const classes = ['cell', isStart && 'start', isEnd && 'end', isPlayer && 'player'].filter(Boolean).join(' ');
            return (
              <div
                key={`${cell.r}-${cell.c}`}
                className={classes}
                style={{
                  borderTopWidth: cell.walls.top ? 4 : 1,
                  borderRightWidth: cell.walls.right ? 4 : 1,
                  borderBottomWidth: cell.walls.bottom ? 4 : 1,
                  borderLeftWidth: cell.walls.left ? 4 : 1,
                  borderTopColor: cell.walls.top ? '#f8fbff' : 'rgba(120, 223, 255, 0.08)',
                  borderRightColor: cell.walls.right ? '#f8fbff' : 'rgba(120, 223, 255, 0.08)',
                  borderBottomColor: cell.walls.bottom ? '#f8fbff' : 'rgba(120, 223, 255, 0.08)',
                  borderLeftColor: cell.walls.left ? '#f8fbff' : 'rgba(120, 223, 255, 0.08)',
                }}
                role="gridcell"
                aria-label={isPlayer ? 'Player position' : isStart ? 'Start' : isEnd ? 'End' : 'Open maze cell'}
              >
                {isPlayer ? '●' : isStart ? 'S' : isEnd ? 'E' : ''}
              </div>
            );
          })}
        </div>

        {complete && (
          <div className="win-panel" role="status" aria-live="polite">
            <h2>Congratulations! You escaped the maze!</h2>
            <p>You solved level {level} in {moves} moves and {formatTime(seconds)}.</p>
            <button onClick={nextLevel}>Continue to Level {level + 1}</button>
          </div>
        )}
      </section>

      <section className="controls" aria-label="Game controls">
        <button onClick={() => move('top')} aria-label="Move up">↑</button>
        <div className="middle-row">
          <button onClick={() => move('left')} aria-label="Move left">←</button>
          <button onClick={() => move('down')} aria-label="Move down">↓</button>
          <button onClick={() => move('right')} aria-label="Move right">→</button>
        </div>
      </section>

      <section className="actions">
        <button className="secondary" onClick={restartLevel}>Restart Level</button>
        <button className="secondary" onClick={newGame}>New Game</button>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
