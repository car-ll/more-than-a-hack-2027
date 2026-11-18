import './MatchHeader.css'

export default function MatchHeader({ match = 'FC Barcelona vs Athletic Club', date = 'La Liga 2026/27' }) {
  return (
    <header className="match-header">
      <div className="match-badge">
        <span className="badge-crest-home">BAR</span>
        <span className="badge-divider">/</span>
        <span className="badge-crest-away">ATH</span>
      </div>

      <div className="match-info">
        <div className="match-league-tag">MTAH 2027 · OFFICIAL POSSESSION METRICS</div>
        <h1 className="match-title">{match}</h1>
        <p className="match-subtitle">Tactical Tracking Analysis · Multi-Player Duel & Stoppage Segmentation</p>
      </div>

      <div className="header-legend">
        <div className="legend-chip chip-home">
          <span className="chip-dot home-dot" />
          <span className="chip-label">Home (Red)</span>
        </div>
        <div className="legend-chip chip-contested">
          <span className="chip-dot contested-dot" />
          <span className="chip-label">Contested (White)</span>
        </div>
        <div className="legend-chip chip-away">
          <span className="chip-dot away-dot" />
          <span className="chip-label">Away (Blue)</span>
        </div>
        <div className="legend-chip chip-dead">
          <span className="chip-dot dead-dot" />
          <span className="chip-label">Dead Ball (Slate)</span>
        </div>
      </div>
    </header>
  )
}
