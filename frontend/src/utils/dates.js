// Dates manipulées en texte AAAA-MM-JJ (jamais via toISOString : décalage de fuseau horaire)
function formater(d) {
  const mois = String(d.getMonth() + 1).padStart(2, '0');
  const jour = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mois}-${jour}`;
}

// Lundi et dimanche de la semaine contenant la date donnée
export function semaineCourante(reference = new Date()) {
  const decalage = (reference.getDay() + 6) % 7; // lundi = 0 ... dimanche = 6
  const lundi = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate() - decalage);
  const dimanche = new Date(lundi.getFullYear(), lundi.getMonth(), lundi.getDate() + 6);
  return [formater(lundi), formater(dimanche)];
}

export function formaterDateFr(iso) {
  const [annee, mois, jour] = iso.split('-');
  return `${jour}/${mois}/${annee}`;
}

export function ajouterJours(iso, nombre) {
  const [annee, mois, jour] = iso.split('-').map(Number);
  return formater(new Date(annee, mois - 1, jour + nombre));
}

// Lundi de la semaine contenant la date donnée
export function lundiDe(iso) {
  const [annee, mois, jour] = iso.split('-').map(Number);
  return semaineCourante(new Date(annee, mois - 1, jour))[0];
}

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août',
  'septembre', 'octobre', 'novembre', 'décembre'];

// Un mois est représenté par 'AAAA-MM'
export function moisCourant(reference = new Date()) {
  return `${reference.getFullYear()}-${String(reference.getMonth() + 1).padStart(2, '0')}`;
}

export function ajouterMois(mois, nombre) {
  const [annee, m] = mois.split('-').map(Number);
  return moisCourant(new Date(annee, m - 1 + nombre, 1));
}

export function nomMois(mois) {
  return `${MOIS[Number(mois.slice(5, 7)) - 1]} ${mois.slice(0, 4)}`;
}

// Tous les jours du mois, au format AAAA-MM-JJ
export function joursDuMois(mois) {
  const [annee, m] = mois.split('-').map(Number);
  const nombre = new Date(annee, m, 0).getDate();
  return Array.from({ length: nombre }, (_, i) => formater(new Date(annee, m - 1, i + 1)));
}

export function bornesDuMois(mois) {
  const jours = joursDuMois(mois);
  return [jours[0], jours[jours.length - 1]];
}

// Trimestre civil (1 à 4) d'une date
export function trimestreDe(reference = new Date()) {
  return { trimestre: Math.floor(reference.getMonth() / 3) + 1, annee: reference.getFullYear() };
}

export function formaterPeriode(debut, fin) {
  return debut === fin ? formaterDateFr(debut) : `du ${formaterDateFr(debut)} au ${formaterDateFr(fin)}`;
}
