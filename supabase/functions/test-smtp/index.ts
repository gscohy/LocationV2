// =====================================================================
// Edge Function : envoie un mail de test via le SMTP de l'utilisateur
// pour valider la configuration (page Paramètres).
//
// Body attendu : { to: string, subject?: string, body?: string }
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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { to, subject, body } = await req.json();
    if (!to || typeof to !== 'string') {
      throw new Error('Destinataire (to) requis');
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
      throw new Error('Aucune configuration SMTP trouvée. Enregistre d’abord les paramètres.');
    }

    const client = new SMTPClient({
      connection: {
        hostname: smtp.host,
        port: Number(smtp.port),
        tls: smtp.secure,
        auth: { username: smtp.username, password: smtp.password },
      },
    });

    const finalSubject =
      typeof subject === 'string' && subject.trim() !== ''
        ? subject
        : 'Test SMTP — Gestion locative';
    const finalBody =
      typeof body === 'string' && body.trim() !== ''
        ? body
        : `Ceci est un email de test envoyé depuis l'application Gestion locative.

Si tu lis ce message, c'est que ta configuration SMTP est opérationnelle :
- Hôte : ${smtp.host}:${smtp.port}
- Utilisateur : ${smtp.username}
- SSL/TLS : ${smtp.secure ? 'activé' : 'désactivé'}
- Expéditeur : ${smtp.from_name} <${smtp.from_email}>

Tu peux maintenant envoyer les quittances par email depuis l'app.`;

    await client.send({
      from: `${smtp.from_name} <${smtp.from_email}>`,
      replyTo: smtp.from_email,
      to: [to.trim()],
      subject: finalSubject,
      content: finalBody,
      html: finalBody.replace(/\n/g, '<br>'),
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
