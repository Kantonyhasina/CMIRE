// Control : DisponibiliteService
// Règles RG1/RG2 : un personnel est INDISPONIBLE sur une période s'il a, sur cette période,
// un congé validé, une mission ou une permanence.
//
// Option { ignorer: [...] } : sources à ne pas contrôler. Exemple : quand on planifie une
// permanence, les autres permanences du même agent ne sont pas un conflit (un cadre peut avoir
// plusieurs créneaux) -> on appelle avec { ignorer: ['permanence'] }.
const Conflits = require('../models/conflits');
const { validerPeriode } = require('../utils/dates');
const { ErreurMetier } = require('../utils/erreurs');

const SOURCES = {
  conge: Conflits.conges,
  mission: Conflits.missions,
  permanence: Conflits.permanences,
};

async function verifierDisponibilite(matricules, dateDebut, dateFin, { ignorer = [] } = {}) {
  validerPeriode(dateDebut, dateFin);

  const inconnues = ignorer.filter((type) => !SOURCES[type]);
  if (inconnues.length > 0) {
    throw new ErreurMetier(
      `Source inconnue : ${inconnues.join(', ')} (valeurs possibles : ${Object.keys(SOURCES).join(', ')})`, 400);
  }

  const types = Object.keys(SOURCES).filter((type) => !ignorer.includes(type));
  const lots = await Promise.all(
    types.map(async (type) => {
      const lignes = await SOURCES[type](matricules, dateDebut, dateFin);
      return lignes.map((l) => ({
        matricule: l.matricule,
        type,
        dateDebut: l.date_debut,
        dateFin: l.date_fin,
        detail: l.detail,
      }));
    })
  );

  const conflitsParMatricule = new Map(matricules.map((m) => [m, []]));
  for (const conflit of lots.flat()) {
    const { matricule, ...reste } = conflit;
    conflitsParMatricule.get(matricule).push(reste);
  }

  return matricules.map((matricule) => {
    const conflits = conflitsParMatricule.get(matricule);
    return { matricule, disponible: conflits.length === 0, conflits };
  });
}

module.exports = { verifierDisponibilite };
