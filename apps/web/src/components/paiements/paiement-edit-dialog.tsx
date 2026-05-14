import { Loader2, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLoyers } from '@/lib/db/loyers';
import {
  useUpdatePaiement,
  type ModePaiement,
  type Paiement,
} from '@/lib/db/paiements';

const SELECT_CLASS =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

// CAF n'est pas un mode de paiement (c'est un payeur). Reste dispo en BDD pour les
// anciens enregistrements, mais n'apparaît plus dans la sélection.
const MODES: { value: ModePaiement; label: string }[] = [
  { value: 'VIREMENT', label: 'Virement' },
  { value: 'PRELEVEMENT', label: 'Prélèvement' },
  { value: 'CHEQUE', label: 'Chèque' },
  { value: 'ESPECES', label: 'Espèces' },
  { value: 'PAYLIB', label: 'Paylib' },
  { value: 'AUTRE', label: 'Autre' },
];

const PAYEURS_PREDEFINIS = ['Locataire', 'CAF', 'Garant', 'Autre'] as const;
type PayeurType = (typeof PAYEURS_PREDEFINIS)[number];

const MOIS_COURT = [
  'janv.',
  'févr.',
  'mars',
  'avr.',
  'mai',
  'juin',
  'juil.',
  'août',
  'sept.',
  'oct.',
  'nov.',
  'déc.',
];

const formatEuro = (v: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v);

interface VentilLine {
  loyerId: string;
  montant: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paiement: Paiement | undefined;
}

