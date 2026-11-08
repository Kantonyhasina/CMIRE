// Control : cas « Générer le tableau de permanence »
// Produit un classeur Excel de 2 feuilles qui reprend les tableaux papier du service :
//   feuille 1 = tableau des quarts et permanences techniques (chef + cadres), feuille 2 = surveillants.
const ExcelJS = require('exceljs');
const Semaine = require('../models/semaine');
const Personnel = require('../models/personnel');
const Poste = require('../models/poste');
const Unite = require('../models/unite');
const PermanenceCadre = require('../models/permanenceCadre');
const PermanenceSurveillant = require('../models/permanenceSurveillant');
const Agenda = require('../models/agenda');
const { ROLES } = require('../config/roles');
const { JOURS, CRENEAUX_CADRE, PLAGES_SURVEILLANT } = require('../config/permanences');
const { lundiDeLaSemaine, ajouterJours, formaterDateFr } = require('../utils/dates');

const DESTINATAIRES = ['Station terrienne', 'Centre Emission', 'Centrale Ivato', 'Centrale Antanetibe',
  'Atelier TTY', 'BNI', 'CRD', 'CAT', 'Archive'];
const GRIS = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
const TRAIT = { style: 'thin', color: { argb: 'FF000000' } };
const BORDURES = { top: TRAIT, left: TRAIT, bottom: TRAIT, right: TRAIT };
const jourMois = (iso) => formaterDateFr(iso).slice(0, 5);
const estHospitalisation = (type) => /hospital/i.test(type);

// ---------- Collecte des données ----------

async function rassemblerDonnees(date) {
  const semaine = await Semaine.decrire(lundiDeLaSemaine(date));
  const [unites, cadres, postes, surveillants, missions, conges] = await Promise.all([
    Unite.findAll(),
    Personnel.findCadresEtChefs(),
    Poste.findAll(),
    Personnel.findByFonction(ROLES.SURVEILLANT),
    Agenda.missionsDeLaPeriode(semaine.dateDebut, semaine.dateFin),
    Agenda.congesDeLaPeriode(semaine.dateDebut, semaine.dateFin),
  ]);
  const [affCadres, affSurveillants] = semaine.numeroSemaine
    ? await Promise.all([
        PermanenceCadre.findBySemaine(semaine.numeroSemaine),
        PermanenceSurveillant.findBySemaine(semaine.numeroSemaine),
      ])
    : [[], []];

  return {
    semaine, cadres, surveillants, affCadres, affSurveillants, missions, conges,
    unites: unites.sort((a, b) => a.numero_unite - b.numero_unite),
    postes: postes.sort((a, b) => a.numero_poste - b.numero_poste),
  };
}

// ---------- Outils de mise en forme ----------

// Écrit dans la plage (l1,c1)->(l2,c2) : fusionne si besoin et applique style et bordures à TOUTES les cellules
function bloc(feuille, l1, c1, l2, c2, valeur, {
  gras = false, taille = 9, horizontal = 'center', vertical = 'middle',
  fond = null, bord = false, retour = false, souligne = false, retrait = 0,
} = {}) {
  if (l1 !== l2 || c1 !== c2) feuille.mergeCells(l1, c1, l2, c2);
  for (let l = l1; l <= l2; l += 1) {
    for (let c = c1; c <= c2; c += 1) {
      const cellule = feuille.getCell(l, c);
      if (fond) cellule.fill = fond;
      if (bord) cellule.border = BORDURES;
    }
  }
  const cellule = feuille.getCell(l1, c1);
  cellule.value = valeur === '' ? null : valeur; // case vide = vraiment vide (et non une chaîne vide)
  cellule.font = { name: 'Arial', size: taille, bold: gras, ...(souligne ? { underline: true } : {}) };
  cellule.alignment = { horizontal, vertical, wrapText: retour, indent: retrait };
}

const cellule = (feuille, l, c, valeur, options) => bloc(feuille, l, c, l, c, valeur, options);

function preparerFeuille(feuille) {
  feuille.views = [{ showGridLines: false }];
  feuille.pageSetup = {
    paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 1,
    horizontalCentered: true,
    margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
  };
}

const formaterPeriode = (debut, fin) =>
  debut === fin ? formaterDateFr(debut) : `du ${formaterDateFr(debut)} au ${formaterDateFr(fin)}`;

// ---------- Pied de feuille : destinataires, missions, congés, signature ----------

