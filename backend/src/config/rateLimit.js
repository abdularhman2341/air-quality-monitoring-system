// TRUST_PROXY is how many proxies stand between the internet and this server
// (1 on Railway). Without it Express sees the proxy's address for every
// visitor, and a limit per address would lock everyone out together, so the
// limits per address stay off until it is set.
const raw = process.env.TRUST_PROXY;
const trustProxy = raw === undefined || raw === '' ? null : Number(raw);

if (trustProxy !== null && (!Number.isInteger(trustProxy) || trustProxy < 0)) {
  throw new Error('TRUST_PROXY must be a whole number of proxies (0 when there is none).');
}

module.exports = {
  trustProxy,
  windowMinutes: 15,
  loginPerEmail: 5,
  loginPerAddress: 20,
  resetRequestsPerEmail: 3,
  resetRequestsPerAddress: 10,
  resetTriesPerAddress: 20,
};
