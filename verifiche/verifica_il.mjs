#!/usr/bin/env node
/*
 * verifica_il.mjs — indice IL di Iwasaki (motore/indici.js)
 * Profili analitici con risultato noto, regole sui tratti ignoti e confronto con una
 * seconda implementazione per campionamento fitto (algoritmo diverso).
 * Uso: node verifiche/verifica_il.mjs [--verbose]
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const I = require('../motore/indici.js');

const verbose = process.argv.includes('--verbose');
let ok = 0, ko = 0;
function check(nome, v, atteso, tol = 1e-9) {
  const passa = typeof atteso === 'number' ? Math.abs(v - atteso) <= tol : JSON.stringify(v) === JSON.stringify(atteso);
  passa ? ok++ : ko++;
  if (verbose || !passa) console.log((passa ? '  ok   ' : '  ERRORE ') + nome + ': ' + JSON.stringify(v) + (passa ? '' : ' (atteso ' + JSON.stringify(atteso) + ')'));
}
const griglia = (da, a, passo, f) => { const p = []; for (let z = da + passo / 2; z < a - 1e-9; z += passo) p.push(f(Math.round(z * 1e6) / 1e6)); return p; };

console.log('1. Peso e integrale');
check('∫ w 0–20 m = 100', I.integralePeso(0, 20), 100);
check('∫ w 5–10 m = 31,25', I.integralePeso(5, 10), 31.25);
check('∫ w oltre 20 m = 0', I.integralePeso(20, 25), 0);
check('w(0) = 10, w(20) = 0', [I.peso(0), I.peso(20)], [10, 0]);
check('F(0,5) = 0,5', I.fattoreF(0.5), 0.5);
check('F(1) = 0', I.fattoreF(1), 0);
check('F(1,5) = 0', I.fattoreF(1.5), 0);

console.log('2. Profili analitici (falda al p.c., passo 0,1 m)');
{
  const r = I.indiceIL(griglia(0, 20, 0.1, z => ({ z, categoria: 'FS', FS: 0.5 })), 0);
  check('FS 0,5 su 0–20 m: IL = 50', r.IL, 50, 1e-9); check('completo', r.completo, true);
  check('FS ≥ 1 ovunque: IL = 0', I.indiceIL(griglia(0, 20, 0.1, z => ({ z, categoria: 'FS', FS: 1.4 })), 0).IL, 0);
  check('FS 0 su 0–20 m: IL = 100', I.indiceIL(griglia(0, 20, 0.1, z => ({ z, categoria: 'FS', FS: 0 })), 0).IL, 100, 1e-9);
  const s = I.indiceIL(griglia(0, 20, 0.1, z => ({ z, categoria: 'FS', FS: z > 5 && z < 10 ? 0 : 2 })), 0);
  check('strato 5–10 m con FS 0: IL = 31,25', s.IL, 31.25, 1e-9);
  check('spessore con FS < 1 = 5 m', s.spessori.liquefacibileFSmin1, 5, 1e-9);
}
console.log('3. Falda');
{
  const r = I.indiceIL(griglia(4, 20, 0.1, z => ({ z, categoria: 'FS', FS: 0 })), 4);
  check('falda 4 m, FS 0 sotto: IL = 64', r.IL, 64, 1e-9);
  check('falda 4 m: tratto sopra falda nota senza dati (completo)', r.completo, true);
  check('spessore sopra falda 4 m', r.spessori.sopraFalda, 4, 1e-9);
}
console.log('4. Tratti ignoti: mai considerati sicuri');
{
  const r = I.indiceIL(griglia(0, 10, 0.1, z => ({ z, categoria: 'FS', FS: 0.5 })), 0);
  check('profilo fino a 10 m: IL_min = 37,5', r.ILmin, 37.5, 1e-9);
  check('profilo fino a 10 m: IL_max = 62,5', r.ILmax, 62.5, 1e-9);
  check('incompleto: IL non definito', [r.completo, r.IL], [false, null]);
  check('spessore ignoto 10 m', r.spessori.ignoto, 10, 1e-9);
  check('assunzione IL_INCOMPLETO dichiarata', r.assunzioni.some(a => a.codice === 'IL_INCOMPLETO'), true);
  const p = griglia(0, 20, 0.1, z => ({ z, categoria: 'FS', FS: 2 }));
  p[50] = { z: p[50].z, categoria: 'ignoto' };
  const m = I.indiceIL(p, 0);
  check('una lettura mancante a 5,05 m: IL_min = 0', m.ILmin, 0, 1e-12);
  check('una lettura mancante: IL_max = ∫ w 5,0–5,1', m.ILmax, I.integralePeso(5.0, 5.1), 1e-9);
  const v = griglia(0, 20, 0.1, z => ({ z, categoria: 'FS', FS: 0.5 })).filter(x => !(x.z > 12 && x.z < 13));
  const g = I.indiceIL(v, 0);
  check('letture tolte tra 12,05 e 12,95 m: ignoto 12,0–13,0 m (i punti vicini coprono mezzo passo)', g.spessori.ignoto, 1.0, 1e-9);
  check('vuoto 12–13 m: IL_max − IL_min = ∫ w sul vuoto', g.ILmax - g.ILmin, I.integralePeso(12.0, 13.0), 1e-9);
}
console.log('5. Comportamento argilloso');
{
  const r = I.indiceIL(griglia(0, 20, 0.1, z => z > 8 && z < 11 ? { z, categoria: 'argilloso' } : { z, categoria: 'FS', FS: 0.5 }), 0);
  check('argilloso 8–11 m: F = 0, IL = 50 − 0,5·∫w 8–11', r.IL, 50 - 0.5 * I.integralePeso(8, 11), 1e-9);
  check('spessore argilloso 3 m', r.spessori.argilloso, 3, 1e-9);
  check('assunzione IL_ARGILLOSO dichiarata', r.assunzioni.some(a => a.codice === 'IL_ARGILLOSO'), true);
  check('nessun testo per l\'utente scrive «F = 0» o «F = 1»', r.assunzioni.concat(I.indiceIL(griglia(0, 10, 0.1, z => ({ z, categoria: 'FS', FS: 0.5 })), 0).assunzioni).some(a => /F = [01]/.test(a.descrizione)), false);
  check('argilloso: FS N.A. e convenzione operativa dichiarata', /FS non applicabile \(N\.A\.\).*convenzione operativa di calcolo.*non equivale a un fattore di sicurezza nullo/.test(r.assunzioni.find(a => a.codice === 'IL_ARGILLOSO').descrizione), true);
}
console.log('6. SPT a punti radi');
{
  const p = [1.5, 3, 4.5, 6, 7.5, 9].map((z, i) => ({ z, categoria: 'FS', FS: [2, 0.8, 0.6, 0.9, 1.2, 2][i] }));
  const r = I.indiceIL(p, 1);
  const atteso = 0.2 * I.integralePeso(2.25, 3.75) + 0.4 * I.integralePeso(3.75, 5.25) + 0.1 * I.integralePeso(5.25, 6.75);
  check('IL_min = somma degli intervalli a metà distanza', r.ILmin, atteso, 1e-9);
  check('oltre 9,75 m ignoto → IL_max − IL_min = ∫ w 9,75–20', r.ILmax - r.ILmin, I.integralePeso(9.75, 20), 1e-9);
  check('tra falda (1 m) e 0,75 m nessun ignoto', r.tratti.filter(t => t.categoria === 'ignoto' && t.a <= 1.5).length, 0);
}
console.log('7. Input non validi');
check('falda negativa', I.indiceIL([], -1).stato, 'input_non_valido');
check('categoria sconosciuta', I.indiceIL([{ z: 1, categoria: 'x' }], 0).stato, 'input_non_valido');
check('FS mancante', I.indiceIL([{ z: 1, categoria: 'FS' }], 0).stato, 'input_non_valido');
check('FS stringa', I.indiceIL([{ z: 1, categoria: 'FS', FS: '0.5' }], 0).stato, 'input_non_valido');
check('profondità ripetuta', I.indiceIL([{ z: 1, categoria: 'FS', FS: 0.5 }, { z: 1, categoria: 'FS', FS: 0.6 }], 0).stato, 'input_non_valido');
check('nessun punto: tutto ignoto sotto falda', I.indiceIL([], 5).ILmax, I.integralePeso(5, 20), 1e-9);

console.log('8. Confronto con campionamento fitto (seconda implementazione)');
{
  let seme = 7, maxErr = 0;
  const rnd = () => { seme = (seme * 1103515245 + 12345) % 2147483648; return seme / 2147483648; };
  for (let k = 0; k < 300; k++) {
    const passo = [0.02, 0.05, 0.1, 0.5, 1.5][Math.floor(rnd() * 5)];
    const zf = Math.round(rnd() * 60) / 10;
    const zs = []; let z = rnd() * passo;
    const fine = 5 + rnd() * 20;
    while (z < fine) { if (rnd() > 0.08) zs.push(Math.round(z * 1e4) / 1e4); z += passo * (rnd() < 0.05 ? 6 : 1); }
    const cats = ['FS', 'FS', 'FS', 'argilloso', 'ignoto'];
    const punti = zs.map(z => { const c = z <= zf ? 'sopraFalda' : cats[Math.floor(rnd() * cats.length)]; return c === 'FS' ? { z, categoria: c, FS: rnd() * 2 } : { z, categoria: c }; });
    const r = I.indiceIL(punti, zf);
    // seconda implementazione: punto-medio su 200 000 campioni, regola dell'intervallo ripetuta in modo indipendente
    const ps = punti.slice().sort((a, b) => a.z - b.z);
    const dz = ps.slice(1).map((p, i) => p.z - ps[i].z).sort((a, b) => a - b);
    const med = dz.length ? dz[Math.floor(dz.length / 2)] : 0, vmax = med ? 3 * med : Infinity;
    const N = 200000, h = 20 / N; let lo = 0, hi = 0;
    const iv = ps.map((p, j) => {
      const pr = ps[j - 1], su = ps[j + 1];
      const a = p.z - (pr ? (p.z - pr.z > vmax ? med / 2 : (p.z - pr.z) / 2) : med / 2);
      const b = p.z + (su ? (su.z - p.z > vmax ? med / 2 : (su.z - p.z) / 2) : med / 2);
      return { a, b, F: p.categoria === 'FS' ? (p.FS <= 1 ? 1 - p.FS : 0) : p.categoria === 'ignoto' || p.categoria === 'sopraFalda' ? null : 0 };
    });
    let j = 0;
    for (let i = 0; i < N; i++) {
      const zc = (i + 0.5) * h, w = 10 - 0.5 * zc;
      if (zc <= zf) continue;
      while (j < iv.length && iv[j].b <= zc) j++;
      const F = j < iv.length && zc >= iv[j].a ? iv[j].F : null;
      if (F === null) hi += w * h; else { lo += F * w * h; hi += F * w * h; }
    }
    maxErr = Math.max(maxErr, Math.abs(lo - r.ILmin), Math.abs(hi - r.ILmax));
  }
  check('300 profili casuali: differenza massima < 2e-3', maxErr < 2e-3, true);
  if (verbose) console.log('  differenza massima', maxErr);
}
console.log('9. Collegamento con il profilo (esempio sintetico)');
{
  const L = require('../motore/liquisite.js'), F = require('../app/profilo.js'), E = require('../app/esempio.js');
  const pr = E.progettoEsempio();
  const [cptu, spt] = pr.prove, [sc, ss] = pr.scenari;
  const r = F.calcolaScenario(cptu, sc, L, { adesso: '2026-11-13T00:00:00Z' });
  const ind = r.indiceIL;
  check('indice presente e calcolato', ind && ind.stato, 'calcolato');
  const punti = F.puntiPerIL(r.righe);
  check('categorie: una per riga con profondità', punti.length, r.righe.length);
  check('righe sopra falda → sopraFalda', r.righe.filter(x => x.codice === 'NON_SATURO').every(x => punti.find(p => p.z === x.z).categoria === 'sopraFalda'), true);
  check('Ic oltre soglia → argilloso', r.righe.filter(x => x.codice === 'IC_OLTRE_SOGLIA').every(x => punti.find(p => p.z === x.z).categoria === 'argilloso'), true);
  const dif = JSON.parse(JSON.stringify(cptu)); dif.dati.find(d => d[0] === 6.3)[2] = null;
  const pDif = F.puntiPerIL(F.calcolaScenario(dif, sc, L, { adesso: '2026-11-13T00:00:00Z' }).righe);
  check('lettura mancante 6,3 m → ignoto', pDif.find(p => p.z === 6.3).categoria, 'ignoto');
  check('FS dei punti = FS delle righe', punti.filter(p => p.categoria === 'FS').every(p => p.FS === r.righe.find(x => x.z === p.z).valori.FS), true);
  check('ricalcolo diretto identico', I.indiceIL(punti, sc.zFalda).ILmin, ind.ILmin, 0);
  check('prova interrotta a 18,4 m: incompleto', ind.completo, false);
  check('IL_max ≥ IL_min + ∫ w 18,41–20', ind.ILmax >= ind.ILmin + I.integralePeso(18.41, 20) - 1e-9, true);
  const rs = F.calcolaScenario(spt, ss, L, { adesso: '2026-11-13T00:00:00Z' });
  check('SPT: indice calcolato', rs.indiceIL.stato, 'calcolato');
  const s2 = JSON.parse(JSON.stringify(sc)); s2.zFalda = 3;
  const r2 = F.calcolaScenario(cptu, s2, L, { adesso: '2026-11-13T00:00:00Z' });
  check('falda più profonda: IL_min non maggiore', r2.indiceIL.ILmin <= ind.ILmin + 1e-9, true);
}

console.log('\nRisultato: ' + ok + ' controlli superati, ' + ko + ' non superati.');
process.exit(ko ? 1 : 0);
