import { Link, createFileRoute } from '@tanstack/react-router';
import { ArrowRight, Building2, FileText, ShieldCheck, UserCircle, Users } from 'lucide-react';

export const Route = createFileRoute('/_authenticated/')({
  component: HomePage,
});

const cards = [
  {
    to: '/proprietaires' as const,
    title: 'Propriétaires',
    description: 'Personnes physiques et SCI détenant des biens.',
    icon: Users,
  },
  {
    to: '/biens' as const,
    title: 'Biens immobiliers',
    description: 'Logements, locaux, parkings, en propre ou en indivision.',
    icon: Building2,
  },
  {
    to: '/locataires' as const,
    title: 'Locataires',
    description: 'Personnes occupant un bien, fiches d\'identité et revenus.',
    icon: UserCircle,
  },
  {
    to: '/garants' as const,
    title: 'Garants',
    description: 'Cautions physiques, Visale, garantie bancaire…',
    icon: ShieldCheck,
  },
  {
    to: '/contrats' as const,
    title: 'Contrats de bail',
    description: 'Baux liant un bien à des locataires, IRL, clauses, résiliation.',
    icon: FileText,
  },
];

function HomePage() {
  return (
    <div className="container py-12">
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">Tableau de bord</h1>
          <p className="text-muted-foreground">
            Modules disponibles. Loyers et paiements arrivent ensuite.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.to}
                to={card.to}
                className="group rounded-lg border p-6 transition-colors hover:bg-accent"
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <h2 className="font-semibold">{card.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{card.description}</p>
                <div className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary">
                  Ouvrir
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
