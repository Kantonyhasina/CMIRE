// Control : AuthController
const authService = require('../services/authService');

async function login(req, res, next) {
  try {
    const { identifiant, motDePasse } = req.body;
    if (!identifiant || !motDePasse) {
      return res.status(400).json({ message: 'Identifiant et mot de passe requis' });
    }
    res.json(await authService.authentifier(identifiant, motDePasse));
  } catch (erreur) {
    next(erreur);
  }
}

function moi(req, res) {
  res.json(req.utilisateur);
}

module.exports = { login, moi };
