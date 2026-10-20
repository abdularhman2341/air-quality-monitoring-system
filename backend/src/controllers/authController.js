const authService = require('../services/AuthService');
const { requireString, requireEmail, requirePassword } = require('../utils/validate');

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
  const password = requireString(body.password, 'password', { max: 72 });
  const { token, user } = await authService.login(email, password);
  res.json({ token, user });
}

async function logout(req, res) {
  await authService.logout(req.sessionId);
  res.status(204).end();
}

async function me(req, res) {
  const user = await authService.getUser(req.userId);
  res.json(user);
}

module.exports = { register, login, logout, me };