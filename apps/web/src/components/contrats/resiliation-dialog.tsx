import type { ResilierContratInput } from '@gl/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { useForm, type FieldErrors } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

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
import { type Contrat, useResilierContrat } from '@/lib/db/contrats';

const optionalNonNeg = z
  .string()
  .trim()
  .refine((v) => v === '' || (!isNaN(Number(v)) && Number(v) >= 0), 'Doit être >= 0');

const formSchema = z.object({
  dateDemandeResiliation: z.string().trim().min(1, 'Date de demande requise'),
  auteurResiliation: z.enum(['BAILLEUR', 'LOCATAIRE', 'JUDICIAIRE']),
  motifResiliation: z.enum([
    'VENTE',
    'REPRISE',
    'CONGE_LOCATAIRE',
    'IMPAYE',
    'TROUBLE_VOISINAGE',
    'AUTRE',
  ]),
  dateFinReelle: z.string().trim().min(1, 'Date de fin réelle requise'),
  preavisRespect: z.boolean(),
  dateRestitutionDg: z.string().trim(),
  montantDgRestitue: optionalNonNeg,
  commentairesResiliation: z.string().trim(),
});

type FormValues = z.infer<typeof formSchema>;

const SELECT_BASE =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contrat: Contrat | undefined;
};

export function ResiliationDialog({ open, onOpenChange, contrat }: Props) {
  const resiliateMutation = useResilierContrat();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      dateDemandeResiliation: '',
      auteurResiliation: 'LOCATAIRE',
      motifResiliation: 'CONGE_LOCATAIRE',
      dateFinReelle: '',
      preavisRespect: true,
      dateRestitutionDg: '',
      montantDgRestitue: '',
      commentairesResiliation: '',
    },
  });

  useEffect(() => {
    if (open && contrat) {
      form.reset({
        dateDemandeResiliation: contrat.dateDemandeResiliation ?? '',
        auteurResiliation: contrat.auteurResiliation ?? 'LOCATAIRE',
        motifResiliation: contrat.motifResiliation ?? 'CONGE_LOCATAIRE',
        dateFinReelle: contrat.dateFinReelle ?? '',
        preavisRespect: contrat.preavisRespect ?? true,
        dateRestitutionDg: contrat.dateRestitutionDg ?? '',
        montantDgRestitue:
          contrat.montantDgRestitue !== undefined ? String(contrat.montantDgRestitue) : '',
        commentairesResiliation: contrat.commentairesResiliation ?? '',
      });
    }
  }, [open, contrat, form]);

  const onValid = async (values: FormValues) => {
    if (!contrat) return;
    try {
      const input: ResilierContratInput = {
        dateDemandeResiliation: new Date(values.dateDemandeResiliation),
        auteurResiliation: values.auteurResiliation,
        motifResiliation: values.motifResiliation,
        dateFinReelle: new Date(values.dateFinReelle),
        preavisRespect: values.preavisRespect,
        dateRestitutionDg:
          values.dateRestitutionDg.trim() === '' ? undefined : new Date(values.dateRestitutionDg),
        montantDgRestitue:
          values.montantDgRestitue.trim() === '' ? undefined : Number(values.montantDgRestitue),
        commentairesResiliation:
          values.commentairesResiliation.trim() === ''
            ? undefined
            : values.commentairesResiliation.trim(),
      };
      await resiliateMutation.mutateAsync({ id: contrat.id, input });
      toast.success('Contrat résilié');
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erreur inconnue');
    }
  };

  const onInvalid = (errors: FieldErrors<FormValues>) => {
    const first = Object.values(errors)[0];
    const msg = (first as { message?: string } | undefined)?.message;
    toast.error(msg ?? 'Formulaire invalide');
  };

  const onSubmit = form.handleSubmit(onValid, onInvalid);
  const isSubmitting = form.formState.isSubmitting;
  const errors = form.formState.errors;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Résilier le contrat</DialogTitle>
          <DialogDescription>
            Renseigne les conditions de fin du bail. Le statut passera à RESILIE.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="dateDemandeResiliation">Date demande *</Label>
              <Input
                id="dateDemandeResiliation"
                type="date"
                {...form.register('dateDemandeResiliation')}
              />
              {errors.dateDemandeResiliation && (
                <p className="text-xs text-destructive">{errors.dateDemandeResiliation.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dateFinReelle">Date fin réelle *</Label>
              <Input id="dateFinReelle" type="date" {...form.register('dateFinReelle')} />
              {errors.dateFinReelle && (
                <p className="text-xs text-destructive">{errors.dateFinReelle.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="auteurResiliation">À l'initiative de *</Label>
              <select
                id="auteurResiliation"
                {...form.register('auteurResiliation')}
                className={SELECT_BASE}
              >
                <option value="LOCATAIRE">Locataire</option>
                <option value="BAILLEUR">Bailleur</option>
                <option value="JUDICIAIRE">Décision judiciaire</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="motifResiliation">Motif *</Label>
              <select
                id="motifResiliation"
                {...form.register('motifResiliation')}
                className={SELECT_BASE}
              >
                <option value="CONGE_LOCATAIRE">Congé du locataire</option>
                <option value="VENTE">Vente du bien</option>
                <option value="REPRISE">Reprise par le bailleur</option>
                <option value="IMPAYE">Impayé</option>
                <option value="TROUBLE_VOISINAGE">Trouble de voisinage</option>
                <option value="AUTRE">Autre</option>
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...form.register('preavisRespect')} className="h-4 w-4" />
            Préavis respecté
          </label>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="dateRestitutionDg">Date restitution DG</Label>
              <Input
                id="dateRestitutionDg"
                type="date"
                {...form.register('dateRestitutionDg')}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="montantDgRestitue">Montant DG restitué (€)</Label>
              <Input
                id="montantDgRestitue"
                type="number"
                step="0.01"
                {...form.register('montantDgRestitue')}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="commentairesResiliation">Commentaires</Label>
            <textarea
              id="commentairesResiliation"
              rows={3}
              {...form.register('commentairesResiliation')}
              placeholder="Retenues sur DG, état du bien, contentieux…"
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" variant="destructive" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Résilier
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
