const { deviceTime } = require('../src/utils/deviceTime');

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const ago = (ms) => new Date(Date.now() - ms).toISOString();
const ahead = (ms) => new Date(Date.now() + ms).toISOString();

// The result is the server time when it is within a second of now.
const isServerTime = (date) => Math.abs(date.getTime() - Date.now()) < 1000;

describe('deviceTime keeps the device time when it can be trusted', () => {
  test('a reading sent now keeps its time', () => {
    const ts = ago(2000);
    expect(deviceTime(ts).toISOString()).toBe(ts);
  });

  test('a reading that waited 30 minutes at the broker keeps its real time', () => {
    const ts = ago(30 * MINUTE);
    expect(deviceTime(ts).toISOString()).toBe(ts);
  });

  test('a reading that waited almost 24 hours keeps its real time', () => {
    const ts = ago(24 * HOUR - MINUTE);
    expect(deviceTime(ts).toISOString()).toBe(ts);
  });

  test('a device clock up to a minute ahead is kept', () => {
    const ts = ahead(50 * 1000);
    expect(deviceTime(ts).toISOString()).toBe(ts);
  });
});

describe('deviceTime uses the server time when the device time cannot be trusted', () => {
  test('a clock that NTP has not set yet (1970), or any time before 2024', () => {
    expect(isServerTime(deviceTime('1970-01-01T00:00:10Z'))).toBe(true);
    expect(isServerTime(deviceTime('2023-12-31T23:59:59Z'))).toBe(true);
  });

  test('a time more than a minute in the future', () => {
    expect(isServerTime(deviceTime(ahead(70 * 1000)))).toBe(true);
    expect(isServerTime(deviceTime(ahead(HOUR)))).toBe(true);
  });

  test('a time more than 24 hours old', () => {
    expect(isServerTime(deviceTime(ago(24 * HOUR + MINUTE)))).toBe(true);
  });
});
