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
