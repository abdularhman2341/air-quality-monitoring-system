const HttpError = require('../errors/HttpError');

class ReadingService {
  async processTelemetry(deviceId, reading) {
    throw HttpError.notImplemented('ReadingService.processTelemetry()', 'S1-10');
  }

  async getHistoricalReadings(userId, deviceId, from, to, page, limit) {
    throw HttpError.notImplemented('ReadingService.getHistoricalReadings()', 'S1-11');
  }

  async getLatestReading(userId, deviceId) {
    throw HttpError.notImplemented('ReadingService.getLatestReading()', 'S1-11');
  }
}

module.exports = new ReadingService();
