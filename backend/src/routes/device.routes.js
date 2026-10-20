const { Router } = require('express');
const deviceController = require('../controllers/deviceController');
const readingController = require('../controllers/readingController');
const alertController = require('../controllers/alertController');
const requireAuth = require('../middlewares/requireAuth');

const router = Router();

router.use(requireAuth);

router.get('/', deviceController.list);
router.post('/', deviceController.link);
router.get('/:mac', deviceController.get);
router.patch('/:mac', deviceController.update);
router.delete('/:mac', deviceController.unlink);

router.get('/:mac/readings', readingController.list);
router.get('/:mac/readings/latest', readingController.latest);

router.get('/:mac/alerts', alertController.listForDevice);

module.exports = router;
