import type {
  AuteurResiliation,
  CreateContratInput,
  ModeCharges,
  ModePaiement,
  MotifResiliation,
  ResilierContratInput,
  StatutContrat,
  TypeContrat,
  UsageContrat,
  ZoneGeographique,
} from '@gl/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

const TABLE = 'contrats';

interface ContratRow {
  id: string;
  reference: string | null;
  bien_id: string;
  date_signature: string;
  date_debut: string;
  date_fin: string | null;
  duree_mois: number;
  reconduction_tacite: boolean | null;
  type: TypeContrat;
  usage: string;
  loyer: number;
  charges_mensuelles: number;
  mode_charges: string;
  depot_garantie: number;
  date_encaissement_dg: string | null;
  jour_paiement: number;
  mode_paiement: ModePaiement;
  frais_notaire: number | null;
  frais_huissier: number | null;
  frais_agence_location: number | null;
  zone_geographique: string | null;
  encadrement_loyer: boolean | null;
  loyer_reference: number | null;
  loyer_reference_majore: number | null;
  complement_loyer: number | null;
  irl_active: boolean | null;
  irl_trimestre_ref: number | null;
  irl_annee_ref: number | null;
  irl_valeur_ref: number | null;
  date_prochaine_revision: string | null;
  clauses_particulieres: string | null;
  clause_resolutoire: string | null;
  clause_solidarite: boolean | null;
  commentaires: string | null;
  statut: StatutContrat;
  date_demande_resiliation: string | null;
  auteur_resiliation: string | null;
  motif_resiliation: string | null;
  commentaires_resiliation: string | null;
  date_fin_reelle: string | null;
  preavis_respect: boolean | null;
  date_restitution_dg: string | null;
  montant_dg_restitue: number | null;
  created_at: string;
  updated_at: string;
}

interface ContratLocataireJoin {
  locataire_id: string;
  est_principal: boolean;
  locataires: {
    id: string;
    nom: string;
    prenom: string;
  } | null;
}

interface ContratBienJoin {
  id: string;
  reference: string | null;
  adresse: string;
  code_postal: string;
  ville: string;
}

interface ContratRowFull extends ContratRow {
  contrat_locataires: ContratLocataireJoin[];
  biens: ContratBienJoin | null;
}

export interface ContratLocataireSummary {
  locataireId: string;
  estPrincipal: boolean;
  label: string;
}

export interface ContratBienSummary {
  id: string;
  reference: string | undefined;
  adresse: string;
  codePostal: string;
  ville: string;
}

export interface Contrat {
  id: string;
  reference: string | undefined;
  bienId: string;
  bien: ContratBienSummary | undefined;

  type: TypeContrat;
  usage: UsageContrat;
  statut: StatutContrat;

  dateSignature: string;
  dateDebut: string;
  dateFin: string | undefined;
  dureeMois: number;
  reconductionTacite: boolean;

  loyer: number;
  chargesMensuelles: number;
  modeCharges: ModeCharges;
  depotGarantie: number;
  dateEncaissementDg: string | undefined;
  jourPaiement: number;
  modePaiement: ModePaiement;

  fraisNotaire: number;
  fraisHuissier: number;
  fraisAgenceLocation: number;

  zoneGeographique: ZoneGeographique | undefined;
  encadrementLoyer: boolean;
  loyerReference: number | undefined;
  loyerReferenceMajore: number | undefined;
  complementLoyer: number | undefined;

  irlActive: boolean;
  irlTrimestreRef: number | undefined;
  irlAnneeRef: number | undefined;
  irlValeurRef: number | undefined;
  dateProchaineRevision: string | undefined;

  clausesParticulieres: string | undefined;
  clauseResolutoire: string | undefined;
  clauseSolidarite: boolean;
  commentaires: string | undefined;

  // Résiliation
  dateDemandeResiliation: string | undefined;
  auteurResiliation: AuteurResiliation | undefined;
  motifResiliation: MotifResiliation | undefined;
  commentairesResiliation: string | undefined;
  dateFinReelle: string | undefined;
  preavisRespect: boolean | undefined;
  dateRestitutionDg: string | undefined;
  montantDgRestitue: number | undefined;

