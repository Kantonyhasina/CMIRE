// Control : MissionService
// Chaque station possède un emplacement de maintenance par trimestre et par année.
// Chaque chef gère uniquement l'intervenant de sa propre unité : un cadre ou le chef lui-même.
const Mission = require('../models/mission');
const Station = require('../models/station');
const Personnel = require('../models/personnel');
const disponibiliteService = require('./disponibiliteService');
const db = require('../config/db');
const { validerPeriode, trimestreDe } = require('../utils/dates');
const { ErreurMetier } = require('../utils/erreurs');

const { decrireConflit } = disponibiliteService;

function aujourdHuiISO() {
  // Le serveur du projet est utilisé à Madagascar : la date de verrouillage
  // est calculée dans le fuseau du service, indépendamment du fuseau système.
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Indian/Antananarivo' }).format(new Date());
}

function estVerrouillee(mission) {
  return mission.dateDebut <= aujourdHuiISO();
}

function validerPeriodeMission(dateDebut, dateFin) {
  validerPeriode(dateDebut, dateFin);
  const debut = trimestreDe(dateDebut);
  const fin = trimestreDe(dateFin);
  if (debut.annee !== fin.annee || debut.trimestre !== fin.trimestre) {
    throw new ErreurMetier('Une mission doit rester entièrement dans le même trimestre et la même année', 400);
  }
}

function exigerDateFuture(dateDebut) {
  if (dateDebut <= aujourdHuiISO()) {
    throw new ErreurMetier('La date de début est arrivée : cette mission est verrouillée et ne peut plus être créée ou modifiée', 409);
  }
}

