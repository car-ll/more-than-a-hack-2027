import React, { useState, useEffect } from 'react'
import './Timeline.css'

export default function Timeline({ minutes = [], mode = 'inPlay' }) {
  const [hoveredMinute, setHoveredMinute] = useState(null)
  const [animated, setAnimated] = useState(false)

  useEffect(() => {
    setAnimated(false)
    const timer = setTimeout(() => setAnimated(true), 150)
    return () => clearTimeout(timer)
  }, [mode])

  if (!minutes || minutes.length === 0) return null

  const matchMinutes = minutes.filter(m => m.isMatchTime)

  return (
    <section className="timeline-card">
      <div className="section-header-row">
        <div>
          <h2 className="section-title">Minute-by-Minute Possession Flow</h2>
          <p className="section-description">
            Hover over any minute bar to inspect exact possession and contested contest rates across match time.
          </p>
        </div>
        <div className="timeline-legend-pills">
          <span className="t-pill red-pill">Red: Home</span>
          <span className="t-pill white-pill">White: Contested</span>
          <span className="t-pill blue-pill">Blue: Away</span>
          {mode === 'fullMatch' && <span className="t-pill slate-pill">Slate: Stoppage</span>}
        </div>
      </div>

      <div className="timeline-visual-area">
        <div className="timeline-bars-track">
          {matchMinutes.map((m, idx) => {
            const vals = mode === 'inPlay' ? m.inPlay : m.full
            if (!vals) return null

            const homeH = vals.home || 0
            const contestedH = vals.contested || 0
            const awayH = vals.away || 0
            const deadH = mode === 'fullMatch' ? (vals.dead || 0) : 0

            return (
              <div
                key={m.minute}
                className={`timeline-column ${animated ? 'grown' : ''}`}
                style={{
                  transitionDelay: `${Math.min(idx * 8, 500)}ms`
                }}
                onMouseEnter={() => setHoveredMinute({ minute: m.minute, vals })}
                onMouseLeave={() => setHoveredMinute(null)}
              >
                {/* Stacked from top to bottom: Away (Blue), Contested (White), Dead (Slate), Home (Red) */}
                <div className="bar-slice away-slice" style={{ height: `${awayH}%` }} />
                <div className="bar-slice contested-slice" style={{ height: `${contestedH}%` }} />
                {mode === 'fullMatch' && (
                  <div className="bar-slice dead-slice" style={{ height: `${deadH}%` }} />
                )}
                <div className="bar-slice home-slice" style={{ height: `${homeH}%` }} />
              </div>
            )
          })}
        </div>

        <div className="timeline-time-labels">
          <span>Kickoff 0'</span>
          <span>15'</span>
          <span>30'</span>
          <span>45' (HT)</span>
          <span>60'</span>
          <span>75'</span>
          <span>90'+</span>
        </div>
      </div>

      {hoveredMinute && (
        <div className="timeline-hover-banner">
          <div className="hover-time-tag">Minute {hoveredMinute.minute}'</div>
          <div className="hover-metrics">
            <span className="h-metric red">Home: {hoveredMinute.vals.home}%</span>
            <span className="h-metric white">Contested: {hoveredMinute.vals.contested}%</span>
            <span className="h-metric blue">Away: {hoveredMinute.vals.away}%</span>
            {mode === 'fullMatch' && (
              <span className="h-metric slate">Dead Ball: {hoveredMinute.vals.dead}%</span>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
