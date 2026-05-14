// =====================================================================
// Edge Function : envoie un rappel de loyer par email via le SMTP de l'utilisateur.
// Pas de PJ — c'est un courrier texte (peut être envoyé en LRAR via service externe).
//
// Body attendu : { to: string[], cc?: string[], subject: string, body: string }
// =====================================================================
import { serve } from 'https://deno.land/std@0.192.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { to, cc, bcc, subject, body } = await req.json();
    if (!Array.isArray(to) || to.length === 0 || !subject || !body) {
      throw new Error('Paramètres requis : to (array), subject, body');
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Authorization manquante');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userResult, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userResult?.user) throw new Error('Session invalide');

    const { data: smtp, error: smtpErr } = await supabase
      .from('parametres_smtp')
      .select('*')
      .maybeSingle();
    if (smtpErr) throw smtpErr;
    if (!smtp) {
      throw new Error('Paramètres SMTP non configurés. Va dans Paramètres pour les saisir.');
    }

    const client = new SMTPClient({
      connection: {
        hostname: smtp.host,
        port: Number(smtp.port),
        tls: smtp.secure,
        auth: { username: smtp.username, password: smtp.password },
      },
    });

    await client.send({
      from: `${smtp.from_name} <${smtp.from_email}>`,
      replyTo: smtp.from_email,
      to,
      cc: Array.isArray(cc) && cc.length > 0 ? cc : undefined,
      bcc: Array.isArray(bcc) && bcc.length > 0 ? bcc : undefined,
      subject,
      content: body,
      html: body.replace(/\n/g, '<br>'),
    });
    await client.close();

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
