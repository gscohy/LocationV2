import { useEffect, useMemo, useRef, useState } from 'react';

import { type Loyer } from '@/lib/db/loyers';

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
  new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(v);

interface Props {
  loyers: Loyer[];
}

interface Mois {
  mois: number;
  annee: number;
  label: string;
  attendu: number;
  encaisse: number;
}

interface SerieBien {
  bienId: string;
  label: string;
  color: string;
  points: { mois: number; annee: number; attendu: number; encaisse: number }[];
}

// Palette vive sans vert (le vert est réservé à la courbe "Total parc")
const COULEURS_BIENS = [
  '#2563eb', // blue-600
  '#ef4444', // red-500
  '#f97316', // orange-500
  '#a855f7', // purple-500
  '#ec4899', // pink-500
  '#06b6d4', // cyan-500
  '#eab308', // yellow-500
  '#dc2626', // red-600
];

interface Point {
  x: number;
  y: number;
}

/**
 * Construit un path SVG lissé (Catmull-Rom → Bézier cubique) à partir d'une liste
 * de points. Donne une courbe douce sans à-coups. Tension = 0.5 par défaut.
 */
function smoothPath(points: Point[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0]!.x},${points[0]!.y}`;
  if (points.length === 2)
    return `M ${points[0]!.x},${points[0]!.y} L ${points[1]!.x},${points[1]!.y}`;

  const t = 0.4; // tension
  let d = `M ${points[0]!.x},${points[0]!.y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[Math.min(points.length - 1, i + 2)]!;
    const cp1x = p1.x + ((p2.x - p0.x) / 6) * (2 * t);
    const cp1y = p1.y + ((p2.y - p0.y) / 6) * (2 * t);
    const cp2x = p2.x - ((p3.x - p1.x) / 6) * (2 * t);
    const cp2y = p2.y - ((p3.y - p1.y) / 6) * (2 * t);
    d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }
  return d;
}

type Mode = 'cumule' | 'par-bien';

