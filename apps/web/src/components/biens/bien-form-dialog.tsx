import {
  codePostalSchema,
  type CreateBienInput,
  type ProprietairePart,
} from '@gl/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { useFieldArray, useForm, type FieldErrors } from 'react-hook-form';
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
import { type Bien, useCreateBien, useUpdateBien } from '@/lib/db/biens';
import { useProprietaires } from '@/lib/db/proprietaires';
import { cn } from '@/lib/utils';

// Helpers
const optionalText = z.string().trim();
const requiredText = (msg: string) => z.string().trim().min(1, msg);
const requiredPositive = (msg: string) =>
  z
    .string()
    .trim()
    .refine((v) => v !== '' && !isNaN(Number(v)) && Number(v) > 0, msg);
const requiredNonNeg = (msg: string) =>
  z
    .string()
    .trim()
    .refine((v) => v !== '' && !isNaN(Number(v)) && Number(v) >= 0, msg);
const optionalNonNeg = z
  .string()
  .trim()
  .refine((v) => v === '' || (!isNaN(Number(v)) && Number(v) >= 0), 'Doit être >= 0');
const requiredPositiveInt = (msg: string) =>
  z
    .string()
    .trim()
    .refine(
      (v) => v !== '' && !isNaN(Number(v)) && Number.isInteger(Number(v)) && Number(v) > 0,
      msg,
    );
const nonNegInt = z
  .string()
  .trim()
  .refine(
    (v) => v !== '' && !isNaN(Number(v)) && Number.isInteger(Number(v)) && Number(v) >= 0,
    'Entier >= 0 requis',
  );
const optionalNonNegInt = z
  .string()
  .trim()
  .refine(
    (v) => v === '' || (!isNaN(Number(v)) && Number.isInteger(Number(v)) && Number(v) >= 0),
    'Entier >= 0',
  );
const optionalInt = z
  .string()
  .trim()
  .refine((v) => v === '' || (!isNaN(Number(v)) && Number.isInteger(Number(v))), 'Entier requis');

const proprietaireRowSchema = z.object({
  proprietaireId: z.string().uuid('Propriétaire requis'),
  quotePart: z
    .string()
    .trim()
    .refine(
      (v) => v !== '' && !isNaN(Number(v)) && Number(v) >= 0 && Number(v) <= 100,
      'Quote-part entre 0 et 100',
    ),
});

const formSchema = z
  .object({
    reference: optionalText,
    type: z.enum(['APPARTEMENT', 'MAISON', 'STUDIO', 'LOCAL', 'GARAGE', 'PARKING', 'CAVE', 'TERRAIN']),
    usage: z.enum(['', 'HABITATION', 'MIXTE', 'PROFESSIONNEL', 'COMMERCIAL']),
    statut: z.enum(['VACANT', 'LOUE', 'TRAVAUX', 'INDISPONIBLE', 'VENDU']),

    adresse: requiredText('Adresse requise'),
    complementAdresse: optionalText,
    codePostal: codePostalSchema,
    ville: requiredText('Ville requise'),
    pays: requiredText('Pays requis'),

    surfaceHabitable: requiredPositive('Surface > 0'),
    surfaceCarrez: optionalNonNeg,
    surfaceTerrain: optionalNonNeg,
    nbPieces: requiredPositiveInt('Nb pièces > 0'),
    nbChambres: nonNegInt,
    nbSallesBain: optionalNonNegInt,
    etage: optionalInt,

    ascenseur: z.boolean(),
    meuble: z.boolean(),
    balcon: z.boolean(),
    parking: z.boolean(),
    cave: z.boolean(),

    chauffageType: z.enum([
      '',
      'INDIVIDUEL_GAZ',
      'INDIVIDUEL_ELEC',
      'COLLECTIF',
      'POMPE_CHALEUR',
      'BOIS',
      'AUTRE',
    ]),
    eauChaudeType: z.enum(['', 'INDIVIDUEL', 'COLLECTIF']),
    classeDpe: z.enum(['', 'A', 'B', 'C', 'D', 'E', 'F', 'G']),
    classeGes: z.enum(['', 'A', 'B', 'C', 'D', 'E', 'F', 'G']),

    description: optionalText,
    reglementInterieur: optionalText,

    loyer: requiredNonNeg('Loyer >= 0'),
    chargesMensuelles: requiredNonNeg('Charges >= 0'),
    depotGarantie: requiredNonNeg('Dépôt >= 0'),

    dateAchat: z.string().trim(),
    prixAchat: optionalNonNeg,
    fraisNotaireAchat: optionalNonNeg,
    fraisAgenceAchat: optionalNonNeg,
    travauxInitiaux: optionalNonNeg,
    valeurEstimee: optionalNonNeg,

    proprietaires: z.array(proprietaireRowSchema).min(1, 'Au moins un propriétaire'),
  })
  .refine(
    (data) =>
      Math.abs(
        data.proprietaires.reduce((s, p) => s + (Number(p.quotePart) || 0), 0) - 100,
      ) < 0.01,
    { message: 'La somme des quote-parts doit faire 100%', path: ['proprietaires'] },
  );

