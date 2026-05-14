import { Loader2 } from 'lucide-react';
import { useState } from 'react';
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
import { Label } from '@/components/ui/label';
import { useGenerateLoyers } from '@/lib/db/loyers';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MOIS_LABELS = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
];

const SELECT_CLASS =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

export function GenerateLoyersDialog({ open, onOpenChange }: Props) {
  const now = new Date();
  const [mois, setMois] = useState(now.getMonth() + 1);
  const [annee, setAnnee] = useState(now.getFullYear());
  const [force, setForce] = useState(false);

  const generate = useGenerateLoyers();

  const annees: number[] = [];
  for (let y = now.getFullYear() - 2; y <= now.getFullYear() + 1; y++) annees.push(y);

  const handleSubmit = async () => {
    try {
      const res = await generate.mutateAsync({ mois, annee, force, contratId: undefined });
      const parts: string[] = [];
      if (res.created > 0) parts.push(`${res.created} créé${res.created > 1 ? 's' : ''}`);
      if (res.updated > 0) parts.push(`${res.updated} mis à jour`);
      if (res.skipped > 0) parts.push(`${res.skipped} ignoré${res.skipped > 1 ? 's' : ''}`);
      const summary = parts.length > 0 ? parts.join(', ') : 'aucun contrat actif';
      toast.success(`Génération ${MOIS_LABELS[mois - 1]} ${annee} : ${summary}`);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur de génération');
    }
  };

  const isSubmitting = generate.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Générer les loyers du mois</DialogTitle>
          <DialogDescription>
            Crée une ligne par contrat actif dont la période couvre le mois choisi. Les loyers déjà
            existants sont ignorés (sauf si « regénérer » est coché).
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="gen-mois">Mois</Label>
              <select
                id="gen-mois"
                value={mois}
                onChange={(e) => setMois(Number(e.target.value))}
                disabled={isSubmitting}
                className={SELECT_CLASS}
              >
                {MOIS_LABELS.map((label, i) => (
                  <option key={i + 1} value={i + 1}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gen-annee">Année</Label>
              <select
                id="gen-annee"
                value={annee}
                onChange={(e) => setAnnee(Number(e.target.value))}
                disabled={isSubmitting}
                className={SELECT_CLASS}
              >
                {annees.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={force}
              onChange={(e) => setForce(e.target.checked)}
              disabled={isSubmitting}
              className="mt-0.5"
            />
            <span>
              <span className="font-medium">Regénérer si déjà créé.</span>{' '}
              <span className="text-muted-foreground">
                Met à jour le montant et l&apos;échéance d&apos;après le contrat. Ne touche pas aux
                paiements déjà ventilés.
              </span>
            </span>
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Générer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
