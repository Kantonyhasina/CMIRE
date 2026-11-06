const router = require('express').Router();
const c = require('../controllers/congeController');
const { verifierToken, exigerRole } = require('../middleware/auth');
const { ROLES } = require('../config/roles');

const agent = exigerRole(ROLES.CADRE, ROLES.SURVEILLANT);
const chef = exigerRole(ROLES.CHEF);

router.use(verifierToken);

router.get('/mes-demandes', agent, c.mesDemandes);
router.post('/', agent, c.demander);
router.get('/unite', chef, c.lister);
router.get('/unite/nombre', chef, c.nombreEnAttente);
router.get('/calendrier', exigerRole(ROLES.CHEF, ROLES.CADRE, ROLES.SURVEILLANT), c.calendrier);
router.put('/:id/decision', chef, c.decider);
router.delete('/:id', exigerRole(ROLES.CHEF, ROLES.CADRE, ROLES.SURVEILLANT), c.annuler);

module.exports = router;
