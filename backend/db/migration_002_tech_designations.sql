-- Étape 3 : autoriser les deux désignations libres dans la grille des surveillants.
-- Les anciennes affectations restent inchangées : elles conservent leur matricule.

ALTER TABLE permanence_surveillant
    ALTER COLUMN matricule DROP NOT NULL;

ALTER TABLE permanence_surveillant
    ADD COLUMN IF NOT EXISTS designation_speciale VARCHAR(20);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM pg_constraint
         WHERE conname = 'ck_permanence_surveillant_agent_ou_designation'
    ) THEN
        ALTER TABLE permanence_surveillant
            ADD CONSTRAINT ck_permanence_surveillant_agent_ou_designation
            CHECK (
                (matricule IS NOT NULL AND designation_speciale IS NULL)
                OR (matricule IS NULL AND designation_speciale IS NOT NULL AND designation_speciale IN ('TECH ELB', 'TECH CNS'))
            );
    END IF;
END $$;

-- Référentiel des stations figurant dans le modèle Excel annuel.
-- ON CONFLICT évite les doublons si certaines stations existent déjà.
INSERT INTO station (nom_station) VALUES
    ('Antsiranana'),
    ('Nosy Be'),
    ('Antalaha'),
    ('Maintirano'),
    ('Mananjary'),
    ('Morondava'),
    ('Toliary'),
    ('Tolagnaro'),
    ('Moroni')
ON CONFLICT (nom_station) DO NOTHING;
