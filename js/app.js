/* ============================================================
   NAVLOG AMAZÔNIA — APP.JS
   4 abas: Rotas · Informações · Configurações · Mapa
   ============================================================ */

var cur = 'r';
var CURRENT_USER = null; // { id, email } — usuário logado (Supabase Auth)

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
var MUNINFO_LIVE = {}; // seq -> {ta, ps:{seca,cheia}, emb:{seca,cheia}}

function rowToInfo(row) {
  return {
    ta: row.ta,
    ps: { seca: row.ps_seca, cheia: row.ps_cheia },
    emb: { seca: row.emb_seca || [], cheia: row.emb_cheia || [] }
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
    || { ta: null, ps: { seca: null, cheia: null }, emb: { seca: [], cheia: [] } };
  return JSON.parse(JSON.stringify(fonte)); // clona pra nao vazar referencia
}

/* Salva no banco (compartilhado com todo mundo) e atualiza o cache local. */
async function setInfo(seq, info) {
  var res = await sb.from('municipios_info').upsert({
    seq: seq,
    ta: info.ta,
    ps_seca: info.ps.seca,
    ps_cheia: info.ps.cheia,
    emb_seca: info.emb.seca,
    emb_cheia: info.emb.cheia
  }, { onConflict: 'seq' });
  if (res.error) { alert('Não consegui salvar: ' + res.error.message); throw res.error; }
  MUNINFO_LIVE[seq] = JSON.parse(JSON.stringify(info));
}

/* "Restaurar original" agora escreve os valores de fábrica de volta
   no banco — vale pra equipe toda, não só pra quem clicou. */
async function resetInfo(seq) {
  var original = MUNINFO[seq] || { ta: null, ps: { seca: null, cheia: null }, emb: { seca: [], cheia: [] } };
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
   ABA 1 — ROTAS
   Lista oculta: só as 10 rotas aparecem. Ao abrir, mostra os
   municípios na ordem de passagem, com km e transit time.
   ============================================================ */

function fmtSaca(v) { return (v === null || v === undefined || v === '') ? '—' : ('R$ ' + Number(v).toFixed(2).replace('.', ',')); }
function fmtTA(v) { return (v === null || v === undefined || v === '') ? '—' : (v + ' d'); }
function principalEmb(lista) {
  // as listas ja vem ordenadas da mais usada pra menos usada (fonte: planilha)
  if (!lista || !lista.length) return null;
  return lista[0];
}

function buildRotaHeader(r) {
  return '<div class="rhead" onclick="toggleRota(\'' + r.num + '\', this)">'
    + '<div class="rnb" style="background:' + r.cor + '">' + r.num + '</div>'
    + '<div class="rinfo">'
    + '<div class="rnome">Calha ' + r.nome + '</div>'
    + '<div class="rsub">' + r.municipios.length + ' municípios · ' + r.dir + '</div>'
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
        + '<span class="mseq" style="color:' + r.cor + '">' + m.seq + '</span>'
        + '<span class="mname">' + m.nome + '</span>'
        + '<span class="mkm">' + m.km + ' km</span>'
        + '<span class="mtt">' + m.tt + '</span>'
        + '</div>';
    }).join('');
    return '<div class="rcard" id="rcard-' + r.num + '" style="--i:' + ri + '" data-txt="' + normKey(r.nome + ' ' + r.num) + '">'
      + buildRotaHeader(r)
      + '<div class="rbody"><div class="rbody-inner">' + mRows + '</div></div>'
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
        + '<span class="chip-seq" style="color:' + r.cor + '">' + m.seq + '</span>'
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
      + '<span class="sh-view-emb-n">' + (item.n || '—') + '</span>'
      + ((item.tt !== null && item.tt !== undefined && item.tt !== '') ? '<span class="sh-view-emb-tt">' + item.tt + ' d</span>' : '')
      + '</div>';
  }).join('');
}

