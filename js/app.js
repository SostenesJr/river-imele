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
        + '<span class="mseq" style="color:' + r.cor + '">' + m.seq + '</span>'
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
var rotaFiltrada = null;
var tipoFiltrado = null; // null | 'aduaneiro' | 'corredor'
var mapAnimateEntrance = true; // true = próxima renderMap() anima entrada dos nós/linhas

/* Mapa real (Leaflet + tiles escuros da CARTO, sem chave de API) por baixo
   das nossas calhas/municípios desenhados por cima. */
var leafletMap = null;
var mapDataLayer = null;         // L.layerGroup com tudo que renderMap() desenha, recriado a cada chamada
var routeLineLayers = {};        // num da calha -> L.polyline atual (pra animar o veículo por cima)
var HUB_LATLNG = [-3.119, -60.021]; // Manaus
var MAP_BOUNDS = [[-10.6, -74.5], [2.7, -53.5]]; // [sudoeste, nordeste] aproximado do Amazonas

function nodeAtivo(m, rNum) {
  if (tipoFiltrado) {
    var seg = SEGURANCA[m.seq];
    return !!(seg && seg.tipo === tipoFiltrado);
  }
  return rotaFiltrada === null || rotaFiltrada === rNum;
}

function mapLabel(rotaNum, idx) { return rotaNum + idx; }

function initLeafletMap() {
  if (leafletMap || typeof L === 'undefined') return;
  var el = document.getElementById('msvg'); if (!el) return;

  leafletMap = L.map(el, {
    zoomControl: false,
    attributionControl: true,
    minZoom: 5,
    maxZoom: 13,
    maxBounds: L.latLngBounds(MAP_BOUNDS).pad(0.3),
    maxBoundsViscosity: 0.6
  });

  // Tiles escuros gratuitos (CARTO, sem necessidade de chave de API) —
  // dão o "mapa real" (rios, relevo, estradas) por baixo das nossas calhas.
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', {
    subdomains: 'abcd',
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>'
  }).addTo(leafletMap);

  // contorno do Amazonas, destacado por cima do mapa real
  L.polygon(AM_BORDER, { color: '#26436b', weight: 2, fill: true, fillColor: '#14b8a6', fillOpacity: 0.03, interactive: false }).addTo(leafletMap);

  leafletMap.fitBounds(L.latLngBounds(MAP_BOUNDS));
  leafletMap.on('click', fecharPopupMapa);
}

function renderMap() {
  if (!leafletMap) initLeafletMap();
  if (!leafletMap) return; // Leaflet ainda não carregou (ex.: sem conexão) — nada a desenhar por enquanto
  var animarEntrada = mapAnimateEntrance;
  mapAnimateEntrance = false;

  if (mapDataLayer) leafletMap.removeLayer(mapDataLayer);
  mapDataLayer = L.layerGroup().addTo(leafletMap);
  routeLineLayers = {};

  // HUB (Manaus)
  var hubIcon = L.divIcon({
    className: 'map-icon-wrap', iconSize: [1, 1],
    html: '<div class="hub-badge"><span class="hub-ring"></span><span class="hub-ring hub-ring2"></span><span class="hub-dot"></span><span class="hub-label">MANAUS</span></div>'
  });
  L.marker(HUB_LATLNG, { icon: hubIcon, interactive: false, keyboard: false }).addTo(mapDataLayer);

  // LINHAS das calhas (hub -> municípios, na ordem de passagem)
  var ri = 0;
  ROTAS.forEach(function (r) {
    var algumAtivo = r.municipios.some(function (m) { return nodeAtivo(m, r.num); });
    var pts = r.municipios.map(function (m) { return LATLNG[m.seq] ? [LATLNG[m.seq].lat, LATLNG[m.seq].lng] : null; }).filter(Boolean);
    if (pts.length) {
      var latlngs = [HUB_LATLNG].concat(pts);
      var line = L.polyline(latlngs, {
        color: r.cor,
        weight: (algumAtivo && !tipoFiltrado) ? 2.6 : 1.2,
        opacity: tipoFiltrado ? 0.12 : (algumAtivo ? 0.65 : 0.08),
        className: 'mline',
        interactive: false
      }).addTo(mapDataLayer);
      routeLineLayers[r.num] = line;
      if (animarEntrada && line._path) {
        var len = line._path.getTotalLength();
        line._path.style.strokeDasharray = len;
        line._path.style.setProperty('--len', len);
        line._path.classList.add('mline-draw');
        line._path.style.animationDelay = (ri * 60) + 'ms';
      }
      ri++;
    }
  });

  // NÓS dos municípios
  var nodeCounter = 0;
  ROTAS.forEach(function (r) {
    r.municipios.forEach(function (m, idx) {
      var ll = LATLNG[m.seq]; if (!ll) return;
      var ativo = nodeAtivo(m, r.num);
      var seg = SEGURANCA[m.seq];
      var label = mapLabel(r.num, idx + 1);
      var segCor = seg ? SEGURANCA_META[seg.tipo].cor : r.cor;

      var badgeClass = 'mnode-badge' + (ativo ? '' : ' mnode-inactive') + (animarEntrada ? ' mnode-in' : '');
      var delayStyle = animarEntrada ? ('--i:' + nodeCounter + ';') : '';
      if (animarEntrada) nodeCounter++;
      var html = '<div class="' + badgeClass + '" style="' + delayStyle + '--rc:' + r.cor + ';--segcor:' + segCor + '">'
        + (seg ? '<span class="mnode-alert-ring" title="Ponto de atenção: ' + SEGURANCA_META[seg.tipo].label + '"></span>' : '')
        + '<span class="mnode-label">' + label + '</span>'
        + (seg ? '<span class="mnode-segdot">' + SEGURANCA_META[seg.tipo].icone + '</span>' : '')
        + '</div>';

      var icon = L.divIcon({ className: 'map-icon-wrap', html: html, iconSize: [1, 1] });
      var marker = L.marker([ll.lat, ll.lng], { icon: icon, interactive: ativo, keyboard: false }).addTo(mapDataLayer);
      if (ativo) {
        marker.on('click', function (e) {
          L.DomEvent.stopPropagation(e);
          showMapPopup(NODEIDX[m.seq], label);
        });
      }
    });
  });

  // Se tem uma calha específica selecionada (não "TODAS"), anima uma
  // embarcação (ou ônibus, pras calhas rodoviárias) percorrendo a rota.
  if (rotaFiltrada && routeLineLayers[rotaFiltrada]) {
    iniciarAnimacaoRota(rotaFiltrada, routeLineLayers[rotaFiltrada]);
  } else {
    pararAnimacaoRota();
  }
}

