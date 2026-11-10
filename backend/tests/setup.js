process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL || 'postgresql://aqms:aqms_dev_password@localhost:5432/aqms_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-not-for-production';
process.env.MAIL_DRIVER = 'memory';

if (!/_test(\?|$)/.test(process.env.DATABASE_URL)) {
  throw new Error('Tests delete all data. TEST_DATABASE_URL must point to a database whose name ends in _test.');
}
