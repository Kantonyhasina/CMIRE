// Control : PermanenceService
// Cas « Planifier la permanence des cadres / des surveillants » et « Consulter le planning de permanence ».
// Règles RG1/RG2 : un agent en congé validé ou en mission ne peut pas être planifié.
// RG8 : un chef de service ne planifie que les cadres de sa propre unité (l'administrateur : toutes).
const Semaine = require('../models/semaine');
const Personnel = require('../models/personnel');
const Poste = require('../models/poste');
const Unite = require('../models/unite');
const PermanenceCadre = require('../models/permanenceCadre');
const PermanenceSurveillant = require('../models/permanenceSurveillant');
const disponibiliteService = require('./disponibiliteService');
const db = require('../config/db');
const { ROLES } = require('../config/roles');
const { JOURS, CRENEAUX_CADRE, PLAGES_SURVEILLANT } = require('../config/permanences');
const { lundiDeLaSemaine, ajouterJours, formaterDateFr } = require('../utils/dates');
const { ErreurMetier } = require('../utils/erreurs');

const MAX_AFFECTATIONS = 1000;

const dateDuJour = (lundi, jour) => ajouterJours(lundi, JOURS.indexOf(jour));
const joursDeLaSemaine = (lundi) => JOURS.map((nom, i) => ({ nom, date: ajouterJours(lundi, i) }));

function decrireSemaine(semaine) {
  const { dateDebut, dateFin, annee, numeroIso, numeroSemaine } = semaine;
  return { dateDebut, dateFin, annee, numeroIso, enregistree: numeroSemaine !== null };
}

async function verifierDroitSurUnite(utilisateur, numeroUnite) {
  if (utilisateur.fonction === ROLES.CHEF && utilisateur.numeroUnite !== numeroUnite) {
    throw new ErreurMetier('Vous ne pouvez gérer que les permanences de votre unité', 403);
  }
  if (!(await Unite.existe(numeroUnite))) throw new ErreurMetier('Unité inexistante', 404);
}

function exigerTableau(affectations) {
  if (!Array.isArray(affectations) || affectations.length > MAX_AFFECTATIONS) {
    throw new ErreurMetier('Liste des affectations invalide', 400);
  }
}

// Ajoute à chaque agent ses indisponibilités de la semaine (congé validé, mission).
// Les permanences ne comptent pas ici : un agent peut avoir plusieurs créneaux.
async function avecIndisponibilites(agents, semaine) {
  const resultats = await disponibiliteService.verifierDisponibilite(
    agents.map((a) => a.matricule), semaine.dateDebut, semaine.dateFin, { ignorer: ['permanence'] });
  return agents.map((agent, i) => ({ ...agent, indisponibilites: resultats[i].conflits }));
}

// Refuse le planning si un agent est affecté un jour où il est en congé ou en mission
async function exigerSansConflit(affectations, semaine, agentsParMatricule) {
  const matricules = [...new Set(affectations.map((a) => a.matricule))];
  if (matricules.length === 0) return;

  const resultats = await disponibiliteService.verifierDisponibilite(
    matricules, semaine.dateDebut, semaine.dateFin, { ignorer: ['permanence'] });
  const conflitsParAgent = new Map(resultats.map((r) => [r.matricule, r.conflits]));

  const lignes = new Set();
  for (const a of affectations) {
    const date = dateDuJour(semaine.dateDebut, a.jour);
    const conflit = conflitsParAgent.get(a.matricule).find((c) => c.dateDebut <= date && date <= c.dateFin);
    if (conflit) {
      const agent = agentsParMatricule.get(a.matricule);
      lignes.add(`${agent.prenom} ${agent.nom} : ${a.jour} ${formaterDateFr(date)} (${conflit.detail})`);
    }
  }
  if (lignes.size > 0) {
    throw new ErreurMetier('Planning refusé : certains agents sont indisponibles', 409, [...lignes]);
  }
}

// ---------- Cadres de maintenance ----------

