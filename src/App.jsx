import { useState, useEffect, useCallback, useRef } from 'react'
import './App.css'

// --- Game constants ---
const COLORS = [
  { id: 0, base: '#6366f1', lit: '#a5b4fc', glow: '#6366f1' },
  { id: 1, base: '#ec4899', lit: '#f9a8d4', glow: '#ec4899' },
  { id: 2, base: '#f59e0b', lit: '#fcd34d', glow: '#f59e0b' },
  { id: 3, base: '#10b981', lit: '#6ee7b7', glow: '#10b981' },
  { id: 4, base: '#3b82f6', lit: '#93c5fd', glow: '#3b82f6' },
  { id: 5, base: '#f97316', lit: '#fdba74', glow: '#f97316' },
  { id: 6, base: '#8b5cf6', lit: '#c4b5fd', glow: '#8b5cf6' },
  { id: 7, base: '#14b8a6', lit: '#5eead4', glow: '#14b8a6' },
  { id: 8, base: '#ef4444', lit: '#fca5a5', glow: '#ef4444' },
]

// Grid grows every few levels
function getGridSize(level) {
  if (level <= 3) return 3
  if (level <= 7) return 4
  return 5
}

// Sequence length increases with level
function getSequenceLength(level) {
  return 2 + level
}

// Display interval shrinks with level (ms per square shown)
function getDisplayInterval(level) {
  return Math.max(350, 900 - level * 50)
}

// Generate a random sequence of grid indices
function generateSequence(length, gridSize) {
  const total = gridSize * gridSize
  const seq = []
  for (let i = 0; i < length; i++) {
    seq.push(Math.floor(Math.random() * total))
  }
  return seq
}

// --- Phase constants ---
const PHASE = {
  IDLE: 'idle',
  COUNTDOWN: 'countdown',
  SHOWING: 'showing',
  WAITING: 'waiting',
  PLAYER: 'player',
  FEEDBACK: 'feedback',
  GAMEOVER: 'gameover',
}

// --- Square component ---
function Square({ color, state, onClick, disabled }) {
  // state: 'idle' | 'lit' | 'correct' | 'wrong' | 'dim'
  const isLit = state === 'lit'
  const isCorrect = state === 'correct'
  const isWrong = state === 'wrong'
  const isDim = state === 'dim'

  let bg = color.base
  let boxShadow = 'none'
  let border = `2px solid ${color.base}55`
  let transform = 'scale(1)'
  let filter = isDim ? 'brightness(0.35)' : 'brightness(0.55)'

  if (isLit) {
    bg = color.lit
    boxShadow = `0 0 24px 6px ${color.glow}88, 0 0 8px 2px ${color.glow}cc`
    border = `2px solid ${color.lit}`
    transform = 'scale(1.07)'
    filter = 'brightness(1)'
  } else if (isCorrect) {
    bg = '#4ade80'
    boxShadow = '0 0 20px 6px #4ade8088, 0 0 8px 2px #4ade80cc'
    border = '2px solid #86efac'
    transform = 'scale(1.05)'
    filter = 'brightness(1)'
  } else if (isWrong) {
    bg = '#f87171'
    boxShadow = '0 0 20px 6px #f8717188, 0 0 8px 2px #f87171cc'
    border = '2px solid #fca5a5'
    transform = 'scale(0.94)'
    filter = 'brightness(1)'
  }

  return (
    <button
      className="square"
      onClick={onClick}
      disabled={disabled}
      style={{
        background: bg,
        boxShadow,
        border,
        transform,
        filter,
        cursor: disabled ? 'default' : 'pointer',
      }}
    />
  )
}