function renderInfoView() {
  if (!viewSeq) return;
  var seq = viewSeq; var info = getInfo(seq);
  var hit = NODEIDX[seq]; var r = hit.rota; var m = hit.mun;

  var html =
    '<div class="sh-hdr">'
    + '<div class="sh-seq" style="color:' + r.cor + '">' + m.seq + '</div>'
    + '<div><div class="sh-nome">' + m.nome + '</div>'
    + '<div class="sh-badge" style="background:' + r.cor + '">CALHA ' + r.nome.toUpperCase() + '</div></div>'
    + '</div>'

    + segHTML(seq)

    + '<div class="sh-view-grid">'
    + '<div class="sh-view-kpi"><div class="sh-view-kt">TT Amazon</div><div class="sh-view-kv">' + fmtTA(info.ta) + '</div></div>'
    + '<div class="sh-view-kpi"><div class="sh-view-kt">Distância</div><div class="sh-view-kv">' + m.km + ' km</div></div>'
    + '<div class="sh-view-kpi"><div class="sh-view-kt">Transit rota</div><div class="sh-view-kv">' + m.tt + '</div></div>'
    + '</div>'

    + '<div class="sh-season" style="border-color:#f59e0b55">'
    + '<div class="sh-season-hdr" style="color:#f59e0b">🏜️ SECA <span class="sh-view-price">' + fmtSaca(info.ps.seca) + ' /saca</span></div>'
    + '<label class="sh-sub">Embarcações mais usadas</label>'
    + '<div class="sh-view-emblist">' + embListViewHTML(info.emb.seca) + '</div>'
    + '</div>'

    + '<div class="sh-season" style="border-color:#0ea5e955">'
    + '<div class="sh-season-hdr" style="color:#0ea5e9">🌊 CHEIA <span class="sh-view-price">' + fmtSaca(info.ps.cheia) + ' /saca</span></div>'
    + '<label class="sh-sub">Embarcações mais usadas</label>'
    + '<div class="sh-view-emblist">' + embListViewHTML(info.emb.cheia) + '</div>'
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

function bCO() {
  var body = document.getElementById('cbdy'); if (!body) return;
  body.innerHTML = ROTAS.map(function (r, ri) {
    var mRows = r.municipios.map(function (m, i) {
      var info = getInfo(m.seq);
      var pSeca = principalEmb(info.emb.seca);
      var pCheia = principalEmb(info.emb.cheia);
      var seg = SEGURANCA[m.seq];
      var segIc = seg ? '<span class="iseg-ic" style="background:' + SEGURANCA_META[seg.tipo].cor + '" title="' + SEGURANCA_META[seg.tipo].label + '">' + SEGURANCA_META[seg.tipo].icone + '</span>' : '';
      return '<div class="irow" data-seq="' + m.seq + '" data-txt="' + normKey(m.seq + ' ' + m.nome) + '" onclick="abrirConfig(\'' + m.seq + '\')">'
        + '<span class="mseq" style="color:' + r.cor + '">' + m.seq + '</span>'
        + '<div class="iinfo">'
        + '<div class="iname">' + m.nome + segIc + '</div>'
        + '<div class="isub">'
        + '<span class="itag ise">🏜️ ' + (pSeca ? pSeca.n : '—') + '</span>'
        + '<span class="itag ich">🌊 ' + (pCheia ? pCheia.n : '—') + '</span>'
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

function embRowHTML(seq, regime, idx, item) {
  return '<div class="emb-row">'
    + '<input class="emb-in emb-nome" type="text" value="' + (item.n || '').replace(/"/g, '&quot;') + '" placeholder="Nome da embarcação" '
    + 'oninput="editEmb(\'' + regime + '\',' + idx + ',\'n\',this.value)">'
    + '<input class="emb-in emb-tt" type="number" step="0.1" min="0" value="' + (item.tt === null || item.tt === undefined ? '' : item.tt) + '" placeholder="dias" '
    + 'oninput="editEmb(\'' + regime + '\',' + idx + ',\'tt\',this.value)">'
    + '<button class="emb-rm" onclick="removeEmb(\'' + regime + '\',' + idx + ')">✕</button>'
    + '</div>';
}

function renderSheet() {
  if (!editState) return;
  var seq = editState.seq; var info = editState.info;
  var hit = NODEIDX[seq]; var r = hit.rota; var m = hit.mun;

  var embSecaHTML = info.emb.seca.map(function (item, i) { return embRowHTML(seq, 'seca', i, item); }).join('')
    || '<div class="emb-empty">Nenhuma embarcação cadastrada.</div>';
  var embCheiaHTML = info.emb.cheia.map(function (item, i) { return embRowHTML(seq, 'cheia', i, item); }).join('')
    || '<div class="emb-empty">Nenhuma embarcação cadastrada.</div>';

  var html =
    '<div class="sh-hdr">'
    + '<div class="sh-seq" style="color:' + r.cor + '">' + m.seq + '</div>'
    + '<div><div class="sh-nome">' + m.nome + '</div>'
    + '<div class="sh-badge" style="background:' + r.cor + '">CALHA ' + r.nome.toUpperCase() + '</div></div>'
    + '</div>'

    + segHTML(seq)

    + '<div class="sh-field">'
    + '<label>Transit Time Amazon (dias)</label>'
    + '<input type="number" step="0.1" min="0" id="in-ta" value="' + (info.ta === null || info.ta === undefined ? '' : info.ta) + '" oninput="editState.info.ta = this.value === \'\' ? null : Number(this.value)">'
    + '</div>'

    + '<div class="sh-season" style="border-color:#f59e0b55">'
    + '<div class="sh-season-hdr" style="color:#f59e0b">🏜️ SECA</div>'
    + '<div class="sh-field"><label>Preço por saca (R$)</label>'
    + '<input type="number" step="0.5" min="0" value="' + (info.ps.seca === null || info.ps.seca === undefined ? '' : info.ps.seca) + '" oninput="editState.info.ps.seca = this.value === \'\' ? null : Number(this.value)"></div>'
    + '<label class="sh-sub">Embarcações mais usadas</label>'
    + '<div id="emb-list-seca">' + embSecaHTML + '</div>'
    + '<button class="emb-add" onclick="addEmb(\'seca\')">+ Adicionar embarcação</button>'
    + '</div>'

    + '<div class="sh-season" style="border-color:#0ea5e955">'
    + '<div class="sh-season-hdr" style="color:#0ea5e9">🌊 CHEIA</div>'
    + '<div class="sh-field"><label>Preço por saca (R$)</label>'
    + '<input type="number" step="0.5" min="0" value="' + (info.ps.cheia === null || info.ps.cheia === undefined ? '' : info.ps.cheia) + '" oninput="editState.info.ps.cheia = this.value === \'\' ? null : Number(this.value)"></div>'
    + '<label class="sh-sub">Embarcações mais usadas</label>'
    + '<div id="emb-list-cheia">' + embCheiaHTML + '</div>'
    + '<button class="emb-add" onclick="addEmb(\'cheia\')">+ Adicionar embarcação</button>'
    + '</div>'

    + '<div class="sh-actions">'
    + '<button class="sh-btn sh-reset" onclick="resetSheetAtual()">⟲ Restaurar original</button>'
    + '<button class="sh-btn sh-save" onclick="salvarSheet()">✓ Salvar</button>'
    + '</div>';

  document.getElementById('sheet-body').innerHTML = html;
}

function editEmb(regime, idx, campo, valor) {
  if (!editState) return;
  var item = editState.info.emb[regime][idx]; if (!item) return;
  item[campo] = (campo === 'tt') ? (valor === '' ? null : Number(valor)) : valor;
}

function removeEmb(regime, idx) {
  if (!editState) return;
  editState.info.emb[regime].splice(idx, 1);
  renderSheet();
}

function addEmb(regime) {
  if (!editState) return;
  editState.info.emb[regime].push({ n: '', tt: null });
  renderSheet();
  var inputs = document.querySelectorAll('#emb-list-' + regime + ' .emb-nome');
  var last = inputs[inputs.length - 1]; if (last) last.focus();
}

function salvarSheet() {
  if (!editState) return;
  // limpa embarcacoes sem nome antes de salvar
  ['seca', 'cheia'].forEach(function (regime) {
    editState.info.emb[regime] = editState.info.emb[regime].filter(function (it) { return it.n && it.n.trim(); });
  });
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

function nodeAtivo(m, rNum) {
  if (tipoFiltrado) {
    var seg = SEGURANCA[m.seq];
    return !!(seg && seg.tipo === tipoFiltrado);
  }
  return rotaFiltrada === null || rotaFiltrada === rNum;
}

function mapLabel(rotaNum, idx) { return rotaNum + idx; }

function renderMap() {
  var svg = document.getElementById('msvg'); if (!svg) return;
  svg.innerHTML = '';
  var NS = 'http://www.w3.org/2000/svg';
  var W = 900, H = 600;
  var LNG0 = -74.5, LNG1 = -53.5, LAT0 = -10.6, LAT1 = 2.7;
  function merc(lat) { return Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)); }
  var m0 = merc(LAT0), m1 = merc(LAT1);
  function proj(lat, lng) { return { x: (lng - LNG0) / (LNG1 - LNG0) * W, y: (m1 - merc(lat)) / (m1 - m0) * H }; }

  var defs = document.createElementNS(NS, 'defs');
  defs.innerHTML = '<pattern id="gr" width="30" height="30" patternUnits="userSpaceOnUse"><path d="M30 0L0 0 0 30" fill="none" stroke="#0f172a" stroke-width=".4"/></pattern><filter id="gw"><feGaussianBlur stdDeviation="1.8" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>';
  svg.appendChild(defs);

  var g = document.createElementNS(NS, 'g'); g.id = 'mg';
  g.setAttribute('transform', 'translate(' + T.x + ',' + T.y + ') scale(' + T.s + ')');

  var bg = document.createElementNS(NS, 'rect'); bg.setAttribute('width', W); bg.setAttribute('height', H); bg.setAttribute('fill', '#070c14'); g.appendChild(bg);
  var gr = document.createElementNS(NS, 'rect'); gr.setAttribute('width', W); gr.setAttribute('height', H); gr.setAttribute('fill', 'url(#gr)'); g.appendChild(gr);

  var bPts = AM_BORDER.map(function (c) { var p = proj(c[0], c[1]); return p.x + ',' + p.y; }).join(' ');
  var border = document.createElementNS(NS, 'polygon');
  border.setAttribute('points', bPts); border.setAttribute('fill', '#0f1b2d'); border.setAttribute('stroke', '#26436b'); border.setAttribute('stroke-width', '2'); g.appendChild(border);

  RIOS.forEach(function (rv) {
    var pts = rv.coords.map(function (c) { var p = proj(c[0], c[1]); return p.x + ' ' + p.y; });
    var path = document.createElementNS(NS, 'polyline');
    path.setAttribute('points', pts.join(', ')); path.setAttribute('fill', 'none');
    path.setAttribute('stroke', '#0284c7'); path.setAttribute('stroke-width', rv.w);
    path.setAttribute('opacity', '0.75'); path.setAttribute('stroke-linecap', 'round'); g.appendChild(path);
  });

  var hub = proj(-3.119, -60.021);
  var hc = document.createElementNS(NS, 'circle');
  hc.setAttribute('cx', hub.x); hc.setAttribute('cy', hub.y); hc.setAttribute('r', '8'); hc.setAttribute('fill', '#14b8a6'); hc.setAttribute('filter', 'url(#gw)'); g.appendChild(hc);
  var hl = document.createElementNS(NS, 'text');
  hl.setAttribute('x', hub.x + 11); hl.setAttribute('y', hub.y + 4); hl.setAttribute('font-size', '9');
  hl.setAttribute('fill', '#14b8a6'); hl.setAttribute('font-weight', '900'); hl.setAttribute('font-family', 'monospace'); hl.textContent = 'MANAUS'; g.appendChild(hl);

  ROTAS.forEach(function (r) {
    var algumAtivo = r.municipios.some(function (m) { return nodeAtivo(m, r.num); });
    var pts = r.municipios.map(function (m) { return LATLNG[m.seq] ? proj(LATLNG[m.seq].lat, LATLNG[m.seq].lng) : null; }).filter(Boolean);
    if (pts.length) {
      var lineCoords = [[hub.x, hub.y]].concat(pts.map(function (p) { return [p.x, p.y]; }));
      var polyPts = lineCoords.map(function (p) { return p[0] + ' ' + p[1]; }).join(', ');
      var line = document.createElementNS(NS, 'polyline');
      line.setAttribute('points', polyPts); line.setAttribute('fill', 'none');
      line.setAttribute('stroke', r.cor); line.setAttribute('stroke-width', (algumAtivo && !tipoFiltrado) ? '2.4' : '1');
      line.setAttribute('opacity', tipoFiltrado ? '0.1' : (algumAtivo ? '0.6' : '0.06')); line.setAttribute('stroke-linecap', 'round'); g.appendChild(line);
    }
  });

  var iz = 1 / T.s;
  ROTAS.forEach(function (r) {
    r.municipios.forEach(function (m, idx) {
      var ll = LATLNG[m.seq]; if (!ll) return;
      var ativo = nodeAtivo(m, r.num);
      var seg = SEGURANCA[m.seq];
      var p = proj(ll.lat, ll.lng);
      var label = mapLabel(r.num, idx + 1);
      var grp = document.createElementNS(NS, 'g');
      grp.style.cursor = ativo ? 'pointer' : 'default';
      grp.style.opacity = ativo ? '1' : '0.08';

      var baseW = (label.length <= 2 ? 20 : label.length === 3 ? 24 : 28);
      var labelW = baseW * iz;
      var labelH = 15 * iz;
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

  svg.appendChild(g);
}

function showMapPopup(hit, label) {
  var popup = document.getElementById('map-popup');
  if (!popup) {
    popup = document.createElement('div'); popup.id = 'map-popup';
    document.getElementById('sc-m').appendChild(popup);
  }
  var r = hit.rota; var m = hit.mun; var prev = hit.prev; var next = hit.next;
  var info = getInfo(m.seq);
  var pSeca = principalEmb(info.emb.seca); var pCheia = principalEmb(info.emb.cheia);
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
    + '<div class="mp-embrow">🏜️ <b>' + (pSeca ? pSeca.n : '—') + '</b></div>'
    + '<div class="mp-embrow">🌊 <b>' + (pCheia ? pCheia.n : '—') + '</b></div>'
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

function initMapInteractions() {
  var msvg = document.getElementById('msvg'); if (!msvg || msvg.dataset.bound) return;
  msvg.dataset.bound = '1';
  var drag = false, ds = {}, moved = false;
  msvg.addEventListener('mousedown', function (e) { drag = true; moved = false; ds = { x: e.clientX - T.x, y: e.clientY - T.y }; });
  document.addEventListener('mousemove', function (e) {
    if (!drag) return; moved = true; T.x = e.clientX - ds.x; T.y = e.clientY - ds.y;
    var mg = document.getElementById('mg'); if (mg) mg.setAttribute('transform', 'translate(' + T.x + ',' + T.y + ') scale(' + T.s + ')');
  });
  document.addEventListener('mouseup', function () { drag = false; });

  msvg.addEventListener('touchstart', function (e) {
    if (e.touches.length === 1) { drag = true; ds = { x: e.touches[0].clientX - T.x, y: e.touches[0].clientY - T.y }; }
  }, { passive: true });
  msvg.addEventListener('touchmove', function (e) {
    if (!drag || e.touches.length !== 1) return;
    T.x = e.touches[0].clientX - ds.x; T.y = e.touches[0].clientY - ds.y;
    var mg = document.getElementById('mg'); if (mg) mg.setAttribute('transform', 'translate(' + T.x + ',' + T.y + ') scale(' + T.s + ')');
  }, { passive: true });
  var lastDist = null;
  msvg.addEventListener('touchstart', function (e) { if (e.touches.length === 2) lastDist = null; }, { passive: true });
  msvg.addEventListener('touchmove', function (e) {
    if (e.touches.length !== 2) return;
    var dx = e.touches[0].clientX - e.touches[1].clientX;
    var dy = e.touches[0].clientY - e.touches[1].clientY;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (lastDist) {
      T.s = Math.min(Math.max(T.s * dist / lastDist, 0.5), 8);
      var mg = document.getElementById('mg'); if (mg) mg.setAttribute('transform', 'translate(' + T.x + ',' + T.y + ') scale(' + T.s + ')');
    }
    lastDist = dist;
  }, { passive: true });
  msvg.addEventListener('touchend', function () { if (lastDist !== null) { lastDist = null; renderMap(); } });
}

function zI() { T.s = Math.min(T.s * 1.3, 8); renderMap(); }
function zO() { T.s = Math.max(T.s / 1.3, 0.5); renderMap(); }
function zR() { T = { s: 1, x: 0, y: 0 }; rotaFiltrada = null; tipoFiltrado = null; atualizarBotoesFiltro(); fecharPopupMapa(); renderMap(); }

/* ============================================================
   NAVEGAÇÃO ENTRE ABAS
   ============================================================ */
function SS(name, btn) {
  cur = name;
  ['r', 'i', 'c', 'm'].forEach(function (s) {
    var el = document.getElementById('sc-' + s);
    if (el) el.classList.toggle('h', s !== name);
  });
  document.querySelectorAll('.htab').forEach(function (b) { b.classList.toggle('on', b.dataset.s === name); });
  ['r', 'i', 'c', 'm'].forEach(function (s) { var bt = document.getElementById('bt-' + s); if (bt) bt.classList.toggle('on', s === name); });

  if (name === 'i') bINFO();
  if (name === 'c') bCO();
  if (name === 'm') { buildMapFilters(); renderMap(); initMapInteractions(); }
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
  var sessionRes = await sb.auth.getSession();
  var session = sessionRes.data && sessionRes.data.session;
  if (!session) { window.location.replace('/login.html'); return; }
  CURRENT_USER = session.user;

  var badge = document.getElementById('user-badge');
  if (badge) badge.textContent = CURRENT_USER.email || '';

  await carregarMunicipiosInfo();
  await carregarObs();

  bRO();
  bINFO();
  bCO();

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

  sb.auth.onAuthStateChange(function (event) {
    if (event === 'SIGNED_OUT') window.location.replace('/login.html');
  });
}
