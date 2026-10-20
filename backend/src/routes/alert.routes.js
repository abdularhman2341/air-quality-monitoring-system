const { Router } = require('express');
const alertController = require('../controllers/alertController');
const requireAuth = require('../middlewares/requireAuth');

const router = Router();

router.get('/', requireAuth, alertController.list);

module.exports = router;
