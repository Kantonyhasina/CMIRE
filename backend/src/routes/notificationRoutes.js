const router = require('express').Router();
const c = require('../controllers/notificationsController');
const { verifierToken, exigerRole } = require('../middleware/auth');
const { ROLES } = require('../config/roles');

const utilisateurs = exigerRole(ROLES.CHEF, ROLES.CADRE, ROLES.SURVEILLANT);
const chef = exigerRole(ROLES.CHEF);

router.use(verifierToken);
router.get('/planning', utilisateurs, c.planning);
router.get('/missions', utilisateurs, c.missions);
router.get('/conges', utilisateurs, c.conges);
router.get('/demandes-conges', chef, c.demandesConges);

module.exports = router;
