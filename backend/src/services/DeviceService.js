const HttpError = require('../errors/HttpError');

class DeviceService {
  async getUserDevices(userId) {
    throw HttpError.notImplemented('DeviceService.getUserDevices()', 'S2-06');
  }

  async getDevice(userId, mac) {
    throw HttpError.notImplemented('DeviceService.getDevice()', 'S2-06');
  }

  async linkDevice(userId, mac, pairingCode, name, location) {
    throw HttpError.notImplemented('DeviceService.linkDevice()', 'S2-06');
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
