import { useEffect, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Props {
  codePostal: string;
  onCodePostalChange: (v: string) => void;
  ville: string;
  onVilleChange: (v: string) => void;
  disabled?: boolean;
  codePostalError?: string;
  villeError?: string;
  /** Préfixe pour les `id` des inputs si plusieurs instances cohabitent dans la même page. */
  idPrefix?: string;
  /** Ajoute "*" sur les labels et la sémantique requis (par défaut true). */
  required?: boolean;
}

interface CommuneApiRow {
  nom: string;
}

/**
 * Couple Code postal + Ville avec autocomplétion via l'API publique
 * gratuite https://geo.api.gouv.fr (codes postaux français à 5 chiffres).
 *
 * Comportement :
 * - dès que le code postal atteint 5 chiffres, on fetch les communes,
 * - si 1 seule commune → on pré-remplit la ville,
 * - si plusieurs → on alimente une <datalist> sur le champ ville,
 * - si aucune → l'utilisateur saisit librement.
 */
export function CodePostalVilleFields({
  codePostal,
  onCodePostalChange,
  ville,
  onVilleChange,
  disabled,
  codePostalError,
  villeError,
  idPrefix = '',
  required = true,
}: Props) {
  const [communes, setCommunes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const cp = codePostal.trim();
    if (!/^\d{5}$/.test(cp)) {
      setCommunes([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`https://geo.api.gouv.fr/communes?codePostal=${cp}&fields=nom&format=json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: CommuneApiRow[]) => {
        if (cancelled) return;
        const noms = data.map((c) => c.nom).sort((a, b) => a.localeCompare(b, 'fr'));
        setCommunes(noms);
        if (noms.length === 1 && (ville.trim() === '' || !noms.includes(ville))) {
          onVilleChange(noms[0]!);
        }
      })
      .catch(() => {
        if (!cancelled) setCommunes([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // Volontairement uniquement codePostal en dep : on ne refait pas de requête
    // quand l'utilisateur tape la ville ou que les handlers changent d'identité.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codePostal]);

  const listId = `${idPrefix}cp-villes-${codePostal || 'x'}`;
  const cpId = `${idPrefix}codePostal`;
  const villeId = `${idPrefix}ville`;

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1.5">
        <Label htmlFor={cpId}>Code postal {required && '*'}</Label>
        <Input
          id={cpId}
          value={codePostal}
          onChange={(e) => onCodePostalChange(e.target.value)}
          disabled={disabled}
          maxLength={5}
          inputMode="numeric"
          placeholder="59191"
        />
        {codePostalError && <p className="text-xs text-destructive">{codePostalError}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={villeId}>
          Ville {required && '*'}
          {communes.length > 1 && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              ({communes.length} communes)
            </span>
          )}
        </Label>
        <Input
          id={villeId}
          value={ville}
          onChange={(e) => onVilleChange(e.target.value)}
          disabled={disabled}
          list={communes.length > 0 ? listId : undefined}
          placeholder={loading ? 'Recherche…' : 'Ville'}
          autoComplete="off"
        />
        {communes.length > 0 && (
          <datalist id={listId}>
            {communes.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        )}
        {villeError && <p className="text-xs text-destructive">{villeError}</p>}
      </div>
    </div>
  );
}
