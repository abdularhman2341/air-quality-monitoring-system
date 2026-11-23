const prisma = require('../db/prisma');
const mqttSubscriber = require('../services/MqttSubscriberService');

// 503 when the database does not answer: the API cannot work. A broken
// broker is 'degraded' with 200: the API still works, but new readings stop
// arriving (openapi.yaml).
async function getHealth(req, res) {
  const mqtt = mqttSubscriber.status;

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    return res.status(503).json({ status: 'error', database: 'disconnected', mqtt });
  }

  const status = mqtt === 'disconnected' ? 'degraded' : 'ok';
  res.json({ status, database: 'connected', mqtt });
}

module.exports = { getHealth };
