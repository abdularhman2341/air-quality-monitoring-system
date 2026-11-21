const readingService = require('../services/ReadingService');
const { optionalDate, optionalInt, invalid } = require('../utils/validate');

async function list(req, res) {
  const from = optionalDate(req.query.from, 'from');
  const to = optionalDate(req.query.to, 'to');
  if (from && to && from > to) {
    throw invalid('from must be before to.');
  }
  const page = optionalInt(req.query.page, 'page', { max: 1000000, fallback: 1 });
  const limit = optionalInt(req.query.limit, 'limit', { max: 1000, fallback: 100 });
  const result = await readingService.getHistoricalReadings(req.userId, req.params.mac, from, to, page, limit);
  res.json(result);
}

async function latest(req, res) {
  const reading = await readingService.getLatestReading(req.userId, req.params.mac);
  res.json(reading);
}

module.exports = { list, latest };