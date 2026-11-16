// A device time more than 10 minutes away from the server time is not
// trusted (for example before NTP sets the clock); the server time is used.
const MAX_CLOCK_SKEW_MS = 10 * 60 * 1000;

function deviceTime(ts) {
  const time = new Date(ts);
  const now = new Date();
  return Math.abs(now - time) > MAX_CLOCK_SKEW_MS ? now : time;
}

module.exports = { deviceTime };