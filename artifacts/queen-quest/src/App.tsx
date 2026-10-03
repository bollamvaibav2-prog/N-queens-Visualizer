import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  CircleHelp,
  Copy,
  Crown,
  LockKeyhole,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  Sparkles,
  StepForward,
  Undo2,
  UsersRound,
  X,
} from 'lucide-react';

type Queen = { row: number; col: number; player: number };
type SolverEvent = {
  kind: 'place' | 'conflict' | 'backtrack' | 'solution' | 'complete';
  board: Queen[];
  focus?: { row: number; col: number };
  message: string;
};
type SavedProgress = { unlocked: number; completed: number[]; wins: number; bestTime: number | null };

const LEVELS = [
  { title: 'First Steps', size: 4, detail: 'Four queens, no collisions' },
  { title: 'Finding Rhythm', size: 5, detail: 'One queen in every row' },
  { title: 'Diagonal Drift', size: 6, detail: 'Watch those long diagonals' },
  { title: 'The Long Board', size: 7, detail: 'Seven rows to reason through' },
  { title: 'Eightfold', size: 8, detail: 'The classic eight queens' },
  { title: 'Quiet Mind', size: 8, detail: 'Find another arrangement' },
];
const STORAGE_KEY = 'queen-quest-progress-v1';
const FILE = 'abcdefghijklmnopqrstuvwxyz';

function readProgress(): SavedProgress {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (!value) return { unlocked: 1, completed: [], wins: 0, bestTime: null };
    const parsed = JSON.parse(value) as SavedProgress;
    return {
      unlocked: Math.max(1, Math.min(LEVELS.length, parsed.unlocked || 1)),
      completed: Array.isArray(parsed.completed) ? parsed.completed : [],
      wins: parsed.wins || 0,
      bestTime: parsed.bestTime ?? null,
    };
  } catch {
    return { unlocked: 1, completed: [], wins: 0, bestTime: null };
  }
}

function hasConflict(a: Pick<Queen, 'row' | 'col'>, b: Pick<Queen, 'row' | 'col'>) {
  return a.row === b.row || a.col === b.col || Math.abs(a.row - b.row) === Math.abs(a.col - b.col);
}

function getConflictingIndices(queens: Queen[]) {
  const conflict = new Set<number>();
  for (let i = 0; i < queens.length; i += 1) {
    for (let j = i + 1; j < queens.length; j += 1) {
      if (hasConflict(queens[i], queens[j])) {
        conflict.add(i);
        conflict.add(j);
      }
    }
  }
  return conflict;
}

function buildSolver(size: number): SolverEvent[] {
  const events: SolverEvent[] = [];
  const placed: Queen[] = [];
  const search = (row: number) => {
    if (row === size) {
      events.push({
        kind: 'solution',
        board: placed.map((queen) => ({ ...queen })),
        message: `A complete arrangement. Solution ${events.filter((event) => event.kind === 'solution').length + 1} found.`,
      });
      return;
    }
    for (let col = 0; col < size; col += 1) {
      const conflict = placed.find((queen) => hasConflict(queen, { row, col }));
      if (conflict) {
        events.push({
          kind: 'conflict',
          board: placed.map((queen) => ({ ...queen })),
          focus: { row, col },
          message: `Column ${FILE[col].toUpperCase()} is unsafe in row ${row + 1}; a queen shares its column or diagonal.`,
        });
        continue;
      }
      const queen = { row, col, player: 0 };
      placed.push(queen);
      events.push({
        kind: 'place',
        board: placed.map((item) => ({ ...item })),
        focus: { row, col },
        message: `Try ${FILE[col].toUpperCase()}${row + 1}. No earlier queen can attack this square.`,
      });
      search(row + 1);
      placed.pop();
      events.push({
        kind: 'backtrack',
        board: placed.map((item) => ({ ...item })),
        focus: { row, col },
        message: `Backtrack from ${FILE[col].toUpperCase()}${row + 1}; test the next safe column.`,
      });
    }
  };
  search(0);
  const finalArrangement = [...events].reverse().find((event) => event.kind === 'solution')?.board ?? [];
  events.push({
    kind: 'complete',
    board: finalArrangement,
    message: `Search complete. All ${events.filter((event) => event.kind === 'solution').length} arrangements counted.`,
  });
  return events;
}

