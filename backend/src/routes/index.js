const { Router } = require('express');
const healthRoutes = require('./health.routes');
const authRoutes = require('./auth.routes');
const deviceRoutes = require('./device.routes');
const alertRoutes = require('./alert.routes');
const adminRoutes = require('./admin.routes');

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/devices', deviceRoutes);
router.use('/alerts', alertRoutes);
router.use('/admin', adminRoutes);

module.exports = router;
