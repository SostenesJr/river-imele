/* ============================================================
   NAVLOG AMAZÔNIA — APP.JS
   4 abas: Rotas · Informações · Configurações · Mapa
   ============================================================ */

var cur = 'r';
var CURRENT_USER = null; // { id, email, role } — usuário logado (Supabase Auth); role: 'admin' | 'cliente'
var CONFIG_EMPRESA = { nome_empresa: null, logo_url: null }; // nome/logo mostrados no cabeçalho pra todo mundo

/* Perfil de acesso: 'admin' edita tudo (Configurações); 'cliente' só
   visualiza (Rotas/Informações/Mapa/Notícias). Se o usuário logado ainda
   não tiver uma linha em `perfis`, o padrão é 'cliente' (mais seguro) —
   quem administra o Supabase precisa cadastrar o primeiro admin manualmente
   (ver README, seção "Como configurar o Supabase"). */
async function carregarPerfil() {
  var res = await sb.from('perfis').select('role,nome').eq('user_id', CURRENT_USER.id);
  if (res.error) { console.error('Erro ao carregar perfil:', res.error); CURRENT_USER.role = 'cliente'; return; }
  var row = (res.data && res.data[0]) || null;
  CURRENT_USER.role = (row && row.role) || 'cliente';
}

function souAdmin() { return !!(CURRENT_USER && CURRENT_USER.role === 'admin'); }

/* Esconde a aba Configurações (desktop e mobile) pra quem não for admin,
   e tira a pessoa de lá se por acaso estiver com essa aba selecionada. */
function aplicarGateAdmin() {
  var admin = souAdmin();
  document.querySelectorAll('.htab[data-s="c"], #bt-c').forEach(function (el) {
    el.style.display = admin ? '' : 'none';
  });
  if (!admin && cur === 'c') SS('r', null);
}

async function carregarConfigEmpresa() {
  var res = await sb.from('config_empresa').select('nome_empresa,logo_url').eq('id', 1);
  if (res.error) { console.error('Erro ao carregar config_empresa:', res.error); return; }
  var row = (res.data && res.data[0]) || null;
  CONFIG_EMPRESA = { nome_empresa: (row && row.nome_empresa) || null, logo_url: (row && row.logo_url) || null };
  aplicarBranding();
}

