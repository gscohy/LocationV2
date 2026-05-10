import type {
  Civilite,
  CreateGarantInput,
  DureeEngagement,
  TypeGarantie,
  UpdateGarantInput,
} from '@gl/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

const TABLE = 'garants';

interface GarantRow {
  id: string;
  civilite: Civilite;
  nom: string;
  prenom: string;
  date_naissance: string | null;
  email: string;
  telephone: string;
  adresse: string | null;
  code_postal: string | null;
  ville: string | null;
  profession: string | null;
  employeur: string | null;
  revenus_mensuels: number | null;
  type_garantie: TypeGarantie;
  montant_max_garanti: number | null;
  duree_engagement: string | null;
  date_fin_engagement: string | null;
  numero_visale: string | null;
  organisme_garant: string | null;
  created_at: string;
  updated_at: string;
}

export interface Garant {
  id: string;
  civilite: Civilite;
  nom: string;
  prenom: string;
  dateNaissance: string | undefined;

  email: string;
  telephone: string;

  adresse: string | undefined;
  codePostal: string | undefined;
  ville: string | undefined;

  profession: string | undefined;
  employeur: string | undefined;
  revenusMensuels: number | undefined;

  typeGarantie: TypeGarantie;
  montantMaxGaranti: number | undefined;
  dureeEngagement: DureeEngagement | undefined;
  dateFinEngagement: string | undefined;
  numeroVisale: string | undefined;
  organismeGarant: string | undefined;

  createdAt: string;
}

function rowToGarant(row: GarantRow): Garant {
  return {
    id: row.id,
    civilite: row.civilite,
    nom: row.nom,
    prenom: row.prenom,
    dateNaissance: row.date_naissance ?? undefined,

    email: row.email,
    telephone: row.telephone,

    adresse: row.adresse ?? undefined,
    codePostal: row.code_postal ?? undefined,
    ville: row.ville ?? undefined,

    profession: row.profession ?? undefined,
    employeur: row.employeur ?? undefined,
    revenusMensuels: row.revenus_mensuels ?? undefined,

    typeGarantie: row.type_garantie,
    montantMaxGaranti: row.montant_max_garanti ?? undefined,
    dureeEngagement: (row.duree_engagement as DureeEngagement) ?? undefined,
    dateFinEngagement: row.date_fin_engagement ?? undefined,
    numeroVisale: row.numero_visale ?? undefined,
    organismeGarant: row.organisme_garant ?? undefined,

    createdAt: row.created_at,
  };
}

const dateOnly = (d: Date | undefined) =>
  d ? new Date(d).toISOString().slice(0, 10) : null;

function inputToInsert(input: CreateGarantInput) {
  return {
    civilite: input.civilite,
    nom: input.nom,
    prenom: input.prenom,
    date_naissance: dateOnly(input.dateNaissance),

    email: input.email,
    telephone: input.telephone,

    adresse: input.adresse ?? null,
    code_postal: input.codePostal ?? null,
    ville: input.ville ?? null,

    profession: input.profession ?? null,
    employeur: input.employeur ?? null,
    revenus_mensuels: input.revenusMensuels ?? null,

    type_garantie: input.typeGarantie,
    montant_max_garanti: input.montantMaxGaranti ?? null,
    duree_engagement: input.dureeEngagement ?? null,
    date_fin_engagement: dateOnly(input.dateFinEngagement),
    numero_visale: input.numeroVisale ?? null,
    organisme_garant: input.organismeGarant ?? null,
  };
}

const garantsQueryKey = ['garants'] as const;

export function useGarants() {
  return useQuery({
    queryKey: garantsQueryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from(TABLE)
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return ((data ?? []) as GarantRow[]).map(rowToGarant);
    },
  });
}

export function useCreateGarant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateGarantInput) => {
      const { data, error } = await supabase
        .from(TABLE)
        .insert(inputToInsert(input))
        .select()
        .single();
      if (error) throw error;
      return rowToGarant(data as GarantRow);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: garantsQueryKey });
    },
  });
}

export function useUpdateGarant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: CreateGarantInput }) => {
      const update = { ...inputToInsert(input), updated_at: new Date().toISOString() };
      const { data, error } = await supabase
        .from(TABLE)
        .update(update)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return rowToGarant(data as GarantRow);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: garantsQueryKey });
    },
  });
}

export function useDeleteGarant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(TABLE).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: garantsQueryKey });
    },
  });
}

export type { UpdateGarantInput };
