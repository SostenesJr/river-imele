/* ============================================================
   NAVLOG AMAZÔNIA — checagem periódica de alertas climáticos (push)
   ============================================================
   Roda automaticamente todo dia (configurado em vercel.json, seção
   "crons", num horário diferente do cron do nível do rio — o plano
   Hobby da Vercel só permite 2 crons, cada um no máximo 1x por dia;
   por isso os três alertas abaixo ficam TODOS neste cron único, em vez
   de um cron por alerta). Busca, pra todos os municípios, DE NOVO aqui
   no servidor (a busca de dentro da aba Clima roda só no navegador de
   cada pessoa e não fica salva em lugar nenhum — por isso esse cron
   busca de novo, a partir do servidor, pra poder comparar com a rodada
   anterior e mandar push):

   1) Qualidade do ar — mesma escala AQI europeia da aba Clima
      (js/app.js/aqiCategoria()). Critico: AQI >= 80 (Muito ruim /
      Extremamente ruim) — geralmente fumaça de queimada na região.
   2) Chuva forte / risco de alagamento — dois sinais, qualquer um dos
      dois basta: chuva ACONTECENDO agora acima de um limiar (~10mm na
      última hora, "chuva forte" na escala do INMET), OU chuva PREVISTA
      pra hoje acima de ~50mm acumulados (referência de "chuva muito
      forte"/risco de alagamento do INMET).
   3) Risco de queimada — a Open-Meteo não tem um índice de incêndio
      pronto, então é uma ESTIMATIVA aproximada (não é um índice
      meteorológico oficial tipo o FWI canadense), combinando três
      sinais que juntos indicam mato seco + propício a alastrar fogo:
      umidade relativa baixa, vento forte e pouca chuva acumulada nos
      últimos 7 dias. Ver calcularRiscoQueimada() abaixo pros pesos
      exatos. Serve como um alerta de atenção, não como fonte oficial
      de risco de incêndio (pra isso, ver o INPE — Programa Queimadas).

   Cada um dos três alertas só manda notificação quando a LISTA de
   municípios críticos MUDA (alguém entra ou sai dela) — não a cada
   rodada do cron, senão notificaria repetido todo dia com a mesma
   situação. O estado de cada alerta fica salvo em public.push_estado
   (ver supabase/migracao-push2-alertas-clima.sql), uma linha por
   alerta (chave 'ar_criticos' / 'chuva_criticos' / 'queimada_criticos').

   Variáveis de ambiente necessárias: as mesmas do cron do nível do rio
   (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET opcional) mais
   VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY (ver api/_lib/push.js). Precisa
   também que supabase/migracao-push.sql E
   supabase/migracao-push2-alertas-clima.sql já tenham sido rodados
   (tabela push_estado).
   ============================================================ */

const { sbFetch } = require('../_lib/supabase');
const { enviarPushTodos } = require('../_lib/push');

var AQI_CRITICO_A_PARTIR_DE = 80;       // "Muito ruim" (80–100) e "Extremamente ruim" (>100)
var CHUVA_HORA_CRITICA_MM = 10;         // chuva na última hora — "forte" (escala INMET: 5–25mm/h)
var CHUVA_DIA_CRITICA_MM = 50;          // chuva acumulada prevista pra hoje — "muito forte"/risco de alagamento
var QUEIMADA_RISCO_CRITICO = 55;        // score 0–100 (ver calcularRiscoQueimada) — "Alto"/"Muito alto"

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

/* Estimativa (0–100) de risco de queimada — NÃO é um índice
   meteorológico oficial, é uma aproximação combinando três fatores que
   juntos favorecem fogo alastrando: ar seco, vento forte, pouca chuva
   recente. Cada fator contribui até um teto (40+30+30=100). */
function calcularRiscoQueimada(umidadePct, ventoKmh, chuva7dMm) {
  var score = 0;
  if (umidadePct <= 30) score += 40;
  else if (umidadePct <= 45) score += 25;
  else if (umidadePct <= 60) score += 10;

  if (ventoKmh >= 25) score += 30;
  else if (ventoKmh >= 15) score += 18;
  else if (ventoKmh >= 8) score += 8;

  if (chuva7dMm <= 2) score += 30;
  else if (chuva7dMm <= 10) score += 18;
  else if (chuva7dMm <= 25) score += 8;

  return Math.min(100, score);
}

/* Lê o estado anterior de um alerta (push_estado, por chave), compara
   com a lista de municípios críticos agora e, se mudou, manda push e
   grava o novo estado. Compartilhado pelos 3 alertas abaixo. */