function aplicarBranding() {
  var lt = document.querySelector('#hdr .lt');
  if (lt) lt.textContent = CONFIG_EMPRESA.nome_empresa || 'NAVLOG AMAZÔNIA';
  var dotWrap = document.querySelector('#hdr .dot');
  if (dotWrap) {
    if (CONFIG_EMPRESA.logo_url) {
      dotWrap.outerHTML = '<img class="hdr-logo" src="' + CONFIG_EMPRESA.logo_url.replace(/"/g, '&quot;') + '" alt="Logo">';
    }
  }
}

/* ── Tema claro/escuro ──
   Preferência de cada aparelho (não é dado da empresa, então fica só no
   localStorage do navegador, não no Supabase). O index.html e o login.html
   já aplicam o tema salvo ANTES de pintar a tela (script inline no <head>),
   pra não dar aquele "flash" trocando de tema na hora de abrir. */
function aplicarTema(tema) {
  document.documentElement.setAttribute('data-theme', tema);
  try { localStorage.setItem('navlog-theme', tema); } catch (e) { /* ignora: modo privado etc. */ }
  var btn = document.getElementById('theme-btn');
  if (btn) btn.textContent = tema === 'light' ? '🌙' : '☀️';
}
function alternarTema() {
  var atual = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  aplicarTema(atual === 'light' ? 'dark' : 'light');
}

async function salvarConfigEmpresa() {
  var nomeEl = document.getElementById('in-empresa-nome');
  var logoEl = document.getElementById('in-empresa-logo');
  if (!nomeEl || !logoEl) return;
  var nome = nomeEl.value.trim();
  var logo = logoEl.value.trim();
  var btn = document.querySelector('.empresa-card .sh-save');
  if (btn) { btn.disabled = true; btn.textContent = 'Salvando...'; }
  var res = await sb.from('config_empresa').upsert({ id: 1, nome_empresa: nome || null, logo_url: logo || null }, { onConflict: 'id' });
  if (res.error) {
    alert('Não consegui salvar: ' + res.error.message);
    if (btn) { btn.disabled = false; btn.textContent = '✓ Salvar dados da empresa'; }
    return;
  }
  CONFIG_EMPRESA = { nome_empresa: nome || null, logo_url: logo || null };
  aplicarBranding();
  if (btn) {
    btn.disabled = false; btn.textContent = '✓ Salvo!';
    setTimeout(function () { if (btn) btn.textContent = '✓ Salvar dados da empresa'; }, 1500);
  }
}

/* ── Login (contas individuais via Supabase Auth) ── */
function sair() {
  sb.auth.signOut().then(function () { window.location.href = '/login.html'; })
    .catch(function () { window.location.href = '/login.html'; });
}

function normKey(s) { return (s||'').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }

/* Indice unico: codigo do node (seq) -> registro completo (rota + municipio + vizinhos). */
const NODEIDX = {};
ROTAS.forEach(function (rota) {
  rota.municipios.forEach(function (mun, i) {
    NODEIDX[mun.seq] = {
      rota: rota,
      mun: mun,
      pos: i + 1,
      total: rota.municipios.length,
      prev: rota.municipios[i - 1] || null,
      next: rota.municipios[i + 1] || null
    };
  });
});

/* ============================================================
   PERSISTENCIA — Supabase (banco de dados compartilhado)
   MUNINFO (data.js) é usada só como valor "de fábrica" — pra quando
   um município ainda não tem linha no banco, e como o que volta ao
   clicar "Restaurar original". Os dados de verdade (o que aparece
   pra todo mundo, de qualquer aparelho) vêm de MUNINFO_LIVE, que é
   carregada do Supabase em carregarMunicipiosInfo().
   ============================================================ */
var MUNINFO_LIVE = {}; // seq -> {ta, ps:{seca,cheia}, emb:[...]}

function rowToInfo(row) {
  return {
    ta: row.ta,
    ps: { seca: row.ps_seca, cheia: row.ps_cheia },
    emb: row.emb || []
  };
}

async function carregarMunicipiosInfo() {
  var res = await sb.from('municipios_info').select('*');
  if (res.error) { console.error('Erro ao carregar municipios_info:', res.error); return; }
  var live = {};
  (res.data || []).forEach(function (row) { live[row.seq] = rowToInfo(row); });
  MUNINFO_LIVE = live;
}

/* Devolve o registro efetivo (banco, ou o "de fábrica" se ainda não
   existir linha pra esse município). */
function getInfo(seq) {
  var fonte = MUNINFO_LIVE[seq] || MUNINFO[seq]
    || { ta: null, ps: { seca: null, cheia: null }, emb: [] };
  return JSON.parse(JSON.stringify(fonte)); // clona pra nao vazar referencia
}

/* Salva no banco (compartilhado com todo mundo) e atualiza o cache local. */
async function setInfo(seq, info) {
  var res = await sb.from('municipios_info').upsert({
    seq: seq,
    ta: info.ta,
    ps_seca: info.ps.seca,
    ps_cheia: info.ps.cheia,
    emb: info.emb
  }, { onConflict: 'seq' });
  if (res.error) { alert('Não consegui salvar: ' + res.error.message); throw res.error; }
  MUNINFO_LIVE[seq] = JSON.parse(JSON.stringify(info));
}

/* "Restaurar original" agora escreve os valores de fábrica de volta
   no banco — vale pra equipe toda, não só pra quem clicou. */
async function resetInfo(seq) {
  var original = MUNINFO[seq] || { ta: null, ps: { seca: null, cheia: null }, emb: [] };
  await setInfo(seq, JSON.parse(JSON.stringify(original)));
}

/* ── Observações pessoais por município — cada usuário só vê e edita
   as próprias (RLS no banco garante isso), salvas no Supabase. ── */
var OBS = {}; // seq -> texto (do usuario atual)
var obsSaveTimers = {};

async function carregarObs() {
  if (!CURRENT_USER) return;
  var res = await sb.from('observacoes').select('*').eq('user_id', CURRENT_USER.id);
  if (res.error) { console.error('Erro ao carregar observações:', res.error); return; }
  var novo = {};
  (res.data || []).forEach(function (row) { novo[row.seq] = row.texto; });
  OBS = novo;
}

function getObs(seq) { return OBS[seq] || ''; }

/* Salva com debounce (600ms depois de parar de digitar) pra não bater
   no banco a cada tecla. */
function setObs(seq, texto) {
  OBS[seq] = texto || '';
  if (obsSaveTimers[seq]) clearTimeout(obsSaveTimers[seq]);
  obsSaveTimers[seq] = setTimeout(function () { salvarObsRemoto(seq); }, 600);
}

function salvarObsRemoto(seq) {
  if (!CURRENT_USER) return;
  var texto = OBS[seq] || '';
  sb.from('observacoes').upsert({
    seq: seq,
    user_id: CURRENT_USER.id,
    texto: texto,
    updated_at: new Date().toISOString()
  }, { onConflict: 'seq,user_id' }).then(function (res) {
    if (res.error) console.error('Erro ao salvar observação:', res.error);
  });
}

/* ============================================================
   ABA "NOTÍCIAS" — nível do Rio Negro em Manaus
   Os dados vêm da tabela nivel_rio, alimentada 1x por dia por uma
   função da Vercel (api/cron/nivel-rio.js) que lê portodemanaus.com.br
   e grava no Supabase — o app só LÊ essa tabela, nunca escreve nela.
   ============================================================ */
var NIVEL_HIST = []; // [{data,nivel_m,variacao_cm,tendencia,fonte}], mais antigo -> mais novo

// Faixa de referência pro medidor visual e pro selo de regime (Seca /
// Normal / Atenção / Alerta / Emergência). O site-fonte (portodemanaus.com.br)
// só informa o valor do dia e se subiu ou desceu — ele mesmo não classifica
// se "está seco" ou "está cheio". Os cortes usados aqui vêm de referências
// oficiais sobre o Rio Negro em Manaus:
//   - Cota de atenção 27,00m / cota de alerta (inundação) 27,50m / cota de
//     emergência 29,00m — Defesa Civil de Manaus e SGB (Serviço Geológico
//     do Brasil), noticiado em 2026.
//   - Não existe uma "cota de seca" oficial equivalente pro lado baixo; o
//     corte de Seca usado aqui é uma referência informal, com base no
//     registro histórico (mínima de 12,70m em out/2023 — a pior seca em
//     121 anos de medição). Por isso o lado de cheia é uma cota oficial e
//     o de seca é uma aproximação — isso fica avisado no rodapé do medidor.
// "critico:true" dispara o banner de alerta + o selinho pulsante nas abas
// Notícias (ver nivelAlertaHTML() e atualizarAlertaAba() abaixo). Do lado
// da seca não tem cota oficial de "emergência" (é decreto do prefeito,
// caso a caso) — por isso o corte crítico aqui (abaixo de 15m) é só uma
// referência aproximada da mínima histórica, não uma cota oficial.
var NIVEL_ESCALA_MIN = 11, NIVEL_ESCALA_MAX = 30;
var NIVEL_REGIMES = [
  { ate: 15,   label: 'Seca severa',         classe: 'seca-severa', cor: '#ea580c', critico: true  },
  { ate: 19,   label: 'Seca',                classe: 'seca',        cor: '#f59e0b', critico: false },
  { ate: 27,   label: 'Normal',               classe: 'normal',     cor: '#14b8a6', critico: false },
  { ate: 27.5, label: 'Atenção',              classe: 'atencao',    cor: '#eab308', critico: true  },
  { ate: 29,   label: 'Alerta (cheia)',       classe: 'alerta',     cor: '#3b82c4', critico: true  },
  { ate: 99,   label: 'Emergência (cheia)',   classe: 'emergencia', cor: '#ef4444', critico: true  }
];
function classificarNivel(nivel) {
  for (var i = 0; i < NIVEL_REGIMES.length; i++) {
    if (nivel <= NIVEL_REGIMES[i].ate) return NIVEL_REGIMES[i];
  }
  return NIVEL_REGIMES[NIVEL_REGIMES.length - 1];
}

var NIVEL_ALERTA_TEXTOS = {
  'seca-severa': 'Rio numa faixa de seca severa, próxima da mínima histórica. Pode afetar a passagem de embarcações com mais calado em trechos rasos.',
  'atencao':     'Rio na cota de atenção (Defesa Civil de Manaus/SGB). Ainda sem restrição, mas vale acompanhar de perto.',
  'alerta':      'Rio na cota de alerta/inundação (Defesa Civil de Manaus/SGB). Pode afetar áreas mais baixas e o acesso a alguns portos/trapiches.',
  'emergencia':  'Rio na cota de emergência (Defesa Civil de Manaus/SGB) — nível de inundação severa.'
};
/* Banner chamativo no topo da aba Notícias quando o nível entra numa faixa
   crítica (ver campo "critico" em NIVEL_REGIMES) — o selo discreto ao lado
   do valor já existia, isso aqui é só pra quem não repara no selo. */
function nivelAlertaHTML(regime) {
  if (!regime.critico) return '';
  var texto = NIVEL_ALERTA_TEXTOS[regime.classe] || '';
  return '<div class="niv-alert-banner ' + regime.classe + '">'
    + '<span class="niv-alert-ic">⚠️</span>'
    + '<div><div class="niv-alert-tt">Nível do rio em ' + regime.label + '</div>'
    + '<div class="niv-alert-tx">' + texto + '</div></div>'
    + '</div>';
}
/* Selinho vermelho pulsante nas abas Notícias (cabeçalho + menu mobile),
   visível de qualquer aba, pra avisar sobre um nível crítico sem precisar
   entrar na aba Notícias. */
function atualizarAlertaAba(critico) {
  document.querySelectorAll('.htab[data-s="n"], #bt-n').forEach(function (el) {
    var existente = el.querySelector('.tab-alert-dot');
    if (critico && !existente) el.insertAdjacentHTML('beforeend', '<span class="tab-alert-dot" title="Nível do rio em faixa crítica"></span>');
    if (!critico && existente) existente.remove();
  });
}

async function carregarNivelRio() {
  // Precisa dos 400 dias MAIS RECENTES (não os mais antigos) — por isso
  // busca em ordem decrescente e depois inverte pra ascendente, já que
  // agora a tabela pode ter milhares de linhas (histórico desde 2000).
  var res = await sb.from('nivel_rio').select('*').order('data', { ascending: false }).limit(400);
  if (res.error) { console.error('Erro ao carregar nivel_rio:', res.error); return; }
  NIVEL_HIST = (res.data || []).map(function (row) {
    return { data: row.data, nivel_m: Number(row.nivel_m), variacao_cm: Number(row.variacao_cm), tendencia: row.tendencia, fonte: row.fonte };
  }).reverse();
}

function nivelDoAnoPassado(hoje) {
  // Procura a leitura de exatamente 1 ano atrás; se não tiver (ex: 29/fev),
  // aceita até 3 dias de diferença pra ainda mostrar uma comparação útil.
  var p = hoje.split('-');
  var alvoISO = (Number(p[0]) - 1) + '-' + p[1] + '-' + p[2];
  var porData = {};
  NIVEL_HIST.forEach(function (h) { porData[h.data] = h; });
  if (porData[alvoISO]) return { item: porData[alvoISO], exato: true };
  var alvoMs = new Date(alvoISO + 'T00:00:00Z').getTime();
  var melhor = null, melhorDist = Infinity;
  NIVEL_HIST.forEach(function (h) {
    var dist = Math.abs(new Date(h.data + 'T00:00:00Z').getTime() - alvoMs);
    if (dist < melhorDist && dist <= 3 * 86400000) { melhorDist = dist; melhor = h; }
  });
  return melhor ? { item: melhor, exato: false } : null;
}

function fmtDataBR(iso) {
  var p = iso.split('-'); return p[2] + '/' + p[1] + '/' + p[0];
}

function niveTrendIcone(t) { return t === 'subindo' ? '📈' : (t === 'descendo' ? '📉' : '➖'); }
function niveTrendTexto(t) { return t === 'subindo' ? 'Enchendo' : (t === 'descendo' ? 'Vazando' : 'Estável'); }

function nivelGaugeHTML(nivel) {
  var min = NIVEL_ESCALA_MIN, max = NIVEL_ESCALA_MAX;
  var pct = Math.max(0, Math.min(100, (nivel - min) / (max - min) * 100));
  var zonasHTML = '', anterior = min;
  NIVEL_REGIMES.forEach(function (z) {
    var largura = (Math.min(z.ate, max) - anterior) / (max - min) * 100;
    if (largura > 0) zonasHTML += '<div class="niv-gauge-zone" style="width:' + largura + '%;background:' + z.cor + '"></div>';
    anterior = z.ate;
  });
  return '<div class="niv-gauge-wrap">'
    + '<div class="niv-gauge">' + zonasHTML + '<div class="niv-gauge-marker" style="left:' + pct + '%"></div></div>'
    + '<div class="niv-gauge-labels"><span>Seca</span><span>Normal</span><span>Atenção/Alerta/Emergência</span></div>'
    + '<div class="niv-gauge-note">Lado da cheia usa as cotas oficiais da Defesa Civil de Manaus/SGB (atenção 27,00m · alerta 27,50m · emergência 29,00m). Não existe cota oficial de seca — o corte de 19,00m é uma referência informal, com base na mínima histórica (12,70m, a pior seca em 121 anos, out/2023).</div>'
    + '</div>';
}

function nivelChartSVG(hist) {
  if (hist.length < 2) return '';
  var W = 600, H = 140, PAD = 10;
  var vals = hist.map(function (h) { return h.nivel_m; });
  var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
  if (min === max) { min -= 1; max += 1; }
  var pts = hist.map(function (h, i) {
    var x = PAD + (i / (hist.length - 1)) * (W - PAD * 2);
    var y = H - PAD - ((h.nivel_m - min) / (max - min)) * (H - PAD * 2);
    return x + ',' + y;
  });
  var last = hist[hist.length - 1];
  var lastPt = pts[pts.length - 1].split(',');
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">'
    + '<polyline points="' + pts.join(' ') + '" fill="none" stroke="#2f9bd6" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>'
    + '<circle cx="' + lastPt[0] + '" cy="' + lastPt[1] + '" r="4" fill="#2f9bd6"/>'
    + '</svg>'
    + '<div style="display:flex;justify-content:space-between;font-size:9px;color:var(--mu);margin-top:4px">'
    + '<span>mín ' + min.toFixed(2) + 'm</span><span>máx ' + max.toFixed(2) + 'm</span></div>';
}

function bNIVEL() {
  var body = document.getElementById('nbdy'); if (!body) return;

  if (!NIVEL_HIST.length) {
    body.innerHTML = '<div class="niv-empty">Ainda não tem nenhuma leitura do nível do rio salva.<br>A coleta automática roda 1x por dia — volte mais tarde.</div>';
    atualizarAlertaAba(false);
    return;
  }

  var atual = NIVEL_HIST[NIVEL_HIST.length - 1];
  var historico90 = NIVEL_HIST.slice(-90);
  var feedItens = NIVEL_HIST.slice().reverse().slice(0, 14);
  var anoPassado = nivelDoAnoPassado(atual.data);

  var compHTML = '';
  if (anoPassado) {
    var diff = Math.round((atual.nivel_m - anoPassado.item.nivel_m) * 100) / 100;
    var diffTxt = (diff > 0 ? '+' : '') + diff.toFixed(2).replace('.', ',') + 'm';
    var diffClasse = diff > 0.05 ? 'subindo' : (diff < -0.05 ? 'descendo' : 'estavel');
    compHTML = '<div class="niv-comp">'
      + '<span class="niv-comp-label">' + (anoPassado.exato ? 'Mesmo dia do ano passado' : 'Próximo do mesmo dia, ano passado') + ' (' + fmtDataBR(anoPassado.item.data) + ')</span>'
      + '<span class="niv-comp-val">' + anoPassado.item.nivel_m.toFixed(2).replace('.', ',') + 'm'
      + ' <span class="niv-comp-diff ' + diffClasse + '">(' + diffTxt + ')</span></span>'
      + '</div>';
  }

  var regime = classificarNivel(atual.nivel_m);
  var cardHTML = '<div class="niv-card">'
    + '<div class="niv-top"><span class="niv-label">🌊 Nível do Rio Negro</span><span class="niv-fonte">Fonte:<br>' + atual.fonte + '</span></div>'
    + '<div class="niv-value-row"><span class="niv-value">' + atual.nivel_m.toFixed(2).replace('.', ',') + '</span><span class="niv-unit">metros</span></div>'
    + '<div class="niv-badges">'
    + '<span class="niv-regime ' + regime.classe + '">' + regime.label + '</span>'
    + '<span class="niv-trend ' + atual.tendencia + '">' + niveTrendIcone(atual.tendencia) + ' ' + niveTrendTexto(atual.tendencia)
    + ' · ' + (atual.variacao_cm > 0 ? '+' : '') + atual.variacao_cm.toFixed(0) + ' cm hoje</span>'
    + '</div>'
    + '<div class="niv-date">Atualizado em ' + fmtDataBR(atual.data) + '</div>'
    + nivelGaugeHTML(atual.nivel_m)
    + compHTML
    + '</div>';

  var chartHTML = '<div class="niv-chart-card">'
    + '<div class="niv-chart-hdr"><span class="niv-chart-title">Histórico</span><span class="niv-chart-range">últimas ' + historico90.length + ' leituras</span></div>'
    + '<div class="niv-chart">' + nivelChartSVG(historico90) + '</div>'
    + '</div>';

  var feedHTML = '<div class="niv-feed-title">Notícias do nível</div>'
    + feedItens.map(function (h) {
      var txt = (h.tendencia === 'estavel')
        ? 'Nível estável em ' + h.nivel_m.toFixed(2) + 'm'
        : (niveTrendTexto(h.tendencia) + ' ' + Math.abs(h.variacao_cm).toFixed(0) + 'cm — nível em ' + h.nivel_m.toFixed(2) + 'm');
      return '<div class="niv-feed-item">'
        + '<div class="niv-feed-icon">' + niveTrendIcone(h.tendencia) + '</div>'
        + '<div class="niv-feed-body"><div class="niv-feed-text">' + txt + '</div><div class="niv-feed-date">' + fmtDataBR(h.data) + ' · ' + h.fonte + '</div></div>'
        + '</div>';
    }).join('');

  body.innerHTML = nivelAlertaHTML(regime) + cardHTML + chartHTML + feedHTML;
  atualizarAlertaAba(!!regime.critico);
}

/* ============================================================
   ABA 1 — ROTAS
   Lista oculta: só as 10 rotas aparecem. Ao abrir, mostra os
   municípios na ordem de passagem, com km e transit time.
   ============================================================ */

function fmtSaca(v) { return (v === null || v === undefined || v === '') ? '—' : ('R$ ' + Number(v).toFixed(2).replace('.', ',')); }
function fmtTA(v) { return (v === null || v === undefined || v === '') ? '—' : (v + ' d'); }

/* A maioria dos códigos de município é uma sigla curta (3-4 letras: AUT,
   COA, ITA...), mas Balbina e Novo Remanso não são município oficial —
   entram como "PFI/BALBINA" e "ITA/NOVO REMANSO" (sigla do município-sede
   + nome da localidade), bem mais compridos. Essa função encolhe a fonte
   nos rótulos (chip, selo do balão, linha da rota) só nesses casos, pra
   não estourar o layout pensado pra códigos de 3-4 letras. */
function seqFS(seq) {
  if (!seq) return '';
  if (seq.length > 8) return 'font-size:.5em;letter-spacing:0;line-height:1.05;';
  if (seq.length > 5) return 'font-size:.7em;letter-spacing:0;';
  return '';
}
function principalEmb(lista) {
  // as listas ja vem ordenadas da mais usada pra menos usada (fonte: planilha)
  if (!lista || !lista.length) return null;
  return lista[0];
}

/* ── Avaliação (1-5 estrelas) e dias de saída por embarcação ── */
var DIAS_SEMANA = [
  { k: 'seg', l: 'S' }, { k: 'ter', l: 'T' }, { k: 'qua', l: 'Q' }, { k: 'qui', l: 'Q' },
  { k: 'sex', l: 'S' }, { k: 'sab', l: 'S' }, { k: 'dom', l: 'D' }
];
function estrelasHTML(nota) {
  var n = Number(nota) || 0;
  var s = '';
  for (var i = 1; i <= 5; i++) s += (i <= n) ? '★' : '☆';
  return s;
}
function diasBadgeHTML(dias) {
  dias = dias || [];
  if (!dias.length) return '';
  return '<div class="emb-dias-badges">' + DIAS_SEMANA.map(function (d) {
    return '<span class="dia-badge' + (dias.indexOf(d.k) !== -1 ? ' on' : '') + '">' + d.l + '</span>';
  }).join('') + '</div>';
}

/* Uma calha é "rodoviária" (ônibus/estrada) quando o nome ou a direção
   menciona isso — usado aqui, no cabeçalho do card, e no mapa (ícone
   do veículo animado na calha selecionada). */
function isRodoviaria(r) { return /rodovi/i.test((r.nome || '') + ' ' + (r.dir || '')); }

function kmTotalRota(r) {
  return r.municipios.reduce(function (soma, m) { return soma + (Number(m.km) || 0); }, 0);
}

/* Tipos de segurança (Aduaneiro / Corredor de Escoamento) presentes na
   calha, sem repetir — vira selinho no cabeçalho do card. */
function segTiposDaRota(r) {
  var vistos = {};
  var lista = [];
  r.municipios.forEach(function (m) {
    var seg = SEGURANCA[m.seq];
    if (seg && !vistos[seg.tipo]) { vistos[seg.tipo] = true; lista.push(seg.tipo); }
  });
  return lista;
}

function buildRotaHeader(r) {
  var rodoviaria = isRodoviaria(r);
  var veicIc = rodoviaria ? '🚌' : '🚤';
  var kmFmt = kmTotalRota(r).toLocaleString('pt-BR');
  var segBadges = segTiposDaRota(r).map(function (tipo) {
    var meta = SEGURANCA_META[tipo];
    return '<span class="rseg-badge" style="background:' + meta.cor + '22;color:' + meta.cor + ';border-color:' + meta.cor + '55" title="' + meta.label + '">' + meta.icone + '</span>';
  }).join('');
  return '<div class="rhead" onclick="toggleRota(\'' + r.num + '\', this)">'
    + '<div class="rnb" style="background:' + r.cor + '">' + r.num + '</div>'
    + '<div class="rinfo">'
    + '<div class="rnome">Calha ' + r.nome + ' <span class="rveic" title="' + (rodoviaria ? 'Rota rodoviária' : 'Rota fluvial') + '">' + veicIc + '</span>' + segBadges + '</div>'
    + '<div class="rsub">' + r.municipios.length + ' municípios · ' + kmFmt + ' km total · ' + r.dir + '</div>'
    + '</div>'
    + '<div class="rchv">▶</div>'
    + '</div>';
}

function bRO() {
  var body = document.getElementById('rbdy'); if (!body) return;
  body.innerHTML = ROTAS.map(function (r, ri) {
    var mRows = r.municipios.map(function (m, i) {
      return '<div class="mrow" data-seq="' + m.seq + '" data-txt="' + normKey(m.seq + ' ' + m.nome) + '">'
        + '<span class="mpos">' + (i + 1) + '</span>'
        + '<span class="mseq" style="color:' + r.cor + ';' + seqFS(m.seq) + '">' + m.seq + '</span>'
        + '<span class="mname">' + m.nome + '</span>'
        + '<span class="mkm">' + m.km + ' km</span>'
        + '<span class="mtt">' + m.tt + '</span>'
        + '</div>';
    }).join('');
    return '<div class="rcard" id="rcard-' + r.num + '" style="--i:' + ri + ';--rc:' + r.cor + '" data-txt="' + normKey(r.nome + ' ' + r.num) + '">'
      + buildRotaHeader(r)
      + '<div class="rbody"><div class="rbody-inner"><div class="rtimeline">' + mRows + '</div></div></div>'
      + '</div>';
  }).join('');
}

function toggleRota(num, headEl) {
  var card = document.getElementById('rcard-' + num);
  if (!card) return;
  card.classList.toggle('open');
}

function fR(q) {
  q = normKey(q.trim());
  document.querySelectorAll('#rbdy .rcard').forEach(function (card) {
    var rows = card.querySelectorAll('.mrow');
    if (!q) {
      card.style.display = '';
      card.classList.remove('open');
      rows.forEach(function (row) { row.style.display = ''; });
      return;
    }
    var rotaMatch = card.dataset.txt.indexOf(q) !== -1;
    var algumaLinha = false;
    rows.forEach(function (row) {
      var hit = rotaMatch || row.dataset.txt.indexOf(q) !== -1;
      row.style.display = hit ? '' : 'none';
      if (hit) algumaLinha = true;
    });
    card.style.display = algumaLinha ? '' : 'none';
    if (algumaLinha) card.classList.add('open'); else card.classList.remove('open');
  });
}

/* ============================================================
   ABA 2 — INFORMAÇÕES (somente leitura)
   Grade de balões compactos (o código do node) agrupados por
   calha. Tocar num balão abre um pop-up com o nome do município
   e todas as informações + observações pessoais editáveis.
   ============================================================ */

function bINFO() {
  var body = document.getElementById('ibdy'); if (!body) return;
  body.innerHTML = ROTAS.map(function (r, ri) {
    var chips = r.municipios.map(function (m) {
      var seg = SEGURANCA[m.seq];
      var dot = seg ? '<span class="chip-segdot" style="background:' + SEGURANCA_META[seg.tipo].cor + '" title="' + SEGURANCA_META[seg.tipo].label + '">' + SEGURANCA_META[seg.tipo].icone + '</span>' : '';
      var obsDot = getObs(m.seq) ? '<span class="chip-obsdot" title="Tem observação salva"></span>' : '';
      return '<button class="chip" data-seq="' + m.seq + '" data-txt="' + normKey(m.seq + ' ' + m.nome) + '" style="border-color:' + r.cor + '" onclick="abrirInfoView(\'' + m.seq + '\')">'
        + '<span class="chip-seq" style="color:' + r.cor + ';' + seqFS(m.seq) + '">' + m.seq + '</span>'
        + dot + obsDot
        + '</button>';
    }).join('');
    return '<div class="rcard open" id="icard-' + r.num + '" style="--i:' + ri + '" data-txt="' + normKey(r.nome + ' ' + r.num) + '">'
      + '<div class="rhead rhead-static">'
      + '<div class="rnb" style="background:' + r.cor + '">' + r.num + '</div>'
      + '<div class="rinfo"><div class="rnome">Calha ' + r.nome + '</div>'
      + '<div class="rsub">' + r.municipios.length + ' municípios</div></div></div>'
      + '<div class="rbody"><div class="rbody-inner"><div class="chipgrid">' + chips + '</div></div></div>'
      + '</div>';
  }).join('');
}

function fINFO(q) {
  q = normKey(q.trim());
  document.querySelectorAll('#ibdy .rcard').forEach(function (card) {
    var chips = card.querySelectorAll('.chip');
    if (!q) { card.style.display = ''; chips.forEach(function (c) { c.style.display = ''; }); return; }
    var rotaMatch = card.dataset.txt.indexOf(q) !== -1;
    var alguma = false;
    chips.forEach(function (c) {
      var hit = rotaMatch || c.dataset.txt.indexOf(q) !== -1;
      c.style.display = hit ? '' : 'none';
      if (hit) alguma = true;
    });
    card.style.display = alguma ? '' : 'none';
  });
}

/* ── BALÃO SOMENTE LEITURA (Informações) ── */

var viewSeq = null; // seq do município aberto no balão de visualização

function abrirInfoView(seq) {
  var hit = NODEIDX[seq]; if (!hit) return;
  viewSeq = seq;
  segAberto = true;
  renderInfoView();
  document.getElementById('sheet-overlay').classList.add('on');
}

function embListViewHTML(lista) {
  if (!lista || !lista.length) return '<div class="emb-empty">Nenhuma embarcação cadastrada.</div>';
  return lista.map(function (item) {
    return '<div class="sh-view-emb">'
      + '<div class="sh-view-emb-top">'
      + '<span class="sh-view-emb-n">' + (item.n || '—') + '</span>'
      + ((item.tt !== null && item.tt !== undefined && item.tt !== '') ? '<span class="sh-view-emb-tt">' + item.tt + ' d</span>' : '')
      + '</div>'
      + (item.nota ? '<div class="sh-view-emb-stars">' + estrelasHTML(item.nota) + '</div>' : '')
      + diasBadgeHTML(item.dias)
      + '</div>';
  }).join('');
}

function renderInfoView() {
  if (!viewSeq) return;
  var seq = viewSeq; var info = getInfo(seq);
  var hit = NODEIDX[seq]; var r = hit.rota; var m = hit.mun;

  var html =
    '<div class="sh-hdr">'
    + '<div class="sh-seq" style="color:' + r.cor + ';' + seqFS(m.seq) + '">' + m.seq + '</div>'
    + '<div><div class="sh-nome">' + m.nome + '</div>'
    + '<div class="sh-badge" style="background:' + r.cor + '">CALHA ' + r.nome.toUpperCase() + '</div></div>'
    + '</div>'

    + segHTML(seq)

    + '<div class="sh-view-grid">'
    + '<div class="sh-view-kpi"><div class="sh-view-kt">TT Amazon</div><div class="sh-view-kv">' + fmtTA(info.ta) + '</div></div>'
    + '<div class="sh-view-kpi"><div class="sh-view-kt">Distância</div><div class="sh-view-kv">' + m.km + ' km</div></div>'
    + '<div class="sh-view-kpi"><div class="sh-view-kt">Transit rota</div><div class="sh-view-kv">' + m.tt + '</div></div>'
    + '</div>'

    + '<div class="sh-season">'
    + '<div class="sh-season-hdr">💰 PREÇO POR SACA</div>'
    + '<div class="sh-price-line"><span class="sh-price-tag" style="color:#f59e0b">🏜️ Seca</span><span class="sh-view-price">' + fmtSaca(info.ps.seca) + ' /saca</span></div>'
    + '<div class="sh-price-line"><span class="sh-price-tag" style="color:#0ea5e9">🌊 Cheia</span><span class="sh-view-price">' + fmtSaca(info.ps.cheia) + ' /saca</span></div>'
    + '</div>'

    + '<div class="sh-season">'
    + '<label class="sh-sub" style="margin-top:0">Embarcações mais usadas</label>'
    + '<div class="sh-view-emblist">' + embListViewHTML(info.emb) + '</div>'
    + '</div>'

    + '<div class="sh-obs-wrap">'
    + '<label class="sh-sub">Observações <span class="sh-obs-hint">(só você vê — fica na sua conta)</span></label>'
    + '<textarea class="sh-obs" id="in-obs" placeholder="Anotações pessoais sobre ' + m.nome + '..." oninput="setObs(\'' + seq + '\', this.value)">' + (getObs(seq) || '').replace(/</g, '&lt;') + '</textarea>'
    + '</div>';

  document.getElementById('sheet-body').innerHTML = html;
}

/* ============================================================
   ABA 3 — CONFIGURAÇÕES
   Mesma lista por calha; ao clicar num município abre um balão
   (bottom sheet) editável com transit Amazon, preço/saca (seca
   e cheia) e as embarcações usadas em cada regime do rio.
   ============================================================ */

function empresaPanelHTML() {
  return '<div class="rcard open empresa-card">'
    + '<div class="rhead rhead-static">'
    + '<div class="rinfo"><div class="rnome">🏢 Dados da empresa</div>'
    + '<div class="rsub">Nome e logo aparecem no cabeçalho pra todo mundo</div></div>'
    + '</div>'
    + '<div class="rbody"><div class="rbody-inner">'
    + '<div class="sh-field"><label>Nome da empresa</label>'
    + '<input type="text" id="in-empresa-nome" value="' + (CONFIG_EMPRESA.nome_empresa || '').replace(/"/g, '&quot;') + '" placeholder="Ex: Facil Express"></div>'
    + '<div class="sh-field"><label>URL do logo (imagem)</label>'
    + '<input type="text" id="in-empresa-logo" value="' + (CONFIG_EMPRESA.logo_url || '').replace(/"/g, '&quot;') + '" placeholder="https://..."></div>'
    + '<button class="sh-btn sh-save" onclick="salvarConfigEmpresa()">✓ Salvar dados da empresa</button>'
    + '</div></div>'
    + '</div>';
}

function bCO() {
  var body = document.getElementById('cbdy'); if (!body) return;
  if (!souAdmin()) { body.innerHTML = '<div class="emb-empty" style="padding:20px;">Você não tem permissão pra ver Configurações.</div>'; return; }
  body.innerHTML = empresaPanelHTML() + ROTAS.map(function (r, ri) {
    var mRows = r.municipios.map(function (m, i) {
      var info = getInfo(m.seq);
      var pEmb = principalEmb(info.emb);
      var seg = SEGURANCA[m.seq];
      var segIc = seg ? '<span class="iseg-ic" style="background:' + SEGURANCA_META[seg.tipo].cor + '" title="' + SEGURANCA_META[seg.tipo].label + '">' + SEGURANCA_META[seg.tipo].icone + '</span>' : '';
      return '<div class="irow" data-seq="' + m.seq + '" data-txt="' + normKey(m.seq + ' ' + m.nome) + '" onclick="abrirConfig(\'' + m.seq + '\')">'
        + '<span class="mseq" style="color:' + r.cor + ';' + seqFS(m.seq) + '">' + m.seq + '</span>'
        + '<div class="iinfo">'
        + '<div class="iname">' + m.nome + segIc + '</div>'
        + '<div class="isub">'
        + '<span class="itag ise">🏜️ ' + fmtSaca(info.ps.seca) + '</span>'
        + '<span class="itag ich">🌊 ' + fmtSaca(info.ps.cheia) + '</span>'
        + '<span class="itag">🚢 ' + (pEmb ? pEmb.n : '—') + '</span>'
        + '</div></div>'
        + '<div class="ita">' + fmtTA(info.ta) + '</div>'
        + '<div class="ichv">›</div>'
        + '</div>';
    }).join('');
    return '<div class="rcard open" id="ccard-' + r.num + '" style="--i:' + ri + '" data-txt="' + normKey(r.nome + ' ' + r.num) + '">'
      + '<div class="rhead rhead-static">'
      + '<div class="rnb" style="background:' + r.cor + '">' + r.num + '</div>'
      + '<div class="rinfo"><div class="rnome">Calha ' + r.nome + '</div>'
      + '<div class="rsub">' + r.municipios.length + ' municípios</div></div></div>'
      + '<div class="rbody"><div class="rbody-inner">' + mRows + '</div></div>'
      + '</div>';
  }).join('');
}

function fC(q) {
  q = normKey(q.trim());
  document.querySelectorAll('#cbdy .rcard').forEach(function (card) {
    var rows = card.querySelectorAll('.irow');
    if (!q) { card.style.display = ''; rows.forEach(function (row) { row.style.display = ''; }); return; }
    var rotaMatch = card.dataset.txt.indexOf(q) !== -1;
    var algumaLinha = false;
    rows.forEach(function (row) {
      var hit = rotaMatch || row.dataset.txt.indexOf(q) !== -1;
      row.style.display = hit ? '' : 'none';
      if (hit) algumaLinha = true;
    });
    card.style.display = algumaLinha ? '' : 'none';
  });
}

/* ── BALÃO EDITÁVEL (bottom sheet) ── */

var editState = null; // { seq, info } — copia de trabalho antes de salvar

function abrirConfig(seq) {
  if (!souAdmin()) return; // defesa extra — a aba já fica escondida pra quem não é admin
  var hit = NODEIDX[seq]; if (!hit) return;
  editState = { seq: seq, info: getInfo(seq) };
  segAberto = true;
  renderSheet();
  document.getElementById('sheet-overlay').classList.add('on');
}

function fecharSheet(e) {
  if (e && e.target && e.target.id !== 'sheet-overlay') return;
  document.getElementById('sheet-overlay').classList.remove('on');
  editState = null;
  viewSeq = null;
}

/* ── Classificação de segurança (Aduaneiro / Corredor de Escoamento) ── */
var segAberto = true;

function segHTML(seq) {
  var seg = SEGURANCA[seq]; if (!seg) return '';
  var meta = SEGURANCA_META[seg.tipo];
  return '<div class="sh-seg sh-seg-' + seg.tipo + '" style="border-color:' + meta.cor + '66">'
    + '<div class="sh-seg-hdr" onclick="segAberto=!segAberto; document.getElementById(\'sh-seg-body\').style.display = segAberto ? \'block\' : \'none\'; this.querySelector(\'.sh-seg-chv\').textContent = segAberto ? \'▾\' : \'▸\';" style="color:' + meta.cor + '">'
    + '<span class="sh-seg-ic">' + meta.icone + '</span>'
    + '<span class="sh-seg-tt">' + meta.label.toUpperCase() + '</span>'
    + '<span class="sh-seg-chv">▾</span>'
    + '</div>'
    + '<div id="sh-seg-body" class="sh-seg-body" style="display:' + (segAberto ? 'block' : 'none') + '">'
    + '<div class="sh-seg-nota">' + seg.nota + '</div>'
    + '<div class="sh-seg-desc">' + meta.desc + '</div>'
    + '</div></div>';
}

function embRowHTML(idx, item) {
  var nota = item.nota || 0;
  var starsHTML = '';
  for (var i = 1; i <= 5; i++) {
    starsHTML += '<span class="star-pick' + (i <= nota ? ' on' : '') + '" onclick="setEmbNota(' + idx + ',' + i + ')">' + (i <= nota ? '★' : '☆') + '</span>';
  }
  var dias = item.dias || [];
  var diasHTML = DIAS_SEMANA.map(function (d) {
    var ativo = dias.indexOf(d.k) !== -1;
    return '<button type="button" class="dia-chip' + (ativo ? ' on' : '') + '" title="' + d.k + '" onclick="toggleEmbDia(' + idx + ',\'' + d.k + '\')">' + d.l + '</button>';
  }).join('');

  return '<div class="emb-row">'
    + '<div class="emb-row-top">'
    + '<input class="emb-in emb-nome" type="text" value="' + (item.n || '').replace(/"/g, '&quot;') + '" placeholder="Nome da embarcação" '
    + 'oninput="editEmb(' + idx + ',\'n\',this.value)">'
    + '<input class="emb-in emb-tt" type="number" step="0.1" min="0" value="' + (item.tt === null || item.tt === undefined ? '' : item.tt) + '" placeholder="dias" '
    + 'oninput="editEmb(' + idx + ',\'tt\',this.value)">'
    + '<button class="emb-rm" onclick="removeEmb(' + idx + ')">✕</button>'
    + '</div>'
    + '<div class="emb-row-mid"><span class="emb-stars-label">Avaliação</span><span class="star-picker">' + starsHTML + '</span></div>'
    + '<div class="emb-row-bot"><span class="emb-dias-label">Sai</span><span class="dia-chips">' + diasHTML + '</span></div>'
    + '</div>';
}

function setEmbNota(idx, valor) {
  if (!editState) return;
  var item = editState.info.emb[idx]; if (!item) return;
  item.nota = (item.nota === valor) ? null : valor; // clicar na mesma nota de novo limpa
  renderSheet();
}

function toggleEmbDia(idx, dia) {
  if (!editState) return;
  var item = editState.info.emb[idx]; if (!item) return;
  if (!item.dias) item.dias = [];
  var i = item.dias.indexOf(dia);
  if (i === -1) item.dias.push(dia); else item.dias.splice(i, 1);
  renderSheet();
}

function renderSheet() {
  if (!editState) return;
  var seq = editState.seq; var info = editState.info;
  var hit = NODEIDX[seq]; var r = hit.rota; var m = hit.mun;

  var embHTML = info.emb.map(function (item, i) { return embRowHTML(i, item); }).join('')
    || '<div class="emb-empty">Nenhuma embarcação cadastrada.</div>';

  var html =
    '<div class="sh-hdr">'
    + '<div class="sh-seq" style="color:' + r.cor + ';' + seqFS(m.seq) + '">' + m.seq + '</div>'
    + '<div><div class="sh-nome">' + m.nome + '</div>'
    + '<div class="sh-badge" style="background:' + r.cor + '">CALHA ' + r.nome.toUpperCase() + '</div></div>'
    + '</div>'

    + segHTML(seq)

    + '<div class="sh-field">'
    + '<label>Transit Time Amazon (dias)</label>'
    + '<input type="number" step="0.1" min="0" id="in-ta" value="' + (info.ta === null || info.ta === undefined ? '' : info.ta) + '" oninput="editState.info.ta = this.value === \'\' ? null : Number(this.value)">'
    + '</div>'

    + '<div class="sh-season">'
    + '<div class="sh-season-hdr">💰 PREÇO POR SACA</div>'
    + '<div class="sh-field"><label style="color:#f59e0b">🏜️ Seca (R$)</label>'
    + '<input type="number" step="0.5" min="0" value="' + (info.ps.seca === null || info.ps.seca === undefined ? '' : info.ps.seca) + '" oninput="editState.info.ps.seca = this.value === \'\' ? null : Number(this.value)"></div>'
    + '<div class="sh-field"><label style="color:#0ea5e9">🌊 Cheia (R$)</label>'
    + '<input type="number" step="0.5" min="0" value="' + (info.ps.cheia === null || info.ps.cheia === undefined ? '' : info.ps.cheia) + '" oninput="editState.info.ps.cheia = this.value === \'\' ? null : Number(this.value)"></div>'
    + '</div>'

    + '<div class="sh-season">'
    + '<label class="sh-sub" style="margin-top:0">Embarcações mais usadas</label>'
    + '<div id="emb-list">' + embHTML + '</div>'
    + '<button class="emb-add" onclick="addEmb()">+ Adicionar embarcação</button>'
    + '</div>'

    + '<div class="sh-actions">'
    + '<button class="sh-btn sh-reset" onclick="resetSheetAtual()">⟲ Restaurar original</button>'
    + '<button class="sh-btn sh-save" onclick="salvarSheet()">✓ Salvar</button>'
    + '</div>';

  document.getElementById('sheet-body').innerHTML = html;
}

function editEmb(idx, campo, valor) {
  if (!editState) return;
  var item = editState.info.emb[idx]; if (!item) return;
  item[campo] = (campo === 'tt') ? (valor === '' ? null : Number(valor)) : valor;
}

function removeEmb(idx) {
  if (!editState) return;
  editState.info.emb.splice(idx, 1);
  renderSheet();
}

function addEmb() {
  if (!editState) return;
  editState.info.emb.push({ n: '', tt: null, nota: null, dias: [] });
  renderSheet();
  var inputs = document.querySelectorAll('#emb-list .emb-nome');
  var last = inputs[inputs.length - 1]; if (last) last.focus();
}

function salvarSheet() {
  if (!editState) return;
  // limpa embarcacoes sem nome antes de salvar
  editState.info.emb = editState.info.emb.filter(function (it) { return it.n && it.n.trim(); });
  var seq = editState.seq, info = editState.info;
  var btn = document.querySelector('.sh-save');
  if (btn) { btn.disabled = true; btn.textContent = 'Salvando...'; }
  setInfo(seq, info).then(function () {
    fecharSheet();
    bCO();
  }).catch(function () {
    if (btn) { btn.disabled = false; btn.textContent = '✓ Salvar'; }
  });
}

function resetSheetAtual() {
  if (!editState) return;
  var seq = editState.seq;
  var btn = document.querySelector('.sh-reset');
  if (btn) { btn.disabled = true; btn.textContent = 'Restaurando...'; }
  resetInfo(seq).then(function () {
    editState.info = getInfo(seq);
    renderSheet();
  }).catch(function () {
    if (btn) { btn.disabled = false; btn.textContent = '⟲ Restaurar original'; }
  });
}

/* ============================================================
   ABA 3 — MAPA
   ============================================================ */
var T = { s: 1, x: 0, y: 0 };
var rotaFiltrada = null;
var tipoFiltrado = null; // null | 'aduaneiro' | 'corredor'
var mapAnimateEntrance = true; // true = próxima renderMap() anima entrada dos nós/linhas

function nodeAtivo(m, rNum) {
  if (tipoFiltrado) {
    var seg = SEGURANCA[m.seq];
    return !!(seg && seg.tipo === tipoFiltrado);
  }
  return rotaFiltrada === null || rotaFiltrada === rNum;
}

function mapLabel(rotaNum, idx) { return rotaNum + idx; }

/* "manchas" fixas de copa de floresta por cima do gradiente verde do fundo —
   posições e raios fixos (não aleatórios a cada render) pra dar uma textura
   orgânica ao "recorte" do estado, sem precisar carregar nenhuma imagem. */
var FOREST_BLOBS = [
  { x: 180, y: 160, r: 130, c: '#1f5f3f', o: .55 }, { x: 420, y: 120, r: 160, c: '#164a34', o: .5 },
  { x: 650, y: 200, r: 140, c: '#1f5f3f', o: .45 }, { x: 300, y: 320, r: 180, c: '#0f3a28', o: .5 },
  { x: 550, y: 380, r: 150, c: '#1f5f3f', o: .4 }, { x: 150, y: 420, r: 130, c: '#164a34', o: .5 },
  { x: 720, y: 420, r: 120, c: '#0f3a28', o: .45 }, { x: 400, y: 480, r: 160, c: '#1a5238', o: .4 }
];

function renderMap() {
  var svg = document.getElementById('msvg'); if (!svg) return;
  var animarEntrada = mapAnimateEntrance;
  mapAnimateEntrance = false;
  svg.innerHTML = '';
  var NS = 'http://www.w3.org/2000/svg';
  var W = 900, H = 600;
  var LNG0 = -74.5, LNG1 = -53.5, LAT0 = -10.6, LAT1 = 2.7;
  function merc(lat) { return Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)); }
  var m0 = merc(LAT0), m1 = merc(LAT1);
  function proj(lat, lng) { return { x: (lng - LNG0) / (LNG1 - LNG0) * W, y: (m1 - merc(lat)) / (m1 - m0) * H }; }

  var bPts = AM_BORDER.map(function (c) { var p = proj(c[0], c[1]); return p.x + ',' + p.y; }).join(' ');

  var defs = document.createElementNS(NS, 'defs');
  defs.innerHTML =
    '<pattern id="gr" width="30" height="30" patternUnits="userSpaceOnUse"><path d="M30 0L0 0 0 30" fill="none" stroke="#0f172a" stroke-width=".4"/></pattern>'
    + '<filter id="gw"><feGaussianBlur stdDeviation="1.8" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>'
    + '<filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="22"/></filter>'
    + '<radialGradient id="forestGrad" cx="45%" cy="40%" r="75%"><stop offset="0%" stop-color="#1c4a32"/><stop offset="55%" stop-color="#123825"/><stop offset="100%" stop-color="#0b241a"/></radialGradient>'
    + '<clipPath id="amClip"><polygon points="' + bPts + '"/></clipPath>';
  svg.appendChild(defs);

  var g = document.createElementNS(NS, 'g'); g.id = 'mg';
  g.setAttribute('transform', 'translate(' + T.x + ',' + T.y + ') scale(' + T.s + ')');
  svg.appendChild(g); // anexa já aqui: getTotalLength() (usado no desenho das linhas) exige o elemento renderizado

  // fundo (fora do estado): "água"/espaço escuro, igual o resto do app
  var bg = document.createElementNS(NS, 'rect'); bg.setAttribute('width', W); bg.setAttribute('height', H); bg.setAttribute('fill', '#070c14'); g.appendChild(bg);

  // "imagem" ilustrada do Amazonas: gradiente + manchas de copa de floresta,
  // recortados exatamente no contorno real do estado
  var amGroup = document.createElementNS(NS, 'g'); amGroup.setAttribute('clip-path', 'url(#amClip)'); g.appendChild(amGroup);
  var amBg = document.createElementNS(NS, 'rect'); amBg.setAttribute('width', W); amBg.setAttribute('height', H); amBg.setAttribute('fill', 'url(#forestGrad)'); amGroup.appendChild(amBg);
  FOREST_BLOBS.forEach(function (b) {
    var blob = document.createElementNS(NS, 'circle');
    blob.setAttribute('cx', b.x); blob.setAttribute('cy', b.y); blob.setAttribute('r', b.r);
    blob.setAttribute('fill', b.c); blob.setAttribute('opacity', b.o); blob.setAttribute('filter', 'url(#soft)');
    amGroup.appendChild(blob);
  });
  var grOverlay = document.createElementNS(NS, 'rect'); grOverlay.setAttribute('width', W); grOverlay.setAttribute('height', H); grOverlay.setAttribute('fill', 'url(#gr)'); grOverlay.setAttribute('opacity', '0.5'); amGroup.appendChild(grOverlay);
  RIOS.forEach(function (rv) {
    var pts = rv.coords.map(function (c) { var p = proj(c[0], c[1]); return p.x + ' ' + p.y; });
    var path = document.createElementNS(NS, 'polyline');
    path.setAttribute('points', pts.join(', ')); path.setAttribute('fill', 'none');
    path.setAttribute('stroke', '#2f9bd6'); path.setAttribute('stroke-width', rv.w);
    path.setAttribute('opacity', '0.8'); path.setAttribute('stroke-linecap', 'round'); amGroup.appendChild(path);
  });

  // contorno do estado, por cima de tudo, pra dar nitidez à silhueta
  var border = document.createElementNS(NS, 'polygon');
  border.setAttribute('points', bPts); border.setAttribute('fill', 'none'); border.setAttribute('stroke', '#3b82c4'); border.setAttribute('stroke-width', '2'); g.appendChild(border);

  var hub = proj(-3.119, -60.021);
  ['hub-ring', 'hub-ring hub-ring2'].forEach(function (cls) {
    var ring = document.createElementNS(NS, 'circle');
    ring.setAttribute('cx', hub.x); ring.setAttribute('cy', hub.y); ring.setAttribute('r', '8');
    ring.setAttribute('fill', 'none'); ring.setAttribute('stroke', '#14b8a6'); ring.setAttribute('stroke-width', '1.5');
    ring.setAttribute('class', cls); g.appendChild(ring);
  });
  var hc = document.createElementNS(NS, 'circle');
  hc.setAttribute('cx', hub.x); hc.setAttribute('cy', hub.y); hc.setAttribute('r', '8'); hc.setAttribute('fill', '#14b8a6'); hc.setAttribute('filter', 'url(#gw)'); g.appendChild(hc);
  var hl = document.createElementNS(NS, 'text');
  hl.setAttribute('x', hub.x + 11); hl.setAttribute('y', hub.y + 4); hl.setAttribute('font-size', '9');
  hl.setAttribute('fill', '#14b8a6'); hl.setAttribute('font-weight', '900'); hl.setAttribute('font-family', 'monospace'); hl.textContent = 'MANAUS'; g.appendChild(hl);

  var iz = 1 / T.s;
  var routeLineEls = {}; // num da calha -> elemento <polyline> (pra animar a embarcação/ônibus por cima)

  ROTAS.forEach(function (r, ri) {
    var algumAtivo = r.municipios.some(function (m) { return nodeAtivo(m, r.num); });
    var pts = r.municipios.map(function (m) { return LATLNG[m.seq] ? proj(LATLNG[m.seq].lat, LATLNG[m.seq].lng) : null; }).filter(Boolean);
    if (pts.length) {
      var lineCoords = [[hub.x, hub.y]].concat(pts.map(function (p) { return [p.x, p.y]; }));
      var polyPts = lineCoords.map(function (p) { return p[0] + ' ' + p[1]; }).join(', ');
      var line = document.createElementNS(NS, 'polyline');
      line.setAttribute('points', polyPts); line.setAttribute('fill', 'none');
      line.setAttribute('class', 'mline');
      line.setAttribute('stroke', r.cor); line.setAttribute('stroke-width', (algumAtivo && !tipoFiltrado) ? '2.4' : '1');
      line.setAttribute('opacity', tipoFiltrado ? '0.1' : (algumAtivo ? '0.6' : '0.06')); line.setAttribute('stroke-linecap', 'round'); g.appendChild(line);
      routeLineEls[r.num] = line;
      if (animarEntrada) {
        var len = line.getTotalLength();
        line.style.strokeDasharray = len;
        line.style.setProperty('--len', len);
        line.classList.add('mline-draw');
        line.style.animationDelay = (ri * 60) + 'ms';
      }
    }
  });

  var nodeCounter = 0;
  ROTAS.forEach(function (r) {
    r.municipios.forEach(function (m, idx) {
      var ll = LATLNG[m.seq]; if (!ll) return;
      var ativo = nodeAtivo(m, r.num);
      var seg = SEGURANCA[m.seq];
      var p = proj(ll.lat, ll.lng);
      var label = mapLabel(r.num, idx + 1);
      var grp = document.createElementNS(NS, 'g');
      grp.setAttribute('class', 'mnode' + (animarEntrada ? ' mnode-in' : ''));
      grp.setAttribute('data-ativo', ativo ? '1' : '0');
      if (animarEntrada) { grp.style.setProperty('--i', nodeCounter); nodeCounter++; }
      grp.style.cursor = ativo ? 'pointer' : 'default';
      grp.style.opacity = ativo ? '1' : '0.08';

      var baseW = (label.length <= 2 ? 20 : label.length === 3 ? 24 : 28);
      var labelW = baseW * iz;
      var labelH = 15 * iz;

      // aura vermelha: ponto de atenção (aduaneiro / corredor de escoamento) —
      // fica atrás do balão, pulsando, pra chamar atenção mesmo antes de abrir.
      if (seg) {
        var alertRing = document.createElementNS(NS, 'rect');
        alertRing.setAttribute('x', p.x - labelW / 2); alertRing.setAttribute('y', p.y - labelH / 2);
        alertRing.setAttribute('width', String(labelW)); alertRing.setAttribute('height', String(labelH));
        alertRing.setAttribute('rx', String(4 * iz));
        alertRing.setAttribute('class', 'mnode-alert-ring');
        var ringDelay = document.createElementNS(NS, 'title'); ringDelay.textContent = 'Ponto de atenção: ' + SEGURANCA_META[seg.tipo].label;
        alertRing.appendChild(ringDelay);
        grp.appendChild(alertRing);
      }

      var bb = document.createElementNS(NS, 'rect');
      bb.setAttribute('x', p.x - labelW / 2); bb.setAttribute('y', p.y - labelH / 2);
      bb.setAttribute('width', String(labelW)); bb.setAttribute('height', String(labelH));
      bb.setAttribute('rx', String(3 * iz));
      bb.setAttribute('fill', ativo ? r.cor : '#1a1e26');
      var segCor = seg ? SEGURANCA_META[seg.tipo].cor : r.cor;
      bb.setAttribute('stroke', seg ? segCor : r.cor);
      bb.setAttribute('stroke-width', String((seg ? 1.6 : (ativo ? 0 : 0.6)) * iz));
      bb.setAttribute('stroke-dasharray', seg ? (2 * iz) + ',' + (1.4 * iz) : 'none');
      bb.setAttribute('opacity', '0.92');
      if (ativo) bb.setAttribute('filter', 'url(#gw)');
      grp.appendChild(bb);

      var hitW = 30 * iz, hitH = 26 * iz;
      var hitArea = document.createElementNS(NS, 'rect');
      hitArea.setAttribute('x', p.x - hitW / 2); hitArea.setAttribute('y', p.y - hitH / 2);
      hitArea.setAttribute('width', String(hitW)); hitArea.setAttribute('height', String(hitH));
      hitArea.setAttribute('fill', 'transparent');
      grp.appendChild(hitArea);

      var nt = document.createElementNS(NS, 'text');
      nt.setAttribute('x', p.x); nt.setAttribute('y', p.y + 3 * iz);
      nt.setAttribute('text-anchor', 'middle'); nt.setAttribute('font-size', String(8 * iz));
      nt.setAttribute('font-weight', '900'); nt.setAttribute('fill', ativo ? '#fff' : r.cor);
      nt.setAttribute('font-family', 'monospace');
      nt.setAttribute('pointer-events', 'none');
      nt.textContent = label; grp.appendChild(nt);

      if (seg) {
        var bx = p.x + labelW / 2, by = p.y - labelH / 2;
        var bcirc = document.createElementNS(NS, 'circle');
        bcirc.setAttribute('cx', bx); bcirc.setAttribute('cy', by); bcirc.setAttribute('r', String(5.5 * iz));
        bcirc.setAttribute('fill', segCor);
        bcirc.setAttribute('stroke', '#070c14'); bcirc.setAttribute('stroke-width', String(1.2 * iz));
        bcirc.setAttribute('opacity', ativo ? '1' : '0.35');
        grp.appendChild(bcirc);
        var bicon = document.createElementNS(NS, 'text');
        bicon.setAttribute('x', bx); bicon.setAttribute('y', by + 2.6 * iz);
        bicon.setAttribute('text-anchor', 'middle'); bicon.setAttribute('font-size', String(6.5 * iz));
        bicon.setAttribute('pointer-events', 'none'); bicon.setAttribute('opacity', ativo ? '1' : '0.35');
        bicon.textContent = SEGURANCA_META[seg.tipo].icone;
        grp.appendChild(bicon);
      }

      if (ativo) {
        grp.addEventListener('click', function (e) {
          e.stopPropagation();
          showMapPopup(NODEIDX[m.seq], label);
        });
      }
      g.appendChild(grp);
    });
  });

  // Se tem uma calha específica selecionada (não "TODAS"), anima uma
  // embarcação (ou ônibus, pras calhas rodoviárias) percorrendo a rota.
  if (rotaFiltrada && routeLineEls[rotaFiltrada]) {
    iniciarAnimacaoRota(rotaFiltrada, routeLineEls[rotaFiltrada], iz);
  } else {
    pararAnimacaoRota();
  }
}

/* ── Ícone animado percorrendo a calha selecionada no mapa ── */
var routeAnim = { raf: null, num: null };

function pararAnimacaoRota() {
  if (routeAnim.raf) cancelAnimationFrame(routeAnim.raf);
  routeAnim.raf = null;
  routeAnim.num = null;
  var el = document.getElementById('route-anim-icon');
  if (el && el.parentNode) el.parentNode.removeChild(el);
}

function iniciarAnimacaoRota(num, line, iz) {
  pararAnimacaoRota();
  var g = document.getElementById('mg'); if (!g || !line) return;
  var len = line.getTotalLength(); if (!len) return;

  var r = ROTAS.filter(function (x) { return x.num === num; })[0]; if (!r) return;
  var rodoviaria = isRodoviaria(r);
  var NS = 'http://www.w3.org/2000/svg';

  // grupo com um halo escuro atrás (pra destacar em cima de qualquer cor de linha/fundo) + o emoji
  var icon = document.createElementNS(NS, 'g');
  icon.id = 'route-anim-icon';
  icon.setAttribute('class', 'route-anim-icon');

  var halo = document.createElementNS(NS, 'circle');
  halo.setAttribute('r', String(11 * iz));
  halo.setAttribute('fill', '#070c14');
  halo.setAttribute('stroke', r.cor);
  halo.setAttribute('stroke-width', String(1.2 * iz));
  halo.setAttribute('opacity', '0.92');
  icon.appendChild(halo);

  var glyph = document.createElementNS(NS, 'text');
  glyph.setAttribute('class', 'route-anim-glyph');
  glyph.setAttribute('text-anchor', 'middle');
  glyph.setAttribute('dominant-baseline', 'central');
  glyph.setAttribute('y', String(1 * iz));
  glyph.setAttribute('font-size', String(15 * iz));
  glyph.setAttribute('font-family', "'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif");
  glyph.setAttribute('fill', '#fff'); // usado como cor só se a fonte não tiver o emoji colorido (fallback)
  glyph.textContent = rodoviaria ? '🚌' : '🚤';
  icon.appendChild(glyph);

  g.appendChild(icon);

  routeAnim.num = num;

  function posicionar(t) {
    var pt = line.getPointAtLength(t * len);
    icon.setAttribute('transform', 'translate(' + pt.x + ',' + pt.y + ')');
  }

  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) {
    posicionar(0.5); // sem movimento: só mostra o ícone parado no meio da rota
    return;
  }

  var duration = 4200; // ms pra ir do porto/garagem até o fim da calha
  var pausa = 900;     // ms parado no fim antes de reiniciar o percurso
  var startTime = null;

  function frame(ts) {
    if (routeAnim.num !== num) return; // outra rota foi selecionada / animação foi parada
    if (!startTime) startTime = ts;
    var elapsed = (ts - startTime) % (duration + pausa);
    var t = Math.min(elapsed / duration, 1);
    posicionar(t);
    routeAnim.raf = requestAnimationFrame(frame);
  }
  routeAnim.raf = requestAnimationFrame(frame);
}

function showMapPopup(hit, label) {
  var popup = document.getElementById('map-popup');
  if (!popup) {
    popup = document.createElement('div'); popup.id = 'map-popup';
    document.getElementById('sc-m').appendChild(popup);
  }
  var r = hit.rota; var m = hit.mun; var prev = hit.prev; var next = hit.next;
  var info = getInfo(m.seq);
  var pEmb = principalEmb(info.emb);
  var seg = SEGURANCA[m.seq];
  var segMeta = seg ? SEGURANCA_META[seg.tipo] : null;

  popup.style.borderColor = seg ? segMeta.cor : r.cor;
  popup.innerHTML =
    '<button class="mp-close" onclick="fecharPopupMapa()">✕</button>'
    + '<div class="mp-top">'
    + '<span class="mp-label" style="color:' + r.cor + '">' + label + '</span>'
    + '<span class="mp-rota" style="background:' + r.cor + '22;color:' + r.cor + '">' + r.nome.toUpperCase() + '</span></div>'
    + '<div class="mp-nome">' + m.nome + '</div>'
    + (seg ? '<button class="mp-segtag" style="background:' + segMeta.cor + '22;color:' + segMeta.cor + ';border-color:' + segMeta.cor + '55" onclick="verDetalheSeg(\'' + m.seq + '\')">'
        + segMeta.icone + ' ' + segMeta.curto + ' <span class="mp-segtag-link">· ver detalhes ›</span></button>' : '')
    + '<div class="mp-kpis">'
    + '<div class="mp-kpi"><div class="mp-kt">Transit</div><div class="mp-kv">' + m.tt + '</div></div>'
    + '<div class="mp-kpi"><div class="mp-kt">Distância</div><div class="mp-kv">' + m.km + ' km</div></div>'
    + '<div class="mp-kpi"><div class="mp-kt">TT Amazon</div><div class="mp-kv">' + fmtTA(info.ta) + '</div></div>'
    + '</div>'
    + '<div class="mp-emb">'
    + '<div class="mp-embrow">🏜️ <b>' + fmtSaca(info.ps.seca) + '</b></div>'
    + '<div class="mp-embrow">🌊 <b>' + fmtSaca(info.ps.cheia) + '</b></div>'
    + '<div class="mp-embrow">🚢 <b>' + (pEmb ? pEmb.n : '—') + '</b></div>'
    + '</div>'
    + '<div class="mp-nav">'
    + (prev ? '<span>⬅ ' + prev.nome + '</span>' : '<span class="mp-dim">⬅ Início</span>')
    + (next ? '<span>' + next.nome + ' ➡</span>' : '<span class="mp-dim">Fim ➡</span>')
    + '</div>';

  popup.classList.add('on');
}

function verDetalheSeg(seq) {
  fecharPopupMapa();
  SS('i', null);
  setTimeout(function () { abrirInfoView(seq); }, 60);
}

function fecharPopupMapa() {
  var p = document.getElementById('map-popup'); if (p) p.classList.remove('on');
}

function filtrarRota(num) {
  tipoFiltrado = null;
  rotaFiltrada = (rotaFiltrada === num) ? null : num;
  atualizarBotoesFiltro();
  fecharPopupMapa(); renderMap();
}

function filtrarTipo(tipo) {
  rotaFiltrada = null;
  tipoFiltrado = (tipoFiltrado === tipo) ? null : tipo;
  atualizarBotoesFiltro();
  fecharPopupMapa(); renderMap();
}

function atualizarBotoesFiltro() {
  document.querySelectorAll('.mfbtn[data-rota]').forEach(function (b) {
    var isActive = !tipoFiltrado && b.dataset.rota === (rotaFiltrada || '');
    b.classList.toggle('active', isActive);
  });
  document.querySelectorAll('.mfbtn[data-tipo]').forEach(function (b) {
    b.classList.toggle('active', b.dataset.tipo === (tipoFiltrado || ''));
  });
}

function buildMapFilters() {
  var cont = document.getElementById('map-filters'); if (!cont) return;
  cont.innerHTML = '';
  var all = document.createElement('button'); all.className = 'mfbtn active'; all.dataset.rota = '';
  all.textContent = 'TODAS';
  all.onclick = function () { rotaFiltrada = null; tipoFiltrado = null; atualizarBotoesFiltro(); fecharPopupMapa(); renderMap(); };
  cont.appendChild(all);
  ROTAS.forEach(function (r) {
    var btn = document.createElement('button'); btn.className = 'mfbtn'; btn.dataset.rota = r.num;
    btn.textContent = r.num; btn.title = r.nome;
    btn.style.setProperty('--rc', r.cor);
    btn.onclick = function () { filtrarRota(r.num); };
    cont.appendChild(btn);
  });
  var sep = document.createElement('div'); sep.className = 'mf-sep'; cont.appendChild(sep);
  Object.keys(SEGURANCA_META).forEach(function (tipo) {
    var meta = SEGURANCA_META[tipo];
    var btn = document.createElement('button'); btn.className = 'mfbtn mfbtn-seg'; btn.dataset.tipo = tipo;
    btn.innerHTML = meta.icone + ' ' + meta.curto;
    btn.title = meta.label;
    btn.style.setProperty('--rc', meta.cor);
    btn.onclick = function () { filtrarTipo(tipo); };
    cont.appendChild(btn);
  });
}

/* Arrastar (mouse/touch) e beliscar (pinça, 2 dedos) pra dar zoom/pan no
   mapa — tudo manual em cima do transform do <g id="mg">, sem depender de
   nenhuma lib externa. */
var mapDrag = { active: false, x: 0, y: 0, moved: false };
var mapPinch = { active: false, dist: 0, s0: 1 };
var mapInteractionsBound = false;

function applyMapTransform() {
  T.s = Math.max(0.5, Math.min(8, T.s));
  var g = document.getElementById('mg');
  if (g) g.setAttribute('transform', 'translate(' + T.x + ',' + T.y + ') scale(' + T.s + ')');
}

/* Muda o zoom (T.s) mantendo o CENTRO da tela fixo no mesmo ponto do mapa —
   sem isso, dar zoom (botão, roda do mouse ou pinça) ia deslocando o mapa
   pro canto superior esquerdo a cada vez (porque a escala do <g> é aplicada
   a partir da origem 0,0). 450,300 é sempre o centro do viewBox (900x600),
   que é sempre o centro visível da tela (o SVG usa xMidYMid), então "manter
   o ponto que está em 450,300 fixo" == "manter o mapa centralizado". */
function zoomAroundCenter(newS) {
  newS = Math.max(0.5, Math.min(8, newS));
  var r = newS / T.s;
  T.x = 450 - r * (450 - T.x);
  T.y = 300 - r * (300 - T.y);
  T.s = newS;
}

function initMapInteractions() {
  var svg = document.getElementById('msvg');
  if (!svg || mapInteractionsBound) return;
  mapInteractionsBound = true;

  svg.addEventListener('mousedown', function (e) {
    mapDrag.active = true; mapDrag.moved = false; mapDrag.x = e.clientX; mapDrag.y = e.clientY;
  });
  window.addEventListener('mousemove', function (e) {
    if (!mapDrag.active) return;
    var dx = e.clientX - mapDrag.x, dy = e.clientY - mapDrag.y;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) mapDrag.moved = true;
    T.x += dx; T.y += dy; mapDrag.x = e.clientX; mapDrag.y = e.clientY;
    applyMapTransform();
  });
  window.addEventListener('mouseup', function () { mapDrag.active = false; });

  /* touchstart/touchmove NÃO podem ser passive aqui: sem chamar
     preventDefault(), o navegador do celular também tentava fazer o
     "pinch-zoom" nativo da página inteira ao mesmo tempo que o nosso zoom
     próprio do mapa — daí a página inteira deslizava/dava zoom, e a barra
     de filtros parecia "sumir" (só tinha saído da área visível). Com
     preventDefault(), só o mapa reage ao gesto. */
  svg.addEventListener('touchstart', function (e) {
    if (e.touches.length === 1) {
      mapDrag.active = true; mapDrag.moved = false;
      mapDrag.x = e.touches[0].clientX; mapDrag.y = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
      e.preventDefault();
      mapDrag.active = false;
      mapPinch.active = true;
      var dx = e.touches[0].clientX - e.touches[1].clientX, dy = e.touches[0].clientY - e.touches[1].clientY;
      mapPinch.dist = Math.hypot(dx, dy); mapPinch.s0 = T.s;
    }
  }, { passive: false });
  svg.addEventListener('touchmove', function (e) {
    if (mapPinch.active && e.touches.length === 2) {
      e.preventDefault();
      var dx = e.touches[0].clientX - e.touches[1].clientX, dy = e.touches[0].clientY - e.touches[1].clientY;
      var d = Math.hypot(dx, dy);
      // pinça: zoom centralizado na tela, pra não "puxar" o mapa pro canto
      zoomAroundCenter(mapPinch.s0 * (d / mapPinch.dist));
      applyMapTransform();
    } else if (mapDrag.active && e.touches.length === 1) {
      e.preventDefault();
      var tdx = e.touches[0].clientX - mapDrag.x, tdy = e.touches[0].clientY - mapDrag.y;
      if (Math.abs(tdx) > 2 || Math.abs(tdy) > 2) mapDrag.moved = true;
      T.x += tdx; T.y += tdy;
      mapDrag.x = e.touches[0].clientX; mapDrag.y = e.touches[0].clientY;
      applyMapTransform();
    }
  }, { passive: false });
  svg.addEventListener('touchend', function (e) {
    mapDrag.active = false;
    if (e.touches.length < 2) mapPinch.active = false;
  });

  svg.addEventListener('wheel', function (e) {
    e.preventDefault();
    var delta = e.deltaY < 0 ? 1.12 : (1 / 1.12);
    zoomAroundCenter(T.s * delta); // zoom com a roda do mouse também fica centralizado
    applyMapTransform();
  }, { passive: false });
}

