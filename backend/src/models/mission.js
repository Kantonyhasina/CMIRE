// Entity : Mission (et ses intervenants : table mission_intervenant)
const db = require('../config/db');

const SELECTION = `SELECT m.numero_mission AS "numeroMission",
                          m.date_debut_mission AS "dateDebut", m.date_fin_mission AS "dateFin",
                          m.trimestre, m.annee_mission AS annee,
                          m.numero_station AS "numeroStation", st.nom_station AS "nomStation"
                     FROM mission m
                     JOIN station st ON st.numero_station = m.numero_station`;

async function findById(numeroMission) {
  const { rows } = await db.query(`${SELECTION} WHERE m.numero_mission = $1`, [numeroMission]);
  return rows[0] || null;
}

async function findByTrimestre(annee, trimestre) {
  const { rows } = await db.query(
    `${SELECTION}
      WHERE m.annee_mission = $1 AND m.trimestre = $2
      ORDER BY m.date_debut_mission, m.numero_mission`,
    [annee, trimestre]
  );
  return rows;
}

async function creer({ numeroStation, dateDebut, dateFin, trimestre, annee }) {
  const { rows } = await db.query(
    `INSERT INTO mission (numero_station, date_debut_mission, date_fin_mission, trimestre, annee_mission)
     VALUES ($1, $2::date, $3::date, $4, $5)
     RETURNING numero_mission`,
    [numeroStation, dateDebut, dateFin, trimestre, annee]
  );
  return findById(rows[0].numero_mission);
}

async function modifier(numeroMission, { numeroStation, dateDebut, dateFin, trimestre, annee }) {
  await db.query(
    `UPDATE mission
        SET numero_station = $2, date_debut_mission = $3::date, date_fin_mission = $4::date,
            trimestre = $5, annee_mission = $6
      WHERE numero_mission = $1`,
    [numeroMission, numeroStation, dateDebut, dateFin, trimestre, annee]
  );
  return findById(numeroMission);
}

async function supprimer(numeroMission) {
  await db.query('DELETE FROM mission WHERE numero_mission = $1', [numeroMission]);
}

async function intervenantsDe(numerosMissions) {
  const { rows } = await db.query(
    `SELECT mi.numero_mission AS "numeroMission", p.matricule, p.nom, p.prenom, p.fonction,
            p.numero_unite AS "numeroUnite", u.nom_unite AS "nomUnite"
       FROM mission_intervenant mi
       JOIN personnel p ON p.matricule = mi.matricule
       JOIN unite u ON u.numero_unite = p.numero_unite
      WHERE mi.numero_mission = ANY($1::int[])
      ORDER BY p.numero_unite, p.nom, p.prenom`,
    [numerosMissions]
  );
  return rows;
}

// Nombre d'intervenants d'AUTRES unités que celle donnée
async function compterAutresUnites(numeroMission, numeroUnite) {
  const { rows } = await db.query(
    `SELECT count(*)::int AS nombre
       FROM mission_intervenant mi JOIN personnel p ON p.matricule = mi.matricule
      WHERE mi.numero_mission = $1 AND p.numero_unite <> $2`,
    [numeroMission, numeroUnite]
  );
  return rows[0].nombre;
}

// Remplace les intervenants d'UNE unité (ceux des autres unités ne sont pas touchés)
async function remplacerIntervenantsUnite(numeroMission, numeroUnite, matricules, client) {
  await client.query(
    `DELETE FROM mission_intervenant mi
      USING personnel p
      WHERE mi.matricule = p.matricule
        AND p.numero_unite = $2
        AND mi.numero_mission = $1`,
    [numeroMission, numeroUnite]
  );
  if (matricules.length === 0) return;
  await client.query(
    `INSERT INTO mission_intervenant (numero_mission, matricule)
     SELECT $1::int, m FROM unnest($2::text[]) AS m`,
    [numeroMission, matricules]
  );
}

module.exports = {
  findById, findByTrimestre, creer, modifier, supprimer,
  intervenantsDe, compterAutresUnites, remplacerIntervenantsUnite,
};