// --- HUD component ---
function HUD({ level, score, best, phase, sequenceLen, playerProgress }) {
  const showProgress = phase === PHASE.PLAYER
  return (
    <div className="hud">
      <div className="hud-stats">
        <Stat label="Level" value={level} />
        <Stat label="Score" value={score} />
        <Stat label="Best" value={best} />
      </div>
      {showProgress && (
        <div className="progress-dots">
          {Array.from({ length: sequenceLen }).map((_, i) => (
            <span
              key={i}
              className={`dot ${i < playerProgress ? 'done' : i === playerProgress ? 'current' : ''}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  )
}

// --- Main App ---
export default function App() {
  const [level, setLevel] = useState(1)
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(() => {
    const saved = localStorage.getItem('memoryBest')
    return saved ? parseInt(saved, 10) : 0
  })
  const [phase, setPhase] = useState(PHASE.IDLE)
  const [sequence, setSequence] = useState([])
  const [litIndex, setLitIndex] = useState(-1)         // which step is currently lit
  const [squareStates, setSquareStates] = useState({}) // { squareIdx: 'correct'|'wrong'|'lit' }
  const [playerStep, setPlayerStep] = useState(0)
  const [countdown, setCountdown] = useState(3)
  const [message, setMessage] = useState('')

  const gridSize = getGridSize(level)
  const totalSquares = gridSize * gridSize
  const sequenceLen = getSequenceLength(level)
  const displayInterval = getDisplayInterval(level)

  const timeoutsRef = useRef([])

  const clearTimeouts = () => {
    timeoutsRef.current.forEach(clearTimeout)
    timeoutsRef.current = []
  }

  const later = (fn, ms) => {
    const id = setTimeout(fn, ms)
    timeoutsRef.current.push(id)
    return id
  }

  // Persist best score
  useEffect(() => {
    localStorage.setItem('memoryBest', String(best))
  }, [best])

  // Cleanup on unmount
  useEffect(() => () => clearTimeouts(), [])

  const startLevel = useCallback((lvl) => {
    clearTimeouts()
    const gSize = getGridSize(lvl)
    const seqLen = getSequenceLength(lvl)
    const interval = getDisplayInterval(lvl)
    const seq = generateSequence(seqLen, gSize)

    setLevel(lvl)
    setSequence(seq)
    setSquareStates({})
    setPlayerStep(0)
    setLitIndex(-1)
    setMessage('')

    // Countdown
    setPhase(PHASE.COUNTDOWN)
    setCountdown(3)
    later(() => setCountdown(2), 700)
    later(() => setCountdown(1), 1400)
    later(() => {
      setCountdown(0)
      setMessage('Watch!')
      setPhase(PHASE.SHOWING)

      // Play back the sequence
      seq.forEach((sqIdx, step) => {
        const ON_DELAY = 300 + step * (interval + 120)
        const OFF_DELAY = ON_DELAY + interval

        later(() => {
          setLitIndex(step)
          setSquareStates({ [sqIdx]: 'lit' })
        }, ON_DELAY)

        later(() => {
          setSquareStates({})
          setLitIndex(-1)
        }, OFF_DELAY)
      })

      // After all squares shown, wait briefly, then open player phase
      const totalTime = 300 + seq.length * (interval + 120) + 200
      later(() => {
        setPhase(PHASE.WAITING)
        setMessage('Get ready...')
      }, totalTime)

      later(() => {
        setPhase(PHASE.PLAYER)
        setMessage('Your turn!')
        setSquareStates({})
        setPlayerStep(0)
      }, totalTime + 600)
    }, 2100)
  }, [])

  const handleStart = () => {
    setScore(0)
    startLevel(1)
  }

  const handleRetry = () => {
    startLevel(level)
  }

  const handleSquareClick = (squareIdx) => {
    if (phase !== PHASE.PLAYER) return

    const expected = sequence[playerStep]
    const isCorrect = squareIdx === expected

    if (isCorrect) {
      // Flash correct
      setSquareStates({ [squareIdx]: 'correct' })
      const nextStep = playerStep + 1

      if (nextStep === sequence.length) {
        // Completed sequence
        const newScore = score + level * 10
        setScore(newScore)
        if (newScore > best) setBest(newScore)
        setPhase(PHASE.FEEDBACK)
        setMessage('Perfect!')
        later(() => {
          setSquareStates({})
          startLevel(level + 1)
        }, 900)
      } else {
        setPlayerStep(nextStep)
        later(() => setSquareStates({}), 300)
      }
    } else {
      // Wrong — flash all wrong, then game over
      setSquareStates({ [squareIdx]: 'wrong' })
      setPhase(PHASE.FEEDBACK)
      setMessage('Wrong!')
      later(() => {
        // Reveal correct sequence quickly
        setSquareStates({})
        setPhase(PHASE.GAMEOVER)
        setMessage('')
      }, 800)
    }
  }

  // Determine what each square should show
  const getSquareState = (idx) => {
    if (squareStates[idx]) return squareStates[idx]
    return 'idle'
  }

  const isInteractive = phase === PHASE.PLAYER
  const showGrid = phase !== PHASE.IDLE && phase !== PHASE.GAMEOVER

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="title">Memory Grid</h1>
        <p className="subtitle">Watch the sequence. Repeat it.</p>
      </header>

      {phase !== PHASE.IDLE && phase !== PHASE.GAMEOVER && (
        <HUD
          level={level}
          score={score}
          best={best}
          phase={phase}
          sequenceLen={sequence.length}
          playerProgress={playerStep}
        />
      )}

      {phase === PHASE.IDLE && (
        <div className="center-card">
          <p className="card-desc">Memorize the pattern. Repeat it. Level up.</p>
          {best > 0 && <p className="best-label">Best score: <strong>{best}</strong></p>}
          <button className="btn-primary" onClick={handleStart}>Start Game</button>
        </div>
      )}

      {phase === PHASE.COUNTDOWN && (
        <div className="countdown-display">
          <span className="countdown-num">{countdown}</span>
        </div>
      )}

      {showGrid && (
        <div
          className="grid-wrapper"
          style={{ '--grid-size': gridSize }}
        >
          {phase === PHASE.SHOWING && (
            <div className="phase-label watching">Watch the sequence</div>
          )}
          {phase === PHASE.WAITING && (
            <div className="phase-label waiting">{message}</div>
          )}
          {phase === PHASE.PLAYER && (
            <div className="phase-label player">{message}</div>
          )}
          {phase === PHASE.FEEDBACK && (
            <div className={`phase-label feedback ${message === 'Perfect!' ? 'good' : 'bad'}`}>
              {message}
            </div>
          )}

          <div className="grid" style={{ '--grid-size': gridSize }}>
            {Array.from({ length: totalSquares }).map((_, idx) => (
              <Square
                key={idx}
                color={COLORS[idx % COLORS.length]}
                state={getSquareState(idx)}
                onClick={() => handleSquareClick(idx)}
                disabled={!isInteractive}
              />
            ))}
          </div>
        </div>
      )}

      {phase === PHASE.GAMEOVER && (
        <div className="center-card">
          <div className="gameover-score">
            <span className="gameover-label">Game Over</span>
            <span className="gameover-value">{score} pts</span>
            {score >= best && score > 0 && <span className="new-best">New Best!</span>}
          </div>
          <p className="card-desc">Failed level <strong>{level}</strong></p>
          <div className="gameover-actions">
            <button className="btn-primary" onClick={handleRetry}>Retry Level {level}</button>
            <button className="btn-secondary" onClick={handleStart}>New Game</button>
          </div>
        </div>
      )}
    </div>
  )
}
