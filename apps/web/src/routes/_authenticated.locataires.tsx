import { createFileRoute } from '@tanstack/react-router';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { LocataireFormDialog } from '@/components/locataires/locataire-form-dialog';
import { Button } from '@/components/ui/button';
import { useDeleteLocataire, useLocataires, type Locataire } from '@/lib/db/locataires';

export const Route = createFileRoute('/_authenticated/locataires')({
  component: LocatairesPage,
});

const formatDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString('fr-FR');
  } catch {
    return iso;
  }
};

function LocatairesPage() {
  const { data, isPending, error } = useLocataires();
  const deleteMutation = useDeleteLocataire();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Locataire | undefined>();

  const openCreate = () => {
    setEditing(undefined);
    setDialogOpen(true);
  };

  const openEdit = (l: Locataire) => {
    setEditing(l);
    setDialogOpen(true);
  };

  const handleDelete = async (l: Locataire) => {
    if (!window.confirm(`Supprimer le locataire « ${l.prenom} ${l.nom} » ?`)) return;
    try {
      await deleteMutation.mutateAsync(l.id);
      toast.success('Locataire supprimé');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la suppression');
    }
  };

  return (
    <div className="container py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Locataires</h1>
          <p className="text-sm text-muted-foreground">
            Personnes qui occupent ou ont occupé un bien.
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
          <p className="text-muted-foreground">Aucun locataire pour le moment.</p>
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
                <th className="px-4 py-3 text-left font-medium">Date de naissance</th>
                <th className="px-4 py-3 text-left font-medium">Email</th>
                <th className="px-4 py-3 text-left font-medium">Téléphone</th>
                <th className="px-4 py-3 text-left font-medium">Profession</th>
                <th className="px-4 py-3 text-left font-medium">Garants</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y text-sm">
              {data.map((l) => (
                <tr key={l.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="font-medium">
                      {l.prenom} {l.nom}
                    </div>
                    {l.nomNaissance && (
                      <div className="text-xs text-muted-foreground">née {l.nomNaissance}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDate(l.dateNaissance)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{l.email}</td>
                  <td className="px-4 py-3 text-muted-foreground">{l.telephoneMobile}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {l.profession ?? <span className="italic">—</span>}
                    {l.typeContratTravail && (
                      <div className="text-xs">{l.typeContratTravail}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {l.garants.length === 0 ? (
                      <span className="italic">—</span>
                    ) : (
                      <ul className="space-y-0.5 text-xs">
                        {l.garants.map((g) => (
                          <li key={g.garantId}>{g.label}</li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(l)}>
                        <Pencil className="h-4 w-4" />
                        <span className="sr-only">Modifier</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(l)}
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

      <LocataireFormDialog open={dialogOpen} onOpenChange={setDialogOpen} locataire={editing} />
    </div>
  );
}
