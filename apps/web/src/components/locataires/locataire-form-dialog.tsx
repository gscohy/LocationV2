import {
  codePostalSchema,
  emailSchema,
  type CreateLocataireInput,
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
import { useGarants } from '@/lib/db/garants';
import {
  type Locataire,
  useCreateLocataire,
  useUpdateLocataire,
} from '@/lib/db/locataires';

const optionalNonNeg = z
  .string()
  .trim()
  .refine((v) => v === '' || (!isNaN(Number(v)) && Number(v) >= 0), 'Doit être >= 0');

const optionalNonNegInt = z
  .string()
  .trim()
  .refine(
    (v) => v === '' || (!isNaN(Number(v)) && Number.isInteger(Number(v)) && Number(v) >= 0),
    'Entier >= 0',
  );

const formSchema = z.object({
  // Identité
  civilite: z.enum(['M', 'MME', 'MLLE']),
  nom: z.string().trim().min(1, 'Nom requis'),
  nomNaissance: z.string().trim(),
  prenom: z.string().trim().min(1, 'Prénom requis'),
  autresPrenoms: z.string().trim(),

  // Naissance
  dateNaissance: z.string().trim().min(1, 'Date de naissance requise'),
  lieuNaissance: z.string().trim().min(1, 'Lieu de naissance requis'),
  paysNaissance: z.string().trim(),
  nationalite: z.string().trim(),

  // Pièce
  typePieceIdentite: z.enum(['', 'CNI', 'PASSEPORT', 'TITRE_SEJOUR']),
  numeroPieceIdentite: z.string().trim(),

  // Contact
  email: emailSchema,
  telephoneMobile: z.string().trim().min(1, 'Téléphone mobile requis'),
  telephoneFixe: z.string().trim(),

  // Adresse précédente
  adressePrecedente: z.string().trim(),
  codePostalPrecedent: z
    .string()
    .trim()
    .refine((v) => v === '' || codePostalSchema.safeParse(v).success, 'Code postal invalide'),
  villePrecedente: z.string().trim(),

  // Profession
  profession: z.string().trim(),
  employeur: z.string().trim(),
  typeContratTravail: z.enum([
    '',
    'CDI',
    'CDD',
    'INTERIM',
    'INDEPENDANT',
    'FONCTIONNAIRE',
    'RETRAITE',
    'ETUDIANT',
    'AUTRE',
  ]),
  dateEmbauche: z.string().trim(),

  // Revenus
  revenusMensuels: optionalNonNeg,
  autresRevenus: optionalNonNeg,

  // Situation
  situationMatrimoniale: z.enum(['', 'CELIBATAIRE', 'MARIE', 'PACS', 'DIVORCE', 'VEUF']),
  nombreEnfants: optionalNonNegInt,
  numeroCaf: z.string().trim(),

  commentaires: z.string().trim(),

  garantIds: z.array(z.string().uuid()),
});

type FormValues = z.infer<typeof formSchema>;

const emptyDefaults: FormValues = {
  civilite: 'M',
  nom: '',
  nomNaissance: '',
  prenom: '',
  autresPrenoms: '',
  dateNaissance: '',
  lieuNaissance: '',
  paysNaissance: '',
  nationalite: '',
  typePieceIdentite: '',
  numeroPieceIdentite: '',
  email: '',
  telephoneMobile: '',
  telephoneFixe: '',
  adressePrecedente: '',
  codePostalPrecedent: '',
  villePrecedente: '',
  profession: '',
  employeur: '',
  typeContratTravail: '',
  dateEmbauche: '',
  revenusMensuels: '',
  autresRevenus: '',
  situationMatrimoniale: '',
  nombreEnfants: '',
  numeroCaf: '',
  commentaires: '',
  garantIds: [],
};

function locataireToDefaults(l: Locataire): FormValues {
  return {
    civilite: l.civilite,
    nom: l.nom,
    nomNaissance: l.nomNaissance ?? '',
    prenom: l.prenom,
    autresPrenoms: l.autresPrenoms ?? '',
    dateNaissance: l.dateNaissance,
    lieuNaissance: l.lieuNaissance,
    paysNaissance: l.paysNaissance ?? '',
    nationalite: l.nationalite ?? '',
    typePieceIdentite: l.typePieceIdentite ?? '',
    numeroPieceIdentite: l.numeroPieceIdentite ?? '',
    email: l.email,
    telephoneMobile: l.telephoneMobile,
    telephoneFixe: l.telephoneFixe ?? '',
    adressePrecedente: l.adressePrecedente ?? '',
    codePostalPrecedent: l.codePostalPrecedent ?? '',
    villePrecedente: l.villePrecedente ?? '',
    profession: l.profession ?? '',
    employeur: l.employeur ?? '',
    typeContratTravail: l.typeContratTravail ?? '',
    dateEmbauche: l.dateEmbauche ?? '',
    revenusMensuels: l.revenusMensuels !== undefined ? String(l.revenusMensuels) : '',
    autresRevenus: l.autresRevenus !== undefined ? String(l.autresRevenus) : '',
    situationMatrimoniale: l.situationMatrimoniale ?? '',
    nombreEnfants: l.nombreEnfants !== undefined ? String(l.nombreEnfants) : '',
    numeroCaf: l.numeroCaf ?? '',
    commentaires: l.commentaires ?? '',
    garantIds: l.garants.map((g) => g.garantId),
  };
}

const numOrUndef = (v: string) => (v.trim() === '' ? undefined : Number(v));
const trimOrUndef = (v: string) => (v.trim() === '' ? undefined : v.trim());

function formToInput(values: FormValues): CreateLocataireInput {
  return {
    civilite: values.civilite,
    nom: values.nom,
    nomNaissance: trimOrUndef(values.nomNaissance),
    prenom: values.prenom,
    autresPrenoms: trimOrUndef(values.autresPrenoms),

    dateNaissance: new Date(values.dateNaissance),
    lieuNaissance: values.lieuNaissance,
    paysNaissance: trimOrUndef(values.paysNaissance),
    nationalite: trimOrUndef(values.nationalite),

    typePieceIdentite: values.typePieceIdentite === '' ? undefined : values.typePieceIdentite,
    numeroPieceIdentite: trimOrUndef(values.numeroPieceIdentite),

    email: values.email,
    telephoneMobile: values.telephoneMobile,
    telephoneFixe: trimOrUndef(values.telephoneFixe),

    adressePrecedente: trimOrUndef(values.adressePrecedente),
    codePostalPrecedent: trimOrUndef(values.codePostalPrecedent),
    villePrecedente: trimOrUndef(values.villePrecedente),

    profession: trimOrUndef(values.profession),
    employeur: trimOrUndef(values.employeur),
    typeContratTravail: values.typeContratTravail === '' ? undefined : values.typeContratTravail,
    dateEmbauche: values.dateEmbauche.trim() === '' ? undefined : new Date(values.dateEmbauche),

    revenusMensuels: numOrUndef(values.revenusMensuels),
    autresRevenus: numOrUndef(values.autresRevenus),

    situationMatrimoniale:
      values.situationMatrimoniale === '' ? undefined : values.situationMatrimoniale,
    nombreEnfants: numOrUndef(values.nombreEnfants),
    numeroCaf: trimOrUndef(values.numeroCaf),

    commentaires: trimOrUndef(values.commentaires),
  };
}

const SELECT_BASE =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

function Section({
  title,
  defaultOpen = false,
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
  locataire?: Locataire;
};

export function LocataireFormDialog({ open, onOpenChange, locataire }: Props) {
  const isEdit = Boolean(locataire);
  const createMutation = useCreateLocataire();
  const updateMutation = useUpdateLocataire();
  const garantsQuery = useGarants();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: emptyDefaults,
  });

  useEffect(() => {
    if (open) form.reset(locataire ? locataireToDefaults(locataire) : emptyDefaults);
  }, [open, locataire, form]);

  const garantIds = form.watch('garantIds');
  const setGarantIds = (ids: string[]) =>
    form.setValue('garantIds', ids, { shouldDirty: true, shouldValidate: false });

  const onValid = async (values: FormValues) => {
    try {
      const input = formToInput(values);
      if (locataire) {
        await updateMutation.mutateAsync({
          id: locataire.id,
          input,
          garantIds: values.garantIds,
        });
        toast.success('Locataire modifié');
      } else {
        await createMutation.mutateAsync({ input, garantIds: values.garantIds });
        toast.success('Locataire créé');
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erreur inconnue');
    }
  };

  const onInvalid = (errors: FieldErrors<FormValues>) => {
    const flatten = (e: unknown): string | undefined => {
      if (!e) return undefined;
      if (typeof e === 'object' && e !== null) {
        if ('message' in e && typeof e.message === 'string') return e.message;
        for (const v of Object.values(e)) {
          const m = flatten(v);
          if (m) return m;
        }
      }
      return undefined;
    };
    toast.error(flatten(errors) ?? 'Formulaire invalide');
  };

  const onSubmit = form.handleSubmit(onValid, onInvalid);
  const isSubmitting = form.formState.isSubmitting;
  const errors = form.formState.errors;
  const garants = garantsQuery.data ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Modifier le locataire' : 'Nouveau locataire'}</DialogTitle>
          <DialogDescription>
            Personne qui occupe le bien. Au moins une pièce d'identité et des justificatifs de
            revenus seront demandés au moment du bail.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-3">
          <Section title="Identité" defaultOpen>
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
                <Label htmlFor="nomNaissance">Nom de naissance</Label>
                <Input id="nomNaissance" {...form.register('nomNaissance')} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="autresPrenoms">Autres prénoms</Label>
              <Input id="autresPrenoms" {...form.register('autresPrenoms')} />
            </div>
          </Section>

          <Section title="Naissance" defaultOpen>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="dateNaissance">Date de naissance *</Label>
                <Input id="dateNaissance" type="date" {...form.register('dateNaissance')} />
                {errors.dateNaissance && (
                  <p className="text-xs text-destructive">{errors.dateNaissance.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lieuNaissance">Lieu de naissance *</Label>
                <Input id="lieuNaissance" {...form.register('lieuNaissance')} />
                {errors.lieuNaissance && (
                  <p className="text-xs text-destructive">{errors.lieuNaissance.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="paysNaissance">Pays de naissance</Label>
                <Input id="paysNaissance" {...form.register('paysNaissance')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nationalite">Nationalité</Label>
                <Input id="nationalite" {...form.register('nationalite')} />
              </div>
            </div>
          </Section>

          <Section title="Contact" defaultOpen>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email *</Label>
                <Input id="email" type="email" {...form.register('email')} />
                {errors.email && (
                  <p className="text-xs text-destructive">{errors.email.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="telephoneMobile">Téléphone mobile *</Label>
                <Input id="telephoneMobile" {...form.register('telephoneMobile')} />
                {errors.telephoneMobile && (
                  <p className="text-xs text-destructive">{errors.telephoneMobile.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="telephoneFixe">Téléphone fixe</Label>
                <Input id="telephoneFixe" {...form.register('telephoneFixe')} />
              </div>
            </div>
          </Section>

          <Section title="Pièce d'identité">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="typePieceIdentite">Type</Label>
                <select
                  id="typePieceIdentite"
                  {...form.register('typePieceIdentite')}
                  className={SELECT_BASE}
                >
                  <option value="">— non précisé —</option>
                  <option value="CNI">Carte d'identité</option>
                  <option value="PASSEPORT">Passeport</option>
                  <option value="TITRE_SEJOUR">Titre de séjour</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="numeroPieceIdentite">Numéro</Label>
                <Input id="numeroPieceIdentite" {...form.register('numeroPieceIdentite')} />
              </div>
            </div>
          </Section>

          <Section title="Adresse précédente">
            <div className="space-y-1.5">
              <Label htmlFor="adressePrecedente">Adresse</Label>
              <Input id="adressePrecedente" {...form.register('adressePrecedente')} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="codePostalPrecedent">Code postal</Label>
                <Input id="codePostalPrecedent" {...form.register('codePostalPrecedent')} />
                {errors.codePostalPrecedent && (
                  <p className="text-xs text-destructive">
                    {errors.codePostalPrecedent.message}
                  </p>
                )}
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="villePrecedente">Ville</Label>
                <Input id="villePrecedente" {...form.register('villePrecedente')} />
              </div>
            </div>
          </Section>

          <Section title="Profession & revenus">
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
                <Label htmlFor="typeContratTravail">Type de contrat</Label>
                <select
                  id="typeContratTravail"
                  {...form.register('typeContratTravail')}
                  className={SELECT_BASE}
                >
                  <option value="">— non précisé —</option>
                  <option value="CDI">CDI</option>
                  <option value="CDD">CDD</option>
                  <option value="INTERIM">Intérim</option>
                  <option value="INDEPENDANT">Indépendant</option>
                  <option value="FONCTIONNAIRE">Fonctionnaire</option>
                  <option value="RETRAITE">Retraité</option>
                  <option value="ETUDIANT">Étudiant</option>
                  <option value="AUTRE">Autre</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dateEmbauche">Date d'embauche</Label>
                <Input id="dateEmbauche" type="date" {...form.register('dateEmbauche')} />
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
              <div className="space-y-1.5">
                <Label htmlFor="autresRevenus">Autres revenus (€)</Label>
                <Input
                  id="autresRevenus"
                  type="number"
                  step="0.01"
                  {...form.register('autresRevenus')}
                />
              </div>
            </div>
          </Section>

          <Section title="Situation familiale">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="situationMatrimoniale">Situation</Label>
                <select
                  id="situationMatrimoniale"
                  {...form.register('situationMatrimoniale')}
                  className={SELECT_BASE}
                >
                  <option value="">— non précisée —</option>
                  <option value="CELIBATAIRE">Célibataire</option>
                  <option value="MARIE">Marié(e)</option>
                  <option value="PACS">Pacsé(e)</option>
                  <option value="DIVORCE">Divorcé(e)</option>
                  <option value="VEUF">Veuf / Veuve</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nombreEnfants">Enfants à charge</Label>
                <Input id="nombreEnfants" type="number" {...form.register('nombreEnfants')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="numeroCaf">N° CAF / allocataire</Label>
                <Input id="numeroCaf" {...form.register('numeroCaf')} />
              </div>
            </div>
          </Section>

          <Section title="Garants associés">
            {garants.length === 0 ? (
              <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
                Aucun garant enregistré. Crée d'abord des garants dans le module Garants pour
                pouvoir les associer ici.
              </p>
            ) : (
              <div className="space-y-2">
                {garants.map((g) => {
                  const checked = garantIds.includes(g.id);
                  const label = `${g.prenom} ${g.nom}`;
                  return (
                    <label
                      key={g.id}
                      className="flex items-center gap-2 rounded-md border bg-background p-2 text-sm hover:bg-accent"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) =>
                          setGarantIds(
                            e.target.checked
                              ? [...garantIds, g.id]
                              : garantIds.filter((id) => id !== g.id),
                          )
                        }
                        className="h-4 w-4"
                      />
                      <span className="flex-1">{label}</span>
                      <span className="text-xs text-muted-foreground">{g.typeGarantie}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </Section>

          <Section title="Notes">
            <div className="space-y-1.5">
              <Label htmlFor="commentaires">Commentaires</Label>
              <textarea
                id="commentaires"
                rows={3}
                {...form.register('commentaires')}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
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
