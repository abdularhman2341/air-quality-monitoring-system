// Comma-separated list of sites allowed to call the API from a browser.
// Empty in production, where the site and the API share one domain.
const corsOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

module.exports = { corsOrigins };
