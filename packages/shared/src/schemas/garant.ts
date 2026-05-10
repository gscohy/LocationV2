import { z } from 'zod';

import { codePostalSchema, emailSchema, idSchema } from './common';
import { civiliteSchema } from './locataire';

export const typeGarantieSchema = z.enum([
  'PHYSIQUE',
  'MORALE',
  'VISALE',
  'CAUTION_BANCAIRE',
  'GARANTIE_LOCAPASS',
  'AUTRE',
]);
export type TypeGarantie = z.infer<typeof typeGarantieSchema>;

export const dureeEngagementSchema = z.enum(['BAIL_INITIAL', 'INDETERMINEE', 'DUREE_FIXE']);
export type DureeEngagement = z.infer<typeof dureeEngagementSchema>;

const baseGarant = z.object({
  civilite: civiliteSchema.default('M'),
  nom: z.string().trim().min(1, 'Nom requis'),
  prenom: z.string().trim().min(1, 'Prénom requis'),
  dateNaissance: z.coerce.date().optional(),

  email: emailSchema,
  telephone: z.string().trim().min(1, 'Téléphone requis'),

  adresse: z.string().trim().optional(),
  codePostal: codePostalSchema.optional(),
  ville: z.string().trim().optional(),

  profession: z.string().trim().optional(),
  employeur: z.string().trim().optional(),
  revenusMensuels: z.number().min(0).optional(),

  typeGarantie: typeGarantieSchema.default('PHYSIQUE'),
  montantMaxGaranti: z.number().min(0).optional(),
  dureeEngagement: dureeEngagementSchema.optional(),
  dateFinEngagement: z.coerce.date().optional(),
  numeroVisale: z.string().trim().optional(),
  organismeGarant: z.string().trim().optional(),
});

export const createGarantSchema = baseGarant;
export const updateGarantSchema = baseGarant.partial();

export type CreateGarantInput = z.infer<typeof createGarantSchema>;
export type UpdateGarantInput = z.infer<typeof updateGarantSchema>;

export const linkGarantSchema = z.object({
  locataireId: idSchema,
  garantId: idSchema,
});
