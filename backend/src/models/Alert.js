const BaseModel = require('./BaseModel');
const HttpError = require('../errors/HttpError');
const prisma = require('../db/prisma');
const AdminAction = require('./AdminAction');

const COLUMNS = {
  id: true,
  device_id: true,
  started_at: true,
  ended_at: true,
  peak_lpg_ppm_est: true,
  threshold_ppm: true,
};

class Alert extends BaseModel {
  static async findOpen(deviceId) {
    const row = await prisma.alert.findFirst({
      where: { device_id: deviceId, ended_at: null },
      select: COLUMNS,
      orderBy: { started_at: 'desc' },
    });
    return row ? new Alert(row) : null;
  }

  static async open(deviceId, lpgPpmEst, thresholdPpm, startedAt) {
    const row = await prisma.alert.create({
      data: {
        device_id: deviceId,
        started_at: startedAt,
        peak_lpg_ppm_est: lpgPpmEst,
        threshold_ppm: thresholdPpm,
      },
      select: COLUMNS,
    });
    return new Alert(row);
  }

  static async markEmailSent(id) {
    await prisma.alert.update({ where: { id }, data: { email_sent: true } });
  }

  static async wasEmailed(id) {
    const row = await prisma.alert.findUnique({ where: { id }, select: { email_sent: true } });
    return Boolean(row && row.email_sent);
  }

  async close(endedAt) {
    const row = await prisma.alert.update({
      where: { id: this.id },
      data: { ended_at: endedAt < this.started_at ? this.started_at : endedAt },
      select: COLUMNS,
    });
    Object.assign(this, row);
    return this;
  }

  static async updatePeak(deviceId, lpgPpmEst) {
    await prisma.alert.updateMany({
      where: { device_id: deviceId, ended_at: null, peak_lpg_ppm_est: { lt: lpgPpmEst } },
      data: { peak_lpg_ppm_est: lpgPpmEst },
    });
  }

  // Admin list: alerts of every device, newest first, with the device and owner.
  static async adminList({ openOnly, deviceId, page, limit }) {
    const where = { device_id: deviceId ?? undefined, ended_at: openOnly ? null : undefined };
    const [rows, total] = await Promise.all([
      prisma.alert.findMany({
        where,
        select: {
          ...COLUMNS,
          device: {
            select: { name: true, location: true, owner: { select: { id: true, name: true, email: true } } },
          },
        },
        orderBy: [{ started_at: 'desc' }, { id: 'desc' }],
        take: limit,
        skip: (page - 1) * limit,
      }),
      prisma.alert.count({ where }),
    ]);
    return { data: rows.map((row) => new Alert(row)), total };
  }

  // Ends an alert by hand, for example when the device never sent alarm_off
  // (#42). The update only matches an open alert, so if the device closes it at
  // the same moment, the admin gets 409 instead of overwriting ended_at.
  static async closeByAdmin(id, admin) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.alert.findUnique({ where: { id }, select: { device_id: true } });
      if (!existing) {
        throw new HttpError(404, 'ALERT_NOT_FOUND', 'Alert not found.');
      }
      const { count } = await tx.alert.updateMany({ where: { id, ended_at: null }, data: { ended_at: new Date() } });
      if (count === 0) {
        throw new HttpError(409, 'ALERT_ALREADY_CLOSED', 'This alert has already ended.');
      }
      await AdminAction.log(tx, admin, 'alert.close', { type: 'alert', id, label: existing.device_id });
      const row = await tx.alert.findUnique({
        where: { id },
        select: { ...COLUMNS, device: { select: { owner_id: true } } },
      });
      return new Alert(row);
    });
  }

  toAdminJSON() {
    const { device, ...alert } = this;
    const owner = device?.owner;
    return {
      ...alert,
      device: device
        ? {
          name: device.name,
          location: device.location,
          owner: owner ? { id: String(owner.id), name: owner.name, email: owner.email } : null,
        }
        : null,
    };
  }

  isOpen() {
    return this.ended_at === null || this.ended_at === undefined;
  }

  static async getHistory(userId, { deviceId, from, to, page, limit }) {
    const where = {
      device: { owner_id: Number(userId) },
      device_id: deviceId ?? undefined,
      started_at: { gte: from ?? undefined, lte: to ?? undefined },
    };
    const [rows, total] = await Promise.all([
      prisma.alert.findMany({
        where,
        select: COLUMNS,
        orderBy: { started_at: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
      }),
      prisma.alert.count({ where }),
    ]);
    return { data: rows.map((row) => new Alert(row)), total };
  }
}

module.exports = Alert;