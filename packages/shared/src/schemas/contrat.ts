import { z } from 'zod';
import { idSchema } from './common';

const baseContrat = z.object({
  bienId: idSchema,
  reference: z.string().trim().optional(),
  dateDebut: z.coerce.date(),
  dateFin: z.coerce.date().optional(),
  duree: z.number().int().min(1).default(12),
  loyer: z.number().min(0),
  chargesMensuelles: z.number().min(0).default(0),
  depotGarantie: z.number().min(0).default(0),
  jourPaiement: z.number().int().min(1).max(31).default(1),
  fraisNotaire: z.number().min(0).default(0),
  fraisHuissier: z.number().min(0).default(0),
  type: z
    .enum(['HABITATION', 'MEUBLE', 'COMMERCIAL', 'PARKING', 'GARAGE', 'SAISONNIER'])
    .default('HABITATION'),
  modePaiement: z
    .enum(['VIREMENT', 'CHEQUE', 'ESPECES', 'CAF', 'PRELEVEMENT', 'AUTRE'])
    .default('VIREMENT'),
  clausesParticulieres: z.string().optional(),
  commentaires: z.string().optional(),
  irlActive: z.boolean().default(false),
  irlIndiceReferenceTrimestre: z.number().int().min(1).max(4).optional(),
  irlIndiceReferenceAnnee: z.number().int().optional(),
});

export const createContratSchema = baseContrat.extend({
  locataireIds: z.array(idSchema).min(1, 'Au moins un locataire requis'),
  locataireIdPrincipal: idSchema.optional(),
});

export const updateContratSchema = baseContrat.partial().extend({
  locataireIds: z.array(idSchema).min(1).optional(),
  locataireIdPrincipal: idSchema.optional(),
  statut: z.enum(['ACTIF', 'EXPIRE', 'RESILIE', 'ARCHIVE']).optional(),
});

export const resilierContratSchema = z.object({
  dateFinReelle: z.coerce.date(),
  raisonResiliation: z.string().trim().min(1),
  preavisRespect: z.boolean().default(true),
  commentairesResiliation: z.string().optional(),
});

export type CreateContratInput = z.infer<typeof createContratSchema>;
export type UpdateContratInput = z.infer<typeof updateContratSchema>;
export type ResilierContratInput = z.infer<typeof resilierContratSchema>;
