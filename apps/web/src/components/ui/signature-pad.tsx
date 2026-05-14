import { Eraser, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Props {
  /** data URL existante (image/png;base64,...) ou undefined. */
  value: string | undefined;
  /** Appelé quand la signature change. undefined si vide. */
  onChange: (value: string | undefined) => void;
  disabled?: boolean;
  /** Largeur en pixels (par défaut 400). */
  width?: number;
  /** Hauteur en pixels (par défaut 150). */
  height?: number;
  className?: string;
}

/**
 * Zone de dessin pour saisir une signature à la souris ou au doigt.
 * Renvoie le résultat en data URL PNG.
 */
/**
 * Redimensionne une image (n'importe quel format géré par le navigateur)
 * et la convertit en PNG data URL, fond blanc, taille raisonnable pour BDD.
 */
async function imageFileToDataUrl(file: File, maxWidth = 800, maxHeight = 300): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const ratio = Math.min(maxWidth / img.width, maxHeight / img.height, 1);
        const w = Math.max(1, Math.round(img.width * ratio));
        const h = Math.max(1, Math.round(img.height * ratio));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas indisponible'));
          return;
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => reject(new Error('Image illisible (format non supporté ?)'));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error('Lecture du fichier échouée'));
    reader.readAsDataURL(file);
  });
}

export function SignaturePad({
  value,
  onChange,
  disabled = false,
  width = 400,
  height = 150,
  className,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const [hasContent, setHasContent] = useState(Boolean(value));

  // (Re)charge l'image existante quand value change depuis l'extérieur.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!value) {
      setHasContent(false);
      return;
    }
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      setHasContent(true);
    };
    img.src = value;
  }, [value]);

  const getPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const startDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    lastPointRef.current = getPoint(e);
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const point = getPoint(e);
    const prev = lastPointRef.current;
    if (!point || !prev) return;
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    lastPointRef.current = point;
    if (!hasContent) setHasContent(true);
  };

  const endDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastPointRef.current = null;
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    onChange(canvas.toDataURL('image/png'));
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasContent(false);
    onChange(undefined);
  };

  const handleUploadClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Veuillez sélectionner un fichier image');
      return;
    }
    try {
      const dataUrl = await imageFileToDataUrl(file);
      onChange(dataUrl);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors du chargement de l’image');
    }
  };

  return (
    <div className={cn('space-y-2', className)}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onPointerDown={startDraw}
        onPointerMove={draw}
        onPointerUp={endDraw}
        onPointerCancel={endDraw}
        onPointerLeave={endDraw}
        className={cn(
          'block w-full touch-none rounded-md border bg-white',
          disabled ? 'cursor-not-allowed opacity-50' : 'cursor-crosshair',
        )}
        style={{ aspectRatio: `${width} / ${height}` }}
      />
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {hasContent
            ? 'Signature enregistrée'
            : 'Dessinez la signature ci-dessus ou importez une image'}
        </span>
        <div className="flex items-center gap-1">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
            disabled={disabled}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleUploadClick}
            disabled={disabled}
          >
            <Upload className="h-3.5 w-3.5" />
            Importer
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClear}
            disabled={disabled || !hasContent}
          >
            <Eraser className="h-3.5 w-3.5" />
            Effacer
          </Button>
        </div>
      </div>
    </div>
  );
}
