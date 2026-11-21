#!/usr/bin/env node
/*
 * verifica_casi_pubblicati.mjs — confronti INDICATIVI con casi pubblicati dagli autori dei metodi,
 * su valori digitalizzati da figure (non tabellati negli originali). Controllano l'integrazione,
 * non la catena di innesco: in ingresso ci sono i FS pubblicati.
 *
 * 1. Indice IL — Iwasaki T., Tokida K., Tatsuoka F. (1981). Soil liquefaction potential evaluation
 *    with use of the simplified procedure. 1st Int. Conf. on Recent Advances in Geotechnical
 *    Earthquake Engineering and Soil Dynamics, St. Louis, pag. 209–214.
 *    Formula: Eq. (5), pag. 210 (F = 1 − FL per FL ≤ 1, W = 10 − 0,5 z, 0–20 m), identica a
 *    Tatsuoka et al. (1980), Soils and Foundations 20(4), Eq. (29a), pag. 107.
 *    Profili FL digitalizzati dalle Fig. 2 e 3 (pag. 210) a 400 dpi; valori PL dalla Tabella 1
 *    (pag. 211): Showa Bridge Br. 1, falda 0,0 m, PL 28,2 (Tab. 1A, n. 13; la Fig. 3 indica
 *    «Boring No. 1»); Nishi Oh-Hata-Cho, falda 3,5 m, PL 0,4 (Tab. 1B, n. 7).
 *    Le figure non danno FL sopra 2,5 m (Showa) e 3,5 m (Nishi): LiquiSite li tratta come tratti
 *    senza risultato, quindi il valore pubblicato deve cadere tra IL_min e IL_max.
 *
 * 2. Cedimento — Zhang G., Robertson P.K., Brachman R.W.I. (2002). Can. Geotech. J. 39,
 *    1168–1180, Fig. 5 (pag. 1173): profili di (qc1N)cs e FS e cedimento cumulato S ≈ 10,2 cm.
 *    Dati: verifiche/dati/zhang2002-fig5.json (passo 0,05 m). Il confronto completo con le
 *    Tabelle 1 e 3 (Marina District, Treasure Island) richiede le CPT originali, non pubblicate
 *    nell'articolo.
 * Uso: node verifiche/verifica_casi_pubblicati.mjs
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const I = require('../motore/indici.js');
const C = require('../motore/cedimenti.js');

let ok = 0, ko = 0;
function check(nome, cond, dettaglio) {
  if (cond) { ok++; console.log('  ✓ ' + nome + (dettaglio ? ' — ' + dettaglio : '')); }
  else { ko++; console.log('  ✗ ' + nome + (dettaglio ? ' — ' + dettaglio : '')); }
}
const f1 = (v) => v.toFixed(1).replace('.', ',');

console.log('1. Indice IL, Iwasaki et al. (1981)');
// [z (m), FL] digitalizzati
const SHOWA_BR1 = [[2.51, 0.57], [3.01, 0.64], [3.42, 0.60], [4.51, 0.51], [5.07, 0.52], [6.49, 1.16], [7.08, 0.24], [7.52, 0.59], [8.27, 0.61], [9.26, 0.98], [10.47, 0.68], [11.50, 0.97], [12.51, 1.15], [13.27, 1.26], [14.47, 1.36], [15.07, 1.27], [15.41, 1.46], [16.52, 1.74], [17.08, 1.44], [17.49, 1.74]];
const NISHI = [[3.52, 1.85], [4.53, 1.11], [6.54, 1.85], [7.50, 1.87], [8.53, 1.41], [9.54, 0.98], [10.55, 1.26], [11.56, 1.25], [12.54, 1.29], [13.52, 1.33], [14.50, 1.34], [15.51, 1.49], [16.49, 1.39], [17.53, 1.38]];
const punti = (p) => p.map(([z, FS]) => ({ z, categoria: 'FS', FS }));
{
  const r = I.indiceIL(punti(SHOWA_BR1), 0.0);
  check('Showa Bridge Br. 1: PL 28,2 compreso tra IL_min e IL_max', r.ILmin <= 28.2 && 28.2 <= r.ILmax, 'IL ' + f1(r.ILmin) + '–' + f1(r.ILmax));
  // estendendo il primo valore fino al piano campagna (falda a 0 m) l'indice si avvicina al valore pubblicato
  const esteso = I.indiceIL(punti([[0.25, SHOWA_BR1[0][1]], [1.25, SHOWA_BR1[0][1]], [2.0, SHOWA_BR1[0][1]], ...SHOWA_BR1]), 0.0);
  check('Showa Bridge Br. 1, primo FL esteso al piano campagna: entro il 10 % di 28,2', Math.abs(esteso.ILmin - 28.2) / 28.2 < 0.10, 'IL ' + f1(esteso.ILmin));
  const r2 = I.indiceIL(punti(NISHI), 3.5);
  check('Nishi Oh-Hata-Cho: PL 0,4 compreso tra IL_min e IL_max', r2.ILmin <= 0.4 && 0.4 <= r2.ILmax, 'IL ' + r2.ILmin.toFixed(2).replace('.', ',') + '–' + r2.ILmax.toFixed(2).replace('.', ','));
}

console.log('2. Cedimento, Zhang et al. (2002), Fig. 5');
{
  const D = JSON.parse(fs.readFileSync(new URL('./dati/zhang2002-fig5.json', import.meta.url), 'utf8'));
  let S = 0;
  for (const [, FS, q] of D.punti) S += C.deformazioneVolumetrica(FS, q).epsV / 100 * D.passo_m * 100; // cm
  check('S ricalcolato entro il 5 % del valore della figura', Math.abs(S - D.S_figura_cm) / D.S_figura_cm < 0.05, 'S ' + S.toFixed(2).replace('.', ',') + ' cm contro ' + D.S_figura_cm.toFixed(2).replace('.', ',') + ' cm');
}

console.log('\nRisultato: ' + ok + ' controlli superati, ' + ko + ' non superati.');
process.exit(ko ? 1 : 0);
