// Entity (lecture) : ce qui peut rendre un personnel indisponible sur une période.
const db = require('../config/db');
const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

// Les congés validés et pauses actives bloquent les affectations. Une pause sans dates
// reste active jusqu'à la date de reprise (qui est le premier jour de retour).
async function conges(matricules, debut, fin) {
  const { rows } = await db.query(
    `SELECT matricule,
            GREATEST(COALESCE(date_debut_conge, (created_at AT TIME ZONE 'Indian/Antananarivo')::date), $2::date) AS date_debut,
            COALESCE(date_fin_conge,
                     CASE WHEN date_reprise IS NOT NULL THEN date_reprise - 1 ELSE $3::date END) AS date_fin,
            'Congé : ' || type AS detail
       FROM conge
      WHERE matricule = ANY($1)
        AND statut IN ('Validé', 'En pause')
        AND COALESCE(date_debut_conge, (created_at AT TIME ZONE 'Indian/Antananarivo')::date) <= $3::date
        AND (date_fin_conge IS NULL OR date_fin_conge >= $2::date)
        AND (date_reprise IS NULL OR date_reprise > $2::date)`,
    [matricules, debut, fin]
  );
  return rows;
}

async function missions(matricules, debut, fin, { exclureMission = null } = {}) {
  const { rows } = await db.query(
    `SELECT mi.matricule,
            m.date_debut_mission AS date_debut,
            m.date_fin_mission   AS date_fin,
            'Mission : ' || st.nom_station AS detail
       FROM mission_intervenant mi
       JOIN mission m  ON m.numero_mission  = mi.numero_mission
       JOIN station st ON st.numero_station = m.numero_station
      WHERE mi.matricule = ANY($1)
        AND m.date_debut_mission <= $3::date
        AND m.date_fin_mission   >= $2::date
        AND ($4::int IS NULL OR m.numero_mission <> $4::int)`,
    [matricules, debut, fin, exclureMission]
  );
  return rows;
}

async function permanences(matricules, debut, fin) {
  const { rows } = await db.query(
    `SELECT matricule, date_perm AS date_debut, date_perm AS date_fin, detail
       FROM (
             SELECT pc.matricule,
                    s.date_debut + (array_position($4::text[], pc.jour_permc::text) - 1) AS date_perm,
                    'Permanence cadre (' || pc.creneau || ')' AS detail
               FROM permanence_cadre pc
               JOIN semaine s ON s.numero_semaine = pc.numero_semaine
              WHERE pc.matricule = ANY($1)
             UNION ALL
             SELECT ps.matricule,
                    s.date_debut + (array_position($4::text[], ps.jour_perms::text) - 1),
                    'Permanence surveillant (' || ps.plage_horaire || ')'
               FROM permanence_surveillant ps
               JOIN semaine s ON s.numero_semaine = ps.numero_semaine
              WHERE ps.matricule = ANY($1)
            ) t
      WHERE date_perm BETWEEN $2::date AND $3::date
      ORDER BY date_perm`,
    [matricules, debut, fin, JOURS]
  );
  return rows;
}

module.exports = { conges, missions, permanences };
