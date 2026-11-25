#!/usr/bin/env node
/*
 * verifica_grafici.mjs — etichette dei grafici (audit v1.0.0, §4 punto 10): disegno simulato su un
 * contesto che registra le chiamate, senza browser.
 *  - «falda» allineata al bordo destro (mai tagliata), sotto la linea se questa è vicina al bordo superiore;
 *  - riferimenti ravvicinati («FS = 1» e «FS rif 1,10»): la seconda etichetta sul lato opposto della linea;
 *  - nomi delle classi granulometriche disegnati dopo i fusi, su fondo bianco, omessi se la banda è stretta.
 *
 * Uso:   node verifiche/verifica_grafici.mjs [--verbose]
 */
import { createRequire } from 'node:module';
import vm from 'node:vm';
import fs from 'node:fs';
const sorgente = fs.readFileSync(new URL('../app/grafici.js', import.meta.url), 'utf8');
const sandbox = { self: {}, console };
vm.createContext(sandbox);
vm.runInContext(sorgente.replace(/\}\)\(typeof self !== 'undefined' \? self : this\);\s*$/, '})(self);'), sandbox);
const { linee, bandeGranulometriche } = sandbox.self.LiquiGrafici.plugin;

const verbose = process.argv.includes('--verbose');
let ok = 0, ko = 0;
function check(nome, valore, atteso) {
  const passa = JSON.stringify(valore) === JSON.stringify(atteso);
  passa ? ok++ : ko++;
  if (verbose || !passa) console.log((passa ? '  ok   ' : '  ERRORE ') + nome + ': ' + JSON.stringify(valore) + (passa ? '' : ' (atteso ' + JSON.stringify(atteso) + ')'));
}
function contesto() {
  const reg = [];
  const c = { reg, font: '', textAlign: 'left' };
  for (const m of ['save', 'restore', 'beginPath', 'rect', 'clip', 'moveTo', 'lineTo', 'stroke', 'setLineDash', 'rotate', 'fillRect'])
    c[m] = (...a) => reg.push([m, ...a]);
  c.translate = (...a) => reg.push(['translate', ...a]);
  c.fillText = (t, x, y) => reg.push(['fillText', t, x, y, c.textAlign]);
  c.measureText = (t) => ({ width: t.length * 6 });
  return c;
}
const area = { left: 50, right: 450, top: 20, bottom: 520 };
const scalaX = (v) => 50 + v * 100;        // x in [0, 4] → 50..450
const scalaY = (v) => 20 + v * 25;         // z in [0, 20]
const chart = (ctx) => ({ ctx, chartArea: area, scales: { x: { getPixelForValue: scalaX }, y: { getPixelForValue: scalaY } } });

{
  const ctx = contesto(); linee.afterDatasetsDraw(chart(ctx), {}, { falda: 6 });
  const t = ctx.reg.find(r => r[0] === 'fillText' && r[1] === 'falda');
  check('falda: allineata a destra, dentro l\'area', [t[4], t[2] <= area.right], ['right', true]);
  const c2 = contesto(); linee.afterDatasetsDraw(chart(c2), {}, { falda: 0.2 });
  const t2 = c2.reg.find(r => r[0] === 'fillText' && r[1] === 'falda');
  check('falda vicina al bordo superiore: etichetta sotto la linea', t2[3] > scalaY(0.2), true);
}
{
  // FS = 1 → px 150; FS rif 1,10 → px 160: 10 px, ravvicinati
  const ctx = contesto(); linee.afterDatasetsDraw(chart(ctx), {}, { riferimentiX: [{ x: 1.1, etichetta: 'FS rif 1,10' }, { x: 1, etichetta: 'FS = 1' }] });
  const tr = ctx.reg.filter(r => r[0] === 'translate');
  check('riferimenti ravvicinati: una etichetta a destra e una a sinistra della linea', [tr[0][1] > scalaX(1), tr[1][1] < scalaX(1.1)], [true, true]);
  check('riferimenti ravvicinati: ruotate in versi opposti', ctx.reg.filter(r => r[0] === 'rotate').map(r => Math.sign(r[1])), [1, -1]);
  const c2 = contesto(); linee.afterDatasetsDraw(chart(c2), {}, { riferimentiX: [{ x: 1, etichetta: 'FS = 1' }, { x: 1.5, etichetta: 'FS rif 1,50' }] });
  check('riferimenti distanti: entrambe a destra della linea', c2.reg.filter(r => r[0] === 'rotate').map(r => Math.sign(r[1])), [1, 1]);
}
{
  // classi granulometriche: x logaritmica simulata
  const sx = (d) => 50 + (Math.log10(d) + 3.3) * 80;
  const ctx = contesto();
  bandeGranulometriche.afterDatasetsDraw({ ctx, chartArea: { left: 50, right: 450, top: 20, bottom: 300 }, scales: { x: { getPixelForValue: sx } } });
  const nomi = ctx.reg.filter(r => r[0] === 'fillText').map(r => r[1]);
  check('nomi delle classi disegnati dopo i fusi', nomi.includes('GHIAIA') && nomi.includes('SABBIA'), true);
  const i = ctx.reg.findIndex(r => r[0] === 'fillText' && r[1] === 'GHIAIA');
  check('fondo bianco prima del testo', ctx.reg[i - 1][0] === 'fillRect' || ctx.reg.slice(0, i).some(r => r[0] === 'fillRect'), true);
  const c2 = contesto();
  bandeGranulometriche.beforeDatasetsDraw({ ctx: c2, chartArea: { left: 50, right: 450, top: 20, bottom: 300 }, scales: { x: { getPixelForValue: sx } } });
  check('prima dei fusi nessun testo', c2.reg.some(r => r[0] === 'fillText'), false);
}
console.log('Risultato: ' + ok + ' controlli superati, ' + ko + ' non superati.');
process.exit(ko ? 1 : 0);
