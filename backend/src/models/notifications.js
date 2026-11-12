const db = require('../config/db');
const { ROLES } = require('../config/roles');

async function compterPlanning(matricule, fonction, depuis) {
  if ([ROLES.CHEF, ROLES.CADRE].includes(fonction)) {
    const { rows } = await db.query(
      `SELECT COUNT(*)::int AS nouveau
         FROM permanence_cadre pc
         JOIN semaine s ON s.numero_semaine = pc.numero_semaine
        WHERE pc.matricule = $1
          AND pc.created_at > $2::timestamptz
          AND s.date_fin >= (NOW() AT TIME ZONE 'Indian/Antananarivo')::date`,
      [matricule, depuis]
    );
    return rows[0].nouveau;
  }

  if (fonction === ROLES.SURVEILLANT) {
    const { rows } = await db.query(
      `SELECT COUNT(*)::int AS nouveau
         FROM permanence_surveillant ps
         JOIN semaine s ON s.numero_semaine = ps.numero_semaine
        WHERE ps.matricule = $1
          AND ps.created_at > $2::timestamptz
          AND s.date_fin >= (NOW() AT TIME ZONE 'Indian/Antananarivo')::date`,
      [matricule, depuis]
    );
    return rows[0].nouveau;
  }

  return 0;
}

async function compterMissions(matricule, depuis) {
  const { rows } = await db.query(
    `SELECT COUNT(DISTINCT mi.numero_mission)::int AS nouveau
       FROM mission_intervenant mi
       JOIN mission m ON m.numero_mission = mi.numero_mission
      WHERE mi.matricule = $1
        AND m.date_fin_mission >= (NOW() AT TIME ZONE 'Indian/Antananarivo')::date
        AND (
          mi.created_at > $2::timestamptz
          OR m.updated_at > $2::timestamptz
        )`,
    [matricule, depuis]
  );
  return rows[0].nouveau;
}

async function compterCongesAgent(matricule, depuis) {
  const { rows } = await db.query(
    `SELECT COUNT(*)::int AS nouveau
       FROM conge c
      WHERE c.matricule = $1
        AND c.statut IN ('Validé', 'Refusé', 'En pause', 'Repris')
        AND COALESCE(c.updated_at, c.created_at) > $2::timestamptz
        AND (c.updated_at IS NOT NULL OR c.date_fin_conge IS NULL OR c.date_fin_conge >= (NOW() AT TIME ZONE 'Indian/Antananarivo')::date)`,
    [matricule, depuis]
  );
  return rows[0].nouveau;
}

async function compterDemandesCongesChef(numeroUnite, depuis) {
  const { rows } = await db.query(
    `SELECT COUNT(*)::int AS nouveau
       FROM conge c
       JOIN personnel p ON p.matricule = c.matricule
      WHERE p.numero_unite = $1
        AND c.statut = 'En attente'
        AND c.created_at > $2::timestamptz`,
    [numeroUnite, depuis]
  );
  return rows[0].nouveau;
}

module.exports = {
  compterPlanning,
  compterMissions,
  compterCongesAgent,
  compterDemandesCongesChef,
};
