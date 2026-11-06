const db = require('../config/db');

async function missionsDeLaPeriode(debut, fin) {
  const { rows } = await db.query(
    `SELECT st.nom_station AS station,
            m.date_debut_mission AS "dateDebut",
            m.date_fin_mission   AS "dateFin"
       FROM mission m
       JOIN station st ON st.numero_station = m.numero_station
      WHERE m.date_debut_mission <= $2::date AND m.date_fin_mission >= $1::date
      ORDER BY m.date_debut_mission, st.nom_station`,
    [debut, fin]
  );
  return rows;
}

async function congesDeLaPeriode(debut, fin) {
  const { rows } = await db.query(
    `SELECT p.nom, p.prenom, c.type,
            c.date_debut_conge AS "dateDebut",
            c.date_fin_conge   AS "dateFin"
       FROM conge c
       JOIN personnel p ON p.matricule = c.matricule
      WHERE c.statut = 'Validé'
        AND c.date_debut_conge <= $2::date AND c.date_fin_conge >= $1::date
      ORDER BY p.nom, p.prenom`,
    [debut, fin]
  );
  return rows;
}

async function missionsDeLAgent(matricule, debut, fin) {
  const { rows } = await db.query(
    `SELECT st.nom_station AS station,
            m.date_debut_mission AS "dateDebut",
            m.date_fin_mission   AS "dateFin"
       FROM mission_intervenant mi
       JOIN mission m  ON m.numero_mission  = mi.numero_mission
       JOIN station st ON st.numero_station = m.numero_station
      WHERE mi.matricule = $1
        AND m.date_debut_mission <= $3::date AND m.date_fin_mission >= $2::date
      ORDER BY m.date_debut_mission`,
    [matricule, debut, fin]
  );
  return rows;
}

async function congesDeLAgent(matricule, debut, fin) {
  const { rows } = await db.query(
    `SELECT type, statut,
            date_debut_conge AS "dateDebut",
            date_fin_conge   AS "dateFin"
       FROM conge
      WHERE matricule = $1
        AND statut IN ('En attente', 'Validé')
        AND date_debut_conge <= $3::date AND date_fin_conge >= $2::date
      ORDER BY date_debut_conge`,
    [matricule, debut, fin]
  );
  return rows;
}

module.exports = { missionsDeLaPeriode, congesDeLaPeriode, missionsDeLAgent, congesDeLAgent };
