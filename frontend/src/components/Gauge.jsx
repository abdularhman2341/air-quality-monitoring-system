import { GAUGE_MAX_PPM, THRESHOLD_PPM, formatPpm } from '../utils/format'

const CENTER = 100
const RADIUS = 80
const ARC = 'M20 100 A80 80 0 0 1 180 100'

function point(angle, radius) {
  return [CENTER + radius * Math.cos(angle), CENTER - radius * Math.sin(angle)]
}

function Gauge({ value, color, unitLabel, thresholdLabel }) {
  const fraction = value === null ? 0 : Math.min(Math.max(value / GAUGE_MAX_PPM, 0), 1)
  const length = Math.PI * RADIUS
  const tickAngle = Math.PI * (1 - THRESHOLD_PPM / GAUGE_MAX_PPM)
  const [x1, y1] = point(tickAngle, 68)
  const [x2, y2] = point(tickAngle, 92)

  return (
    <div className="gauge">
      <svg viewBox="0 0 200 116" role="img" aria-label={`${value ?? '—'} ppm`}>
        <path d={ARC} className="gauge-track" />
        <path
          d={ARC}
          className="gauge-value"
          style={{ stroke: color, strokeDasharray: `${(length * fraction).toFixed(1)} 400` }}
        />
        <line x1={x1} y1={y1} x2={x2} y2={y2} className="gauge-tick" />
      </svg>
      <div className="gauge-reading">
        <div className="gauge-number">{value === null ? '—' : formatPpm(value)}</div>
        <div className="gauge-unit">{unitLabel}</div>
      </div>
      <div className="gauge-scale" dir="ltr">
        <span>0</span>
        <span>{formatPpm(GAUGE_MAX_PPM)}</span>
      </div>
      <div className="gauge-threshold">
        <span className="gauge-threshold-mark" />
        {thresholdLabel}
      </div>
    </div>
  )
}

export default Gauge
