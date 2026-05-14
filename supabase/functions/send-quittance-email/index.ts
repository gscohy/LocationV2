// =====================================================================
// Edge Function : envoie une quittance par email via SMTP de l'utilisateur.
// Runtime : Deno (Supabase Edge Functions)
//
// Body attendu :
//   { quittanceId: string, to: string[], cc?: string[], subject: string, body: string }
//
// Étapes :
//   1. Auth de l'appelant via Bearer.
//   2. Charge les paramètres SMTP du user (RLS).
//   3. Charge la quittance + le contexte (loyer, contrat, bien, locataires, propriétaires).
//   4. Génère le PDF (pdf-lib).
//   5. Envoie via SMTP (denomailer) avec PJ.
//   6. Met à jour la quittance (statut=ENVOYEE, date_envoi, destinataires).
// =====================================================================
import { serve } from 'https://deno.land/std@0.192.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';
import { PDFDocument, StandardFonts, rgb } from 'https://esm.sh/pdf-lib@1.17.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MOIS_LONG = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
];

function formatEuro(v: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { quittanceId, to, cc, bcc, subject, body } = await req.json();
    if (!quittanceId || !Array.isArray(to) || to.length === 0 || !subject || !body) {
      throw new Error('Paramètres requis : quittanceId, to (array), subject, body');
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Authorization manquante');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    // 1. Vérifier la session
    const { data: userResult, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userResult?.user) throw new Error('Session invalide');

    // 2. Charger paramètres SMTP du user
    const { data: smtp, error: smtpErr } = await supabase
      .from('parametres_smtp')
      .select('*')
      .maybeSingle();
    if (smtpErr) throw smtpErr;
    if (!smtp) {
      throw new Error('Paramètres SMTP non configurés. Va dans Paramètres pour les saisir.');
    }

    // 3. Charger la quittance avec son contexte complet
    const { data: q, error: qErr } = await supabase
      .from('quittances')
      .select(
        '*, loyers(id, mois, annee, montant_loyer, montant_charges, montant_total, contrats(id, biens(adresse, complement_adresse, code_postal, ville, bien_proprietaires(quote_part, proprietaires(id, type, civilite, nom, prenom, adresse, complement_adresse, code_postal, ville, pays, entreprise, signature_data_url))), contrat_locataires(est_principal, locataires(id, civilite, nom, prenom))))',
      )
      .eq('id', quittanceId)
      .maybeSingle();
    if (qErr) throw qErr;
    if (!q) throw new Error('Quittance introuvable');

    const loyer = q.loyers;
    if (!loyer) throw new Error('Loyer associé à la quittance introuvable');
    const bien = loyer.contrats?.biens;
    const bienProprios = bien?.bien_proprietaires ?? [];
    const proprios = bienProprios
      .map((bp: any) => ({ ...bp.proprietaires, quote_part: Number(bp.quote_part) }))
      .filter((p: any) => p)
      .sort((a: any, b: any) => b.quote_part - a.quote_part);
    const cls = loyer.contrats?.contrat_locataires ?? [];
    const tousLocataires = cls
      .map((cl: any) => ({ ...cl.locataires, est_principal: cl.est_principal }))
      .filter((l: any) => l);

    // 4. Générer le PDF
    const pdfBytes = await buildQuittancePdf({
      periode: q.periode,
      montantLoyer: Number(q.montant_loyer),
      montantCharges: Number(q.montant_charges),
      montantTotal: Number(q.montant_total),
      mois: loyer.mois,
      annee: loyer.annee,
      bienAdresse: bien?.adresse ?? '',
      bienComplement: bien?.complement_adresse ?? '',
      bienCodePostal: bien?.code_postal ?? '',
      bienVille: bien?.ville ?? '',
      proprietaires: proprios,
      locataires: tousLocataires,
      dateGeneration: q.date_generation ?? new Date().toISOString(),
    });

    // 5. Envoi SMTP
    const client = new SMTPClient({
      connection: {
        hostname: smtp.host,
        port: Number(smtp.port),
        tls: smtp.secure,
        auth: {
          username: smtp.username,
          password: smtp.password,
        },
      },
    });

    const filename = `quittance-${q.periode.toLowerCase().replace(/\s+/g, '-')}.pdf`;
    await client.send({
      from: `${smtp.from_name} <${smtp.from_email}>`,
      replyTo: smtp.from_email,
      to,
      cc: Array.isArray(cc) && cc.length > 0 ? cc : undefined,
      bcc: Array.isArray(bcc) && bcc.length > 0 ? bcc : undefined,
      subject,
      content: body,
      html: body.replace(/\n/g, '<br>'),
      attachments: [
        {
          filename,
          content: pdfBytes,
          contentType: 'application/pdf',
          encoding: 'binary',
        },
      ],
    });
    await client.close();

    // 6. Mise à jour de la quittance
    const allDestinataires = [...to, ...(cc ?? []), ...(bcc ?? [])].join(', ');
    await supabase
      .from('quittances')
      .update({
        statut: 'ENVOYEE',
        date_envoi: new Date().toISOString(),
        destinataires: allDestinataires,
        mode_envoi: 'EMAIL',
        email_envoye: true,
      })
      .eq('id', quittanceId);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});

