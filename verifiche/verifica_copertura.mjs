#!/usr/bin/env node
/*
 * verifica_copertura.mjs — criterio 3 della verifica preliminare: copertura delle prove e «sabbia
 * pulita» (audit v1.0.0, B4.1–B4.2; decisione D5 del 25/11/2026). Criteri di screening applicativi
 * di LiquiSite, non tolleranze né prescrizioni delle NTC 2018.
 *  - tolleranza fissa: SPT 1,5 m, CPT 0,25 m, tra tetto saturo e prima prova, tra prove consecutive,
 *    tra ultima prova e letto; basta un intervallo strettamente oltre tolleranza → non soddisfatto;
 *  - «sabbia pulita» contraddetta dai dati → non soddisfatto, senza deroga.
 * I risultati di prova sono costruiti a mano (righe con valori noti) per controllare i limiti esatti.
 *
 * Uso:   node verifiche/verifica_copertura.mjs [--verbose]
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const L = require('../motore/liquisite.js');
const P = require('../app/progetto.js');
const F = require('../app/profilo.js');
const X = require('../app/esclusione.js');
const XP = require('../app/esporta.js');

const verbose = process.argv.includes('--verbose');
let ok = 0, ko = 0;
function check(nome, valore, atteso) {
  const passa = JSON.stringify(valore) === JSON.stringify(atteso);
  passa ? ok++ : ko++;
  if (verbose || !passa) console.log((passa ? '  ok   ' : '  ERRORE ') + nome + ': ' + JSON.stringify(valore) + (passa ? '' : ' (atteso ' + JSON.stringify(atteso) + ')'));
}
const r9 = (v) => Math.round(v * 1e9) / 1e9;

/** Scenario e risultato costruiti a mano: strato 0–20 m dichiarato sabbia pulita. */
function caso(tipo, zs, opzioni = {}) {
  const metodo = tipo === 'SPT' ? 'bi2014Spt' : 'bi2014Cpt';
  const prova = { tipo };
  const scenario = { metodo, zFalda: opzioni.zFalda ?? 0, amax: 0.25, strati: [{ id: 'strato-1', da: 0, a: 20, gamma: 18, gammaSat: 19, FC: null }],
    esclusione: { strati: [{ stratoId: 'strato-1', da: 0, a: 20, sabbiaPulita: 'sabbiaPulita' in opzioni ? opzioni.sabbiaPulita : true }] } };
  const chiave = tipo === 'SPT' ? 'N160' : 'qc1N';
  const righe = zs.map((z, i) => {
    const r = { indice: i, z, stato: 'calcolato', valori: { [chiave]: opzioni.valore ?? 250 }, FC: null, avvisi: [] };
    if (opzioni.FC !== undefined) r.FC = typeof opzioni.FC === 'function' ? opzioni.FC(z, i) : opzioni.FC;
    if (opzioni.Ic !== undefined) r.valori.Ic = typeof opzioni.Ic === 'function' ? opzioni.Ic(z, i) : opzioni.Ic;
    return r;
  });
  const v = X.valutaEsclusione(L, prova, scenario, { stato: 'calcolato', righe });
  return { v, c3: v.strati[0].c3, scenario };
}
const passo = (p, da, a) => { const o = []; for (let k = 1; r9(da + k * p) <= a; k++) o.push(r9(da + k * p)); return o; };

console.log('1. Esempio di Fabio: SPT a 2 e 10 m in uno strato saturo 0–20 m');
{
  const { v, c3 } = caso('SPT', [2, 10]);
  check('criterio 3 non soddisfatto', [c3.stato, c3.soddisfatto], ['valutato', false]);
  check('tratti scoperti 0–2, 2–10 e 10–20 m', c3.trattiScoperti.map(t => [t.da, t.a]), [[0, 2], [2, 10], [10, 20]]);
  check('esito del sito: non «verifica omessa»', v.esito.codice !== 'omessa', true);
  check('motivo con i tratti e dichiarazione di criterio di LiquiSite', /3 tratti.*0,00–2,00 m.*non considerati sicuri.*non una prescrizione delle NTC/.test(c3.motivo), true);
  check('tratti aggregati per sito e nota', [v.trattiScoperti.length, v.note.some(n => /non coperti da prove.*1,50 m/.test(n))], [3, true]);
  check('testo per CSV e stampa', /strato 0,00–20,00 m, tratto 0,00–2,00 m; strato 0,00–20,00 m, tratto 2,00–10,00 m; strato 0,00–20,00 m, tratto 10,00–20,00 m/.test(X.testoTrattiScoperti(v)), true);
}

