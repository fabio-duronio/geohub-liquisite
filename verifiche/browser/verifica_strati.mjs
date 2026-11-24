// GeoHub-LiquiSite — controllo nel browser degli id stabili degli strati (audit v1.0.0, B4.3).
// Copyright (C) 2026 Fabio Duronio — AGPL-3.0 con i termini aggiuntivi del file NOTICE.
//
// Cambiare la quota di uno strato nella tabella non separa curva granulometrica, campione e giudizio
// del geologo; uno strato aggiunto riceve un id. File serviti da disco, rete esterna bloccata.
// Uso: node verifiche/browser/verifica_strati.mjs
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

const cella = (i, k) => page.locator('#tabStrati tbody tr.r1').nth(i).locator('input[data-k="' + k + '"]');
const preliminare = () => page.evaluate(() => document.getElementById('pan-esclusione').textContent);

console.log('1. Cambio di quota nella tabella degli strati');
{
  await page.click('#btnEsempio');
  await page.click('[data-open-section="secStrati"]'); await page.waitForTimeout(200);
  await cella(0, 'a').fill('1,25'); await cella(1, 'da').fill('1,25'); await page.waitForTimeout(150);
  await chiudi();
  await page.click('#tab-esclusione'); await page.waitForTimeout(400);
  const t = await preliminare();
  check('elenco: strato 1,25–3,40 m con criterio 4', /1,25–3,40 m\s*Limo argilloso · criterio 4/.test(t), true);
  await page.click('text=1,25–3,40 m'); await page.waitForTimeout(300);
  check('dettaglio: campione e curva conservati', await page.evaluate(() => [document.getElementById('exCampione') && document.getElementById('exCampione').value, (document.getElementById('exCurva') || {}).value?.split('\n').length]), ['S1-C1, 2,5–3,0 m', 8]);
}

console.log('2. Strato aggiunto');
{
  await page.click('[data-open-section="secStrati"]'); await page.waitForTimeout(200);
  await page.click('#btnAggiungiStrato'); await page.waitForTimeout(150);
  const ids = await page.evaluate(() => window.LiquiUI.stato.pr.scenari[0].strati.map(s => s.id));
  check('id per ogni strato, tutti diversi', [ids.length, ids.every(i => /^strato-/.test(i)), new Set(ids).size], [8, true, 8]);
  await chiudi();
}

check('nessun errore JavaScript', erroriJS, []);
await browser.close();
console.log('\nRisultato: ' + ok + ' controlli superati, ' + ko + ' non superati.');
if (ko) process.exit(1);
