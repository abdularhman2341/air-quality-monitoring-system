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

  async updateDevice(userId, mac, changes) {
    const device = await this.getDevice(userId, mac);
    await device.update(changes);
    return this.getDevice(userId, mac);
  }

  async unlinkDevice(userId, mac) {
    const device = await this.getDevice(userId, mac);
    await device.unlink();
  }

  async updateDeviceStatus(deviceId, state) {
    await Device.setConnectionState(deviceId, state);
    console.log(`MQTT ${deviceId} is ${state}`);
  }

  async updateLastReading(deviceId, readingTime) {
    await Device.updateLastReading(deviceId, readingTime);
  }

  async validateOwnership(userId, deviceId) {
    const device = await Device.findOwned(userId, deviceId);
    return device !== null;
  }
}

module.exports = new DeviceService();