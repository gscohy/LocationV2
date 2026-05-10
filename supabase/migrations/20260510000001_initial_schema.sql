-- =====================================================================
-- Schéma initial — Application de gestion locative v2
-- =====================================================================
-- Convention :
--   - UUID partout (compatibles avec auth.uid() Supabase)
--   - snake_case pour les noms de colonnes
--   - Types ENUM Postgres natifs
--   - Contraintes de clé étrangère explicites
--   - Indexes sur les colonnes de filtre fréquentes
-- =====================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================================
-- ENUMS
-- =====================================================================

CREATE TYPE user_role AS ENUM ('ADMIN', 'GESTIONNAIRE', 'LECTEUR');
CREATE TYPE type_proprietaire AS ENUM ('PHYSIQUE', 'MORALE');
CREATE TYPE type_bien AS ENUM ('APPARTEMENT', 'MAISON', 'STUDIO', 'LOCAL', 'GARAGE', 'PARKING', 'CAVE', 'TERRAIN');
CREATE TYPE statut_bien AS ENUM ('VACANT', 'LOUE', 'TRAVAUX', 'INDISPONIBLE', 'VENDU');
CREATE TYPE civilite AS ENUM ('M', 'MME', 'MLLE');
CREATE TYPE type_contrat AS ENUM ('HABITATION_VIDE', 'HABITATION_MEUBLE', 'MOBILITE', 'ETUDIANT', 'COMMERCIAL', 'PROFESSIONNEL', 'PARKING', 'GARAGE', 'SAISONNIER');
CREATE TYPE statut_contrat AS ENUM ('BROUILLON', 'ACTIF', 'EXPIRE', 'RENOUVELE', 'RESILIE', 'ARCHIVE');
CREATE TYPE mode_paiement AS ENUM ('VIREMENT', 'PRELEVEMENT', 'CHEQUE', 'ESPECES', 'CAF', 'PAYLIB', 'AUTRE');
CREATE TYPE statut_loyer AS ENUM ('EN_ATTENTE', 'PARTIEL', 'PAYE', 'RETARD', 'IMPAYE', 'ANNULE');
CREATE TYPE type_rappel AS ENUM ('RAPPEL_AMIABLE', 'RELANCE', 'MISE_EN_DEMEURE', 'COMMANDEMENT_PAYER', 'ASSIGNATION');
CREATE TYPE mode_envoi AS ENUM ('EMAIL', 'COURRIER_SIMPLE', 'LRAR', 'HUISSIER', 'MAIN_PROPRE');
CREATE TYPE statut_quittance AS ENUM ('GENEREE', 'ENVOYEE', 'ANNULEE');
CREATE TYPE categorie_charge AS ENUM ('TRAVAUX', 'ENTRETIEN', 'ASSURANCE_PNO', 'ASSURANCE_LOYERS_IMPAYES', 'CREDIT_IMMOBILIER', 'TAXE_FONCIERE', 'TAXE_HABITATION', 'CHARGES_COPROPRIETE', 'FRAIS_GESTION', 'HONORAIRES_AGENCE', 'FRAIS_PROCEDURE', 'EAU', 'ELECTRICITE', 'GAZ', 'INTERNET', 'EXCEPTIONNELLE', 'AUTRE');
CREATE TYPE type_charge AS ENUM ('PONCTUELLE', 'RECURRENTE');
CREATE TYPE frequence_charge AS ENUM ('MENSUELLE', 'TRIMESTRIELLE', 'SEMESTRIELLE', 'ANNUELLE');
CREATE TYPE categorie_document AS ENUM ('CONTRAT', 'LOCATAIRE', 'GARANT', 'BIEN', 'CHARGE', 'PRET', 'QUITTANCE', 'DIAGNOSTIC', 'ETAT_LIEUX', 'COURRIER', 'ASSURANCE', 'AUTRE');
CREATE TYPE statut_pret AS ENUM ('EN_COURS', 'SOLDE', 'RACHETE', 'SUSPENDU');
CREATE TYPE type_pret AS ENUM ('AMORTISSABLE', 'IN_FINE', 'RELAIS', 'PEL', 'CEL', 'PTZ');
CREATE TYPE type_diagnostic AS ENUM ('DPE', 'CREP', 'AMIANTE', 'DIAG_ELEC', 'DIAG_GAZ', 'ERP', 'BRUIT', 'AUDIT', 'CARREZ', 'BOUTIN', 'TERMITES', 'ASSAINISSEMENT');
CREATE TYPE type_etat_lieux AS ENUM ('ENTREE', 'SORTIE');
CREATE TYPE type_garantie AS ENUM ('PHYSIQUE', 'MORALE', 'VISALE', 'CAUTION_BANCAIRE', 'GARANTIE_LOCAPASS', 'AUTRE');
CREATE TYPE type_notification AS ENUM ('FIN_BAIL', 'REVISION_IRL', 'RETARD_PAIEMENT', 'ECHEANCE_CREDIT', 'ASSURANCE_RENOUVELLEMENT', 'DIAGNOSTIC_EXPIRATION', 'EDL_PLANIFIE', 'GENERIQUE');
CREATE TYPE severite_notification AS ENUM ('INFO', 'WARNING', 'ERROR');

