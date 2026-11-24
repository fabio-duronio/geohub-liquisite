// GeoHub-LiquiSite — controllo nel browser degli avvisi sui dati dello scenario (audit v1.0.0, B5).
// Copyright (C) 2026 Fabio Duronio — AGPL-3.0 con i termini aggiuntivi del file NOTICE.
//
// Gli avvisi di unità (γ, γsat, amax) e gli errori di congruenza compaiono accanto ai campi, nella
// scheda «Avvisi e assunzioni» e in stampa. File serviti da disco, rete esterna bloccata.
// Uso: node verifiche/browser/verifica_dati.mjs
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const RADICE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const BASE = 'http://liquisite.test/';
const TIPI = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const CHROME = ['/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(p => fs.existsSync(p));

let ok = 0, ko = 0;
const check = (nome, ottenuto, atteso) => {
  const a = JSON.stringify(ottenuto), b = JSON.stringify(atteso);
  if (a === b) ok++; else { ko++; console.log('  ERRORE ' + nome + ': ' + a + ' (atteso ' + b + ')'); }
};

let browser;
try { browser = await chromium.launch(); } catch (e) { if (!CHROME) throw e; browser = await chromium.launch({ executablePath: CHROME }); }
const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
const erroriJS = [], dialoghi = [];
page.on('pageerror', e => erroriJS.push(e.message));
page.on('dialog', d => { dialoghi.push(d.message()); d.accept(); });
await page.route('**/*', async (route) => {
  const url = new URL(route.request().url());
  if (url.origin + '/' !== BASE) return route.abort();
  const file = path.join(RADICE, decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
  if (!file.startsWith(RADICE) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
  return route.fulfill({ path: file, contentType: TIPI[path.extname(file)] || 'application/octet-stream' });
});
await page.goto(BASE);
await page.waitForFunction(() => window.LiquiUI && window.Chart);
await page.evaluate(() => { window.print = () => {}; });

const chiudi = () => page.evaluate(() => { const b = document.getElementById('closeSettings'); if (b && b.offsetParent) b.click(); });

const avvisoAmax = () => page.evaluate(() => { const b = document.getElementById('scAmaxAvv'); return b && !b.hidden ? b.textContent : ''; });
const boxStrati = () => page.evaluate(() => ({ errori: [...document.querySelectorAll('#erroriStrati .alert-danger li')].map(l => l.textContent), avvisi: [...document.querySelectorAll('#erroriStrati .alert-warn li')].map(l => l.textContent) }));
const cella = (i, k) => page.locator('#tabStrati tbody tr.r1').nth(i).locator('input[data-k="' + k + '"]');

console.log('1. amax in m/s²: avviso sotto il campo, calcolo consentito');
{
  await page.click('#btnEsempio');
  await page.click('[data-open-section="secScenario"]'); await page.waitForTimeout(150);
  check('esempio: nessun avviso su amax', await avvisoAmax(), '');
  await page.fill('#scAmax', '2,45'); await page.waitForTimeout(100);
  check('amax 2,45: avviso con la conversione', /2,45 m\/s² ≈ 0,25 g/.test(await avvisoAmax()), true);
  await page.fill('#scAmax', '0,26'); await page.waitForTimeout(100);
  check('amax 0,26: avviso tolto', await avvisoAmax(), '');
  await page.fill('#scAmax', '2,45'); await chiudi(); await page.waitForTimeout(100);
  await page.click('#btnQuickCalcola'); await page.waitForTimeout(500);
  check('calcolo eseguito con l\'avviso', await page.evaluate(() => window.LiquiUI.statoRisultato(window.LiquiUI.stato.pr.scenari[0])), 'aggiornato');
  await page.click('#tab-avvisi'); await page.waitForTimeout(200);
  check('scheda «Avvisi e assunzioni»: sezione dei dati dello scenario', await page.evaluate(() => /Dati dello scenario da controllare[\s\S]*amax = 2,45 g/.test(document.getElementById('pan-avvisi').textContent)), true);
  await page.evaluate(() => { window.print = () => {}; document.getElementById('btnStampa').click(); }); await page.waitForTimeout(600);
  check('stampa: avviso sui dati dello scenario', await page.evaluate(() => /Dati dello scenario\.\s*amax = 2,45 g/.test(document.getElementById('stampa').innerText)), true);
}

console.log('2. Pesi di volume nella stratigrafia');
{
  await page.click('[data-open-section="secStrati"]'); await page.waitForTimeout(200);
  check('esempio: nessun errore né avviso negli strati', await boxStrati(), { errori: [], avvisi: [] });
  await cella(0, 'gamma').fill('1,85'); await page.waitForTimeout(100);
  const b1 = await boxStrati();
  check('γ = 1,85: avviso di unità, nessun errore', [b1.errori.length, b1.avvisi.length, /γ = 1,85 kN\/m³, fuori da 11–27/.test(b1.avvisi[0] || '')], [0, 1, true]);
  await cella(0, 'gammaSat').fill('1,98'); await page.waitForTimeout(100);
  const b2 = await boxStrati();
  check('γsat = 1,98: errore γsat ≤ γw e due avvisi', [b2.errori.some(e => /non supera il peso di volume dell'acqua/.test(e)), b2.avvisi.length], [true, 2]);
  await cella(0, 'gamma').fill('22'); await cella(0, 'gammaSat').fill('15'); await page.waitForTimeout(100);
  check('γ 22 e γsat 15: errore γsat < γ', (await boxStrati()).errori.some(e => /γsat \(15\) minore di γ \(22\)/.test(e)), true);
  await chiudi();
}

check('nessun errore JavaScript', erroriJS, []);
await browser.close();
console.log('\nRisultato: ' + ok + ' controlli superati, ' + ko + ' non superati.');
if (ko) process.exit(1);
