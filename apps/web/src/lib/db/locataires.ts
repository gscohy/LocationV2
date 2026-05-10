import type {
  Civilite,
  CreateLocataireInput,
  SituationMatrimoniale,
  TypeContratTravail,
  TypeGarantie,
  TypePieceIdentite,
  UpdateLocataireInput,
} from '@gl/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

const TABLE = 'locataires';

interface LocataireRow {
  id: string;
  civilite: Civilite;
  nom: string;
  nom_naissance: string | null;
  prenom: string;
  autres_prenoms: string | null;
  date_naissance: string;
  lieu_naissance: string;
  pays_naissance: string | null;
  nationalite: string | null;
  numero_piece_identite: string | null;
  type_piece_identite: string | null;
  email: string;
  telephone_mobile: string;
  telephone_fixe: string | null;
  adresse_precedente: string | null;
  code_postal_precedent: string | null;
  ville_precedente: string | null;
  profession: string | null;
  employeur: string | null;
  type_contrat_travail: string | null;
  date_embauche: string | null;
  revenus_mensuels: number | null;
  autres_revenus: number | null;
  situation_matrimoniale: string | null;
  nombre_enfants: number | null;
  numero_caf: string | null;
  commentaires: string | null;
  created_at: string;
  updated_at: string;
}

interface LocataireGarantJoin {
  garant_id: string;
  garants: {
    id: string;
    nom: string;
    prenom: string;
    type_garantie: TypeGarantie;
  } | null;
}

interface LocataireRowWithGarants extends LocataireRow {
  locataire_garants: LocataireGarantJoin[];
}

export interface LocataireGarantSummary {
  garantId: string;
  label: string;
  typeGarantie: TypeGarantie;
}

export interface Locataire {
  id: string;
  civilite: Civilite;
  nom: string;
  nomNaissance: string | undefined;
  prenom: string;
  autresPrenoms: string | undefined;

  dateNaissance: string;
  lieuNaissance: string;
  paysNaissance: string | undefined;
  nationalite: string | undefined;

  typePieceIdentite: TypePieceIdentite | undefined;
  numeroPieceIdentite: string | undefined;

  email: string;
  telephoneMobile: string;
  telephoneFixe: string | undefined;

  adressePrecedente: string | undefined;
  codePostalPrecedent: string | undefined;
  villePrecedente: string | undefined;

  profession: string | undefined;
  employeur: string | undefined;
  typeContratTravail: TypeContratTravail | undefined;
  dateEmbauche: string | undefined;

  revenusMensuels: number | undefined;
  autresRevenus: number | undefined;

  situationMatrimoniale: SituationMatrimoniale | undefined;
  nombreEnfants: number | undefined;
  numeroCaf: string | undefined;

  commentaires: string | undefined;

  garants: LocataireGarantSummary[];
  createdAt: string;
}

function rowToLocataire(row: LocataireRowWithGarants): Locataire {
  return {
    id: row.id,
    civilite: row.civilite,
    nom: row.nom,
    nomNaissance: row.nom_naissance ?? undefined,
    prenom: row.prenom,
    autresPrenoms: row.autres_prenoms ?? undefined,

    dateNaissance: row.date_naissance,
    lieuNaissance: row.lieu_naissance,
    paysNaissance: row.pays_naissance ?? undefined,
    nationalite: row.nationalite ?? undefined,

    typePieceIdentite: (row.type_piece_identite as TypePieceIdentite) ?? undefined,
    numeroPieceIdentite: row.numero_piece_identite ?? undefined,

    email: row.email,
    telephoneMobile: row.telephone_mobile,
    telephoneFixe: row.telephone_fixe ?? undefined,

    adressePrecedente: row.adresse_precedente ?? undefined,
    codePostalPrecedent: row.code_postal_precedent ?? undefined,
    villePrecedente: row.ville_precedente ?? undefined,

    profession: row.profession ?? undefined,
    employeur: row.employeur ?? undefined,
    typeContratTravail: (row.type_contrat_travail as TypeContratTravail) ?? undefined,
    dateEmbauche: row.date_embauche ?? undefined,

    revenusMensuels: row.revenus_mensuels ?? undefined,
    autresRevenus: row.autres_revenus ?? undefined,

    situationMatrimoniale: (row.situation_matrimoniale as SituationMatrimoniale) ?? undefined,
    nombreEnfants: row.nombre_enfants ?? undefined,
    numeroCaf: row.numero_caf ?? undefined,

    commentaires: row.commentaires ?? undefined,

    garants: (row.locataire_garants ?? []).map((lg) => ({
      garantId: lg.garant_id,
      label: lg.garants ? `${lg.garants.prenom} ${lg.garants.nom}` : '— inconnu —',
      typeGarantie: lg.garants?.type_garantie ?? 'PHYSIQUE',
    })),
    createdAt: row.created_at,
  };
}

