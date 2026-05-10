import { Link, Outlet, createFileRoute, redirect, useRouter } from '@tanstack/react-router';
import { Building, Building2, Home, LogOut, ShieldCheck, UserCircle, Users } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { sessionQueryOptions, signOut, useSession } from '@/lib/auth';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ context, location }) => {
    const session = await context.queryClient.ensureQueryData(sessionQueryOptions);
    if (!session) {
      throw redirect({
        to: '/login',
        search: { redirect: location.href },
      });
    }
  },
  component: AuthenticatedLayout,
});

const navItems = [
  { to: '/', label: 'Tableau de bord', icon: Home, exact: true },
  { to: '/proprietaires', label: 'Propriétaires', icon: Users, exact: false },
  { to: '/biens', label: 'Biens', icon: Building2, exact: false },
  { to: '/locataires', label: 'Locataires', icon: UserCircle, exact: false },
  { to: '/garants', label: 'Garants', icon: ShieldCheck, exact: false },
] as const;

function AuthenticatedLayout() {
  const router = useRouter();
  const { data: session } = useSession();

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success('Déconnexion réussie');
      await router.invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erreur de déconnexion');
    }
  };

  return (
    <div className="min-h-screen">
      <header className="border-b bg-background">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2 font-semibold">
              <Building className="h-5 w-5" />
              Gestion locative
            </Link>
            <nav className="flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    activeOptions={{ exact: item.exact }}
                    className={cn(
                      'inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
                    )}
                    activeProps={{
                      className: 'bg-accent text-accent-foreground',
                    }}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{session?.user.email}</span>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4" />
              Déconnexion
            </Button>
          </div>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
