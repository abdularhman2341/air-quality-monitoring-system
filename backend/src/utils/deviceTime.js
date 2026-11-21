// The time of a reading or alarm, from the device clock when it can be
// trusted, otherwise the server time.
// A late message keeps its real time: messages wait at the broker while the
// backend is down (clean: false), and an alarm the device sees offline is
// sent later with the time it happened. Keeping that time also lets a late
// message delivered twice (QoS 1) be saved once (readings are unique per
// device and time).
// The device time is not trusted when it is more than a minute ahead or more
// than 24 hours old. A clock NTP never set (1970) is caught by the second rule.
const MAX_AHEAD_MS = 60 * 1000;
const MAX_DELAY_MS = 24 * 60 * 60 * 1000;

function deviceTime(ts) {
  const time = new Date(ts);
  const now = new Date();
  const trusted = time - now <= MAX_AHEAD_MS && now - time <= MAX_DELAY_MS;
  return trusted ? time : now;
}

module.exports = { deviceTime };
