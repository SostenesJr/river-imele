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
   ============================================================ */

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

async function sbFetch(path, opts) {
  var url = process.env.SUPABASE_URL + '/rest/v1/' + path;
  var headers = Object.assign({
    apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: 'Bearer ' + process.env.SUPABASE_SERVICE_ROLE_KEY,
    'Content-Type': 'application/json'
  }, (opts && opts.headers) || {});
  var res = await fetch(url, Object.assign({}, opts, { headers: headers }));
  if (!res.ok) {
    var body = await res.text().catch(function () { return ''; });
    throw new Error('Supabase ' + res.status + ': ' + body);
  }
  return res.status === 204 ? null : res.json();
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

    res.status(200).json({
      ok: true, data: variacao.data, nivel_m: nivelFinal,
      variacao_cm: variacao.variacaoCm, tendencia: variacao.tendencia,
      corrigido_por_tabela: nivelFinal === nivelAbsoluto
    });
  } catch (err) {
    res.status(500).json({ error: String((err && err.message) || err) });
  }
};
