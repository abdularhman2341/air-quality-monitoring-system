const BaseModel = require('./BaseModel');
const HttpError = require('../errors/HttpError');

class Alert extends BaseModel {
  static async open(deviceId, lpgPpmEst, thresholdPpm, ts) {
    throw HttpError.notImplemented('Alert.open()', 'S2-07');
  }

  async close(ts) {
    throw HttpError.notImplemented('Alert.close()', 'S2-07');
  }

  async updatePeak(lpgPpmEst) {
    throw HttpError.notImplemented('Alert.updatePeak()', 'S2-07');
  }

  isOpen() {
    return this.ended_at === null || this.ended_at === undefined;
  }

  static async getHistory(userId, filters) {
    throw HttpError.notImplemented('Alert.getHistory()', 'S2-07');
  }
}

module.exports = Alert;
