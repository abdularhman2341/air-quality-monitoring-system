const Alert = require('../models/Alert');
const Device = require('../models/Device');
const User = require('../models/User');
const { deviceTime } = require('../utils/deviceTime');
const { gasAlertEmail, gasAlertEndedEmail } = require('../utils/emails');
const realtimeGateway = require('./RealtimeGateway');
const mailService = require('./MailService');

const EMAIL_EVERY_MINUTES = 10;

// The site address for the link in alert emails, without a trailing slash.
const appUrl = () => (process.env.APP_URL || '').replace(/\/+$/, '') || null;

class AlertService {
  constructor() {
    this.emailQueues = new Map();
  }

  async handleAlarmEvent(deviceId, event, ownerId) {
    const time = deviceTime(event.ts);
    const openAlert = await Alert.findOpen(deviceId);

    if (event.event === 'alarm_on') {
      if (openAlert) return openAlert;
      const alert = await Alert.open(deviceId, event.lpg_ppm_est, event.threshold_ppm, time);
      console.log(`MQTT ${deviceId} alert ${alert.id} opened`);
      realtimeGateway.emitToOwner(ownerId, 'alert:new', alert);
      this.emailLater(deviceId, () => this.emailAlarmStarted(alert, ownerId));
      return alert;
    }

    if (!openAlert) return null;
    await openAlert.close(time);
    console.log(`MQTT ${deviceId} alert ${openAlert.id} closed`);
    realtimeGateway.emitToOwner(ownerId, 'alert:new', openAlert);
    this.emailLater(deviceId, () => this.emailAlarmEnded(openAlert, ownerId));
    return openAlert;
  }

  // Emails are prepared after the MQTT message is handled, so a slow database
  // or mail provider never holds up readings. The emails of one device run
  // one after the other: the "ended" email must see whether "started" went out.
  emailLater(deviceId, job) {
    const previous = this.emailQueues.get(deviceId) || Promise.resolve();
    const current = previous
      .then(job)
      .catch((err) => console.error(`Alert email for ${deviceId} failed: ${err.message}`));
    this.emailQueues.set(deviceId, current);
    current.then(() => {
      if (this.emailQueues.get(deviceId) === current) this.emailQueues.delete(deviceId);
    });
  }

  async alertEmailOwner(ownerId) {
    if (ownerId === null || ownerId === undefined) return null;
    const owner = await User.findById(ownerId);
    return owner && owner.wantsAlertEmails() ? owner : null;
  }

  // At most one "started" email per device every 10 minutes, so an alarm
  // that goes on and off does not fill the inbox (or the daily mail quota).
  async emailAlarmStarted(alert, ownerId) {
    const owner = await this.alertEmailOwner(ownerId);
    if (!owner) return;
    const device = await Device.claimAlertEmail(alert.device_id, EMAIL_EVERY_MINUTES);
    if (!device) return;
    await Alert.markEmailSent(alert.id);
    const email = gasAlertEmail({
      device, ppm: alert.peak_lpg_ppm_est, thresholdPpm: alert.threshold_ppm, startedAt: alert.started_at, appUrl: appUrl(),
    });
    mailService.sendInBackground(owner.email, email, 'gas alert');
  }

  async emailAlarmEnded(alert, ownerId) {
    if (!(await Alert.wasEmailed(alert.id))) return;
    const owner = await this.alertEmailOwner(ownerId);
    if (!owner) return;
    const device = await Device.findLabel(alert.device_id);
    if (!device) return;
    const email = gasAlertEndedEmail({
      device, peakPpm: alert.peak_lpg_ppm_est, endedAt: alert.ended_at, appUrl: appUrl(),
    });
    mailService.sendInBackground(owner.email, email, 'gas alert ended');
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