  locataires: ContratLocataireSummary[];
  createdAt: string;
}

function rowToContrat(row: ContratRowFull): Contrat {
  return {
    id: row.id,
    reference: row.reference ?? undefined,
    bienId: row.bien_id,
    bien: row.biens
      ? {
          id: row.biens.id,
          reference: row.biens.reference ?? undefined,
          adresse: row.biens.adresse,
          codePostal: row.biens.code_postal,
          ville: row.biens.ville,
        }
      : undefined,

    type: row.type,
    usage: (row.usage as UsageContrat) ?? 'RESIDENCE_PRINCIPALE',
    statut: row.statut,

    dateSignature: row.date_signature,
    dateDebut: row.date_debut,
    dateFin: row.date_fin ?? undefined,
    dureeMois: row.duree_mois,
    reconductionTacite: row.reconduction_tacite ?? true,

    loyer: row.loyer,
    chargesMensuelles: row.charges_mensuelles,
    modeCharges: (row.mode_charges as ModeCharges) ?? 'PROVISION_REGULARISATION',
    depotGarantie: row.depot_garantie,
    dateEncaissementDg: row.date_encaissement_dg ?? undefined,
    jourPaiement: row.jour_paiement,
    modePaiement: row.mode_paiement,

    fraisNotaire: row.frais_notaire ?? 0,
    fraisHuissier: row.frais_huissier ?? 0,
    fraisAgenceLocation: row.frais_agence_location ?? 0,

    zoneGeographique: (row.zone_geographique as ZoneGeographique) ?? undefined,
    encadrementLoyer: row.encadrement_loyer ?? false,
    loyerReference: row.loyer_reference ?? undefined,
    loyerReferenceMajore: row.loyer_reference_majore ?? undefined,
    complementLoyer: row.complement_loyer ?? undefined,

    irlActive: row.irl_active ?? false,
    irlTrimestreRef: row.irl_trimestre_ref ?? undefined,
    irlAnneeRef: row.irl_annee_ref ?? undefined,
    irlValeurRef: row.irl_valeur_ref ?? undefined,
    dateProchaineRevision: row.date_prochaine_revision ?? undefined,

    clausesParticulieres: row.clauses_particulieres ?? undefined,
    clauseResolutoire: row.clause_resolutoire ?? undefined,
    clauseSolidarite: row.clause_solidarite ?? false,
    commentaires: row.commentaires ?? undefined,

    dateDemandeResiliation: row.date_demande_resiliation ?? undefined,
    auteurResiliation: (row.auteur_resiliation as AuteurResiliation) ?? undefined,
    motifResiliation: (row.motif_resiliation as MotifResiliation) ?? undefined,
    commentairesResiliation: row.commentaires_resiliation ?? undefined,
    dateFinReelle: row.date_fin_reelle ?? undefined,
    preavisRespect: row.preavis_respect ?? undefined,
    dateRestitutionDg: row.date_restitution_dg ?? undefined,
    montantDgRestitue: row.montant_dg_restitue ?? undefined,

    locataires: (row.contrat_locataires ?? []).map((cl) => ({
      locataireId: cl.locataire_id,
      estPrincipal: cl.est_principal,
      label: cl.locataires ? `${cl.locataires.prenom} ${cl.locataires.nom}` : '— inconnu —',
    })),
    createdAt: row.created_at,
  };
}

const dateOnly = (d: Date | string | undefined) =>
  d ? new Date(d).toISOString().slice(0, 10) : null;

