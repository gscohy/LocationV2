import { createFileRoute } from '@tanstack/react-router';
import { Building2, Loader2, Pencil, Plus, Trash2, User } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { ProprietaireFormDialog } from '@/components/proprietaires/proprietaire-form-dialog';
import { Button } from '@/components/ui/button';
import {
  useDeleteProprietaire,
  useProprietaires,
  type Proprietaire,
} from '@/lib/db/proprietaires';

export const Route = createFileRoute('/_authenticated/proprietaires')({
  component: ProprietairesPage,
});

function ProprietairesPage() {
  const { data, isPending, error } = useProprietaires();
  const deleteMutation = useDeleteProprietaire();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Proprietaire | undefined>();

  const openCreate = () => {
    setEditing(undefined);
    setDialogOpen(true);
  };

  const openEdit = (proprietaire: Proprietaire) => {
    setEditing(proprietaire);
    setDialogOpen(true);
  };

  const handleDelete = async (proprietaire: Proprietaire) => {
    const label =
      proprietaire.type === 'MORALE'
        ? proprietaire.entreprise || proprietaire.nom
        : `${proprietaire.prenom ?? ''} ${proprietaire.nom}`.trim();
    if (!window.confirm(`Supprimer le propriétaire « ${label} » ?`)) return;
    try {
      await deleteMutation.mutateAsync(proprietaire.id);
      toast.success('Propriétaire supprimé');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la suppression');
    }
  };

  return (
    <div className="container py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Propriétaires</h1>
          <p className="text-sm text-muted-foreground">
            Personnes physiques ou morales détenant un ou plusieurs biens.
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
          <p className="text-muted-foreground">Aucun propriétaire pour le moment.</p>
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
                <th className="px-4 py-3 text-left font-medium">Type</th>
                <th className="px-4 py-3 text-left font-medium">Nom / Raison sociale</th>
                <th className="px-4 py-3 text-left font-medium">Email</th>
                <th className="px-4 py-3 text-left font-medium">Ville</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y text-sm">
              {data.map((p) => {
                const display =
                  p.type === 'MORALE'
                    ? p.entreprise || p.nom
                    : `${p.prenom ?? ''} ${p.nom}`.trim();
                return (
                  <tr key={p.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      {p.type === 'MORALE' ? (
                        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                          <Building2 className="h-4 w-4" />
                          Morale
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                          <User className="h-4 w-4" />
                          Physique
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium">{display}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.email}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {p.codePostal} {p.ville}
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
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ProprietaireFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        proprietaire={editing}
      />
    </div>
  );
}
