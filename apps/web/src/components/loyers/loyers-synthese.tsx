import { useMemo } from 'react';

import { type Bien } from '@/lib/db/biens';
import { type Charge } from '@/lib/db/charges';
import { type Loyer } from '@/lib/db/loyers';
import { cn } from '@/lib/utils';

export type SyntheseMode = 'loyers' | 'charges' | 'benefice';

const MOIS_COURT = [
  'Janv.',
  'Févr.',
  'Mars',
  'Avr.',
  'Mai',
  'Juin',
  'Juil.',
  'Août',
  'Sept.',
  'Oct.',
  'Nov.',
  'Déc.',
];

const formatEuro = (v: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v);

interface Props {
  loyers: Loyer[];
  annee: number;
  /** Mode d'affichage : loyers encaissés, charges, ou bénéfice (loyers - charges). Défaut: loyers. */
  mode?: SyntheseMode;
  /** Charges à afficher (requis si mode != 'loyers'). */
  charges?: Charge[];
  /** Tous les biens : inclus les biens sans loyer ni charge (vacants). Optionnel. */
  biens?: Bien[];
}

interface BienLigne {
  bienId: string;
  bienAdresse: string;
  bienVille: string;
  locataires: Set<string>;
  /** map mois (1-12) → loyer correspondant ce mois pour ce bien */
  parMois: Map<number, Loyer>;
  totalPaye: number;
  totalDu: number;
}

/**
 * Tableau de synthèse : matrice bien × 12 mois de l'année donnée.
 * Selon `mode` :
 *  - 'loyers' (défaut) : montant encaissé / dû, coloration par statut
 *  - 'charges' : total des charges du bien sur le mois
 *  - 'benefice' : loyer encaissé - charges, coloré rouge si négatif
 */