function zI() { zoomAroundCenter(T.s * 1.3); renderMap(); }
function zO() { zoomAroundCenter(T.s / 1.3); renderMap(); }
function zR() {
  T = { s: 1, x: 0, y: 0 };
  rotaFiltrada = null; tipoFiltrado = null; atualizarBotoesFiltro(); fecharPopupMapa();
  mapAnimateEntrance = true;
  renderMap();
}

/* ============================================================
   NAVEGAÇÃO ENTRE ABAS
   ============================================================ */
function SS(name, btn) {
  cur = name;
  ['r', 'i', 'c', 'm', 'n'].forEach(function (s) {
    var el = document.getElementById('sc-' + s);
    if (el) el.classList.toggle('h', s !== name);
  });
  document.querySelectorAll('.htab').forEach(function (b) { b.classList.toggle('on', b.dataset.s === name); });
  ['r', 'i', 'c', 'm', 'n'].forEach(function (s) { var bt = document.getElementById('bt-' + s); if (bt) bt.classList.toggle('on', s === name); });

  if (name === 'i') bINFO();
  if (name === 'c') bCO();
  if (name === 'm') { mapAnimateEntrance = true; buildMapFilters(); renderMap(); initMapInteractions(); }
  if (name === 'n') bNIVEL();
}

