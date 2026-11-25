#!/usr/bin/env node
/*
 * verifica_firma.mjs — firma del rapporto (audit v1.0.0, rilievo 13.a): distinta dalla firma di calcolo.
 * La firma di calcolo non cambia con FS di riferimento e Verifica preliminare (non cambiano i risultati);
 * la firma del rapporto sì, e cambia anche con le versioni dei moduli. Nel CSV compare insieme alle versioni.
 *
 * Uso:   node verifiche/verifica_firma.mjs [--verbose]
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const L = require('../motore/liquisite.js');
const P = require('../app/progetto.js');
const F = require('../app/profilo.js');
const E = require('../app/esempio.js');
const XP = require('../app/esporta.js');
const IND = require('../motore/indici.js');
const CED = require('../motore/cedimenti.js');

const verbose = process.argv.includes('--verbose');
let ok = 0, ko = 0;
function check(nome, valore, atteso) {
  const passa = JSON.stringify(valore) === JSON.stringify(atteso);
  passa ? ok++ : ko++;
  if (verbose || !passa) console.log((passa ? '  ok   ' : '  ERRORE ') + nome + ': ' + JSON.stringify(valore) + (passa ? '' : ' (atteso ' + JSON.stringify(atteso) + ')'));
}
const ver = { motore: L.VERSIONE_MOTORE, indici: IND.VERSIONE_INDICI, cedimenti: CED.VERSIONE_CEDIMENTI, zs9: '1.2.0' };
const pr = E.progettoEsempio(), sc = pr.scenari[0], pv = pr.prove.find(p => p.id === sc.provaId) || pr.prove[0];

const fc = P.firmaInput(pv, sc, ver.motore), fr = P.firmaRapporto(pv, sc, ver);
check('formato 8 cifre esadecimali', /^[0-9a-f]{8}$/.test(fr), true);
check('distinta dalla firma di calcolo', fr !== fc, true);
check('stabile a parità di input', P.firmaRapporto(pv, sc, ver), fr);

sc.opzioni.FSrif = 1.5;
check('FS di riferimento: firma di calcolo invariata', P.firmaInput(pv, sc, ver.motore), fc);
check('FS di riferimento: firma del rapporto cambia', P.firmaRapporto(pv, sc, ver) !== fr, true);
sc.opzioni.FSrif = P.FS_RIFERIMENTO;
check('ripristinato il FS: torna la firma di prima', P.firmaRapporto(pv, sc, ver), fr);

sc.esclusione.pcSubOrizzontale = !sc.esclusione.pcSubOrizzontale;
check('Verifica preliminare: firma di calcolo invariata', P.firmaInput(pv, sc, ver.motore), fc);
check('Verifica preliminare: firma del rapporto cambia', P.firmaRapporto(pv, sc, ver) !== fr, true);
sc.esclusione.pcSubOrizzontale = !sc.esclusione.pcSubOrizzontale;

for (const k of ['indici', 'cedimenti', 'zs9']) check('versione ' + k + ': la firma del rapporto cambia', P.firmaRapporto(pv, sc, { ...ver, [k]: ver[k] + '.x' }) !== fr, true);

const r = F.calcolaScenario(pv, sc, L);
const csv = XP.csvRisultati(pr, pv, sc, r, { versioni: ver });
check('CSV: versioni e firma del rapporto', csv.includes('indici ' + ver.indici) && csv.includes('cedimenti ' + ver.cedimenti) && csv.includes('ZS9 1.2.0') && csv.includes('firma del rapporto;' + fr), true);
check('CSV senza versioni: nessuna riga dei moduli', XP.csvRisultati(pr, pv, sc, r).includes('firma del rapporto'), false);

console.log('Risultato: ' + ok + ' controlli superati, ' + ko + ' non superati.');
process.exit(ko ? 1 : 0);
