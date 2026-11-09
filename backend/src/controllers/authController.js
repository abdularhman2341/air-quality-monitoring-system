const authService = require('../services/AuthService');
const realtimeGateway = require('../services/RealtimeGateway');
const { requireString, requireEmail, requirePassword, requirePasswordInput } = require('../utils/validate');

async function register(req, res) {
  const body = req.body || {};
  const name = requireString(body.name, 'name', { max: 100 });
  const email = requireEmail(body.email);
  const password = requirePassword(body.password);
  const user = await authService.register(name, email, password);
  res.status(201).json({ user });
}

async function login(req, res) {
  const body = req.body || {};
  const email = requireEmail(body.email);
  const password = requirePasswordInput(body.password, 'password');
  const { token, user } = await authService.login(email, password);
  res.json({ token, user });
}

async function logout(req, res) {
  await authService.logout(req.sessionId);
  realtimeGateway.disconnectSession(req.sessionId);
  res.status(204).end();
}

async function logoutAll(req, res) {
  const body = req.body || {};
  const currentPassword = requirePasswordInput(body.current_password, 'current_password');
  const token = await authService.logoutAll(req.userId, currentPassword);
  realtimeGateway.disconnectUser(req.userId);
  res.json({ token });
}

async function me(req, res) {
  const user = await authService.getUser(req.userId);
  res.json(user);
}

async function updateMe(req, res) {
  const body = req.body || {};
  const name = requireString(body.name, 'name', { max: 100 });
  const user = await authService.updateProfile(req.userId, { name });
  res.json(user);
}

async function changeEmail(req, res) {
  const body = req.body || {};
  const email = requireEmail(body.email);
  const currentPassword = requirePasswordInput(body.current_password, 'current_password');
  const user = await authService.changeEmail(req.userId, email, currentPassword);
  res.json(user);
}

async function deleteMe(req, res) {
  const body = req.body || {};
  const currentPassword = requirePasswordInput(body.current_password, 'current_password');
  await authService.deleteAccount(req.userId, currentPassword);
  realtimeGateway.disconnectUser(req.userId);
  res.status(204).end();
}

module.exports = { register, login, logout, logoutAll, me, updateMe, changeEmail, deleteMe };