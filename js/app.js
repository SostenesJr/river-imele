/* ============================================================
   NAVLOG AMAZÔNIA — APP.JS
   4 abas: Rotas · Informações · Configurações · Mapa
   ============================================================ */

var cur = 'r';
var CURRENT_USER = null; // { id, email, role } — usuário logado (Supabase Auth); role: 'admin' | 'cliente'
var CONFIG_EMPRESA = { nome_empresa: null, logo_url: null }; // nome/logo mostrados no cabeçalho pra todo mundo

/* Perfil de acesso: 'admin' edita tudo (Configurações); 'cliente' só
   visualiza. Se o usuário logado ainda não tiver uma linha em `perfis`,
   o padrão é 'cliente' (mais seguro) — quem administra o Supabase precisa
   cadastrar o primeiro admin manualmente (ver README). */
async function carregarPerfil() {
  var res = await sb.from('perfis').select('role,nome').eq('user_id', CURRENT_USER.id);
  if (res.error) { console.error('Erro ao carregar perfil:', res.error); CURRENT_USER.role = 'cliente'; return; }
  var row = (res.data && res.data[0]) || null;
  CURRENT_USER.role = (row && row.role) || 'cliente';
}

function souAdmin() { return !!(CURRENT_USER && CURRENT_USER.role === 'admin'); }

