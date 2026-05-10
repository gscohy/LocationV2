// =====================================================================
// Edge Function : génération mensuelle des loyers
// =====================================================================
// Appelée par pg_cron (1er du mois 06h00) ou manuellement.
// =====================================================================
import { serve } from 'https://deno.land/std@0.192.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const now = new Date();
    const mois = body.mois ?? now.getMonth() + 1;
    const annee = body.annee ?? now.getFullYear();
    const force: boolean = body.force ?? false;

    // Service role pour bypass RLS (job admin)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const periodStart = new Date(annee, mois - 1, 1);
    const periodEnd = new Date(annee, mois, 0);

    const { data: contrats } = await supabase
      .from('contrats')
      .select('id, date_debut, date_fin, date_fin_reelle, jour_paiement, loyer, charges_mensuelles')
      .eq('statut', 'ACTIF');

    if (!contrats) throw new Error('Erreur lecture contrats');

    let created = 0;
    let skipped = 0;

    for (const c of contrats) {
      if (new Date(c.date_debut) > periodEnd) { skipped++; continue; }
      if (c.date_fin && new Date(c.date_fin) < periodStart) { skipped++; continue; }
      if (c.date_fin_reelle && new Date(c.date_fin_reelle) < periodStart) { skipped++; continue; }

      const { data: existing } = await supabase
        .from('loyers')
        .select('id')
        .eq('contrat_id', c.id)
        .eq('mois', mois)
        .eq('annee', annee)
        .maybeSingle();

      if (existing && !force) { skipped++; continue; }

      const dateEcheance = new Date(annee, mois - 1, Math.min(c.jour_paiement, 28))
        .toISOString().slice(0, 10);

      if (existing && force) {
        await supabase.from('loyers').update({
          montant_loyer: c.loyer,
          montant_charges: c.charges_mensuelles,
          date_echeance: dateEcheance,
        }).eq('id', existing.id);
      } else {
        await supabase.from('loyers').insert({
          contrat_id: c.id,
          mois,
          annee,
          montant_loyer: c.loyer,
          montant_charges: c.charges_mensuelles,
          date_echeance: dateEcheance,
          statut: 'EN_ATTENTE',
        });
      }
      created++;
    }

    return new Response(
      JSON.stringify({ mois, annee, created, skipped }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
