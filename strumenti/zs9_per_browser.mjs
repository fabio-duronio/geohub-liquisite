// GeoHub-LiquiSite — genera dati/zs9-data.js da dati/zs9-data.json.
// Copyright (C) 2026 Fabio Duronio — AGPL-3.0 con i termini aggiuntivi del file NOTICE.
//
// Perché: la politica di sicurezza dei contenuti di LiquiSite (index.html, connect-src 'none')
// non permette di leggere file con fetch; i dati ZS9 arrivano quindi come script, come i fusi
// granulometrici (dati/fusi-ntc2018.js). Il testo JSON è copiato byte per byte, senza modifiche:
// verifiche/verifica_magnitudo.mjs controlla che l'impronta SHA-256 coincida con quella del file
// di SismaSite.
//
// Uso:  node strumenti/zs9_per_browser.mjs
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const RADICE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const testo = readFileSync(path.join(RADICE, 'dati', 'zs9-data.json'), 'utf8').trimEnd();
JSON.parse(testo); // si ferma se il file non è JSON valido
const PRIMA = '/* Generato da dati/zs9-data.json con strumenti/zs9_per_browser.mjs (stesso testo, nessuna modifica).\n' +
  '   Zonazione sismogenetica ZS9: Meletti et al. (2004), INGV, doi:10.13127/sh/zs9, CC BY 4.0. */\n' +
  '(function (root) { root.LiquiZS9Dati = ';
const DOPO = '; })(typeof self !== \'undefined\' ? self : this);\n';
writeFileSync(path.join(RADICE, 'dati', 'zs9-data.js'), PRIMA + testo + DOPO);
console.log('dati/zs9-data.js scritto (' + testo.length + ' caratteri di JSON).');
