const express = require('express');
const { creerControleur } = require('../controllers/referentielController');
const { verifierToken, exigerRole } = require('../middleware/auth');

// Lecture : tout utilisateur connecté (listes déroulantes). Écriture : Administrateur.
module.exports = (modele, libelleEntite) => {
  const controleur = creerControleur(modele, libelleEntite);
  const router = express.Router();

  router.use(verifierToken);
  router.get('/', controleur.lister);
  router.post('/', exigerRole('Administrateur'), controleur.creer);
  router.put('/:id', exigerRole('Administrateur'), controleur.modifier);
  router.delete('/:id', exigerRole('Administrateur'), controleur.supprimer);

  return router;
};
