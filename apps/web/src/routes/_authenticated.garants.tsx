import type { TypeGarantie } from '@gl/shared';
import { createFileRoute } from '@tanstack/react-router';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { GarantFormDialog } from '@/components/garants/garant-form-dialog';
import { Button } from '@/components/ui/button';
import { useDeleteGarant, useGarants, type Garant } from '@/lib/db/garants';

export const Route = createFileRoute('/_authenticated/garants')({
  component: GarantsPage,
});

const TYPE_LABEL: Record<TypeGarantie, string> = {
  PHYSIQUE: 'Personne physique',
  MORALE: 'Personne morale',
  VISALE: 'Visale',
  CAUTION_BANCAIRE: 'Caution bancaire',
  GARANTIE_LOCAPASS: 'Loca-Pass',
  AUTRE: 'Autre',
};

const formatEuro = (value: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(
    value,
  );

function GarantsPage() {
  const { data, isPending, error } = useGarants();
  const deleteMutation = useDeleteGarant();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Garant | undefined>();

  const openCreate = () => {
    setEditing(undefined);
    setDialogOpen(true);
  };

  const openEdit = (g: Garant) => {
    setEditing(g);
    setDialogOpen(true);
  };

  const handleDelete = async (g: Garant) => {
    if (!window.confirm(`Supprimer le garant « ${g.prenom} ${g.nom} » ?`)) return;
    try {
      await deleteMutation.mutateAsync(g.id);
      toast.success('Garant supprimé');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la suppression');
    }
  };

  return (
    <div className="container py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Garants</h1>
          <p className="text-sm text-muted-foreground">
            Personnes ou organismes qui se portent caution pour un locataire.
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
          <p className="text-muted-foreground">Aucun garant pour le moment.</p>
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
                <th className="px-4 py-3 text-left font-medium">Nom</th>
                <th className="px-4 py-3 text-left font-medium">Type</th>
                <th className="px-4 py-3 text-left font-medium">Email</th>
                <th className="px-4 py-3 text-left font-medium">Téléphone</th>
                <th className="px-4 py-3 text-right font-medium">Montant max</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y text-sm">
              {data.map((g) => (
                <tr key={g.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">
                    {g.prenom} {g.nom}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{TYPE_LABEL[g.typeGarantie]}</td>
                  <td className="px-4 py-3 text-muted-foreground">{g.email}</td>
                  <td className="px-4 py-3 text-muted-foreground">{g.telephone}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    {g.montantMaxGaranti !== undefined ? (
                      formatEuro(g.montantMaxGaranti)
                    ) : (
                      <span className="italic">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(g)}>
                        <Pencil className="h-4 w-4" />
                        <span className="sr-only">Modifier</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(g)}
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

      <GarantFormDialog open={dialogOpen} onOpenChange={setDialogOpen} garant={editing} />
    </div>
  );
}
