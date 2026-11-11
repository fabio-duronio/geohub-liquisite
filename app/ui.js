/*
 * GeoHub-LiquiSite — interfaccia
 * Copyright (C) 2026 Fabio Duronio — AGPL-3.0 con i termini aggiuntivi del file NOTICE.
 *
 * Solo interfaccia: nessuna formula. I risultati vengono da LiquiProfilo.calcolaScenario,
 * che chiama il motore. Ogni risultato porta la firma degli input: se un input cambia,
 * il risultato è «non aggiornato» finché non si ricalcola.
 */
(function () {
  'use strict';
  const L = window.LiquiSite, P = window.LiquiProgetto, F = window.LiquiProfilo, I = window.LiquiImporta,
    X = window.LiquiEsporta, E = window.LiquiEsempio, Gr = window.LiquiGrafici;
  const $ = (id) => document.getElementById(id);
  const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (v, cifre = 2) => isNum(v) ? v.toLocaleString('it-IT', { minimumFractionDigits: cifre, maximumFractionDigits: cifre }) : '–';

  const S = {
    pr: P.nuovoProgetto(),
    tab: 'profili', sottotab: 'finali',
    selezione: null, // indice della riga selezionata
    pannelli: null,  // id dei pannelli visibili (per tipo di metodo)
    confronto: [],   // id degli scenari nel confronto
    grafici: []
  };

  // ---------------------------------------------------------------------------
  // Accesso al modello
  // ---------------------------------------------------------------------------
  const prova = () => S.pr.prove.find(p => p.id === S.pr.provaAttiva) || null;
  const scenario = () => S.pr.scenari.find(s => s.id === S.pr.scenarioAttivo) || null;
  const provaDi = (s) => S.pr.prove.find(p => p.id === s.provaId) || null;
  const risultatoDi = (s) => (S.pr.risultati || {})[s.id] || null;

  /** 'aggiornato' | 'non_aggiornato' | 'assente' */
  function statoRisultato(s) {
    const r = s && risultatoDi(s);
    if (!r) return 'assente';
    const p = provaDi(s);
    if (!p || r.origine === 'file' || r.versioneMotore !== L.VERSIONE_MOTORE || r.firma !== P.firmaInput(p, s, L.VERSIONE_MOTORE)) return 'non_aggiornato';
    return 'aggiornato';
  }

  /** Lettura esplicita di un campo numerico: '' → null, testo non numerico → NaN (segnalato). */
  function leggiNumero(input) {
    const t = input.value.trim();
    if (t === '' && !(input.validity && input.validity.badInput)) { input.removeAttribute('aria-invalid'); return null; }
    const v = Number(t);
    if (t === '' || !Number.isFinite(v)) { input.setAttribute('aria-invalid', 'true'); return NaN; }
    input.removeAttribute('aria-invalid');
    return v;
  }

  // ---------------------------------------------------------------------------
  // Pannello: progetto
  // ---------------------------------------------------------------------------
  function renderProgetto() {
    const p = S.pr.progetto;
    $('prTitolo').value = p.titolo || ''; $('prSito').value = p.sito || '';
    $('prAutore').value = p.autore || ''; $('prNote').value = p.note || '';
    $('sumProgetto').textContent = p.titolo || '';
  }
  for (const [id, k] of [['prTitolo', 'titolo'], ['prSito', 'sito'], ['prAutore', 'autore'], ['prNote', 'note']]) {
    $(id).addEventListener('input', (e) => { S.pr.progetto[k] = e.target.value; $('sumProgetto').textContent = S.pr.progetto.titolo || ''; renderRiepilogo(); });
  }

  // ---------------------------------------------------------------------------
  // Pannello: prova
  // ---------------------------------------------------------------------------
  function renderProva() {
    const sel = $('selProva');
    sel.innerHTML = S.pr.prove.map(p => '<option value="' + esc(p.id) + '">' + esc(p.nome) + ' · ' + p.tipo + '</option>').join('') || '<option value="">— nessuna prova —</option>';
    sel.value = S.pr.provaAttiva || '';
    sel.disabled = S.pr.prove.length === 0;
    $('btnDatiProva').disabled = $('btnEliminaProva').disabled = !prova();
    const pv = prova();
    const box = $('provaCampi');
    if (!pv) { box.innerHTML = '<div class="hint">Nessuna prova. Crea una prova o apri l\'esempio.</div>'; $('sumProva').textContent = ''; return; }
    const zs = pv.dati.map(r => r[pv.colonne.indexOf('z')]).filter(isNum);
    const fz = P.UNITA.z.fattori[pv.unita.z || 'm'];
    let h = '';
    if (pv.esempio) h += '<div class="alert alert-warn" style="margin-bottom:10px;"><span class="alert-title">Esempio sintetico</span>Dati inventati per provare l\'app: non rappresentano un sito reale.</div>';
    h += '<div class="field"><label for="pvNome">Nome</label><input type="text" id="pvNome" value="' + esc(pv.nome) + '"></div>';
    h += '<div class="field"><label for="pvProv">Provenienza</label><input type="text" id="pvProv" value="' + esc(pv.provenienza) + '" placeholder="es. certificato n. …, ditta …"></div>';
    h += '<div class="chips" style="margin-bottom:12px;">' +
      '<div class="chip"><span>Tipo</span><span>' + esc(P.TIPI_PROVA[pv.tipo].etichetta) + '</span></div>' +
      '<div class="chip"><span>Letture</span><span class="num">' + pv.dati.length + '</span></div>' +
      '<div class="chip"><span>Profondità indagata</span><span class="num">' + (zs.length ? fmt(Math.min(...zs) * fz) + ' – ' + fmt(Math.max(...zs) * fz) + ' m' : '–') + '</span></div>' +
      '<div class="chip"><span>Colonne</span><span>' + pv.colonne.map(c => esc(P.ETICHETTE_COLONNE[c]) + ' [' + esc(pv.unita[c] || P.UNITA[c].interna) + ']').join(', ') + '</span></div></div>';
    const par = pv.parametri || {};
    if (pv.tipo === 'SPT') {
      h += '<div class="group-label">Attrezzatura SPT</div>' +
        '<div class="field-row"><div class="field"><label for="pvCE">CE (energia)</label><input type="number" step="0.01" id="pvCE" value="' + (par.CE ?? '') + '"><div class="hint">ERm/60 %</div></div>' +
        '<div class="field"><label for="pvSporg">Sporgenza aste [m]</label><input type="number" step="0.1" id="pvSporg" value="' + (par.sporgenza ?? '') + '"></div></div>' +
        '<div class="field-row"><div class="field"><label for="pvCB">CB (diametro foro)</label><input type="number" step="0.01" id="pvCB" value="' + (par.CB ?? '') + '"></div>' +
        '<div class="field"><label for="pvCS">CS (campionatore)</label><input type="number" step="0.01" id="pvCS" value="' + (par.CS ?? '') + '"' + (par.senzaRivestimento ? ' disabled' : '') + '></div></div>' +
        '<div class="checkline"><input type="checkbox" id="pvSenzaRiv"' + (par.senzaRivestimento ? ' checked' : '') + '><label for="pvSenzaRiv">Campionatore senza rivestimento (solo Cetin 2018: CS calcolato)</label></div>';
    } else if (pv.tipo === 'CPTU') {
      h += '<div class="field"><label for="pvAr">Rapporto d\'area a<sub>r</sub></label><input type="number" step="0.01" id="pvAr" value="' + (par.ar ?? '') + '"><div class="hint">Vuoto: il motore usa 0,8 e lo segnala come assunzione.</div></div>';
    } else if (pv.tipo === 'CPTE') {
      h += '<div class="hint" style="margin-bottom:10px;">CPT a punta elettrica senza misura di u: q<sub>t</sub> = q<sub>c</sub> (assunzione dichiarata nei risultati).</div>';
    }
    h += '<div class="group-label">Unità dichiarate</div><div class="field-row">' + pv.colonne.map(c => {
      const opz = Object.keys(P.UNITA[c].fattori);
      return '<div class="field"><label for="pvU_' + c + '">' + esc(P.ETICHETTE_COLONNE[c]) + '</label><select id="pvU_' + c + '" data-col="' + c + '"' + (opz.length < 2 ? ' disabled' : '') + '>' +
        opz.map(u => '<option' + ((pv.unita[c] || P.UNITA[c].interna) === u ? ' selected' : '') + '>' + esc(u) + '</option>').join('') + '</select></div>';
    }).join('') + '</div>';
    box.innerHTML = h;
    $('sumProva').textContent = pv.tipo + ' · ' + pv.dati.length + ' letture';

    $('pvNome').addEventListener('input', (e) => { pv.nome = e.target.value; aggiornaEtichette(); });
    $('pvProv').addEventListener('input', (e) => { pv.provenienza = e.target.value; });
    const num = (id, k) => { const el = $(id); if (el) el.addEventListener('input', () => { pv.parametri[k] = leggiNumero(el); inputCambiato(); }); };
    num('pvCE', 'CE'); num('pvSporg', 'sporgenza'); num('pvCB', 'CB'); num('pvCS', 'CS'); num('pvAr', 'ar');
    if ($('pvSenzaRiv')) $('pvSenzaRiv').addEventListener('change', (e) => { pv.parametri.senzaRivestimento = e.target.checked; $('pvCS').disabled = e.target.checked; inputCambiato(); });
    box.querySelectorAll('select[data-col]').forEach(el => el.addEventListener('change', () => { pv.unita[el.dataset.col] = el.value; inputCambiato(); renderProva(); }));
  }

  $('selProva').addEventListener('change', (e) => {
    S.pr.provaAttiva = e.target.value;
    const s = S.pr.scenari.find(x => x.provaId === S.pr.provaAttiva);
    S.pr.scenarioAttivo = s ? s.id : null;
    S.selezione = null; S.pannelli = null;
    renderTutto();
  });
  $('btnEliminaProva').addEventListener('click', () => {
    const pv = prova(); if (!pv) return;
    const n = S.pr.scenari.filter(s => s.provaId === pv.id).length;
    if (!confirm('Eliminare la prova «' + pv.nome + '»' + (n ? ' e i suoi ' + n + ' scenari' : '') + '?')) return;
    for (const s of S.pr.scenari.filter(s => s.provaId === pv.id)) delete S.pr.risultati[s.id];
    S.pr.scenari = S.pr.scenari.filter(s => s.provaId !== pv.id);
    S.pr.prove = S.pr.prove.filter(p => p.id !== pv.id);
    S.pr.provaAttiva = S.pr.prove[0] ? S.pr.prove[0].id : null;
    const s = S.pr.scenari.find(x => x.provaId === S.pr.provaAttiva);
    S.pr.scenarioAttivo = s ? s.id : null;
    S.confronto = S.confronto.filter(id => S.pr.scenari.some(s => s.id === id));
    renderTutto();
  });

  // ---------------------------------------------------------------------------
  // Pannello: scenario
  // ---------------------------------------------------------------------------
  function renderScenario() {
    const pv = prova();
    const sel = $('selScenario');
    const lista = pv ? S.pr.scenari.filter(s => s.provaId === pv.id) : [];
    sel.innerHTML = lista.map(s => '<option value="' + esc(s.id) + '">' + esc(s.nome) + '</option>').join('') || '<option value="">— nessuno scenario —</option>';
    sel.value = S.pr.scenarioAttivo || '';
    sel.disabled = lista.length === 0;
    $('btnNuovoScenario').disabled = !pv;
    $('btnDuplicaScenario').disabled = $('btnEliminaScenario').disabled = !scenario();
    const sc = scenario();
    const box = $('scenarioCampi');
    if (!sc) { box.innerHTML = '<div class="hint">' + (pv ? 'Crea uno scenario per questa prova.' : 'Serve prima una prova.') + '</div>'; $('sumScenario').textContent = ''; return; }
    const metodi = P.METODI_PER_TIPO[pv.tipo];
    let h = '<div class="field"><label for="scNome">Nome dello scenario</label><input type="text" id="scNome" value="' + esc(sc.nome) + '"></div>';
    h += '<div class="field"><label for="scMetodo">Metodo</label><select id="scMetodo">' + metodi.map(m => '<option value="' + m + '"' + (sc.metodo === m ? ' selected' : '') + '>' + esc(P.NOMI_METODI[m]) + '</option>').join('') + '</select>' +
      '<div class="hint">' + esc(F.METODI[sc.metodo].notaFS) + '</div></div>';
    h += '<div class="field-row"><div class="field"><label for="scMw">Magnitudo M<sub>w</sub></label><input type="number" step="0.01" id="scMw" value="' + (sc.Mw ?? '') + '"></div>' +
      '<div class="field"><label for="scAmax">a<sub>max</sub> in superficie [g]</label><input type="number" step="0.001" min="0" id="scAmax" value="' + (sc.amax ?? '') + '"></div></div>';
    h += '<div class="hint" style="margin:-4px 0 10px;">Valori forniti dal geologo con la loro fonte (es. GeoHub-SismaSite, analisi di risposta sismica locale). In questa versione l\'app non li calcola.</div>';
    if (sc.metodo === 'cetin2018Spt' || sc.metodo === 'kayen2013Vs') {
      h += '<div class="field"><label for="scVs12">V*<sub>s,12</sub> [m/s]</label><input type="number" step="1" id="scVs12" value="' + (sc.opzioni.Vs12 ?? '') + '"><div class="hint">Vs media nei primi 12 m, usata nel coefficiente r<sub>d</sub> del metodo.</div></div>';
    }
    if (sc.metodo === 'bi2014Cpt') {
      h += '<div class="field-row"><div class="field"><label for="scIc">Soglia di I<sub>c</sub></label><input type="number" step="0.05" id="scIc" value="' + (sc.opzioni.IcSoglia ?? '') + '"><div class="hint">2,6; 2,4–2,8 per sensibilità</div></div>' +
        '<div class="field"><label for="scCfc">C<sub>FC</sub></label><input type="number" step="0.01" id="scCfc" value="' + (sc.opzioni.CFC ?? '') + '"><div class="hint">0 senza taratura locale</div></div></div>';
    }
    h += '<div class="field"><label for="scNote">Note e fonti dei parametri</label><textarea id="scNote">' + esc(sc.note) + '</textarea></div>';
    box.innerHTML = h;
    $('sumScenario').textContent = sc.nome;

    $('scNome').addEventListener('input', (e) => { sc.nome = e.target.value; aggiornaEtichette(); });
    $('scNote').addEventListener('input', (e) => { sc.note = e.target.value; });
    $('scMetodo').addEventListener('change', (e) => { sc.metodo = e.target.value; S.pannelli = null; renderScenario(); inputCambiato(); renderStrati(); });
    const num = (id, set) => { const el = $(id); if (el) el.addEventListener('input', () => { set(leggiNumero(el)); inputCambiato(); }); };
    num('scMw', v => { sc.Mw = v; }); num('scAmax', v => { sc.amax = v; });
    num('scVs12', v => { sc.opzioni.Vs12 = v; }); num('scIc', v => { sc.opzioni.IcSoglia = v; }); num('scCfc', v => { sc.opzioni.CFC = v; });
  }

  $('selScenario').addEventListener('change', (e) => { S.pr.scenarioAttivo = e.target.value; S.selezione = null; renderTutto(); });
  $('btnNuovoScenario').addEventListener('click', () => {
    const pv = prova(); if (!pv) return;
    const s = P.nuovoScenario(pv, null, S.pr.scenari.length);
    const att = scenario();
    if (att) s.strati = P.copia(att.strati);
    S.pr.scenari.push(s); S.pr.scenarioAttivo = s.id; renderTutto();
  });
  $('btnDuplicaScenario').addEventListener('click', () => {
    const sc = scenario(); if (!sc) return;
    const s = P.duplicaScenario(sc, S.pr.scenari.length);
    S.pr.scenari.push(s); S.pr.scenarioAttivo = s.id;
    if (!S.confronto.includes(sc.id)) S.confronto.push(sc.id);
    if (S.confronto.length < 3) S.confronto.push(s.id);
    renderTutto();
  });
  $('btnEliminaScenario').addEventListener('click', () => {
    const sc = scenario(); if (!sc || !confirm('Eliminare lo scenario «' + sc.nome + '»?')) return;
    S.pr.scenari = S.pr.scenari.filter(s => s.id !== sc.id);
    delete S.pr.risultati[sc.id];
    S.confronto = S.confronto.filter(id => id !== sc.id);
    const s = S.pr.scenari.find(x => x.provaId === S.pr.provaAttiva);
    S.pr.scenarioAttivo = s ? s.id : null;
    renderTutto();
  });

  // ---------------------------------------------------------------------------
  // Pannello: falda e stratigrafia
  // ---------------------------------------------------------------------------
  function renderStrati() {
    const sc = scenario();
    const tb = $('tabStrati').querySelector('tbody');
    $('scFalda').disabled = $('btnAggiungiStrato').disabled = !sc;
    if (!sc) { tb.innerHTML = ''; $('scFalda').value = ''; $('sumStrati').textContent = ''; $('hintFC').textContent = ''; $('erroriStrati').innerHTML = ''; return; }
    $('scFalda').value = sc.zFalda ?? '';
    const etich = { da: 'da [m]', a: 'a [m]', gamma: 'γ', gammaSat: 'γsat', FC: 'FC [%]' };
    tb.innerHTML = sc.strati.map((s, i) => '<tr data-i="' + i + '" class="r1">' +
      ['da', 'a', 'gamma', 'gammaSat', 'FC'].map(k => '<td><input type="number" step="0.1" data-k="' + k + '" aria-label="' + etich[k] + ', strato ' + (i + 1) + '" value="' + (s[k] ?? '') + '"></td>').join('') + '</tr>' +
      '<tr data-i="' + i + '" class="r2"><td colspan="4"><input class="txt" type="text" data-k="descrizione" placeholder="descrizione" aria-label="descrizione, strato ' + (i + 1) + '" value="' + esc(s.descrizione || '') + '"></td>' +
      '<td style="text-align:right;"><button class="btn-link" type="button" data-rimuovi="' + i + '" aria-label="Rimuovi strato ' + (i + 1) + '">rimuovi</button></td></tr>').join('');
    $('sumStrati').textContent = (isNum(sc.zFalda) ? 'falda ' + fmt(sc.zFalda, 1) + ' m · ' : '') + sc.strati.length + ' strati';
    const pv = prova();
    $('hintFC').textContent = pv && pv.tipo.startsWith('CPT')
      ? 'FC: se indicato nello strato sostituisce la stima da Ic (B&I 2014); vuoto → stimato da Ic.'
      : 'FC per strato: usato quando la prova non riporta FC al punto; richiesto dai metodi SPT.';
    mostraErroriStrati();
  }
  function mostraErroriStrati() {
    const sc = scenario(), pv = prova();
    const err = sc && pv ? F.controllaScenario(pv, sc, L).filter(e => /strati|zFalda/.test(e.campo)) : [];
    $('erroriStrati').innerHTML = err.length ? '<div class="alert alert-danger" style="margin-top:10px;"><ul>' + err.map(e => '<li>' + esc(e.motivo) + '</li>').join('') + '</ul></div>' : '';
  }
  $('scFalda').addEventListener('input', (e) => { const sc = scenario(); if (!sc) return; sc.zFalda = leggiNumero(e.target); inputCambiato(); mostraErroriStrati(); $('sumStrati').textContent = (isNum(sc.zFalda) ? 'falda ' + fmt(sc.zFalda, 1) + ' m · ' : '') + sc.strati.length + ' strati'; });
  $('tabStrati').addEventListener('input', (e) => {
    const sc = scenario(); const tr = e.target.closest('tr'); if (!sc || !tr) return;
    const s = sc.strati[Number(tr.dataset.i)], k = e.target.dataset.k;
    s[k] = k === 'descrizione' ? e.target.value : leggiNumero(e.target);
    inputCambiato(); mostraErroriStrati();
  });
  $('tabStrati').addEventListener('click', (e) => {
    const b = e.target.closest('[data-rimuovi]'); const sc = scenario(); if (!b || !sc) return;
    sc.strati.splice(Number(b.dataset.rimuovi), 1); renderStrati(); inputCambiato();
  });
  $('btnAggiungiStrato').addEventListener('click', () => {
    const sc = scenario(); if (!sc) return;
    const ult = sc.strati[sc.strati.length - 1];
    sc.strati.push({ da: ult ? ult.a : 0, a: null, gamma: ult ? ult.gamma : 18, gammaSat: ult ? ult.gammaSat : 19, FC: null, descrizione: '' });
    renderStrati(); inputCambiato();
  });

  // ---------------------------------------------------------------------------
  // Calcolo e stato
  // ---------------------------------------------------------------------------
  function calcola(s) {
    const r = F.calcolaScenario(provaDi(s), s, L);
    S.pr.risultati[s.id] = r;
    return r;
  }
  $('btnCalcola').addEventListener('click', () => {
    const sc = scenario(); if (!sc) return;
    calcola(sc);
    renderRisultati();
    renderStato();
  });

  function renderStato() {
    const sc = scenario();
    const el = $('statoCalcolo');
    $('btnCalcola').disabled = !sc;
    if (!sc) { el.innerHTML = ''; return; }
    const st = statoRisultato(sc), r = risultatoDi(sc);
    let h;
    if (st === 'assente') h = '<span class="badge badge-none">non calcolato</span>';
    else if (st === 'non_aggiornato') h = '<span class="badge badge-stale">risultati non aggiornati</span><span>' + (r.origine === 'file' ? 'letti dal file (motore ' + esc(r.versioneMotore) + '): ricalcolare' : 'input modificati: ricalcolare') + '</span>';
    else if (r.stato !== 'calcolato') h = '<span class="badge badge-err">input non validi</span><span>vedi «Avvisi e assunzioni»</span>';
    else h = '<span class="badge badge-ok">aggiornato</span><span class="num">motore ' + esc(r.versioneMotore) + '</span>';
    el.innerHTML = h;
  }

  /** Chiamata a ogni modifica di un input di calcolo. */
  function inputCambiato() {
    renderStato();
    renderRiepilogo();
    aggiornaVeli();
    if (S.tab === 'confronto') renderConfronto();
  }

  function aggiornaEtichette() {
    const pv = prova(), sc = scenario();
    if (pv) { const o = $('selProva').querySelector('option[value="' + CSS.escape(pv.id) + '"]'); if (o) o.textContent = pv.nome + ' · ' + pv.tipo; }
    if (sc) { const o = $('selScenario').querySelector('option[value="' + CSS.escape(sc.id) + '"]'); if (o) o.textContent = sc.nome; $('sumScenario').textContent = sc.nome; }
    renderRiepilogo();
  }

  // ---------------------------------------------------------------------------
  // Riepilogo
  // ---------------------------------------------------------------------------
  function renderRiepilogo() {
    const box = $('riepilogo');
    const pv = prova(), sc = scenario();
    const crumb = '<div class="summary-head">' +
      '<span class="crumb">Progetto <b>' + esc(S.pr.progetto.titolo || '—') + '</b></span>' +
      '<span class="crumb">Prova <b>' + esc(pv ? pv.nome : '—') + '</b>' + (pv && pv.esempio ? ' <span class="badge badge-sample">esempio sintetico</span>' : '') + '</span>' +
      '<span class="crumb">Scenario <b>' + esc(sc ? sc.nome : '—') + '</b></span>' +
      '<span class="crumb">Metodo <b>' + esc(sc ? P.NOMI_METODI[sc.metodo] : '—') + '</b></span>' +
      '<span id="riepStato"></span></div>';
    const r = sc && risultatoDi(sc);
    const st = statoRisultato(sc);
    let kpi = '';
    if (r && r.stato === 'calcolato') {
      const q = r.riepilogo;
      const nNon = q.punti - (q.conteggi.calcolato || 0);
      const kv = (lab, val, unit, sub) => '<div class="kpi"><div class="kpi-label">' + lab + '</div><div class="kpi-value">' + val + (unit ? ' <span class="kpi-unit">' + unit + '</span>' : '') + '</div>' + (sub ? '<div class="kpi-sub">' + sub + '</div>' : '') + '</div>';
      kpi = '<div class="kpi-row">' +
        kv('FS minimo calcolato', q.fsMin ? fmt(q.fsMin.FS) : '–', '', q.fsMin ? 'a z = ' + fmt(q.fsMin.z) + ' m' : 'nessun punto calcolato') +
        kv('Profondità indagata', q.profonditaIndagata ? fmt(q.profonditaIndagata.da, 1) + '–' + fmt(q.profonditaIndagata.a, 1) : '–', 'm') +
        kv('Estensione analizzata', q.estensioneAnalizzata ? fmt(q.estensioneAnalizzata.da, 1) + '–' + fmt(q.estensioneAnalizzata.a, 1) : '–', 'm', 'tra il primo e l\'ultimo punto calcolato') +
        kv('Punti calcolati', (q.conteggi.calcolato || 0) + ' / ' + q.punti, '', nNon ? nNon + ' non calcolati' : 'tutti calcolati') +
        kv('Avvisi', String(q.avvisi.length), '', q.intervalliNonCalcolati.length + ' intervalli non calcolati') + '</div>' +
        '<div class="hint">Il FS minimo non descrive da solo la risposta del sito: vedere profili, intervalli non calcolati e avvisi. FS = 1 è il riferimento del modello; le NTC 2018 non fissano un valore minimo.</div>';
    } else if (r && r.stato !== 'calcolato') {
      kpi = '<div class="alert alert-danger"><span class="alert-title">Calcolo non eseguito: input non validi</span><ul>' + r.errori.map(e => '<li>' + esc(e.motivo) + '</li>').join('') + '</ul></div>';
    } else {
      kpi = '<div class="hint">' + (sc ? 'Imposta i parametri e premi «Calcola».' : 'Crea una prova e uno scenario, oppure apri l\'esempio sintetico.') + '</div>';
    }
    box.innerHTML = crumb + kpi;
    const b = $('riepStato');
    b.innerHTML = st === 'aggiornato' ? (r.stato === 'calcolato' ? '<span class="badge badge-ok">risultati aggiornati</span>' : '<span class="badge badge-err">input non validi</span>')
      : st === 'non_aggiornato' ? '<span class="badge badge-stale">risultati non aggiornati</span>' : '<span class="badge badge-none">non calcolato</span>';
  }

  // ---------------------------------------------------------------------------
  // Schede
  // ---------------------------------------------------------------------------
  const TABS = ['profili', 'tabelle', 'confronto', 'avvisi'];
  function mostraTab(t) {
    S.tab = t;
    for (const x of TABS) {
      $('tab-' + x).setAttribute('aria-selected', String(x === t));
      $('tab-' + x).tabIndex = x === t ? 0 : -1;
      $('pan-' + x).hidden = x !== t;
    }
    renderRisultati();
  }
  TABS.forEach((t, i) => {
    $('tab-' + t).addEventListener('click', () => mostraTab(t));
    $('tab-' + t).addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const n = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length];
      mostraTab(n); $('tab-' + n).focus();
    });
  });

  function distruggiGrafici() { for (const c of S.grafici) c.chart.destroy(); S.grafici = []; }

  function renderRisultati() {
    distruggiGrafici();
    renderRiepilogo();
    if (S.tab === 'profili') renderProfili();
    else if (S.tab === 'tabelle') renderTabelle();
    else if (S.tab === 'confronto') renderConfronto();
    else renderAvvisi();
  }

  function aggiornaVeli() {
    const sc = scenario();
    const stale = sc && statoRisultato(sc) !== 'aggiornato';
    document.querySelectorAll('[data-velo]').forEach(v => { v.hidden = !stale; });
  }

  // ---------------------------------------------------------------------------
  // Profili
  // ---------------------------------------------------------------------------
  const COL = { ink: '#111827', blu: '#1e4e8c', grigio: '#5f6b7a', bruno: '#9a4410', verde: '#1f6b45', viola: '#6b3fa0' };

  function catalogoPannelli(pv, sc) {
    const cpt = pv.tipo === 'CPTE' || pv.tipo === 'CPTU', spt = pv.tipo === 'SPT';
    const p = [];
    const s = (chiave, nome, colore, sorgente = 'valori', tratteggio = false) => ({ chiave, nome, colore, sorgente, tratteggio });
    if (cpt) {
      p.push({ id: 'qc', titolo: 'qc (misurato)', etichettaX: 'qc [MPa]', serie: [s('qc', 'qc', COL.ink, 'ingresso')], def: true, cifre: 2 });
      p.push({ id: 'fs', titolo: 'fs (misurato)', etichettaX: 'fs [kPa]', serie: [s('fs', 'fs', COL.ink, 'ingresso')], def: true, cifre: 1 });
      if (pv.tipo === 'CPTU') p.push({ id: 'u2', titolo: 'u2 (misurata)', etichettaX: 'u2 [kPa]', serie: [s('u2', 'u2', COL.ink, 'ingresso')], def: false, cifre: 1 });
      p.push({ id: 'Ic', titolo: 'Ic', etichettaX: 'Ic [–]', serie: [s('Ic', 'Ic', COL.ink)], rif: isNum(sc.opzioni.IcSoglia) ? [{ x: sc.opzioni.IcSoglia, etichetta: 'soglia Ic ' + fmt(sc.opzioni.IcSoglia, 1) }] : [], xMin: 1, xMax: 4, def: true, cifre: 2,
        nota: 'Oltre la soglia il metodo non si applica (non è un\'esclusione normativa).' });
      p.push({ id: 'qc1N', titolo: 'Resistenza normalizzata', etichettaX: 'qc1N, qc1Ncs [–]', serie: [s('qc1N', 'qc1N', COL.grigio, 'valori', true), s('qc1Ncs', 'qc1Ncs', COL.ink)], def: true, cifre: 1 });
    } else if (spt) {
      p.push({ id: 'N', titolo: 'N SPT (misurato)', etichettaX: 'N [colpi/30 cm]', serie: [s('N', 'N', COL.ink, 'ingresso')], def: true, cifre: 0 });
      p.push({ id: 'N160', titolo: 'Resistenza normalizzata', etichettaX: '(N1)60, (N1)60cs [–]', serie: [s('N160', '(N1)60', COL.grigio, 'valori', true), s('N160cs', '(N1)60cs', COL.ink)], def: true, cifre: 1 });
    } else {
      p.push({ id: 'Vs', titolo: 'Vs (misurata) e Vs1', etichettaX: 'Vs, Vs1 [m/s]', serie: [s('Vs', 'Vs', COL.ink, 'ingresso'), s('Vs1', 'Vs1', COL.grigio, 'valori', true)], def: true, cifre: 0 });
    }
    const crr = sc.metodo === 'kayen2013Vs' ? 'CRR15' : 'CRR';
    p.push({ id: 'csrcrr', titolo: 'CSR e CRR a condizioni di sito', etichettaX: 'CSR, CRR [–]', serie: [s('CSR', 'CSR (sito)', COL.ink, 'valori', true), s(crr, sc.metodo === 'kayen2013Vs' ? 'CRR PL 15 % (sito)' : 'CRR (sito)', COL.blu)], def: true, cifre: 3, xMin: 0 });
    p.push({ id: 'FS', titolo: 'Fattore di sicurezza FS', etichettaX: 'FS [–]', serie: [s('FS', 'FS', COL.blu)], rif: [{ x: 1, etichetta: 'FS = 1 (riferimento del modello)' }], xMin: 0, xMax: 3, def: true, cifre: 2 });
    if (sc.metodo !== 'bi2014Spt') p.push({ id: 'PL', titolo: 'Probabilità PL', etichettaX: 'PL [–]', serie: [s('PL', 'PL', COL.ink)], xMin: 0, xMax: 1, def: false, cifre: 3, nota: F.METODI[sc.metodo].notaPL });
    p.push({ id: 'tens', titolo: 'Tensioni', etichettaX: 'σ [kPa]', serie: [s('sv', 'σv', COL.ink, 'tensioni'), s('sve', 'σ\'v', COL.blu, 'tensioni', true), s('u', 'u0', COL.grigio, 'tensioni')], def: false, cifre: 1, xMin: 0 });
    if (sc.metodo === 'cetin2018Spt') p.push({ id: 'coef', titolo: 'rd, Kσ, KMw', etichettaX: '[–]', serie: [s('rd', 'rd', COL.ink), s('Ksigma', 'Kσ', COL.blu, 'valori', true), s('KMw', 'KMw', COL.grigio)], def: false, cifre: 3 });
    else if (sc.metodo === 'kayen2013Vs') p.push({ id: 'coef', titolo: 'rd', etichettaX: 'rd [–]', serie: [s('rd', 'rd', COL.ink)], def: false, cifre: 3 });
    else p.push({ id: 'coef', titolo: 'rd, Kσ, MSF', etichettaX: '[–]', serie: [s('rd', 'rd', COL.ink), s('Ksigma', 'Kσ', COL.blu, 'valori', true), s('MSF', 'MSF', COL.grigio)], def: false, cifre: 3 });
    return p;
  }

  function renderProfili() {
    const box = $('pan-profili');
    const pv = prova(), sc = scenario(), r = sc && risultatoDi(sc);
    if (!pv || !sc) { box.innerHTML = '<div class="empty">Nessuna prova o scenario attivo.</div>'; return; }
    if (!r || r.stato !== 'calcolato') { box.innerHTML = '<div class="empty">' + (r ? 'Il calcolo non è stato eseguito: correggi gli input (vedi riepilogo).' : 'Premi «Calcola» per ottenere i profili.') + '</div>'; return; }
    const cat = catalogoPannelli(pv, sc);
    const chiave = pv.tipo + '|' + sc.metodo;
    if (!S.pannelli || S.pannelli.chiave !== chiave) S.pannelli = { chiave, id: new Set(cat.filter(c => c.def).map(c => c.id)) };
    const continuo = F.METODI[sc.metodo].continuo;
    let h = '<div class="chart-toolbar" role="group" aria-label="Pannelli visibili">' + cat.map(c =>
      '<label><input type="checkbox" data-pannello="' + c.id + '"' + (S.pannelli.id.has(c.id) ? ' checked' : '') + '> ' + esc(c.titolo) + '</label>').join('') + '</div>';
    h += '<div class="profiles" id="profili">' + cat.filter(c => S.pannelli.id.has(c.id)).map(c =>
      '<div class="profile"><div class="profile-head"><span></span><button class="btn-link" type="button" data-png="' + c.id + '" aria-label="Scarica PNG di ' + esc(c.titolo) + '">PNG</button></div>' +
      '<div class="chart-wrap"><canvas id="cv-' + c.id + '" role="img" aria-label="Profilo ' + esc(c.titolo) + '"></canvas><div class="stale-veil" data-velo hidden>Risultati non aggiornati</div></div>' +
      '<div class="profile-note" id="nota-' + c.id + '"></div></div>').join('') + '</div>';
    h += '<div class="legend-note"><span><span class="sw" style="color:#2f7dd6;border-top-style:dashed;"></span>falda di verifica</span>' +
      '<span><span class="sw" style="color:#aab8c8;"></span>limiti degli strati</span>' +
      '<span><span class="sw dash" style="color:#5f6b7a;"></span>riferimento</span>' +
      (continuo ? '<span>Linee interrotte dove il punto non è calcolato o mancano dati.</span>' : '<span><span class="sw dot" style="color:#1e4e8c;"></span>SPT: punti discreti, non uniti.</span>') + '</div>';
    h += '<div class="sel-detail" id="dettaglioSel">Seleziona un punto su un grafico o una riga in tabella.</div>';
    box.innerHTML = h;

    const zMax = Math.max(Math.ceil((r.riepilogo.profonditaIndagata ? r.riepilogo.profonditaIndagata.a : 10) + 0.5), ...sc.strati.map(s => isNum(s.a) ? s.a : 0));
    const strati = [...new Set(sc.strati.flatMap(s => [s.da, s.a]).filter(z => isNum(z) && z > 0))];
    for (const c of cat.filter(c => S.pannelli.id.has(c.id))) {
      const serie = c.serie.map(x => {
        const sr = F.serie(r, x.chiave, x.sorgente);
        return { nome: x.nome, colore: x.colore, tratteggio: x.tratteggio, stilePunto: x.tratteggio ? 'rect' : 'circle', soloPunti: !continuo && x.sorgente !== 'tensioni', segmenti: sr.segmenti, punti: sr.punti };
      });
      const cfg = {
        titolo: c.titolo, etichettaX: c.etichettaX, yMax: zMax, falda: sc.zFalda, strati, riferimentiX: c.rif || [],
        xMin: c.xMin, xMax: c.xMax, cifre: c.cifre, serie
      };
      const chart = Gr.profilo($('cv-' + c.id), { ...cfg,
        selezionato: S.selezione !== null ? (r.righe[S.selezione] || {}).z : undefined,
        onClick: (indice) => seleziona(indice)
      });
      S.grafici.push({ id: c.id, titolo: c.titolo, chart, cfg });
      // note: valori fuori scala (non modificati) e significato
      const note = [];
      if (isNum(c.xMax)) {
        const fuori = serie.reduce((n, s) => n + s.punti.filter(p => p.x > c.xMax).length, 0);
        if (fuori) note.push(fuori + ' valori oltre ' + fmt(c.xMax, c.xMax < 2 ? 1 : 0) + ' non visibili (fuori scala, vedi tabella)');
      }
      if (c.nota) note.push(c.nota);
      $('nota-' + c.id).textContent = note.join(' · ');
    }
    box.querySelectorAll('[data-pannello]').forEach(el => el.addEventListener('change', () => {
      if (el.checked) S.pannelli.id.add(el.dataset.pannello); else S.pannelli.id.delete(el.dataset.pannello);
      renderRisultati();
    }));
    box.querySelectorAll('[data-png]').forEach(el => el.addEventListener('click', () => {
      const g = S.grafici.find(x => x.id === el.dataset.png);
      if (g) scarica(Gr.png(g.chart), nomeFile('profilo-' + g.id, 'png'), true);
    }));
    aggiornaVeli();
    mostraDettaglio();
  }

  function seleziona(indice) {
    S.selezione = indice;
    const sc = scenario(), r = sc && risultatoDi(sc);
    const z = r && r.righe[indice] ? r.righe[indice].z : undefined;
    for (const g of S.grafici) Gr.selezione(g.chart, z);
    document.querySelectorAll('table.data-table tr[data-indice]').forEach(tr => tr.classList.toggle('hl', Number(tr.dataset.indice) === indice));
    const tr = document.querySelector('table.data-table tr[data-indice="' + indice + '"]');
    if (tr && S.tab === 'tabelle') tr.scrollIntoView({ block: 'nearest' });
    mostraDettaglio();
  }

  function mostraDettaglio() {
    const el = $('dettaglioSel'); const sc = scenario(), r = sc && risultatoDi(sc);
    if (!el || !r || S.selezione === null || !r.righe[S.selezione]) return;
    const x = r.righe[S.selezione];
    let t = '<b>z = ' + fmt(x.z) + ' m</b> · stato: ' + esc(F.ETICHETTE_STATI[x.stato] || x.stato);
    if (x.stato === 'calcolato') t += ' · FS = <span class="num">' + fmt(x.valori.FS) + '</span> · CSR = <span class="num">' + fmt(x.valori.CSR, 3) + '</span>';
    if (x.motivo) t += '<br>' + esc(x.motivo);
    if (x.avvisi.length) t += '<br>Avvisi: ' + x.avvisi.map(a => esc(a.messaggio)).join(' · ');
    t += ' <button class="btn-link" type="button" id="vaiTabella">vedi in tabella</button>';
    el.innerHTML = t;
    $('vaiTabella').addEventListener('click', () => { mostraTab('tabelle'); seleziona(S.selezione); });
  }

  // ---------------------------------------------------------------------------
  // Tabelle
  // ---------------------------------------------------------------------------
  function intest(k) {
    const g = F.G[k] || { etichetta: k, unita: '' };
    return '<th scope="col">' + esc(g.etichetta) + (g.unita && g.unita !== '–' ? '<span class="u">[' + esc(g.unita) + ']</span>' : '<span class="u">&nbsp;</span>') + '</th>';
  }

  function renderTabelle() {
    const box = $('pan-tabelle');
    const pv = prova(), sc = scenario(), r = sc && risultatoDi(sc);
    if (!pv) { box.innerHTML = '<div class="empty">Nessuna prova attiva.</div>'; return; }
    const sub = [['originali', 'Dati originali'], ['intermedi', 'Risultati intermedi'], ['finali', 'Risultati finali']];
    let h = '<div class="chart-toolbar"><div class="subtabs" role="group" aria-label="Tabella">' + sub.map(([k, t]) =>
      '<button type="button" data-sub="' + k + '" aria-pressed="' + (S.sottotab === k) + '">' + t + '</button>').join('') + '</div>' +
      '<span class="hint">Valori arrotondati solo a video; il CSV conserva la precisione piena.</span></div>';
    const stale = sc && statoRisultato(sc) !== 'aggiornato';
    if (S.sottotab !== 'originali' && stale && r) h += '<div class="alert alert-warn" style="margin-bottom:10px;">Risultati non aggiornati rispetto agli input: ricalcolare.</div>';

    if (S.sottotab === 'originali') {
      const iz = pv.colonne.indexOf('z');
      h += '<div class="table-scroll"><table class="data-table"><thead><tr><th scope="col">#</th>' + pv.colonne.map(c => '<th scope="col">' + esc(P.ETICHETTE_COLONNE[c]) + '<span class="u">[' + esc(pv.unita[c] || P.UNITA[c].interna) + ']</span></th>').join('') + '</tr></thead><tbody>' +
        pv.dati.map((riga, i) => '<tr data-indice="' + i + '"' + (S.selezione === i ? ' class="hl"' : '') + '><td>' + (i + 1) + '</td>' + riga.map((v, j) => '<td>' + (v === null ? '–' : fmt(v, j === iz ? 2 : (F.G[pv.colonne[j]] || {}).cifre ?? 2)) + '</td>').join('') + '</tr>').join('') +
        '</tbody></table></div><div class="hint" style="margin-top:6px;">Dati come inseriti, nelle unità dichiarate. «–» = dato mancante.</div>';
    } else if (!r || r.stato !== 'calcolato') {
      h += '<div class="empty">Nessun risultato da mostrare: premi «Calcola».</div>';
    } else {
      const M = F.METODI[sc.metodo];
      let cols;
      if (S.sottotab === 'intermedi') cols = ['t:sv', 't:u', 't:sve', 'FC', 'origineFC'].concat(M.intermedie);
      else cols = ['stato'].concat(M.finali, ['motivo']);
      h += '<div class="table-scroll"><table class="data-table"><thead><tr>' + intest('z') + cols.map(k => {
        if (k === 'stato') return '<th scope="col">stato<span class="u">&nbsp;</span></th>';
        if (k === 'motivo') return '<th scope="col" style="text-align:left;">motivo / avvisi<span class="u">&nbsp;</span></th>';
        if (k === 'origineFC') return '<th scope="col" style="text-align:left;">origine FC<span class="u">&nbsp;</span></th>';
        return intest(k.startsWith('t:') ? k.slice(2) : k);
      }).join('') + '</tr></thead><tbody>' +
        r.righe.map(x => '<tr data-indice="' + x.indice + '" class="' + (S.selezione === x.indice ? 'hl ' : '') + (x.stato !== 'calcolato' ? 'muted' : '') + '"><td>' + fmt(x.z) + '</td>' + cols.map(k => {
          if (k === 'stato') return '<td><span class="stato-tag ' + x.stato + '">' + esc(F.ETICHETTE_STATI[x.stato] || x.stato) + '</span></td>';
          if (k === 'motivo') return '<td class="txt" title="' + esc(x.motivo || '') + '">' + esc([x.codice ? (F.MOTIVI_BREVI[x.codice] || x.codice) : null, ...x.avvisi.map(a => a.codice)].filter(Boolean).join(' · ')) + '</td>';
          if (k === 'origineFC') return '<td class="txt" style="min-width:120px;">' + esc(x.origineFC || '–') + '</td>';
          if (k === 'FC') return '<td>' + fmt(x.FC, 1) + '</td>';
          if (k.startsWith('t:')) return '<td>' + (x.tensioni ? fmt(x.tensioni[k.slice(2)], 1) : '–') + '</td>';
          const v = x.stato === 'calcolato' && x.valori ? x.valori[k] : null;
          return '<td>' + fmt(v, (F.G[k] || {}).cifre ?? 3) + '</td>';
        }).join('') + '</tr>').join('') + '</tbody></table></div>';
      h += '<div class="hint" style="margin-top:6px;">' + esc(M.notaFS) + ' ' + esc(M.notaPL) + ' «–» = non calcolato o non applicabile (mai zero).</div>';
    }
    box.innerHTML = h;
    box.querySelectorAll('[data-sub]').forEach(b => b.addEventListener('click', () => { S.sottotab = b.dataset.sub; renderTabelle(); }));
    box.querySelectorAll('tr[data-indice]').forEach(tr => tr.addEventListener('click', () => seleziona(Number(tr.dataset.indice))));
  }

  // ---------------------------------------------------------------------------
  // Confronto tra scenari
  // ---------------------------------------------------------------------------
  function renderConfronto() {
    distruggiGrafici();
    const box = $('pan-confronto');
    if (S.pr.scenari.length === 0) { box.innerHTML = '<div class="empty">Nessuno scenario.</div>'; return; }
    S.confronto = S.confronto.filter(id => S.pr.scenari.some(s => s.id === id));
    if (S.confronto.length === 0 && scenario()) S.confronto = [scenario().id];
    let h = '<div class="hint" style="margin-bottom:8px;">Scegli 2–3 scenari (per creare una variante usa «Duplica» e modifica falda, a<sub>max</sub> o M<sub>w</sub>).</div><div class="scen-list" role="group" aria-label="Scenari a confronto">' +
      S.pr.scenari.map(s => '<label><input type="checkbox" data-conf="' + esc(s.id) + '"' + (S.confronto.includes(s.id) ? ' checked' : '') + (!S.confronto.includes(s.id) && S.confronto.length >= 3 ? ' disabled' : '') + '>' +
        '<span class="scen-dot" style="background:' + esc(s.colore) + '"></span>' + esc(s.nome) + ' <span class="hint">(' + esc(provaDi(s) ? provaDi(s).nome : '?') + ')</span></label>').join('') + '</div>';
    h += '<div class="btn-row" style="margin-bottom:12px;"><button class="btn btn-sm btn-primary" type="button" id="btnCalcolaConf">Calcola gli scenari selezionati</button></div>';
    const sel = S.confronto.map(id => S.pr.scenari.find(s => s.id === id));
    const stati = sel.map(s => statoRisultato(s));
    const prove = new Set(sel.map(s => s.provaId)), metodi = new Set(sel.map(s => s.metodo));
    const avvisi = [];
    if (stati.some(st => st !== 'aggiornato')) avvisi.push(['warn', 'Alcuni scenari non sono calcolati o non sono aggiornati: premi «Calcola gli scenari selezionati».']);
    if (prove.size > 1) avvisi.push(['info', 'Scenari su prove diverse: il confronto è per profondità dal piano campagna, senza quote assolute né distanze.']);
    if (metodi.size > 1) avvisi.push(['info', 'Metodi diversi: FS e PL hanno basi diverse (B&I 2014 CPT: FS = 1 ↔ PL ≈ 16 %; Cetin 2018: FS = 1 ↔ PL = 50 %; Kayen 2013: FS riferito a PL = 15 %). Nessun risultato viene scelto automaticamente.']);
    const calcolati = sel.filter((s, i) => stati[i] === 'aggiornato' && risultatoDi(s).stato === 'calcolato');
    if (calcolati.length > 1) {
      const rif = risultatoDi(calcolati[0]);
      for (const s of calcolati.slice(1)) {
        const d = F.confrontaDominio(rif, risultatoDi(s));
        if (!d.uguale) avvisi.push(['warn', 'Il dominio dei punti calcolati di «' + s.nome + '» è diverso da quello di «' + calcolati[0].nome + '»: ' +
          (d.soloA.length ? d.soloA.length + ' punti calcolati solo nel primo' : '') + (d.soloA.length && d.soloB.length ? ', ' : '') + (d.soloB.length ? d.soloB.length + ' solo nel secondo' : '') + ' (es. per la falda diversa).']);
      }
    }
    h += avvisi.map(([t, m]) => '<div class="alert alert-' + t + '">' + m + '</div>').join('');
    h += '<div class="panel" style="border:1px solid var(--line); margin-top:12px; padding:8px;"><div class="profile-head"><span></span><button class="btn-link" type="button" id="pngConf">PNG</button></div>' +
      '<div class="chart-wide"><canvas id="cvConf" role="img" aria-label="FS sovrapposti degli scenari"></canvas></div><div class="profile-note" id="notaConf"></div></div>';
    h += '<div class="section-title">Parametri</div><div class="table-scroll"><table class="data-table"><thead><tr><th scope="col">Scenario</th><th scope="col">Prova</th><th scope="col">Metodo</th>' + '<th scope="col">Mw<span class="u">&nbsp;</span></th>' + '<th scope="col">amax<span class="u">[g]</span></th><th scope="col">falda<span class="u">[m]</span></th><th scope="col">stato</th></tr></thead><tbody>' +
      sel.map((s, i) => '<tr><td><span class="scen-dot" style="background:' + esc(s.colore) + '"></span> ' + esc(s.nome) + '</td><td class="txt">' + esc(provaDi(s) ? provaDi(s).nome : '?') + '</td><td class="txt">' + esc(P.NOMI_METODI[s.metodo]) + '</td><td>' + fmt(s.Mw) + '</td><td>' + fmt(s.amax, 3) + '</td><td>' + fmt(s.zFalda) + '</td><td class="txt">' + (stati[i] === 'aggiornato' ? 'aggiornato' : stati[i] === 'assente' ? 'non calcolato' : 'non aggiornato') + '</td></tr>').join('') + '</tbody></table></div>';
    h += '<div class="section-title">Riepilogo dei risultati</div><div class="table-scroll"><table class="data-table"><thead><tr><th scope="col">Scenario</th><th scope="col">FS minimo</th><th scope="col">a z<span class="u">[m]</span></th><th scope="col">estensione analizzata<span class="u">[m]</span></th><th scope="col">punti calcolati</th><th scope="col">intervalli non calcolati</th><th scope="col" style="text-align:left;">avvisi</th></tr></thead><tbody>' +
      sel.map((s, i) => {
        const r = risultatoDi(s);
        if (stati[i] !== 'aggiornato' || !r || r.stato !== 'calcolato') return '<tr><td>' + esc(s.nome) + '</td><td colspan="6" class="txt">' + (r && r.stato !== 'calcolato' && stati[i] === 'aggiornato' ? 'input non validi' : 'da calcolare') + '</td></tr>';
        const q = r.riepilogo;
        return '<tr><td><span class="scen-dot" style="background:' + esc(s.colore) + '"></span> ' + esc(s.nome) + '</td><td>' + (q.fsMin ? fmt(q.fsMin.FS) : '–') + '</td><td>' + (q.fsMin ? fmt(q.fsMin.z) : '–') + '</td><td>' +
          (q.estensioneAnalizzata ? fmt(q.estensioneAnalizzata.da, 1) + '–' + fmt(q.estensioneAnalizzata.a, 1) : '–') + '</td><td>' + (q.conteggi.calcolato || 0) + ' / ' + q.punti + '</td><td>' + q.intervalliNonCalcolati.length + '</td><td class="txt">' +
          esc(q.avvisi.map(a => a.codice + ' (' + a.n + ')').join(', ') || '—') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
    box.innerHTML = h;

    box.querySelectorAll('[data-conf]').forEach(el => el.addEventListener('change', () => {
      if (el.checked) { if (S.confronto.length < 3) S.confronto.push(el.dataset.conf); }
      else S.confronto = S.confronto.filter(id => id !== el.dataset.conf);
      renderConfronto();
    }));
    $('btnCalcolaConf').addEventListener('click', () => { for (const s of sel) calcola(s); renderStato(); renderRiepilogo(); renderConfronto(); });

    // grafico FS sovrapposti
    const serie = [];
    let zMax = 5, fuori = 0;
    for (const [i, s] of sel.entries()) {
      if (stati[i] !== 'aggiornato' || risultatoDi(s).stato !== 'calcolato') continue;
      const r = risultatoDi(s), sr = F.serie(r, 'FS');
      fuori += sr.punti.filter(p => p.x > 3).length;
      zMax = Math.max(zMax, Math.ceil((r.riepilogo.profonditaIndagata ? r.riepilogo.profonditaIndagata.a : 0) + 0.5));
      serie.push({ nome: s.nome, colore: s.colore, tratteggio: i === 1, stilePunto: ['circle', 'rect', 'triangle'][i], soloPunti: !F.METODI[s.metodo].continuo, segmenti: sr.segmenti });
    }
    if (serie.length) {
      const att = scenario();
      const chart = Gr.profilo($('cvConf'), { titolo: 'FS a confronto', etichettaX: 'FS [–]', yMax: zMax, xMin: 0, xMax: 3, cifre: 2, serie,
        falda: sel.length === 1 ? sel[0].zFalda : undefined, riferimentiX: [{ x: 1, etichetta: 'FS = 1 (riferimento del modello)' }] });
      S.grafici.push({ id: 'confronto', titolo: 'FS a confronto', chart });
      const falde = [...new Set(sel.map(s => s.zFalda))];
      $('notaConf').textContent = (fuori ? fuori + ' valori FS > 3 non visibili (fuori scala). ' : '') + 'Falde: ' + sel.map(s => s.nome + ' ' + fmt(s.zFalda) + ' m').join('; ') + '.' + (att ? '' : '');
      if (falde.length === 1) $('notaConf').textContent += ' Linea tratteggiata blu: falda comune.';
      if (falde.length === 1) { chart.options.plugins.linee.falda = falde[0]; chart.update('none'); }
      $('pngConf').addEventListener('click', () => scarica(Gr.png(chart), nomeFile('confronto-FS', 'png'), true));
    } else {
      $('notaConf').textContent = 'Nessuno scenario calcolato e aggiornato tra quelli selezionati.';
    }
  }

  // ---------------------------------------------------------------------------
  // Avvisi e assunzioni
  // ---------------------------------------------------------------------------
  function renderAvvisi() {
    const box = $('pan-avvisi');
    const pv = prova(), sc = scenario(), r = sc && risultatoDi(sc);
    let h = '';
    if (!r) { box.innerHTML = '<div class="empty">Nessun risultato: premi «Calcola».</div>'; return; }
    if (statoRisultato(sc) !== 'aggiornato') h += '<div class="alert alert-warn">Risultati non aggiornati rispetto agli input: ricalcolare.</div>';
    if (r.stato !== 'calcolato') {
      h += '<div class="alert alert-danger"><span class="alert-title">Input non validi</span><ul>' + r.errori.map(e => '<li>' + esc(e.campo) + ': ' + esc(e.motivo) + '</li>').join('') + '</ul></div>';
      box.innerHTML = h; return;
    }
    const q = r.riepilogo;
    h += '<div class="section-title">Intervalli non calcolati</div>';
    h += q.intervalliNonCalcolati.length ? '<div class="table-scroll"><table class="data-table"><thead><tr><th scope="col">da<span class="u">[m]</span></th><th scope="col">a<span class="u">[m]</span></th><th scope="col">punti</th><th scope="col">stato</th><th scope="col" style="text-align:left;">motivo</th></tr></thead><tbody>' +
      q.intervalliNonCalcolati.map(i => '<tr><td>' + fmt(i.da) + '</td><td>' + fmt(i.a) + '</td><td>' + i.n + '</td><td><span class="stato-tag ' + i.stato + '">' + esc(F.ETICHETTE_STATI[i.stato]) + '</span></td><td class="txt">' + esc(i.motivo) + '</td></tr>').join('') + '</tbody></table></div>'
      : '<div class="hint">Nessuno.</div>';
    h += '<div class="hint" style="margin-top:6px;">Un intervallo non calcolato non è un intervallo «sicuro». Le profondità oltre ' + fmt(q.profonditaIndagata ? q.profonditaIndagata.a : 0) + ' m non sono indagate.</div>';
    h += '<div class="section-title">Avvisi del metodo e dell\'app</div>';
    h += q.avvisi.length ? '<div class="table-scroll"><table class="data-table"><thead><tr><th scope="col">codice</th><th scope="col">tipo</th><th scope="col">punti</th><th scope="col">z<span class="u">[m]</span></th><th scope="col" style="text-align:left;">messaggio</th></tr></thead><tbody>' +
      q.avvisi.map(a => '<tr><td>' + esc(a.codice) + '</td><td>' + esc(a.tipo) + '</td><td>' + a.n + '</td><td>' + fmt(a.zDa) + '–' + fmt(a.zA) + '</td><td class="txt">' + esc(a.messaggio) + '</td></tr>').join('') + '</tbody></table></div>'
      : '<div class="hint">Nessun avviso.</div>';
    h += '<div class="section-title">Assunzioni</div><ul>' + q.assunzioni.map(a => '<li>' + esc(a.descrizione) + (a.n ? ' <span class="hint">(' + a.n + ' punti)</span>' : '') + '</li>').join('') +
      (pv.tipo === 'CPTE' ? '' : '') + '</ul>';
    h += '<div class="section-title">Basi del metodo</div><ul><li>' + esc(q.notaFS) + '</li><li>' + esc(q.notaPL) + '</li>' +
      '<li>FS = 1 è il riferimento del modello, non una soglia normativa: le NTC 2018 non fissano un FS minimo, il margine è valutato e motivato dal progettista.</li>' +
      '<li>Indice del potenziale di liquefazione (IL) ed effetti post-liquefazione: non calcolati in questa versione.</li></ul>';
    box.innerHTML = h;
  }

  // ---------------------------------------------------------------------------
  // Importazione dati della prova
  // ---------------------------------------------------------------------------
  const IM = { modo: 'nuova', lettura: null };
  function apriImporta(modo) {
    IM.modo = modo; IM.toccato = false;
    const pv = prova();
    $('dlgTitolo').textContent = modo === 'nuova' ? 'Nuova prova' : 'Dati della prova «' + (pv ? pv.nome : '') + '»';
    $('imTipo').innerHTML = Object.keys(P.TIPI_PROVA).map(t => '<option value="' + t + '">' + esc(P.TIPI_PROVA[t].etichetta) + '</option>').join('');
    $('imTipo').disabled = modo !== 'nuova';
    if (modo === 'nuova') {
      $('imTipo').value = 'CPTU'; $('imNome').value = ''; $('imTesto').value = '';
    } else {
      $('imTipo').value = pv.tipo; $('imNome').value = pv.nome;
      // testo con i dati attuali (separatore ;, decimale ,), nelle unità dichiarate
      $('imTesto').value = pv.colonne.join(';') + '\n' + pv.dati.map(r => r.map(v => v === null ? '' : String(v).replace('.', ',')).join(';')).join('\n');
      $('imSep').value = ';'; $('imDec').value = ','; $('imInt').value = 'si';
    }
    $('imFile').value = '';
    IM.unita = modo === 'nuova' ? P.unitaPredefinite($('imTipo').value) : P.copia(pv.unita);
    leggiImporta(true);
    $('dlgImporta').showModal();
  }
  function leggiImporta(riproponi) {
    const tipo = $('imTipo').value;
    const sep = $('imSep').value === '\t' || $('imSep').value === '&#9;' ? '\t' : $('imSep').value;
    const div = I.dividi($('imTesto').value, sep);
    $('imSepRic').textContent = $('imSep').value === 'auto' && div.righe.length ? 'riconosciuto: ' + ({ ';': 'punto e virgola', ',': 'virgola', '\t': 'tabulazione' }[div.separatore]) : '';
    if (riproponi) $('imInt').value = I.haIntestazione(div.righe, $('imDec').value) ? 'si' : 'no';
    const conInt = $('imInt').value === 'si';
    const intestazione = conInt && div.righe.length ? div.righe[0] : null;
    if (riproponi || !IM.mappa || IM.tipo !== tipo) { IM.mappa = I.proponiColonne(intestazione, tipo); IM.tipo = tipo; }
    if (!IM.unita || riproponi === 'tipo') IM.unita = P.unitaPredefinite(tipo);
    const nCol = div.righe.reduce((m, r) => Math.max(m, r.length), 0);
    const nomiCol = Array.from({ length: nCol }, (_, j) => (intestazione && intestazione[j]) ? intestazione[j] : 'colonna ' + (j + 1));
    const grandezze = P.TIPI_PROVA[tipo].colonne.concat(P.TIPI_PROVA[tipo].facoltative);
    $('imMappa').innerHTML = grandezze.map(g => {
      const obbl = P.TIPI_PROVA[tipo].colonne.includes(g);
      const unita = Object.keys(P.UNITA[g].fattori);
      return '<div class="field"><label for="imM_' + g + '">' + esc(P.ETICHETTE_COLONNE[g]) + (obbl ? ' *' : ' (facoltativa)') + '</label>' +
        '<select id="imM_' + g + '" data-g="' + g + '"><option value="">— non presente —</option>' + nomiCol.map((n, j) => '<option value="' + j + '"' + (IM.mappa[g] === j ? ' selected' : '') + '>' + esc(n) + '</option>').join('') + '</select>' +
        '<select data-u="' + g + '" aria-label="unità di ' + esc(P.ETICHETTE_COLONNE[g]) + '" style="margin-top:4px;"' + (unita.length < 2 ? ' disabled' : '') + '>' + unita.map(u => '<option' + ((IM.unita[g] || P.UNITA[g].interna) === u ? ' selected' : '') + '>' + esc(u) + '</option>').join('') + '</select></div>';
    }).join('');
    $('imMappa').querySelectorAll('select[data-g]').forEach(el => el.addEventListener('change', () => { IM.mappa[el.dataset.g] = el.value === '' ? null : Number(el.value); IM.toccato = true; leggiImporta(false); }));
    $('imMappa').querySelectorAll('select[data-u]').forEach(el => el.addEventListener('change', () => { IM.unita[el.dataset.u] = el.value; leggiImporta(false); }));
    const ris = div.righe.length ? I.costruisciDati(div.righe, { tipo, mappa: IM.mappa, unita: IM.unita, decimale: $('imDec').value, saltaIntestazione: conInt }) : { ok: false, errori: [{ riga: null, colonna: '', motivo: 'nessun dato' }] };
    IM.lettura = ris;
    $('imErrori').innerHTML = ris.ok ? '' : '<div class="alert alert-danger"><span class="alert-title">Da correggere prima di applicare</span><ul>' +
      ris.errori.slice(0, 12).map(e => '<li>' + (e.riga ? 'riga ' + e.riga + ', ' : '') + esc(e.colonna) + ': ' + esc(e.motivo) + '</li>').join('') + (ris.errori.length > 12 ? '<li>… altri ' + (ris.errori.length - 12) + '</li>' : '') + '</ul></div>';
    if (ris.colonne) {
      $('imAnteprima').innerHTML = '<thead><tr>' + ris.colonne.map(c => '<th>' + esc(P.ETICHETTE_COLONNE[c]) + '<span class="u">[' + esc(ris.unita[c]) + ']</span></th>').join('') + '</tr></thead><tbody>' +
        ris.dati.slice(0, 10).map(r => '<tr>' + r.map(v => '<td>' + (v === null ? '–' : esc(String(v).replace('.', ','))) + '</td>').join('') + '</tr>').join('') + '</tbody>';
      $('imRiepilogo').textContent = ris.dati.length + ' righe lette' + (ris.ok ? '' : ' · ' + ris.errori.length + ' problemi');
    } else { $('imAnteprima').innerHTML = ''; $('imRiepilogo').textContent = ''; }
    $('imApplica').disabled = !ris.ok;
  }
  ['imSep', 'imDec', 'imInt'].forEach(id => $(id).addEventListener('change', () => leggiImporta(false)));
  $('imTipo').addEventListener('change', () => leggiImporta('tipo'));
  $('imTesto').addEventListener('input', () => leggiImporta(!IM.toccato));
  $('imFile').addEventListener('change', (e) => {
    const f = e.target.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => { $('imTesto').value = rd.result; $('imSep').value = 'auto'; leggiImporta(true); if (!$('imNome').value) $('imNome').value = f.name.replace(/\.[^.]+$/, ''); };
    rd.readAsText(f);
  });
  $('dlgImporta').querySelectorAll('[data-chiudi]').forEach(b => b.addEventListener('click', () => $('dlgImporta').close()));
  $('imApplica').addEventListener('click', () => {
    const ris = IM.lettura; if (!ris || !ris.ok) return;
    let pv;
    if (IM.modo === 'nuova') {
      pv = P.nuovaProva($('imTipo').value, $('imNome').value.trim() || null);
      S.pr.prove.push(pv); S.pr.provaAttiva = pv.id;
      const s = P.nuovoScenario(pv, null, S.pr.scenari.length);
      S.pr.scenari.push(s); S.pr.scenarioAttivo = s.id;
    } else pv = prova();
    pv.colonne = ris.colonne; pv.dati = ris.dati; pv.unita = ris.unita;
    if ($('imNome').value.trim()) pv.nome = $('imNome').value.trim();
    pv.esempio = false;
    $('dlgImporta').close();
    S.selezione = null;
    renderTutto();
  });
  $('btnNuovaProva').addEventListener('click', () => apriImporta('nuova'));
  $('btnDatiProva').addEventListener('click', () => apriImporta('sostituisci'));

  // ---------------------------------------------------------------------------
  // Progetto: nuovo, esempio, apri, salva
  // ---------------------------------------------------------------------------
  const vuoto = () => S.pr.prove.length === 0 && !S.pr.progetto.titolo;
  $('btnNuovo').addEventListener('click', () => {
    if (!vuoto() && !confirm('Iniziare un nuovo progetto? Le modifiche non salvate andranno perse.')) return;
    S.pr = P.nuovoProgetto(); S.confronto = []; S.selezione = null; S.pannelli = null; renderTutto();
  });
  $('btnEsempio').addEventListener('click', () => {
    if (!vuoto() && !confirm('Aprire l\'esempio sintetico? Le modifiche non salvate andranno perse.')) return;
    S.pr = E.progettoEsempio(); S.confronto = []; S.selezione = null; S.pannelli = null; renderTutto();
  });
  $('btnApri').addEventListener('click', () => $('fileApri').click());
  $('fileApri').addEventListener('change', (e) => {
    const f = e.target.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      const esito = P.apriProgetto(rd.result);
      if (!esito.ok) { alert('File non valido:\n' + esito.errori.slice(0, 10).map(x => '• ' + x.campo + ': ' + x.motivo).join('\n')); return; }
      S.pr = esito.progetto; S.confronto = []; S.selezione = null; S.pannelli = null; renderTutto();
    };
    rd.readAsText(f);
    e.target.value = '';
  });
  $('btnSalva').addEventListener('click', () => {
    const blob = new Blob([P.salvaProgetto(S.pr)], { type: 'application/json' });
    scarica(URL.createObjectURL(blob), nomeFile('progetto', 'json'));
  });
  $('btnCsv').addEventListener('click', () => {
    const sc = scenario();
    if (!sc || statoRisultato(sc) !== 'aggiornato' || risultatoDi(sc).stato !== 'calcolato') { alert('Calcola lo scenario attivo prima di esportare: i risultati devono essere aggiornati.'); return; }
    const csv = X.csvRisultati(S.pr, prova(), sc, risultatoDi(sc));
    scarica(URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })), nomeFile('risultati-' + sc.nome, 'csv'));
  });

  function nomeFile(base, est) {
    const t = (S.pr.progetto.titolo || 'liquisite') + '-' + base;
    return t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) + '.' + est;
  }
  function scarica(url, nome, dataUrl) {
    const a = document.createElement('a'); a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove();
    if (!dataUrl) setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  // ---------------------------------------------------------------------------
  // Stampa
  // ---------------------------------------------------------------------------
  $('btnStampa').addEventListener('click', () => {
    const sc = scenario();
    if (!sc || statoRisultato(sc) !== 'aggiornato' || risultatoDi(sc).stato !== 'calcolato') { alert('Calcola lo scenario attivo prima di stampare: i risultati devono essere aggiornati.'); return; }
    if (S.tab !== 'profili') mostraTab('profili');
    preparaStampa();
    setTimeout(() => window.print(), 50);
  });

  function preparaStampa() {
    const pv = prova(), sc = scenario(), r = risultatoDi(sc), q = r.riepilogo, par = pv.parametri || {};
    const riga = (k, v) => '<tr><th>' + k + '</th><td>' + v + '</td></tr>';
    let parProva = '';
    if (pv.tipo === 'SPT') parProva = 'CE ' + fmt(par.CE) + '; CB ' + fmt(par.CB) + '; ' + (par.senzaRivestimento ? 'campionatore senza rivestimento' : 'CS ' + fmt(par.CS)) + '; sporgenza aste ' + fmt(par.sporgenza) + ' m';
    else if (pv.tipo === 'CPTU') parProva = 'rapporto d\'area ar ' + (isNum(par.ar) ? fmt(par.ar) : 'non indicato (0,8 predefinito)');
    else if (pv.tipo === 'CPTE') parProva = 'qt = qc (nessuna misura di u)';
    let opz = '';
    if (sc.metodo === 'bi2014Cpt') opz = 'soglia Ic ' + fmt(sc.opzioni.IcSoglia) + '; CFC ' + fmt(sc.opzioni.CFC);
    if (sc.metodo === 'cetin2018Spt' || sc.metodo === 'kayen2013Vs') opz = 'V*s,12 ' + fmt(sc.opzioni.Vs12, 0) + ' m/s';
    let h = '<div class="st-testata"><div class="st-titolo">GeoHub-LiquiSite – Verifica a liquefazione</div>' +
      '<div class="st-norma">Metodi semplificati · NTC 2018 §7.11.3.4 · Circolare 21/01/2019 n. 7, C7.11.3.4</div></div>';
    h += '<div class="st-h">1. Dati</div><table class="st-tab"><tbody>' +
      riga('Progetto', esc(S.pr.progetto.titolo || '—')) + riga('Sito', esc(S.pr.progetto.sito || '—')) +
      (S.pr.progetto.autore ? riga('Autore', esc(S.pr.progetto.autore)) : '') +
      riga('Prova', esc(pv.nome) + ' – ' + esc(P.TIPI_PROVA[pv.tipo].etichetta) + (pv.esempio ? ' – <b>ESEMPIO SINTETICO, dati inventati</b>' : '')) +
      riga('Provenienza dei dati', esc(pv.provenienza || '—')) +
      riga('Parametri della prova', esc(parProva || '—')) +
      riga('Scenario', esc(sc.nome)) + riga('Metodo', esc(P.NOMI_METODI[sc.metodo]) + (opz ? ' · ' + esc(opz) : '')) +
      riga('Magnitudo Mw', fmt(sc.Mw)) + riga('amax in superficie', fmt(sc.amax, 3) + ' g') + riga('Falda di verifica', fmt(sc.zFalda) + ' m dal p.c.') +
      (sc.note ? riga('Note e fonti dei parametri', esc(sc.note)) : '') + '</tbody></table>';
    h += '<table class="st-tab num"><thead><tr><th>da [m]</th><th>a [m]</th><th>γ [kN/m³]</th><th>γsat [kN/m³]</th><th>FC [%]</th><th>descrizione</th></tr></thead><tbody>' +
      sc.strati.map(s => '<tr><td>' + fmt(s.da) + '</td><td>' + fmt(s.a) + '</td><td>' + fmt(s.gamma, 1) + '</td><td>' + fmt(s.gammaSat, 1) + '</td><td>' + (isNum(s.FC) ? fmt(s.FC, 0) : '–') + '</td><td style="text-align:left;">' + esc(s.descrizione || '') + '</td></tr>').join('') + '</tbody></table>';
    h += '<div class="st-h">2. Riepilogo</div><table class="st-tab"><tbody>' +
      riga('Profondità indagata', q.profonditaIndagata ? fmt(q.profonditaIndagata.da) + ' – ' + fmt(q.profonditaIndagata.a) + ' m' : '–') +
      riga('Estensione analizzata', q.estensioneAnalizzata ? fmt(q.estensioneAnalizzata.da) + ' – ' + fmt(q.estensioneAnalizzata.a) + ' m' : '–') +
      riga('Punti calcolati', (q.conteggi.calcolato || 0) + ' su ' + q.punti) +
      riga('FS minimo calcolato', q.fsMin ? fmt(q.fsMin.FS) + ' a z = ' + fmt(q.fsMin.z) + ' m' : '–') +
      riga('Intervalli non calcolati', q.intervalliNonCalcolati.length ? q.intervalliNonCalcolati.map(i => fmt(i.da) + '–' + fmt(i.a) + ' m: ' + esc(F.ETICHETTE_STATI[i.stato]) + (i.codice ? ' (' + esc(i.codice) + ')' : '')).join('; ') : 'nessuno') +
      '</tbody></table><p class="st-nota">Il FS minimo non descrive da solo la risposta del sito. FS = 1 è il riferimento del modello; le NTC 2018 non fissano un valore minimo del fattore di sicurezza: l\'adeguatezza del margine è valutata e motivata dal progettista. ' + esc(q.notaFS) + ' ' + esc(q.notaPL) + '</p>';
    h += '<div class="st-h st-pagina">3. Profili</div><div class="st-grafici">' + S.grafici.filter(g => g.cfg).map(g => '<figure><img alt="' + esc(g.titolo) + '" src="' + Gr.immagineStampa(g.cfg) + '"><figcaption>' + esc(g.titolo) + ($('nota-' + g.id) && $('nota-' + g.id).textContent ? ' – ' + esc($('nota-' + g.id).textContent) : '') + '</figcaption></figure>').join('') + '</div>' +
      '<p class="st-nota">Linea tratteggiata blu: falda di verifica; linee grigie: limiti degli strati. CSR tratteggiata, CRR continua. ' + (F.METODI[sc.metodo].continuo ? 'Le linee si interrompono dove il punto non è calcolato o mancano dati.' : 'SPT: risultati alle profondità delle prove, non uniti.') + '</p>';
    h += '<div class="st-h">4. Avvisi, assunzioni e limiti</div><ul class="st-lista">' +
      q.avvisi.map(a => '<li><b>' + esc(a.codice) + '</b> (' + a.n + ' punti, z ' + fmt(a.zDa) + '–' + fmt(a.zA) + ' m): ' + esc(a.messaggio) + '</li>').join('') +
      q.assunzioni.map(a => '<li>Assunzione: ' + esc(a.descrizione) + (a.n ? ' (' + a.n + ' punti)' : '') + '</li>').join('') +
      '<li>Profondità oltre ' + fmt(q.profonditaIndagata ? q.profonditaIndagata.a : 0) + ' m non indagate; un intervallo non calcolato non è un intervallo sicuro.</li>' +
      '<li>Indice del potenziale di liquefazione ed effetti post-liquefazione: non calcolati in questa versione.</li></ul>';
    h += '<div class="st-piede"><span>GeoHub-LiquiSite · motore ' + esc(r.versioneMotore) + ' · calcolato il ' + esc(new Date(r.calcolatoIl).toLocaleString('it-IT')) + ' · firma input ' + esc(r.firma) + '</span><span>Basato su LiquiSite di Fabio Duronio, geologo</span></div>';
    $('stampa').innerHTML = h;
  }

  // ---------------------------------------------------------------------------
  function renderTutto() {
    $('topVersione').textContent = 'motore ' + L.VERSIONE_MOTORE;
    renderProgetto(); renderProva(); renderScenario(); renderStrati(); renderStato(); renderRisultati();
  }

  window.LiquiUI = { stato: S, renderTutto, calcola, statoRisultato };
  renderTutto();
})();
