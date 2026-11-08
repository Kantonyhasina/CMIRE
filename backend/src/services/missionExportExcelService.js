// Export annuel du planning d'entretien systématique (4 tableaux trimestriels).
const ExcelJS = require('exceljs');
const Mission = require('../models/mission');
const Station = require('../models/station');

const ORDRE_STATIONS = [
  'ANTSIRANANA', 'NOSY BE', 'ANTALAHA', 'MAINTIRANO', 'MANANJARY',
  'MORONDAVA', 'TOLIARY', 'TOLAGNARO', 'MORONI',
];
const UNITES = ['CNS', 'RSI', 'ELB'];
const TRAIT = { style: 'thin', color: { argb: 'FF9CA3AF' } };
const BORDURES = { top: TRAIT, left: TRAIT, bottom: TRAIT, right: TRAIT };
const VERT = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC6EFCE' } };
const ENTETE = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E2F3' } };
const BANDEAU = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB4C7E7' } };
const GRIS = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };

function normaliser(valeur) {
  return String(valeur || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleUpperCase();
}

function formaterDate(iso) {
  if (!iso) return '';
  const [annee, mois, jour] = iso.split('-');
  return `${jour}/${mois}/${annee}`;
}

function aujourdhuiISO() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Indian/Antananarivo' }).format(new Date());
}

function ordonnerStations(stations) {
  return [...stations].sort((a, b) => {
    const nomA = normaliser(a.nom_station);
    const nomB = normaliser(b.nom_station);
    const rangA = ORDRE_STATIONS.indexOf(nomA);
    const rangB = ORDRE_STATIONS.indexOf(nomB);
    if (rangA !== -1 || rangB !== -1) {
      return (rangA === -1 ? 999 : rangA) - (rangB === -1 ? 999 : rangB);
    }
    return nomA.localeCompare(nomB);
  });
}

function valeurIntervenant(mission, codeUnite) {
  const agent = mission.intervenants.find((i) => normaliser(i.nomUnite).includes(codeUnite));
  return agent ? (agent.identifiant || `${agent.prenom} ${agent.nom}`) : '';
}

function styliserCellule(cell, { bold = false, fill = null, align = 'center', fontSize = 9 } = {}) {
  cell.font = { name: 'Arial', size: fontSize, bold };
  cell.alignment = { horizontal: align, vertical: 'middle', wrapText: true };
  cell.border = BORDURES;
  if (fill) cell.fill = fill;
}

function ecrireTableau(feuille, trimestre, ligneDebut, colonneDebut, stations, missionsParStation, dateVerrouillage) {
  const colonnes = ['Station', 'Période prévue', ...UNITES];
  const finColonne = colonneDebut + colonnes.length - 1;

  feuille.mergeCells(ligneDebut, colonneDebut, ligneDebut, finColonne);
  const titre = feuille.getCell(ligneDebut, colonneDebut);
  titre.value = `TRIMESTRE ${trimestre}`;
  styliserCellule(titre, { bold: true, fill: BANDEAU, fontSize: 11 });
  for (let c = colonneDebut; c <= finColonne; c += 1) {
    feuille.getCell(ligneDebut, c).fill = BANDEAU;
    feuille.getCell(ligneDebut, c).border = BORDURES;
  }
  feuille.getRow(ligneDebut).height = 22;

  colonnes.forEach((nom, index) => {
    const cell = feuille.getCell(ligneDebut + 1, colonneDebut + index);
    cell.value = nom;
    styliserCellule(cell, { bold: true, fill: ENTETE, fontSize: 9 });
  });
  feuille.getRow(ligneDebut + 1).height = 24;

  stations.forEach((station, index) => {
    const rowIndex = ligneDebut + 2 + index;
    const mission = missionsParStation.get(station.numero_station);
    const demarree = Boolean(mission && mission.dateDebut <= dateVerrouillage);
    const fill = demarree ? VERT : (index % 2 === 0 ? null : GRIS);
    const valeurs = [
      station.nom_station,
      mission ? `du ${formaterDate(mission.dateDebut)} au ${formaterDate(mission.dateFin)}` : '',
      ...(mission ? UNITES.map((code) => valeurIntervenant(mission, code)) : ['', '', '']),
    ];

    valeurs.forEach((valeur, colIndex) => {
      const cell = feuille.getCell(rowIndex, colonneDebut + colIndex);
      cell.value = valeur;
      styliserCellule(cell, { fill, align: colIndex === 0 ? 'left' : 'center' });
    });
    feuille.getRow(rowIndex).height = 21;
  });
}

