const signupService = require('../services/SignupService');
const clientIp = require('../utils/clientIp');
const {
  requireString, requireEmail, requirePassword, requireCode,
} = require('../utils/validate');

// 202, not 201: the account is saved but works only after the code.
async function register(req, res) {
  const body = req.body || {};
  const name = requireString(body.name, 'name', { max: 100 });
  const email = requireEmail(body.email);
  const password = requirePassword(body.password);
  const user = await signupService.start(name, email, password, clientIp(req));
  res.status(202).json({ email: user.email });
}

async function confirm(req, res) {
  const body = req.body || {};
  const email = requireEmail(body.email);
  const code = requireCode(body.code);
  const { token, user } = await signupService.confirm(email, code, clientIp(req));
  res.json({ token, user });
}

async function resend(req, res) {
  const email = requireEmail((req.body || {}).email);
  await signupService.resend(email, clientIp(req));
  res.status(204).end();
}

module.exports = { register, confirm, resend };
