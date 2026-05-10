import {
  codePostalSchema,
  emailSchema,
  type CreateGarantInput,
} from '@gl/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { useForm, type FieldErrors } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { type Garant, useCreateGarant, useUpdateGarant } from '@/lib/db/garants';

const optionalNonNeg = z
  .string()
  .trim()
  .refine((v) => v === '' || (!isNaN(Number(v)) && Number(v) >= 0), 'Doit être >= 0');

const formSchema = z.object({
  civilite: z.enum(['M', 'MME', 'MLLE']),
  nom: z.string().trim().min(1, 'Nom requis'),
  prenom: z.string().trim().min(1, 'Prénom requis'),
  dateNaissance: z.string().trim(),

  email: emailSchema,
  telephone: z.string().trim().min(1, 'Téléphone requis'),

  adresse: z.string().trim(),
  codePostal: z
    .string()
    .trim()
    .refine((v) => v === '' || codePostalSchema.safeParse(v).success, 'Code postal invalide'),
  ville: z.string().trim(),

  profession: z.string().trim(),
  employeur: z.string().trim(),
  revenusMensuels: optionalNonNeg,

  typeGarantie: z.enum([
    'PHYSIQUE',
    'MORALE',
    'VISALE',
    'CAUTION_BANCAIRE',
    'GARANTIE_LOCAPASS',
    'AUTRE',
  ]),
  montantMaxGaranti: optionalNonNeg,
  dureeEngagement: z.enum(['', 'BAIL_INITIAL', 'INDETERMINEE', 'DUREE_FIXE']),
  dateFinEngagement: z.string().trim(),
  numeroVisale: z.string().trim(),
  organismeGarant: z.string().trim(),
});

type FormValues = z.infer<typeof formSchema>;

const emptyDefaults: FormValues = {
  civilite: 'M',
  nom: '',
  prenom: '',
  dateNaissance: '',
  email: '',
  telephone: '',
  adresse: '',
  codePostal: '',
  ville: '',
  profession: '',
  employeur: '',
  revenusMensuels: '',
  typeGarantie: 'PHYSIQUE',
  montantMaxGaranti: '',
  dureeEngagement: '',
  dateFinEngagement: '',
  numeroVisale: '',
  organismeGarant: '',
};

function garantToDefaults(g: Garant): FormValues {
  return {
    civilite: g.civilite,
    nom: g.nom,
    prenom: g.prenom,
    dateNaissance: g.dateNaissance ?? '',
    email: g.email,
    telephone: g.telephone,
    adresse: g.adresse ?? '',
    codePostal: g.codePostal ?? '',
    ville: g.ville ?? '',
    profession: g.profession ?? '',
    employeur: g.employeur ?? '',
    revenusMensuels: g.revenusMensuels !== undefined ? String(g.revenusMensuels) : '',
    typeGarantie: g.typeGarantie,
    montantMaxGaranti: g.montantMaxGaranti !== undefined ? String(g.montantMaxGaranti) : '',
    dureeEngagement: g.dureeEngagement ?? '',
    dateFinEngagement: g.dateFinEngagement ?? '',
    numeroVisale: g.numeroVisale ?? '',
    organismeGarant: g.organismeGarant ?? '',
  };
}

const numOrUndef = (v: string) => (v.trim() === '' ? undefined : Number(v));
const trimOrUndef = (v: string) => (v.trim() === '' ? undefined : v.trim());

function formToInput(values: FormValues): CreateGarantInput {
  return {
    civilite: values.civilite,
    nom: values.nom,
    prenom: values.prenom,
    dateNaissance: values.dateNaissance.trim() === '' ? undefined : new Date(values.dateNaissance),
    email: values.email,
    telephone: values.telephone,
    adresse: trimOrUndef(values.adresse),
    codePostal: trimOrUndef(values.codePostal),
    ville: trimOrUndef(values.ville),
    profession: trimOrUndef(values.profession),
    employeur: trimOrUndef(values.employeur),
    revenusMensuels: numOrUndef(values.revenusMensuels),
    typeGarantie: values.typeGarantie,
    montantMaxGaranti: numOrUndef(values.montantMaxGaranti),
    dureeEngagement: values.dureeEngagement === '' ? undefined : values.dureeEngagement,
    dateFinEngagement:
      values.dateFinEngagement.trim() === '' ? undefined : new Date(values.dateFinEngagement),
    numeroVisale: trimOrUndef(values.numeroVisale),
    organismeGarant: trimOrUndef(values.organismeGarant),
  };
}

const SELECT_BASE =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

function Section({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-md border bg-card open:pb-4 [&[open]>summary]:border-b"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between rounded-md px-4 py-3 text-sm font-medium hover:bg-accent">
        {title}
        <span className="text-xs text-muted-foreground transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>
      <div className="space-y-4 px-4 pt-4">{children}</div>
    </details>
  );
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  garant?: Garant;
};

