#!/usr/bin/env node
/*
 * verifica_cedimenti.mjs — deformazione volumetrica (Zhang et al. 2002), cedimento e LSN:
 * equazioni dell'Appendice A, convenzioni di interpolazione e di campo, casi analitici,
 * collegamento al profilo, CSV. La seconda implementazione è in verifica_cedimenti.py.
 * Uso: node verifiche/verifica_cedimenti.mjs [--verbose]
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const C = require('../motore/cedimenti.js');
const L = require('../motore/liquisite.js');
const P = require('../app/progetto.js');
const F = require('../app/profilo.js');
const E = require('../app/esempio.js');
const X = require('../app/esporta.js');

const verbose = process.argv.includes('--verbose');
let ok = 0, ko = 0;
function check(nome, valore, atteso) {
  const passa = JSON.stringify(valore) === JSON.stringify(atteso);
  passa ? ok++ : ko++;
  if (verbose || !passa) console.log((passa ? '  ok   ' : '  ERRORE ') + nome + ': ' + JSON.stringify(valore) + (passa ? '' : ' (atteso ' + JSON.stringify(atteso) + ')'));
}
const vicino = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
const eps = (f, q) => C.deformazioneVolumetrica(f, q).epsV;

console.log('1. Equazioni A1–A14 ai valori discreti di FS');
{
  const casi = [[0.5, 50, 102 * 50 ** -0.82], [0.6, 100, 102 * 100 ** -0.82], [0.6, 180, 2411 * 180 ** -1.45], [0.7, 150, 1701 * 150 ** -1.42],
    [0.8, 70, 102 * 70 ** -0.82], [0.8, 120, 1690 * 120 ** -1.46], [0.9, 40, 102 * 40 ** -0.82], [0.9, 90, 1430 * 90 ** -1.48],
    [1.0, 100, 64 * 100 ** -0.93], [1.1, 100, 11 * 100 ** -0.65], [1.2, 100, 9.7 * 100 ** -0.69], [1.3, 100, 7.6 * 100 ** -0.71], [2.0, 100, 0]];
  for (const [f, q, e] of casi) check('FS ' + f + ', (qc1N)cs ' + q, vicino(eps(f, q), e), true);
  check('deformazione limite = 102 · 33^−0,82', vicino(C.EPS_LIMITE, 102 * 33 ** -0.82), true);
  check('deformazione limite ≈ 5,8 % (Fig. 3: circa 5,5 % a 35)', C.EPS_LIMITE > 5.7 && C.EPS_LIMITE < 5.9, true);
  // raccordi tra i due tratti delle curve 0,6–0,9: piccoli salti propri delle equazioni pubblicate (max ≈ 6 % a FS 0,9, q 60)
  for (const [f, q] of [[0.6, 147], [0.7, 110], [0.8, 80], [0.9, 60]]) {
    const k = C.CURVE.findIndex(c => c.FS === f), t = C.CURVE[k].tratti;
    const a = t[0].a * q ** t[0].b, b = t[1].a * q ** t[1].b;
    check('raccordo FS ' + f + ' a ' + q + ': salto < 7 %', Math.abs(a - b) / a < 0.07, true);
  }
}

console.log('2. Convenzioni approvate');
{
  check('FS ≤ 0,5: curva limite', [eps(0.2, 80), eps(0, 80)], [eps(0.5, 80), eps(0.5, 80)]);
  check('FS ≥ 2: zero', [eps(2, 80), eps(3.5, 80)], [0, 0]);
  check('FS 0,65: media delle curve 0,6 e 0,7', vicino(eps(0.65, 120), (eps(0.6, 120) + eps(0.7, 120)) / 2), true);
  check('FS 1,65: metà della curva 1,3', vicino(eps(1.65, 120), eps(1.3, 120) / 2), true);
  check('(qc1N)cs 20 → 33, segnalato', [eps(1.0, 20) === eps(1.0, 33), C.deformazioneVolumetrica(1.0, 20).limitato], [true, 'sotto']);
  check('(qc1N)cs 260 → 200, segnalato', [eps(0.8, 260) === eps(0.8, 200), C.deformazioneVolumetrica(0.8, 260).limitato], [true, 'sopra']);
  let monFS = true, monQ = true;
  // le curve 0,6–0,9 superano di poco la curva limite oltre i raccordi (equazioni pubblicate): tolleranza 3 %
  for (let q = 33; q <= 200; q += 1) for (let f = 0.3; f < 2.1; f += 0.01) if (eps(f + 0.01, q) > eps(f, q) * 1.03 + 1e-9) monFS = false;
  for (let f = 0.5; f <= 2; f += 0.05) for (let q = 33; q < 200; q += 1) if (eps(f, q + 1) > eps(f, q) * 1.07 + 1e-9) monQ = false;
  check('εv non cresce con FS (salvo eccessi < 3 % delle equazioni pubblicate)', monFS, true);
  check('εv non cresce con (qc1N)cs (salvo i raccordi delle equazioni)', monQ, true);
  let eccezioni = 0;
  for (const v of [-1, NaN, Infinity]) { try { C.deformazioneVolumetrica(v, 80); } catch (e) { eccezioni++; } try { C.deformazioneVolumetrica(1, v); } catch (e) { eccezioni++; } }
  check('ingressi non validi rifiutati', eccezioni, 6);
}

console.log('3. Casi analitici di cedimento e LSN');
{
  // strato uniforme 2–5 m: un punto ogni 0,1 m da 2,05 a 4,95, falda 2 m; oltre 5 m argilloso fino a 20 m
  const punti = [];
  for (let z = 2.05; z < 5; z += 0.1) punti.push({ z: Math.round(z * 100) / 100, categoria: 'FS', FS: 0.8, qc1Ncs: 90 });
  for (let z = 5.05; z < 20; z += 0.1) punti.push({ z: Math.round(z * 100) / 100, categoria: 'argilloso' });
  const r = C.cedimentoLSN(punti, 2);
  const e = eps(0.8, 90);
  check('completo', r.completo, true);
  check('S = εv · 3 m', vicino(r.Smin, e / 100 * 3, 1e-9), true);
  check('LSN = 1000 · εv · ln(5/2)', vicino(r.LSNmin, 1000 * e / 100 * Math.log(5 / 2), 1e-9), true);
  check('LSN 0–10 m = LSN (nulla oltre 5 m)', vicino(r.LSN10min, r.LSNmin), true);
  // stesso profilo interrotto a 12 m: 12–20 m ignoto
  const corto = punti.filter(p => p.z < 12);
  const rc = C.cedimentoLSN(corto, 2);
  check('prova interrotta: intervallo', rc.completo, false);
  check('S_min invariato, S_max + deformazione limite su 8 m', [vicino(rc.Smin, r.Smin), vicino(rc.Smax - rc.Smin, C.EPS_LIMITE / 100 * (20 - 11.95 - 0.05), 1e-6)], [true, true]);
  check('LSN_max − LSN_min = 1000 · εlim · ln(20/12)', vicino(rc.LSNmax - rc.LSNmin, 1000 * C.EPS_LIMITE / 100 * Math.log(20 / 12), 1e-6), true);
  check('LSN 0–10 m non risente del tratto ignoto oltre 12 m', vicino(rc.LSN10max, rc.LSN10min), true);
  // falda al piano campagna e nessun dato in superficie: massimo non limitato e segnalato
  const rs = C.cedimentoLSN([{ z: 3, categoria: 'FS', FS: 1, qc1Ncs: 80 }], 0);
  check('falda 0 e superficie ignota: LSN_max non limitato', [isFinite(rs.LSNmax), rs.avvisi.some(a => a.codice === 'LSN_NON_LIMITATO')], [false, true]);
  check('punto FS senza (qc1N)cs rifiutato', C.cedimentoLSN([{ z: 3, categoria: 'FS', FS: 1 }], 1).stato, 'input_non_valido');
}

console.log('4. Collegamento al profilo e all\'esempio');
{
  const pr = E.progettoEsempio();
  const [s1, s2, s3] = pr.scenari;
  const r = F.calcolaScenario(pr.prove[0], s1, L, { adesso: '2026-11-13T00:00:00Z' });
  const c = r.cedimenti;
  check('cedimenti calcolati per la CPTU', c.stato, 'calcolato');
  check('prova interrotta a 18,4 m: intervallo', c.completo, false);
  check('S_min ≤ S_max e LSN_min ≤ LSN_max', c.Smin <= c.Smax && c.LSNmin <= c.LSNmax, true);
  check('LSN 0–10 m ≤ LSN 0–20 m', c.LSN10min <= c.LSNmin + 1e-9 && c.LSN10max <= c.LSNmax + 1e-9, true);
  const calc = r.righe.filter(x => x.stato === 'calcolato');
  check('εv su ogni riga calcolata', calc.every(x => typeof x.valori.epsV === 'number'), true);
  check('εv della riga = εv(FS, qc1Ncs)', calc.every(x => vicino(x.valori.epsV, eps(x.valori.FS, x.valori.qc1Ncs))), true);
  check('nessuna εv sulle righe non calcolate', r.righe.filter(x => x.stato !== 'calcolato').every(x => !x.valori || x.valori.epsV === undefined), true);
  const rAlta = F.calcolaScenario(pr.prove[0], s3, L);
  check('falda più alta: S_min non minore', rAlta.cedimenti.Smin >= c.Smin - 1e-12, true);
  check('SPT: nessun cedimento (metodo da CPT)', F.calcolaScenario(pr.prove[1], s2, L).cedimenti, null);
  const csv = X.csvRisultati(pr, pr.prove[0], s1, r, {});
  check('CSV: righe di intestazione di cedimento e LSN', csv.includes('# Cedimento post-sismico 0-20 m') && csv.includes('# LSN (senza classi)'), true);
  check('CSV: colonna εv', csv.split('\r\n').find(x => x.startsWith('z [m]')).includes('εv post-liquefazione [%]'), true);
  check('assunzioni dichiarate (curve, combinazione, esclusi, ambito, LSN, incompleto)',
    ['ZHANG_CURVE', 'ZHANG_COMBINAZIONE', 'ZHANG_ESCLUSI', 'ZHANG_AMBITO', 'LSN_DEFINIZIONE', 'CEDIMENTI_INCOMPLETO'].every(k => c.assunzioni.some(a => a.codice === k)), true);
}

console.log('\nRisultato: ' + ok + ' controlli superati, ' + ko + ' non superati.');
process.exit(ko ? 1 : 0);
