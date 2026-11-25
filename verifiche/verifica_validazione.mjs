#!/usr/bin/env node
/*
 * verifica_validazione.mjs — controlli di congruenza e di plausibilità dei dati (audit v1.0.0, B5 e
 * §4 punto 1): pesi di volume, tensione efficace a ogni profondità, unità di γ e amax, profondità
 * dei file di progetto. Nessuna formula del motore coinvolta.
 *
 * Uso:   node verifiche/verifica_validazione.mjs [--verbose]
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const L = require('../motore/liquisite.js');
const P = require('../app/progetto.js');
const F = require('../app/profilo.js');
const X = require('../app/esporta.js');
const E = require('../app/esempio.js');

const verbose = process.argv.includes('--verbose');
let ok = 0, ko = 0;
function check(nome, valore, atteso) {
  const passa = JSON.stringify(valore) === JSON.stringify(atteso);
  passa ? ok++ : ko++;
  if (verbose || !passa) console.log((passa ? '  ok   ' : '  ERRORE ') + nome + ': ' + JSON.stringify(valore) + (passa ? '' : ' (atteso ' + JSON.stringify(atteso) + ')'));
}
const ADESSO = '2026-11-24T10:00:00.000Z';

function caso(strati, { zFalda = 7.5, amax = 0.25, dati = [[8, 15, 10]] } = {}) {
  const b = P.nuovaProva('SPT', 'validazione');
  b.colonne = ['z', 'N', 'FC']; b.unita.FC = '%'; b.dati = dati;
  b.parametri = { CE: 1, CB: 1, CS: 1, sporgenza: 1, senzaRivestimento: false };
  const s = P.nuovoScenario(b, 'validazione', 0);
  Object.assign(s, { metodo: 'bi2014Spt', Mw: 6.5, amax, zFalda, strati });
  return { b, s, errori: F.controllaScenario(b, s, L), avvisi: F.avvisiScenario(s), r: F.calcolaScenario(b, s, L, { adesso: ADESSO }) };
}
const codici = (lista) => lista.map(e => e.codice);
const strato = (da, a, gamma, gammaSat) => ({ da, a, gamma, gammaSat, FC: 10, descrizione: '' });

console.log('1. Pesi di volume incoerenti: errori bloccanti');
{
  let c = caso([strato(0, 20, 22, 15)]);
  check('γsat < γ: errore', codici(c.errori), ['GSAT_MINORE_GAMMA']);
  check('γsat < γ: calcolo non eseguito', c.r.stato, 'input_non_valido');
  c = caso([strato(0, 20, 19, 19)]);
  check('γsat = γ: ammesso', [codici(c.errori), c.r.stato], [[], 'calcolato']);
  c = caso([strato(0, 3, 9, 9), strato(3, 20, 22, 22)], { zFalda: 0, dati: [[2, 10, 10], [15, 10, 10]] });
  check('σ\'v negativa tra 0 e 3 m e positiva a 20 m (audit B5.3): errore sullo strato', codici(c.errori), ['GSAT_NON_SUPERA_GAMMA_W']);
  check('σ\'v negativa intermedia: calcolo non eseguito', c.r.stato, 'input_non_valido');
  c = caso([strato(0, 20, 18, L.GAMMA_W)]);
  check('γsat = γw: errore', codici(c.errori).includes('GSAT_NON_SUPERA_GAMMA_W'), true);
  check('messaggio con lo strato e l\'unità', /strato 0–20 m: γsat = 9,81 kN\/m³ non supera/.test(c.errori.find(e => e.codice === 'GSAT_NON_SUPERA_GAMMA_W').motivo), true);
}

console.log('2. γsat > γw garantisce σ\'v > 0 a ogni profondità (nessun controllo per interfaccia)');
{
  let seme = 12345;
  const rnd = () => { seme = (seme * 1103515245 + 12345) % 2147483648; return seme / 2147483648; };
  let casi = 0, negativi = 0;
  for (let k = 0; k < 400; k++) {
    const n = 1 + Math.floor(rnd() * 6), strati = [];
    let z = 0;
    for (let i = 0; i < n; i++) {
      const a = i === n - 1 ? 20 : Math.min(20, z + 0.2 + rnd() * 6);
      const gsat = L.GAMMA_W + 1e-6 + rnd() * 15, g = 1 + rnd() * (gsat - 1);
      strati.push(strato(z, a, g, gsat)); z = a; if (z >= 20) break;
    }
    const zFalda = rnd() * 21;
    const c = caso(strati, { zFalda });
    if (c.errori.length) continue;
    casi++;
    for (let zi = 0.05; zi <= 20; zi += 0.05) { const t = L.tensioni(strati, zFalda, zi); if (t.stato !== 'calcolato' || !(t.sve > 0)) negativi++; }
  }
  check('stratigrafie casuali accettate', casi > 300, true);
  check('nessuna profondità con σ\'v ≤ 0 (passo 5 cm, 0–20 m)', negativi, 0);
}

console.log('3. Unità dei pesi di volume e di amax: avvisi non bloccanti');
{
  let c = caso([strato(0, 8, 1.85, 1.98)]);
  check('g/cm³ (audit B5.2): avvisi su γ e γsat', codici(c.avvisi), ['PESO_DI_VOLUME_INSOLITO', 'PESO_DI_VOLUME_INSOLITO']);
  check('g/cm³: γsat ≤ γw blocca il calcolo (prima FS 1,99 invece di 1,02)', [codici(c.errori), c.r.stato], [['GSAT_NON_SUPERA_GAMMA_W'], 'input_non_valido']);
  check('messaggio con la conversione', /1,85 g\/cm³ ≈ 18,1 kN\/m³/.test(c.avvisi[0].messaggio), true);
  c = caso([strato(0, 20, 1850, 1980)]);
  check('kg/m³: avvisi, calcolo eseguito', [codici(c.avvisi).length, codici(c.errori), c.r.stato], [2, [], 'calcolato']);
  check('kg/m³: avvisi nel risultato', c.r.avvisiScenario.length, 2);
  for (const [g, atteso] of [[11, 0], [27, 0], [10.9, 1], [27.1, 1]]) check('γ = ' + g + ' (γsat 27)', caso([strato(0, 20, g, 27)]).avvisi.length, atteso);
  c = caso([strato(0, 20, 18.5, 19.8)], { amax: 2.45 });
  check('amax = 2,45 (audit B5.4): avviso, calcolo eseguito', [codici(c.avvisi), c.r.stato], [['AMAX_INSOLITA'], 'calcolato']);
  check('amax: messaggio con la conversione', /2,45 m\/s² ≈ 0,25 g/.test(c.avvisi[0].messaggio), true);
  check('amax = 1,0 g: nessun avviso', caso([strato(0, 20, 18.5, 19.8)], { amax: 1.0 }).avvisi, []);
}

console.log('4. Esempio sintetico e uscite');
{
  const pr = E.progettoEsempio();
  for (const s of pr.scenari) {
    const pv = pr.prove.find(p => p.id === s.provaId);
    check('esempio «' + s.nome + '»: nessun errore e nessun avviso', [F.controllaScenario(pv, s, L), F.avvisiScenario(s)], [[], []]);
  }
  const c = caso([strato(0, 20, 1850, 1980)]);
  const csv = X.csvRisultati({ progetto: { titolo: 't', sito: '' } }, c.b, c.s, c.r);
  check('CSV: avvisi sui dati nell\'intestazione', (csv.match(/# Avviso sui dati dello scenario/g) || []).length, 2);
  const [b, s] = [pr.prove[0], pr.scenari[0]];
  check('CSV dell\'esempio: nessun avviso sui dati', /Avviso sui dati/.test(X.csvRisultati(pr, b, s, F.calcolaScenario(b, s, L, { adesso: ADESSO }))), false);
}

console.log('5. File di progetto: profondità obbligatorie e crescenti (audit §4 punto 1)');
{
  const base = () => JSON.parse(P.salvaProgetto(E.progettoEsempio()));
  check('esempio: aperto', P.apriProgetto(JSON.stringify(base())).ok, true);
  let a = base(); a.prove[0].dati.splice(100, 0, a.prove[0].dati[100].slice());
  let esito = P.apriProgetto(JSON.stringify(a));
  check('profondità ripetuta: file rifiutato', [esito.ok, esito.errori.some(e => e.campo === 'prove[0].dati[101][0]' && /non crescente/.test(e.motivo))], [false, true]);
  a = base(); a.prove[1].dati.reverse();
  esito = P.apriProgetto(JSON.stringify(a));
  check('profondità decrescenti: file rifiutato', [esito.ok, esito.errori.length > 0 && esito.errori.every(e => /non crescente/.test(e.motivo))], [false, true]);
  a = base(); a.prove[1].dati[3][0] = null;
  esito = P.apriProgetto(JSON.stringify(a));
  check('profondità mancante: file rifiutato', [esito.ok, esito.errori.some(e => /profondità mancante/.test(e.motivo))], [false, true]);
  a = base(); a.prove[1].dati[3][1] = null;
  check('altro dato mancante (N): file aperto come prima', P.apriProgetto(JSON.stringify(a)).ok, true);
}

console.log('\nRisultato: ' + ok + ' controlli superati, ' + ko + ' non superati.');
process.exit(ko ? 1 : 0);
