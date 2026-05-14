import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { cleanupOrphanLoyer } from '@/lib/db/loyers';
import { supabase } from '@/lib/supabase';

const TABLE_PAIEMENTS = 'paiements';
const TABLE_VENTILATIONS = 'paiement_ventilations';

export type ModePaiement =
  | 'VIREMENT'
  | 'PRELEVEMENT'
  | 'CHEQUE'
  | 'ESPECES'
  | 'CAF'
  | 'PAYLIB'
  | 'AUTRE';

interface PaiementRow {
  id: string;
  montant: number;
  date_reception: string;
  date_valeur_bancaire: string | null;
  mode: ModePaiement;
  payeur: string;
  reference: string | null;
  commentaire: string | null;
  created_at: string;
}

interface VentilationJoin {
  id: string;
  loyer_id: string;
  montant: number;
  loyers: {
    id: string;
    mois: number;
    annee: number;
    montant_total: number;
    contrats: {
      id: string;
      reference: string | null;
      biens: { adresse: string; code_postal: string; ville: string } | null;
    } | null;
  } | null;
}

interface PaiementRowFull extends PaiementRow {
  paiement_ventilations: VentilationJoin[];
}

export interface VentilationSummary {
  id: string;
  loyerId: string;
  montant: number;
  loyerLabel: string;
}

export interface Paiement {
  id: string;
  montant: number;
  dateReception: string;
  dateValeurBancaire: string | undefined;
  mode: ModePaiement;
  payeur: string;
  reference: string | undefined;
  commentaire: string | undefined;
  ventilations: VentilationSummary[];
  createdAt: string;
}

const MOIS_COURT = [
  'janv.',
  'févr.',
  'mars',
  'avr.',
  'mai',
  'juin',
  'juil.',
  'août',
  'sept.',
  'oct.',
  'nov.',
  'déc.',
];

function ventilationLabel(v: VentilationJoin): string {
  if (!v.loyers) return '— loyer supprimé —';
  const l = v.loyers;
  const periode = `${MOIS_COURT[l.mois - 1]} ${l.annee}`;
  const bien = l.contrats?.biens?.adresse ?? 'bien inconnu';
  return `${periode} — ${bien}`;
}

function rowToPaiement(row: PaiementRowFull): Paiement {
  return {
    id: row.id,
    montant: Number(row.montant),
    dateReception: row.date_reception,
    dateValeurBancaire: row.date_valeur_bancaire ?? undefined,
    mode: row.mode,
    payeur: row.payeur,
    reference: row.reference ?? undefined,
    commentaire: row.commentaire ?? undefined,
    ventilations: (row.paiement_ventilations ?? []).map((v) => ({
      id: v.id,
      loyerId: v.loyer_id,
      montant: Number(v.montant),
      loyerLabel: ventilationLabel(v),
    })),
    createdAt: row.created_at,
  };
}

const SELECT_FULL =
  '*, paiement_ventilations(id, loyer_id, montant, loyers(id, mois, annee, montant_total, contrats(id, reference, biens(adresse, code_postal, ville))))';

export interface PaiementsFilters {
  dateMin?: string;
  dateMax?: string;
  mode?: ModePaiement;
}

const paiementsQueryKey = (filters: PaiementsFilters) => ['paiements', filters] as const;

export function usePaiements(filters: PaiementsFilters = {}) {
  return useQuery({
    queryKey: paiementsQueryKey(filters),
    queryFn: async () => {
      let q = supabase
        .from(TABLE_PAIEMENTS)
        .select(SELECT_FULL)
        .order('date_reception', { ascending: false });
      if (filters.dateMin) q = q.gte('date_reception', filters.dateMin);
      if (filters.dateMax) q = q.lte('date_reception', filters.dateMax);
      if (filters.mode) q = q.eq('mode', filters.mode);
      const { data, error } = await q;
      if (error) throw error;
      return ((data ?? []) as unknown as PaiementRowFull[]).map(rowToPaiement);
    },
  });
}