async function checarEAvisar(chave, criticosAgora, montarTexto, urlHash, tag) {
  criticosAgora = criticosAgora.slice().sort();
  var linhas = await sbFetch('push_estado?select=valor&chave=eq.' + chave, { method: 'GET' });
  var criticosAntes = (linhas && linhas[0] && linhas[0].valor) || [];
  criticosAntes = criticosAntes.slice().sort();

  var mudou = JSON.stringify(criticosAgora) !== JSON.stringify(criticosAntes);
  if (!mudou) return { mudou: false, criticos: criticosAgora, push: null };

  var entraram = criticosAgora.filter(function (s) { return criticosAntes.indexOf(s) === -1; });
  var sairam = criticosAntes.filter(function (s) { return criticosAgora.indexOf(s) === -1; });

  var pushInfo = null;
  try {
    pushInfo = await enviarPushTodos({
      title: 'NavLog Amazônia',
      body: montarTexto(entraram, sairam),
      url: '/index.html' + urlHash,
      tag: tag
    });
  } catch (pushErr) {
    console.error('push (' + chave + ') falhou:', String((pushErr && pushErr.message) || pushErr));
  }

  await sbFetch('push_estado', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify([{ chave: chave, valor: criticosAgora, atualizado_em: new Date().toISOString() }])
  });

  return { mudou: true, criticos: criticosAgora, push: pushInfo };
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

    // ---- 1) Qualidade do ar ----
    var arUrl = 'https://air-quality-api.open-meteo.com/v1/air-quality?latitude=' + lats + '&longitude=' + lngs + '&current=european_aqi&timezone=auto';
    var arRes = await fetch(arUrl);
    if (!arRes.ok) throw new Error('Falha ao buscar Open-Meteo (qualidade do ar): HTTP ' + arRes.status);
    var arItens = await arRes.json();
    var arArr = Array.isArray(arItens) ? arItens : [arItens];
    var arCriticos = [];
    arArr.forEach(function (item, i) {
      var aqi = item && item.current && typeof item.current.european_aqi === 'number' ? item.current.european_aqi : null;
      if (aqi !== null && aqi >= AQI_CRITICO_A_PARTIR_DE) arCriticos.push(lista[i].seq);
    });

    // ---- 2) Chuva (tempo real + prevista) e 3) risco de queimada ----
    // Um único request cobre os dois: chuva/umidade/vento atuais, mais
    // a soma diária (past_days=7 dá os últimos 7 dias, incluindo hoje;
    // forecast_days=1 garante que "hoje" também vem no array daily).
    var climaUrl = 'https://api.open-meteo.com/v1/forecast?latitude=' + lats + '&longitude=' + lngs
      + '&current=precipitation,relative_humidity_2m,wind_speed_10m'
      + '&daily=precipitation_sum&past_days=7&forecast_days=1&timezone=auto';
    var climaRes = await fetch(climaUrl);
    if (!climaRes.ok) throw new Error('Falha ao buscar Open-Meteo (chuva/risco de queimada): HTTP ' + climaRes.status);
    var climaItens = await climaRes.json();
    var climaArr = Array.isArray(climaItens) ? climaItens : [climaItens];

    var chuvaCriticos = [];
    var queimadaCriticos = [];
    climaArr.forEach(function (item, i) {
      var seq = lista[i].seq;
      var cur = item && item.current;
      var daily = item && item.daily;
      if (!cur || !daily || !Array.isArray(daily.precipitation_sum)) return;

      var chuvaAgoraMm = typeof cur.precipitation === 'number' ? cur.precipitation : 0;
      var chuvaHojeMm = daily.precipitation_sum[daily.precipitation_sum.length - 1] || 0;
      if (chuvaAgoraMm >= CHUVA_HORA_CRITICA_MM || chuvaHojeMm >= CHUVA_DIA_CRITICA_MM) chuvaCriticos.push(seq);

      var umidade = typeof cur.relative_humidity_2m === 'number' ? cur.relative_humidity_2m : 100;
      var vento = typeof cur.wind_speed_10m === 'number' ? cur.wind_speed_10m : 0;
      // soma dos últimos 7 dias, SEM contar hoje (índice final), pra não
      // misturar "choveu muito hoje" com "semana seca" na mesma conta
      var chuva7dMm = daily.precipitation_sum.slice(0, -1).reduce(function (soma, v) { return soma + (v || 0); }, 0);
      var risco = calcularRiscoQueimada(umidade, vento, chuva7dMm);
      if (risco >= QUEIMADA_RISCO_CRITICO) queimadaCriticos.push(seq);
    });

    var resAr = await checarEAvisar('ar_criticos', arCriticos, function (entraram, sairam) {
      var partes = [];
      if (entraram.length) partes.push('entrou(aram) em alerta de ar ruim: ' + entraram.join(', '));
      if (sairam.length) partes.push('melhorou(aram): ' + sairam.join(', '));
      return partes.join(' · ') || 'A qualidade do ar mudou em um ou mais municípios.';
    }, '#w', 'navlog-qualidade-ar');

    var resChuva = await checarEAvisar('chuva_criticos', chuvaCriticos, function (entraram, sairam) {
      var partes = [];
      if (entraram.length) partes.push('chuva forte/risco de alagamento em: ' + entraram.join(', '));
      if (sairam.length) partes.push('chuva deu trégua em: ' + sairam.join(', '));
      return partes.join(' · ') || 'A situação de chuva mudou em um ou mais municípios.';
    }, '#w', 'navlog-chuva-forte');

    var resQueimada = await checarEAvisar('queimada_criticos', queimadaCriticos, function (entraram, sairam) {
      var partes = [];
      if (entraram.length) partes.push('risco alto de queimada em: ' + entraram.join(', '));
      if (sairam.length) partes.push('risco de queimada baixou em: ' + sairam.join(', '));
      return partes.join(' · ') || 'O risco de queimada mudou em um ou mais municípios.';
    }, '#w', 'navlog-risco-queimada');

    res.status(200).json({
      ok: true,
      ar: resAr,
      chuva: resChuva,
      queimada: resQueimada
    });
  } catch (err) {
    res.status(500).json({ error: String((err && err.message) || err) });
  }
};