function formatTime(ms: number) {
  const seconds = Math.floor(ms / 1000);
  const tenths = Math.floor((ms % 1000) / 100);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}.${tenths}`;
}

function App() {
  const [initialChallenge] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const levelParam = Number(params.get('level'));
    const sizeParam = Number(params.get('size'));
    const index = Number.isInteger(levelParam) && levelParam >= 1 && levelParam <= LEVELS.length
      ? levelParam - 1
      : Math.max(0, LEVELS.findIndex((level) => level.size === sizeParam));
    const challenge = params.get('challenge') === '1';
    return { index, size: challenge && sizeParam >= 4 && sizeParam <= 8 ? sizeParam : null, challenge };
  });
  const [levelIndex, setLevelIndex] = useState(initialChallenge.index);
  const [challengeSize, setChallengeSize] = useState<number | null>(initialChallenge.size);
  const [challengeActive, setChallengeActive] = useState(initialChallenge.challenge);
  const [progress, setProgress] = useState<SavedProgress>(readProgress);
  const [queens, setQueens] = useState<Queen[]>([]);
  const [history, setHistory] = useState<Queen[][]>([]);
  const [notice, setNotice] = useState('Place a queen on the board. Each row, column, and diagonal can hold only one.');
  const [friendMode, setFriendMode] = useState(false);
  const [playerNames, setPlayerNames] = useState(['Avery', 'Morgan']);
  const [turn, setTurn] = useState(0);
  const [copied, setCopied] = useState(false);
  const [winOpen, setWinOpen] = useState(false);
  const [solverEvents, setSolverEvents] = useState<SolverEvent[]>([]);
  const [solverStep, setSolverStep] = useState(0);
  const [solverPlaying, setSolverPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [solverFocus, setSolverFocus] = useState<{ row: number; col: number } | null>(null);
  const [solverNarration, setSolverNarration] = useState('Choose Watch to follow the search, one decision at a time.');
  const [elapsed, setElapsed] = useState(0);
  const runStart = useRef<number | null>(null);
  const manualStart = useRef<number | null>(null);
  const levelSize = challengeSize ?? LEVELS[levelIndex].size;
  const conflicts = useMemo(() => getConflictingIndices(queens), [queens]);
  const isValidWin = queens.length === levelSize && conflicts.size === 0;
  const solverActive = solverEvents.length > 0;
  const currentEvent = solverStep > 0 ? solverEvents[solverStep - 1] : undefined;
  const solverMetrics = useMemo(() => {
    const shown = solverEvents.slice(0, solverStep);
    return {
      attempts: shown.filter((event) => event.kind === 'place' || event.kind === 'conflict').length,
      placed: shown.filter((event) => event.kind === 'place').length,
      backtracks: shown.filter((event) => event.kind === 'backtrack').length,
      solutions: shown.filter((event) => event.kind === 'solution').length,
    };
  }, [solverEvents, solverStep]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  }, [progress]);

  useEffect(() => {
    if (queens.length > 0 && !solverActive && !winOpen) {
      const ticker = window.setInterval(() => {
        if (manualStart.current !== null) setElapsed(Date.now() - manualStart.current);
      }, 100);
      return () => window.clearInterval(ticker);
    }
    return undefined;
  }, [queens.length, solverActive, winOpen]);

  useEffect(() => {
    if (!isValidWin || solverActive) return;
    setNotice('Beautifully done. Every queen has her own row, column, and diagonal.');
    setWinOpen(true);
    const alreadyDone = progress.completed.includes(levelIndex + 1);
    if (!alreadyDone) {
      const finishedTime = manualStart.current === null ? elapsed : Date.now() - manualStart.current;
      setElapsed(finishedTime);
      const completed = [...progress.completed, levelIndex + 1];
      const nextUnlocked = Math.max(progress.unlocked, Math.min(LEVELS.length, levelIndex + 2));
      setProgress((old) => ({
        ...old,
        completed,
        unlocked: nextUnlocked,
        wins: old.wins + 1,
        bestTime: old.bestTime === null ? finishedTime : Math.min(old.bestTime, finishedTime || old.bestTime),
      }));
      manualStart.current = null;
    }
  }, [isValidWin, solverActive, progress.completed, levelIndex, elapsed]);

  useEffect(() => {
    if (!solverPlaying) return;
    const timer = window.setTimeout(() => {
      const nextIndex = Math.min(solverStep + 1, solverEvents.length);
      const event = solverEvents[nextIndex - 1];
      if (event) {
        setQueens(event.board);
        setSolverFocus(event.focus ?? null);
        setSolverNarration(event.message);
        setElapsed(runStart.current === null ? 0 : Date.now() - runStart.current);
      }
      setSolverStep(nextIndex);
      if (nextIndex >= solverEvents.length) {
        setSolverPlaying(false);
        if (runStart.current !== null) setElapsed(Date.now() - runStart.current);
      }
    }, Math.max(120, 820 / speed));
    return () => window.clearTimeout(timer);
  }, [solverPlaying, solverStep, solverEvents, speed]);

  useEffect(() => {
    if (!solverPlaying) return;
    const ticker = window.setInterval(() => {
      if (runStart.current !== null) setElapsed(Date.now() - runStart.current);
    }, 100);
    return () => window.clearInterval(ticker);
  }, [solverPlaying]);

  const beginManual = () => {
    if (solverPlaying || solverActive) {
      setSolverPlaying(false);
      setSolverEvents([]);
      setSolverStep(0);
      setSolverFocus(null);
    }
  };

  const resetBoard = () => {
    beginManual();
    setQueens([]);
    setHistory([]);
    setTurn(0);
    setNotice('Board cleared. Start again whenever you are ready.');
    setWinOpen(false);
    setElapsed(0);
    manualStart.current = null;
  };

  const chooseLevel = (index: number) => {
    if (index + 1 > progress.unlocked && !challengeActive) return;
    setChallengeActive(false);
    setLevelIndex(index);
    setChallengeSize(null);
    setQueens([]);
    setHistory([]);
    setTurn(0);
    setWinOpen(false);
    setSolverEvents([]);
    setSolverStep(0);
    setSolverPlaying(false);
    setSolverFocus(null);
    setElapsed(0);
    manualStart.current = null;
    setNotice('New board, fresh thinking. Place a queen to begin.');
    const url = new URL(window.location.href);
    url.search = '';
    window.history.replaceState({}, '', url);
  };

  const clickCell = (row: number, col: number) => {
    if (solverPlaying) return;
    beginManual();
    const existing = queens.find((queen) => queen.row === row && queen.col === col);
    if (existing) {
      setHistory((old) => [...old, queens.map((queen) => ({ ...queen }))]);
      const next = queens.filter((queen) => queen !== existing);
      setQueens(next);
      setWinOpen(false);
      setNotice('Queen lifted. Undo can restore the previous board.');
      return;
    }
    if (manualStart.current === null) manualStart.current = Date.now();
    const next = [...queens, { row, col, player: friendMode ? turn : 0 }];
    const collision = queens.some((queen) => hasConflict(queen, { row, col }));
    setHistory((old) => [...old, queens.map((queen) => ({ ...queen }))]);
    setQueens(next);
    setWinOpen(false);
    if (friendMode) setTurn((old) => (old + 1) % 2);
    if (collision) {
      setNotice('Conflict. Red marks the queens that can attack each other. Can you spot the line?');
    } else if (next.length === levelSize && getConflictingIndices(next).size === 0) {
      setNotice('All queens are safe. The board is complete.');
    } else {
      setNotice(`${friendMode ? playerNames[turn] : 'Nice move'} — this square is safe so far.`);
    }
  };

  const undo = () => {
    if (!history.length) return;
    beginManual();
    setQueens(history[history.length - 1]);
    setHistory((old) => old.slice(0, -1));
    setWinOpen(false);
    setNotice('Last move undone.');
  };

  const startSolver = () => {
    if (!solverActive || solverStep >= solverEvents.length) {
      const events = buildSolver(levelSize);
      setSolverEvents(events);
      setSolverStep(0);
      setQueens([]);
      setSolverFocus(null);
      setSolverNarration('Search started. The solver will test columns from left to right.');
      setElapsed(0);
      runStart.current = Date.now();
    } else if (runStart.current === null) {
      runStart.current = Date.now() - elapsed;
    }
    setFriendMode(false);
    setHistory([]);
    setSolverPlaying(true);
    setWinOpen(false);
  };

  const pauseSolver = () => setSolverPlaying(false);

  const stepSolver = () => {
    if (!solverActive || solverStep >= solverEvents.length) {
      const events = buildSolver(levelSize);
      setSolverEvents(events);
      setSolverStep(0);
      setQueens([]);
      setSolverFocus(null);
      setElapsed(0);
      runStart.current = Date.now();
      const event = events[0];
      if (event) {
        setQueens(event.board);
        setSolverFocus(event.focus ?? null);
        setSolverNarration(event.message);
        setSolverStep(1);
      }
      return;
    }
    const event = solverEvents[solverStep];
    if (event) {
      if (runStart.current === null) runStart.current = Date.now() - elapsed;
      setQueens(event.board);
      setSolverFocus(event.focus ?? null);
      setSolverNarration(event.message);
      setSolverStep((value) => value + 1);
      setElapsed(Date.now() - runStart.current);
    }
  };

  const resetSolver = () => {
    setSolverPlaying(false);
    setSolverEvents([]);
    setSolverStep(0);
    setQueens([]);
    setSolverFocus(null);
    setElapsed(0);
    runStart.current = null;
    setSolverNarration('Choose Watch to follow the search, one decision at a time.');
  };

  const shareChallenge = async () => {
    const url = new URL(window.location.href);
    url.searchParams.set('level', String(levelIndex + 1));
    url.searchParams.set('size', String(levelSize));
    url.searchParams.set('challenge', '1');
    try {
      await navigator.clipboard.writeText(url.toString());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt('Copy this challenge link:', url.toString());
    }
  };

  const progressPercent = Math.round((progress.completed.length / LEVELS.length) * 100);
  const focus = solverFocus ?? (currentEvent?.focus ?? null);
  const queenAt = (row: number, col: number) => queens.findIndex((queen) => queen.row === row && queen.col === col);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <div className="brand-mark" aria-hidden="true"><Crown size={21} strokeWidth={2.2} /></div>
          <div>
            <div className="brand-name">Queen Quest</div>
            <div className="eyebrow" style={{ marginTop: -1 }}>A little logic goes a long way</div>
          </div>
        </div>
        <div className="streak-chip" aria-label={`${progress.wins} puzzles completed`}>
          <Sparkles size={14} /> <span>{progress.wins} solved</span>
        </div>
      </header>

      <main className="page-grid">
        <aside className="journey" aria-label="Level journey">
          <div className="journey-heading">
            <h2>Your journey</h2>
            <span className="eyebrow">{progress.completed.length}/{LEVELS.length}</span>
          </div>
          <div className="level-list">
            <div className="journey-list">
              {LEVELS.map((level, index) => {
                const locked = index + 1 > progress.unlocked && !challengeActive;
                const done = progress.completed.includes(index + 1);
                return (
                  <button
                    key={level.title}
                    className={`level-item${levelIndex === index ? ' selected' : ''}${done ? ' done' : ''}`}
                    onClick={() => chooseLevel(index)}
                    disabled={locked}
                    aria-current={levelIndex === index ? 'step' : undefined}
                    aria-label={`${locked ? 'Locked, ' : ''}Level ${index + 1}: ${level.title}, ${level.size} by ${level.size}`}
                    data-testid={`level-${index + 1}`}
                  >
                    <span className="level-index">{locked ? <LockKeyhole size={13} /> : done ? <Check size={15} /> : String(index + 1).padStart(2, '0')}</span>
                    <span className="level-copy"><b>{level.title}</b><span>{level.size} × {level.size} board</span></span>
                    {done && <CheckCircle2 className="level-state" size={14} />}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="panel progress-card" style={{ marginTop: 16 }}>
            <div className="progress-ring" style={{ '--progress': `${progressPercent}%` } as CSSProperties} aria-label={`${progressPercent}% complete`} />
            <div className="progress-copy"><strong>Quest progress</strong><span>{progress.completed.length} of {LEVELS.length} boards mastered</span></div>
            <span className="progress-count">{progressPercent}%</span>
          </div>
        </aside>

        <section className="main-column" aria-label="Puzzle board">
          {challengeActive && (
            <div className="challenge-banner" role="status">
              <span><UsersRound size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Friend challenge · {levelSize} queens</span>
              <button className="button subtle" style={{ padding: '5px 8px', fontSize: 9 }} onClick={() => { setChallengeActive(false); setChallengeSize(null); window.history.replaceState({}, '', window.location.pathname); }}>Exit challenge <X size={12} /></button>
            </div>
          )}
          <div className="hero-line">
            <div>
              <div className="eyebrow">Level {String(levelIndex + 1).padStart(2, '0')} <span style={{ margin: '0 5px' }}>·</span> {levelSize} × {levelSize} board</div>
              <h1>{LEVELS[levelIndex].title}</h1>
              <p>{LEVELS[levelIndex].detail}. Find a place for every queen.</p>
            </div>
            <div className="streak-chip" title="Your personal best time">
              <CircleHelp size={14} /> {progress.bestTime === null ? 'Your first run' : `Best ${formatTime(progress.bestTime)}`}
            </div>
          </div>

          <div className="panel board-panel">
            <div className="board-head">
              <div className="board-title"><Crown size={17} color="#514b91" /><strong>Place your queens</strong><span>{queens.length} / {levelSize}</span></div>
              <div className="board-actions">
                <button className="button subtle" onClick={undo} disabled={!history.length || solverPlaying} aria-label="Undo last move" data-testid="button-undo"><Undo2 size={14} />Undo</button>
                <button className="button subtle" onClick={resetBoard} aria-label="Reset board" data-testid="button-reset"><RotateCcw size={13} />Reset</button>
              </div>
            </div>
            <div className="board-wrap">
              <div className="row-labels" aria-hidden="true">{Array.from({ length: levelSize }, (_, row) => <span key={row}>{levelSize - row}</span>)}</div>
              <div className="board-frame">
                <div className="board" style={{ gridTemplateColumns: `repeat(${levelSize}, 1fr)`, gridTemplateRows: `repeat(${levelSize}, 1fr)` }} role="grid" aria-label={`${levelSize} by ${levelSize} chessboard`}>
                  {Array.from({ length: levelSize }, (_, row) =>
                    Array.from({ length: levelSize }, (_, col) => {
                      const index = queenAt(row, col);
                      const isConflict = index >= 0 && conflicts.has(index);
                      const focused = focus?.row === row && focus.col === col;
                      const tested = currentEvent?.kind === 'conflict' && focused;
                      const queen = index >= 0 ? queens[index] : undefined;
                      return (
                        <button
                          key={`${row}-${col}`}
                          className={`cell ${(row + col) % 2 === 0 ? 'light' : 'dark'}${isConflict || tested ? ' conflict' : ''}${focused && currentEvent?.kind === 'place' ? ' solver-current' : ''}${focused && currentEvent?.kind === 'backtrack' ? ' solver-tested' : ''}`}
                          onClick={() => clickCell(row, col)}
                          role="gridcell"
                          aria-label={`${FILE[col].toUpperCase()}${levelSize - row}${queen ? `, queen by ${friendMode ? playerNames[queen.player] : 'you'}${isConflict ? ', conflict' : ''}` : ''}`}
                          aria-pressed={index >= 0}
                          data-testid={`board-cell-${row}-${col}`}
                        >
                          {queen && <span className={`queen-token${isConflict ? ' conflicted' : ''}${currentEvent?.kind === 'place' && focused ? ' solver' : ''}`}><Crown size="66%" strokeWidth={2.2} /></span>}
                          {levelSize <= 5 && <span className="cell-label">{FILE[col]}{levelSize - row}</span>}
                        </button>
                      );
                    }),
                  )}
                </div>
              </div>
              <div className="col-labels" aria-hidden="true" style={{ gridTemplateColumns: `repeat(${levelSize}, 1fr)` }}>{Array.from({ length: levelSize }, (_, col) => <span key={col}>{FILE[col]}</span>)}</div>
            </div>
            <div className="board-caption">
              <div className="legend">
                <span className="legend-item"><i className="legend-dot" />Safe square</span>
                <span className="legend-item"><i className="legend-dot danger" />Queen conflict</span>
              </div>
              <span>Tap a square to place or lift a queen</span>
            </div>
            <div className={`feedback${conflicts.size ? ' alert' : isValidWin ? ' success' : ''}`} role="status" aria-live="polite" data-testid="status-board">
              {conflicts.size ? <X size={15} /> : isValidWin ? <CheckCircle2 size={15} /> : <CircleHelp size={15} />}
              <span>{notice}</span>
            </div>
          </div>
        </section>

        <aside className="right-column" aria-label="Game tools">
          <section className="panel side-card" aria-labelledby="solver-title">
            <div className="side-title"><h2 id="solver-title">Watch the solver</h2><span className="eyebrow">BACKTRACKING</span></div>
            <p className="solver-intro">See how a computer explores each choice, spots a conflict, and rewinds to try again.</p>
            <button className="solver-main" onClick={solverPlaying ? pauseSolver : startSolver} data-testid="button-solve">
              {solverPlaying ? <><Pause size={15} />Pause the search</> : <><Play size={15} />{solverStep > 0 && solverStep < solverEvents.length ? 'Resume watching' : 'Solve / Watch'}</>}
            </button>
            <div className="control-row">
              <button className="icon-button" aria-label="Reset solver" title="Reset" onClick={resetSolver} data-testid="button-solver-reset"><RotateCcw size={14} /></button>
              <button className="icon-button" aria-label="Return to start" title="Return to start" onClick={() => { setSolverPlaying(false); setSolverStep(0); setQueens([]); setSolverFocus(null); setSolverNarration('Search rewound to its first decision.'); }} disabled={!solverActive} data-testid="button-solver-start"><SkipBack size={14} /></button>
              <button className="icon-button" aria-label="Step forward one decision" title="Step" onClick={stepSolver} disabled={solverPlaying} data-testid="button-solver-step"><StepForward size={15} /></button>
              <label className="sr-only" htmlFor="solver-speed">Solver speed</label>
              <select className="speed-select" id="solver-speed" value={speed} onChange={(event) => setSpeed(Number(event.target.value))} aria-label="Solver speed" data-testid="select-solver-speed">
                <option value={0.5}>Slow</option><option value={1}>Steady</option><option value={2}>Quick</option><option value={4}>Fast</option>
              </select>
            </div>
            <div className="run-progress" aria-label={`${solverStep} of ${solverEvents.length} solver steps`}><span style={{ width: `${solverEvents.length ? (solverStep / solverEvents.length) * 100 : 0}%` }} /></div>
            <div className="stats-grid">
              <div className="stat"><label>Solutions</label><strong>{solverMetrics.solutions}</strong></div>
              <div className="stat"><label>Visited</label><strong>{solverMetrics.placed}</strong></div>
              <div className="stat"><label>Attempts</label><strong>{solverMetrics.attempts}</strong></div>
              <div className="stat"><label>Backtracks</label><strong>{solverMetrics.backtracks}</strong></div>
            </div>
            <div className="narration" aria-live="polite" data-testid="text-solver-narration">{solverNarration}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 9, color: '#85808d', font: '10px var(--app-font-mono)' }}>
              <span>Elapsed</span><span>{formatTime(elapsed)}</span>
            </div>
          </section>

          <section className="panel side-card friend-card" aria-labelledby="friend-title">
            <div className="side-title"><h2 id="friend-title">Play together</h2><UsersRound size={16} color="#68618e" /></div>
            <p className="friend-description">Pass the board between two players. Take turns placing queens and solve it together.</p>
            <div className="player-fields">
              {playerNames.map((name, index) => (
                <div className="player-field" key={index}>
                  <label htmlFor={`player-${index}`}>Player {index + 1}</label>
                  <input id={`player-${index}`} value={name} maxLength={18} onChange={(event) => setPlayerNames((old) => old.map((item, idx) => idx === index ? event.target.value : item))} aria-label={`Player ${index + 1} name`} data-testid={`input-player-${index + 1}`} />
                </div>
              ))}
            </div>
            <div className="turn-banner">
              <span><i className="turn-dot" />{friendMode ? `${playerNames[turn] || `Player ${turn + 1}`}'s turn` : 'Hot-seat mode is off'}</span>
              <button className="button subtle" style={{ padding: '5px 8px', fontSize: 9 }} onClick={() => { setFriendMode((old) => !old); setTurn(0); setNotice(friendMode ? 'Playing solo. Your board is unchanged.' : `${playerNames[0] || 'Player 1'} starts. Pass the board after each placement.`); }} data-testid="button-hotseat">{friendMode ? 'Turn off' : 'Start'}</button>
            </div>
            <button className="challenge-button" onClick={shareChallenge} data-testid="button-share-challenge">
              {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Challenge link copied' : 'Copy friend challenge link'}
            </button>
            <p className="challenge-note">Link opens this board size and level on their device.</p>
          </section>
        </aside>
      </main>

      {winOpen && (
        <div className="modal-backdrop" role="presentation">
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="win-title">
            <div className="modal-icon"><CheckCircle2 size={23} /></div>
            <div className="eyebrow" style={{ marginTop: 15 }}>Board mastered</div>
            <h2 id="win-title">A quiet solution.</h2>
            <p>You placed all {levelSize} queens without a single shared row, column, or diagonal. The next board is now open.</p>
            <div className="modal-actions">
              <button className="button" onClick={() => setWinOpen(false)}>Stay here</button>
              {levelIndex + 1 < LEVELS.length && <button className="button primary" onClick={() => { setWinOpen(false); chooseLevel(levelIndex + 1); }}>Next level <ArrowRight size={14} /></button>}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default App;