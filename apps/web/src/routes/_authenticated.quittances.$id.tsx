import { createFileRoute, Link, useParams } from '@tanstack/react-router';
import { ArrowLeft, Loader2, Printer, Send } from 'lucide-react';
import { useState } from 'react';

import { EnvoyerQuittanceDialog } from '@/components/quittances/envoyer-quittance-dialog';
import { Button } from '@/components/ui/button';
import {
  periodeLabel,
  useQuittance,
  type QuittanceProprietaireSummary,
} from '@/lib/db/quittances';

export const Route = createFileRoute('/_authenticated/quittances/$id')({
  component: QuittanceViewPage,
});

const formatEuro = (v: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v);

const formatDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
};

function nomBailleur(p: QuittanceProprietaireSummary): string {
  if (p.type === 'MORALE') {
    return p.entreprise ?? p.nom;
  }
  const parts: string[] = [];
  if (p.civilite) parts.push(p.civilite);
  if (p.prenom) parts.push(p.prenom);
  parts.push(p.nom);
  return parts.join(' ');
}

function nomLocataire(l: {
  civilite: string | undefined;
  nom: string;
  prenom: string;
}): string {
  return [l.civilite, l.prenom, l.nom].filter(Boolean).join(' ');
}

function QuittanceViewPage() {
  const { id } = useParams({ from: '/_authenticated/quittances/$id' });
  const { data: q, isPending, error } = useQuittance(id);
  const [envoiOpen, setEnvoiOpen] = useState(false);

  if (isPending) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (error || !q) {
    return (
      <div className="container py-8">
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error?.message ?? 'Quittance introuvable'}
        </div>
        <Link to="/quittances" className="mt-4 inline-block">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4" />
            Retour
          </Button>
        </Link>
      </div>
    );
  }

  const l = q.loyer;
  const principal = l?.locatairePrincipal;
  const tousProprietaires = l?.proprietaires ?? [];
  const tousLocataires = l?.tousLocataires ?? [];
  const bailleurPrincipal = tousProprietaires[0];
  const periode = l ? periodeLabel(l.mois, l.annee) : q.periode;
  const listFr = new Intl.ListFormat('fr', { style: 'long', type: 'conjunction' });
  const nomsBailleurs =
    tousProprietaires.length > 0
      ? listFr.format(tousProprietaires.map(nomBailleur))
      : '— bailleur inconnu —';
  const nomsLocataires =
    tousLocataires.length > 0
      ? listFr.format(tousLocataires.map(nomLocataire))
      : '— locataire inconnu —';

  return (
    <>
      {/* Barre d'actions — masquée à l'impression */}
      <div className="border-b bg-muted/30 print:hidden">
        <div className="container flex items-center justify-between py-3">
          <Link to="/quittances">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4" />
              Retour aux quittances
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setEnvoiOpen(true)}>
              <Send className="h-4 w-4" />
              Envoyer par email
            </Button>
            <Button onClick={() => window.print()}>
              <Printer className="h-4 w-4" />
              Imprimer / Enregistrer en PDF
            </Button>
          </div>
        </div>
      </div>

      <EnvoyerQuittanceDialog open={envoiOpen} onOpenChange={setEnvoiOpen} quittance={q} />

      {/* Le document imprimable */}
      <div className="mx-auto my-8 max-w-3xl rounded-md border bg-white p-12 text-sm shadow-sm print:my-0 print:max-w-none print:border-0 print:p-8 print:shadow-none">
        <header className="mb-8 flex items-start justify-between">
          <div className="space-y-3">
            {tousProprietaires.length === 0 && (
              <div className="italic text-muted-foreground">— Bailleur inconnu —</div>
            )}
            {tousProprietaires.map((p) => (
              <div key={p.id}>
                <div className="font-semibold">{nomBailleur(p)}</div>
                {p.type === 'MORALE' && p.entreprise && p.nom !== p.entreprise && (
                  <div className="text-xs text-muted-foreground">Représenté par {p.nom}</div>
                )}
                <div>{p.adresse}</div>
                {p.complementAdresse && <div>{p.complementAdresse}</div>}
                <div>
                  {p.codePostal} {p.ville}
                </div>
                {p.pays && p.pays !== 'France' && <div>{p.pays}</div>}
              </div>
            ))}
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold tracking-tight">QUITTANCE</div>
            <div className="text-lg font-semibold text-muted-foreground">DE LOYER</div>
            <div className="mt-2 text-xs text-muted-foreground">
              Émise le {formatDate(q.dateGeneration)}
            </div>
          </div>
        </header>

        <section className="mb-8 grid grid-cols-2 gap-6">
          <div>
            <div className="text-xs font-semibold uppercase text-muted-foreground">
              Locataire
            </div>
            {principal ? (
              <>
                <div className="font-medium">{nomLocataire(principal)}</div>
                {l && l.tousLocataires.length > 1 && (
                  <ul className="text-xs text-muted-foreground">
                    {l.tousLocataires
                      .filter((x) => x.id !== principal.id)
                      .map((x) => (
                        <li key={x.id}>et {nomLocataire(x)}</li>
                      ))}
                  </ul>
                )}
              </>
            ) : (
              <div className="italic text-muted-foreground">— Locataire inconnu —</div>
            )}
            {l && (
              <div className="mt-2 text-xs text-muted-foreground">
                <div>{l.bienAdresse}</div>
                {l.bienComplementAdresse && <div>{l.bienComplementAdresse}</div>}
                <div>
                  {l.bienCodePostal} {l.bienVille}
                </div>
              </div>
            )}
          </div>
          <div className="rounded-md bg-muted/40 p-4">
            <div className="text-xs font-semibold uppercase text-muted-foreground">Période</div>
            <div className="text-lg font-semibold">{periode}</div>
            <div className="mt-3 text-xs font-semibold uppercase text-muted-foreground">
              Montant total
            </div>
            <div className="text-2xl font-bold">{formatEuro(q.montantTotal)}</div>
            <div className="mt-2 text-xs text-muted-foreground">
              dont loyer hors charges : {formatEuro(q.montantLoyer)}
            </div>
            <div className="text-xs text-muted-foreground">
              dont charges : {formatEuro(q.montantCharges)}
            </div>
          </div>
        </section>

        <section className="mb-8 leading-relaxed">
          <p>
            {tousProprietaires.length > 1 ? 'Nous soussignés ' : 'Je soussigné(e) '}
            <span className="font-medium">{nomsBailleurs}</span>,{' '}
            {tousProprietaires.length > 1 ? 'bailleurs' : 'bailleur'} du logement désigné
            ci-dessus, {tousProprietaires.length > 1 ? 'reconnaissons' : 'reconnais'} avoir reçu
            de <span className="font-medium">{nomsLocataires}</span> la somme de{' '}
            <span className="font-medium">{formatEuro(q.montantTotal)}</span> au titre du loyer
            et des charges de la période <span className="font-medium">{periode}</span>.
          </p>
          <p className="mt-3">
            La présente quittance vaut reçu pour la somme indiquée. Elle annule tous les reçus qui
            auraient pu être donnés précédemment pour la même période en cas de paiements
            fractionnés.
          </p>
        </section>

        <section className="mt-12">
          <div className="flex items-start gap-6">
            <div className="flex-shrink-0">
              <div className="text-xs text-muted-foreground">Fait à</div>
              <div className="border-b border-foreground/40 pb-1 pr-12">
                {bailleurPrincipal?.ville ?? '—'}
              </div>
              <div className="mt-3 text-xs text-muted-foreground">le</div>
              <div className="border-b border-foreground/40 pb-1 pr-12">
                {formatDate(q.dateGeneration)}
              </div>
            </div>
            <div className="flex-1">
              <div className="mb-2 text-xs text-muted-foreground">
                {tousProprietaires.length > 1
                  ? 'Signatures des bailleurs'
                  : 'Signature du bailleur'}
              </div>
              <div
                className={
                  tousProprietaires.length > 1
                    ? 'grid grid-cols-2 gap-4'
                    : 'grid grid-cols-1 gap-4'
                }
              >
                {tousProprietaires.length === 0 ? (
                  <div className="h-20 border-b border-foreground/40" />
                ) : (
                  tousProprietaires.map((p) => (
                    <div key={p.id} className="space-y-1">
                      <div className="h-20 border-b border-foreground/40 p-1">
                        {p.signatureDataUrl ? (
                          <img
                            src={p.signatureDataUrl}
                            alt={`Signature de ${nomBailleur(p)}`}
                            className="h-full max-h-20 object-contain"
                          />
                        ) : null}
                      </div>
                      <div className="text-[10px] text-muted-foreground">{nomBailleur(p)}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>

        <footer className="mt-12 border-t pt-4 text-center text-[10px] text-muted-foreground">
          Document généré le {formatDate(q.dateGeneration)} — Quittance n° {q.id.slice(0, 8)}
        </footer>
      </div>
    </>
  );
}
