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
            GREATEST(COALESCE(c.date_debut_conge, (c.created_at AT TIME ZONE 'Indian/Antananarivo')::date), $1::date) AS "dateDebut",
            COALESCE(c.date_fin_conge, CASE WHEN c.date_reprise IS NOT NULL THEN c.date_reprise - 1 ELSE $2::date END) AS "dateFin"
       FROM conge c
       JOIN personnel p ON p.matricule = c.matricule
      WHERE c.statut IN ('Validé', 'En pause')
        AND COALESCE(c.date_debut_conge, (c.created_at AT TIME ZONE 'Indian/Antananarivo')::date) <= $2::date
        AND (c.date_fin_conge IS NULL OR c.date_fin_conge >= $1::date)
        AND (c.date_reprise IS NULL OR c.date_reprise > $1::date)
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
            GREATEST(COALESCE(date_debut_conge, (created_at AT TIME ZONE 'Indian/Antananarivo')::date), $2::date) AS "dateDebut",
            COALESCE(date_fin_conge, CASE WHEN date_reprise IS NOT NULL THEN date_reprise - 1 ELSE $3::date END) AS "dateFin"
       FROM conge
      WHERE matricule = $1
        AND statut IN ('En attente', 'Validé', 'En pause')
        AND COALESCE(date_debut_conge, (created_at AT TIME ZONE 'Indian/Antananarivo')::date) <= $3::date
        AND (date_fin_conge IS NULL OR date_fin_conge >= $2::date)
        AND (date_reprise IS NULL OR date_reprise > $2::date)
      ORDER BY date_debut_conge`,
    [matricule, debut, fin]
  );
  return rows;
}

module.exports = { missionsDeLaPeriode, congesDeLaPeriode, missionsDeLAgent, congesDeLAgent };
