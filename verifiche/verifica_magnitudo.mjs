// GeoHub-LiquiSite — verifiche della proposta di Mw dalle zone ZS9 (livello applicativo).
// Copyright (C) 2026 Fabio Duronio — AGPL-3.0 con i termini aggiuntivi del file NOTICE.
//
// Uso:  node verifiche/verifica_magnitudo.mjs      (esce con codice 1 se un controllo fallisce)
//
// 1. File copiati da GeoHub-SismaSite (PR #31, zs9 v1.2.0) senza modifiche: impronte SHA-256.
// 2. dati/zs9-data.js (per il browser) contiene lo stesso testo di dati/zs9-data.json.
// 3. Controllo delle coordinate: intervallo, valori non numerici, ordine lat/lon, fuori Italia.
// 4. Proposta per le località di controllo (stessi casi delle verifiche di SismaSite).
// 5. Mw dello scenario: proposta o manuale, motivazione obbligatoria se diversa, avvisi < 5 e < 5,5.
// 6. Formato del progetto: coordinate e origine della Mw salvate e riaperte; file precedenti.
// 7. Le coordinate non entrano nel calcolo: firma degli input e FS invariati a parità di Mw.
// 8. Testi per la stampa: fonte, criterio, datum, criticità.
// Nessuna formula: zona, distanze e Mw vengono dal modulo moduli/zs9.js.
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { createHash } from 'crypto';
import vm from 'vm';

const require = createRequire(import.meta.url);
const P = require('../app/progetto.js');
const MG = require('../app/magnitudo.js');
const F = require('../app/profilo.js');
const E = require('../app/esempio.js');
const L = require('../motore/liquisite.js');
const ZS9 = require('../moduli/zs9.js');
const D = require('../dati/zs9-data.json');

let ok = 0, ko = 0;
const check = (nome, ottenuto, atteso) => {
  const a = JSON.stringify(ottenuto), b = JSON.stringify(atteso);
  if (a === b) ok++; else { ko++; console.log('  ERRORE ' + nome + ': ' + a + ' (atteso ' + b + ')'); }
};
const sha = (rel) => createHash('sha256').update(readFileSync(new URL('../' + rel, import.meta.url))).digest('hex');

console.log('1. File copiati da GeoHub-SismaSite senza modifiche (PR #31, zs9 v1.2.0)');
{
  const ATTESI = {
    'moduli/zs9.js': '615243123454bd4b5f95a24bafb24b5853a546abe97c7e850ab2d61752d9d6aa',
    'dati/zs9-data.json': '3a15606a05e51713a2ca66065a53343e39da8b392d061141c5efa9e196ea1dc0',
    'strumenti/convert_zs9.py': 'a738a135ecd06742dca8c66397252439bcb59d209cf032b856c2032e37defb31',
    'verifiche/verifica_zs9.mjs': '6ff2b06866650d52844099bbe84bb154bcf4ad3e74d14b95b99586ab722bc49d',
    'verifiche/verifica_zs9.py': '24da04b85a30c3cf9c1d579de0ba2c485af287d60728d89a30820905a5bac079'
  };
  for (const [f, h] of Object.entries(ATTESI)) check('SHA-256 di ' + f, sha(f), h);
  check('versione del modulo', ZS9.VERSIONE, '1.2.0');
  check('versione verificata dal livello applicativo', MG.VERSIONE_ZS9, ZS9.VERSIONE);
}

console.log('2. dati/zs9-data.js identico a dati/zs9-data.json');
{
  const js = readFileSync(new URL('../dati/zs9-data.js', import.meta.url), 'utf8');
  const json = readFileSync(new URL('../dati/zs9-data.json', import.meta.url), 'utf8').trimEnd();
  check('testo JSON contenuto byte per byte', js.includes('root.LiquiZS9Dati = ' + json + '; })('), true);
  const ctx = {}; vm.runInNewContext(js, { self: ctx });
  check('oggetto per il browser uguale al JSON', JSON.stringify(ctx.LiquiZS9Dati), JSON.stringify(D));
  check('nessun altro codice nel file', js.replace(json, '').length < 400, true);
}

