const { ErreurMetier } = require('./erreurs');

const FORMAT = /^\d{4}-\d{2}-\d{2}$/;

function dateValide(texte) {
  if (typeof texte !== 'string' || !FORMAT.test(texte)) return false;
  const d = new Date(`${texte}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === texte;
}

function validerPeriode(dateDebut, dateFin) {
  if (!dateValide(dateDebut) || !dateValide(dateFin)) {
    throw new ErreurMetier('Dates invalides (format attendu : AAAA-MM-JJ)', 400);
  }
  if (dateDebut > dateFin) {
    throw new ErreurMetier('La date de fin doit être postérieure ou égale à la date de début', 400);
  }
}

module.exports = { dateValide, validerPeriode };

function ajouterJours(iso, nombre) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + nombre);
  return d.toISOString().slice(0, 10);
}

// Lundi de la semaine contenant la date donnée (semaine = lundi -> dimanche)
function lundiDeLaSemaine(iso) {
  const decalage = (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7;
  return ajouterJours(iso, -decalage);
}

function formaterDateFr(iso) {
  const [annee, mois, jour] = iso.split('-');
  return `${jour}/${mois}/${annee}`;
}

function exigerDate(valeur) {
  if (!dateValide(valeur)) {
    throw new ErreurMetier('Date invalide (format attendu : AAAA-MM-JJ)', 400);
  }
  return valeur;
}

module.exports = {
  ...module.exports,
  ajouterJours,
  lundiDeLaSemaine,
  formaterDateFr,
  exigerDate,
};
