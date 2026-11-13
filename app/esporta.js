/*
 * GeoHub-LiquiSite — esportazione CSV
 * Copyright (C) 2026 Fabio Duronio — AGPL-3.0 con i termini aggiuntivi del file NOTICE.
 *
 * - Dati mancanti o non calcolati: cella vuota, mai zero.
 * - Numeri a precisione piena (nessun arrotondamento di visualizzazione).
 * - Testi che un foglio elettronico potrebbe leggere come formule (= + - @ tab, a capo)
 *   vengono preceduti da un apostrofo.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./progetto.js'), require('./profilo.js'));
  else root.LiquiEsporta = factory(root.LiquiProgetto, root.LiquiProfilo);
})(typeof self !== 'undefined' ? self : this, function (P, F) {
  'use strict';


  function testoSicuro(s) {
    s = String(s);
    return /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
  }

  function cella(v, opz) {
    if (v === null || v === undefined) return '';
    let s;
    if (typeof v === 'number') {
      if (!Number.isFinite(v)) return '';
      s = String(v);
      if (opz.decimale === ',') s = s.replace('.', ',');
      return s;
    }
    s = testoSicuro(v);
    if (s.includes(opz.separatore) || s.includes('"') || s.includes('\n') || s.includes('\r')) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  /**
   * CSV dei risultati di uno scenario.
   * opz: { separatore: ';' (default), decimale: ',' (default) }
   */
  function csvRisultati(progetto, prova, scenario, risultato, opz = {}) {
    opz = { separatore: ';', decimale: ',', ...opz };
    if (opz.separatore === opz.decimale) throw new Error('separatore di colonna e decimale coincidono');
    const M = F.METODI[scenario.metodo];
    const colIn = prova.colonne.filter(c => c !== 'z');
    const righe = [];
    const riga = (arr) => righe.push(arr.map(v => cella(v, opz)).join(opz.separatore));
    riga(['# GeoHub-LiquiSite – risultati']);
    riga(['# Progetto', progetto.progetto.titolo || '']);
    riga(['# Sito', progetto.progetto.sito || '']);
    riga(['# Prova', prova.nome + ' (' + prova.tipo + ')' + (prova.esempio ? ' – ESEMPIO SINTETICO' : '')]);
    riga(['# Scenario', scenario.nome]);
    riga(['# Metodo', P.NOMI_METODI[scenario.metodo]]);
    riga(['# Mw', scenario.Mw, 'amax (g)', scenario.amax, 'falda (m)', scenario.zFalda]);
    riga(['# FS di riferimento', F.fsRiferimento(scenario)]);
    if (opz.preliminare) riga(['# Verifica preliminare NTC 2018 par. 7.11.3.4.2', opz.preliminare]);
    riga(['# Criterio di verifica', F.criterioFS(scenario)]);
    riga(['# Motore', risultato.versioneMotore, 'calcolato il', risultato.calcolatoIl, 'firma input', risultato.firma]);
    const ind = risultato.indiceIL;
    if (ind && ind.stato === 'calcolato') {
      riga(['# IL Iwasaki 0-20 m (senza classi)', 'IL_min', ind.ILmin, 'IL_max', ind.ILmax, 'completo', ind.completo ? 'si' : 'no', 'spessore ignoto (m)', ind.spessori.ignoto]);
    }
    const ced = risultato.cedimenti;
    if (ced && ced.stato === 'calcolato') {
      riga(['# Cedimento post-sismico 0-20 m (Zhang et al. 2002)', 'S_min (cm)', ced.Smin * 100, 'S_max (cm)', ced.Smax * 100, 'completo', ced.completo ? 'si' : 'no']);
      riga(['# LSN (senza classi)', 'LSN_min 0-20 m', ced.LSNmin, 'LSN_max 0-20 m', ced.LSNmax, 'LSN_min 0-10 m', ced.LSN10min, 'LSN_max 0-10 m', ced.LSN10max]);
    }
    riga(['# Dati della prova convertiti nelle unità interne; celle vuote = dato mancante o non calcolato']);
    const chiavi = ['z'].concat(colIn.map(c => 'in:' + c), ['t:sv', 't:u', 't:sve', 'FC', 'origineFC'], M.intermedie, M.finali, scenario.metodo === 'bi2014Cpt' ? ['epsV'] : []);
    const intest = chiavi.map(k => {
      if (k === 'origineFC') return 'origine FC';
      const g = k.startsWith('in:') ? k.slice(3) : k.startsWith('t:') ? k.slice(2) : k;
      const d = F.G[g] || { etichetta: g, unita: '' };
      return d.etichetta + (d.unita && d.unita !== '–' ? ' [' + d.unita + ']' : '');
    });
    riga(intest.concat(['stato', 'codice', 'motivo', 'avvisi', 'assunzioni']));
    for (const r of risultato.righe) {
      const val = chiavi.map(k => {
        if (k === 'z') return r.z;
        if (k.startsWith('in:')) return r.ingresso ? r.ingresso[k.slice(3)] : null;
        if (k.startsWith('t:')) return r.tensioni ? r.tensioni[k.slice(2)] : null;
        if (k === 'FC') return r.FC;
        if (k === 'origineFC') return r.origineFC;
        return F.valoreRisultato(r, k);
      });
      riga(val.concat([r.stato, r.codice || '', r.motivo || '',
        (r.avvisi || []).map(a => a.codice).join(' | '), (r.assunzioni || []).map(a => a.codice).join(' | ')]));
    }
    return righe.join('\r\n') + '\r\n';
  }

  return { csvRisultati, testoSicuro, cella };
});
