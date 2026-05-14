import { z } from 'zod';
import { emailSchema } from './common';

export const parametresSmtpSchema = z.object({
  host: z.string().trim().min(1, 'Hôte SMTP requis'),
  port: z.coerce.number().int().min(1).max(65535).default(465),
  username: z.string().trim().min(1, 'Utilisateur SMTP requis'),
  password: z.string().min(1, 'Mot de passe SMTP requis'),
  secure: z.boolean().default(true),
  fromEmail: emailSchema,
  fromName: z.string().trim().min(1, 'Nom expéditeur requis'),
});

export type ParametresSmtpInput = z.infer<typeof parametresSmtpSchema>;