export function LoyersChart12Mois({ loyers }: Props) {
  const [mode, setMode] = useState<Mode>('cumule');
  const [bienSelectionne, setBienSelectionne] = useState<string>('');

  // Squelette des 12 derniers mois (vide)
  const squelette = useMemo<Mois[]>(() => {
    const now = new Date();
    const mois: Mois[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      mois.push({
        mois: d.getMonth() + 1,
        annee: d.getFullYear(),
        label: MOIS_COURT[d.getMonth()]!,
        attendu: 0,
        encaisse: 0,
      });
    }
    return mois;
  }, []);

  // Données agrégées (cumulé tous biens)
  const data = useMemo<Mois[]>(() => {
    const mois = squelette.map((m) => ({ ...m }));
    for (const l of loyers) {
      const idx = mois.findIndex((m) => m.mois === l.mois && m.annee === l.annee);
      if (idx >= 0) {
        mois[idx]!.attendu += l.montantTotal;
        mois[idx]!.encaisse += l.montantPaye;
      }
    }
    return mois;
  }, [loyers, squelette]);

  // Séries par bien (encaissé uniquement, vision parc)
  const seriesBien = useMemo<SerieBien[]>(() => {
    const byBien = new Map<string, { adresse: string; ville: string; data: Mois[] }>();
    for (const l of loyers) {
      const bienId = l.contrat?.bienId ?? '';
      if (!bienId) continue;
      let s = byBien.get(bienId);
      if (!s) {
        s = {
          adresse: l.contrat?.bienAdresse ?? '— inconnu —',
          ville: l.contrat?.bienVille ?? '',
          data: squelette.map((m) => ({ ...m })),
        };
        byBien.set(bienId, s);
      }
      const idx = s.data.findIndex((m) => m.mois === l.mois && m.annee === l.annee);
      if (idx >= 0) {
        s.data[idx]!.attendu += l.montantTotal;
        s.data[idx]!.encaisse += l.montantPaye;
      }
    }
    return Array.from(byBien.entries())
      .sort((a, b) => a[1].adresse.localeCompare(b[1].adresse, 'fr'))
      .map(([bienId, s], i) => ({
        bienId,
        label: s.adresse,
        color: COULEURS_BIENS[i % COULEURS_BIENS.length]!,
        points: s.data.map((d) => ({
          mois: d.mois,
          annee: d.annee,
          attendu: d.attendu,
          encaisse: d.encaisse,
        })),
      }));
  }, [loyers, squelette]);

  // Série du bien sélectionné (mode par-bien)
  const serieBienChoisi = useMemo(() => {
    if (!bienSelectionne) return null;
    return seriesBien.find((s) => s.bienId === bienSelectionne) ?? null;
  }, [seriesBien, bienSelectionne]);

  // Init bien sélectionné au premier chargement
  useEffect(() => {
    if (mode === 'par-bien' && !bienSelectionne && seriesBien.length > 0) {
      setBienSelectionne(seriesBien[0]!.bienId);
    }
  }, [mode, bienSelectionne, seriesBien]);

  const maxValue = useMemo(() => {
    let m = 0;
    if (mode === 'cumule') {
      // max sur toutes les lignes par bien + le total cumulé
      for (const s of seriesBien) {
        for (const p of s.points) m = Math.max(m, p.encaisse);
      }
      m = Math.max(m, ...data.map((d) => d.encaisse));
    } else {
      // Bien sélectionné : max attendu/encaissé
      if (serieBienChoisi) {
        for (const p of serieBienChoisi.points) m = Math.max(m, p.attendu, p.encaisse);
      }
    }
    return m > 0 ? Math.ceil((m * 1.1) / 50) * 50 : 100;
  }, [data, seriesBien, serieBienChoisi, mode]);

  const [hovered, setHovered] = useState<number | null>(null);
  const [animated, setAnimated] = useState(false);

  // Animation : redessine au montage et quand les données changent
  useEffect(() => {
    setAnimated(false);
    const id = requestAnimationFrame(() => setAnimated(true));
    return () => cancelAnimationFrame(id);
  }, [data]);

  // Géométrie
  const width = 900;
  const height = 260;
  const padLeft = 56;
  const padRight = 24;
  const padTop = 20;
  const padBottom = 44;
  const innerW = width - padLeft - padRight;
  const innerH = height - padTop - padBottom;
  const stepX = data.length > 1 ? innerW / (data.length - 1) : 0;

  const xAt = (i: number) => padLeft + i * stepX;
  const yScale = (v: number) => padTop + innerH - (v / maxValue) * innerH;

  // Courbe TOTAL parc (utilisée en mode cumulé pour superposer une ligne foncée)
  const ptsEncaisseTotal: Point[] = data.map((d, i) => ({ x: xAt(i), y: yScale(d.encaisse) }));
  const pathEncaisse = smoothPath(ptsEncaisseTotal);

  const ticks = 4;

  return (
    <div className="rounded-xl border bg-gradient-to-br from-card to-card/50 p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Loyers — 12 mois glissants</h3>
          <p className="text-xs text-muted-foreground">
            {mode === 'cumule'
              ? `Superposition des ${seriesBien.length} bien${seriesBien.length > 1 ? 's' : ''} + total cumulé du parc`
              : 'Détail attendu vs encaissé pour le bien sélectionné'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex overflow-hidden rounded-md border text-xs">
            <button
              type="button"
              onClick={() => setMode('cumule')}
              className={
                mode === 'cumule'
                  ? 'bg-primary px-3 py-1.5 font-medium text-primary-foreground'
                  : 'bg-background px-3 py-1.5 font-medium text-muted-foreground hover:bg-muted'
              }
            >
              Cumulé
            </button>
            <button
              type="button"
              onClick={() => setMode('par-bien')}
              className={
                mode === 'par-bien'
                  ? 'bg-primary px-3 py-1.5 font-medium text-primary-foreground'
                  : 'bg-background px-3 py-1.5 font-medium text-muted-foreground hover:bg-muted'
              }
            >
              Par bien
            </button>
          </div>
          {mode === 'par-bien' && seriesBien.length > 0 && (
            <select
              value={bienSelectionne}
              onChange={(e) => setBienSelectionne(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            >
              {seriesBien.map((s) => (
                <option key={s.bienId} value={s.bienId}>
                  {s.label}
                </option>
              ))}
            </select>
          )}
          {mode === 'par-bien' && (
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5 text-slate-500">
                <span
                  className="block h-0.5 w-5 rounded"
                  style={{
                    background: '#94a3b8',
                    backgroundImage:
                      'repeating-linear-gradient(to right, #94a3b8 0 4px, transparent 4px 7px)',
                  }}
                />
                Attendu
              </span>
              <span className="flex items-center gap-1.5 font-medium text-emerald-700">
                <span className="block h-0.5 w-5 rounded bg-emerald-500" />
                Encaissé
              </span>
            </div>
          )}
        </div>
      </div>

      {mode === 'cumule' && seriesBien.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          {seriesBien.map((s) => (
            <span key={s.bienId} className="flex items-center gap-1.5">
              <span className="block h-0.5 w-5 rounded" style={{ background: s.color }} />
              <span className="text-muted-foreground">{s.label}</span>
            </span>
          ))}
          <span className="flex items-center gap-1.5 font-medium text-emerald-700">
            <span className="block h-1 w-5 rounded bg-emerald-600" />
            <span>Total parc</span>
          </span>
        </div>
      )}

      <div className="relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-auto w-full overflow-visible"
          onMouseLeave={() => setHovered(null)}
        >
          <defs>
            <linearGradient id="gradEncaisse" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="strokeEncaisse" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="#059669" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Grille horizontale + labels Y */}
          {Array.from({ length: ticks + 1 }, (_, i) => {
            const v = (maxValue * i) / ticks;
            const y = yScale(v);
            return (
              <g key={i}>
                <line
                  x1={padLeft}
                  x2={width - padRight}
                  y1={y}
                  y2={y}
                  stroke="currentColor"
                  strokeOpacity={0.06}
                  strokeDasharray="2 4"
                />
                <text
                  x={padLeft - 10}
                  y={y + 3}
                  fontSize={10}
                  textAnchor="end"
                  fill="currentColor"
                  fillOpacity={0.4}
                >
                  {formatEuro(v)}
                </text>
              </g>
            );
          })}

          {mode === 'cumule' && (
            <>
              {/* Lignes par bien superposées */}
              {seriesBien.map((s, idx) => {
                const pts: Point[] = s.points.map((p, i) => ({
                  x: xAt(i),
                  y: yScale(p.encaisse),
                }));
                return (
                  <PathAnimated
                    key={s.bienId}
                    d={smoothPath(pts)}
                    stroke={s.color}
                    strokeWidth={2}
                    animated={animated}
                    duration={1.0}
                    delay={0.1 + idx * 0.06}
                  />
                );
              })}
              {/* Courbe TOTAL parc (épaisse verte) */}
              <PathAnimated
                d={pathEncaisse}
                stroke="#059669"
                strokeWidth={3.5}
                animated={animated}
                duration={1.2}
                delay={0.4}
              />
            </>
          )}

          {mode === 'par-bien' && serieBienChoisi && (
            <>
              {/* Aire sous la courbe encaissée du bien choisi */}
              <path
                d={
                  serieBienChoisi.points.length === 0
                    ? ''
                    : `M ${xAt(0)},${padTop + innerH} ` +
                      smoothPath(
                        serieBienChoisi.points.map((p, i) => ({
                          x: xAt(i),
                          y: yScale(p.encaisse),
                        })),
                      ).replace(/^M /, 'L ') +
                      ` L ${xAt(serieBienChoisi.points.length - 1)},${padTop + innerH} Z`
                }
                fill="url(#gradEncaisse)"
                style={{
                  opacity: animated ? 1 : 0,
                  transition: 'opacity 0.8s ease-out 0.4s',
                }}
              />
              {/* Courbe attendu pointillée */}
              <PathAnimated
                d={smoothPath(
                  serieBienChoisi.points.map((p, i) => ({ x: xAt(i), y: yScale(p.attendu) })),
                )}
                stroke="#94a3b8"
                strokeWidth={1.5}
                strokeDasharray="5 4"
                animated={animated}
                duration={1.0}
                delay={0.1}
              />
              {/* Courbe encaissé épaisse */}
              <PathAnimated
                d={smoothPath(
                  serieBienChoisi.points.map((p, i) => ({ x: xAt(i), y: yScale(p.encaisse) })),
                )}
                stroke="url(#strokeEncaisse)"
                strokeWidth={3}
                animated={animated}
                duration={1.2}
                delay={0.3}
              />
            </>
          )}

          {/* Trait vertical de survol */}
          {hovered !== null && (
            <line
              x1={xAt(hovered)}
              x2={xAt(hovered)}
              y1={padTop}
              y2={padTop + innerH}
              stroke="#10b981"
              strokeOpacity={0.25}
              strokeWidth={1}
              pointerEvents="none"
            />
          )}

          {/* Zones de hover (1 par mois) */}
          {data.map((_, i) => (
            <rect
              key={`hover-${i}`}
              x={xAt(i) - stepX / 2}
              y={padTop}
              width={stepX}
              height={innerH}
              fill="transparent"
              onMouseEnter={() => setHovered(i)}
              style={{ cursor: 'pointer' }}
            />
          ))}

          {/* Points — mode cumulé : un point par bien à chaque mois + total */}
          {mode === 'cumule' &&
            seriesBien.map((s) =>
              s.points.map((p, i) => {
                const isHovered = hovered === i;
                return (
                  <circle
                    key={`pt-${s.bienId}-${i}`}
                    cx={xAt(i)}
                    cy={yScale(p.encaisse)}
                    r={isHovered ? 4 : 2.5}
                    fill={s.color}
                    stroke="#fff"
                    strokeWidth={1.5}
                    pointerEvents="none"
                    style={{ transition: 'r 150ms ease-out' }}
                  />
                );
              }),
            )}
          {mode === 'cumule' &&
            data.map((d, i) => {
              const isHovered = hovered === i;
              return (
                <g key={`tot-${i}`} pointerEvents="none">
                  {isHovered && (
                    <circle
                      cx={xAt(i)}
                      cy={yScale(d.encaisse)}
                      r={11}
                      fill="#059669"
                      fillOpacity={0.25}
                    />
                  )}
                  <circle
                    cx={xAt(i)}
                    cy={yScale(d.encaisse)}
                    r={isHovered ? 6 : 4}
                    fill="#059669"
                    stroke="#fff"
                    strokeWidth={2}
                    style={{ transition: 'r 150ms ease-out' }}
                  />
                </g>
              );
            })}

          {/* Points — mode par-bien : courbes attendu/encaissé d'UN bien */}
          {mode === 'par-bien' &&
            serieBienChoisi &&
            serieBienChoisi.points.map((p, i) => {
              const isHovered = hovered === i;
              return (
                <g key={`pts-pb-${i}`} pointerEvents="none">
                  <circle
                    cx={xAt(i)}
                    cy={yScale(p.attendu)}
                    r={isHovered ? 4 : 2.5}
                    fill="#94a3b8"
                    style={{ transition: 'r 150ms ease-out' }}
                  />
                  {isHovered && (
                    <circle
                      cx={xAt(i)}
                      cy={yScale(p.encaisse)}
                      r={11}
                      fill="#10b981"
                      fillOpacity={0.2}
                    />
                  )}
                  <circle
                    cx={xAt(i)}
                    cy={yScale(p.encaisse)}
                    r={isHovered ? 6 : 3.5}
                    fill="#10b981"
                    stroke="#fff"
                    strokeWidth={2}
                    style={{ transition: 'r 150ms ease-out' }}
                  />
                </g>
              );
            })}

          {/* Labels axe X */}
          {data.map((d, i) => {
            const isHovered = hovered === i;
            return (
              <g key={`lbl-${i}`}>
                <text
                  x={xAt(i)}
                  y={height - padBottom + 18}
                  fontSize={10}
                  textAnchor="middle"
                  fill="currentColor"
                  fillOpacity={isHovered ? 1 : 0.7}
                  fontWeight={isHovered ? 700 : 400}
                  style={{ transition: 'all 150ms ease-out' }}
                >
                  {d.label}
                </text>
                <text
                  x={xAt(i)}
                  y={height - padBottom + 30}
                  fontSize={8}
                  textAnchor="middle"
                  fill="currentColor"
                  fillOpacity={0.4}
                >
                  {d.annee}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Tooltip flottant — par-bien (sélection d'un bien : attendu / encaissé / écart) */}
        {mode === 'par-bien' && serieBienChoisi && hovered !== null && (
          <div
            className="pointer-events-none absolute -top-2 z-10 min-w-[180px] rounded-lg border bg-popover/95 px-3 py-2 text-xs shadow-lg backdrop-blur-sm"
            style={{
              left: `${(xAt(hovered) / width) * 100}%`,
              transform: 'translateX(-50%) translateY(-100%)',
              transition: 'left 150ms ease-out',
            }}
          >
            {(() => {
              const p = serieBienChoisi.points[hovered];
              if (!p) return null;
              const ecart = p.encaisse - p.attendu;
              return (
                <>
                  <div className="mb-1 border-b pb-1">
                    <div className="font-semibold">
                      {MOIS_COURT[p.mois - 1]} {p.annee}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {serieBienChoisi.label}
                    </div>
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-muted-foreground">Attendu</span>
                      <span className="font-medium">{formatEuro(p.attendu)}</span>
                    </div>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-muted-foreground">Encaissé</span>
                      <span className="font-semibold text-emerald-700">
                        {formatEuro(p.encaisse)}
                      </span>
                    </div>
                    {p.attendu > 0 && (
                      <div className="mt-1 flex items-baseline justify-between gap-3 border-t pt-1">
                        <span className="text-muted-foreground">Écart</span>
                        <span
                          className={`font-semibold ${
                            ecart >= 0 ? 'text-emerald-700' : 'text-red-600'
                          }`}
                        >
                          {ecart >= 0 ? '+' : ''}
                          {formatEuro(ecart)}
                        </span>
                      </div>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {/* Tooltip flottant — mode cumulé : détail par bien + total parc */}
        {mode === 'cumule' && hovered !== null && (
          <div
            className="pointer-events-none absolute -top-2 z-10 min-w-[220px] rounded-lg border bg-popover/95 px-3 py-2 text-xs shadow-lg backdrop-blur-sm"
            style={{
              left: `${(xAt(hovered) / width) * 100}%`,
              transform: 'translateX(-50%) translateY(-100%)',
              transition: 'left 150ms ease-out',
            }}
          >
            <div className="mb-1 border-b pb-1 font-semibold">
              {squelette[hovered]?.label} {squelette[hovered]?.annee}
            </div>
            <ul className="space-y-0.5">
              {seriesBien.map((s) => {
                const p = s.points[hovered];
                if (!p) return null;
                return (
                  <li
                    key={s.bienId}
                    className="flex items-baseline justify-between gap-3"
                  >
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <span
                        className="block h-0.5 w-3 rounded"
                        style={{ background: s.color }}
                      />
                      <span className="truncate" style={{ maxWidth: 140 }}>
                        {s.label}
                      </span>
                    </span>
                    <span className="font-medium" style={{ color: s.color }}>
                      {formatEuro(p.encaisse)}
                    </span>
                  </li>
                );
              })}
            </ul>
            <div className="mt-1 flex items-baseline justify-between gap-3 border-t pt-1">
              <span className="font-medium">Total parc</span>
              <span className="font-semibold">
                {formatEuro(
                  seriesBien.reduce((s, ser) => s + (ser.points[hovered]?.encaisse ?? 0), 0),
                )}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface PathAnimatedProps {
  d: string;
  stroke: string;
  strokeWidth: number;
  strokeDasharray?: string;
  animated: boolean;
  duration: number;
  delay: number;
  filter?: string;
}

/**
 * Path SVG avec animation "draw" : stroke-dasharray + stroke-dashoffset
 * passent de pleins à zéro pour donner l'effet de tracé qui apparaît.
 */
function PathAnimated(props: PathAnimatedProps) {
  const ref = useRef<SVGPathElement | null>(null);
  const [length, setLength] = useState(0);

  useEffect(() => {
    if (ref.current) {
      setLength(ref.current.getTotalLength());
    }
  }, [props.d]);

  return (
    <path
      ref={ref}
      d={props.d}
      fill="none"
      stroke={props.stroke}
      strokeWidth={props.strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray={
        props.strokeDasharray ?? (length > 0 ? `${length}` : undefined)
      }
      strokeDashoffset={props.animated || length === 0 ? 0 : length}
      filter={props.filter}
      style={{
        transition: `stroke-dashoffset ${props.duration}s cubic-bezier(0.4, 0, 0.2, 1) ${props.delay}s`,
      }}
    />
  );
}
