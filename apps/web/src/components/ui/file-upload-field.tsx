import { ExternalLink, FileText, Loader2, Trash2, Upload } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Props {
  /** Storage key actuelle (chemin dans le bucket). */
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  /** Fonction d'upload : doit retourner la storage key résultante. */
  uploadFn: (file: File) => Promise<string>;
  /** Fonction qui retourne une URL signée pour télécharger/afficher le fichier. */
  getUrlFn: (key: string) => Promise<string>;
  disabled?: boolean;
  /** Types MIME acceptés (par défaut image + PDF). */
  accept?: string;
  /** Taille max en MB (par défaut 10). */
  maxSizeMB?: number;
}

/**
 * Champ d'upload de fichier vers Supabase Storage avec aperçu et bouton de
 * suppression. Stocke la storage key dans le state parent.
 */
export function FileUploadField({
  value,
  onChange,
  uploadFn,
  getUrlFn,
  disabled = false,
  accept = 'image/*,application/pdf',
  maxSizeMB = 10,
}: Props) {
  const [uploading, setUploading] = useState(false);
  const [opening, setOpening] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > maxSizeMB * 1024 * 1024) {
      toast.error(`Fichier trop volumineux (max ${maxSizeMB} MB)`);
      return;
    }
    setUploading(true);
    try {
      const key = await uploadFn(file);
      onChange(key);
      toast.success('Fichier importé');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de l’import');
    } finally {
      setUploading(false);
    }
  };

  const handleOpen = async () => {
    if (!value) return;
    setOpening(true);
    try {
      const url = await getUrlFn(value);
      window.open(url, '_blank', 'noopener');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Impossible d’ouvrir le fichier');
    } finally {
      setOpening(false);
    }
  };

  const filename = value ? value.split('/').pop() ?? value : '';

  return (
    <div className="space-y-2">
      {value ? (
        <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 p-2">
          <div className="flex items-center gap-2 overflow-hidden">
            <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
            <span className="truncate text-xs">{filename}</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleOpen}
              disabled={disabled || opening}
              title="Ouvrir le fichier"
            >
              {opening ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ExternalLink className="h-3.5 w-3.5" />
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange(undefined)}
              disabled={disabled}
              title="Retirer le fichier"
            >
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </div>
        </div>
      ) : (
        <label
          className={cn(
            'flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed bg-muted/20 p-3 text-xs text-muted-foreground hover:bg-muted/40',
            (disabled || uploading) && 'cursor-not-allowed opacity-50',
          )}
        >
          <input
            type="file"
            accept={accept}
            className="hidden"
            onChange={handleFileChange}
            disabled={disabled || uploading}
          />
          {uploading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Import en cours…
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" />
              Importer une facture / photo (jpg, png, pdf — max {maxSizeMB} MB)
            </>
          )}
        </label>
      )}
    </div>
  );
}
