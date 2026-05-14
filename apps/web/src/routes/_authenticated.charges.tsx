import type { CategorieCharge } from '@gl/shared';
import { createFileRoute } from '@tanstack/react-router';
import { ExternalLink, Loader2, Pencil, Plus, Receipt, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { ChargeFormDialog } from '@/components/charges/charge-form-dialog';
import { Button } from '@/components/ui/button';
import { useBiens } from '@/lib/db/biens';
import {
  getPreuveUrl,
  useCharges,
  useDeleteCharge,
  type Charge,
  type ChargesFilters,
} from '@/lib/db/charges';

export const Route = createFileRoute('/_authenticated/charges')({
  component: ChargesPage,
});

const CATEGORIES_LABEL: Record<CategorieCharge, string> = {
  TRAVAUX: 'Travaux',
  ENTRETIEN: 'Entretien',
  ASSURANCE_PNO: 'Assurance PNO',
  ASSURANCE_LOYERS_IMPAYES: 'Assurance loyers impayés',
  CREDIT_IMMOBILIER: 'Crédit immobilier',
  TAXE_FONCIERE: 'Taxe foncière',
  TAXE_HABITATION: 'Taxe d’habitation',
  CHARGES_COPROPRIETE: 'Charges copro',
  FRAIS_GESTION: 'Frais gestion',
  HONORAIRES_AGENCE: 'Honoraires agence',
  FRAIS_PROCEDURE: 'Frais procédure',
  EAU: 'Eau',
  ELECTRICITE: 'Électricité',
  GAZ: 'Gaz',
  INTERNET: 'Internet',
  EXCEPTIONNELLE: 'Exceptionnelle',
  AUTRE: 'Autre',
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

function ChargesPage() {
  const biensQuery = useBiens();
  const [filterBien, setFilterBien] = useState('');
  const [filterCategorie, setFilterCategorie] = useState<CategorieCharge | ''>('');
  const [dateMin, setDateMin] = useState('');
  const [dateMax, setDateMax] = useState('');

  const filters: ChargesFilters = useMemo(
    () => ({
      bienId: filterBien === '' ? undefined : filterBien,
      categorie: filterCategorie === '' ? undefined : filterCategorie,
      dateMin: dateMin === '' ? undefined : dateMin,
      dateMax: dateMax === '' ? undefined : dateMax,
    }),
    [filterBien, filterCategorie, dateMin, dateMax],
  );

  const { data, isPending, error } = useCharges(filters);
  const deleteMutation = useDeleteCharge();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Charge | undefined>();

  const openCreate = () => {
    setEditing(undefined);
    setDialogOpen(true);
  };
  const openEdit = (c: Charge) => {
    setEditing(c);
    setDialogOpen(true);
  };

  const totals = useMemo(() => {
    const list = data ?? [];
    return {
      count: list.length,
      total: list.reduce((s, c) => s + c.montantTtc, 0),
      deductible: list.filter((c) => c.deductible).reduce((s, c) => s + c.montantTtc, 0),
    };
  }, [data]);

  const handleDelete = async (c: Charge) => {
    if (!window.confirm(`Supprimer la charge « ${c.description} » du ${formatDate(c.date)} ?`))
      return;
    try {
      await deleteMutation.mutateAsync(c.id);
      toast.success('Charge supprimée');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    }
  };

  const handleOpenPreuve = async (storageKey: string) => {
    try {
      const url = await getPreuveUrl(storageKey);
      window.open(url, '_blank', 'noopener');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Impossible d’ouvrir');
    }
  };

  return (
    <div className="container py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Charges</h1>
          <p className="text-sm text-muted-foreground">
            Dépenses engagées par bien : travaux, crédit, assurances, taxes, fluides…
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nouvelle charge
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border bg-muted/30 p-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="f-bien">
            Bien
          </label>
          <select
            id="f-bien"
            className={SELECT_CLASS}
            value={filterBien}
            onChange={(e) => setFilterBien(e.target.value)}
          >
            <option value="">Tous</option>
            {(biensQuery.data ?? []).map((b) => (
              <option key={b.id} value={b.id}>
                {b.adresse}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="f-cat">
            Catégorie
          </label>
          <select
            id="f-cat"
            className={SELECT_CLASS}
            value={filterCategorie}
            onChange={(e) => setFilterCategorie(e.target.value as CategorieCharge | '')}
          >
            <option value="">Toutes</option>
            {(Object.keys(CATEGORIES_LABEL) as CategorieCharge[]).map((c) => (
              <option key={c} value={c}>
                {CATEGORIES_LABEL[c]}
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
            <span className="font-medium text-foreground">{totals.count}</span> charges
          </span>
          <span className="text-muted-foreground">
            Total :{' '}
            <span className="font-medium text-foreground">{formatEuro(totals.total)}</span>
          </span>
          <span className="text-muted-foreground">
            Déductible : <span className="font-medium">{formatEuro(totals.deductible)}</span>
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
          <Receipt className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 text-muted-foreground">Aucune charge enregistrée pour ces filtres.</p>
        </div>
      )}

      {data && data.length > 0 && (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Date</th>
                <th className="px-4 py-3 text-left font-medium">Bien</th>
                <th className="px-4 py-3 text-left font-medium">Catégorie</th>
                <th className="px-4 py-3 text-left font-medium">Description / Fournisseur</th>
                <th className="px-4 py-3 text-right font-medium">Montant TTC</th>
                <th className="px-4 py-3 text-center font-medium">Preuve</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.map((c) => (
                <tr key={c.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">{formatDate(c.date)}</td>
                  <td className="px-4 py-3">
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
                  <td className="px-4 py-3 text-xs">
                    <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-800">
                      {CATEGORIES_LABEL[c.categorie]}
                    </span>
                    {c.type === 'RECURRENTE' && (
                      <div className="mt-0.5 text-[10px] text-muted-foreground">
                        Récurrente {c.frequence ? c.frequence.toLowerCase() : ''}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <div className="font-medium">{c.description}</div>
                    {c.fournisseur && (
                      <div className="text-muted-foreground">{c.fournisseur}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="font-medium">{formatEuro(c.montantTtc)}</div>
                    {c.montantHt !== undefined && (
                      <div className="text-[10px] text-muted-foreground">
                        HT {formatEuro(c.montantHt)}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {c.preuveStorageKey ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenPreuve(c.preuveStorageKey!)}
                        title="Ouvrir la preuve"
                      >
                        <ExternalLink className="h-4 w-4 text-blue-700" />
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(c)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ChargeFormDialog open={dialogOpen} onOpenChange={setDialogOpen} charge={editing} />
    </div>
  );
}
