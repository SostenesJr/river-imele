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

   Cada um dos três alertas acima só manda notificação quando a LISTA
   de municípios críticos MUDA (alguém entra ou sai dela) — não a cada
   rodada do cron, senão notificaria repetido todo dia com a mesma
   situação. O estado de cada alerta fica salvo em public.push_estado
   (ver supabase/migracao-push2-alertas-clima.sql), uma linha por
   alerta (chave 'ar_criticos' / 'chuva_criticos' / 'queimada_criticos').

   4) Alerta de emergência (seca/cheia/geral) por município — raspagem
      automática do feed de notícias da Agência Brasil (agência de
      imprensa oficial do governo federal), filtrando por palavra-chave
      de desastre + nome do município. Diferente dos três alertas acima
      (que são 100% automáticos, sem revisão humana), este NUNCA chega
      direto ao cliente: cada acerto fica como CANDIDATO
      (`alerta.confirmado:false`) na coluna `alerta` de
      `municipios_info`, visível só pro admin em Configurações, até
      alguém confirmar ou descartar manualmente (ver
      `alertaMunicipioEditHTML()`/`confirmarAlerta()`/`limparAlerta()`
      em js/app.js). Só depois de confirmado é que aparece na aba
      Informações, pra todo mundo — ver README, seção "Alerta de
      emergência por município". Precisa que
      supabase/migracao-alerta-emergencia.sql já tenha sido rodado
      (colunas `alerta`/`alerta_dispensados`).

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

var AGENCIA_BRASIL_RSS_URL = 'https://agenciabrasil.ebc.com.br/rss/ultimasnoticias/feed.xml';
// Palavras-chave de desastre (normalizadas: minúsculo, sem acento) que
// classificam o TIPO do alerta quando aparecem perto do nome de um
// município na mesma notícia. Lista pequena de propósito — é só um
// filtro grosseiro pra gerar CANDIDATOS; a precisão final vem da
// revisão humana (admin confirma/descarta em Configurações), não desta
// lista.
var ALERTA_KEYWORDS_SECA = ['seca', 'estiagem'];
var ALERTA_KEYWORDS_CHEIA = ['enchente', 'cheia', 'inundacao', 'alagamento', 'transbordamento'];
var ALERTA_KEYWORDS_GERAL = ['calamidade', 'emergencia'];

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

/* Mesma ideia de carregarLatLng() acima, mas extraindo `const ROTAS =
   [...]` do próprio js/data.js pra pegar o NOME completo de cada
   município (ex. 'Autazes', 'Sao Sebastiao do Uatuma') — só usado pela
   checagem 4 (notícias), pra casar o texto da notícia com o município
   pelo nome, já que LATLNG só tem o código de 3 letras. Inclui também
   Manaus (MAO), que não faz parte de nenhuma ROTA. */
async function carregarMunicipiosNomes(req) {
  var host = req.headers['x-forwarded-host'] || req.headers['host'];
  var proto = req.headers['x-forwarded-proto'] || 'https';
  var url = proto + '://' + host + '/js/data.js';
  var r = await fetch(url);
  if (!r.ok) throw new Error('Falha ao buscar ' + url + ' pra extrair ROTAS: HTTP ' + r.status);
  var texto = await r.text();
  var m = texto.match(/const ROTAS\s*=\s*(\[[\s\S]*?\]);/);
  if (!m) throw new Error('não encontrei "const ROTAS = [...]" em js/data.js (o arquivo pode ter mudado de formato)');
  // eslint-disable-next-line no-new-func
  var rotas = new Function('return ' + m[1])();
  var lista = [{ seq: 'MAO', nome: 'Manaus' }];
  rotas.forEach(function (rota) {
    (rota.municipios || []).forEach(function (mu) { lista.push({ seq: mu.seq, nome: mu.nome }); });
  });
  return lista;
}

/* minúsculo + sem acento, pra comparar texto de notícia com nome de
   município sem depender de acentuação bater certinho dos dois lados */
function normalizarTexto(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function classificarAlertaTipo(textoNorm) {
  if (ALERTA_KEYWORDS_SECA.some(function (k) { return textoNorm.indexOf(k) !== -1; })) return 'seca';
  if (ALERTA_KEYWORDS_CHEIA.some(function (k) { return textoNorm.indexOf(k) !== -1; })) return 'cheia';
  if (ALERTA_KEYWORDS_GERAL.some(function (k) { return textoNorm.indexOf(k) !== -1; })) return 'geral';
  return null;
}

/* Extrai o conteúdo de uma tag XML simples (<tag>texto</tag> ou
   <tag><![CDATA[texto]]></tag>) de dentro de um bloco de texto —
   parser "na mão" de propósito (feed pequeno, não vale a pena trazer
   uma dependência de XML só pra isso). */
function extrairTagXML(bloco, tag) {
  var re = new RegExp('<' + tag + '[^>]*>([\\s\\S]*?)<\\/' + tag + '>', 'i');
  var m = bloco.match(re);
  if (!m) return '';
  var v = m[1];
  var cdata = v.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  if (cdata) v = cdata[1];
  return v.trim();
}

/* Busca o feed RSS da Agência Brasil (agência de notícias oficial do
   governo federal) e devolve uma lista simples [{titulo, descricao,
   link, data}] — `data` já convertida pra 'YYYY-MM-DD' (hoje, se o
   pubDate não vier num formato reconhecível). NÃO é um feed de alertas
   oficiais nem específico do Amazonas — é notícia geral do Brasil,
   por isso a filtragem por palavra-chave + nome de município
   (detectarCandidatosAlerta(), abaixo) e a confirmação manual depois. */
async function buscarNoticiasAgenciaBrasil() {
  var r = await fetch(AGENCIA_BRASIL_RSS_URL, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NavLogAmazonia/1.0)' } });
  if (!r.ok) throw new Error('Falha ao buscar ' + AGENCIA_BRASIL_RSS_URL + ': HTTP ' + r.status);
  var xml = await r.text();
  var blocos = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];
  var hojeISO = new Date().toISOString().slice(0, 10);
  return blocos.map(function (bloco) {
    var titulo = extrairTagXML(bloco, 'title');
    var descricao = extrairTagXML(bloco, 'description');
    var link = extrairTagXML(bloco, 'link');
    var pubDate = extrairTagXML(bloco, 'pubDate');
    var dataObj = pubDate ? new Date(pubDate) : null;
    var data = (dataObj && !isNaN(dataObj.getTime())) ? dataObj.toISOString().slice(0, 10) : hojeISO;
    return { titulo: titulo, descricao: descricao, link: link, data: data };
  }).filter(function (item) { return item.titulo && item.link; });
}

