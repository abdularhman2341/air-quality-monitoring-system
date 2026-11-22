import { useLanguage } from '../../i18n/LanguageContext'
import SensorForm from './SensorForm'
import MySensors from './MySensors'
import './AddSensor.css'

const STEPS = [1, 2, 3]

// Link a new sensor on one side; the linked sensors and the setup steps on
// the other.
function AddSensor() {
  const { t } = useLanguage()
  return (
    <div className="add-sensor">
      <SensorForm />
      <div className="add-sensor-side">
        <MySensors />
        <ol className="add-steps">
          {STEPS.map((step) => (
            <li key={step}>
              <span className="step-number">{step}</span>
              <div>
                <div className="step-title">{t(`addSensor.step${step}Title`)}</div>
                <div className="step-body">{t(`addSensor.step${step}Body`)}</div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

export default AddSensor
