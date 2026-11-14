#!/usr/bin/env node
/*
 * verifica_preliminare.mjs — verifica preliminare (§7.11.3.4.2) per strato e per sito,
 * dati salvati con il progetto, coerenza dei fusi usati dal browser, zone della carta SBT.
 * Uso: node verifiche/verifica_preliminare.mjs [--verbose]
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const L = require('../motore/liquisite.js');
const P = require('../app/progetto.js');
const F = require('../app/profilo.js');
const E = require('../app/esempio.js');
const X = require('../app/esclusione.js');

const verbose = process.argv.includes('--verbose');
let ok = 0, ko = 0;
function check(nome, valore, atteso) {
  const passa = JSON.stringify(valore) === JSON.stringify(atteso);
  passa ? ok++ : ko++;
  if (verbose || !passa) console.log((passa ? '  ok   ' : '  ERRORE ') + nome + ': ' + JSON.stringify(valore) + (passa ? '' : ' (atteso ' + JSON.stringify(atteso) + ')'));
}
const ADESSO = '2026-11-13T00:00:00Z';
const pr = E.progettoEsempio();
const cptu = pr.prove[0], spt = pr.prove[1];
const [sCpt, sSpt] = pr.scenari;
const calc = (pv, sc) => F.calcolaScenario(pv, sc, L, { adesso: ADESSO });
const strato = (v, da) => v.strati.find(s => Math.abs(s.da - da) < 1e-9);
// Variante di prova con una ghiaia sabbiosa nello strato profondo (curva esterna ai fusi) e la
// sabbia media senza curva: serve a controllare l'esclusione con il criterio 4, che le sabbie
// dell'esempio, interne ai fusi, non possono mostrare.
const GHIAIA = [[0.5, 1], [1.2, 3], [2, 8], [3, 12], [5, 22], [10, 42], [20, 68], [40, 90], [63, 100]];
const sG = P.copia(sCpt);
Object.assign(sG.esclusione.strati.find(x => x.da === 13.2), { sabbiaPulita: false, curva: GHIAIA, decisione4: 'soddisfatto', motivazione4: '' });
Object.assign(sG.esclusione.strati.find(x => x.da === 8.6), { curva: null, campione: '', decisione4: null });

console.log('1. Esempio: esito e strati');
{
  const v = X.valutaEsclusione(L, cptu, sCpt, calc(cptu, sCpt));
  check('criterio 1 non soddisfatto (amax 0,26 g)', v.criteri.c1.soddisfatto, false);
  check('criterio 2 non soddisfatto (falda 2,4 m)', v.criteri.c2.soddisfatto, false);
  check('esito: nessuno strato escluso, esclusione non dimostrata', [v.esito.codice, v.conteggi.stratiEsclusi], ['non_dimostrata', 0]);
  check('riporto sopra falda: non pertinente', strato(v, 0).esito, 'non_pertinente');
  check('sabbia limosa: non sabbia pulita, curva interna → non esclusa', strato(v, 3.4).esito, 'non_escluso');
  check('sabbia media dichiarata pulita, qc1N < 180 → criterio 3 non soddisfatto', strato(v, 8.6).c3.soddisfatto, false);
  check('sabbia media: curva interna ai fusi, confermata → non esclusa', [strato(v, 8.6).c4.proposta, strato(v, 8.6).esito], ['non soddisfatto', 'non_escluso']);
  check('sabbia profonda: curva interna ai fusi, confermata → non esclusa', [strato(v, 13.2).c4.proposta, strato(v, 13.2).esito], ['non soddisfatto', 'non_escluso']);
  check('curve lontane dal confine Uc = 3,5', [3.4, 8.6, 13.2].every(z => Math.abs(strato(v, z).c4.motore.Uc - 3.5) > 0.25), true);
  const vg = X.valutaEsclusione(L, cptu, sG, calc(cptu, sG));
  check('variante con ghiaia: esclusione parziale', vg.esito.codice, 'parziale');
  check('variante: sabbia media senza curva → esclusione non dimostrata', strato(vg, 8.6).esito, 'non_dimostrato');
  check('variante: ghiaia con curva esterna confermata → esclusa (criterio 4)', [strato(vg, 13.2).esito, strato(vg, 13.2).criteriEscludenti], ['escluso', [4]]);
  check('variante: proposta del motore «soddisfatto»', strato(vg, 13.2).c4.proposta, 'soddisfatto');
  check('nota della Circolare con amax ≥ 0,1 g', v.note.some(n => n.includes('C7.11.3.4')), true);
  check('nota: l\'esito non modifica i FS', v.note.some(n => n.includes('non modifica i fattori di sicurezza')), true);
}

console.log('2. Criteri 1 e 2 di sito');
{
  const s = P.copia(sCpt); s.amax = 0.08;
  check('amax 0,08 g → verifica omessa, criterio 1', [X.valutaEsclusione(L, cptu, s, null).esito.codice, X.valutaEsclusione(L, cptu, s, null).esito.criterio], ['omessa', 1]);
  const s2 = P.copia(sCpt); s2.esclusione.faldaMediaStagionale = 16;
  check('falda 16 m, p.c. e fondazioni sì → criterio 2', X.valutaEsclusione(L, cptu, s2, null).esito.criterio, 2);
  s2.esclusione.fondazioniSuperficiali = false;
  check('falda 16 m con fondazioni profonde → non omessa', X.valutaEsclusione(L, cptu, s2, null).criteri.c2.soddisfatto, false);
  const s3 = P.copia(sCpt); s3.esclusione.pcSubOrizzontale = null;
  check('dati di sito incompleti → criterio 2 non valutato', X.valutaEsclusione(L, cptu, s3, null).criteri.c2.stato, 'dati_insufficienti');
  const s4 = P.copia(sCpt); s4.esclusione.faldaMediaStagionale = 15;
  check('falda esattamente 15 m → non soddisfatto', X.valutaEsclusione(L, cptu, s4, null).criteri.c2.soddisfatto, false);
}

console.log('3. Criterio 3 per strato');
{
  // prova con qc alto nella sabbia media: tutti i punti oltre 180
  const forte = P.copia(cptu);
  forte.dati = forte.dati.map(d => (d[0] >= 8.6 && d[0] < 12.4) ? [d[0], 32, d[2] * 0.3, d[3]] : d);
  const r = calc(forte, sCpt);
  const v = X.valutaEsclusione(L, forte, sCpt, r);
  check('sabbia pulita con tutti i qc1N > 180 → esclusa (criterio 3)', [strato(v, 8.6).c3.soddisfatto, strato(v, 8.6).esito], [true, 'escluso']);
  check('minimo qc1N riportato e > 180', strato(v, 8.6).c3.minimo > 180, true);
  // un punto mancante nello strato → non dimostrato
  const buco = P.copia(forte); buco.dati.find(d => d[0] === 10).splice(1, 1, null);
  const vb = X.valutaEsclusione(L, buco, sCpt, calc(buco, sCpt));
  check('un punto senza qc1N → dati insufficienti', [strato(vb, 8.6).c3.stato, strato(vb, 8.6).c3.soddisfatto], ['dati_insufficienti', null]);
  // tratto non indagato dentro lo strato → non dimostrato
  const lac = P.copia(forte); lac.dati = lac.dati.filter(d => !(d[0] > 10 && d[0] < 11.5));
  const vl = X.valutaEsclusione(L, lac, sCpt, calc(lac, sCpt));
  check('tratto non indagato di 1,5 m nello strato → non dimostrato', strato(vl, 8.6).c3.stato, 'dati_insufficienti');
  // sabbia pulita non indicata
  const s = P.copia(sCpt); s.esclusione.strati = s.esclusione.strati.filter(x => x.da !== 8.6);
  check('sabbia pulita non indicata → da completare', X.valutaEsclusione(L, forte, s, r).strati.find(x => x.da === 8.6).c3.stato, 'dati_insufficienti');
  // risultati assenti → criterio 3 sospeso
  check('senza risultati → criterio 3 sospeso', strato(X.valutaEsclusione(L, forte, sCpt, null), 8.6).c3.motivo, 'calcolo non eseguito');
  // SPT: normalizzazione del metodo, (N1)60 > 30
  const vs = X.valutaEsclusione(L, spt, sSpt, calc(spt, sSpt));
  check('SPT: grandezza (N1)60 e soglia 30', [strato(vs, 8.6).c3.grandezza, strato(vs, 8.6).c3.soglia], ['(N1)60', 30]);
  check('SPT: strato senza prove → dati insufficienti', strato(vs, 12.4).c3.stato, 'dati_insufficienti');
  // Vs: criterio 3 non applicabile
  const pv = P.nuovaProva('VS', 'v'); pv.dati = [[2, 150], [5, 170], [9, 220]];
  const sv = P.copia(sCpt); sv.metodo = 'kayen2013Vs'; sv.provaId = pv.id; sv.opzioni.Vs12 = 180;
  check('profilo Vs: criterio 3 non applicabile', strato(X.valutaEsclusione(L, pv, sv, calc(pv, sv)), 3.4).c3.stato, 'non_applicabile');
}

console.log('4. Criterio 4: conferma del geologo');
{
  const s = P.copia(sG);
  const g = s.esclusione.strati.find(x => x.da === 13.2);
  g.decisione4 = null;
  check('proposta non confermata → da confermare, strato non escluso', [strato(X.valutaEsclusione(L, cptu, s, null), 13.2).c4.stato, strato(X.valutaEsclusione(L, cptu, s, null), 13.2).esito], ['da_confermare', 'non_dimostrato']);
  g.decisione4 = 'non soddisfatto';
  check('scelta diversa dalla proposta senza motivazione → da confermare', strato(X.valutaEsclusione(L, cptu, s, null), 13.2).c4.stato, 'da_confermare');
  g.motivazione4 = 'campione non rappresentativo dello strato';
  check('scelta diversa motivata → valutato, non soddisfatto', [strato(X.valutaEsclusione(L, cptu, s, null), 13.2).c4.stato, strato(X.valutaEsclusione(L, cptu, s, null), 13.2).c4.soddisfatto], ['valutato', false]);
  const c = P.copia(sG); c.esclusione.strati.find(x => x.da === 13.2).curva = [[0.5, 30], [2, 60], [10, 80]];
  check('copertura insufficiente: nessuna esclusione proposta', strato(X.valutaEsclusione(L, cptu, c, null), 13.2).c4.proposta !== 'soddisfatto', true);
  const n = P.copia(sG); n.esclusione.strati.find(x => x.da === 13.2).curva = [[1, 50], [0.5, 60]];
  check('curva non monotona → input non valido', strato(X.valutaEsclusione(L, cptu, n, null), 13.2).c4.stato, 'input_non_valido');
}

console.log('5. Esclusione del sito con i criteri 3–4');
{
  const s = P.copia(sCpt);
  s.strati = [{ da: 0, a: 1.8, gamma: 18, gammaSat: 19, FC: null, descrizione: 'riporto' }, { da: 1.8, a: 20, gamma: 19, gammaSat: 20, FC: null, descrizione: 'ghiaia' }];
  s.esclusione.strati = [{ da: 1.8, a: 20, sabbiaPulita: false, curva: GHIAIA, decisione4: 'soddisfatto', motivazione4: '' }];
  check('unico strato saturo escluso → verifica omessa (criteri 3–4)', X.valutaEsclusione(L, cptu, s, null).esito.criterio, '3–4');
  const corta = P.copia(s); corta.strati[1].a = 15;
  corta.esclusione.strati[0].a = 15;
  check('stratigrafia fino a 15 m: sito non escluso', X.valutaEsclusione(L, cptu, corta, null).esito.codice !== 'omessa', true);
}

console.log('6. Salvataggio, firma e dati di vecchi progetti');
{
  const testo = P.salvaProgetto(pr);
  const r = P.apriProgetto(testo);
  const canon = (x) => JSON.stringify(x, (k, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map(c => [c, v[c]])) : v);
  check('riapertura conserva le curve', canon(r.progetto.scenari[0].esclusione), canon(sCpt.esclusione));
  const s = P.copia(sCpt); s.esclusione.faldaMediaStagionale = 30;
  check('la verifica preliminare non entra nella firma', P.firmaInput(cptu, s, L.VERSIONE_MOTORE), P.firmaInput(cptu, sCpt, L.VERSIONE_MOTORE));
  const vecchio = JSON.parse(testo); delete vecchio.scenari[0].esclusione;
  check('progetto senza dati preliminari: aperto con valori vuoti', P.apriProgetto(JSON.stringify(vecchio)).progetto.scenari[0].esclusione, P.esclusioneVuota());
  const rotto = JSON.parse(testo); rotto.scenari[0].esclusione = 'x';
  check('dati preliminari non validi rifiutati', P.apriProgetto(JSON.stringify(rotto)).ok, false);
  check('nuovo scenario con dati preliminari vuoti', P.nuovoScenario(cptu, 's').esclusione, P.esclusioneVuota());
  const s2 = P.copia(sCpt);
  X.aggiornaStrato(s2, { da: 1.2, a: 3.4 }, { sabbiaPulita: true });
  check('aggiornaStrato crea la voce dello strato', X.datiStrato(X.datiEsclusione(s2), { da: 1.2, a: 3.4 }).sabbiaPulita, true);
}

console.log('7. Lettura della curva e dati dei fusi per il browser');
{
  check('virgola, punto e tabulazione', X.leggiCurva('0,1; 20\n1\t60\n2 90').curva, [[0.1, 20], [1, 60], [2, 90]]);
  check('riga incompleta segnalata', X.leggiCurva('0,1; 20\nabc').errori.length, 1);
  check('testo ↔ curva', X.leggiCurva(X.testoCurva([[0.075, 12.5], [2, 100]])).curva, [[0.075, 12.5], [2, 100]]);
  const ctx = {}; vm.runInNewContext(readFileSync(new URL('../dati/fusi-ntc2018.js', import.meta.url), 'utf8'), { self: ctx });
  check('fusi per il browser identici al JSON', JSON.stringify(ctx.LiquiFusi), JSON.stringify(JSON.parse(readFileSync(new URL('../dati/fusi-ntc2018.json', import.meta.url), 'utf8'))));
}

console.log('8. Carta di comportamento (zone da Ic, Robertson e Wride 1998, Tab. 1)');
{
  check('limiti delle zone', F.ZONE_SBT.map(z => z.icA).filter(Number.isFinite), [1.31, 2.05, 2.60, 2.95, 3.60]);
  check('zone ai limiti', [1.0, 1.31, 2.0, 2.6, 2.95, 3.59, 3.6, 4].map(F.zonaSBT), [7, 6, 6, 4, 3, 3, 2, 2]);
  const r = calc(cptu, sCpt);
  const conSbt = r.righe.filter(x => x.sbt);
  check('ogni lettura CPT ha Q, F e Ic per la carta', conSbt.length, r.righe.length);
  check('Ic della carta = Ic del calcolo', r.righe.filter(x => x.stato === 'calcolato').every(x => Math.abs(x.sbt.Ic - x.valori.Ic) < 1e-12), true);
  check('limo argilloso (12,55–13,05 m) in zona 3 o 4', r.righe.filter(x => x.z > 12.55 && x.z < 13.05).every(x => [3, 4].includes(x.sbt.zona)), true);
  check('sabbia profonda (14–19,8 m) in zona 6', r.righe.filter(x => x.z > 14 && x.z < 19.8).filter(x => x.sbt.zona === 6).length > 250, true);
  check('sabbia media (9,5–12 m) in zona 6', r.righe.filter(x => x.z > 9.5 && x.z < 12).filter(x => x.sbt.zona === 6).length > 100, true);
  check('nessun dato SBT per prove SPT', calc(spt, sSpt).righe.some(x => x.sbt), false);
}

console.log('\nRisultato: ' + ok + ' controlli superati, ' + ko + ' non superati.');
process.exit(ko ? 1 : 0);
