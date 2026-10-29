// Fabrique d'accès aux tables de référence (clé numérique + libellé).
// Les noms de table/colonnes viennent du code (jamais de l'utilisateur) : l'interpolation est sûre.
const db = require('../config/db');

function creerReferentiel({ table, cle, libelle }) {
  return {
    async findAll() {
      const { rows } = await db.query(`SELECT ${cle}, ${libelle} FROM ${table} ORDER BY ${libelle}`);
      return rows;
    },
    async create(nom) {
      const { rows } = await db.query(
        `INSERT INTO ${table} (${libelle}) VALUES ($1) RETURNING ${cle}, ${libelle}`, [nom]);
      return rows[0];
    },
    async update(id, nom) {
      const { rows } = await db.query(
        `UPDATE ${table} SET ${libelle} = $1 WHERE ${cle} = $2 RETURNING ${cle}, ${libelle}`, [nom, id]);
      return rows[0] || null;
    },
    async existe(id) {
      const { rowCount } = await db.query(`SELECT 1 FROM ${table} WHERE ${cle} = $1`, [id]);
      return rowCount > 0;
    },
    async remove(id) {
      const { rowCount } = await db.query(`DELETE FROM ${table} WHERE ${cle} = $1`, [id]);
      return rowCount > 0;
    },
  };
}

module.exports = { creerReferentiel };
