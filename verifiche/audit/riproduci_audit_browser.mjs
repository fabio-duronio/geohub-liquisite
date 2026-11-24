// GeoHub-LiquiSite — riproduzione nel browser dei rilievi dell'audit su v1.0.0 (stampa, persistenza,
// flusso dell'esempio, focus, contrasto). Fase 1: verifica, nessuna correzione.
// Copyright (C) 2026 Fabio Duronio — AGPL-3.0 con i termini aggiuntivi del file NOTICE.
//
// Stessa impostazione di verifiche/browser/verifica_browser.mjs: file serviti da disco, rete esterna
// bloccata. Usa Playwright; se Chromium di Playwright non è installato, prova Chrome di sistema.
// Uso: node verifiche/audit/riproduci_audit_browser.mjs   (codice di uscita sempre 0)
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
let browser;
try { browser = await chromium.launch(); } catch { browser = await chromium.launch({ executablePath: CHROME }); }

const esiti = [];
const controlla = (id, descrizione, corretto, misurato) => esiti.push({ id, descrizione, corretto, misurato });

async function nuovaPagina(w = 1440, h = 900) {
  // contesto esplicito: con browser.newPage() Playwright non consegna l'avviso beforeunload alla chiusura
  const page = await (await browser.newContext({ viewport: { width: w, height: h } })).newPage();
  page.dialoghi = [];
  page.on('dialog', d => { page.dialoghi.push(d.type()); d.accept(); });
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin + '/' !== BASE) return route.abort();
    const file = path.join(RADICE, decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
    if (!file.startsWith(RADICE) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ path: file, contentType: TIPI[path.extname(file)] || 'application/octet-stream' });
  });
  await page.goto(BASE);
  await page.waitForFunction(() => window.LiquiUI && window.Chart);
  await page.evaluate(() => { window.print = () => {}; }); // la finestra di stampa non si apre nei test
  return page;
}
const attendi = (page, ms = 400) => page.waitForTimeout(ms);
const testoStampa = (page) => page.evaluate(() => document.getElementById('stampa').innerText);

// B6.1 — stampa dal browser senza passare dal pulsante: pagina vuota
let page = await nuovaPagina();
await page.evaluate(() => { document.getElementById('btnEsempio').click(); document.getElementById('btnCalcola').click(); });
await attendi(page);
// Ctrl+P: il browser emette beforeprint e applica @media print (emulateMedia da solo non emette l'evento)
await page.emulateMedia({ media: 'print' });
await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
const fredda = await page.evaluate(() => ({ figli: document.getElementById('stampa').children.length, testo: document.getElementById('stampa').innerText.trim().length }));
await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
await page.emulateMedia({ media: 'screen' });
controlla('B6.1', 'Ctrl+P con risultati calcolati, senza usare «Stampa / PDF»: la stampa deve contenere il rapporto o un avviso',
  fredda.testo > 0, '#stampa: ' + fredda.figli + ' elementi, ' + fredda.testo + ' caratteri');

// B6.2 — dopo una stampa, risultati cambiati: resta il rapporto vecchio
await page.evaluate(() => document.getElementById('btnStampa').click());
await attendi(page, 800);
const amaxPrima = ((await testoStampa(page)).match(/amax [0-9,]+ g/) || [])[0];
await page.evaluate(() => { window.LiquiUI.stato.pr.scenari[0].amax = 0.35; window.LiquiUI.renderTutto(); });
await attendi(page);
const dopo = await page.evaluate(() => ({ testo: document.getElementById('stampa').innerText, stato: window.LiquiUI.statoRisultato(window.LiquiUI.stato.pr.scenari[0]) }));
controlla('B6.2', 'amax portata da 0,26 a 0,35 g dopo una stampa: #stampa non deve conservare il rapporto non aggiornato',
  dopo.testo.trim().length === 0 || !/amax 0,260 g/.test(dopo.testo), 'stampato prima: ' + amaxPrima + '; dopo la modifica (' + dopo.stato + ') #stampa riporta ancora: ' + ((dopo.testo.match(/amax [0-9,]+ g/) || [])[0] || 'niente'));

// B6.3 — le tavole stampate dipendono dal gruppo di pannelli aperto
await page.evaluate(() => { window.LiquiUI.stato.pr.scenari[0].amax = 0.26; window.LiquiUI.renderTutto(); document.getElementById('btnCalcola').click(); });
await attendi(page);
const tavole = () => page.evaluate(() => [...document.querySelectorAll('#stampa .st-grafici figure figcaption')].map(f => f.innerText.split(' – ')[0].split('\n')[0]).filter(t => !/^Strato/.test(t)));
await page.evaluate(() => document.getElementById('btnStampa').click()); await attendi(page, 800);
const tVerifica = await tavole();
await page.evaluate(() => document.querySelector('[data-preset="cedimenti"]').click()); await attendi(page);
await page.evaluate(() => document.getElementById('btnStampa').click()); await attendi(page, 800);
const tCedimenti = await tavole();
controlla('B6.3', 'la stampa deve contenere le stesse tavole qualunque sia il gruppo di pannelli aperto',
  JSON.stringify(tVerifica) === JSON.stringify(tCedimenti), 'gruppo «verifica»: ' + tVerifica.join(', ') + ' | gruppo «cedimenti»: ' + tCedimenti.join(', '));

