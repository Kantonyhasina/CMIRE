const router = require('express').Router();
const { lister } = require('../controllers/disponibiliteController');
const { verifierToken, exigerRole } = require('../middleware/auth');

router.get('/', verifierToken, exigerRole('Chef de service'), lister);

module.exports = router;
