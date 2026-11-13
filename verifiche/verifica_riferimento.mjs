#!/usr/bin/env node
/*
 * verifica_riferimento.mjs — confronto con un calcolo pubblicato da terzi.
 * Fonte: National Academies of Sciences, Engineering, and Medicine (2024). Pile Design for
 * Downdrag: Examples and Supporting Materials. Appendix G, Design Example 5 (Blytheville, AR),
 * Evento 1 (amax 0,1 g, Mw 6,5), metodo di Boulanger e Idriss (2014) da CPT.
 * Dati: verifiche/dati/nasem2024-blytheville.json, estratti dal PDF (Tabelle G3, G5, G6, G7).
 *
 * Come si confronta:
 *  - ingresso di ogni riga: qt e fs della Tabella G3; σv0 dalla Tabella G5 (la colonna è
 *    etichettata σ'v0 ma contiene la tensione totale: a 24,93 ft il testo dà σv0 = 2758 psf e
 *    σ'v0 = 1263 psf); σ'v0 = σv0 − u0 con falda a 1 ft, come nel testo;
 *  - FC imposto = 80·Ic − 137 con l'Ic pubblicato: l'esempio calcola Ic con l'iterazione di
 *    Robertson (2009), il motore con la regola di Robertson e Wride (1998) adottata da B&I
 *    2014; imponendo lo stesso FC si confronta il resto della catena;
 *  - righe sotto falda con (qc1N)cs pubblicato < 254 (l'esempio limita (qc1N)cs a 254 anche
 *    fuori dall'esponente m, il motore solo nell'esponente, come in B&I 2014 pag. 10) e,
 *    per CRR, con CRR7,5 < 2 (l'esempio limita CRR7,5 a 2,0); profondità entro 20 m, limite
 *    di LiquiSite (la tabella arriva a 83,7 ft).
 * Tolleranze: grandezze a 3 decimali nella tabella → 0,5 %; grandezze a 2 decimali →
 * metà dell'ultima cifra più un margine (0,006), oppure 1 % per i valori maggiori di 1.
 * Uso: node verifiche/verifica_riferimento.mjs [--verbose]
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const L = require('../motore/liquisite.js');
const D = require('./dati/nasem2024-blytheville.json');
const verbose = process.argv.includes('--verbose');
let ok = 0, ko = 0;
function check(nome, passa, info) {
  passa ? ok++ : ko++;
  if (verbose || !passa) console.log((passa ? '  ok   ' : '  ERRORE ') + nome + (info ? ': ' + info : ''));
}
const TSF = 95.7605, PSF = 0.0478803, PCF_W = 62.4, FT = 0.3048;

console.log('1. Calcolo dettagliato a 24,93 ft (Tabella G4)');
{
  const p = { z: 24.93 * FT, sv: 2758 * PSF, sve: 1263 * PSF, qc: 59.929 * TSF / 1000, fs: 0.316 * TSF, FC: 11.5 };
  const r = L.bi2014Cpt(p, D.evento1, { tipo: 'CPTE' });
  const attesi = [['CN', 'CN', 1.32, 0.01], ['qc1N', 'qc1N', 74.0, 0.015], ['Δqc1N', 'dqc1N', 11.0, 0.02], ['qc1Ncs', 'qc1Ncs', 85.0, 0.01],
    ['MSFmax', 'MSFmax', 1.195, 0.005], ['MSF', 'MSF', 1.073, 0.005], ['Cσ', 'Csigma', 0.095, 0.02], ['Kσ', 'Ksigma', 1.05, 0.005],
    ['rd', 'rd', 0.881, 0.005], ['CRR7,5', 'CRR75', 0.12, 0.02], ['CRR al sito', 'CRR', 0.136, 0.01], ['CSR al sito', 'CSR', 0.125, 0.01], ['FS', 'FS', 1.08, 0.015]];
  for (const [nome, k, v, tol] of attesi) check(nome, Math.abs(r[k] - v) <= tol * v, r[k].toFixed(4) + ' (pubblicato ' + v + ')');
}

console.log('2. Profilo intero, Tabelle G3, G5 e G6');
{
  let n = 0, nCRR = 0;
  const peggio = {};
  const rel = (a, b) => Math.abs(a - b) / Math.abs(b);
  const segna = (k, d) => { peggio[k] = Math.max(peggio[k] || 0, d); };
  for (let i = 0; i < D.G3.righe.length; i++) {
    const [z, fs, qt] = D.G3.righe[i], g5 = D.G5.righe[i], g6 = D.G6.righe[i];
    if (z <= D.falda_ft + 0.2 || g5[10] >= 254 || z * FT > L.Z_MAX_APP) continue;
    const sv = g5[2] * PSF, sve = sv - (z - D.falda_ft) * PCF_W * PSF;
    const FC = Math.min(100, Math.max(0, 80 * g5[3] - 137));
    const r = L.bi2014Cpt({ z: z * FT, sv, sve, qc: qt * TSF / 1000, fs: fs * TSF, FC }, D.evento1, { tipo: 'CPTE', IcSoglia: 3.9 });
    if (r.stato !== 'calcolato') { check('riga ' + z + ' ft calcolata', false, r.stato + ' ' + (r.codice || '')); continue; }
    n++;
    segna('CN', rel(r.CN, g5[7])); segna('qc1N', rel(r.qc1N, g5[6])); segna('qc1Ncs', rel(r.qc1Ncs, g5[10]));
    segna('rd', Math.abs(r.rd - g6[1])); segna('Kσ', Math.abs(r.Ksigma - g6[4])); segna('MSF', Math.abs(r.MSF - g6[7])); segna('CSR', Math.abs(r.CSR - g6[10]));
    if (g6[8] < 2) {
      nCRR++;
      const sc = (a, b) => (b > 1 ? rel(a, b) / 0.01 : Math.abs(a - b) / 0.006);
      segna('CRR7,5', sc(r.CRR75, g6[8])); segna('CRR', sc(r.CRR, g6[9]));
    }
  }
  check('righe confrontate (sotto falda, qc1Ncs < 254)', n >= 55, String(n));
  check('righe con CRR confrontato (CRR7,5 < 2)', nCRR >= 35, String(nCRR));
  for (const k of ['CN', 'qc1N', 'qc1Ncs']) check(k + ' entro 0,5 % su ogni riga', peggio[k] <= 0.005, 'scarto massimo ' + (peggio[k] * 100).toFixed(3) + ' %');
  for (const k of ['rd', 'Kσ', 'MSF', 'CSR']) check(k + ' entro l\'arrotondamento a 2 decimali', peggio[k] <= 0.006, 'scarto massimo ' + peggio[k].toFixed(4));
  for (const k of ['CRR7,5', 'CRR']) check(k + ' entro arrotondamento (0,006) o 1 %', peggio[k] <= 1, 'rapporto con la tolleranza ' + peggio[k].toFixed(2));
}

console.log('\nRisultato: ' + ok + ' controlli superati, ' + ko + ' non superati.');
process.exit(ko ? 1 : 0);