// =====================================================================
// Génération PDF — version simplifiée, A4 portrait.
// =====================================================================
interface PdfInput {
  periode: string;
  montantLoyer: number;
  montantCharges: number;
  montantTotal: number;
  mois: number;
  annee: number;
  bienAdresse: string;
  bienComplement: string;
  bienCodePostal: string;
  bienVille: string;
  proprietaires: any[];
  locataires: any[];
  dateGeneration: string;
}

async function buildQuittancePdf(input: PdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let y = 800;
  const left = 50;
  const right = 545;

  const draw = (
    text: string,
    opts: { x?: number; size?: number; bold?: boolean; alignRight?: boolean } = {},
  ) => {
    const size = opts.size ?? 10;
    const f = opts.bold ? fontBold : font;
    let x = opts.x ?? left;
    if (opts.alignRight) {
      const w = f.widthOfTextAtSize(text, size);
      x = right - w;
    }
    page.drawText(text, { x, y, size, font: f, color: rgb(0, 0, 0) });
  };

  // En-tête : bailleur(s) à gauche, titre à droite
  const yStart = y;
  for (const p of input.proprietaires) {
    const nom =
      p.type === 'MORALE'
        ? p.entreprise ?? p.nom
        : [p.civilite, p.prenom, p.nom].filter(Boolean).join(' ');
    draw(nom, { bold: true });
    y -= 13;
    draw(p.adresse);
    y -= 13;
    if (p.complement_adresse) {
      draw(p.complement_adresse);
      y -= 13;
    }
    draw(`${p.code_postal} ${p.ville}`);
    y -= 22;
  }

  // Reset y pour titre à droite
  y = yStart;
  draw('QUITTANCE DE LOYER', { size: 18, bold: true, alignRight: true });
  y -= 22;
  const dateGen = new Date(input.dateGeneration).toLocaleDateString('fr-FR');
  draw(`Émise le ${dateGen}`, { size: 9, alignRight: true });

  // Bloc locataire + bien
  y = Math.min(y, 680) - 30;
  draw('LOCATAIRE', { bold: true, size: 9 });
  y -= 16;
  for (const l of input.locataires) {
    const nom = [l.civilite, l.prenom, l.nom].filter(Boolean).join(' ');
    draw(nom);
    y -= 13;
  }
  y -= 10;
  draw('Bien loué :', { size: 9 });
  y -= 13;
  draw(input.bienAdresse);
  y -= 13;
  if (input.bienComplement) {
    draw(input.bienComplement);
    y -= 13;
  }
  draw(`${input.bienCodePostal} ${input.bienVille}`);
  y -= 25;

  // Bloc période et montants
  draw(`Période : ${input.periode}`, { bold: true, size: 12 });
  y -= 18;
  draw(`Montant total : ${formatEuro(input.montantTotal)}`, { bold: true, size: 12 });
  y -= 15;
  draw(`  dont loyer hors charges : ${formatEuro(input.montantLoyer)}`);
  y -= 13;
  draw(`  dont charges : ${formatEuro(input.montantCharges)}`);
  y -= 30;

  // Texte légal
  const pluriel = input.proprietaires.length > 1;
  const nomsBailleurs = input.proprietaires
    .map((p) =>
      p.type === 'MORALE'
        ? p.entreprise ?? p.nom
        : [p.civilite, p.prenom, p.nom].filter(Boolean).join(' '),
    )
    .join(', ');
  const nomsLocataires = input.locataires
    .map((l) => [l.civilite, l.prenom, l.nom].filter(Boolean).join(' '))
    .join(', ');

  const intro = pluriel ? 'Nous soussignés' : 'Je soussigné(e)';
  const bailleurMot = pluriel ? 'bailleurs' : 'bailleur';
  const verbe = pluriel ? 'reconnaissons' : 'reconnais';
  const paragraphe = `${intro} ${nomsBailleurs}, ${bailleurMot} du logement désigné ci-dessus, ${verbe} avoir reçu de ${nomsLocataires} la somme de ${formatEuro(input.montantTotal)} au titre du loyer et des charges de la période ${input.periode}.`;

  const wrapped = wrapText(paragraphe, font, 10, right - left);
  for (const line of wrapped) {
    draw(line, { size: 10 });
    y -= 13;
  }
  y -= 8;
  const note =
    'La présente quittance vaut reçu pour la somme indiquée. Elle annule tous les reçus qui auraient pu être donnés précédemment pour la même période en cas de paiements fractionnés.';
  for (const line of wrapText(note, font, 9, right - left)) {
    draw(line, { size: 9 });
    y -= 12;
  }

  // Signatures (au moins une zone par bailleur)
  y -= 30;
  draw(`Fait le ${dateGen}`, { size: 10 });
  y -= 30;

  draw(pluriel ? 'Signatures des bailleurs :' : 'Signature du bailleur :', { size: 9 });
  y -= 15;

  const signWidth = 130;
  const signHeight = 50;
  let sigX = left;
  const startY = y;
  for (const p of input.proprietaires) {
    if (p.signature_data_url && typeof p.signature_data_url === 'string') {
      try {
        const dataPart = p.signature_data_url.split(',')[1];
        if (dataPart) {
          const bytes = Uint8Array.from(atob(dataPart), (c) => c.charCodeAt(0));
          const img = await pdf.embedPng(bytes);
          const dims = img.scaleToFit(signWidth, signHeight);
          page.drawImage(img, {
            x: sigX,
            y: startY - signHeight + (signHeight - dims.height) / 2,
            width: dims.width,
            height: dims.height,
          });
        }
      } catch {
        // Si la signature n'est pas un PNG valide, on laisse la zone vide.
      }
    }
    // Trait sous la zone signature
    page.drawLine({
      start: { x: sigX, y: startY - signHeight - 2 },
      end: { x: sigX + signWidth, y: startY - signHeight - 2 },
      thickness: 0.5,
      color: rgb(0.5, 0.5, 0.5),
    });
    // Nom du bailleur sous le trait
    const nom =
      p.type === 'MORALE'
        ? p.entreprise ?? p.nom
        : [p.civilite, p.prenom, p.nom].filter(Boolean).join(' ');
    page.drawText(nom, {
      x: sigX,
      y: startY - signHeight - 14,
      size: 8,
      font,
      color: rgb(0.4, 0.4, 0.4),
    });
    sigX += signWidth + 20;
  }

  return await pdf.save();
}

function wrapText(text: string, font: any, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const w of words) {
    const test = current ? `${current} ${w}` : w;
    if (font.widthOfTextAtSize(test, size) > maxWidth) {
      if (current) lines.push(current);
      current = w;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}
