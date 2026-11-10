const { Router } = require('express');
const authController = require('../controllers/authController');
const requireAuth = require('../middlewares/requireAuth');

const router = Router();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.get('/me', requireAuth, authController.me);
router.patch('/me', requireAuth, authController.updateMe);
router.patch('/me/email', requireAuth, authController.changeEmail);
router.patch('/me/password', requireAuth, authController.changePassword);
router.delete('/me', requireAuth, authController.deleteMe);
router.post('/logout', requireAuth, authController.logout);
router.post('/logout-all', requireAuth, authController.logoutAll);

module.exports = router;