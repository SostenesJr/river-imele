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
  // crossfade das cores em vez de trocar na cara — liga uma classe que ativa
  // a transição em tudo, por um instante só, e desliga de novo (ver CSS).
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduced) {
    document.documentElement.classList.add('theme-transition');
    clearTimeout(window._temaTransT);
    window._temaTransT = setTimeout(function () { document.documentElement.classList.remove('theme-transition'); }, 420);
  }
  document.documentElement.setAttribute('data-theme', tema);
  try { localStorage.setItem('navlog-theme', tema); } catch (e) { /* ignora: modo privado etc. */ }
  var btn = document.getElementById('theme-btn');
  if (btn) btn.textContent = tema === 'light' ? '🌙' : '☀️';
}
function alternarTema() {
  var atual = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  aplicarTema(atual === 'light' ? 'dark' : 'light');
}

/* ── Idioma da interface (PT/EN/ES/ZH) ──
   Preferência de cada aparelho (localStorage), igual o tema — não é dado
   da empresa. setIdiomaEstatico() (em i18n.js) troca o texto estático do
   HTML (via data-i18n); aqui a gente completa reconstruindo o conteúdo
   dinâmico das abas (gerado em JS) e o que estiver aberto no momento
   (balão de visualização/edição, popup do mapa). */
function aplicarIdioma(lang) {
  setIdiomaEstatico(lang);
  atualizarHeroSub();
  if (typeof atualizarIndicadorAbas === 'function') requestAnimationFrame(atualizarIndicadorAbas);
  if (typeof ROTAS === 'undefined') return; // data.js ainda não carregou
  if (typeof atualizarBotaoPush === 'function') atualizarBotaoPush();
  bRO();
  bINFO();
  if (souAdmin()) bCO();
  bNIVEL();
  bCLIMA();
  if (cur === 'm') { buildMapFilters(); renderMap(); }
  if (viewSeq) renderInfoView();
  if (editState) renderSheet();
  if (climaViewSeq) renderClimaView();
  if (rotaCalcAberto) renderRotaCalc();
}
function alternarIdioma() {
  var i = LANGS.indexOf(LANG);
  aplicarIdioma(LANGS[(i + 1) % LANGS.length]);
}
function atualizarHeroSub() {
  var el = document.getElementById('hero-sub'); if (!el || typeof ROTAS === 'undefined') return;
  var totalMun = ROTAS.reduce(function (soma, r) { return soma + r.municipios.length; }, 0);
  var calhasAlvo = ROTAS.length, munAlvo = totalMun;

  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) { el.textContent = tf('hero_sub_tpl', { calhas: calhasAlvo, municipios: munAlvo }); return; }

  // conta subindo do zero até o valor final — cancela uma contagem anterior
  // em andamento (ex.: troca de idioma rápida) antes de começar outra.
  if (el._heroCountRaf) cancelAnimationFrame(el._heroCountRaf);
  var inicio = null, duracao = 900;
  function passo(ts) {
    if (!inicio) inicio = ts;
    var p = Math.min((ts - inicio) / duracao, 1);
    var facil = 1 - Math.pow(1 - p, 3); // ease-out cúbico
    el.textContent = tf('hero_sub_tpl', { calhas: Math.round(calhasAlvo * facil), municipios: Math.round(munAlvo * facil) });
    el._heroCountRaf = (p < 1) ? requestAnimationFrame(passo) : null;
  }
  el._heroCountRaf = requestAnimationFrame(passo);
}

/* ── Notificações push (Web Push) ──
   Ativado por "aparelho + navegador" (não por conta): cada inscrição
   fica salva em push_subscriptions, pareada com quem estava logado no
   momento de ativar, só pra identificação — quem manda a notificação de
   verdade é sempre o backend (crons/webhook na Vercel), nunca o
   navegador de quem ativou. Dispara em qualquer mudança: regime do
   nível do rio, edição de um município em Configurações, ou mudança na
   qualidade do ar (ver README, seção "Notificações push", e
   api/_lib/push.js). */
var PUSH_ESTADO = 'indisponivel'; // 'indisponivel' | 'desativado' | 'ativado' | 'negado'

function pushSuportado() {
  return 'serviceWorker' in navigator && typeof window.PushManager !== 'undefined' && typeof window.Notification !== 'undefined';
}

