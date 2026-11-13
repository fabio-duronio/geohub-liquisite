#!/usr/bin/env node
/*
 * verifica_profilo.mjs — controlli del livello applicativo (app/*.js):
 * coincidenza con il motore, gestione degli intervalli, firma degli input, importazione,
 * esportazione CSV, salvataggio e riapertura JSON.
 *
 * Uso:   node verifiche/verifica_profilo.mjs [--verbose]
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const L = require('../motore/liquisite.js');
const P = require('../app/progetto.js');
const F = require('../app/profilo.js');
const I = require('../app/importa.js');
const X = require('../app/esporta.js');
const E = require('../app/esempio.js');

const verbose = process.argv.includes('--verbose');
let ok = 0, ko = 0;
function check(nome, valore, atteso) {
  const passa = JSON.stringify(valore) === JSON.stringify(atteso);
  passa ? ok++ : ko++;
  if (verbose || !passa) console.log((passa ? '  ok   ' : '  ERRORE ') + nome + ': ' + JSON.stringify(valore) + (passa ? '' : ' (atteso ' + JSON.stringify(atteso) + ')'));
}
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const ADESSO = '2026-11-12T10:00:00.000Z';

const pr = E.progettoEsempio();
const [cptu, spt] = pr.prove;
const [sCpt, sSpt] = pr.scenari;
// Copia dell'esempio con un tratto non indagato (12,0–12,6 m) e una lettura fs mancante a 6,30 m
const difettosa = P.copia(cptu);
difettosa.dati = difettosa.dati.filter(d => !(d[0] > 12.0 && d[0] < 12.6));
difettosa.dati.find(d => d[0] === 6.3)[2] = null;
const rDif = F.calcolaScenario(difettosa, sCpt, L, { adesso: ADESSO });

// ---------------------------------------------------------------------------
console.log('1. Ogni riga calcolata coincide con il motore chiamato con gli stessi input');
function confrontaConMotore(prova, sc, nome) {
  const r = F.calcolaScenario(prova, sc, L, { adesso: ADESSO });
  check(nome + ': stato', r.stato, 'calcolato');
  let diversi = 0, nonFiniti = 0, n = 0;
  for (const x of r.righe) {
    if (x.stato !== 'calcolato') { if (x.valori && isNum(x.valori.FS)) diversi++; continue; }
    n++;
    const t = L.tensioni(sc.strati, sc.zFalda, x.z);
    const d = x.ingresso;
    const sis = { amax: sc.amax, Mw: sc.Mw };
    let e;
    if (sc.metodo === 'bi2014Cpt') {
      const p = { z: x.z, qc: d.qc, fs: d.fs, sv: t.sv, sve: t.sve };
      if (prova.tipo === 'CPTU') p.u2 = d.u2;
      const o = { tipo: prova.tipo, IcSoglia: sc.opzioni.IcSoglia, CFC: sc.opzioni.CFC };
      if (prova.tipo === 'CPTU' && isNum(prova.parametri.ar)) o.ar = prova.parametri.ar;
      if (x.origineFC && x.origineFC.startsWith('assegnato')) p.FC = x.FC;
      e = L.bi2014Cpt(p, sis, o);
    } else if (sc.metodo === 'bi2014Spt') {
      e = L.bi2014Spt({ z: x.z, N: d.N, FC: x.FC, sv: t.sv, sve: t.sve }, sis, { CE: prova.parametri.CE, CB: prova.parametri.CB, CS: prova.parametri.CS, sporgenza: prova.parametri.sporgenza });
    } else if (sc.metodo === 'cetin2018Spt') {
      e = L.cetin2018Spt({ z: x.z, N: d.N, FC: x.FC, sv: t.sv, sve: t.sve }, sis, { CE: prova.parametri.CE, CB: prova.parametri.CB, CS: prova.parametri.CS, sporgenza: prova.parametri.sporgenza }, { Vs12: sc.opzioni.Vs12 });
    } else {
      const p = { z: x.z, Vs: d.Vs, sv: t.sv, sve: t.sve };
      if (x.FC !== null) p.FC = x.FC;
      e = L.kayen2013Vs(p, sis, { Vs12: sc.opzioni.Vs12 });
    }
    if (e.stato !== 'calcolato' || e.FS !== x.valori.FS || e.CSR !== x.valori.CSR) diversi++;
    if (!isNum(x.valori.FS)) nonFiniti++;
  }
  check(nome + ': righe diverse dal motore (su ' + n + ')', diversi, 0);
  check(nome + ': FS non finiti tra i calcolati', nonFiniti, 0);
  return r;
}
const rCpt = confrontaConMotore(cptu, sCpt, 'CPTU esempio');
const rSpt = confrontaConMotore(spt, sSpt, 'SPT esempio B&I');
const sCetin = { ...P.copia(sSpt), metodo: 'cetin2018Spt' };
confrontaConMotore(spt, sCetin, 'SPT esempio Cetin');
{
  const vs = P.nuovaProva('VS', 'Vs sintetica');
  vs.dati = [[2, 150], [3, 160], [4, 165], [5, 170], [6, 180], [8, 200], [10, 230]];
  const s = { ...P.copia(sSpt), id: 'vs1', provaId: vs.id, metodo: 'kayen2013Vs' };
  confrontaConMotore(vs, s, 'Vs Kayen');
}

// ---------------------------------------------------------------------------
console.log('2. Intervalli: sopra falda, dati mancanti, non applicabili, fuori stratigrafia');
{
  const sopra = rCpt.righe.filter(x => x.z <= sCpt.zFalda);
  // sopra falda nessun FS: NON_SATURO, oppure Ic oltre soglia se il motore lo rileva prima
  check('CPTU: righe sopra falda tutte non calcolate', sopra.every(x => x.stato === 'non_applicabile' && ['NON_SATURO', 'IC_OLTRE_SOGLIA'].includes(x.codice) && !x.valori?.FS), true);
  check('CPTU: sabbia sopra falda → NON_SATURO', rCpt.righe.filter(x => x.z < 1.2).every(x => x.codice === 'NON_SATURO'), true);
  const manc = rDif.righe.find(x => x.z === 6.3);
  check('CPTU: lettura mancante → dati insufficienti', [manc.stato, manc.codice], ['dati_insufficienti', 'DATO_MANCANTE']);
  check('CPTU: lettura mancante senza valori', manc.valori, undefined);
  check('CPTU: nessuna riga tra 12,0 e 12,6 m (non indagato)', rDif.righe.some(x => x.z > 12.0 && x.z < 12.6), false);
  const argilla = rCpt.righe.filter(x => x.z > 12.6 && x.z < 15.6);
  check('CPTU: argilla limosa → Ic oltre soglia', argilla.length > 100 && argilla.every(x => x.codice === 'IC_OLTRE_SOGLIA'), true);
  const s2 = P.copia(sCpt); s2.strati = s2.strati.filter(s => s.a <= 12.4);
  const r2 = F.calcolaScenario(cptu, s2, L, { adesso: ADESSO });
  const fuori = r2.righe.filter(x => x.z > 12.4);
  check('stratigrafia fino a 12,4 m: righe oltre → fuori stratigrafia', fuori.length > 0 && fuori.every(x => x.stato === 'dati_insufficienti' && x.codice === 'FUORI_STRATIGRAFIA'), true);
  const s3 = P.copia(sSpt); s3.strati.forEach(s => { s.FC = null; });
  const sptSenzaFC = P.copia(spt); sptSenzaFC.colonne = ['z', 'N']; sptSenzaFC.dati = sptSenzaFC.dati.map(d => d.slice(0, 2));
  const r3 = F.calcolaScenario(sptSenzaFC, s3, L, { adesso: ADESSO });
  check('SPT senza FC → dati insufficienti, nessun FS', r3.righe.filter(x => x.z > 2).every(x => x.stato === 'dati_insufficienti' && x.codice === 'FC_MANCANTE'), true);
  const q = rCpt.riepilogo;
  check('riepilogo: profondità indagata', q.profonditaIndagata, { da: 0.6, a: 18.4 });
  check('riepilogo: punti totali = righe', q.punti, cptu.dati.length);
  check('riepilogo: somma dei conteggi', Object.values(q.conteggi).reduce((a, b) => a + b, 0), q.punti);
  const fsCalc = rCpt.righe.filter(x => x.stato === 'calcolato').map(x => x.valori.FS);
  check('riepilogo: FS minimo = minimo dei calcolati', q.fsMin.FS, Math.min(...fsCalc));
  check('riepilogo: SPT dichiara punti discreti', rSpt.riepilogo.assunzioni.some(a => a.codice === 'SPT_PUNTI_DISCRETI'), true);
}

// ---------------------------------------------------------------------------
console.log('3. Controlli dello scenario');
{
  const s = P.copia(sCpt); s.Mw = null; s.zFalda = null;
  const r = F.calcolaScenario(cptu, s, L, { adesso: ADESSO });
  check('Mw e falda mancanti: input non validi', [r.stato, r.errori.map(e => e.campo).sort()], ['input_non_valido', ['Mw', 'zFalda']]);
  check('nessuna riga calcolata', r.righe.length, 0);
  const s2 = P.copia(sCpt); s2.strati[1].da = 3;
  check('stratigrafia con vuoto', F.calcolaScenario(cptu, s2, L).errori.some(e => e.codice === 'VUOTO'), true);
  const s3 = P.copia(sCpt); s3.metodo = 'bi2014Spt';
  check('metodo non compatibile', F.calcolaScenario(cptu, s3, L).errori.some(e => e.codice === 'NON_COMPATIBILE'), true);
  const s4 = P.copia(sSpt); s4.metodo = 'cetin2018Spt'; s4.opzioni.Vs12 = null;
  check('Cetin senza Vs12', F.calcolaScenario(spt, s4, L).errori.some(e => e.campo === 'opzioni.Vs12'), true);
  for (const v of [0.9, 3.5, NaN]) { const s6 = P.copia(sCpt); s6.opzioni.FSrif = v; check('FS di riferimento ' + v + ' rifiutato', F.calcolaScenario(cptu, s6, L).errori.some(e => e.campo === 'opzioni.FSrif'), true); }
  const s7 = P.copia(sCpt); s7.opzioni.FSrif = null;
  check('FS di riferimento assente → predefinito 1,25', [F.calcolaScenario(cptu, s7, L).stato, F.fsRiferimento(s7)], ['calcolato', 1.25]);
  check('esempio: FS di riferimento 1,25', F.fsRiferimento(sCpt), 1.25);
  check('criterio: NTC, Circolare, EN 1998-5 e JRC citati', ['§ 7.11.3.4', 'C7.11.3.4', 'EN 1998-5, § 4.1.4', '2012, § 4.5', '1,25'].every(t => F.criterioFS(sCpt).includes(t)), true);
  const s8 = P.copia(sCpt); s8.opzioni.FSrif = 1.5;
  check('criterio: valore diverso dichiarato come scelta del progettista', F.criterioFS(s8).includes('ha adottato FS di riferimento = 1,5'), true);
  const vecchio = P.copia(pr); delete vecchio.scenari[0].opzioni.FSrif;
  check('progetto senza FSrif: riaperto con 1,25', P.apriProgetto(JSON.stringify(vecchio)).progetto.scenari[0].opzioni.FSrif, 1.25);
  const s5 = P.copia(sCpt); s5.zFalda = -1;
  check('falda sopra p.c.', F.calcolaScenario(cptu, s5, L).errori.some(e => e.codice === 'FALDA_SOPRA_PC'), true);
}

// ---------------------------------------------------------------------------
console.log('4. Firma degli input e ricalcolo');
{
  const f0 = P.firmaInput(cptu, sCpt, L.VERSIONE_MOTORE);
  check('firma stabile', P.firmaInput(P.copia(cptu), P.copia(sCpt), L.VERSIONE_MOTORE), f0);
  for (const [nome, mod] of [['falda', s => { s.zFalda = 3; }], ['amax', s => { s.amax = 0.2; }], ['Mw', s => { s.Mw = 6; }],
    ['strato', s => { s.strati[1].gammaSat = 20; }], ['opzione', s => { s.opzioni.IcSoglia = 2.4; }]]) {
    const s = P.copia(sCpt); mod(s);
    check('firma cambia con ' + nome, P.firmaInput(cptu, s, L.VERSIONE_MOTORE) !== f0, true);
  }
  const p2 = P.copia(cptu); p2.dati[50][1] += 0.01;
  check('firma cambia con un dato della prova', P.firmaInput(p2, sCpt, L.VERSIONE_MOTORE) !== f0, true);
  const p3 = P.copia(cptu); p3.unita.qc = 'kPa';
  check('firma cambia con l\'unità', P.firmaInput(p3, sCpt, L.VERSIONE_MOTORE) !== f0, true);
  check('firma cambia con la versione del motore', P.firmaInput(cptu, sCpt, '9.9.9') !== f0, true);
  { const s = P.copia(sCpt); s.opzioni.FSrif = 1.5; check('FS di riferimento non cambia la firma (solo lettura)', P.firmaInput(cptu, s, L.VERSIONE_MOTORE), f0); }
  check('nome e note non cambiano la firma', P.firmaInput(cptu, { ...P.copia(sCpt), nome: 'x', note: 'y' }, L.VERSIONE_MOTORE), f0);
  // falda diversa: tensioni ricalcolate e dominio diverso
  const s = P.copia(sCpt); s.zFalda = 3.0;
  const r = F.calcolaScenario(cptu, s, L, { adesso: ADESSO });
  const a = rCpt.righe.find(x => x.z === 5), b = r.righe.find(x => x.z === 5);
  check('falda 3 m: σ\'v a 5 m maggiore', b.tensioni.sve > a.tensioni.sve, true);
  check('falda 3 m: u a 5 m = 2·γw', Math.abs(b.tensioni.u - 2 * 9.81) < 1e-9, true);
  check('falda 3 m: FS a 5 m cambia', b.valori.FS !== a.valori.FS, true);
  const d = F.confrontaDominio(rCpt, r);
  check('dominio diverso segnalato', d.uguale, false);
  const aSopra3 = rCpt.riepilogo.zCalcolate.filter(z => z <= 3);
  check('falda 3 m: i punti calcolati entro 3 m stanno solo nel primo', d.soloA.length > 0 && aSopra3.every(z => d.soloA.includes(Number(z.toFixed(4)))), true);
  check('falda 3 m: nessun punto calcolato entro 3 m nel secondo', r.riepilogo.zCalcolate.some(z => z <= 3), false);
  check('dominio uguale con sé stesso', F.confrontaDominio(rCpt, rCpt).uguale, true);
}

// ---------------------------------------------------------------------------
console.log('5. Serie per i grafici');
{
  const sr = F.serie(rDif, 'FS');
  const calc = rDif.righe.filter(x => x.stato === 'calcolato');
  check('punti FS = righe calcolate', sr.punti.length, calc.length);
  check('nessun punto FS su righe non calcolate', sr.punti.every(p => rDif.righe[p.indice].stato === 'calcolato'), true);
  check('segmenti interrotti (lettura mancante, argilla, vuoto 12–12,6 m)', sr.segmenti.length >= 4, true);
  const sv = sr.segmenti.find(sg => sg.some(p => p.y === 6.28));
  check('il segmento che contiene 6,28 m non contiene 6,32 m (6,30 mancante)', sv.some(p => p.y === 6.32), false);
  const q = F.serie(rDif, 'qc', 'ingresso');
  check('dati misurati qc: tutte le letture con qc', q.punti.length, difettosa.dati.length);
  const vuoto = q.segmenti.find(sg => sg.some(p => p.y === 12.0));
  check('qc: nessuna linea attraverso il vuoto 12,0–12,6 m', vuoto.some(p => p.y >= 12.6), false);
  check('valori invariati (FS)', sr.punti.every(p => p.x === rDif.righe[p.indice].valori.FS), true);
}

// ---------------------------------------------------------------------------
console.log('6. Importazione');
{
  const testo = 'Prof [m];qc [MPa];fs [kPa];u2 [kPa]\n1,0;2,5;30;0\n1,1;2,6;;5\n1,2;2,7;32;6\n';
  const div = I.dividi(testo);
  check('separatore riconosciuto', div.separatore, ';');
  check('intestazione riconosciuta', I.haIntestazione(div.righe, ','), true);
  const mappa = I.proponiColonne(div.righe[0], 'CPTU');
  check('colonne proposte', [mappa.z, mappa.qc, mappa.fs, mappa.u2], [0, 1, 2, 3]);
  const r = I.costruisciDati(div.righe, { tipo: 'CPTU', mappa, unita: { z: 'm', qc: 'MPa', fs: 'kPa', u2: 'kPa' }, decimale: ',', saltaIntestazione: true });
  check('lettura ok', r.ok, true);
  check('cella vuota → null', r.dati[1][2], null);
  check('decimale virgola', r.dati[0][1], 2.5);
  const r2 = I.costruisciDati(div.righe, { tipo: 'CPTU', mappa, unita: {}, decimale: '.', saltaIntestazione: true });
  check('decimale dichiarato sbagliato → errori', r2.ok, false);
  check('numero ambiguo con punto e decimale virgola', I.numero('1.234', ',').errore !== undefined, true);
  check('testo non numerico', I.numero('abc', '.').errore !== undefined, true);
  check('stringa vuota → null', I.numero('  ', '.').valore, null);
  const r3 = I.costruisciDati([['1', '2', '3', '0'], ['0.5', '2', '3', '0']], { tipo: 'CPTU', mappa: { z: 0, qc: 1, fs: 2, u2: 3 }, unita: {}, decimale: '.', saltaIntestazione: false });
  check('profondità non crescente → errore', r3.errori.some(e => /non crescente/.test(e.motivo)), true);
  const r4 = I.costruisciDati([['1', '2']], { tipo: 'CPTU', mappa: { z: 0, qc: 1, fs: null, u2: null }, unita: {}, decimale: '.' });
  check('colonna obbligatoria non associata', r4.ok, false);
  const tab = I.dividi('z\tN\n1.5\t9\n3.0\t7');
  check('tabulazione riconosciuta', tab.separatore, '\t');
  check('virgolette rispettate', I.dividi('"a;b";c', ';').righe[0], ['a;b', 'c']);
  // conversione di unità: qc in kPa dà gli stessi risultati di qc in MPa
  const pk = P.copia(cptu); pk.unita.qc = 'kPa'; pk.dati = pk.dati.map(r => [r[0], r[1] === null ? null : r[1] * 1000, r[2], r[3]]);
  const rk = F.calcolaScenario(pk, sCpt, L, { adesso: ADESSO });
  const maxDiff = Math.max(...rk.righe.filter(x => x.stato === 'calcolato').map((x, i) => Math.abs(x.valori.FS - rCpt.righe[x.indice].valori.FS) / rCpt.righe[x.indice].valori.FS));
  check('qc in kPa ≡ qc in MPa (FS, differenza relativa < 1e-12)', maxDiff < 1e-12, true);
  const pc = P.copia(spt); pc.unita.z = 'cm'; pc.dati = pc.dati.map(r => [r[0] * 100, ...r.slice(1)]);
  const rc = F.calcolaScenario(pc, sSpt, L, { adesso: ADESSO });
  check('z in cm ≡ z in m (SPT)', rc.righe.map(x => x.stato === 'calcolato' ? Number(x.valori.FS.toFixed(10)) : x.stato), rSpt.righe.map(x => x.stato === 'calcolato' ? Number(x.valori.FS.toFixed(10)) : x.stato));
}

// ---------------------------------------------------------------------------
console.log('7. Esportazione CSV');
{
  const prx = P.copia(pr); prx.progetto.titolo = '=HYPERLINK("http://x")';
  const csv = X.csvRisultati(prx, cptu, sCpt, rCpt);
  const righe = csv.trim().split('\r\n');
  const inizio = righe.findIndex(r => r.startsWith('z [m]'));
  check('righe di dati = righe del risultato', righe.length - inizio - 1, rCpt.righe.length);
  const nCol = righe[inizio].split(';').length;
  check('stesso numero di colonne in ogni riga', righe.slice(inizio).every(r => r.split(';').length === nCol), true);
  check('titolo protetto dalla formula', righe[1].includes("'=HYPERLINK"), true);
  check('testo con virgolette racchiuso', righe[1].includes('"\'=HYPERLINK(""http://x"")"'), true);
  const intest = righe[inizio].split(';');
  const iFS = intest.indexOf('FS'), iStato = intest.indexOf('stato');
  const rigaNS = righe[inizio + 1].split(';');
  check('riga non calcolata: FS vuoto, non zero', rigaNS[iFS], '');
  check('riga non calcolata: stato', rigaNS[iStato], 'non_applicabile');
  const prima = rCpt.righe.findIndex(x => x.stato === 'calcolato');
  const val = righe[inizio + 1 + prima].split(';')[iFS];
  check('FS a precisione piena (virgola decimale)', Number(val.replace(',', '.')), rCpt.righe[prima].valori.FS);
  check('motore e firma nell\'intestazione', csv.includes(L.VERSIONE_MOTORE) && csv.includes(rCpt.firma), true);
  check('esempio dichiarato', csv.includes('ESEMPIO SINTETICO'), true);
  const csv2 = X.csvRisultati(pr, cptu, sCpt, rCpt, { separatore: ',', decimale: '.' });
  check('separatore virgola: decimale punto', csv2.split('\r\n')[inizio + 1 + prima].split(',')[0], String(rCpt.righe[prima].z));
  check('numero negativo non trattato come formula', X.cella(-1.5, { separatore: ';', decimale: ',' }), '-1,5');
  check('testo «-x» protetto', X.cella('-x', { separatore: ';', decimale: ',' }), "'-x");
  check('NaN → cella vuota', X.cella(NaN, { separatore: ';', decimale: ',' }), '');
}

// ---------------------------------------------------------------------------
console.log('8. Salvataggio e riapertura del progetto');
{
  const prs = P.copia(pr); prs.risultati = { [sCpt.id]: rCpt };
  const testo = P.salvaProgetto(prs);
  const a = P.apriProgetto(testo);
  check('riapertura ok', a.ok, true);
  check('input identici', JSON.stringify({ ...a.progetto, risultati: undefined }), JSON.stringify({ ...prs, risultati: undefined }));
  check('risultati del file marcati', a.progetto.risultati[sCpt.id].origine, 'file');
  const r2 = F.calcolaScenario(a.progetto.prove[0], a.progetto.scenari[0], L, { adesso: ADESSO });
  check('ricalcolo dopo riapertura identico', JSON.stringify(r2.righe), JSON.stringify(rCpt.righe));
  check('firma identica dopo riapertura', r2.firma, rCpt.firma);
  check('JSON non valido', P.apriProgetto('{').ok, false);
  check('formato sbagliato', P.apriProgetto(JSON.stringify({ ...prs, formato: 'altro' })).ok, false);
  check('versione non supportata', P.apriProgetto(JSON.stringify({ ...prs, versioneFormato: 99 })).ok, false);
  const b = P.copia(prs); b.prove[0].dati[3][1] = '2,5';
  check('stringa nei dati rifiutata', P.apriProgetto(JSON.stringify(b)).ok, false);
  const c = P.copia(prs); c.prove[0].tipo = 'CPT';
  check('tipo di prova sconosciuto rifiutato', P.apriProgetto(JSON.stringify(c)).ok, false);
  const d = P.copia(prs); d.scenari[0].metodo = 'kayen2013Vs';
  check('metodo incompatibile rifiutato', P.apriProgetto(JSON.stringify(d)).ok, false);
  const e = P.copia(prs); e.prove[0].unita.qc = 'bar';
  check('unità non ammessa rifiutata', P.apriProgetto(JSON.stringify(e)).ok, false);
  const f = P.copia(prs); f.scenari[0].provaId = 'nessuna';
  check('scenario senza prova rifiutato', P.apriProgetto(JSON.stringify(f)).ok, false);
  const g = P.copia(prs); g.prove[0].dati[0] = [1, 2];
  check('riga con numero di valori errato rifiutata', P.apriProgetto(JSON.stringify(g)).ok, false);
}

console.log('\nRisultato: ' + ok + ' controlli superati, ' + ko + ' non superati.');
process.exit(ko ? 1 : 0);
