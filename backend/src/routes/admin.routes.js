const { Router } = require('express');
const adminController = require('../controllers/adminController');
const requireAuth = require('../middlewares/requireAuth');
const requireAdmin = require('../middlewares/requireAdmin');

const router = Router();

router.use(requireAuth, requireAdmin);

router.get('/actions', adminController.listActions);

router.get('/users', adminController.listUsers);
router.get('/users/:id', adminController.getUser);
router.patch('/users/:id', adminController.updateUser);
router.delete('/users/:id', adminController.deleteUser);
router.post('/users/:id/logout-all', adminController.signOutUser);

router.get('/devices', adminController.listDevices);
router.post('/devices', adminController.registerDevice);
router.get('/devices/:mac', adminController.getDevice);
router.patch('/devices/:mac', adminController.updateDevice);
router.delete('/devices/:mac', adminController.deleteDevice);
router.post('/devices/:mac/pairing-code', adminController.replacePairingCode);
router.get('/devices/:mac/readings', adminController.listReadings);

router.get('/alerts', adminController.listAlerts);
router.post('/alerts/:id/close', adminController.closeAlert);

module.exports = router;
