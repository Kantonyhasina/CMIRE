const router = require('express').Router();
const c = require('../controllers/permanenceController');
const { verifierToken, exigerRole } = require('../middleware/auth');
const { ROLES } = require('../config/roles');

router.use(verifierToken);

// Lecture : chef, cadre et surveillant
const lecteurs = exigerRole(
  ROLES.CHEF,
  ROLES.CADRE,
  ROLES.SURVEILLANT
);

// Modification : chef de service uniquement
const planificateurs = exigerRole(ROLES.CHEF);

// Consultation
router.get('/cadres', lecteurs, c.consulterCadres);
router.get('/surveillants', lecteurs, c.consulterSurveillants);

// Modification réservée au chef
router.put('/cadres', planificateurs, c.enregistrerCadres);
router.put('/surveillants', planificateurs, c.enregistrerSurveillants);

// Export Excel accessible aux lecteurs
router.get('/export', lecteurs, c.exporter);

// Planning personnel
router.get(
  '/mon-planning',
  exigerRole(ROLES.CHEF, ROLES.CADRE, ROLES.SURVEILLANT),
  c.monPlanning
);

module.exports = router;