const Notifications = require('../models/notifications');
const { ROLES } = require('../config/roles');
const { ErreurMetier } = require('../utils/erreurs');

function normaliserDepuis(valeur) {
  if (valeur === undefined || valeur === null || valeur === '') {
    return new Date(0).toISOString();
  }
  const date = new Date(valeur);
  if (Number.isNaN(date.getTime())) {
    throw new ErreurMetier('Date de dernière visite invalide', 400);
  }
  return date.toISOString();
}

async function planning(utilisateur, depuisBrut) {
  if (![ROLES.CHEF, ROLES.CADRE, ROLES.SURVEILLANT].includes(utilisateur.fonction)) {
    throw new ErreurMetier('Accès refusé', 403);
  }
  const nouveau = await Notifications.compterPlanning(
    utilisateur.matricule, utilisateur.fonction, normaliserDepuis(depuisBrut)
  );
  return { nouveau };
}

async function missions(utilisateur, depuisBrut) {
  if (![ROLES.CHEF, ROLES.CADRE, ROLES.SURVEILLANT].includes(utilisateur.fonction)) {
    throw new ErreurMetier('Accès refusé', 403);
  }
  return { nouveau: await Notifications.compterMissions(
    utilisateur.matricule, normaliserDepuis(depuisBrut)
  ) };
}

async function conges(utilisateur, depuisBrut) {
  if (![ROLES.CHEF, ROLES.CADRE, ROLES.SURVEILLANT].includes(utilisateur.fonction)) {
    throw new ErreurMetier('Accès refusé', 403);
  }
  return { nouveau: await Notifications.compterCongesAgent(
    utilisateur.matricule, normaliserDepuis(depuisBrut)
  ) };
}

async function demandesConges(utilisateur, depuisBrut) {
  if (utilisateur.fonction !== ROLES.CHEF) {
    throw new ErreurMetier('Réservé au chef de service', 403);
  }
  return { nouveau: await Notifications.compterDemandesCongesChef(
    utilisateur.numeroUnite, normaliserDepuis(depuisBrut)
  ) };
}

module.exports = { planning, missions, conges, demandesConges };