console.log('2. SPT: tolleranza 1,5 m');
{
  check('SPT ogni 1,4 m: soddisfatto', [caso('SPT', passo(1.4, 0, 20)).c3.soddisfatto, caso('SPT', passo(1.4, 0, 20)).c3.trattiScoperti || 'nessuno'], [true, 'nessuno']);
  const c16 = caso('SPT', passo(1.6, 0, 20)).c3;
  check('SPT ogni 1,6 m: non soddisfatto', [c16.soddisfatto, c16.trattiScoperti.length > 0], [false, true]);
  check('SPT ogni 1,5 m (limite esatto): soddisfatto', caso('SPT', passo(1.5, 0, 19.5)).c3.soddisfatto, true);
  check('SPT: prima prova a 1,5 m dal tetto (limite esatto): soddisfatto', caso('SPT', [1.5, 3, 4.5, 6, 7.5, 9, 10.5, 12, 13.5, 15, 16.5, 18, 19.5]).c3.soddisfatto, true);
  check('SPT: prima prova a 1,6 m dal tetto: non soddisfatto, tratto 0–1,6', [caso('SPT', [1.6, ...passo(1.4, 1.6, 19.9)]).c3.soddisfatto, caso('SPT', [1.6, ...passo(1.4, 1.6, 19.9)]).c3.trattiScoperti[0]], [false, { da: 0, a: 1.6 }]);
  check('SPT: ultima prova a 18,4 m dal letto 20 m (1,6 m): non soddisfatto', caso('SPT', [...passo(1.4, 0, 18.4)]).c3.soddisfatto, false);
  check('SPT: una sola prova fuori tolleranza basta', caso('SPT', [1, 2, 3, 4, 5, 6.6, 8, 9.4, 10.8, 12.2, 13.6, 15, 16.4, 17.8, 19.2]).c3.soddisfatto, false);
  check('la tolleranza non dipende dal passo: prove fitte + un vuoto di 3 m', caso('SPT', [...passo(0.5, 0, 8), ...passo(0.5, 11, 19.5)]).c3.soddisfatto, false);
  // la falda delimita il tratto saturo: con falda a 10 m il tratto da coprire è 10–20 m
  check('falda a 10 m: la copertura riguarda solo 10–20 m', caso('SPT', [11, 12.4, 13.8, 15.2, 16.6, 18, 19.4], { zFalda: 10 }).c3.soddisfatto, true);
  check('falda a 10 m: prima prova a 11,6 m → tratto 10–11,6 scoperto', caso('SPT', [11.6, 13, 14.4, 15.8, 17.2, 18.6], { zFalda: 10 }).c3.trattiScoperti[0], { da: 10, a: 11.6 });
}

console.log('3. CPT: tolleranza 0,25 m');
{
  const fitto = (p) => passo(p, 0, 19.95);
  check('CPT, passo 0,24 m: soddisfatto', caso('CPTE', fitto(0.24)).c3.soddisfatto, true);
  check('CPT, passo 0,25 m (limite esatto): soddisfatto', caso('CPTE', fitto(0.25)).c3.soddisfatto, true);
  check('CPT, passo 0,26 m: non soddisfatto', caso('CPTE', fitto(0.26)).c3.soddisfatto, false);
  const conBuco = (g) => [...passo(0.2, 0, 8), r9(8 + g), ...passo(0.2, r9(8 + g), 19.9)];
  check('CPT, vuoto di 0,24 m: soddisfatto', caso('CPTE', conBuco(0.24)).c3.soddisfatto, true);
  check('CPT, vuoto di 0,26 m: non soddisfatto', caso('CPTE', conBuco(0.26)).c3.soddisfatto, false);
  const c = caso('CPTU', conBuco(0.5)).c3;
  check('CPTU, vuoto di 0,5 m: tratto scoperto identificato', c.trattiScoperti.length === 1 && Math.abs(c.trattiScoperti[0].da - 7.8) < 0.21 && c.soddisfatto === false, true);
  check('tolleranze esportate', X.TOLLERANZA_COPERTURA, { SPT: 1.5, CPTE: 0.25, CPTU: 0.25 });
}

console.log('4. Sabbia pulita: FC misurato');
{
  const zs = passo(1.4, 0, 19.6);
  check('SPT, FC 5 %: ammessa', caso('SPT', zs, { FC: 5 }).c3.soddisfatto, true);
  const x = caso('SPT', zs, { FC: 5.1 }).c3;
  check('SPT, FC 5,1 %: non ammessa', [x.stato, x.soddisfatto, !!x.contraddizione], ['valutato', false, true]);
  check('messaggio: contraddizione, nessuna deroga, suggerisce di dividere lo strato, criterio di LiquiSite', /contraddetta dai dati.*FC fino a 5,1 % > 5 %.*senza deroga.*dividere lo strato.*non una prescrizione delle NTC/.test(x.contraddizione.messaggio), true);
  const f35 = caso('SPT', zs, { FC: 35 }).c3;
  check('SPT, FC 35 % dichiarato sabbia pulita (rilievo B4.2): non soddisfatto', [f35.soddisfatto, f35.contraddizione.fcMax], [false, 35]);
  check('SPT, un solo punto con FC 12 % tra FC 3 %: non ammessa', caso('SPT', zs, { FC: (z, i) => i === 5 ? 12 : 3 }).c3.soddisfatto, false);
  check('SPT senza FC misurato: nessun controllo sulla sabbia pulita', caso('SPT', zs).c3.soddisfatto, true);
  check('l\'esito del sito non è «verifica omessa» con FC 35 %', caso('SPT', zs, { FC: 35 }).v.esito.codice !== 'omessa', true);
  check('dichiarazione «no sabbia pulita»: invariato, non soddisfatto', caso('SPT', zs, { sabbiaPulita: false }).c3.motivo, 'lo strato non è dichiarato sabbia pulita');
  check('sabbia pulita non indicata: invariato, dati insufficienti', caso('SPT', zs, { sabbiaPulita: null }).c3.stato, 'dati_insufficienti');
}

