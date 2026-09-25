/* ============================================================
   NAVLOG AMAZÔNIA — webhook: notificação push ao editar um município
   ============================================================
   Não é um cron — é chamado direto pelo Supabase (Database Webhooks)
   toda vez que uma linha de public.municipios_info é atualizada em
   Configurações (preço, embarcações, dias de saída do porto etc.), pra
   avisar quem tem notificação push ativada. Configuração necessária no
   painel do Supabase (Database → Webhooks → Create a new hook), ver
   passo a passo no README ("Notificações push"):
     Table:      municipios_info
     Events:     Update
     Type:       HTTP Request
     Method:     POST
     URL:        https://SEU-DOMINIO.vercel.app/api/webhook-municipio
     Headers:    x-webhook-secret: <mesmo valor de WEBHOOK_SECRET abaixo>

   Variáveis de ambiente necessárias (Vercel):
     WEBHOOK_SECRET       — senha só sua, tem que bater com o header
                             "x-webhook-secret" configurado no Supabase,
                             pra ninguém além do Supabase conseguir
                             chamar essa rota e disparar notificações
     VAPID_PUBLIC_KEY /
     VAPID_PRIVATE_KEY    — ver api/_lib/push.js
   ============================================================ */

const { enviarPushTodos } = require('./_lib/push');

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'método não permitido' });
      return;
    }
    if (process.env.WEBHOOK_SECRET) {
      var recebido = req.headers['x-webhook-secret'];
      if (recebido !== process.env.WEBHOOK_SECRET) {
        res.status(401).json({ error: 'não autorizado' });
        return;
      }
    }

    // Payload de um Database Webhook da Supabase: { type, table, record, old_record, ... }
    var body = req.body || {};
    var record = body.record || {};
    var seq = record.seq || '?';

    var info = await enviarPushTodos({
      title: 'NavLog Amazônia — dados atualizados',
      body: 'As informações do município ' + seq + ' foram atualizadas em Configurações.',
      url: '/index.html#i',
      tag: 'navlog-municipio-' + seq
    });

    res.status(200).json({ ok: true, push: info });
  } catch (err) {
    res.status(500).json({ error: String((err && err.message) || err) });
  }
};
