-- =====================================================================
-- Migration 001 : numéro de téléphone + matricules automatiques (P001, P002, ...)
-- À exécuter UNE SEULE FOIS sur la base existante (pgAdmin > Query Tool).
-- Les comptes existants gardent leur matricule actuel (ex. A001).
-- =====================================================================

BEGIN;

-- 1. Numéro de téléphone (facultatif)
ALTER TABLE personnel ADD COLUMN IF NOT EXISTS numero_telephone VARCHAR(30);

-- 2. Compteur et fonction de génération des matricules
CREATE SEQUENCE IF NOT EXISTS seq_matricule START 1;

CREATE OR REPLACE FUNCTION generer_matricule() RETURNS TEXT
LANGUAGE sql AS $$
    SELECT 'P' || lpad(n::text, greatest(3, length(n::text)), '0')
      FROM (SELECT nextval('seq_matricule') AS n) t
$$;

ALTER TABLE personnel ALTER COLUMN matricule SET DEFAULT generer_matricule();

-- 3. Le prochain matricule suit le plus grand déjà utilisé au format Pnnn (P001 si aucun)
SELECT setval('seq_matricule',
              COALESCE((SELECT max(substring(matricule FROM 2)::int)
                          FROM personnel
                         WHERE matricule ~ '^P[0-9]+$'), 0) + 1,
              false);

COMMIT;
