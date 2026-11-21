// Regressione: i riferimenti ai file in index.html portano la versione dell'app (?v=), così i browser
// non riusano copie vecchie in cache (regola di docs/sviluppo.md). Chart.js porta la propria versione.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const P=require('../app/progetto.js');
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const rif=[...html.matchAll(/(?:src|href)="((?:vendor|css|motore|app|dati|moduli)\/[^"?]+)\?v=([^"]+)"/g)].map(m=>({file:m[1],v:m[2]}));
assert(rif.length>=18,'riferimenti con ?v= trovati: '+rif.length);
let n=1;
for(const {file,v} of rif){
  const atteso=file.startsWith('vendor/chart.js/')?'4.4.4':P.VERSIONE_APP;
  assert.equal(v,atteso,file+': ?v='+v+' invece di '+atteso);n++;
}
// ogni script locale dell'app deve avere il parametro ?v=
const senza=[...html.matchAll(/<script src="([^"?]+)"/g)].map(m=>m[1]);
assert.deepEqual(senza,[],'script senza ?v=: '+senza.join(', '));n++;
console.log('Risultato: '+n+' controlli superati, 0 non superati.');