async function consulterCadres({ date, numeroUnite }) {
  const lundi = lundiDeLaSemaine(date);
  const semaine = await Semaine.decrire(lundi);
  const cadres = await Personnel.findByFonction(ROLES.CADRE, { numeroUnite });
  const affectations = semaine.numeroSemaine
    ? await PermanenceCadre.findBySemaineEtUnite(semaine.numeroSemaine, numeroUnite)
    : [];

  return {
    semaine: decrireSemaine(semaine),
    jours: joursDeLaSemaine(lundi),
    creneaux: CRENEAUX_CADRE,
    agents: await avecIndisponibilites(cadres, semaine),
    affectations,
  };
}

async function consulterCadresPour({ date, numeroUnite }, utilisateur) {
  await verifierDroitSurUnite(utilisateur, numeroUnite);
  return consulterCadres({ date, numeroUnite });
}

async function enregistrerCadres({ date, numeroUnite, affectations }, utilisateur) {
  await verifierDroitSurUnite(utilisateur, numeroUnite);
  exigerTableau(affectations);

  const lundi = lundiDeLaSemaine(date);
  const semaine = await Semaine.decrire(lundi);
  const cadres = await Personnel.findByFonction(ROLES.CADRE, { numeroUnite });
  const parMatricule = new Map(cadres.map((c) => [c.matricule, c]));

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
  }

  await exigerSansConflit(affectations, semaine, parMatricule);

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
  const [postes, surveillants] = await Promise.all([
    Poste.findAll(),
    Personnel.findByFonction(ROLES.SURVEILLANT),
  ]);
  const affectations = semaine.numeroSemaine
    ? await PermanenceSurveillant.findBySemaine(semaine.numeroSemaine)
    : [];

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
  const [postes, surveillants] = await Promise.all([
    Poste.findAll(),
    Personnel.findByFonction(ROLES.SURVEILLANT),
  ]);
  const numerosPostes = new Set(postes.map((p) => p.numero_poste));
  const parMatricule = new Map(surveillants.map((s) => [s.matricule, s]));

  // Un même surveillant peut tenir deux postes à la même plage (ex. la nuit) : seul le créneau
  // d'un poste est exclusif (un seul surveillant par poste, jour et plage).
  const creneauxPris = new Set();
  for (const a of affectations) {
    if (!a || !parMatricule.has(a.matricule)) {
      throw new ErreurMetier(`Agent inconnu ou n'est pas surveillant : ${a?.matricule}`, 400);
    }
    if (!numerosPostes.has(a.numeroPoste)) throw new ErreurMetier(`Poste inconnu : ${a.numeroPoste}`, 400);
    if (!JOURS.includes(a.jour)) throw new ErreurMetier(`Jour invalide : ${a.jour}`, 400);
    if (!PLAGES_SURVEILLANT.includes(a.plage)) throw new ErreurMetier(`Plage horaire invalide : ${a.plage}`, 400);
    const cle = `${a.numeroPoste}|${a.jour}|${a.plage}`;
    if (creneauxPris.has(cle)) throw new ErreurMetier('Deux surveillants sur le même poste et la même plage', 400);
    creneauxPris.add(cle);
  }

  await exigerSansConflit(affectations, semaine, parMatricule);

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
    if (utilisateur.fonction === ROLES.CADRE) {
      lignes = (await PermanenceCadre.findByAgent(semaine.numeroSemaine, utilisateur.matricule))
        .map((l) => ({ ...l, poste: null }));
    } else if (utilisateur.fonction === ROLES.SURVEILLANT) {
      lignes = await PermanenceSurveillant.findByAgent(semaine.numeroSemaine, utilisateur.matricule);
    }
  }

  const permanences = lignes
    .map((l) => ({ jour: l.jour, date: dateDuJour(lundi, l.jour), horaire: l.horaire, poste: l.poste }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.horaire.localeCompare(b.horaire));

  return { semaine: decrireSemaine(semaine), permanences };
}

module.exports = {
  consulterCadres: consulterCadresPour,
  enregistrerCadres,
  consulterSurveillants,
  enregistrerSurveillants,
  monPlanning,
};
