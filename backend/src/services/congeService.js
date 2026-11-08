// Gestion des congés : demandes des agents, congés directs du chef et pauses sans durée connue.
const Conge = require('../models/conge');
const Personnel = require('../models/personnel');
const disponibiliteService = require('./disponibiliteService');
const { ROLES } = require('../config/roles');
const { TYPES_CONGE } = require('../config/conges');
const { validerPeriode, formaterPeriode, nombreDeJours, dateValide } = require('../utils/dates');
const { ErreurMetier } = require('../utils/erreurs');

const { decrireConflit } = disponibiliteService;
const MAX_JOURS_CALENDRIER = 366;
const STATUTS_LISTABLES = ['En attente', 'Validé', 'En pause', 'Repris'];

function aujourdHuiMadagascar() {
  const parties = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Indian/Antananarivo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const valeurs = Object.fromEntries(parties.map((p) => [p.type, p.value]));
  return `${valeurs.year}-${valeurs.month}-${valeurs.day}`;
}

async function conflitsPlanning(matricule, dateDebut, dateFin) {
  const [resultat] = await disponibiliteService.verifierDisponibilite(
    [matricule], dateDebut, dateFin, { ignorer: ['conge'] });
  return resultat.conflits.map(decrireConflit);
}

async function exigerDemande(id) {
  const conge = await Conge.findById(id);
  if (!conge) throw new ErreurMetier('Demande ou congé introuvable', 404);
  return conge;
}

function exigerMemeUnite(conge, utilisateur) {
  if (conge.numeroUnite !== utilisateur.numeroUnite) {
    throw new ErreurMetier("Cette demande n'appartient pas à votre unité", 403);
  }
}

function exigerType(type) {
  if (!TYPES_CONGE.includes(type)) throw new ErreurMetier('Type de congé invalide', 400);
}

// ---------- Côté agent : demande classique à dates définies ----------
async function personnelsUnite(utilisateur) {
  return Personnel.findByUnite(utilisateur.numeroUnite);
}

async function mesDemandes(utilisateur) {
  return { types: TYPES_CONGE, demandes: await Conge.findByAgent(utilisateur.matricule) };
}

async function demander({ dateDebut, dateFin, type }, utilisateur) {
  validerPeriode(dateDebut, dateFin);
  exigerType(type);

  const existants = await Conge.chevauchantDeLAgent(utilisateur.matricule, dateDebut, dateFin);
  if (existants.length > 0) {
    const e = existants[0];
    throw new ErreurMetier(
      e.statut === 'En pause'
        ? 'Vous êtes actuellement en pause et ne pouvez pas demander un autre congé'
        : `Cette période chevauche un congé ou une demande existante (${e.dateDebut && e.dateFin ? formaterPeriode(e.dateDebut, e.dateFin) : e.type})`,
      409);
  }

  const alertes = await conflitsPlanning(utilisateur.matricule, dateDebut, dateFin);
  const conge = await Conge.creer({ matricule: utilisateur.matricule, dateDebut, dateFin, type });
  return { conge, alertes };
}

