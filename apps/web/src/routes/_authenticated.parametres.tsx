import { parametresSmtpSchema, type ParametresSmtpInput } from '@gl/shared';
import { createFileRoute } from '@tanstack/react-router';
import { Info, Loader2, Save } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useParametresSmtp, useUpsertParametresSmtp } from '@/lib/db/parametres-smtp';

export const Route = createFileRoute('/_authenticated/parametres')({
  component: ParametresPage,
});

interface FormValues {
  host: string;
  port: string;
  username: string;
  password: string;
  secure: boolean;
  fromEmail: string;
  fromName: string;
}

const emptyDefaults: FormValues = {
  host: 'smtp.orange.fr',
  port: '465',
  username: '',
  password: '',
  secure: true,
  fromEmail: '',
  fromName: 'Gestion locative',
};

function ParametresPage() {
  const { data, isPending } = useParametresSmtp();
  const upsert = useUpsertParametresSmtp();

  const form = useForm<FormValues>({
    defaultValues: emptyDefaults,
  });

  useEffect(() => {
    if (data) {
      form.reset({
        host: data.host,
        port: String(data.port),
        username: data.username,
        password: data.password,
        secure: data.secure,
        fromEmail: data.fromEmail,
        fromName: data.fromName,
      });
    }
  }, [data, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    const input: ParametresSmtpInput = {
      host: values.host.trim(),
      port: Number(values.port),
      username: values.username.trim(),
      password: values.password,
      secure: values.secure,
      fromEmail: values.fromEmail.trim(),
      fromName: values.fromName.trim(),
    };
    const parsed = parametresSmtpSchema.safeParse(input);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Formulaire invalide');
      return;
    }
    try {
      await upsert.mutateAsync(parsed.data);
      toast.success('Paramètres SMTP enregistrés');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    }
  });

  const isSubmitting = form.formState.isSubmitting || upsert.isPending;

  return (
    <div className="container max-w-2xl py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Paramètres</h1>
        <p className="text-sm text-muted-foreground">
          Configuration de la boîte mail utilisée pour envoyer les quittances aux locataires.
        </p>
      </div>

      <div className="mb-4 flex items-start gap-3 rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
        <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <div>
          <div className="font-medium">Conseils Orange / Gmail</div>
          <ul className="mt-1 list-inside list-disc space-y-0.5">
            <li>
              <strong>Orange :</strong> hôte <code>smtp.orange.fr</code>, port 465 (SSL) ou 587
              (STARTTLS). Utilisateur = email complet. Mot de passe = mot de passe applicatif
              généré depuis l&apos;espace client Orange.
            </li>
            <li>
              <strong>Gmail :</strong> hôte <code>smtp.gmail.com</code>, port 465. Active la
              double authentification puis crée un « mot de passe d&apos;application » sur{' '}
              <em>myaccount.google.com/apppasswords</em>.
            </li>
            <li>
              Le mot de passe est stocké en BDD avec une RLS qui te le réserve. Préfère un compte
              dédié à la gestion plutôt que ton compte personnel.
            </li>
          </ul>
        </div>
      </div>

      {isPending ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="host">Hôte SMTP *</Label>
              <Input
                id="host"
                placeholder="smtp.orange.fr"
                disabled={isSubmitting}
                {...form.register('host')}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="port">Port *</Label>
              <Input
                id="port"
                type="number"
                placeholder="465"
                disabled={isSubmitting}
                {...form.register('port')}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="username">Utilisateur (email)</Label>
              <Input
                id="username"
                placeholder="gestion@orange.fr"
                autoComplete="username"
                disabled={isSubmitting}
                {...form.register('username')}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Mot de passe *</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                disabled={isSubmitting}
                {...form.register('password')}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              disabled={isSubmitting}
              {...form.register('secure')}
            />
            <span>
              Connexion sécurisée SSL/TLS (cochée pour port 465, décochée pour port 587 STARTTLS)
            </span>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="fromEmail">Email expéditeur *</Label>
              <Input
                id="fromEmail"
                type="email"
                placeholder="gestion@orange.fr"
                disabled={isSubmitting}
                {...form.register('fromEmail')}
              />
              <p className="text-xs text-muted-foreground">
                Souvent identique à l&apos;utilisateur. Doit être autorisé par le serveur.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fromName">Nom affiché *</Label>
              <Input
                id="fromName"
                placeholder="Gestion locative"
                disabled={isSubmitting}
                {...form.register('fromName')}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Enregistrer
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