type FormValues = z.infer<typeof formSchema>;

const emptyDefaults: FormValues = {
  reference: '',
  type: 'APPARTEMENT',
  usage: 'HABITATION',
  statut: 'VACANT',

  adresse: '',
  complementAdresse: '',
  codePostal: '',
  ville: '',
  pays: 'France',

  surfaceHabitable: '',
  surfaceCarrez: '',
  surfaceTerrain: '',
  nbPieces: '1',
  nbChambres: '0',
  nbSallesBain: '',
  etage: '',

  ascenseur: false,
  meuble: false,
  balcon: false,
  parking: false,
  cave: false,

  chauffageType: '',
  eauChaudeType: '',
  classeDpe: '',
  classeGes: '',

  description: '',
  reglementInterieur: '',

  loyer: '',
  chargesMensuelles: '0',
  depotGarantie: '0',

  dateAchat: '',
  prixAchat: '',
  fraisNotaireAchat: '',
  fraisAgenceAchat: '',
  travauxInitiaux: '',
  valeurEstimee: '',

  proprietaires: [],
};

function bienToDefaults(b: Bien): FormValues {
  return {
    reference: b.reference ?? '',
    type: b.type,
    usage: b.usage ?? 'HABITATION',
    statut: b.statut,

    adresse: b.adresse,
    complementAdresse: b.complementAdresse ?? '',
    codePostal: b.codePostal,
    ville: b.ville,
    pays: b.pays,

    surfaceHabitable: String(b.surfaceHabitable),
    surfaceCarrez: b.surfaceCarrez !== undefined ? String(b.surfaceCarrez) : '',
    surfaceTerrain: b.surfaceTerrain !== undefined ? String(b.surfaceTerrain) : '',
    nbPieces: String(b.nbPieces),
    nbChambres: String(b.nbChambres),
    nbSallesBain: b.nbSallesBain !== undefined ? String(b.nbSallesBain) : '',
    etage: b.etage !== undefined ? String(b.etage) : '',

    ascenseur: b.ascenseur,
    meuble: b.meuble,
    balcon: b.balcon,
    parking: b.parking,
    cave: b.cave,

    chauffageType: b.chauffageType ?? '',
    eauChaudeType: b.eauChaudeType ?? '',
    classeDpe: b.classeDpe ?? '',
    classeGes: b.classeGes ?? '',

    description: b.description ?? '',
    reglementInterieur: b.reglementInterieur ?? '',

    loyer: String(b.loyer),
    chargesMensuelles: String(b.chargesMensuelles),
    depotGarantie: String(b.depotGarantie),

    dateAchat: b.dateAchat ?? '',
    prixAchat: b.prixAchat !== undefined ? String(b.prixAchat) : '',
    fraisNotaireAchat: b.fraisNotaireAchat !== undefined ? String(b.fraisNotaireAchat) : '',
    fraisAgenceAchat: b.fraisAgenceAchat !== undefined ? String(b.fraisAgenceAchat) : '',
    travauxInitiaux: b.travauxInitiaux !== undefined ? String(b.travauxInitiaux) : '',
    valeurEstimee: b.valeurEstimee !== undefined ? String(b.valeurEstimee) : '',

    proprietaires: b.proprietaires.map((p) => ({
      proprietaireId: p.proprietaireId,
      quotePart: String(p.quotePart),
    })),
  };
}

const numOrUndef = (v: string) => (v.trim() === '' ? undefined : Number(v));
const numOrZero = (v: string) => (v.trim() === '' ? 0 : Number(v));
const trimOrUndef = (v: string) => (v.trim() === '' ? undefined : v.trim());

