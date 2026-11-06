// Control : MissionService
// Cas « Planifier une mission trimestrielle », « Affecter des intervenants à une mission »
// et « Consulter le planning des missions ».
// Chaque chef de service affecte les agents de SA unité (RG8). Une mission peut avoir des
// intervenants de plusieurs unités ; elle ne peut être modifiée ou supprimée que si aucun
// intervenant d'une autre unité n'y participe.
const Mission = require('../models/mission');
const Station = require('../models/station');
const Personnel = require('../models/personnel');
const disponibiliteService = require('./disponibiliteService');
const db = require('../config/db');
const { validerPeriode, trimestreDe } = require('../utils/dates');
const { ErreurMetier } = require('../utils/erreurs');

const { decrireConflit } = disponibiliteService;

async function detaillerMissions(missions) {
  const intervenants = missions.length > 0
    ? await Mission.intervenantsDe(missions.map((m) => m.numeroMission))
    : [];
  return missions.map((m) => ({
    ...m,
    intervenants: intervenants
      .filter((i) => i.numeroMission === m.numeroMission)
      .map(({ numeroMission, ...agent }) => agent),
  }));
}

async function exigerMission(numeroMission) {
  const mission = await Mission.findById(numeroMission);
  if (!mission) throw new ErreurMetier('Mission introuvable', 404);
  return mission;
}

async function exigerStation(numeroStation) {
  if (!Number.isInteger(numeroStation) || !(await Station.existe(numeroStation))) {
    throw new ErreurMetier('Station inexistante', 400);
  }
}

async function exigerAucunAutreUnite(numeroMission, utilisateur) {
  if ((await Mission.compterAutresUnites(numeroMission, utilisateur.numeroUnite)) > 0) {
    throw new ErreurMetier(
      "Des intervenants d'autres unités participent à cette mission : elle ne peut plus être modifiée "
      + 'ni supprimée (chaque chef de service gère les intervenants de son unité)', 409);
  }
}

// ---------- Consultation ----------

async function lister({ annee, trimestre }) {
  if (!Number.isInteger(annee) || annee < 2000 || annee > 2100) throw new ErreurMetier('Année invalide', 400);
  if (![1, 2, 3, 4].includes(trimestre)) throw new ErreurMetier('Trimestre invalide (1 à 4)', 400);
  return detaillerMissions(await Mission.findByTrimestre(annee, trimestre));
}

// ---------- Planification ----------

async function creer({ numeroStation, dateDebut, dateFin }) {
  validerPeriode(dateDebut, dateFin);
  await exigerStation(numeroStation);
  // Le trimestre est celui de la date de début : on ne peut donc pas le saisir de travers
  const mission = await Mission.creer({ numeroStation, dateDebut, dateFin, ...trimestreDe(dateDebut) });
  return (await detaillerMissions([mission]))[0];
}

async function modifier(numeroMission, { numeroStation, dateDebut, dateFin }, utilisateur) {
  await exigerMission(numeroMission);
  await exigerAucunAutreUnite(numeroMission, utilisateur);
  validerPeriode(dateDebut, dateFin);
  await exigerStation(numeroStation);

  // La nouvelle période doit convenir à tous les intervenants déjà affectés
  const actuels = await Mission.intervenantsDe([numeroMission]);
  const resultats = await disponibiliteService.verifierDisponibilite(
    actuels.map((i) => i.matricule), dateDebut, dateFin, { exclureMission: numeroMission });
  const lignes = resultats.flatMap((r) => {
    const agent = actuels.find((i) => i.matricule === r.matricule);
    return r.conflits.map((c) => `${agent.prenom} ${agent.nom} : ${decrireConflit(c)}`);
  });
  if (lignes.length > 0) {
    throw new ErreurMetier('Nouvelle période impossible : des intervenants sont indisponibles', 409, lignes);
  }

  const mission = await Mission.modifier(numeroMission, {
    numeroStation, dateDebut, dateFin, ...trimestreDe(dateDebut),
  });
  return (await detaillerMissions([mission]))[0];
}

async function supprimer(numeroMission, utilisateur) {
  await exigerMission(numeroMission);
  await exigerAucunAutreUnite(numeroMission, utilisateur);
  await Mission.supprimer(numeroMission);
}

// ---------- Affectation des intervenants de l'unité du chef ----------

async function candidats(numeroMission, utilisateur) {
  const mission = await exigerMission(numeroMission);
  const agents = await Personnel.findByUnite(utilisateur.numeroUnite);
  const resultats = await disponibiliteService.verifierDisponibilite(
    agents.map((a) => a.matricule), mission.dateDebut, mission.dateFin, { exclureMission: numeroMission });
  const affectes = new Set(
    (await Mission.intervenantsDe([numeroMission]))
      .filter((i) => i.numeroUnite === utilisateur.numeroUnite)
      .map((i) => i.matricule));

  return {
    mission: (await detaillerMissions([mission]))[0],
    agents: agents.map((a, i) => ({
      ...a,
      disponible: resultats[i].disponible,
      conflits: resultats[i].conflits,
      affecte: affectes.has(a.matricule),
    })),
  };
}

async function affecter(numeroMission, { matricules }, utilisateur) {
  const mission = await exigerMission(numeroMission);
  if (!Array.isArray(matricules) || matricules.length > 200) {
    throw new ErreurMetier('Liste des intervenants invalide', 400);
  }
  const agents = new Map((await Personnel.findByUnite(utilisateur.numeroUnite)).map((a) => [a.matricule, a]));
  const choisis = [...new Set(matricules)];
  for (const matricule of choisis) {
    if (!agents.has(matricule)) {
      throw new ErreurMetier(`Agent inconnu ou hors de votre unité : ${matricule}`, 400);
    }
  }

  // RG1/RG2 : aucun intervenant en congé validé ou déjà pris par une permanence ou une autre mission
  const resultats = await disponibiliteService.verifierDisponibilite(
    choisis, mission.dateDebut, mission.dateFin, { exclureMission: numeroMission });
  const lignes = resultats.flatMap((r) => {
    const agent = agents.get(r.matricule);
    return r.conflits.map((c) => `${agent.prenom} ${agent.nom} : ${decrireConflit(c)}`);
  });
  if (lignes.length > 0) {
    throw new ErreurMetier('Affectation refusée : certains agents sont indisponibles', 409, lignes);
  }

  await db.transaction((client) =>
    Mission.remplacerIntervenantsUnite(numeroMission, utilisateur.numeroUnite, choisis, client));
  return (await detaillerMissions([await Mission.findById(numeroMission)]))[0];
}

module.exports = { lister, creer, modifier, supprimer, candidats, affecter };
