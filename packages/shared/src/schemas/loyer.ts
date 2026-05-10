import { z } from 'zod';
import { idSchema, paginationSchema } from './common';

export const listLoyersSchema = paginationSchema.extend({
  contratId: idSchema.optional(),
  bienId: idSchema.optional(),
  locataireId: idSchema.optional(),
  statut: z.enum(['EN_ATTENTE', 'PARTIEL', 'PAYE', 'RETARD', 'IMPAYE']).optional(),
  annee: z.coerce.number().int().optional(),
  mois: z.coerce.number().int().min(1).max(12).optional(),
});
export type ListLoyersQuery = z.infer<typeof listLoyersSchema>;

export const generateLoyersSchema = z.object({
  /** Mois et année à générer. Si omis, le mois courant. */
  mois: z.number().int().min(1).max(12).optional(),
  annee: z.number().int().optional(),
  /** Si true, regénère même les loyers déjà créés (sans toucher aux paiements). */
  force: z.boolean().default(false),
  /** Limiter à un contrat précis (sinon tous les contrats actifs). */
  contratId: idSchema.optional(),
});
export type GenerateLoyersInput = z.infer<typeof generateLoyersSchema>;

export const updateLoyerSchema = z.object({
  montantDu: z.number().min(0).optional(),
  dateEcheance: z.coerce.date().optional(),
  commentaires: z.string().optional(),
});
export type UpdateLoyerInput = z.infer<typeof updateLoyerSchema>;
