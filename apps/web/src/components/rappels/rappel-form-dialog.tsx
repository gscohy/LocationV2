import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, Loader2, Send } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import {
  PREVIENT_GARANTS,
  TYPE_RAPPEL_LABEL,
  buildTemplate,
} from '@/components/rappels/rappel-templates';
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
import { useCreateCharge } from '@/lib/db/charges';
import { type Loyer } from '@/lib/db/loyers';
import { useParametresSmtp } from '@/lib/db/parametres-smtp';
import {
  useCreateRappel,
  type ModeEnvoi,
  type TypeRappel,
} from '@/lib/db/rappels';
import { supabase } from '@/lib/supabase';

const SELECT_CLASS =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

const TYPES_ORDONNES: TypeRappel[] = [
  'RAPPEL_AMIABLE',
  'RELANCE',
  'MISE_EN_DEMEURE',
  'COMMANDEMENT_PAYER',
  'ASSIGNATION',
];

const MODES_ENVOI: { value: ModeEnvoi; label: string }[] = [
  { value: 'EMAIL', label: 'Email' },
  { value: 'COURRIER_SIMPLE', label: 'Courrier simple' },
  { value: 'LRAR', label: 'Lettre recommandée AR' },
  { value: 'HUISSIER', label: 'Huissier' },
  { value: 'MAIN_PROPRE', label: 'Remise en main propre' },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loyer: Loyer | undefined;
}

interface GarantInfo {
  id: string;
  prenom: string;
  nom: string;
  email: string;
}

