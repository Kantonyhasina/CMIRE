// Control : PermanenceController
const permanenceService = require('../services/permanenceService');
const exportExcelService = require('../services/exportExcelService');
const { exigerDate } = require('../utils/dates');
const { ErreurMetier } = require('../utils/erreurs');

function lireUnite(valeur) {
  const numeroUnite = Number(valeur);
  if (!Number.isInteger(numeroUnite) || numeroUnite <= 0) throw new ErreurMetier('Unité invalide', 400);
  return numeroUnite;
}

const action = (travail) => async (req, res, next) => {
  try {
    await travail(req, res);
  } catch (erreur) {
    next(erreur);
  }
};

const consulterCadres = action(async (req, res) => {
  res.json(await permanenceService.consulterCadres(
    { date: exigerDate(req.query.date), numeroUnite: lireUnite(req.query.numeroUnite) }, req.utilisateur));
});

const enregistrerCadres = action(async (req, res) => {
  res.json(await permanenceService.enregistrerCadres({
    date: exigerDate(req.body.date),
    numeroUnite: lireUnite(req.body.numeroUnite),
    affectations: req.body.affectations,
  }, req.utilisateur));
});

const consulterSurveillants = action(async (req, res) => {
  res.json(await permanenceService.consulterSurveillants({ date: exigerDate(req.query.date) }));
});

const enregistrerSurveillants = action(async (req, res) => {
  res.json(await permanenceService.enregistrerSurveillants({
    date: exigerDate(req.body.date),
    affectations: req.body.affectations,
  }));
});

const monPlanning = action(async (req, res) => {
  res.json(await permanenceService.monPlanning({ date: exigerDate(req.query.date) }, req.utilisateur));
});

const exporter = action(async (req, res) => {
  const { buffer, nomFichier } = await exportExcelService.genererTableau(exigerDate(req.query.date));
  res.set({
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="${nomFichier}"`,
    'Content-Length': buffer.length,
  });
  res.send(buffer);
});

module.exports = {
  consulterCadres, enregistrerCadres, consulterSurveillants, enregistrerSurveillants, monPlanning, exporter,
};
