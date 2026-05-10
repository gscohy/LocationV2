import { z } from 'zod';
import { codePostalSchema, emailSchema } from './common';

export const civiliteSchema = z.enum(['M', 'MME', 'MLLE']);
export type Civilite = z.infer<typeof civiliteSchema>;

export const typePieceIdentiteSchema = z.enum(['CNI', 'PASSEPORT', 'TITRE_SEJOUR']);
export type TypePieceIdentite = z.infer<typeof typePieceIdentiteSchema>;

export const typeContratTravailSchema = z.enum([
  'CDI',
  'CDD',
  'INTERIM',
  'INDEPENDANT',
  'FONCTIONNAIRE',
  'RETRAITE',
  'ETUDIANT',
  'AUTRE',
]);
export type TypeContratTravail = z.infer<typeof typeContratTravailSchema>;

export const situationMatrimonialeSchema = z.enum([
  'CELIBATAIRE',
  'MARIE',
  'PACS',
  'DIVORCE',
  'VEUF',
]);
export type SituationMatrimoniale = z.infer<typeof situationMatrimonialeSchema>;

const baseLocataire = z.object({
  // Identité
  civilite: civiliteSchema.default('M'),
  nom: z.string().trim().min(1, 'Nom requis'),
  nomNaissance: z.string().trim().optional(),
  prenom: z.string().trim().min(1, 'Prénom requis'),
  autresPrenoms: z.string().trim().optional(),

  // Naissance
  dateNaissance: z.coerce.date(),
  lieuNaissance: z.string().trim().min(1, 'Lieu de naissance requis'),
  paysNaissance: z.string().trim().optional(),
  nationalite: z.string().trim().optional(),

  // Pièce d'identité
  typePieceIdentite: typePieceIdentiteSchema.optional(),
  numeroPieceIdentite: z.string().trim().optional(),

  // Contact
  email: emailSchema,
  telephoneMobile: z.string().trim().min(1, 'Téléphone mobile requis'),
  telephoneFixe: z.string().trim().optional(),

  // Adresse précédente
  adressePrecedente: z.string().trim().optional(),
  codePostalPrecedent: codePostalSchema.optional(),
  villePrecedente: z.string().trim().optional(),

  // Profession
  profession: z.string().trim().optional(),
  employeur: z.string().trim().optional(),
  typeContratTravail: typeContratTravailSchema.optional(),
  dateEmbauche: z.coerce.date().optional(),

  // Revenus
  revenusMensuels: z.number().min(0).optional(),
  autresRevenus: z.number().min(0).optional(),

  // Situation
  situationMatrimoniale: situationMatrimonialeSchema.optional(),
  nombreEnfants: z.number().int().min(0).optional(),
  numeroCaf: z.string().trim().optional(),

  // Notes
  commentaires: z.string().trim().optional(),
});

export const createLocataireSchema = baseLocataire;
export const updateLocataireSchema = baseLocataire.partial();

export type CreateLocataireInput = z.infer<typeof createLocataireSchema>;
export type UpdateLocataireInput = z.infer<typeof updateLocataireSchema>;