function inputToInsert(input: CreateContratInput) {
  return {
    reference: input.reference ?? null,
    bien_id: input.bienId,
    date_signature: dateOnly(input.dateSignature),
    date_debut: dateOnly(input.dateDebut),
    date_fin: dateOnly(input.dateFin),
    duree_mois: input.dureeMois,
    reconduction_tacite: input.reconductionTacite,
    type: input.type,
    usage: input.usage,
    loyer: input.loyer,
    charges_mensuelles: input.chargesMensuelles,
    mode_charges: input.modeCharges,
    depot_garantie: input.depotGarantie,
    date_encaissement_dg: dateOnly(input.dateEncaissementDg),
    jour_paiement: input.jourPaiement,
    mode_paiement: input.modePaiement,
    frais_notaire: input.fraisNotaire,
    frais_huissier: input.fraisHuissier,
    frais_agence_location: input.fraisAgenceLocation,
    zone_geographique: input.zoneGeographique ?? null,
    encadrement_loyer: input.encadrementLoyer,
    loyer_reference: input.loyerReference ?? null,
    loyer_reference_majore: input.loyerReferenceMajore ?? null,
    complement_loyer: input.complementLoyer ?? null,
    irl_active: input.irlActive,
    irl_trimestre_ref: input.irlTrimestreRef ?? null,
    irl_annee_ref: input.irlAnneeRef ?? null,
    irl_valeur_ref: input.irlValeurRef ?? null,
    clauses_particulieres: input.clausesParticulieres ?? null,
    clause_resolutoire: input.clauseResolutoire ?? null,
    clause_solidarite: input.clauseSolidarite,
    commentaires: input.commentaires ?? null,
    statut: input.statut,
  };
}

const SELECT_FULL =
  '*, contrat_locataires(locataire_id, est_principal, locataires(id, nom, prenom)), biens(id, reference, adresse, code_postal, ville)';

const contratsQueryKey = ['contrats'] as const;

export function useContrats() {
  return useQuery({
    queryKey: contratsQueryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from(TABLE)
        .select(SELECT_FULL)
        .order('date_debut', { ascending: false });
      if (error) throw error;
      return ((data ?? []) as unknown as ContratRowFull[]).map(rowToContrat);
    },
  });
}

async function syncLocatairesAssoc(
  contratId: string,
  locataireIds: string[],
  locataireIdPrincipal: string,
  removeFirst: boolean,
) {
  if (removeFirst) {
    const { error } = await supabase
      .from('contrat_locataires')
      .delete()
      .eq('contrat_id', contratId);
    if (error) throw error;
  }
  if (locataireIds.length > 0) {
    const rows = locataireIds.map((id) => ({
      contrat_id: contratId,
      locataire_id: id,
      est_principal: id === locataireIdPrincipal,
    }));
    const { error } = await supabase.from('contrat_locataires').insert(rows);
    if (error) throw error;
  }
}

export function useCreateContrat() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateContratInput) => {
      const { data, error } = await supabase
        .from(TABLE)
        .insert(inputToInsert(input))
        .select('id')
        .single();
      if (error) throw error;
      const id = (data as { id: string }).id;
      try {
        await syncLocatairesAssoc(id, input.locataireIds, input.locataireIdPrincipal, false);
      } catch (e) {
        await supabase.from(TABLE).delete().eq('id', id);
        throw e;
      }
      return id;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: contratsQueryKey });
    },
  });
}

export function useUpdateContrat() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: CreateContratInput }) => {
      const update = { ...inputToInsert(input), updated_at: new Date().toISOString() };
      const { error } = await supabase.from(TABLE).update(update).eq('id', id);
      if (error) throw error;
      await syncLocatairesAssoc(id, input.locataireIds, input.locataireIdPrincipal, true);
      return id;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: contratsQueryKey });
    },
  });
}

export function useDeleteContrat() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(TABLE).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: contratsQueryKey });
    },
  });
}

export function useResilierContrat() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: ResilierContratInput }) => {
      const update = {
        statut: 'RESILIE' as StatutContrat,
        date_demande_resiliation: dateOnly(input.dateDemandeResiliation),
        auteur_resiliation: input.auteurResiliation,
        motif_resiliation: input.motifResiliation,
        date_fin_reelle: dateOnly(input.dateFinReelle),
        preavis_respect: input.preavisRespect,
        date_restitution_dg: dateOnly(input.dateRestitutionDg),
        montant_dg_restitue: input.montantDgRestitue ?? null,
        commentaires_resiliation: input.commentairesResiliation ?? null,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from(TABLE).update(update).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: contratsQueryKey });
    },
  });
}
