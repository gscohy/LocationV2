import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

const TABLE = 'loyers';

export type StatutLoyer = 'EN_ATTENTE' | 'PARTIEL' | 'PAYE' | 'RETARD' | 'IMPAYE' | 'ANNULE';

interface LoyerRow {
  id: string;
  contrat_id: string;
  mois: number;
  annee: number;
  montant_loyer: number;
  montant_charges: number;
  montant_total: number;
  montant_paye: number;
  date_echeance: string;
  date_paiement_complet: string | null;
  statut: StatutLoyer;
  commentaires: string | null;
  created_at: string;
  updated_at: string;
}

interface LoyerContratJoin {
  id: string;
  reference: string | null;
  jour_paiement: number;
  loyer: number;
  charges_mensuelles: number;
  date_debut: string;
  date_fin: string | null;
  date_fin_reelle: string | null;
  statut: string;
  biens: {
    id: string;
    reference: string | null;
    adresse: string;
    code_postal: string;
    ville: string;
  } | null;
  contrat_locataires: Array<{
    est_principal: boolean;
    locataires: { id: string; nom: string; prenom: string } | null;
  }>;
}

interface LoyerRowFull extends LoyerRow {
  contrats: LoyerContratJoin | null;
}

export interface LoyerContratSummary {
  id: string;
  reference: string | undefined;
  bienAdresse: string;
  bienVille: string;
  locatairePrincipalLabel: string;
}

export interface Loyer {
  id: string;
  contratId: string;
  contrat: LoyerContratSummary | undefined;
  mois: number;
  annee: number;
  montantLoyer: number;
  montantCharges: number;
  montantTotal: number;
  montantPaye: number;
  soldeRestant: number;
  dateEcheance: string;
  datePaiementComplet: string | undefined;
  statut: StatutLoyer;
  commentaires: string | undefined;
  createdAt: string;
}

function rowToLoyer(row: LoyerRowFull): Loyer {
  const c = row.contrats;
  const principal = c?.contrat_locataires.find((cl) => cl.est_principal)?.locataires;
  const autre = c?.contrat_locataires[0]?.locataires;
  const loc = principal ?? autre ?? undefined;

  const total = Number(row.montant_total);
  const paye = Number(row.montant_paye);

  return {
    id: row.id,
    contratId: row.contrat_id,
    contrat: c
      ? {
          id: c.id,
          reference: c.reference ?? undefined,
          bienAdresse: c.biens?.adresse ?? '— bien inconnu —',
          bienVille: c.biens ? `${c.biens.code_postal} ${c.biens.ville}` : '',
          locatairePrincipalLabel: loc ? `${loc.prenom} ${loc.nom}` : '— sans locataire —',
        }
      : undefined,
    mois: row.mois,
    annee: row.annee,
    montantLoyer: Number(row.montant_loyer),
    montantCharges: Number(row.montant_charges),
    montantTotal: total,
    montantPaye: paye,
    soldeRestant: Math.max(0, total - paye),
    dateEcheance: row.date_echeance,
    datePaiementComplet: row.date_paiement_complet ?? undefined,
    statut: row.statut,
    commentaires: row.commentaires ?? undefined,
    createdAt: row.created_at,
  };
}

const SELECT_FULL =
  '*, contrats(id, reference, jour_paiement, loyer, charges_mensuelles, date_debut, date_fin, date_fin_reelle, statut, biens(id, reference, adresse, code_postal, ville), contrat_locataires(est_principal, locataires(id, nom, prenom)))';

export interface LoyersFilters {
  statut?: StatutLoyer;
  annee?: number;
  mois?: number;
  contratId?: string;
}

const loyersQueryKey = (filters: LoyersFilters) => ['loyers', filters] as const;

export function useLoyers(filters: LoyersFilters = {}) {
  return useQuery({
    queryKey: loyersQueryKey(filters),
    queryFn: async () => {
      let q = supabase.from(TABLE).select(SELECT_FULL).order('date_echeance', { ascending: false });
      if (filters.statut) q = q.eq('statut', filters.statut);
      if (filters.annee) q = q.eq('annee', filters.annee);
      if (filters.mois) q = q.eq('mois', filters.mois);
      if (filters.contratId) q = q.eq('contrat_id', filters.contratId);
      const { data, error } = await q;
      if (error) throw error;
      return ((data ?? []) as unknown as LoyerRowFull[]).map(rowToLoyer);
    },
  });
}

export interface UpdateLoyerInput {
  montantLoyer: number;
  montantCharges: number;
  dateEcheance: string;
  commentaires: string | undefined;
}

export function useUpdateLoyer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateLoyerInput }) => {
      const { error } = await supabase
        .from(TABLE)
        .update({
          montant_loyer: input.montantLoyer,
          montant_charges: input.montantCharges,
          date_echeance: input.dateEcheance,
          commentaires: input.commentaires ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['loyers'] });
    },
  });
}

