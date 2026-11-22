import Gauge from '../../components/Gauge'
import { useLanguage } from '../../i18n/LanguageContext'
import { THRESHOLD_PPM, formatPpm } from '../../utils/format'
import { STATE_COLORS } from './deviceState'

// The big status of the device on screen: its name, the state word with
// what it means and what to do, and the gauge with the latest ppm.
function StatusHero({ device, state }) {
  const { t } = useLanguage()
  const colors = STATE_COLORS[state]
  return (
    <section className={`status-hero hero-${state}`}>
      <div>
        <div className="hero-device" style={{ color: colors.ink }}>
          <span className={`dot ${state === 'alert' ? 'pulse' : ''}`} style={{ background: colors.ink }} />
          {device.name || device.mac_display}
          {device.location && ` · ${device.location}`}
        </div>
        <h2 className="hero-word" style={{ color: colors.ink }}>{t(`dashboard.${state}`)}</h2>
        <p className="hero-message">{t(`dashboard.${state}Message`)}</p>
        <p className="hero-advice">{t(`dashboard.${state}Advice`)}</p>
      </div>
      <Gauge
        value={device.latest ? device.latest.lpg_ppm_est : null}
        color={colors.ink}
        unitLabel={t('dashboard.ppmEstimated')}
        thresholdLabel={t('dashboard.threshold', { ppm: formatPpm(THRESHOLD_PPM) })}
      />
    </section>
  )
}

export default StatusHero
