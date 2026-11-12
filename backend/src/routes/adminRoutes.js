const router = require('express').Router();
const {
  listerComptes,
  creerCompte,
  modifierCompte,
  changerActivationCompte,
} = require('../controllers/adminController');
const { verifierToken, exigerRole } = require('../middleware/auth');

router.use(verifierToken, exigerRole('Administrateur'));

router.get('/', listerComptes);
router.post('/', creerCompte);
router.put('/:matricule', modifierCompte);
router.patch('/:matricule/activation', changerActivationCompte);

module.exports = router;
