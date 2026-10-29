// Control : liste du personnel d'une unité avec sa disponibilité sur une période
const Personnel = require('../models/personnel');
const disponibiliteService = require('../services/disponibiliteService');
const { ErreurMetier } = require('../utils/erreurs');

async function lister(req, res, next) {
  try {
    const { numeroUnite, dateDebut, dateFin, ignorer } = req.query;

    const unite = Number(numeroUnite);
    if (!Number.isInteger(unite) || unite <= 0) throw new ErreurMetier('Unité invalide', 400);

    // RG8 : un chef de service ne consulte que les personnels de sa propre unité
    if (req.utilisateur.fonction === 'Chef de service' && unite !== req.utilisateur.numeroUnite) {
      throw new ErreurMetier('Vous ne pouvez consulter que les personnels de votre unité', 403);
    }

    const personnels = await Personnel.findByUnite(unite);
    const resultats = await disponibiliteService.verifierDisponibilite(
      personnels.map((p) => p.matricule),
      dateDebut,
      dateFin,
      { ignorer: ignorer ? String(ignorer).split(',') : [] }
    );

    res.json(personnels.map((p, i) => ({ ...p, ...resultats[i] })));
  } catch (erreur) {
    next(erreur);
  }
}

module.exports = { lister };
