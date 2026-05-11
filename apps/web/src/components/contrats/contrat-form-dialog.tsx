import type { CreateContratInput } from '@gl/shared';
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
import { useBiens } from '@/lib/db/biens';
import { type Contrat, useCreateContrat, useUpdateContrat } from '@/lib/db/contrats';
import { useLocataires } from '@/lib/db/locataires';

const requiredNonNeg = (msg: string) =>
  z
    .string()
    .trim()
    .refine((v) => v !== '' && !isNaN(Number(v)) && Number(v) >= 0, msg);
const optionalNonNeg = z
  .string()
  .trim()
  .refine((v) => v === '' || (!isNaN(Number(v)) && Number(v) >= 0), 'Doit être >= 0');
const requiredPosInt = (msg: string) =>
  z
    .string()
    .trim()
    .refine(
      (v) => v !== '' && !isNaN(Number(v)) && Number.isInteger(Number(v)) && Number(v) > 0,
      msg,
    );
const optionalIntInRange = (min: number, max: number, msg: string) =>
  z
    .string()
    .trim()
    .refine(
      (v) =>
        v === '' ||
        (!isNaN(Number(v)) && Number.isInteger(Number(v)) && Number(v) >= min && Number(v) <= max),
      msg,
    );

const formSchema = z
  .object({
    bienId: z.string().uuid('Bien requis'),
    reference: z.string().trim(),
    type: z.enum([
      'HABITATION_VIDE',
      'HABITATION_MEUBLE',
      'MOBILITE',
      'ETUDIANT',
      'COMMERCIAL',
      'PROFESSIONNEL',
      'PARKING',
      'GARAGE',
      'SAISONNIER',
    ]),
    usage: z.enum(['RESIDENCE_PRINCIPALE', 'RESIDENCE_SECONDAIRE', 'MIXTE']),
    statut: z.enum(['BROUILLON', 'ACTIF', 'EXPIRE', 'RENOUVELE', 'RESILIE', 'ARCHIVE']),

    dateSignature: z.string().trim().min(1, 'Date de signature requise'),
    dateDebut: z.string().trim().min(1, 'Date de début requise'),
    dateFin: z.string().trim(),
    dureeMois: requiredPosInt('Durée en mois > 0'),
    reconductionTacite: z.boolean(),

    loyer: requiredNonNeg('Loyer >= 0'),
    chargesMensuelles: requiredNonNeg('Charges >= 0'),
    modeCharges: z.enum(['PROVISION_REGULARISATION', 'FORFAIT']),
    depotGarantie: requiredNonNeg('Dépôt >= 0'),
    dateEncaissementDg: z.string().trim(),
    jourPaiement: z
      .string()
      .trim()
      .refine(
        (v) =>
          v !== '' &&
          !isNaN(Number(v)) &&
          Number.isInteger(Number(v)) &&
          Number(v) >= 1 &&
          Number(v) <= 31,
        'Jour entre 1 et 31',
      ),
    modePaiement: z.enum([
      'VIREMENT',
      'PRELEVEMENT',
      'CHEQUE',
      'ESPECES',
      'CAF',
      'PAYLIB',
      'AUTRE',
    ]),

    fraisNotaire: requiredNonNeg('>= 0'),
    fraisHuissier: requiredNonNeg('>= 0'),
    fraisAgenceLocation: requiredNonNeg('>= 0'),

    zoneGeographique: z.enum(['', 'TENDUE', 'NON_TENDUE']),
    encadrementLoyer: z.boolean(),
    loyerReference: optionalNonNeg,
    loyerReferenceMajore: optionalNonNeg,
    complementLoyer: optionalNonNeg,

    irlActive: z.boolean(),
    irlTrimestreRef: optionalIntInRange(1, 4, 'Trimestre 1-4'),
    irlAnneeRef: optionalIntInRange(2000, 2100, 'Année invalide'),
    irlValeurRef: optionalNonNeg,

    clausesParticulieres: z.string().trim(),
    clauseResolutoire: z.string().trim(),
    clauseSolidarite: z.boolean(),
    commentaires: z.string().trim(),

    locataireIds: z.array(z.string().uuid()).min(1, 'Au moins un locataire'),
    locataireIdPrincipal: z.string().uuid('Locataire principal requis'),
  })
  .refine((data) => data.locataireIds.includes(data.locataireIdPrincipal), {
    message: 'Le locataire principal doit faire partie des locataires sélectionnés',
    path: ['locataireIdPrincipal'],
  });

type FormValues = z.infer<typeof formSchema>;

