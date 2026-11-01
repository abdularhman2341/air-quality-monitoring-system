const prisma = require('../db/prisma');
const mqttSubscriber = require('../services/MqttSubscriberService');

async function getHealth(req, res) {
  const mqtt = mqttSubscriber.status;

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (err) {
    return res.status(503).json({ status: 'error', database: 'disconnected', mqtt });
  }

  const status = mqtt === 'disconnected' ? 'degraded' : 'ok';
  res.json({ status, database: 'connected', mqtt });
}

module.exports = { getHealth };
