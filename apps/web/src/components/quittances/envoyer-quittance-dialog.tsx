import { useQueryClient } from '@tanstack/react-query';
import { Copy, Loader2, Mail, Send } from 'lucide-react';
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
import { useParametresSmtp } from '@/lib/db/parametres-smtp';
import {
  useMarkQuittanceEnvoyee,
  type ModeEnvoi,
  type Quittance,
} from '@/lib/db/quittances';
import { supabase } from '@/lib/supabase';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quittance: Quittance | undefined;
}

const formatEuro = (v: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v);

function defaultBody(q: Quittance | undefined): string {
  if (!q) return '';
  const locataires = q.loyer?.tousLocataires ?? [];
  const greeting =
    locataires.length === 0
      ? 'Bonjour,'
      : locataires.length === 1
        ? `Bonjour ${locataires[0]?.prenom ?? ''},`
        : 'Bonjour,';
  return [
    greeting,
    '',
    `Vous trouverez ci-joint la quittance de loyer pour la période ${q.periode}, d'un montant de ${formatEuro(q.montantTotal)} (dont ${formatEuro(q.montantCharges)} de charges).`,
    '',
    'Cette quittance vaut reçu pour la somme indiquée.',
    '',
    'Cordialement.',
  ].join('\n');
}

function defaultSubject(q: Quittance | undefined): string {
  if (!q) return '';
  return `Quittance de loyer — ${q.periode}`;
}

const SELECT_CLASS =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

const MODES_ENVOI: { value: ModeEnvoi; label: string }[] = [
  { value: 'EMAIL', label: 'Email' },
  { value: 'COURRIER_SIMPLE', label: 'Courrier simple' },
  { value: 'LRAR', label: 'Lettre recommandée AR' },
  { value: 'HUISSIER', label: 'Huissier' },
  { value: 'MAIN_PROPRE', label: 'Remise en main propre' },
];

