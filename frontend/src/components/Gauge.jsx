import { GAUGE_MAX_PPM, THRESHOLD_PPM, formatPpm } from '../utils/format'

const CENTER = 100
const RADIUS = 80
// A half circle from left (0 ppm) to right (GAUGE_MAX_PPM), centre (100, 100)
// and radius 80, in SVG viewBox units.
const ARC = 'M20 100 A80 80 0 0 1 180 100'

// A point on a circle around the centre. SVG y grows downwards, hence minus.
function point(angle, radius) {
  return [CENTER + radius * Math.cos(angle), CENTER - radius * Math.sin(angle)]
}

// The dial: grey track, the coloured part for the value, and the threshold mark.
function GaugeArc({ value, color }) {
  const fraction = value === null ? 0 : Math.min(Math.max(value / GAUGE_MAX_PPM, 0), 1)
  // The coloured arc is the same path, drawn with a dash as long as the
  // value's share of the half circle (π × radius); the gap of 400 hides the rest.
  const length = Math.PI * RADIUS
  // The threshold mark: π (left) at 0 ppm, 0 (right) at GAUGE_MAX_PPM.
  const tickAngle = Math.PI * (1 - THRESHOLD_PPM / GAUGE_MAX_PPM)
  const [x1, y1] = point(tickAngle, 68)
  const [x2, y2] = point(tickAngle, 92)

  return (
    <svg viewBox="0 0 200 116" role="img" aria-label={`${value ?? '—'} ppm`}>
      <path d={ARC} className="gauge-track" />
      <path
        d={ARC}
        className="gauge-value"
        style={{ stroke: color, strokeDasharray: `${(length * fraction).toFixed(1)} 400` }}
      />
      <line x1={x1} y1={y1} x2={x2} y2={y2} className="gauge-tick" />
    </svg>
  )
}

function Gauge({ value, color, unitLabel, thresholdLabel }) {
  return (
    <div className="gauge">
      <GaugeArc value={value} color={color} />
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