// B7 — nessuna bozza e nessun avviso in uscita
// modifica con l'interfaccia, come l'utente: Chrome mostra l'avviso di uscita solo dopo un gesto dell'utente
await page.click('[data-open-section="secScenario"]'); await attendi(page, 150);
await page.fill('#scAmax', '0,30'); await page.evaluate(() => document.getElementById('closeSettings').click());
await attendi(page, 800);
const chiavi = await page.evaluate(() => Object.keys(localStorage));
page.dialoghi.length = 0;
await page.close({ runBeforeUnload: true });
await new Promise(r => setTimeout(r, 500));
controlla('B7', 'progetto modificato e non salvato: alla chiusura serve l\'avviso beforeunload (e una bozza locale)',
  page.dialoghi.includes('beforeunload'), 'dialoghi alla chiusura: ' + (page.dialoghi.join(', ') || 'nessuno') + '; chiavi in localStorage: ' + (chiavi.join(', ') || 'nessuna'));

// §4 punto 6 — «Demo sintetica» della barra non calcola
page = await nuovaPagina();
await page.evaluate(() => document.getElementById('btnEsempio').click()); await attendi(page);
const statoDemo = await page.evaluate(() => window.LiquiUI.statoRisultato(window.LiquiUI.stato.pr.scenari[0]));
controlla('6', '«Demo sintetica» nella barra in alto: lo scenario attivo dovrebbe risultare calcolato come con «Esplora l\'esempio sintetico»',
  statoDemo === 'aggiornato', 'stato dello scenario attivo: ' + statoDemo);

// §4 punto 7 — selettore degli scenari limitato alla prova attiva
const sel = await page.evaluate(() => ({ opzioni: document.getElementById('selScenario').options.length, scenari: window.LiquiUI.stato.pr.scenari.length }));
controlla('7', 'selettore «Scenario»: elenca solo gli scenari della prova attiva',
  sel.opzioni === sel.scenari, sel.opzioni + ' scenari elencati su ' + sel.scenari);

// §4 punto 8 — focus da tastiera nella tabella degli strati (rilievo non confermato se «ok»)
await page.evaluate(() => document.querySelector('[data-open-section="secStrati"]').click()); await attendi(page, 300);
const campo = page.locator('#tabStrati tbody tr.r1').nth(1).locator('input[data-k="a"]');
await campo.click(); await campo.fill('3,4'); await page.keyboard.press('Tab'); await attendi(page, 200);
const focus = await page.evaluate(() => ({ k: document.activeElement.dataset.k, dentro: !!document.activeElement.closest('#tabStrati') }));
controlla('8', 'Tab dopo la modifica di «a» in tabStrati: il focus passa al campo successivo (rilievo dell\'audit: focus perso)',
  focus.dentro && focus.k === 'gamma', 'focus su: ' + (focus.dentro ? 'campo «' + focus.k + '» della tabella' : 'fuori dalla tabella'));
await page.evaluate(() => document.getElementById('closeSettings').click());

// §4 punto 11 — contrasto dei numeri dei pannelli
await page.evaluate(() => document.getElementById('btnCalcola').click()); await attendi(page, 600);
const contrasti = await page.evaluate(() => {
  const lum = (c) => { const m = c.match(/[\d.]+/g).map(Number).slice(0, 3).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]; };
  const sfondo = (e) => { while (e) { const c = getComputedStyle(e).backgroundColor; if (c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c)) return c; e = e.parentElement; } return 'rgb(255, 255, 255)'; };
  return [...document.querySelectorAll('.track-no')].map(e => { const a = lum(getComputedStyle(e).color), b = lum(sfondo(e)); return +((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toFixed(2); });
});
controlla('11', 'numeri dei pannelli (.track-no): contrasto ≥ 4,5:1 (WCAG 2.1 AA, 1.4.3)',
  contrasti.length > 0 && Math.min(...contrasti) >= 4.5, 'rapporti misurati: ' + [...new Set(contrasti)].join(', '));
await page.close();

await browser.close();
const larg = Math.max(...esiti.map(e => e.id.length));
for (const e of esiti) console.log((e.corretto ? 'ok              ' : 'DIFETTO PRESENTE') + '  ' + e.id.padEnd(larg) + '  ' + e.descrizione + '\n' + ' '.repeat(18 + larg) + '→ ' + e.misurato);
console.log('\n' + esiti.filter(e => !e.corretto).length + ' difetti presenti su ' + esiti.length + ' controlli nel browser.');