export function GarantFormDialog({ open, onOpenChange, garant }: Props) {
  const isEdit = Boolean(garant);
  const createMutation = useCreateGarant();
  const updateMutation = useUpdateGarant();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: emptyDefaults,
  });

  useEffect(() => {
    if (open) form.reset(garant ? garantToDefaults(garant) : emptyDefaults);
  }, [open, garant, form]);

  const typeGarantie = form.watch('typeGarantie');
  const dureeEngagement = form.watch('dureeEngagement');

  const onValid = async (values: FormValues) => {
    try {
      const input = formToInput(values);
      if (garant) {
        await updateMutation.mutateAsync({ id: garant.id, input });
        toast.success('Garant modifié');
      } else {
        await createMutation.mutateAsync(input);
        toast.success('Garant créé');
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erreur inconnue');
    }
  };

  const onInvalid = (errors: FieldErrors<FormValues>) => {
    const first = Object.values(errors)[0];
    const msg = (first as { message?: string } | undefined)?.message;
    toast.error(msg ?? 'Formulaire invalide');
  };

  const onSubmit = form.handleSubmit(onValid, onInvalid);
  const isSubmitting = form.formState.isSubmitting;
  const errors = form.formState.errors;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Modifier le garant' : 'Nouveau garant'}</DialogTitle>
          <DialogDescription>
            Personne ou organisme se portant caution pour un locataire.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-3">
          <Section title="Identité">
            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="civilite">Civilité</Label>
                <select id="civilite" {...form.register('civilite')} className={SELECT_BASE}>
                  <option value="M">M.</option>
                  <option value="MME">Mme</option>
                  <option value="MLLE">Mlle</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="prenom">Prénom *</Label>
                <Input id="prenom" {...form.register('prenom')} />
                {errors.prenom && (
                  <p className="text-xs text-destructive">{errors.prenom.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nom">Nom *</Label>
                <Input id="nom" {...form.register('nom')} />
                {errors.nom && <p className="text-xs text-destructive">{errors.nom.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dateNaissance">Date de naissance</Label>
                <Input id="dateNaissance" type="date" {...form.register('dateNaissance')} />
              </div>
            </div>
          </Section>

          <Section title="Contact">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email *</Label>
                <Input id="email" type="email" {...form.register('email')} />
                {errors.email && (
                  <p className="text-xs text-destructive">{errors.email.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="telephone">Téléphone *</Label>
                <Input id="telephone" {...form.register('telephone')} />
                {errors.telephone && (
                  <p className="text-xs text-destructive">{errors.telephone.message}</p>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="adresse">Adresse</Label>
              <Input id="adresse" {...form.register('adresse')} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="codePostal">Code postal</Label>
                <Input id="codePostal" {...form.register('codePostal')} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="ville">Ville</Label>
                <Input id="ville" {...form.register('ville')} />
              </div>
            </div>
          </Section>

          <Section title="Garantie">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="typeGarantie">Type de garantie *</Label>
                <select
                  id="typeGarantie"
                  {...form.register('typeGarantie')}
                  className={SELECT_BASE}
                >
                  <option value="PHYSIQUE">Personne physique</option>
                  <option value="MORALE">Personne morale</option>
                  <option value="VISALE">Visale</option>
                  <option value="CAUTION_BANCAIRE">Caution bancaire</option>
                  <option value="GARANTIE_LOCAPASS">Garantie Loca-Pass</option>
                  <option value="AUTRE">Autre</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="montantMaxGaranti">Montant max garanti (€)</Label>
                <Input
                  id="montantMaxGaranti"
                  type="number"
                  step="0.01"
                  {...form.register('montantMaxGaranti')}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dureeEngagement">Durée d'engagement</Label>
                <select
                  id="dureeEngagement"
                  {...form.register('dureeEngagement')}
                  className={SELECT_BASE}
                >
                  <option value="">— non précisée —</option>
                  <option value="BAIL_INITIAL">Bail initial uniquement</option>
                  <option value="INDETERMINEE">Indéterminée</option>
                  <option value="DUREE_FIXE">Durée fixe</option>
                </select>
              </div>
              {dureeEngagement === 'DUREE_FIXE' && (
                <div className="space-y-1.5">
                  <Label htmlFor="dateFinEngagement">Date fin d'engagement</Label>
                  <Input
                    id="dateFinEngagement"
                    type="date"
                    {...form.register('dateFinEngagement')}
                  />
                </div>
              )}
              {typeGarantie === 'VISALE' && (
                <div className="space-y-1.5">
                  <Label htmlFor="numeroVisale">N° Visale</Label>
                  <Input id="numeroVisale" {...form.register('numeroVisale')} />
                </div>
              )}
              {(typeGarantie === 'CAUTION_BANCAIRE' ||
                typeGarantie === 'GARANTIE_LOCAPASS' ||
                typeGarantie === 'MORALE' ||
                typeGarantie === 'AUTRE') && (
                <div className="space-y-1.5">
                  <Label htmlFor="organismeGarant">Organisme</Label>
                  <Input
                    id="organismeGarant"
                    placeholder="Banque, État, etc."
                    {...form.register('organismeGarant')}
                  />
                </div>
              )}
            </div>
          </Section>

          <Section title="Profession & revenus" defaultOpen={false}>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="profession">Profession</Label>
                <Input id="profession" {...form.register('profession')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="employeur">Employeur</Label>
                <Input id="employeur" {...form.register('employeur')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="revenusMensuels">Revenus mensuels nets (€)</Label>
                <Input
                  id="revenusMensuels"
                  type="number"
                  step="0.01"
                  {...form.register('revenusMensuels')}
                />
              </div>
            </div>
          </Section>

          <DialogFooter className="pt-2">
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
