const HttpError = require('../errors/HttpError');
const Reading = require('../models/Reading');
const deviceService = require('./DeviceService');
const alertService = require('./AlertService');

class ReadingService {
  async processTelemetry(deviceId, payload) {
    const reading = await Reading.record(deviceId, payload);
    if (!reading) return null;
    await deviceService.updateLastReading(deviceId, reading.reading_time);
    if (reading.alarm_active) {
      await alertService.updatePeak(deviceId, reading.lpg_ppm_est);
    }
    return reading;
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