function piedDeFeuille(feuille, ligne, donnees, { milieu, signature, surveillants }) {
  const destinataires = surveillants
    ? [...DESTINATAIRES.slice(0, -1), 'Chauffeur', 'Archive']
    : DESTINATAIRES;

  cellule(feuille, ligne, 1, 'DESTINATAIRES:', { gras: true, taille: 9, horizontal: 'left', souligne: true });
  destinataires.forEach((d, i) => cellule(feuille, ligne + 1 + i, 1, d, { taille: 9, horizontal: 'left', retrait: 1 }));

  const [c1, c2] = milieu;
  let l = ligne;
  const titre = (texte) => { bloc(feuille, l, c1, l, c2, texte, { gras: true, taille: 9, horizontal: 'left', souligne: true }); l += 1; };
  const entree = (texte) => { bloc(feuille, l, c1, l, c2, texte, { taille: 9, horizontal: 'left', retrait: 1 }); l += 1; };

  const conges = surveillants ? donnees.conges.filter((c) => !estHospitalisation(c.type)) : donnees.conges;
  titre('Mission :');
  if (donnees.missions.length === 0) entree('—');
  donnees.missions.forEach((m) => entree(`${m.station} ${formaterPeriode(m.dateDebut, m.dateFin)}`));
  l += 1;
  titre('Congé :');
  if (conges.length === 0) entree('—');
  conges.forEach((c) => entree(`${c.nom} ${c.prenom} (${formaterPeriode(c.dateDebut, c.dateFin)})`));
  if (surveillants) {
    l += 1;
    titre('Hospitalisé :');
    const hospitalises = donnees.conges.filter((c) => estHospitalisation(c.type));
    if (hospitalises.length === 0) entree('—');
    hospitalises.forEach((c) => entree(`${c.nom} ${c.prenom} (${formaterPeriode(c.dateDebut, c.dateFin)})`));
  }

  bloc(feuille, ligne, signature[0], ligne + 1, signature[1], 'LE CHARGE DE MAINTENANCE\nIRE ET INFORMATIQUE',
    { gras: true, taille: 9, retour: true });
}

// ---------- Feuille 1 : cadres de maintenance ----------

function feuilleCadres(classeur, donnees) {
  const { semaine, unites, cadres, affCadres } = donnees;
  const feuille = classeur.addWorksheet('Permanences techniques');
  preparerFeuille(feuille);

  const PREMIERE = 2;                              // colonne B : premier créneau
  const nbCreneaux = JOURS.length * CRENEAUX_CADRE.length;
  const DERNIERE = PREMIERE + nbCreneaux - 1;      // colonne V : dernier créneau
  const TEL = DERNIERE + 1;                        // colonne W : N°TPH
  feuille.getColumn(1).width = 30;
  for (let c = PREMIERE; c <= DERNIERE; c += 1) feuille.getColumn(c).width = 4.7;
  feuille.getColumn(TEL).width = 16;

  // En-tête de l'institution (à gauche) et références de la semaine (à droite)
  ['ASECNA', 'REPRESENTATION DE MADAGASCAR', '***', 'SERVICE M.I.R.E', '***'].forEach((texte, i) =>
    cellule(feuille, 1 + i, 1, texte, { gras: true, taille: i === 1 || i === 2 || i === 4 ? 8 : 10, horizontal: 'left' }));
  const droite = (ligne, texte, taille) => bloc(feuille, ligne, 12, ligne, TEL, texte, { gras: true, taille, horizontal: 'right' });
  droite(1, `ANNEE :  ${semaine.annee}`, 13);
  droite(2, `${semaine.numeroIso}ème SEMAINE`, 13);
  droite(3, `Du ${formaterDateFr(semaine.dateDebut)} au ${formaterDateFr(semaine.dateFin)}`, 10);

  bloc(feuille, 7, 1, 7, TEL, 'TABLEAU DES QUARTS ET DES PERMANENCES TECHNIQUES', { gras: true, taille: 12 });
  feuille.getRow(7).height = 22;

  // En-tête du tableau : jours / horaires de début / horaires de fin
  const L1 = 9;
  feuille.getRow(L1).height = 28;
  cellule(feuille, L1, 1, 'DATES', { gras: true, bord: true });
  cellule(feuille, L1 + 1, 1, 'H O R A I R E S', { gras: true, taille: 8, horizontal: 'right', bord: true });
  cellule(feuille, L1 + 2, 1, 'NOM ET PRÉNOMS', { gras: true, taille: 9, horizontal: 'left', bord: true });
  JOURS.forEach((jour, i) => {
    const c = PREMIERE + i * CRENEAUX_CADRE.length;
    bloc(feuille, L1, c, L1, c + CRENEAUX_CADRE.length - 1,
      `${jour.toUpperCase()}\n${jourMois(ajouterJours(semaine.dateDebut, i))}`, { gras: true, taille: 8, retour: true, bord: true });
    CRENEAUX_CADRE.forEach((creneau, k) => {
      const [debut, fin] = creneau.split('-');
      cellule(feuille, L1 + 1, c + k, debut, { taille: 7, bord: true });
      cellule(feuille, L1 + 2, c + k, fin, { taille: 7, bord: true });
    });
  });
  bloc(feuille, L1, TEL, L1 + 2, TEL, 'N°TPH', { gras: true, bord: true });

  // Corps : une bande par unité, puis le chef de service en premier et les cadres
  const coches = new Set(affCadres.map((a) => `${a.matricule}|${a.jour}|${a.creneau}`));
  let ligne = L1 + 3;
  for (const unite of unites) {
    const agents = cadres.filter((c) => c.numeroUnite === unite.numero_unite);
    if (agents.length === 0) continue;
    bloc(feuille, ligne, 1, ligne, DERNIERE, `UNITE ${unite.nom_unite}`, { gras: true, taille: 10, fond: GRIS, bord: true });
    cellule(feuille, ligne, TEL, '', { fond: GRIS, bord: true });
    ligne += 1;
    for (const agent of agents) {
      feuille.getRow(ligne).height = 15;
      cellule(feuille, ligne, 1, `${agent.nom.toUpperCase()} ${agent.prenom}`, { horizontal: 'left', bord: true, retrait: 1 });
      JOURS.forEach((jour, i) => CRENEAUX_CADRE.forEach((creneau, k) => {
        const marque = coches.has(`${agent.matricule}|${jour}|${creneau}`) ? 'X' : '';
        cellule(feuille, ligne, PREMIERE + i * CRENEAUX_CADRE.length + k, marque, { gras: true, taille: 10, bord: true });
      }));
      cellule(feuille, ligne, TEL, agent.numeroTelephone || '', { bord: true });
      ligne += 1;
    }
  }

  piedDeFeuille(feuille, ligne + 2, donnees, { milieu: [2, 14], signature: [15, TEL], surveillants: false });
}

