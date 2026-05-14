import {
  chargeSchema,
  type CategorieCharge,
  type ChargeInput,
  type FrequenceCharge,
  type ModePaiementCharge,
  type TypeCharge,
} from '@gl/shared';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FileUploadField } from '@/components/ui/file-upload-field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useBiens } from '@/lib/db/biens';
import {
  getPreuveUrl,
  uploadPreuve,
  useCreateCharge,
  useUpdateCharge,
  type Charge,
} from '@/lib/db/charges';

const SELECT_CLASS =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

const CATEGORIES: { value: CategorieCharge; label: string }[] = [
  { value: 'TRAVAUX', label: 'Travaux' },
  { value: 'ENTRETIEN', label: 'Entretien' },
  { value: 'ASSURANCE_PNO', label: 'Assurance PNO' },
  { value: 'ASSURANCE_LOYERS_IMPAYES', label: 'Assurance loyers impayés' },
  { value: 'CREDIT_IMMOBILIER', label: 'Crédit immobilier' },
  { value: 'TAXE_FONCIERE', label: 'Taxe foncière' },
  { value: 'TAXE_HABITATION', label: "Taxe d'habitation" },
  { value: 'CHARGES_COPROPRIETE', label: 'Charges de copropriété' },
  { value: 'FRAIS_GESTION', label: 'Frais de gestion' },
  { value: 'HONORAIRES_AGENCE', label: 'Honoraires agence' },
  { value: 'FRAIS_PROCEDURE', label: 'Frais de procédure' },
  { value: 'EAU', label: 'Eau' },
  { value: 'ELECTRICITE', label: 'Électricité' },
  { value: 'GAZ', label: 'Gaz' },
  { value: 'INTERNET', label: 'Internet' },
  { value: 'EXCEPTIONNELLE', label: 'Exceptionnelle' },
  { value: 'AUTRE', label: 'Autre' },
];

const MODES: { value: ModePaiementCharge; label: string }[] = [
  { value: 'VIREMENT', label: 'Virement' },
  { value: 'PRELEVEMENT', label: 'Prélèvement' },
  { value: 'CHEQUE', label: 'Chèque' },
  { value: 'ESPECES', label: 'Espèces' },
  { value: 'PAYLIB', label: 'Paylib' },
  { value: 'AUTRE', label: 'Autre' },
];

const FREQUENCES: { value: FrequenceCharge; label: string }[] = [
  { value: 'MENSUELLE', label: 'Mensuelle' },
  { value: 'TRIMESTRIELLE', label: 'Trimestrielle' },
  { value: 'SEMESTRIELLE', label: 'Semestrielle' },
  { value: 'ANNUELLE', label: 'Annuelle' },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  charge: Charge | undefined;
}

interface FormState {
  bienId: string;
  categorie: CategorieCharge;
  sousCategorie: string;
  description: string;
  fournisseur: string;
  numeroFacture: string;
  montantTtc: string;
  montantHt: string;
  tva: string;
  date: string;
  datePaiement: string;
  modePaiement: ModePaiementCharge | '';
  type: TypeCharge;
  frequence: FrequenceCharge | '';
  dateDebut: string;
  dateFin: string;
  recuperable: boolean;
  deductible: boolean;
  ligne2044: string;
  commentaires: string;
  preuveStorageKey: string | undefined;
}

function emptyState(): FormState {
  return {
    bienId: '',
    categorie: 'TRAVAUX',
    sousCategorie: '',
    description: '',
    fournisseur: '',
    numeroFacture: '',
    montantTtc: '',
    montantHt: '',
    tva: '',
    date: new Date().toISOString().slice(0, 10),
    datePaiement: '',
    modePaiement: '',
    type: 'PONCTUELLE',
    frequence: '',
    dateDebut: '',
    dateFin: '',
    recuperable: false,
    deductible: true,
    ligne2044: '',
    commentaires: '',
    preuveStorageKey: undefined,
  };
}

