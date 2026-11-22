// Controllo di plausibilità delle unità all'importazione (app/importa.js, controllaPlausibilita).
// Gli avvisi sono soglie operative dell'app: non bloccano l'importazione e non convertono nulla.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const I = require('../app/importa.js');
const E = require('../app/esempio.js');

let n = 0;
const ok = (c, m) => { assert(c, m); n++; };
const colonne = (avvisi) => avvisi.map(a => a.colonna);

// CPTU realistica (profondità in m, qc in MPa, fs e u2 in kPa)
const z = Array.from({ length: 40 }, (_, k) => 0.5 + k * 0.5);
const cptu = (fz = 1, fq = 1, ff = 1, fu = 1, unita = { z: 'm', qc: 'MPa', fs: 'kPa', u2: 'kPa' }) => ({
  colonne: ['z', 'qc', 'fs', 'u2'], unita,
  dati: z.map((zz, k) => [zz * fz, (3 + (k % 5)) * fq, (40 + 3 * (k % 7)) * ff, (zz > 2 ? 9.81 * (zz - 2) : 0) * fu])
});

// 1. Dati plausibili: nessun avviso
ok(I.controllaPlausibilita(cptu()).length === 0, 'CPTU plausibile senza avvisi');

// 2. qc in kPa dichiarati MPa
let a = I.controllaPlausibilita(cptu(1, 1000));
ok(colonne(a).includes('qc') && /kPa/.test(a.find(x => x.colonna === 'qc').motivo), 'qc in kPa dichiarato MPa');
// 3. qc in MPa dichiarati kPa (unità dichiarata kPa: convertita 0,003-0,007 MPa)
a = I.controllaPlausibilita(cptu(1, 1, 1, 1, { z: 'm', qc: 'kPa', fs: 'kPa', u2: 'kPa' }));
ok(colonne(a).includes('qc'), 'qc in MPa dichiarato kPa');
// 4. fs in MPa dichiarato kPa
a = I.controllaPlausibilita(cptu(1, 1, 0.001));
ok(colonne(a).includes('fs') && /MPa/.test(a.find(x => x.colonna === 'fs').motivo), 'fs in MPa dichiarato kPa');
// 5. u2 in MPa dichiarato kPa
a = I.controllaPlausibilita(cptu(1, 1, 1, 0.001));
ok(colonne(a).includes('u2'), 'u2 in MPa dichiarato kPa');
// 6. profondità in cm dichiarata m / in m dichiarata cm
a = I.controllaPlausibilita(cptu(100));
ok(colonne(a).includes('z') && /cm/.test(a.find(x => x.colonna === 'z').motivo), 'z in cm dichiarata m');
a = I.controllaPlausibilita(cptu(1, 1, 1, 1, { z: 'cm', qc: 'MPa', fs: 'kPa', u2: 'kPa' }));
ok(colonne(a).includes('z'), 'z in m dichiarata cm');
// 7. scala relativa qc/fs: qc e fs singolarmente plausibili ma fs/qc fuori scala → un solo avviso su fs
a = I.controllaPlausibilita({ colonne: ['z', 'qc', 'fs'], unita: { z: 'm', qc: 'MPa', fs: 'kPa' },
  dati: z.map((zz, k) => [zz, 0.8 + 0.01 * k, 800 + k]) });
ok(a.length === 1 && a[0].colonna === 'fs' && /rapporto fs\/qc/.test(a[0].motivo), 'rapporto fs/qc fuori scala');
// 8. un solo valore anomalo non fa scattare gli avvisi sulla mediana
const unico = cptu(); unico.dati[10][1] = 500;
ok(I.controllaPlausibilita(unico).length === 0, 'valore isolato anomalo non segnalato');
// 9. SPT, Vs, FC
const spt = (N, FC) => ({ colonne: ['z', 'N', 'FC'], unita: { z: 'm', N: 'colpi/30 cm', FC: '%' }, dati: [[1.5, N, FC], [3, N, FC], [4.5, N, FC]] });
ok(I.controllaPlausibilita(spt(12, 20)).length === 0, 'SPT plausibile');
ok(colonne(I.controllaPlausibilita(spt(150, 20))).includes('N'), 'N oltre 100');
ok(colonne(I.controllaPlausibilita(spt(12, 150))).includes('FC'), 'FC oltre 100 %');
ok(colonne(I.controllaPlausibilita(spt(12, 0.2))).includes('FC'), 'FC come frazione 0-1');
const vs = (v) => ({ colonne: ['z', 'Vs'], unita: { z: 'm', Vs: 'm/s' }, dati: [[2, v], [5, v * 1.1], [10, v * 1.2]] });
ok(I.controllaPlausibilita(vs(250)).length === 0, 'Vs plausibile');
ok(colonne(I.controllaPlausibilita(vs(0.25))).includes('Vs'), 'Vs in km/s');
// 10. pochi dati o dati assenti: nessun avviso, nessuna eccezione
ok(I.controllaPlausibilita({ colonne: ['z', 'qc'], unita: { z: 'm', qc: 'MPa' }, dati: [[1, 9000]] }).length === 0, 'meno di 3 valori: nessun giudizio');
ok(I.controllaPlausibilita({ colonne: ['z', 'qc'], unita: { z: 'm', qc: 'MPa' }, dati: [] }).length === 0, 'nessun dato');
ok(I.controllaPlausibilita({ colonne: ['z', 'qc', 'fs'], unita: { z: 'm', qc: 'MPa', fs: 'kPa' }, dati: z.map(zz => [zz, null, null]) }).length === 0, 'colonne vuote');

// 11. Integrazione con costruisciDati: avvisi presenti ma ok invariato (non blocca)
const righe = I.dividi('z;qc;fs;u2\n' + z.map(zz => [zz, 4000, 40, 0].join(';').replace(/\./g, ',')).join('\n'), ';').righe;
const r = I.costruisciDati(righe, { tipo: 'CPTU', mappa: { z: 0, qc: 1, fs: 2, u2: 3 }, unita: { z: 'm', qc: 'MPa', fs: 'kPa', u2: 'kPa' }, decimale: ',', saltaIntestazione: true });
ok(r.ok === true && r.avvisi.some(x => x.colonna === 'qc'), 'avviso presente, importazione non bloccata');
// la stessa tabella con l'unità corretta (kPa) non produce avvisi
const r2 = I.costruisciDati(righe, { tipo: 'CPTU', mappa: { z: 0, qc: 1, fs: 2, u2: 3 }, unita: { z: 'm', qc: 'kPa', fs: 'kPa', u2: 'kPa' }, decimale: ',', saltaIntestazione: true });
ok(r2.ok === true && !colonne(r2.avvisi).includes('qc'), 'unità corretta: nessun avviso su qc');
// i dati restano quelli inseriti (nessuna conversione silenziosa)
ok(r.dati[0][1] === 4000 && r.unita.qc === 'MPa', 'dati e unità dichiarata invariati');

// 12. Nessun falso positivo sulle prove dell'esempio sintetico (CPTU e SPT)
for (const p of E.progettoEsempio().prove) {
  ok(I.controllaPlausibilita({ colonne: p.colonne, dati: p.dati, unita: p.unita }).length === 0, 'esempio senza avvisi: ' + p.nome);
}

console.log('Unità: ' + n + ' controlli superati, 0 non superati.');
