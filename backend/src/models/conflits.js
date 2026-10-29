// Entity (lecture) : ce qui peut rendre un personnel indisponible sur une période.
// Chaque fonction reçoit une liste de matricules et une période [debut, fin] (dates incluses).
const db = require('../config/db');

const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

// Congés VALIDÉS uniquement : une demande « En attente » ou « Refusé » ne bloque rien.
async function conges(matricules, debut, fin) {
  const { rows } = await db.query(
    `SELECT matricule,
            date_debut_conge AS date_debut,
            date_fin_conge   AS date_fin,
            'Congé : ' || type AS detail
       FROM conge
      WHERE matricule = ANY($1)
        AND statut = 'Validé'
        AND date_debut_conge <= $3::date
        AND date_fin_conge   >= $2::date`,
    [matricules, debut, fin]
  );
  return rows;
}

async function missions(matricules, debut, fin) {
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
        AND m.date_fin_mission   >= $2::date`,
    [matricules, debut, fin]
  );
  return rows;
}

// La date exacte d'une permanence = début de la semaine + rang du jour (Lundi = +0 ... Dimanche = +6)
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
