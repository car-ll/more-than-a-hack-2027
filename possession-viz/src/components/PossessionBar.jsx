import React, { useState, useEffect } from 'react'
import './PossessionBar.css'

export default function PossessionBar({
  title = '',
  stats = {},
  mode = 'inPlay', // 'inPlay' (3-split) or 'fullMatch' (4-split)
  size = 'large',
  animationTrigger = 0
}) {
  // animationStage:
  // 0: Initial grounded
  // 1: Rising upwards (vertical expansion / spring rise)
  // 2: Horizontal segmentation slide
  // 3: Numbers counting up & badges/dividers revealed
  const [animationStage, setAnimationStage] = useState(0)
  const [displayedPercentages, setDisplayedPercentages] = useState({
    home: 0,
    contested: 0,
    away: 0,
    dead: 0
  })

  // Extract values based on mode
  const currentValues = mode === 'inPlay'
    ? {
        home: stats.inPlay?.home || 0,
        contested: stats.inPlay?.contested || 0,
        away: stats.inPlay?.away || 0,
        dead: 0
      }
    : {
        home: stats.fullMatch?.home || 0,
        contested: stats.fullMatch?.contested || 0,
        away: stats.fullMatch?.away || 0,
        dead: stats.fullMatch?.dead || 0
      }

  // Handle sequential rising and stat count-up animation
  useEffect(() => {
    setAnimationStage(0)
    setDisplayedPercentages({ home: 0, contested: 0, away: 0, dead: 0 })

    // Step 1: Trigger vertical rise after 100ms
    const timer1 = setTimeout(() => {
      setAnimationStage(1) // Bar rises vertically from baseline
    }, 120)

    // Step 2: Expand segments into place
    const timer2 = setTimeout(() => {
      setAnimationStage(2)
    }, 600)

    // Step 3: Count up numbers to final stats
    const timer3 = setTimeout(() => {
      setAnimationStage(3)
      const duration = 1200
      const startTime = performance.now()

      const animateCounter = (now) => {
        const elapsed = now - startTime
        const progress = Math.min(elapsed / duration, 1)
        // easeOutCubic
        const ease = 1 - Math.pow(1 - progress, 3)

        setDisplayedPercentages({
          home: +(currentValues.home * ease).toFixed(1),
          contested: +(currentValues.contested * ease).toFixed(1),
          away: +(currentValues.away * ease).toFixed(1),
          dead: +(currentValues.dead * ease).toFixed(1)
        })

        if (progress < 1) {
          requestAnimationFrame(animateCounter)
        } else {
          setDisplayedPercentages({
            home: currentValues.home,
            contested: currentValues.contested,
            away: currentValues.away,
            dead: currentValues.dead
          })
        }
      }

      requestAnimationFrame(animateCounter)
    }, 850)

    return () => {
      clearTimeout(timer1)
      clearTimeout(timer2)
      clearTimeout(timer3)
    }
  }, [mode, animationTrigger, currentValues.home, currentValues.contested, currentValues.away, currentValues.dead])

  // Compute widths
  const isSegmented = animationStage >= 2
  const homeWidth = isSegmented ? currentValues.home : 0
  const contestedWidth = isSegmented ? currentValues.contested : 0
  const awayWidth = isSegmented ? currentValues.away : 0
  const deadWidth = isSegmented && mode === 'fullMatch' ? currentValues.dead : 0

  return (
    <div className={`possession-container ${size} stage-${animationStage}`}>
      {title && <div className="bar-header-title">{title}</div>}

      {/* Top Stat Displays with Divider Labels */}
      <div className={`stats-summary-ribbon ${animationStage >= 3 ? 'revealed' : ''}`}>
        {/* HOME (RED) */}
        <div className="stat-card stat-home">
          <div className="stat-badge-label">
            <span className="color-indicator red-dot" />
            <span className="team-name">HOME (BARCELONA)</span>
          </div>
          <div className="stat-value-group">
            <span className="stat-number">{displayedPercentages.home.toFixed(1)}</span>
            <span className="stat-percent">%</span>
          </div>
          <div className="stat-subtext">Controlled Possession</div>
        </div>

        {/* CONTESTED (WHITE) */}
        <div className="stat-card stat-contested">
          <div className="stat-badge-label">
            <span className="color-indicator white-dot" />
            <span className="team-name">CONTESTED</span>
          </div>
          <div className="stat-value-group">
            <span className="stat-number">{displayedPercentages.contested.toFixed(1)}</span>
            <span className="stat-percent">%</span>
          </div>
          <div className="stat-subtext">2+ Players on Ball / Duel</div>
        </div>

        {/* AWAY (BLUE) */}
        <div className="stat-card stat-away">
          <div className="stat-badge-label">
            <span className="color-indicator blue-dot" />
            <span className="team-name">AWAY (ATHLETIC)</span>
          </div>
          <div className="stat-value-group">
            <span className="stat-number">{displayedPercentages.away.toFixed(1)}</span>
            <span className="stat-percent">%</span>
          </div>
          <div className="stat-subtext">Controlled Possession</div>
        </div>

        {/* DEAD BALL (SLATE/NEUTRAL - only in full match mode) */}
        {mode === 'fullMatch' && (
          <div className="stat-card stat-dead">
            <div className="stat-badge-label">
              <span className="color-indicator slate-dot" />
              <span className="team-name">DEAD BALL</span>
            </div>
            <div className="stat-value-group">
              <span className="stat-number">{displayedPercentages.dead.toFixed(1)}</span>
              <span className="stat-percent">%</span>
            </div>
            <div className="stat-subtext">Out of Play / Stoppages</div>
          </div>
        )}
      </div>

      {/* THE HORIZONTAL BAR WITH RISING LAUNCHPAD & DIVIDERS */}
      <div className="bar-stage-frame">
        <div className={`horizontal-possession-bar ${animationStage >= 1 ? 'is-risen' : 'is-grounded'}`}>
          {/* SEGMENT 1: HOME (RED) */}
          <div
            className="bar-segment segment-home"
            style={{ width: `${homeWidth}%` }}
          >
            <div className="segment-gloss" />
            <div className="segment-inner-content">
              {homeWidth > 12 && (
                <div className="segment-inline-tag">
                  <span className="tag-name">HOME</span>
                  <span className="tag-val">{displayedPercentages.home.toFixed(1)}%</span>
                </div>
              )}
            </div>
          </div>

          {/* DIVIDER 1: HOME / CONTESTED */}
          {homeWidth > 0 && contestedWidth > 0 && (
            <div className={`segment-divider divider-home-contested ${animationStage >= 3 ? 'visible' : ''}`}>
              <div className="divider-line" />
              <div className="divider-pill">
                <span>VS</span>
              </div>
            </div>
          )}

          {/* SEGMENT 2: CONTESTED (WHITE) */}
          <div
            className="bar-segment segment-contested"
            style={{ width: `${contestedWidth}%` }}
          >
            <div className="segment-gloss" />
            <div className="segment-inner-content">
              {contestedWidth > 7 && (
                <div className="segment-inline-tag dark-text">
                  <span className="tag-name">CONTESTED</span>
                  <span className="tag-val">{displayedPercentages.contested.toFixed(1)}%</span>
                </div>
              )}
            </div>
          </div>

          {/* DIVIDER 2: CONTESTED / AWAY */}
          {contestedWidth > 0 && awayWidth > 0 && (
            <div className={`segment-divider divider-contested-away ${animationStage >= 3 ? 'visible' : ''}`}>
              <div className="divider-line" />
              <div className="divider-pill">
                <span>VS</span>
              </div>
            </div>
          )}

          {/* SEGMENT 3: AWAY (BLUE) */}
          <div
            className="bar-segment segment-away"
            style={{ width: `${awayWidth}%` }}
          >
            <div className="segment-gloss" />
            <div className="segment-inner-content">
              {awayWidth > 12 && (
                <div className="segment-inline-tag">
                  <span className="tag-name">AWAY</span>
                  <span className="tag-val">{displayedPercentages.away.toFixed(1)}%</span>
                </div>
              )}
            </div>
          </div>

          {/* DIVIDER 3: AWAY / DEAD BALL (only in full match) */}
          {mode === 'fullMatch' && awayWidth > 0 && deadWidth > 0 && (
            <div className={`segment-divider divider-away-dead ${animationStage >= 3 ? 'visible' : ''}`}>
              <div className="divider-line" />
              <div className="divider-pill stoppage-pill">
                <span>STOP</span>
              </div>
            </div>
          )}

          {/* SEGMENT 4: DEAD BALL (SLATE/TEXTURED) */}
          {mode === 'fullMatch' && (
            <div
              className="bar-segment segment-dead"
              style={{ width: `${deadWidth}%` }}
            >
              <div className="hazard-stripes" />
              <div className="segment-inner-content">
                {deadWidth > 12 && (
                  <div className="segment-inline-tag">
                    <span className="tag-name">DEAD BALL</span>
                    <span className="tag-val">{displayedPercentages.dead.toFixed(1)}%</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Rising baseline shadow/glow effect */}
        <div className={`rising-ground-glow ${animationStage >= 1 ? 'glow-active' : ''}`} />
      </div>

      {/* Sub-bar Divider Indicator Legend */}
      <div className={`divider-legend-bar ${animationStage >= 3 ? 'show' : ''}`}>
        <div className="legend-segment-label label-home">
          <span className="marker-arrow">▲</span>
          <span>Red: Home Team (Barcelona)</span>
        </div>
        <div className="legend-segment-label label-contested">
          <span className="marker-arrow">▲</span>
          <span>White: Contested (2+ Players on Ball)</span>
        </div>
        <div className="legend-segment-label label-away">
          <span className="marker-arrow">▲</span>
          <span>Blue: Away Team (Athletic)</span>
        </div>
        {mode === 'fullMatch' && (
          <div className="legend-segment-label label-dead">
            <span className="marker-arrow">▲</span>
            <span>Slate: Dead Ball / Stoppage</span>
          </div>
        )}
      </div>
    </div>
  )
}
