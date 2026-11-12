// Control : PermanenceService
// Cas « Planifier la permanence des cadres / des surveillants » et « Consulter le planning de permanence ».
// RG1/RG2 : un agent en congé validé ou en mission ne peut pas être planifié.
// RG8 : un chef ne peut modifier que le planning de sa propre unité, mais peut consulter les autres unités.
const Semaine = require('../models/semaine');
const Personnel = require('../models/personnel');
const Poste = require('../models/poste');
const Unite = require('../models/unite');
const PermanenceCadre = require('../models/permanenceCadre');
const PermanenceSurveillant = require('../models/permanenceSurveillant');
const Agenda = require('../models/agenda');
const disponibiliteService = require('./disponibiliteService');
const db = require('../config/db');
const { ROLES } = require('../config/roles');
const { JOURS, CRENEAUX_CADRE, PLAGES_SURVEILLANT } = require('../config/permanences');
const { lundiDeLaSemaine, ajouterJours, formaterDateFr } = require('../utils/dates');
const { ErreurMetier } = require('../utils/erreurs');

const MAX_AFFECTATIONS = 1000;
const DESIGNATIONS_SURVEILLANT = new Set(['TECH ELB', 'TECH CNS']);

const dateDuJour = (lundi, jour) => ajouterJours(lundi, JOURS.indexOf(jour));
const joursDeLaSemaine = (lundi) => JOURS.map((nom, i) => ({ nom, date: ajouterJours(lundi, i) }));

function decrireSemaine(semaine) {
  const { dateDebut, dateFin, annee, numeroIso, numeroSemaine } = semaine;
  return { dateDebut, dateFin, annee, numeroIso, enregistree: numeroSemaine !== null };
}

// La consultation est autorisée pour toutes les unités par les routes réservées aux chefs.
async function verifierUniteExiste(numeroUnite) {
  if (!(await Unite.existe(numeroUnite))) {
    throw new ErreurMetier('Unité inexistante', 404);
  }
}

// La modification reste limitée à l'unité du chef connecté.
async function verifierDroitModification(utilisateur, numeroUnite) {
  await verifierUniteExiste(numeroUnite);

  if (
    utilisateur.fonction === ROLES.CHEF &&
    Number(utilisateur.numeroUnite) !== Number(numeroUnite)
  ) {
    throw new ErreurMetier(
      'Vous pouvez consulter les autres unités, mais modifier uniquement les permanences de votre unité',
      403
    );
  }
}

function exigerTableau(affectations) {
  if (!Array.isArray(affectations) || affectations.length > MAX_AFFECTATIONS) {
    throw new ErreurMetier('Liste des affectations invalide', 400);
  }
}

// Ajoute à chaque agent ses indisponibilités de la semaine (congé validé, mission).
// Les permanences ne comptent pas ici : un agent peut avoir plusieurs créneaux.
async function avecIndisponibilites(agents, semaine) {
  if (agents.length === 0) return [];

  const resultats = await disponibiliteService.verifierDisponibilite(
    agents.map((a) => a.matricule),
    semaine.dateDebut,
    semaine.dateFin,
    { ignorer: ['permanence'] }
  );

  return agents.map((agent, i) => ({
    ...agent,
    indisponibilites: resultats[i].conflits,
  }));
}

// Refuse le planning si un agent est affecté un jour où il est en congé ou en mission.
async function exigerSansConflit(affectations, semaine, agentsParMatricule) {
  const matricules = [...new Set(affectations.map((a) => a.matricule).filter(Boolean))];
  if (matricules.length === 0) return;

  const resultats = await disponibiliteService.verifierDisponibilite(
    matricules,
    semaine.dateDebut,
    semaine.dateFin,
    { ignorer: ['permanence'] }
  );
  const conflitsParAgent = new Map(resultats.map((r) => [r.matricule, r.conflits]));

  const lignes = new Set();
  for (const a of affectations) {
    const date = dateDuJour(semaine.dateDebut, a.jour);
    const conflits = conflitsParAgent.get(a.matricule) || [];
    const conflit = conflits.find((c) => c.dateDebut <= date && date <= c.dateFin);

    if (conflit) {
      const agent = agentsParMatricule.get(a.matricule);
      if (agent) {
        lignes.add(`${agent.prenom} ${agent.nom} : ${a.jour} ${formaterDateFr(date)} (${conflit.detail})`);
      }
    }
  }

  if (lignes.size > 0) {
    throw new ErreurMetier('Planning refusé : certains agents sont indisponibles', 409, [...lignes]);
  }
}

// ---------- Cadres de maintenance et chef de service ----------

