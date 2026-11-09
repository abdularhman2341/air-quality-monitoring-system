const adminService = require('../services/AdminService');
const AdminAction = require('../models/AdminAction');
const HttpError = require('../errors/HttpError');
const Device = require('../models/Device');
const {
  requireString, requireEmail, optionalString, optionalDate, optionalInt, invalid,
} = require('../utils/validate');

const ROLES = ['user', 'admin'];
const MAX_ID = 2147483647;

function readPage(query) {
  const page = optionalInt(query.page, 'page', { max: 1000000, fallback: 1 });
  const limit = optionalInt(query.limit, 'limit', { max: 200, fallback: 50 });
  return { page, limit };
}

function readSearch(query) {
  return typeof query.q === 'string' ? query.q.trim().slice(0, 100) : '';
}

// Ids in the URL are whole numbers. Anything else cannot match a row, so it
// gets the same 404 as an id that does not exist.
function readId(value, code, message) {
  if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > MAX_ID) {
    throw new HttpError(404, code, message);
  }
  return Number(value);
}

const userId = (req) => readId(req.params.id, 'USER_NOT_FOUND', 'User not found.');

async function listActions(req, res) {
  const { page, limit } = readPage(req.query);
  const { data, total } = await AdminAction.list(page, limit);
  res.json({ data, page, limit, total });
}

async function listUsers(req, res) {
  const { page, limit } = readPage(req.query);
  const { data, total } = await adminService.listUsers(readSearch(req.query), page, limit);
  res.json({ data, page, limit, total });
}

async function getUser(req, res) {
  const { user, devices } = await adminService.getUserWithDevices(userId(req));
  res.json({ user, devices });
}

async function updateUser(req, res) {
  const body = req.body || {};
  const changes = {};
  if (body.name !== undefined) {
    changes.name = requireString(body.name, 'name', { max: 100 });
  }
  if (body.email !== undefined) {
    changes.email = requireEmail(body.email);
  }
  if (body.role !== undefined) {
    if (!ROLES.includes(body.role)) {
      throw invalid('role must be user or admin.');
    }
    changes.role = body.role;
  }
  if (Object.keys(changes).length === 0) {
    throw invalid('Send name, email or role to update.');
  }
  const user = await adminService.updateUser(userId(req), changes, req.admin);
  res.json(user);
}

async function deleteUser(req, res) {
  await adminService.deleteUser(userId(req), req.admin);
  res.status(204).end();
}

async function signOutUser(req, res) {
  await adminService.signOutUser(userId(req), req.admin);
  res.status(204).end();
}

async function listDevices(req, res) {
  const { page, limit } = readPage(req.query);
  const { data, total } = await adminService.listDevices(readSearch(req.query), page, limit);
  res.json({ data: data.map((device) => device.toAdminJSON()), page, limit, total });
}

async function getDevice(req, res) {
  const device = await adminService.getDevice(req.params.mac);
  res.json(device.toAdminJSON());
}

async function registerDevice(req, res) {
  const body = req.body || {};
  const mac = requireString(body.mac_address, 'mac_address', { max: 17 });
  const name = optionalString(body.name, 'name', 100);
  const location = optionalString(body.location, 'location', 150);
  const { device, pairingCode } = await adminService.registerDevice(mac, name, location, req.admin);
  res.status(201).json({ device: device.toAdminJSON(), pairing_code: pairingCode });
}

function readOwnerId(value) {
  if (value === null || value === '') {
    return null;
  }
  return readId(String(value), 'USER_NOT_FOUND', 'The new owner does not exist.');
}

async function updateDevice(req, res) {
  const body = req.body || {};
  const changes = {};
  if (body.name !== undefined) {
    changes.name = optionalString(body.name, 'name', 100);
  }
  if (body.location !== undefined) {
    changes.location = optionalString(body.location, 'location', 150);
  }
  if (body.owner_id !== undefined) {
    changes.owner_id = readOwnerId(body.owner_id);
  }
  if (Object.keys(changes).length === 0) {
    throw invalid('Send name, location or owner_id to update.');
  }
  const device = await adminService.updateDevice(req.params.mac, changes, req.admin);
  res.json(device.toAdminJSON());
}

async function deleteDevice(req, res) {
  await adminService.deleteDevice(req.params.mac, req.admin);
  res.status(204).end();
}

async function replacePairingCode(req, res) {
  const pairingCode = await adminService.replacePairingCode(req.params.mac, req.admin);
  res.json({ pairing_code: pairingCode });
}

async function listReadings(req, res) {
  const from = optionalDate(req.query.from, 'from');
  const to = optionalDate(req.query.to, 'to');
  if (from && to && from > to) {
    throw invalid('from must be before to.');
  }
  const page = optionalInt(req.query.page, 'page', { max: 1000000, fallback: 1 });
  const limit = optionalInt(req.query.limit, 'limit', { max: 1000, fallback: 100 });
  res.json(await adminService.getReadings(req.params.mac, from, to, page, limit));
}

async function listAlerts(req, res) {
  const { page, limit } = readPage(req.query);
  const status = req.query.status === undefined || req.query.status === '' ? 'all' : req.query.status;
  if (!['all', 'open'].includes(status)) {
    throw invalid('status must be all or open.');
  }
  const deviceId = req.query.device_id ? Device.normalizeMac(req.query.device_id) : undefined;
  const { data, total } = await adminService.listAlerts({ openOnly: status === 'open', deviceId, page, limit });
  res.json({ data: data.map((alert) => alert.toAdminJSON()), page, limit, total });
}

async function closeAlert(req, res) {
  const alertId = readId(req.params.id, 'ALERT_NOT_FOUND', 'Alert not found.');
  const alert = await adminService.closeAlert(alertId, req.admin);
  res.json(alert);
}

module.exports = {
  listActions,
  listUsers,
  getUser,
  updateUser,
  deleteUser,
  signOutUser,
  listDevices,
  getDevice,
  registerDevice,
  updateDevice,
  deleteDevice,
  replacePairingCode,
  listReadings,
  listAlerts,
  closeAlert,
};
