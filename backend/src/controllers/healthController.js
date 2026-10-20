const pool = require('../config/db');

async function getHealth(req, res) {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (err) {
    res.status(503).json({ status: 'error', database: 'disconnected' });
  }
}

module.exports = { getHealth };
