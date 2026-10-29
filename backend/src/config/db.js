const { Pool, types } = require('pg');

// Les colonnes DATE (oid 1082) sont renvoyées telles quelles ('2025-12-15') et non
// converties en objet Date, ce qui évite tout décalage de fuseau horaire.
types.setTypeParser(1082, (valeur) => valeur);

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// Exécute `travail(client)` dans une transaction : tout est validé (COMMIT) ou tout est annulé.
async function transaction(travail) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const resultat = await travail(client);
    await client.query('COMMIT');
    return resultat;
  } catch (erreur) {
    await client.query('ROLLBACK');
    throw erreur;
  } finally {
    client.release();
  }
}

module.exports = {
  query: (texte, params) => pool.query(texte, params),
  transaction,
  pool,
};