export function LoyersSyntheseView({
  loyers,
  annee,
  mode = 'loyers',
  charges = [],
  biens = [],
}: Props) {
  const lignes = useMemo<BienLigne[]>(() => {
    const map = new Map<string, BienLigne>();

    // Initialise toutes les lignes depuis la liste des biens (pour inclure
    // les biens vacants sans loyer ni charge).
    for (const b of biens) {
      map.set(b.id, {
        bienId: b.id,
        bienAdresse: b.adresse,
        bienVille: `${b.codePostal} ${b.ville}`,
        locataires: new Set(),
        parMois: new Map(),
        totalPaye: 0,
        totalDu: 0,
      });
    }

    for (const l of loyers) {
      if (l.annee !== annee) continue;
      const bienId = l.contrat?.bienId ?? `unknown-${l.contratId}`;
      let ligne = map.get(bienId);
      if (!ligne) {
        ligne = {
          bienId,
          bienAdresse: l.contrat?.bienAdresse ?? '— bien inconnu —',
          bienVille: l.contrat?.bienVille ?? '',
          locataires: new Set(),
          parMois: new Map(),
          totalPaye: 0,
          totalDu: 0,
        };
        map.set(bienId, ligne);
      }
      if (l.contrat?.locatairePrincipalLabel) {
        ligne.locataires.add(l.contrat.locatairePrincipalLabel);
      }
      // Si déjà un loyer pour ce mois (cas rare de doublon), on cumule plutôt qu'écraser.
      const existant = ligne.parMois.get(l.mois);
      if (existant) {
        // Cumule en gardant une référence agrégée fictive
        ligne.parMois.set(l.mois, {
          ...existant,
          montantPaye: existant.montantPaye + l.montantPaye,
          montantTotal: existant.montantTotal + l.montantTotal,
          soldeRestant: existant.soldeRestant + l.soldeRestant,
        });
      } else {
        ligne.parMois.set(l.mois, l);
      }
      ligne.totalPaye += l.montantPaye;
      ligne.totalDu += l.montantTotal;
    }
    return Array.from(map.values()).sort((a, b) =>
      a.bienAdresse.localeCompare(b.bienAdresse, 'fr'),
    );
  }, [loyers, annee, biens]);

  /**
   * Charges agrégées par (bienId, mois) pour l'année donnée.
   * - PONCTUELLE : compte sur le mois de `date`.
   * - RECURRENTE : déplie sur tous les mois entre `date_debut`/`date` et `date_fin`/aujourd'hui,
   *   selon la fréquence (MENSUELLE / TRIMESTRIELLE / SEMESTRIELLE / ANNUELLE).
   */
  const chargesParBienMois = useMemo<Map<string, Map<number, number>>>(() => {
    const map = new Map<string, Map<number, number>>();
    const addToMap = (bienId: string, mois: number, montant: number) => {
      let parMois = map.get(bienId);
      if (!parMois) {
        parMois = new Map();
        map.set(bienId, parMois);
      }
      parMois.set(mois, (parMois.get(mois) ?? 0) + montant);
    };

    for (const c of charges) {
      if (c.type === 'PONCTUELLE' || !c.frequence) {
        const d = new Date(c.date);
        if (d.getFullYear() === annee) addToMap(c.bienId, d.getMonth() + 1, c.montantTtc);
        continue;
      }
      // Récurrente : déplier
      const debut = c.dateDebut ? new Date(c.dateDebut) : new Date(c.date);
      const fin = c.dateFin ? new Date(c.dateFin) : new Date(annee, 11, 31);
      const stepMois =
        c.frequence === 'MENSUELLE'
          ? 1
          : c.frequence === 'TRIMESTRIELLE'
            ? 3
            : c.frequence === 'SEMESTRIELLE'
              ? 6
              : 12;
      // Itère mois par mois depuis debut jusqu'à fin
      const cursor = new Date(debut.getFullYear(), debut.getMonth(), 1);
      const stopAt = new Date(fin.getFullYear(), fin.getMonth(), 1);
      while (cursor.getTime() <= stopAt.getTime()) {
        if (cursor.getFullYear() === annee) {
          addToMap(c.bienId, cursor.getMonth() + 1, c.montantTtc);
        }
        cursor.setMonth(cursor.getMonth() + stepMois);
      }
    }
    return map;
  }, [charges, annee]);

  /** Valeur affichée dans une cellule selon le mode courant. */
  const cellValue = (bienId: string, mois: number, loyer: Loyer | undefined): number => {
    if (mode === 'loyers') return loyer?.montantPaye ?? 0;
    if (mode === 'charges') return chargesParBienMois.get(bienId)?.get(mois) ?? 0;
    // benefice = loyer encaissé - charges du mois
    const enc = loyer?.montantPaye ?? 0;
    const ch = chargesParBienMois.get(bienId)?.get(mois) ?? 0;
    return enc - ch;
  };

  const totauxParMois = useMemo<number[]>(() => {
    const totaux = Array(12).fill(0) as number[];
    for (const ligne of lignes) {
      for (let m = 1; m <= 12; m++) {
        const v = cellValue(ligne.bienId, m, ligne.parMois.get(m));
        totaux[m - 1] = (totaux[m - 1] ?? 0) + v;
      }
    }
    return totaux;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lignes, chargesParBienMois, mode]);

  const totauxParBien = useMemo<Map<string, number>>(() => {
    const map = new Map<string, number>();
    for (const ligne of lignes) {
      let total = 0;
      for (let m = 1; m <= 12; m++) {
        total += cellValue(ligne.bienId, m, ligne.parMois.get(m));
      }
      map.set(ligne.bienId, total);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lignes, chargesParBienMois, mode]);

  const totalGlobal = useMemo(() => {
    let total = 0;
    for (const v of totauxParBien.values()) total += v;
    return total;
  }, [totauxParBien]);
  const totalGlobalDu = useMemo(() => lignes.reduce((s, l) => s + l.totalDu, 0), [lignes]);

  if (lignes.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">
        Aucun loyer pour {annee}. Génère les loyers du mois ou change d&apos;année.
      </div>
    );
  }

  const cellColor = (l: Loyer | undefined, value: number): string => {
    if (mode === 'charges') {
      if (value === 0) return 'bg-muted/20 text-muted-foreground';
      return 'bg-red-50 text-red-900';
    }
    if (mode === 'benefice') {
      if (value === 0) return 'bg-muted/20 text-muted-foreground';
      return value > 0 ? 'bg-green-50 text-green-900' : 'bg-red-50 text-red-900';
    }
    if (!l) return 'bg-muted/20 text-muted-foreground';
    switch (l.statut) {
      case 'PAYE':
        return 'bg-green-50 text-green-900';
      case 'PARTIEL':
        return 'bg-amber-50 text-amber-900';
      case 'RETARD':
        return 'bg-orange-50 text-orange-900';
      case 'IMPAYE':
        return 'bg-red-50 text-red-900';
      case 'ANNULE':
        return 'bg-gray-100 text-gray-500 line-through';
      default:
        return 'bg-slate-50 text-slate-800';
    }
  };

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-xs">
        <thead className="bg-muted/50">
          <tr>
            <th className="sticky left-0 z-10 min-w-[200px] bg-muted/50 px-3 py-2 text-left font-medium">
              Bien
            </th>
            {MOIS_COURT.map((m, i) => (
              <th key={i} className="px-2 py-2 text-center font-medium">
                {m}
                <div className="text-[10px] font-normal text-muted-foreground">{annee}</div>
              </th>
            ))}
            <th className="px-3 py-2 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {lignes.map((ligne) => (
            <tr key={ligne.bienId} className="hover:bg-muted/20">
              <td className="sticky left-0 z-10 bg-background px-3 py-2">
                <div className="font-medium">{ligne.bienAdresse}</div>
                <div className="text-[10px] text-muted-foreground">{ligne.bienVille}</div>
                {ligne.locataires.size > 0 && (
                  <div className="text-[10px] text-muted-foreground">
                    {Array.from(ligne.locataires).join(', ')}
                  </div>
                )}
              </td>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((mois) => {
                const loyer = ligne.parMois.get(mois);
                const value = cellValue(ligne.bienId, mois, loyer);
                return (
                  <td
                    key={mois}
                    className={cn('px-2 py-2 text-center', cellColor(loyer, value))}
                  >
                    {mode === 'loyers' && loyer ? (
                      <>
                        <div className="font-medium">{formatEuro(loyer.montantPaye)}</div>
                        {loyer.soldeRestant > 0.005 && (
                          <div className="text-[10px] opacity-70">
                            / {formatEuro(loyer.montantTotal)}
                          </div>
                        )}
                      </>
                    ) : mode === 'loyers' ? (
                      <span className="opacity-40">—</span>
                    ) : value === 0 ? (
                      <span className="opacity-40">—</span>
                    ) : (
                      <div className="font-medium">{formatEuro(value)}</div>
                    )}
                  </td>
                );
              })}
              <td className="bg-muted/30 px-3 py-2 text-right">
                {mode === 'loyers' ? (
                  <>
                    <div className="font-semibold text-green-700">
                      {formatEuro(ligne.totalPaye)}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      / {formatEuro(ligne.totalDu)}
                    </div>
                  </>
                ) : (
                  <div
                    className={cn(
                      'font-semibold',
                      mode === 'charges'
                        ? 'text-red-700'
                        : (totauxParBien.get(ligne.bienId) ?? 0) >= 0
                          ? 'text-green-700'
                          : 'text-red-700',
                    )}
                  >
                    {formatEuro(totauxParBien.get(ligne.bienId) ?? 0)}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-muted/50">
          <tr>
            <td className="sticky left-0 z-10 bg-muted/50 px-3 py-2 font-semibold">
              Total {annee}
            </td>
            {totauxParMois.map((total, i) => (
              <td key={i} className="px-2 py-2 text-center text-xs font-medium">
                {total > 0 ? formatEuro(total) : <span className="opacity-40">—</span>}
              </td>
            ))}
            <td className="bg-muted px-3 py-2 text-right">
              <div
                className={cn(
                  'font-bold',
                  mode === 'charges'
                    ? 'text-red-700'
                    : mode === 'benefice'
                      ? totalGlobal >= 0
                        ? 'text-green-700'
                        : 'text-red-700'
                      : 'text-green-700',
                )}
              >
                {formatEuro(totalGlobal)}
              </div>
              {mode === 'loyers' && (
                <div className="text-[10px] text-muted-foreground">
                  / {formatEuro(totalGlobalDu)}
                </div>
              )}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
