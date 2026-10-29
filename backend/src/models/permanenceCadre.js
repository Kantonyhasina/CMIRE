// Entity : PermanenceCadre
const db = require('../config/db');

async function findBySemaineEtUnite(numeroSemaine, numeroUnite) {
  const { rows } = await db.query(
    `SELECT pc.matricule, pc.jour_permc AS jour, pc.creneau
       FROM permanence_cadre pc
       JOIN personnel p ON p.matricule = pc.matricule
      WHERE pc.numero_semaine = $1 AND p.numero_unite = $2
      ORDER BY pc.id_permc`,
    [numeroSemaine, numeroUnite]
  );
  return rows;
}

// Toutes unités confondues (tableau complet du service)
async function findBySemaine(numeroSemaine) {
  const { rows } = await db.query(
    `SELECT matricule, jour_permc AS jour, creneau
       FROM permanence_cadre
      WHERE numero_semaine = $1`,
    [numeroSemaine]
  );
  return rows;
}

async function findByAgent(numeroSemaine, matricule) {
  const { rows } = await db.query(
    `SELECT jour_permc AS jour, creneau AS horaire
       FROM permanence_cadre
      WHERE numero_semaine = $1 AND matricule = $2`,
    [numeroSemaine, matricule]
  );
  return rows;
}

// Remplace le planning des cadres d'UNE unité pour la semaine (les autres unités sont intactes)
async function remplacer(numeroSemaine, numeroUnite, affectations, client) {
  await client.query(
    `DELETE FROM permanence_cadre pc
      USING personnel p
      WHERE pc.matricule = p.matricule
        AND p.numero_unite = $2
        AND pc.numero_semaine = $1`,
    [numeroSemaine, numeroUnite]
  );
  if (affectations.length === 0) return;
  await client.query(
    `INSERT INTO permanence_cadre (jour_permc, creneau, numero_semaine, matricule)
     SELECT t.jour, t.creneau, $1::int, t.matricule
       FROM unnest($2::text[], $3::text[], $4::text[]) AS t(jour, creneau, matricule)`,
    [
      numeroSemaine,
      affectations.map((a) => a.jour),
      affectations.map((a) => a.creneau),
      affectations.map((a) => a.matricule),
    ]
  );
}

module.exports = { findBySemaineEtUnite, findBySemaine, findByAgent, remplacer };
