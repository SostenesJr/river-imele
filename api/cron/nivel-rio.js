/* ============================================================
   NAVLOG AMAZÔNIA — coleta diária do nível do Rio Negro (Manaus)
   ============================================================
   Roda automaticamente 1x por dia (configurado em vercel.json, seção
   "crons"). Busca a variação do dia em portodemanaus.com.br, soma em
   cima da última leitura salva no Supabase e grava a leitura de hoje.

   Por que "soma em cima da última leitura" em vez de ler o número
   absoluto direto da página: o número grande do topo da página é
   preenchido por JavaScript no navegador (não vem pronto no HTML), mas
   a variação do dia ("Vazou: -18.00cm" / "Encheu: 12.00cm") vem como
   texto simples no HTML, então é o dado mais confiável pra extrair sem
   precisar de um navegador de verdade rodando aqui. Como fallback, se a
   tabela mensal também trouxer um valor absoluto pra data de hoje, ele é
   usado pra corrigir qualquer desvio acumulado.

   Variáveis de ambiente necessárias (configurar no painel da Vercel,
   Project Settings → Environment Variables):
     SUPABASE_URL              — mesma URL do js/supabase-config.js
     SUPABASE_SERVICE_ROLE_KEY — a chave "service_role" (Project Settings
                                  → API Keys no Supabase — NUNCA a mesma
                                  chave "anon" usada no site, e nunca
                                  colocar essa chave em código público)
     CRON_SECRET                — opcional, mas recomendado: uma senha
                                  qualquer só sua, pra ninguém além da
                                  Vercel conseguir chamar essa rota

   Desde a notificação push "qualquer mudança" (ver README, seção
   "Notificações push"), esse cron também manda um push pra quem ativou
   notificações sempre que o REGIME do rio muda de faixa (ex.: Seca →
   Seca severa, Normal → Atenção) em relação à leitura anterior — não a
   cada leitura diária, só quando a faixa muda de verdade. Usa
   api/_lib/regime.js (cópia server-side de NIVEL_REGIMES) e
   api/_lib/push.js (envio via Web Push). Variáveis extra necessárias
   pra isso: VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY (ver api/_lib/push.js).
   ============================================================ */

const { sbFetch } = require('../_lib/supabase');
const { classificarNivel } = require('../_lib/regime');
const { enviarPushTodos } = require('../_lib/push');

const FONTE_URL = 'https://portodemanaus.com.br/nivel-do-rio-negro/';
const FONTE_NOME = 'Porto de Manaus';

