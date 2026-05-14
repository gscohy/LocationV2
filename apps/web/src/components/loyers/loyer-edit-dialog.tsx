import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
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
import { useUpdateLoyer, type Loyer } from '@/lib/db/loyers';

const formSchema = z.object({
  montantLoyer: z
    .string()
    .trim()
    .refine((v) => v !== '' && !isNaN(Number(v)) && Number(v) >= 0, 'Loyer >= 0'),
  montantCharges: z
    .string()
    .trim()
    .refine((v) => v !== '' && !isNaN(Number(v)) && Number(v) >= 0, 'Charges >= 0'),
  dateEcheance: z.string().trim().min(1, 'Date d’échéance requise'),
  commentaires: z.string().trim(),
});

type FormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loyer: Loyer | undefined;
}

export function LoyerEditDialog({ open, onOpenChange, loyer }: Props) {
  const update = useUpdateLoyer();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      montantLoyer: '',
      montantCharges: '',
      dateEcheance: '',
      commentaires: '',
    },
  });

  useEffect(() => {
    if (open && loyer) {
      form.reset({
        montantLoyer: String(loyer.montantLoyer),
        montantCharges: String(loyer.montantCharges),
        dateEcheance: loyer.dateEcheance,
        commentaires: loyer.commentaires ?? '',
      });
    }
  }, [open, loyer, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    if (!loyer) return;
    try {
      await update.mutateAsync({
        id: loyer.id,
        input: {
          montantLoyer: Number(values.montantLoyer),
          montantCharges: Number(values.montantCharges),
          dateEcheance: values.dateEcheance,
          commentaires: values.commentaires.trim() === '' ? undefined : values.commentaires.trim(),
        },
      });
      toast.success('Loyer mis à jour');
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur de mise à jour');
    }
  });

  const isSubmitting = form.formState.isSubmitting || update.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modifier le loyer</DialogTitle>
          <DialogDescription>
            Ajuste les montants ou la date d&apos;échéance (cas particuliers : prorata, départ en
            cours de mois, etc.).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="montantLoyer">Loyer hors charges (€)</Label>
              <Input
                id="montantLoyer"
                type="number"
                step="0.01"
                min="0"
                disabled={isSubmitting}
                {...form.register('montantLoyer')}
              />
              {form.formState.errors.montantLoyer && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.montantLoyer.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="montantCharges">Charges (€)</Label>
              <Input
                id="montantCharges"
                type="number"
                step="0.01"
                min="0"
                disabled={isSubmitting}
                {...form.register('montantCharges')}
              />
              {form.formState.errors.montantCharges && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.montantCharges.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dateEcheance">Date d&apos;échéance</Label>
            <Input
              id="dateEcheance"
              type="date"
              disabled={isSubmitting}
              {...form.register('dateEcheance')}
            />
            {form.formState.errors.dateEcheance && (
              <p className="text-xs text-destructive">
                {form.formState.errors.dateEcheance.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="commentaires">Commentaires</Label>
            <textarea
              id="commentaires"
              rows={3}
              disabled={isSubmitting}
              {...form.register('commentaires')}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
