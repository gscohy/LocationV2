import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

const TABLE = 'quittances';

export type StatutQuittance = 'GENEREE' | 'ENVOYEE' | 'ANNULEE';
export type ModeEnvoi = 'EMAIL' | 'COURRIER_SIMPLE' | 'LRAR' | 'HUISSIER' | 'MAIN_PROPRE';

interface QuittanceRow {
  id: string;
  loyer_id: string;
  periode: string;
  montant_total: number;
  montant_loyer: number;
  montant_charges: number;
  date_generation: string;
  date_envoi: string | null;
  mode_envoi: ModeEnvoi;
  destinataires: string | null;
  statut: StatutQuittance;
  document_storage_key: string | null;
  email_envoye: boolean | null;
}

interface QuittanceProprietaireRow {
  id: string;
  type: string;
  civilite: string | null;
  nom: string;
  prenom: string | null;
  email: string;
  adresse: string;
  complement_adresse: string | null;
  code_postal: string;
  ville: string;
  pays: string;
  entreprise: string | null;
  signature_data_url: string | null;
}

interface QuittanceLoyerJoin {
  id: string;
  mois: number;
  annee: number;
  statut: string;
  contrats: {
    id: string;
    reference: string | null;
    biens: {
      adresse: string;
      complement_adresse: string | null;
      code_postal: string;
      ville: string;
      bien_proprietaires: Array<{
        quote_part: number;
        proprietaires: QuittanceProprietaireRow | null;
      }>;
    } | null;
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

interface QuittanceRowFull extends QuittanceRow {
  loyers: QuittanceLoyerJoin | null;
}

export interface QuittanceLocataireSummary {
  id: string;
  civilite: string | undefined;
  nom: string;
  prenom: string;
  email: string | undefined;
}

export interface QuittanceProprietaireSummary {
  id: string;
  type: 'PHYSIQUE' | 'MORALE';
  civilite: string | undefined;
  nom: string;
  prenom: string | undefined;
  email: string;
  adresse: string;
  complementAdresse: string | undefined;
  codePostal: string;
  ville: string;
  pays: string;
  entreprise: string | undefined;
  quotePart: number;
  signatureDataUrl: string | undefined;
}

export interface QuittanceLoyerSummary {
  id: string;
  mois: number;
  annee: number;
  bienAdresse: string;
  bienComplementAdresse: string | undefined;
  bienCodePostal: string;
  bienVille: string;
  proprietaires: QuittanceProprietaireSummary[];
  locatairePrincipal: QuittanceLocataireSummary | undefined;
  tousLocataires: QuittanceLocataireSummary[];
}

export interface Quittance {
  id: string;
  loyerId: string;
  loyer: QuittanceLoyerSummary | undefined;
  periode: string;
  montantTotal: number;
  montantLoyer: number;
  montantCharges: number;
  dateGeneration: string;
  dateEnvoi: string | undefined;
  modeEnvoi: ModeEnvoi;
  destinataires: string | undefined;
  statut: StatutQuittance;
}

function rowToQuittance(row: QuittanceRowFull): Quittance {
  const l = row.loyers;
  const cls = l?.contrats?.contrat_locataires ?? [];
  const tousLocataires: QuittanceLocataireSummary[] = cls
    .map((cl) =>
      cl.locataires
        ? {
            id: cl.locataires.id,
            civilite: cl.locataires.civilite ?? undefined,
            nom: cl.locataires.nom,
            prenom: cl.locataires.prenom,
            email: cl.locataires.email ?? undefined,
          }
        : null,
    )
    .filter((x): x is QuittanceLocataireSummary => x !== null);
  const principal =
    cls.find((cl) => cl.est_principal)?.locataires ?? cls[0]?.locataires ?? undefined;

  const props: QuittanceProprietaireSummary[] = (
    l?.contrats?.biens?.bien_proprietaires ?? []
  )
    .map((bp) =>
      bp.proprietaires
        ? {
            id: bp.proprietaires.id,
            type: (bp.proprietaires.type as 'PHYSIQUE' | 'MORALE') ?? 'PHYSIQUE',
            civilite: bp.proprietaires.civilite ?? undefined,
            nom: bp.proprietaires.nom,
            prenom: bp.proprietaires.prenom ?? undefined,
            email: bp.proprietaires.email,
            adresse: bp.proprietaires.adresse,
            complementAdresse: bp.proprietaires.complement_adresse ?? undefined,
            codePostal: bp.proprietaires.code_postal,
            ville: bp.proprietaires.ville,
            pays: bp.proprietaires.pays,
            entreprise: bp.proprietaires.entreprise ?? undefined,
            quotePart: Number(bp.quote_part),
            signatureDataUrl: bp.proprietaires.signature_data_url ?? undefined,
          }
        : null,
    )
    .filter((x): x is QuittanceProprietaireSummary => x !== null)
    .sort((a, b) => b.quotePart - a.quotePart);

  return {
    id: row.id,
    loyerId: row.loyer_id,
    loyer: l
      ? {
          id: l.id,
          mois: l.mois,
          annee: l.annee,
          bienAdresse: l.contrats?.biens?.adresse ?? '— bien inconnu —',
          bienComplementAdresse: l.contrats?.biens?.complement_adresse ?? undefined,
          bienCodePostal: l.contrats?.biens?.code_postal ?? '',
          bienVille: l.contrats?.biens?.ville ?? '',
          proprietaires: props,
          locatairePrincipal: principal
            ? {
                id: principal.id,
                civilite: principal.civilite ?? undefined,
                nom: principal.nom,
                prenom: principal.prenom,
                email: principal.email ?? undefined,
              }
            : undefined,
          tousLocataires,
        }
      : undefined,
    periode: row.periode,
    montantTotal: Number(row.montant_total),
    montantLoyer: Number(row.montant_loyer),
    montantCharges: Number(row.montant_charges),
    dateGeneration: row.date_generation,
    dateEnvoi: row.date_envoi ?? undefined,
    modeEnvoi: row.mode_envoi,
    destinataires: row.destinataires ?? undefined,
    statut: row.statut,
  };
}

const SELECT_FULL =
  '*, loyers(id, mois, annee, statut, contrats(id, reference, biens(adresse, complement_adresse, code_postal, ville, bien_proprietaires(quote_part, proprietaires(id, type, civilite, nom, prenom, email, adresse, complement_adresse, code_postal, ville, pays, entreprise, signature_data_url))), contrat_locataires(est_principal, locataires(id, civilite, nom, prenom, email))))';

const MOIS_LONG = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
];

export function periodeLabel(mois: number, annee: number): string {
  return `${MOIS_LONG[mois - 1]} ${annee}`;
}

export function useQuittances() {
  return useQuery({
    queryKey: ['quittances'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(TABLE)
        .select(SELECT_FULL)
        .order('date_generation', { ascending: false });
      if (error) throw error;
      return ((data ?? []) as unknown as QuittanceRowFull[]).map(rowToQuittance);
    },
  });
}

export function useQuittance(id: string | undefined) {
  return useQuery({
    queryKey: ['quittances', id],
    enabled: Boolean(id),
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from(TABLE)
        .select(SELECT_FULL)
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data ? rowToQuittance(data as unknown as QuittanceRowFull) : null;
    },
  });
}

