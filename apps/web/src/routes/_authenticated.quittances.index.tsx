import { createFileRoute, useRouter } from '@tanstack/react-router';
import { Eye, FileText, Loader2, Send, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { EnvoyerQuittanceDialog } from '@/components/quittances/envoyer-quittance-dialog';
import { Button } from '@/components/ui/button';
import {
  useDeleteQuittance,
  useQuittances,
  type Quittance,
  type StatutQuittance,
} from '@/lib/db/quittances';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/_authenticated/quittances/')({
  component: QuittancesPage,
});

const STATUT_LABEL: Record<StatutQuittance, string> = {
  GENEREE: 'Générée',
  ENVOYEE: 'Envoyée',
  ANNULEE: 'Annulée',
};

const STATUT_COLOR: Record<StatutQuittance, string> = {
  GENEREE: 'bg-blue-100 text-blue-800',
  ENVOYEE: 'bg-green-100 text-green-800',
  ANNULEE: 'bg-gray-100 text-gray-500 line-through',
};

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

function QuittancesPage() {
  const { data, isPending, error } = useQuittances();
  const deleteMutation = useDeleteQuittance();
  const router = useRouter();
  const [envoiOpen, setEnvoiOpen] = useState(false);
  const [envoiTarget, setEnvoiTarget] = useState<Quittance | undefined>();

  const openQuittance = (q: Quittance) => {
    const url = router.buildLocation({ to: '/quittances/$id', params: { id: q.id } }).href;
    window.open(url, '_blank', 'noopener');
  };

  const openEnvoi = (q: Quittance) => {
    setEnvoiTarget(q);
    setEnvoiOpen(true);
  };

  const handleDelete = async (q: Quittance) => {
    const label = `${q.periode} — ${q.loyer?.bienAdresse ?? '?'}`;
    if (!window.confirm(`Supprimer la quittance « ${label} » ?`)) return;
    try {
      await deleteMutation.mutateAsync(q.id);
      toast.success('Quittance supprimée');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la suppression');
    }
  };

  return (
    <div className="container py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Quittances</h1>
          <p className="text-sm text-muted-foreground">
            Quittances de loyer émises. Génération depuis un loyer payé (page Loyers).
          </p>
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
          <FileText className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 text-muted-foreground">
            Aucune quittance émise. Va sur la page <strong>Loyers</strong>, sur un loyer{' '}
            <em>Payé</em>, clique l&apos;icône violette pour émettre une quittance.
          </p>
        </div>
      )}

      <EnvoyerQuittanceDialog
        open={envoiOpen}
        onOpenChange={setEnvoiOpen}
        quittance={envoiTarget}
      />

      {data && data.length > 0 && (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full">
            <thead className="bg-muted/50 text-sm">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Période</th>
                <th className="px-4 py-3 text-left font-medium">Bien / Locataire</th>
                <th className="px-4 py-3 text-left font-medium">Générée le</th>
                <th className="px-4 py-3 text-right font-medium">Montant</th>
                <th className="px-4 py-3 text-left font-medium">Statut</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y text-sm">
              {data.map((q) => (
                <tr key={q.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{q.periode}</td>
                  <td className="px-4 py-3">
                    {q.loyer ? (
                      <>
                        <div className="font-medium">{q.loyer.bienAdresse}</div>
                        <div className="text-xs text-muted-foreground">
                          {q.loyer.bienCodePostal} {q.loyer.bienVille}
                          {q.loyer.locatairePrincipal &&
                            ` — ${q.loyer.locatairePrincipal.prenom} ${q.loyer.locatairePrincipal.nom}`}
                        </div>
                      </>
                    ) : (
                      <span className="italic text-destructive">Loyer introuvable</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDate(q.dateGeneration)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="font-medium">{formatEuro(q.montantTotal)}</div>
                    {q.montantCharges > 0 && (
                      <div className="text-xs text-muted-foreground">
                        dont {formatEuro(q.montantCharges)} ch.
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                        STATUT_COLOR[q.statut],
                      )}
                    >
                      {STATUT_LABEL[q.statut]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openQuittance(q)}
                        title="Voir / imprimer la quittance"
                      >
                        <Eye className="h-4 w-4 text-blue-700" />
                        <span className="sr-only">Voir</span>
                      </Button>
                      {q.statut !== 'ANNULEE' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEnvoi(q)}
                          title="Envoyer la quittance"
                        >
                          <Send className="h-4 w-4 text-indigo-700" />
                          <span className="sr-only">Envoyer</span>
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(q)}
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
    </div>
  );
}
