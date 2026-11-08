// Entity : Conge. Une date NULL représente une indisponibilité sans durée connue.
const db = require('../config/db');

const SELECTION = `SELECT c.id_conge AS id, c.matricule, p.nom, p.prenom,
                          p.identifiant, p.fonction,
                          p.numero_unite AS "numeroUnite", c.type, c.statut,
                          c.date_debut_conge AS "dateDebut", c.date_fin_conge AS "dateFin",
                          c.date_reprise AS "dateReprise", c.created_at AS "createdAt"
                     FROM conge c
                     JOIN personnel p ON p.matricule = c.matricule`;

async function findById(id) {
  const { rows } = await db.query(`${SELECTION} WHERE c.id_conge = $1`, [id]);
  return rows[0] || null;
}

async function findByAgent(matricule) {
  const { rows } = await db.query(
    `${SELECTION} WHERE c.matricule = $1 ORDER BY c.created_at DESC, c.id_conge DESC`, [matricule]);
  return rows;
}

async function findByUnite(numeroUnite, statut) {
  const { rows } = await db.query(
    `${SELECTION} WHERE p.numero_unite = $1 AND c.statut = $2
      ORDER BY c.date_debut_conge NULLS FIRST, c.created_at DESC, p.nom, c.id_conge`,
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

// Les pauses sans date couvrent toute période future jusqu'à leur reprise.
async function chevauchantDeLAgent(matricule, debut, fin) {
  const { rows } = await db.query(
    `${SELECTION}
      WHERE c.matricule = $1
        AND c.statut IN ('En attente', 'Validé', 'En pause')
        AND COALESCE(c.date_debut_conge, (c.created_at AT TIME ZONE 'Indian/Antananarivo')::date) <= $3::date
        AND (c.date_fin_conge IS NULL OR c.date_fin_conge >= $2::date)
        AND (c.date_reprise IS NULL OR c.date_reprise > $2::date)
      ORDER BY c.created_at DESC`,
    [matricule, debut, fin]
  );
  return rows;
}

async function pourCalendrier(numeroUnite, debut, fin, statuts) {
  const { rows } = await db.query(
    `SELECT c.id_conge AS id, c.matricule, c.type, c.statut,
            GREATEST(COALESCE(c.date_debut_conge, (c.created_at AT TIME ZONE 'Indian/Antananarivo')::date), $2::date) AS "dateDebut",
            COALESCE(c.date_fin_conge,
                     CASE WHEN c.date_reprise IS NOT NULL THEN c.date_reprise - 1 ELSE $3::date END) AS "dateFin",
            c.date_reprise AS "dateReprise"
       FROM conge c JOIN personnel p ON p.matricule = c.matricule
      WHERE p.numero_unite = $1
        AND c.statut = ANY($4::text[])
        AND COALESCE(c.date_debut_conge, (c.created_at AT TIME ZONE 'Indian/Antananarivo')::date) <= $3::date
        AND (c.date_fin_conge IS NULL OR c.date_fin_conge >= $2::date)
        AND (c.date_reprise IS NULL OR c.date_reprise > $2::date)
      ORDER BY c.date_debut_conge NULLS FIRST, p.nom`,
    [numeroUnite, debut, fin, statuts]
  );
  return rows;
}

async function creer({ matricule, dateDebut = null, dateFin = null, type, statut = 'En attente', creePar = null }) {
  const { rows } = await db.query(
    `INSERT INTO conge (matricule, date_debut_conge, date_fin_conge, type, statut, created_by)
     VALUES ($1, $2::date, $3::date, $4, $5, $6)
     RETURNING id_conge`,
    [matricule, dateDebut, dateFin, type, statut, creePar]
  );
  return findById(rows[0].id_conge);
}

async function changerStatut(id, statut) {
  await db.query('UPDATE conge SET statut = $2 WHERE id_conge = $1', [id, statut]);
}

async function reprendre(id, dateReprise) {
  await db.query(
    `UPDATE conge SET statut = 'Repris', date_reprise = $2::date WHERE id_conge = $1 AND statut = 'En pause'`,
    [id, dateReprise]
  );
  return findById(id);
}

async function supprimer(id) {
  await db.query('DELETE FROM conge WHERE id_conge = $1', [id]);
}

module.exports = {
  findById, findByAgent, findByUnite, compterParStatut,
  chevauchantDeLAgent, pourCalendrier, creer, changerStatut, reprendre, supprimer,
};
