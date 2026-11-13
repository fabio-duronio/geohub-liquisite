// Regressione: coerenza di Ic in grafico, tabella ed esportazione per i punti oltre soglia.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const F=require('../app/profilo.js'), L=require('../motore/liquisite.js'), E=require('../app/esempio.js'), X=require('../app/esporta.js');
const pr=E.progettoEsempio(), s=pr.scenari[0], p=pr.prove[0];
const r=F.calcolaScenario(p,s,L);
const escluso=r.righe.find(x=>x.codice==='IC_OLTRE_SOGLIA');assert(escluso);
assert.equal(F.valoreRisultato(escluso,'Ic'),escluso.valori.Ic);
assert.equal(F.valoreRisultato(escluso,'FS'),null);
assert(F.serie(r,'Ic').punti.some(x=>x.indice===escluso.indice));
const lines=X.csvRisultati(pr,p,s,r,{decimale:'.'}).split('\r\n');
const csv=lines.slice(lines.findIndex(x=>x.startsWith('z [m];')));
const cols=csv[0].split(';'), data=csv[escluso.indice+1].split(';');
assert.equal(Number(data[cols.indexOf('Ic')]),escluso.valori.Ic);
assert.equal(data[cols.indexOf('FS')],'');
console.log('Restituzione: 6 controlli superati (Ic oltre soglia visibile, FS non inventato).');