-- =====================================================================
-- PROFILS UTILISATEURS (extension de auth.users)
-- =====================================================================

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'GESTIONNAIRE',
  telephone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger : créer un profil automatiquement à la création d'un user auth
CREATE FUNCTION handle_new_user() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, nom, prenom, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nom', 'Utilisateur'),
    COALESCE(NEW.raw_user_meta_data->>'prenom', ''),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'ADMIN')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =====================================================================
-- PROPRIÉTAIRES & BIENS
-- =====================================================================

CREATE TABLE proprietaires (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type type_proprietaire NOT NULL DEFAULT 'PHYSIQUE',
  civilite civilite,
  nom TEXT NOT NULL,
  prenom TEXT,
  date_naissance DATE,
  lieu_naissance TEXT,
  nationalite TEXT,
  email TEXT NOT NULL,
  email_secondaire TEXT,
  telephone_fixe TEXT,
  telephone_mobile TEXT,
  adresse TEXT NOT NULL,
  complement_adresse TEXT,
  code_postal TEXT NOT NULL,
  ville TEXT NOT NULL,
  pays TEXT NOT NULL DEFAULT 'France',
  entreprise TEXT,
  forme_juridique TEXT,
  siret TEXT,
  rcs TEXT,
  iban TEXT,
  bic TEXT,
  signature_storage_key TEXT,
  logo_storage_key TEXT,
  commentaires TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_proprietaires_owner ON proprietaires(owner_user_id);
CREATE INDEX idx_proprietaires_email ON proprietaires(email);

CREATE TABLE biens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reference TEXT,
  type type_bien NOT NULL DEFAULT 'APPARTEMENT',
  usage TEXT,
  adresse TEXT NOT NULL,
  complement_adresse TEXT,
  code_postal TEXT NOT NULL,
  ville TEXT NOT NULL,
  pays TEXT NOT NULL DEFAULT 'France',
  surface_habitable NUMERIC(10,2) NOT NULL,
  surface_carrez NUMERIC(10,2),
  surface_terrain NUMERIC(10,2),
  nb_pieces INT NOT NULL DEFAULT 1,
  nb_chambres INT NOT NULL DEFAULT 0,
  nb_salles_bain INT,
  etage INT,
  ascenseur BOOLEAN DEFAULT FALSE,
  meuble BOOLEAN DEFAULT FALSE,
  balcon BOOLEAN DEFAULT FALSE,
  parking BOOLEAN DEFAULT FALSE,
  cave BOOLEAN DEFAULT FALSE,
  chauffage_type TEXT,
  eau_chaude_type TEXT,
  classe_dpe TEXT,
  classe_ges TEXT,
  description TEXT,
  reglement_interieur TEXT,
  loyer NUMERIC(10,2) NOT NULL,
  charges_mensuelles NUMERIC(10,2) NOT NULL DEFAULT 0,
  depot_garantie NUMERIC(10,2) NOT NULL DEFAULT 0,
  statut statut_bien NOT NULL DEFAULT 'VACANT',
  date_achat DATE,
  prix_achat NUMERIC(12,2),
  frais_notaire_achat NUMERIC(10,2),
  frais_agence_achat NUMERIC(10,2),
  travaux_initiaux NUMERIC(10,2),
  valeur_estimee NUMERIC(12,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_biens_statut ON biens(statut);
CREATE INDEX idx_biens_ville ON biens(ville);

CREATE TABLE bien_proprietaires (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bien_id UUID NOT NULL REFERENCES biens(id) ON DELETE CASCADE,
  proprietaire_id UUID NOT NULL REFERENCES proprietaires(id) ON DELETE CASCADE,
  quote_part NUMERIC(5,2) NOT NULL DEFAULT 100,
  UNIQUE(bien_id, proprietaire_id)
);
CREATE INDEX idx_bp_bien ON bien_proprietaires(bien_id);
CREATE INDEX idx_bp_prop ON bien_proprietaires(proprietaire_id);

CREATE TABLE lots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bien_id UUID NOT NULL REFERENCES biens(id) ON DELETE CASCADE,
  numero TEXT NOT NULL,
  description TEXT,
  surface NUMERIC(10,2),
  usage TEXT,
  tantiemes_copro INT
);
CREATE INDEX idx_lots_bien ON lots(bien_id);

-- =====================================================================
-- LOCATAIRES & GARANTS
-- =====================================================================

CREATE TABLE locataires (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  civilite civilite NOT NULL DEFAULT 'M',
  nom TEXT NOT NULL,
  nom_naissance TEXT,
  prenom TEXT NOT NULL,
  autres_prenoms TEXT,
  date_naissance DATE NOT NULL,
  lieu_naissance TEXT NOT NULL,
  pays_naissance TEXT,
  nationalite TEXT,
  numero_piece_identite TEXT,
  type_piece_identite TEXT,
  email TEXT NOT NULL,
  telephone_mobile TEXT NOT NULL,
  telephone_fixe TEXT,
  adresse_precedente TEXT,
  code_postal_precedent TEXT,
  ville_precedente TEXT,
  profession TEXT,
  employeur TEXT,
  type_contrat_travail TEXT,
  date_embauche DATE,
  revenus_mensuels NUMERIC(10,2),
  autres_revenus NUMERIC(10,2),
  situation_matrimoniale TEXT,
  nombre_enfants INT,
  numero_caf TEXT,
  commentaires TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_locataires_nom ON locataires(nom, prenom);
CREATE INDEX idx_locataires_email ON locataires(email);

CREATE TABLE garants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  civilite civilite NOT NULL DEFAULT 'M',
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL,
  date_naissance DATE,
  email TEXT NOT NULL,
  telephone TEXT NOT NULL,
  adresse TEXT,
  code_postal TEXT,
  ville TEXT,
  profession TEXT,
  employeur TEXT,
  revenus_mensuels NUMERIC(10,2),
  type_garantie type_garantie NOT NULL DEFAULT 'PHYSIQUE',
  montant_max_garanti NUMERIC(10,2),
  duree_engagement TEXT,
  date_fin_engagement DATE,
  numero_visale TEXT,
  organisme_garant TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE locataire_garants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  locataire_id UUID NOT NULL REFERENCES locataires(id) ON DELETE CASCADE,
  garant_id UUID NOT NULL REFERENCES garants(id) ON DELETE CASCADE,
  UNIQUE(locataire_id, garant_id)
);

-- =====================================================================
-- CONTRATS
-- =====================================================================

CREATE TABLE contrats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reference TEXT,
  bien_id UUID NOT NULL REFERENCES biens(id) ON DELETE RESTRICT,
  date_signature DATE NOT NULL,
  date_debut DATE NOT NULL,
  date_fin DATE,
  duree_mois INT NOT NULL DEFAULT 36,
  reconduction_tacite BOOLEAN DEFAULT TRUE,
  type type_contrat NOT NULL DEFAULT 'HABITATION_VIDE',
  usage TEXT NOT NULL DEFAULT 'RESIDENCE_PRINCIPALE',
  loyer NUMERIC(10,2) NOT NULL,
  charges_mensuelles NUMERIC(10,2) NOT NULL DEFAULT 0,
  mode_charges TEXT NOT NULL DEFAULT 'PROVISION_REGULARISATION',
  depot_garantie NUMERIC(10,2) NOT NULL DEFAULT 0,
  date_encaissement_dg DATE,
  jour_paiement INT NOT NULL DEFAULT 1 CHECK (jour_paiement BETWEEN 1 AND 31),
  mode_paiement mode_paiement NOT NULL DEFAULT 'VIREMENT',
  frais_notaire NUMERIC(10,2) DEFAULT 0,
  frais_huissier NUMERIC(10,2) DEFAULT 0,
  frais_agence_location NUMERIC(10,2) DEFAULT 0,
  zone_geographique TEXT,
  encadrement_loyer BOOLEAN DEFAULT FALSE,
  loyer_reference NUMERIC(10,2),
  loyer_reference_majore NUMERIC(10,2),
  complement_loyer NUMERIC(10,2),
  irl_active BOOLEAN DEFAULT FALSE,
  irl_trimestre_ref INT,
  irl_annee_ref INT,
  irl_valeur_ref NUMERIC(8,4),
  date_prochaine_revision DATE,
  clauses_particulieres TEXT,
  clause_resolutoire TEXT,
  clause_solidarite BOOLEAN DEFAULT FALSE,
  commentaires TEXT,
  statut statut_contrat NOT NULL DEFAULT 'BROUILLON',
  date_demande_resiliation DATE,
  auteur_resiliation TEXT,
  motif_resiliation TEXT,
  commentaires_resiliation TEXT,
  date_fin_reelle DATE,
  preavis_respect BOOLEAN,
  date_restitution_dg DATE,
  montant_dg_restitue NUMERIC(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_contrats_bien ON contrats(bien_id);
CREATE INDEX idx_contrats_statut ON contrats(statut);
CREATE INDEX idx_contrats_date_fin ON contrats(date_fin);

CREATE TABLE contrat_locataires (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contrat_id UUID NOT NULL REFERENCES contrats(id) ON DELETE CASCADE,
  locataire_id UUID NOT NULL REFERENCES locataires(id) ON DELETE CASCADE,
  est_principal BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE(contrat_id, locataire_id)
);

CREATE TABLE etats_lieux (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contrat_id UUID NOT NULL REFERENCES contrats(id) ON DELETE CASCADE,
  type type_etat_lieux NOT NULL,
  date DATE NOT NULL,
  heure TEXT,
  realise_par TEXT,
  nom_tiers TEXT,
  frais_huissier NUMERIC(10,2),
  present_locataire BOOLEAN DEFAULT FALSE,
  present_bailleur BOOLEAN DEFAULT FALSE,
  signe BOOLEAN DEFAULT FALSE,
  compteur_electricite NUMERIC(12,2),
  compteur_eau_froide NUMERIC(12,2),
  compteur_eau_chaude NUMERIC(12,2),
  compteur_gaz NUMERIC(12,2),
  nb_cles INT,
  pieces JSONB,
  commentaires TEXT,
  document_storage_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_etats_lieux_contrat ON etats_lieux(contrat_id);

-- =====================================================================
-- LOYERS, PAIEMENTS, QUITTANCES, RAPPELS
-- =====================================================================

CREATE TABLE loyers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contrat_id UUID NOT NULL REFERENCES contrats(id) ON DELETE CASCADE,
  mois INT NOT NULL CHECK (mois BETWEEN 1 AND 12),
  annee INT NOT NULL,
  montant_loyer NUMERIC(10,2) NOT NULL,
  montant_charges NUMERIC(10,2) NOT NULL DEFAULT 0,
  montant_total NUMERIC(10,2) GENERATED ALWAYS AS (montant_loyer + montant_charges) STORED,
  montant_paye NUMERIC(10,2) NOT NULL DEFAULT 0,
  date_echeance DATE NOT NULL,
  date_paiement_complet DATE,
  statut statut_loyer NOT NULL DEFAULT 'EN_ATTENTE',
  commentaires TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(contrat_id, mois, annee)
);
CREATE INDEX idx_loyers_contrat ON loyers(contrat_id);
CREATE INDEX idx_loyers_statut ON loyers(statut);
CREATE INDEX idx_loyers_date_echeance ON loyers(date_echeance);

CREATE TABLE paiements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  montant NUMERIC(10,2) NOT NULL CHECK (montant > 0),
  date_reception DATE NOT NULL,
  date_valeur_bancaire DATE,
  mode mode_paiement NOT NULL DEFAULT 'VIREMENT',
  payeur TEXT NOT NULL DEFAULT 'Locataire',
  reference TEXT,
  commentaire TEXT,
  saisi_par UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_paiements_date ON paiements(date_reception);

CREATE TABLE paiement_ventilations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  paiement_id UUID NOT NULL REFERENCES paiements(id) ON DELETE CASCADE,
  loyer_id UUID NOT NULL REFERENCES loyers(id) ON DELETE CASCADE,
  montant NUMERIC(10,2) NOT NULL CHECK (montant > 0),
  UNIQUE(paiement_id, loyer_id)
);
CREATE INDEX idx_ventil_paiement ON paiement_ventilations(paiement_id);
CREATE INDEX idx_ventil_loyer ON paiement_ventilations(loyer_id);

CREATE TABLE quittances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loyer_id UUID NOT NULL REFERENCES loyers(id) ON DELETE CASCADE,
  periode TEXT NOT NULL,
  montant_total NUMERIC(10,2) NOT NULL,
  montant_loyer NUMERIC(10,2) NOT NULL,
  montant_charges NUMERIC(10,2) NOT NULL DEFAULT 0,
  date_generation TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  date_envoi TIMESTAMPTZ,
  mode_envoi mode_envoi NOT NULL DEFAULT 'EMAIL',
  destinataires TEXT,
  statut statut_quittance NOT NULL DEFAULT 'GENEREE',
  document_storage_key TEXT,
  email_envoye BOOLEAN DEFAULT FALSE,
  journal_envois JSONB
);
CREATE INDEX idx_quittances_loyer ON quittances(loyer_id);

