#!/usr/bin/env node
/*
 * verifica_addensamento.mjs — punti oltre il campo della correlazione per addensamento
 * (audit v1.0.0, B1; soglie approvate il 25/11/2026, scelta di LiquiSite non indicata dagli autori):
 * Boulanger & Idriss (2014) con qc1Ncs > 211 (CPT) o (N1)60cs > 37 (SPT) → 'non_applicabile',
 * codice OLTRE_CAMPO_ADDENSAMENTO, nessun CRR/FS/PL; indice IL con F = 0, cedimento con εv = 0;
 * il criterio 3 della verifica preliminare usa ancora la resistenza normalizzata di questi punti.
 *
 * Uso:   node verifiche/verifica_addensamento.mjs [--verbose]
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const L = require('../motore/liquisite.js');
const IND = require('../motore/indici.js');
const CED = require('../motore/cedimenti.js');
const P = require('../app/progetto.js');
const F = require('../app/profilo.js');
const X = require('../app/esclusione.js');
const XP = require('../app/esporta.js');
const E = require('../app/esempio.js');

const verbose = process.argv.includes('--verbose');
let ok = 0, ko = 0;
function check(nome, valore, atteso) {
  const passa = JSON.stringify(valore) === JSON.stringify(atteso);
  passa ? ok++ : ko++;
  if (verbose || !passa) console.log((passa ? '  ok   ' : '  ERRORE ') + nome + ': ' + JSON.stringify(valore) + (passa ? '' : ' (atteso ' + JSON.stringify(atteso) + ')'));
}
const STRATO = [{ da: 0, a: 20, gamma: 18, gammaSat: 19 }];
const SISMA = { amax: 0.25, Mw: 6.5 };
const VERT = { CE: 1, CB: 1, CS: 1, sporgenza: 1 };
const cpt = (z, qc, fs, zw = 1) => { const t = L.tensioni(STRATO, zw, z); return L.bi2014Cpt({ z, qc, fs, sv: t.sv, sve: t.sve }, SISMA, { tipo: 'CPTE' }); };
const spt = (z, N, FC = 5, zw = 1) => { const t = L.tensioni(STRATO, zw, z); return L.bi2014Spt({ z, N, FC, sv: t.sv, sve: t.sve }, SISMA, VERT); };

console.log('1. Motore: soglie e contenuto del risultato');
{
  check('soglie esportate', L.SOGLIE_ADDENSAMENTO_BI, { qc1Ncs: 211, N160cs: 37 });
  // ricerca del qc che porta qc1Ncs a cavallo di 211 (a 3,5 m, fs = 1 % di qc)
  let a = 5, b = 40;
  for (let k = 0; k < 60; k++) { const m = (a + b) / 2, r = cpt(3.5, m, m * 10); (r.qc1Ncs ?? r.diagnostica?.qc1Ncs) > 211 ? b = m : a = m; }
  const sotto = cpt(3.5, a - 0.01, (a - 0.01) * 10), sopra = cpt(3.5, b + 0.01, (b + 0.01) * 10);
  check('CPT appena sotto 211: calcolato', [sotto.stato, sotto.qc1Ncs <= 211], ['calcolato', true]);
  check('CPT appena sotto la soglia: qc1Ncs > 210 e CRR7,5 tra 3,5 e 3,725', [sotto.qc1Ncs > 210, sotto.CRR75 > 3.5 && sotto.CRR75 <= 3.7246], [true, true]);
  check('messaggio con il CRR7,5 alla soglia', /alla soglia CRR7,5 = 3,72/.test(sopra.motivo) && /alla soglia CRR7,5 = 1,75/.test(spt(6, 60).motivo), true);
  check('CPT appena sopra 211: oltre il campo', [sopra.stato, sopra.codice], ['non_applicabile', 'OLTRE_CAMPO_ADDENSAMENTO']);
  check('CPT oltre il campo: nessun CRR, FS, PL', [sopra.CRR, sopra.CRR75, sopra.FS, sopra.PL], [undefined, undefined, undefined, undefined]);
  check('CPT oltre il campo: normalizzazione e domanda conservate', ['qc1N', 'qc1Ncs', 'CN', 'Ic', 'rd', 'CSR', 'Ksigma', 'MSF'].every(k => Number.isFinite(sopra[k])), true);
  check('CPT oltre il campo: motivo con soglia e fonte', /qc1Ncs = [\d,]+ > 211.*Soglia scelta da LiquiSite.*Eq\. 2\.16/.test(sopra.motivo), true);
  const rifiuto = [28, 55, 62, 80, 100].map(qc => cpt(3.5, qc, qc * 5).codice);
  check('CPT da 28 a 100 MPa (fino al rifiuto): mai errore numerico', rifiuto, Array(5).fill('OLTRE_CAMPO_ADDENSAMENTO'));
  check('CPT molto addensata sopra falda: NON_SATURO', cpt(3.5, 62, 300, 5).codice, 'NON_SATURO');
  const n36 = spt(6, 28), n40 = spt(6, 40);
  check('SPT (N1)60cs ≤ 37: calcolato', [n36.stato, n36.N160cs <= 37], ['calcolato', true]);
  check('SPT (N1)60cs > 37: oltre il campo', [n40.stato, n40.codice, n40.N160cs > 37, n40.FS], ['non_applicabile', 'OLTRE_CAMPO_ADDENSAMENTO', true, undefined]);
  check('SPT N = 100: oltre il campo, nessun errore numerico', spt(6, 100).codice, 'OLTRE_CAMPO_ADDENSAMENTO');
}

console.log('2. Indice IL e cedimento');
{
  const il = IND.indiceIL([{ z: 2, categoria: 'FS', FS: 0.5 }, { z: 3, categoria: 'addensato' }, { z: 4, categoria: 'FS', FS: 0.5 }], 1, { vuotoMax: 5 });
  const tratto = il.tratti.find(t => t.categoria === 'addensato');
  check('categoria «addensato» accettata, F = 0', [il.stato, tratto && tratto.F, tratto && tratto.contributo], ['calcolato', 0, 0]);
  check('spessore «addensato» riportato a parte', il.spessori.addensato, 1);
  check('assunzione dichiarata (IL_ADDENSATO)', il.assunzioni.some(a => a.codice === 'IL_ADDENSATO' && /scelte da LiquiSite/.test(a.descrizione)), true);
  const ced = CED.cedimento([{ z: 2, categoria: 'FS', FS: 0.5, qc1Ncs: 80 }, { z: 3, categoria: 'addensato' }, { z: 4, categoria: 'FS', FS: 0.5, qc1Ncs: 80 }], 1, { vuotoMax: 5 });
  const tc = ced.tratti.find(t => t.categoria === 'addensato');
  check('cedimento: εv = 0 nel tratto addensato', [tc.epsMin, tc.epsMax], [0, 0]);

  // esempio CPTU con un livello al rifiuto a 3,50 m (audit B1.b)
  const pr = E.progettoEsempio(), pv = pr.prove[0], sc = pr.scenari[0];
  const i = pv.dati.findIndex(d => Math.abs(d[0] - 3.5) < 1e-9);
  const conQc = (qc) => { const c = P.copia(pv); c.dati[i][1] = qc; return F.calcolaScenario(c, sc, L); };
  const r62 = conQc(62), r28 = conQc(28);
  check('esempio, rifiuto a 3,50 m: riga oltre il campo', [r62.righe[i].stato, r62.righe[i].codice], ['non_applicabile', 'OLTRE_CAMPO_ADDENSAMENTO']);
  check('esempio, rifiuto a 3,50 m: stessi IL e cedimento di qc = 28 MPa (punto non liquefacibile in entrambi)',
    [r62.indiceIL.ILmin, r62.indiceIL.ILmax, r62.cedimenti.Smin, r62.cedimenti.Smax], [r28.indiceIL.ILmin, r28.indiceIL.ILmax, r28.cedimenti.Smin, r28.cedimenti.Smax]);
  check('esempio, rifiuto: nessun tratto «senza risultato» in più rispetto all\'esempio originale',
    r62.indiceIL.spessori.ignoto, F.calcolaScenario(pv, sc, L).indiceIL.spessori.ignoto);
  check('esempio, rifiuto: spessore addensato > 0', r62.indiceIL.spessori.addensato > 0, true);
  check('riga: resistenza normalizzata e CSR nei valori, FS no', [Number.isFinite(r62.righe[i].valori.qc1Ncs), Number.isFinite(r62.righe[i].valori.CSR), r62.righe[i].valori.FS], [true, true, null]);
  check('grafico qc1Ncs: il punto addensato c\'è', F.serie(r62, 'qc1Ncs', 'valori').punti.some(p => p.y === 3.5), true);
  check('grafico FS: il punto addensato non c\'è', F.serie(r62, 'FS', 'valori').punti.some(p => p.y === 3.5), false);
  check('tabelle: FS non esposto, qc1Ncs sì', [F.valoreRisultato(r62.righe[i], 'FS'), Number.isFinite(F.valoreRisultato(r62.righe[i], 'qc1Ncs'))], [null, true]);
  check('FS minimo del riepilogo invariato', r62.riepilogo.fsMin, r28.riepilogo.fsMin);
  const csv = XP.csvRisultati(pr, pv, sc, r62);
  check('CSV: riga con il codice e senza FS', csv.split('\n').some(l => /^3,5;/.test(l) && /OLTRE_CAMPO_ADDENSAMENTO|molto addensato/.test(l)), true);
}

console.log('3. Criterio 3 della verifica preliminare: i punti addensati contano');
{
  const b = P.nuovaProva('SPT', 'c3');
  b.colonne = ['z', 'N', 'FC']; b.unita.FC = '%';
  b.dati = []; for (let z = 1.5; z <= 19.5; z += 1) b.dati.push([z, 60, 3]);
  b.parametri = { CE: 1, CB: 1, CS: 1, sporgenza: 1, senzaRivestimento: false };
  const s = P.nuovoScenario(b, 'c3', 0);
  Object.assign(s, { metodo: 'bi2014Spt', Mw: 6.5, amax: 0.25, zFalda: 1, strati: [{ id: 'strato-1', da: 0, a: 20, gamma: 18, gammaSat: 19, FC: 3 }] });
  X.aggiornaStrato(s, s.strati[0], { sabbiaPulita: true });
  const r = F.calcolaScenario(b, s, L);
  check('tutti i punti oltre il campo', r.righe.every(x => x.codice === 'OLTRE_CAMPO_ADDENSAMENTO'), true);
  const c3 = X.valutaEsclusione(L, b, s, r).strati[0].c3;
  check('criterio 3 valutato sui punti addensati', [c3.stato, c3.soddisfatto, c3.mancanti], ['valutato', true, 0]);
  check('indice IL nullo e completo', [r.indiceIL.ILmin, r.indiceIL.ILmax], [0, 0]);
}

console.log('4. Kayen 2013 (Vs): Vs1 > 277 m/s oltre il campo (audit B1.c, scelta di LiquiSite approvata il 25/11/2026)');
{
  const t = L.tensioni(STRATO, 1, 10), cvs = Math.min(Math.pow(100 / t.sve, 0.25), 1.5);
  const kay = (vs1, zw = 1) => { const tt = L.tensioni(STRATO, zw, 10); return L.kayen2013Vs({ z: 10, Vs: vs1 / cvs, FC: 0, sv: tt.sv, sve: tt.sve }, SISMA, { Vs12: 200 }); };
  check('soglia esportata', L.SOGLIA_ADDENSAMENTO_KAYEN, { Vs1: 277 });
  check('Vs1 = 277,00: calcolato (soglia stretta)', [kay(277).stato, Math.abs(kay(277).Vs1 - 277) < 1e-9], ['calcolato', true]);
  check('Vs1 = 277,01: oltre il campo', [kay(277.01).stato, kay(277.01).codice], ['non_applicabile', 'OLTRE_CAMPO_ADDENSAMENTO']);
  const o = kay(800);
  check('Vs1 = 800: oltre il campo, nessun CRR, FS, PL', [o.stato, o.CRR15, o.FS, o.PL], ['non_applicabile', undefined, undefined, undefined]);
  check('oltre il campo: Vs1, CSR, rd e DWF conservati', ['Vs1', 'CVs', 'rd', 'CSR', 'DWF'].every(k => Number.isFinite(o[k])), true);
  check('messaggio: soglia, CRR7,5 = 2,02, scelta di LiquiSite, dati della Tab. S1', /Vs1 = 800,00 m\/s > 277 m\/s/.test(o.motivo) && /CRR7,5 = 2,02/.test(o.motivo) && /scelta da LiquiSite, non un limite pubblicato/.test(o.motivo) && /328,62/.test(o.motivo) && /non è un'esclusione/i.test(o.motivo), true);
  check('sopra falda prevale NON_SATURO', kay(800, 10).codice, 'NON_SATURO');
  check('CRR a PL 15 % alla soglia ≈ 2,02 (Mw 7,5, σ\'v0 100 kPa, FC 0)', Math.abs(Math.exp((Math.pow(0.0073 * 277, 2.8011) - 2.6168 * Math.log(7.5) - 0.0099 * Math.log(100) + 0.4809 * L.PhiInv(0.15)) / 1.946) - 2.02) < 0.005, true);
  // profilo Vs completo
  const b = P.nuovaProva('VS', 'kay'); b.colonne = ['z', 'Vs'];
  b.dati = [[2, 150], [4, 180], [6, 400], [8, 220], [10, 800]];
  const s = P.nuovoScenario(b, 'kay', 0);
  Object.assign(s, { metodo: 'kayen2013Vs', Mw: 6.5, amax: 0.25, zFalda: 1, strati: [{ id: 'strato-1', da: 0, a: 12, gamma: 18, gammaSat: 19, FC: 5 }] }); s.opzioni.Vs12 = 200;
  const r = F.calcolaScenario(b, s, L);
  const righe = r.righe.map(x => x.codice || x.stato);
  check('profilo Vs: punti a 6 e 10 m oltre il campo', [righe[2], righe[4]], ['OLTRE_CAMPO_ADDENSAMENTO', 'OLTRE_CAMPO_ADDENSAMENTO']);
  check('profilo Vs: FS non esposto, Vs1 e CSR sì', [F.valoreRisultato(r.righe[2], 'FS'), Number.isFinite(F.valoreRisultato(r.righe[2], 'Vs1')), Number.isFinite(F.valoreRisultato(r.righe[2], 'CSR'))], [null, true, true]);
  check('IL: spessore «addensato» > 0, nessuna estensione ad «ignoto»', [r.indiceIL.spessori.addensato > 0, r.indiceIL.spessori.addensato + r.indiceIL.spessori.ignoto <= 20 + 1e-9], [true, true]);
  const senza = F.calcolaScenario(Object.assign(P.copia(b), { dati: [[2, 150], [4, 180], [6, 270], [8, 220], [10, 270]] }), s, L);
  check('IL: il tratto addensato ha F = 0 (IL non maggiore di quello con Vs prossime alla soglia)', r.indiceIL.ILmax <= senza.indiceIL.ILmax + 1e-9, true);
}

console.log('\nRisultato: ' + ok + ' controlli superati, ' + ko + ' non superati.');
process.exit(ko ? 1 : 0);
