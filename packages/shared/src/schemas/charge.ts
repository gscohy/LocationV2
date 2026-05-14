import { z } from 'zod';

export const categorieChargeSchema = z.enum([
  'TRAVAUX',
  'ENTRETIEN',
  'ASSURANCE_PNO',
  'ASSURANCE_LOYERS_IMPAYES',
  'CREDIT_IMMOBILIER',
  'TAXE_FONCIERE',
  'TAXE_HABITATION',
  'CHARGES_COPROPRIETE',
  'FRAIS_GESTION',
  'HONORAIRES_AGENCE',
  'FRAIS_PROCEDURE',
  'EAU',
  'ELECTRICITE',
  'GAZ',
  'INTERNET',
  'EXCEPTIONNELLE',
  'AUTRE',
]);
export type CategorieCharge = z.infer<typeof categorieChargeSchema>;

export const typeChargeSchema = z.enum(['PONCTUELLE', 'RECURRENTE']);
export type TypeCharge = z.infer<typeof typeChargeSchema>;

export const frequenceChargeSchema = z.enum([
  'MENSUELLE',
  'TRIMESTRIELLE',
  'SEMESTRIELLE',
  'ANNUELLE',
]);
export type FrequenceCharge = z.infer<typeof frequenceChargeSchema>;

export const modePaiementChargeSchema = z.enum([
  'VIREMENT',
  'PRELEVEMENT',
  'CHEQUE',
  'ESPECES',
  'CAF',
  'PAYLIB',
  'AUTRE',
]);
export type ModePaiementCharge = z.infer<typeof modePaiementChargeSchema>;

export const chargeSchema = z.object({
  bienId: z.string().uuid('Bien requis'),
  categorie: categorieChargeSchema,
  sousCategorie: z.string().trim().optional(),
  description: z.string().trim().min(1, 'Description requise'),
  fournisseur: z.string().trim().optional(),
  numeroFacture: z.string().trim().optional(),
  montantTtc: z.number().positive('Montant TTC doit être > 0'),
  montantHt: z.number().nonnegative().optional(),
  tva: z.number().nonnegative().optional(),
  date: z.string().min(1, 'Date requise'),
  datePaiement: z.string().optional(),
  modePaiement: modePaiementChargeSchema.optional(),
  type: typeChargeSchema.default('PONCTUELLE'),
  frequence: frequenceChargeSchema.optional(),
  dateDebut: z.string().optional(),
  dateFin: z.string().optional(),
  recuperable: z.boolean().default(false),
  deductible: z.boolean().default(true),
  ligne2044: z.string().trim().optional(),
  commentaires: z.string().trim().optional(),
  /** Storage key du fichier preuve (facture, photo) dans le bucket charges-preuves. */
  preuveStorageKey: z.string().trim().optional(),
});

export type ChargeInput = z.infer<typeof chargeSchema>;
