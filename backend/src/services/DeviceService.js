const HttpError = require('../errors/HttpError');
const Device = require('../models/Device');
const realtimeGateway = require('./RealtimeGateway');

// Device rules for the REST API (always for the signed-in user) and the
// status and last-reading updates that MQTT messages trigger.
class DeviceService {
  async getUserDevices(userId) {
    return Device.findByOwner(userId);
  }

  // Every per-device route goes through here. The MAC may come with colons
  // or dashes (normalizeMac). A device of another user answers 404, the same
  // as one that does not exist, so the API never shows whose devices exist.
  async getDevice(userId, mac) {
    const device = await Device.findOwned(userId, Device.normalizeMac(mac));
    if (!device) {
      throw new HttpError(404, 'DEVICE_NOT_FOUND', 'Device not found.');
    }
    return device;
  }

  // The pairing code and "already linked" rules live in Device.link.
  async linkDevice(userId, mac, pairingCode, name, location) {
    return Device.link(userId, Device.normalizeMac(mac), pairingCode, name, location);
  }

  // device.update does not refresh the object, so the device is read again
  // to answer with the stored values.
  async updateDevice(userId, mac, changes) {
    const device = await this.getDevice(userId, mac);
    await device.update(changes);
    return this.getDevice(userId, mac);
  }

  // Frees the device and deletes its readings and alerts (Device.unlink), so
  // a new owner never sees the previous owner's data. The row stays, so the
  // same pairing code works again (stage 3 report, decision 18b).
  async unlinkDevice(userId, mac) {
    const device = await this.getDevice(userId, mac);
    await device.unlink();
  }

  // From the device's status topic: 'online' when it connects, 'offline'
  // from its Last Will when the broker loses it.
  async updateDeviceStatus(deviceId, state, ownerId) {
    await Device.setConnectionState(deviceId, state);
    console.log(`MQTT ${deviceId} is ${state}`);
    realtimeGateway.emitToOwner(ownerId, 'device:status', { device_id: deviceId, state, ts: new Date().toISOString() });
  }

  // Only moves forward: a late or resent reading never moves it back.
  async updateLastReading(deviceId, readingTime) {
    await Device.updateLastReading(deviceId, readingTime);
  }
}

module.exports = new DeviceService();