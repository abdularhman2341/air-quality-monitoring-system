const alertService = require('../services/AlertService');
const deviceService = require('../services/DeviceService');
const Device = require('../models/Device');
const { optionalDate, optionalInt, invalid } = require('../utils/validate');

function readFilters(query) {
  const from = optionalDate(query.from, 'from');
  const to = optionalDate(query.to, 'to');
  if (from && to && from > to) {
    throw invalid('from must be before to.');
  }
  const page = optionalInt(query.page, 'page', { max: 1000000, fallback: 1 });
  const limit = optionalInt(query.limit, 'limit', { max: 1000, fallback: 100 });
  return { from, to, page, limit };
}

async function list(req, res) {
  const filters = readFilters(req.query);
  if (req.query.device_id !== undefined && req.query.device_id !== '') {
    filters.deviceId = Device.normalizeMac(req.query.device_id);
  }
  res.json(await alertService.getAlertHistory(req.userId, filters));
}

async function listForDevice(req, res) {
  const filters = readFilters(req.query);
  const device = await deviceService.getDevice(req.userId, req.params.mac);
  filters.deviceId = device.device_id;
  res.json(await alertService.getAlertHistory(req.userId, filters));
}

module.exports = { list, listForDevice };