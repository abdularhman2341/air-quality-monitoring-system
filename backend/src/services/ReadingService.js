const HttpError = require('../errors/HttpError');
const Reading = require('../models/Reading');
const deviceService = require('./DeviceService');
const alertService = require('./AlertService');
const realtimeGateway = require('./RealtimeGateway');

class ReadingService {
  // Saves one reading from MQTT. QoS 1 can deliver the same message twice;
  // the second copy (same device and time) is not saved and Reading.record
  // returns null, so nothing else runs and the dashboard gets it once.
  // While the alarm is on, each reading can raise the open alert's peak.
  async processTelemetry(deviceId, payload, ownerId) {
    const reading = await Reading.record(deviceId, payload);
    if (!reading) return null;
    await deviceService.updateLastReading(deviceId, reading.reading_time);
    await deviceService.markOnline(deviceId, ownerId);
    if (reading.alarm_active) {
      await alertService.updatePeak(deviceId, reading.lpg_ppm_est);
    } else {
      await alertService.closeIfAlarmStopped(deviceId, reading.reading_time, ownerId);
    }
    realtimeGateway.emitToOwner(ownerId, 'reading:new', reading);
    return reading;
  }

  // getDevice first, so a user can only read their own devices (404 otherwise).
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