#!/usr/bin/env node
/*
 * verifica_casuale.mjs — prove casuali (con seme fisso, ripetibili) sull'intero percorso:
 * profilo → motore → indice IL → CSV → salvataggio e riapertura, e sull'importazione di testo.
 * Controlla proprietà che devono valere per qualunque input, non valori scientifici.
 *
 * Uso:   node verifiche/verifica_casuale.mjs [--verbose] [--casi N] [--seme S]
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const L = require('../motore/liquisite.js');
const P = require('../app/progetto.js');
const F = require('../app/profilo.js');
const I = require('../app/importa.js');
const X = require('../app/esporta.js');
const IND = require('../motore/indici.js');
const EX = require('../app/esclusione.js');

const arg = (nome, def) => { const i = process.argv.indexOf(nome); return i > 0 ? Number(process.argv[i + 1]) : def; };
const verbose = process.argv.includes('--verbose');
const CASI = arg('--casi', 150), SEME = arg('--seme', 7031);
let ok = 0, ko = 0;
function check(nome, valore, atteso) {
  const passa = JSON.stringify(valore) === JSON.stringify(atteso);
  passa ? ok++ : ko++;
  if (verbose || !passa) console.log((passa ? '  ok   ' : '  ERRORE ') + nome + ': ' + JSON.stringify(valore) + (passa ? '' : ' (atteso ' + JSON.stringify(atteso) + ')'));
}
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

function generatore(seme) {
  let a = seme >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = generatore(SEME);
const tra = (a, b) => a + (b - a) * rnd();
const intero = (a, b) => Math.floor(tra(a, b + 1));
const scegli = (v) => v[Math.floor(rnd() * v.length)];
const r = (v, c) => Math.round(v * 10 ** c) / 10 ** c;

function strati(zMax) {
  const out = []; let z = 0;
  while (z < zMax) {
    const a = Math.min(zMax, r(z + tra(0.5, 5), 2));
    const g = r(tra(16, 20), 1);
    out.push({ da: z, a, gamma: g, gammaSat: r(g + tra(0.3, 1.5), 1), FC: rnd() < 0.6 ? intero(0, 90) : null, descrizione: '' });
    z = a;
  }
  return out;
}

function provaCasuale() {
  const tipo = scegli(['CPTU', 'CPTE', 'SPT', 'VS']);
  const pv = P.nuovaProva(tipo, 'casuale ' + tipo);
  const dati = [];
  let z = r(tra(0, 1.5), 2);
  const passo = tipo === 'SPT' ? 1.5 : tipo === 'VS' ? 1 : scegli([0.02, 0.05, 0.1]);
  const zFine = tra(4, 24);
  while (z <= zFine) {
    let riga;
    if (tipo === 'CPTU') riga = [z, r(tra(0.3, 30), 3), r(tra(1, 250), 1), r(tra(-20, 600), 1)];
    else if (tipo === 'CPTE') riga = [z, r(tra(0.3, 30), 3), r(tra(1, 250), 1)];
    else if (tipo === 'SPT') riga = [z, intero(0, 60)];
    else riga = [z, r(tra(80, 450), 0)];
    if (rnd() < 0.03) riga[intero(1, riga.length - 1)] = null;          // lettura mancante
    dati.push(riga);
    z = r(z + passo * (rnd() < 0.02 ? intero(4, 30) : 1), 2);           // talvolta un tratto non indagato
  }
  pv.dati = dati;
  return pv;
}

function scenarioCasuale(pv) {
  const metodi = P.METODI_PER_TIPO[pv.tipo];
  const s = P.nuovoScenario(pv, 'casuale', 0);
  const zMax = pv.dati.at(-1)[0] + (rnd() < 0.15 ? -tra(0.5, 3) : tra(0, 2)); // a volte stratigrafia più corta della prova
  Object.assign(s, { metodo: scegli(metodi), Mw: r(tra(5, 8), 1), amax: r(tra(0.05, 0.5), 3), zFalda: r(tra(0, 6), 2), strati: strati(Math.max(1, zMax)) });
  s.opzioni = { Vs12: r(tra(120, 400), 0), IcSoglia: scegli([2.4, 2.6, 2.8]), CFC: scegli([0, 0.07, -0.1]) };
  return s;
}

const STATI = new Set(Object.values(L.STATI));
let eccezioni = 0, statiIgnoti = 0, fsNonValidi = 0, fsInventati = 0, ilFuori = 0, ilIncoerenti = 0,
  sommaConteggi = 0, esclusioniIndebite = 0, nCed = 0, cedIncoerenti = 0, csvRighe = 0, csvTesti = 0, firmaRiapertura = 0, contenimento = 0, calcolati = 0, nCalc = 0;

console.log('1. Profili casuali (' + CASI + ' casi, seme ' + SEME + ')');
for (let k = 0; k < CASI; k++) {
  const pv = provaCasuale(), sc = scenarioCasuale(pv);
  let res;
  try { res = F.calcolaScenario(pv, sc, L, { adesso: '2026-11-13T00:00:00Z' }); } catch (e) { eccezioni++; if (verbose) console.log(e); continue; }
  if (res.stato !== 'calcolato') continue;
  nCalc++;
  for (const x of res.righe) {
    if (!STATI.has(x.stato)) statiIgnoti++;
    const fs = x.valori && x.valori.FS;
    if (x.stato === 'calcolato') { calcolati++; if (!isNum(fs) || fs <= 0) fsNonValidi++; }
    else if (fs !== undefined && fs !== null) fsInventati++;
  }
  const q = res.riepilogo;
  if (Object.values(q.conteggi).reduce((a, b) => a + b, 0) !== q.punti) sommaConteggi++;

  const il = res.indiceIL;
  if (il && il.stato === 'calcolato') {
    if (!(il.ILmin >= -1e-9 && il.ILmax <= 100 + 1e-9 && il.ILmin <= il.ILmax + 1e-9)) ilFuori++;
    if (il.completo !== (il.spessori.ignoto < 1e-9) || (il.completo && Math.abs(il.ILmax - il.ILmin) > 1e-9)) ilIncoerenti++;
    // rendere ignota una lettura calcolata non può restringere l'intervallo
    const punti = F.puntiPerIL(res.righe), i = punti.findIndex(p => p.categoria === 'FS');
    if (i >= 0) {
      const p2 = punti.map(p => ({ ...p })); p2[i] = { z: p2[i].z, categoria: 'ignoto' };
      const il2 = IND.indiceIL(p2, sc.zFalda);
      if (!(il2.ILmin <= il.ILmin + 1e-9 && il2.ILmax >= il.ILmax - 1e-9)) contenimento++;
    }
  }

  // verifica preliminare con dati casuali: mai un'esclusione senza un criterio soddisfatto
  sc.esclusione = { faldaMediaStagionale: rnd() < 0.5 ? r(tra(0, 30), 1) : null, pcSubOrizzontale: scegli([true, false, null]), fondazioniSuperficiali: scegli([true, false, null]),
    strati: sc.strati.map(s0 => ({ da: s0.da, a: s0.a, sabbiaPulita: scegli([true, false, null]), decisione4: scegli(['soddisfatto', 'non soddisfatto', null]), motivazione4: scegli(['', 'motivo']),
      curva: rnd() < 0.5 ? null : (() => { let d = tra(0.001, 0.05), p = tra(0, 15); const c = []; while (p < 100 && c.length < 12) { c.push([r(d, 4), r(p, 1)]); d *= tra(1.3, 4); p = Math.min(100, p + tra(3, 30)); } return c; })() })) };
  try {
    const v = EX.valutaEsclusione(L, pv, sc, res);
    const pert = v.strati.filter(x => x.pertinente);
    if (v.esito.codice === 'omessa' && !(v.criteri.c1.soddisfatto || v.criteri.c2.soddisfatto || (v.coperto && pert.length && pert.every(x => x.esito === 'escluso')))) esclusioniIndebite++;
    for (const x of v.strati) {
      if (x.esito === 'escluso' && !(x.c3.soddisfatto === true || (x.c4.soddisfatto === true && x.dati.decisione4 === 'soddisfatto'))) esclusioniIndebite++;
      if (x.c3.soddisfatto === true && x.dati.sabbiaPulita !== true) esclusioniIndebite++;
    }
  } catch (e) { eccezioni++; if (verbose) console.log(e); }

  const ced = res.cedimenti;
  if (ced && ced.stato === 'calcolato') {
    nCed++;
    if (!(ced.Smin >= 0 && ced.Smin <= ced.Smax + 1e-12 && ced.LSNmin >= 0 && ced.LSNmin <= ced.LSNmax + 1e-9 && ced.LSN10min <= ced.LSNmin + 1e-9 && ced.Smax <= 20 * 0.0581 + 1e-9)) cedIncoerenti++;
    if (ced.completo !== res.indiceIL.completo) { cedIncoerenti++; if (verbose) console.log('completo', ced.completo, res.indiceIL.completo); }
  } else if (sc.metodo === 'bi2014Cpt') cedIncoerenti++;
  else if (ced) cedIncoerenti++;

  const pr = P.nuovoProgetto(); pr.prove = [pv]; pr.scenari = [sc]; pr.provaAttiva = pv.id; pr.scenarioAttivo = sc.id;
  const csv = X.csvRisultati(pr, pv, sc, res, { decimale: scegli([',', '.']) });
  const righe = csv.split('\r\n'), h = righe.findIndex(x => x.startsWith('z [m]'));
  if (h < 0 || righe.slice(h + 1).filter(x => x !== '').length !== res.righe.length) csvRighe++;
  if (/NaN|undefined|Infinity|\[object/.test(csv)) csvTesti++;

  const riaperto = P.apriProgetto(P.salvaProgetto(pr));
  if (!riaperto.ok || P.firmaInput(riaperto.progetto.prove[0], riaperto.progetto.scenari[0], L.VERSIONE_MOTORE) !== P.firmaInput(pv, sc, L.VERSIONE_MOTORE)) firmaRiapertura++;
}
check('scenari calcolati (almeno metà dei casi)', nCalc >= CASI / 2, true);
check('righe calcolate esaminate (> 1000)', calcolati > 1000, true);
check('nessuna eccezione', eccezioni, 0);
check('stati sempre tra quelli previsti', statiIgnoti, 0);
check('FS finito e positivo nelle righe calcolate', fsNonValidi, 0);
check('nessun FS nelle righe non calcolate', fsInventati, 0);
check('riepilogo: somma dei conteggi = punti', sommaConteggi, 0);
check('IL: 0 ≤ IL_min ≤ IL_max ≤ 100', ilFuori, 0);
check('IL: «completo» solo senza tratti ignoti e con IL_min = IL_max', ilIncoerenti, 0);
check('IL: una lettura resa ignota allarga o conserva l\'intervallo', contenimento, 0);
check('verifica preliminare: nessuna esclusione senza criterio soddisfatto e confermato', esclusioniIndebite, 0);
check('cedimenti calcolati in alcuni casi CPT', nCed > 0, true);
check('cedimento e LSN: 0 ≤ min ≤ max, S ≤ 20 m · εlim, LSN 0–10 ≤ LSN 0–20', cedIncoerenti, 0);
check('CSV: una riga per punto', csvRighe, 0);
check('CSV: nessun NaN, undefined, Infinity', csvTesti, 0);
check('salvataggio e riapertura: stessa firma degli input', firmaRiapertura, 0);

console.log('2. Importazione di testo casuale');
{
  let eccImp = 0, okNonCrescenti = 0, okValoriErrati = 0, nOk = 0;
  for (let k = 0; k < CASI * 2; k++) {
    const sep = scegli([';', '\t', ',']), dec = sep === ',' ? '.' : scegli([',', '.']);
    const n = intero(1, 40), righe = [];
    let z = tra(0, 2);
    for (let i = 0; i < n; i++) {
      z += rnd() < 0.05 ? -tra(0, 1) : tra(0.01, 1);
      const celle = [z, tra(0.1, 30), tra(0, 300), tra(-50, 500)].map(v => {
        const u = rnd();
        if (u < 0.03) return '';
        if (u < 0.05) return scegli(['abc', '1.2.3', '--', 'n.d.', '1,5,2']);
        return v.toFixed(intero(0, 3)).replace('.', dec);
      });
      righe.push(celle.join(sep));
    }
    const testo = (rnd() < 0.5 ? ['z', 'qc', 'fs', 'u2'].join(sep) + '\n' : '') + righe.join(rnd() < 0.5 ? '\n' : '\r\n');
    try {
      const div = I.dividi(testo, sep);
      const intest = I.haIntestazione(div.righe, dec);
      const res = I.costruisciDati(div.righe, { tipo: 'CPTU', mappa: { z: 0, qc: 1, fs: 2, u2: 3 }, unita: { z: 'm', qc: 'MPa', fs: 'kPa', u2: 'kPa' }, decimale: dec, saltaIntestazione: intest });
      if (res.ok) {
        nOk++;
        for (let i = 1; i < res.dati.length; i++) if (!(res.dati[i][0] > res.dati[i - 1][0])) okNonCrescenti++;
        for (const d of res.dati) for (const v of d) if (v !== null && !isNum(v)) okValoriErrati++;
      }
    } catch (e) { eccImp++; if (verbose) console.log(e); }
  }
  check('importazione: nessuna eccezione', eccImp, 0);
  check('importazione: alcuni testi accettati', nOk > 0, true);
  check('importazione accettata: profondità crescenti', okNonCrescenti, 0);
  check('importazione accettata: solo numeri o celle vuote', okValoriErrati, 0);
}

console.log('\nRisultato: ' + ok + ' controlli superati, ' + ko + ' non superati.');
process.exit(ko ? 1 : 0);
