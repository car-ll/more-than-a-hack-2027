import PossessionBar from './PossessionBar.jsx'
import './HalfBreakdown.css'

export default function HalfBreakdown({ halves = [], mode = 'inPlay', animationTrigger = 0 }) {
  if (!halves || halves.length === 0) return null

  return (
    <section className="half-breakdown-card">
      <div className="section-header-row">
        <div>
          <h2 className="section-title">Breakdown By Half</h2>
          <p className="section-description">
            Comparing team momentum and contested battle rates between 1st Half and 2nd Half.
          </p>
        </div>
      </div>

      <div className="halves-container">
        {halves.map((h, idx) => (
          <div key={h.half || idx} className="half-panel">
            <div className="half-title-row">
              <span className="half-badge">{h.half === 1 ? '1st Half' : '2nd Half'}</span>
              <span className="half-meta">
                {mode === 'inPlay'
                  ? `${(h.liveFrames / 25 / 60).toFixed(1)} mins live play`
                  : `${(h.totalGradedFrames / 25 / 60).toFixed(1)} mins total`}
              </span>
            </div>

            <PossessionBar
              stats={h}
              mode={mode}
              size="normal"
              animationTrigger={animationTrigger}
            />
          </div>
        ))}
      </div>
    </section>
  )
}
