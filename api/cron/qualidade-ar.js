/* ============================================================
   NAVLOG AMAZÔNIA — checagem periódica de qualidade do ar (push)
   ============================================================
   Roda automaticamente todo dia (configurado em vercel.json, seção
   "crons", num horário diferente do cron do nível do rio — o plano
   Hobby da Vercel só permite crons com frequência diária). Busca a
   qualidade do ar (mesma API e mesma escala AQI europeia usada na aba
   Clima do site — ver js/app.js/aqiCategoria()) pra todos os
   municípios, DE NOVO aqui no servidor: a busca de dentro do app roda
   no navegador de cada pessoa e não é salva em lugar nenhum, então não
   dava pra reaproveitar — esse cron faz a mesma conta só que a partir
   daqui, pra poder comparar com a rodada anterior e mandar push.

   Só manda notificação quando a LISTA de municípios em faixa "Muito
   ruim"/"Extremamente ruim" muda (alguém entra ou sai dela) — não a
   cada rodada do cron, senão notificaria repetido todo dia com a mesma
   situação. O estado da rodada anterior fica salvo em
   public.push_estado_ar (ver supabase/migracao-push.sql).

   Variáveis de ambiente necessárias: as mesmas do cron do nível do rio
   (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET opcional) mais
   VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY (ver api/_lib/push.js). Precisa
   também que supabase/migracao-push.sql já tenha sido rodado (tabela
   push_estado_ar).
   ============================================================ */

const { sbFetch } = require('../_lib/supabase');
const { enviarPushTodos } = require('../_lib/push');

// Mesma escala/cortes de js/app.js (aqiCategoria) — índice europeu (0–100+).
var AQI_CRITICO_A_PARTIR_DE = 80; // "Muito ruim" (80–100) e "Extremamente ruim" (>100)

/* Os crons da Vercel chamam a rota com GET simples, sem corpo — então,
   em vez de duplicar a lista de coordenadas aqui (57 municípios, teria
   que manter as duas cópias sincronizadas manualmente pra sempre),
   esse cron busca o PRÓPRIO js/data.js já publicado no site (mesmo
   domínio da função) e extrai o objeto LATLNG dali. Só funciona depois
   do primeiro deploy do site (não tem como rodar isso antes de existir
   um domínio publicado com o data.js nele). */
async function carregarLatLng(req) {
  var host = req.headers['x-forwarded-host'] || req.headers['host'];
  var proto = req.headers['x-forwarded-proto'] || 'https';
  var url = proto + '://' + host + '/js/data.js';
  var r = await fetch(url);
  if (!r.ok) throw new Error('Falha ao buscar ' + url + ' pra extrair LATLNG: HTTP ' + r.status);
  var texto = await r.text();
  var m = texto.match(/const LATLNG\s*=\s*(\{[\s\S]*?\};)/);
  if (!m) throw new Error('não encontrei "const LATLNG = {...}" em js/data.js (o arquivo pode ter mudado de formato)');
  // eslint-disable-next-line no-new-func
  return new Function('return ' + m[1])();
}

module.exports = async function handler(req, res) {
  try {
    if (process.env.CRON_SECRET) {
      var auth = req.headers['authorization'];
      if (auth !== 'Bearer ' + process.env.CRON_SECRET) {
        res.status(401).json({ error: 'não autorizado' });
        return;
      }
    }
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      res.status(500).json({ error: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY não configuradas' });
      return;
    }

    var latlng = await carregarLatLng(req);
    var lista = Object.keys(latlng).map(function (seq) {
      return { seq: seq, lat: latlng[seq].lat, lng: latlng[seq].lng };
    });

    var lats = lista.map(function (m) { return m.lat; }).join(',');
    var lngs = lista.map(function (m) { return m.lng; }).join(',');
    var url = 'https://air-quality-api.open-meteo.com/v1/air-quality?latitude=' + lats + '&longitude=' + lngs + '&current=european_aqi&timezone=auto';
    var arRes = await fetch(url);
    if (!arRes.ok) throw new Error('Falha ao buscar Open-Meteo (qualidade do ar): HTTP ' + arRes.status);
    var itens = await arRes.json();
    var itensArr = Array.isArray(itens) ? itens : [itens];

    var criticosAgora = [];
    itensArr.forEach(function (item, i) {
      var aqi = item && item.current && typeof item.current.european_aqi === 'number' ? item.current.european_aqi : null;
      if (aqi !== null && aqi >= AQI_CRITICO_A_PARTIR_DE) criticosAgora.push(lista[i].seq);
    });
    criticosAgora.sort();

    var estadoRows = await sbFetch('push_estado_ar?select=municipios_criticos&id=eq.1', { method: 'GET' });
    var criticosAntes = (estadoRows && estadoRows[0] && estadoRows[0].municipios_criticos) || [];
    criticosAntes = criticosAntes.slice().sort();

    var mudou = JSON.stringify(criticosAgora) !== JSON.stringify(criticosAntes);
    var pushInfo = null;

    if (mudou) {
      var entraram = criticosAgora.filter(function (s) { return criticosAntes.indexOf(s) === -1; });
      var sairam = criticosAntes.filter(function (s) { return criticosAgora.indexOf(s) === -1; });
      var partes = [];
      if (entraram.length) partes.push('entrou(aram) em alerta de ar ruim: ' + entraram.join(', '));
      if (sairam.length) partes.push('melhorou(aram): ' + sairam.join(', '));

      try {
        pushInfo = await enviarPushTodos({
          title: 'NavLog Amazônia — qualidade do ar',
          body: partes.join(' · ') || 'A qualidade do ar mudou em um ou mais municípios.',
          url: '/index.html#w',
          tag: 'navlog-qualidade-ar'
        });
      } catch (pushErr) {
        console.error('push (qualidade do ar) falhou:', String((pushErr && pushErr.message) || pushErr));
      }

      await sbFetch('push_estado_ar?id=eq.1', {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ municipios_criticos: criticosAgora, atualizado_em: new Date().toISOString() })
      });
    }

    res.status(200).json({ ok: true, criticos: criticosAgora, mudou: mudou, push: pushInfo });
  } catch (err) {
    res.status(500).json({ error: String((err && err.message) || err) });
  }
};
