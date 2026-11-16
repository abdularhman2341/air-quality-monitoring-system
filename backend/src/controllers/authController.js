const authService = require('../services/AuthService');
const realtimeGateway = require('../services/RealtimeGateway');
const clientIp = require('../utils/clientIp');
const {
  requireString, requireEmail, requirePassword, requirePasswordInput, requireCode, invalid,
} = require('../utils/validate');

// Controllers read and check the request, call a service and send the answer.
// There is no try/catch: Express 5 passes a rejected promise to errorHandler.
// req.body is undefined when no JSON was sent, hence `req.body || {}`.

async function register(req, res) {
  const body = req.body || {};
  const name = requireString(body.name, 'name', { max: 100 });
  const email = requireEmail(body.email);
  const password = requirePassword(body.password);
  const user = await authService.register(name, email, password);
  res.status(201).json({ user });
}

// The client address feeds the per-address login limit (AuthService.login).
async function login(req, res) {
  const body = req.body || {};
  const email = requireEmail(body.email);
  const password = requirePasswordInput(body.password, 'password');
  const { token, user } = await authService.login(email, password, clientIp(req));
  res.json({ token, user });
}

async function logout(req, res) {
  await authService.logout(req.sessionId);
  realtimeGateway.disconnectSession(req.sessionId);
  res.status(204).end();
}

// Ends every session of the user and answers with a new token, so only this
// tab stays signed in. Open sockets of the old sessions are closed too.
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

// Only the fields that were sent are changed; sending neither is a 400.
async function updateMe(req, res) {
  const body = req.body || {};
  const changes = {};
  if (body.name !== undefined) {
    changes.name = requireString(body.name, 'name', { max: 100 });
  }
  if (body.alert_emails !== undefined) {
    if (typeof body.alert_emails !== 'boolean') {
      throw invalid('alert_emails must be true or false.');
    }
    changes.alert_emails = body.alert_emails;
  }
  if (Object.keys(changes).length === 0) {
    throw invalid('Send name or alert_emails to update.');
  }
  const user = await authService.updateProfile(req.userId, changes);
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

// Same as logoutAll: other devices are signed out, this tab gets a new token.
async function changePassword(req, res) {
  const body = req.body || {};
  const currentPassword = requirePasswordInput(body.current_password, 'current_password');
  const newPassword = requirePassword(body.new_password);
  const token = await authService.changePassword(req.userId, currentPassword, newPassword);
  realtimeGateway.disconnectUser(req.userId);
  res.json({ token });
}

// The same 202 answer whether or not the email has an account.
async function forgotPassword(req, res) {
  const email = requireEmail((req.body || {}).email);
  await authService.requestPasswordReset(email, clientIp(req));
  res.status(202).json({ message: 'If this email has an account, a code was sent to it.' });
}

// Every session ends, so every open socket of the user is closed. No token
// is returned: the user signs in with the new password.
async function resetPassword(req, res) {
  const body = req.body || {};
  const email = requireEmail(body.email);
  const code = requireCode(body.code);
  const newPassword = requirePassword(body.new_password);
  const user = await authService.resetPassword(email, code, newPassword, clientIp(req));
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