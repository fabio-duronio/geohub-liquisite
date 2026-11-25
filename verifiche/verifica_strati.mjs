#!/usr/bin/env node
/*
 * verifica_strati.mjs — identificativo stabile degli strati e collegamento dei dati della verifica
 * preliminare (curva granulometrica, campione, giudizio del geologo) — audit v1.0.0, B4.3.
 * Nessuna formula coinvolta; la firma degli input non dipende dagli identificativi.
 *
 * Uso:   node verifiche/verifica_strati.mjs [--verbose]
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const L = require('../motore/liquisite.js');
const P = require('../app/progetto.js');
const F = require('../app/profilo.js');
const X = require('../app/esclusione.js');
const E = require('../app/esempio.js');

const verbose = process.argv.includes('--verbose');
let ok = 0, ko = 0;
function check(nome, valore, atteso) {
  const passa = JSON.stringify(valore) === JSON.stringify(atteso);
  passa ? ok++ : ko++;
  if (verbose || !passa) console.log((passa ? '  ok   ' : '  ERRORE ') + nome + ': ' + JSON.stringify(valore) + (passa ? '' : ' (atteso ' + JSON.stringify(atteso) + ')'));
}
const RE_ID = /^[A-Za-z0-9_.:-]{1,64}$/;
const senzaId = (o) => { const c = P.copia(o); for (const s of c.scenari) { s.strati.forEach(st => delete st.id); (s.esclusione.strati || []).forEach(v => delete v.stratoId); } return c; };
const campione = (sc, i) => X.datiStrato(X.datiEsclusione(sc), sc.strati[i]).campione;

console.log('1. Esempio: id stabili e voci collegate');
{
  const pr = E.progettoEsempio();
  for (const s of pr.scenari) {
    const ids = s.strati.map(x => x.id);
    check('«' + s.nome + '»: id validi e distinti', [ids.every(i => RE_ID.test(i)), new Set(ids).size === ids.length], [true, true]);
    check('«' + s.nome + '»: ogni voce della verifica preliminare collegata a uno strato', s.esclusione.strati.every(v => ids.includes(v.stratoId)), true);
    check('«' + s.nome + '»: id per primo nell\'oggetto', Object.keys(s.strati[0])[0], 'id');
  }
}

console.log('2. Cambio di quota (audit B4.3)');
{
  const pr = E.progettoEsempio(), s = pr.scenari[1];
  check('prima: campione dello strato 1,20–3,40 m', campione(s, 1), 'S1-C1, 2,5–3,0 m');
  s.strati[0].a = 1.25; s.strati[1].da = 1.25;
  check('confine 1,20 → 1,25 m: curva e campione restano', [campione(s, 1), X.datiStrato(X.datiEsclusione(s), s.strati[1]).curva.length], ['S1-C1, 2,5–3,0 m', 8]);
  const r = F.calcolaScenario(pr.prove[1], s, L);
  const st = X.valutaEsclusione(L, pr.prove[1], s, r).strati[1];
  check('esito dello strato invariato (criterio 4 confermato dal geologo)', [st.da, st.c4.soddisfatto, st.esito], [1.25, true, 'escluso']);
  X.aggiornaStrato(s, s.strati[1], { campione: 'S1-C1 bis' });
  check('aggiornamento: quote della voce allineate allo strato', s.esclusione.strati.filter(v => v.stratoId === s.strati[1].id).map(v => [v.da, v.campione]), [[1.25, 'S1-C1 bis']]);
}

console.log('3. Salvataggio e riapertura');
{
  const pr = E.progettoEsempio();
  const ap = P.apriProgetto(P.salvaProgetto(pr));
  check('file della versione corrente: aperto', ap.ok, true);
  check('id degli strati conservati', ap.progetto.scenari.map(s => s.strati.map(x => x.id)), pr.scenari.map(s => s.strati.map(x => x.id)));
  check('collegamenti conservati', ap.progetto.scenari.map(s => s.esclusione.strati.map(v => v.stratoId)), pr.scenari.map(s => s.esclusione.strati.map(v => v.stratoId)));
}

console.log('4. File della versione 1.0.0 (senza id)');
{
  const vecchio = senzaId(JSON.parse(P.salvaProgetto(E.progettoEsempio())));
  const ap = P.apriProgetto(JSON.stringify(vecchio));
  check('aperto', ap.ok, true);
  const s = ap.progetto.scenari[1];
  check('id assegnati a tutti gli strati', s.strati.every(x => RE_ID.test(x.id)), true);
  check('voci collegate per quote all\'apertura', s.esclusione.strati.every(v => s.strati.some(x => x.id === v.stratoId)), true);
  s.strati[0].a = 1.25; s.strati[1].da = 1.25;
  check('dopo l\'apertura il cambio di quota non separa i dati', campione(s, 1), 'S1-C1, 2,5–3,0 m');
}

console.log('5. File alterati');
{
  const base = () => JSON.parse(P.salvaProgetto(E.progettoEsempio()));
  let a = base(); a.scenari[0].strati[1].id = a.scenari[0].strati[0].id;
  let e = P.apriProgetto(JSON.stringify(a));
  check('id dello strato ripetuto: file rifiutato', [e.ok, e.errori.some(x => x.campo === 'scenari[0].strati[1].id')], [false, true]);
  a = base(); a.scenari[0].strati[0].id = '<b>x</b>';
  check('id dello strato non valido: file rifiutato', P.apriProgetto(JSON.stringify(a)).ok, false);
  a = base(); a.scenari[0].esclusione.strati[1].stratoId = a.scenari[0].esclusione.strati[0].stratoId;
  e = P.apriProgetto(JSON.stringify(a));
  check('due voci per lo stesso strato: file rifiutato', [e.ok, e.errori.some(x => x.campo === 'scenari[0].esclusione.strati[1].stratoId')], [false, true]);
  a = base(); a.scenari[0].esclusione.strati[0].stratoId = 'strato-inesistente';
  check('voce di uno strato inesistente: file aperto, voce conservata', [P.apriProgetto(JSON.stringify(a)).ok, P.apriProgetto(JSON.stringify(a)).progetto.scenari[0].esclusione.strati.length], [true, 7]);
}

console.log('6. Strato eliminato e strato nuovo con le stesse quote');
{
  const pr = E.progettoEsempio(), s = pr.scenari[0];
  const tolto = s.strati.splice(1, 1)[0];
  s.strati.splice(1, 0, { id: P.nuovoId('strato'), da: tolto.da, a: tolto.a, gamma: 18, gammaSat: 19, FC: null, descrizione: '' });
  check('lo strato nuovo non eredita la curva del vecchio', X.datiStrato(X.datiEsclusione(s), s.strati[1]).curva, null);
}

console.log('7. La firma degli input non dipende dagli identificativi');
{
  const pr = E.progettoEsempio(), pv = pr.prove[0], s = pr.scenari[0];
  const f = P.firmaInput(pv, s, L.VERSIONE_MOTORE);
  const s2 = P.copia(s); s2.strati.forEach(x => { x.id = P.nuovoId('strato'); });
  const s3 = P.copia(s); s3.strati.forEach(x => delete x.id);
  check('id diversi: stessa firma', P.firmaInput(pv, s2, L.VERSIONE_MOTORE), f);
  check('senza id (come nella 1.0.0): stessa firma', P.firmaInput(pv, s3, L.VERSIONE_MOTORE), f);
}

console.log('\nRisultato: ' + ok + ' controlli superati, ' + ko + ' non superati.');
process.exit(ko ? 1 : 0);