console.log('3. Coordinate del sito');
{
  const st = (a, b) => MG.statoCoordinate(a, b).stato;
  check('vuote', st(null, null), 'vuote');
  check('solo latitudine', st(42.35, null), 'incomplete');
  check('solo longitudine', st(undefined, 13.4), 'incomplete');
  check('latitudine non numerica (NaN dal campo)', st(NaN, 13.4), 'non_valide');
  check('latitudine come testo', st('42.35', 13.4), 'non_valide');
  check('latitudine 95°', st(95, 13.4), 'non_valide');
  check('longitudine −181°', st(42, -181), 'non_valide');
  check('valide', st(42.3498, 13.3995), 'valide');
  check('messaggio di intervallo', /tra −90° e 90°/.test(MG.statoCoordinate(95, 13).errori[0].motivo), true);
  check('messaggio sui gradi decimali', /gradi decimali/.test(MG.statoCoordinate(NaN, 13).errori[0].motivo), true);
  const pr = (lat, lon) => { const p = P.nuovoProgetto(); p.progetto.lat = lat; p.progetto.lon = lon; return MG.proposta(p, ZS9, D); };
  const inv = pr(13.3995, 42.3498);
  check('lat/lon invertite: fuori dominio, nessuna Mw', [inv.esito, inv.disponibile, inv.mw], ['fuori_dominio', false, null]);
  check('lat/lon invertite: avviso del modulo', /invertite/.test(inv.motivo), true);
  const parigi = pr(48.8566, 2.3522);
  check('Parigi: fuori dal territorio ZS9', [parigi.esito, parigi.disponibile], ['fuori_dominio', false]);
  const vuoto = pr(null, null);
  check('senza coordinate: proposta non disponibile', [vuoto.esito, vuoto.disponibile, vuoto.zs9], ['coordinate', false, null]);
  const errata = pr(95, 13);
  check('coordinate fuori intervallo: modulo non chiamato', [errata.esito, errata.zs9], ['coordinate', null]);
  check('senza modulo: nessuna proposta', MG.proposta({ progetto: { lat: 42, lon: 13 } }, null, D).esito, 'modulo_assente');
}

console.log('4. Proposta per le località di controllo');
const LOC = [
  ["L'Aquila", 42.3498, 13.3995, 'dentro_zona', 923, 7.06], ['Sulmona', 42.0480, 13.9262, 'dentro_zona', 923, 7.06],
  ['Avezzano', 42.0310, 13.4260, 'dentro_zona', 923, 7.06], ['Norcia', 42.7925, 13.0930, 'dentro_zona', 923, 7.06],
  ['Teramo', 42.6589, 13.7044, 'dentro_zona', 918, 6.37], ['Chieti', 42.3510, 14.1675, 'dentro_zona', 918, 6.37],
  ['Mirandola', 44.8870, 11.0660, 'dentro_zona', 912, 6.14],
  ['Pescara', 42.4618, 14.2161, 'fuori_zona', null, 7.06], ['Francavilla al Mare', 42.4210, 14.2870, 'fuori_zona', null, 7.06],
  ['Ortona', 42.3550, 14.4030, 'fuori_zona', null, 7.06], ['Lanciano', 42.2310, 14.3900, 'fuori_zona', null, 7.06],
  ['Vasto', 42.1120, 14.7080, 'fuori_zona', null, 7.06]
];
const progettoA = (lat, lon) => { const p = P.nuovoProgetto(); p.progetto.lat = lat; p.progetto.lon = lon; return p; };
for (const [nome, la, lo, esito, zona, mw] of LOC) {
  const r = MG.proposta(progettoA(la, lo), ZS9, D);
  check(nome, [r.esito, r.zs9.zona, r.mw, r.disponibile, esito === 'fuori_zona' ? r.zs9.tabella.length : null],
    [esito, zona, mw, true, esito === 'fuori_zona' ? 36 : null]);
}
{
  const r = MG.proposta(progettoA(42.4618, 14.2161), ZS9, D);
  check('Pescara: tabella con le zone escluse', r.zs9.tabella.some(t => !t.ammissibile) && r.zs9.tabella.some(t => t.ammissibile), true);
  check('Pescara: testo con zona più vicina e zone selezionate', /918 a 2,07 km.*zona 923, 927/.test(r.titolo), true);
  const s = MG.proposta(progettoA(40.0, 8.5), ZS9, D);
  check('Sardegna (40,0; 8,5): disaggregazione richiesta, nessuna Mw', [s.esito, s.disponibile, s.mw], ['disaggregazione_richiesta', false, null]);
  check('disaggregazione: motivo dichiarato', /disaggregazione, che LiquiSite non calcola/.test(s.motivo), true);
}

