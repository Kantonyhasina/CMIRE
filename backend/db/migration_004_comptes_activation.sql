-- CMIRE : désactivation et réactivation logique des comptes du personnel.
-- Les lignes de permanences, missions et congés restent associées au matricule.
-- À exécuter une seule fois sur la base CMIRE existante.

ALTER TABLE personnel
  ADD COLUMN IF NOT EXISTS actif BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS date_desactivation TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS date_reactivation TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_personnel_actif_unite_fonction
  ON personnel (actif, numero_unite, fonction);
