import { CheckCircle, Clock } from 'lucide-react';

import {
  TYPE_RAPPEL_COLOR,
  TYPE_RAPPEL_LABEL,
} from '@/components/rappels/rappel-templates';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { type Rappel } from '@/lib/db/rappels';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rappel: Rappel | undefined;
}

const MODES_ENVOI_LABEL: Record<string, string> = {
  EMAIL: 'Email',
  COURRIER_SIMPLE: 'Courrier simple',
  LRAR: 'Lettre recommandée AR',
  HUISSIER: 'Huissier',
  MAIN_PROPRE: 'Remise en main propre',
};

const formatEuro = (v: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v);

const formatDate = (iso: string | undefined) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
};

/**
 * Parse les destinataires stockés au format "to: a, b | cc: c | bcc: d".
 * Si le format n'est pas reconnu, retourne tout dans le champ To.
 */
function parseDestinataires(s: string): { to: string; cc: string; bcc: string } {
  const result = { to: '', cc: '', bcc: '' };
  if (!s) return result;
  if (s.includes('|') || s.includes('cc:') || s.includes('bcc:')) {
    const parts = s.split('|').map((p) => p.trim());
    for (const part of parts) {
      const lower = part.toLowerCase();
      if (lower.startsWith('cc:')) result.cc = part.slice(3).trim();
      else if (lower.startsWith('bcc:')) result.bcc = part.slice(4).trim();
      else result.to = part;
    }
  } else {
    result.to = s;
  }
  return result;
}

export function RappelViewDialog({ open, onOpenChange, rappel }: Props) {
  if (!rappel) return null;
  const dest = parseDestinataires(rappel.destinataires);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Détail du rappel</DialogTitle>
          <DialogDescription>
            <span
              className={cn(
                'mr-2 inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                TYPE_RAPPEL_COLOR[rappel.type],
              )}
            >
              {TYPE_RAPPEL_LABEL[rappel.type]}
            </span>
            {rappel.envoye ? (
              <span className="inline-flex items-center gap-1 text-xs text-green-700">
                <CheckCircle className="h-3 w-3" />
                Envoyé le {formatDate(rappel.dateEnvoi)} —{' '}
                {MODES_ENVOI_LABEL[rappel.modeEnvoi] ?? rappel.modeEnvoi}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                Brouillon
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          {rappel.loyer && (
            <div className="rounded-md border bg-muted/30 p-3 text-xs">
              <div className="font-medium">
                Loyer concerné : {rappel.loyer.mois}/{rappel.loyer.annee} —{' '}
                {rappel.loyer.bienAdresse}
              </div>
              <div className="text-muted-foreground">
                {rappel.loyer.bienCodePostal} {rappel.loyer.bienVille} —{' '}
                {rappel.loyer.locatairePrincipalLabel} — solde restant{' '}
                {formatEuro(rappel.loyer.soldeRestant)}
              </div>
            </div>
          )}

          <div className="space-y-1.5 rounded-md border p-3">
            <div className="grid grid-cols-[80px_1fr] gap-1 text-xs">
              <span className="text-muted-foreground">À</span>
              <span className="break-all">{dest.to || '—'}</span>
              {dest.cc && (
                <>
                  <span className="text-muted-foreground">Cc</span>
                  <span className="break-all">{dest.cc}</span>
                </>
              )}
              {dest.bcc && (
                <>
                  <span className="text-muted-foreground">Cci</span>
                  <span className="break-all">{dest.bcc}</span>
                </>
              )}
              <span className="text-muted-foreground">Sujet</span>
              <span className="font-medium">{rappel.sujet}</span>
            </div>
          </div>

          <div className="rounded-md border bg-white p-4">
            <div className="whitespace-pre-wrap font-mono text-xs leading-relaxed">
              {rappel.contenu}
            </div>
          </div>

          {(rappel.fraisEngages !== undefined || rappel.commentaires) && (
            <div className="rounded-md border bg-muted/30 p-3 text-xs">
              {rappel.fraisEngages !== undefined && (
                <div>
                  <span className="text-muted-foreground">Frais engagés :</span>{' '}
                  <span className="font-medium">{formatEuro(rappel.fraisEngages)}</span>
                </div>
              )}
              {rappel.commentaires && (
                <div className="mt-1">
                  <span className="text-muted-foreground">Commentaire interne :</span>{' '}
                  <span className="italic">{rappel.commentaires}</span>
                </div>
              )}
            </div>
          )}

          <div className="text-[10px] text-muted-foreground">
            Créé le {formatDate(rappel.createdAt)} — id {rappel.id.slice(0, 8)}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
