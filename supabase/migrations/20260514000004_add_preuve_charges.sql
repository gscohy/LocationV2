-- =====================================================================
-- Ajoute le support des preuves de charges (factures, photos) :
-- 1. Colonne `preuve_storage_key` sur charges pour pointer vers Supabase Storage
-- 2. Bucket privé `charges-preuves` avec RLS par utilisateur (chaque user n'accède
--    qu'aux fichiers dont la clé commence par son user_id)
-- =====================================================================

ALTER TABLE charges
  ADD COLUMN IF NOT EXISTS preuve_storage_key TEXT;

COMMENT ON COLUMN charges.preuve_storage_key IS
  'Chemin vers le fichier preuve (facture/photo) dans le bucket charges-preuves. Format: <user_id>/<filename>';

-- Bucket charges-preuves (privé, RLS via auth.uid()).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'charges-preuves',
  'charges-preuves',
  FALSE,
  10485760, -- 10 MB max
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Policies : chaque user accède uniquement aux fichiers dont le path commence par son auth.uid().
-- Policies : chaque user accède uniquement aux fichiers dont le path commence
-- par son auth.uid(). Drop avant create pour pouvoir rejouer la migration.
DROP POLICY IF EXISTS "charges_preuves_select_own" ON storage.objects;
CREATE POLICY "charges_preuves_select_own" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'charges-preuves'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "charges_preuves_insert_own" ON storage.objects;
CREATE POLICY "charges_preuves_insert_own" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'charges-preuves'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "charges_preuves_delete_own" ON storage.objects;
CREATE POLICY "charges_preuves_delete_own" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'charges-preuves'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
