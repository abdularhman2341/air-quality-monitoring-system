const authService = require('../services/AuthService');
const realtimeGateway = require('../services/RealtimeGateway');
const {
  requireString, requireEmail, requirePassword, requirePasswordInput, requireCode,
} = require('../utils/validate');

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

async function verifyEmail(req, res) {
  const code = requireCode((req.body || {}).code);
  const user = await authService.verifyEmail(req.userId, code);
  res.json(user);
}

async function resendVerification(req, res) {
  await authService.resendVerification(req.userId);
  res.status(204).end();
}

async function confirmEmailChange(req, res) {
  const code = requireCode((req.body || {}).code);
  const user = await authService.confirmEmailChange(req.userId, code);
  res.json(user);
}

async function resendEmailChange(req, res) {
  await authService.resendEmailChange(req.userId);
  res.status(204).end();
}

async function cancelEmailChange(req, res) {
  const user = await authService.cancelEmailChange(req.userId);
  res.json(user);
}

async function changePassword(req, res) {
  const body = req.body || {};
  const currentPassword = requirePasswordInput(body.current_password, 'current_password');
  const newPassword = requirePassword(body.new_password);
  const token = await authService.changePassword(req.userId, currentPassword, newPassword);
  realtimeGateway.disconnectUser(req.userId);
  res.json({ token });
}

async function forgotPassword(req, res) {
  const email = requireEmail((req.body || {}).email);
  await authService.requestPasswordReset(email);
  res.status(202).json({ message: 'If this email has an account, a code was sent to it.' });
}

async function resetPassword(req, res) {
  const body = req.body || {};
  const email = requireEmail(body.email);
  const code = requireCode(body.code);
  const newPassword = requirePassword(body.new_password);
  const user = await authService.resetPassword(email, code, newPassword);
  realtimeGateway.disconnectUser(String(user.id));
  res.status(204).end();
}

async function deleteMe(req, res) {
  const body = req.body || {};
  const currentPassword = requirePasswordInput(body.current_password, 'current_password');
  await authService.deleteAccount(req.userId, currentPassword);
  realtimeGateway.disconnectUser(req.userId);
  res.status(204).end();
}

module.exports = {
  register, login, logout, logoutAll, me, updateMe, changeEmail, changePassword, forgotPassword, resetPassword, deleteMe,
  verifyEmail, resendVerification, confirmEmailChange, resendEmailChange, cancelEmailChange,
};