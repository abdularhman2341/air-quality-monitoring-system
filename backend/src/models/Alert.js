const BaseModel = require('./BaseModel');
const prisma = require('../db/prisma');

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