async function detaillerMissions(missions) {
  const intervenants = missions.length > 0
    ? await Mission.intervenantsDe(missions.map((m) => m.numeroMission))
    : [];
  return missions.map((m) => ({
    ...m,
    verrouillee: estVerrouillee(m),
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

async function exigerMissionModifiable(numeroMission) {
  const mission = await exigerMission(numeroMission);
  if (estVerrouillee(mission)) {
    throw new ErreurMetier('Mission verrouillée : la date de début est arrivée, aucune modification n’est autorisée', 409);
  }
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

async function exigerEmplacementLibre(numeroStation, dateDebut, numeroMission = null) {
  const { annee, trimestre } = trimestreDe(dateDebut);
  if (await Mission.existePourStationEtTrimestre(numeroStation, annee, trimestre, numeroMission)) {
    throw new ErreurMetier('Une mission existe déjà pour cette station dans ce trimestre', 409);
  }
}

// ---------- Consultation ----------

async function lister({ annee, trimestre }) {
  if (!Number.isInteger(annee) || annee < 2000 || annee > 2100) throw new ErreurMetier('Année invalide', 400);
  if (![1, 2, 3, 4].includes(trimestre)) throw new ErreurMetier('Trimestre invalide (1 à 4)', 400);
  return detaillerMissions(await Mission.findByTrimestre(annee, trimestre));
}

async function listerAnnee(annee) {
  if (!Number.isInteger(annee) || annee < 2000 || annee > 2100) throw new ErreurMetier('Année invalide', 400);
  return detaillerMissions(await Mission.findByAnnee(annee));
}

// ---------- Planification ----------

async function creer({ numeroStation, dateDebut, dateFin }) {
  validerPeriodeMission(dateDebut, dateFin);
  exigerDateFuture(dateDebut);
  await exigerStation(numeroStation);
  await exigerEmplacementLibre(numeroStation, dateDebut);
  const mission = await Mission.creer({ numeroStation, dateDebut, dateFin, ...trimestreDe(dateDebut) });
  return (await detaillerMissions([mission]))[0];
}

async function modifier(numeroMission, { numeroStation, dateDebut, dateFin }, utilisateur) {
  const missionExistante = await exigerMissionModifiable(numeroMission);
  await exigerAucunAutreUnite(numeroMission, utilisateur);
  validerPeriodeMission(dateDebut, dateFin);
  exigerDateFuture(dateDebut);
  const nouvellePeriode = trimestreDe(dateDebut);
  if (nouvellePeriode.annee !== missionExistante.annee
      || nouvellePeriode.trimestre !== missionExistante.trimestre) {
    throw new ErreurMetier('La modification doit conserver le trimestre et l’année de planification initiaux', 400);
  }
  await exigerStation(numeroStation);
  await exigerEmplacementLibre(numeroStation, dateDebut, numeroMission);

  // La nouvelle période doit convenir à l'intervenant déjà affecté.
  const actuels = await Mission.intervenantsDe([numeroMission]);
  const matricules = actuels.map((i) => i.matricule);
  const resultats = matricules.length > 0
    ? await disponibiliteService.verifierDisponibilite(matricules, dateDebut, dateFin, { exclureMission: numeroMission })
    : [];
  const lignes = resultats.flatMap((r) => {
    const agent = actuels.find((i) => i.matricule === r.matricule);
    return r.conflits.map((c) => `${agent.prenom} ${agent.nom} : ${decrireConflit(c)}`);
  });
  if (lignes.length > 0) {
    throw new ErreurMetier('Nouvelle période impossible : des intervenants sont indisponibles', 409, lignes);
  }

  // La station reste réservée à son emplacement annuel ; le trimestre ne peut pas changer.
  const mission = await Mission.modifier(numeroMission, {
    numeroStation, dateDebut, dateFin, ...trimestreDe(dateDebut),
  });
  return (await detaillerMissions([mission]))[0];
}

async function supprimer(numeroMission, utilisateur) {
  await exigerMissionModifiable(numeroMission);
  await exigerAucunAutreUnite(numeroMission, utilisateur);
  await Mission.supprimer(numeroMission);
}

// ---------- Affectation de l'unique cadre de l'unité du chef ----------

async function candidats(numeroMission, utilisateur) {
  const mission = await exigerMissionModifiable(numeroMission);
  const agents = await Personnel.findCadresEtChefs({ numeroUnite: utilisateur.numeroUnite });
  const resultats = agents.length > 0
    ? await disponibiliteService.verifierDisponibilite(
      agents.map((a) => a.matricule), mission.dateDebut, mission.dateFin, { exclureMission: numeroMission })
    : [];
  const parResultat = new Map(resultats.map((r) => [r.matricule, r]));
  const affecte = (await Mission.intervenantsDe([numeroMission]))
    .find((i) => Number(i.numeroUnite) === Number(utilisateur.numeroUnite));

  return {
    mission: (await detaillerMissions([mission]))[0],
    agents: agents.map((a) => {
      const resultat = parResultat.get(a.matricule) || { disponible: true, conflits: [] };
      return {
        ...a,
        disponible: resultat.disponible,
        conflits: resultat.conflits,
        affecte: affecte?.matricule === a.matricule,
      };
    }),
    matriculeAffecte: affecte?.matricule || null,
  };
}

async function affecter(numeroMission, { matricules }, utilisateur) {
  const mission = await exigerMissionModifiable(numeroMission);
  if (!Array.isArray(matricules) || matricules.length > 1) {
    throw new ErreurMetier('Un seul cadre ou chef de service peut être affecté par unité et par mission', 400);
  }

  const agents = new Map(
    (await Personnel.findCadresEtChefs({ numeroUnite: utilisateur.numeroUnite }))
      .map((a) => [a.matricule, a])
  );
  const choisis = [...new Set(matricules)];
  for (const matricule of choisis) {
    if (!agents.has(matricule)) {
      throw new ErreurMetier(`Agent inconnu, non cadre ou hors de votre unité : ${matricule}`, 400);
    }
  }

  // RG1/RG2 : un agent en congé validé, en permanence ou en autre mission est indisponible.
  const resultats = choisis.length > 0
    ? await disponibiliteService.verifierDisponibilite(
      choisis, mission.dateDebut, mission.dateFin, { exclureMission: numeroMission })
    : [];
  const lignes = resultats.flatMap((r) => {
    const agent = agents.get(r.matricule);
    return r.conflits.map((c) => `${agent.prenom} ${agent.nom} : ${decrireConflit(c)}`);
  });
  if (lignes.length > 0) {
    throw new ErreurMetier('Affectation refusée : le cadre sélectionné est indisponible', 409, lignes);
  }

  await db.transaction((client) =>
    Mission.remplacerIntervenantsUnite(numeroMission, utilisateur.numeroUnite, choisis, client));
  return (await detaillerMissions([await Mission.findById(numeroMission)]))[0];
}

module.exports = { lister, listerAnnee, creer, modifier, supprimer, candidats, affecter };
