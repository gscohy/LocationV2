import { z } from 'zod';
import { idSchema, paginationSchema } from './common';

export const ventilationSchema = z.object({
  loyerId: idSchema,
  montant: z.number().positive(),
});

export const createPaiementSchema = z
  .object({
    montant: z.number().positive('Montant > 0'),
    date: z.coerce.date(),
    mode: z.enum(['VIREMENT', 'CHEQUE', 'ESPECES', 'CAF', 'PRELEVEMENT', 'AUTRE']).default('VIREMENT'),
    payeur: z.string().trim().min(1).default('Locataire'),
    reference: z.string().trim().optional(),
    commentaire: z.string().trim().optional(),
    ventilations: z.array(ventilationSchema).min(1, 'Au moins une ventilation requise'),
  })
  .refine(
    (data) =>
      Math.abs(data.ventilations.reduce((s, v) => s + v.montant, 0) - data.montant) < 0.01,
    { message: 'La somme des ventilations doit égaler le montant du paiement', path: ['ventilations'] },
  );

export type CreatePaiementInput = z.infer<typeof createPaiementSchema>;

export const listPaiementsSchema = paginationSchema.extend({
  loyerId: idSchema.optional(),
  contratId: idSchema.optional(),
  dateDebut: z.coerce.date().optional(),
  dateFin: z.coerce.date().optional(),
});
export type ListPaiementsQuery = z.infer<typeof listPaiementsSchema>;
