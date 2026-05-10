import type {
  ChauffageType,
  ClasseEnergie,
  CreateBienInput,
  EauChaudeType,
  ProprietairePart,
  StatutBien,
  TypeBien,
  UpdateBienInput,
  UsageBien,
} from '@gl/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

const TABLE = 'biens';

interface BienRow {
  id: string;
  reference: string | null;
  type: TypeBien;
  usage: string | null;
  adresse: string;
  complement_adresse: string | null;
  code_postal: string;
  ville: string;
  pays: string;
  surface_habitable: number;
  surface_carrez: number | null;
  surface_terrain: number | null;
  nb_pieces: number;
  nb_chambres: number;
  nb_salles_bain: number | null;
  etage: number | null;
  ascenseur: boolean | null;
  meuble: boolean | null;
  balcon: boolean | null;
  parking: boolean | null;
  cave: boolean | null;
  chauffage_type: string | null;
  eau_chaude_type: string | null;
  classe_dpe: string | null;
  classe_ges: string | null;
  description: string | null;
  reglement_interieur: string | null;
  loyer: number;
  charges_mensuelles: number;
  depot_garantie: number;
  statut: StatutBien;
  date_achat: string | null;
  prix_achat: number | null;
  frais_notaire_achat: number | null;
  frais_agence_achat: number | null;
  travaux_initiaux: number | null;
  valeur_estimee: number | null;
  created_at: string;
  updated_at: string;
}

interface BienProprietaireJoin {
  proprietaire_id: string;
  quote_part: number;
  proprietaires: {
    id: string;
    type: 'PHYSIQUE' | 'MORALE';
    nom: string;
    prenom: string | null;
    entreprise: string | null;
  } | null;
}

interface BienRowWithProprietaires extends BienRow {
  bien_proprietaires: BienProprietaireJoin[];
}

export interface BienProprietaireSummary {
  proprietaireId: string;
  quotePart: number;
  label: string;
  type: 'PHYSIQUE' | 'MORALE';
}

export interface Bien {
  id: string;
  reference: string | undefined;
  type: TypeBien;
  usage: UsageBien | undefined;
  statut: StatutBien;

  adresse: string;
  complementAdresse: string | undefined;
  codePostal: string;
  ville: string;
  pays: string;

  surfaceHabitable: number;
  surfaceCarrez: number | undefined;
  surfaceTerrain: number | undefined;
  nbPieces: number;
  nbChambres: number;
  nbSallesBain: number | undefined;
  etage: number | undefined;

  ascenseur: boolean;
  meuble: boolean;
  balcon: boolean;
  parking: boolean;
  cave: boolean;

  chauffageType: ChauffageType | undefined;
  eauChaudeType: EauChaudeType | undefined;
  classeDpe: ClasseEnergie | undefined;
  classeGes: ClasseEnergie | undefined;

  description: string | undefined;
  reglementInterieur: string | undefined;

  loyer: number;
  chargesMensuelles: number;
  depotGarantie: number;

  dateAchat: string | undefined;
  prixAchat: number | undefined;
  fraisNotaireAchat: number | undefined;
  fraisAgenceAchat: number | undefined;
  travauxInitiaux: number | undefined;
  valeurEstimee: number | undefined;

  proprietaires: BienProprietaireSummary[];
  createdAt: string;
}

function proprietaireLabel(p: BienProprietaireJoin['proprietaires']): string {
  if (!p) return '— inconnu —';
  if (p.type === 'MORALE') return p.entreprise ?? p.nom;
  return `${p.prenom ?? ''} ${p.nom}`.trim();
}

function rowToBien(row: BienRowWithProprietaires): Bien {
  return {
    id: row.id,
    reference: row.reference ?? undefined,
    type: row.type,
    usage: (row.usage as UsageBien) ?? undefined,
    statut: row.statut,

    adresse: row.adresse,
    complementAdresse: row.complement_adresse ?? undefined,
    codePostal: row.code_postal,
    ville: row.ville,
    pays: row.pays,

    surfaceHabitable: row.surface_habitable,
    surfaceCarrez: row.surface_carrez ?? undefined,
    surfaceTerrain: row.surface_terrain ?? undefined,
    nbPieces: row.nb_pieces,
    nbChambres: row.nb_chambres,
    nbSallesBain: row.nb_salles_bain ?? undefined,
    etage: row.etage ?? undefined,

    ascenseur: row.ascenseur ?? false,
    meuble: row.meuble ?? false,
    balcon: row.balcon ?? false,
    parking: row.parking ?? false,
    cave: row.cave ?? false,

    chauffageType: (row.chauffage_type as ChauffageType) ?? undefined,
    eauChaudeType: (row.eau_chaude_type as EauChaudeType) ?? undefined,
    classeDpe: (row.classe_dpe as ClasseEnergie) ?? undefined,
    classeGes: (row.classe_ges as ClasseEnergie) ?? undefined,

    description: row.description ?? undefined,
    reglementInterieur: row.reglement_interieur ?? undefined,

    loyer: row.loyer,
    chargesMensuelles: row.charges_mensuelles,
    depotGarantie: row.depot_garantie,

    dateAchat: row.date_achat ?? undefined,
    prixAchat: row.prix_achat ?? undefined,
    fraisNotaireAchat: row.frais_notaire_achat ?? undefined,
    fraisAgenceAchat: row.frais_agence_achat ?? undefined,
    travauxInitiaux: row.travaux_initiaux ?? undefined,
    valeurEstimee: row.valeur_estimee ?? undefined,

    proprietaires: (row.bien_proprietaires ?? []).map((bp) => ({
      proprietaireId: bp.proprietaire_id,
      quotePart: bp.quote_part,
      label: proprietaireLabel(bp.proprietaires),
      type: bp.proprietaires?.type ?? 'PHYSIQUE',
    })),
    createdAt: row.created_at,
  };
}

