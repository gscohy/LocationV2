import type { TypeRappel } from '@/lib/db/rappels';

export const TYPE_RAPPEL_LABEL: Record<TypeRappel, string> = {
  RAPPEL_AMIABLE: 'Rappel amiable',
  RELANCE: 'Relance',
  MISE_EN_DEMEURE: 'Mise en demeure',
  COMMANDEMENT_PAYER: 'Commandement de payer',
  ASSIGNATION: 'Assignation',
};

export const TYPE_RAPPEL_COLOR: Record<TypeRappel, string> = {
  RAPPEL_AMIABLE: 'bg-blue-100 text-blue-800',
  RELANCE: 'bg-amber-100 text-amber-800',
  MISE_EN_DEMEURE: 'bg-orange-100 text-orange-800',
  COMMANDEMENT_PAYER: 'bg-red-100 text-red-800',
  ASSIGNATION: 'bg-rose-200 text-rose-900',
};

/**
 * Niveaux d'escalade : doit-on prévenir les garants à ce niveau ?
 */
export const PREVIENT_GARANTS: Record<TypeRappel, boolean> = {
  RAPPEL_AMIABLE: false,
  RELANCE: false,
  MISE_EN_DEMEURE: true,
  COMMANDEMENT_PAYER: true,
  ASSIGNATION: true,
};

const MOIS_LONG = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

interface TemplateContext {
  locataireNom: string;
  bailleurNom: string;
  bienAdresse: string;
  bienVille: string;
  periode: { mois: number; annee: number };
  montantDu: number;
  montantPaye: number;
  soldeRestant: number;
  dateEcheance: string;
}

const formatEuro = (v: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v);

const formatDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
};

const periodeLabel = (mois: number, annee: number) => `${MOIS_LONG[mois - 1]} ${annee}`;

export interface RappelTemplate {
  sujet: string;
  contenu: string;
}

export function buildTemplate(type: TypeRappel, ctx: TemplateContext): RappelTemplate {
  const periode = periodeLabel(ctx.periode.mois, ctx.periode.annee);
  const echeance = formatDate(ctx.dateEcheance);
  const reste = formatEuro(ctx.soldeRestant);
  const total = formatEuro(ctx.montantDu);

  switch (type) {
    case 'RAPPEL_AMIABLE':
      return {
        sujet: `Rappel — Loyer ${periode}`,
        contenu: `Bonjour ${ctx.locataireNom},

Sauf erreur de notre part, le règlement du loyer de la période de ${periode} (échéance du ${echeance}) ne nous est pas parvenu à ce jour.

Le solde restant dû est de ${reste} (sur un montant total de ${total}).

Il est possible qu'un règlement soit en cours d'acheminement ; dans ce cas, merci de ne pas tenir compte de ce courrier.

À défaut, nous vous remercions de bien vouloir régulariser cette situation dans les meilleurs délais.

Cordialement,
${ctx.bailleurNom}`,
      };

    case 'RELANCE':
      return {
        sujet: `Relance — Loyer ${periode} impayé`,
        contenu: `Bonjour ${ctx.locataireNom},

Malgré notre précédent rappel, nous constatons que le loyer de la période de ${periode} (échéance du ${echeance}) reste impayé à ce jour.

Solde restant dû : ${reste}.

Nous vous demandons de procéder au règlement sans délai. À défaut de régularisation sous 8 jours à compter de la réception de ce courrier, nous nous verrons contraints d'engager une procédure de recouvrement, conformément aux clauses du bail.

Nous vous invitons à nous contacter au plus vite si vous rencontrez une difficulté ponctuelle, afin de trouver une solution amiable.

Cordialement,
${ctx.bailleurNom}`,
      };

    case 'MISE_EN_DEMEURE':
      return {
        sujet: `Mise en demeure — Loyer ${periode}`,
        contenu: `${ctx.locataireNom},

Malgré nos précédents courriers de rappel et de relance, le loyer de la période de ${periode} (échéance du ${echeance}) demeure impayé.

Solde dû : ${reste}.

Par la présente, nous vous mettons en demeure de régler la somme due dans un délai de 8 jours à compter de la réception du présent courrier, adressé en lettre recommandée avec accusé de réception.

À défaut de paiement intégral dans ce délai, nous engagerons sans nouvel avis la procédure prévue par le bail et la loi : commandement de payer par voie d'huissier, déclenchement de la clause résolutoire et, le cas échéant, sollicitation de la caution.

Bien entendu, si vous avez d'ores et déjà procédé au règlement, nous vous prions de bien vouloir nous en faire parvenir le justificatif.

Adresse du logement concerné : ${ctx.bienAdresse}, ${ctx.bienVille}.

${ctx.bailleurNom}`,
      };

    case 'COMMANDEMENT_PAYER':
      return {
        sujet: `Commandement de payer — Loyer ${periode}`,
        contenu: `${ctx.locataireNom},

Vous trouverez ci-joint le commandement de payer signifié par voie d'huissier de justice, pour le règlement du loyer impayé de la période de ${periode}.

Solde réclamé : ${reste} (au titre du loyer et des charges, hors frais d'huissier et de procédure).

À défaut de règlement intégral dans le délai légal de deux mois à compter de la signification, la clause résolutoire insérée au bail produira ses effets de plein droit et la procédure d'expulsion pourra être engagée.

Logement concerné : ${ctx.bienAdresse}, ${ctx.bienVille}.

${ctx.bailleurNom}`,
      };

    case 'ASSIGNATION':
      return {
        sujet: `Assignation devant le tribunal — Loyer ${periode}`,
        contenu: `${ctx.locataireNom},

Suite au commandement de payer demeuré sans effet, vous trouverez ci-joint l'assignation à comparaître devant le tribunal judiciaire compétent, pour solliciter notamment :
- la constatation de l'acquisition de la clause résolutoire du bail,
- le règlement du solde dû au titre du loyer impayé (${reste}),
- votre expulsion ainsi que celle de tout occupant de son chef,
- la condamnation aux frais et dépens.

Logement concerné : ${ctx.bienAdresse}, ${ctx.bienVille}.

${ctx.bailleurNom}`,
      };
  }
}
