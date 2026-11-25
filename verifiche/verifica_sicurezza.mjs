// GeoHub-LiquiSite — verifiche sull'apertura dei progetti (dati non attendibili) e sul FS di riferimento.
// I payload sono innocui: al massimo impostano una variabile globale di prova.
// Uso: node verifiche/verifica_sicurezza.mjs
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const L = require('../motore/liquisite.js');
const P = require('../app/progetto.js');
const F = require('../app/profilo.js');
const X = require('../app/esporta.js');
const E = require('../app/esempio.js');

let ok = 0, ko = 0;
function check(nome, ottenuto, atteso) {
  const a = JSON.stringify(ottenuto), b = JSON.stringify(atteso);
  if (a === b) ok++; else { ko++; console.log('  ERRORE ' + nome + ': ' + a + ' (atteso ' + b + ')'); }
}
const PAYLOAD = '"><img src=x onerror="globalThis.__liquiXSS=1">';
const base = () => JSON.parse(P.salvaProgetto(E.progettoEsempio()));
const apri = (obj) => P.apriProgetto(typeof obj === 'string' ? obj : JSON.stringify(obj));
const rifiutato = (obj, campo) => { const r = apri(obj); return !r.ok && r.errori.some(e => e.campo.startsWith(campo)); };

console.log('1. Percorsi di iniezione segnalati');
{
  const a = base(); a.scenari[0].opzioni.CFC = PAYLOAD;
  check('stringa in opzioni.CFC rifiutata', rifiutato(a, 'scenari[0].opzioni.CFC'), true);
  for (const k of ['Vs12', 'IcSoglia', 'FSrif']) { const b = base(); b.scenari[0].opzioni[k] = PAYLOAD; check('stringa in opzioni.' + k + ' rifiutata', rifiutato(b, 'scenari[0].opzioni.' + k), true); }
  const c = base(); c.prove[1].parametri.CE = PAYLOAD;
  check('stringa nei parametri della prova rifiutata', rifiutato(c, 'prove[1].parametri.CE'), true);
  for (const k of ['Mw', 'amax', 'zFalda']) { const d = base(); d.scenari[0][k] = PAYLOAD; check('stringa in ' + k + ' rifiutata', rifiutato(d, 'scenari[0].' + k), true); }
  const e = base(); e.scenari[0].strati[0].gamma = PAYLOAD;
  check('stringa nei pesi di volume rifiutata', rifiutato(e, 'scenari[0].strati[0].gamma'), true);
  const f = base(); f.scenari[0].esclusione.faldaMediaStagionale = PAYLOAD;
  check('stringa nella falda media stagionale rifiutata', rifiutato(f, 'scenari[0].esclusione.faldaMediaStagionale'), true);

  // Risultati alterati: non vengono mai ricaricati, qualunque sia il contenuto.
  const g = base();
  g.risultati = { [g.scenari[0].id]: { stato: 'calcolato', versioneMotore: L.VERSIONE_MOTORE, firma: '0', righe: [],
    riepilogo: { punti: PAYLOAD, conteggi: { calcolato: PAYLOAD }, avvisi: [], intervalliNonCalcolati: [] } } };
  const rg = apri(g);
  check('risultati alterati: progetto aperto senza risultati', [rg.ok, Object.keys(rg.progetto.risultati).length], [true, 0]);
  check('risultati alterati: avviso di ricalcolo', rg.avvisi.length === 1 && /Calcola/.test(rg.avvisi[0]), true);
  check('nessun campo sconosciuto conservato', JSON.stringify(rg.progetto).includes('onerror'), false);
}