async function consulterCadres({ date, numeroUnite }) {
  const lundi = lundiDeLaSemaine(date);
  const semaine = await Semaine.decrire(lundi);

  const affectations = semaine.numeroSemaine
    ? await PermanenceCadre.findBySemaineEtUnite(semaine.numeroSemaine, numeroUnite)
    : [];
  // Les agents désactivés ne sont jamais proposés pour de nouvelles affectations.
  // S'ils ont déjà une permanence dans la semaine consultée, on les garde visibles
  // afin que l'historique reste lisible et que le chef puisse retirer l'ancienne case.
  const tousLesCadres = await Personnel.findCadresEtChefs({ numeroUnite, inclureInactifs: true });
  const affectes = new Set(affectations.map((a) => a.matricule));
  const cadresEtChef = tousLesCadres.filter((agent) => agent.actif || affectes.has(agent.matricule));

  return {
    semaine: decrireSemaine(semaine),
    jours: joursDeLaSemaine(lundi),
    creneaux: CRENEAUX_CADRE,
    agents: await avecIndisponibilites(cadresEtChef, semaine),
    affectations,
  };
}

async function consulterCadresPour({ date, numeroUnite }) {
  await verifierUniteExiste(numeroUnite);
  return consulterCadres({ date, numeroUnite });
}

async function enregistrerCadres({ date, numeroUnite, affectations }, utilisateur) {
  await verifierDroitModification(utilisateur, numeroUnite);
  exigerTableau(affectations);

  const lundi = lundiDeLaSemaine(date);
  const semaine = await Semaine.decrire(lundi);
  const affectationsExistantes = semaine.numeroSemaine
    ? await PermanenceCadre.findBySemaineEtUnite(semaine.numeroSemaine, numeroUnite)
    : [];
  const tousLesCadres = await Personnel.findCadresEtChefs({ numeroUnite, inclureInactifs: true });
  const parMatricule = new Map(tousLesCadres.map((agent) => [agent.matricule, agent]));
  const clesExistantes = new Set(affectationsExistantes.map((a) => `${a.matricule}|${a.jour}|${a.creneau}`));

  const vues = new Set();
  for (const a of affectations) {
    if (!a || !parMatricule.has(a.matricule)) {
      throw new ErreurMetier(`Agent inconnu ou hors de l'unité : ${a?.matricule}`, 400);
    }
    if (!JOURS.includes(a.jour)) throw new ErreurMetier(`Jour invalide : ${a.jour}`, 400);
    if (!CRENEAUX_CADRE.includes(a.creneau)) throw new ErreurMetier(`Créneau invalide : ${a.creneau}`, 400);

    const cle = `${a.matricule}|${a.jour}|${a.creneau}`;
    if (vues.has(cle)) throw new ErreurMetier('Affectation en double', 400);
    vues.add(cle);
    const agent = parMatricule.get(a.matricule);
    if (!agent.actif && !clesExistantes.has(cle)) {
      throw new ErreurMetier(`Le compte ${a.matricule} est désactivé : aucune nouvelle permanence ne peut lui être affectée`, 409);
    }
  }

  // Les affectations historiques inchangées d'agents désactivés sont conservables.
  // Seules les affectations actives passent par le contrôle de nouvelle disponibilité.
  const nouvellesAffectationsActives = affectations.filter((a) => parMatricule.get(a.matricule)?.actif);
  await exigerSansConflit(nouvellesAffectationsActives, semaine, parMatricule);

  await db.transaction(async (client) => {
    const numeroSemaine = await Semaine.trouverOuCreer(lundi, client);
    await PermanenceCadre.remplacer(numeroSemaine, numeroUnite, affectations, client);
  });

  return consulterCadres({ date, numeroUnite });
}

// ---------- Surveillants (tableau unique pour tous les postes et toutes les unités) ----------

async function consulterSurveillants({ date }) {
  const lundi = lundiDeLaSemaine(date);
  const semaine = await Semaine.decrire(lundi);
  const [postes, tousLesSurveillants, affectations] = await Promise.all([
    Poste.findAll(),
    Personnel.findByFonction(ROLES.SURVEILLANT, { inclureInactifs: true }),
    semaine.numeroSemaine ? PermanenceSurveillant.findBySemaine(semaine.numeroSemaine) : Promise.resolve([]),
  ]);
  const affectes = new Set(affectations.map((a) => a.matricule).filter(Boolean));
  const surveillants = tousLesSurveillants.filter((agent) => agent.actif || affectes.has(agent.matricule));

  return {
    semaine: decrireSemaine(semaine),
    jours: joursDeLaSemaine(lundi),
    plages: PLAGES_SURVEILLANT,
    postes: postes.sort((a, b) => a.numero_poste - b.numero_poste),
    agents: await avecIndisponibilites(surveillants, semaine),
    affectations,
  };
}

