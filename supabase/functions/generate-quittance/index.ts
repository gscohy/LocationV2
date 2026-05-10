// =====================================================================
// Edge Function : génération PDF d'une quittance
// =====================================================================
// Runtime : Deno (Supabase Edge Functions)
// Appel depuis le frontend :
//   const { data, error } = await supabase.functions.invoke('generate-quittance', {
//     body: { loyerId: 'xxx', envoyer: true }
//   });
// =====================================================================
import { serve } from 'https://deno.land/std@0.192.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { PDFDocument, StandardFonts, rgb } from 'https://cdn.skypack.dev/pdf-lib?dts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { loyerId, envoyer } = await req.json();
    if (!loyerId) throw new Error('loyerId requis');

    // Auth header de l'appelant
    const authHeader = req.headers.get('Authorization')!;
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    // Récupère le loyer + contrat + bien + locataires + propriétaire
    const { data: loyer, error: loyerErr } = await supabase
      .from('loyers')
      .select(`
        *,
        contrat:contrats(
          *,
          bien:biens(
            *,
            proprietaires:bien_proprietaires(*, proprietaire:proprietaires(*))
          ),
          locataires:contrat_locataires(*, locataire:locataires(*))
        )
      `)
      .eq('id', loyerId)
      .single();

    if (loyerErr || !loyer) throw new Error('Loyer introuvable');
    if (loyer.statut !== 'PAYE') throw new Error('Quittance générable uniquement après paiement complet');

    const periode = `${['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'][loyer.mois - 1]} ${loyer.annee}`;
    const locataire = loyer.contrat.locataires[0]?.locataire;
    const bien = loyer.contrat.bien;
    const proprietaire = bien.proprietaires[0]?.proprietaire;
    if (!locataire || !proprietaire) throw new Error('Locataire ou propriétaire manquant');

    // Génération PDF avec pdf-lib
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]); // A4
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    let y = 780;
    const drawText = (text: string, opts: { x?: number; size?: number; bold?: boolean } = {}) => {
      page.drawText(text, {
        x: opts.x ?? 50,
        y,
        size: opts.size ?? 11,
        font: opts.bold ? fontBold : font,
        color: rgb(0, 0, 0),
      });
    };

    drawText('QUITTANCE DE LOYER', { size: 18, bold: true });
    y -= 30;
    drawText(`Période : ${periode}`, { bold: true, size: 13 });
    y -= 25;
    drawText(`Montant : ${loyer.montant_total.toFixed(2)} €`, { bold: true, size: 13 });
    y -= 25;
    drawText(`  dont loyer : ${loyer.montant_loyer.toFixed(2)} €`);
    y -= 18;
    drawText(`  dont charges : ${loyer.montant_charges.toFixed(2)} €`);
    y -= 35;
    drawText('Locataire', { bold: true });
    y -= 18;
    drawText(`${locataire.civilite} ${locataire.prenom} ${locataire.nom}`);
    y -= 18;
    drawText(`${bien.adresse}`);
    y -= 18;
    drawText(`${bien.code_postal} ${bien.ville}`);
    y -= 35;
    drawText('Bailleur', { bold: true });
    y -= 18;
    drawText(`${proprietaire.prenom ?? ''} ${proprietaire.nom}`);
    y -= 18;
    drawText(`${proprietaire.adresse}, ${proprietaire.code_postal} ${proprietaire.ville}`);
    y -= 50;
    drawText(`Je soussigné(e) ${proprietaire.prenom ?? ''} ${proprietaire.nom},`);
    y -= 16;
    drawText(`reconnais avoir reçu de ${locataire.prenom} ${locataire.nom} la somme de`);
    y -= 16;
    drawText(`${loyer.montant_total.toFixed(2)} €`, { bold: true });
    y -= 16;
    drawText(`au titre du loyer et des charges de la période ${periode}.`);
    y -= 30;
    drawText(`Cette quittance vaut reçu pour la somme indiquée.`);
    y -= 50;
    drawText(`Fait le ${new Date().toLocaleDateString('fr-FR')}`);

    const pdfBytes = await pdfDoc.save();

    // Upload dans le bucket quittances
    const storageKey = `${loyer.contrat_id}/quittance-${periode.replace(' ', '-')}.pdf`;
    const { error: uploadErr } = await supabase.storage
      .from('quittances')
      .upload(storageKey, pdfBytes, { contentType: 'application/pdf', upsert: true });
    if (uploadErr) throw uploadErr;

    // Création Document + Quittance en BDD
    const { data: doc } = await supabase
      .from('documents')
      .insert({
        nom: `Quittance ${periode}.pdf`,
        storage_key: storageKey,
        bucket: 'quittances',
        taille_octets: pdfBytes.length,
        mime_type: 'application/pdf',
        extension: 'pdf',
        categorie: 'QUITTANCE',
        type_doc: 'QUITTANCE',
        contrat_id: loyer.contrat_id,
        uploaded_by: (await supabase.auth.getUser()).data.user?.id,
      })
      .select()
      .single();

    const { data: quittance, error: qErr } = await supabase
      .from('quittances')
      .insert({
        loyer_id: loyer.id,
        periode,
        montant_total: loyer.montant_total,
        montant_loyer: loyer.montant_loyer,
        montant_charges: loyer.montant_charges,
        document_storage_key: storageKey,
        statut: envoyer ? 'ENVOYEE' : 'GENEREE',
        destinataires: locataire.email,
      })
      .select()
      .single();
    if (qErr) throw qErr;

    // TODO : envoi email via Resend si envoyer === true
    // const resendKey = Deno.env.get('RESEND_API_KEY');
    // if (envoyer && resendKey) { /* fetch resend.com/api/send */ }

    return new Response(JSON.stringify({ quittance, document: doc }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