// applicationServerKey do PushManager precisa ser Uint8Array, não a
// string base64url em que a VAPID_PUBLIC_KEY vem — conversão padrão
// usada em qualquer integração Web Push.
function urlBase64ToUint8Array(base64String) {
  var padding = '='.repeat((4 - base64String.length % 4) % 4);
  var base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  var rawData = atob(base64);
  var outputArray = new Uint8Array(rawData.length);
  for (var i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

async function atualizarBotaoPush() {
  var btn = document.getElementById('push-btn');
  if (!btn) return;
  if (!pushSuportado()) { PUSH_ESTADO = 'indisponivel'; btn.style.display = 'none'; return; }
  btn.style.display = '';
  if (Notification.permission === 'denied') {
    PUSH_ESTADO = 'negado';
    btn.textContent = '🔕';
    btn.setAttribute('data-i18n-title', 'push_btn_title_negado');
    btn.title = t('push_btn_title_negado');
    return;
  }
  try {
    var reg = await navigator.serviceWorker.ready;
    var sub = await reg.pushManager.getSubscription();
    PUSH_ESTADO = sub ? 'ativado' : 'desativado';
  } catch (e) { PUSH_ESTADO = 'desativado'; }
  var ligado = PUSH_ESTADO === 'ativado';
  btn.textContent = ligado ? '🔔' : '🔕';
  var chave = ligado ? 'push_btn_title_on' : 'push_btn_title_off';
  btn.setAttribute('data-i18n-title', chave);
  btn.title = t(chave);
}

async function togglePush() {
  if (!pushSuportado()) { alert(t('push_indisponivel_msg')); return; }
  if (PUSH_ESTADO === 'ativado') {
    await desativarPush();
  } else {
    if (Notification.permission === 'denied') { alert(t('push_negado_msg')); return; }
    await ativarPush();
  }
  await atualizarBotaoPush();
}

async function ativarPush() {
  var btn = document.getElementById('push-btn');
  if (btn) btn.disabled = true;
  try {
    var permissao = await Notification.requestPermission();
    if (permissao !== 'granted') return;
    var reg = await navigator.serviceWorker.ready;
    var sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
    }
    var json = sub.toJSON();
    var userRes = await sb.auth.getUser();
    var userId = userRes.data && userRes.data.user && userRes.data.user.id;
    if (!userId || !json.keys) return;
    var res = await sb.from('push_subscriptions').upsert({
      user_id: userId,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth_key: json.keys.auth,
      user_agent: navigator.userAgent
    }, { onConflict: 'endpoint' });
    if (res.error) {
      console.error('push: falha ao salvar inscrição:', res.error.message);
      alert(tf('erro_salvar_tpl', { msg: res.error.message }));
    }
  } catch (e) {
    console.error('push: falha ao ativar:', e);
    alert(t('push_erro_msg'));
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function desativarPush() {
  var btn = document.getElementById('push-btn');
  if (btn) btn.disabled = true;
  try {
    var reg = await navigator.serviceWorker.ready;
    var sub = await reg.pushManager.getSubscription();
    if (sub) {
      var endpoint = sub.endpoint;
      await sub.unsubscribe();
      await sb.from('push_subscriptions').delete().eq('endpoint', endpoint);
    }
  } catch (e) {
    console.error('push: falha ao desativar:', e);
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function salvarConfigEmpresa() {
  var nomeEl = document.getElementById('in-empresa-nome');
  var logoEl = document.getElementById('in-empresa-logo');
  if (!nomeEl || !logoEl) return;
  var nome = nomeEl.value.trim();
  var logo = logoEl.value.trim();
  var btn = document.querySelector('.empresa-card .sh-save');
  if (btn) { btn.disabled = true; btn.textContent = t('salvando'); }
  var res = await sb.from('config_empresa').upsert({ id: 1, nome_empresa: nome || null, logo_url: logo || null }, { onConflict: 'id' });
  if (res.error) {
    alert(tf('erro_salvar_tpl', { msg: res.error.message }));
    if (btn) { btn.disabled = false; btn.textContent = t('empresa_save_btn'); }
    return;
  }
  CONFIG_EMPRESA = { nome_empresa: nome || null, logo_url: logo || null };
  aplicarBranding();
  if (btn) {
    btn.disabled = false; btn.textContent = t('salvo_ok'); btn.classList.add('ok');
    setTimeout(function () { if (btn) { btn.textContent = t('empresa_save_btn'); btn.classList.remove('ok'); } }, 1500);
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
    emb: row.emb || [],
    dias: row.dias || [], // dias da semana que SAI DO PORTO (por município, não por embarcação)
    contato: { nome: row.contato_nome || '', tel: row.contato_tel || '' } // agente local/porto
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
    || { ta: null, ps: { seca: null, cheia: null }, emb: [], dias: [] };
  var info = JSON.parse(JSON.stringify(fonte)); // clona pra nao vazar referencia
  if (!info.dias) info.dias = [];
  if (!info.contato) info.contato = { nome: '', tel: '' };
  return info;
}

/* Salva no banco (compartilhado com todo mundo) e atualiza o cache local. */
async function setInfo(seq, info) {
  var res = await sb.from('municipios_info').upsert({
    seq: seq,
    ta: info.ta,
    ps_seca: info.ps.seca,
    ps_cheia: info.ps.cheia,
    emb: info.emb,
    dias: info.dias || [],
    contato_nome: (info.contato && info.contato.nome) || null,
    contato_tel: (info.contato && info.contato.tel) || null
  }, { onConflict: 'seq' });
  if (res.error) { alert(tf('erro_salvar_tpl', { msg: res.error.message })); throw res.error; }
  MUNINFO_LIVE[seq] = JSON.parse(JSON.stringify(info));
}

/* "Restaurar original" agora escreve os valores de fábrica de volta
   no banco — vale pra equipe toda, não só pra quem clicou. */
async function resetInfo(seq) {
  var original = MUNINFO[seq] || { ta: null, ps: { seca: null, cheia: null }, emb: [], dias: [] };
  original = JSON.parse(JSON.stringify(original));
  if (!original.dias) original.dias = [];
  if (!original.contato) original.contato = { nome: '', tel: '' };
  await setInfo(seq, original);
}

/* ── Alerta de embarcação mal avaliada: quando TODAS as embarcações que
   têm avaliação (nota 1-5) estão com nota baixa (1 ou 2), vale a pena
   chamar atenção — pode ser hora de rever a operação naquele município.
   Município sem nenhuma avaliação (nota) não conta como "ruim", só como
   "ainda não avaliado". ── */
function embAvaliacaoRuim(emb) {
  var avaliadas = (emb || []).filter(function (it) { return it && it.nota; });
  return avaliadas.length > 0 && avaliadas.every(function (it) { return it.nota <= 2; });
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
/* "label" é fixo (chave interna, não muda com idioma) — o texto exibido
   vem de t('regime_' + label) na hora de renderizar (ver regimeLabel()),
   assim a mesma faixa aparece certa nos 4 idiomas. */
var NIVEL_REGIMES = [
  { ate: 15,   label: 'seca_severa', classe: 'seca-severa', cor: '#ea580c', critico: true  },
  { ate: 19,   label: 'seca',        classe: 'seca',        cor: '#f59e0b', critico: false },
  { ate: 27,   label: 'normal',      classe: 'normal',      cor: '#14b8a6', critico: false },
  { ate: 27.5, label: 'atencao',     classe: 'atencao',     cor: '#eab308', critico: true  },
  { ate: 29,   label: 'alerta',      classe: 'alerta',      cor: '#3b82c4', critico: true  },
  { ate: 99,   label: 'emergencia',  classe: 'emergencia',  cor: '#ef4444', critico: true  }
];
function regimeLabel(regime) { return t('regime_' + regime.label); }
function classificarNivel(nivel) {
  for (var i = 0; i < NIVEL_REGIMES.length; i++) {
    if (nivel <= NIVEL_REGIMES[i].ate) return NIVEL_REGIMES[i];
  }
  return NIVEL_REGIMES[NIVEL_REGIMES.length - 1];
}
/* Regime atual (última leitura), usado pra colorir os rios no mapa —
   null enquanto o nível ainda não carregou (mapa mostra os rios sem a
   camada de cor nesse caso, sem travar nada). */
function regimeAtual() {
  if (!NIVEL_HIST.length) return null;
  return classificarNivel(NIVEL_HIST[NIVEL_HIST.length - 1].nivel_m);
}

/* Banner chamativo no topo da aba Notícias quando o nível entra numa faixa
   crítica (ver campo "critico" em NIVEL_REGIMES) — o selo discreto ao lado
   do valor já existia, isso aqui é só pra quem não repara no selo. */
function nivelAlertaHTML(regime) {
  if (!regime.critico) return '';
  var texto = t('alert_text_' + regime.label) || '';
  return '<div class="niv-alert-banner ' + regime.classe + '">'
    + '<span class="niv-alert-ic">⚠️</span>'
    + '<div><div class="niv-alert-tt">' + tf('niv_alert_title_tpl', { regime: regimeLabel(regime) }) + '</div>'
    + '<div class="niv-alert-tx">' + texto + '</div></div>'
    + '</div>';
}
/* Selinho vermelho pulsante numa aba (cabeçalho + menu mobile), visível
   de qualquer aba, pra avisar sobre algo crítico sem precisar entrar na
   aba em questão. "tab" é o código da aba ('n' pro nível do rio, 'w' pra
   qualidade do ar); tituloKey é a chave de tradução do tooltip. */
function atualizarAlertaAba(tab, critico, tituloKey) {
  document.querySelectorAll('.htab[data-s="' + tab + '"], #bt-' + tab).forEach(function (el) {
    var existente = el.querySelector('.tab-alert-dot');
    if (critico && !existente) el.insertAdjacentHTML('beforeend', '<span class="tab-alert-dot" title="' + t(tituloKey || 'alert_dot_title') + '"></span>');
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
function niveTrendTexto(tr) { return tr === 'subindo' ? t('trend_subindo') : (tr === 'descendo' ? t('trend_descendo') : t('trend_estavel')); }

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
    + '<div class="niv-gauge-labels"><span>' + t('niv_gauge_seca') + '</span><span>' + t('niv_gauge_normal') + '</span><span>' + t('niv_gauge_alerta_grupo') + '</span></div>'
    + '<div class="niv-gauge-note">' + t('niv_gauge_note') + '</div>'
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
    + '<span>' + t('min_abbr') + ' ' + min.toFixed(2) + 'm</span><span>' + t('max_abbr') + ' ' + max.toFixed(2) + 'm</span></div>';
}

function bNIVEL() {
  var body = document.getElementById('nbdy'); if (!body) return;

  if (!NIVEL_HIST.length) {
    body.innerHTML = '<div class="niv-empty">' + t('niv_empty_html') + '</div>';
    atualizarAlertaAba('n', false);
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
      + '<span class="niv-comp-label">' + (anoPassado.exato ? t('niv_mesmo_dia_ano_passado') : t('niv_proximo_mesmo_dia')) + ' (' + fmtDataBR(anoPassado.item.data) + ')</span>'
      + '<span class="niv-comp-val">' + anoPassado.item.nivel_m.toFixed(2).replace('.', ',') + 'm'
      + ' <span class="niv-comp-diff ' + diffClasse + '">(' + diffTxt + ')</span></span>'
      + '</div>';
  }

  var regime = classificarNivel(atual.nivel_m);
  var cardHTML = '<div class="niv-card' + (regime.critico ? ' niv-critico' : '') + '"' + (regime.critico ? ' style="--niv-glow:' + regime.cor + '"' : '') + '>'
    + '<div class="niv-top"><span class="niv-label">' + t('niv_label') + '</span><span class="niv-fonte">' + t('niv_fonte_label') + '<br>' + atual.fonte + '</span></div>'
    + '<div class="niv-value-row"><span class="niv-value">' + atual.nivel_m.toFixed(2).replace('.', ',') + '</span><span class="niv-unit">' + t('niv_unit') + '</span></div>'
    + '<div class="niv-badges">'
    + '<span class="niv-regime ' + regime.classe + '">' + regimeLabel(regime) + '</span>'
    + '<span class="niv-trend ' + atual.tendencia + '">' + niveTrendIcone(atual.tendencia) + ' ' + niveTrendTexto(atual.tendencia)
    + ' · ' + (atual.variacao_cm > 0 ? '+' : '') + atual.variacao_cm.toFixed(0) + ' cm ' + t('niv_hoje') + '</span>'
    + '</div>'
    + '<div class="niv-date">' + t('niv_atualizado_em') + ' ' + fmtDataBR(atual.data) + '</div>'
    + nivelGaugeHTML(atual.nivel_m)
    + compHTML
    + '</div>';

  var chartHTML = '<div class="niv-chart-card">'
    + '<div class="niv-chart-hdr"><span class="niv-chart-title">' + t('niv_historico_title') + '</span><span class="niv-chart-range">' + tf('niv_historico_range_tpl', { n: historico90.length }) + '</span></div>'
    + '<div class="niv-chart">' + nivelChartSVG(historico90) + '</div>'
    + '</div>';

  var feedHTML = '<div class="niv-feed-title">' + t('niv_feed_title') + '</div>'
    + feedItens.map(function (h) {
      var txt = (h.tendencia === 'estavel')
        ? tf('niv_feed_estavel_tpl', { v: h.nivel_m.toFixed(2) })
        : tf('niv_feed_trend_tpl', { trend: niveTrendTexto(h.tendencia), cm: Math.abs(h.variacao_cm).toFixed(0), v: h.nivel_m.toFixed(2) });
      return '<div class="niv-feed-item">'
        + '<div class="niv-feed-icon">' + niveTrendIcone(h.tendencia) + '</div>'
        + '<div class="niv-feed-body"><div class="niv-feed-text">' + txt + '</div><div class="niv-feed-date">' + fmtDataBR(h.data) + ' · ' + h.fonte + '</div></div>'
        + '</div>';
    }).join('');

  body.innerHTML = nivelAlertaHTML(regime) + cardHTML + chartHTML + feedHTML;
  atualizarAlertaAba('n', !!regime.critico);
}

/* ============================================================
   ABA "CLIMA" — clima atual + qualidade do ar nos municípios
   Usa a Open-Meteo (api.open-meteo.com + air-quality-api.open-meteo.com),
   um serviço público e gratuito que não exige conta nem chave de API e
   aceita vários pontos (lat/lng) numa única chamada — por isso dá pra
   buscar os 57 municípios de uma vez só, em vez de 57 chamadas separadas
   (x2, uma pro tempo e uma pra qualidade do ar).
   Roda direto no navegador de quem está usando o app (não passa pelo
   Supabase); por isso, se a pessoa estiver sem internet ou algum
   bloqueio de rede impedir a chamada, a seção mostra um aviso com
   botão de "tentar de novo" em vez de travar o resto da aba.
   ============================================================ */
var CLIMA_POR_SEQ = {};      // seq -> {temp, sensacao, chuva, vento, codigo, aqi, pm25, pm10, diario:[{data,max,min,chuva,codigo}]}
var CLIMA_ATUALIZADO_EM = null; // epoch ms da última busca com sucesso
var CLIMA_CARREGANDO = false;
var CLIMA_ERRO = false;
var CLIMA_INTERVALO_MS = 20 * 60 * 1000; // não busca de novo antes de 20min

/* Códigos "WMO weather code" (padrão usado pela Open-Meteo) agrupados nas
   categorias que fazem sentido pro clima amazônico — não precisa de um
   caso pra cada um dos ~25 códigos possíveis. */
function climaCategoria(codigo) {
  if (codigo === 0) return { ic: '☀️', key: 'clima_desc_limpo' };
  if (codigo === 1 || codigo === 2) return { ic: '🌤️', key: 'clima_desc_parcial' };
  if (codigo === 3) return { ic: '☁️', key: 'clima_desc_nublado' };
  if (codigo === 45 || codigo === 48) return { ic: '🌫️', key: 'clima_desc_nevoa' };
  if (codigo >= 51 && codigo <= 57) return { ic: '🌦️', key: 'clima_desc_garoa' };
  if (codigo >= 61 && codigo <= 67) return { ic: '🌧️', key: 'clima_desc_chuva' };
  if (codigo >= 80 && codigo <= 82) return { ic: '🌧️', key: 'clima_desc_pancada' };
  if ((codigo >= 71 && codigo <= 77) || codigo === 85 || codigo === 86) return { ic: '🌨️', key: 'clima_desc_neve' };
  if (codigo >= 95) return { ic: '⛈️', key: 'clima_desc_trovoada' };
  return { ic: '🌡️', key: 'clima_desc_indef' };
}

/* Faixas do "European AQI" (escala 0-100+ usada pela Open-Meteo, baseada
   no Copernicus CAMS) — mais simples de mostrar num selinho do que o
   AQI americano (0-500). Relevante sobretudo na época de seca/fumaça de
   queimada na região. */
function aqiCategoria(aqi) {
  if (aqi === null || aqi === undefined || isNaN(aqi)) return null;
  if (aqi <= 20) return { cor: '#22c55e', key: 'aqi_bom' };
  if (aqi <= 40) return { cor: '#84cc16', key: 'aqi_razoavel' };
  if (aqi <= 60) return { cor: '#eab308', key: 'aqi_moderado' };
  if (aqi <= 80) return { cor: '#f97316', key: 'aqi_ruim' };
  if (aqi <= 100) return { cor: '#ef4444', key: 'aqi_muito_ruim' };
  return { cor: '#a21caf', key: 'aqi_extremo' };
}

/* Lista estável de municípios com coordenada conhecida (LATLNG, em
   data.js — as mesmas usadas pro mapa), na ordem em que aparecem nas
   calhas — usada tanto pra montar a URL da API (lat/lng em lote, na
   mesma ordem) quanto pra desenhar a grade depois. */
function climaMunicipiosOrdenados() {
  var lista = [];
  ROTAS.forEach(function (r) {
    r.municipios.forEach(function (m) {
      var ll = LATLNG[m.seq];
      if (ll) lista.push({ seq: m.seq, nome: m.nome, cor: r.cor, lat: ll.lat, lng: ll.lng });
    });
  });
  return lista;
}

async function carregarClima() {
  if (CLIMA_CARREGANDO) return;
  CLIMA_CARREGANDO = true;
  CLIMA_ERRO = false;
  var lista = climaMunicipiosOrdenados();
  if (!lista.length) { CLIMA_CARREGANDO = false; return; }
  var lats = lista.map(function (m) { return m.lat; }).join(',');
  var lngs = lista.map(function (m) { return m.lng; }).join(',');
  var urlTempo = 'https://api.open-meteo.com/v1/forecast?latitude=' + lats + '&longitude=' + lngs
    + '&current=temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m'
    + '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum&forecast_days=5'
    + '&timezone=America%2FManaus';
  // Endpoint separado (outro subdomínio) só pra qualidade do ar — mesma
  // lista de coordenadas, na mesma ordem, então dá pra casar as duas
  // respostas pelo índice (i).
  var urlAr = 'https://air-quality-api.open-meteo.com/v1/air-quality?latitude=' + lats + '&longitude=' + lngs
    + '&current=pm2_5,pm10,european_aqi'
    + '&timezone=America%2FManaus';
  try {
    var resArr = await Promise.all([fetch(urlTempo), fetch(urlAr)]);
    var resTempo = resArr[0], resAr = resArr[1];
    if (!resTempo.ok) throw new Error('HTTP ' + resTempo.status + ' (tempo)');
    if (!resAr.ok) throw new Error('HTTP ' + resAr.status + ' (qualidade do ar)');
    var dataArr = await Promise.all([resTempo.json(), resAr.json()]);
    var dataTempo = dataArr[0], dataAr = dataArr[1];
    // Com mais de uma coordenada na URL, a Open-Meteo devolve uma lista
    // (um item por município, na mesma ordem que foi mandada); com uma
    // só, devolve um objeto único — cobre os dois casos por garantia.
    var itensTempo = Array.isArray(dataTempo) ? dataTempo : [dataTempo];
    var itensAr = Array.isArray(dataAr) ? dataAr : [dataAr];
    var novo = {};
    lista.forEach(function (mun, i) {
      var ct = itensTempo[i] && itensTempo[i].current;
      var cd = itensTempo[i] && itensTempo[i].daily;
      var ca = itensAr[i] && itensAr[i].current;
      if (!ct) return;
      var diario = [];
      if (cd && cd.time) {
        cd.time.forEach(function (data, di) {
          diario.push({
            data: data,
            max: cd.temperature_2m_max ? cd.temperature_2m_max[di] : null,
            min: cd.temperature_2m_min ? cd.temperature_2m_min[di] : null,
            chuva: cd.precipitation_sum ? cd.precipitation_sum[di] : null,
            codigo: cd.weather_code ? cd.weather_code[di] : null
          });
        });
      }
      novo[mun.seq] = {
        temp: ct.temperature_2m,
        sensacao: ct.apparent_temperature,
        chuva: ct.precipitation,
        vento: ct.wind_speed_10m,
        codigo: ct.weather_code,
        aqi: ca ? ca.european_aqi : null,
        pm25: ca ? ca.pm2_5 : null,
        pm10: ca ? ca.pm10 : null,
        diario: diario
      };
    });
    CLIMA_POR_SEQ = novo;
    CLIMA_ATUALIZADO_EM = Date.now();
  } catch (e) {
    console.error('Erro ao carregar clima:', e);
    CLIMA_ERRO = true;
  } finally {
    CLIMA_CARREGANDO = false;
    bCLIMA();
    if (climaViewSeq) renderClimaView(); // balão de clima aberto — atualiza com o dado novo
  }
}

function climaCardHTML(mun) {
  var d = CLIMA_POR_SEQ[mun.seq];
  if (!d || d.temp === null || d.temp === undefined) return '';
  var cat = climaCategoria(d.codigo);
  var aqiCat = aqiCategoria(d.aqi);
  var aqiHTML = aqiCat
    ? '<div class="clima-aqi" style="--aqi-cor:' + aqiCat.cor + '" title="' + tf('clima_aqi_title_tpl', { pm25: (d.pm25 != null ? d.pm25.toFixed(0) : '—'), pm10: (d.pm10 != null ? d.pm10.toFixed(0) : '—') }) + '">'
      + '<span class="clima-aqi-dot"></span>' + t(aqiCat.key) + ' · ' + Math.round(d.aqi) + '</div>'
    : '<div class="clima-aqi clima-aqi-indef">' + t('clima_aqi_indef') + '</div>';
  return '<div class="clima-card" data-txt="' + normKey(mun.seq + ' ' + mun.nome) + '" onclick="abrirClimaView(\'' + mun.seq + '\')">'
    + '<div class="clima-card-top">'
    + '<span class="clima-seq" style="color:' + mun.cor + ';' + seqFS(mun.seq) + '">' + mun.seq + '</span>'
    + '<span class="clima-ic" title="' + t(cat.key) + '">' + cat.ic + '</span>'
    + '</div>'
    + '<div class="clima-nome">' + mun.nome + '</div>'
    + '<div class="clima-temp">' + Math.round(d.temp) + '°<span class="clima-sensacao">' + tf('clima_sensacao_tpl', { v: Math.round(d.sensacao) }) + '</span></div>'
    + '<div class="clima-sub"><span title="' + t('clima_chuva_title') + '">💧 ' + (d.chuva || 0).toFixed(1) + 'mm</span>'
    + '<span title="' + t('clima_vento_title') + '">💨 ' + Math.round(d.vento) + 'km/h</span></div>'
    + aqiHTML
    + '</div>';
}

function bCLIMA() {
  var body = document.getElementById('climabdy'); if (!body) return;

  if (CLIMA_ERRO && !CLIMA_ATUALIZADO_EM) {
    body.innerHTML = '<div class="clima-hdr"><span class="clima-title">' + t('clima_title') + '</span></div>'
      + '<div class="clima-empty">' + t('clima_erro_html') + '<button class="sh-btn" onclick="carregarClima()">' + t('clima_tentar_de_novo') + '</button></div>';
    return;
  }
  if (!CLIMA_ATUALIZADO_EM) return; // ainda carregando — segue mostrando o esqueleto estático do HTML

  var lista = climaMunicipiosOrdenados();
  var horaFmt = new Date(CLIMA_ATUALIZADO_EM).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  body.innerHTML = '<div class="clima-hdr"><span class="clima-title">' + t('clima_title') + '</span>'
    + '<span class="clima-atualizado">' + tf('clima_atualizado_tpl', { hora: horaFmt }) + '</span></div>'
    + climaArAlertaHTML(lista)
    + '<div class="clima-grid">' + lista.map(climaCardHTML).join('') + '</div>';
}

/* Lista de municípios com qualidade do ar "muito ruim"/"extremamente
   ruim" agora — comum na época de seca/fumaça de queimada na região.
   Usado tanto pro banner no topo da aba quanto pro selinho de alerta
   na própria aba (visível de qualquer outra aba, igual o do nível do
   rio). */
function climaArCriticoLista(lista) {
  return lista.filter(function (mun) {
    var d = CLIMA_POR_SEQ[mun.seq];
    var cat = d && aqiCategoria(d.aqi);
    return cat && (cat.key === 'aqi_muito_ruim' || cat.key === 'aqi_extremo');
  });
}
function climaArAlertaHTML(lista) {
  var criticos = climaArCriticoLista(lista);
  atualizarAlertaAba('w', criticos.length > 0, 'clima_ar_alert_dot_title');
  if (!criticos.length) return '';
  var nomes = criticos.map(function (mun) { return mun.nome; });
  var nomesTxt = nomes.length <= 4 ? nomes.join(', ') : nomes.slice(0, 4).join(', ') + tf('clima_ar_alerta_mais_tpl', { n: nomes.length - 4 });
  return '<div class="niv-alert-banner ar-critico">'
    + '<span class="niv-alert-ic">💨</span>'
    + '<div><div class="niv-alert-tt">' + tf('clima_ar_alerta_title_tpl', { n: criticos.length }) + '</div>'
    + '<div class="niv-alert-tx">' + nomesTxt + '</div></div>'
    + '</div>';
}

/* ── BALÃO DO CLIMA (clicar num cartão da aba Clima abre o detalhe,
   grande e centralizado — mesmo balão/bottom-sheet já usado nas abas
   Informações/Configurações, que já é responsivo: desliza de baixo no
   celular e fica centralizado com cantos arredondados no computador). ── */
var climaViewSeq = null; // seq do município aberto no balão de clima

function abrirClimaView(seq) {
  if (!CLIMA_POR_SEQ[seq]) return; // ainda sem dado desse município — não abre balão vazio
  climaViewSeq = seq;
  renderClimaView();
  document.getElementById('sheet-overlay').classList.add('on');
}

function renderClimaView() {
  if (!climaViewSeq) return;
  var seq = climaViewSeq;
  var hit = NODEIDX[seq]; if (!hit) return;
  var r = hit.rota, m = hit.mun;
  var d = CLIMA_POR_SEQ[seq];
  var horaFmt = CLIMA_ATUALIZADO_EM ? new Date(CLIMA_ATUALIZADO_EM).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';

  var html = '<div class="sh-hdr">'
    + '<div class="sh-seq" style="color:' + r.cor + ';' + seqFS(m.seq) + '">' + m.seq + '</div>'
    + '<div><div class="sh-nome">' + m.nome + '</div>'
    + '<div class="sh-badge" style="background:' + r.cor + '">' + t('calha_word').toUpperCase() + ' ' + r.nome.toUpperCase() + '</div></div>'
    + '</div>';

  if (!d) {
    html += '<div class="clima-empty">' + t('clima_erro_html') + '</div>';
    document.getElementById('sheet-body').innerHTML = html;
    return;
  }

  var cat = climaCategoria(d.codigo);
  var aqiCat = aqiCategoria(d.aqi);
  var aqiBlocoHTML = aqiCat
    ? '<div class="clima-view-aqi" style="--aqi-cor:' + aqiCat.cor + '"><span class="clima-aqi-dot"></span>' + t(aqiCat.key) + ' · ' + Math.round(d.aqi) + '</div>'
      + '<div class="clima-view-aqi-sub"><span>PM2,5: ' + (d.pm25 != null ? d.pm25.toFixed(0) : '—') + ' µg/m³</span><span>PM10: ' + (d.pm10 != null ? d.pm10.toFixed(0) : '—') + ' µg/m³</span></div>'
    : '<div class="clima-aqi-indef">' + t('clima_aqi_indef') + '</div>';

  html += '<div class="clima-view-hero">'
    + '<div class="clima-view-ic">' + cat.ic + '</div>'
    + '<div class="clima-view-temp">' + Math.round(d.temp) + '°</div>'
    + '<div class="clima-view-desc">' + t(cat.key) + '</div>'
    + '<div class="clima-view-sensacao">' + tf('clima_sensacao_tpl', { v: Math.round(d.sensacao) }) + '</div>'
    + '</div>'

    + '<div class="sh-view-grid" style="grid-template-columns:repeat(2,1fr)">'
    + '<div class="sh-view-kpi"><div class="sh-view-kt">' + t('clima_chuva_title') + '</div><div class="sh-view-kv">💧 ' + (d.chuva || 0).toFixed(1) + 'mm</div></div>'
    + '<div class="sh-view-kpi"><div class="sh-view-kt">' + t('clima_vento_title') + '</div><div class="sh-view-kv">💨 ' + Math.round(d.vento) + 'km/h</div></div>'
    + '</div>'

    + '<div class="sh-season">'
    + '<div class="sh-season-hdr">' + t('clima_aqi_section_title') + '</div>'
    + aqiBlocoHTML
    + '</div>'

    + climaPrevisaoHTML(d.diario)

    + (horaFmt ? '<div class="clima-view-atualizado">' + tf('clima_atualizado_tpl', { hora: horaFmt }) + '</div>' : '');

  document.getElementById('sheet-body').innerHTML = html;
}

/* Faixa horizontal com a previsão dos próximos dias (a Open-Meteo já
   manda isso na mesma chamada do clima atual, sem precisar de outra
   requisição). Reaproveita DIAS_SEMANA_KEYS/diaLetra() — o mesmo sistema
   de tradução da letra do dia usado nos "dias de saída do porto" — pra
   rotular cada dia certo nos 4 idiomas. */
function climaPrevisaoHTML(diario) {
  if (!diario || !diario.length) return '';
  var hojeISO = new Date().toISOString().slice(0, 10);
  var diasHTML = diario.map(function (dia, i) {
    var cat = climaCategoria(dia.codigo);
    var jsDay = new Date(dia.data + 'T12:00:00').getDay(); // meio-dia evita virar de data por fuso
    var idxSemana = jsDay === 0 ? 6 : jsDay - 1;
    var label = (i === 0 && dia.data === hojeISO) ? t('clima_hoje') : diaLetra(DIAS_SEMANA_KEYS[idxSemana]);
    return '<div class="clima-prev-dia">'
      + '<div class="clima-prev-label">' + label + '</div>'
      + '<div class="clima-prev-ic" title="' + t(cat.key) + '">' + cat.ic + '</div>'
      + '<div class="clima-prev-max">' + (dia.max != null ? Math.round(dia.max) + '°' : '—') + '</div>'
      + '<div class="clima-prev-min">' + (dia.min != null ? Math.round(dia.min) + '°' : '—') + '</div>'
      + (dia.chuva ? '<div class="clima-prev-chuva">💧' + dia.chuva.toFixed(0) + 'mm</div>' : '<div class="clima-prev-chuva">&nbsp;</div>')
      + '</div>';
  }).join('');
  return '<div class="sh-season">'
    + '<div class="sh-season-hdr">' + t('clima_previsao_title') + '</div>'
    + '<div class="clima-prev-row">' + diasHTML + '</div>'
    + '</div>';
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

/* ── Avaliação (1-5 estrelas, por embarcação) e dias de saída do
   porto (por município — não muda de embarcação pra embarcação) ──
   As chaves ('seg','ter'...) nunca mudam (é o que fica salvo no banco);
   a letra/nome mostrados na tela vêm traduzidos de i18n.js (chaves dl_ e dn_),
   pra fazer sentido em qualquer um dos 4 idiomas (ex: em inglês, o certo
   é "M T W T F S S", não "S T Q Q S S D"). */
var DIAS_SEMANA_KEYS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];
function diaLetra(k) { return t('dl_' + k); }
function diaNome(k) { return t('dn_' + k); }
function estrelasHTML(nota) {
  var n = Number(nota) || 0;
  var s = '';
  for (var i = 1; i <= 5; i++) s += (i <= n) ? '★' : '☆';
  return s;
}
function diasBadgeHTML(dias) {
  dias = dias || [];
  if (!dias.length) return '';
  return '<div class="emb-dias-badges">' + DIAS_SEMANA_KEYS.map(function (k) {
    return '<span class="dia-badge' + (dias.indexOf(k) !== -1 ? ' on' : '') + '" title="' + diaNome(k) + '">' + diaLetra(k) + '</span>';
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

/* SEGURANCA_META (data.js) guarda só o que não muda com idioma (cor,
   ícone, chave "tipo"); o texto (label/curto/desc) vem daqui, traduzido. */
function segMetaLabel(tipo) { return t('seg_' + tipo + '_label'); }
function segMetaCurto(tipo) { return t('seg_' + tipo + '_curto'); }
function segMetaDesc(tipo) { return t('seg_' + tipo + '_desc'); }

function buildRotaHeader(r) {
  var rodoviaria = isRodoviaria(r);
  var veicIc = rodoviaria ? '🚌' : '🚤';
  var kmFmt = kmTotalRota(r).toLocaleString('pt-BR');
  var segBadges = segTiposDaRota(r).map(function (tipo) {
    var meta = SEGURANCA_META[tipo];
    return '<span class="rseg-badge" style="background:' + meta.cor + '22;color:' + meta.cor + ';border-color:' + meta.cor + '55" title="' + segMetaLabel(tipo) + '">' + meta.icone + '</span>';
  }).join('');
  return '<div class="rhead" onclick="toggleRota(\'' + r.num + '\', this)">'
    + '<div class="rnb" style="background:' + r.cor + '">' + r.num + '</div>'
    + '<div class="rinfo">'
    + '<div class="rnome">' + t('calha_word') + ' ' + r.nome + ' <span class="rveic" title="' + (rodoviaria ? t('rota_rodoviaria_title') : t('rota_fluvial_title')) + '">' + veicIc + '</span>' + segBadges + '</div>'
    + '<div class="rsub">' + r.municipios.length + ' ' + t('municipios_word') + ' · ' + kmFmt + ' km ' + t('total_word') + ' · ' + r.dir + '</div>'
    + '</div>'
    + '<div class="rchv">▶</div>'
    + '</div>';
}

// Estado vazio (sem resultado) reaproveitado pelas 3 listas com busca
// (Rotas / Informações / Configurações) — some sozinho quando a busca
// está vazia ou quando algum card/linha bate com o texto digitado.
function emptyStateHTML(id) {
  return '<div class="search-empty h" id="' + id + '">'
    + '<div class="search-empty-ic">🔍</div>'
    + '<div class="search-empty-tx">' + t('busca_sem_resultado') + '</div>'
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
  }).join('') + emptyStateHTML('rempty');
}

function toggleRota(num, headEl) {
  var card = document.getElementById('rcard-' + num);
  if (!card) return;
  card.classList.toggle('open');
}

function fR(q) {
  q = normKey(q.trim());
  var algumaVisivel = false;
  document.querySelectorAll('#rbdy .rcard').forEach(function (card) {
    var rows = card.querySelectorAll('.mrow');
    if (!q) {
      card.style.display = '';
      card.classList.remove('open');
      rows.forEach(function (row) { row.style.display = ''; });
      algumaVisivel = true;
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
    if (algumaLinha) { card.classList.add('open'); algumaVisivel = true; } else card.classList.remove('open');
  });
  var vazio = document.getElementById('rempty');
  if (vazio) vazio.classList.toggle('h', algumaVisivel);
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
      var dot = seg ? '<span class="chip-segdot" style="background:' + SEGURANCA_META[seg.tipo].cor + '" title="' + segMetaLabel(seg.tipo) + '">' + SEGURANCA_META[seg.tipo].icone + '</span>' : '';
      var obsDot = getObs(m.seq) ? '<span class="chip-obsdot" title="' + t('obs_saved_dot_title') + '"></span>' : '';
      var warnDot = embAvaliacaoRuim(getInfo(m.seq).emb) ? '<span class="chip-warndot" title="' + t('emb_avaliacao_baixa_title') + '">⚠️</span>' : '';
      return '<button class="chip" data-seq="' + m.seq + '" data-txt="' + normKey(m.seq + ' ' + m.nome) + '" style="border-color:' + r.cor + '" onclick="abrirInfoView(\'' + m.seq + '\')">'
        + '<span class="chip-seq" style="color:' + r.cor + ';' + seqFS(m.seq) + '">' + m.seq + '</span>'
        + dot + obsDot + warnDot
        + '</button>';
    }).join('');
    return '<div class="rcard open" id="icard-' + r.num + '" style="--i:' + ri + '" data-txt="' + normKey(r.nome + ' ' + r.num) + '">'
      + '<div class="rhead rhead-static">'
      + '<div class="rnb" style="background:' + r.cor + '">' + r.num + '</div>'
      + '<div class="rinfo"><div class="rnome">' + t('calha_word') + ' ' + r.nome + '</div>'
      + '<div class="rsub">' + r.municipios.length + ' ' + t('municipios_word') + '</div></div></div>'
      + '<div class="rbody"><div class="rbody-inner"><div class="chipgrid">' + chips + '</div></div></div>'
      + '</div>';
  }).join('') + emptyStateHTML('iempty');
}

function fINFO(q) {
  q = normKey(q.trim());
  var algumaVisivel = false;
  document.querySelectorAll('#ibdy .rcard').forEach(function (card) {
    var chips = card.querySelectorAll('.chip');
    if (!q) { card.style.display = ''; chips.forEach(function (c) { c.style.display = ''; }); algumaVisivel = true; return; }
    var rotaMatch = card.dataset.txt.indexOf(q) !== -1;
    var alguma = false;
    chips.forEach(function (c) {
      var hit = rotaMatch || c.dataset.txt.indexOf(q) !== -1;
      c.style.display = hit ? '' : 'none';
      if (hit) alguma = true;
    });
    card.style.display = alguma ? '' : 'none';
    if (alguma) algumaVisivel = true;
  });
  var vazio = document.getElementById('iempty');
  if (vazio) vazio.classList.toggle('h', algumaVisivel);
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
  if (!lista || !lista.length) return '<div class="emb-empty">' + t('emb_empty') + '</div>';
  return lista.map(function (item) {
    return '<div class="sh-view-emb">'
      + '<div class="sh-view-emb-top">'
      + '<span class="sh-view-emb-n">' + (item.n || '—') + '</span>'
      + ((item.tt !== null && item.tt !== undefined && item.tt !== '') ? '<span class="sh-view-emb-tt">' + item.tt + ' d</span>' : '')
      + '</div>'
      + (item.nota ? '<div class="sh-view-emb-stars">' + estrelasHTML(item.nota) + '</div>' : '')
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
    + '<div class="sh-badge" style="background:' + r.cor + '">' + t('calha_word').toUpperCase() + ' ' + r.nome.toUpperCase() + '</div></div>'
    + '</div>'

    + segHTML(seq)

    + '<div class="sh-view-grid">'
    + '<div class="sh-view-kpi"><div class="sh-view-kt">' + t('kpi_tt_amazon') + '</div><div class="sh-view-kv">' + fmtTA(info.ta) + '</div></div>'
    + '<div class="sh-view-kpi"><div class="sh-view-kt">' + t('kpi_distancia') + '</div><div class="sh-view-kv">' + m.km + ' km</div></div>'
    + '<div class="sh-view-kpi"><div class="sh-view-kt">' + t('kpi_transit_rota') + '</div><div class="sh-view-kv">' + m.tt + '</div></div>'
    + '</div>'

    + '<div class="sh-season">'
    + '<label class="sh-sub" style="margin-top:0">' + t('dias_saida_view_label') + '</label>'
    + (info.dias && info.dias.length ? diasBadgeHTML(info.dias) : '<div class="emb-empty">' + t('dias_nao_informado') + '</div>')
    + '</div>'

    + '<div class="sh-season">'
    + '<div class="sh-season-hdr">' + t('preco_saca_title') + '</div>'
    + '<div class="sh-price-line"><span class="sh-price-tag" style="color:#f59e0b">' + t('preco_seca_view') + '</span><span class="sh-view-price">' + fmtSaca(info.ps.seca) + ' ' + t('per_saca_suffix') + '</span></div>'
    + '<div class="sh-price-line"><span class="sh-price-tag" style="color:#0ea5e9">' + t('preco_cheia_view') + '</span><span class="sh-view-price">' + fmtSaca(info.ps.cheia) + ' ' + t('per_saca_suffix') + '</span></div>'
    + '</div>'

    + '<div class="sh-season">'
    + '<label class="sh-sub" style="margin-top:0">' + t('emb_mais_usadas') + '</label>'
    + (embAvaliacaoRuim(info.emb) ? '<div class="emb-warn-banner">⚠️ ' + t('emb_avaliacao_baixa_aviso') + '</div>' : '')
    + '<div class="sh-view-emblist">' + embListViewHTML(info.emb) + '</div>'
    + '</div>'

    + '<div class="sh-season">'
    + '<div class="sh-season-hdr">' + t('contato_title') + '</div>'
    + (info.contato && (info.contato.nome || info.contato.tel)
        ? '<div class="sh-contato-view">'
          + (info.contato.nome ? '<div class="sh-contato-nome">' + info.contato.nome.replace(/</g, '&lt;') + '</div>' : '')
          + (info.contato.tel ? '<a class="sh-contato-tel" href="tel:' + info.contato.tel.replace(/[^0-9+]/g, '') + '">📞 ' + info.contato.tel.replace(/</g, '&lt;') + '</a>' : '')
          + '</div>'
        : '<div class="emb-empty">' + t('contato_nao_informado') + '</div>')
    + '</div>'

    + '<div class="sh-obs-wrap">'
    + '<label class="sh-sub">' + t('observacoes_label') + ' <span class="sh-obs-hint">' + t('observacoes_hint') + '</span></label>'
    + '<textarea class="sh-obs" id="in-obs" placeholder="' + tf('observacoes_ph_tpl', { nome: m.nome }).replace(/"/g, '&quot;') + '" oninput="setObs(\'' + seq + '\', this.value)">' + (getObs(seq) || '').replace(/</g, '&lt;') + '</textarea>'
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
    + '<div class="rinfo"><div class="rnome">' + t('empresa_card_title') + '</div>'
    + '<div class="rsub">' + t('empresa_card_sub') + '</div></div>'
    + '</div>'
    + '<div class="rbody"><div class="rbody-inner">'
    + '<div class="sh-field"><label>' + t('empresa_nome_label') + '</label>'
    + '<input type="text" id="in-empresa-nome" value="' + (CONFIG_EMPRESA.nome_empresa || '').replace(/"/g, '&quot;') + '" placeholder="' + t('empresa_nome_ph') + '"></div>'
    + '<div class="sh-field"><label>' + t('empresa_logo_label') + '</label>'
    + '<input type="text" id="in-empresa-logo" value="' + (CONFIG_EMPRESA.logo_url || '').replace(/"/g, '&quot;') + '" placeholder="' + t('empresa_logo_ph') + '"></div>'
    + '<button class="sh-btn sh-save" onclick="salvarConfigEmpresa()">' + t('empresa_save_btn') + '</button>'
    + '</div></div>'
    + '</div>';
}

function bCO() {
  var body = document.getElementById('cbdy'); if (!body) return;
  if (!souAdmin()) { body.innerHTML = '<div class="emb-empty" style="padding:20px;">' + t('config_no_permission') + '</div>'; return; }
  body.innerHTML = empresaPanelHTML() + ROTAS.map(function (r, ri) {
    var mRows = r.municipios.map(function (m, i) {
      var info = getInfo(m.seq);
      var pEmb = principalEmb(info.emb);
      var seg = SEGURANCA[m.seq];
      var segIc = seg ? '<span class="iseg-ic" style="background:' + SEGURANCA_META[seg.tipo].cor + '" title="' + segMetaLabel(seg.tipo) + '">' + SEGURANCA_META[seg.tipo].icone + '</span>' : '';
      var embWarn = embAvaliacaoRuim(info.emb) ? '<span class="itag itag-warn" title="' + t('emb_avaliacao_baixa_title') + '">⚠️ ' + t('emb_avaliacao_baixa_curto') + '</span>' : '';
      return '<div class="irow" data-seq="' + m.seq + '" data-txt="' + normKey(m.seq + ' ' + m.nome) + '" onclick="abrirConfig(\'' + m.seq + '\')">'
        + '<span class="mseq" style="color:' + r.cor + ';' + seqFS(m.seq) + '">' + m.seq + '</span>'
        + '<div class="iinfo">'
        + '<div class="iname">' + m.nome + segIc + '</div>'
        + '<div class="isub">'
        + '<span class="itag ise">🏜️ ' + fmtSaca(info.ps.seca) + '</span>'
        + '<span class="itag ich">🌊 ' + fmtSaca(info.ps.cheia) + '</span>'
        + '<span class="itag">🚢 ' + (pEmb ? pEmb.n : '—') + '</span>'
        + embWarn
        + '</div></div>'
        + '<div class="ita">' + fmtTA(info.ta) + '</div>'
        + '<div class="ichv">›</div>'
        + '</div>';
    }).join('');
    return '<div class="rcard open" id="ccard-' + r.num + '" style="--i:' + ri + '" data-txt="' + normKey(r.nome + ' ' + r.num) + '">'
      + '<div class="rhead rhead-static">'
      + '<div class="rnb" style="background:' + r.cor + '">' + r.num + '</div>'
      + '<div class="rinfo"><div class="rnome">' + t('calha_word') + ' ' + r.nome + '</div>'
      + '<div class="rsub">' + r.municipios.length + ' ' + t('municipios_word') + '</div></div></div>'
      + '<div class="rbody"><div class="rbody-inner">' + mRows + '</div></div>'
      + '</div>';
  }).join('') + emptyStateHTML('cempty');
}

function fC(q) {
  q = normKey(q.trim());
  var algumaVisivel = false;
  document.querySelectorAll('#cbdy .rcard').forEach(function (card) {
    var rows = card.querySelectorAll('.irow');
    if (!q) { card.style.display = ''; rows.forEach(function (row) { row.style.display = ''; }); algumaVisivel = true; return; }
    if (card.classList.contains('empresa-card')) { card.style.display = 'none'; return; }
    var rotaMatch = (card.dataset.txt || '').indexOf(q) !== -1;
    var algumaLinha = false;
    rows.forEach(function (row) {
      var hit = rotaMatch || row.dataset.txt.indexOf(q) !== -1;
      row.style.display = hit ? '' : 'none';
      if (hit) algumaLinha = true;
    });
    card.style.display = algumaLinha ? '' : 'none';
    if (algumaLinha) algumaVisivel = true;
  });
  var vazio = document.getElementById('cempty');
  if (vazio) vazio.classList.toggle('h', algumaVisivel);
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
  climaViewSeq = null;
  // rotaCalcAberto (a tela dentro do balão) fecha junto, mas ROTA_CALC
  // (origem/destino escolhidos) fica guardado — é o que mantém a linha
  // desenhada no mapa depois que o balão fecha.
  rotaCalcAberto = false;
}

/* ── Rota entre dois municípios quaisquer (estimativa) ──
   O app só tem, por dado, a distância/tempo de cada município ATÉ
   MANAUS (m.km / m.tt — é assim que a planilha original foi montada,
   não é uma distância "de um município pro outro"). Pra estimar a
   distância entre DOIS municípios quaisquer sem inventar dado que não
   existe, a regra é:
   - Mesma calha (exceto a I, que se ramifica em Humaitá pra Apuí e
     Labréa — não é uma linha reta): assume-se um trajeto contínuo ao
     longo da própria calha, distância = |kmB - kmA|.
   - Calhas diferentes (ou a calha I): assume-se que a carga passa por
     Manaus pra trocar de calha (é como a operação funciona de verdade,
     hub-and-spoke) — distância = kmA + kmB.
   Por isso todo resultado é rotulado como ESTIMATIVA, com a explicação
   do método sempre visível junto do resultado. */
var ROTA_CALC = { origem: null, destino: null };
var rotaCalcAberto = false;

function parseDiasTT(tt) {
  var m = String(tt || '').match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : null;
}

function calcularRotaEstimada(seqA, seqB) {
  var a = NODEIDX[seqA], b = NODEIDX[seqB];
  if (!a || !b) return null;
  if (seqA === seqB) return { distanciaKm: 0, diasEstimado: 0, viaHub: false, mesmaCalha: true };

  var mesmaCalhaLinha = a.rota.num === b.rota.num && a.rota.num !== 'I';
  var kmA = Number(a.mun.km) || 0, kmB = Number(b.mun.km) || 0;
  var ttA = parseDiasTT(a.mun.tt), ttB = parseDiasTT(b.mun.tt);

  var distanciaKm = mesmaCalhaLinha ? Math.abs(kmB - kmA) : (kmA + kmB);
  var diasEstimado = (ttA !== null && ttB !== null)
    ? (mesmaCalhaLinha ? Math.abs(ttB - ttA) : (ttA + ttB))
    : null;

  return { distanciaKm: distanciaKm, diasEstimado: diasEstimado, viaHub: !mesmaCalhaLinha, mesmaCalha: mesmaCalhaLinha };
}

function municipiosSelectOptionsHTML(selecionado) {
  return ROTAS.map(function (r) {
    var opts = r.municipios.map(function (m) {
      return '<option value="' + m.seq + '"' + (m.seq === selecionado ? ' selected' : '') + '>' + m.nome + ' (' + m.seq + ')</option>';
    }).join('');
    return '<optgroup label="' + t('calha_word') + ' ' + r.nome + '">' + opts + '</optgroup>';
  }).join('');
}

function abrirRotaCalc() {
  rotaCalcAberto = true;
  segAberto = true;
  renderRotaCalc();
  document.getElementById('sheet-overlay').classList.add('on');
}

function setRotaCalcOrigem(seq) { ROTA_CALC.origem = seq || null; renderRotaCalc(); renderMap(); }
function setRotaCalcDestino(seq) { ROTA_CALC.destino = seq || null; renderRotaCalc(); renderMap(); }
function limparRotaCalc() { ROTA_CALC.origem = null; ROTA_CALC.destino = null; renderRotaCalc(); renderMap(); }

function renderRotaCalc() {
  if (!rotaCalcAberto) return;
  var res = (ROTA_CALC.origem && ROTA_CALC.destino) ? calcularRotaEstimada(ROTA_CALC.origem, ROTA_CALC.destino) : null;

  var html =
    '<div class="sh-hdr"><div><div class="sh-nome">' + t('rota_calc_title') + '</div>'
    + '<div class="sh-badge" style="background:var(--ac)">' + t('rota_calc_badge') + '</div></div></div>'

    + '<div class="sh-field"><label>' + t('rota_calc_origem_label') + '</label>'
    + '<select id="rota-calc-origem" onchange="setRotaCalcOrigem(this.value)"><option value="">—</option>' + municipiosSelectOptionsHTML(ROTA_CALC.origem) + '</select></div>'

    + '<div class="sh-field"><label>' + t('rota_calc_destino_label') + '</label>'
    + '<select id="rota-calc-destino" onchange="setRotaCalcDestino(this.value)"><option value="">—</option>' + municipiosSelectOptionsHTML(ROTA_CALC.destino) + '</select></div>';

  if (res) {
    html += '<div class="sh-season">'
      + '<div class="sh-view-grid" style="grid-template-columns:repeat(2,1fr)">'
      + '<div class="sh-view-kpi"><div class="sh-view-kt">' + t('rota_calc_resultado_distancia') + '</div><div class="sh-view-kv">' + res.distanciaKm.toLocaleString('pt-BR') + ' km</div></div>'
      + '<div class="sh-view-kpi"><div class="sh-view-kt">' + t('rota_calc_resultado_tempo') + '</div><div class="sh-view-kv">' + (res.diasEstimado === null ? '—' : tf('rota_calc_dias_tpl', { dias: res.diasEstimado })) + '</div></div>'
      + '</div>'
      + '<div class="rota-calc-nota">ℹ️ ' + (res.mesmaCalha && res.distanciaKm === 0 ? t('rota_calc_nota_mesmo') : (res.viaHub ? t('rota_calc_nota_via_hub') : t('rota_calc_nota_mesma_calha'))) + '</div>'
      + '</div>';
  } else {
    html += '<div class="emb-empty">' + t('rota_calc_hint') + '</div>';
  }

  html += '<div class="sh-actions"><button class="sh-btn sh-reset" onclick="limparRotaCalc()">' + t('rota_calc_limpar_btn') + '</button></div>';

  document.getElementById('sheet-body').innerHTML = html;
}

/* ── Classificação de segurança (Aduaneiro / Corredor de Escoamento) ── */
var segAberto = true;

function segHTML(seq) {
  var seg = SEGURANCA[seq]; if (!seg) return '';
  var meta = SEGURANCA_META[seg.tipo];
  return '<div class="sh-seg sh-seg-' + seg.tipo + '" style="border-color:' + meta.cor + '66">'
    + '<div class="sh-seg-hdr" onclick="segAberto=!segAberto; document.getElementById(\'sh-seg-body\').style.display = segAberto ? \'block\' : \'none\'; this.querySelector(\'.sh-seg-chv\').textContent = segAberto ? \'▾\' : \'▸\';" style="color:' + meta.cor + '">'
    + '<span class="sh-seg-ic">' + meta.icone + '</span>'
    + '<span class="sh-seg-tt">' + segMetaLabel(seg.tipo).toUpperCase() + '</span>'
    + '<span class="sh-seg-chv">▾</span>'
    + '</div>'
    + '<div id="sh-seg-body" class="sh-seg-body" style="display:' + (segAberto ? 'block' : 'none') + '">'
    + '<div class="sh-seg-nota">' + seg.nota + '</div>'
    + '<div class="sh-seg-desc">' + segMetaDesc(seg.tipo) + '</div>'
    + '</div></div>';
}

function embRowHTML(idx, item) {
  var nota = item.nota || 0;
  var starsHTML = '';
  for (var i = 1; i <= 5; i++) {
    starsHTML += '<span class="star-pick' + (i <= nota ? ' on' : '') + '" onclick="setEmbNota(' + idx + ',' + i + ')">' + (i <= nota ? '★' : '☆') + '</span>';
  }
  return '<div class="emb-row">'
    + '<div class="emb-row-top">'
    + '<input class="emb-in emb-nome" type="text" value="' + (item.n || '').replace(/"/g, '&quot;') + '" placeholder="' + t('emb_nome_ph') + '" '
    + 'oninput="editEmb(' + idx + ',\'n\',this.value)">'
    + '<input class="emb-in emb-tt" type="number" step="0.1" min="0" value="' + (item.tt === null || item.tt === undefined ? '' : item.tt) + '" placeholder="' + t('emb_tt_ph') + '" '
    + 'oninput="editEmb(' + idx + ',\'tt\',this.value)">'
    + '<button class="emb-rm" onclick="removeEmb(' + idx + ')">✕</button>'
    + '</div>'
    + '<div class="emb-row-mid"><span class="emb-stars-label">' + t('avaliacao_label') + '</span><span class="star-picker">' + starsHTML + '</span></div>'
    + '</div>';
}

function setEmbNota(idx, valor) {
  if (!editState) return;
  var item = editState.info.emb[idx]; if (!item) return;
  item.nota = (item.nota === valor) ? null : valor; // clicar na mesma nota de novo limpa
  renderSheet();
}

/* Dias de saída do porto — agora é do município (não da embarcação) */
function toggleInfoDia(dia) {
  if (!editState) return;
  if (!editState.info.dias) editState.info.dias = [];
  var i = editState.info.dias.indexOf(dia);
  if (i === -1) editState.info.dias.push(dia); else editState.info.dias.splice(i, 1);
  renderSheet();
}

function renderSheet() {
  if (!editState) return;
  var seq = editState.seq; var info = editState.info;
  var hit = NODEIDX[seq]; var r = hit.rota; var m = hit.mun;

  var embHTML = info.emb.map(function (item, i) { return embRowHTML(i, item); }).join('')
    || '<div class="emb-empty">' + t('emb_empty') + '</div>';

  var html =
    '<div class="sh-hdr">'
    + '<div class="sh-seq" style="color:' + r.cor + ';' + seqFS(m.seq) + '">' + m.seq + '</div>'
    + '<div><div class="sh-nome">' + m.nome + '</div>'
    + '<div class="sh-badge" style="background:' + r.cor + '">' + t('calha_word').toUpperCase() + ' ' + r.nome.toUpperCase() + '</div></div>'
    + '</div>'

    + segHTML(seq)

    + '<div class="sh-field">'
    + '<label>' + t('ta_label') + '</label>'
    + '<input type="number" step="0.1" min="0" id="in-ta" value="' + (info.ta === null || info.ta === undefined ? '' : info.ta) + '" oninput="editState.info.ta = this.value === \'\' ? null : Number(this.value)">'
    + '</div>'

    + '<div class="sh-field">'
    + '<label>' + t('dias_saida_edit_label') + '</label>'
    + '<div class="dia-chips">' + DIAS_SEMANA_KEYS.map(function (k) {
        var ativo = (info.dias || []).indexOf(k) !== -1;
        return '<button type="button" class="dia-chip' + (ativo ? ' on' : '') + '" title="' + diaNome(k) + '" onclick="toggleInfoDia(\'' + k + '\')">' + diaLetra(k) + '</button>';
      }).join('') + '</div>'
    + '</div>'

    + '<div class="sh-season">'
    + '<div class="sh-season-hdr">' + t('preco_saca_title') + '</div>'
    + '<div class="sh-field"><label style="color:#f59e0b">' + t('preco_seca_edit') + '</label>'
    + '<input type="number" step="0.5" min="0" value="' + (info.ps.seca === null || info.ps.seca === undefined ? '' : info.ps.seca) + '" oninput="editState.info.ps.seca = this.value === \'\' ? null : Number(this.value)"></div>'
    + '<div class="sh-field"><label style="color:#0ea5e9">' + t('preco_cheia_edit') + '</label>'
    + '<input type="number" step="0.5" min="0" value="' + (info.ps.cheia === null || info.ps.cheia === undefined ? '' : info.ps.cheia) + '" oninput="editState.info.ps.cheia = this.value === \'\' ? null : Number(this.value)"></div>'
    + '</div>'

    + '<div class="sh-season">'
    + '<label class="sh-sub" style="margin-top:0">' + t('emb_mais_usadas') + '</label>'
    + (embAvaliacaoRuim(info.emb) ? '<div class="emb-warn-banner">⚠️ ' + t('emb_avaliacao_baixa_aviso') + '</div>' : '')
    + '<div id="emb-list">' + embHTML + '</div>'
    + '<button class="emb-add" onclick="addEmb()">' + t('emb_add_btn') + '</button>'
    + '</div>'

    + '<div class="sh-season">'
    + '<div class="sh-season-hdr">' + t('contato_title') + '</div>'
    + '<div class="sh-field"><label>' + t('contato_nome_label') + '</label>'
    + '<input type="text" id="in-contato-nome" value="' + ((info.contato && info.contato.nome) || '').replace(/"/g, '&quot;') + '" placeholder="' + t('contato_nome_ph') + '" oninput="if(!editState.info.contato) editState.info.contato={nome:\'\',tel:\'\'}; editState.info.contato.nome=this.value"></div>'
    + '<div class="sh-field"><label>' + t('contato_tel_label') + '</label>'
    + '<input type="text" id="in-contato-tel" value="' + ((info.contato && info.contato.tel) || '').replace(/"/g, '&quot;') + '" placeholder="' + t('contato_tel_ph') + '" oninput="if(!editState.info.contato) editState.info.contato={nome:\'\',tel:\'\'}; editState.info.contato.tel=this.value"></div>'
    + '</div>'

    + '<div class="sh-actions">'
    + '<button class="sh-btn sh-reset" onclick="resetSheetAtual()">' + t('restaurar_btn') + '</button>'
    + '<button class="sh-btn sh-save" onclick="salvarSheet()">' + t('salvar_btn') + '</button>'
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
  editState.info.emb.push({ n: '', tt: null, nota: null });
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
  if (btn) { btn.disabled = true; btn.textContent = t('salvando'); }
  setInfo(seq, info).then(function () {
    // pisca "✓ Salvo!" um instante antes de fechar, pra dar um feedback
    // visual claro (em vez de só sumir na hora) — depois pisca o card na
    // lista também (flashSeq, o mesmo efeito usado pra updates via Realtime).
    if (btn) { btn.disabled = false; btn.textContent = t('salvo_ok'); btn.classList.add('ok'); }
    setTimeout(function () {
      fecharSheet();
      bCO();
      flashSeq(seq);
    }, 380);
  }).catch(function () {
    if (btn) { btn.disabled = false; btn.textContent = t('salvar_btn'); }
  });
}

function resetSheetAtual() {
  if (!editState) return;
  var seq = editState.seq;
  var btn = document.querySelector('.sh-reset');
  if (btn) { btn.disabled = true; btn.textContent = t('restaurando'); }
  resetInfo(seq).then(function () {
    if (btn) { btn.disabled = false; btn.textContent = t('restaurado_ok'); btn.classList.add('ok'); }
    setTimeout(function () {
      editState.info = getInfo(seq);
      renderSheet();
    }, 380);
  }).catch(function () {
    if (btn) { btn.disabled = false; btn.textContent = t('restaurar_btn'); }
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
    + '<clipPath id="amClip"><polygon points="' + bPts + '"/></clipPath>'
    // "mapa 2.5D": luz rasante (diagonal, canto superior-esquerdo mais claro) —
    // dá a sensação de relevo/inclinação sem mudar nenhuma coordenada real,
    // então não interfere em nada do clique/arrasto do mapa.
    + '<linearGradient id="rasante" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#ffffff" stop-opacity="0.16"/><stop offset="45%" stop-color="#ffffff" stop-opacity="0"/><stop offset="100%" stop-color="#000000" stop-opacity="0.22"/></linearGradient>'
    // vinheta: escurece as bordas do mapa, reforçando a sensação de profundidade
    // ("olhando de cima, de um pouco de distância") — fixa na tela, não se move
    // com o pan/zoom do conteúdo, então também não mexe em nenhuma coordenada.
    + '<radialGradient id="vinheta" cx="50%" cy="46%" r="72%"><stop offset="55%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity="0.38"/></radialGradient>';
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
  var rasanteOverlay = document.createElementNS(NS, 'rect'); rasanteOverlay.setAttribute('width', W); rasanteOverlay.setAttribute('height', H); rasanteOverlay.setAttribute('fill', 'url(#rasante)'); amGroup.appendChild(rasanteOverlay);
  // Regime atual do nível do rio (Seca/Normal/Atenção/Alerta/Emergência)
  // pintado como um "glow" por baixo do traçado azul de cada rio — o rio
  // continua com cara de água, só ganha uma auréola na cor do regime,
  // reforçando visualmente o que já é mostrado na aba Notícias.
  var regime = regimeAtual();

  RIOS.forEach(function (rv) {
    var pts = rv.coords.map(function (c) { var p = proj(c[0], c[1]); return p.x + ' ' + p.y; });
    if (regime) {
      var glow = document.createElementNS(NS, 'polyline');
      glow.setAttribute('points', pts.join(', ')); glow.setAttribute('fill', 'none');
      glow.setAttribute('stroke', regime.cor); glow.setAttribute('stroke-width', String(rv.w + 5));
      glow.setAttribute('opacity', '0.35'); glow.setAttribute('stroke-linecap', 'round');
      glow.setAttribute('class', 'river-regime-glow' + (regime.critico ? ' river-regime-critico' : ''));
      glow.style.setProperty('--regime-glow', regime.cor);
      amGroup.appendChild(glow);
    }
    var path = document.createElementNS(NS, 'polyline');
    path.setAttribute('points', pts.join(', ')); path.setAttribute('fill', 'none');
    path.setAttribute('stroke', '#2f9bd6'); path.setAttribute('stroke-width', rv.w);
    path.setAttribute('opacity', '0.8'); path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('class', 'river-main'); amGroup.appendChild(path);

    // "correnteza": uma segunda linha por cima, com tracinhos claros que
    // correm ao longo do próprio rio — só decoração, bem sutil, não
    // atrapalha a leitura do traçado nem das rotas desenhadas por cima.
    var fluxo = document.createElementNS(NS, 'polyline');
    fluxo.setAttribute('points', pts.join(', ')); fluxo.setAttribute('fill', 'none');
    fluxo.setAttribute('stroke', '#bfe6ff'); fluxo.setAttribute('stroke-width', String(Math.max(1, rv.w * 0.4)));
    fluxo.setAttribute('stroke-linecap', 'round'); fluxo.setAttribute('class', 'river-flow');
    amGroup.appendChild(fluxo);
  });

  // contorno do estado, por cima de tudo, pra dar nitidez à silhueta
  var border = document.createElementNS(NS, 'polygon');
  border.setAttribute('points', bPts); border.setAttribute('fill', 'none'); border.setAttribute('stroke', '#3b82c4'); border.setAttribute('stroke-width', '2');
  border.setAttribute('class', 'am-border'); g.appendChild(border);

  var hubLL = { lat: -3.119, lng: -60.021 };
  var hub = proj(hubLL.lat, hubLL.lng);
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
  var routeLineEls = {}; // num da calha -> path "de medida" (pra animar a embarcação/ônibus por cima)
  var routeMarcosEls = {}; // num da calha -> [{seq, len}] (pra "pingar" o pino de cada município quando a animação passa por ele)

  /* Catmull-Rom -> Bézier: pontos de controle do trecho p1->p2 levando em
     conta os vizinhos p0/p3, pra linha curvar suave em vez de quebrar reto
     em cada município — usado só nas rotas rodoviárias (H/I), que não têm
     rio pra seguir. ("tensao" é o divisor padrão de Catmull-Rom, controla
     o quanto a curva "estica" — 6 é o valor usual, mais suave sem exagerar.) */
  function crControlPoints(p0, p1, p2, p3) {
    var tensao = 6;
    return {
      c1x: p1.x + (p2.x - p0.x) / tensao, c1y: p1.y + (p2.y - p0.y) / tensao,
      c2x: p2.x - (p3.x - p1.x) / tensao, c2y: p2.y - (p3.y - p1.y) / tensao
    };
  }

  /* Rotas fluviais: em vez de traçar reto (ou uma curva "solta") entre os
     municípios, a linha da rota acompanha o próprio traçado do rio (o fio
     azul já desenhado acima), andando pelos pontos do rio mais perto de
     cada município. Mapeamento calha -> rio; H e I ficam de fora (são
     rodoviárias, não têm rio pra seguir) e usam o traçado por Bézier acima. */
  var RIOS_POR_NOME = {}; RIOS.forEach(function (rv) { RIOS_POR_NOME[rv.name] = rv; });
  var RIO_TRONCO = RIOS_POR_NOME['Amazonas/Solimoes'];
  var ROTA_RIO = { A: 'Amazonas/Solimoes', B: 'Amazonas/Solimoes', C: 'Madeira', D: 'Amazonas/Solimoes', E: 'Amazonas/Solimoes', F: 'Rio Negro', G: 'Purus', J: 'Jurua' };
  // Madeira/Purus/Jurua nascem longe de Manaus: pra chegar neles a rota
  // primeiro desce/sobe o tronco (Solimões/Amazonas) até a foz do afluente,
  // só depois entra no afluente propriamente. Rio Negro já passa perto o
  // bastante do hub (a foz dele é o próprio encontro das águas em Manaus).
  var RIO_AFLUENTE_TRONCO = { Madeira: true, Purus: true, Jurua: true };
  // acima disso (em graus) o município é considerado fora da beira do rio —
  // a "entrada" dele é por um igarapé/afluente que o mapa não tem desenhado,
  // então a linha da rota vai só até o ponto do rio mais próximo, e um fio
  // fino à parte liga esse ponto até o município (ver "fio d'água" abaixo).
  var LIMITE_BEIRA_RIO = 0.15;

  function idxMaisPerto(river, lat, lng) {
    var bestI = 0, bestD = Infinity;
    for (var i = 0; i < river.coords.length; i++) {
      var c = river.coords[i];
      var d = Math.hypot(c[0] - lat, c[1] - lng);
      if (d < bestD) { bestD = d; bestI = i; }
    }
    return { idx: bestI, dist: bestD };
  }
  function trechoRio(river, iA, iB) {
    var pts = [];
    if (iA <= iB) { for (var i = iA; i <= iB; i++) pts.push(river.coords[i]); }
    else { for (var i = iA; i >= iB; i--) pts.push(river.coords[i]); }
    return pts;
  }

  ROTAS.forEach(function (r, ri) {
    var algumAtivo = r.municipios.some(function (m) { return nodeAtivo(m, r.num); });
    var largura = (algumAtivo && !tipoFiltrado) ? '1.6' : '0.7';
    var opacidade = tipoFiltrado ? '0.1' : (algumAtivo ? '0.6' : '0.06');
    var nomeRio = ROTA_RIO[r.num];
    var dCompleto = '';
    var trechoIdx = 0; // conta trechos desenhados nesta rota, só pro atraso da animação de entrada
    var marcos = []; // [{seq, len}] em ordem: comprimento acumulado da curva até cada município, pra "pingar" o pino quando a animação (barco/ônibus) passa por ele

    function registrarMarco(destinoM) {
      if (!destinoM) return;
      var tmp = document.createElementNS(NS, 'path'); tmp.setAttribute('d', dCompleto);
      marcos.push({ seq: destinoM.seq, len: tmp.getTotalLength() });
    }

    function desenharTrecho(pontosLL, destinoM) {
      if (!pontosLL || pontosLL.length < 2) return;
      var pts = pontosLL.map(function (c) { return proj(c[0], c[1]); });
      var d = 'M ' + pts[0].x + ',' + pts[0].y;
      for (var i = 1; i < pts.length; i++) d += ' L ' + pts[i].x + ',' + pts[i].y;
      dCompleto += (dCompleto ? ' ' : '') + d; // path com vários subpaths M ainda soma certo no getTotalLength/getPointAtLength
      registrarMarco(destinoM);

      var seg = destinoM ? SEGURANCA[destinoM.seq] : null;
      var trecho = document.createElementNS(NS, 'path');
      trecho.setAttribute('d', d); trecho.setAttribute('fill', 'none');
      trecho.setAttribute('class', 'mline');
      trecho.setAttribute('stroke', r.cor); trecho.setAttribute('stroke-width', largura);
      trecho.setAttribute('opacity', opacidade); trecho.setAttribute('stroke-linecap', 'round');
      trecho.setAttribute('stroke-linejoin', 'round');
      if (seg) trecho.setAttribute('stroke-dasharray', '6,5');
      g.appendChild(trecho);

      if (animarEntrada) {
        var len = trecho.getTotalLength();
        trecho.style.setProperty('--len', len);
        trecho.style.strokeDasharray = seg ? '6,5' : String(len);
        trecho.classList.add('mline-draw');
        trecho.style.animationDelay = ((ri * 9 + trechoIdx) * 35) + 'ms';
        trechoIdx++;
      }
    }

    function desenharTrechoBezier(p0, p1, p2, p3, destinoM, idxAnim) {
      var cp = crControlPoints(p0, p1, p2, p3);
      var d = 'M ' + p1.x + ',' + p1.y + ' C ' + cp.c1x + ',' + cp.c1y + ' ' + cp.c2x + ',' + cp.c2y + ' ' + p2.x + ',' + p2.y;
      dCompleto += (dCompleto ? ' ' : '') + d;
      registrarMarco(destinoM);

      var seg = destinoM ? SEGURANCA[destinoM.seq] : null;
      var trecho = document.createElementNS(NS, 'path');
      trecho.setAttribute('d', d); trecho.setAttribute('fill', 'none');
      trecho.setAttribute('class', 'mline');
      trecho.setAttribute('stroke', r.cor); trecho.setAttribute('stroke-width', largura);
      trecho.setAttribute('opacity', opacidade); trecho.setAttribute('stroke-linecap', 'round');
      if (seg) trecho.setAttribute('stroke-dasharray', '6,5');
      g.appendChild(trecho);

      if (animarEntrada) {
        var len = trecho.getTotalLength();
        trecho.style.setProperty('--len', len);
        trecho.style.strokeDasharray = seg ? '6,5' : String(len);
        trecho.classList.add('mline-draw');
        trecho.style.animationDelay = ((ri * 9 + idxAnim) * 35) + 'ms';
      }
    }

    if (nomeRio) {
      // ---- rota fluvial: a linha segue o traçado do rio (o fio azul) ----
      var river = RIOS_POR_NOME[nomeRio];
      var afluente = !!RIO_AFLUENTE_TRONCO[nomeRio];
      var idxAtual, pontoAtual;

      if (afluente) {
        var hubNoTronco = idxMaisPerto(RIO_TRONCO, hubLL.lat, hubLL.lng);
        var bocaIdx = river.coords.length - 1; // foz do afluente no tronco (sempre o último ponto, nesses 3 rios)
        var bocaLL = river.coords[bocaIdx];
        var troncoNaBoca = idxMaisPerto(RIO_TRONCO, bocaLL[0], bocaLL[1]);
        desenharTrecho([[hubLL.lat, hubLL.lng]].concat(trechoRio(RIO_TRONCO, hubNoTronco.idx, troncoNaBoca.idx)), null);
        idxAtual = bocaIdx;
        pontoAtual = river.coords[bocaIdx];
      } else {
        var hubNoRio = idxMaisPerto(river, hubLL.lat, hubLL.lng);
        desenharTrecho([[hubLL.lat, hubLL.lng], river.coords[hubNoRio.idx]], null);
        idxAtual = hubNoRio.idx;
        pontoAtual = river.coords[hubNoRio.idx];
      }

      r.municipios.forEach(function (m) {
        var ll = LATLNG[m.seq]; if (!ll) return;
        var dock = idxMaisPerto(river, ll.lat, ll.lng);
        // o traçado do rio é uma poligonal simplificada — em trechos onde
        // vários municípios vizinhos caem no mesmo ponto mais próximo dela
        // (pouca resolução ali), liga direto o ponto anterior até este,
        // em vez de deixar a linha "sumir" (comprimento zero).
        var pontosLL = (dock.idx === idxAtual) ? [pontoAtual, [ll.lat, ll.lng]] : trechoRio(river, idxAtual, dock.idx);
        desenharTrecho(pontosLL, m);
        idxAtual = dock.idx;
        pontoAtual = pontosLL[pontosLL.length - 1];

        // "fio d'água": município fora da beira do rio (entrada por
        // igarapé/afluente) — liga o ponto do rio mais próximo até ele.
        if (dock.dist > LIMITE_BEIRA_RIO) {
          var pReal = proj(ll.lat, ll.lng);
          var pDock = proj(river.coords[dock.idx][0], river.coords[dock.idx][1]);
          var fio = document.createElementNS(NS, 'path');
          fio.setAttribute('d', 'M ' + pReal.x + ',' + pReal.y + ' L ' + pDock.x + ',' + pDock.y);
          fio.setAttribute('fill', 'none'); fio.setAttribute('stroke', '#2f9bd6');
          fio.setAttribute('stroke-width', '0.6'); fio.setAttribute('stroke-dasharray', '1.5,2.5');
          fio.setAttribute('stroke-linecap', 'round'); fio.setAttribute('opacity', opacidade);
          fio.setAttribute('class', 'fio-agua'); // gotejamento animado (ver CSS) — mostra que a "entrada" ali também é água
          g.appendChild(fio);
        }
      });
    } else {
      // ---- rota rodoviária (H/I), sem rio pra seguir: Bézier suave entre
      // os pontos, respeitando ramificação (campo `de`, ex. Humaitá na I) ----
      var pares = r.municipios.map(function (m) {
        var ll = LATLNG[m.seq]; return ll ? { m: m, p: proj(ll.lat, ll.lng) } : null;
      }).filter(Boolean);
      if (pares.length) {
        var porSeq = {}; pares.forEach(function (it) { porSeq[it.m.seq] = it; });
        var hubItem = { m: null, p: hub };
        function paiDe(it, idx) {
          if (it.m.de) return porSeq[it.m.de] || hubItem;
          return idx === 0 ? hubItem : pares[idx - 1];
        }
        function filhoUnicoDe(it) {
          var filhos = pares.filter(function (o, i) { return paiDe(o, i) === it; });
          return filhos.length === 1 ? filhos[0] : null;
        }

        pares.forEach(function (it, idx) {
          var pai = paiDe(it, idx);
          var avo = pai === hubItem ? hubItem : paiDe(pai, pares.indexOf(pai));
          var filho = filhoUnicoDe(it);
          var p0 = avo.p, p1 = pai.p, p2 = it.p, p3 = filho ? filho.p : it.p;
          desenharTrechoBezier(p0, p1, p2, p3, it.m, idx);
        });
      }
    }

    // path invisível com a rota inteira (hub -> últimos municípios), só pra
    // medir posição/distância — usado pra animar o barco/ônibus por cima.
    var medida = document.createElementNS(NS, 'path');
    medida.setAttribute('d', dCompleto); medida.setAttribute('fill', 'none'); medida.setAttribute('stroke', 'none');
    g.appendChild(medida);
    routeLineEls[r.num] = medida;
    routeMarcosEls[r.num] = marcos;
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
      grp.setAttribute('data-mnode-seq', m.seq);
      grp.setAttribute('data-px', p.x); grp.setAttribute('data-py', p.y);
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
        var ringDelay = document.createElementNS(NS, 'title'); ringDelay.textContent = t('seg_ponto_atencao') + ' ' + segMetaLabel(seg.tipo);
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
    iniciarAnimacaoRota(rotaFiltrada, routeLineEls[rotaFiltrada], iz, routeMarcosEls[rotaFiltrada]);
  } else {
    pararAnimacaoRota();
  }

  // Linha estimada entre dois municípios (calculadora de rota A→B,
  // botão 🧭 no mapa) — traço reto e tracejado, deliberadamente
  // diferente do traçado real dos rios/rotas, pra deixar claro que é
  // uma linha ilustrativa (ver calcularRotaEstimada() pro método).
  if (ROTA_CALC.origem && ROTA_CALC.destino && ROTA_CALC.origem !== ROTA_CALC.destino) {
    var llA = LATLNG[ROTA_CALC.origem], llB = LATLNG[ROTA_CALC.destino];
    if (llA && llB) {
      var pA = proj(llA.lat, llA.lng), pB = proj(llB.lat, llB.lng);
      var calcLine = document.createElementNS(NS, 'line');
      calcLine.setAttribute('x1', pA.x); calcLine.setAttribute('y1', pA.y);
      calcLine.setAttribute('x2', pB.x); calcLine.setAttribute('y2', pB.y);
      calcLine.setAttribute('class', 'rota-calc-line');
      g.appendChild(calcLine);
      [pA, pB].forEach(function (p) {
        var dot = document.createElementNS(NS, 'circle');
        dot.setAttribute('cx', p.x); dot.setAttribute('cy', p.y); dot.setAttribute('r', 6);
        dot.setAttribute('class', 'rota-calc-dot');
        g.appendChild(dot);
      });
    }
  }

  // legenda do regime do rio (o mesmo "regime" usado pra pintar o glow
  // dos rios acima) — clicável, leva direto pra aba Notícias
  var legenda = document.getElementById('map-regime-legend');
  if (legenda) {
    if (regime) {
      legenda.classList.remove('h');
      legenda.innerHTML = '<span class="map-regime-dot" style="background:' + regime.cor + '"></span>' + regimeLabel(regime);
    } else {
      legenda.classList.add('h');
    }
  }

  // vinheta do "mapa 2.5D": fica FORA do <g id="mg"> (irmã dele, não filha),
  // então nunca recebe o transform de pan/zoom nem participa da matemática
  // de arrasto/clique — é puramente visual, sempre cobrindo a tela inteira.
  var vinheta = document.createElementNS(NS, 'rect');
  vinheta.setAttribute('x', '-50'); vinheta.setAttribute('y', '-50');
  vinheta.setAttribute('width', W + 100); vinheta.setAttribute('height', H + 100);
  vinheta.setAttribute('fill', 'url(#vinheta)');
  vinheta.setAttribute('pointer-events', 'none');
  svg.appendChild(vinheta);

  applyMapTransform();
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

function iniciarAnimacaoRota(num, line, iz, marcos) {
  pararAnimacaoRota();
  var g = document.getElementById('mg'); if (!g || !line) return;
  var len = line.getTotalLength(); if (!len) return;

  var r = ROTAS.filter(function (x) { return x.num === num; })[0]; if (!r) return;
  var rodoviaria = isRodoviaria(r);
  var NS = 'http://www.w3.org/2000/svg';

  // grupo "pai": embrulha o rastro (atrás) + o ícone (na frente), assim um
  // único #route-anim-icon dá conta de remover tudo de uma vez (ver
  // pararAnimacaoRota()).
  var wrap = document.createElementNS(NS, 'g');
  wrap.id = 'route-anim-icon';

  // rastro: alguns pontinhos "puxando" o ícone, encolhendo e sumindo —
  // dá sensação de movimento/esteira na água (ou poeira, no caso do ônibus).
  var TRAIL_N = 6, TRAIL_STEP = 0.016;
  var trailEls = [];
  for (var ti = 1; ti <= TRAIL_N; ti++) {
    var td = document.createElementNS(NS, 'circle');
    td.setAttribute('r', String(Math.max(0.6, 3.2 - ti * 0.42) * iz));
    td.setAttribute('fill', r.cor);
    td.setAttribute('opacity', String(Math.max(0, 0.5 - ti * 0.075)));
    wrap.appendChild(td);
    trailEls.push(td);
  }

  // grupo com um halo escuro atrás (pra destacar em cima de qualquer cor de linha/fundo) + o emoji
  var icon = document.createElementNS(NS, 'g');
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

  wrap.appendChild(icon);
  g.appendChild(wrap);

  routeAnim.num = num;

  // "ping" no pino do município quando a animação passa por ele — e, na
  // rota I (única com bifurcação, ver campo `de` em data.js), um destaque
  // diferente em Humaitá no instante em que a carga se reparte pras duas
  // pontas (Apuí/Lábrea).
  var marcosEstado = (marcos || []).map(function (mk) { return { seq: mk.seq, len: mk.len, feito: false }; });
  function pingMunicipio(seq) {
    var alvo = document.querySelector('[data-mnode-seq="' + seq + '"]');
    if (!alvo) return;
    var px = alvo.getAttribute('data-px'), py = alvo.getAttribute('data-py');
    if (px == null || py == null) return;
    var bifurcacao = (num === 'I' && seq === 'HUM');
    var ring = document.createElementNS(NS, 'circle');
    ring.setAttribute('cx', px); ring.setAttribute('cy', py);
    ring.setAttribute('r', String((bifurcacao ? 7 : 9) * iz));
    ring.setAttribute('fill', 'none'); ring.setAttribute('stroke', r.cor);
    ring.setAttribute('stroke-width', String((bifurcacao ? 2.2 : 1.6) * iz));
    ring.setAttribute('class', bifurcacao ? 'mnode-ping mnode-ping-split' : 'mnode-ping');
    g.appendChild(ring);
    setTimeout(function () { if (ring.parentNode) ring.parentNode.removeChild(ring); }, bifurcacao ? 900 : 650);
    if (bifurcacao) {
      // segundo anel, um pouco atrasado, pra reforçar a ideia de "duas frentes"
      var ring2 = ring.cloneNode();
      ring2.style.animationDelay = '140ms';
      g.appendChild(ring2);
      setTimeout(function () { if (ring2.parentNode) ring2.parentNode.removeChild(ring2); }, 1050);
    }
  }
  function verificarMarcos(lenAtual) {
    marcosEstado.forEach(function (mk) {
      if (!mk.feito && lenAtual >= mk.len - 0.5) { mk.feito = true; pingMunicipio(mk.seq); }
    });
  }
  function resetarMarcos() { marcosEstado.forEach(function (mk) { mk.feito = false; }); }

  function posicionar(t) {
    var pt = line.getPointAtLength(t * len);
    icon.setAttribute('transform', 'translate(' + pt.x + ',' + pt.y + ')');
    trailEls.forEach(function (td, i) {
      var tt = Math.max(0, t - TRAIL_STEP * (i + 1));
      var p2 = line.getPointAtLength(tt * len);
      td.setAttribute('cx', p2.x); td.setAttribute('cy', p2.y);
    });
  }

  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) {
    posicionar(0.5); // sem movimento: só mostra o ícone parado no meio da rota
    return;
  }

  var duration = 4200; // ms pra ir do porto/garagem até o fim da calha
  var pausa = 900;     // ms parado no fim antes de reiniciar o percurso
  var startTime = null, elapsedAnterior = 0;

  function frame(ts) {
    if (routeAnim.num !== num) return; // outra rota foi selecionada / animação foi parada
    if (!startTime) startTime = ts;
    var elapsed = (ts - startTime) % (duration + pausa);
    if (elapsed < elapsedAnterior) resetarMarcos(); // voltou pro começo: reseta os pings pra próxima volta
    elapsedAnterior = elapsed;
    var t = Math.min(elapsed / duration, 1);
    posicionar(t);
    verificarMarcos(t * len);
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
        + segMeta.icone + ' ' + segMetaCurto(seg.tipo) + ' <span class="mp-segtag-link">· ' + t('ver_detalhes') + '</span></button>' : '')
    + '<div class="mp-kpis">'
    + '<div class="mp-kpi"><div class="mp-kt">' + t('kpi_transit') + '</div><div class="mp-kv">' + m.tt + '</div></div>'
    + '<div class="mp-kpi"><div class="mp-kt">' + t('kpi_distancia') + '</div><div class="mp-kv">' + m.km + ' km</div></div>'
    + '<div class="mp-kpi"><div class="mp-kt">' + t('kpi_tt_amazon') + '</div><div class="mp-kv">' + fmtTA(info.ta) + '</div></div>'
    + '</div>'
    + '<div class="mp-emb">'
    + '<div class="mp-embrow">🏜️ <b>' + fmtSaca(info.ps.seca) + '</b></div>'
    + '<div class="mp-embrow">🌊 <b>' + fmtSaca(info.ps.cheia) + '</b></div>'
    + '<div class="mp-embrow">🚢 <b>' + (pEmb ? pEmb.n : '—') + '</b></div>'
    + '</div>'
    + '<div class="mp-nav">'
    + (prev ? '<span>⬅ ' + prev.nome + '</span>' : '<span class="mp-dim">⬅ ' + t('map_popup_inicio') + '</span>')
    + (next ? '<span>' + next.nome + ' ➡</span>' : '<span class="mp-dim">' + t('map_popup_fim') + ' ➡</span>')
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
  all.textContent = t('map_filter_todas');
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
    btn.innerHTML = meta.icone + ' ' + segMetaCurto(tipo);
    btn.title = segMetaLabel(tipo);
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
  // "mapa 2.5D": paralaxe do brilho atmosférico atrás do mapa (fora do SVG,
  // no CSS de #map-wrap) — se desloca uma fração do pan, dando sensação de
  // profundidade. Só mexe numa custom property lida pelo CSS; não toca em
  // nenhuma coordenada usada por clique/arrasto/zoom.
  var wrap = document.getElementById('map-wrap');
  if (wrap) {
    var px = Math.max(-32, Math.min(32, T.x * 0.03));
    var py = Math.max(-32, Math.min(32, T.y * 0.03));
    wrap.style.setProperty('--map-px', px.toFixed(1) + 'px');
    wrap.style.setProperty('--map-py', py.toFixed(1) + 'px');
  }
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
/* "pill" deslizante atrás da aba ativa (desktop, cabeçalho) e barrinha
   deslizante embaixo do ícone ativo (mobile, menu inferior) — desliza até
   a posição/largura certa em vez de só trocar a cor na hora. Recalculada
   a cada troca de aba, no resize e quando o idioma muda (o texto da aba
   muda de largura em cada idioma). */
function atualizarIndicadorAbas() {
  var ativoH = document.querySelector('.htab.on');
  var pill = document.getElementById('htab-pill');
  if (ativoH && pill) {
    pill.style.width = ativoH.offsetWidth + 'px';
    pill.style.transform = 'translateX(' + ativoH.offsetLeft + 'px)';
  }
  var ativoB = document.querySelector('.btab.on');
  var ind = document.getElementById('btab-ind');
  if (ativoB && ind) {
    ind.style.width = ativoB.offsetWidth + 'px';
    ind.style.transform = 'translateX(' + ativoB.offsetLeft + 'px)';
  }
}
window.addEventListener('resize', function () {
  clearTimeout(window._indAbasResizeT);
  window._indAbasResizeT = setTimeout(atualizarIndicadorAbas, 120);
});

function SS(name, btn) {
  cur = name;
  ['r', 'i', 'c', 'm', 'n', 'w'].forEach(function (s) {
    var el = document.getElementById('sc-' + s);
    if (el) el.classList.toggle('h', s !== name);
  });
  document.querySelectorAll('.htab').forEach(function (b) { b.classList.toggle('on', b.dataset.s === name); });
  ['r', 'i', 'c', 'm', 'n', 'w'].forEach(function (s) { var bt = document.getElementById('bt-' + s); if (bt) bt.classList.toggle('on', s === name); });

  // conteúdo da aba recém-aberta entra com um fade + leve deslocamento
  // (reflow força reiniciar a animação, igual o truque usado em flashSeq)
  var scAtual = document.getElementById('sc-' + name);
  if (scAtual) {
    scAtual.classList.remove('scr-enter');
    void scAtual.offsetWidth;
    scAtual.classList.add('scr-enter');
  }
  atualizarIndicadorAbas();

  if (name === 'i') bINFO();
  if (name === 'c') bCO();
  if (name === 'm') { mapAnimateEntrance = true; buildMapFilters(); renderMap(); initMapInteractions(); }
  if (name === 'n') bNIVEL();
  if (name === 'w') {
    bCLIMA();
    // busca de novo só se nunca buscou ou se já faz tempo — abrir/fechar
    // a aba não deve disparar uma chamada nova toda vez
    var stale = !CLIMA_ATUALIZADO_EM || (Date.now() - CLIMA_ATUALIZADO_EM > CLIMA_INTERVALO_MS);
    if (stale && !CLIMA_CARREGANDO) carregarClima();
  }
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
  if (state === 'live') { dot.classList.add('live'); dot.title = t('live_live_title'); }
  else if (state === 'offline') { dot.classList.add('offline'); dot.title = t('live_offline_title'); }
  else { dot.title = t('live_connecting'); }
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
  setIdiomaEstatico(idiomaSalvo());
  atualizarHeroSub();
  requestAnimationFrame(atualizarIndicadorAbas);

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
  carregarClima(); // dispara em paralelo (não é await) — não deve atrasar o resto do app
  atualizarBotaoPush(); // idem: só ajusta o ícone do sino, não deve atrasar o resto do app

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
        if (NIVEL_HIST.length) atualizarAlertaAba('n', !!classificarNivel(NIVEL_HIST[NIVEL_HIST.length - 1].nivel_m).critico);
        if (cur === 'n') bNIVEL();
        if (cur === 'm') renderMap(); // cor dos rios (regime do nível) precisa acompanhar em tempo real
      });
    })
    .subscribe();

  sb.auth.onAuthStateChange(function (event) {
    if (event === 'SIGNED_OUT') window.location.replace('/login.html');
  });
}
