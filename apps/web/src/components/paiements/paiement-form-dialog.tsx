import { useQuery } from '@tanstack/react-query';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ensureLoyerForMonth, useLoyers, type Loyer } from '@/lib/db/loyers';
import { useCreatePaiement, type ModePaiement } from '@/lib/db/paiements';
import { supabase } from '@/lib/supabase';

const SELECT_CLASS =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

// CAF n'est pas un mode de paiement (c'est un payeur). Reste dispo en BDD pour les
// anciens enregistrements, mais n'apparaît plus dans la sélection.
const MODES: { value: ModePaiement; label: string }[] = [
  { value: 'VIREMENT', label: 'Virement' },
  { value: 'PRELEVEMENT', label: 'Prélèvement' },
  { value: 'CHEQUE', label: 'Chèque' },
  { value: 'ESPECES', label: 'Espèces' },
  { value: 'PAYLIB', label: 'Paylib' },
  { value: 'AUTRE', label: 'Autre' },
];

const MODE_LABEL: Record<ModePaiement, string> = MODES.reduce(
  (acc, m) => {
    acc[m.value] = m.label;
    return acc;
  },
  {} as Record<ModePaiement, string>,
);

// Liste des types de payeur. À terme, à remplacer par une table paramétrable
// (page Paramètres) — la BDD stocke déjà une chaîne libre, donc ce sera transparent.
const PAYEURS_PREDEFINIS = ['Locataire', 'CAF', 'Garant', 'Autre'] as const;
type PayeurType = (typeof PAYEURS_PREDEFINIS)[number];

const formatDateFR = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString('fr-FR');
  } catch {
    return iso;
  }
};

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

const formatEuro = (v: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v);

interface EncaissementLine {
  loyerId: string;
  montant: string;
  dateReception: string;
  mode: ModePaiement;
  payeurType: PayeurType;
  payeurCustom: string;
  reference: string;
}

function payeurFinal(l: EncaissementLine): string {
  return l.payeurType === 'Autre' ? l.payeurCustom.trim() : l.payeurType;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pré-remplissage : si fourni, la 1re ligne cible ce loyer pour son solde restant. */
  prefillLoyer?: Loyer;
}

function loyerOptionLabel(l: Loyer): string {
  const periode = `${MOIS_COURT[l.mois - 1]} ${l.annee}`;
  const bien = l.contrat?.bienAdresse ?? 'bien inconnu';
  const loc = l.contrat?.locatairePrincipalLabel ?? '';
  return `${periode} — ${bien}${loc ? ` (${loc})` : ''} — reste ${formatEuro(l.soldeRestant)}`;
}

function defaultLigne(today: string): EncaissementLine {
  return {
    loyerId: '',
    montant: '',
    dateReception: today,
    mode: 'VIREMENT',
    payeurType: 'Locataire',
    payeurCustom: '',
    reference: '',
  };
}

