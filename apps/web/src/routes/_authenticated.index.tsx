import { Link, createFileRoute } from '@tanstack/react-router';
import {
  ArrowRight,
  Banknote,
  Building2,
  Calendar,
  FileCheck,
  FileText,
  MailWarning,
  Receipt,
  Settings,
  ShieldCheck,
  UserCircle,
  Users,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { LoyersChart12Mois } from '@/components/dashboard/loyers-chart-12-mois';
import {
  LoyersSyntheseView,
  type SyntheseMode,
} from '@/components/loyers/loyers-synthese';
import { useBiens } from '@/lib/db/biens';
import { useCharges } from '@/lib/db/charges';
import { useLoyers } from '@/lib/db/loyers';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/_authenticated/')({
  component: HomePage,
});

const cards = [
  { to: '/proprietaires', title: 'Propriétaires', icon: Users },
  { to: '/biens', title: 'Biens', icon: Building2 },
  { to: '/locataires', title: 'Locataires', icon: UserCircle },
  { to: '/garants', title: 'Garants', icon: ShieldCheck },
  { to: '/contrats', title: 'Contrats', icon: FileText },
  { to: '/loyers', title: 'Loyers', icon: Calendar },
  { to: '/paiements', title: 'Paiements', icon: Banknote },
  { to: '/quittances', title: 'Quittances', icon: FileCheck },
  { to: '/rappels', title: 'Rappels', icon: MailWarning },
  { to: '/charges', title: 'Charges', icon: Receipt },
  { to: '/parametres', title: 'Paramètres', icon: Settings },
] as const;

const formatEuro = (v: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v);