const emptyDefaults: FormValues = {
  bienId: '',
  reference: '',
  type: 'HABITATION_VIDE',
  usage: 'RESIDENCE_PRINCIPALE',
  statut: 'BROUILLON',

  dateSignature: '',
  dateDebut: '',
  dateFin: '',
  dureeMois: '36',
  reconductionTacite: true,

  loyer: '',
  chargesMensuelles: '0',
  modeCharges: 'PROVISION_REGULARISATION',
  depotGarantie: '0',
  dateEncaissementDg: '',
  jourPaiement: '1',
  modePaiement: 'VIREMENT',

  fraisNotaire: '0',
  fraisHuissier: '0',
  fraisAgenceLocation: '0',

  zoneGeographique: '',
  encadrementLoyer: false,
  loyerReference: '',
  loyerReferenceMajore: '',
  complementLoyer: '',

  irlActive: false,
  irlTrimestreRef: '',
  irlAnneeRef: '',
  irlValeurRef: '',

  clausesParticulieres: '',
  clauseResolutoire: '',
  clauseSolidarite: false,
  commentaires: '',

  locataireIds: [],
  locataireIdPrincipal: '',
};

function contratToDefaults(c: Contrat): FormValues {
  return {
    bienId: c.bienId,
    reference: c.reference ?? '',
    type: c.type,
    usage: c.usage,
    statut: c.statut,

    dateSignature: c.dateSignature,
    dateDebut: c.dateDebut,
    dateFin: c.dateFin ?? '',
    dureeMois: String(c.dureeMois),
    reconductionTacite: c.reconductionTacite,

    loyer: String(c.loyer),
    chargesMensuelles: String(c.chargesMensuelles),
    modeCharges: c.modeCharges,
    depotGarantie: String(c.depotGarantie),
    dateEncaissementDg: c.dateEncaissementDg ?? '',
    jourPaiement: String(c.jourPaiement),
    modePaiement: c.modePaiement,

    fraisNotaire: String(c.fraisNotaire),
    fraisHuissier: String(c.fraisHuissier),
    fraisAgenceLocation: String(c.fraisAgenceLocation),

    zoneGeographique: c.zoneGeographique ?? '',
    encadrementLoyer: c.encadrementLoyer,
    loyerReference: c.loyerReference !== undefined ? String(c.loyerReference) : '',
    loyerReferenceMajore:
      c.loyerReferenceMajore !== undefined ? String(c.loyerReferenceMajore) : '',
    complementLoyer: c.complementLoyer !== undefined ? String(c.complementLoyer) : '',

    irlActive: c.irlActive,
    irlTrimestreRef: c.irlTrimestreRef !== undefined ? String(c.irlTrimestreRef) : '',
    irlAnneeRef: c.irlAnneeRef !== undefined ? String(c.irlAnneeRef) : '',
    irlValeurRef: c.irlValeurRef !== undefined ? String(c.irlValeurRef) : '',

    clausesParticulieres: c.clausesParticulieres ?? '',
    clauseResolutoire: c.clauseResolutoire ?? '',
    clauseSolidarite: c.clauseSolidarite,
    commentaires: c.commentaires ?? '',

    locataireIds: c.locataires.map((l) => l.locataireId),
    locataireIdPrincipal: c.locataires.find((l) => l.estPrincipal)?.locataireId ?? '',
  };
}

const numOrUndef = (v: string) => (v.trim() === '' ? undefined : Number(v));

