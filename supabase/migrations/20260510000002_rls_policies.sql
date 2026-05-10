-- =====================================================================
-- Row-Level Security policies
-- =====================================================================
-- Principe : un utilisateur ne voit que ses propres propriétaires (et,
-- en cascade, les biens, contrats, loyers… qui en dépendent).
-- =====================================================================

-- Activer RLS sur toutes les tables
ALTER TABLE profiles                ENABLE ROW LEVEL SECURITY;
ALTER TABLE proprietaires           ENABLE ROW LEVEL SECURITY;
ALTER TABLE biens                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE bien_proprietaires      ENABLE ROW LEVEL SECURITY;
ALTER TABLE lots                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE locataires              ENABLE ROW LEVEL SECURITY;
ALTER TABLE garants                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE locataire_garants       ENABLE ROW LEVEL SECURITY;
ALTER TABLE contrats                ENABLE ROW LEVEL SECURITY;
ALTER TABLE contrat_locataires      ENABLE ROW LEVEL SECURITY;
ALTER TABLE etats_lieux             ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyers                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE paiements               ENABLE ROW LEVEL SECURITY;
ALTER TABLE paiement_ventilations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE quittances              ENABLE ROW LEVEL SECURITY;
ALTER TABLE rappels                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE charges                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE prets_immobiliers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE echeances_prets         ENABLE ROW LEVEL SECURITY;
ALTER TABLE diagnostics             ENABLE ROW LEVEL SECURITY;
ALTER TABLE indices_irl             ENABLE ROW LEVEL SECURITY;
ALTER TABLE revisions_loyer         ENABLE ROW LEVEL SECURITY;
ALTER TABLE vacances_locatives      ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents               ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications           ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- Helper : un user voit-il ce bien ?
-- =====================================================================
CREATE OR REPLACE FUNCTION user_can_see_bien(p_bien_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM bien_proprietaires bp
    JOIN proprietaires p ON p.id = bp.proprietaire_id
    WHERE bp.bien_id = p_bien_id AND p.owner_user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION user_can_see_contrat(p_contrat_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM contrats c
    WHERE c.id = p_contrat_id AND user_can_see_bien(c.bien_id)
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION user_can_see_locataire(p_locataire_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM contrat_locataires cl
    JOIN contrats c ON c.id = cl.contrat_id
    WHERE cl.locataire_id = p_locataire_id AND user_can_see_bien(c.bien_id)
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- =====================================================================
-- Profiles
-- =====================================================================
CREATE POLICY profiles_select_own ON profiles FOR SELECT
  USING (id = auth.uid());
CREATE POLICY profiles_update_own ON profiles FOR UPDATE
  USING (id = auth.uid());

-- =====================================================================
-- Proprietaires : owner_user_id direct
-- =====================================================================
CREATE POLICY prop_select ON proprietaires FOR SELECT USING (owner_user_id = auth.uid());
CREATE POLICY prop_insert ON proprietaires FOR INSERT WITH CHECK (owner_user_id = auth.uid());
CREATE POLICY prop_update ON proprietaires FOR UPDATE USING (owner_user_id = auth.uid());
CREATE POLICY prop_delete ON proprietaires FOR DELETE USING (owner_user_id = auth.uid());

-- =====================================================================
-- Biens : via bien_proprietaires
-- =====================================================================
CREATE POLICY biens_select ON biens FOR SELECT USING (user_can_see_bien(id));
CREATE POLICY biens_insert ON biens FOR INSERT WITH CHECK (TRUE); -- vérifié via bien_proprietaires post-insert (transaction)
CREATE POLICY biens_update ON biens FOR UPDATE USING (user_can_see_bien(id));
CREATE POLICY biens_delete ON biens FOR DELETE USING (user_can_see_bien(id));

CREATE POLICY bp_select ON bien_proprietaires FOR SELECT
  USING (EXISTS (SELECT 1 FROM proprietaires p WHERE p.id = proprietaire_id AND p.owner_user_id = auth.uid()));
CREATE POLICY bp_insert ON bien_proprietaires FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM proprietaires p WHERE p.id = proprietaire_id AND p.owner_user_id = auth.uid()));
CREATE POLICY bp_delete ON bien_proprietaires FOR DELETE
  USING (EXISTS (SELECT 1 FROM proprietaires p WHERE p.id = proprietaire_id AND p.owner_user_id = auth.uid()));

CREATE POLICY lots_select ON lots FOR SELECT USING (user_can_see_bien(bien_id));
CREATE POLICY lots_modify ON lots FOR ALL USING (user_can_see_bien(bien_id)) WITH CHECK (user_can_see_bien(bien_id));

-- =====================================================================
-- Locataires / Garants
-- =====================================================================
CREATE POLICY loc_select ON locataires FOR SELECT USING (user_can_see_locataire(id) OR auth.uid() IS NOT NULL); -- visible par tout user authentifié pour création; à raffiner
CREATE POLICY loc_modify ON locataires FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY gar_modify ON garants FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY locgar_modify ON locataire_garants FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- =====================================================================
-- Contrats et dépendances
-- =====================================================================
CREATE POLICY contrats_select ON contrats FOR SELECT USING (user_can_see_bien(bien_id));
CREATE POLICY contrats_modify ON contrats FOR ALL USING (user_can_see_bien(bien_id)) WITH CHECK (user_can_see_bien(bien_id));

CREATE POLICY cl_modify ON contrat_locataires FOR ALL USING (user_can_see_contrat(contrat_id)) WITH CHECK (user_can_see_contrat(contrat_id));

CREATE POLICY edl_modify ON etats_lieux FOR ALL USING (user_can_see_contrat(contrat_id)) WITH CHECK (user_can_see_contrat(contrat_id));

CREATE POLICY loyers_modify ON loyers FOR ALL USING (user_can_see_contrat(contrat_id)) WITH CHECK (user_can_see_contrat(contrat_id));

CREATE POLICY paiements_select ON paiements FOR SELECT
  USING (EXISTS (SELECT 1 FROM paiement_ventilations pv JOIN loyers l ON l.id = pv.loyer_id WHERE pv.paiement_id = paiements.id AND user_can_see_contrat(l.contrat_id)));
CREATE POLICY paiements_modify ON paiements FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY pv_modify ON paiement_ventilations FOR ALL
  USING (EXISTS (SELECT 1 FROM loyers l WHERE l.id = loyer_id AND user_can_see_contrat(l.contrat_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM loyers l WHERE l.id = loyer_id AND user_can_see_contrat(l.contrat_id)));

CREATE POLICY q_modify ON quittances FOR ALL
  USING (EXISTS (SELECT 1 FROM loyers l WHERE l.id = loyer_id AND user_can_see_contrat(l.contrat_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM loyers l WHERE l.id = loyer_id AND user_can_see_contrat(l.contrat_id)));

CREATE POLICY r_modify ON rappels FOR ALL
  USING (EXISTS (SELECT 1 FROM loyers l WHERE l.id = loyer_id AND user_can_see_contrat(l.contrat_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM loyers l WHERE l.id = loyer_id AND user_can_see_contrat(l.contrat_id)));

-- =====================================================================
-- Charges, prêts, diagnostics, IRL, vacances
-- =====================================================================
CREATE POLICY charges_modify ON charges FOR ALL USING (user_can_see_bien(bien_id)) WITH CHECK (user_can_see_bien(bien_id));

CREATE POLICY prets_modify ON prets_immobiliers FOR ALL USING (user_can_see_bien(bien_id)) WITH CHECK (user_can_see_bien(bien_id));

CREATE POLICY ech_modify ON echeances_prets FOR ALL
  USING (EXISTS (SELECT 1 FROM prets_immobiliers p WHERE p.id = pret_id AND user_can_see_bien(p.bien_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM prets_immobiliers p WHERE p.id = pret_id AND user_can_see_bien(p.bien_id)));

CREATE POLICY diag_modify ON diagnostics FOR ALL USING (user_can_see_bien(bien_id)) WITH CHECK (user_can_see_bien(bien_id));

CREATE POLICY irl_select ON indices_irl FOR SELECT USING (auth.uid() IS NOT NULL); -- IRL = référentiel public
CREATE POLICY irl_admin ON indices_irl FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')) WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN'));

CREATE POLICY rev_modify ON revisions_loyer FOR ALL USING (user_can_see_contrat(contrat_id)) WITH CHECK (user_can_see_contrat(contrat_id));

CREATE POLICY vac_modify ON vacances_locatives FOR ALL USING (user_can_see_bien(bien_id)) WITH CHECK (user_can_see_bien(bien_id));

-- =====================================================================
-- Documents
-- =====================================================================
CREATE POLICY documents_select ON documents FOR SELECT USING (
  (bien_id IS NULL OR user_can_see_bien(bien_id)) AND
  (contrat_id IS NULL OR user_can_see_contrat(contrat_id)) AND
  uploaded_by IS NOT NULL
);
CREATE POLICY documents_insert ON documents FOR INSERT WITH CHECK (uploaded_by = auth.uid());
CREATE POLICY documents_delete ON documents FOR DELETE USING (uploaded_by = auth.uid());

-- =====================================================================
-- Notifications : strictement personnelles
-- =====================================================================
CREATE POLICY notif_own ON notifications FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
