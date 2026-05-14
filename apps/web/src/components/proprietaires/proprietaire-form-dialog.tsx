import { codePostalSchema, emailSchema, type CreateProprietaireInput } from '@gl/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { useForm, type FieldErrors } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CodePostalVilleFields } from '@/components/ui/code-postal-ville-fields';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SignaturePad } from '@/components/ui/signature-pad';
import {
  useCreateProprietaire,
  useUpdateProprietaire,
  type Proprietaire,
} from '@/lib/db/proprietaires';

// Schéma "form" : tolère les chaînes vides sur les champs optionnels.
// On nettoie ('' → undefined) au moment du submit avant d'appeler la mutation.
const formSchema = z.object({
  type: z.enum(['PHYSIQUE', 'MORALE']),
  nom: z.string().trim().min(1, 'Nom requis'),
  prenom: z.string().trim(),
  email: emailSchema,
  telephone: z
    .string()
    .trim()
    .refine((v) => v === '' || /^[+\d\s.()-]{6,20}$/.test(v), 'Téléphone invalide'),
  adresse: z.string().trim().min(1, 'Adresse requise'),
  ville: z.string().trim().min(1, 'Ville requise'),
  codePostal: codePostalSchema,
  entreprise: z.string().trim(),
  siret: z
    .string()
    .trim()
    .refine((v) => v === '' || /^\d{14}$/.test(v), 'SIRET = 14 chiffres'),
  numeroRIB: z.string().trim(),
  signatureDataUrl: z.string().trim().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const emptyDefaults: FormValues = {
  type: 'PHYSIQUE',
  nom: '',
  prenom: '',
  email: '',
  telephone: '',
  adresse: '',
  ville: '',
  codePostal: '',
  entreprise: '',
  siret: '',
  numeroRIB: '',
  signatureDataUrl: undefined,
};

function proprietaireToDefaults(p: Proprietaire): FormValues {
  return {
    type: p.type,
    nom: p.nom,
    prenom: p.prenom ?? '',
    email: p.email,
    telephone: p.telephone ?? '',
    adresse: p.adresse,
    ville: p.ville,
    codePostal: p.codePostal,
    entreprise: p.entreprise ?? '',
    siret: p.siret ?? '',
    numeroRIB: p.numeroRIB ?? '',
    signatureDataUrl: p.signatureDataUrl,
  };
}

function formToInput(values: FormValues): CreateProprietaireInput {
  const trim = (v: string) => (v.trim() === '' ? undefined : v.trim());
  return {
    type: values.type,
    nom: values.nom,
    prenom: trim(values.prenom),
    email: values.email,
    telephone: trim(values.telephone),
    adresse: values.adresse,
    ville: values.ville,
    codePostal: values.codePostal,
    entreprise: trim(values.entreprise),
    siret: trim(values.siret),
    numeroRIB: trim(values.numeroRIB),
    signatureDataUrl: values.signatureDataUrl,
  };
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proprietaire?: Proprietaire;
};

export function ProprietaireFormDialog({ open, onOpenChange, proprietaire }: Props) {
  const isEdit = Boolean(proprietaire);
  const createMutation = useCreateProprietaire();
  const updateMutation = useUpdateProprietaire();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: emptyDefaults,
  });

  useEffect(() => {
    if (open) {
      form.reset(proprietaire ? proprietaireToDefaults(proprietaire) : emptyDefaults);
    }
  }, [open, proprietaire, form]);

  const type = form.watch('type');
  const isMorale = type === 'MORALE';

  const onValid = async (values: FormValues) => {
    try {
      const input = formToInput(values);
      if (proprietaire) {
        await updateMutation.mutateAsync({ id: proprietaire.id, input });
        toast.success('Propriétaire modifié');
      } else {
        await createMutation.mutateAsync(input);
        toast.success('Propriétaire créé');
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erreur inconnue');
    }
  };

  const onInvalid = (errors: FieldErrors<FormValues>) => {
    const first = Object.values(errors)[0];
    const msg = first?.message;
    toast.error(typeof msg === 'string' ? msg : 'Formulaire invalide');
  };

  const onSubmit = form.handleSubmit(onValid, onInvalid);

  const isSubmitting = form.formState.isSubmitting;
  const errors = form.formState.errors;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Modifier le propriétaire' : 'Nouveau propriétaire'}</DialogTitle>
          <DialogDescription>
            Personne physique ou morale qui détient un ou plusieurs biens.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="type">Type</Label>
              <select
                id="type"
                {...form.register('type')}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="PHYSIQUE">Personne physique</option>
                <option value="MORALE">Personne morale (SCI, SARL…)</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email *</Label>
              <Input id="email" type="email" {...form.register('email')} />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="nom">{isMorale ? 'Raison sociale *' : 'Nom *'}</Label>
              <Input id="nom" {...form.register('nom')} />
              {errors.nom && <p className="text-xs text-destructive">{errors.nom.message}</p>}
            </div>
            {!isMorale && (
              <div className="space-y-1.5">
                <Label htmlFor="prenom">Prénom</Label>
                <Input id="prenom" {...form.register('prenom')} />
              </div>
            )}
          </div>

          {isMorale && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="entreprise">Forme juridique / dénomination</Label>
                <Input id="entreprise" placeholder="ex: SCI Famille" {...form.register('entreprise')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="siret">SIRET</Label>
                <Input id="siret" placeholder="14 chiffres" {...form.register('siret')} />
                {errors.siret && (
                  <p className="text-xs text-destructive">{errors.siret.message}</p>
                )}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="telephone">Téléphone</Label>
            <Input id="telephone" {...form.register('telephone')} />
            {errors.telephone && (
              <p className="text-xs text-destructive">{errors.telephone.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="adresse">Adresse *</Label>
            <Input id="adresse" {...form.register('adresse')} />
            {errors.adresse && <p className="text-xs text-destructive">{errors.adresse.message}</p>}
          </div>

          <CodePostalVilleFields
            codePostal={form.watch('codePostal')}
            onCodePostalChange={(v) => form.setValue('codePostal', v, { shouldDirty: true })}
            ville={form.watch('ville')}
            onVilleChange={(v) => form.setValue('ville', v, { shouldDirty: true })}
            codePostalError={errors.codePostal?.message}
            villeError={errors.ville?.message}
          />

          <div className="space-y-1.5">
            <Label htmlFor="numeroRIB">IBAN (pour réception des loyers)</Label>
            <Input id="numeroRIB" placeholder="FR76…" {...form.register('numeroRIB')} />
          </div>

          <div className="space-y-1.5">
            <Label>Signature (apparaîtra sur les quittances)</Label>
            <SignaturePad
              value={form.watch('signatureDataUrl')}
              onChange={(v) => form.setValue('signatureDataUrl', v, { shouldDirty: true })}
              disabled={isSubmitting}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? 'Enregistrer' : 'Créer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
