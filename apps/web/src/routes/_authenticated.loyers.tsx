import { createFileRoute, useRouter } from '@tanstack/react-router';
import { Banknote, Calendar, Eye, FileCheck, Loader2, Pencil, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { GenerateLoyersDialog } from '@/components/loyers/generate-loyers-dialog';
import { LoyerEditDialog } from '@/components/loyers/loyer-edit-dialog';
import { LoyerPaiementsDialog } from '@/components/loyers/loyer-paiements-dialog';
import { PaiementFormDialog } from '@/components/paiements/paiement-form-dialog';
import { Button } from '@/components/ui/button';
import {
  useDeleteLoyer,
  useLoyers,
  type Loyer,
  type LoyersFilters,
  type StatutLoyer,
} from '@/lib/db/loyers';
import { useCreateQuittance } from '@/lib/db/quittances';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/_authenticated/loyers')({
  component: LoyersPage,
});

const STATUT_LABEL: Record<StatutLoyer, string> = {
  EN_ATTENTE: 'En attente',
  PARTIEL: 'Partiel',
  PAYE: 'Payé',
  RETARD: 'Retard',
  IMPAYE: 'Impayé',
  ANNULE: 'Annulé',
};

const STATUT_COLOR: Record<StatutLoyer, string> = {
  EN_ATTENTE: 'bg-slate-100 text-slate-800',
  PARTIEL: 'bg-amber-100 text-amber-800',
  PAYE: 'bg-green-100 text-green-800',
  RETARD: 'bg-orange-100 text-orange-800',
  IMPAYE: 'bg-red-100 text-red-800',
  ANNULE: 'bg-gray-100 text-gray-500 line-through',
};

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

const formatEuro = (value: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value);

const formatDate = (iso: string | undefined) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('fr-FR');
  } catch {
    return iso;
  }
};

const SELECT_CLASS =
  'h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