// ---------- Feuille 2 : surveillants ----------

function feuilleSurveillants(classeur, donnees) {
  const { semaine, postes, surveillants, affSurveillants } = donnees;
  const feuille = classeur.addWorksheet('Surveillants');
  preparerFeuille(feuille);

  feuille.getColumn(1).width = 26;
  for (let c = 2; c <= 1 + JOURS.length; c += 1) feuille.getColumn(c).width = 15;
  const DERNIERE = 1 + JOURS.length;

  // Deux surveillants de même prénom : on ajoute l'initiale du nom pour les distinguer
  const compte = new Map();
  surveillants.forEach((s) => compte.set(s.prenom, (compte.get(s.prenom) || 0) + 1));
  const affichage = new Map(surveillants.map((s) => [
    s.matricule,
    (compte.get(s.prenom) > 1 ? `${s.prenom} ${s.nom[0]}.` : s.prenom).toUpperCase(),
  ]));
  const occupant = new Map(affSurveillants.map((a) => [`${a.numeroPoste}|${a.jour}|${a.plage}`, a.designationSpeciale || a.matricule]));

  bloc(feuille, 1, 1, 1, DERNIERE, 'TABLEAU DE PERMANENCE - SURVEILLANTS', { gras: true, taille: 16 });
  feuille.getRow(1).height = 28;
  bloc(feuille, 2, 1, 2, DERNIERE, `ANNEE :  ${semaine.annee}`, { gras: true, taille: 11 });

  const L1 = 4;
  bloc(feuille, L1, 1, L1 + 1, 1, `SEMAINE  ${semaine.numeroIso}`, { gras: true, taille: 10, bord: true });
  JOURS.forEach((jour, i) => {
    cellule(feuille, L1, 2 + i, jour.toUpperCase(), { gras: true, taille: 9, bord: true });
    cellule(feuille, L1 + 1, 2 + i, jourMois(ajouterJours(semaine.dateDebut, i)), { gras: true, taille: 9, bord: true });
  });

  let ligne = L1 + 2;
  for (const poste of postes) {
    bloc(feuille, ligne, 1, ligne, DERNIERE, poste.nom_poste.toUpperCase(),
      { gras: true, taille: 10, horizontal: 'left', fond: GRIS, bord: true, retrait: 1 });
    ligne += 1;
    for (const plage of PLAGES_SURVEILLANT) {
      const [debut, fin] = plage.split('-');
      feuille.getRow(ligne).height = 18;
      cellule(feuille, ligne, 1, `De ${debut} à ${fin}`, { taille: 9, bord: true });
      JOURS.forEach((jour, i) => {
        const valeur = occupant.get(`${poste.numero_poste}|${jour}|${plage}`);
        const libelle = valeur ? (affichage.get(valeur) || valeur) : '';
        cellule(feuille, ligne, 2 + i, libelle, { taille: 9, bord: true });
      });
      ligne += 1;
    }
  }

  piedDeFeuille(feuille, ligne + 2, donnees, { milieu: [2, 5], signature: [6, DERNIERE], surveillants: true });
}

// ---------- Point d'entrée ----------

async function genererTableau(date) {
  const donnees = await rassemblerDonnees(date);
  const { semaine } = donnees;

  const classeur = new ExcelJS.Workbook();
  classeur.creator = 'CMIRE';
  classeur.title = `Tableau de permanence - semaine ${semaine.numeroIso} ${semaine.annee}`;
  feuilleCadres(classeur, donnees);
  feuilleSurveillants(classeur, donnees);

  return {
    buffer: Buffer.from(await classeur.xlsx.writeBuffer()),
    nomFichier: `tableau-permanence-S${semaine.numeroIso}-${semaine.annee}.xlsx`,
  };
}

module.exports = { genererTableau };
