const router = require('express').Router();
const c = require('../controllers/missionController');
const { verifierToken, exigerRole } = require('../middleware/auth');
const { ROLES } = require('../config/roles');

const chef = exigerRole(ROLES.CHEF);

router.use(verifierToken);

router.get('/', exigerRole(ROLES.CHEF, ROLES.CADRE, ROLES.SURVEILLANT), c.lister);
router.post('/', chef, c.creer);
router.put('/:id', chef, c.modifier);
router.delete('/:id', chef, c.supprimer);
router.get('/:id/candidats', chef, c.candidats);
router.put('/:id/intervenants', chef, c.affecter);

module.exports = router;
