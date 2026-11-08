// Entity : PermanenceSurveillant
const db = require('../config/db');

async function findBySemaine(numeroSemaine) {
  const { rows } = await db.query(
    `SELECT numero_poste AS "numeroPoste", jour_perms AS jour,
            plage_horaire AS plage, matricule,
            designation_speciale AS "designationSpeciale"
       FROM permanence_surveillant
      WHERE numero_semaine = $1
      ORDER BY id_perms`,
    [numeroSemaine]
  );
  return rows;
}

async function findByAgent(numeroSemaine, matricule) {
  const { rows } = await db.query(
    `SELECT ps.jour_perms AS jour, ps.plage_horaire AS horaire, po.nom_poste AS poste
       FROM permanence_surveillant ps
       JOIN poste po ON po.numero_poste = ps.numero_poste
      WHERE ps.numero_semaine = $1 AND ps.matricule = $2`,
    [numeroSemaine, matricule]
  );
  return rows;
}

// Remplace tout le tableau des surveillants de la semaine.
// Une case contient soit un matricule, soit un libellé spécial (TECH ELB / TECH CNS).
async function remplacer(numeroSemaine, affectations, client) {
  await client.query('DELETE FROM permanence_surveillant WHERE numero_semaine = $1', [numeroSemaine]);
  if (affectations.length === 0) return;

  await client.query(
    `INSERT INTO permanence_surveillant
       (numero_semaine, numero_poste, jour_perms, plage_horaire, matricule, designation_speciale)
     SELECT $1::int, t.poste, t.jour, t.plage, t.matricule, t.designation
       FROM unnest($2::int[], $3::text[], $4::text[], $5::text[], $6::text[])
         AS t(poste, jour, plage, matricule, designation)`,
    [
      numeroSemaine,
      affectations.map((a) => a.numeroPoste),
      affectations.map((a) => a.jour),
      affectations.map((a) => a.plage),
      affectations.map((a) => a.matricule || null),
      affectations.map((a) => a.designationSpeciale || null),
    ]
  );
}

module.exports = { findBySemaine, findByAgent, remplacer };
