// CLIENT_IP_HEADER is read once when the module loads, so each case loads it fresh.
function loadWith(value, path = '../src/config/rateLimit') {
  const saved = process.env.CLIENT_IP_HEADER;
  if (value === undefined) delete process.env.CLIENT_IP_HEADER;
  else process.env.CLIENT_IP_HEADER = value;
  try {
    let mod;
    jest.isolateModules(() => { mod = require(path); });
    return mod;
  } finally {
    process.env.CLIENT_IP_HEADER = saved;
  }
}

describe('CLIENT_IP_HEADER', () => {
  test('missing or empty turns the limits per address off', () => {
    expect(loadWith(undefined).clientIpHeader).toBeNull();
    expect(loadWith('  ').clientIpHeader).toBeNull();
  });

  test('is read in any letter case', () => {
    expect(loadWith(' X-Real-IP ').clientIpHeader).toBe('x-real-ip');
  });

  test('a value that is not a header name stops the server at start', () => {
    expect(() => loadWith('x real ip')).toThrow('CLIENT_IP_HEADER must be a header name');
  });
});

describe('clientIp', () => {
  const req = (headers) => ({ get: (name) => headers[name.toLowerCase()] });

  test('gives null without CLIENT_IP_HEADER, so sign-in still works', () => {
    const clientIp = loadWith(undefined, '../src/utils/clientIp');
    expect(clientIp(req({ 'x-real-ip': '198.51.100.1' }))).toBeNull();
  });

  test('reads IPv4 and IPv6 addresses from the header', () => {
    const clientIp = loadWith('x-real-ip', '../src/utils/clientIp');
    expect(clientIp(req({ 'x-real-ip': ' 198.51.100.1 ' }))).toBe('198.51.100.1');
    expect(clientIp(req({ 'x-real-ip': '2001:db8::1' }))).toBe('2001:db8::1');
    expect(clientIp(req({}))).toBeNull();
  });
});