function formToInput(values: FormValues): CreateContratInput {
  return {
    bienId: values.bienId,
    reference: values.reference.trim() === '' ? undefined : values.reference.trim(),
    type: values.type,
    usage: values.usage,
    statut: values.statut,

    dateSignature: new Date(values.dateSignature),
    dateDebut: new Date(values.dateDebut),
    dateFin: values.dateFin.trim() === '' ? undefined : new Date(values.dateFin),
    dureeMois: Number(values.dureeMois),
    reconductionTacite: values.reconductionTacite,

    loyer: Number(values.loyer),
    chargesMensuelles: Number(values.chargesMensuelles),
    modeCharges: values.modeCharges,
    depotGarantie: Number(values.depotGarantie),
    dateEncaissementDg:
      values.dateEncaissementDg.trim() === '' ? undefined : new Date(values.dateEncaissementDg),
    jourPaiement: Number(values.jourPaiement),
    modePaiement: values.modePaiement,

    fraisNotaire: Number(values.fraisNotaire),
    fraisHuissier: Number(values.fraisHuissier),
    fraisAgenceLocation: Number(values.fraisAgenceLocation),

    zoneGeographique: values.zoneGeographique === '' ? undefined : values.zoneGeographique,
    encadrementLoyer: values.encadrementLoyer,
    loyerReference: numOrUndef(values.loyerReference),
    loyerReferenceMajore: numOrUndef(values.loyerReferenceMajore),
    complementLoyer: numOrUndef(values.complementLoyer),

    irlActive: values.irlActive,
    irlTrimestreRef: numOrUndef(values.irlTrimestreRef),
    irlAnneeRef: numOrUndef(values.irlAnneeRef),
    irlValeurRef: numOrUndef(values.irlValeurRef),

    clausesParticulieres:
      values.clausesParticulieres.trim() === '' ? undefined : values.clausesParticulieres.trim(),
    clauseResolutoire:
      values.clauseResolutoire.trim() === '' ? undefined : values.clauseResolutoire.trim(),
    clauseSolidarite: values.clauseSolidarite,
    commentaires: values.commentaires.trim() === '' ? undefined : values.commentaires.trim(),

    locataireIds: values.locataireIds,
    locataireIdPrincipal: values.locataireIdPrincipal,
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
  contrat?: Contrat;
};

export function ContratFormDialog({ open, onOpenChange, contrat }: Props) {
  const isEdit = Boolean(contrat);
  const createMutation = useCreateContrat();
  const updateMutation = useUpdateContrat();
  const biensQuery = useBiens();
  const locatairesQuery = useLocataires();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: emptyDefaults,
  });

  useEffect(() => {
    if (open) form.reset(contrat ? contratToDefaults(contrat) : emptyDefaults);
  }, [open, contrat, form]);

  const locataireIds = form.watch('locataireIds');
  const locataireIdPrincipal = form.watch('locataireIdPrincipal');
  const irlActive = form.watch('irlActive');
  const encadrementLoyer = form.watch('encadrementLoyer');

  const toggleLocataire = (id: string, checked: boolean) => {
    const newIds = checked ? [...locataireIds, id] : locataireIds.filter((x) => x !== id);
    form.setValue('locataireIds', newIds, { shouldDirty: true, shouldValidate: false });
    // Auto-set principal si c'est le premier sélectionné, ou clear si on enlève le principal
    if (checked && newIds.length === 1) {
      form.setValue('locataireIdPrincipal', id, { shouldDirty: true });
    } else if (!checked && locataireIdPrincipal === id) {
      form.setValue('locataireIdPrincipal', newIds[0] ?? '', { shouldDirty: true });
    }
  };

  const setPrincipal = (id: string) => {
    form.setValue('locataireIdPrincipal', id, { shouldDirty: true, shouldValidate: false });
  };

  const onValid = async (values: FormValues) => {
    try {
      const input = formToInput(values);
      if (contrat) {
        await updateMutation.mutateAsync({ id: contrat.id, input });
        toast.success('Contrat modifié');
      } else {
        await createMutation.mutateAsync(input);
        toast.success('Contrat créé');
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

  const biens = biensQuery.data ?? [];
  const locataires = locatairesQuery.data ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Modifier le contrat' : 'Nouveau contrat de bail'}</DialogTitle>
          <DialogDescription>
            Bail liant un bien à un ou plusieurs locataires (avec un principal).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-3">
          <Section title="Identification" defaultOpen>
            <div className="space-y-1.5">
              <Label htmlFor="bienId">Bien *</Label>
              {biens.length === 0 ? (
                <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
                  Aucun bien enregistré. Crée d'abord un bien.
                </p>
              ) : (
                <select id="bienId" {...form.register('bienId')} className={SELECT_BASE}>
                  <option value="">— sélectionner —</option>
                  {biens.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.reference ? `[${b.reference}] ` : ''}
                      {b.adresse}, {b.codePostal} {b.ville}
                    </option>
                  ))}
                </select>
              )}
              {errors.bienId && <p className="text-xs text-destructive">{errors.bienId.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="reference">Référence interne</Label>
                <Input id="reference" placeholder="BAIL-2026-001" {...form.register('reference')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="statut">Statut *</Label>
                <select id="statut" {...form.register('statut')} className={SELECT_BASE}>
                  <option value="BROUILLON">Brouillon</option>
                  <option value="ACTIF">Actif</option>
                  <option value="EXPIRE">Expiré</option>
                  <option value="RENOUVELE">Renouvelé</option>
                  <option value="RESILIE">Résilié</option>
                  <option value="ARCHIVE">Archivé</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="type">Type de bail *</Label>
                <select id="type" {...form.register('type')} className={SELECT_BASE}>
                  <option value="HABITATION_VIDE">Habitation - vide</option>
                  <option value="HABITATION_MEUBLE">Habitation - meublé</option>
                  <option value="MOBILITE">Bail mobilité</option>
                  <option value="ETUDIANT">Étudiant</option>
                  <option value="COMMERCIAL">Commercial</option>
                  <option value="PROFESSIONNEL">Professionnel</option>
                  <option value="PARKING">Parking</option>
                  <option value="GARAGE">Garage</option>
                  <option value="SAISONNIER">Saisonnier</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="usage">Usage *</Label>
                <select id="usage" {...form.register('usage')} className={SELECT_BASE}>
                  <option value="RESIDENCE_PRINCIPALE">Résidence principale</option>
                  <option value="RESIDENCE_SECONDAIRE">Résidence secondaire</option>
                  <option value="MIXTE">Mixte</option>
                </select>
              </div>
            </div>
          </Section>

          <Section title="Dates & durée" defaultOpen>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="dateSignature">Signature *</Label>
                <Input id="dateSignature" type="date" {...form.register('dateSignature')} />
                {errors.dateSignature && (
                  <p className="text-xs text-destructive">{errors.dateSignature.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dateDebut">Prise d'effet *</Label>
                <Input id="dateDebut" type="date" {...form.register('dateDebut')} />
                {errors.dateDebut && (
                  <p className="text-xs text-destructive">{errors.dateDebut.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dateFin">Fin prévue</Label>
                <Input id="dateFin" type="date" {...form.register('dateFin')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dureeMois">Durée (mois) *</Label>
                <Input id="dureeMois" type="number" {...form.register('dureeMois')} />
                {errors.dureeMois && (
                  <p className="text-xs text-destructive">{errors.dureeMois.message}</p>
                )}
              </div>
              <div className="col-span-2 flex items-end">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    {...form.register('reconductionTacite')}
                    className="h-4 w-4"
                  />
                  Reconduction tacite
                </label>
              </div>
            </div>
          </Section>

          <Section title="Locataires" defaultOpen>
            {locataires.length === 0 ? (
              <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
                Aucun locataire enregistré. Crée d'abord au moins un locataire.
              </p>
            ) : (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">
                  Coche les locataires du bail, puis désigne le principal.
                </p>
                <div className="space-y-1 rounded-md border bg-background p-2">
                  <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-2 py-1 text-xs font-medium text-muted-foreground">
                    <span>Locataire</span>
                    <span>Inclus</span>
                    <span>Principal</span>
                  </div>
                  {locataires.map((l) => {
                    const checked = locataireIds.includes(l.id);
                    return (
                      <div
                        key={l.id}
                        className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded px-2 py-1.5 text-sm hover:bg-accent"
                      >
                        <span>
                          {l.prenom} {l.nom}
                          <span className="ml-2 text-xs text-muted-foreground">{l.email}</span>
                        </span>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => toggleLocataire(l.id, e.target.checked)}
                          className="h-4 w-4"
                        />
                        <input
                          type="radio"
                          name="locataireIdPrincipal"
                          checked={locataireIdPrincipal === l.id}
                          disabled={!checked}
                          onChange={() => setPrincipal(l.id)}
                          className="h-4 w-4"
                        />
                      </div>
                    );
                  })}
                </div>
                {errors.locataireIds && (
                  <p className="text-xs text-destructive">
                    {(errors.locataireIds as { message?: string }).message}
                  </p>
                )}
                {errors.locataireIdPrincipal && (
                  <p className="text-xs text-destructive">{errors.locataireIdPrincipal.message}</p>
                )}
              </div>
            )}
          </Section>

          <Section title="Loyer & charges" defaultOpen>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="loyer">Loyer hors charges (€) *</Label>
                <Input id="loyer" type="number" step="0.01" {...form.register('loyer')} />
                {errors.loyer && <p className="text-xs text-destructive">{errors.loyer.message}</p>}
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
                <Label htmlFor="modeCharges">Mode des charges *</Label>
                <select
                  id="modeCharges"
                  {...form.register('modeCharges')}
                  className={SELECT_BASE}
                >
                  <option value="PROVISION_REGULARISATION">Provision + régularisation</option>
                  <option value="FORFAIT">Forfait</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="depotGarantie">Dépôt de garantie (€) *</Label>
                <Input
                  id="depotGarantie"
                  type="number"
                  step="0.01"
                  {...form.register('depotGarantie')}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dateEncaissementDg">Date encaissement DG</Label>
                <Input
                  id="dateEncaissementDg"
                  type="date"
                  {...form.register('dateEncaissementDg')}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="jourPaiement">Jour de paiement (1-31) *</Label>
                <Input id="jourPaiement" type="number" {...form.register('jourPaiement')} />
                {errors.jourPaiement && (
                  <p className="text-xs text-destructive">{errors.jourPaiement.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="modePaiement">Mode de paiement *</Label>
                <select
                  id="modePaiement"
                  {...form.register('modePaiement')}
                  className={SELECT_BASE}
                >
                  <option value="VIREMENT">Virement</option>
                  <option value="PRELEVEMENT">Prélèvement</option>
                  <option value="CHEQUE">Chèque</option>
                  <option value="ESPECES">Espèces</option>
                  <option value="CAF">CAF directe</option>
                  <option value="PAYLIB">Paylib</option>
                  <option value="AUTRE">Autre</option>
                </select>
              </div>
            </div>
          </Section>

          <Section title="Frais">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="fraisNotaire">Frais de notaire (€)</Label>
                <Input
                  id="fraisNotaire"
                  type="number"
                  step="0.01"
                  {...form.register('fraisNotaire')}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fraisHuissier">Frais d'huissier (€)</Label>
                <Input
                  id="fraisHuissier"
                  type="number"
                  step="0.01"
                  {...form.register('fraisHuissier')}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fraisAgenceLocation">Frais d'agence (€)</Label>
                <Input
                  id="fraisAgenceLocation"
                  type="number"
                  step="0.01"
                  {...form.register('fraisAgenceLocation')}
                />
              </div>
            </div>
          </Section>

          <Section title="Encadrement des loyers (zone tendue)">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="zoneGeographique">Zone géographique</Label>
                <select
                  id="zoneGeographique"
                  {...form.register('zoneGeographique')}
                  className={SELECT_BASE}
                >
                  <option value="">— non précisée —</option>
                  <option value="TENDUE">Zone tendue</option>
                  <option value="NON_TENDUE">Zone non tendue</option>
                </select>
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    {...form.register('encadrementLoyer')}
                    className="h-4 w-4"
                  />
                  Encadrement applicable
                </label>
              </div>
              {encadrementLoyer && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="loyerReference">Loyer de référence (€)</Label>
                    <Input
                      id="loyerReference"
                      type="number"
                      step="0.01"
                      {...form.register('loyerReference')}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="loyerReferenceMajore">Loyer de référence majoré (€)</Label>
                    <Input
                      id="loyerReferenceMajore"
                      type="number"
                      step="0.01"
                      {...form.register('loyerReferenceMajore')}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="complementLoyer">Complément de loyer (€)</Label>
                    <Input
                      id="complementLoyer"
                      type="number"
                      step="0.01"
                      {...form.register('complementLoyer')}
                    />
                  </div>
                </>
              )}
            </div>
          </Section>

          <Section title="Indexation IRL">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...form.register('irlActive')} className="h-4 w-4" />
              Indexation IRL active
            </label>
            {irlActive && (
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="irlTrimestreRef">Trimestre IRL réf.</Label>
                  <Input
                    id="irlTrimestreRef"
                    type="number"
                    min="1"
                    max="4"
                    {...form.register('irlTrimestreRef')}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="irlAnneeRef">Année IRL réf.</Label>
                  <Input
                    id="irlAnneeRef"
                    type="number"
                    placeholder="2025"
                    {...form.register('irlAnneeRef')}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="irlValeurRef">Valeur IRL réf.</Label>
                  <Input
                    id="irlValeurRef"
                    type="number"
                    step="0.01"
                    placeholder="146.07"
                    {...form.register('irlValeurRef')}
                  />
                </div>
              </div>
            )}
          </Section>

          <Section title="Clauses">
            <div className="space-y-1.5">
              <Label htmlFor="clausesParticulieres">Clauses particulières</Label>
              <textarea
                id="clausesParticulieres"
                rows={3}
                {...form.register('clausesParticulieres')}
                placeholder="Animaux, fumeurs, sous-location…"
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="clauseResolutoire">Clause résolutoire</Label>
              <textarea
                id="clauseResolutoire"
                rows={3}
                {...form.register('clauseResolutoire')}
                placeholder="Conditions de résiliation de plein droit…"
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...form.register('clauseSolidarite')} className="h-4 w-4" />
              Clause de solidarité (colocation)
            </label>
          </Section>

          <Section title="Notes">
            <div className="space-y-1.5">
              <Label htmlFor="commentaires">Commentaires internes</Label>
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
