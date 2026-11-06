// Control : CongeService
// Cas « Demander un congé » (cadre / surveillant), « Valider une demande de congé » (chef de service
// de l'unité du demandeur, RG8) et « Consulter le calendrier des congés ».
// RG2 : seul un congé VALIDÉ rend l'agent indisponible.
const Conge = require('../models/conge');
const Personnel = require('../models/personnel');
const disponibiliteService = require('./disponibiliteService');
const { ROLES } = require('../config/roles');
const { TYPES_CONGE } = require('../config/conges');
const { validerPeriode, formaterPeriode, nombreDeJours } = require('../utils/dates');
const { ErreurMetier } = require('../utils/erreurs');

const { decrireConflit } = disponibiliteService;
const MAX_JOURS_CALENDRIER = 366;

// Missions et permanences déjà prévues pendant la période (les congés sont gérés à part)
async function conflitsPlanning(matricule, dateDebut, dateFin) {
  const [resultat] = await disponibiliteService.verifierDisponibilite(
    [matricule], dateDebut, dateFin, { ignorer: ['conge'] });
  return resultat.conflits.map(decrireConflit);
}

async function exigerDemande(id) {
  const conge = await Conge.findById(id);
  if (!conge) throw new ErreurMetier('Demande introuvable', 404);
  return conge;
}

function exigerMemeUnite(conge, utilisateur) {
  if (conge.numeroUnite !== utilisateur.numeroUnite) {
    throw new ErreurMetier("Cette demande n'appartient pas à votre unité", 403);
  }
}

// ---------- Côté agent ----------

async function mesDemandes(utilisateur) {
  return { types: TYPES_CONGE, demandes: await Conge.findByAgent(utilisateur.matricule) };
}

async function demander({ dateDebut, dateFin, type }, utilisateur) {
  validerPeriode(dateDebut, dateFin);
  if (!TYPES_CONGE.includes(type)) throw new ErreurMetier('Type de congé invalide', 400);

  const existants = await Conge.chevauchantDeLAgent(utilisateur.matricule, dateDebut, dateFin);
  if (existants.length > 0) {
    const e = existants[0];
    throw new ErreurMetier(
      `Cette période chevauche ${e.statut === 'Validé' ? 'un de vos congés validés' : 'une de vos demandes en attente'} `
      + `(${formaterPeriode(e.dateDebut, e.dateFin)})`, 409);
  }

  // Une mission ou une permanence déjà prévue n'empêche pas la demande : le chef en est averti
  const alertes = await conflitsPlanning(utilisateur.matricule, dateDebut, dateFin);
  const conge = await Conge.creer({ matricule: utilisateur.matricule, dateDebut, dateFin, type });
  return { conge, alertes };
}

// L'agent annule SA demande tant qu'elle est en attente ; le chef peut annuler tout congé de son unité
async function annuler(id, utilisateur) {
  const conge = await exigerDemande(id);
  if (utilisateur.fonction === ROLES.CHEF) {
    exigerMemeUnite(conge, utilisateur);
  } else {
    if (conge.matricule !== utilisateur.matricule) {
      throw new ErreurMetier('Vous ne pouvez annuler que vos propres demandes', 403);
    }
    if (conge.statut !== 'En attente') {
      throw new ErreurMetier('Seule une demande en attente peut être annulée', 409);
    }
  }
  await Conge.supprimer(id);
}

// ---------- Côté chef de service ----------

async function lister(statut, utilisateur) {
  if (!['En attente', 'Validé'].includes(statut)) {
    throw new ErreurMetier('Statut invalide (En attente ou Validé)', 400);
  }
  const conges = await Conge.findByUnite(utilisateur.numeroUnite, statut);
  if (statut !== 'En attente') return conges;
  return Promise.all(conges.map(async (c) => ({
    ...c, conflits: await conflitsPlanning(c.matricule, c.dateDebut, c.dateFin),
  })));
}

async function nombreEnAttente(utilisateur) {
  return { nombre: await Conge.compterParStatut(utilisateur.numeroUnite, 'En attente') };
}

async function decider(id, { decision, confirmer }, utilisateur) {
  if (!['Validé', 'Refusé'].includes(decision)) {
    throw new ErreurMetier('Décision invalide (Validé ou Refusé)', 400);
  }
  const conge = await exigerDemande(id);
  exigerMemeUnite(conge, utilisateur);
  if (conge.statut !== 'En attente') throw new ErreurMetier('Cette demande a déjà été traitée', 409);

  // Valider un congé alors que l'agent a du travail planifié : le chef doit le confirmer
  if (decision === 'Validé' && confirmer !== true) {
    const conflits = await conflitsPlanning(conge.matricule, conge.dateDebut, conge.dateFin);
    if (conflits.length > 0) {
      throw new ErreurMetier(
        "Conflit détecté : l'agent a déjà du travail planifié sur cette période", 409, conflits, 'CONFIRMATION_REQUISE');
    }
  }
  await Conge.changerStatut(id, decision);
  return Conge.findById(id);
}

// ---------- Calendrier (chef et agents de l'unité) ----------

async function calendrier({ dateDebut, dateFin }, utilisateur) {
  validerPeriode(dateDebut, dateFin);
  if (nombreDeJours(dateDebut, dateFin) > MAX_JOURS_CALENDRIER) {
    throw new ErreurMetier(`Période trop longue (${MAX_JOURS_CALENDRIER} jours maximum)`, 400);
  }
  const estChef = utilisateur.fonction === ROLES.CHEF;
  const [agents, conges] = await Promise.all([
    Personnel.findByUnite(utilisateur.numeroUnite),
    Conge.pourCalendrier(utilisateur.numeroUnite, dateDebut, dateFin, estChef ? ['Validé', 'En attente'] : ['Validé']),
  ]);
  return {
    agents,
    conges: conges.map((c) => ({
      id: c.id, matricule: c.matricule, statut: c.statut, dateDebut: c.dateDebut, dateFin: c.dateFin,
      // Le motif (maladie, hospitalisation...) n'est visible que du chef et de l'intéressé
      type: estChef || c.matricule === utilisateur.matricule ? c.type : null,
    })),
  };
}

module.exports = { mesDemandes, demander, annuler, lister, nombreEnAttente, decider, calendrier };
