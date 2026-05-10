import { z } from 'zod';
import { codePostalSchema, idSchema } from './common';

export const typeBienSchema = z.enum([
  'APPARTEMENT',
  'MAISON',
  'STUDIO',
  'LOCAL',
  'GARAGE',
  'PARKING',
  'CAVE',
  'TERRAIN',
]);
export type TypeBien = z.infer<typeof typeBienSchema>;

export const statutBienSchema = z.enum(['VACANT', 'LOUE', 'TRAVAUX', 'INDISPONIBLE', 'VENDU']);
export type StatutBien = z.infer<typeof statutBienSchema>;

export const usageBienSchema = z.enum(['HABITATION', 'MIXTE', 'PROFESSIONNEL', 'COMMERCIAL']);
export type UsageBien = z.infer<typeof usageBienSchema>;

export const chauffageTypeSchema = z.enum([
  'INDIVIDUEL_GAZ',
  'INDIVIDUEL_ELEC',
  'COLLECTIF',
  'POMPE_CHALEUR',
  'BOIS',
  'AUTRE',
]);
export type ChauffageType = z.infer<typeof chauffageTypeSchema>;

export const eauChaudeTypeSchema = z.enum(['INDIVIDUEL', 'COLLECTIF']);
export type EauChaudeType = z.infer<typeof eauChaudeTypeSchema>;

export const classeEnergieSchema = z.enum(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
export type ClasseEnergie = z.infer<typeof classeEnergieSchema>;

const baseBien = z.object({
  reference: z.string().trim().optional(),
  type: typeBienSchema.default('APPARTEMENT'),
  usage: usageBienSchema.optional(),
  statut: statutBienSchema.default('VACANT'),

  adresse: z.string().trim().min(1, 'Adresse requise'),
  complementAdresse: z.string().trim().optional(),
  codePostal: codePostalSchema,
  ville: z.string().trim().min(1, 'Ville requise'),
  pays: z.string().trim().default('France'),

  surfaceHabitable: z.number().positive('Surface > 0'),
  surfaceCarrez: z.number().min(0).optional(),
  surfaceTerrain: z.number().min(0).optional(),
  nbPieces: z.number().int().positive().default(1),
  nbChambres: z.number().int().min(0).default(0),
  nbSallesBain: z.number().int().min(0).optional(),
  etage: z.number().int().optional(),

  ascenseur: z.boolean().default(false),
  meuble: z.boolean().default(false),
  balcon: z.boolean().default(false),
  parking: z.boolean().default(false),
  cave: z.boolean().default(false),

  chauffageType: chauffageTypeSchema.optional(),
  eauChaudeType: eauChaudeTypeSchema.optional(),
  classeDpe: classeEnergieSchema.optional(),
  classeGes: classeEnergieSchema.optional(),

  description: z.string().trim().optional(),
  reglementInterieur: z.string().trim().optional(),

  loyer: z.number().min(0, 'Loyer >= 0'),
  chargesMensuelles: z.number().min(0).default(0),
  depotGarantie: z.number().min(0).default(0),

  dateAchat: z.coerce.date().optional(),
  prixAchat: z.number().min(0).optional(),
  fraisNotaireAchat: z.number().min(0).optional(),
  fraisAgenceAchat: z.number().min(0).optional(),
  travauxInitiaux: z.number().min(0).optional(),
  valeurEstimee: z.number().min(0).optional(),
});

export const proprietairePartSchema = z.object({
  proprietaireId: idSchema,
  quotePart: z.number().min(0).max(100),
});
export type ProprietairePart = z.infer<typeof proprietairePartSchema>;

export const createBienSchema = baseBien.extend({
  proprietaires: z
    .array(proprietairePartSchema)
    .min(1, 'Au moins un propriétaire')
    .refine(
      (arr) => Math.abs(arr.reduce((s, p) => s + p.quotePart, 0) - 100) < 0.01,
      'La somme des quote-parts doit faire 100%',
    ),
});

export const updateBienSchema = baseBien.partial().extend({
  proprietaires: z
    .array(proprietairePartSchema)
    .min(1)
    .refine(
      (arr) => Math.abs(arr.reduce((s, p) => s + p.quotePart, 0) - 100) < 0.01,
      'La somme des quote-parts doit faire 100%',
    )
    .optional(),
});

export type CreateBienInput = z.infer<typeof createBienSchema>;
export type UpdateBienInput = z.infer<typeof updateBienSchema>;
