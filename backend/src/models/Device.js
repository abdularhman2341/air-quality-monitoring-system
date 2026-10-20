const BaseModel = require('./BaseModel');
const HttpError = require('../errors/HttpError');

const MAC_PATTERN = /^[0-9A-F]{12}$/;

class Device extends BaseModel {
  static normalizeMac(mac) {
    const normalized = String(mac).replace(/[:-]/g, '').toUpperCase();
    if (!MAC_PATTERN.test(normalized)) {
      throw new HttpError(400, 'INVALID_MAC', 'MAC address must have 12 hexadecimal characters.');
    }
    return normalized;
  }

  async link(userId, pairingCode) {
    throw HttpError.notImplemented('Device.link()', 'S2-06');
  }

  async unlink() {
    throw HttpError.notImplemented('Device.unlink()', 'S2-06');
  }

  async setConnectionState(state) {
    throw HttpError.notImplemented('Device.setConnectionState()', 'S1-10');
  }

  belongsTo(userId) {
    return this.owner_id !== null && String(this.owner_id) === String(userId);
  }

  async getReadings(from, to, page, limit) {
    throw HttpError.notImplemented('Device.getReadings()', 'S1-11');
  }

  async getLatestReading() {
    throw HttpError.notImplemented('Device.getLatestReading()', 'S1-11');
  }
}

module.exports = Device;
