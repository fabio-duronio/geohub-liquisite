#!/usr/bin/env node
/*
 * verifica_esclusione.mjs — controlla i criteri di esclusione (NTC 2018 §7.11.3.4.2)
 * e il confronto con i fusi della Fig. 7.11.1 (dati/fusi-ntc2018.json).
 * Uso: node verifiche/verifica_esclusione.mjs [--verbose]
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const L = require('../motore/liquisite.js');
const fusi = JSON.parse(readFileSync(new URL('../dati/fusi-ntc2018.json', import.meta.url), 'utf8'));

const verbose = process.argv.includes('--verbose');
let ok = 0, ko = 0;
function check(nome, valore, atteso) {
  const passa = valore === atteso;
  passa ? ok++ : ko++;
  if (verbose || !passa) console.log((passa ? '  ok   ' : '  ERRORE ') + nome + ': ' + valore + (passa ? '' : ' (atteso ' + atteso + ')'));
}

console.log('Criteri 1–3');
check('C1 amax 0,08', L.criterio1(0.08).soddisfatto, true);
check('C1 amax 0,10', L.criterio1(0.10).soddisfatto, false);
check('C2 falda 16 m, p.c. orizzontale, fond. superficiali', L.criterio2(16, true, true).soddisfatto, true);
check('C2 falda 16 m, fond. profonde', L.criterio2(16, true, false).soddisfatto, false);
check('C2 falda 15 m', L.criterio2(15, true, true).soddisfatto, false);
check('C3 SPT 31, sabbia pulita', L.criterio3('SPT', 31, true).soddisfatto, true);
check('C3 SPT 31: avviso margine', L.criterio3('SPT', 31, true).avvisi.length, 1);
check('C3 SPT 31, non sabbia pulita', L.criterio3('SPT', 31, false).soddisfatto, false);
check('C3 CPT 181', L.criterio3('CPTE', 181, true).soddisfatto, true);
check('C3 CPT 180', L.criterio3('CPTE', 180, true).soddisfatto, false);

// I limiti digitalizzati hanno diametri ripetuti per l'arrotondamento a 4 cifre (gradini
// verticali). Dalla versione 0.3.0 il motore rifiuta i diametri ripetuti in una curva: per
// usare i limiti come curve di prova si tiene il primo punto di ogni diametro.
const senzaDuplicati = (curva) => curva.filter(([d], i) => i === 0 || d !== curva[i - 1][0]);

console.log('Fusi digitalizzati: coerenza interna');
for (const [k, lim] of [['a_Uc_minore_3_5', 'a'], ['b_Uc_maggiore_3_5', 'b']]) {
  for (const lato of ['sinistra', 'destra']) {
    const curva = senzaDuplicati(fusi[k][lato].map(([p, d]) => [d, p]));
    const u = L.coeffUniformita(curva).Uc;
    // le curve limite del fuso (a) hanno Uc < 3,5, quelle del fuso (b) Uc > 3,5
    check('Uc della curva ' + lato + ' del fuso ' + lim + ' (' + u.toFixed(2) + ') coerente', lim === 'a' ? u < 3.5 : u > 3.5, true);
    const ps = fusi[k][lato].map(x => x[0]), ds = fusi[k][lato].map(x => x[1]);
    check('fuso ' + lim + ' ' + lato + ': d crescente con p', ds.every((d, i) => i === 0 || d >= ds[i - 1]), true);
    check('fuso ' + lim + ' ' + lato + ': passante 2–98 %', ps[0] === 2 && ps[ps.length - 1] === 98, true);
  }
}
// Freccia «possibilità di liquefazione» a circa 26 % di passante: limiti letti sulle figure
const at = (lato, p) => lato.find(x => x[0] === p)[1];
check('fuso a, limite fine a 26 % ≈ 0,015 mm', Math.abs(Math.log10(at(fusi.a_Uc_minore_3_5.sinistra, 26) / 0.015)) < 0.05, true);
check('fuso a, limite grossolano a 26 % ≈ 1,3 mm', Math.abs(Math.log10(at(fusi.a_Uc_minore_3_5.destra, 26) / 1.3)) < 0.05, true);
check('fuso b, limite fine a 26 % ≈ 0,005 mm', Math.abs(Math.log10(at(fusi.b_Uc_maggiore_3_5.sinistra, 26) / 0.005)) < 0.05, true);
check('fuso b, limite grossolano a 26 % ≈ 1,7 mm', Math.abs(Math.log10(at(fusi.b_Uc_maggiore_3_5.destra, 26) / 1.7)) < 0.06, true);

console.log('Criterio 4 su curve costruite');
const fa = fusi.a_Uc_minore_3_5;
// curva al centro del fuso (a) in scala logaritmica
const centro = senzaDuplicati(fa.sinistra.map(([p, d], i) => [Math.sqrt(d * fa.destra[i][1]), p]));
check('centro del fuso (a): interna', L.criterio4(centro, fusi).proposta, 'non soddisfatto');
// limo argilloso fine: curva del limite fine spostata di una decade verso i fini
const fine = senzaDuplicati(fa.sinistra.map(([p, d]) => [d / 10, p]));
check('curva molto fine: esterna', L.criterio4(fine, fusi).proposta, 'soddisfatto');
// ghiaia grossa: limite grossolano spostato di una decade verso i grossi
const grossa = senzaDuplicati(fa.destra.map(([p, d]) => [d * 10, p]));
check('curva molto grossa: esterna', L.criterio4(grossa, fusi).proposta, 'soddisfatto');
// curva coincidente con il limite: tocca
const limite = senzaDuplicati(fa.sinistra.map(([p, d]) => [d, p]));
check('curva sul limite: nessuna proposta', L.criterio4(limite, fusi).proposta, 'nessuna proposta');
// curva che attraversa il limite fine
// (la rotazione cambia Uc, quindi si controlla il confronto con il fuso (a) direttamente)
const attraversa = senzaDuplicati(fa.sinistra.map(([p, d]) => [d * Math.pow(10, (p - 50) / 50 * 0.4), p]));
check('curva che attraversa il limite del fuso (a): tocca', L.confrontaFuso(attraversa, fa).esito, 'tocca');
check('stessa curva: Uc > 3,5, si usa il fuso (b)', L.coeffUniformita(attraversa).Uc > 3.5, true);
// Uc non determinabile (curva dal 30 al 100 %): confronto con entrambi i fusi
const parziale = [[0.0005, 30], [0.001, 60], [0.002, 100]];
const r = L.criterio4(parziale, fusi);
check('Uc non determinabile: due confronti', Object.keys(r.confronti).length, 2);

console.log('\nRisultato: ' + ok + ' controlli superati, ' + ko + ' non superati.');
process.exit(ko ? 1 : 0);