CREATE TABLE rappels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loyer_id UUID NOT NULL REFERENCES loyers(id) ON DELETE CASCADE,
  type type_rappel NOT NULL,
  destinataires TEXT NOT NULL,
  modele_id UUID,
  sujet TEXT NOT NULL,
  contenu TEXT NOT NULL,
  date_envoi_planifie DATE,
  date_envoi_effectif TIMESTAMPTZ,
  mode_envoi mode_envoi NOT NULL DEFAULT 'EMAIL',
  envoye BOOLEAN DEFAULT FALSE,
  frais_engages NUMERIC(10,2),
  document_storage_key TEXT,
  commentaires TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_rappels_loyer ON rappels(loyer_id);

-- =====================================================================
-- CHARGES, PRÊTS, DIAGNOSTICS, IRL, VACANCES
-- =====================================================================

CREATE TABLE charges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bien_id UUID NOT NULL REFERENCES biens(id) ON DELETE CASCADE,
  categorie categorie_charge NOT NULL DEFAULT 'TRAVAUX',
  sous_categorie TEXT,
  description TEXT NOT NULL,
  fournisseur TEXT,
  numero_facture TEXT,
  montant_ttc NUMERIC(10,2) NOT NULL,
  montant_ht NUMERIC(10,2),
  tva NUMERIC(10,2),
  date DATE NOT NULL,
  date_paiement DATE,
  mode_paiement mode_paiement,
  type type_charge NOT NULL DEFAULT 'PONCTUELLE',
  frequence frequence_charge,
  date_debut DATE,
  date_fin DATE,
  recuperable BOOLEAN DEFAULT FALSE,
  deductible BOOLEAN DEFAULT TRUE,
  ligne_2044 TEXT,
  commentaires TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_charges_bien ON charges(bien_id);
