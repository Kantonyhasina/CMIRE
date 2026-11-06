const router = require('express').Router();
const c = require('../controllers/permanenceController');
const { verifierToken, exigerRole } = require('../middleware/auth');
const { ROLES } = require('../config/roles');

// Seuls les chefs de service planifient les permanences.
// Ils peuvent consulter toutes les unités, mais le service bloque côté serveur
// toute tentative de modification d'une unité autre que la leur.
const planificateurs = exigerRole(ROLES.CHEF);

router.use(verifierToken);

router.get('/cadres', planificateurs, c.consulterCadres);
router.put('/cadres', planificateurs, c.enregistrerCadres);
router.get('/surveillants', planificateurs, c.consulterSurveillants);
router.put('/surveillants', planificateurs, c.enregistrerSurveillants);
router.get('/export', planificateurs, c.exporter);
router.get('/mon-planning', exigerRole(ROLES.CHEF, ROLES.CADRE, ROLES.SURVEILLANT), c.monPlanning);

module.exports = router;
