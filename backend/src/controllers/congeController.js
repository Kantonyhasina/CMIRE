// Control : CongeController
const congeService = require('../services/congeService');
const { exigerDate } = require('../utils/dates');
const { ErreurMetier } = require('../utils/erreurs');

function lireId(valeur) {
  const id = Number(valeur);
  if (!Number.isInteger(id) || id <= 0) throw new ErreurMetier('Identifiant invalide', 400);
  return id;
}

const action = (travail) => async (req, res, next) => {
  try {
    await travail(req, res);
  } catch (erreur) {
    next(erreur);
  }
};

const mesDemandes = action(async (req, res) => {
  res.json(await congeService.mesDemandes(req.utilisateur));
});

const demander = action(async (req, res) => {
  const { dateDebut, dateFin, type } = req.body;
  res.status(201).json(await congeService.demander(
    { dateDebut: exigerDate(dateDebut), dateFin: exigerDate(dateFin), type }, req.utilisateur));
});

const annuler = action(async (req, res) => {
  await congeService.annuler(lireId(req.params.id), req.utilisateur);
  res.status(204).end();
});

const lister = action(async (req, res) => {
  res.json(await congeService.lister(req.query.statut ?? 'En attente', req.utilisateur));
});

const nombreEnAttente = action(async (req, res) => {
  res.json(await congeService.nombreEnAttente(req.utilisateur));
});

const decider = action(async (req, res) => {
  res.json(await congeService.decider(
    lireId(req.params.id), { decision: req.body.decision, confirmer: req.body.confirmer }, req.utilisateur));
});

const calendrier = action(async (req, res) => {
  res.json(await congeService.calendrier(
    { dateDebut: exigerDate(req.query.dateDebut), dateFin: exigerDate(req.query.dateFin) }, req.utilisateur));
});

module.exports = { mesDemandes, demander, annuler, lister, nombreEnAttente, decider, calendrier };
