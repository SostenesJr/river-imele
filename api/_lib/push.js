/* ============================================================
   NAVLOG AMAZÔNIA — envio de notificações push (Web Push)
   ============================================================
   Usado pelo cron do nível do rio, pelo cron de qualidade do ar e pelo
   webhook de edição de município (ver api/webhook-municipio.js) pra
   mandar notificação push pra todo mundo que ativou notificações no
   app (tabela push_subscriptions).

   Variáveis de ambiente necessárias (Vercel, Project Settings →
   Environment Variables):
     VAPID_PUBLIC_KEY    — mesma chave pública que fica em
                            js/supabase-config.js (VAPID_PUBLIC_KEY) —
                            é pública por design, pode repetir aqui
     VAPID_PRIVATE_KEY   — a chave privada correspondente. NUNCA vai no
                            código do site, só aqui como env var
     VAPID_CONTACT_EMAIL — opcional; um e-mail de contato (exigido pelo
                            padrão Web Push, não precisa ser monitorado)
   ============================================================ */

const webpush = require('web-push');
const { sbFetch } = require('./supabase');

var configurado = false;
function garantirVapid() {
  if (configurado) return;
  webpush.setVapidDetails(
    'mailto:' + (process.env.VAPID_CONTACT_EMAIL || 'contato@navlog.app'),
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  configurado = true;
}

/* Manda `payload` ({title, body, url, tag}) por push pra todo mundo que
   tem uma inscrição salva. Remove sozinho as inscrições que o navegador
   da pessoa já invalidou (410 Gone / 404 Not Found — o jeito normal de
   uma inscrição "morrer": desinstalou o app, limpou os dados do
   navegador, trocou de aparelho etc.; não tem como o app avisar antes
   disso acontecer, só descobre na hora de tentar mandar). */
async function enviarPushTodos(payload) {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    console.warn('push: VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY não configuradas nas variáveis de ambiente — pulando envio');
    return { enviados: 0, falhas: 0, removidas: 0, pulou: true };
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('push: SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY não configuradas — pulando envio');
    return { enviados: 0, falhas: 0, removidas: 0, pulou: true };
  }
  garantirVapid();

  var subs = await sbFetch('push_subscriptions?select=id,endpoint,p256dh,auth_key', { method: 'GET' });
  if (!subs || !subs.length) return { enviados: 0, falhas: 0, removidas: 0 };

  var corpo = JSON.stringify(payload);
  var enviados = 0, falhas = 0, removidas = 0;

  await Promise.all(subs.map(async function (s) {
    try {
      await webpush.sendNotification({
        endpoint: s.endpoint,
        keys: { p256dh: s.p256dh, auth: s.auth_key }
      }, corpo);
      enviados++;
    } catch (err) {
      falhas++;
      var status = err && (err.statusCode || err.status);
      if (status === 404 || status === 410) {
        removidas++;
        await sbFetch('push_subscriptions?id=eq.' + s.id, { method: 'DELETE' }).catch(function () {});
      } else {
        console.error('push: falha ao enviar pra uma inscrição:', String((err && err.message) || err));
      }
    }
  }));

  return { enviados: enviados, falhas: falhas, removidas: removidas };
}

module.exports = { enviarPushTodos: enviarPushTodos };
