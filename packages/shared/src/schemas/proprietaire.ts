import { z } from 'zod';
import { codePostalSchema, emailSchema, telephoneSchema } from './common';

const baseProprietaire = z.object({
  type: z.enum(['PHYSIQUE', 'MORALE']).default('PHYSIQUE'),
  nom: z.string().trim().min(1, 'Nom requis'),
  prenom: z.string().trim().optional(),
  email: emailSchema,
  telephone: telephoneSchema,
  adresse: z.string().trim().min(1, 'Adresse requise'),
  ville: z.string().trim().min(1, 'Ville requise'),
  codePostal: codePostalSchema,
  entreprise: z.string().trim().optional(),
  siret: z
    .string()
    .regex(/^\d{14}$/, 'SIRET = 14 chiffres')
    .optional(),
  numeroRIB: z.string().trim().optional(),
});

export const createProprietaireSchema = baseProprietaire;
export const updateProprietaireSchema = baseProprietaire.partial();

export type CreateProprietaireInput = z.infer<typeof createProprietaireSchema>;
export type UpdateProprietaireInput = z.infer<typeof updateProprietaireSchema>;