console.log('5. Mw dello scenario');
{
  const prop = MG.proposta(progettoA(42.3498, 13.3995), ZS9, D);            // L'Aquila, 7,06
  const nessuna = MG.proposta(progettoA(null, null), ZS9, D);
  const disag = MG.proposta(progettoA(40.0, 8.5), ZS9, D);
  const sc = () => { const s = P.nuovoScenario(null, 'S'); return s; };
  check('nuovo scenario: origine manuale, motivazione vuota', P.nuovoScenario(null).magnitudo, { origine: 'manuale', motivazione: '' });

  const a = sc();
  check('applica proposta', MG.applicaProposta(a, prop), true);
  check('dopo applica: origine zs9 e Mw 7,06', [a.magnitudo.origine, a.Mw], ['zs9', 7.06]);
  check('uguale alla proposta: nessun errore', MG.statoMagnitudo(a, prop).errori, []);
  a.Mw = 6.5;
  const e1 = MG.statoMagnitudo(a, prop);
  check('diversa senza motivazione: errore', e1.errori.map(e => e.campo), ['magnitudo.motivazione']);
  check('testo dell\'errore', e1.errori[0].motivo, 'Mw 6,50 diversa dalla proposta ZS9 (7,06): la motivazione è obbligatoria.');
  a.magnitudo.motivazione = '   ';
  check('motivazione di soli spazi: errore', MG.statoMagnitudo(a, prop).errori.length, 1);
  a.magnitudo.motivazione = 'disaggregazione INGV, nodo 26339, PoE 10 % in 50 anni';
  check('diversa con motivazione: nessun errore', MG.statoMagnitudo(a, prop).errori, []);
  check('diversa: segnalata', MG.statoMagnitudo(a, prop).diversa, true);

  const b = sc(); b.Mw = 6.5;
  check('manuale senza coordinate: nessun errore', MG.statoMagnitudo(b, nessuna).errori, []);
  check('manuale diversa dalla proposta: motivazione obbligatoria', MG.statoMagnitudo(b, prop).errori.map(e => e.campo), ['magnitudo.motivazione']);
  b.Mw = 7.06;
  check('manuale uguale alla proposta: nessun errore', MG.statoMagnitudo(b, prop).errori, []);

  const c = sc(); c.magnitudo.origine = 'zs9'; c.Mw = 6.2;
  check('origine zs9 senza coordinate: errore', MG.statoMagnitudo(c, nessuna).errori.map(e => e.campo), ['magnitudo.origine']);
  check('origine zs9 con disaggregazione richiesta: errore', MG.statoMagnitudo(c, disag).errori.map(e => e.campo), ['magnitudo.origine']);
  check('applica proposta non disponibile: nessuna modifica', [MG.applicaProposta(c, disag), c.Mw], [false, 6.2]);

  const av = (mw) => { const s = sc(); s.Mw = mw; return MG.statoMagnitudo(s, nessuna).avvisi.map(x => x.codice); };
  check('Mw 4,8: avvisi Linee guida LQ e Cetin', av(4.8), ['MW_SOTTO_5', 'MW_SOTTO_5_5']);
  check('Mw 5,0: solo Cetin (5 non è < 5)', av(5.0), ['MW_SOTTO_5_5']);
  check('Mw 5,49: solo Cetin', av(5.49), ['MW_SOTTO_5_5']);
  check('Mw 5,5: nessun avviso', av(5.5), []);
  check('Mw vuota: nessun avviso', av(null), []);
  check('avviso < 5: NTC 2018 senza criterio sulla magnitudo', /NTC 2018 non hanno un criterio sulla magnitudo/.test(MG.statoMagnitudo({ Mw: 4.8 }, nessuna).avvisi[0].testo), true);

  // allineamento degli scenari quando cambiano le coordinate
  const segue = sc(); MG.applicaProposta(segue, prop);
  const scelto = sc(); MG.applicaProposta(scelto, prop); scelto.Mw = 6.8; scelto.magnitudo.motivazione = 'scelta del geologo';
  const man = sc(); man.Mw = 6.1;
  const teramo = MG.proposta(progettoA(42.6589, 13.7044), ZS9, D);
  check('allinea: modifica solo lo scenario che seguiva la proposta', MG.allineaScenari([segue, scelto, man], prop, teramo), 1);
  check('allinea: Mw nuove', [segue.Mw, scelto.Mw, man.Mw], [6.37, 6.8, 6.1]);
  check('allinea: proposta non più disponibile → Mw vuota (errore in app)', [MG.allineaScenari([segue], teramo, nessuna), segue.Mw], [1, null]);

  check('testo origine (stampa e CSV)', MG.testoOrigine(scelto, teramo), 'Mw 6,80 – proposta dalle zone ZS9 (coordinate del sito); diversa dalla proposta ZS9 (6,37). Motivazione: scelta del geologo');
  check('testo origine manuale con disaggregazione', MG.testoOrigine(man, disag), 'Mw 6,10 – inserimento manuale; proposta ZS9 non disponibile (disaggregazione richiesta)');
}

