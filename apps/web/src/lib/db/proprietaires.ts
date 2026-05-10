import type {
  CreateProprietaireInput,
  UpdateProprietaireInput,
} from '@gl/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

const TABLE = 'proprietaires';

interface ProprietaireRow {
  id: string;
  owner_user_id: string;
  type: 'PHYSIQUE' | 'MORALE';
  nom: string;
  prenom: string | null;
  email: string;
  telephone_mobile: string | null;
  adresse: string;
  code_postal: string;
  ville: string;
  pays: string;
  entreprise: string | null;
  siret: string | null;
  iban: string | null;
  created_at: string;
  updated_at: string;
}

export interface Proprietaire {
  id: string;
  type: 'PHYSIQUE' | 'MORALE';
  nom: string;
  prenom: string | undefined;
  email: string;
  telephone: string | undefined;
  adresse: string;
  ville: string;
  codePostal: string;
  entreprise: string | undefined;
  siret: string | undefined;
  numeroRIB: string | undefined;
  createdAt: string;
}

function rowToProprietaire(row: ProprietaireRow): Proprietaire {
  return {
    id: row.id,
    type: row.type,
    nom: row.nom,
    prenom: row.prenom ?? undefined,
    email: row.email,
    telephone: row.telephone_mobile ?? undefined,
    adresse: row.adresse,
    ville: row.ville,
    codePostal: row.code_postal,
    entreprise: row.entreprise ?? undefined,
    siret: row.siret ?? undefined,
    numeroRIB: row.iban ?? undefined,
    createdAt: row.created_at,
  };
}

function inputToInsert(input: CreateProprietaireInput, ownerUserId: string) {
  return {
    owner_user_id: ownerUserId,
    type: input.type,
    nom: input.nom,
    prenom: input.prenom ?? null,
    email: input.email,
    telephone_mobile: input.telephone ?? null,
    adresse: input.adresse,
    code_postal: input.codePostal,
    ville: input.ville,
    pays: 'France',
    entreprise: input.entreprise ?? null,
    siret: input.siret ?? null,
    iban: input.numeroRIB ?? null,
  };
}

function inputToUpdate(input: UpdateProprietaireInput) {
  const update: Record<string, unknown> = {};
  if (input.type !== undefined) update.type = input.type;
  if (input.nom !== undefined) update.nom = input.nom;
  if (input.prenom !== undefined) update.prenom = input.prenom ?? null;
  if (input.email !== undefined) update.email = input.email;
  if (input.telephone !== undefined) update.telephone_mobile = input.telephone ?? null;
  if (input.adresse !== undefined) update.adresse = input.adresse;
  if (input.codePostal !== undefined) update.code_postal = input.codePostal;
  if (input.ville !== undefined) update.ville = input.ville;
  if (input.entreprise !== undefined) update.entreprise = input.entreprise ?? null;
  if (input.siret !== undefined) update.siret = input.siret ?? null;
  if (input.numeroRIB !== undefined) update.iban = input.numeroRIB ?? null;
  update.updated_at = new Date().toISOString();
  return update;
}

const proprietairesQueryKey = ['proprietaires'] as const;

export function useProprietaires() {
  return useQuery({
    queryKey: proprietairesQueryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from(TABLE)
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return ((data ?? []) as ProprietaireRow[]).map(rowToProprietaire);
    },
  });
}

export function useCreateProprietaire() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateProprietaireInput) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Session expirée. Reconnectez-vous.');
      const { data, error } = await supabase
        .from(TABLE)
        .insert(inputToInsert(input, user.id))
        .select()
        .single();
      if (error) throw error;
      return rowToProprietaire(data as ProprietaireRow);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: proprietairesQueryKey });
    },
  });
}

export function useUpdateProprietaire() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateProprietaireInput }) => {
      const { data, error } = await supabase
        .from(TABLE)
        .update(inputToUpdate(input))
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return rowToProprietaire(data as ProprietaireRow);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: proprietairesQueryKey });
    },
  });
}

export function useDeleteProprietaire() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(TABLE).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: proprietairesQueryKey });
    },
  });
}
