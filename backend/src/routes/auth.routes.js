const { Router } = require('express');
const authController = require('../controllers/authController');
const signupController = require('../controllers/signupController');
const requireAuth = require('../middlewares/requireAuth');

const router = Router();

// The first six work without a token; everything after needs one.
router.post('/register', signupController.register);
router.post('/register/confirm', signupController.confirm);
router.post('/register/resend', signupController.resend);
router.post('/login', authController.login);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.get('/me', requireAuth, authController.me);
router.patch('/me', requireAuth, authController.updateMe);
router.patch('/me/email', requireAuth, authController.changeEmail);
router.post('/me/email/confirm', requireAuth, authController.confirmEmailChange);
router.post('/me/email/resend', requireAuth, authController.resendEmailChange);
router.delete('/me/email/pending', requireAuth, authController.cancelEmailChange);
router.patch('/me/password', requireAuth, authController.changePassword);
router.delete('/me', requireAuth, authController.deleteMe);
router.post('/logout', requireAuth, authController.logout);
router.post('/logout-all', requireAuth, authController.logoutAll);

module.exports = router;