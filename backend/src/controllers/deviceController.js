const HttpError = require('../errors/HttpError');
const deviceService = require('../services/DeviceService');
const { requireString, optionalString } = require('../utils/validate');

async function list(req, res) {
  const devices = await deviceService.getUserDevices(req.userId);
  res.json(devices);
}

async function link(req, res) {
  const body = req.body || {};
  const mac = requireString(body.mac_address, 'mac_address', { max: 17 });
  const pairingCode = requireString(body.pairing_code, 'pairing_code', { max: 32 });
  const name = requireString(body.name, 'name', { max: 100 });
  const location = optionalString(body.location, 'location', 150);
  const device = await deviceService.linkDevice(req.userId, mac, pairingCode, name, location);
  res.status(201).json(device);
}

async function get(req, res) {
  const device = await deviceService.getDevice(req.userId, req.params.mac);
  res.json(device);
}

async function update(req, res) {
  throw HttpError.notImplemented('PATCH /devices/:mac', 'S2-06');
}

async function unlink(req, res) {
  throw HttpError.notImplemented('DELETE /devices/:mac', 'S2-06');
}

module.exports = { list, link, get, update, unlink };
