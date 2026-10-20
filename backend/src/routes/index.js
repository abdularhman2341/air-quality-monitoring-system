const { Router } = require('express');
const healthRoutes = require('./health.routes');
const authRoutes = require('./auth.routes');
const deviceRoutes = require('./device.routes');
const alertRoutes = require('./alert.routes');

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/devices', deviceRoutes);
router.use('/alerts', alertRoutes);

module.exports = router;