function HomePage() {
  const now = new Date();
  const moisCourant = now.getMonth() + 1;
  const anneeCourante = now.getFullYear();
  const [syntheseMode, setSyntheseMode] = useState<SyntheseMode>('loyers');

  const loyersQuery = useLoyers();
  const chargesQuery = useCharges();
  const biensQuery = useBiens();

  const loyers = useMemo(() => loyersQuery.data ?? [], [loyersQuery.data]);
  const charges = useMemo(() => chargesQuery.data ?? [], [chargesQuery.data]);

  /** Stats du mois courant. */
  const statsMois = useMemo(() => {
    const loyersMois = loyers.filter(
      (l) => l.mois === moisCourant && l.annee === anneeCourante,
    );
    const attendu = loyersMois.reduce((s, l) => s + l.montantTotal, 0);
    const encaisse = loyersMois.reduce((s, l) => s + l.montantPaye, 0);
    const chargesMois = charges
      .filter((c) => {
        const d = new Date(c.date);
        return d.getMonth() + 1 === moisCourant && d.getFullYear() === anneeCourante;
      })
      .reduce((s, c) => s + c.montantTtc, 0);
    return {
      attendu,
      encaisse,
      reste: Math.max(0, attendu - encaisse),
      charges: chargesMois,
      net: encaisse - chargesMois,
    };
  }, [loyers, charges, moisCourant, anneeCourante]);

  /** Stats charges agrégées (mois / trimestre / année / total). */
  const statsCharges = useMemo(() => {
    const trimestreCourant = Math.ceil(moisCourant / 3);
    return {
      mois: charges
        .filter((c) => {
          const d = new Date(c.date);
          return d.getMonth() + 1 === moisCourant && d.getFullYear() === anneeCourante;
        })
        .reduce((s, c) => s + c.montantTtc, 0),
      trimestre: charges
        .filter((c) => {
          const d = new Date(c.date);
          return (
            Math.ceil((d.getMonth() + 1) / 3) === trimestreCourant &&
            d.getFullYear() === anneeCourante
          );
        })
        .reduce((s, c) => s + c.montantTtc, 0),
      annee: charges
        .filter((c) => new Date(c.date).getFullYear() === anneeCourante)
        .reduce((s, c) => s + c.montantTtc, 0),
      total: charges.reduce((s, c) => s + c.montantTtc, 0),
    };
  }, [charges, moisCourant, anneeCourante]);

  /** Totaux charges par bien (sur l'année courante). */
  const chargesParBien = useMemo(() => {
    const map = new Map<string, { adresse: string; ville: string; total: number }>();
    for (const c of charges) {
      if (new Date(c.date).getFullYear() !== anneeCourante) continue;
      const key = c.bien?.id ?? c.bienId;
      const adresse = c.bien?.adresse ?? '— inconnu —';
      const ville = c.bien?.ville ?? '';
      const existant = map.get(key);
      if (existant) existant.total += c.montantTtc;
      else map.set(key, { adresse, ville, total: c.montantTtc });
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [charges, anneeCourante]);

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

  return (
    <div className="container py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Tableau de bord</h1>
        <p className="text-sm text-muted-foreground">
          Synthèse {MOIS_LABELS[moisCourant - 1]} {anneeCourante}
        </p>
      </div>

      {/* KPI mois courant */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          label="Loyers attendus"
          value={formatEuro(statsMois.attendu)}
          sub="ce mois"
          color="text-slate-700"
        />
        <KpiCard
          label="Loyers encaissés"
          value={formatEuro(statsMois.encaisse)}
          sub={
            statsMois.reste > 0.005
              ? `reste ${formatEuro(statsMois.reste)}`
              : 'soldé ✓'
          }
          color="text-green-700"
        />
        <KpiCard
          label="Charges"
          value={formatEuro(statsMois.charges)}
          sub="dépenses du mois"
          color="text-red-700"
        />
        <KpiCard
          label="Résultat net"
          value={formatEuro(statsMois.net)}
          sub="encaissé − charges"
          color={statsMois.net >= 0 ? 'text-emerald-700' : 'text-red-700'}
        />
      </div>

      {/* Graphique 12 mois */}
      <div className="mb-6">
        <LoyersChart12Mois loyers={loyers} />
      </div>

      {/* Synthèse par bien × mois — toggle loyers / charges / bénéfice */}
      <div className="mb-6">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">Synthèse {anneeCourante}</h2>
          <div className="flex items-center gap-2">
            <SyntheseToggle mode={syntheseMode} onChange={setSyntheseMode} />
            <Link
              to="/loyers"
              className="text-xs font-medium text-primary hover:underline"
            >
              Détail →
            </Link>
          </div>
        </div>
        <LoyersSyntheseView
          loyers={loyers}
          charges={charges}
          biens={biensQuery.data ?? []}
          annee={anneeCourante}
          mode={syntheseMode}
        />
      </div>

      {/* Totaux charges */}
      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold">Charges — totaux</h3>
          <ul className="space-y-2 text-sm">
            <ChargeTotalLine label="Ce mois" value={statsCharges.mois} />
            <ChargeTotalLine label="Trimestre en cours" value={statsCharges.trimestre} />
            <ChargeTotalLine label="Année en cours" value={statsCharges.annee} />
            <ChargeTotalLine
              label="Depuis le début"
              value={statsCharges.total}
              emphasized
            />
          </ul>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold">Charges {anneeCourante} par bien</h3>
          {chargesParBien.length === 0 ? (
            <p className="text-xs text-muted-foreground">Aucune charge sur l’année.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {chargesParBien.map((b, i) => (
                <li key={i} className="flex items-baseline justify-between">
                  <span className="truncate">
                    <span className="font-medium">{b.adresse}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{b.ville}</span>
                  </span>
                  <span className="font-medium">{formatEuro(b.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Accès rapide aux modules */}
      <div>
        <h2 className="mb-2 text-sm font-semibold">Accès rapide</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {cards.map((c) => {
            const Icon = c.icon;
            return (
              <Link
                key={c.to}
                to={c.to}
                className="group flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm transition-colors hover:bg-accent"
              >
                <Icon className="h-4 w-4 text-primary" />
                <span className="font-medium">{c.title}</span>
                <ArrowRight className="ml-auto h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SyntheseToggle({
  mode,
  onChange,
}: {
  mode: SyntheseMode;
  onChange: (m: SyntheseMode) => void;
}) {
  const options: { value: SyntheseMode; label: string }[] = [
    { value: 'loyers', label: 'Loyers payés' },
    { value: 'charges', label: 'Charges' },
    { value: 'benefice', label: 'Bénéfice / Déficit' },
  ];
  return (
    <div className="flex overflow-hidden rounded-md border text-xs">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            'px-3 py-1.5 font-medium transition-colors',
            mode === opt.value
              ? 'bg-primary text-primary-foreground'
              : 'bg-background text-muted-foreground hover:bg-muted',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-xs font-medium uppercase text-muted-foreground">{label}</div>
      <div className={cn('mt-1 text-2xl font-bold', color)}>{value}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}

function ChargeTotalLine({
  label,
  value,
  emphasized = false,
}: {
  label: string;
  value: number;
  emphasized?: boolean;
}) {
  return (
    <li className="flex items-baseline justify-between border-b pb-1 last:border-0 last:pb-0">
      <span className={cn('text-muted-foreground', emphasized && 'font-medium text-foreground')}>
        {label}
      </span>
      <span className={cn('font-medium', emphasized && 'text-lg')}>{formatEuro(value)}</span>
    </li>
  );
}
