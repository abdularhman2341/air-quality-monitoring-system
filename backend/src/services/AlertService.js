const HttpError = require('../errors/HttpError');

class AlertService {
  async handleAlarmEvent(deviceId, event) {
    throw HttpError.notImplemented('AlertService.handleAlarmEvent()', 'S2-07');
  }

  async updatePeak(deviceId, lpgPpmEst) {
    throw HttpError.notImplemented('AlertService.updatePeak()', 'S2-07');
  }

  async getAlertHistory(userId, filters) {
    throw HttpError.notImplemented('AlertService.getAlertHistory()', 'S2-07');
  }
}

module.exports = new AlertService();