/* Casa cada notícia com cada município (pelo NOME, não pelo código) —
   só conta como candidato quando a mesma notícia tem uma palavra-chave
   de desastre E o nome do município, os dois juntos. Fica só com o
   PRIMEIRO município+notícia que bater por município (não sobrescreve
   dentro da mesma rodada). */
function detectarCandidatosAlerta(municipios, itens) {
  var candidatos = {};
  itens.forEach(function (item) {
    var textoNorm = normalizarTexto(item.titulo + ' ' + item.descricao);
    var tipo = classificarAlertaTipo(textoNorm);
    if (!tipo) return;
    municipios.forEach(function (mu) {
      if (candidatos[mu.seq]) return;
      var nomeNorm = normalizarTexto(mu.nome);
      if (nomeNorm.length < 4) return; // nome curto demais — risco alto de falso positivo
      if (textoNorm.indexOf(nomeNorm) === -1) return;
      candidatos[mu.seq] = { tipo: tipo, titulo: item.titulo, texto: item.descricao.slice(0, 280), fonte_url: item.link, desde: item.data };
    });
  });
  return candidatos;
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

    // ---- 4) Notícias (Agência Brasil) — candidatos de alerta de emergência ----
    // Nunca falha o cron inteiro: se a raspagem de notícias der qualquer
    // problema (feed fora do ar, formato mudou), os 3 alertas acima já
    // rodaram normalmente — só essa 4ª checagem fica pra próxima rodada.
    var noticiasResumo = { novosCandidatos: [], erro: null };
    try {
      var municipiosNomes = await carregarMunicipiosNomes(req);
      var itensNoticias = await buscarNoticiasAgenciaBrasil();
      var candidatos = detectarCandidatosAlerta(municipiosNomes, itensNoticias);
      var seqsComCandidato = Object.keys(candidatos);

      if (seqsComCandidato.length) {
        // busca o estado atual de TODOS os municípios (tabela pequena,
        // ~57 linhas) em vez de filtrar por seq na URL — evita lidar
        // com caracteres especiais (ex. 'PFI/BALBINA') num filtro `in.()`
        var todasLinhas = await sbFetch('municipios_info?select=seq,alerta,alerta_dispensados', { method: 'GET' });
        var atuaisPorSeq = {};
        (todasLinhas || []).forEach(function (row) { atuaisPorSeq[row.seq] = row; });

        var paraGravar = [];
        seqsComCandidato.forEach(function (seq) {
          var novo = candidatos[seq];
          var atual = atuaisPorSeq[seq] || {};
          var alertaAtual = atual.alerta || null;
          var dispensados = atual.alerta_dispensados || [];
          if (dispensados.indexOf(novo.fonte_url) !== -1) return;            // admin já descartou essa notícia pra esse município
          if (alertaAtual && alertaAtual.fonte_url === novo.fonte_url) return; // já é candidato/confirmado com essa mesma notícia
          if (alertaAtual && alertaAtual.confirmado) return;                  // alerta já confirmado em aberto — só um admin decide, cron não sobrescreve
          paraGravar.push({ seq: seq, alerta: { tipo: novo.tipo, titulo: novo.titulo, texto: novo.texto, fonte_url: novo.fonte_url, desde: novo.desde, confirmado: false } });
          noticiasResumo.novosCandidatos.push(seq);
        });

        if (paraGravar.length) {
          await sbFetch('municipios_info', {
            method: 'POST',
            headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
            body: JSON.stringify(paraGravar)
          });
          try {
            await enviarPushTodos({
              title: 'NavLog Amazônia — possível alerta',
              body: 'Notícia automática aponta possível emergência em: ' + noticiasResumo.novosCandidatos.join(', ') + '. Revise em Configurações.',
              url: '/index.html#c',
              tag: 'navlog-alerta-emergencia'
            });
          } catch (pushErr) {
            console.error('push (alerta de emergência) falhou:', String((pushErr && pushErr.message) || pushErr));
          }
        }
      }
    } catch (noticiasErr) {
      noticiasResumo.erro = String((noticiasErr && noticiasErr.message) || noticiasErr);
      console.error('checagem de notícias (Agência Brasil) falhou, seguindo mesmo assim:', noticiasResumo.erro);
    }

    res.status(200).json({
      ok: true,
      ar: resAr,
      chuva: resChuva,
      queimada: resQueimada,
      noticias: noticiasResumo
    });
  } catch (err) {
    res.status(500).json({ error: String((err && err.message) || err) });
  }
};