export function RappelFormDialog({ open, onOpenChange, loyer }: Props) {
  const create = useCreateRappel();
  const createCharge = useCreateCharge();
  const { data: smtp } = useParametresSmtp();
  const queryClient = useQueryClient();

  const [type, setType] = useState<TypeRappel>('RAPPEL_AMIABLE');
  const [destinatairesTo, setDestinatairesTo] = useState('');
  const [destinatairesCc, setDestinatairesCc] = useState('');
  const [destinatairesBcc, setDestinatairesBcc] = useState('');
  const [inclureGarants, setInclureGarants] = useState(false);
  const [sujet, setSujet] = useState('');
  const [contenu, setContenu] = useState('');
  const [modeEnvoi, setModeEnvoi] = useState<ModeEnvoi>('EMAIL');
  const [fraisEngages, setFraisEngages] = useState('');
  const [commentaires, setCommentaires] = useState('');
  const [sending, setSending] = useState(false);

  // Garants liés aux locataires du contrat de ce loyer.
  const garantsQuery = useQuery({
    queryKey: ['rappel-garants-by-loyer', loyer?.id ?? ''],
    enabled: open && Boolean(loyer?.contrat?.id),
    queryFn: async (): Promise<GarantInfo[]> => {
      if (!loyer?.contrat?.id) return [];
      // contrat → contrat_locataires → locataires → locataire_garants → garants
      const { data, error } = await supabase
        .from('contrat_locataires')
        .select(
          'locataires(locataire_garants(garants(id, prenom, nom, email)))',
        )
        .eq('contrat_id', loyer.contrat.id);
      if (error) throw error;
      type Row = {
        locataires: {
          locataire_garants: Array<{
            garants: { id: string; prenom: string; nom: string; email: string } | null;
          }>;
        } | null;
      };
      const ids = new Set<string>();
      const out: GarantInfo[] = [];
      for (const row of (data ?? []) as unknown as Row[]) {
        for (const lg of row.locataires?.locataire_garants ?? []) {
          if (lg.garants && !ids.has(lg.garants.id)) {
            ids.add(lg.garants.id);
            out.push(lg.garants);
          }
        }
      }
      return out;
    },
  });

  // Locataires (déjà dans loyer.contrat) — on va aussi récupérer leurs emails
  // depuis un fetch ciblé car loyer.contrat.locatairePrincipalLabel ne porte pas l'email.
  const locatairesQuery = useQuery({
    queryKey: ['rappel-locataires-by-loyer', loyer?.id ?? ''],
    enabled: open && Boolean(loyer?.contrat?.id),
    queryFn: async () => {
      if (!loyer?.contrat?.id) return [] as { id: string; nom: string; prenom: string; email: string | null }[];
      const { data, error } = await supabase
        .from('contrat_locataires')
        .select('locataires(id, nom, prenom, email)')
        .eq('contrat_id', loyer.contrat.id);
      if (error) throw error;
      type Row = { locataires: { id: string; nom: string; prenom: string; email: string | null } | null };
      return ((data ?? []) as unknown as Row[])
        .map((r) => r.locataires)
        .filter((x): x is NonNullable<Row['locataires']> => x !== null);
    },
  });

  // Propriétaires du bien — pour le Bcc systématique (règle d'or).
  const proprietairesQuery = useQuery({
    queryKey: ['rappel-proprietaires-by-loyer', loyer?.id ?? ''],
    enabled: open && Boolean(loyer?.contrat?.id),
    queryFn: async () => {
      if (!loyer?.contrat?.id) return [] as { id: string; email: string }[];
      const { data: contrat, error: errContrat } = await supabase
        .from('contrats')
        .select('bien_id')
        .eq('id', loyer.contrat.id)
        .maybeSingle();
      if (errContrat) throw errContrat;
      if (!contrat) return [];
      const bienId = (contrat as { bien_id: string }).bien_id;
      const { data, error } = await supabase
        .from('bien_proprietaires')
        .select('proprietaires(id, email)')
        .eq('bien_id', bienId);
      if (error) throw error;
      type Row = { proprietaires: { id: string; email: string } | null };
      return ((data ?? []) as unknown as Row[])
        .map((r) => r.proprietaires)
        .filter((x): x is NonNullable<Row['proprietaires']> => x !== null);
    },
  });

  const garants = useMemo(() => garantsQuery.data ?? [], [garantsQuery.data]);
  const locataires = useMemo(() => locatairesQuery.data ?? [], [locatairesQuery.data]);
  const proprietaires = useMemo(() => proprietairesQuery.data ?? [], [proprietairesQuery.data]);

  // Dédup helper.
  const dedup = (arr: (string | null | undefined)[]) =>
    Array.from(
      new Set(
        arr
          .filter((e): e is string => Boolean(e))
          .map((e) => e.trim().toLowerCase())
          .filter((e) => e !== ''),
      ),
    );

  // Reset à l'ouverture
  useEffect(() => {
    if (!open) return;
    setType('RAPPEL_AMIABLE');
    setInclureGarants(false);
    setModeEnvoi('EMAIL');
    setFraisEngages('');
    setCommentaires('');
  }, [open]);

  // Pré-remplissage destinataires & template à chaque changement de type/option
  useEffect(() => {
    if (!open || !loyer) return;

    const emailsLoc = dedup(locataires.map((l) => l.email));
    setDestinatairesTo(emailsLoc.join(', '));

    const emailsGarants = dedup(garants.map((g) => g.email));
    setDestinatairesCc(inclureGarants ? emailsGarants.join(', ') : '');

    // Règle d'or : tous les propriétaires en Bcc systématiquement.
    const emailsProprios = dedup(proprietaires.map((p) => p.email));
    setDestinatairesBcc(emailsProprios.join(', '));

    // Template
    const locataireNom =
      locataires.length > 0
        ? new Intl.ListFormat('fr', { style: 'long', type: 'conjunction' }).format(
            locataires.map((l) => `${l.prenom} ${l.nom}`),
          )
        : 'Locataire';
    const principal = loyer.contrat?.locatairePrincipalLabel ?? '';
    const tpl = buildTemplate(type, {
      locataireNom: locataires.length > 0 ? locataireNom : principal,
      bailleurNom: 'Le bailleur',
      bienAdresse: loyer.contrat?.bienAdresse ?? '',
      bienVille: loyer.contrat?.bienVille ?? '',
      periode: { mois: loyer.mois, annee: loyer.annee },
      montantDu: loyer.montantTotal,
      montantPaye: loyer.montantPaye,
      soldeRestant: loyer.soldeRestant,
      dateEcheance: loyer.dateEcheance,
    });
    setSujet(tpl.sujet);
    setContenu(tpl.contenu);
  }, [open, type, inclureGarants, loyer, locataires, garants, proprietaires]);

  // Quand on change de type, recommander d'inclure les garants au-delà de MED.
  useEffect(() => {
    if (!open) return;
    setInclureGarants(PREVIENT_GARANTS[type]);
  }, [type, open]);

  const peutEnvoyerEmail = modeEnvoi === 'EMAIL' && smtp !== null && smtp !== undefined;

  const splitEmails = (s: string) =>
    s.split(/[,;]/).map((e) => e.trim()).filter(Boolean);

  /**
   * Crée automatiquement une charge "Frais procédure" si frais > 0
   * ET que le rappel est marqué envoyé. Utilise le bien lié au loyer.
   */
  const creerChargeFrais = async (rappelId: string) => {
    if (!loyer?.contrat?.bienId) return;
    const montant = Number(fraisEngages);
    if (!fraisEngages.trim() || !montant || montant <= 0) return;
    try {
      await createCharge.mutateAsync({
        bienId: loyer.contrat.bienId,
        categorie: 'FRAIS_PROCEDURE',
        description: `Frais ${TYPE_RAPPEL_LABEL[type].toLowerCase()} — Loyer ${loyer.mois}/${loyer.annee}`,
        montantTtc: montant,
        date: new Date().toISOString().slice(0, 10),
        datePaiement: new Date().toISOString().slice(0, 10),
        type: 'PONCTUELLE',
        recuperable: false,
        deductible: true,
        commentaires: `Lié au rappel ${rappelId.slice(0, 8)}`,
      });
    } catch (err) {
      // Ne bloque pas l'enregistrement du rappel : juste un toast informatif.
      toast.error(
        `Rappel enregistré, mais erreur lors de la création de la charge : ${err instanceof Error ? err.message : 'inconnue'}`,
      );
    }
  };

  const handleEnregistrer = async (marquerEnvoye: boolean) => {
    if (!loyer) return;
    if (!sujet.trim() || !contenu.trim()) {
      toast.error('Sujet et contenu requis');
      return;
    }
    const toList = splitEmails(destinatairesTo);
    const ccList = splitEmails(destinatairesCc);
    const bccList = splitEmails(destinatairesBcc);
    const tousDestinataires = [...toList, ...ccList, ...bccList];
    if (tousDestinataires.length === 0) {
      toast.error('Au moins un destinataire requis');
      return;
    }
    const destinatairesStr = [
      toList.join(', '),
      ccList.length > 0 ? `cc: ${ccList.join(', ')}` : '',
      bccList.length > 0 ? `bcc: ${bccList.join(', ')}` : '',
    ]
      .filter(Boolean)
      .join(' | ');
    try {
      const rappelId = await create.mutateAsync({
        loyerId: loyer.id,
        type,
        destinataires: destinatairesStr,
        sujet: sujet.trim(),
        contenu,
        modeEnvoi,
        fraisEngages: fraisEngages.trim() === '' ? undefined : Number(fraisEngages),
        commentaires: commentaires.trim() === '' ? undefined : commentaires.trim(),
        marquerEnvoye,
      });
      if (marquerEnvoye) await creerChargeFrais(rappelId);
      toast.success(marquerEnvoye ? 'Rappel enregistré comme envoyé' : 'Rappel enregistré');
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    }
  };

  const handleEnvoyerMaintenant = async () => {
    if (!loyer || !smtp) {
      toast.error('Configuration SMTP requise (Paramètres)');
      return;
    }
    if (!sujet.trim() || !contenu.trim()) {
      toast.error('Sujet et contenu requis');
      return;
    }
    const toList = splitEmails(destinatairesTo);
    const ccList = splitEmails(destinatairesCc);
    const bccList = splitEmails(destinatairesBcc);
    if (toList.length === 0) {
      toast.error('Au moins un destinataire principal requis');
      return;
    }

    setSending(true);
    try {
      // 1. Envoi via Edge Function send-rappel-email
      const { error: fnError } = await supabase.functions.invoke('send-rappel-email', {
        body: { to: toList, cc: ccList, bcc: bccList, subject: sujet, body: contenu },
      });
      if (fnError) throw fnError;

      const destinatairesStr = [
        toList.join(', '),
        ccList.length > 0 ? `cc: ${ccList.join(', ')}` : '',
        bccList.length > 0 ? `bcc: ${bccList.join(', ')}` : '',
      ]
        .filter(Boolean)
        .join(' | ');

      // 2. Création du rappel marqué envoyé
      const rappelId = await create.mutateAsync({
        loyerId: loyer.id,
        type,
        destinataires: destinatairesStr,
        sujet: sujet.trim(),
        contenu,
        modeEnvoi: 'EMAIL',
        fraisEngages: fraisEngages.trim() === '' ? undefined : Number(fraisEngages),
        commentaires: commentaires.trim() === '' ? undefined : commentaires.trim(),
        marquerEnvoye: true,
      });

      // 3. Si frais engagés > 0, créer la charge correspondante
      await creerChargeFrais(rappelId);

      toast.success('Rappel envoyé et enregistré');
      void queryClient.invalidateQueries({ queryKey: ['rappels'] });
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de l’envoi');
    } finally {
      setSending(false);
    }
  };

  const isSubmitting = create.isPending || sending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouveau rappel de loyer</DialogTitle>
          <DialogDescription>
            {loyer ? (
              <>
                Loyer {loyer.mois}/{loyer.annee} — {loyer.contrat?.bienAdresse ?? '?'} — Solde
                dû : <strong>{loyer.soldeRestant.toFixed(2)} €</strong>
              </>
            ) : (
              'Aucun loyer sélectionné'
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="r-type">Type de rappel</Label>
              <select
                id="r-type"
                value={type}
                onChange={(e) => setType(e.target.value as TypeRappel)}
                disabled={isSubmitting}
                className={SELECT_CLASS}
              >
                {TYPES_ORDONNES.map((t) => (
                  <option key={t} value={t}>
                    {TYPE_RAPPEL_LABEL[t]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="r-mode">Mode d&apos;envoi</Label>
              <select
                id="r-mode"
                value={modeEnvoi}
                onChange={(e) => setModeEnvoi(e.target.value as ModeEnvoi)}
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
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="r-to">Destinataires (locataires)</Label>
            <Input
              id="r-to"
              value={destinatairesTo}
              onChange={(e) => setDestinatairesTo(e.target.value)}
              disabled={isSubmitting}
              placeholder="email1@x.fr, email2@x.fr"
            />
          </div>

          {garants.length > 0 && (
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={inclureGarants}
                  onChange={(e) => setInclureGarants(e.target.checked)}
                  disabled={isSubmitting}
                />
                Inclure {garants.length} garant{garants.length > 1 ? 's' : ''} en Cc (
                {garants.map((g) => `${g.prenom} ${g.nom}`).join(', ')})
              </label>
              {inclureGarants && (
                <Input
                  value={destinatairesCc}
                  onChange={(e) => setDestinatairesCc(e.target.value)}
                  disabled={isSubmitting}
                  placeholder="garant@x.fr"
                />
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="r-bcc">Cci — copie cachée (propriétaires)</Label>
            <Input
              id="r-bcc"
              value={destinatairesBcc}
              onChange={(e) => setDestinatairesBcc(e.target.value)}
              disabled={isSubmitting}
              placeholder="proprio@x.fr"
            />
            <p className="text-xs text-muted-foreground">
              Pré-rempli avec tous les propriétaires du bien — invisible par le locataire et les
              garants.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="r-sujet">Sujet</Label>
            <Input
              id="r-sujet"
              value={sujet}
              onChange={(e) => setSujet(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="r-contenu">Contenu</Label>
            <textarea
              id="r-contenu"
              rows={14}
              value={contenu}
              onChange={(e) => setContenu(e.target.value)}
              disabled={isSubmitting}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="r-frais">Frais engagés (€, optionnel)</Label>
              <Input
                id="r-frais"
                type="number"
                step="0.01"
                min="0"
                value={fraisEngages}
                onChange={(e) => setFraisEngages(e.target.value)}
                disabled={isSubmitting}
                placeholder="ex. 5,80 pour un LRAR"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="r-commentaires">Commentaire interne</Label>
              <Input
                id="r-commentaires"
                value={commentaires}
                onChange={(e) => setCommentaires(e.target.value)}
                disabled={isSubmitting}
                placeholder="Pour mémoire (non envoyé)"
              />
            </div>
          </div>

          {!smtp && modeEnvoi === 'EMAIL' && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <strong>SMTP non configuré.</strong> Va dans Paramètres pour activer l&apos;envoi
              automatique. Tu peux quand même enregistrer ce rappel et l&apos;envoyer hors-app.
            </div>
          )}
        </div>

        <DialogFooter className="flex-wrap gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Annuler
          </Button>
          <Button
            variant="outline"
            onClick={() => handleEnregistrer(false)}
            disabled={isSubmitting}
          >
            Enregistrer brouillon
          </Button>
          <Button
            variant="outline"
            onClick={() => handleEnregistrer(true)}
            disabled={isSubmitting}
          >
            <CheckCircle className="h-4 w-4" />
            Marquer envoyé (hors-app)
          </Button>
          {peutEnvoyerEmail && (
            <Button onClick={handleEnvoyerMaintenant} disabled={isSubmitting}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Envoyer maintenant
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
