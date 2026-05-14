-- =====================================================================
-- Table `parametres_smtp` : configuration SMTP par utilisateur.
-- 1 enregistrement par owner_user_id (singleton). Utilisée par l'Edge
-- Function `send-quittance-email` pour envoyer les mails de quittance.
-- =====================================================================

CREATE TABLE IF NOT EXISTS parametres_smtp (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  host TEXT NOT NULL,
  port INT NOT NULL DEFAULT 465 CHECK (port BETWEEN 1 AND 65535),
  username TEXT NOT NULL,
  password TEXT NOT NULL,
  secure BOOLEAN NOT NULL DEFAULT TRUE,
  from_email TEXT NOT NULL,
  from_name TEXT NOT NULL DEFAULT 'Gestion locative',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_parametres_smtp_user ON parametres_smtp(owner_user_id);

-- Trigger updated_at (utilise la fonction trigger_set_updated_at déjà créée
-- dans la migration initiale).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at' AND tgrelid = 'parametres_smtp'::regclass
  ) THEN
    CREATE TRIGGER set_updated_at BEFORE UPDATE ON parametres_smtp
      FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
  END IF;
END $$;

-- =====================================================================
-- RLS : chaque user voit/modifie uniquement son propre enregistrement.
-- =====================================================================

ALTER TABLE parametres_smtp ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "parametres_smtp_select_own" ON parametres_smtp;
CREATE POLICY "parametres_smtp_select_own" ON parametres_smtp
  FOR SELECT USING (auth.uid() = owner_user_id);

DROP POLICY IF EXISTS "parametres_smtp_insert_own" ON parametres_smtp;
CREATE POLICY "parametres_smtp_insert_own" ON parametres_smtp
  FOR INSERT WITH CHECK (auth.uid() = owner_user_id);

DROP POLICY IF EXISTS "parametres_smtp_update_own" ON parametres_smtp;
CREATE POLICY "parametres_smtp_update_own" ON parametres_smtp
  FOR UPDATE USING (auth.uid() = owner_user_id);

DROP POLICY IF EXISTS "parametres_smtp_delete_own" ON parametres_smtp;
CREATE POLICY "parametres_smtp_delete_own" ON parametres_smtp
  FOR DELETE USING (auth.uid() = owner_user_id);

COMMENT ON TABLE parametres_smtp IS
  'Configuration SMTP par utilisateur pour envoi des quittances. Le mot de passe est stocké en clair (la RLS l''isole). Recommandation : utiliser un mot de passe d''application dédié plutôt que le mot de passe principal.';