function htmlParaTexto(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function numBR(s) {
  return parseFloat(String(s).replace(',', '.'));
}

/* Acha "DD/MM/YYYY ... (Vazou|Encheu): [+-]?N.NN cm" no texto da página
   e devolve { data: 'YYYY-MM-DD', variacaoCm: number, tendencia }. */
function extrairVariacaoDoDia(texto) {
  var re = /(\d{2})\/(\d{2})\/(\d{4})[\s\S]{0,120}?(Vazou|Encheu)\s*[:\-]?\s*([+-]?\d{1,3}[.,]\d{1,2})\s*cm/i;
  var m = texto.match(re);
  if (!m) return null;
  var dd = m[1], mm = m[2], yyyy = m[3];
  var tipo = m[4].toLowerCase();
  var valor = Math.abs(numBR(m[5]));
  var variacaoCm = tipo === 'vazou' ? -valor : valor;
  var tendencia = variacaoCm > 0 ? 'subindo' : (variacaoCm < 0 ? 'descendo' : 'estavel');
  return { data: yyyy + '-' + mm + '-' + dd, variacaoCm: variacaoCm, tendencia: tendencia };
}

/* Tenta achar, na tabela do mês, um valor absoluto de cota (m) pra
   corrigir desvio acumulado — best effort, não é obrigatório pro
   funcionamento (se não achar, segue só com a soma da variação). */
function extrairCotaAbsoluta(texto, dataISO) {
  var dia = parseInt(dataISO.slice(8, 10), 10);
  var re = new RegExp('(?:^|[^0-9])' + dia + '\\s+(\\d{1,2}[.,]\\d{2})\\s+[+-]?\\d{1,3}[.,]\\d{1,2}\\b');
  var m = texto.match(re);
  if (!m) return null;
  var v = numBR(m[1]);
  return (v > 5 && v < 35) ? v : null; // faixa plausível de cota em Manaus, evita pegar lixo
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
      res.status(500).json({ error: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY não configuradas nas variáveis de ambiente da Vercel' });
      return;
    }

    var pagRes = await fetch(FONTE_URL, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NavLogAmazonia/1.0)' } });
    if (!pagRes.ok) throw new Error('Falha ao buscar ' + FONTE_URL + ': HTTP ' + pagRes.status);
    var html = await pagRes.text();
    var texto = htmlParaTexto(html);

    var variacao = extrairVariacaoDoDia(texto);
    if (!variacao) {
      res.status(422).json({ error: 'não consegui reconhecer a variação do dia na página-fonte (o site pode ter mudado o layout)' });
      return;
    }

    // já temos leitura pra esse dia? não faz nada (evita duplicar/rodar 2x)
    var existente = await sbFetch('nivel_rio?data=eq.' + variacao.data + '&select=data', { method: 'GET' });
    if (existente && existente.length) {
      res.status(200).json({ ok: true, info: 'leitura de ' + variacao.data + ' já existia, nada a fazer' });
      return;
    }

    var ultima = await sbFetch('nivel_rio?select=data,nivel_m&order=data.desc&limit=1', { method: 'GET' });
    if (!ultima || !ultima.length) {
      res.status(500).json({ error: 'tabela nivel_rio está vazia — rode o INSERT âncora do supabase/nivel_rio.sql antes de ativar o cron' });
      return;
    }

    var nivelCalculado = Math.round((ultima[0].nivel_m + variacao.variacaoCm / 100) * 100) / 100;
    var nivelAbsoluto = extrairCotaAbsoluta(texto, variacao.data);
    // se achou um valor absoluto plausível e ele bate razoavelmente perto
    // do calculado, prefere o absoluto (corrige qualquer arredondamento
    // acumulado); senão fica com o calculado
    var nivelFinal = (nivelAbsoluto !== null && Math.abs(nivelAbsoluto - nivelCalculado) < 0.5) ? nivelAbsoluto : nivelCalculado;

    await sbFetch('nivel_rio', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([{
        data: variacao.data,
        nivel_m: nivelFinal,
        variacao_cm: variacao.variacaoCm,
        tendencia: variacao.tendencia,
        fonte: FONTE_NOME
      }])
    });

    // Regime mudou de faixa em relação à leitura anterior? Manda push.
    // (não é obrigatório pro resto do cron funcionar — se o push falhar
    // por qualquer motivo, a leitura já foi gravada normalmente acima.)
    var pushInfo = null;
    try {
      var regimeAntes = classificarNivel(ultima[0].nivel_m);
      var regimeDepois = classificarNivel(nivelFinal);
      if (regimeAntes.label !== regimeDepois.label) {
        pushInfo = await enviarPushTodos({
          title: 'NavLog Amazônia — nível do rio',
          body: 'O regime do Rio Negro em Manaus mudou de "' + regimeAntes.nome + '" para "' + regimeDepois.nome + '" (' + nivelFinal.toFixed(2).replace('.', ',') + 'm).',
          url: '/index.html#n',
          tag: 'navlog-nivel-rio'
        });
      }
    } catch (pushErr) {
      console.error('push (nível do rio) falhou, seguindo mesmo assim:', String((pushErr && pushErr.message) || pushErr));
    }

    res.status(200).json({
      ok: true, data: variacao.data, nivel_m: nivelFinal,
      variacao_cm: variacao.variacaoCm, tendencia: variacao.tendencia,
      corrigido_por_tabela: nivelFinal === nivelAbsoluto,
      push: pushInfo
    });
  } catch (err) {
    res.status(500).json({ error: String((err && err.message) || err) });
  }
};
