import { z } from 'zod';

import { idSchema } from './common';

export const typeContratSchema = z.enum([
  'HABITATION_VIDE',
  'HABITATION_MEUBLE',
  'MOBILITE',
  'ETUDIANT',
  'COMMERCIAL',
  'PROFESSIONNEL',
  'PARKING',
  'GARAGE',
  'SAISONNIER',
]);
export type TypeContrat = z.infer<typeof typeContratSchema>;

export const usageContratSchema = z.enum([
  'RESIDENCE_PRINCIPALE',
  'RESIDENCE_SECONDAIRE',
  'MIXTE',
]);
export type UsageContrat = z.infer<typeof usageContratSchema>;

export const modePaiementSchema = z.enum([
  'VIREMENT',
  'PRELEVEMENT',
  'CHEQUE',
  'ESPECES',
  'CAF',
  'PAYLIB',
  'AUTRE',
]);
export type ModePaiement = z.infer<typeof modePaiementSchema>;

export const modeChargesSchema = z.enum(['PROVISION_REGULARISATION', 'FORFAIT']);
export type ModeCharges = z.infer<typeof modeChargesSchema>;

export const statutContratSchema = z.enum([
  'BROUILLON',
  'ACTIF',
  'EXPIRE',
  'RENOUVELE',
  'RESILIE',
  'ARCHIVE',
]);
export type StatutContrat = z.infer<typeof statutContratSchema>;

export const zoneGeographiqueSchema = z.enum(['TENDUE', 'NON_TENDUE']);
export type ZoneGeographique = z.infer<typeof zoneGeographiqueSchema>;

export const auteurResiliationSchema = z.enum(['BAILLEUR', 'LOCATAIRE', 'JUDICIAIRE']);
export type AuteurResiliation = z.infer<typeof auteurResiliationSchema>;

export const motifResiliationSchema = z.enum([
  'VENTE',
  'REPRISE',
  'CONGE_LOCATAIRE',
  'IMPAYE',
  'TROUBLE_VOISINAGE',
  'AUTRE',
]);
export type MotifResiliation = z.infer<typeof motifResiliationSchema>;

const baseContrat = z.object({
  // Identification
  reference: z.string().trim().optional(),
  bienId: idSchema,
  type: typeContratSchema.default('HABITATION_VIDE'),
  usage: usageContratSchema.default('RESIDENCE_PRINCIPALE'),
  statut: statutContratSchema.default('BROUILLON'),

  // Dates
  dateSignature: z.coerce.date(),
  dateDebut: z.coerce.date(),
  dateFin: z.coerce.date().optional(),
  dureeMois: z.number().int().min(1).default(36),
  reconductionTacite: z.boolean().default(true),

  // Loyer & charges
  loyer: z.number().min(0, 'Loyer >= 0'),
  chargesMensuelles: z.number().min(0).default(0),
  modeCharges: modeChargesSchema.default('PROVISION_REGULARISATION'),
  depotGarantie: z.number().min(0).default(0),
  dateEncaissementDg: z.coerce.date().optional(),
  jourPaiement: z.number().int().min(1).max(31).default(1),
  modePaiement: modePaiementSchema.default('VIREMENT'),

  // Frais
  fraisNotaire: z.number().min(0).default(0),
  fraisHuissier: z.number().min(0).default(0),
  fraisAgenceLocation: z.number().min(0).default(0),

  // Encadrement loyer
  zoneGeographique: zoneGeographiqueSchema.optional(),
  encadrementLoyer: z.boolean().default(false),
  loyerReference: z.number().min(0).optional(),
  loyerReferenceMajore: z.number().min(0).optional(),
  complementLoyer: z.number().min(0).optional(),

  // IRL
  irlActive: z.boolean().default(false),
  irlTrimestreRef: z.number().int().min(1).max(4).optional(),
  irlAnneeRef: z.number().int().optional(),
  irlValeurRef: z.number().min(0).optional(),

  // Clauses
  clausesParticulieres: z.string().optional(),
  clauseResolutoire: z.string().optional(),
  clauseSolidarite: z.boolean().default(false),
  commentaires: z.string().optional(),
});

export const createContratSchema = baseContrat.extend({
  locataireIds: z.array(idSchema).min(1, 'Au moins un locataire requis'),
  locataireIdPrincipal: idSchema,
});

export const updateContratSchema = baseContrat.partial().extend({
  locataireIds: z.array(idSchema).min(1).optional(),
  locataireIdPrincipal: idSchema.optional(),
});

export const resilierContratSchema = z.object({
  dateDemandeResiliation: z.coerce.date(),
  auteurResiliation: auteurResiliationSchema,
  motifResiliation: motifResiliationSchema,
  dateFinReelle: z.coerce.date(),
  preavisRespect: z.boolean().default(true),
  dateRestitutionDg: z.coerce.date().optional(),
  montantDgRestitue: z.number().min(0).optional(),
  commentairesResiliation: z.string().optional(),
});

export type CreateContratInput = z.infer<typeof createContratSchema>;
export type UpdateContratInput = z.infer<typeof updateContratSchema>;
export type ResilierContratInput = z.infer<typeof resilierContratSchema>;
