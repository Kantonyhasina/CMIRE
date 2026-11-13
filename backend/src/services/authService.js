const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Personnel = require('../models/personnel');
const { ErreurMetier } = require('../utils/erreurs');

async function authentifier(identifiant, motDePasse) {
  const personnel = await Personnel.findByIdentifiant(identifiant);

  // Même message que l'identifiant soit inconnu ou le mot de passe faux
  const valide = personnel && personnel.actif && (await bcrypt.compare(motDePasse, personnel.mot_de_passe));
  if (!valide) {
    throw new ErreurMetier('Identifiant ou mot de passe incorrect', 401);
  }

  const utilisateur = {
    matricule: personnel.matricule,
    nom: personnel.nom,
    prenom: personnel.prenom,
    fonction: personnel.fonction,
    numeroUnite: personnel.numero_unite,
    nomUnite: personnel.nomUnite,
  };

  const token = jwt.sign(
    { matricule: utilisateur.matricule, fonction: utilisateur.fonction, numeroUnite: utilisateur.numeroUnite },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRATION || '8h' }
  );

  return { token, utilisateur };
}

module.exports = { authentifier };
