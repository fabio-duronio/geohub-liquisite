/*
 * GeoHub-LiquiSite — importazione di tabelle (incolla o CSV)
 * Copyright (C) 2026 Fabio Duronio — AGPL-3.0 con i termini aggiuntivi del file NOTICE.
 *
 * Conversioni esplicite: il separatore di colonna e quello decimale sono scelti (o
 * riconosciuti e mostrati); ogni cella vuota diventa null, ogni cella non numerica è un
 * errore segnalato con riga e colonna. Nessun valore viene scartato in silenzio.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./progetto.js'));
  else root.LiquiImporta = factory(root.LiquiProgetto);
})(typeof self !== 'undefined' ? self : this, function (P) {
  'use strict';

  /** Divide il testo in righe e celle. sep: ';' | ',' | '\t' | 'auto'. Rispetta le virgolette. */
  function dividi(testo, sep = 'auto') {
    const righeTesto = String(testo).replace(/\r\n?/g, '\n').split('\n').filter(r => r.trim() !== '');
    if (sep === 'auto') {
      const prima = righeTesto.slice(0, 5).join('\n');
      const conta = (c) => (prima.match(new RegExp(c === '\t' ? '\\t' : '\\' + c, 'g')) || []).length;
      sep = conta('\t') > 0 ? '\t' : conta(';') > 0 ? ';' : ',';
    }
    const righe = righeTesto.map(r => {
      const celle = [];
      let cella = '', dentro = false;
      for (let i = 0; i < r.length; i++) {
        const ch = r[i];
        if (dentro) {
          if (ch === '"' && r[i + 1] === '"') { cella += '"'; i++; }
          else if (ch === '"') dentro = false;
          else cella += ch;
        } else if (ch === '"') dentro = true;
        else if (ch === sep) { celle.push(cella.trim()); cella = ''; }
        else cella += ch;
      }
      celle.push(cella.trim());
      return celle;
    });
    return { separatore: sep, righe };
  }

  /**
   * Converte una cella in numero con il separatore decimale dichiarato.
   * '' → null; testo non numerico → { errore }. Con decimale ',' il punto non è accettato
   * come separatore delle migliaia (ambiguo): la cella va corretta.
   */
  function numero(cella, decimale) {
    const s = String(cella).trim();
    if (s === '') return { valore: null };
    let t = s;
    if (decimale === ',') {
      if (t.includes('.')) return { errore: 'contiene un punto, ma il separatore decimale dichiarato è la virgola' };
      t = t.replace(',', '.');
    } else if (t.includes(',')) return { errore: 'contiene una virgola, ma il separatore decimale dichiarato è il punto' };
    if (!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(t)) return { errore: 'non è un numero' };
    const v = Number(t);
    return Number.isFinite(v) ? { valore: v } : { errore: 'numero non finito' };
  }

  /** Riconosce l'intestazione: vero se la prima riga contiene almeno una cella non numerica. */
  function haIntestazione(righe, decimale) {
    if (!righe.length) return false;
    return righe[0].some(c => c !== '' && numero(c, decimale).errore);
  }

  const SINONIMI = {
    z: ['z', 'prof', 'profondita', 'profondità', 'depth', 'd'],
    qc: ['qc', 'qc(mpa)', 'resistenza punta', 'cone resistance'],
    fs: ['fs', 'fs(kpa)', 'attrito laterale', 'sleeve friction'],
    u2: ['u2', 'u', 'pressione interstiziale', 'pore pressure'],
    N: ['n', 'nspt', 'n spt', 'colpi', 'blows', 'n30'],
    Vs: ['vs', 'velocita', 'velocità', 'vs (m/s)'],
    FC: ['fc', 'fini', 'fines', 'fines content']
  };

  /** Proposta di associazione colonna → grandezza in base all'intestazione (da confermare). */
  function proponiColonne(intestazione, tipo) {
    const voluti = P.TIPI_PROVA[tipo].colonne.concat(P.TIPI_PROVA[tipo].facoltative);
    const mappa = {};
    const norm = (s) => String(s).toLowerCase().replace(/\[.*?\]|\(.*?\)/g, '').replace(/[_]/g, ' ').trim();
    for (const g of voluti) {
      const j = (intestazione || []).findIndex(h => SINONIMI[g].includes(norm(h)));
      mappa[g] = j >= 0 ? j : null;
    }
    // senza intestazione: ordine standard delle colonne
    if (!intestazione) P.TIPI_PROVA[tipo].colonne.forEach((g, j) => { mappa[g] = j; });
    return mappa;
  }

  /**
   * Costruisce i dati di una prova.
   * opz: { tipo, mappa: {grandezza: indiceColonna|null}, unita: {grandezza: unità}, decimale, saltaIntestazione }
   * Restituisce { ok, errori: [{riga, colonna, motivo}], colonne, dati, unita }.
   */
  function costruisciDati(righe, opz) {
    const tipo = opz.tipo;
    const obbligatorie = P.TIPI_PROVA[tipo].colonne;
    const facoltative = P.TIPI_PROVA[tipo].facoltative;
    const errori = [];
    for (const g of obbligatorie) if (opz.mappa[g] === null || opz.mappa[g] === undefined) errori.push({ riga: null, colonna: g, motivo: 'colonna obbligatoria non associata' });
    for (const g of Object.keys(opz.unita || {})) if (P.UNITA[g] && P.UNITA[g].fattori[opz.unita[g]] === undefined) errori.push({ riga: null, colonna: g, motivo: 'unità non ammessa: ' + opz.unita[g] });
    if (errori.length) return { ok: false, errori };
    const colonne = obbligatorie.concat(facoltative.filter(g => opz.mappa[g] !== null && opz.mappa[g] !== undefined));
    const dati = [];
    const inizio = opz.saltaIntestazione ? 1 : 0;
    for (let i = inizio; i < righe.length; i++) {
      const r = righe[i];
      const riga = colonne.map(g => {
        const cella = r[opz.mappa[g]];
        if (cella === undefined) return null;
        const n = numero(cella, opz.decimale);
        if (n.errore) { errori.push({ riga: i + 1, colonna: g, motivo: '«' + cella + '» ' + n.errore }); return null; }
        return n.valore;
      });
      dati.push(riga);
    }
    if (dati.length === 0) errori.push({ riga: null, colonna: '', motivo: 'Sono presenti solo intestazioni: aggiungi almeno una riga di misure prima di confermare.' });
    // profondità: obbligatoria e crescente (non si riordina in silenzio)
    const iz = colonne.indexOf('z');
    dati.forEach((r, k) => { if (r[iz] === null) errori.push({ riga: k + 1 + inizio, colonna: 'z', motivo: 'profondità mancante' }); });
    for (let k = 1; k < dati.length; k++) {
      if (dati[k][iz] !== null && dati[k - 1][iz] !== null && !(dati[k][iz] > dati[k - 1][iz])) {
        errori.push({ riga: k + 1 + inizio, colonna: 'z', motivo: 'profondità non crescente' });
      }
    }
    const unita = {};
    for (const g of colonne) unita[g] = (opz.unita && opz.unita[g]) || P.UNITA[g].interna;
    return { ok: errori.length === 0, errori, colonne, dati, unita };
  }

  return { dividi, numero, haIntestazione, proponiColonne, costruisciDati };
});
