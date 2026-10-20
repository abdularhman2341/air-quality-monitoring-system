const bcrypt = require('bcryptjs');
const BaseModel = require('./BaseModel');
const HttpError = require('../errors/HttpError');
const pool = require('../config/db');

const MAC_PATTERN = /^[0-9A-F]{12}$/;

const SELECT_WITH_LATEST = `
  SELECT d.device_id, d.owner_id, d.name, d.location, d.connection_state,
         d.online_since, d.last_reading_at, d.created_at,
         r.lpg_ppm_est, r.alarm_active, r.reading_time
  FROM devices d
  LEFT JOIN LATERAL (
    SELECT lpg_ppm_est, alarm_active, reading_time
    FROM readings
    WHERE readings.device_id = d.device_id
    ORDER BY reading_time DESC
    LIMIT 1
  ) r ON true`;

class Device extends BaseModel {
  static normalizeMac(mac) {
    const normalized = String(mac ?? '').replace(/[:-]/g, '').trim().toUpperCase();
    if (!MAC_PATTERN.test(normalized)) {
      throw new HttpError(400, 'INVALID_MAC', 'MAC address must have 12 hexadecimal characters.');
    }
    return normalized;
  }

  static formatMac(deviceId) {
    return deviceId.match(/.{2}/g).join(':');
  }

  static async findByOwner(userId) {
    const { rows } = await pool.query(
      `${SELECT_WITH_LATEST} WHERE d.owner_id = $1 ORDER BY d.created_at, d.device_id`,
      [userId],
    );
    return rows.map((row) => new Device(row));
  }

  static async findOwned(userId, deviceId) {
    const { rows } = await pool.query(
      `${SELECT_WITH_LATEST} WHERE d.device_id = $1 AND d.owner_id = $2`,
      [deviceId, userId],
    );
    return rows[0] ? new Device(rows[0]) : null;
  }

  static async link(userId, deviceId, pairingCode, name, location) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        'SELECT device_id, owner_id, pairing_code_hash FROM devices WHERE device_id = $1 FOR UPDATE',
        [deviceId],
      );
      const device = rows[0];
      const codeMatches = device ? await bcrypt.compare(pairingCode, device.pairing_code_hash) : false;
      if (!codeMatches) {
        throw new HttpError(404, 'DEVICE_NOT_FOUND', 'No device matches this MAC address and pairing code.');
      }
      if (device.owner_id !== null && String(device.owner_id) !== String(userId)) {
        throw new HttpError(409, 'DEVICE_ALREADY_LINKED', 'This device is already linked to another account.');
      }
      await client.query(
        'UPDATE devices SET owner_id = $1, name = $2, location = $3 WHERE device_id = $4',
        [userId, name, location, deviceId],
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    return Device.findOwned(userId, deviceId);
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

  toJSON() {
    return {
      device_id: this.device_id,
      mac_display: Device.formatMac(this.device_id),
      name: this.name,
      location: this.location,
      connection_state: this.connection_state,
      last_reading_at: this.last_reading_at,
      latest: this.reading_time
        ? { lpg_ppm_est: Number(this.lpg_ppm_est), alarm_active: this.alarm_active, reading_time: this.reading_time }
        : null,
      estimate_validated: false,
    };
  }
}

module.exports = Device;