/**
 * Recalcule `montant_paye` et `statut` d'un loyer à partir de la somme actuelle
 * de ses ventilations. À appeler après tout ajout/suppression/édition de paiement
 * ou pour resynchroniser un loyer dont l'état serait devenu incohérent.
 */
export async function recalcLoyerStatut(loyerId: string) {
  const { data: loyer, error: errLoyer } = await supabase
    .from('loyers')
    .select('id, montant_total')
    .eq('id', loyerId)
    .maybeSingle();
  if (errLoyer) throw errLoyer;
  if (!loyer) return;

  const { data: ventils, error: errVentils } = await supabase
    .from(TABLE_VENTILATIONS)
    .select('montant, paiements(date_reception)')
    .eq('loyer_id', loyerId);
  if (errVentils) throw errVentils;

  type VentilRow = { montant: number; paiements: { date_reception: string } | null };
  const rows = (ventils ?? []) as unknown as VentilRow[];

  const totalPaye = rows.reduce((s, v) => s + Number(v.montant), 0);
  const total = Number(loyer.montant_total);
  const derniereDate = rows
    .map((v) => v.paiements?.date_reception)
    .filter((d): d is string => Boolean(d))
    .sort()
    .at(-1);

  let statut: 'EN_ATTENTE' | 'PARTIEL' | 'PAYE';
  let datePaiementComplet: string | null;
  if (totalPaye >= total - 0.005) {
    statut = 'PAYE';
    datePaiementComplet = derniereDate ?? null;
  } else if (totalPaye > 0) {
    statut = 'PARTIEL';
    datePaiementComplet = null;
  } else {
    statut = 'EN_ATTENTE';
    datePaiementComplet = null;
  }

  const { error: errUpdate } = await supabase
    .from('loyers')
    .update({
      montant_paye: totalPaye,
      statut,
      date_paiement_complet: datePaiementComplet,
      updated_at: new Date().toISOString(),
    })
    .eq('id', loyerId);
  if (errUpdate) throw errUpdate;
}

export interface CreatePaiementVentilation {
  loyerId: string;
  montant: number;
}

export interface CreatePaiementInput {
  montant: number;
  dateReception: string;
  dateValeurBancaire: string | undefined;
  mode: ModePaiement;
  payeur: string;
  reference: string | undefined;
  commentaire: string | undefined;
  ventilations: CreatePaiementVentilation[];
}

export function useCreatePaiement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreatePaiementInput) => {
      const { data: created, error: errInsert } = await supabase
        .from(TABLE_PAIEMENTS)
        .insert({
          montant: input.montant,
          date_reception: input.dateReception,
          date_valeur_bancaire: input.dateValeurBancaire ?? null,
          mode: input.mode,
          payeur: input.payeur,
          reference: input.reference ?? null,
          commentaire: input.commentaire ?? null,
        })
        .select('id')
        .single();
      if (errInsert) throw errInsert;
      const paiementId = (created as { id: string }).id;

      try {
        const rows = input.ventilations.map((v) => ({
          paiement_id: paiementId,
          loyer_id: v.loyerId,
          montant: v.montant,
        }));
        const { error: errVentils } = await supabase.from(TABLE_VENTILATIONS).insert(rows);
        if (errVentils) throw errVentils;

        const loyerIdsUniques = Array.from(new Set(input.ventilations.map((v) => v.loyerId)));
        for (const loyerId of loyerIdsUniques) {
          await recalcLoyerStatut(loyerId);
        }
      } catch (err) {
        await supabase.from(TABLE_PAIEMENTS).delete().eq('id', paiementId);
        throw err;
      }

      return paiementId;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['paiements'] });
      void queryClient.invalidateQueries({ queryKey: ['loyers'] });
    },
  });
}

