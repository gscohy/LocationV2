import { z } from 'zod';
import { idSchema } from './common';

export const categorieDocumentSchema = z.enum([
  'CONTRAT',
  'LOCATAIRE',
  'GARANT',
  'BIEN',
  'CHARGE',
  'PRET',
  'QUITTANCE',
  'DIAGNOSTIC',
  'ETAT_LIEUX',
  'COURRIER',
  'AUTRE',
]);
export type CategorieDocument = z.infer<typeof categorieDocumentSchema>;

export const uploadDocumentMetaSchema = z
  .object({
    categorie: categorieDocumentSchema,
    typeDoc: z.string().trim().optional(),
    description: z.string().trim().optional(),
    contratId: idSchema.optional(),
    locataireId: idSchema.optional(),
    garantId: idSchema.optional(),
    bienId: idSchema.optional(),
    chargeId: idSchema.optional(),
    pretId: idSchema.optional(),
  })
  .refine(
    (d) =>
      [d.contratId, d.locataireId, d.garantId, d.bienId, d.chargeId, d.pretId].some(Boolean),
    { message: 'Au moins une entité parent doit être renseignée' },
  );

export type UploadDocumentMeta = z.infer<typeof uploadDocumentMetaSchema>;

export const documentSearchSchema = z.object({
  bienId: idSchema.optional(),
  contratId: idSchema.optional(),
  locataireId: idSchema.optional(),
  garantId: idSchema.optional(),
  chargeId: idSchema.optional(),
  pretId: idSchema.optional(),
  categorie: categorieDocumentSchema.optional(),
});
export type DocumentSearch = z.infer<typeof documentSearchSchema>;
