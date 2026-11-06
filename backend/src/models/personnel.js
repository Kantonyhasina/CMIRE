// Entity : Personnel
const db = require('../config/db');
const { ROLES } = require('../config/roles');

const COLONNES_PUBLIQUES = `p.matricule, p.nom, p.prenom, p.fonction, p.identifiant,
                            p.numero_telephone, p.numero_unite, u.nom_unite`;

async function findByIdentifiant(identifiant) {
  const { rows } = await db.query(
    `SELECT matricule, nom, prenom, fonction, identifiant, mot_de_passe, numero_unite
       FROM personnel
      WHERE identifiant = $1`,
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

async function findAll() {
  const { rows } = await db.query(
    `SELECT ${COLONNES_PUBLIQUES}
       FROM personnel p
       JOIN unite u ON u.numero_unite = p.numero_unite
      ORDER BY u.nom_unite, p.nom, p.prenom`
  );
  return rows;
}

// Personnel d'une unité pour le contrôle de disponibilité.
// L'administrateur (super-utilisateur) n'est jamais planifié : il est exclu.
async function findByUnite(numeroUnite) {
  const { rows } = await db.query(
    `SELECT matricule, nom, prenom, fonction
       FROM personnel
      WHERE numero_unite = $1
        AND fonction <> $2
      ORDER BY nom, prenom`,
    [numeroUnite, ROLES.ADMIN]
  );
  return rows;
}

// Agents d'une fonction donnée, éventuellement limités à une unité.
async function findByFonction(fonction, { numeroUnite } = {}) {
  const params = [fonction];
  let filtreUnite = '';
  if (numeroUnite !== undefined) {
    params.push(numeroUnite);
    filtreUnite = 'AND p.numero_unite = $2';
  }
  const { rows } = await db.query(
    `SELECT p.matricule, p.nom, p.prenom, p.fonction, p.identifiant,
            p.numero_telephone AS "numeroTelephone",
            p.numero_unite AS "numeroUnite",
            u.nom_unite AS "nomUnite"
       FROM personnel p
       LEFT JOIN unite u ON u.numero_unite = p.numero_unite
      WHERE p.fonction = $1 ${filtreUnite}
      ORDER BY p.nom, p.prenom`,
    params
  );
  return rows;
}

// Cadres et chef de service d'une unité (ou de toutes les unités).
// Le chef est toujours placé avant les cadres de son unité.
// Les alias numeroTelephone / numeroUnite conservent le format attendu par le frontend et Excel.
async function findCadresEtChefs({ numeroUnite } = {}) {
  const params = [ROLES.CHEF, ROLES.CADRE];
  let filtreUnite = '';

  if (numeroUnite !== undefined) {
    params.push(numeroUnite);
    filtreUnite = 'AND p.numero_unite = $3';
  }

  const { rows } = await db.query(
    `SELECT p.matricule, p.nom, p.prenom, p.fonction,
            p.numero_telephone AS "numeroTelephone",
            p.numero_unite AS "numeroUnite"
       FROM personnel p
      WHERE p.fonction IN ($1, $2)
        ${filtreUnite}
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
     RETURNING matricule, nom, prenom, fonction, identifiant, numero_telephone, numero_unite`,
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
      RETURNING matricule, nom, prenom, fonction, identifiant, numero_telephone, numero_unite`,
    [matricule, nom, prenom, fonction, identifiant, numeroUnite, numeroTelephone, motDePasseHash ?? null]
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
  remove,
  identifiantExiste,
  aDesPermanences,
};
