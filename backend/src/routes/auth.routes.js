const { Router } = require('express');
const authController = require('../controllers/authController');
const requireAuth = require('../middlewares/requireAuth');

const router = Router();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/me', requireAuth, authController.me);

module.exports = router;