export function PaiementFormDialog({ open, onOpenChange, prefillLoyer }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const [lignes, setLignes] = useState<EncaissementLine[]>([defaultLigne(today)]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loyersQuery = useLoyers();
  const create = useCreatePaiement();

  /** Encaissements déjà reçus sur le loyer pré-rempli (lecture seule). */
  type PaiementExistant = {
    paiementId: string;
    montant: number;
    dateReception: string;
    mode: ModePaiement;
    payeur: string;
    reference: string | null;
  };
  const paiementsExistantsQuery = useQuery({
    queryKey: ['paiement-ventilations', 'by-loyer', prefillLoyer?.id ?? ''],
    enabled: open && Boolean(prefillLoyer),
    queryFn: async (): Promise<PaiementExistant[]> => {
      if (!prefillLoyer) return [];
      const { data, error } = await supabase
        .from('paiement_ventilations')
        .select('montant, paiements(id, date_reception, mode, payeur, reference)')
        .eq('loyer_id', prefillLoyer.id);
      if (error) throw error;
      type Row = {
        montant: number;
        paiements: {
          id: string;
          date_reception: string;
          mode: ModePaiement;
          payeur: string;
          reference: string | null;
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
        }))
        .sort((a, b) => a.dateReception.localeCompare(b.dateReception));
    },
  });

  const loyersOuverts = useMemo(
    () =>
      (loyersQuery.data ?? []).filter(
        (l) =>
          l.statut === 'EN_ATTENTE' ||
          l.statut === 'PARTIEL' ||
          l.statut === 'RETARD' ||
          l.statut === 'IMPAYE',
      ),
    [loyersQuery.data],
  );

  useEffect(() => {
    if (!open) return;
    if (prefillLoyer) {
      setLignes([
        {
          ...defaultLigne(today),
          loyerId: prefillLoyer.id,
          montant: String(prefillLoyer.soldeRestant),
        },
      ]);
    } else {
      setLignes([defaultLigne(today)]);
    }
  }, [open, prefillLoyer, today]);

  const totalRecu = useMemo(
    () => lignes.reduce((s, l) => s + (Number(l.montant) || 0), 0),
    [lignes],
  );

  /** Agrégation par loyer ciblé : cumul des montants ventilés sur chaque loyer. */
  type LoyerImpact = {
    loyer: Loyer;
    ajout: number;
    nouveauPaye: number;
    seraPaye: boolean;
    reste: number;
    surplus: number;
  };
  const impactsParLoyer = useMemo<LoyerImpact[]>(() => {
    const map = new Map<string, number>();
    for (const l of lignes) {
      if (!l.loyerId) continue;
      const v = Number(l.montant) || 0;
      map.set(l.loyerId, (map.get(l.loyerId) ?? 0) + v);
    }
    return Array.from(map.entries())
      .map(([loyerId, ajout]) => {
        const loyer = loyersOuverts.find((x) => x.id === loyerId);
        if (!loyer) return null;
        const nouveauPaye = loyer.montantPaye + ajout;
        return {
          loyer,
          ajout,
          nouveauPaye,
          seraPaye: nouveauPaye + 0.005 >= loyer.montantTotal,
          reste: Math.max(0, loyer.montantTotal - nouveauPaye),
          surplus: Math.max(0, nouveauPaye - loyer.montantTotal),
        } satisfies LoyerImpact;
      })
      .filter((x): x is LoyerImpact => x !== null);
  }, [lignes, loyersOuverts]);

  const surplusList = useMemo(
    () => impactsParLoyer.filter((i) => i.surplus > 0.005),
    [impactsParLoyer],
  );

  const addLigne = () => setLignes((arr) => [...arr, defaultLigne(today)]);
  const removeLigne = (i: number) => setLignes((arr) => arr.filter((_, idx) => idx !== i));
  const updateLigne = (i: number, patch: Partial<EncaissementLine>) =>
    setLignes((arr) => arr.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const onLoyerChange = (i: number, loyerId: string) => {
    const ligne = lignes[i];
    if (!ligne) return;
    const loyer = loyersOuverts.find((l) => l.id === loyerId);
    const currentMontant = Number(ligne.montant);
    const nextMontant =
      loyer && (!currentMontant || currentMontant === 0)
        ? String(loyer.soldeRestant)
        : ligne.montant;
    updateLigne(i, { loyerId, montant: nextMontant });
  };

  /**
   * Sur perte de focus du montant : si le cumul des encaissements pour ce loyer
   * laisse un reste à percevoir > 0, on ajoute automatiquement une nouvelle carte
   * ciblant le même loyer, pré-remplie avec le reste — pour que l'utilisateur
   * enchaîne avec un autre encaissement (ex : CAF après le locataire).
   */
  const onMontantBlur = (i: number) => {
    const ligne = lignes[i];
    if (!ligne || !ligne.loyerId) return;
    const loyer = loyersOuverts.find((l) => l.id === ligne.loyerId);
    if (!loyer) return;
    const montantSaisi = Number(ligne.montant) || 0;
    if (montantSaisi <= 0) return;

    const cumul = lignes.reduce(
      (s, x) => (x.loyerId === ligne.loyerId ? s + (Number(x.montant) || 0) : s),
      0,
    );
    const reste = loyer.montantTotal - (loyer.montantPaye + cumul);
    if (reste <= 0.005) return;

    const dejaUneAutreLigne = lignes
      .slice(i + 1)
      .some((x) => x.loyerId === ligne.loyerId || x.loyerId === '');
    if (dejaUneAutreLigne) return;

    setLignes((arr) => [
      ...arr,
      {
        ...defaultLigne(today),
        loyerId: loyer.id,
        // Pas de pré-remplissage du montant : on ne sait pas combien sera reçu
        // au prochain encaissement. L'utilisateur saisira la valeur réelle, ou
        // laissera vide (la ligne sera ignorée au submit).
      },
    ]);
  };

  /**
   * Solde un loyer en complétant la dernière ligne vide qui le cible, ou en
   * ajoutant une nouvelle ligne avec le montant manquant pile poil.
   */
  const solderLoyer = (loyerId: string, manque: number) => {
    if (manque <= 0.005) return;

    let idxLastVide = -1;
    for (let i = lignes.length - 1; i >= 0; i--) {
      const ligne = lignes[i];
      if (!ligne) continue;
      if (ligne.loyerId === loyerId && (Number(ligne.montant) || 0) <= 0) {
        idxLastVide = i;
        break;
      }
    }

    if (idxLastVide !== -1) {
      updateLigne(idxLastVide, { montant: manque.toFixed(2) });
      return;
    }
    setLignes((arr) => [
      ...arr,
      { ...defaultLigne(today), loyerId, montant: manque.toFixed(2) },
    ]);
  };

  function moisSuivant(loyer: Loyer): { mois: number; annee: number } {
    const mois = loyer.mois === 12 ? 1 : loyer.mois + 1;
    const annee = loyer.mois === 12 ? loyer.annee + 1 : loyer.annee;
    return { mois, annee };
  }

  /**
   * Si surplus, propose le report sur le mois suivant. Si OK, ré-écrit les lignes :
   * la dernière ligne de chaque loyer en surplus est réduite, une nouvelle ligne
   * (mêmes date/mode/payeur/référence) est ajoutée vers le loyer du mois suivant.
   * Retourne null en cas d'erreur, sinon le nouveau tableau de lignes à envoyer.
   */
  async function applyReportSurplus(): Promise<EncaissementLine[] | null> {
    if (surplusList.length === 0) return lignes;

    const messages = surplusList.map((s) => {
      const next = moisSuivant(s.loyer);
      return `• ${MOIS_LONG[s.loyer.mois - 1]} ${s.loyer.annee} : surplus de ${formatEuro(
        s.surplus,
      )} → reporter sur ${MOIS_LONG[next.mois - 1]} ${next.annee}`;
    });
    const ok = window.confirm(
      `Trop perçu détecté :\n\n${messages.join(
        '\n',
      )}\n\nReporter automatiquement l'excédent sur le mois suivant ?\n\n• OK = créer les loyers manquants et ventiler l'excédent sur le mois suivant (avec les mêmes date/mode/payeur).\n• Annuler = enregistrer tel quel. Le loyer sera marqué payé, le trop-perçu reste non reporté.`,
    );
    if (!ok) return lignes;

    const newLignes: EncaissementLine[] = [...lignes];

    for (const s of surplusList) {
      const contratId = s.loyer.contratId;
      if (!contratId) {
        toast.error(
          `Impossible de reporter : contrat introuvable pour ${MOIS_LONG[s.loyer.mois - 1]} ${s.loyer.annee}`,
        );
        return null;
      }
      // Trouver la dernière ligne pointant ce loyer pour y prélever le surplus.
      let idxLastForLoyer = -1;
      for (let i = newLignes.length - 1; i >= 0; i--) {
        if (newLignes[i]?.loyerId === s.loyer.id) {
          idxLastForLoyer = i;
          break;
        }
      }
      if (idxLastForLoyer === -1) continue;

      const next = moisSuivant(s.loyer);
      let nextLoyerId: string;
      try {
        const { id } = await ensureLoyerForMonth(contratId, next.mois, next.annee);
        nextLoyerId = id;
      } catch (e) {
        toast.error(
          e instanceof Error
            ? `Création loyer ${MOIS_LONG[next.mois - 1]} ${next.annee} : ${e.message}`
            : 'Erreur création loyer suivant',
        );
        return null;
      }

      const source = newLignes[idxLastForLoyer]!;
      const sourceMontant = Number(source.montant) || 0;
      const reducedMontant = Math.max(0, sourceMontant - s.surplus);
      newLignes[idxLastForLoyer] = { ...source, montant: String(reducedMontant) };
      newLignes.push({
        loyerId: nextLoyerId,
        montant: String(s.surplus),
        dateReception: source.dateReception,
        mode: source.mode,
        payeurType: source.payeurType,
        payeurCustom: source.payeurCustom,
        reference: source.reference,
      });
    }

    return newLignes;
  }

  const handleSubmit = async () => {
    // Les lignes laissées vides (montant 0 / vide) sont simplement ignorées : ce sont
    // des cartes auto-créées que l'utilisateur n'a pas remplies.
    const lignesActives = lignes.filter((l) => (Number(l.montant) || 0) > 0);
    if (lignesActives.length === 0) {
      toast.error('Saisis au moins un encaissement avec un montant > 0');
      return;
    }
    for (const l of lignesActives) {
      if (!l.loyerId) {
        toast.error('Chaque encaissement doit cibler un loyer');
        return;
      }
      if (!l.dateReception) {
        toast.error('Date de réception requise sur chaque encaissement');
        return;
      }
      if (l.payeurType === 'Autre' && l.payeurCustom.trim() === '') {
        toast.error('Précisez le payeur (champ "Autre")');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const lignesFinales = await applyReportSurplus();
      if (lignesFinales === null) {
        setIsSubmitting(false);
        return;
      }
      const lignesAEnvoyer = lignesFinales.filter((l) => (Number(l.montant) || 0) > 0);

      for (const l of lignesAEnvoyer) {
        await create.mutateAsync({
          montant: Number(l.montant),
          dateReception: l.dateReception,
          dateValeurBancaire: undefined,
          mode: l.mode,
          payeur: payeurFinal(l),
          reference: l.reference.trim() === '' ? undefined : l.reference.trim(),
          commentaire: undefined,
          ventilations: [{ loyerId: l.loyerId, montant: Number(l.montant) }],
        });
      }
      toast.success(
        `${lignesAEnvoyer.length} encaissement${lignesAEnvoyer.length > 1 ? 's' : ''} enregistré${
          lignesAEnvoyer.length > 1 ? 's' : ''
        }`,
      );
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de l’enregistrement');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Saisir des encaissements</DialogTitle>
          <DialogDescription>
            Une ligne = un encaissement réel (qui, combien, quand, par quel mode). Le total est
            calculé. Si un loyer est trop perçu, l&apos;excédent peut être reporté sur le mois
            suivant.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {prefillLoyer &&
            paiementsExistantsQuery.data &&
            paiementsExistantsQuery.data.length > 0 && (
              <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-xs">
                <div className="mb-1 font-medium text-blue-900">
                  Déjà reçu sur ce loyer ({formatEuro(prefillLoyer.montantPaye)} /{' '}
                  {formatEuro(prefillLoyer.montantTotal)}) — reste{' '}
                  {formatEuro(prefillLoyer.soldeRestant)}
                </div>
                <ul className="space-y-0.5 text-blue-900/90">
                  {paiementsExistantsQuery.data.map((p) => (
                    <li key={p.paiementId}>
                      <span className="font-medium">{formatEuro(p.montant)}</span> le{' '}
                      {formatDateFR(p.dateReception)} — {MODE_LABEL[p.mode]} ({p.payeur})
                      {p.reference ? ` — réf. ${p.reference}` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            )}

          {loyersOuverts.length === 0 && (
            <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
              Aucun loyer non payé. Génère d&apos;abord les loyers du mois.
            </p>
          )}

          {loyersOuverts.length > 0 && (
            <>
              <div className="space-y-3">
                {lignes.map((l, i) => (
                  <div key={i} className="space-y-2 rounded-md border bg-muted/30 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">
                        Encaissement #{i + 1}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeLigne(i)}
                        disabled={isSubmitting || lignes.length === 1}
                        title="Retirer cet encaissement"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor={`l-loyer-${i}`}>Loyer ciblé</Label>
                      <select
                        id={`l-loyer-${i}`}
                        value={l.loyerId}
                        onChange={(e) => onLoyerChange(i, e.target.value)}
                        disabled={isSubmitting}
                        className={SELECT_CLASS}
                      >
                        <option value="">— choisir un loyer —</option>
                        {loyersOuverts.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {loyerOptionLabel(opt)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                      <div className="space-y-1.5">
                        <Label htmlFor={`l-date-${i}`}>Date reçue</Label>
                        <Input
                          id={`l-date-${i}`}
                          type="date"
                          value={l.dateReception}
                          onChange={(e) => updateLigne(i, { dateReception: e.target.value })}
                          disabled={isSubmitting}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`l-mode-${i}`}>Mode</Label>
                        <select
                          id={`l-mode-${i}`}
                          value={l.mode}
                          onChange={(e) =>
                            updateLigne(i, { mode: e.target.value as ModePaiement })
                          }
                          disabled={isSubmitting}
                          className={SELECT_CLASS}
                        >
                          {MODES.map((m) => (
                            <option key={m.value} value={m.value}>
                              {m.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`l-payeur-${i}`}>Payeur</Label>
                        <select
                          id={`l-payeur-${i}`}
                          value={l.payeurType}
                          onChange={(e) =>
                            updateLigne(i, { payeurType: e.target.value as PayeurType })
                          }
                          disabled={isSubmitting}
                          className={SELECT_CLASS}
                        >
                          {PAYEURS_PREDEFINIS.map((p) => (
                            <option key={p} value={p}>
                              {p === 'Autre' ? 'Autre…' : p}
                            </option>
                          ))}
                        </select>
                        {l.payeurType === 'Autre' && (
                          <Input
                            value={l.payeurCustom}
                            onChange={(e) => updateLigne(i, { payeurCustom: e.target.value })}
                            disabled={isSubmitting}
                            placeholder="Préciser le payeur"
                            className="mt-1"
                          />
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`l-montant-${i}`}>Montant (€)</Label>
                        <Input
                          id={`l-montant-${i}`}
                          type="number"
                          step="0.01"
                          min="0"
                          value={l.montant}
                          onChange={(e) => updateLigne(i, { montant: e.target.value })}
                          onBlur={() => onMontantBlur(i)}
                          disabled={isSubmitting}
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor={`l-ref-${i}`}>Référence (optionnel)</Label>
                      <Input
                        id={`l-ref-${i}`}
                        value={l.reference}
                        onChange={(e) => updateLigne(i, { reference: e.target.value })}
                        disabled={isSubmitting}
                        placeholder="N° chèque, libellé virement…"
                      />
                    </div>
                  </div>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addLigne}
                  disabled={isSubmitting}
                >
                  <Plus className="h-4 w-4" />
                  Ajouter un encaissement
                </Button>
              </div>

              {impactsParLoyer.length === 1 ? (
                (() => {
                  const a = impactsParLoyer[0]!;
                  const ecart = a.nouveauPaye - a.loyer.montantTotal;
                  const ecartLabel =
                    Math.abs(ecart) < 0.005
                      ? 'soldé ✓'
                      : ecart > 0
                        ? `trop perçu +${formatEuro(ecart)}`
                        : `manque ${formatEuro(-ecart)}`;
                  const ecartColor =
                    Math.abs(ecart) < 0.005
                      ? 'text-green-700'
                      : ecart > 0
                        ? 'text-amber-700'
                        : 'text-red-700';
                  return (
                    <div className="rounded-md border bg-background p-3 text-sm">
                      <div className="flex items-baseline justify-between">
                        <span className="text-muted-foreground">
                          Total reçu après enregistrement
                        </span>
                        <span className="text-lg font-semibold">
                          {formatEuro(a.nouveauPaye)}{' '}
                          <span className="text-sm font-normal text-muted-foreground">
                            / {formatEuro(a.loyer.montantTotal)}
                          </span>
                        </span>
                      </div>
                      <div className="mt-1 flex items-baseline justify-between text-xs">
                        <span className="text-muted-foreground">
                          dont {formatEuro(a.loyer.montantPaye)} déjà payé +{' '}
                          {formatEuro(totalRecu)} nouveau
                        </span>
                        <span className="flex items-center gap-2">
                          <span className={`font-medium ${ecartColor}`}>{ecartLabel}</span>
                          {ecart < -0.005 && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-6 px-2 text-xs"
                              onClick={() => solderLoyer(a.loyer.id, -ecart)}
                              disabled={isSubmitting}
                            >
                              Solder {formatEuro(-ecart)}
                            </Button>
                          )}
                        </span>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div className="flex items-baseline justify-between rounded-md border bg-background p-3 text-sm">
                  <span className="text-muted-foreground">
                    Total nouveaux encaissements ({impactsParLoyer.length} loyers ciblés)
                  </span>
                  <span className="text-lg font-semibold text-green-700">
                    {formatEuro(totalRecu)}
                  </span>
                </div>
              )}

              {impactsParLoyer.length > 0 && (
                <div className="rounded-md border border-dashed bg-background p-3 text-xs">
                  <div className="mb-1 font-medium text-muted-foreground">
                    Aperçu après enregistrement :
                  </div>
                  <ul className="space-y-0.5">
                    {impactsParLoyer.map((a) => {
                      const next = moisSuivant(a.loyer);
                      if (a.surplus > 0.005) {
                        return (
                          <li key={a.loyer.id} className="text-amber-700">
                            ◑ {MOIS_LONG[a.loyer.mois - 1]} {a.loyer.annee} — soldé, surplus{' '}
                            {formatEuro(a.surplus)} → proposé en report sur{' '}
                            {MOIS_LONG[next.mois - 1]} {next.annee}
                          </li>
                        );
                      }
                      if (a.seraPaye) {
                        return (
                          <li key={a.loyer.id} className="font-medium text-green-700">
                            ✓ {MOIS_LONG[a.loyer.mois - 1]} {a.loyer.annee} — soldé
                          </li>
                        );
                      }
                      return (
                        <li key={a.loyer.id} className="text-amber-700">
                          ◐ {MOIS_LONG[a.loyer.mois - 1]} {a.loyer.annee} — restera{' '}
                          {formatEuro(a.reste)} à percevoir
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || loyersOuverts.length === 0}>
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Enregistrer ({formatEuro(totalRecu)})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
