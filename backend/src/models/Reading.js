const BaseModel = require('./BaseModel');
const HttpError = require('../errors/HttpError');
const pool = require('../config/db');

const COLUMNS = `id, seq, reading_time, received_at, lpg_ppm_est, alarm_active,
  sensor_raw_adc, sensor_voltage, rs_ro_ratio`;

const IN_RANGE = `device_id = $1
  AND ($2::timestamptz IS NULL OR reading_time >= $2)
  AND ($3::timestamptz IS NULL OR reading_time <= $3)`;

class Reading extends BaseModel {
  static async findByDevice(deviceId, from, to, page, limit) {
    const offset = (page - 1) * limit;
    const [rowsResult, countResult] = await Promise.all([
      pool.query(
        `SELECT ${COLUMNS} FROM readings WHERE ${IN_RANGE}
         ORDER BY reading_time DESC LIMIT $4 OFFSET $5`,
        [deviceId, from, to, limit, offset],
      ),
      pool.query(`SELECT COUNT(*) AS total FROM readings WHERE ${IN_RANGE}`, [deviceId, from, to]),
    ]);
    return {
      data: rowsResult.rows.map((row) => new Reading(row)),
      total: Number(countResult.rows[0].total),
    };
  }

  static async findLatest(deviceId) {
    const { rows } = await pool.query(
      `SELECT ${COLUMNS} FROM readings WHERE device_id = $1 ORDER BY reading_time DESC LIMIT 1`,
      [deviceId],
    );
    return rows[0] ? new Reading(rows[0]) : null;
  }

  static async record(deviceId, payload) {
    throw HttpError.notImplemented('Reading.record()', 'S1-10');
  }
}

module.exports = Reading;
