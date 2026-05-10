import { z } from 'zod';

export const idSchema = z.string().uuid();

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20),
  search: z.string().trim().optional(),
});
export type Pagination = z.infer<typeof paginationSchema>;

export const codePostalSchema = z.string().regex(/^\d{5}$/, 'Code postal invalide (5 chiffres)');
export const emailSchema = z.string().email('Email invalide').toLowerCase();
export const telephoneSchema = z
  .string()
  .regex(/^[+\d\s.()-]{6,20}$/, 'Téléphone invalide')
  .optional();
