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

// Optional sensor fields: a missing or wrong value is stored as null instead
// of rejecting the whole reading. "Wrong" includes a value the database would
// refuse: seq is a 32-bit INTEGER column, and readings_adc_range allows 0 to
// 4095 (the ESP32's 12-bit ADC). A refused row is an error, and an error
// leaves the MQTT message unacknowledged, so it would come back forever (B5).
const INT32_MIN = -(2 ** 31);
const INT32_MAX = 2 ** 31 - 1;
const ADC_MAX = 4095;
const integerOrNull = (value, min = INT32_MIN, max = INT32_MAX) => (
  Number.isInteger(value) && value >= min && value <= max ? value : null
);
const numberOrNull = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

class Reading extends BaseModel {
  // Newest first. Prisma ignores a filter set to undefined, so a missing from
  // or to (?? undefined) means "no limit on that side".
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

  // Returns null when this device already has a reading at this time: QoS 1
  // can deliver a message twice, and the unique (device_id, reading_time)
  // index with skipDuplicates keeps one copy. reading_time is the device
  // clock, or the server clock when the two are far apart (deviceTime).
  static async record(deviceId, payload) {
    const data = {
      device_id: deviceId,
      seq: integerOrNull(payload.seq),
      sensor_raw_adc: integerOrNull(payload.sensor_raw_adc, 0, ADC_MAX),
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