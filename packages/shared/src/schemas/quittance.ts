import { z } from 'zod';
import { idSchema } from './common';

export const generateQuittanceSchema = z.object({
  loyerId: idSchema,
  /** Si true, envoie automatiquement par email après génération. */
  envoyer: z.boolean().default(false),
  /** Liste de destinataires (sinon utilise l'email du locataire principal). */
  destinataires: z.array(z.string().email()).optional(),
});
export type GenerateQuittanceInput = z.infer<typeof generateQuittanceSchema>;
