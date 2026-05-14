import { createFileRoute } from '@tanstack/react-router';
import { CheckCircle, Clock, Eye, Loader2, MailWarning, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import {
  TYPE_RAPPEL_COLOR,
  TYPE_RAPPEL_LABEL,
} from '@/components/rappels/rappel-templates';
import { RappelViewDialog } from '@/components/rappels/rappel-view-dialog';
import { Button } from '@/components/ui/button';
import {
  useDeleteRappel,
  useMarkRappelEnvoye,
  useRappels,
  type Rappel,
  type TypeRappel,
} from '@/lib/db/rappels';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/_authenticated/rappels')({
  component: RappelsPage,
});

const SELECT_CLASS =
  'h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

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

const formatDate = (iso: string | undefined) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('fr-FR');
  } catch {
    return iso;
  }
};

function RappelsPage() {
  const [filterType, setFilterType] = useState<TypeRappel | ''>('');
  const [filterEnvoye, setFilterEnvoye] = useState<'' | 'oui' | 'non'>('');

  const filters = useMemo(
    () => ({
      type: filterType === '' ? undefined : filterType,
      envoye: filterEnvoye === '' ? undefined : filterEnvoye === 'oui',
    }),
    [filterType, filterEnvoye],
  );

  const { data, isPending, error } = useRappels(filters);
  const markMutation = useMarkRappelEnvoye();
  const deleteMutation = useDeleteRappel();

  const [viewOpen, setViewOpen] = useState(false);
  const [viewing, setViewing] = useState<Rappel | undefined>();

  const openView = (r: Rappel) => {
    setViewing(r);
    setViewOpen(true);
  };

  const handleMark = async (r: Rappel) => {
    if (!window.confirm('Marquer ce rappel comme envoyé maintenant ?')) return;
    try {
      await markMutation.mutateAsync(r.id);
      toast.success('Marqué comme envoyé');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    }
  };

  const handleDelete = async (r: Rappel) => {
    if (!window.confirm(`Supprimer le rappel « ${r.sujet} » ?`)) return;
    try {
      await deleteMutation.mutateAsync(r.id);
      toast.success('Rappel supprimé');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    }
  };

  return (
    <div className="container py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Rappels</h1>
        <p className="text-sm text-muted-foreground">
          Historique des rappels et mises en demeure envoyés. Création depuis la page Loyers
          (bouton « Relancer » sur les loyers en retard).
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border bg-muted/30 p-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="f-type">
            Type
          </label>
          <select
            id="f-type"
            className={SELECT_CLASS}
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as TypeRappel | '')}
          >
            <option value="">Tous</option>
            {(Object.keys(TYPE_RAPPEL_LABEL) as TypeRappel[]).map((t) => (
              <option key={t} value={t}>
                {TYPE_RAPPEL_LABEL[t]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="f-envoye">
            Statut envoi
          </label>
          <select
            id="f-envoye"
            className={SELECT_CLASS}
            value={filterEnvoye}
            onChange={(e) => setFilterEnvoye(e.target.value as '' | 'oui' | 'non')}
          >
            <option value="">Tous</option>
            <option value="non">Brouillon (non envoyé)</option>
            <option value="oui">Envoyé</option>
          </select>
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
          <MailWarning className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 text-muted-foreground">
            Aucun rappel pour ces filtres. Va sur la page <strong>Loyers</strong>, sur un loyer
            en retard, clique l&apos;icône <strong>Relancer</strong> pour créer un rappel.
          </p>
        </div>
      )}

      {data && data.length > 0 && (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full">
            <thead className="bg-muted/50 text-sm">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Type</th>
                <th className="px-4 py-3 text-left font-medium">Loyer / Bien</th>
                <th className="px-4 py-3 text-left font-medium">Sujet</th>
                <th className="px-4 py-3 text-left font-medium">Créé le</th>
                <th className="px-4 py-3 text-left font-medium">Statut</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y text-sm">
              {data.map((r) => (
                <tr key={r.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                        TYPE_RAPPEL_COLOR[r.type],
                      )}
                    >
                      {TYPE_RAPPEL_LABEL[r.type]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {r.loyer ? (
                      <>
                        <div className="font-medium">
                          {MOIS_COURT[r.loyer.mois - 1]} {r.loyer.annee} — solde{' '}
                          {formatEuro(r.loyer.soldeRestant)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {r.loyer.bienAdresse} — {r.loyer.locatairePrincipalLabel}
                        </div>
                      </>
                    ) : (
                      <span className="italic text-destructive">Loyer introuvable</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <div className="font-medium">{r.sujet}</div>
                    <div className="text-muted-foreground line-clamp-1">
                      {r.destinataires}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {formatDate(r.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {r.envoye ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 font-medium text-green-800">
                        <CheckCircle className="h-3 w-3" />
                        Envoyé {r.dateEnvoi && `le ${formatDate(r.dateEnvoi)}`}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                        <Clock className="h-3 w-3" />
                        Brouillon
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openView(r)}
                        title="Voir le détail du rappel"
                      >
                        <Eye className="h-4 w-4 text-blue-700" />
                        <span className="sr-only">Voir</span>
                      </Button>
                      {!r.envoye && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleMark(r)}
                          disabled={markMutation.isPending}
                          title="Marquer envoyé"
                        >
                          <CheckCircle className="h-4 w-4 text-green-700" />
                          <span className="sr-only">Marquer envoyé</span>
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(r)}
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
      <RappelViewDialog open={viewOpen} onOpenChange={setViewOpen} rappel={viewing} />
    </div>
  );
}
