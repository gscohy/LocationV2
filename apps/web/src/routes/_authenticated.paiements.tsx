import { createFileRoute } from '@tanstack/react-router';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { PaiementEditDialog } from '@/components/paiements/paiement-edit-dialog';
import { PaiementFormDialog } from '@/components/paiements/paiement-form-dialog';
import { Button } from '@/components/ui/button';
import {
  useDeletePaiement,
  usePaiements,
  type ModePaiement,
  type Paiement,
} from '@/lib/db/paiements';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/_authenticated/paiements')({
  component: PaiementsPage,
});

const MODE_LABEL: Record<ModePaiement, string> = {
  VIREMENT: 'Virement',
  PRELEVEMENT: 'Prélèvement',
  CHEQUE: 'Chèque',
  ESPECES: 'Espèces',
  CAF: 'CAF',
  PAYLIB: 'Paylib',
  AUTRE: 'Autre',
};

const MODE_COLOR: Record<ModePaiement, string> = {
  VIREMENT: 'bg-blue-100 text-blue-800',
  PRELEVEMENT: 'bg-indigo-100 text-indigo-800',
  CHEQUE: 'bg-purple-100 text-purple-800',
  ESPECES: 'bg-emerald-100 text-emerald-800',
  CAF: 'bg-amber-100 text-amber-800',
  PAYLIB: 'bg-pink-100 text-pink-800',
  AUTRE: 'bg-slate-100 text-slate-800',
};

const SELECT_CLASS =
  'h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

const formatEuro = (v: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v);

const formatDate = (iso: string | undefined) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('fr-FR');
  } catch {
    return iso;
  }
};

function PaiementsPage() {
  const [filterMode, setFilterMode] = useState<ModePaiement | ''>('');
  const [dateMin, setDateMin] = useState('');
  const [dateMax, setDateMax] = useState('');

  const filters = useMemo(
    () => ({
      mode: filterMode === '' ? undefined : filterMode,
      dateMin: dateMin === '' ? undefined : dateMin,
      dateMax: dateMax === '' ? undefined : dateMax,
    }),
    [filterMode, dateMin, dateMax],
  );

  const { data, isPending, error } = usePaiements(filters);
  const deleteMutation = useDeletePaiement();

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Paiement | undefined>();

  const openEdit = (p: Paiement) => {
    setEditing(p);
    setEditOpen(true);
  };

  const totals = useMemo(() => {
    const list = data ?? [];
    return {
      count: list.length,
      total: list.reduce((acc, p) => acc + p.montant, 0),
    };
  }, [data]);

  const handleDelete = async (p: Paiement) => {
    const ok = window.confirm(
      `Supprimer le paiement de ${formatEuro(p.montant)} reçu le ${formatDate(p.dateReception)} ?\n\nLes ventilations seront supprimées et les statuts des loyers concernés recalculés.`,
    );
    if (!ok) return;
    try {
      await deleteMutation.mutateAsync(p.id);
      toast.success('Paiement supprimé');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la suppression');
    }
  };

  return (
    <div className="container py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Paiements</h1>
          <p className="text-sm text-muted-foreground">
            Encaissements reçus, ventilés sur un ou plusieurs loyers.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Nouveau paiement
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border bg-muted/30 p-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="f-mode">
            Mode
          </label>
          <select
            id="f-mode"
            className={SELECT_CLASS}
            value={filterMode}
            onChange={(e) => setFilterMode(e.target.value as ModePaiement | '')}
          >
            <option value="">Tous</option>
            {(Object.keys(MODE_LABEL) as ModePaiement[]).map((m) => (
              <option key={m} value={m}>
                {MODE_LABEL[m]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="f-dmin">
            Du
          </label>
          <input
            id="f-dmin"
            type="date"
            className={SELECT_CLASS}
            value={dateMin}
            onChange={(e) => setDateMin(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="f-dmax">
            Au
          </label>
          <input
            id="f-dmax"
            type="date"
            className={SELECT_CLASS}
            value={dateMax}
            onChange={(e) => setDateMax(e.target.value)}
          />
        </div>
        <div className="ml-auto flex gap-4 text-sm">
          <span className="text-muted-foreground">
            <span className="font-medium text-foreground">{totals.count}</span> paiement
            {totals.count > 1 ? 's' : ''}
          </span>
          <span className="text-muted-foreground">
            Total encaissé :{' '}
            <span className="font-medium text-green-700">{formatEuro(totals.total)}</span>
          </span>
        </div>
      </div>

      {isPending && (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Erreur de chargement : {error.message}
        </div>
      )}

      {data && data.length === 0 && !isPending && (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground">
            Aucun paiement enregistré. Clique sur « Nouveau paiement » pour saisir un encaissement.
          </p>
        </div>
      )}

      {data && data.length > 0 && (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full">
            <thead className="bg-muted/50 text-sm">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Date</th>
                <th className="px-4 py-3 text-left font-medium">Mode</th>
                <th className="px-4 py-3 text-left font-medium">Payeur</th>
                <th className="px-4 py-3 text-right font-medium">Montant</th>
                <th className="px-4 py-3 text-left font-medium">Ventilations</th>
                <th className="px-4 py-3 text-left font-medium">Référence</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y text-sm">
              {data.map((p) => (
                <tr key={p.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="font-medium">{formatDate(p.dateReception)}</div>
                    {p.dateValeurBancaire && (
                      <div className="text-xs text-muted-foreground">
                        valeur {formatDate(p.dateValeurBancaire)}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                        MODE_COLOR[p.mode],
                      )}
                    >
                      {MODE_LABEL[p.mode]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{p.payeur}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatEuro(p.montant)}</td>
                  <td className="px-4 py-3">
                    <ul className="space-y-0.5 text-xs">
                      {p.ventilations.map((v) => (
                        <li key={v.id} className="text-muted-foreground">
                          <span className="font-medium text-foreground">
                            {formatEuro(v.montant)}
                          </span>{' '}
                          → {v.loyerLabel}
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {p.reference ?? '—'}
                    {p.commentaire && (
                      <div className="mt-0.5 italic">{p.commentaire}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                        <Pencil className="h-4 w-4" />
                        <span className="sr-only">Modifier</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(p)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                        <span className="sr-only">Supprimer</span>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <PaiementFormDialog open={createOpen} onOpenChange={setCreateOpen} />
      <PaiementEditDialog open={editOpen} onOpenChange={setEditOpen} paiement={editing} />
    </div>
  );
}