async function generer(annee) {
  const [stationsBrutes, missionsBrutes] = await Promise.all([
    Station.findAll(),
    Mission.findByAnnee(annee),
  ]);
  const intervenants = missionsBrutes.length > 0
    ? await Mission.intervenantsDe(missionsBrutes.map((m) => m.numeroMission))
    : [];
  const missions = missionsBrutes.map((m) => ({
    ...m,
    intervenants: intervenants.filter((i) => i.numeroMission === m.numeroMission),
  }));
  const stations = ordonnerStations(stationsBrutes);
  const dateVerrouillage = aujourdhuiISO();

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'CMIRE';
  workbook.subject = `Planning annuel des missions ${annee}`;
  workbook.created = new Date();
  const feuille = workbook.addWorksheet('Planning annuel', {
    pageSetup: {
      paperSize: 8,
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 1,
      horizontalCentered: true,
      margins: { left: 0.25, right: 0.25, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
    },
    views: [{ showGridLines: false }],
  });

  for (let col = 1; col <= 11; col += 1) {
    if (col === 1 || col === 7) feuille.getColumn(col).width = 23;
    else if (col === 2 || col === 8) feuille.getColumn(col).width = 26;
    else if (col === 6) feuille.getColumn(col).width = 3;
    else feuille.getColumn(col).width = 12;
  }

  feuille.mergeCells('A1:K1');
  feuille.getCell('A1').value = `PLANNING ENTRETIEN SYSTÉMATIQUE VHF DÉPORTÉE ${annee}`;
  feuille.getCell('A1').font = { name: 'Arial', size: 16, bold: true };
  feuille.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
  feuille.getRow(1).height = 30;
  feuille.mergeCells('A2:K2');
  feuille.getCell('A2').value = 'Intervenants : un seul cadre ou chef de service par unité (CNS, RSI, ELB)';
  feuille.getCell('A2').font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF475569' } };
  feuille.getCell('A2').alignment = { horizontal: 'center' };

  const ecart = Math.max(stations.length, 9) + 5;
  const ligneHaut = 4;
  const ligneBas = ligneHaut + ecart;
  for (const trimestre of [1, 2, 3, 4]) {
    const missionsParStation = new Map(
      missions.filter((m) => m.trimestre === trimestre).map((m) => [m.numeroStation, m])
    );
    const ligne = trimestre === 1 || trimestre === 3 ? ligneHaut : ligneBas;
    const colonne = trimestre === 1 || trimestre === 2 ? 1 : 7;
    ecrireTableau(feuille, trimestre, ligne, colonne, stations, missionsParStation, dateVerrouillage);
  }

  const derniereLigne = ligneBas + 2 + stations.length + 1;
  feuille.mergeCells(derniereLigne, 1, derniereLigne, 11);
  const legende = feuille.getCell(derniereLigne, 1);
  legende.value = `Vert : mission commencée ou arrivée à sa date de début (verrouillée au ${formaterDate(dateVerrouillage)}).`;
  legende.font = { name: 'Arial', size: 8, italic: true };
  legende.alignment = { horizontal: 'left' };

  const buffer = await workbook.xlsx.writeBuffer();
  return {
    buffer: Buffer.from(buffer),
    nomFichier: `planning_missions_${annee}.xlsx`,
  };
}

module.exports = { generer };
