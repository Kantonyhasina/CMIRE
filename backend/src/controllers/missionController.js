// Control : MissionController
const missionService = require('../services/missionService');
const missionExportExcelService = require('../services/missionExportExcelService');
const { exigerDate } = require('../utils/dates');
const { ErreurMetier } = require('../utils/erreurs');

function lireId(valeur) {
  const id = Number(valeur);
  if (!Number.isInteger(id) || id <= 0) throw new ErreurMetier('Identifiant invalide', 400);
  return id;
}

const lireCorps = (corps) => ({
  numeroStation: Number(corps.numeroStation),
  dateDebut: exigerDate(corps.dateDebut),
  dateFin: exigerDate(corps.dateFin),
});

const action = (travail) => async (req, res, next) => {
  try {
    await travail(req, res);
  } catch (erreur) {
    next(erreur);
  }
};

const lister = action(async (req, res) => {
  res.json(await missionService.lister({ annee: Number(req.query.annee), trimestre: Number(req.query.trimestre) }));
});

const exporterAnnuel = action(async (req, res) => {
  const annee = Number(req.query.annee);
  if (!Number.isInteger(annee) || annee < 2000 || annee > 2100) {
    throw new ErreurMetier('Année invalide', 400);
  }
  const { buffer, nomFichier } = await missionExportExcelService.generer(annee);
  res.set({
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="${nomFichier}"`,
    'Content-Length': buffer.length,
  });
  res.send(buffer);
});

const creer = action(async (req, res) => {
  res.status(201).json(await missionService.creer(lireCorps(req.body)));
});

const modifier = action(async (req, res) => {
  res.json(await missionService.modifier(lireId(req.params.id), lireCorps(req.body), req.utilisateur));
});

const supprimer = action(async (req, res) => {
  await missionService.supprimer(lireId(req.params.id), req.utilisateur);
  res.status(204).end();
});

const candidats = action(async (req, res) => {
  res.json(await missionService.candidats(lireId(req.params.id), req.utilisateur));
});

const affecter = action(async (req, res) => {
  res.json(await missionService.affecter(lireId(req.params.id), { matricules: req.body.matricules }, req.utilisateur));
});

module.exports = { lister, exporterAnnuel, creer, modifier, supprimer, candidats, affecter };