async function annuler(id, utilisateur) {
  const conge = await exigerDemande(id);
  if (utilisateur.fonction === ROLES.CHEF) {
    exigerMemeUnite(conge, utilisateur);
    if (conge.statut === 'Repris') throw new ErreurMetier("Un historique de reprise ne peut pas être supprimé", 409);
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

// ---------- Côté chef : création directe dans son unité, sans circuit d'approbation ----------
async function creerDirectement({ matricule, type, dateDebut, dateFin, sansDureeConnue }, utilisateur) {
  exigerType(type);
  const personnel = (await Personnel.findByUnite(utilisateur.numeroUnite))
    .find((p) => p.matricule === matricule);
  if (!personnel) throw new ErreurMetier("Ce personnel n'appartient pas à votre unité", 403);

  const estPause = sansDureeConnue === true;
  if (estPause) {
    if (!['Maladie', 'Hospitalisation'].includes(type)) {
      throw new ErreurMetier('La pause sans durée connue est réservée à la maladie ou à l’hospitalisation', 400);
    }
    if (dateDebut || dateFin) throw new ErreurMetier('Une pause sans durée connue ne doit contenir aucune date de début ou de fin', 400);
    const aujourdHui = aujourdHuiMadagascar();
    const existants = await Conge.chevauchantDeLAgent(matricule, aujourdHui, aujourdHui);
    if (existants.length) throw new ErreurMetier('Ce personnel possède déjà un congé ou une indisponibilité active', 409);
    const alertes = await conflitsPlanning(matricule, aujourdHui, '9999-12-31');
    const conge = await Conge.creer({
      matricule, type, dateDebut: null, dateFin: null, statut: 'En pause', creePar: utilisateur.matricule,
    });
    return { conge, alertes };
  }

  validerPeriode(dateDebut, dateFin);
  const existants = await Conge.chevauchantDeLAgent(matricule, dateDebut, dateFin);
  if (existants.length) throw new ErreurMetier('Cette période chevauche un congé ou une indisponibilité existante', 409);
  const alertes = await conflitsPlanning(matricule, dateDebut, dateFin);
  const conge = await Conge.creer({
    matricule, type, dateDebut, dateFin, statut: 'Validé', creePar: utilisateur.matricule,
  });
  return { conge, alertes };
}

async function reprendre(id, { dateReprise }, utilisateur) {
  if (!dateValide(dateReprise)) throw new ErreurMetier('Date de reprise invalide (format attendu : AAAA-MM-JJ)', 400);
  const conge = await exigerDemande(id);
  exigerMemeUnite(conge, utilisateur);
  if (conge.statut !== 'En pause') throw new ErreurMetier('Cette indisponibilité n’est plus en pause', 409);
  if (dateReprise > aujourdHuiMadagascar()) throw new ErreurMetier('La date de reprise ne peut pas être dans le futur', 400);
  if (conge.createdAt) {
    const debutPause = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Indian/Antananarivo', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date(conge.createdAt));
    if (dateReprise < debutPause) {
      throw new ErreurMetier('La date de reprise ne peut pas être antérieure à la mise en pause', 400);
    }
  }
  return Conge.reprendre(id, dateReprise);
}

async function lister(statut, utilisateur) {
  if (!STATUTS_LISTABLES.includes(statut)) {
    throw new ErreurMetier(`Statut invalide (${STATUTS_LISTABLES.join(', ')})`, 400);
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
  if (!['Validé', 'Refusé'].includes(decision)) throw new ErreurMetier('Décision invalide (Validé ou Refusé)', 400);
  const conge = await exigerDemande(id);
  exigerMemeUnite(conge, utilisateur);
  if (conge.statut !== 'En attente') throw new ErreurMetier('Cette demande a déjà été traitée', 409);

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

async function calendrier({ dateDebut, dateFin }, utilisateur) {
  validerPeriode(dateDebut, dateFin);
  if (nombreDeJours(dateDebut, dateFin) > MAX_JOURS_CALENDRIER) {
    throw new ErreurMetier(`Période trop longue (${MAX_JOURS_CALENDRIER} jours maximum)`, 400);
  }
  const estChef = utilisateur.fonction === ROLES.CHEF;
  const [agents, conges] = await Promise.all([
    Personnel.findByUnite(utilisateur.numeroUnite),
    Conge.pourCalendrier(utilisateur.numeroUnite, dateDebut, dateFin,
      estChef ? ['Validé', 'En attente', 'En pause', 'Repris'] : ['Validé', 'En pause', 'Repris']),
  ]);
  return {
    agents,
    conges: conges.map((c) => ({
      ...c,
      type: estChef || c.matricule === utilisateur.matricule ? c.type : null,
    })),
  };
}

module.exports = {
  personnelsUnite, mesDemandes, demander, annuler, creerDirectement, reprendre,
  lister, nombreEnAttente, decider, calendrier,
};