function chargeToState(c: Charge): FormState {
  return {
    bienId: c.bienId,
    categorie: c.categorie,
    sousCategorie: c.sousCategorie ?? '',
    description: c.description,
    fournisseur: c.fournisseur ?? '',
    numeroFacture: c.numeroFacture ?? '',
    montantTtc: String(c.montantTtc),
    montantHt: c.montantHt !== undefined ? String(c.montantHt) : '',
    tva: c.tva !== undefined ? String(c.tva) : '',
    date: c.date,
    datePaiement: c.datePaiement ?? '',
    modePaiement: c.modePaiement ?? '',
    type: c.type,
    frequence: c.frequence ?? '',
    dateDebut: c.dateDebut ?? '',
    dateFin: c.dateFin ?? '',
    recuperable: c.recuperable,
    deductible: c.deductible,
    ligne2044: c.ligne2044 ?? '',
    commentaires: c.commentaires ?? '',
    preuveStorageKey: c.preuveStorageKey,
  };
}

export function ChargeFormDialog({ open, onOpenChange, charge }: Props) {
  const isEdit = Boolean(charge);
  const biensQuery = useBiens();
  const createMutation = useCreateCharge();
  const updateMutation = useUpdateCharge();

  const [state, setState] = useState<FormState>(emptyState());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setState(charge ? chargeToState(charge) : emptyState());
  }, [open, charge]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setState((s) => ({ ...s, [key]: value }));

  const trimOrUndef = (s: string) => (s.trim() === '' ? undefined : s.trim());
  const numOrUndef = (s: string) => (s.trim() === '' ? undefined : Number(s));

  const handleSubmit = async () => {
    const input: ChargeInput = {
      bienId: state.bienId,
      categorie: state.categorie,
      sousCategorie: trimOrUndef(state.sousCategorie),
      description: state.description.trim(),
      fournisseur: trimOrUndef(state.fournisseur),
      numeroFacture: trimOrUndef(state.numeroFacture),
      montantTtc: Number(state.montantTtc),
      montantHt: numOrUndef(state.montantHt),
      tva: numOrUndef(state.tva),
      date: state.date,
      datePaiement: trimOrUndef(state.datePaiement),
      modePaiement: state.modePaiement === '' ? undefined : state.modePaiement,
      type: state.type,
      frequence: state.frequence === '' ? undefined : state.frequence,
      dateDebut: trimOrUndef(state.dateDebut),
      dateFin: trimOrUndef(state.dateFin),
      recuperable: state.recuperable,
      deductible: state.deductible,
      ligne2044: trimOrUndef(state.ligne2044),
      commentaires: trimOrUndef(state.commentaires),
      preuveStorageKey: state.preuveStorageKey,
    };
    const parsed = chargeSchema.safeParse(input);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Formulaire invalide');
      return;
    }
    setSubmitting(true);
    try {
      if (charge) {
        await updateMutation.mutateAsync({ id: charge.id, input: parsed.data });
        toast.success('Charge modifiée');
      } else {
        await createMutation.mutateAsync(parsed.data);
        toast.success('Charge enregistrée');
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  const biens = biensQuery.data ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Modifier la charge' : 'Nouvelle charge'}</DialogTitle>
          <DialogDescription>
            Toute dépense engagée sur un bien (travaux, crédit, assurance, taxes, fluides…).
            Une preuve (facture, photo) peut être attachée.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="c-bien">Bien *</Label>
              <select
                id="c-bien"
                value={state.bienId}
                onChange={(e) => update('bienId', e.target.value)}
                disabled={submitting}
                className={SELECT_CLASS}
              >
                <option value="">— choisir —</option>
                {biens.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.adresse} ({b.codePostal} {b.ville})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-categorie">Catégorie *</Label>
              <select
                id="c-categorie"
                value={state.categorie}
                onChange={(e) => update('categorie', e.target.value as CategorieCharge)}
                disabled={submitting}
                className={SELECT_CLASS}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="c-description">Description *</Label>
            <Input
              id="c-description"
              value={state.description}
              onChange={(e) => update('description', e.target.value)}
              disabled={submitting}
              placeholder="Ex. Réfection peinture séjour"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="c-fournisseur">Fournisseur / prestataire</Label>
              <Input
                id="c-fournisseur"
                value={state.fournisseur}
                onChange={(e) => update('fournisseur', e.target.value)}
                disabled={submitting}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-facture">N° facture</Label>
              <Input
                id="c-facture"
                value={state.numeroFacture}
                onChange={(e) => update('numeroFacture', e.target.value)}
                disabled={submitting}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="c-ttc">Montant TTC (€) *</Label>
              <Input
                id="c-ttc"
                type="number"
                step="0.01"
                min="0"
                value={state.montantTtc}
                onChange={(e) => update('montantTtc', e.target.value)}
                disabled={submitting}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-ht">Montant HT</Label>
              <Input
                id="c-ht"
                type="number"
                step="0.01"
                min="0"
                value={state.montantHt}
                onChange={(e) => update('montantHt', e.target.value)}
                disabled={submitting}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-tva">TVA</Label>
              <Input
                id="c-tva"
                type="number"
                step="0.01"
                min="0"
                value={state.tva}
                onChange={(e) => update('tva', e.target.value)}
                disabled={submitting}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="c-date">Date *</Label>
              <Input
                id="c-date"
                type="date"
                value={state.date}
                onChange={(e) => update('date', e.target.value)}
                disabled={submitting}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-datepaiement">Date de paiement</Label>
              <Input
                id="c-datepaiement"
                type="date"
                value={state.datePaiement}
                onChange={(e) => update('datePaiement', e.target.value)}
                disabled={submitting}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-mode">Mode de paiement</Label>
              <select
                id="c-mode"
                value={state.modePaiement}
                onChange={(e) =>
                  update('modePaiement', e.target.value as ModePaiementCharge | '')
                }
                disabled={submitting}
                className={SELECT_CLASS}
              >
                <option value="">—</option>
                {MODES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="c-type">Type</Label>
              <select
                id="c-type"
                value={state.type}
                onChange={(e) => update('type', e.target.value as TypeCharge)}
                disabled={submitting}
                className={SELECT_CLASS}
              >
                <option value="PONCTUELLE">Ponctuelle</option>
                <option value="RECURRENTE">Récurrente</option>
              </select>
            </div>
            {state.type === 'RECURRENTE' && (
              <div className="space-y-1.5">
                <Label htmlFor="c-frequence">Fréquence</Label>
                <select
                  id="c-frequence"
                  value={state.frequence}
                  onChange={(e) =>
                    update('frequence', e.target.value as FrequenceCharge | '')
                  }
                  disabled={submitting}
                  className={SELECT_CLASS}
                >
                  <option value="">—</option>
                  {FREQUENCES.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {state.type === 'RECURRENTE' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="c-debut">Début de la récurrence</Label>
                <Input
                  id="c-debut"
                  type="date"
                  value={state.dateDebut}
                  onChange={(e) => update('dateDebut', e.target.value)}
                  disabled={submitting}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-fin">Fin (optionnel)</Label>
                <Input
                  id="c-fin"
                  type="date"
                  value={state.dateFin}
                  onChange={(e) => update('dateFin', e.target.value)}
                  disabled={submitting}
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Preuve (facture, photo)</Label>
            <FileUploadField
              value={state.preuveStorageKey}
              onChange={(v) => update('preuveStorageKey', v)}
              uploadFn={uploadPreuve}
              getUrlFn={getPreuveUrl}
              disabled={submitting}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={state.recuperable}
                onChange={(e) => update('recuperable', e.target.checked)}
                disabled={submitting}
              />
              Récupérable auprès du locataire
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={state.deductible}
                onChange={(e) => update('deductible', e.target.checked)}
                disabled={submitting}
              />
              Déductible fiscalement
            </label>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="c-commentaires">Commentaires</Label>
            <textarea
              id="c-commentaires"
              rows={2}
              value={state.commentaires}
              onChange={(e) => update('commentaires', e.target.value)}
              disabled={submitting}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? 'Enregistrer' : 'Créer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
