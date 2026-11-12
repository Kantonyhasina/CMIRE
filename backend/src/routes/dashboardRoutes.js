const router = require('express').Router();
const { obtenir } = require('../controllers/dashboardController');
const { verifierToken } = require('../middleware/auth');

router.get('/', verifierToken, obtenir);

module.exports = router;
