const router = require('express').Router();
const { listerComptes, creerCompte, modifierCompte, supprimerCompte } = require('../controllers/adminController');
const { verifierToken, exigerRole } = require('../middleware/auth');

router.use(verifierToken, exigerRole('Administrateur'));

router.get('/', listerComptes);
router.post('/', creerCompte);
router.put('/:matricule', modifierCompte);
router.delete('/:matricule', supprimerCompte);

module.exports = router;