console.log('6. Formato del progetto');
{
  const pr = E.progettoEsempio();
  check('esempio: senza coordinate', [pr.progetto.lat, pr.progetto.lon], [null, null]);
  check('esempio: Mw manuale in tutti gli scenari', pr.scenari.map(s => s.magnitudo.origine), ['manuale', 'manuale', 'manuale']);
  pr.progetto.lat = 42.4618; pr.progetto.lon = 14.2161; pr.progetto.noteZS9 = 'Sito costiero';
  pr.scenari[0].magnitudo = { origine: 'zs9', motivazione: 'prova' };
  const a = P.apriProgetto(P.salvaProgetto(pr));
  check('riapertura: coordinate e note', [a.ok, a.progetto.progetto.lat, a.progetto.progetto.lon, a.progetto.progetto.noteZS9], [true, 42.4618, 14.2161, 'Sito costiero']);
  check('riapertura: origine e motivazione', a.progetto.scenari[0].magnitudo, { origine: 'zs9', motivazione: 'prova' });

  const vecchio = JSON.parse(P.salvaProgetto(E.progettoEsempio()));
  delete vecchio.progetto.lat; delete vecchio.progetto.lon; delete vecchio.progetto.noteZS9;
  for (const s of vecchio.scenari) delete s.magnitudo;
  const v = P.apriProgetto(JSON.stringify(vecchio));
  check('file 0.2.x senza coordinate né origine: aperto', v.ok, true);
  check('file 0.2.x: Mw considerata manuale, valore invariato', v.progetto.scenari.map(s => [s.magnitudo.origine, s.Mw]), [['manuale', 6.1], ['manuale', 6.1], ['manuale', 6.1]]);
  check('file 0.2.x: coordinate vuote', [v.progetto.progetto.lat, v.progetto.progetto.lon, v.progetto.progetto.noteZS9], [null, null, '']);

  const alterato = (f) => { const o = JSON.parse(P.salvaProgetto(E.progettoEsempio())); f(o); return P.apriProgetto(JSON.stringify(o)); };
  const err = (r) => r.ok ? [] : r.errori.map(e => e.campo);
  check('latitudine come testo: file rifiutato', err(alterato(o => { o.progetto.lat = '42.35'; })), ['progetto.lat']);
  check('origine non ammessa: file rifiutato', err(alterato(o => { o.scenari[0].magnitudo.origine = 'disaggregazione'; })), ['scenari[0].magnitudo.origine']);
  check('origine ereditata (__proto__): file rifiutato', err(alterato(o => { o.scenari[0].magnitudo.origine = 'constructor'; })), ['scenari[0].magnitudo.origine']);
  check('magnitudo non oggetto: file rifiutato', err(alterato(o => { o.scenari[0].magnitudo = 'zs9'; })), ['scenari[0].magnitudo']);
  check('motivazione non testo: file rifiutato', err(alterato(o => { o.scenari[0].magnitudo.motivazione = 5; })), ['scenari[0].magnitudo.motivazione']);
  const fuori = alterato(o => { o.progetto.lat = 95; });
  check('latitudine 95 nel file: aperto e segnalato dall\'app, non sostituito', [fuori.ok, fuori.progetto.progetto.lat, MG.statoCoordinate(95, null).stato], [true, 95, 'non_valide']);
}

