const BaseModel = require('./BaseModel');
const prisma = require('../db/prisma');
const { deviceTime } = require('../utils/deviceTime');

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

const integerOrNull = (value) => (Number.isInteger(value) ? value : null);
const numberOrNull = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

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
    const data = {
      device_id: deviceId,
      seq: integerOrNull(payload.seq),
      sensor_raw_adc: integerOrNull(payload.sensor_raw_adc),
      sensor_voltage: numberOrNull(payload.sensor_voltage),
      rs_ro_ratio: numberOrNull(payload.rs_ro_ratio),
      lpg_ppm_est: payload.lpg_ppm_est,
      alarm_active: payload.alarm_active,
      reading_time: deviceTime(payload.ts),
    };
    const { count } = await prisma.reading.createMany({ data: [data], skipDuplicates: true });
    return count === 1 ? new Reading(data) : null;
  }
}

module.exports = Reading;