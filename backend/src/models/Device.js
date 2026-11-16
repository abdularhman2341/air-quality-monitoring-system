const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const BaseModel = require('./BaseModel');
const HttpError = require('../errors/HttpError');
const prisma = require('../db/prisma');
const Reading = require('./Reading');
const AdminAction = require('./AdminAction');
const { bcryptRounds } = require('../config/auth');

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

// A device without an owner: it can be linked again with its pairing code.
const RELEASED = { owner_id: null, name: null, location: null, last_reading_at: null, alert_email_at: null };

const ADMIN_COLUMNS = { ...COLUMNS, owner: { select: { id: true, name: true, email: true } } };

// Pairing codes look like K7QM-4XPB: 8 characters from 32 letters and digits
// that are hard to confuse (no 0/O, 1/I), about 10^12 possible codes.
const PAIRING_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const UNIQUE_VIOLATION = 'P2002';

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

  static async findOwnerId(deviceId) {
    const row = await prisma.device.findUnique({
      where: { device_id: deviceId },
      select: { owner_id: true },
    });
    return row ? row.owner_id : undefined;
  }

  // Marks that an alert email is being sent for this device and returns its
  // name and location, or null when one was sent in the last `minutes`.
  // One statement, so two alarms at the same moment cannot both pass.
  static async claimAlertEmail(deviceId, minutes) {
    const rows = await prisma.$queryRaw`
      UPDATE devices SET alert_email_at = now()
      WHERE device_id = ${deviceId}
        AND (alert_email_at IS NULL OR alert_email_at < now() - make_interval(mins => ${minutes}::int))
      RETURNING name, location`;
    return rows.length ? rows[0] : null;
  }

  static async findLabel(deviceId) {
    return prisma.device.findUnique({ where: { device_id: deviceId }, select: { name: true, location: true } });
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
        data: RELEASED,
      });
      if (count === 0) {
        throw new HttpError(404, 'DEVICE_NOT_FOUND', 'Device not found.');
      }
      await tx.alert.deleteMany({ where: { device_id: this.device_id } });
      await tx.reading.deleteMany({ where: { device_id: this.device_id } });
    });
  }

  // Unlinks every device of an account that is being deleted, inside the
  // caller's transaction. Same rule as unlink(): the history is deleted, so
  // the next owner of a device starts empty.
  static async releaseAllOwnedBy(tx, userId) {
    const ownerId = Number(userId);
    const owned = await tx.device.findMany({ where: { owner_id: ownerId }, select: { device_id: true } });
    const deviceIds = owned.map((device) => device.device_id);
    if (deviceIds.length === 0) {
      return 0;
    }
    await tx.alert.deleteMany({ where: { device_id: { in: deviceIds } } });
    await tx.reading.deleteMany({ where: { device_id: { in: deviceIds } } });
    const { count } = await tx.device.updateMany({
      where: { device_id: { in: deviceIds }, owner_id: ownerId },
      data: RELEASED,
    });
    return count;
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

  async getReadings(from, to, page, limit) {
    return Reading.findByDevice(this.device_id, from, to, page, limit);
  }

  async getLatestReading() {
    return Reading.findLatest(this.device_id);
  }

  static newPairingCode() {
    const chars = Array.from({ length: 8 }, () => PAIRING_ALPHABET[crypto.randomInt(PAIRING_ALPHABET.length)]);
    return `${chars.slice(0, 4).join('')}-${chars.slice(4).join('')}`;
  }

  // Admin list: every device with its owner. The search matches the MAC
  // (with or without separators), the name, the location or the owner's email.
  static async adminSearch(query, page, limit) {
    let where = {};
    if (query) {
      const contains = { contains: query, mode: 'insensitive' };
      const mac = query.replace(/[:-]/g, '').toUpperCase();
      where = {
        OR: [
          ...(mac ? [{ device_id: { contains: mac } }] : []),
          { name: contains },
          { location: contains },
          { owner: { is: { email: contains } } },
        ],
      };
    }
    const [rows, total] = await Promise.all([
      prisma.device.findMany({
        where,
        select: ADMIN_COLUMNS,
        orderBy: [{ created_at: 'asc' }, { device_id: 'asc' }],
        take: limit,
        skip: (page - 1) * limit,
      }),
      prisma.device.count({ where }),
    ]);
    return { data: await Promise.all(rows.map((row) => Device.withLatest(row))), total };
  }

  static async adminFind(deviceId) {
    const row = await prisma.device.findUnique({ where: { device_id: deviceId }, select: ADMIN_COLUMNS });
    return row ? Device.withLatest(row) : null;
  }

  // Registers a new device. The pairing code is returned once and only its
  // bcrypt hash is stored, so nobody can read it back later (not even an admin).
  static async register(deviceId, name, location, admin) {
    const pairingCode = Device.newPairingCode();
    const pairingCodeHash = await bcrypt.hash(pairingCode, bcryptRounds);
    try {
      await prisma.$transaction(async (tx) => {
        await tx.device.create({ data: { device_id: deviceId, pairing_code_hash: pairingCodeHash, name, location } });
        await AdminAction.log(tx, admin, 'device.create', { type: 'device', id: deviceId, label: name }, { name, location });
      });
    } catch (err) {
      if (err.code === UNIQUE_VIOLATION) {
        throw new HttpError(409, 'DEVICE_EXISTS', 'A device with this MAC address is already registered.');
      }
      throw err;
    }
    return { device: await Device.adminFind(deviceId), pairingCode };
  }

  // Admin edit of name, location and owner. A new owner (or none) gets an
  // empty history, the same rule as unlink(): nobody sees another owner's data.
  // newOwner is the User for a new owner_id; the log keeps both owners' emails.
  async adminUpdate(changes, admin, newOwner = null) {
    const data = {};
    const details = {};
    for (const [field, value] of Object.entries(changes)) {
      if (value !== this[field]) {
        data[field] = value;
        details[field] = { from: this[field], to: value };
      }
    }
    if (Object.keys(data).length === 0) {
      return;
    }
    const ownerChanged = 'owner_id' in data;
    if (ownerChanged) {
      delete details.owner_id;
      details.owner = { from: this.owner?.email ?? null, to: newOwner?.email ?? null };
    }
    const target = this.logTarget();
    await prisma.$transaction(async (tx) => {
      if (ownerChanged) {
        data.last_reading_at = null;
        await tx.alert.deleteMany({ where: { device_id: this.device_id } });
        await tx.reading.deleteMany({ where: { device_id: this.device_id } });
      }
      await tx.device.update({ where: { device_id: this.device_id }, data });
      await AdminAction.log(tx, admin, 'device.update', target, { ...details, history_deleted: ownerChanged });
    });
  }

  // Deletes the row with its readings and alerts (ON DELETE CASCADE). The device
  // must be registered again before anyone can link it; its MQTT messages are dropped.
  async adminDelete(admin) {
    await prisma.$transaction(async (tx) => {
      await AdminAction.log(tx, admin, 'device.delete', this.logTarget(), { owner: this.owner?.email ?? null });
      await tx.device.delete({ where: { device_id: this.device_id } });
    });
  }

  async replacePairingCode(admin) {
    const pairingCode = Device.newPairingCode();
    const pairingCodeHash = await bcrypt.hash(pairingCode, bcryptRounds);
    await prisma.$transaction(async (tx) => {
      await tx.device.update({ where: { device_id: this.device_id }, data: { pairing_code_hash: pairingCodeHash } });
      await AdminAction.log(tx, admin, 'device.pairing_code', this.logTarget());
    });
    return pairingCode;
  }

  logTarget() {
    return { type: 'device', id: this.device_id, label: this.name };
  }

  toAdminJSON() {
    return {
      ...this.toJSON(),
      owner: this.owner ? { id: String(this.owner.id), name: this.owner.name, email: this.owner.email } : null,
      online_since: this.online_since,
      created_at: this.created_at,
    };
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