const HttpError = require('../errors/HttpError');
const deviceService = require('./DeviceService');

class ReadingService {
  async processTelemetry(deviceId, reading) {
    throw HttpError.notImplemented('ReadingService.processTelemetry()', 'S1-10');
  }

   async getHistoricalReadings(userId, mac, from, to, page, limit) {
    const device = await deviceService.getDevice(userId, mac);
    const { data, total } = await device.getReadings(from, to, page, limit);
    return { data, page, limit, total };
  }

  async getLatestReading(userId, mac) {
    const device = await deviceService.getDevice(userId, mac);
    const reading = await device.getLatestReading();
    if (!reading) {
      throw new HttpError(404, 'NO_READINGS', 'This device has no readings yet.');
    }
    return reading;
  }
}

module.exports = new ReadingService();
