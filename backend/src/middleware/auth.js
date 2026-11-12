const jwt = require('jsonwebtoken');
const Personnel = require('../models/personnel');

// Précondition globale : toute action exige une session authentifiée.
// La fonction, l'unité et le statut actif sont relus en base à chaque requête : un compte désactivé
// perd immédiatement ses accès, sans attendre l'expiration du jeton.
async function verifierToken(req, res, next) {
  const [type, token] = (req.headers.authorization || '').split(' ');
  if (type !== 'Bearer' || !token) {
    return res.status(401).json({ message: 'Authentification requise' });
  }

  let contenu;
  try {
    contenu = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ message: 'Session invalide ou expirée' });
  }

  try {
    const personnel = await Personnel.findByMatricule(contenu.matricule);
    if (!personnel || !personnel.actif) {
      return res.status(401).json({ message: 'Compte désactivé ou introuvable' });
    }
    req.utilisateur = {
      matricule: personnel.matricule,
      fonction: personnel.fonction,
      numeroUnite: personnel.numero_unite,
    };
    next();
  } catch (erreur) {
    next(erreur);
  }
}

function exigerRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.utilisateur.fonction)) {
      return res.status(403).json({ message: 'Accès refusé' });
    }
    next();
  };
}

module.exports = { verifierToken, exigerRole };
