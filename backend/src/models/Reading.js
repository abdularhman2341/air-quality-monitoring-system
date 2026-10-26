const BaseModel = require('./BaseModel');
const HttpError = require('../errors/HttpError');
const prisma = require('../db/prisma');

const COLUMNS = {
  id: true,
  seq: true,
  reading_time: true,
  received_at: true,
  lpg_ppm_est: true,
  alarm_active: true,
  sensor_raw_adc: true,
  sensor_voltage: true,
  rs_ro_ratio: true,
};

class Reading extends BaseModel {
  static async findByDevice(deviceId, from, to, page, limit) {
    const where = {
      device_id: deviceId,
      reading_time: { gte: from ?? undefined, lte: to ?? undefined },
    };
    const [rows, total] = await Promise.all([
      prisma.reading.findMany({
        where,
        select: COLUMNS,
        orderBy: { reading_time: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
      }),
      prisma.reading.count({ where }),
    ]);
    return {
      data: rows.map((row) => new Reading(row)),
      total,
    };
  }

  static async findLatest(deviceId) {
    const row = await prisma.reading.findFirst({
      where: { device_id: deviceId },
      select: COLUMNS,
      orderBy: { reading_time: 'desc' },
    });
    return row ? new Reading(row) : null;
  }

  static async record(deviceId, payload) {
    throw HttpError.notImplemented('Reading.record()', 'S1-10');
  }
}

module.exports = Reading;