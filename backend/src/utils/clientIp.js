const net = require('net');
const { clientIpHeader } = require('../config/rateLimit');

// The visitor's address for the limits per address, or null when it is not
// known (no CLIENT_IP_HEADER, or the header is missing or not an address).
function clientIp(req) {
  if (clientIpHeader === null) {
    return null;
  }
  const value = (req.get(clientIpHeader) || '').trim();
  return net.isIP(value) ? value : null;
}

module.exports = clientIp;
