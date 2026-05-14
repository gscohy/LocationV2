import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

const TABLE = 'rappels';

export type TypeRappel =
  | 'RAPPEL_AMIABLE'
  | 'RELANCE'
  | 'MISE_EN_DEMEURE'
  | 'COMMANDEMENT_PAYER'
  | 'ASSIGNATION';

export type ModeEnvoi = 'EMAIL' | 'COURRIER_SIMPLE' | 'LRAR' | 'HUISSIER' | 'MAIN_PROPRE';

interface RappelRow {
  id: string;
  loyer_id: string;
  type: TypeRappel;
  destinataires: string;
  sujet: string;
  contenu: string;
  date_envoi_planifie: string | null;
  date_envoi_effectif: string | null;
  mode_envoi: ModeEnvoi;
  envoye: boolean | null;
  frais_engages: number | null;
  commentaires: string | null;
  created_at: string;
}

interface RappelLoyerJoin {
  id: string;
  mois: number;
  annee: number;
  montant_total: number;
  montant_paye: number;
  statut: string;
  date_echeance: string;
  contrats: {
    id: string;
    biens: { adresse: string; code_postal: string; ville: string } | null;
    contrat_locataires: Array<{
      est_principal: boolean;
      locataires: {
        id: string;
        civilite: string | null;
        nom: string;
        prenom: string;
        email: string | null;
      } | null;
    }>;
  } | null;
}

interface RappelRowFull extends RappelRow {
  loyers: RappelLoyerJoin | null;
}

export interface RappelLoyerSummary {
  id: string;
  mois: number;
  annee: number;
  montantTotal: number;
  montantPaye: number;
  soldeRestant: number;
  statut: string;
  dateEcheance: string;
  bienAdresse: string;
  bienCodePostal: string;
  bienVille: string;
  locatairePrincipalLabel: string;
}

export interface Rappel {
  id: string;
  loyerId: string;
  loyer: RappelLoyerSummary | undefined;
  type: TypeRappel;
  destinataires: string;
  sujet: string;
  contenu: string;
  datePlanifiee: string | undefined;
  dateEnvoi: string | undefined;
  modeEnvoi: ModeEnvoi;
  envoye: boolean;
  fraisEngages: number | undefined;
  commentaires: string | undefined;
  createdAt: string;
}

function rowToRappel(row: RappelRowFull): Rappel {
  const l = row.loyers;
  const cls = l?.contrats?.contrat_locataires ?? [];
  const principal =
    cls.find((cl) => cl.est_principal)?.locataires ?? cls[0]?.locataires ?? undefined;

  return {
    id: row.id,
    loyerId: row.loyer_id,
    loyer: l
      ? {
          id: l.id,
          mois: l.mois,
          annee: l.annee,
          montantTotal: Number(l.montant_total),
          montantPaye: Number(l.montant_paye),
          soldeRestant: Math.max(0, Number(l.montant_total) - Number(l.montant_paye)),
          statut: l.statut,
          dateEcheance: l.date_echeance,
          bienAdresse: l.contrats?.biens?.adresse ?? '— bien inconnu —',
          bienCodePostal: l.contrats?.biens?.code_postal ?? '',
          bienVille: l.contrats?.biens?.ville ?? '',
          locatairePrincipalLabel: principal
            ? `${principal.prenom} ${principal.nom}`
            : '— sans locataire —',
        }
      : undefined,
    type: row.type,
    destinataires: row.destinataires,
    sujet: row.sujet,
    contenu: row.contenu,
    datePlanifiee: row.date_envoi_planifie ?? undefined,
    dateEnvoi: row.date_envoi_effectif ?? undefined,
    modeEnvoi: row.mode_envoi,
    envoye: Boolean(row.envoye),
    fraisEngages: row.frais_engages !== null ? Number(row.frais_engages) : undefined,
    commentaires: row.commentaires ?? undefined,
    createdAt: row.created_at,
  };
}

const SELECT_FULL =
  '*, loyers(id, mois, annee, montant_total, montant_paye, statut, date_echeance, contrats(id, biens(adresse, code_postal, ville), contrat_locataires(est_principal, locataires(id, civilite, nom, prenom, email))))';

export interface RappelsFilters {
  type?: TypeRappel;
  envoye?: boolean;
  loyerId?: string;
}

export function useRappels(filters: RappelsFilters = {}) {
  return useQuery({
    queryKey: ['rappels', filters],
    queryFn: async () => {
      let q = supabase
        .from(TABLE)
        .select(SELECT_FULL)
        .order('created_at', { ascending: false });
      if (filters.type) q = q.eq('type', filters.type);
      if (filters.envoye !== undefined) q = q.eq('envoye', filters.envoye);
      if (filters.loyerId) q = q.eq('loyer_id', filters.loyerId);
      const { data, error } = await q;
      if (error) throw error;
      return ((data ?? []) as unknown as RappelRowFull[]).map(rowToRappel);
    },
  });
}

export interface CreateRappelInput {
  loyerId: string;
  type: TypeRappel;
  destinataires: string;
  sujet: string;
  contenu: string;
  modeEnvoi: ModeEnvoi;
  fraisEngages: number | undefined;
  commentaires: string | undefined;
  /** Si true, marque le rappel comme envoyé immédiatement (cas où l'utilisateur envoie hors-app). */
  marquerEnvoye: boolean;
}

export function useCreateRappel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateRappelInput): Promise<string> => {
      const now = new Date().toISOString();
      const { data: inserted, error } = await supabase
        .from(TABLE)
        .insert({
          loyer_id: input.loyerId,
          type: input.type,
          destinataires: input.destinataires,
          sujet: input.sujet,
          contenu: input.contenu,
          mode_envoi: input.modeEnvoi,
          envoye: input.marquerEnvoye,
          date_envoi_effectif: input.marquerEnvoye ? now : null,
          frais_engages: input.fraisEngages ?? null,
          commentaires: input.commentaires ?? null,
        })
        .select('id')
        .single();
      if (error) throw error;
      return (inserted as { id: string }).id;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['rappels'] });
    },
  });
}

export function useMarkRappelEnvoye() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from(TABLE)
        .update({
          envoye: true,
          date_envoi_effectif: new Date().toISOString(),
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['rappels'] });
    },
  });
}

export function useDeleteRappel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(TABLE).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['rappels'] });
    },
  });
}