console.log('2. Identificativi, colori e valori enumerati');
{
  for (const t of ['constructor', 'toString', '__proto__', 'hasOwnProperty', 'CPT']) { const a = base(); a.prove[0].tipo = t; check('tipo di prova «' + t + '» rifiutato', rifiutato(a, 'prove[0].tipo'), true); }
  for (const m of ['constructor', 'toString', 'valueOf']) { const a = base(); a.scenari[0].metodo = m; check('metodo «' + m + '» rifiutato', rifiutato(a, 'scenari[0].metodo'), true); }
  for (const u of ['toString', 'constructor', 'bar']) { const a = base(); a.prove[0].unita.qc = u; check('unità «' + u + '» rifiutata', rifiutato(a, 'prove[0].unita.qc'), true); }
  const c = base(); c.prove[0].colonne.push('constructor'); c.prove[0].dati = c.prove[0].dati.map(r => r.concat(null));
  check('colonna «constructor» rifiutata', rifiutato(c, 'prove[0].colonne'), true);
  const d = base(); d.prove[0].id = PAYLOAD; check('identificativo di prova con caratteri non ammessi rifiutato', rifiutato(d, 'prove[0].id'), true);
  const e = base(); e.scenari[0].id = PAYLOAD; check('identificativo di scenario con caratteri non ammessi rifiutato', rifiutato(e, 'scenari[0].id'), true);
  const f = base(); f.scenari[1].id = f.scenari[0].id; check('identificativi di scenario duplicati rifiutati', rifiutato(f, 'scenari[1].id'), true);
  const g = base(); g.scenari[0].colore = 'red;background:url(x)'; check('colore non esadecimale rifiutato', rifiutato(g, 'scenari[0].colore'), true);
  const h = base(); h.scenari[0].esclusione.strati[0].decisione4 = PAYLOAD; check('decisione del criterio 4 non ammessa rifiutata', rifiutato(h, 'scenari[0].esclusione.strati[0].decisione4'), true);
  const i = base(); i.scenari[0].esclusione.strati[0].curva = [[0.1, PAYLOAD]]; check('curva granulometrica con testo rifiutata', rifiutato(i, 'scenari[0].esclusione.strati[0].curva'), true);
  const j = base(); j.prove[1].parametri.senzaRivestimento = 'si'; check('booleano scritto come testo rifiutato', rifiutato(j, 'prove[1].parametri.senzaRivestimento'), true);
  // Testo libero: accettato (sarà sempre mostrato con escape) ma conservato tale e quale.
  const k = base(); k.scenari[0].nome = PAYLOAD; k.progetto.titolo = PAYLOAD; k.scenari[0].strati[0].descrizione = PAYLOAD;
  const rk = apri(k); check('testo libero accettato e conservato', [rk.ok, rk.progetto.scenari[0].nome, rk.progetto.progetto.titolo], [true, PAYLOAD, PAYLOAD]);
}

console.log('3. Robustezza dell\'apertura');
{
  const a = base(); delete a.prove[0].unita.qc; check('unità mancante con più scelte ammesse rifiutata', rifiutato(a, 'prove[0].unita.qc'), true);
  const b = base(); delete b.prove[1].unita.N;
  const rb = apri(b); check('unità mancante con una sola scelta: assunta', [rb.ok, rb.ok && rb.progetto.prove[1].unita.N], [true, 'colpi/30 cm']);
  const c = base(); delete c.prove[0].unita; check('oggetto unità assente: errori per le colonne, nessuna eccezione', rifiutato(c, 'prove[0].unita'), true);
  const d = base(); d.risultati = null; check('risultati null', apri(d).ok, true);
  const e = base(); e.risultati = { x: null, y: 'z' }; check('risultati malformati: ignorati con avviso', [apri(e).ok, apri(e).avvisi.length], [true, 1]);
  const f = base(); f.risultati = []; check('risultati come elenco: ignorati', apri(f).ok, true);
  const g = base(); g.scenari[0].opzioni = 'x'; check('opzioni non oggetto rifiutate', rifiutato(g, 'scenari[0].opzioni'), true);
  const h = base(); h.prove[0].parametri = [1]; check('parametri come elenco rifiutati', rifiutato(h, 'prove[0].parametri'), true);
  const i = base(); i.scenari[0].strati = [null]; check('strato null rifiutato', rifiutato(i, 'scenari[0].strati[0]'), true);
  check('file JSON nullo', apri('null').ok, false);
  check('elenco al posto del progetto', apri('[]').ok, false);
  const j = base(); j.progetto = null; check('sezione progetto nulla', apri(j).ok, false);
  const k = base(); k.prove = [null, 1, 'x']; check('prove non oggetto: errori, nessuna eccezione', apri(k).ok, false);
  const l = base(); l.scenari[0].esclusione.strati = [null]; check('strato preliminare nullo rifiutato', rifiutato(l, 'scenari[0].esclusione.strati[0]'), true);
  // Prova casuale: alterazioni di una foglia qualsiasi non devono mai produrre eccezioni.
  let seme = 20261115; const rnd = () => ((seme = (seme * 1664525 + 1013904223) >>> 0) / 4294967296);
  const valori = [null, undefined, PAYLOAD, '', 'constructor', -1, 0, 1e308, NaN, true, [], {}, [[1]], { a: 1 }];
  const foglie = (o, perc = [], out = []) => {
    if (o && typeof o === 'object') for (const k of Object.keys(o)) { if (Array.isArray(o) && o.length > 50 && Number(k) > 3) continue; foglie(o[k], perc.concat(k), out); }
    out.push(perc); return out;
  };
  const tutte = foglie(base());
  // Il payload può restare solo nei campi di testo libero (mostrati sempre con escape).
  // 'motivazione' (della Mw) è testo libero come 'motivazione4': mostrata sempre con escape (app/ui.js).
  const TESTI = new Set(['nome', 'titolo', 'sito', 'autore', 'note', 'descrizione', 'provenienza', 'campione', 'motivazione4', 'motivazione']);
  const fuoriDaiTesti = (o, chiave) => {
    if (typeof o === 'string') return o.includes('onerror') && !TESTI.has(chiave);
    if (o && typeof o === 'object') return Object.keys(o).some(k => fuoriDaiTesti(o[k], Array.isArray(o) ? chiave : k));
    return false;
  };
  let eccezioni = 0, esitiStrani = 0;
  for (let n = 0; n < 1500; n++) {
    const o = base(), perc = tutte[Math.floor(rnd() * tutte.length)];
    if (!perc.length) continue;
    let t = o; for (const k of perc.slice(0, -1)) t = t[k];
    const v = valori[Math.floor(rnd() * valori.length)];
    if (v === undefined) delete t[perc[perc.length - 1]]; else t[perc[perc.length - 1]] = v;
    try {
      const r = apri(o);
      if (typeof r.ok !== 'boolean' || !Array.isArray(r.errori) || r.errori.some(e => typeof e.campo !== 'string' || typeof e.motivo !== 'string')) esitiStrani++;
      if (r.ok && fuoriDaiTesti(r.progetto)) esitiStrani++;
    } catch (err) { eccezioni++; }
  }
  check('1500 alterazioni casuali: nessuna eccezione', eccezioni, 0);
  check('1500 alterazioni casuali: esiti sempre ben formati', esitiStrani, 0);
}

