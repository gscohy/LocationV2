-- =====================================================================
-- Ajoute une colonne `signature_data_url` à la table `proprietaires` pour
-- stocker l'image de signature directement en data URL base64 (PNG).
-- La colonne existante `signature_storage_key` reste disponible pour un
-- futur passage à Supabase Storage si les signatures deviennent volumineuses.
-- =====================================================================

ALTER TABLE proprietaires
  ADD COLUMN IF NOT EXISTS signature_data_url TEXT;

COMMENT ON COLUMN proprietaires.signature_data_url IS
  'Signature dessinée à la souris/au doigt, stockée en data URL (image/png;base64,...). Utilisée pour imprimer/afficher les quittances. ~10-30 KB par signature.';
