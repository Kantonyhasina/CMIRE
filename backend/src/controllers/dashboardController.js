const dashboardService = require('../services/dashboardService');

async function obtenir(req, res, next) {
  try {
    res.json(await dashboardService.obtenir(req.utilisateur));
  } catch (erreur) {
    next(erreur);
  }
}

module.exports = { obtenir };
