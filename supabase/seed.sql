-- =====================================================================
-- Seed initial — données de base
-- =====================================================================
-- Pour le dev local uniquement (Supabase CLI charge ce fichier).
-- En prod, créer le user via l'UI Supabase Studio, puis ajouter les
-- données réelles.
-- =====================================================================

-- Quelques indices IRL récents (à compléter)
INSERT INTO indices_irl (trimestre, annee, valeur, date_publication) VALUES
  (1, 2024, 142.06, '2024-04-12'),
  (2, 2024, 143.46, '2024-07-12'),
  (3, 2024, 144.51, '2024-10-15'),
  (4, 2024, 145.47, '2025-01-15'),
  (1, 2025, 146.07, '2025-04-15'),
  (2, 2025, 146.66, '2025-07-15'),
  (3, 2025, 147.13, '2025-10-15'),
  (4, 2025, 147.40, '2026-01-15')
ON CONFLICT (trimestre, annee) DO NOTHING;
