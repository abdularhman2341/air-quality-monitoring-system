const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yaml');
const routes = require('./routes');
const notFound = require('./middlewares/notFound');
const errorHandler = require('./middlewares/errorHandler');

const openapi = YAML.parse(fs.readFileSync(path.join(__dirname, '..', 'docs', 'openapi.yaml'), 'utf8'));

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/v1/docs', swaggerUi.serve, swaggerUi.setup(openapi));
app.use('/api/v1', routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;