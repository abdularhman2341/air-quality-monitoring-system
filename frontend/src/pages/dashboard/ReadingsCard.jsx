import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useLanguage } from '../../i18n/LanguageContext'
import { GAUGE_MAX_PPM, THRESHOLD_PPM, formatMoment, formatPpm } from '../../utils/format'
import { STATE_COLORS } from './deviceState'

// The chart's fixed settings. Each one is passed to its chart part as is;
// only the values that change (time format, y range, colors) are added there.
const AXIS_TICK = { fontSize: 11, fill: 'var(--text-faint)' }
const X_AXIS = { dataKey: 'time', tick: AXIS_TICK, tickLine: false, axisLine: { stroke: 'var(--border)' }, minTickGap: 40 }
const Y_AXIS = { ticks: [0, 600, 1200, GAUGE_MAX_PPM], tickFormatter: formatPpm, tick: AXIS_TICK, tickLine: false, axisLine: false, width: 44 }
const AREA = { type: 'monotone', dataKey: 'ppm', strokeWidth: 2.5, isAnimationActive: false }
const CHART_MARGIN = { top: 8, right: 8, bottom: 0, left: 0 }

// The API sends readings newest first; the chart draws oldest to newest.
function toChartData(data) {
  return (data?.data || []).slice().reverse().map((r) => ({ time: r.reading_time, ppm: r.lpg_ppm_est }))
}

// The device's recent readings as a chart, with the threshold line.
function ReadingsCard({ data, state }) {
  const { t } = useLanguage()
  const chartData = toChartData(data)
  return (
    <section className="card readings-card">
      <div className="readings-head">
        <h3>{t('dashboard.recentReadings')}</h3>
        <span>{t('dashboard.lastCount', { count: chartData.length })}</span>
        <span className="legend">
          <span className="legend-line" />
          {t('dashboard.threshold', { ppm: formatPpm(THRESHOLD_PPM) })}
        </span>
      </div>
      {chartData.length === 0 ? (
        <p className="dashboard-message">{t('dashboard.noReadings')}</p>
      ) : (
        <ReadingsChart data={chartData} colors={STATE_COLORS[state]} />
      )}
      <p className="estimate-note">{t('dashboard.estimateNote')}</p>
    </section>
  )
}

// The y axis reaches at least GAUGE_MAX_PPM, so the threshold line stays in
// the same place unless a reading goes higher. Times from an earlier day
// show their date (F13).
function ReadingsChart({ data, colors }) {
  const { locale } = useLanguage()
  const time = (v) => formatMoment(v, locale)
  const chartMax = Math.max(GAUGE_MAX_PPM, ...data.map((r) => r.ppm))
  return (
    <div className="chart" dir="ltr">
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data} margin={CHART_MARGIN}>
          <CartesianGrid vertical={false} stroke="#f0f1f3" />
          <XAxis {...X_AXIS} tickFormatter={time} />
          <YAxis {...Y_AXIS} domain={[0, chartMax]} />
          <Tooltip labelFormatter={time} formatter={(v) => [`${formatPpm(v)} ppm`, '']} separator="" />
          <ReferenceLine y={THRESHOLD_PPM} stroke="var(--text)" strokeDasharray="5 5" />
          <Area {...AREA} stroke={colors.ink} fill={colors.fill} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export default ReadingsCard
