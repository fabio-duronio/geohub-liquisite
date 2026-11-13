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
    X = window.LiquiEsporta, E = window.LiquiEsempio, Gr = window.LiquiGrafici, EX = window.LiquiEsclusione;
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
    grafici: [],
    esclSel: null    // strato selezionato nella verifica preliminare
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
    if (t === '') { input.removeAttribute('aria-invalid'); input.removeAttribute('title'); return null; }
    const ris = I.numero(t, t.includes(',') ? ',' : '.');
    if (ris.errore) { input.setAttribute('aria-invalid', 'true'); input.title = 'Inserisci un numero: es. 18,5 oppure 18.5, senza separatori delle migliaia.'; return NaN; }
    input.removeAttribute('aria-invalid'); input.removeAttribute('title');
    return ris.valore;
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
      h += '<div class="alert alert-warn">Inserire N della prova SPT originale, non N60 né (N1)60 già corretti. Il motore applica le correzioni indicate sotto. I colpi DPSH non sono N SPT.</div><div class="group-label">Attrezzatura SPT</div>' +
        '<div class="field-row"><div class="field"><label for="pvCE">CE = ER / 60 (SPT grezzo)</label><input type="text" inputmode="decimal" step="0.01" id="pvCE" value="' + (par.CE ?? '') + '"><div class="hint">ERm/60 %</div></div>' +
        '<div class="field"><label for="pvSporg">Sporgenza aste [m]</label><input type="text" inputmode="decimal" step="0.1" id="pvSporg" value="' + (par.sporgenza ?? '') + '"></div></div>' +
        '<div class="field-row"><div class="field"><label for="pvCB">CB (diametro foro)</label><input type="text" inputmode="decimal" step="0.01" id="pvCB" value="' + (par.CB ?? '') + '"></div>' +
        '<div class="field"><label for="pvCS">CS (campionatore)</label><input type="text" inputmode="decimal" step="0.01" id="pvCS" value="' + (par.CS ?? '') + '"' + (par.senzaRivestimento ? ' disabled' : '') + '></div></div>' +
        '<div class="checkline"><input type="checkbox" id="pvSenzaRiv"' + (par.senzaRivestimento ? ' checked' : '') + '><label for="pvSenzaRiv">Campionatore senza rivestimento (solo Cetin 2018: CS calcolato)</label></div>';
    } else if (pv.tipo === 'CPTU') {
      h += '<div class="field"><label for="pvAr">Rapporto d\'area a<sub>r</sub></label><input type="text" inputmode="decimal" step="0.01" id="pvAr" value="' + (par.ar ?? '') + '"><div class="hint">Vuoto: il motore usa 0,8 e lo segnala come assunzione.</div></div>';
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
    h += '<div class="field-row"><div class="field"><label for="scMw">Magnitudo M<sub>w</sub></label><input type="text" inputmode="decimal" step="0.01" id="scMw" value="' + (sc.Mw ?? '') + '"></div>' +
      '<div class="field"><label for="scAmax">a<sub>max</sub> in superficie [g]</label><input type="text" inputmode="decimal" step="0.001" min="0" id="scAmax" value="' + (sc.amax ?? '') + '"></div></div>';
    h += '<div class="hint" style="margin:-4px 0 10px;">Consulta <a href="https://fabio-duronio.github.io/geohub-sismasite/" target="_blank" rel="noopener noreferrer">GeoHub-SismaSite</a> o le <a href="https://esse1-gis.mi.ingv.it/" target="_blank" rel="noopener noreferrer">mappe INGV MPS04-S1 ↗</a>. Inserisci a<sub>max</sub> in superficie: il valore di pericolosità di base non coincide automaticamente con quello di sito. Documenta fonte, probabilità/tempo di ritorno e trattamento degli effetti locali nelle note. Nessuna importazione automatica.</div>';
    if (sc.metodo === 'cetin2018Spt' || sc.metodo === 'kayen2013Vs') {
      h += '<div class="field"><label for="scVs12">V*<sub>s,12</sub> [m/s]</label><input type="text" inputmode="decimal" step="1" id="scVs12" value="' + (sc.opzioni.Vs12 ?? '') + '"><div class="hint">Vs media nei primi 12 m, usata nel coefficiente r<sub>d</sub> del metodo.</div></div>';
    }
    if (sc.metodo === 'bi2014Cpt') {
      h += '<div class="field-row"><div class="field"><label for="scIc">Soglia di I<sub>c</sub></label><input type="text" inputmode="decimal" step="0.05" id="scIc" value="' + (sc.opzioni.IcSoglia ?? '') + '"><div class="hint">2,6; 2,4–2,8 per sensibilità</div></div>' +
        '<div class="field"><label for="scCfc">C<sub>FC</sub></label><input type="text" inputmode="decimal" step="0.01" id="scCfc" value="' + (sc.opzioni.CFC ?? '') + '"><div class="hint">0 senza taratura locale</div></div></div>';
    }
    h += '<div class="field"><label for="scFsRif">FS di riferimento</label><input type="text" inputmode="decimal" step="0.05" id="scFsRif" value="' + (sc.opzioni.FSrif ?? '') + '"><div class="hint">1,25: valore raccomandato da EN 1998-5, § 4.1.4. Le NTC 2018 non fissano un minimo: il margine è valutato e motivato dal progettista.</div></div>';
    h += '<div class="field"><label for="scNote">Note e fonti dei parametri</label><textarea id="scNote">' + esc(sc.note) + '</textarea></div>';
    box.innerHTML = h;
    $('sumScenario').textContent = sc.nome;

    $('scNome').addEventListener('input', (e) => { sc.nome = e.target.value; aggiornaEtichette(); });
    $('scNote').addEventListener('input', (e) => { sc.note = e.target.value; });
    $('scMetodo').addEventListener('change', (e) => { sc.metodo = e.target.value; S.pannelli = null; renderScenario(); inputCambiato(); renderStrati(); });
    const num = (id, set) => { const el = $(id); if (el) el.addEventListener('input', () => { set(leggiNumero(el)); inputCambiato(); }); };
    num('scMw', v => { sc.Mw = v; }); num('scAmax', v => { sc.amax = v; });
    num('scVs12', v => { sc.opzioni.Vs12 = v; }); num('scIc', v => { sc.opzioni.IcSoglia = v; }); num('scCfc', v => { sc.opzioni.CFC = v; }); const elRif = $('scFsRif');
    if (elRif) elRif.addEventListener('input', () => {
      const v = leggiNumero(elRif), valido = v === null || (isNum(v) && v >= 1 && v <= 3);
      elRif.setAttribute('aria-invalid', valido ? 'false' : 'true');
      if (valido) { sc.opzioni.FSrif = v; renderStato(); renderRisultati(); }
      else sc.opzioni.FSrif = v;
    });
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
      ['da', 'a', 'gamma', 'gammaSat', 'FC'].map(k => '<td><input type="text" inputmode="decimal" step="0.1" data-k="' + k + '" aria-label="' + etich[k] + ', strato ' + (i + 1) + '" value="' + (s[k] ?? '') + '"></td>').join('') + '</tr>' +
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
  /** Riquadro dell'indice IL (Iwasaki): valore se completo, altrimenti intervallo IL_min–IL_max. */
  function testoCedimento(c) {
    if (!c || c.stato !== 'calcolato') return 'non disponibile';
    return 'S ' + (c.completo ? '= ' + fmt(c.Smin * 100, 1) : 'tra ' + fmt(c.Smin * 100, 1) + ' e ' + fmt(c.Smax * 100, 1)) + ' cm';
  }
  const fmtLSN = (v) => isFinite(v) ? fmt(v, 1) : 'non limitato';
  function testoLSN(c, breve) {
    const a = breve ? c.LSN10min : c.LSNmin, b = breve ? c.LSN10max : c.LSNmax;
    return Math.abs(b - a) < 1e-9 ? fmtLSN(a) : 'tra ' + fmtLSN(a) + ' e ' + fmtLSN(b);
  }
  function bloccoCedimenti(c, aggiornato) {
    if (!c || !aggiornato) return '';
    if (c.stato !== 'calcolato') return '<div class="blocco-il"><b>Cedimento post-sismico: non calcolabile</b></div>';
    return '<div class="blocco-il"><div><span class="eyebrow">CEDIMENTO POST-SISMICO DA CPT · ZHANG ET AL. 2002 · 0–20 m</span>' +
      '<div class="il-valore num">' + esc(testoCedimento(c)) + '</div><div class="num">LSN ' + esc(testoLSN(c)) + ' · 0–10 m: ' + esc(testoLSN(c, true)) + '</div></div>' +
      '<span>Stima della deformazione volumetrica di riconsolidazione su piano campagna sub-orizzontale, senza spostamenti laterali; gli autori la indicano per progetti a rischio basso o medio e come stima preliminare per gli altri. ' +
      (c.completo ? '' : 'Copertura incompleta: ' + fmt(c.spessori.ignoto, 2) + ' m senza risultato, con contributo nullo nel valore inferiore e deformazione limite (' + fmt(c.epsLimite, 2) + ' %) nel superiore. ') +
      c.avvisi.map(a => esc(a.messaggio)).join(' ') + ' LSN senza classi: il giudizio resta del progettista.</span></div>';
  }

  function testoIL(ind) {
    if (!ind) return 'non disponibile';
    if (ind.stato !== 'calcolato') return 'non calcolabile: ' + (ind.errori || []).map(e => e.motivo).join('; ');
    return ind.completo ? fmt(ind.IL, 1) : 'tra ' + fmt(ind.ILmin, 1) + ' e ' + fmt(ind.ILmax, 1);
  }
  function bloccoIL(ind, aggiornato) {
    if (!ind || !aggiornato) return '';
    if (ind.stato !== 'calcolato') return '<div class="blocco-il"><b>Indice IL (Iwasaki): ' + esc(testoIL(ind)) + '</b></div>';
    const sp = ind.spessori;
    return '<div class="blocco-il"><div><span class="eyebrow">INDICE DEL POTENZIALE DI LIQUEFAZIONE · IWASAKI · 0–20 m</span>' +
      '<div class="il-valore num">IL ' + (ind.completo ? '= ' : '') + esc(testoIL(ind)) + '</div></div>' +
      '<span>' + (ind.completo ? 'Profilo coperto in 0–20 m.' : 'Copertura incompleta in 0–20 m: ' + fmt(sp.ignoto, 2) + ' m senza risultato (dati mancanti, non calcolati o non indagati): contributo nullo nel valore inferiore, massimo possibile nel superiore. Nessun tratto ignoto è considerato sicuro.') +
      ' Spessori: FS calcolato ' + fmt(sp.FS, 2) + ' m (di cui FS &lt; 1 ' + fmt(sp.liquefacibileFSmin1, 2) + ' m), sopra falda ' + fmt(sp.sopraFalda, 2) + ' m, esclusi per comportamento argilloso (Ic oltre soglia, FS N.A., nessun contributo) ' + fmt(sp.argilloso, 2) + ' m. Senza classi: il giudizio resta del progettista.</span></div>';
  }

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
        '<div class="hint">Il FS minimo non descrive da solo la risposta del sito: vedere profili, intervalli non calcolati e avvisi. FS di riferimento ' + fmt(F.fsRiferimento(sc)) + ' (EN 1998-5, § 4.1.4; le NTC 2018 non fissano un minimo e il margine è valutato e motivato dal progettista).</div>';
    } else if (r && r.stato !== 'calcolato') {
      kpi = '<div class="alert alert-danger"><span class="alert-title">Calcolo non eseguito: input non validi</span><ul>' + r.errori.map(e => '<li>' + esc(e.motivo) + '</li>').join('') + '</ul></div>';
    } else {
      kpi = '<div class="hint">' + (sc ? 'Imposta i parametri e premi «Calcola».' : 'Crea una prova e uno scenario, oppure apri l\'esempio sintetico.') + '</div>';
    }
    if (r && r.stato === 'calcolato') {
      const valide = r.righe.filter(x => x.stato === 'calcolato' && isNum(x.valori?.FS));
      const sotto = valide.filter(x => x.valori.FS < 1), rif = F.fsRiferimento(sc);
      const margine = valide.filter(x => x.valori.FS >= 1 && x.valori.FS < rif);
      const aggiornato = st === 'aggiornato';
      kpi += '<div class="lettura-esito ' + (!aggiornato ? 'esito-attesa' : sotto.length ? 'esito-critico' : margine.length ? 'esito-attesa' : 'esito-neutro') + '"><b>' +
        (!aggiornato ? 'Lettura sospesa: ricalcolare dopo la modifica degli input.' : !valide.length ? 'Nessun punto con FS valido: non è possibile leggere l’esito.' : sotto.length ? sotto.length + ' punti su ' + valide.length + ' calcolati hanno FS < 1' + (margine.length ? '; altri ' + margine.length + ' hanno FS tra 1 e ' + fmt(rif) + '.' : '.') : margine.length ? 'Nessun punto con FS < 1; ' + margine.length + ' punti su ' + valide.length + ' hanno FS tra 1 e ' + fmt(rif) + ' (margine inferiore al riferimento).' : 'Nessun punto calcolato presenta FS < ' + fmt(rif) + '.') +
        '</b><span>' + (!aggiornato ? '' : sotto.length ? 'In questi punti la domanda ciclica supera la resistenza stimata dal metodo. Consulta profondità e valori nella tabella.' : 'Questo dato non esclude problemi negli intervalli non calcolati o non investigati.') +
        ' Il conteggio riguarda le misure, non lo spessore degli strati né una probabilità di liquefazione del sito.</span></div>';
      kpi += bloccoIL(r.indiceIL, aggiornato);
      kpi += bloccoCedimenti(r.cedimenti, aggiornato);
    }
    box.innerHTML = crumb + kpi;
    const b = $('riepStato');
    b.innerHTML = st === 'aggiornato' ? (r.stato === 'calcolato' ? '<span class="badge badge-ok">risultati aggiornati</span>' : '<span class="badge badge-err">input non validi</span>')
      : st === 'non_aggiornato' ? '<span class="badge badge-stale">risultati non aggiornati</span>' : '<span class="badge badge-none">non calcolato</span>';
  }

  // ---------------------------------------------------------------------------
  // Schede
  // ---------------------------------------------------------------------------
  const TABS = ['esclusione', 'profili', 'tabelle', 'confronto', 'avvisi'];
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
    else if (S.tab === 'esclusione') renderEsclusione();
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

  function catalogoPannelli(pv, sc, r) {
    const cpt = pv.tipo === 'CPTE' || pv.tipo === 'CPTU', spt = pv.tipo === 'SPT';
    const p = [];
    const s = (chiave, nome, colore, sorgente = 'valori', tratteggio = false) => ({ chiave, nome, colore, sorgente, tratteggio });
    if (cpt) {
      p.push({ id: 'qc', titolo: 'qc (misurato)', etichettaX: 'qc [MPa]', serie: [s('qc', 'qc', COL.ink, 'ingresso')], def: true, cifre: 2 });
      p.push({ id: 'fs', titolo: 'fs (misurato)', etichettaX: 'fs [kPa]', serie: [s('fs', 'fs', COL.ink, 'ingresso')], def: true, cifre: 1 });
      if (pv.tipo === 'CPTU') p.push({ id: 'u2', titolo: 'u2 (misurata)', etichettaX: 'u2 [kPa]', serie: [s('u2', 'u2', COL.ink, 'ingresso')], def: false, cifre: 1 });
      p.push({ id: 'Ic', titolo: 'Indice di comportamento', etichettaX: 'Ic [–]', serie: [s('Ic', 'Ic', COL.ink)], rif: isNum(sc.opzioni.IcSoglia) ? [{ x: sc.opzioni.IcSoglia, etichetta: 'soglia Ic ' + fmt(sc.opzioni.IcSoglia, 1) }] : [], xMin: 1, xMax: 4, def: true, cifre: 2,
        nota: 'Oltre la soglia il metodo non si applica (non è un\'esclusione normativa).' });
      p.push({ id: 'qc1N', titolo: 'Resistenza normalizzata', etichettaX: 'qc1N, qc1Ncs [–]', serie: [s('qc1N', 'qc1N', COL.grigio, 'valori', true), s('qc1Ncs', 'qc1Ncs', COL.ink)], def: true, cifre: 1 });
    } else if (spt) {
      p.push({ id: 'N', titolo: 'N SPT (misurato)', etichettaX: 'N [colpi/30 cm]', serie: [s('N', 'N', COL.ink, 'ingresso')], def: true, cifre: 0 });
      p.push({ id: 'N160', titolo: 'Resistenza normalizzata', etichettaX: '(N1)60, (N1)60cs [–]', serie: [s('N160', '(N1)60', COL.grigio, 'valori', true), s('N160cs', '(N1)60cs', COL.ink)], def: true, cifre: 1 });
    } else {
      p.push({ id: 'Vs', titolo: 'Vs (misurata) e Vs1', etichettaX: 'Vs, Vs1 [m/s]', serie: [s('Vs', 'Vs', COL.ink, 'ingresso'), s('Vs1', 'Vs1', COL.grigio, 'valori', true)], def: true, cifre: 0 });
    }
    const crr = sc.metodo === 'kayen2013Vs' ? 'CRR15' : 'CRR';
    p.push({ id: 'csrcrr', titolo: 'Domanda e resistenza', etichettaX: 'CSR, CRR [–]', serie: [s('CSR', 'CSR (sito)', '#bd3c3c', 'valori', true), s(crr, sc.metodo === 'kayen2013Vs' ? 'CRR PL 15 % (sito)' : 'CRR (sito)', '#218273')], def: true, cifre: 3, xMin: 0 });
    p.push({ id: 'FS', titolo: 'Fattore di sicurezza', etichettaX: 'FS [–]', serie: [s('FS', 'FS', COL.blu)], rif: [{ x: 1, etichetta: 'FS = 1' }, { x: F.fsRiferimento(sc), etichetta: 'FS rif ' + fmt(F.fsRiferimento(sc)) }], xMin: 0, xMax: 3, def: true, cifre: 2, nota: 'Rosso: FS < 1; ambra: FS tra 1 e il riferimento ' + fmt(F.fsRiferimento(sc)) + '; verde tenue: oltre. Confronto puntuale, non giudizio di sicurezza del sito.' });
    if (sc.metodo !== 'bi2014Spt') p.push({ id: 'PL', titolo: 'Probabilità PL', etichettaX: 'PL [–]', serie: [s('PL', 'PL', COL.ink)], xMin: 0, xMax: 1, def: false, cifre: 3, nota: F.METODI[sc.metodo].notaPL });
    const ind = r && r.indiceIL;
    if (ind && ind.stato === 'calcolato') {
      const lo = ind.curva.map(c => ({ x: c.ILmin, y: c.z })), hi = ind.curva.map(c => ({ x: c.ILmax, y: c.z }));
      const dir = [{ nome: 'IL cumulato (tratti senza risultato: contributo nullo)', colore: COL.blu, tratteggio: false, segmenti: [lo], punti: lo }];
      if (!ind.completo) dir.push({ nome: 'limite superiore (tratti senza risultato: contributo massimo)', colore: COL.grigio, tratteggio: true, segmenti: [hi], punti: hi });
      p.push({ id: 'IL', titolo: 'Indice IL cumulato', etichettaX: 'IL cumulato [–]', serieDirette: dir, xMin: 0, def: false, cifre: 2,
        nota: 'Iwasaki, 0–20 m, senza classi. ' + (ind.completo ? 'IL = ' + fmt(ind.IL, 1) + '.' : 'Copertura incompleta: IL tra ' + fmt(ind.ILmin, 1) + ' e ' + fmt(ind.ILmax, 1) + ' (valori a 20 m).') });
    }
    const ced = r && r.cedimenti;
    if (ced && ced.stato === 'calcolato') {
      // εv per punto: solo i tratti calcolati, interrotti dove manca il risultato
      const seg = []; let cur = [];
      for (const t of ced.tratti) {
        if (t.categoria === 'FS') cur.push({ x: t.epsMin, y: t.zPunto });
        else if (cur.length) { seg.push(cur); cur = []; }
      }
      if (cur.length) seg.push(cur);
      p.push({ id: 'epsv', titolo: 'Deformazione volumetrica', etichettaX: 'εv [%]', serieDirette: [{ nome: 'εv post-liquefazione', colore: COL.ink, tratteggio: false, segmenti: seg, punti: seg.flat() }],
        xMin: 0, def: false, cifre: 2, nota: 'Zhang et al. (2002), interpolazione lineare in FS; Ic oltre soglia e sopra falda: εv = 0.' });
      const lo = [{ x: 0, y: 0 }].concat(ced.tratti.map(t => ({ x: t.Smin * 100, y: t.a }))), hi = [{ x: 0, y: 0 }].concat(ced.tratti.map(t => ({ x: t.Smax * 100, y: t.a })));
      const dir = [{ nome: 'cedimento cumulato (tratti senza risultato: contributo nullo)', colore: COL.blu, tratteggio: false, segmenti: [lo], punti: lo }];
      if (!ced.completo) dir.push({ nome: 'limite superiore (tratti senza risultato: deformazione limite)', colore: COL.grigio, tratteggio: true, segmenti: [hi], punti: hi });
      p.push({ id: 'sced', titolo: 'Cedimento cumulato', etichettaX: 'S [cm]', serieDirette: dir, xMin: 0, def: false, cifre: 1,
        nota: 'Dal piano campagna verso il basso. ' + testoCedimento(ced) + ' · LSN ' + testoLSN(ced) + '.' });
    }
    p.push({ id: 'tens', titolo: 'Tensioni', etichettaX: 'σ [kPa]', serie: [s('sv', 'σv', COL.ink, 'tensioni'), s('sve', 'σ\'v', COL.blu, 'tensioni', true), s('u', 'u0', COL.grigio, 'tensioni')], def: false, cifre: 1, xMin: 0 });
    if (sc.metodo === 'cetin2018Spt') p.push({ id: 'coef', titolo: 'rd, Kσ, KMw', etichettaX: '[–]', serie: [s('rd', 'rd', COL.ink), s('Ksigma', 'Kσ', COL.blu, 'valori', true), s('KMw', 'KMw', COL.grigio)], def: false, cifre: 3 });
    else if (sc.metodo === 'kayen2013Vs') p.push({ id: 'coef', titolo: 'rd', etichettaX: 'rd [–]', serie: [s('rd', 'rd', COL.ink)], def: false, cifre: 3 });
    else p.push({ id: 'coef', titolo: 'rd, Kσ, MSF', etichettaX: '[–]', serie: [s('rd', 'rd', COL.ink), s('Ksigma', 'Kσ', COL.blu, 'valori', true), s('MSF', 'MSF', COL.grigio)], def: false, cifre: 3 });
    return p;
  }

  function renderProfili() {
    const box = $('pan-profili');
    const pv = prova(), sc = scenario(), r = sc && risultatoDi(sc);
    if (!pv || !sc) { box.innerHTML = '<div class="empty welcome"><span class="eyebrow">IL TUO SPAZIO DI ANALISI</span><h2>Una tavola, tutto il profilo.</h2><p>Carica una prova CPT/CPTu, SPT o Vs, definisci lo scenario e confronta i risultati in profondità.</p><div class="btn-row"><button class="btn btn-primary" id="welcomeSample">Esplora l’esempio sintetico</button><button class="btn" id="welcomeImport">Importa una prova</button></div><p class="hint">L’esempio è dimostrativo: non rappresenta un sito reale.</p></div>'; $('welcomeSample').onclick = () => { $('btnEsempio').click(); $('btnCalcola').click(); }; $('welcomeImport').onclick = () => $('btnNuovaProva').click(); return; }
    if (!r || r.stato !== 'calcolato') { box.innerHTML = '<div class="empty">' + (r ? 'Il calcolo non è stato eseguito: correggi gli input (vedi riepilogo).' : 'Premi «Calcola scenario» per ottenere i profili.') + '</div>'; return; }
    const cat = catalogoPannelli(pv, sc, r);
    const chiave = pv.tipo + '|' + sc.metodo;
    if (!S.pannelli || S.pannelli.chiave !== chiave) S.pannelli = { chiave, preset: 'verifica', id: new Set(cat.filter(c => ['Ic','qc1N','N','N160','Vs','csrcrr','FS'].includes(c.id)).map(c => c.id)) };
    const continuo = F.METODI[sc.metodo].continuo;
    const presets = { verifica: ['Ic','qc1N','N','N160','Vs','csrcrr','FS'], dati: ['qc','fs','u2','N','Vs','Ic'], tensioni: ['tens','coef'], probabilita: ['FS','PL','IL'], cedimenti: ['FS','epsv','sced'] };
    let h = '<div class="sheet-tools"><div class="subtabs" role="group" aria-label="Tavola">' +
      [['verifica','Verifica'],['dati','Dati e interpretazione'],['tensioni','Tensioni e coefficienti'],['probabilita','FS, PL e IL'],['cedimenti','Cedimenti e LSN']].filter(([k]) => (k !== 'probabilita' || cat.some(c=>c.id==='PL' || c.id==='IL')) && (k !== 'cedimenti' || cat.some(c => c.id === 'epsv'))).map(([k,label]) =>
      '<button data-preset="'+k+'" aria-pressed="'+(S.pannelli.preset===k)+'">'+label+'</button>').join('') +
      '</div><details class="panel-picker"><summary>Personalizza pannelli</summary><div class="chart-toolbar">' + cat.map(c =>
      '<label><input type="checkbox" data-pannello="' + c.id + '"' + (S.pannelli.id.has(c.id) ? ' checked' : '') + '> ' + esc(c.titolo) + '</label>').join('') + '</div></details></div>';
    h += '<div class="sheet-heading"><div><span class="eyebrow">TAVOLA DI ANALISI / PROFILO VERTICALE</span><h2>' + esc(pv.nome) + '</h2></div><div class="sheet-meta">M<sub>w</sub> <b>'+fmt(sc.Mw)+'</b> &nbsp; a<sub>max</sub> <b>'+fmt(sc.amax,3)+' g</b> &nbsp; Falda <b>'+fmt(sc.zFalda)+' m</b><br>'+esc(P.NOMI_METODI[sc.metodo])+'</div></div>';
    h += '<div class="profiles" id="profili" style="--tracks:'+Math.max(1,Math.min(4,cat.filter(c => S.pannelli.id.has(c.id)).length))+'">' + cat.filter(c => S.pannelli.id.has(c.id)).map((c,i) =>
      '<div class="profile" data-track="'+c.id+'"><div class="profile-head"><span class="track-no">'+String(i+1).padStart(2,'0')+'</span><span>'+esc(c.titolo)+'</span><button class="btn-link" type="button" data-png="' + c.id + '" aria-label="Scarica PNG di ' + esc(c.titolo) + '">PNG</button></div>' +
      '<div class="chart-wrap"><canvas id="cv-' + c.id + '" role="img" aria-label="Profilo ' + esc(c.titolo) + '"></canvas><div class="stale-veil" data-velo hidden>Risultati non aggiornati</div></div>' +
      '<div class="profile-note" id="nota-' + c.id + '"></div></div>').join('') + '</div>';
    h += '<div class="legend-note"><span><span class="sw" style="color:#2f7dd6;border-top-style:dashed;"></span>falda di verifica</span>' +
      '<span><span class="sw" style="color:#aab8c8;"></span>limiti degli strati</span>' +
      '<span><span class="sw dash" style="color:#5f6b7a;"></span>riferimento</span>' +
      (continuo ? '<span>Le interruzioni non indicano sicurezza: consultare stati e avvisi.</span>' : '<span><span class="sw dot" style="color:#1e4e8c;"></span>SPT: punti discreti, non uniti.</span>') + '</div>';
    h += '<p class="scope-note">' + (sc.metodo === 'bi2014Cpt' ? 'Cedimento post-sismico da CPT (Zhang et al. 2002) e LSN nella tavola «Cedimenti e LSN»; spostamenti laterali non calcolati.' : 'Cedimenti post-sismici: calcolati solo con prove CPT; spostamenti laterali non calcolati.') + ' La probabilità PL, ove disponibile, è puntuale e non è l’indice IL.</p>';
    h += '<div class="sel-detail" id="dettaglioSel">Seleziona un punto su un grafico o una riga in tabella.</div>';
    if (sc.metodo === 'bi2014Cpt') h += '<div class="sbt-card"><div class="sbt-chart"><canvas id="cv-sbt" role="img" aria-label="Carta di comportamento CPT"></canvas></div>' +
      '<div class="sbt-side"><div class="section-title">Carta di comportamento</div>' + tabellaZoneSBT(r) + '<p class="hint">Strumento di lettura della prova, non entra nel calcolo. Zone 2–7 delimitate da Ic (Robertson e Wride 1998, Tab. 1, da Robertson 1990); Ic non si applica alle zone 1, 8 e 9, che non sono rappresentate. Q con l\'esponente n della procedura del metodo.</p>' +
      '<button class="btn-link" type="button" data-png="sbt">Scarica PNG</button></div></div>';
    box.innerHTML = h;

    const zMax = Math.max(Math.ceil((r.riepilogo.profonditaIndagata ? r.riepilogo.profonditaIndagata.a : 10) + 0.5), ...sc.strati.map(s => isNum(s.a) ? s.a : 0));
    const strati = [...new Set(sc.strati.flatMap(s => [s.da, s.a]).filter(z => isNum(z) && z > 0))];
    for (const c of cat.filter(c => S.pannelli.id.has(c.id))) {
      const serie = c.serieDirette ? c.serieDirette.map(x => ({ ...x, soloPunti: false })) : c.serie.map(x => {
        const sr = F.serie(r, x.chiave, x.sorgente);
        return { nome: x.nome, colore: x.colore, tratteggio: x.tratteggio, stilePunto: x.tratteggio ? 'rect' : 'circle', soloPunti: !continuo && x.sorgente !== 'tensioni', segmenti: sr.segmenti, punti: sr.punti };
      });
      const cfg = {
        titolo: c.titolo, etichettaX: c.etichettaX, yMax: zMax, falda: sc.zFalda, strati, riferimentiX: c.rif || [],
        xMin: c.xMin, xMax: c.xMax, cifre: c.cifre, serie, tipoPannello: c.id, sogliaIc: sc.opzioni.IcSoglia ?? 2.6, fsRif: F.fsRiferimento(sc)
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
    box.querySelectorAll('[data-preset]').forEach(el => el.onclick = () => { S.pannelli.preset = el.dataset.preset; S.pannelli.id = new Set(presets[el.dataset.preset].filter(id => cat.some(c => c.id === id))); renderRisultati(); });
    box.querySelectorAll('[data-pannello]').forEach(el => el.addEventListener('change', () => {
      S.pannelli.preset = 'custom';
      if (el.checked) S.pannelli.id.add(el.dataset.pannello); else S.pannelli.id.delete(el.dataset.pannello);
      renderRisultati();
    }));
    box.querySelectorAll('[data-png]').forEach(el => el.addEventListener('click', () => {
      const g = S.grafici.find(x => x.id === el.dataset.png);
      if (g) scarica(Gr.png(g.chart), nomeFile('profilo-' + g.id, 'png'), true);
    }));
    if (sc.metodo === 'bi2014Cpt' && $('cv-sbt')) {
      const chart = Gr.cartaSBT($('cv-sbt'), cfgSBT(r, sc));
      S.grafici.push({ id: 'sbt', titolo: 'Carta di comportamento CPT', chart });
    }
    aggiornaVeli();
    mostraDettaglio();
  }

  function cfgSBT(r, sc) {
    const punti = r.righe.filter(x => x.sbt).map(x => ({ Q: x.sbt.Q, F: x.sbt.F, Ic: x.sbt.Ic, z: x.z, indice: x.indice,
      gruppo: x.stato === 'calcolato' ? 'calcolato' : x.codice === 'IC_OLTRE_SOGLIA' ? 'escluso' : 'altro' }));
    const lim = F.ZONE_SBT.map(z => z.icA).filter(isFinite);
    const zone = F.ZONE_SBT.map(z => ({ zona: z.zona, icMedio: isFinite(z.icA) ? (z.icDa + z.icA) / 2 : z.icDa + 0.25 })).filter(z => z.zona !== 7);
    return { punti, limiti: lim, zone, soglia: sc.opzioni.IcSoglia ?? 2.6, onClick: (i) => seleziona(i) };
  }

  function tabellaZoneSBT(r) {
    const n = {}; let tot = 0;
    for (const x of r.righe) if (x.sbt && x.sbt.zona) { n[x.sbt.zona] = (n[x.sbt.zona] || 0) + 1; tot++; }
    return '<table class="data-table compact"><thead><tr><th>zona</th><th style="text-align:left">comportamento</th><th>Ic</th><th>punti</th></tr></thead><tbody>' +
      F.ZONE_SBT.map(z => '<tr><td>' + z.zona + '</td><td class="txt">' + esc(z.nome) + '</td><td>' + (!z.icDa ? '&lt; ' + fmt(z.icA) : !isFinite(z.icA) ? '&gt; ' + fmt(z.icDa) : fmt(z.icDa) + '–' + fmt(z.icA)) + '</td><td>' + (n[z.zona] || 0) + '</td></tr>').join('') +
      '</tbody></table><p class="hint">' + tot + ' letture rappresentate.</p>';
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
      else cols = ['stato', 'letturaFS'].concat(M.finali, sc.metodo === 'bi2014Cpt' ? ['epsV'] : [], ['motivo']);
      h += '<div class="table-scroll"><table class="data-table"><thead><tr>' + intest('z') + cols.map(k => {
        if (k === 'letturaFS') return '<th scope="col">Lettura del modello<span class="u">FS rispetto a 1 e al riferimento</span></th>';
        if (k === 'stato') return '<th scope="col">stato<span class="u">&nbsp;</span></th>';
        if (k === 'motivo') return '<th scope="col" style="text-align:left;">motivo / avvisi<span class="u">&nbsp;</span></th>';
        if (k === 'origineFC') return '<th scope="col" style="text-align:left;">origine FC<span class="u">&nbsp;</span></th>';
        return intest(k.startsWith('t:') ? k.slice(2) : k);
      }).join('') + '</tr></thead><tbody>' +
        r.righe.map(x => '<tr data-indice="' + x.indice + '" class="' + (S.selezione === x.indice ? 'hl ' : '') + (x.stato !== 'calcolato' ? 'muted' : '') + '"><td>' + fmt(x.z) + '</td>' + cols.map(k => {
          if (k === 'letturaFS') { const fs = F.valoreRisultato(x, 'FS'); return '<td class="txt">' + (fs === null ? (x.codice === 'IC_OLTRE_SOGLIA' ? 'FS N.A. · escluso per comportamento argilloso' : 'Non valutabile: vedere motivo') : '<span class="esito-chip ' + (fs < 1 ? 'esito-critico' : fs < F.fsRiferimento(sc) ? 'esito-attesa' : 'esito-neutro') + '">' + (fs < 1 ? 'FS < 1 · domanda > resistenza' : fs < F.fsRiferimento(sc) ? 'FS < ' + fmt(F.fsRiferimento(sc)) + ' · margine inferiore al riferimento' : 'FS ≥ ' + fmt(F.fsRiferimento(sc)) + ' · margine ≥ riferimento') + '</span>') + '</td>'; }
          if (k === 'stato') return '<td><span class="stato-tag ' + x.stato + '">' + esc(F.ETICHETTE_STATI[x.stato] || x.stato) + '</span></td>';
          if (k === 'motivo') return '<td class="txt" title="' + esc(x.motivo || '') + '">' + esc([x.codice ? (F.MOTIVI_BREVI[x.codice] || x.codice) : null, ...x.avvisi.map(a => a.codice)].filter(Boolean).join(' · ')) + '</td>';
          if (k === 'origineFC') return '<td class="txt" style="min-width:120px;">' + esc(x.origineFC || '–') + '</td>';
          if (k === 'FC') return '<td>' + fmt(x.FC, 1) + '</td>';
          if (k.startsWith('t:')) return '<td>' + (x.tensioni ? fmt(x.tensioni[k.slice(2)], 1) : '–') + '</td>';
          const v = F.valoreRisultato(x, k);
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
        falda: sel.length === 1 ? sel[0].zFalda : undefined, riferimentiX: [{ x: 1, etichetta: 'FS = 1' }].concat([...new Set(sel.map(s => F.fsRiferimento(s)))].map(v => ({ x: v, etichetta: 'FS rif ' + fmt(v) }))) });
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
  // Verifica preliminare — esclusione della verifica (NTC 2018 §7.11.3.4.2)
  // ---------------------------------------------------------------------------
  const ICONE_ESITO = {
    escluso: ['ok', '✓', 'criterio soddisfatto'], non_escluso: ['no', '✕', 'criterio non soddisfatto'],
    non_dimostrato: ['att', '!', 'esclusione non dimostrata'], non_pertinente: ['na', '—', 'non pertinente']
  };
  function iconaCriterio(c) {
    if (c.soddisfatto === true) return ICONE_ESITO.escluso;
    if (c.soddisfatto === false) return ICONE_ESITO.non_escluso;
    if (c.stato === 'non_pertinente' || c.stato === 'non_applicabile') return ICONE_ESITO.non_pertinente;
    return ICONE_ESITO.non_dimostrato;
  }
  const icona = (i) => '<span class="escl-ico escl-' + i[0] + '" title="' + esc(i[2]) + '" aria-label="' + esc(i[2]) + '">' + i[1] + '</span>';
  const siNo = (v) => v === true ? 'sì' : v === false ? 'no' : '';
  const sceltaSiNo = (id, v) => '<select id="' + id + '"><option value=""' + (v === null ? ' selected' : '') + '>da indicare</option><option value="si"' + (v === true ? ' selected' : '') +
    '>sì</option><option value="no"' + (v === false ? ' selected' : '') + '>no</option></select>';
  const leggiSiNo = (el) => el.value === 'si' ? true : el.value === 'no' ? false : null;

  function fusiDaMostrare(c4) {
    const tutti = { a: { nome: 'fuso (a), Uc < 3,5', dati: EX.FUSI.a_Uc_minore_3_5, colore: 'rgba(181,51,50,1)' },
      b: { nome: 'fuso (b), Uc > 3,5', dati: EX.FUSI.b_Uc_maggiore_3_5, colore: 'rgba(30,78,140,1)' } };
    const chiavi = c4 && c4.motore && c4.motore.confronti ? Object.keys(c4.motore.confronti) : ['a', 'b'];
    return chiavi.map(k => ({ nome: tutti[k].nome, sinistra: tutti[k].dati.sinistra, destra: tutti[k].dati.destra, colore: tutti[k].colore }));
  }

  function renderEsclusione() {
    const box = $('pan-esclusione');
    const pv = prova(), sc = scenario();
    if (!pv || !sc) { box.innerHTML = '<div class="empty">Crea una prova e uno scenario, oppure apri l\'esempio sintetico.</div>'; return; }
    const st = statoRisultato(sc), r = st === 'aggiornato' ? risultatoDi(sc) : null;
    const v = EX.valutaEsclusione(L, pv, sc, r && r.stato === 'calcolato' ? r : null);
    const dati = EX.datiEsclusione(sc);
    const pert = v.strati.filter(x => x.pertinente);
    if (S.esclSel === null || !v.strati[S.esclSel]) S.esclSel = pert.length ? pert[0].indice : (v.strati.length ? 0 : null);
    const sel = S.esclSel !== null ? v.strati[S.esclSel] : null;
    const classeEsito = v.esito.codice === 'omessa' ? 'esito-neutro' : v.esito.codice === 'parziale' ? 'esito-attesa' : 'esito-critico';

    let h = '<div class="sheet-heading"><div><span class="eyebrow">VERIFICA PRELIMINARE · NTC 2018 §7.11.3.4.2</span><h2>' + esc(sc.nome) + '</h2></div>' +
      '<div class="sheet-meta">' + esc(pv.nome) + ' · ' + esc(P.NOMI_METODI[sc.metodo]) + '</div></div>';
    h += '<div class="lettura-esito ' + classeEsito + '"><b>' + esc(v.esito.titolo) + '</b><span>' + esc(v.esito.testo) + ' ' +
      v.conteggi.criteriSoddisfatti + ' criteri di sito soddisfatti su 2 · strati saturi entro 20 m: ' + v.conteggi.stratiPertinenti +
      ' (esclusi ' + v.conteggi.stratiEsclusi + ', non esclusi ' + v.conteggi.stratiNonEsclusi + ', da completare ' + v.conteggi.stratiNonDimostrati + ').</span></div>';
    if (st !== 'aggiornato') h += '<div class="alert alert-warn">Risultati del calcolo ' + (st === 'assente' ? 'assenti' : 'non aggiornati') + ': il criterio 3 usa i valori normalizzati del metodo e resta sospeso fino al calcolo.</div>';

    h += '<div class="section-title">Dati di sito</div><div class="escl-sito">' +
      '<div class="field"><label>a<sub>max</sub> al p.c. in campo libero [g]</label><input type="text" value="' + (isNum(sc.amax) ? fmt(sc.amax, 3) : '') + '" disabled><div class="hint">dallo scenario</div></div>' +
      '<div class="field"><label for="exFalda">Falda media stagionale [m dal p.c.]</label><input type="text" inputmode="decimal" id="exFalda" value="' + (isNum(dati.faldaMediaStagionale) ? String(dati.faldaMediaStagionale).replace('.', ',') : '') + '"><div class="hint">può differire dalla falda di verifica (' + fmt(sc.zFalda) + ' m)</div></div>' +
      '<div class="field"><label for="exPc">Piano campagna sub-orizzontale</label>' + sceltaSiNo('exPc', dati.pcSubOrizzontale) + '</div>' +
      '<div class="field"><label for="exFond">Fondazioni superficiali</label>' + sceltaSiNo('exFond', dati.fondazioniSuperficiali) + '</div></div>';

    // albero dei criteri
    const c1 = v.criteri.c1, c2 = v.criteri.c2;
    let albero = '<div class="escl-albero"><div class="section-title">Criteri di esclusione</div><ul>' +
      '<li class="escl-voce">' + icona(iconaCriterio(c1)) + '<div><b>1 · Accelerazione massima</b><span>' + (isNum(c1.valore) ? 'a<sub>max</sub> = ' + fmt(c1.valore, 3) + ' g; soglia 0,1 g' : 'a<sub>max</sub> non indicata') + '</span></div></li>' +
      '<li class="escl-voce">' + icona(iconaCriterio(c2)) + '<div><b>2 · Falda profonda</b><span>' + (c2.stato === 'valutato' ? 'falda media stagionale ' + fmt(c2.valore) + ' m; soglia 15 m' +
        (c2.condizioni && (!c2.condizioni.pcSubOrizzontale || !c2.condizioni.fondazioniSuperficiali) ? '; condizioni su p.c. o fondazioni non soddisfatte' : '') : esc(c2.motivo || 'dati incompleti')) + '</span></div></li>' +
      '<li class="escl-gruppo"><b>3 e 4 · Depositi, per strato</b></li>';
    for (const x of v.strati) {
      const ic = ICONE_ESITO[x.esito];
      albero += '<li class="escl-voce escl-strato' + (x.indice === S.esclSel ? ' sel' : '') + '"><button type="button" data-escl-strato="' + x.indice + '">' + icona(ic) +
        '<div><b>' + fmt(x.da) + '–' + fmt(x.a) + ' m</b><span>' + esc(x.descrizione || 'strato ' + (x.indice + 1)) +
        (x.criteriEscludenti.length ? ' · criterio ' + x.criteriEscludenti.join(' e ') : '') + '</span></div></button></li>';
    }
    albero += '</ul><p class="hint">✓ soddisfatto · ✕ non soddisfatto · ! da completare o non dimostrato · — non pertinente (sopra falda di verifica o oltre 20 m)</p></div>';

    // dettaglio dello strato
    let dett = '<div class="escl-dettaglio">';
    if (!sel) dett += '<div class="empty">Nessuno strato nello scenario: definisci la stratigrafia.</div>';
    else {
      const c3 = sel.c3, c4 = sel.c4, m4 = c4.motore;
      dett += '<div class="section-title">Strato ' + fmt(sel.da) + '–' + fmt(sel.a) + ' m</div><p class="escl-desc">' + esc(sel.descrizione || '—') + (sel.pertinente ? '' : ' · <b>non pertinente</b>: sopra la falda di verifica o oltre 20 m') + '</p>';
      dett += '<div class="escl-blocco"><div class="escl-tit">' + icona(iconaCriterio(c3)) + ' <b>Criterio 3</b> · sabbie pulite con ' + (c3.grandezza ? esc(c3.grandezza) + ' > ' + c3.soglia : '(N1)60 > 30 o qc1N > 180') + '</div>' +
        '<div class="field"><label for="exSabbia">Strato costituito da sabbie pulite</label>' + sceltaSiNo('exSabbia', sel.dati.sabbiaPulita) + '<div class="hint">giudizio del geologo, da granulometria e descrizione</div></div>' +
        (isNum(c3.punti) ? '<p class="hint">Punti saturi nello strato: ' + c3.punti + (c3.mancanti ? ' (' + c3.mancanti + ' senza valore)' : '') + ' · minimo ' + esc(c3.grandezza) + ' = ' + fmt(c3.minimo, 1) + ' · oltre soglia: ' + c3.sopraSoglia + '. Normalizzazione: ' + esc(P.NOMI_METODI[sc.metodo]) + '.</p>' : '') +
        '<p class="escl-motivo">' + esc(c3.motivo || '') + '</p></div>';
      dett += '<div class="escl-blocco"><div class="escl-tit">' + icona(iconaCriterio(c4)) + ' <b>Criterio 4</b> · granulometria esterna ai fusi della Fig. 7.11.1</div>' +
        '<div class="field"><label for="exCampione">Campione</label><input type="text" id="exCampione" value="' + esc(sel.dati.campione) + '" placeholder="es. S1-C3, 6,0–6,5 m"></div>' +
        '<div class="field"><label for="exCurva">Curva granulometrica: una riga per setaccio, «diametro [mm]; passante [%]»</label><textarea id="exCurva" rows="7" spellcheck="false">' + esc(EX.testoCurva(sel.dati.curva)) + '</textarea><div class="hint" id="exCurvaErr"></div></div>';
      if (m4 && m4.stato !== 'input_non_valido') {
        dett += '<p class="hint">U<sub>c</sub> = ' + (isNum(m4.Uc) ? fmt(m4.Uc, 1) : 'non determinabile') + ' · D<sub>10</sub> = ' + (isNum(m4.D10) ? fmt(m4.D10, 4) + ' mm' : '–') + ' · D<sub>60</sub> = ' + (isNum(m4.D60) ? fmt(m4.D60, 4) + ' mm' : '–') +
          ' · copertura del passante ' + fmt(m4.copertura.pCurvaMin, 0) + '–' + fmt(m4.copertura.pCurvaMax, 0) + ' % (richiesto 10–90 %, senza estrapolazione)</p>' +
          '<p><b>Proposta di LiquiSite:</b> ' + esc(m4.proposta) + '</p>' + (m4.avvisi || []).map(a => '<p class="hint">' + esc(a.messaggio) + '</p>').join('') +
          '<div class="field"><label for="exDecisione">Valutazione del geologo</label><select id="exDecisione"><option value="">da confermare</option>' +
          '<option value="soddisfatto"' + (sel.dati.decisione4 === 'soddisfatto' ? ' selected' : '') + '>esterna ai fusi: criterio soddisfatto</option>' +
          '<option value="non soddisfatto"' + (sel.dati.decisione4 === 'non soddisfatto' ? ' selected' : '') + '>non esterna: criterio non soddisfatto</option></select></div>' +
          '<div class="field"><label for="exMotivazione">Motivazione' + (sel.dati.decisione4 && sel.dati.decisione4 !== m4.proposta ? ' (obbligatoria: scelta diversa dalla proposta)' : '') + '</label><textarea id="exMotivazione" rows="2">' + esc(sel.dati.motivazione4) + '</textarea></div>';
      }
      dett += '<p class="escl-motivo">' + esc(c4.motivo || '') + '</p></div>';
    }
    dett += '</div>';
    const grafico = '<div class="escl-grafico"><div class="escl-chart"><canvas id="cv-fuso" role="img" aria-label="Curva granulometrica e fusi"></canvas></div>' +
      '<p class="hint">Fusi digitalizzati dalla Fig. 7.11.1 delle NTC 2018. LiquiSite non estrapola la curva oltre i punti misurati.</p></div>';
    h += '<div class="escl-grid">' + albero + dett + grafico + '</div>';
    h += '<ul class="escl-note">' + v.note.map(n => '<li>' + esc(n) + '</li>').join('') +
      '<li>Gli esiti si scrivono come «verifica omessa ai sensi del §7.11.3.4.2», mai come «terreno non liquefacibile».</li></ul>';
    box.innerHTML = h;

    const chart = Gr.fusoGranulometrico($('cv-fuso'), { fusi: fusiDaMostrare(sel && sel.c4), curva: sel && sel.dati.curva });
    S.grafici.push({ id: 'fuso', titolo: 'Curva granulometrica e fusi', chart });

    const aggiornaSito = (k, val) => { if (!sc.esclusione || typeof sc.esclusione !== 'object') sc.esclusione = P.esclusioneVuota(); sc.esclusione[k] = val; renderRisultati(); };
    $('exFalda').addEventListener('change', (e) => { const n = leggiNumero(e.target); if (!Number.isNaN(n)) aggiornaSito('faldaMediaStagionale', n); });
    $('exPc').addEventListener('change', (e) => aggiornaSito('pcSubOrizzontale', leggiSiNo(e.target)));
    $('exFond').addEventListener('change', (e) => aggiornaSito('fondazioniSuperficiali', leggiSiNo(e.target)));
    box.querySelectorAll('[data-escl-strato]').forEach(el => el.addEventListener('click', () => { S.esclSel = Number(el.dataset.esclStrato); renderRisultati(); }));
    if (sel) {
      const s0 = sc.strati[sel.indice];
      const agg = (mod) => { EX.aggiornaStrato(sc, s0, mod); renderRisultati(); };
      $('exSabbia').addEventListener('change', (e) => agg({ sabbiaPulita: leggiSiNo(e.target) }));
      $('exCampione').addEventListener('change', (e) => agg({ campione: e.target.value }));
      $('exCurva').addEventListener('change', (e) => {
        const l = EX.leggiCurva(e.target.value);
        if (l.errori.length) { $('exCurvaErr').textContent = l.errori.join(' · '); e.target.setAttribute('aria-invalid', 'true'); return; }
        // una curva nuova richiede una nuova valutazione del geologo
        agg({ curva: l.curva.length ? l.curva : null, decisione4: null, motivazione4: '' });
      });
      if ($('exDecisione')) $('exDecisione').addEventListener('change', (e) => agg({ decisione4: e.target.value || null }));
      if ($('exMotivazione')) $('exMotivazione').addEventListener('change', (e) => agg({ motivazione4: e.target.value }));
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
      '<li>Criterio di verifica: ' + esc(F.criterioFS(sc)) + '</li>' +
      '<li>' + (r.cedimenti && r.cedimenti.stato === 'calcolato' ? 'Cedimento post-sismico e LSN: ' + esc(testoCedimento(r.cedimenti)) + '; LSN ' + esc(testoLSN(r.cedimenti)) + '. Spostamenti laterali: non calcolati.' : 'Cedimenti post-sismici: calcolati solo con prove CPT. Spostamenti laterali: non calcolati.') + '</li></ul>';
    if (r.cedimenti && r.cedimenti.stato === 'calcolato') h += '<div class="section-title">Cedimento e LSN: assunzioni</div><ul>' + r.cedimenti.assunzioni.concat(r.cedimenti.avvisi.map(a => ({ descrizione: a.messaggio }))).map(a => '<li>' + esc(a.descrizione) + '</li>').join('') + '<li>' + esc(r.cedimenti.fonte) + '</li></ul>';
    const ind = r.indiceIL;
    if (ind) {
      h += '<div class="section-title">Indice IL (Iwasaki)</div>';
      if (ind.stato !== 'calcolato') h += '<div class="alert alert-danger">' + esc(testoIL(ind)) + '</div>';
      else {
        h += '<div class="table-scroll"><table class="data-table"><thead><tr><th scope="col">grandezza</th><th scope="col">valore</th></tr></thead><tbody>' +
          [['IL_min (tratti senza risultato: contributo nullo)', fmt(ind.ILmin, 2)], ['IL_max (tratti senza risultato: contributo massimo)', fmt(ind.ILmax, 2)], ['indice completo', ind.completo ? 'sì: IL = ' + fmt(ind.IL, 2) : 'no'],
            ['spessore con FS calcolato [m]', fmt(ind.spessori.FS, 2)], ['di cui con FS < 1 [m]', fmt(ind.spessori.liquefacibileFSmin1, 2)], ['sopra falda, contributo nullo [m]', fmt(ind.spessori.sopraFalda, 2)],
            ['escluso per comportamento argilloso, FS N.A. [m]', fmt(ind.spessori.argilloso, 2)], ['senza risultato [m]', fmt(ind.spessori.ignoto, 2)]]
            .map(([a, b]) => '<tr><td class="txt">' + a + '</td><td>' + b + '</td></tr>').join('') + '</tbody></table></div>';
        h += '<ul>' + ind.assunzioni.map(a => '<li>' + esc(a.descrizione) + '</li>').join('') + '<li>' + esc(ind.fonte) + '</li></ul>';
      }
    }
    box.innerHTML = h;
  }

  // ---------------------------------------------------------------------------
  // Importazione dati della prova
  // ---------------------------------------------------------------------------
  const IM = { modo: 'nuova', lettura: null };
  const bozzeImportazione = new Map();
  let chiaveBozza = 'nuova';
  $('dlgImporta').addEventListener('close', () => {
    if (!$('imTesto').value.trim()) return;
    bozzeImportazione.set(chiaveBozza, { progetto: S.pr, tipo: $('imTipo').value, nome: $('imNome').value, testo: $('imTesto').value, sep: $('imSep').value, dec: $('imDec').value, int: $('imInt').value, mappa: P.copia(IM.mappa), unita: P.copia(IM.unita), toccato: IM.toccato });
  });
  function apriImporta(modo) {
    IM.modo = modo; IM.toccato = false;
    const pv = prova();
    chiaveBozza = modo === 'nuova' ? 'nuova' : pv.id;
    const bozza = bozzeImportazione.get(chiaveBozza);
    const riprendi = bozza && bozza.progetto === S.pr;
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
    if (riprendi) {
      $('imTipo').value=bozza.tipo; $('imNome').value=bozza.nome; $('imTesto').value=bozza.testo;
      $('imSep').value=bozza.sep; $('imDec').value=bozza.dec; $('imInt').value=bozza.int;
      IM.tipo=bozza.tipo; IM.mappa=P.copia(bozza.mappa); IM.unita=P.copia(bozza.unita); IM.toccato=bozza.toccato;
      leggiImporta(false);
    }
    if ($('dlgSettings').open) $('dlgSettings').close();
    $('dlgImporta').showModal();
    $('dlgImporta').dispatchEvent(new CustomEvent('importa:aperto', { detail: { riprendi: !!riprendi } }));
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
    bozzeImportazione.delete(chiaveBozza);
    IM.modo = 'sostituisci'; chiaveBozza = pv.id;
    $('imTipo').disabled = true;
    $('dlgTitolo').textContent = 'Modifica dati della prova «' + pv.nome + '»';
    S.selezione = null;
    renderTutto();
    $('dlgImporta').dispatchEvent(new CustomEvent('importa:salvato'));
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
    const pre = EX.valutaEsclusione(L, prova(), sc, risultatoDi(sc));
    const csv = X.csvRisultati(S.pr, prova(), sc, risultatoDi(sc), { preliminare: pre.esito.titolo + '. ' + pre.esito.testo });
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

  const nFS = (r, soglia) => r.righe.filter(x => x.stato === 'calcolato' && isNum(x.valori?.FS) && x.valori.FS < soglia).length;

  function stampaEsclusione(pv, sc, r) {
    const v = EX.valutaEsclusione(L, pv, sc, r && r.stato === 'calcolato' ? r : null);
    const d = EX.datiEsclusione(sc);
    const es = (c) => c.soddisfatto === true ? 'soddisfatto' : c.soddisfatto === false ? 'non soddisfatto' : (c.stato === 'non_pertinente' || c.stato === 'non_applicabile') ? 'non pertinente' : 'non dimostrato';
    const ESITI = { escluso: 'verifica omessa (§7.11.3.4.2)', non_escluso: 'verifica necessaria', non_dimostrato: 'esclusione non dimostrata', non_pertinente: 'non pertinente' };
    let h = '<div class="st-h">2. Verifica preliminare (NTC 2018 §7.11.3.4.2)</div>' +
      '<p class="st-nota"><b>' + esc(v.esito.titolo) + '.</b> ' + esc(v.esito.testo) + '</p><table class="st-tab"><tbody>' +
      '<tr><th>1. a<sub>max</sub> &lt; 0,1 g</th><td>' + es(v.criteri.c1) + (isNum(v.criteri.c1.valore) ? ' (a<sub>max</sub> = ' + fmt(v.criteri.c1.valore, 3) + ' g)' : '') + '</td></tr>' +
      '<tr><th>2. Falda media stagionale &gt; 15 m, p.c. sub-orizzontale, fondazioni superficiali</th><td>' + es(v.criteri.c2) +
      ' (falda ' + (isNum(d.faldaMediaStagionale) ? fmt(d.faldaMediaStagionale) + ' m' : 'non indicata') + '; p.c. sub-orizzontale: ' + (siNo(d.pcSubOrizzontale) || 'non indicato') + '; fondazioni superficiali: ' + (siNo(d.fondazioniSuperficiali) || 'non indicato') + ')</td></tr>' +
      '</tbody></table><table class="st-tab num"><thead><tr><th>da [m]</th><th>a [m]</th><th>descrizione</th><th>criterio 3</th><th>criterio 4</th><th>esito</th></tr></thead><tbody>' +
      v.strati.map(x => '<tr><td>' + fmt(x.da) + '</td><td>' + fmt(x.a) + '</td><td style="text-align:left;">' + esc(x.descrizione) + '</td>' +
        '<td style="text-align:left;">' + es(x.c3) + (isNum(x.c3.minimo) ? ' · min ' + esc(x.c3.grandezza) + ' ' + fmt(x.c3.minimo, 1) : '') + (x.dati.sabbiaPulita === null ? '' : ' · sabbia pulita: ' + siNo(x.dati.sabbiaPulita)) + '</td>' +
        '<td style="text-align:left;">' + es(x.c4) + (x.c4.motore && isNum(x.c4.motore.Uc) ? ' · Uc ' + fmt(x.c4.motore.Uc, 1) : '') + (x.dati.campione ? ' · ' + esc(x.dati.campione) : '') +
        (x.c4.motore ? ' · proposta: ' + esc(x.c4.proposta) + (x.dati.decisione4 ? '; geologo: ' + esc(x.dati.decisione4) + (x.dati.motivazione4 ? ' (' + esc(x.dati.motivazione4) + ')' : '') : '; da confermare') : '') + '</td>' +
        '<td style="text-align:left;">' + ESITI[x.esito] + '</td></tr>').join('') + '</tbody></table>';
    const conCurva = v.strati.filter(x => x.dati.curva && x.dati.curva.length);
    if (conCurva.length) h += '<div class="st-grafici st-fusi">' + conCurva.map(x => '<figure><img alt="Curva granulometrica" src="' +
      Gr.immagineDa(Gr.fusoGranulometrico, { fusi: fusiDaMostrare(x.c4), curva: x.dati.curva }, 520, 380) + '"><figcaption>Strato ' + fmt(x.da) + '–' + fmt(x.a) + ' m' + (x.dati.campione ? ' · ' + esc(x.dati.campione) : '') + '</figcaption></figure>').join('') + '</div>';
    h += '<p class="st-nota">' + v.note.map(esc).join(' ') + ' Criterio 3: per strato, con la normalizzazione del metodo (' + esc(P.NOMI_METODI[sc.metodo]) + '); lo strato è escluso solo se dichiarato sabbia pulita e se tutti i punti saturi superano la soglia. Criterio 4: fusi digitalizzati dalla Fig. 7.11.1, nessuna estrapolazione della curva, esito confermato dal geologo.</p>';
    return h;
  }

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
    h += stampaEsclusione(pv, sc, r);
    h += '<div class="st-h">3. Riepilogo</div><table class="st-tab"><tbody>' +
      riga('Profondità indagata', q.profonditaIndagata ? fmt(q.profonditaIndagata.da) + ' – ' + fmt(q.profonditaIndagata.a) + ' m' : '–') +
      riga('Estensione analizzata', q.estensioneAnalizzata ? fmt(q.estensioneAnalizzata.da) + ' – ' + fmt(q.estensioneAnalizzata.a) + ' m' : '–') +
      riga('Punti calcolati', (q.conteggi.calcolato || 0) + ' su ' + q.punti) +
      riga('FS minimo calcolato', q.fsMin ? fmt(q.fsMin.FS) + ' a z = ' + fmt(q.fsMin.z) + ' m' : '–') +
      riga('FS di riferimento', fmt(F.fsRiferimento(sc)) + ' · punti calcolati con FS < 1: ' + nFS(r, 1) + '; con FS < ' + fmt(F.fsRiferimento(sc)) + ': ' + nFS(r, F.fsRiferimento(sc))) +
      (r.cedimenti && r.cedimenti.stato === 'calcolato' ? riga('Cedimento post-sismico da CPT (Zhang et al. 2002, 0–20 m)', esc(testoCedimento(r.cedimenti)) + (r.cedimenti.completo ? '' : ' — copertura incompleta: contributo nullo nel valore inferiore, deformazione limite ' + fmt(r.cedimenti.epsLimite, 2) + ' % nel superiore')) +
        riga('LSN (senza classi)', '0–20 m: ' + esc(testoLSN(r.cedimenti)) + ' · 0–10 m: ' + esc(testoLSN(r.cedimenti, true))) : '') +
      riga('Indice IL (Iwasaki, 0–20 m, senza classi)', r.indiceIL ? esc(testoIL(r.indiceIL)) + (r.indiceIL.stato === 'calcolato' && !r.indiceIL.completo ? ' — copertura incompleta: ' + fmt(r.indiceIL.spessori.ignoto, 2) + ' m senza risultato, con contributo nullo nel valore inferiore e massimo possibile nel superiore' : '') : '–') +
      riga('Intervalli non calcolati', q.intervalliNonCalcolati.length ? q.intervalliNonCalcolati.map(i => fmt(i.da) + '–' + fmt(i.a) + ' m: ' + esc(F.ETICHETTE_STATI[i.stato]) + (i.codice ? ' (' + esc(i.codice) + ')' : '')).join('; ') : 'nessuno') +
      '</tbody></table><p class="st-nota"><b>Criterio di verifica e scelta del coefficiente di sicurezza.</b> ' + esc(F.criterioFS(sc)) + '</p><p class="st-nota">Il FS minimo non descrive da solo la risposta del sito. ' + esc(q.notaFS) + ' ' + esc(q.notaPL) + '</p>';
    const tavole = S.grafici.filter(g => g.cfg);
    for (let i = 0; i < tavole.length; i += 2) {
      h += '<div class="st-h st-pagina">4. Profili · Tavola ' + (i / 2 + 1) + ' · ' + esc(pv.nome) + (pv.esempio ? ' · ESEMPIO SINTETICO' : '') + '</div>' +
        '<p class="st-nota">' + esc(S.pr.progetto.titolo) + ' · ' + esc(sc.nome) + '<br>' + esc(P.NOMI_METODI[sc.metodo]) + ' · Mw ' + fmt(sc.Mw) + ' · amax ' + fmt(sc.amax,3) + ' g · falda ' + fmt(sc.zFalda) + ' m</p><div class="st-grafici">' +
        tavole.slice(i,i+2).map(g => '<figure><img alt="' + esc(g.titolo) + '" src="' + Gr.immagineStampa(g.cfg, 400, 700) + '"><figcaption>' + esc(g.titolo) + ($('nota-' + g.id) && $('nota-' + g.id).textContent ? ' – ' + esc($('nota-' + g.id).textContent) : '') + '</figcaption></figure>').join('') + '</div>' +
        '<p class="st-nota">Falda: linea blu tratteggiata. CSR: rossa tratteggiata; CRR: verde continua. FS &lt; 1: domanda maggiore della resistenza del modello, non classificazione normativa. Le interruzioni non indicano sicurezza.</p>';
    }
    const sbt = S.grafici.find(g => g.id === 'sbt');
    if (sbt) h += '<div class="st-h st-pagina">5. Carta di comportamento CPT</div><figure class="st-sbt"><img alt="Carta di comportamento CPT" src="' +
      Gr.immagineDa(Gr.cartaSBT, cfgSBT(r, sc), 640, 560) + '"></figure>' + tabellaZoneSBT(r) +
      '<p class="st-nota">Strumento di lettura della prova, non entra nel calcolo. Zone 2–7 delimitate da Ic (Robertson e Wride 1998, Tab. 1, da Robertson 1990); le zone 1, 8 e 9 non sono definite da Ic e non sono rappresentate.</p>';
    h += '<div class="st-h st-pagina">' + (sbt ? '6' : '5') + '. Avvisi, assunzioni e limiti</div><ul class="st-lista">' +
      q.avvisi.map(a => '<li><b>' + esc(a.codice) + '</b> (' + a.n + ' punti, z ' + fmt(a.zDa) + '–' + fmt(a.zA) + ' m): ' + esc(a.messaggio) + '</li>').join('') +
      q.assunzioni.map(a => '<li>Assunzione: ' + esc(a.descrizione) + (a.n ? ' (' + a.n + ' punti)' : '') + '</li>').join('') +
      '<li>Profondità oltre ' + fmt(q.profonditaIndagata ? q.profonditaIndagata.a : 0) + ' m non indagate; un intervallo non calcolato non è un intervallo sicuro.</li>' +
      (r.indiceIL && r.indiceIL.stato === 'calcolato' ? r.indiceIL.assunzioni.map(a => '<li>IL: ' + esc(a.descrizione) + '</li>').join('') + '<li>IL: ' + esc(r.indiceIL.fonte) + '</li>' : '') +
      (r.cedimenti && r.cedimenti.stato === 'calcolato' ? r.cedimenti.assunzioni.concat(r.cedimenti.avvisi.map(a => ({ descrizione: a.messaggio }))).map(a => '<li>Cedimento e LSN: ' + esc(a.descrizione) + '</li>').join('') + '<li>Cedimento e LSN: ' + esc(r.cedimenti.fonte) + '</li>' : '<li>Cedimenti post-sismici: calcolati solo con prove CPT.</li>') +
      '<li>Spostamenti laterali: non calcolati.</li></ul>';
    h += '<div class="st-piede"><span>GeoHub-LiquiSite ' + esc(P.VERSIONE_APP) + ' · motore ' + esc(r.versioneMotore) + ' · calcolato il ' + esc(new Date(r.calcolatoIl).toLocaleString('it-IT')) + ' · firma input ' + esc(r.firma) + '</span><span>Basato su LiquiSite di Fabio Duronio, geologo</span></div>';
    $('stampa').innerHTML = h;
  }

  // ---------------------------------------------------------------------------
  // Avvio
  // ---------------------------------------------------------------------------
  function renderTutto() {
    $('topVersione').textContent = 'v' + P.VERSIONE_APP + ' · motore ' + L.VERSIONE_MOTORE;
    renderProgetto(); renderProva(); renderScenario(); renderStrati(); renderStato(); renderRisultati();
  }

  window.LiquiUI = { stato: S, renderTutto, calcola, statoRisultato };
  renderTutto();
})();