export function PaiementEditDialog({ open, onOpenChange, paiement }: Props) {
  const update = useUpdatePaiement();
  const loyersQuery = useLoyers();

  const [montant, setMontant] = useState('');
  const [dateReception, setDateReception] = useState('');
  const [dateValeur, setDateValeur] = useState('');
  const [mode, setMode] = useState<ModePaiement>('VIREMENT');
  const [payeurType, setPayeurType] = useState<PayeurType>('Locataire');
  const [payeurCustom, setPayeurCustom] = useState('');
  const [reference, setReference] = useState('');
  const [commentaire, setCommentaire] = useState('');
  const [lignes, setLignes] = useState<VentilLine[]>([]);

  useEffect(() => {
    if (!open || !paiement) return;
    setMontant(String(paiement.montant));
    setDateReception(paiement.dateReception);
    setDateValeur(paiement.dateValeurBancaire ?? '');
    setMode(paiement.mode);

    const isPredef = (PAYEURS_PREDEFINIS as readonly string[]).includes(paiement.payeur);
    if (isPredef) {
      setPayeurType(paiement.payeur as PayeurType);
      setPayeurCustom('');
    } else {
      setPayeurType('Autre');
      setPayeurCustom(paiement.payeur);
    }

    setReference(paiement.reference ?? '');
    setCommentaire(paiement.commentaire ?? '');
    setLignes(
      paiement.ventilations.map((v) => ({
        loyerId: v.loyerId,
        montant: String(v.montant),
      })),
    );
  }, [open, paiement]);

  /** Loyers proposés : ceux déjà ventilés sur ce paiement (même PAYE) + tous les loyers ouverts. */
  const loyersDisponibles = useMemo(() => {
    const all = loyersQuery.data ?? [];
    const ouverts = all.filter(
      (l) =>
        l.statut === 'EN_ATTENTE' ||
        l.statut === 'PARTIEL' ||
        l.statut === 'RETARD' ||
        l.statut === 'IMPAYE',
    );
    const idsActuels = new Set(paiement?.ventilations.map((v) => v.loyerId) ?? []);
    const actuels = all.filter((l) => idsActuels.has(l.id));
    const combined = new Map(ouverts.map((l) => [l.id, l]));
    for (const l of actuels) combined.set(l.id, l);
    return Array.from(combined.values()).sort((a, b) => {
      // Tri : par année DESC, puis mois DESC
      if (a.annee !== b.annee) return b.annee - a.annee;
      return b.mois - a.mois;
    });
  }, [loyersQuery.data, paiement]);

  const sommeVentilations = useMemo(
    () => lignes.reduce((s, l) => s + (Number(l.montant) || 0), 0),
    [lignes],
  );
  const ecart = (Number(montant) || 0) - sommeVentilations;

  const addLigne = () => setLignes((arr) => [...arr, { loyerId: '', montant: '' }]);
  const removeLigne = (i: number) => setLignes((arr) => arr.filter((_, idx) => idx !== i));
  const updateLigne = (i: number, patch: Partial<VentilLine>) =>
    setLignes((arr) => arr.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const handleSubmit = async () => {
    if (!paiement) return;
    const montantNum = Number(montant);
    if (!montantNum || montantNum <= 0) {
      toast.error('Montant > 0 requis');
      return;
    }
    if (!dateReception) {
      toast.error('Date de réception requise');
      return;
    }
    if (payeurType === 'Autre' && payeurCustom.trim() === '') {
      toast.error('Précisez le payeur (champ "Autre")');
      return;
    }
    if (lignes.length === 0) {
      toast.error('Au moins une ventilation');
      return;
    }
    for (const l of lignes) {
      if (!l.loyerId) {
        toast.error('Chaque ligne doit cibler un loyer');
        return;
      }
      const m = Number(l.montant);
      if (!m || m <= 0) {
        toast.error('Chaque ligne doit avoir un montant > 0');
        return;
      }
    }
    const ids = lignes.map((l) => l.loyerId);
    if (new Set(ids).size !== ids.length) {
      toast.error('Un même loyer ne peut être ventilé deux fois');
      return;
    }
    if (Math.abs(ecart) > 0.01) {
      toast.error(
        `Somme des ventilations (${formatEuro(sommeVentilations)}) ≠ montant (${formatEuro(
          montantNum,
        )})`,
      );
      return;
    }

    try {
      const payeurFinal = payeurType === 'Autre' ? payeurCustom.trim() : payeurType;
      await update.mutateAsync({
        id: paiement.id,
        montant: montantNum,
        dateReception,
        dateValeurBancaire: dateValeur === '' ? undefined : dateValeur,
        mode,
        payeur: payeurFinal,
        reference: reference.trim() === '' ? undefined : reference.trim(),
        commentaire: commentaire.trim() === '' ? undefined : commentaire.trim(),
        ventilations: lignes.map((l) => ({ loyerId: l.loyerId, montant: Number(l.montant) })),
      });
      toast.success('Paiement modifié — statuts des loyers recalculés');
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la modification');
    }
  };

  const isSubmitting = update.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifier le paiement</DialogTitle>
          <DialogDescription>
            Les statuts des loyers impactés (anciens et nouveaux) seront recalculés
            automatiquement.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <section className="space-y-3 rounded-md border p-3">
            <h3 className="text-sm font-semibold">Détails du paiement</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="e-montant">Montant (€)</Label>
                <Input
                  id="e-montant"
                  type="number"
                  step="0.01"
                  min="0"
                  value={montant}
                  onChange={(e) => setMontant(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="e-mode">Mode</Label>
                <select
                  id="e-mode"
                  value={mode}
                  onChange={(e) => setMode(e.target.value as ModePaiement)}
                  disabled={isSubmitting}
                  className={SELECT_CLASS}
                >
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
                <Label htmlFor="e-date">Date de réception</Label>
                <Input
                  id="e-date"
                  type="date"
                  value={dateReception}
                  onChange={(e) => setDateReception(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="e-datev">Date de valeur (optionnel)</Label>
                <Input
                  id="e-datev"
                  type="date"
                  value={dateValeur}
                  onChange={(e) => setDateValeur(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="e-payeur">Payeur</Label>
                <select
                  id="e-payeur"
                  value={payeurType}
                  onChange={(e) => setPayeurType(e.target.value as PayeurType)}
                  disabled={isSubmitting}
                  className={SELECT_CLASS}
                >
                  {PAYEURS_PREDEFINIS.map((p) => (
                    <option key={p} value={p}>
                      {p === 'Autre' ? 'Autre…' : p}
                    </option>
                  ))}
                </select>
                {payeurType === 'Autre' && (
                  <Input
                    value={payeurCustom}
                    onChange={(e) => setPayeurCustom(e.target.value)}
                    disabled={isSubmitting}
                    placeholder="Préciser"
                    className="mt-1"
                  />
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="e-ref">Référence (optionnel)</Label>
                <Input
                  id="e-ref"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="e-comm">Commentaire</Label>
              <textarea
                id="e-comm"
                rows={2}
                value={commentaire}
                onChange={(e) => setCommentaire(e.target.value)}
                disabled={isSubmitting}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
          </section>

          <section className="space-y-2 rounded-md border bg-muted/30 p-3">
            <div className="flex items-baseline justify-between">
              <h3 className="text-sm font-semibold">Ventilations</h3>
              <div className="text-xs text-muted-foreground">
                Somme :{' '}
                <span className="font-medium text-foreground">
                  {formatEuro(sommeVentilations)}
                </span>
                {Math.abs(ecart) > 0.01 && (
                  <>
                    {' '}
                    — <span className="text-destructive">écart {formatEuro(ecart)}</span>
                  </>
                )}
              </div>
            </div>

            {lignes.map((l, i) => (
              <div key={i} className="grid grid-cols-[1fr_120px_auto] gap-2">
                <select
                  value={l.loyerId}
                  onChange={(e) => updateLigne(i, { loyerId: e.target.value })}
                  disabled={isSubmitting}
                  className={SELECT_CLASS}
                >
                  <option value="">— choisir un loyer —</option>
                  {loyersDisponibles.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {MOIS_COURT[opt.mois - 1]} {opt.annee} —{' '}
                      {opt.contrat?.bienAdresse ?? '?'} — total{' '}
                      {formatEuro(opt.montantTotal)}
                    </option>
                  ))}
                </select>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={l.montant}
                  onChange={(e) => updateLigne(i, { montant: e.target.value })}
                  disabled={isSubmitting}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeLigne(i)}
                  disabled={isSubmitting || lignes.length === 1}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addLigne}
              disabled={isSubmitting}
            >
              <Plus className="h-4 w-4" />
              Ajouter une ventilation
            </Button>
          </section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