function aplicarGateAdmin() {
  var admin = souAdmin();
  document.querySelectorAll('.htab[data-s="c"]').forEach(function (el) {
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

function aplicarTema(tema) {
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

function sheetScaleSalva() {
  try { var v = parseFloat(localStorage.getItem('navlog-sheet-scale')); return v || 1; }
  catch (e) { return 1; }
}
function setSheetScale(escala) {
  var sheet = document.getElementById('sheet');
  if (sheet) sheet.style.setProperty('--sh-scale', escala);
  try { localStorage.setItem('navlog-sheet-scale', escala); } catch (e) { /* modo privado etc. */ }
  document.querySelectorAll('.sh-size-btn').forEach(function (b) {
    b.classList.toggle('on', parseFloat(b.dataset.sz) === escala);
  });
}

function aplicarIdioma(lang) {
  setIdiomaEstatico(lang);
  atualizarHeroSub();
  if (typeof atualizarIndicadorAbas === 'function') requestAnimationFrame(atualizarIndicadorAbas);
  if (typeof ROTAS === 'undefined') return;
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

  if (el._heroCountRaf) cancelAnimationFrame(el._heroCountRaf);
  var inicio = null, duracao = 900;
  function passo(ts) {
    if (!inicio) inicio = ts;
    var p = Math.min((ts - inicio) / duracao, 1);
    var facil = 1 - Math.pow(1 - p, 3);
    el.textContent = tf('hero_sub_tpl', { calhas: Math.round(calhasAlvo * facil), municipios: Math.round(munAlvo * facil) });
    el._heroCountRaf = (p < 1) ? requestAnimationFrame(passo) : null;
  }
  el._heroCountRaf = requestAnimationFrame(passo);
}

var PUSH_ESTADO = 'indisponivel';

function pushSuportado() {
  return 'serviceWorker' in navigator && typeof window.PushManager !== 'undefined' && typeof window.Notification !== 'undefined';
}

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

function sair() {
  sb.auth.signOut().then(function () { window.location.href = '/login.html'; })
    .catch(function () { window.location.href = '/login.html'; });
}

function normKey(s) { return (s||'').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }

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

var MUNINFO_LIVE = {};

function rowToInfo(row) {
  return {
    ta: row.ta,
    ps: { seca: row.ps_seca, cheia: row.ps_cheia },
    emb: row.emb || [],
    dias: row.dias || [],
    contato: { nome: row.contato_nome || '', tel: row.contato_tel || '' },
    // alerta: candidato/confirmado automaticamente pelo cron (ver "Alerta
    // de emergência por município" no README) — null quando não há nada
    // em aberto pra esse município.
    alerta: row.alerta || null,
    // alertaDispensados: lista de fonte_url já descartadas por um admin
    // (ver limparAlerta()), pra o cron não recriar o mesmo candidato
    alertaDispensados: row.alerta_dispensados || []
  };
}

async function carregarMunicipiosInfo() {
  var res = await sb.from('municipios_info').select('*');
  if (res.error) { console.error('Erro ao carregar municipios_info:', res.error); return; }
  var live = {};
  (res.data || []).forEach(function (row) { live[row.seq] = rowToInfo(row); });
  MUNINFO_LIVE = live;
}

function getInfo(seq) {
  var fonte = MUNINFO_LIVE[seq] || MUNINFO[seq]
    || { ta: null, ps: { seca: null, cheia: null }, emb: [], dias: [] };
  var info = JSON.parse(JSON.stringify(fonte));
  if (!info.dias) info.dias = [];
  if (!info.contato) info.contato = { nome: '', tel: '' };
  if (info.alerta === undefined) info.alerta = null;
  if (!info.alertaDispensados) info.alertaDispensados = [];
  return info;
}

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

async function resetInfo(seq) {
  var original = MUNINFO[seq] || { ta: null, ps: { seca: null, cheia: null }, emb: [], dias: [] };
  original = JSON.parse(JSON.stringify(original));
  if (!original.dias) original.dias = [];
  if (!original.contato) original.contato = { nome: '', tel: '' };
  await setInfo(seq, original);
}

/* ============================================================
   ALERTA DE EMERGÊNCIA POR MUNICÍPIO (seca/cheia/geral)
   ============================================================
   Detectado automaticamente pelo cron (api/cron/clima-alertas.js, 4a
   checagem — raspa o feed de notícias da Agência Brasil) e salvo na
   coluna `alerta` de municipios_info como um CANDIDATO
   (confirmado:false). Fica invisível pra cliente até um admin revisar
   em Configurações (confirmar ou descartar) — só depois de confirmado
   aparece na aba Informações. Ver README, seção "Alerta de emergência
   por município".
   ============================================================ */
var ALERTA_TIPO_META = {
  seca: { ic: '🏜️', key: 'alerta_emerg_tipo_seca', cor: '#f59e0b' },
  cheia: { ic: '🌊', key: 'alerta_emerg_tipo_cheia', cor: '#3b82c4' },
  geral: { ic: '⚠️', key: 'alerta_emerg_tipo_geral', cor: '#ef4444' }
};
function alertaTipoMeta(tipo) { return ALERTA_TIPO_META[tipo] || ALERTA_TIPO_META.geral; }

function fmtDataBR(iso) {
  if (!iso) return '—';
  var p = String(iso).split('-');
  if (p.length !== 3) return iso;
  return p[2] + '/' + p[1] + '/' + p[0];
}

/* Somente leitura — aba Informações. Só mostra algo quando o alerta já
   foi confirmado por um admin (candidato não aparece aqui). */
function alertaMunicipioViewHTML(seq) {
  var info = getInfo(seq);
  var al = info.alerta;
  if (!al || !al.confirmado) return '';
  var meta = alertaTipoMeta(al.tipo);
  return '<div class="sh-alerta-emerg sh-alerta-emerg-ativo" style="--alerta-cor:' + meta.cor + '">'
    + '<div class="sh-alerta-emerg-hdr">'
    + '<span class="sh-alerta-emerg-ic">' + meta.ic + '</span>'
    + '<span class="sh-alerta-emerg-tt">' + t(meta.key).toUpperCase() + '</span>'
    + '</div>'
    + (al.titulo ? '<div class="sh-alerta-emerg-titulo">' + String(al.titulo).replace(/</g, '&lt;') + '</div>' : '')
    + '<div class="sh-alerta-emerg-meta">' + tf('alerta_emerg_desde_tpl', { data: fmtDataBR(al.desde) }) + '</div>'
    + (al.fonte_url ? '<a class="sh-alerta-emerg-fonte" href="' + String(al.fonte_url).replace(/"/g, '&quot;') + '" target="_blank" rel="noopener">' + t('alerta_emerg_ver_fonte') + '</a>' : '')
    + '</div>';
}

/* Painel de revisão/controle — só admin, dentro do balão de edição
   (Configurações). Candidato (confirmado:false): mostra a notícia e os
   botões Confirmar/Descartar. Já confirmado: mostra que está ativo (e
   visível na aba Informações) com um botão pra encerrar manualmente,
   já que a raspagem automática não tem como saber quando a situação
   acabou. */
function alertaMunicipioEditHTML(seq) {
  if (!souAdmin()) return '';
  var info = getInfo(seq);
  var al = info.alerta;
  if (!al) return '';
  var meta = alertaTipoMeta(al.tipo);
  var tituloHTML = al.titulo ? '<div class="sh-alerta-emerg-titulo">' + String(al.titulo).replace(/</g, '&lt;') + '</div>' : '';
  var fonteHTML = al.fonte_url ? '<a class="sh-alerta-emerg-fonte" href="' + String(al.fonte_url).replace(/"/g, '&quot;') + '" target="_blank" rel="noopener">' + t('alerta_emerg_ver_fonte') + '</a>' : '';

  if (!al.confirmado) {
    return '<div class="sh-alerta-emerg sh-alerta-emerg-candidato" style="--alerta-cor:' + meta.cor + '">'
      + '<div class="sh-alerta-emerg-hdr">'
      + '<span class="sh-alerta-emerg-ic">' + meta.ic + '</span>'
      + '<span class="sh-alerta-emerg-tt">' + t('alerta_emerg_candidato_title') + '</span>'
      + '</div>'
      + tituloHTML
      + '<div class="sh-alerta-emerg-hint">' + t('alerta_emerg_candidato_hint') + '</div>'
      + fonteHTML
      + '<div class="sh-alerta-emerg-actions">'
      + '<button type="button" class="sh-btn alerta-dispensar-btn" onclick="limparAlerta(\'' + seq + '\')">' + t('alerta_emerg_dispensar_btn') + '</button>'
      + '<button type="button" class="sh-btn sh-save alerta-confirmar-btn" onclick="confirmarAlerta(\'' + seq + '\')">' + t('alerta_emerg_confirmar_btn') + '</button>'
      + '</div></div>';
  }

  return '<div class="sh-alerta-emerg sh-alerta-emerg-ativo" style="--alerta-cor:' + meta.cor + '">'
    + '<div class="sh-alerta-emerg-hdr">'
    + '<span class="sh-alerta-emerg-ic">' + meta.ic + '</span>'
    + '<span class="sh-alerta-emerg-tt">' + t('alerta_emerg_ativo_title') + '</span>'
    + '</div>'
    + tituloHTML
    + '<div class="sh-alerta-emerg-meta">' + tf('alerta_emerg_desde_tpl', { data: fmtDataBR(al.desde) }) + '</div>'
    + fonteHTML
    + '<div class="sh-alerta-emerg-actions">'
    + '<button type="button" class="sh-btn alerta-dispensar-btn" onclick="limparAlerta(\'' + seq + '\')">' + t('alerta_emerg_encerrar_btn') + '</button>'
    + '</div></div>';
}

/* Confirma o candidato: deixa de ser só visível pro admin e passa a
   aparecer também na aba Informações, pra todo mundo. */
async function confirmarAlerta(seq) {
  if (!souAdmin()) return;
  var info = getInfo(seq);
  if (!info.alerta) return;
  var btn = document.querySelector('.alerta-confirmar-btn');
  if (btn) { btn.disabled = true; btn.textContent = t('salvando'); }
  var novoAlerta = {
    tipo: info.alerta.tipo, titulo: info.alerta.titulo, texto: info.alerta.texto,
    fonte_url: info.alerta.fonte_url, desde: info.alerta.desde, confirmado: true
  };
  var res = await sb.from('municipios_info').upsert({ seq: seq, alerta: novoAlerta }, { onConflict: 'seq' });
  if (res.error) {
    alert(tf('erro_salvar_tpl', { msg: res.error.message }));
    if (btn) { btn.disabled = false; }
    renderSheet();
    return;
  }
  info.alerta = novoAlerta;
  MUNINFO_LIVE[seq] = info;
  if (editState && editState.seq === seq) { editState.info = getInfo(seq); renderSheet(); }
  if (viewSeq === seq) renderInfoView();
  bINFO(); bCO();
  flashSeq(seq);
}

/* Usado tanto pra "Descartar" (candidato ainda não confirmado) quanto
   pra "Encerrar alerta" (já confirmado, situação resolvida): limpa o
   alerta e guarda a fonte em alertaDispensados, pra o cron não recriar
   o mesmo candidato a partir da mesma notícia nas próximas rodadas. */
async function limparAlerta(seq) {
  if (!souAdmin()) return;
  var info = getInfo(seq);
  if (!info.alerta) return;
  var btn = document.querySelector('.alerta-dispensar-btn');
  if (btn) { btn.disabled = true; btn.textContent = t('salvando'); }
  var dispensados = (info.alertaDispensados || []).slice();
  if (info.alerta.fonte_url && dispensados.indexOf(info.alerta.fonte_url) === -1) dispensados.push(info.alerta.fonte_url);
  var res = await sb.from('municipios_info').upsert({ seq: seq, alerta: null, alerta_dispensados: dispensados }, { onConflict: 'seq' });
  if (res.error) {
    alert(tf('erro_salvar_tpl', { msg: res.error.message }));
    if (btn) { btn.disabled = false; }
    renderSheet();
    return;
  }
  info.alerta = null;
  info.alertaDispensados = dispensados;
  MUNINFO_LIVE[seq] = info;
  if (editState && editState.seq === seq) { editState.info = getInfo(seq); renderSheet(); }
  if (viewSeq === seq) renderInfoView();
  bINFO(); bCO();
}

function embAvaliacaoRuim(emb) {
  var avaliadas = (emb || []).filter(function (it) { return it && it.nota; });
  return avaliadas.length > 0 && avaliadas.every(function (it) { return it.nota <= 2; });
}

var OBS = {};
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

var NIVEL_HIST = [];

var NIVEL_ESCALA_MIN = 11, NIVEL_ESCALA_MAX = 30;
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
function regimeAtual() {
  if (!NIVEL_HIST.length) return null;
  return classificarNivel(NIVEL_HIST[NIVEL_HIST.length - 1].nivel_m);
}

function nivelAlertaHTML(regime) {
  if (!regime.critico) return '';
  var texto = t('alert_text_' + regime.label) || '';
  return '<div class="niv-alert-banner ' + regime.classe + '">'
    + '<span class="niv-alert-ic">⚠️</span>'
    + '<div><div class="niv-alert-tt">' + tf('niv_alert_title_tpl', { regime: regimeLabel(regime) }) + '</div>'
    + '<div class="niv-alert-tx">' + texto + '</div></div>'
    + '</div>';
}
function atualizarAlertaAba(tab, critico, tituloKey) {
  document.querySelectorAll('.htab[data-s="' + tab + '"]').forEach(function (el) {
    var existente = el.querySelector('.tab-alert-dot');
    if (critico && !existente) el.insertAdjacentHTML('beforeend', '<span class="tab-alert-dot" title="' + t(tituloKey || 'alert_dot_title') + '"></span>');
    if (!critico && existente) existente.remove();
  });
}

async function carregarNivelRio() {
  var res = await sb.from('nivel_rio').select('*').order('data', { ascending: false }).limit(400);
  if (res.error) { console.error('Erro ao carregar nivel_rio:', res.error); return; }
  NIVEL_HIST = (res.data || []).map(function (row) {
    return { data: row.data, nivel_m: Number(row.nivel_m), variacao_cm: Number(row.variacao_cm), tendencia: row.tendencia, fonte: row.fonte };
  }).reverse();
}

function nivelDoAnoPassado(hoje) {
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

var CLIMA_POR_SEQ = {};
var CLIMA_ATUALIZADO_EM = null;
var CLIMA_CARREGANDO = false;
var CLIMA_ERRO = false;
var CLIMA_INTERVALO_MS = 10 * 60 * 1000;

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

function aqiCategoria(aqi) {
  if (aqi === null || aqi === undefined || isNaN(aqi)) return null;
  if (aqi <= 20) return { cor: '#22c55e', key: 'aqi_bom' };
  if (aqi <= 40) return { cor: '#84cc16', key: 'aqi_razoavel' };
  if (aqi <= 60) return { cor: '#eab308', key: 'aqi_moderado' };
  if (aqi <= 80) return { cor: '#f97316', key: 'aqi_ruim' };
  if (aqi <= 100) return { cor: '#ef4444', key: 'aqi_muito_ruim' };
  return { cor: '#a21caf', key: 'aqi_extremo' };
}

function climaMunicipiosOrdenados() {
  var lista = [];
  var llMAO = LATLNG.MAO;
  if (llMAO) lista.push({ seq: 'MAO', nome: 'Manaus', cor: '#14b8a6', lat: llMAO.lat, lng: llMAO.lng });
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
  if (CLIMA_ATUALIZADO_EM) bCLIMA();
  var lista = climaMunicipiosOrdenados();
  if (!lista.length) { CLIMA_CARREGANDO = false; return; }
  var lats = lista.map(function (m) { return m.lat; }).join(',');
  var lngs = lista.map(function (m) { return m.lng; }).join(',');
  var urlTempo = 'https://api.open-meteo.com/v1/forecast?latitude=' + lats + '&longitude=' + lngs
    + '&current=temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m'
    + '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum&forecast_days=5'
    + '&timezone=America%2FManaus';
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
    if (climaViewSeq) renderClimaView();
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
  if (!CLIMA_ATUALIZADO_EM) return;

  var lista = climaMunicipiosOrdenados();
  var horaFmt = new Date(CLIMA_ATUALIZADO_EM).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  body.innerHTML = '<div class="clima-hdr"><span class="clima-title">' + t('clima_title') + '</span>'
    + '<span class="clima-atualizado">' + tf('clima_atualizado_tpl', { hora: horaFmt })
    + '<button class="clima-refresh-btn" onclick="carregarClima()" title="' + t('clima_atualizar_agora') + '"'
    + (CLIMA_CARREGANDO ? ' disabled' : '') + '>' + (CLIMA_CARREGANDO ? '<span class="clima-refresh-spin">⟳</span>' : '⟳') + '</button></span>'
    + '<div class="clima-fonte-nota">' + t('clima_fonte_nota') + '</div></div>'
    + climaArAlertaHTML(lista)
    + '<div class="clima-grid">' + lista.map(climaCardHTML).join('') + '</div>';
}

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

var climaViewSeq = null;

function abrirClimaView(seq) {
  if (!CLIMA_POR_SEQ[seq]) return;
  climaViewSeq = seq;
  renderClimaView();
  document.getElementById('sheet-overlay').classList.add('on');
}

function renderClimaView() {
  if (!climaViewSeq) return;
  var seq = climaViewSeq;
  var hit = NODEIDX[seq];
  if (!hit && seq !== 'MAO') return;
  var r = hit ? hit.rota : null, m = hit ? hit.mun : { seq: 'MAO', nome: 'Manaus' };
  var d = CLIMA_POR_SEQ[seq];
  var horaFmt = CLIMA_ATUALIZADO_EM ? new Date(CLIMA_ATUALIZADO_EM).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';

  var corHdr = r ? r.cor : '#14b8a6';
  var badgeHTML = r
    ? '<div class="sh-badge" style="background:' + r.cor + '">' + t('calha_word').toUpperCase() + ' ' + r.nome.toUpperCase() + '</div>'
    : '<div class="sh-badge" style="background:' + corHdr + '">' + t('clima_hub_badge') + '</div>';
  var html = '<div class="sh-hdr">'
    + '<div class="sh-seq" style="color:' + corHdr + ';' + seqFS(m.seq) + '">' + m.seq + '</div>'
    + '<div><div class="sh-nome">' + m.nome + '</div>'
    + badgeHTML + '</div>'
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

    + climaRadarMiniHTML(seq)

    + (horaFmt ? '<div class="clima-view-atualizado">' + tf('clima_atualizado_tpl', { hora: horaFmt }) + '</div>' : '');

  document.getElementById('sheet-body').innerHTML = html;
  var ll = LATLNG[seq];
  if (ll) climaRadarMiniCarregar(seq, ll.lat, ll.lng);
}

function climaRadarMiniHTML(seq) {
  var ll = LATLNG[seq];
  if (!ll) return '';
  return '<div class="sh-season">'
    + '<div class="sh-season-hdr">' + t('clima_radar_mini_title') + '</div>'
    + '<div class="clima-radar-thumb" id="climaRadarThumb-' + seq + '">'
    + '<div class="clima-radar-loading">' + t('radar_carregando') + '</div>'
    + '</div>'
    + '<div class="clima-radar-attr">' + t('radar_fonte_nota') + '</div>'
    + '</div>';
}

function climaPrevisaoHTML(diario) {
  if (!diario || !diario.length) return '';
  var hojeISO = new Date().toISOString().slice(0, 10);
  var diasHTML = diario.map(function (dia, i) {
    var cat = climaCategoria(dia.codigo);
    var jsDay = new Date(dia.data + 'T12:00:00').getDay();
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

function fmtSaca(v) { return (v === null || v === undefined || v === '') ? '—' : ('R$ ' + Number(v).toFixed(2).replace('.', ',')); }
function fmtTA(v) { return (v === null || v === undefined || v === '') ? '—' : (v + ' d'); }

function seqFS(seq) {
  if (!seq) return '';
  if (seq.length > 8) return 'font-size:.5em;letter-spacing:0;line-height:1.05;';
  if (seq.length > 5) return 'font-size:.7em;letter-spacing:0;';
  return '';
}
function principalEmb(lista) {
  if (!lista || !lista.length) return null;
  return lista[0];
}

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

function isRodoviaria(r) { return /rodovi/i.test((r.nome || '') + ' ' + (r.dir || '')); }

function kmTotalRota(r) {
  return r.municipios.reduce(function (soma, m) { return soma + (Number(m.km) || 0); }, 0);
}

function segTiposDaRota(r) {
  var vistos = {};
  var lista = [];
  r.municipios.forEach(function (m) {
    var seg = SEGURANCA[m.seq];
    if (seg && !vistos[seg.tipo]) { vistos[seg.tipo] = true; lista.push(seg.tipo); }
  });
  return lista;
}

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

var viewSeq = null;

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
      + ((item.dias && item.dias.length) ? diasBadgeHTML(item.dias) : '')
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

    + alertaMunicipioViewHTML(seq)

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

var editState = null;

function abrirConfig(seq) {
  if (!souAdmin()) return;
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
}

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
  var dias = item.dias || [];
  var diasHTML = DIAS_SEMANA_KEYS.map(function (k) {
    var ativo = dias.indexOf(k) !== -1;
    return '<button type="button" class="dia-chip' + (ativo ? ' on' : '') + '" title="' + diaNome(k) + '" onclick="toggleEmbDia(' + idx + ',\'' + k + '\')">' + diaLetra(k) + '</button>';
  }).join('');
  return '<div class="emb-row">'
    + '<div class="emb-row-top">'
    + '<input class="emb-in emb-nome" type="text" value="' + (item.n || '').replace(/"/g, '&quot;') + '" placeholder="' + t('emb_nome_ph') + '" '
    + 'oninput="editEmb(' + idx + ',\'n\',this.value)">'
    + '<input class="emb-in emb-tt" type="number" step="0.1" min="0" value="' + (item.tt === null || item.tt === undefined ? '' : item.tt) + '" placeholder="' + t('emb_tt_ph') + '" '
    + 'oninput="editEmb(' + idx + ',\'tt\',this.value)">'
    + '<button class="emb-rm" onclick="removeEmb(' + idx + ')">✕</button>'
    + '</div>'
    + '<div class="emb-row-mid"><span class="emb-stars-label">' + t('avaliacao_label') + '</span><span class="star-picker">' + starsHTML + '</span></div>'
    + '<div class="emb-row-bot"><span class="emb-dias-label">' + t('emb_dias_label') + '</span><div class="dia-chips">' + diasHTML + '</div></div>'
    + '</div>';
}

function setEmbNota(idx, valor) {
  if (!editState) return;
  var item = editState.info.emb[idx]; if (!item) return;
  item.nota = (item.nota === valor) ? null : valor;
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

    + alertaMunicipioEditHTML(seq)

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
    + '<input type="text" id="in-contato-nome" value="' + ((info.contato && info.contato.nome) || '').replace(/"/g, '&quot;') + '" placeholder="' + t('contato_nome_ph') + '" oninput="if(!editState.info.contato) editState.info.contato={nome:\'\',tel:\'\'}; editState.info.contato.nome=this.value">'
    + '<div class="sh-field"><label>' + t('contato_tel_label') + '</label>'
    + '<input type="text" id="in-contato-tel" value="' + ((info.contato && info.contato.tel) || '').replace(/"/g, '&quot;') + '" placeholder="' + t('contato_tel_ph') + '" oninput="if(!editState.info.contato) editState.info.contato={nome:\'\',tel:\'\'}; editState.info.contato.tel=this.value">'
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
  editState.info.emb.push({ n: '', tt: null, nota: null, dias: [] });
  renderSheet();
  var inputs = document.querySelectorAll('#emb-list .emb-nome');
  var last = inputs[inputs.length - 1]; if (last) last.focus();
}

function salvarSheet() {
  if (!editState) return;
  editState.info.emb = editState.info.emb.filter(function (it) { return it.n && it.n.trim(); });
  var seq = editState.seq, info = editState.info;
  var btn = document.querySelector('.sh-save');
  if (btn) { btn.disabled = true; btn.textContent = t('salvando'); }
  setInfo(seq, info).then(function () {
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
/* Filtro por rota/calha — seleção MÚLTIPLA (array de números de rota, ex.
   ['A','D']), pra dar pra comparar duas ou mais calhas ao mesmo tempo no
   mapa. null/[] = nenhum filtro de rota ativo (mostra todas). */
var rotasFiltradas = null;
var tipoFiltrado = null;
var mapAnimateEntrance = true;

/* Seleção múltipla de municípios (botão 📍 na gaveta do mapa) — cruza
   calhas, diferente do filtro por rota (calhas inteiras) ou por tipo
   (Aduaneiro/Corredor). null = desligada; array de `seq` quando ativa,
   e nesse caso tem prioridade sobre os outros dois filtros (ver
   filtrarRota()/filtrarTipo()/buildMapFilters(), que a desligam ao
   escolher um filtro diferente). */
var municipiosSelecionados = null;

function nodeAtivo(m, rNum) {
  if (municipiosSelecionados) return municipiosSelecionados.indexOf(m.seq) !== -1;
  if (tipoFiltrado) {
    var seg = SEGURANCA[m.seq];
    return !!(seg && seg.tipo === tipoFiltrado);
  }
  return !rotasFiltradas || rotasFiltradas.indexOf(rNum) !== -1;
}

function mapLabel(rotaNum, idx) { return rotaNum + idx; }

var MAPA_FOTO_CALIB = { x: -9.0, y: 11.13, w: 822.3, h: 566.97 };

var RADAR_Z = 6;
var RADAR_Z_MINI = 7;
var RADAR_HOST = '';
var RADAR_FRAMES = [];
var RADAR_IDX_AGORA = -1;
var RADAR_META_EM = 0;
var RADAR_META_TTL_MS = 10 * 60 * 1000;
var RADAR_ATIVO = false;
var RADAR_TOCANDO = true;
var RADAR_IDX = -1;
var RADAR_TIMER = null;
var RADAR_ERRO = false;

function radarLon2Tile(lon, z) { return Math.floor((lon + 180) / 360 * Math.pow(2, z)); }
function radarLat2Tile(lat, z) {
  var r = lat * Math.PI / 180;
  return Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * Math.pow(2, z));
}
function radarTile2Lon(x, z) { return x / Math.pow(2, z) * 360 - 180; }
function radarTile2Lat(y, z) {
  var n = Math.PI - 2 * Math.PI * y / Math.pow(2, z);
  return Math.atan((Math.exp(n) - Math.exp(-n)) / 2) * 180 / Math.PI;
}
function radarFracX(lng, z) { var v = (lng + 180) / 360 * Math.pow(2, z); return v - Math.floor(v); }
function radarFracY(lat, z) {
  var r = lat * Math.PI / 180;
  var v = (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * Math.pow(2, z);
  return v - Math.floor(v);
}

function radarTileURL(path, x, y, z) { return RADAR_HOST + path + '/256/' + z + '/' + x + '/' + y + '/2/1_1.png'; }

function radarBuscarMeta(cb) {
  if (RADAR_FRAMES.length && (Date.now() - RADAR_META_EM) < RADAR_META_TTL_MS) { cb && cb(); return; }
  fetch('https://api.rainviewer.com/public/weather-maps.json').then(function (r) {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }).then(function (j) {
    RADAR_HOST = j.host;
    var past = (j.radar && j.radar.past) || [];
    var nowcast = (j.radar && j.radar.nowcast) || [];
    RADAR_FRAMES = past.concat(nowcast);
    RADAR_IDX_AGORA = past.length ? past.length - 1 : 0;
    if (RADAR_IDX < 0 || RADAR_IDX >= RADAR_FRAMES.length) RADAR_IDX = RADAR_IDX_AGORA;
    RADAR_META_EM = Date.now();
    RADAR_ERRO = false;
    cb && cb();
  }).catch(function (e) {
    console.error('Erro ao buscar radar (RainViewer):', e);
    RADAR_ERRO = true;
    cb && cb();
  });
}

var RADAR_LEAFLET_LAYER = null;
function radarAtualizarCamadaLeaflet() {
  if (!LMAP) return;
  if (!RADAR_ATIVO) {
    if (RADAR_LEAFLET_LAYER) { LMAP.removeLayer(RADAR_LEAFLET_LAYER); RADAR_LEAFLET_LAYER = null; }
    return;
  }
  var frame = RADAR_FRAMES[RADAR_IDX];
  if (!frame) return;
  var url = RADAR_HOST + frame.path + '/256/{z}/{x}/{y}/2/1_1.png';
  if (!RADAR_LEAFLET_LAYER) {
    RADAR_LEAFLET_LAYER = L.tileLayer(url, { opacity: 0.72, zIndex: 450, pane: 'overlayPane' }).addTo(LMAP);
  } else {
    RADAR_LEAFLET_LAYER.setUrl(url);
  }
}
function radarAtualizarFrameDOM() {
  radarAtualizarCamadaLeaflet();
  radarAtualizarUI();
}

function radarFrameLabel(frame) {
  if (!frame) return '';
  var diffMin = Math.round((frame.time - Date.now() / 1000) / 60);
  if (Math.abs(diffMin) <= 2) return t('radar_agora');
  if (diffMin < 0) return tf('radar_min_atras_tpl', { n: Math.abs(diffMin) });
  return tf('radar_min_previsao_tpl', { n: diffMin });
}

function radarAtualizarUI() {
  var el = document.getElementById('map-radar-ctl');
  if (!el) return;
  if (!RADAR_ATIVO) {
    el.innerHTML = '<button class="map-radar-toggle" onclick="radarToggleCamada()" title="' + t('radar_ligar_title') + '">📡 <span>' + t('radar_btn_label') + '</span></button>';
    return;
  }
  var frame = RADAR_FRAMES[RADAR_IDX];
  el.innerHTML = '<div class="map-radar-panel">'
    + '<button class="map-radar-toggle on" onclick="radarToggleCamada()" title="' + t('radar_desligar_title') + '">📡</button>'
    + '<button class="map-radar-play" onclick="radarTogglePlay()" title="' + (RADAR_TOCANDO ? t('radar_pausar_title') : t('radar_tocar_title')) + '">' + (RADAR_TOCANDO ? '⏸' : '▶') + '</button>'
    + '<span class="map-radar-time">' + radarFrameLabel(frame) + '</span>'
    + '</div>'
    + '<div class="map-radar-attr">' + t('radar_fonte_nota') + '</div>';
}

function radarPlay() {
  radarPararTimer();
  RADAR_TOCANDO = true;
  RADAR_TIMER = setInterval(function () {
    if (!RADAR_FRAMES.length) return;
    RADAR_IDX = (RADAR_IDX + 1) % RADAR_FRAMES.length;
    radarAtualizarFrameDOM();
  }, 600);
  radarAtualizarUI();
}
function radarPararTimer() { if (RADAR_TIMER) { clearInterval(RADAR_TIMER); RADAR_TIMER = null; } }
function radarStop() { RADAR_TOCANDO = false; radarPararTimer(); radarAtualizarUI(); }
function radarTogglePlay() { if (RADAR_TOCANDO) radarStop(); else radarPlay(); }

function radarToggleCamada() {
  RADAR_ATIVO = !RADAR_ATIVO;
  if (RADAR_ATIVO) {
    radarBuscarMeta(function () {
      radarAtualizarCamadaLeaflet();
      if (RADAR_TOCANDO) radarPlay(); else radarAtualizarUI();
    });
  } else {
    radarStop();
    radarAtualizarCamadaLeaflet();
  }
}

function climaRadarMiniURL(lat, lng) {
  var z = RADAR_Z_MINI;
  var x = radarLon2Tile(lng, z), y = radarLat2Tile(lat, z);
  var frame = RADAR_FRAMES[RADAR_IDX_AGORA];
  if (!frame) return null;
  return {
    url: radarTileURL(frame.path, x, y, z),
    px: radarFracX(lng, z) * 256,
    py: radarFracY(lat, z) * 256,
    hora: frame.time
  };
}
function climaRadarMiniCarregar(seq, lat, lng) {
  var elId = 'climaRadarThumb-' + seq;
  radarBuscarMeta(function () {
    var el = document.getElementById(elId);
    if (!el || climaViewSeq !== seq) return;
    if (RADAR_ERRO || !RADAR_FRAMES.length) {
      el.innerHTML = '<div class="clima-radar-erro">' + t('clima_radar_indisponivel') + '</div>';
      return;
    }
    var info = climaRadarMiniURL(lat, lng);
    if (!info) { el.innerHTML = '<div class="clima-radar-erro">' + t('clima_radar_indisponivel') + '</div>'; return; }
    el.innerHTML = '<div class="clima-radar-pin"></div>';
    el.style.backgroundImage = 'url(' + info.url + ')';
    el.style.backgroundPosition = (-(info.px - 60)) + 'px ' + (-(info.py - 60)) + 'px';
  });
}

var LMAP = null;
var LTILE_CLARO = null, LTILE_ESCURO = null;
var LAYER_RIOS, LAYER_ROTAS, LAYER_NODES, LAYER_HUB;
var MAPA_TILE_ESTILO = (function () {
  try { return localStorage.getItem('navlog-tile-estilo') || 'escuro'; }
  catch (e) { return 'escuro'; }
})();
var AM_LNG0 = -74.5, AM_LNG1 = -53.5, AM_LAT0 = -10.6, AM_LAT1 = 2.7;

function initLeafletMapa() {
  if (LMAP) return;
  var el = document.getElementById('msvg'); if (!el || typeof L === 'undefined') return;

  var bounds = L.latLngBounds([AM_LAT0, AM_LNG0], [AM_LAT1, AM_LNG1]);
  LMAP = L.map(el, {
    center: [-4.4, -63.8], zoom: 6, minZoom: 5, maxZoom: 15,
    zoomControl: false, attributionControl: true,
    maxBounds: bounds.pad(0.7), maxBoundsViscosity: 0.55
  });

  LTILE_CLARO = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, subdomains: 'abc', attribution: '&copy; OpenStreetMap'
  });
  LTILE_ESCURO = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 16, attribution: 'Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors, GIS User Community'
  });
  (MAPA_TILE_ESTILO === 'claro' ? LTILE_CLARO : LTILE_ESCURO).addTo(LMAP);
  var btnTile = document.getElementById('btn-tile-estilo');
  if (btnTile) btnTile.classList.toggle('tile-toggle-active', MAPA_TILE_ESTILO === 'claro');

  LAYER_RIOS = L.layerGroup().addTo(LMAP);
  LAYER_ROTAS = L.layerGroup().addTo(LMAP);
  LAYER_HUB = L.layerGroup().addTo(LMAP);
  LAYER_NODES = L.layerGroup().addTo(LMAP);

  LMAP.on('click', function () { fecharPopupMapa(); fecharMapToolbar(); });
}

function toggleMapToolbar() {
  var painel = document.getElementById('map-toolbar');
  var btn = document.getElementById('map-toolbar-toggle');
  if (!painel || !btn) return;
  var abrir = !painel.classList.contains('on');
  painel.classList.toggle('on', abrir);
  btn.classList.toggle('on', abrir);
  btn.textContent = abrir ? '✕' : '☰';
}
function fecharMapToolbar() {
  var painel = document.getElementById('map-toolbar');
  var btn = document.getElementById('map-toolbar-toggle');
  if (!painel || !painel.classList.contains('on')) return;
  painel.classList.remove('on');
  if (btn) { btn.classList.remove('on'); btn.textContent = '☰'; }
}

function toggleTileEstilo() {
  MAPA_TILE_ESTILO = (MAPA_TILE_ESTILO === 'claro') ? 'escuro' : 'claro';
  try { localStorage.setItem('navlog-tile-estilo', MAPA_TILE_ESTILO); } catch (e) { /* modo privado etc. */ }
  if (!LMAP) return;
  [LTILE_CLARO, LTILE_ESCURO].forEach(function (l) { if (l && LMAP.hasLayer(l)) LMAP.removeLayer(l); });
  (MAPA_TILE_ESTILO === 'claro' ? LTILE_CLARO : LTILE_ESCURO).addTo(LMAP);
  var btn = document.getElementById('btn-tile-estilo');
  if (btn) btn.classList.toggle('tile-toggle-active', MAPA_TILE_ESTILO === 'claro');
}

function renderMap() {
  initLeafletMapa();
  if (!LMAP) return;
  mapAnimateEntrance = false;

  LAYER_RIOS.clearLayers();
  LAYER_ROTAS.clearLayers();
  LAYER_HUB.clearLayers();
  LAYER_NODES.clearLayers();

  var hubLL = { lat: -3.119, lng: -60.021 };

  var regime = regimeAtual();

  RIOS.forEach(function (rv) {
    var latlngs = rv.coords;
    if (regime) {
      L.polyline(latlngs, {
        color: regime.cor, weight: rv.w + 5, opacity: 0.35, lineCap: 'round',
        className: regime.critico ? 'river-regime-critico' : '', interactive: false
      }).addTo(LAYER_RIOS);
    }
    L.polyline(latlngs, { color: '#2f9bd6', weight: rv.w, opacity: 0.8, lineCap: 'round', className: 'river-main', interactive: false }).addTo(LAYER_RIOS);
  });

  var hubIcon = L.divIcon({
    className: '', iconSize: [16, 16], iconAnchor: [8, 8],
    html: '<div class="lm-hub"><div class="lm-hub-ring"></div><div class="lm-hub-ring lm-hub-ring2"></div><div class="lm-hub-dot"></div><div class="lm-hub-label">MANAUS</div></div>'
  });
  L.marker([hubLL.lat, hubLL.lng], { icon: hubIcon, interactive: false, zIndexOffset: 500 }).addTo(LAYER_HUB);

  var RIOS_POR_NOME = {}; RIOS.forEach(function (rv) { RIOS_POR_NOME[rv.name] = rv; });
  var RIO_TRONCO = RIOS_POR_NOME['Amazonas/Solimoes'];
  var ROTA_RIO = { A: 'Amazonas/Solimoes', B: 'Amazonas/Solimoes', C: 'Madeira', D: 'Amazonas/Solimoes', E: 'Amazonas/Solimoes', F: 'Rio Negro', G: 'Purus', J: 'Jurua' };
  var RIO_AFLUENTE_TRONCO = { Madeira: true, Purus: true, Jurua: true };
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
  function catmullRomPontos(p0, p1, p2, p3, n) {
    var tensao = 6, pts = [];
    var c1lng = p1.lng + (p2.lng - p0.lng) / tensao, c1lat = p1.lat + (p2.lat - p0.lat) / tensao;
    var c2lng = p2.lng - (p3.lng - p1.lng) / tensao, c2lat = p2.lat - (p3.lat - p1.lat) / tensao;
    for (var i = 0; i <= n; i++) {
      var s = i / n, is = 1 - s;
      var lng = is * is * is * p1.lng + 3 * is * is * s * c1lng + 3 * is * s * s * c2lng + s * s * s * p2.lng;
      var lat = is * is * is * p1.lat + 3 * is * is * s * c1lat + 3 * is * s * s * c2lat + s * s * s * p2.lat;
      pts.push([lat, lng]);
    }
    return pts;
  }

  ROTAS.forEach(function (r) {
    var algumAtivo = r.municipios.some(function (m) { return nodeAtivo(m, r.num); });
    var largura = (algumAtivo && !tipoFiltrado) ? 3 : 1.3;
    var opacidade = tipoFiltrado ? 0.1 : (algumAtivo ? 0.85 : 0.08);
    var nomeRio = ROTA_RIO[r.num];

    function desenharTrecho(pontosLL, destinoM) {
      if (!pontosLL || pontosLL.length < 2) return;
      var seg = destinoM ? SEGURANCA[destinoM.seq] : null;
      L.polyline(pontosLL, {
        color: r.cor, weight: largura, opacity: opacidade, className: 'mline',
        dashArray: seg ? '7,6' : null, lineCap: 'round', lineJoin: 'round', interactive: false
      }).addTo(LAYER_ROTAS);
    }

    if (nomeRio) {
      var river = RIOS_POR_NOME[nomeRio];
      var afluente = !!RIO_AFLUENTE_TRONCO[nomeRio];
      var idxAtual, pontoAtual;

      if (afluente) {
        var hubNoTronco = idxMaisPerto(RIO_TRONCO, hubLL.lat, hubLL.lng);
        var bocaIdx = river.coords.length - 1;
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
        var pontosLL = (dock.idx === idxAtual) ? [pontoAtual, [ll.lat, ll.lng]] : trechoRio(river, idxAtual, dock.idx);
        desenharTrecho(pontosLL, m);
        idxAtual = dock.idx;
        pontoAtual = pontosLL[pontosLL.length - 1];

        if (dock.dist > LIMITE_BEIRA_RIO) {
          L.polyline([[ll.lat, ll.lng], river.coords[dock.idx]], {
            color: '#2f9bd6', weight: 1.3, opacity: opacidade, dashArray: '1.5,4',
            lineCap: 'round', className: 'fio-agua', interactive: false
          }).addTo(LAYER_ROTAS);
        }
      });
    } else {
      var pares = r.municipios.map(function (m) {
        var ll = LATLNG[m.seq]; return ll ? { m: m, p: ll } : null;
      }).filter(Boolean);
      if (pares.length) {
        var porSeq = {}; pares.forEach(function (it) { porSeq[it.m.seq] = it; });
        var hubItem = { m: null, p: hubLL };
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
          var pts = catmullRomPontos(avo.p, pai.p, it.p, filho ? filho.p : it.p, 12);
          desenharTrecho(pts, it.m);
        });
      }
    }
  });

  ROTAS.forEach(function (r) {
    r.municipios.forEach(function (m, idx) {
      var ll = LATLNG[m.seq]; if (!ll) return;
      var ativo = nodeAtivo(m, r.num);
      var seg = SEGURANCA[m.seq];
      var label = mapLabel(r.num, idx + 1);
      var segCor = seg ? SEGURANCA_META[seg.tipo].cor : r.cor;
      var html = '<div class="lm-node-wrap">'
        + '<div class="lm-node' + (seg ? ' lm-node-alert' : '') + '" data-ativo="' + (ativo ? 1 : 0) + '"'
        + ' style="background:' + (ativo ? r.cor : '#1a1e26') + ';border:1.5px ' + (seg ? 'dashed' : 'solid') + ' ' + (seg ? segCor : r.cor) + ';color:' + (ativo ? '#fff' : r.cor) + ';opacity:' + (ativo ? 1 : 0.35) + '">' + label + '</div>'
        + (seg ? '<div class="lm-node-seg-dot" style="background:' + segCor + '" title="' + segMetaLabel(seg.tipo) + '">' + SEGURANCA_META[seg.tipo].icone + '</div>' : '')
        + '</div>';
      var icon = L.divIcon({ className: '', html: html, iconSize: null, iconAnchor: [16, 10] });
      var marker = L.marker([ll.lat, ll.lng], { icon: icon, interactive: ativo, keyboard: false });
      if (ativo) marker.on('click', function () { showMapPopup(NODEIDX[m.seq], label); });
      marker.addTo(LAYER_NODES);
    });
  });

  var legenda = document.getElementById('map-regime-legend');
  if (legenda) {
    if (regime) {
      legenda.classList.remove('h');
      legenda.innerHTML = '<span class="map-regime-dot" style="background:' + regime.cor + '"></span>' + regimeLabel(regime);
    } else {
      legenda.classList.add('h');
    }
  }

  radarAtualizarCamadaLeaflet();
  radarAtualizarUI();
}

function showMapPopup(hit, label) {
  var popup = document.getElementById('map-popup');
  if (!popup) {
    popup = document.createElement('div'); popup.id = 'map-popup';
    document.getElementById('sc-m').appendChild(popup);
    popup.addEventListener('gesturestart', function (e) { e.preventDefault(); });
    popup.addEventListener('gesturechange', function (e) { e.preventDefault(); });
  }
  var r = hit.rota; var m = hit.mun; var prev = hit.prev; var next = hit.next;
  var info = getInfo(m.seq);
  var pEmb = principalEmb(info.emb);
  var seg = SEGURANCA[m.seq];
  var segMeta = seg ? SEGURANCA_META[seg.tipo] : null;

  popup.style.borderColor = seg ? segMeta.cor : r.cor;
  popup.innerHTML =
    '<button class="mp-close" onclick="fecharPopupMapa()">✕</button>'
    + '<div class="mp-size-ctl">'
    + '<button class="mp-size-btn on" data-sz="1" onclick="setMapPopupScale(1)" title="' + t('sheet_size_p_title') + '">P</button>'
    + '<button class="mp-size-btn" data-sz="1.3" onclick="setMapPopupScale(1.3)" title="' + t('sheet_size_m_title') + '">M</button>'
    + '<button class="mp-size-btn" data-sz="1.5" onclick="setMapPopupScale(1.5)" title="' + t('sheet_size_g_title') + '">G</button>'
    + '</div>'
    + '<div class="mp-body">'
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
    + '</div>'
    + '</div>';

  setMapPopupScale(mapPopupScaleSalva(), popup);
  popup.classList.add('on');
}

function mapPopupScaleSalva() {
  try { var v = parseFloat(localStorage.getItem('navlog-mappopup-scale')); return v || 1; }
  catch (e) { return 1; }
}
function setMapPopupScale(escala, popupEl) {
  var popup = popupEl || document.getElementById('map-popup');
  if (popup) popup.style.setProperty('--mp-scale', escala);
  try { localStorage.setItem('navlog-mappopup-scale', escala); } catch (e) { /* modo privado etc. */ }
  document.querySelectorAll('.mp-size-btn').forEach(function (b) {
    b.classList.toggle('on', parseFloat(b.dataset.sz) === escala);
  });
}

function verDetalheSeg(seq) {
  fecharPopupMapa();
  SS('i', null);
  setTimeout(function () { abrirInfoView(seq); }, 60);
}

function fecharPopupMapa() {
  var p = document.getElementById('map-popup'); if (p) p.classList.remove('on');
}

/* Toggle: cada toque soma/retira a calha da seleção (não fecha a gaveta,
   pra dar pra marcar duas ou mais calhas em sequência e comparar as
   rotas no mapa — ver README, "Comparar duas ou mais calhas"). */
function filtrarRota(num) {
  tipoFiltrado = null;
  municipiosSelecionados = null;
  if (!rotasFiltradas) rotasFiltradas = [];
  var i = rotasFiltradas.indexOf(num);
  if (i === -1) rotasFiltradas.push(num); else rotasFiltradas.splice(i, 1);
  if (!rotasFiltradas.length) rotasFiltradas = null;
  atualizarBotoesFiltro();
  fecharPopupMapa(); renderMap();
}

function filtrarTipo(tipo) {
  rotasFiltradas = null;
  municipiosSelecionados = null;
  tipoFiltrado = (tipoFiltrado === tipo) ? null : tipo;
  atualizarBotoesFiltro();
  fecharPopupMapa(); renderMap(); fecharMapToolbar();
}

function atualizarBotoesFiltro() {
  document.querySelectorAll('.mfbtn[data-rota]').forEach(function (b) {
    var num = b.dataset.rota;
    var isActive = !tipoFiltrado && !municipiosSelecionados && !!num && !!rotasFiltradas && rotasFiltradas.indexOf(num) !== -1;
    // o botão "Todas" (data-rota="") fica ativo quando nenhuma calha
    // específica está marcada e nenhum outro filtro está ligado
    if (!num) isActive = !tipoFiltrado && !municipiosSelecionados && !rotasFiltradas;
    b.classList.toggle('active', isActive);
  });
  document.querySelectorAll('.mfbtn[data-tipo]').forEach(function (b) {
    b.classList.toggle('active', !municipiosSelecionados && b.dataset.tipo === (tipoFiltrado || ''));
  });
  var btnMuni = document.getElementById('muni-select-open-btn');
  if (btnMuni) btnMuni.classList.toggle('active', !!municipiosSelecionados);
  var badge = document.getElementById('muni-select-badge');
  if (badge) badge.textContent = municipiosSelecionados ? ' (' + municipiosSelecionados.length + ')' : '';
}

function buildMapFilters() {
  var cont = document.getElementById('map-filters'); if (!cont) return;
  cont.innerHTML = '';
  var all = document.createElement('button'); all.className = 'mfbtn active'; all.dataset.rota = '';
  all.textContent = t('map_filter_todas');
  all.onclick = function () { rotasFiltradas = null; tipoFiltrado = null; municipiosSelecionados = null; atualizarBotoesFiltro(); fecharPopupMapa(); renderMap(); fecharMapToolbar(); };
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
  atualizarBotoesFiltro();
}

/* ── Seleção múltipla de municípios (botão 📍, ver index.html/#muni-
   select-overlay) ── a lista cobre todos os municípios de todas as
   calhas (Manaus/MAO fica de fora: ela é o hub, sempre visível no mapa,
   e não é um "node" filtrável como os outros). A seleção fica num rascunho
   (muniSelectTemp) enquanto o balão está aberto, e só passa a valer de
   verdade (municipiosSelecionados) ao tocar "Aplicar" — assim dá pra
   marcar/desmarcar várias vezes sem o mapa recarregando a cada toque. */
var muniSelectTemp = [];

function todosMunicipiosParaSelecao() {
  var lista = [];
  ROTAS.forEach(function (r) {
    r.municipios.forEach(function (m) { lista.push({ seq: m.seq, nome: m.nome, cor: r.cor }); });
  });
  return lista;
}

function abrirMuniSelect() {
  muniSelectTemp = (municipiosSelecionados || []).slice();
  var busca = document.getElementById('muni-select-busca'); if (busca) busca.value = '';
  renderMuniSelectLista();
  var overlay = document.getElementById('muni-select-overlay'); if (overlay) overlay.classList.add('on');
  fecharMapToolbar();
}
function fecharMuniSelect(e) {
  if (e && e.target !== e.currentTarget) return;
  var overlay = document.getElementById('muni-select-overlay'); if (overlay) overlay.classList.remove('on');
}
function toggleMuniSelectItem(seq) {
  var i = muniSelectTemp.indexOf(seq);
  if (i === -1) muniSelectTemp.push(seq); else muniSelectTemp.splice(i, 1);
  var el = document.querySelector('.muni-select-item[data-seq="' + seq + '"]');
  if (el) {
    var on = muniSelectTemp.indexOf(seq) !== -1;
    el.classList.toggle('on', on);
    var check = el.querySelector('.muni-select-check'); if (check) check.textContent = on ? '✓' : '';
  }
  var cEl = document.getElementById('muni-select-count'); if (cEl) cEl.textContent = muniSelectTemp.length;
}
function renderMuniSelectLista() {
  var cont = document.getElementById('muni-select-lista'); if (!cont) return;
  var busca = normKey((document.getElementById('muni-select-busca') || {}).value || '');
  var itens = todosMunicipiosParaSelecao().filter(function (it) {
    return !busca || normKey(it.nome).indexOf(busca) !== -1 || normKey(it.seq).indexOf(busca) !== -1;
  });
  cont.innerHTML = itens.length ? itens.map(function (it) {
    var on = muniSelectTemp.indexOf(it.seq) !== -1;
    return '<div class="muni-select-item' + (on ? ' on' : '') + '" data-seq="' + it.seq + '" onclick="toggleMuniSelectItem(\'' + it.seq + '\')">'
      + '<span class="muni-select-dot" style="background:' + it.cor + '"></span>'
      + '<span class="muni-select-nome">' + it.nome + '</span>'
      + '<span class="muni-select-check">' + (on ? '✓' : '') + '</span>'
      + '</div>';
  }).join('') : '<div class="search-empty"><span class="search-empty-ic">🔎</span><span class="search-empty-tx">' + t('busca_sem_resultado') + '</span></div>';
  var cEl = document.getElementById('muni-select-count'); if (cEl) cEl.textContent = muniSelectTemp.length;
}
function limparMuniSelect() {
  muniSelectTemp = [];
  renderMuniSelectLista();
}
function aplicarMuniSelect() {
  municipiosSelecionados = muniSelectTemp.length ? muniSelectTemp.slice() : null;
  rotasFiltradas = null; tipoFiltrado = null;
  atualizarBotoesFiltro();
  fecharMuniSelect();
  fecharPopupMapa(); renderMap();
}

function zI() { if (LMAP) LMAP.zoomIn(); }
function zO() { if (LMAP) LMAP.zoomOut(); }
function zR() {
  rotasFiltradas = null; tipoFiltrado = null; municipiosSelecionados = null; atualizarBotoesFiltro(); fecharPopupMapa();
  if (LMAP) LMAP.setView([-4.4, -63.8], 6);
  renderMap();
}

function atualizarIndicadorAbas() {
  var ativoH = document.querySelector('.htab.on');
  var pill = document.getElementById('htab-pill');
  if (ativoH && pill) {
    pill.style.height = ativoH.offsetHeight + 'px';
    pill.style.transform = 'translateY(' + ativoH.offsetTop + 'px)';
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

  var scAtual = document.getElementById('sc-' + name);
  if (scAtual) {
    scAtual.classList.remove('scr-enter');
    void scAtual.offsetWidth;
    scAtual.classList.add('scr-enter');
  }
  atualizarIndicadorAbas();

  if (name === 'i') bINFO();
  if (name === 'c') bCO();
  if (name === 'm') {
    buildMapFilters(); renderMap();
    if (LMAP) setTimeout(function () { LMAP.invalidateSize(); }, 0);
  }
  else radarPararTimer();
  if (name === 'n') bNIVEL();
  if (name === 'w') {
    bCLIMA();
    var stale = !CLIMA_ATUALIZADO_EM || (Date.now() - CLIMA_ATUALIZADO_EM > CLIMA_INTERVALO_MS);
    if (stale && !CLIMA_CARREGANDO) carregarClima();
  }
}

function setLiveStatus(state) {
  var dot = document.getElementById('live-dot'); if (!dot) return;
  dot.classList.remove('live', 'offline');
  if (state === 'live') { dot.classList.add('live'); dot.title = t('live_live_title'); }
  else if (state === 'offline') { dot.classList.add('offline'); dot.title = t('live_offline_title'); }
  else { dot.title = t('live_connecting'); }
}

function flashSeq(seq) {
  requestAnimationFrame(function () {
    document.querySelectorAll('[data-seq="' + seq + '"]').forEach(function (el) {
      el.classList.remove('flash-update');
      void el.offsetWidth;
      el.classList.add('flash-update');
    });
  });
}

async function initApp() {
  aplicarTema(document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark');
  setIdiomaEstatico(idiomaSalvo());
  atualizarHeroSub();
  requestAnimationFrame(atualizarIndicadorAbas);
  setSheetScale(sheetScaleSalva());

  var sheetOverlayEl = document.getElementById('sheet-overlay');
  if (sheetOverlayEl) {
    sheetOverlayEl.addEventListener('gesturestart', function (e) { e.preventDefault(); });
    sheetOverlayEl.addEventListener('gesturechange', function (e) { e.preventDefault(); });
  }

  var sessionRes = await sb.auth.getSession();
  var session = sessionRes.data && sessionRes.data.session;
  if (!session) { window.location.replace('/login.html'); return; }
  CURRENT_USER = session.user;

  var badge = document.getElementById('user-badge');
  if (badge) {
    var email = CURRENT_USER.email || '';
    badge.textContent = email ? email.charAt(0).toUpperCase() : '?';
    badge.title = email;
  }

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
  carregarClima();
  atualizarBotaoPush();

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

  sb.channel('nivel_rio_changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'nivel_rio' }, function () {
      carregarNivelRio().then(function () {
        if (NIVEL_HIST.length) atualizarAlertaAba('n', !!classificarNivel(NIVEL_HIST[NIVEL_HIST.length - 1].nivel_m).critico);
        if (cur === 'n') bNIVEL();
        if (cur === 'm') renderMap();
      });
    })
    .subscribe();

  sb.auth.onAuthStateChange(function (event) {
    if (event === 'SIGNED_OUT') window.location.replace('/login.html');
  });
}