function inputToInsert(input: CreateBienInput) {
  return {
    reference: input.reference ?? null,
    type: input.type,
    usage: input.usage ?? null,
    adresse: input.adresse,
    complement_adresse: input.complementAdresse ?? null,
    code_postal: input.codePostal,
    ville: input.ville,
    pays: input.pays,
    surface_habitable: input.surfaceHabitable,
    surface_carrez: input.surfaceCarrez ?? null,
    surface_terrain: input.surfaceTerrain ?? null,
    nb_pieces: input.nbPieces,
    nb_chambres: input.nbChambres,
    nb_salles_bain: input.nbSallesBain ?? null,
    etage: input.etage ?? null,
    ascenseur: input.ascenseur,
    meuble: input.meuble,
    balcon: input.balcon,
    parking: input.parking,
    cave: input.cave,
    chauffage_type: input.chauffageType ?? null,
    eau_chaude_type: input.eauChaudeType ?? null,
    classe_dpe: input.classeDpe ?? null,
    classe_ges: input.classeGes ?? null,
    description: input.description ?? null,
    reglement_interieur: input.reglementInterieur ?? null,
    loyer: input.loyer,
    charges_mensuelles: input.chargesMensuelles,
    depot_garantie: input.depotGarantie,
    statut: input.statut,
    date_achat: input.dateAchat ? new Date(input.dateAchat).toISOString().slice(0, 10) : null,
    prix_achat: input.prixAchat ?? null,
    frais_notaire_achat: input.fraisNotaireAchat ?? null,
    frais_agence_achat: input.fraisAgenceAchat ?? null,
    travaux_initiaux: input.travauxInitiaux ?? null,
    valeur_estimee: input.valeurEstimee ?? null,
  };
}

const SELECT_WITH_PROPS =
  '*, bien_proprietaires(proprietaire_id, quote_part, proprietaires(id, type, nom, prenom, entreprise))';

const biensQueryKey = ['biens'] as const;

export function useBiens() {
  return useQuery({
    queryKey: biensQueryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from(TABLE)
        .select(SELECT_WITH_PROPS)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return ((data ?? []) as unknown as BienRowWithProprietaires[]).map(rowToBien);
    },
  });
}

async function syncProprietairesAssoc(
  bienId: string,
  proprietaires: ProprietairePart[],
  removeFirst: boolean,
) {
  if (removeFirst) {
    const { error } = await supabase.from('bien_proprietaires').delete().eq('bien_id', bienId);
    if (error) throw error;
  }
  if (proprietaires.length > 0) {
    const rows = proprietaires.map((p) => ({
      bien_id: bienId,
      proprietaire_id: p.proprietaireId,
      quote_part: p.quotePart,
    }));
    const { error } = await supabase.from('bien_proprietaires').insert(rows);
    if (error) throw error;
  }
}

export function useCreateBien() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateBienInput) => {
      // UUID client-side : on évite le SELECT post-INSERT qui serait rejeté par
      // la RLS biens_select tant que les bien_proprietaires ne sont pas encore créés.
      const bienId = crypto.randomUUID();
      const { error } = await supabase
        .from(TABLE)
        .insert({ id: bienId, ...inputToInsert(input) });
      if (error) throw error;
      try {
        await syncProprietairesAssoc(bienId, input.proprietaires, false);
      } catch (e) {
        // Rollback best-effort : on tente de supprimer le bien orphelin.
        await supabase.from(TABLE).delete().eq('id', bienId);
        throw e;
      }
      return bienId;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: biensQueryKey });
    },
  });
}

export function useUpdateBien() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      input,
      proprietaires,
    }: {
      id: string;
      input: Omit<CreateBienInput, 'proprietaires'>;
      proprietaires: ProprietairePart[];
    }) => {
      const update = {
        ...inputToInsert({ ...input, proprietaires } as CreateBienInput),
        updated_at: new Date().toISOString(),
      };
      const { error: upErr } = await supabase.from(TABLE).update(update).eq('id', id);
      if (upErr) throw upErr;
      await syncProprietairesAssoc(id, proprietaires, true);
      return id;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: biensQueryKey });
    },
  });
}

export function useDeleteBien() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(TABLE).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: biensQueryKey });
    },
  });
}

export type UpdateBienPayload = Parameters<ReturnType<typeof useUpdateBien>['mutateAsync']>[0];
export type { UpdateBienInput };
