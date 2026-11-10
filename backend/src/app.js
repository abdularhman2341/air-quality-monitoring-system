const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yaml');
const routes = require('./routes');
const notFound = require('./middlewares/notFound');
const errorHandler = require('./middlewares/errorHandler');
const { corsOrigins } = require('./config/cors');
const { trustProxy } = require('./config/rateLimit');

const openapi = YAML.parse(fs.readFileSync(path.join(__dirname, '..', 'docs', 'openapi.yaml'), 'utf8'));

const frontendDist = process.env.FRONTEND_DIST;

const app = express();

// Makes req.ip the visitor's address instead of the proxy's (see config/rateLimit.js).
if (trustProxy !== null) {
  app.set('trust proxy', trustProxy);
}

if (corsOrigins.length > 0) {
  app.use(cors({ origin: corsOrigins }));
}
app.use(express.json());

app.use('/api/v1/docs', swaggerUi.serve, swaggerUi.setup(openapi));
app.use('/api/v1', routes);
app.use('/api', notFound);

if (frontendDist) {
  app.use(express.static(frontendDist));
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

app.use(notFound);
app.use(errorHandler);

module.exports = app;