export function EnvoyerQuittanceDialog({ open, onOpenChange, quittance }: Props) {
  const mark = useMarkQuittanceEnvoyee();
  const { data: smtpConfig } = useParametresSmtp();
  const queryClient = useQueryClient();

  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [mode, setMode] = useState<ModeEnvoi>('EMAIL');
  const [sending, setSending] = useState(false);

  // Pré-remplissage à l'ouverture (dédup des emails côté locataires & propriétaires).
  useEffect(() => {
    if (!open || !quittance) return;
    const dedup = (emails: (string | null | undefined)[]) =>
      Array.from(
        new Set(
          emails
            .filter((e): e is string => Boolean(e))
            .map((e) => e.trim().toLowerCase())
            .filter((e) => e !== ''),
        ),
      );
    const emailsLocataires = dedup(
      (quittance.loyer?.tousLocataires ?? []).map((l) => l.email),
    ).join(', ');
    // Règle d'or : propriétaires en Bcc (copie cachée), pas en Cc visible par le locataire.
    const emailsProprietaires = dedup(
      (quittance.loyer?.proprietaires ?? []).map((p) => p.email),
    ).join(', ');
    setTo(emailsLocataires);
    setCc('');
    setBcc(emailsProprietaires);
    setSubject(defaultSubject(quittance));
    setBody(defaultBody(quittance));
    setMode('EMAIL');
  }, [open, quittance]);

  const mailtoUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (cc.trim()) params.set('cc', cc.trim());
    if (bcc.trim()) params.set('bcc', bcc.trim());
    if (subject.trim()) params.set('subject', subject.trim());
    if (body.trim()) params.set('body', body);
    return `mailto:${encodeURIComponent(to.trim())}?${params.toString().replace(/\+/g, '%20')}`;
  }, [to, cc, bcc, subject, body]);

  const handleOpenMailClient = () => {
    if (!to.trim()) {
      toast.error('Au moins un destinataire requis');
      return;
    }
    window.location.href = mailtoUrl;
  };

  const handleCopyMessage = async () => {
    const txt = [
      `À : ${to}`,
      cc.trim() ? `Cc : ${cc}` : '',
      `Sujet : ${subject}`,
      '',
      body,
    ]
      .filter(Boolean)
      .join('\n');
    try {
      await navigator.clipboard.writeText(txt);
      toast.success('Message copié dans le presse-papiers');
    } catch {
      toast.error('Impossible de copier');
    }
  };

  const handleSendNow = async () => {
    if (!quittance) return;
    if (!smtpConfig) {
      toast.error('Configurez vos paramètres SMTP dans Paramètres avant d’envoyer.');
      return;
    }
    const toList = to.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
    if (toList.length === 0) {
      toast.error('Au moins un destinataire requis');
      return;
    }
    const ccList = cc.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
    const bccList = bcc.split(/[,;]/).map((s) => s.trim()).filter(Boolean);

    setSending(true);
    try {
      const { error } = await supabase.functions.invoke('send-quittance-email', {
        body: {
          quittanceId: quittance.id,
          to: toList,
          cc: ccList,
          bcc: bccList,
          subject,
          body,
        },
      });
      if (error) throw error;
      toast.success('Quittance envoyée avec succès');
      void queryClient.invalidateQueries({ queryKey: ['quittances'] });
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de l’envoi';
      toast.error(msg);
    } finally {
      setSending(false);
    }
  };

  const handleMarkEnvoyee = async () => {
    if (!quittance) return;
    const destinataires = [
      to.trim(),
      cc.trim() ? `cc: ${cc.trim()}` : '',
      bcc.trim() ? `bcc: ${bcc.trim()}` : '',
    ]
      .filter(Boolean)
      .join(' | ');
    try {
      await mark.mutateAsync({
        id: quittance.id,
        modeEnvoi: mode,
        destinataires: destinataires || undefined,
      });
      toast.success('Quittance marquée comme envoyée');
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    }
  };

  const isSubmitting = mark.isPending || sending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Envoyer la quittance</DialogTitle>
          <DialogDescription>
            Prévisualise le message et les destinataires. L&apos;envoi se fait via ton client mail
            par défaut. La quittance PDF est à joindre manuellement après impression.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="env-to">À (locataires)</Label>
            <Input
              id="env-to"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="email1@x.fr, email2@x.fr"
              disabled={isSubmitting}
            />
            <p className="text-xs text-muted-foreground">Plusieurs emails séparés par des virgules.</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="env-cc">Cc (visible par le locataire)</Label>
            <Input
              id="env-cc"
              value={cc}
              onChange={(e) => setCc(e.target.value)}
              placeholder="(vide par défaut)"
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="env-bcc">Cci — copie cachée (propriétaires)</Label>
            <Input
              id="env-bcc"
              value={bcc}
              onChange={(e) => setBcc(e.target.value)}
              placeholder="proprio@x.fr"
              disabled={isSubmitting}
            />
            <p className="text-xs text-muted-foreground">
              Pré-rempli avec tous les propriétaires du bien — invisible par le locataire.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="env-subject">Sujet</Label>
            <Input
              id="env-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="env-body">Message</Label>
            <textarea
              id="env-body"
              rows={9}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              disabled={isSubmitting}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="env-mode">Mode d&apos;envoi (pour traçabilité)</Label>
            <select
              id="env-mode"
              value={mode}
              onChange={(e) => setMode(e.target.value as ModeEnvoi)}
              disabled={isSubmitting}
              className={SELECT_CLASS}
            >
              {MODES_ENVOI.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {smtpConfig ? (
            <div className="rounded-md border border-green-200 bg-green-50 p-3 text-xs text-green-900">
              <strong>Envoi automatique disponible :</strong> via SMTP{' '}
              <code>{smtpConfig.host}</code> (compte <code>{smtpConfig.username}</code>). Le PDF
              est généré et joint automatiquement. Le bouton{' '}
              <em>Envoyer maintenant</em> ci-dessous fait tout.
            </div>
          ) : (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <strong>Aucun SMTP configuré.</strong> Va dans <em>Paramètres</em> pour saisir tes
              identifiants Orange/Gmail, sinon utilise <em>Ouvrir mon client mail</em> pour
              déléguer l&apos;envoi à ton client mail local (PDF à joindre manuellement).
            </div>
          )}
        </div>

        <DialogFooter className="flex-wrap gap-2">
          <Button variant="outline" onClick={handleCopyMessage} disabled={isSubmitting}>
            <Copy className="h-4 w-4" />
            Copier
          </Button>
          <Button variant="outline" onClick={handleOpenMailClient} disabled={isSubmitting}>
            <Mail className="h-4 w-4" />
            Client mail local
          </Button>
          <Button variant="outline" onClick={handleMarkEnvoyee} disabled={isSubmitting}>
            {mark.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Marquer envoyée
          </Button>
          {smtpConfig && (
            <Button onClick={handleSendNow} disabled={isSubmitting}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Envoyer maintenant
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
