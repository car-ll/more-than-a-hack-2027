import { useState, useEffect } from 'react'
import PossessionBar from './components/PossessionBar.jsx'
import MatchHeader from './components/MatchHeader.jsx'
import HalfBreakdown from './components/HalfBreakdown.jsx'
import Timeline from './components/Timeline.jsx'
import './App.css'

function App() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState('inPlay') // 'inPlay' (3-split) or 'fullMatch' (4-split)
  const [animKey, setAnimKey] = useState(0)

  useEffect(() => {
    fetch('/possession-data.json')
      .then(res => res.json())
      .then(d => {
        setData(d)
        setLoading(false)
      })
      .catch(err => {
        console.error('Failed to load data:', err)
        setLoading(false)
      })
  }, [])

  const triggerReplay = () => {
    setAnimKey(prev => prev + 1)
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Loading tracking & possession data…</p>
      </div>
    )
  }

  if (!data) {
    return <div className="error-screen">Failed to load data</div>
  }

  return (
    <div className="app">
      <MatchHeader match={data.match} date={data.date} />

      {/* Control bar: Mode Switcher & Replay Rising Animation */}
      <div className="dashboard-controls">
        <div className="view-mode-selector">
          <button
            className={`mode-btn ${mode === 'inPlay' ? 'active' : ''}`}
            onClick={() => setMode('inPlay')}
          >
            <span className="mode-dot live-dot" />
            Active In-Play (3-Color: Home / Contested / Away)
          </button>
          <button
            className={`mode-btn ${mode === 'fullMatch' ? 'active' : ''}`}
            onClick={() => setMode('fullMatch')}
          >
            <span className="mode-dot match-dot" />
            Full Match Time (4-Way: Dead Ball Separated)
          </button>
        </div>

        <button className="replay-btn" onClick={triggerReplay} title="Re-run rising animation">
          <span className="replay-icon">↻</span>
          <span>Replay Rising Bar</span>
        </button>
      </div>

      {/* Main Overall Possession Section */}
      <section className="main-possession-card">
        <div className="section-header-row">
          <div>
            <h2 className="section-title">
              {mode === 'inPlay' ? 'Active In-Play Possession' : 'Full Match Time Distribution'}
            </h2>
            <p className="section-description">
              {mode === 'inPlay'
                ? 'Calculated while the ball is live on pitch. White indicates contested duels where 2 or more players from opposing sides contest the ball simultaneously.'
                : 'Complete match timeline breakdown distinguishing clean team control, contested multi-player duels, and dead-ball stoppages.'}
            </p>
          </div>
          <div className="time-badge">
            {mode === 'inPlay' ? 'Live Ball (~60 Mins)' : 'Total Graded (106 Mins)'}
          </div>
        </div>

        <PossessionBar
          stats={data.overall}
          mode={mode}
          size="large"
          animationTrigger={animKey}
        />
      </section>

      {/* Half Breakdown */}
      <HalfBreakdown
        halves={data.halves}
        mode={mode}
        animationTrigger={animKey}
      />

      {/* Minute-by-Minute Timeline */}
      <Timeline
        minutes={data.minutes}
        mode={mode}
      />
    </div>
  )
}

export default App
