import type {
  CategorieCharge,
  ChargeInput,
  FrequenceCharge,
  ModePaiementCharge,
  TypeCharge,
} from '@gl/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

const TABLE = 'charges';
export const BUCKET_PREUVES = 'charges-preuves';

interface ChargeRow {
  id: string;
  bien_id: string;
  categorie: CategorieCharge;
  sous_categorie: string | null;
  description: string;
  fournisseur: string | null;
  numero_facture: string | null;
  montant_ttc: number;
  montant_ht: number | null;
  tva: number | null;
  date: string;
  date_paiement: string | null;
  mode_paiement: ModePaiementCharge | null;
  type: TypeCharge;
  frequence: FrequenceCharge | null;
  date_debut: string | null;
  date_fin: string | null;
  recuperable: boolean | null;
  deductible: boolean | null;
  ligne_2044: string | null;
  commentaires: string | null;
  created_at: string;
  updated_at: string;
}

interface ChargeBienJoin {
  id: string;
  reference: string | null;
  adresse: string;
  code_postal: string;
  ville: string;
}

interface ChargeRowFull extends ChargeRow {
  biens: ChargeBienJoin | null;
  /** Champ ajouté manuellement via une 2e requête : pas dans la table charges directement. */
  preuve_storage_key?: string | null;
}

export interface Charge {
  id: string;
  bienId: string;
  bien: {
    id: string;
    reference: string | undefined;
    adresse: string;
    codePostal: string;
    ville: string;
  } | undefined;
  categorie: CategorieCharge;
  sousCategorie: string | undefined;
  description: string;
  fournisseur: string | undefined;
  numeroFacture: string | undefined;
  montantTtc: number;
  montantHt: number | undefined;
  tva: number | undefined;
  date: string;
  datePaiement: string | undefined;
  modePaiement: ModePaiementCharge | undefined;
  type: TypeCharge;
  frequence: FrequenceCharge | undefined;
  dateDebut: string | undefined;
  dateFin: string | undefined;
  recuperable: boolean;
  deductible: boolean;
  ligne2044: string | undefined;
  commentaires: string | undefined;
  preuveStorageKey: string | undefined;
  createdAt: string;
}

function rowToCharge(row: ChargeRowFull): Charge {
  return {
    id: row.id,
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
    categorie: row.categorie,
    sousCategorie: row.sous_categorie ?? undefined,
    description: row.description,
    fournisseur: row.fournisseur ?? undefined,
    numeroFacture: row.numero_facture ?? undefined,
    montantTtc: Number(row.montant_ttc),
    montantHt: row.montant_ht !== null ? Number(row.montant_ht) : undefined,
    tva: row.tva !== null ? Number(row.tva) : undefined,
    date: row.date,
    datePaiement: row.date_paiement ?? undefined,
    modePaiement: row.mode_paiement ?? undefined,
    type: row.type,
    frequence: row.frequence ?? undefined,
    dateDebut: row.date_debut ?? undefined,
    dateFin: row.date_fin ?? undefined,
    recuperable: Boolean(row.recuperable),
    deductible: row.deductible !== false,
    ligne2044: row.ligne_2044 ?? undefined,
    commentaires: row.commentaires ?? undefined,
    preuveStorageKey: row.preuve_storage_key ?? undefined,
    createdAt: row.created_at,
  };
}

const SELECT_FULL = '*, biens(id, reference, adresse, code_postal, ville)';

export interface ChargesFilters {
  bienId?: string;
  categorie?: CategorieCharge;
  dateMin?: string;
  dateMax?: string;
}

export function useCharges(filters: ChargesFilters = {}) {
  return useQuery({
    queryKey: ['charges', filters],
    queryFn: async () => {
      let q = supabase.from(TABLE).select(SELECT_FULL).order('date', { ascending: false });
      if (filters.bienId) q = q.eq('bien_id', filters.bienId);
      if (filters.categorie) q = q.eq('categorie', filters.categorie);
      if (filters.dateMin) q = q.gte('date', filters.dateMin);
      if (filters.dateMax) q = q.lte('date', filters.dateMax);
      const { data, error } = await q;
      if (error) throw error;
      return ((data ?? []) as unknown as ChargeRowFull[]).map(rowToCharge);
    },
  });
}

function inputToInsert(input: ChargeInput, preuveStorageKey?: string) {
  return {
    bien_id: input.bienId,
    categorie: input.categorie,
    sous_categorie: input.sousCategorie ?? null,
    description: input.description,
    fournisseur: input.fournisseur ?? null,
    numero_facture: input.numeroFacture ?? null,
    montant_ttc: input.montantTtc,
    montant_ht: input.montantHt ?? null,
    tva: input.tva ?? null,
    date: input.date,
    date_paiement: input.datePaiement ?? null,
    mode_paiement: input.modePaiement ?? null,
    type: input.type,
    frequence: input.frequence ?? null,
    date_debut: input.dateDebut ?? null,
    date_fin: input.dateFin ?? null,
    recuperable: input.recuperable,
    deductible: input.deductible,
    ligne_2044: input.ligne2044 ?? null,
    commentaires: input.commentaires ?? null,
    preuve_storage_key: preuveStorageKey ?? input.preuveStorageKey ?? null,
  };
}

export function useCreateCharge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ChargeInput) => {
      const { data, error } = await supabase
        .from(TABLE)
        .insert(inputToInsert(input))
        .select('id')
        .single();
      if (error) throw error;
      return (data as { id: string }).id;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['charges'] });
    },
  });
}

export function useUpdateCharge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: ChargeInput }) => {
      const { error } = await supabase
        .from(TABLE)
        .update({ ...inputToInsert(input), updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['charges'] });
    },
  });
}

export function useDeleteCharge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(TABLE).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['charges'] });
    },
  });
}

/**
 * Upload une preuve (facture, photo) dans le bucket charges-preuves.
 * Retourne le chemin de stockage.
 */
export async function uploadPreuve(file: File): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Session expirée');
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin';
  const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET_PREUVES).upload(path, file, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  });
  if (error) throw error;
  return path;
}

/**
 * Retourne une URL signée temporaire (1 heure) pour télécharger/afficher la preuve.
 */
export async function getPreuveUrl(storageKey: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET_PREUVES)
    .createSignedUrl(storageKey, 3600);
  if (error) throw error;
  return data.signedUrl;
}