/** Quittances déjà émises pour ce loyer (utile pour empêcher les doublons). */
export function useQuittancesByLoyer(loyerId: string | undefined) {
  return useQuery({
    queryKey: ['quittances', 'by-loyer', loyerId ?? ''],
    enabled: Boolean(loyerId),
    queryFn: async () => {
      if (!loyerId) return [];
      const { data, error } = await supabase
        .from(TABLE)
        .select(SELECT_FULL)
        .eq('loyer_id', loyerId)
        .order('date_generation', { ascending: false });
      if (error) throw error;
      return ((data ?? []) as unknown as QuittanceRowFull[]).map(rowToQuittance);
    },
  });
}

export interface CreateQuittanceInput {
  loyerId: string;
}

export function useCreateQuittance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateQuittanceInput): Promise<string> => {
      // Vérifie que le loyer est bien PAYE et récupère les infos pour figer le contenu.
      const { data: loyer, error: errLoyer } = await supabase
        .from('loyers')
        .select('id, statut, mois, annee, montant_loyer, montant_charges, montant_total')
        .eq('id', input.loyerId)
        .maybeSingle();
      if (errLoyer) throw errLoyer;
      if (!loyer) throw new Error('Loyer introuvable');

      const l = loyer as {
        id: string;
        statut: string;
        mois: number;
        annee: number;
        montant_loyer: number;
        montant_charges: number;
        montant_total: number;
      };
      if (l.statut !== 'PAYE') {
        throw new Error('La quittance ne peut être émise qu’après paiement complet du loyer.');
      }

      // Annule toute quittance précédente encore valide sur ce loyer.
      const { error: errAnnule } = await supabase
        .from(TABLE)
        .update({ statut: 'ANNULEE' })
        .eq('loyer_id', l.id)
        .neq('statut', 'ANNULEE');
      if (errAnnule) throw errAnnule;

      const periode = periodeLabel(l.mois, l.annee);

      const { data: inserted, error: errInsert } = await supabase
        .from(TABLE)
        .insert({
          loyer_id: l.id,
          periode,
          montant_total: l.montant_total,
          montant_loyer: l.montant_loyer,
          montant_charges: l.montant_charges,
          statut: 'GENEREE',
        })
        .select('id')
        .single();
      if (errInsert) throw errInsert;
      return (inserted as { id: string }).id;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['quittances'] });
    },
  });
}

export function useDeleteQuittance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(TABLE).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['quittances'] });
    },
  });
}

export interface MarkEnvoyeInput {
  id: string;
  modeEnvoi: ModeEnvoi;
  destinataires: string | undefined;
}

export function useMarkQuittanceEnvoyee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: MarkEnvoyeInput) => {
      const { error } = await supabase
        .from(TABLE)
        .update({
          statut: 'ENVOYEE',
          date_envoi: new Date().toISOString(),
          mode_envoi: input.modeEnvoi,
          destinataires: input.destinataires ?? null,
          email_envoye: input.modeEnvoi === 'EMAIL',
        })
        .eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['quittances'] });
    },
  });
}
