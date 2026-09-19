/* ============================================================
   NAVLOG AMAZÔNIA — APP.JS
   3 abas: Rotas · Informações · Mapa
   ============================================================ */

var cur = 'r';

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
   PERSISTENCIA — overrides do usuario por municipio, salvos no
   navegador (localStorage). MUNINFO (data.js) e a base "de fabrica";
   getInfo() devolve a base mesclada com o que o operador editou.
   ============================================================ */
var LS_KEY = 'riverops_muninfo_overrides_v1';

function carregarOverrides() {
  try {
    var raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) { return {}; }
}
var OVERRIDES = carregarOverrides();

function salvarOverrides() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(OVERRIDES)); } catch (e) {}
}

/* Devolve o registro efetivo (base + edicoes) de um municipio. */
function getInfo(seq) {
  var base = MUNINFO[seq] || { ta: null, ps: { seca: null, cheia: null }, emb: { seca: [], cheia: [] } };
  var ov = OVERRIDES[seq];
  if (!ov) {
    // clona pra nao vazar referencia do objeto base
    return JSON.parse(JSON.stringify(base));
  }
  return {
    ta: (ov.ta !== undefined) ? ov.ta : base.ta,
    ps: {
      seca: (ov.ps && ov.ps.seca !== undefined) ? ov.ps.seca : base.ps.seca,
      cheia: (ov.ps && ov.ps.cheia !== undefined) ? ov.ps.cheia : base.ps.cheia
    },
    emb: {
      seca: (ov.emb && ov.emb.seca) ? JSON.parse(JSON.stringify(ov.emb.seca)) : JSON.parse(JSON.stringify(base.emb.seca)),
      cheia: (ov.emb && ov.emb.cheia) ? JSON.parse(JSON.stringify(ov.emb.cheia)) : JSON.parse(JSON.stringify(base.emb.cheia))
    }
  };
}

function setInfo(seq, info) {
  OVERRIDES[seq] = info;
  salvarOverrides();
}

function resetInfo(seq) {
  delete OVERRIDES[seq];
  salvarOverrides();
}

/* ============================================================
   ABA 1 — ROTAS
   Lista oculta: só as 10 rotas aparecem. Ao abrir, mostra os
   municípios na ordem de passagem, com km e transit time.
   ============================================================ */

function fmtSaca(v) { return (v === null || v === undefined || v === '') ? '—' : ('R$ ' + Number(v).toFixed(2).replace('.', ',')); }
function fmtTA(v) { return (v === null || v === undefined || v === '') ? '—' : (v + ' d'); }
function principalEmb(lista) {
  if (!lista || !lista.length) return null;
  var ordenado = lista.slice().sort(function (a, b) { return (b.freq || 0) - (a.freq || 0); });
  return ordenado[0];
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
  body.innerHTML = ROTAS.map(function (r) {
    var mRows = r.municipios.map(function (m, i) {
      return '<div class="mrow" data-txt="' + normKey(m.seq + ' ' + m.nome) + '">'
        + '<span class="mpos">' + (i + 1) + '</span>'
        + '<span class="mseq" style="color:' + r.cor + '">' + m.seq + '</span>'
        + '<span class="mname">' + m.nome + '</span>'
        + '<span class="mkm">' + m.km + ' km</span>'
        + '<span class="mtt">' + m.tt + '</span>'
        + '</div>';
    }).join('');
    return '<div class="rcard" id="rcard-' + r.num + '" data-txt="' + normKey(r.nome + ' ' + r.num) + '">'
      + buildRotaHeader(r)
      + '<div class="rbody">' + mRows + '</div>'
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
   ABA 2 — INFORMAÇÕES
   Mesma lista por calha; ao clicar num município abre um balão
   (bottom sheet) editável com transit Amazon, preço/saca (seca
   e cheia) e as embarcações usadas em cada regime do rio.
   ============================================================ */

function bIO() {
  var body = document.getElementById('ibdy'); if (!body) return;
  body.innerHTML = ROTAS.map(function (r) {
    var mRows = r.municipios.map(function (m, i) {
      var info = getInfo(m.seq);
      var pSeca = principalEmb(info.emb.seca);
      var pCheia = principalEmb(info.emb.cheia);
      var seg = SEGURANCA[m.seq];
      var segIc = seg ? '<span class="iseg-ic" style="background:' + SEGURANCA_META[seg.tipo].cor + '" title="' + SEGURANCA_META[seg.tipo].label + '">' + SEGURANCA_META[seg.tipo].icone + '</span>' : '';
      return '<div class="irow" data-txt="' + normKey(m.seq + ' ' + m.nome) + '" onclick="abrirInfo(\'' + m.seq + '\')">'
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
    return '<div class="rcard open" id="icard-' + r.num + '" data-txt="' + normKey(r.nome + ' ' + r.num) + '">'
      + '<div class="rhead rhead-static">'
      + '<div class="rnb" style="background:' + r.cor + '">' + r.num + '</div>'
      + '<div class="rinfo"><div class="rnome">Calha ' + r.nome + '</div>'
      + '<div class="rsub">' + r.municipios.length + ' municípios</div></div></div>'
      + '<div class="rbody" style="display:block">' + mRows + '</div>'
      + '</div>';
  }).join('');
}

function fI(q) {
  q = normKey(q.trim());
  document.querySelectorAll('#ibdy .rcard').forEach(function (card) {
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

function abrirInfo(seq) {
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
  editState.info.emb[regime].push({ n: '', freq: 1, tt: null });
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
  setInfo(editState.seq, editState.info);
  fecharSheet();
  bIO();
}

function resetSheetAtual() {
  if (!editState) return;
  resetInfo(editState.seq);
  editState.info = getInfo(editState.seq);
  renderSheet();
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
  setTimeout(function () { abrirInfo(seq); }, 60);
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
  ['r', 'i', 'm'].forEach(function (s) {
    var el = document.getElementById('sc-' + s);
    if (el) el.classList.toggle('h', s !== name);
  });
  document.querySelectorAll('.htab').forEach(function (b) { b.classList.toggle('on', b.dataset.s === name); });
  ['r', 'i', 'm'].forEach(function (s) { var bt = document.getElementById('bt-' + s); if (bt) bt.classList.toggle('on', s === name); });

  if (name === 'i') bIO();
  if (name === 'm') { buildMapFilters(); renderMap(); initMapInteractions(); }
}

bRO();
bIO();
