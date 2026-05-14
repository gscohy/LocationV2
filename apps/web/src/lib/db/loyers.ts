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
  bienId: string;
  bienAdresse: string;
  bienVille: string;
  locatairePrincipalLabel: string;
  /** Ids de tous les locataires du contrat (utile pour le filtrage côté liste). */
  locataireIds: string[];
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
          bienId: c.biens?.id ?? '',
          bienAdresse: c.biens?.adresse ?? '— bien inconnu —',
          bienVille: c.biens ? `${c.biens.code_postal} ${c.biens.ville}` : '',
          locatairePrincipalLabel: loc ? `${loc.prenom} ${loc.nom}` : '— sans locataire —',
          locataireIds: (c.contrat_locataires ?? [])
            .map((cl) => cl.locataires?.id)
            .filter((x): x is string => Boolean(x)),
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
      // 1. Récupérer les paiement_id qui ont une ventilation sur ce loyer.
      const { data: ventils, error: errVentils } = await supabase
        .from('paiement_ventilations')
        .select('paiement_id')
        .eq('loyer_id', id);
      if (errVentils) throw errVentils;
      const paiementIds = Array.from(
        new Set(
          ((ventils ?? []) as { paiement_id: string }[]).map((v) => v.paiement_id),
        ),
      );

      // 2. Supprimer le loyer (cascade SQL : ventilations, quittances, rappels).
      const { error } = await supabase.from(TABLE).delete().eq('id', id);
      if (error) throw error;

      // 3. Pour chaque paiement qui pointait sur ce loyer, vérifier s'il a
      //    encore d'autres ventilations. Sinon, le supprimer (paiement orphelin).
      for (const paiementId of paiementIds) {
        const { data: restantes, error: errRest } = await supabase
          .from('paiement_ventilations')
          .select('id')
          .eq('paiement_id', paiementId)
          .limit(1);
        if (errRest) throw errRest;
        if (!restantes || restantes.length === 0) {
          const { error: errDel } = await supabase
            .from('paiements')
            .delete()
            .eq('id', paiementId);
          if (errDel) throw errDel;
        }
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['loyers'] });
      void queryClient.invalidateQueries({ queryKey: ['paiements'] });
      void queryClient.invalidateQueries({ queryKey: ['paiement-ventilations'] });
      void queryClient.invalidateQueries({ queryKey: ['quittances'] });
      void queryClient.invalidateQueries({ queryKey: ['rappels'] });
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

  const payloadAvecFlag = {
    contrat_id: contratId,
    mois,
    annee,
    montant_loyer: c.loyer,
    montant_charges: c.charges_mensuelles,
    date_echeance: dateEcheance,
    statut: 'EN_ATTENTE' as const,
    auto_genere_par_surplus: true,
  };

  const tryInsert = (payload: Record<string, unknown>) =>
    supabase.from(TABLE).insert(payload).select('id').single();

  let inserted: { id: string } | null = null;
  let errInsert = null as unknown;

  const first = await tryInsert(payloadAvecFlag);
  if (first.error) {
    // Si la migration `auto_genere_par_surplus` n'a pas encore été appliquée côté
    // cloud, PostgREST renvoie une erreur "Could not find the 'auto_genere_par_surplus'
    // column". On retry sans le flag pour que la fonctionnalité reste opérante.
    const msg = first.error.message ?? '';
    if (msg.includes('auto_genere_par_surplus') || first.error.code === 'PGRST204') {
      const { auto_genere_par_surplus: _drop, ...payloadSansFlag } = payloadAvecFlag;
      void _drop;
      const fallback = await tryInsert(payloadSansFlag);
      if (fallback.error) {
        errInsert = fallback.error;
      } else {
        inserted = fallback.data as { id: string };
      }
    } else {
      errInsert = first.error;
    }
  } else {
    inserted = first.data as { id: string };
  }

  if (errInsert) throw errInsert;
  if (!inserted) throw new Error('Échec de création du loyer (réponse vide)');
  return { id: inserted.id, created: true };
}

/**
 * Supprime un loyer s'il est orphelin : auto-créé pour absorber un surplus,
 * sans aucune ventilation de paiement, et avec `montant_paye = 0`.
 * No-op sinon. Appelée après les opérations de paiement (delete/update) pour
 * éviter de laisser des loyers fantômes en BDD.
 */
export async function cleanupOrphanLoyer(loyerId: string): Promise<boolean> {
  const { data: loyer, error: errLoyer } = await supabase
    .from(TABLE)
    .select('id, auto_genere_par_surplus, montant_paye')
    .eq('id', loyerId)
    .maybeSingle();
  if (errLoyer) throw errLoyer;
  if (!loyer) return false;

  const l = loyer as { id: string; auto_genere_par_surplus: boolean | null; montant_paye: number };
  if (!l.auto_genere_par_surplus) return false;
  if (Number(l.montant_paye) > 0.005) return false;

  // Vérifier qu'aucune ventilation ne pointe encore sur ce loyer.
  const { data: ventils, error: errVentils } = await supabase
    .from('paiement_ventilations')
    .select('id')
    .eq('loyer_id', l.id)
    .limit(1);
  if (errVentils) throw errVentils;
  if ((ventils ?? []).length > 0) return false;

  // Pas de quittance non plus (sécurité).
  const { data: quittances, error: errQ } = await supabase
    .from('quittances')
    .select('id')
    .eq('loyer_id', l.id)
    .limit(1);
  if (errQ) throw errQ;
  if ((quittances ?? []).length > 0) return false;

  const { error: errDel } = await supabase.from(TABLE).delete().eq('id', l.id);
  if (errDel) throw errDel;
  return true;
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
