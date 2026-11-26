#!/usr/bin/env node
/*
 * verifica_formato.mjs — formato del file di progetto e struttura del CSV (v1.0.2, punti 1 e 2 della specifica).
 *
 * versioneFormato 2: il writer scrive sempre 2; i file 1 si aprono come sono; un formato più recente si
 * rifiuta con «aggiorna l'app». CSV: seconda riga `# schema_version;2`, nessuna riga persa, regola in docs/sviluppo.md.
 *
 * Uso:   node verifiche/verifica_formato.mjs [--verbose]
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
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
const canon = (x) => JSON.stringify(x, (k, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map(c => [c, v[c]])) : v);

const pr = E.progettoEsempio();
const salvato = JSON.parse(P.salvaProgetto(pr));

// --- file di progetto
check('versione del formato corrente', P.VERSIONE_FORMATO, 2);
check('il progetto nuovo dichiara il formato 2', P.apriProgetto(P.salvaProgetto(pr)).progetto.versioneFormato, 2);
check('il file salvato dall\'esempio dichiara il formato 2', salvato.versioneFormato, 2);

const v1 = { ...salvato, versioneFormato: 1 };
const aperto1 = P.apriProgetto(JSON.stringify(v1));
check('file formato 1: si apre', aperto1.ok, true);
check('file formato 1: nessun errore', aperto1.errori || [], []);
check('file formato 1: input identici', canon({ ...aperto1.progetto, versioneFormato: 0, risultati: undefined }), canon({ ...pr, versioneFormato: 0, risultati: undefined }));
check('file formato 1: al nuovo salvataggio diventa formato 2', JSON.parse(P.salvaProgetto(aperto1.progetto)).versioneFormato, 2);

const aperto2 = P.apriProgetto(JSON.stringify({ ...salvato, versioneFormato: 2 }));
check('file formato 2: si apre', aperto2.ok, true);
const aperto3 = P.apriProgetto(JSON.stringify({ ...salvato, versioneFormato: 3 }));
check('file formato 3: rifiutato', aperto3.ok, false);
check('file formato 3: messaggio «aggiorna l\'app» con i formati', aperto3.errori.some(e => /aggiorna l'app \(formato 3, questa versione legge fino al formato 2/.test(e.motivo)), true);
check('file formato 3: nessun progetto restituito', aperto3.progetto === undefined || aperto3.progetto === null, true);
for (const v of [0, '2', 1.5, null, 99]) {
  const e = P.apriProgetto(JSON.stringify({ ...salvato, versioneFormato: v }));
  check('versioneFormato ' + JSON.stringify(v) + ': rifiutato', e.ok, false);
}
check('versioneFormato assente: rifiutato', P.apriProgetto(JSON.stringify((({ versioneFormato, ...r }) => r)(salvato))).ok, false);

// la firma di calcolo non dipende dal formato del file
const p = pr.prove[0], s = pr.scenari[0];
const riaperto = P.apriProgetto(JSON.stringify(v1)).progetto;
check('firma di calcolo uguale tra progetto aperto da formato 1 e progetto originale', P.firmaInput(riaperto.prove[0], riaperto.scenari[0], L.VERSIONE), P.firmaInput(pr.prove[0], pr.scenari[0], L.VERSIONE));

// --- CSV
const r = F.calcolaScenario(p, s, L);
const versioni = { indici: 'x', cedimenti: 'y', zs9: 'z' };
const righe = X.csvRisultati(pr, p, s, r, { decimale: '.', versioni }).split('\r\n');
check('CSV riga 1: intestazione invariata', righe[0], '# GeoHub-LiquiSite – risultati;versione;' + P.VERSIONE_APP);
check('CSV riga 2: schema_version', righe[1], '# schema_version;2');
check('CSV riga 3: il progetto segue lo schema_version', righe[2].startsWith('# Progetto;'), true);
check('CSV: una sola riga schema_version', righe.filter(x => x.startsWith('# schema_version')).length, 1);
for (const intest of ['# Progetto', '# Sito', '# Prova', '# Scenario', '# Metodo', '# Mw', '# FS di riferimento', '# Criterio di verifica', '# Motore', '# Moduli']) {
  check('CSV: riga «' + intest + '» presente', righe.some(x => x.startsWith(intest + ';')), true);
}
const senza = righe.filter((x, i) => i !== 1);
check('CSV: tolta la riga schema_version le altre righe hanno l\'ordine della 1.0.1', senza.slice(0, 3).map(x => x.split(';')[0]), ['# GeoHub-LiquiSite – risultati', '# Progetto', '# Sito']);
check('CSV: la tabella dei risultati è ancora presente', righe.some(x => x.startsWith('z [m];')), true);

// --- regola scritta
const sviluppo = fs.readFileSync(new URL('../docs/sviluppo.md', import.meta.url), 'utf8');
check('docs/sviluppo.md: regola dello schema del CSV', /schema_version/.test(sviluppo) && /solo in coda/.test(sviluppo), true);
check('docs/sviluppo.md: formato del progetto 2', /versioneFormato` 2/.test(sviluppo), true);

console.log('\nRisultato: ' + ok + ' controlli superati, ' + ko + ' non superati.');
process.exit(ko ? 1 : 0);