console.log('7. Le coordinate non entrano nel calcolo');
{
  const pr = E.progettoEsempio(), prova = pr.prove[0], s = pr.scenari[0];
  const f0 = P.firmaInput(prova, s, L.VERSIONE_MOTORE);
  const r0 = F.calcolaScenario(prova, s, L, { adesso: 'x' });
  pr.progetto.lat = 42.3498; pr.progetto.lon = 13.3995; s.magnitudo = { origine: 'manuale', motivazione: 'x' };
  check('firma invariata con coordinate e origine diverse', P.firmaInput(prova, s, L.VERSIONE_MOTORE), f0);
  const r1 = F.calcolaScenario(prova, s, L, { adesso: 'x' });
  check('FS identici a parità di Mw', r1.righe.map(x => x.valori && x.valori.FS), r0.righe.map(x => x.valori && x.valori.FS));
  MG.applicaProposta(s, MG.proposta(pr, ZS9, D));
  check('con la proposta (7,06) la firma cambia: la Mw entra nel calcolo', P.firmaInput(prova, s, L.VERSIONE_MOTORE) !== f0, true);
  const r2 = F.calcolaScenario(prova, s, L, { adesso: 'x' });
  check('calcolo con la Mw proposta', [r2.stato, r2.configurazione.scenario.Mw], ['calcolato', 7.06]);
}

console.log('8. Testi per la stampa');
{
  const T = MG.TESTI;
  check('fonte: Tab. A1.1 delle Linee guida LQ', /Linee guida LQ v1\.0.*Tab\. A1\.1, pag\. 31/.test(T.fonte), true);
  check('fonte: ZS9 Meletti et al. 2004, doi, CC BY 4.0', /Meletti et al\. \(2004\), INGV, doi:10\.13127\/sh\/zs9 – CC BY 4\.0/.test(T.fonte), true);
  check('criterio: interpretazione della regola, pag. 30', /interpretazione della regola delle Linee guida LQ, pag\. 30/.test(T.criterio), true);
  check('datum non dichiarato, scarto circa 100 m', /non dichiarato/.test(T.datum) && /circa 100 m/.test(T.datum), true);
  check('criticità: fonte pag. 31–32 e tre voci', [/pag\. 31–32/.test(T.criticitaFonte), T.criticita.length], [true, 3]);
  check('disaggregazione non calcolata', /non è calcolata da LiquiSite/.test(T.disaggregazione), true);
}

console.log('\nRisultato: ' + ok + ' controlli superati, ' + ko + ' non superati.');
process.exit(ko ? 1 : 0);
