const bcrypt = require('bcryptjs');
const BaseModel = require('./BaseModel');
const HttpError = require('../errors/HttpError');
const prisma = require('../db/prisma');
const Reading = require('./Reading');

const MAC_PATTERN = /^[0-9A-F]{12}$/;

const COLUMNS = {
  device_id: true,
  owner_id: true,
  name: true,
  location: true,
  connection_state: true,
  online_since: true,
  last_reading_at: true,
  created_at: true,
};

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

  static async isRegistered(deviceId) {
    const row = await prisma.device.findUnique({
      where: { device_id: deviceId },
      select: { device_id: true },
    });
    return row !== null;
  }

  static async withLatest(row) {
    const latest = await prisma.reading.findFirst({
      where: { device_id: row.device_id },
      select: { lpg_ppm_est: true, alarm_active: true, reading_time: true },
      orderBy: { reading_time: 'desc' },
    });
    return new Device({ ...row, ...latest });
  }

  static async findByOwner(userId) {
    const rows = await prisma.device.findMany({
      where: { owner_id: Number(userId) },
      select: COLUMNS,
      orderBy: [{ created_at: 'asc' }, { device_id: 'asc' }],
    });
    return Promise.all(rows.map((row) => Device.withLatest(row)));
  }

  static async findOwned(userId, deviceId) {
    const row = await prisma.device.findFirst({
      where: { device_id: deviceId, owner_id: Number(userId) },
      select: COLUMNS,
    });
    return row ? Device.withLatest(row) : null;
  }

  static async link(userId, deviceId, pairingCode, name, location) {
    const ownerId = Number(userId);
    const device = await prisma.device.findUnique({
      where: { device_id: deviceId },
      select: { owner_id: true, pairing_code_hash: true },
    });
    const codeMatches = device ? await bcrypt.compare(pairingCode, device.pairing_code_hash) : false;
    if (!codeMatches) {
      throw new HttpError(404, 'DEVICE_NOT_FOUND', 'No device matches this MAC address and pairing code.');
    }
    const { count } = await prisma.device.updateMany({
      where: {
        device_id: deviceId,
        OR: [{ owner_id: null }, { owner_id: ownerId }],
      },
      data: { owner_id: ownerId, name, location },
    });
    if (count === 0) {
      throw new HttpError(409, 'DEVICE_ALREADY_LINKED', 'This device is already linked to another account.');
    }
    return Device.findOwned(userId, deviceId);
  }

  async update(changes) {
    const { count } = await prisma.device.updateMany({
      where: { device_id: this.device_id, owner_id: this.owner_id },
      data: changes,
    });
    if (count === 0) {
      throw new HttpError(404, 'DEVICE_NOT_FOUND', 'Device not found.');
    }
  }

  async unlink() {
    await prisma.$transaction(async (tx) => {
      const { count } = await tx.device.updateMany({
        where: { device_id: this.device_id, owner_id: this.owner_id },
        data: { owner_id: null, name: null, location: null, last_reading_at: null },
      });
      if (count === 0) {
        throw new HttpError(404, 'DEVICE_NOT_FOUND', 'Device not found.');
      }
      await tx.alert.deleteMany({ where: { device_id: this.device_id } });
      await tx.reading.deleteMany({ where: { device_id: this.device_id } });
    });
  }

  static async setConnectionState(deviceId, state) {
    if (state === 'online') {
      await prisma.device.updateMany({
        where: { device_id: deviceId, connection_state: 'offline' },
        data: { connection_state: 'online', online_since: new Date() },
      });
      return;
    }
    await prisma.device.updateMany({
      where: { device_id: deviceId },
      data: { connection_state: 'offline', online_since: null },
    });
  }

  static async updateLastReading(deviceId, readingTime) {
    await prisma.device.updateMany({
      where: {
        device_id: deviceId,
        OR: [{ last_reading_at: null }, { last_reading_at: { lt: readingTime } }],
      },
      data: { last_reading_at: readingTime },
    });
  }

  belongsTo(userId) {
    return this.owner_id !== null && String(this.owner_id) === String(userId);
  }

  async getReadings(from, to, page, limit) {
    return Reading.findByDevice(this.device_id, from, to, page, limit);
  }

  async getLatestReading() {
    return Reading.findLatest(this.device_id);
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