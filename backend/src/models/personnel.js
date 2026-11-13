// Entity : Personnel
const db = require('../config/db');
const { ROLES } = require('../config/roles');

const COLONNES_PUBLIQUES = `p.matricule, p.nom, p.prenom, p.fonction, p.identifiant,
                            p.numero_telephone, p.numero_unite, u.nom_unite,
                            p.actif, p.date_desactivation AS "dateDesactivation",
                            p.date_reactivation AS "dateReactivation"`;

async function findByIdentifiant(identifiant) {
  const { rows } = await db.query(
    `SELECT
        p.matricule,
        p.nom,
        p.prenom,
        p.fonction,
        p.identifiant,
        p.mot_de_passe,
        p.numero_unite,
        u.nom_unite AS "nomUnite",
        p.actif
     FROM personnel p
     LEFT JOIN unite u
       ON u.numero_unite = p.numero_unite
     WHERE p.identifiant = $1`,
    [identifiant]
  );

  return rows[0] || null;
}

async function findByMatricule(matricule) {
  const { rows } = await db.query(
    `SELECT ${COLONNES_PUBLIQUES}
       FROM personnel p
       JOIN unite u ON u.numero_unite = p.numero_unite
      WHERE p.matricule = $1`,
    [matricule]
  );
  return rows[0] || null;
}

// Pour l'administration, la liste comprend les comptes actifs et désactivés.
async function findAll() {
  const { rows } = await db.query(
    `SELECT ${COLONNES_PUBLIQUES}
       FROM personnel p
       JOIN unite u ON u.numero_unite = p.numero_unite
      ORDER BY p.actif DESC, u.nom_unite, p.nom, p.prenom`
  );
  return rows;
}

// Le personnel inactif reste dans la base pour préserver l'historique,
// mais n'est jamais proposé pour une nouvelle affectation.
async function findByUnite(numeroUnite) {
  const { rows } = await db.query(
    `SELECT matricule, nom, prenom, fonction, identifiant, numero_unite AS "numeroUnite"
       FROM personnel
      WHERE numero_unite = $1
        AND fonction <> $2
        AND actif = TRUE
      ORDER BY nom, prenom`,
    [numeroUnite, ROLES.ADMIN]
  );
  return rows;
}

async function findByFonction(fonction, { numeroUnite, inclureInactifs = false } = {}) {
  const params = [fonction];
  const conditions = ['p.fonction = $1'];
  if (numeroUnite !== undefined) {
    params.push(numeroUnite);
    conditions.push(`p.numero_unite = $${params.length}`);
  }
  if (!inclureInactifs) conditions.push('p.actif = TRUE');

  const { rows } = await db.query(
    `SELECT p.matricule, p.nom, p.prenom, p.fonction, p.identifiant,
            p.numero_telephone AS "numeroTelephone",
            p.numero_unite AS "numeroUnite",
            u.nom_unite AS "nomUnite", p.actif
       FROM personnel p
       LEFT JOIN unite u ON u.numero_unite = p.numero_unite
      WHERE ${conditions.join(' AND ')}
      ORDER BY p.nom, p.prenom`,
    params
  );
  return rows;
}

// Cadres et chef de service d'une unité (ou de toutes les unités).
// Le chef est toujours placé avant les cadres de son unité.
// Par défaut, seuls les personnels actifs sont proposés à la planification.
async function findCadresEtChefs({ numeroUnite, inclureInactifs = false } = {}) {
  const params = [ROLES.CHEF, ROLES.CADRE];
  const conditions = ['p.fonction IN ($1, $2)'];

  if (numeroUnite !== undefined) {
    params.push(numeroUnite);
    conditions.push(`p.numero_unite = $${params.length}`);
  }
  if (!inclureInactifs) conditions.push('p.actif = TRUE');

  const { rows } = await db.query(
    `SELECT p.matricule, p.nom, p.prenom, p.fonction, p.identifiant,
            p.numero_telephone AS "numeroTelephone",
            p.numero_unite AS "numeroUnite", u.nom_unite AS "nomUnite", p.actif
       FROM personnel p
       JOIN unite u ON u.numero_unite = p.numero_unite
      WHERE ${conditions.join(' AND ')}
      ORDER BY p.numero_unite,
               CASE WHEN p.fonction = $1 THEN 0 ELSE 1 END,
               p.nom, p.prenom`,
    params
  );
  return rows;
}

// Le matricule est généré par la base (P001, P002, ...) : on ne le fournit jamais.
async function create({ nom, prenom, fonction, identifiant, motDePasseHash, numeroUnite, numeroTelephone }) {
  const { rows } = await db.query(
    `INSERT INTO personnel
            (nom, prenom, fonction, identifiant, mot_de_passe, numero_unite, numero_telephone)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING matricule, nom, prenom, fonction, identifiant, numero_telephone, numero_unite, actif`,
    [nom, prenom, fonction, identifiant, motDePasseHash, numeroUnite, numeroTelephone]
  );
  return rows[0];
}

// motDePasseHash = null : on garde le mot de passe actuel
async function update(matricule, { nom, prenom, fonction, identifiant, numeroUnite, numeroTelephone, motDePasseHash }) {
  const { rows } = await db.query(
    `UPDATE personnel
        SET nom = $2, prenom = $3, fonction = $4, identifiant = $5,
            numero_unite = $6, numero_telephone = $7,
            mot_de_passe = COALESCE($8, mot_de_passe)
      WHERE matricule = $1
      RETURNING matricule, nom, prenom, fonction, identifiant,
                numero_telephone, numero_unite, actif`,
    [matricule, nom, prenom, fonction, identifiant, numeroUnite, numeroTelephone, motDePasseHash ?? null]
  );
  return rows[0] || null;
}

async function changerActivation(matricule, actif) {
  const { rows } = await db.query(
    `UPDATE personnel
        SET actif = $2,
            date_desactivation = CASE WHEN $2 THEN NULL ELSE NOW() END,
            date_reactivation = CASE WHEN $2 THEN NOW() ELSE date_reactivation END
      WHERE matricule = $1
      RETURNING matricule, nom, prenom, fonction, identifiant,
                numero_telephone, numero_unite, actif,
                date_desactivation AS "dateDesactivation",
                date_reactivation AS "dateReactivation"`,
    [matricule, actif]
  );
  return rows[0] || null;
}

async function remove(matricule) {
  const { rowCount } = await db.query('DELETE FROM personnel WHERE matricule = $1', [matricule]);
  return rowCount > 0;
}

async function identifiantExiste(identifiant, sauf = null) {
  const { rowCount } = await db.query(
    'SELECT 1 FROM personnel WHERE identifiant = $1 AND matricule IS DISTINCT FROM $2',
    [identifiant, sauf]
  );
  return rowCount > 0;
}

async function aDesPermanences(matricule) {
  const { rowCount } = await db.query(
    `SELECT 1 FROM permanence_cadre WHERE matricule = $1
     UNION ALL
     SELECT 1 FROM permanence_surveillant WHERE matricule = $1`,
    [matricule]
  );
  return rowCount > 0;
}

module.exports = {
  findByIdentifiant,
  findByMatricule,
  findAll,
  findByUnite,
  findByFonction,
  findCadresEtChefs,
  create,
  update,
  changerActivation,
  remove,
  identifiantExiste,
  aDesPermanences,
};