async function enregistrerSurveillants({ date, affectations }) {
  exigerTableau(affectations);

  const lundi = lundiDeLaSemaine(date);
  const semaine = await Semaine.decrire(lundi);
  const [postes, tousLesSurveillants] = await Promise.all([
    Poste.findAll(),
    Personnel.findByFonction(ROLES.SURVEILLANT, { inclureInactifs: true }),
  ]);
  const affectationsExistantes = semaine.numeroSemaine
    ? await PermanenceSurveillant.findBySemaine(semaine.numeroSemaine)
    : [];
  const numerosPostes = new Set(postes.map((p) => p.numero_poste));
  const parMatricule = new Map(tousLesSurveillants.map((s) => [s.matricule, s]));
  const clesExistantes = new Set(affectationsExistantes
    .filter((a) => a.matricule)
    .map((a) => `${a.numeroPoste}|${a.jour}|${a.plage}|${a.matricule}`));

  // Une case contient soit un surveillant réel, soit une des deux désignations libres.
  // TECH ELB / TECH CNS ne sont volontairement liés à aucun matricule.
  const creneauxPris = new Set();
  for (const a of affectations) {
    if (!a) throw new ErreurMetier('Affectation invalide', 400);
    const aUnAgent = Boolean(a.matricule);
    const aUneDesignation = Boolean(a.designationSpeciale);
    if (aUnAgent === aUneDesignation) {
      throw new ErreurMetier('Une affectation doit contenir soit un surveillant, soit TECH ELB / TECH CNS', 400);
    }
    if (aUnAgent && !parMatricule.has(a.matricule)) {
      throw new ErreurMetier(`Agent inconnu ou n'est pas surveillant : ${a.matricule}`, 400);
    }
    if (aUnAgent && !parMatricule.get(a.matricule).actif) {
      const cleExistante = `${a.numeroPoste}|${a.jour}|${a.plage}|${a.matricule}`;
      if (!clesExistantes.has(cleExistante)) {
        throw new ErreurMetier(`Le compte ${a.matricule} est désactivé : aucune nouvelle permanence ne peut lui être affectée`, 409);
      }
    }
    if (aUneDesignation && !DESIGNATIONS_SURVEILLANT.has(a.designationSpeciale)) {
      throw new ErreurMetier('Désignation spéciale invalide : ' + a.designationSpeciale, 400);
    }
    if (!numerosPostes.has(a.numeroPoste)) throw new ErreurMetier(`Poste inconnu : ${a.numeroPoste}`, 400);
    if (!JOURS.includes(a.jour)) throw new ErreurMetier(`Jour invalide : ${a.jour}`, 400);
    if (!PLAGES_SURVEILLANT.includes(a.plage)) throw new ErreurMetier(`Plage horaire invalide : ${a.plage}`, 400);

    const cle = `${a.numeroPoste}|${a.jour}|${a.plage}`;
    if (creneauxPris.has(cle)) throw new ErreurMetier('Deux surveillants sur le même poste et la même plage', 400);
    creneauxPris.add(cle);
  }

  const nouvellesAffectationsActives = affectations.filter((a) => a.matricule && parMatricule.get(a.matricule)?.actif);
  await exigerSansConflit(nouvellesAffectationsActives, semaine, parMatricule);

  await db.transaction(async (client) => {
    const numeroSemaine = await Semaine.trouverOuCreer(lundi, client);
    await PermanenceSurveillant.remplacer(numeroSemaine, affectations, client);
  });

  return consulterSurveillants({ date });
}

// ---------- Consultation par l'agent concerné ----------

async function monPlanning({ date }, utilisateur) {
  const lundi = lundiDeLaSemaine(date);
  const semaine = await Semaine.decrire(lundi);

  let lignes = [];
  if (semaine.numeroSemaine) {
    // Le chef assure lui aussi des permanences dans la grille des cadres.
    if ([ROLES.CADRE, ROLES.CHEF].includes(utilisateur.fonction)) {
      lignes = (await PermanenceCadre.findByAgent(semaine.numeroSemaine, utilisateur.matricule))
        .map((l) => ({ ...l, poste: null }));
    } else if (utilisateur.fonction === ROLES.SURVEILLANT) {
      lignes = await PermanenceSurveillant.findByAgent(semaine.numeroSemaine, utilisateur.matricule);
    }
  }

  const permanences = lignes
    .map((l) => ({ jour: l.jour, date: dateDuJour(lundi, l.jour), horaire: l.horaire, poste: l.poste }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.horaire.localeCompare(b.horaire));

  const [missions, conges] = await Promise.all([
    Agenda.missionsDeLAgent(utilisateur.matricule, semaine.dateDebut, semaine.dateFin),
    Agenda.congesDeLAgent(utilisateur.matricule, semaine.dateDebut, semaine.dateFin),
  ]);

  return { semaine: decrireSemaine(semaine), permanences, missions, conges };
}

module.exports = {
  consulterCadres: consulterCadresPour,
  enregistrerCadres,
  consulterSurveillants,
  enregistrerSurveillants,
  monPlanning,
};
