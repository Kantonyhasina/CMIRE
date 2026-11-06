// Entity : Conge
const db = require('../config/db');

const SELECTION = `SELECT c.id_conge AS id, c.matricule, p.nom, p.prenom,
                          p.numero_unite AS "numeroUnite", c.type, c.statut,
                          c.date_debut_conge AS "dateDebut", c.date_fin_conge AS "dateFin"
                     FROM conge c
                     JOIN personnel p ON p.matricule = c.matricule`;

async function findById(id) {
  const { rows } = await db.query(`${SELECTION} WHERE c.id_conge = $1`, [id]);
  return rows[0] || null;
}

async function findByAgent(matricule) {
  const { rows } = await db.query(
    `${SELECTION} WHERE c.matricule = $1 ORDER BY c.date_debut_conge DESC, c.id_conge DESC`, [matricule]);
  return rows;
}

async function findByUnite(numeroUnite, statut) {
  const { rows } = await db.query(
    `${SELECTION} WHERE p.numero_unite = $1 AND c.statut = $2
      ORDER BY c.date_debut_conge, p.nom, c.id_conge`,
    [numeroUnite, statut]
  );
  return rows;
}

async function compterParStatut(numeroUnite, statut) {
  const { rows } = await db.query(
    `SELECT count(*)::int AS nombre
       FROM conge c JOIN personnel p ON p.matricule = c.matricule
      WHERE p.numero_unite = $1 AND c.statut = $2`,
    [numeroUnite, statut]
  );
  return rows[0].nombre;
}

// Congés de l'agent (en attente ou validés) qui chevauchent la période : sert à refuser les doublons
async function chevauchantDeLAgent(matricule, debut, fin) {
  const { rows } = await db.query(
    `${SELECTION}
      WHERE c.matricule = $1
        AND c.statut IN ('En attente', 'Validé')
        AND c.date_debut_conge <= $3::date
        AND c.date_fin_conge   >= $2::date
      ORDER BY c.date_debut_conge`,
    [matricule, debut, fin]
  );
  return rows;
}

async function pourCalendrier(numeroUnite, debut, fin, statuts) {
  const { rows } = await db.query(
    `${SELECTION}
      WHERE p.numero_unite = $1
        AND c.statut = ANY($4::text[])
        AND c.date_debut_conge <= $3::date
        AND c.date_fin_conge   >= $2::date
      ORDER BY c.date_debut_conge, p.nom`,
    [numeroUnite, debut, fin, statuts]
  );
  return rows;
}

async function creer({ matricule, dateDebut, dateFin, type }) {
  const { rows } = await db.query(
    `INSERT INTO conge (matricule, date_debut_conge, date_fin_conge, type)
     VALUES ($1, $2::date, $3::date, $4)
     RETURNING id_conge`,
    [matricule, dateDebut, dateFin, type]
  );
  return findById(rows[0].id_conge);
}

async function changerStatut(id, statut) {
  await db.query('UPDATE conge SET statut = $2 WHERE id_conge = $1', [id, statut]);
}

async function supprimer(id) {
  await db.query('DELETE FROM conge WHERE id_conge = $1', [id]);
}

module.exports = {
  findById, findByAgent, findByUnite, compterParStatut,
  chevauchantDeLAgent, pourCalendrier, creer, changerStatut, supprimer,
};
