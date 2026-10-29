// Entity : Semaine (lundi -> dimanche). Créée au premier enregistrement d'un planning.
const db = require('../config/db');

// Décrit la semaine commençant à `lundi`, qu'elle existe en base ou non
async function decrire(lundi) {
  const { rows } = await db.query(
    `SELECT s.numero_semaine,
            d.lundi                               AS date_debut,
            (d.lundi + 6)                         AS date_fin,
            EXTRACT(ISOYEAR FROM d.lundi)::int    AS annee,
            EXTRACT(WEEK FROM d.lundi)::int       AS numero_iso
       FROM (SELECT $1::date AS lundi) d
       LEFT JOIN semaine s ON s.date_debut = d.lundi`,
    [lundi]
  );
  const r = rows[0];
  return {
    numeroSemaine: r.numero_semaine,
    dateDebut: r.date_debut,
    dateFin: r.date_fin,
    annee: r.annee,
    numeroIso: r.numero_iso,
  };
}

async function trouverOuCreer(lundi, client) {
  const { rows } = await client.query(
    `INSERT INTO semaine (annee, date_debut, date_fin)
     VALUES (EXTRACT(ISOYEAR FROM $1::date)::int, $1::date, $1::date + 6)
     ON CONFLICT (date_debut) DO UPDATE SET date_debut = EXCLUDED.date_debut
     RETURNING numero_semaine`,
    [lundi]
  );
  return rows[0].numero_semaine;
}

module.exports = { decrire, trouverOuCreer };
