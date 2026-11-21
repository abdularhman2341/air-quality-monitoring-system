// CLIENT_IP_HEADER names the header the hosting edge writes with the visitor's
// address on every request (x-real-ip on Railway). Railway does not promise a
// fixed number of proxies, so counting them (Express "trust proxy") gave a CDN
// address that changes on each request. Without it the limits per address stay
// off and the limits per email still work.
const raw = (process.env.CLIENT_IP_HEADER || '').trim().toLowerCase();
const clientIpHeader = raw === '' ? null : raw;

if (clientIpHeader !== null && !/^[a-z0-9-]+$/.test(clientIpHeader)) {
  throw new Error('CLIENT_IP_HEADER must be a header name, for example x-real-ip.');
}

module.exports = {
  clientIpHeader,
  windowMinutes: 15,
  loginPerEmail: 5,
  loginPerAddress: 20,
  resetRequestsPerEmail: 3,
  resetRequestsPerAddress: 10,
  resetTriesPerAddress: 20,
  signupsPerAddress: 10,
  signupTriesPerAddress: 20,
  signupResendsPerAddress: 10,
};