const dateOnly = (d: Date | undefined) =>
  d ? new Date(d).toISOString().slice(0, 10) : null;

function inputToInsert(input: CreateLocataireInput) {
  return {
    civilite: input.civilite,
    nom: input.nom,
    nom_naissance: input.nomNaissance ?? null,
    prenom: input.prenom,
    autres_prenoms: input.autresPrenoms ?? null,

    date_naissance: dateOnly(input.dateNaissance) ?? '',
    lieu_naissance: input.lieuNaissance,
    pays_naissance: input.paysNaissance ?? null,
    nationalite: input.nationalite ?? null,

    type_piece_identite: input.typePieceIdentite ?? null,
    numero_piece_identite: input.numeroPieceIdentite ?? null,

    email: input.email,
    telephone_mobile: input.telephoneMobile,
    telephone_fixe: input.telephoneFixe ?? null,

    adresse_precedente: input.adressePrecedente ?? null,
    code_postal_precedent: input.codePostalPrecedent ?? null,
    ville_precedente: input.villePrecedente ?? null,

    profession: input.profession ?? null,
    employeur: input.employeur ?? null,
    type_contrat_travail: input.typeContratTravail ?? null,
    date_embauche: dateOnly(input.dateEmbauche),

    revenus_mensuels: input.revenusMensuels ?? null,
    autres_revenus: input.autresRevenus ?? null,

    situation_matrimoniale: input.situationMatrimoniale ?? null,
    nombre_enfants: input.nombreEnfants ?? null,
    numero_caf: input.numeroCaf ?? null,

    commentaires: input.commentaires ?? null,
  };
}

const SELECT_WITH_GARANTS =
  '*, locataire_garants(garant_id, garants(id, nom, prenom, type_garantie))';

const locatairesQueryKey = ['locataires'] as const;

export function useLocataires() {
  return useQuery({
    queryKey: locatairesQueryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from(TABLE)
        .select(SELECT_WITH_GARANTS)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return ((data ?? []) as unknown as LocataireRowWithGarants[]).map(rowToLocataire);
    },
  });
}

async function syncGarantsAssoc(locataireId: string, garantIds: string[], removeFirst: boolean) {
  if (removeFirst) {
    const { error } = await supabase
      .from('locataire_garants')
      .delete()
      .eq('locataire_id', locataireId);
    if (error) throw error;
  }
  if (garantIds.length > 0) {
    const rows = garantIds.map((garantId) => ({
      locataire_id: locataireId,
      garant_id: garantId,
    }));
    const { error } = await supabase.from('locataire_garants').insert(rows);
    if (error) throw error;
  }
}

export function useCreateLocataire() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      input,
      garantIds,
    }: {
      input: CreateLocataireInput;
      garantIds: string[];
    }) => {
      const { data, error } = await supabase
        .from(TABLE)
        .insert(inputToInsert(input))
        .select('id')
        .single();
      if (error) throw error;
      const id = (data as { id: string }).id;
      if (garantIds.length > 0) {
        await syncGarantsAssoc(id, garantIds, false);
      }
      return id;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: locatairesQueryKey });
    },
  });
}

export function useUpdateLocataire() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      input,
      garantIds,
    }: {
      id: string;
      input: CreateLocataireInput;
      garantIds: string[];
    }) => {
      const update = { ...inputToInsert(input), updated_at: new Date().toISOString() };
      const { error } = await supabase.from(TABLE).update(update).eq('id', id);
      if (error) throw error;
      await syncGarantsAssoc(id, garantIds, true);
      return id;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: locatairesQueryKey });
    },
  });
}

export function useDeleteLocataire() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(TABLE).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: locatairesQueryKey });
    },
  });
}

export type { UpdateLocataireInput };
