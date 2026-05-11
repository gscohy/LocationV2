import type { StatutContrat, TypeContrat } from '@gl/shared';
import { createFileRoute } from '@tanstack/react-router';
import { FileX, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { ContratFormDialog } from '@/components/contrats/contrat-form-dialog';
import { ResiliationDialog } from '@/components/contrats/resiliation-dialog';
import { Button } from '@/components/ui/button';
import { useContrats, useDeleteContrat, type Contrat } from '@/lib/db/contrats';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/_authenticated/contrats')({
  component: ContratsPage,
});

const TYPE_LABEL: Record<TypeContrat, string> = {
  HABITATION_VIDE: 'Habitation vide',
  HABITATION_MEUBLE: 'Meublé',
  MOBILITE: 'Mobilité',
  ETUDIANT: 'Étudiant',
  COMMERCIAL: 'Commercial',
  PROFESSIONNEL: 'Professionnel',
  PARKING: 'Parking',
  GARAGE: 'Garage',
  SAISONNIER: 'Saisonnier',
};

const STATUT_LABEL: Record<StatutContrat, string> = {
  BROUILLON: 'Brouillon',
  ACTIF: 'Actif',
  EXPIRE: 'Expiré',
  RENOUVELE: 'Renouvelé',
  RESILIE: 'Résilié',
  ARCHIVE: 'Archivé',
};

const STATUT_COLOR: Record<StatutContrat, string> = {
  BROUILLON: 'bg-gray-100 text-gray-800',
  ACTIF: 'bg-green-100 text-green-800',
  EXPIRE: 'bg-amber-100 text-amber-800',
  RENOUVELE: 'bg-blue-100 text-blue-800',
  RESILIE: 'bg-red-100 text-red-800',
  ARCHIVE: 'bg-slate-100 text-slate-700',
};

const formatEuro = (value: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(
    value,
  );

const formatDate = (iso: string | undefined) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('fr-FR');
  } catch {
    return iso;
  }
};

function ContratsPage() {
  const { data, isPending, error } = useContrats();
  const deleteMutation = useDeleteContrat();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Contrat | undefined>();
  const [resiliationOpen, setResiliationOpen] = useState(false);
  const [resiliating, setResiliating] = useState<Contrat | undefined>();

  const openCreate = () => {
    setEditing(undefined);
    setDialogOpen(true);
  };

  const openEdit = (c: Contrat) => {
    setEditing(c);
    setDialogOpen(true);
  };

  const openResiliation = (c: Contrat) => {
    setResiliating(c);
    setResiliationOpen(true);
  };

  const handleDelete = async (c: Contrat) => {
    const label = c.reference || `${c.bien?.adresse ?? '?'} (${formatDate(c.dateDebut)})`;
    if (!window.confirm(`Supprimer le contrat « ${label} » ?\n\nCela supprimera aussi les loyers, paiements et quittances liés.`))
      return;
    try {
      await deleteMutation.mutateAsync(c.id);
      toast.success('Contrat supprimé');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la suppression');
    }
  };

  return (
    <div className="container py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Contrats de bail</h1>
          <p className="text-sm text-muted-foreground">
            Baux liant un bien à un ou plusieurs locataires (avec un principal).
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
          <p className="text-muted-foreground">Aucun contrat pour le moment.</p>
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
                <th className="px-4 py-3 text-left font-medium">Bien / Référence</th>
                <th className="px-4 py-3 text-left font-medium">Type</th>
                <th className="px-4 py-3 text-left font-medium">Locataires</th>
                <th className="px-4 py-3 text-left font-medium">Période</th>
                <th className="px-4 py-3 text-right font-medium">Loyer</th>
                <th className="px-4 py-3 text-left font-medium">Statut</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y text-sm">
              {data.map((c) => (
                <tr key={c.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    {c.reference && (
                      <div className="font-mono text-xs text-muted-foreground">{c.reference}</div>
                    )}
                    {c.bien ? (
                      <>
                        <div className="font-medium">{c.bien.adresse}</div>
                        <div className="text-xs text-muted-foreground">
                          {c.bien.codePostal} {c.bien.ville}
                        </div>
                      </>
                    ) : (
                      <span className="italic text-destructive">Bien inconnu</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{TYPE_LABEL[c.type]}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {c.locataires.length === 0 ? (
                      <span className="italic text-destructive">— aucun —</span>
                    ) : (
                      <ul className="space-y-0.5 text-xs">
                        {c.locataires.map((l) => (
                          <li key={l.locataireId}>
                            {l.estPrincipal && <span className="text-primary">★ </span>}
                            {l.label}
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    <div>du {formatDate(c.dateDebut)}</div>
                    <div>au {formatDate(c.dateFin)}</div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="font-medium">{formatEuro(c.loyer)}</div>
                    {c.chargesMensuelles > 0 && (
                      <div className="text-xs text-muted-foreground">
                        + {formatEuro(c.chargesMensuelles)} ch.
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                        STATUT_COLOR[c.statut],
                      )}
                    >
                      {STATUT_LABEL[c.statut]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      {(c.statut === 'ACTIF' || c.statut === 'BROUILLON') && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openResiliation(c)}
                          title="Résilier"
                        >
                          <FileX className="h-4 w-4 text-amber-600" />
                          <span className="sr-only">Résilier</span>
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                        <Pencil className="h-4 w-4" />
                        <span className="sr-only">Modifier</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(c)}
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

      <ContratFormDialog open={dialogOpen} onOpenChange={setDialogOpen} contrat={editing} />
      <ResiliationDialog
        open={resiliationOpen}
        onOpenChange={setResiliationOpen}
        contrat={resiliating}
      />
    </div>
  );
}