function LoyersPage() {
  const router = useRouter();
  const createQuittance = useCreateQuittance();
  const now = new Date();
  const [filterStatut, setFilterStatut] = useState<StatutLoyer | ''>('');
  const [filterAnnee, setFilterAnnee] = useState<number | ''>(now.getFullYear());
  const [filterMois, setFilterMois] = useState<number | ''>('');

  const filters: LoyersFilters = useMemo(
    () => ({
      statut: filterStatut === '' ? undefined : filterStatut,
      annee: filterAnnee === '' ? undefined : filterAnnee,
      mois: filterMois === '' ? undefined : filterMois,
    }),
    [filterStatut, filterAnnee, filterMois],
  );

  const { data, isPending, error } = useLoyers(filters);
  const deleteMutation = useDeleteLoyer();

  const [generateOpen, setGenerateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Loyer | undefined>();
  const [paiementOpen, setPaiementOpen] = useState(false);
  const [paiementPrefill, setPaiementPrefill] = useState<Loyer | undefined>();
  const [viewPaiementsOpen, setViewPaiementsOpen] = useState(false);
  const [viewing, setViewing] = useState<Loyer | undefined>();

  const totals = useMemo(() => {
    const list = data ?? [];
    return {
      count: list.length,
      total: list.reduce((acc, l) => acc + l.montantTotal, 0),
      paye: list.reduce((acc, l) => acc + l.montantPaye, 0),
      reste: list.reduce((acc, l) => acc + l.soldeRestant, 0),
    };
  }, [data]);

  const annees: number[] = [];
  for (let y = now.getFullYear() - 3; y <= now.getFullYear() + 1; y++) annees.push(y);

  const openEdit = (l: Loyer) => {
    setEditing(l);
    setEditOpen(true);
  };

  const openPaiement = (l: Loyer) => {
    setPaiementPrefill(l);
    setPaiementOpen(true);
  };

  const openViewPaiements = (l: Loyer) => {
    setViewing(l);
    setViewPaiementsOpen(true);
  };

  const handleEmettreQuittance = async (l: Loyer) => {
    const label = `${MOIS_LABELS[l.mois - 1]} ${l.annee} — ${l.contrat?.bienAdresse ?? '?'}`;
    if (
      !window.confirm(
        `Émettre une quittance pour « ${label} » ?\n\nUne éventuelle quittance précédente sur ce loyer sera marquée Annulée.`,
      )
    )
      return;
    try {
      const id = await createQuittance.mutateAsync({ loyerId: l.id });
      toast.success('Quittance générée — ouverture dans un nouvel onglet');
      const url = router.buildLocation({ to: '/quittances/$id', params: { id } }).href;
      window.open(url, '_blank', 'noopener');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la génération');
    }
  };

  const handleDelete = async (l: Loyer) => {
    const label = `${MOIS_LABELS[l.mois - 1]} ${l.annee} — ${l.contrat?.bienAdresse ?? '?'}`;
    if (!window.confirm(`Supprimer le loyer « ${label} » ?\n\nLes paiements ventilés et la quittance associée seront aussi supprimés.`))
      return;
    try {
      await deleteMutation.mutateAsync(l.id);
      toast.success('Loyer supprimé');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la suppression');
    }
  };

  return (
    <div className="container py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Loyers</h1>
          <p className="text-sm text-muted-foreground">
            Échéances mensuelles générées à partir des contrats actifs.
          </p>
        </div>
        <Button onClick={() => setGenerateOpen(true)}>
          <Calendar className="h-4 w-4" />
          Générer le mois
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border bg-muted/30 p-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="f-statut">
            Statut
          </label>
          <select
            id="f-statut"
            className={SELECT_CLASS}
            value={filterStatut}
            onChange={(e) => setFilterStatut(e.target.value as StatutLoyer | '')}
          >
            <option value="">Tous</option>
            {(Object.keys(STATUT_LABEL) as StatutLoyer[]).map((s) => (
              <option key={s} value={s}>
                {STATUT_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="f-annee">
            Année
          </label>
          <select
            id="f-annee"
            className={SELECT_CLASS}
            value={filterAnnee}
            onChange={(e) => setFilterAnnee(e.target.value === '' ? '' : Number(e.target.value))}
          >
            <option value="">Toutes</option>
            {annees.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="f-mois">
            Mois
          </label>
          <select
            id="f-mois"
            className={SELECT_CLASS}
            value={filterMois}
            onChange={(e) => setFilterMois(e.target.value === '' ? '' : Number(e.target.value))}
          >
            <option value="">Tous</option>
            {MOIS_LABELS.map((label, i) => (
              <option key={i + 1} value={i + 1}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="ml-auto flex gap-4 text-sm">
          <span className="text-muted-foreground">
            <span className="font-medium text-foreground">{totals.count}</span> ligne
            {totals.count > 1 ? 's' : ''}
          </span>
          <span className="text-muted-foreground">
            Dû :{' '}
            <span className="font-medium text-foreground">{formatEuro(totals.total)}</span>
          </span>
          <span className="text-muted-foreground">
            Payé : <span className="font-medium text-green-700">{formatEuro(totals.paye)}</span>
          </span>
          <span className="text-muted-foreground">
            Reste :{' '}
            <span className={cn('font-medium', totals.reste > 0 ? 'text-red-700' : 'text-foreground')}>
              {formatEuro(totals.reste)}
            </span>
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
            Aucun loyer pour ces filtres. Clique sur « Générer le mois » pour créer les échéances
            des contrats actifs.
          </p>
        </div>
      )}

      {data && data.length > 0 && (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full">
            <thead className="bg-muted/50 text-sm">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Période</th>
                <th className="px-4 py-3 text-left font-medium">Bien / Locataire</th>
                <th className="px-4 py-3 text-left font-medium">Échéance</th>
                <th className="px-4 py-3 text-right font-medium">Loyer + charges</th>
                <th className="px-4 py-3 text-right font-medium">Payé / Reste</th>
                <th className="px-4 py-3 text-left font-medium">Statut</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y text-sm">
              {data.map((l) => (
                <tr key={l.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="font-medium">{MOIS_LABELS[l.mois - 1]}</div>
                    <div className="text-xs text-muted-foreground">{l.annee}</div>
                  </td>
                  <td className="px-4 py-3">
                    {l.contrat ? (
                      <>
                        <div className="font-medium">{l.contrat.bienAdresse}</div>
                        <div className="text-xs text-muted-foreground">
                          {l.contrat.bienVille} — {l.contrat.locatairePrincipalLabel}
                        </div>
                      </>
                    ) : (
                      <span className="italic text-destructive">Contrat introuvable</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(l.dateEcheance)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="font-medium">{formatEuro(l.montantTotal)}</div>
                    {l.montantCharges > 0 && (
                      <div className="text-xs text-muted-foreground">
                        dont {formatEuro(l.montantCharges)} ch.
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="text-green-700">{formatEuro(l.montantPaye)}</div>
                    {l.soldeRestant > 0 && (
                      <div className="text-xs text-red-700">
                        reste {formatEuro(l.soldeRestant)}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                        STATUT_COLOR[l.statut],
                      )}
                    >
                      {STATUT_LABEL[l.statut]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      {l.montantPaye > 0 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openViewPaiements(l)}
                          title="Voir les paiements reçus"
                        >
                          <Eye className="h-4 w-4 text-blue-700" />
                          <span className="sr-only">Voir paiements</span>
                        </Button>
                      )}
                      {l.statut !== 'PAYE' && l.statut !== 'ANNULE' && l.soldeRestant > 0 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openPaiement(l)}
                          title="Encaisser un paiement"
                        >
                          <Banknote className="h-4 w-4 text-green-700" />
                          <span className="sr-only">Encaisser</span>
                        </Button>
                      )}
                      {l.statut === 'PAYE' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEmettreQuittance(l)}
                          disabled={createQuittance.isPending}
                          title="Émettre une quittance"
                        >
                          <FileCheck className="h-4 w-4 text-purple-700" />
                          <span className="sr-only">Émettre quittance</span>
                        </Button>
                      )}
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

      <GenerateLoyersDialog open={generateOpen} onOpenChange={setGenerateOpen} />
      <LoyerEditDialog open={editOpen} onOpenChange={setEditOpen} loyer={editing} />
      <PaiementFormDialog
        open={paiementOpen}
        onOpenChange={setPaiementOpen}
        prefillLoyer={paiementPrefill}
      />
      <LoyerPaiementsDialog
        open={viewPaiementsOpen}
        onOpenChange={setViewPaiementsOpen}
        loyer={viewing}
      />
    </div>
  );
}
