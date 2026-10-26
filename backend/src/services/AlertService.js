const Alert = require('../models/Alert');
const { deviceTime } = require('../utils/deviceTime');

class AlertService {
  async handleAlarmEvent(deviceId, event) {
    const time = deviceTime(event.ts);
    const openAlert = await Alert.findOpen(deviceId);

    if (event.event === 'alarm_on') {
      if (openAlert) return openAlert;
      const alert = await Alert.open(deviceId, event.lpg_ppm_est, event.threshold_ppm, time);
      console.log(`MQTT ${deviceId} alert ${alert.id} opened`);
      return alert;
    }

    if (!openAlert) return null;
    await openAlert.close(time);
    console.log(`MQTT ${deviceId} alert ${openAlert.id} closed`);
    return openAlert;
  }

  async updatePeak(deviceId, lpgPpmEst) {
    await Alert.updatePeak(deviceId, lpgPpmEst);
  }

  async getAlertHistory(userId, filters) {
    const { data, total } = await Alert.getHistory(userId, filters);
    return { data, page: filters.page, limit: filters.limit, total };
  }
}

module.exports = new AlertService();