CREATE INDEX idx_charges_date ON charges(date);

CREATE TABLE prets_immobiliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bien_id UUID NOT NULL REFERENCES biens(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  banque TEXT NOT NULL,
  numero_pret TEXT,
  type type_pret NOT NULL DEFAULT 'AMORTISSABLE',
  montant_emprunte NUMERIC(12,2) NOT NULL,
  taux_interet NUMERIC(6,4) NOT NULL,
  taeg NUMERIC(6,4),
  duree_mois INT NOT NULL,
  date_debut DATE NOT NULL,
  date_fin DATE NOT NULL,
  mensualite_base NUMERIC(10,2) NOT NULL,
  mensualite_assurance NUMERIC(10,2) DEFAULT 0,
  organisme_assurance TEXT,
  taux_assurance NUMERIC(6,4),
  capital_restant NUMERIC(12,2),
  statut statut_pret NOT NULL DEFAULT 'EN_COURS',
  commentaires TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_prets_bien ON prets_immobiliers(bien_id);

CREATE TABLE echeances_prets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pret_id UUID NOT NULL REFERENCES prets_immobiliers(id) ON DELETE CASCADE,
  rang INT NOT NULL,
  date_echeance DATE NOT NULL,
  montant_total NUMERIC(10,2) NOT NULL,
  capital_amorti NUMERIC(10,2) NOT NULL,
  interets NUMERIC(10,2) NOT NULL,
  assurance NUMERIC(10,2) DEFAULT 0,
  capital_restant NUMERIC(12,2) NOT NULL,
  payee BOOLEAN DEFAULT FALSE,
  UNIQUE(pret_id, rang)
);
CREATE INDEX idx_echeances_pret ON echeances_prets(pret_id);
CREATE INDEX idx_echeances_date ON echeances_prets(date_echeance);