console.log('5. Sabbia pulita: CPT senza FC misurato (Ic) e con FC misurato');
{
  const zs = passo(0.2, 0, 19.9);
  check('Ic 1,775 in tutti i punti: ammessa', caso('CPTE', zs, { Ic: 1.775 }).c3.soddisfatto, true);
  const c = caso('CPTE', zs, { Ic: (z, i) => i === 40 ? 1.776 : 1.5 }).c3;
  check('Ic 1,776 in un punto: non ammessa', [c.soddisfatto, c.contraddizione.punti, c.contraddizione.icMax], [false, 1, 1.776]);
  check('messaggio con Ic e FC ≈ 5 % (B&I 2014, Eq. 2.30)', /Ic fino a 1,776 > 1,775.*FC ≈ 5 % da B&I 2014, Eq\. 2\.30/.test(c.contraddizione.messaggio), true);
  check('CPT con FC misurato 4 % e Ic 1,9: ammessa (prevale il FC misurato)', caso('CPTE', zs, { FC: 4, Ic: 1.9 }).c3.soddisfatto, true);
  check('CPT con FC misurato 6 %, Ic 1,5: non ammessa', caso('CPTE', zs, { FC: 6, Ic: 1.5 }).c3.soddisfatto, false);
  check('CPT, Ic oltre soglia dello scenario (sabbia pulita contraddetta): non soddisfatto', caso('CPTE', zs, { Ic: 2.8 }).c3.soddisfatto, false);
  check('soglie esportate', X.SABBIA_PULITA_MAX, { FC: 5, Ic: 1.775 });
  const ic = (5 + 137) / 80;
  check('FC 5 % ↔ Ic 1,775 (Eq. 2.30 con C_FC = 0)', ic, 2.025 - 0.25);
}

console.log('6. Con la copertura insufficiente il dato mancante non nasconde il risultato');
{
  const zs = [2, 10];
  const { c3 } = caso('SPT', zs, {});
  check('anche con strato non coperto lo stato è «valutato» (non «dati insufficienti»)', c3.stato, 'valutato');
  const c4 = caso('SPT', passo(1.4, 0, 19.6), { FC: 35 });
  check('criterio 4 confermato dal geologo resta indipendente: lo strato è escluso dal criterio 4', (() => {
    const sc = c4.scenario; Object.assign(sc.esclusione.strati[0], { decisione4: 'soddisfatto', motivazione4: 'Curva verificata dal geologo.', curva: [[0.001, 5], [0.01, 15], [0.075, 40], [1, 90], [10, 100]] });
    const v = X.valutaEsclusione(L, { tipo: 'SPT' }, sc, { stato: 'calcolato', righe: passo(1.4, 0, 19.6).map((z, i) => ({ indice: i, z, stato: 'calcolato', valori: { N160: 250 }, FC: 35, avvisi: [] })) });
    return [v.strati[0].c3.soddisfatto, v.strati[0].c4.stato];
  })().join(), 'false,valutato');
}

console.log('7. Esempio dell\'app e CSV');
{
  const E = require('../app/esempio.js');
  const pr = E.progettoEsempio();
  for (const s of pr.scenari) {
    const pv = pr.prove.find(p => p.id === s.provaId), r = F.calcolaScenario(pv, s, L);
    const v = X.valutaEsclusione(L, pv, s, r);
    check('«' + s.nome + '»: nessun errore, tratti scoperti coerenti con il testo', [Array.isArray(v.trattiScoperti), (X.testoTrattiScoperti(v) === '') === (v.trattiScoperti.length === 0)], [true, true]);
  }
  const pv = pr.prove[0], s = pr.scenari[0], r = F.calcolaScenario(pv, s, L);
  const csv = XP.csvRisultati(pr, pv, s, r, { preliminare: 'Esito. ' + X.testoTrattiScoperti({ trattiScoperti: [{ da: 0, a: 2, strato: '0–20' }] }) });
  check('CSV: i tratti non coperti sono riportati', /Tratti saturi non coperti da prove, non considerati sicuri: strato 0,00–20,00 m, tratto 0,00–2,00 m/.test(csv), true);
}

console.log('\nRisultato: ' + ok + ' controlli superati, ' + ko + ' non superati.');
process.exit(ko ? 1 : 0);