console.log('4. FS di riferimento: nessun ripiego silenzioso');
{
  const pr = E.progettoEsempio(), sc = pr.scenari[0], pv = pr.prove.find(p => p.id === sc.provaId);
  const r = F.calcolaScenario(pv, sc, L, { adesso: '2026-11-15T00:00:00Z' });
  const con = (v) => { const s = P.copia(sc); if (v === 'assente') delete s.opzioni.FSrif; else s.opzioni.FSrif = v; return s; };
  for (const v of [4, 0.5, NaN, 3.0001]) {
    const s = con(v), st = F.statoFsRiferimento(s);
    check('valore ' + v + ': non valido', [st.valido, F.fsRiferimento(s)], [false, null]);
    check('valore ' + v + ': nessun 1,25 nel criterio', F.criterioFS(s).includes('raccomanda FS = 1,25, come illustrato'), false);
    let errore = null; try { X.csvRisultati(pr, pv, s, r); } catch (e) { errore = e.message; }
    check('valore ' + v + ': CSV bloccato con motivo', errore !== null && errore.includes('FS di riferimento non valido'), true);
    check('valore ' + v + ': calcolo segnala il campo', F.calcolaScenario(pv, s, L).errori.some(e => e.campo === 'opzioni.FSrif'), true);
  }
  for (const [v, atteso] of [[null, 1.25], ['assente', 1.25], [1.5, 1.5], [1, 1], [3, 3]]) {
    const s = con(v);
    check('valore ' + v + ': ' + atteso, [F.statoFsRiferimento(s).valido, F.fsRiferimento(s)], [true, atteso]);
  }
  check('CSV consentito con valore valido', typeof X.csvRisultati(pr, pv, con(1.5), r), 'string');
  const a = JSON.parse(P.salvaProgetto(pr)); a.scenari[0].opzioni.FSrif = 4;
  const ra = apri(a);
  check('valore 4 salvato: riaperto come 4 e segnalato', [ra.ok, ra.progetto.scenari[0].opzioni.FSrif, F.fsRiferimento(ra.progetto.scenari[0])], [true, 4, null]);
  const b = JSON.parse(P.salvaProgetto(pr)); delete b.scenari[0].opzioni.FSrif;
  check('progetto precedente senza il campo: 1,25', F.fsRiferimento(apri(b).progetto.scenari[0]), 1.25);
}

console.log('\nRisultato: ' + ok + ' controlli superati, ' + ko + ' non superati.');
if (ko) process.exit(1);
