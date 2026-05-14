-- =====================================================================
-- Ajoute un flag `auto_genere_par_surplus` à la table `loyers` pour distinguer
-- les loyers créés à la volée par le report de trop-perçu (via ensureLoyerForMonth)
-- des loyers générés normalement par le bouton "Générer le mois".
--
-- Permet d'auto-supprimer les loyers orphelins (auto-créés mais qui ont perdu
-- leur seule ventilation après suppression d'un paiement).
-- =====================================================================

ALTER TABLE loyers
  ADD COLUMN IF NOT EXISTS auto_genere_par_surplus BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN loyers.auto_genere_par_surplus IS
  'TRUE si le loyer a été créé à la volée par ensureLoyerForMonth (report de trop-perçu sur le mois suivant). Permet le nettoyage automatique des loyers orphelins après suppression du paiement source.';