export function useDeleteLoyer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(TABLE).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['loyers'] });
    },
  });
}

export interface GenerateLoyersInput {
  mois: number;
  annee: number;
  force: boolean;
  contratId: string | undefined;
}

export interface GenerateLoyersResult {
  created: number;
  updated: number;
  skipped: number;
  scanned: number;
}

interface ContratGenRow {
  id: string;
  date_debut: string;
  date_fin: string | null;
  date_fin_reelle: string | null;
  jour_paiement: number;
  loyer: number;
  charges_mensuelles: number;
}

function dateEcheanceFor(annee: number, mois: number, jourPaiement: number): string {
  const day = Math.min(Math.max(1, jourPaiement), 28);
  const m = String(mois).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${annee}-${m}-${d}`;
}

/**
 * Garantit l'existence d'un loyer pour (contrat, mois, annee).
 * Si absent, le crée à partir du contrat (loyer, charges, jour_paiement).
 * Retourne l'id du loyer + un drapeau indiquant s'il vient d'être créé.
 *
 * À appeler depuis le code applicatif (pas un hook React), typiquement pour
 * reporter un trop-perçu sur le mois suivant.
 */
export async function ensureLoyerForMonth(
  contratId: string,
  mois: number,
  annee: number,
): Promise<{ id: string; created: boolean }> {
  const { data: existing, error: errFind } = await supabase
    .from(TABLE)
    .select('id')
    .eq('contrat_id', contratId)
    .eq('mois', mois)
    .eq('annee', annee)
    .maybeSingle();
  if (errFind) throw errFind;
  if (existing) return { id: existing.id, created: false };

  const { data: contrat, error: errContrat } = await supabase
    .from('contrats')
    .select('jour_paiement, loyer, charges_mensuelles')
    .eq('id', contratId)
    .maybeSingle();
  if (errContrat) throw errContrat;
  if (!contrat) throw new Error('Contrat introuvable pour créer le loyer du mois suivant');

  const c = contrat as { jour_paiement: number; loyer: number; charges_mensuelles: number };
  const dateEcheance = dateEcheanceFor(annee, mois, c.jour_paiement);

  const { data: inserted, error: errInsert } = await supabase
    .from(TABLE)
    .insert({
      contrat_id: contratId,
      mois,
      annee,
      montant_loyer: c.loyer,
      montant_charges: c.charges_mensuelles,
      date_echeance: dateEcheance,
      statut: 'EN_ATTENTE',
    })
    .select('id')
    .single();
  if (errInsert) throw errInsert;
  return { id: (inserted as { id: string }).id, created: true };
}

export function useGenerateLoyers() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: GenerateLoyersInput): Promise<GenerateLoyersResult> => {
      const { mois, annee, force, contratId } = input;
      const periodStart = `${annee}-${String(mois).padStart(2, '0')}-01`;
      const lastDay = new Date(annee, mois, 0).getDate();
      const periodEnd = `${annee}-${String(mois).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      let q = supabase
        .from('contrats')
        .select('id, date_debut, date_fin, date_fin_reelle, jour_paiement, loyer, charges_mensuelles')
        .eq('statut', 'ACTIF');
      if (contratId) q = q.eq('id', contratId);

      const { data: contratsRaw, error: errContrats } = await q;
      if (errContrats) throw errContrats;
      const contrats = (contratsRaw ?? []) as ContratGenRow[];

      let created = 0;
      let updated = 0;
      let skipped = 0;

      for (const c of contrats) {
        if (c.date_debut > periodEnd) {
          skipped++;
          continue;
        }
        if (c.date_fin && c.date_fin < periodStart) {
          skipped++;
          continue;
        }
        if (c.date_fin_reelle && c.date_fin_reelle < periodStart) {
          skipped++;
          continue;
        }

        const { data: existing, error: errExisting } = await supabase
          .from(TABLE)
          .select('id')
          .eq('contrat_id', c.id)
          .eq('mois', mois)
          .eq('annee', annee)
          .maybeSingle();
        if (errExisting) throw errExisting;

        const dateEcheance = dateEcheanceFor(annee, mois, c.jour_paiement);

        if (existing) {
          if (!force) {
            skipped++;
            continue;
          }
          const { error: errUpdate } = await supabase
            .from(TABLE)
            .update({
              montant_loyer: c.loyer,
              montant_charges: c.charges_mensuelles,
              date_echeance: dateEcheance,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id);
          if (errUpdate) throw errUpdate;
          updated++;
        } else {
          const { error: errInsert } = await supabase.from(TABLE).insert({
            contrat_id: c.id,
            mois,
            annee,
            montant_loyer: c.loyer,
            montant_charges: c.charges_mensuelles,
            date_echeance: dateEcheance,
            statut: 'EN_ATTENTE',
          });
          if (errInsert) throw errInsert;
          created++;
        }
      }

      return { created, updated, skipped, scanned: contrats.length };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['loyers'] });
    },
  });
}
