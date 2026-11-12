const db = require('../config/db');
const { ROLES } = require('../config/roles');

const nombre = async (sql, params = []) => {
  const { rows } = await db.query(sql, params);
  return Number(rows[0]?.nombre ?? 0);
};

async function pourAdministrateur() {
  const [personnel, unites, stations, missions] = await Promise.all([
    db.query(`SELECT count(*) FILTER (WHERE actif = TRUE)::int AS actifs,
                     count(*) FILTER (WHERE actif = FALSE)::int AS inactifs
                FROM personnel`),
    nombre('SELECT count(*)::int AS nombre FROM unite'),
    nombre('SELECT count(*)::int AS nombre FROM station'),
    nombre(`SELECT count(*)::int AS nombre FROM mission
             WHERE annee_mission = EXTRACT(YEAR FROM CURRENT_DATE)::int`),
  ]);

  return {
    role: 'Administrateur',
    statistiques: [
      { libelle: 'Personnel actif', valeur: personnel.rows[0].actifs, detail: 'Comptes autorisés à se connecter', ton: 'bleu' },
      { libelle: 'Comptes désactivés', valeur: personnel.rows[0].inactifs, detail: 'Comptes conservés dans l’historique', ton: 'ambre' },
      { libelle: 'Unités', valeur: unites, detail: 'Unités référencées', ton: 'violet' },
      { libelle: 'Missions cette année', valeur: missions, detail: 'Missions enregistrées', ton: 'vert' },
      { libelle: 'Stations', valeur: stations, detail: 'Stations du référentiel', ton: 'gris' },
    ],
    message: 'Vue générale de l’administration et des ressources CMIRE.',
  };
}

async function pourChef(numeroUnite) {
  const [personnel, conges, missions, permanences, unite] = await Promise.all([
    nombre(`SELECT count(*)::int AS nombre FROM personnel
             WHERE numero_unite = $1 AND actif = TRUE AND fonction <> $2`, [numeroUnite, ROLES.ADMIN]),
    nombre(`SELECT count(*)::int AS nombre
              FROM conge c JOIN personnel p ON p.matricule = c.matricule
             WHERE p.numero_unite = $1 AND c.statut = 'En attente'`, [numeroUnite]),
    nombre(`SELECT count(*)::int AS nombre FROM mission
             WHERE date_fin_mission >= CURRENT_DATE`),
    nombre(`SELECT count(*)::int AS nombre FROM (
              SELECT pc.id_permc
                FROM permanence_cadre pc
                JOIN personnel p ON p.matricule = pc.matricule
                JOIN semaine s ON s.numero_semaine = pc.numero_semaine
               WHERE p.numero_unite = $1
                 AND s.date_debut <= CURRENT_DATE AND s.date_fin >= CURRENT_DATE
              UNION ALL
              SELECT ps.id_perms
                FROM permanence_surveillant ps
                JOIN personnel p ON p.matricule = ps.matricule
                JOIN semaine s ON s.numero_semaine = ps.numero_semaine
               WHERE p.numero_unite = $1
                 AND s.date_debut <= CURRENT_DATE AND s.date_fin >= CURRENT_DATE
            ) affectations`, [numeroUnite]),
    db.query('SELECT nom_unite FROM unite WHERE numero_unite = $1', [numeroUnite]),
  ]);

  return {
    role: 'Chef de service',
    nomUnite: unite.rows[0]?.nom_unite || null,
    statistiques: [
      { libelle: 'Personnel actif', valeur: personnel, detail: 'Agents de votre unité', ton: 'bleu' },
      { libelle: 'Congés à traiter', valeur: conges, detail: 'Demandes en attente de décision', ton: 'ambre' },
      { libelle: 'Missions à venir', valeur: missions, detail: 'Missions dont la période n’est pas terminée', ton: 'vert' },
      { libelle: 'Permanences cette semaine', valeur: permanences, detail: 'Affectations de votre unité', ton: 'violet' },
    ],
    message: 'Suivi de votre unité, des congés et de la planification.',
  };
}

async function pourAgent(utilisateur) {
  const permanencesSql = utilisateur.fonction === ROLES.SURVEILLANT
    ? `SELECT count(*)::int AS nombre
         FROM permanence_surveillant ps JOIN semaine s ON s.numero_semaine = ps.numero_semaine
        WHERE ps.matricule = $1 AND s.date_fin >= CURRENT_DATE
          AND s.date_debut <= CURRENT_DATE + 6`
    : `SELECT count(*)::int AS nombre
         FROM permanence_cadre pc JOIN semaine s ON s.numero_semaine = pc.numero_semaine
        WHERE pc.matricule = $1 AND s.date_fin >= CURRENT_DATE
          AND s.date_debut <= CURRENT_DATE + 6`;

  const [missions, conges, permanences, unite] = await Promise.all([
    nombre(`SELECT count(*)::int AS nombre
              FROM mission_intervenant mi JOIN mission m ON m.numero_mission = mi.numero_mission
             WHERE mi.matricule = $1 AND m.date_fin_mission >= CURRENT_DATE`, [utilisateur.matricule]),
    nombre(`SELECT count(*)::int AS nombre FROM conge
             WHERE matricule = $1 AND statut IN ('En attente', 'Validé', 'En pause')`, [utilisateur.matricule]),
    nombre(permanencesSql, [utilisateur.matricule]),
    db.query('SELECT nom_unite FROM unite WHERE numero_unite = $1', [utilisateur.numeroUnite]),
  ]);

  return {
    role: utilisateur.fonction,
    nomUnite: unite.rows[0]?.nom_unite || null,
    statistiques: [
      { libelle: 'Missions à venir', valeur: missions, detail: 'Missions auxquelles vous participez', ton: 'vert' },
      { libelle: 'Congés et absences', valeur: conges, detail: 'Demandes et périodes en cours', ton: 'ambre' },
      { libelle: 'Permanences à venir', valeur: permanences, detail: 'Cette semaine et les six prochains jours', ton: 'bleu' },
    ],
    message: 'Retrouvez rapidement votre planning et le suivi de vos congés.',
  };
}

async function obtenir(utilisateur) {
  if (utilisateur.fonction === ROLES.ADMIN) return pourAdministrateur();
  if (utilisateur.fonction === ROLES.CHEF) return pourChef(utilisateur.numeroUnite);
  return pourAgent(utilisateur);
}

module.exports = { obtenir };