/* ── Ícone animado percorrendo a calha selecionada no mapa ──
   Interpola em cima das coordenadas reais (lat/lng), não em pixels —
   assim continua certinho mesmo se a pessoa arrastar ou der zoom no mapa
   enquanto o ícone se move. */
var routeAnim = { raf: null, num: null, marker: null };

function pararAnimacaoRota() {
  if (routeAnim.raf) cancelAnimationFrame(routeAnim.raf);
  routeAnim.raf = null;
  routeAnim.num = null;
  if (routeAnim.marker && leafletMap) leafletMap.removeLayer(routeAnim.marker);
  routeAnim.marker = null;
}

function iniciarAnimacaoRota(num, line) {
  pararAnimacaoRota();
  if (!leafletMap) return;
  var latlngs = line.getLatLngs(); if (!latlngs || latlngs.length < 2) return;

  var acc = [0];
  for (var i = 1; i < latlngs.length; i++) {
    acc.push(acc[i - 1] + leafletMap.distance(latlngs[i - 1], latlngs[i]));
  }
  var total = acc[acc.length - 1]; if (!total) return;

  var r = ROTAS.filter(function (x) { return x.num === num; })[0]; if (!r) return;
  var rodoviaria = isRodoviaria(r);

  var html = '<div class="route-anim-icon"><span class="route-anim-halo" style="--rc:' + r.cor + '"></span>'
    + '<span class="route-anim-glyph">' + (rodoviaria ? '🚌' : '🚤') + '</span></div>';
  var icon = L.divIcon({ className: 'map-icon-wrap', html: html, iconSize: [1, 1] });
  var marker = L.marker(latlngs[0], { icon: icon, interactive: false, keyboard: false, zIndexOffset: 1000 }).addTo(leafletMap);
  routeAnim.marker = marker;
  routeAnim.num = num;

  function pontoEm(dist) {
    for (var i = 1; i < acc.length; i++) {
      if (dist <= acc[i] || i === acc.length - 1) {
        var segLen = acc[i] - acc[i - 1];
        var f = segLen ? (dist - acc[i - 1]) / segLen : 0;
        var a = latlngs[i - 1], b = latlngs[i];
        return L.latLng(a.lat + (b.lat - a.lat) * f, a.lng + (b.lng - a.lng) * f);
      }
    }
    return latlngs[latlngs.length - 1];
  }

  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) {
    marker.setLatLng(pontoEm(total * 0.5)); // sem movimento: só mostra o ícone parado no meio da rota
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
    marker.setLatLng(pontoEm(t * total));
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

/* Arrastar/beliscar pra dar zoom já é nativo do Leaflet (e funciona melhor
   que o que a gente fazia na mão antes) — só garante que o mapa existe e
   redesenha certinho se o tamanho do container mudou. */
function initMapInteractions() {
  if (!leafletMap) initLeafletMap();
  if (leafletMap) leafletMap.invalidateSize();
}

function zI() { if (leafletMap) leafletMap.zoomIn(); }
function zO() { if (leafletMap) leafletMap.zoomOut(); }
function zR() {
  rotaFiltrada = null; tipoFiltrado = null; atualizarBotoesFiltro(); fecharPopupMapa();
  mapAnimateEntrance = true;
  if (leafletMap) leafletMap.fitBounds(L.latLngBounds(MAP_BOUNDS));
  renderMap();
}

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
  if (name === 'm') { mapAnimateEntrance = true; buildMapFilters(); renderMap(); initMapInteractions(); }
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
