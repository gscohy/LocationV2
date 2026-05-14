import { useQuery } from '@tanstack/react-query';
import { Loader2, RefreshCw } from 'lucide-react';
import { useMemo } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { type Loyer } from '@/lib/db/loyers';
import { useRecalcLoyer, type ModePaiement } from '@/lib/db/paiements';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

const MOIS_LONG = [
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

const formatEuro = (v: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v);

const formatDateFR = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString('fr-FR');
  } catch {
    return iso;
  }
};

interface PaiementVentile {
  paiementId: string;
  montant: number;
  dateReception: string;
  mode: ModePaiement;
  payeur: string;
  reference: string | null;
  commentaire: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loyer: Loyer | undefined;
}

export function LoyerPaiementsDialog({ open, onOpenChange, loyer }: Props) {
  const query = useQuery({
    queryKey: ['paiement-ventilations', 'by-loyer', loyer?.id ?? ''],
    enabled: open && Boolean(loyer),
    queryFn: async (): Promise<PaiementVentile[]> => {
      if (!loyer) return [];
      const { data, error } = await supabase
        .from('paiement_ventilations')
        .select('montant, paiements(id, date_reception, mode, payeur, reference, commentaire)')
        .eq('loyer_id', loyer.id);
      if (error) throw error;
      type Row = {
        montant: number;
        paiements: {
          id: string;
          date_reception: string;
          mode: ModePaiement;
          payeur: string;
          reference: string | null;
          commentaire: string | null;
        } | null;
      };
      return ((data ?? []) as unknown as Row[])
        .filter((r): r is Row & { paiements: NonNullable<Row['paiements']> } => r.paiements !== null)
        .map((r) => ({
          paiementId: r.paiements.id,
          montant: Number(r.montant),
          dateReception: r.paiements.date_reception,
          mode: r.paiements.mode,
          payeur: r.paiements.payeur,
          reference: r.paiements.reference,
          commentaire: r.paiements.commentaire,
        }))
        .sort((a, b) => a.dateReception.localeCompare(b.dateReception));
    },
  });

  const titre = loyer
    ? `Paiements — ${MOIS_LONG[loyer.mois - 1]} ${loyer.annee}`
    : 'Paiements';

  /** Somme réelle des ventilations actuellement liées au loyer. */
  const sommeVentilations = useMemo(
    () => (query.data ?? []).reduce((s, p) => s + p.montant, 0),
    [query.data],
  );

  /**
   * Incohérence : le loyer.montantPaye (stocké) ne correspond plus à la somme
   * réelle des ventilations. Peut arriver si des paiements ont été supprimés/
   * modifiés en BDD sans recalcul du loyer.
   */
  const ecartAvecLoyer = loyer ? Math.abs(loyer.montantPaye - sommeVentilations) : 0;
  const incoherence = loyer && query.data ? ecartAvecLoyer > 0.005 : false;

  const recalc = useRecalcLoyer();
  const handleRecalc = async () => {
    if (!loyer) return;
    try {
      await recalc.mutateAsync(loyer.id);
      toast.success('Statut du loyer resynchronisé');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur de recalcul');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{titre}</DialogTitle>
          {loyer?.contrat && (
            <DialogDescription>
              {loyer.contrat.bienAdresse} ({loyer.contrat.bienVille}) —{' '}
              {loyer.contrat.locatairePrincipalLabel}
            </DialogDescription>
          )}
        </DialogHeader>

        {loyer && (
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-md border bg-muted/30 p-3 text-center">
              <div className="text-xs text-muted-foreground">Montant dû</div>
              <div className="text-lg font-semibold">{formatEuro(loyer.montantTotal)}</div>
            </div>
            <div className="rounded-md border bg-muted/30 p-3 text-center">
              <div className="text-xs text-muted-foreground">Reçu</div>
              <div className="text-lg font-semibold text-green-700">
                {formatEuro(loyer.montantPaye)}
              </div>
            </div>
            <div className="rounded-md border bg-muted/30 p-3 text-center">
              <div className="text-xs text-muted-foreground">Reste</div>
              <div
                className={cn(
                  'text-lg font-semibold',
                  loyer.soldeRestant > 0.005 ? 'text-red-700' : 'text-foreground',
                )}
              >
                {formatEuro(loyer.soldeRestant)}
              </div>
            </div>
          </div>
        )}

        {incoherence && (
          <div className="flex items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <div>
              <div className="font-medium">État incohérent détecté</div>
              <div className="text-xs">
                Le « Reçu » du loyer ({formatEuro(loyer!.montantPaye)}) ne correspond plus à la
                somme réelle des paiements ventilés ({formatEuro(sommeVentilations)}). Cela peut
                arriver après une suppression de paiement non finalisée.
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRecalc}
              disabled={recalc.isPending}
            >
              {recalc.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Recalculer
            </Button>
          </div>
        )}

        {query.isPending && (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}

        {query.error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            Erreur de chargement : {(query.error as Error).message}
          </div>
        )}

        {query.data && query.data.length === 0 && !query.isPending && (
          <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            Aucun encaissement enregistré sur ce loyer.
          </div>
        )}

        {query.data && query.data.length > 0 && (
          <div className="overflow-hidden rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Date</th>
                  <th className="px-3 py-2 text-left font-medium">Mode</th>
                  <th className="px-3 py-2 text-left font-medium">Payeur</th>
                  <th className="px-3 py-2 text-right font-medium">Montant</th>
                  <th className="px-3 py-2 text-left font-medium">Référence</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {query.data.map((p) => (
                  <tr key={p.paiementId}>
                    <td className="px-3 py-2">{formatDateFR(p.dateReception)}</td>
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                          MODE_COLOR[p.mode],
                        )}
                      >
                        {MODE_LABEL[p.mode]}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{p.payeur}</td>
                    <td className="px-3 py-2 text-right font-medium">{formatEuro(p.montant)}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {p.reference ?? '—'}
                      {p.commentaire && <div className="mt-0.5 italic">{p.commentaire}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
