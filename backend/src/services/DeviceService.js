const HttpError = require('../errors/HttpError');
const Device = require('../models/Device');

class DeviceService {
    async getUserDevices(userId) {
    return Device.findByOwner(userId);
  }

  async getDevice(userId, mac) {
    const device = await Device.findOwned(userId, Device.normalizeMac(mac));
    if (!device) {
      throw new HttpError(404, 'DEVICE_NOT_FOUND', 'Device not found.');
    }
    return device;
  }

  async linkDevice(userId, mac, pairingCode, name, location) {
    return Device.link(userId, Device.normalizeMac(mac), pairingCode, name, location);
  }

  async updateDevice(userId, mac, data) {
    throw HttpError.notImplemented('DeviceService.updateDevice()', 'S2-06');
  }

  async unlinkDevice(userId, mac) {
    throw HttpError.notImplemented('DeviceService.unlinkDevice()', 'S2-06');
  }

  async updateDeviceStatus(deviceId, state) {
    throw HttpError.notImplemented('DeviceService.updateDeviceStatus()', 'S1-10');
  }

  async updateLastReading(deviceId, readingTime) {
    throw HttpError.notImplemented('DeviceService.updateLastReading()', 'S1-10');
  }

  async validateOwnership(userId, deviceId) {
    throw HttpError.notImplemented('DeviceService.validateOwnership()', 'S2-06');
  }
}

module.exports = new DeviceService();
