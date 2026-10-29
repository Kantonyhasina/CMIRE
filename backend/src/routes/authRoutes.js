const router = require('express').Router();
const { login, moi } = require('../controllers/authController');
const { verifierToken } = require('../middleware/auth');

router.post('/login', login);
router.get('/me', verifierToken, moi);

module.exports = router;
