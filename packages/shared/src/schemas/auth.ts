import { z } from 'zod';

export const loginSchema = z.object({
  // Lenient sur le login : on accepte n'importe quel identifiant non vide
  // (l'authentification réelle se fait via le hash de mot de passe).
  // Ainsi un email comme admin@local (sans TLD) reste utilisable.
  email: z.string().min(1, 'Identifiant requis').toLowerCase(),
  password: z.string().min(1, 'Mot de passe requis'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8, 'Au moins 8 caractères'),
    confirmPassword: z.string().min(8),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirmPassword'],
  });
