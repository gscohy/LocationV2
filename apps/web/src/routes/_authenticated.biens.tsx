import type { StatutBien, TypeBien } from '@gl/shared';
import { createFileRoute } from '@tanstack/react-router';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { BienFormDialog } from '@/components/biens/bien-form-dialog';
import { Button } from '@/components/ui/button';
import { useBiens, useDeleteBien, type Bien } from '@/lib/db/biens';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/_authenticated/biens')({
  component: BiensPage,
});

const TYPE_LABEL: Record<TypeBien, string> = {
  APPARTEMENT: 'Appartement',
  MAISON: 'Maison',
  STUDIO: 'Studio',
  LOCAL: 'Local',
  GARAGE: 'Garage',
  PARKING: 'Parking',
  CAVE: 'Cave',
  TERRAIN: 'Terrain',
};

const STATUT_LABEL: Record<StatutBien, string> = {
  VACANT: 'Vacant',
  LOUE: 'Loué',
  TRAVAUX: 'Travaux',
  INDISPONIBLE: 'Indisponible',
  VENDU: 'Vendu',
};

const STATUT_COLOR: Record<StatutBien, string> = {
  VACANT: 'bg-amber-100 text-amber-800',
  LOUE: 'bg-green-100 text-green-800',
  TRAVAUX: 'bg-blue-100 text-blue-800',
  INDISPONIBLE: 'bg-gray-100 text-gray-800',
  VENDU: 'bg-purple-100 text-purple-800',
};

const formatEuro = (value: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value);

function BiensPage() {
  const { data, isPending, error } = useBiens();
  const deleteMutation = useDeleteBien();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Bien | undefined>();

  const openCreate = () => {
    setEditing(undefined);
    setDialogOpen(true);
  };

  const openEdit = (bien: Bien) => {
    setEditing(bien);
    setDialogOpen(true);
  };

  const handleDelete = async (bien: Bien) => {
    const label = bien.reference || `${bien.adresse}, ${bien.ville}`;
    if (!window.confirm(`Supprimer le bien « ${label} » ?`)) return;
    try {
      await deleteMutation.mutateAsync(bien.id);
      toast.success('Bien supprimé');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la suppression');
    }
  };

  return (
    <div className="container py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Biens immobiliers</h1>
          <p className="text-sm text-muted-foreground">
            Logements et locaux. Chaque bien peut appartenir à un ou plusieurs propriétaires (indivision).
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nouveau
        </Button>
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

      {data && data.length === 0 && (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground">Aucun bien pour le moment.</p>
          <Button className="mt-4" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Créer le premier
          </Button>
        </div>
      )}

      {data && data.length > 0 && (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full">
            <thead className="bg-muted/50 text-sm">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Référence / Adresse</th>
                <th className="px-4 py-3 text-left font-medium">Type</th>
                <th className="px-4 py-3 text-right font-medium">Surface</th>
                <th className="px-4 py-3 text-right font-medium">Loyer</th>
                <th className="px-4 py-3 text-left font-medium">Propriétaires</th>
                <th className="px-4 py-3 text-left font-medium">Statut</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y text-sm">
              {data.map((b) => (
                <tr key={b.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    {b.reference && (
                      <div className="font-mono text-xs text-muted-foreground">{b.reference}</div>
                    )}
                    <div className="font-medium">{b.adresse}</div>
                    <div className="text-xs text-muted-foreground">
                      {b.codePostal} {b.ville}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{TYPE_LABEL[b.type]}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    {b.surfaceHabitable} m²
                    <div className="text-xs">
                      {b.nbPieces} p. / {b.nbChambres} ch.
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="font-medium">{formatEuro(b.loyer)}</div>
                    {b.chargesMensuelles > 0 && (
                      <div className="text-xs text-muted-foreground">
                        + {formatEuro(b.chargesMensuelles)} ch.
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {b.proprietaires.length === 0 ? (
                      <span className="text-destructive">— aucun —</span>
                    ) : (
                      <ul className="space-y-0.5">
                        {b.proprietaires.map((p) => (
                          <li key={p.proprietaireId} className="text-xs">
                            {p.label}{' '}
                            <span className="text-muted-foreground">({p.quotePart}%)</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                        STATUT_COLOR[b.statut],
                      )}
                    >
                      {STATUT_LABEL[b.statut]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(b)}>
                        <Pencil className="h-4 w-4" />
                        <span className="sr-only">Modifier</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(b)}
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

      <BienFormDialog open={dialogOpen} onOpenChange={setDialogOpen} bien={editing} />
    </div>
  );
}