/* ============================================================
   INICIALIZAÇÃO
   Chamada pelo index.html depois de carregar data.js e app.js.
   ============================================================ */
/* ── Indicador "ao vivo" (status da conexão Realtime) ── */
function setLiveStatus(state) {
  // state: 'connecting' | 'live' | 'offline'
  var dot = document.getElementById('live-dot'); if (!dot) return;
  dot.classList.remove('live', 'offline');
  if (state === 'live') { dot.classList.add('live'); dot.title = 'Ao vivo — atualizações da equipe em tempo real'; }
  else if (state === 'offline') { dot.classList.add('offline'); dot.title = 'Sem conexão em tempo real — pode não ver atualizações da equipe agora'; }
  else { dot.title = 'Conectando...'; }
}

/* Pisca por um instante o card/chip do município que acabou de ser
   atualizado por outra pessoa, pra chamar atenção pra mudança. */
function flashSeq(seq) {
  requestAnimationFrame(function () {
    document.querySelectorAll('[data-seq="' + seq + '"]').forEach(function (el) {
      el.classList.remove('flash-update');
      void el.offsetWidth; // reinicia a animação, se já tinha rodado
      el.classList.add('flash-update');
    });
  });
}

async function initApp() {
  aplicarTema(document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark');

  var sessionRes = await sb.auth.getSession();
  var session = sessionRes.data && sessionRes.data.session;
  if (!session) { window.location.replace('/login.html'); return; }
  CURRENT_USER = session.user;

  var badge = document.getElementById('user-badge');
  if (badge) badge.textContent = CURRENT_USER.email || '';

  await carregarPerfil();
  await carregarConfigEmpresa();
  await carregarMunicipiosInfo();
  await carregarObs();
  await carregarNivelRio();

  aplicarGateAdmin();
  bRO();
  bINFO();
  bCO();
  bNIVEL();

  // Realtime: quando alguém edita Configurações em outro aparelho,
  // a tela de quem estiver olhando atualiza sozinha.
  setLiveStatus('connecting');
  sb.channel('municipios_info_changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'municipios_info' }, function (payload) {
      var seq = payload.new && payload.new.seq;
      if (seq) { MUNINFO_LIVE[seq] = rowToInfo(payload.new); }
      if (cur === 'i') bINFO();
      if (cur === 'c') bCO();
      if (seq) flashSeq(seq);
    })
    .subscribe(function (status) {
      if (status === 'SUBSCRIBED') setLiveStatus('live');
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') setLiveStatus('offline');
    });

  // Realtime também pro nível do rio: quando a coleta diária (Vercel Cron)
  // grava a leitura do dia, quem estiver com o app aberto vê na hora.
  sb.channel('nivel_rio_changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'nivel_rio' }, function () {
      carregarNivelRio().then(function () {
        // Atualiza o selinho de alerta mesmo se quem estiver olhando não
        // estiver na aba Notícias agora — senão só reagia entrando lá.
        if (NIVEL_HIST.length) atualizarAlertaAba(!!classificarNivel(NIVEL_HIST[NIVEL_HIST.length - 1].nivel_m).critico);
        if (cur === 'n') bNIVEL();
      });
    })
    .subscribe();

  sb.auth.onAuthStateChange(function (event) {
    if (event === 'SIGNED_OUT') window.location.replace('/login.html');
  });
}