CREATE TABLE diagnostics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bien_id UUID NOT NULL REFERENCES biens(id) ON DELETE CASCADE,
  type type_diagnostic NOT NULL,
  date_realisation DATE NOT NULL,
  date_expiration DATE,
  organisme TEXT,
  numero_certification TEXT,
  resultat TEXT,
  valeur_dpe NUMERIC(8,2),
  ges NUMERIC(8,2),
  cout NUMERIC(10,2),
  document_storage_key TEXT,
  commentaires TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_diagnostics_bien ON diagnostics(bien_id);
CREATE INDEX idx_diagnostics_expiration ON diagnostics(date_expiration);

CREATE TABLE indices_irl (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trimestre INT NOT NULL CHECK (trimestre BETWEEN 1 AND 4),
  annee INT NOT NULL,
  valeur NUMERIC(8,4) NOT NULL,
  variation NUMERIC(6,4),
  date_publication DATE,
  UNIQUE(trimestre, annee)
);

CREATE TABLE revisions_loyer (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contrat_id UUID NOT NULL REFERENCES contrats(id) ON DELETE CASCADE,
  date_revision DATE NOT NULL,
  ancien_loyer NUMERIC(10,2) NOT NULL,
  nouveau_loyer NUMERIC(10,2) NOT NULL,
  pourcentage NUMERIC(6,4) NOT NULL,
  irl_trimestre_ref INT NOT NULL,
  irl_annee_ref INT NOT NULL,
  irl_valeur_ref NUMERIC(8,4) NOT NULL,
  irl_trimestre_new INT NOT NULL,
  irl_annee_new INT NOT NULL,
  irl_valeur_new NUMERIC(8,4) NOT NULL,
  courrier_storage_key TEXT,
  date_envoi DATE,
  accepte BOOLEAN,
  date_application DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_revisions_contrat ON revisions_loyer(contrat_id);

CREATE TABLE vacances_locatives (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bien_id UUID NOT NULL REFERENCES biens(id) ON DELETE CASCADE,
  date_debut DATE NOT NULL,
  date_fin DATE,
  raison TEXT,
  commentaires TEXT
);
CREATE INDEX idx_vacances_bien ON vacances_locatives(bien_id);

-- =====================================================================
-- DOCUMENTS (métadonnées des fichiers stockés dans Supabase Storage)
-- =====================================================================

CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nom TEXT NOT NULL,
  storage_key TEXT NOT NULL UNIQUE,
  bucket TEXT NOT NULL DEFAULT 'documents',
  taille_octets BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  extension TEXT NOT NULL,
  checksum TEXT,
  categorie categorie_document NOT NULL,
  type_doc TEXT,
  description TEXT,
  bien_id UUID REFERENCES biens(id) ON DELETE CASCADE,
  contrat_id UUID REFERENCES contrats(id) ON DELETE CASCADE,
  locataire_id UUID REFERENCES locataires(id) ON DELETE CASCADE,
  garant_id UUID REFERENCES garants(id) ON DELETE CASCADE,
  charge_id UUID REFERENCES charges(id) ON DELETE CASCADE,
  pret_id UUID REFERENCES prets_immobiliers(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES auth.users(id),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    bien_id IS NOT NULL OR contrat_id IS NOT NULL OR locataire_id IS NOT NULL
    OR garant_id IS NOT NULL OR charge_id IS NOT NULL OR pret_id IS NOT NULL
  )
);
CREATE INDEX idx_documents_categorie ON documents(categorie);
CREATE INDEX idx_documents_bien ON documents(bien_id);
CREATE INDEX idx_documents_contrat ON documents(contrat_id);
CREATE INDEX idx_documents_locataire ON documents(locataire_id);

-- =====================================================================
-- NOTIFICATIONS
-- =====================================================================

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type type_notification NOT NULL,
  severite severite_notification NOT NULL DEFAULT 'INFO',
  titre TEXT NOT NULL,
  message TEXT NOT NULL,
  lien TEXT,
  payload JSONB,
  lue BOOLEAN DEFAULT FALSE,
  date_lecture TIMESTAMPTZ,
  date_expiration DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_notifications_user_lue ON notifications(user_id, lue);

-- =====================================================================
-- TRIGGERS updated_at
-- =====================================================================

CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT table_name FROM information_schema.columns
    WHERE table_schema = 'public' AND column_name = 'updated_at'
  LOOP
    EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();', t);
  END LOOP;
END $$;
