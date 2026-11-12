const notificationsService = require('../services/notificationsService');

const action = (travail) => async (req, res, next) => {
  try {
    res.json(await travail(req, res));
  } catch (erreur) {
    next(erreur);
  }
};

const planning = action((req) => notificationsService.planning(req.utilisateur, req.query.depuis));
const missions = action((req) => notificationsService.missions(req.utilisateur, req.query.depuis));
const conges = action((req) => notificationsService.conges(req.utilisateur, req.query.depuis));
const demandesConges = action((req) => notificationsService.demandesConges(req.utilisateur, req.query.depuis));

module.exports = { planning, missions, conges, demandesConges };