export interface UpdatePaiementInput {
  id: string;
  montant: number;
  dateReception: string;
  dateValeurBancaire: string | undefined;
  mode: ModePaiement;
  payeur: string;
  reference: string | undefined;
  commentaire: string | undefined;
  ventilations: CreatePaiementVentilation[];
}

export function useUpdatePaiement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdatePaiementInput) => {
      // 1. Lire les anciennes ventilations pour connaître les loyers à recalculer.
      const { data: anciennes, error: errAnciennes } = await supabase
        .from(TABLE_VENTILATIONS)
        .select('loyer_id')
        .eq('paiement_id', input.id);
      if (errAnciennes) throw errAnciennes;
      const anciensLoyerIds = ((anciennes ?? []) as { loyer_id: string }[]).map(
        (v) => v.loyer_id,
      );

      // 2. Mettre à jour le paiement.
      const { error: errUpdate } = await supabase
        .from(TABLE_PAIEMENTS)
        .update({
          montant: input.montant,
          date_reception: input.dateReception,
          date_valeur_bancaire: input.dateValeurBancaire ?? null,
          mode: input.mode,
          payeur: input.payeur,
          reference: input.reference ?? null,
          commentaire: input.commentaire ?? null,
        })
        .eq('id', input.id);
      if (errUpdate) throw errUpdate;

      // 3. Remplacer les ventilations (delete + insert — pas de transaction côté JS,
      //    on accepte le risque court d'incohérence si l'insert échoue).
      const { error: errDelete } = await supabase
        .from(TABLE_VENTILATIONS)
        .delete()
        .eq('paiement_id', input.id);
      if (errDelete) throw errDelete;

      const rows = input.ventilations.map((v) => ({
        paiement_id: input.id,
        loyer_id: v.loyerId,
        montant: v.montant,
      }));
      const { error: errInsert } = await supabase.from(TABLE_VENTILATIONS).insert(rows);
      if (errInsert) throw errInsert;

      // 4. Recalculer le statut de tous les loyers impactés (anciens ∪ nouveaux).
      const tousLoyerIds = Array.from(
        new Set([...anciensLoyerIds, ...input.ventilations.map((v) => v.loyerId)]),
      );
      for (const loyerId of tousLoyerIds) {
        await recalcLoyerStatut(loyerId);
      }
      // 5. Nettoyer les loyers orphelins (auto-créés pour absorber un surplus
      //    qui a disparu suite à cette modification).
      for (const loyerId of anciensLoyerIds) {
        if (!input.ventilations.some((v) => v.loyerId === loyerId)) {
          await cleanupOrphanLoyer(loyerId);
        }
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['paiements'] });
      void queryClient.invalidateQueries({ queryKey: ['loyers'] });
      void queryClient.invalidateQueries({ queryKey: ['paiement-ventilations'] });
    },
  });
}

export function useRecalcLoyer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (loyerId: string) => {
      await recalcLoyerStatut(loyerId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['loyers'] });
      void queryClient.invalidateQueries({ queryKey: ['paiements'] });
      void queryClient.invalidateQueries({ queryKey: ['paiement-ventilations'] });
    },
  });
}

export function useDeletePaiement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: ventils, error: errSelect } = await supabase
        .from(TABLE_VENTILATIONS)
        .select('loyer_id')
        .eq('paiement_id', id);
      if (errSelect) throw errSelect;
      const loyerIds = Array.from(
        new Set(((ventils ?? []) as { loyer_id: string }[]).map((v) => v.loyer_id)),
      );

      const { error } = await supabase.from(TABLE_PAIEMENTS).delete().eq('id', id);
      if (error) throw error;

      for (const loyerId of loyerIds) {
        await recalcLoyerStatut(loyerId);
        // Nettoyer les loyers auto-générés devenus orphelins suite à la suppression.
        await cleanupOrphanLoyer(loyerId);
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['paiements'] });
      void queryClient.invalidateQueries({ queryKey: ['loyers'] });
    },
  });
}