function formToInput(values: FormValues): CreateBienInput {
  return {
    reference: trimOrUndef(values.reference),
    type: values.type,
    usage: values.usage === '' ? undefined : values.usage,
    statut: values.statut,

    adresse: values.adresse,
    complementAdresse: trimOrUndef(values.complementAdresse),
    codePostal: values.codePostal,
    ville: values.ville,
    pays: values.pays,

    surfaceHabitable: Number(values.surfaceHabitable),
    surfaceCarrez: numOrUndef(values.surfaceCarrez),
    surfaceTerrain: numOrUndef(values.surfaceTerrain),
    nbPieces: Number(values.nbPieces),
    nbChambres: Number(values.nbChambres),
    nbSallesBain: numOrUndef(values.nbSallesBain),
    etage: numOrUndef(values.etage),

    ascenseur: values.ascenseur,
    meuble: values.meuble,
    balcon: values.balcon,
    parking: values.parking,
    cave: values.cave,

    chauffageType: values.chauffageType === '' ? undefined : values.chauffageType,
    eauChaudeType: values.eauChaudeType === '' ? undefined : values.eauChaudeType,
    classeDpe: values.classeDpe === '' ? undefined : values.classeDpe,
    classeGes: values.classeGes === '' ? undefined : values.classeGes,

    description: trimOrUndef(values.description),
    reglementInterieur: trimOrUndef(values.reglementInterieur),

    loyer: numOrZero(values.loyer),
    chargesMensuelles: numOrZero(values.chargesMensuelles),
    depotGarantie: numOrZero(values.depotGarantie),

    dateAchat: values.dateAchat.trim() === '' ? undefined : new Date(values.dateAchat),
    prixAchat: numOrUndef(values.prixAchat),
    fraisNotaireAchat: numOrUndef(values.fraisNotaireAchat),
    fraisAgenceAchat: numOrUndef(values.fraisAgenceAchat),
    travauxInitiaux: numOrUndef(values.travauxInitiaux),
    valeurEstimee: numOrUndef(values.valeurEstimee),

    proprietaires: values.proprietaires.map(
      (p): ProprietairePart => ({
        proprietaireId: p.proprietaireId,
        quotePart: Number(p.quotePart),
      }),
    ),
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
  bien?: Bien;
};

export function BienFormDialog({ open, onOpenChange, bien }: Props) {
  const isEdit = Boolean(bien);
  const createMutation = useCreateBien();
  const updateMutation = useUpdateBien();
  const proprietairesQuery = useProprietaires();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: emptyDefaults,
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'proprietaires',
  });

  useEffect(() => {
    if (open) {
      form.reset(bien ? bienToDefaults(bien) : emptyDefaults);
    }
  }, [open, bien, form]);

  const watchedProps = form.watch('proprietaires');
  const total = useMemo(
    () => watchedProps.reduce((s, p) => s + (Number(p.quotePart) || 0), 0),
    [watchedProps],
  );
  const totalOk = Math.abs(total - 100) < 0.01;

  const onValid = async (values: FormValues) => {
    try {
      const input = formToInput(values);
      if (bien) {
        const { proprietaires, ...rest } = input;
        await updateMutation.mutateAsync({ id: bien.id, input: rest, proprietaires });
        toast.success('Bien modifié');
      } else {
        await createMutation.mutateAsync(input);
        toast.success('Bien créé');
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

  const proprietairesList = proprietairesQuery.data ?? [];
  const usedIds = new Set(watchedProps.map((p) => p.proprietaireId).filter(Boolean));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Modifier le bien' : 'Nouveau bien'}</DialogTitle>
          <DialogDescription>
            Bien physique lou&eacute; ou destin&eacute; &agrave; la location.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-3">
          <Section title="Identification" defaultOpen>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="reference">Référence interne</Label>
                <Input id="reference" placeholder="APP01" {...form.register('reference')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="type">Type *</Label>
                <select id="type" {...form.register('type')} className={SELECT_BASE}>
                  <option value="APPARTEMENT">Appartement</option>
                  <option value="MAISON">Maison</option>
                  <option value="STUDIO">Studio</option>
                  <option value="LOCAL">Local commercial</option>
                  <option value="GARAGE">Garage</option>
                  <option value="PARKING">Parking</option>
                  <option value="CAVE">Cave</option>
                  <option value="TERRAIN">Terrain</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="usage">Usage</Label>
                <select id="usage" {...form.register('usage')} className={SELECT_BASE}>
                  <option value="">— non précisé —</option>
                  <option value="HABITATION">Habitation</option>
                  <option value="MIXTE">Mixte</option>
                  <option value="PROFESSIONNEL">Professionnel</option>
                  <option value="COMMERCIAL">Commercial</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="statut">Statut *</Label>
                <select id="statut" {...form.register('statut')} className={SELECT_BASE}>
                  <option value="VACANT">Vacant</option>
                  <option value="LOUE">Loué</option>
                  <option value="TRAVAUX">Travaux</option>
                  <option value="INDISPONIBLE">Indisponible</option>
                  <option value="VENDU">Vendu</option>
                </select>
              </div>
            </div>
          </Section>

          <Section title="Localisation" defaultOpen>
            <div className="space-y-1.5">
              <Label htmlFor="adresse">Adresse *</Label>
              <Input id="adresse" {...form.register('adresse')} />
              {errors.adresse && (
                <p className="text-xs text-destructive">{errors.adresse.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="complementAdresse">Complément (bâtiment, étage…)</Label>
              <Input id="complementAdresse" {...form.register('complementAdresse')} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="codePostal">Code postal *</Label>
                <Input id="codePostal" {...form.register('codePostal')} />
                {errors.codePostal && (
                  <p className="text-xs text-destructive">{errors.codePostal.message}</p>
                )}
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="ville">Ville *</Label>
                <Input id="ville" {...form.register('ville')} />
                {errors.ville && <p className="text-xs text-destructive">{errors.ville.message}</p>}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pays">Pays *</Label>
              <Input id="pays" {...form.register('pays')} />
            </div>
          </Section>

          <Section title="Caractéristiques" defaultOpen>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="surfaceHabitable">Surface habitable (m²) *</Label>
                <Input
                  id="surfaceHabitable"
                  type="number"
                  step="0.01"
                  {...form.register('surfaceHabitable')}
                />
                {errors.surfaceHabitable && (
                  <p className="text-xs text-destructive">{errors.surfaceHabitable.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="surfaceCarrez">Surface Carrez (m²)</Label>
                <Input
                  id="surfaceCarrez"
                  type="number"
                  step="0.01"
                  {...form.register('surfaceCarrez')}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="surfaceTerrain">Surface terrain (m²)</Label>
                <Input
                  id="surfaceTerrain"
                  type="number"
                  step="0.01"
                  {...form.register('surfaceTerrain')}
                />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="nbPieces">Nb pièces *</Label>
                <Input id="nbPieces" type="number" {...form.register('nbPieces')} />
                {errors.nbPieces && (
                  <p className="text-xs text-destructive">{errors.nbPieces.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nbChambres">Nb chambres *</Label>
                <Input id="nbChambres" type="number" {...form.register('nbChambres')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nbSallesBain">Salles de bain</Label>
                <Input id="nbSallesBain" type="number" {...form.register('nbSallesBain')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="etage">Étage</Label>
                <Input id="etage" type="number" {...form.register('etage')} />
              </div>
            </div>
          </Section>

          <Section title="Loyer & charges" defaultOpen>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="loyer">Loyer hors charges (€) *</Label>
                <Input id="loyer" type="number" step="0.01" {...form.register('loyer')} />
                {errors.loyer && (
                  <p className="text-xs text-destructive">{errors.loyer.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="chargesMensuelles">Charges mensuelles (€)</Label>
                <Input
                  id="chargesMensuelles"
                  type="number"
                  step="0.01"
                  {...form.register('chargesMensuelles')}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="depotGarantie">Dépôt de garantie (€)</Label>
                <Input
                  id="depotGarantie"
                  type="number"
                  step="0.01"
                  {...form.register('depotGarantie')}
                />
              </div>
            </div>
          </Section>

          <Section title="Propriétaires & quote-parts" defaultOpen>
            {proprietairesList.length === 0 && (
              <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
                Aucun propriétaire enregistré. Crée d'abord au moins un propriétaire dans le module
                Propriétaires.
              </p>
            )}
            {fields.map((field, index) => (
              <div key={field.id} className="flex items-end gap-2">
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor={`prop-${index}`}>Propriétaire</Label>
                  <select
                    id={`prop-${index}`}
                    {...form.register(`proprietaires.${index}.proprietaireId` as const)}
                    className={SELECT_BASE}
                  >
                    <option value="">— sélectionner —</option>
                    {proprietairesList.map((p) => {
                      const label =
                        p.type === 'MORALE'
                          ? p.entreprise || p.nom
                          : `${p.prenom ?? ''} ${p.nom}`.trim();
                      const disabled =
                        usedIds.has(p.id) && p.id !== watchedProps[index]?.proprietaireId;
                      return (
                        <option key={p.id} value={p.id} disabled={disabled}>
                          {label} {disabled ? '(déjà ajouté)' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div className="w-32 space-y-1.5">
                  <Label htmlFor={`qp-${index}`}>Quote-part %</Label>
                  <Input
                    id={`qp-${index}`}
                    type="number"
                    step="0.01"
                    {...form.register(`proprietaires.${index}.quotePart` as const)}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(index)}
                  aria-label="Retirer"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ proprietaireId: '', quotePart: '' })}
                disabled={proprietairesList.length === 0}
              >
                <Plus className="h-4 w-4" />
                Ajouter un propriétaire
              </Button>
              {fields.length > 0 && (
                <p
                  className={cn(
                    'text-sm font-medium',
                    totalOk ? 'text-green-600' : 'text-destructive',
                  )}
                >
                  Total : {total.toFixed(2)} % {totalOk ? '✓' : `(${(100 - total).toFixed(2)} % manquants)`}
                </p>
              )}
            </div>
          </Section>

          <Section title="Équipements">
            <div className="grid grid-cols-3 gap-4">
              {(
                [
                  ['ascenseur', 'Ascenseur'],
                  ['meuble', 'Meublé'],
                  ['balcon', 'Balcon / terrasse'],
                  ['parking', 'Place de parking'],
                  ['cave', 'Cave'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" {...form.register(key)} className="h-4 w-4" />
                  {label}
                </label>
              ))}
            </div>
          </Section>

          <Section title="Énergie">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="chauffageType">Chauffage</Label>
                <select
                  id="chauffageType"
                  {...form.register('chauffageType')}
                  className={SELECT_BASE}
                >
                  <option value="">— non précisé —</option>
                  <option value="INDIVIDUEL_GAZ">Individuel gaz</option>
                  <option value="INDIVIDUEL_ELEC">Individuel électrique</option>
                  <option value="COLLECTIF">Collectif</option>
                  <option value="POMPE_CHALEUR">Pompe à chaleur</option>
                  <option value="BOIS">Bois</option>
                  <option value="AUTRE">Autre</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="eauChaudeType">Eau chaude</Label>
                <select
                  id="eauChaudeType"
                  {...form.register('eauChaudeType')}
                  className={SELECT_BASE}
                >
                  <option value="">— non précisé —</option>
                  <option value="INDIVIDUEL">Individuel</option>
                  <option value="COLLECTIF">Collectif</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="classeDpe">DPE</Label>
                <select id="classeDpe" {...form.register('classeDpe')} className={SELECT_BASE}>
                  <option value="">—</option>
                  {(['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="classeGes">GES</Label>
                <select id="classeGes" {...form.register('classeGes')} className={SELECT_BASE}>
                  <option value="">—</option>
                  {(['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </Section>

          <Section title="Achat & valorisation">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="dateAchat">Date d'achat</Label>
                <Input id="dateAchat" type="date" {...form.register('dateAchat')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="prixAchat">Prix d'achat (€)</Label>
                <Input id="prixAchat" type="number" step="0.01" {...form.register('prixAchat')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="valeurEstimee">Valeur estimée (€)</Label>
                <Input
                  id="valeurEstimee"
                  type="number"
                  step="0.01"
                  {...form.register('valeurEstimee')}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fraisNotaireAchat">Frais de notaire (€)</Label>
                <Input
                  id="fraisNotaireAchat"
                  type="number"
                  step="0.01"
                  {...form.register('fraisNotaireAchat')}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fraisAgenceAchat">Frais d'agence (€)</Label>
                <Input
                  id="fraisAgenceAchat"
                  type="number"
                  step="0.01"
                  {...form.register('fraisAgenceAchat')}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="travauxInitiaux">Travaux initiaux (€)</Label>
                <Input
                  id="travauxInitiaux"
                  type="number"
                  step="0.01"
                  {...form.register('travauxInitiaux')}
                />
              </div>
            </div>
          </Section>

          <Section title="Notes">
            <div className="space-y-1.5">
              <Label htmlFor="description">Description publique</Label>
              <textarea
                id="description"
                rows={3}
                {...form.register('description')}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reglementInterieur">Règlement intérieur</Label>
              <textarea
                id="reglementInterieur"
                rows={3}
                {...form.register('reglementInterieur')}
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
