/*
 * GeoHub-LiquiSite — progetto di ESEMPIO SINTETICO
 * Copyright (C) 2026 Fabio Duronio — AGPL-3.0 con i termini aggiuntivi del file NOTICE.
 *
 * Dati inventati, generati con funzioni deterministiche, per provare il percorso completo.
 * Non rappresentano alcun sito reale.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./progetto.js'));
  else root.LiquiEsempio = factory(root.LiquiProgetto);
})(typeof self !== 'undefined' ? self : this, function (P) {
  'use strict';

  const r = (v, c) => Math.round(v * 10 ** c) / 10 ** c;

  function cptu() {
    const dati = [];
    for (let i = 4; i <= 150; i++) {
      const z = r(i * 0.1, 2);
      const w = Math.sin(z * 7.3) * 0.5 + Math.sin(z * 2.1) * 0.5;
      let qc, fs, u2;
      if (z < 2.5) { qc = 1.6 + 0.4 * w; fs = 45 + 10 * w; u2 = 0; }                          // limo argilloso
      else if (z < 8.2) { qc = 4.5 + 1.8 * w + 0.25 * (z - 2.5); fs = 22 + 8 * w; u2 = 9.81 * (z - 2.0); } // sabbia limosa sciolta
      else if (z < 10.8) { qc = 1.1 + 0.2 * w; fs = 38 + 6 * w; u2 = 9.81 * (z - 2.0) + 180; }   // argilla
      else { qc = 14 + 4 * w + 0.6 * (z - 10.8); fs = 70 + 15 * w; u2 = 9.81 * (z - 2.0); }     // sabbia densa
      dati.push([z, r(qc, 2), r(fs, 1), r(u2, 1)]);
    }
    // un tratto senza dati (prova interrotta e ripresa) e una lettura mancante
    const senza = dati.filter(d => !(d[0] > 12.0 && d[0] < 12.6));
    const k = senza.findIndex(d => d[0] === 6.3);
    senza[k][2] = null;
    return senza;
  }

  function spt() {
    return [[1.5, 9], [3.0, 7], [4.5, 11], [6.0, 8], [7.5, 10], [9.0, 25], [10.5, 31], [12.0, 34]];
  }

  function progettoEsempio() {
    const pr = P.nuovoProgetto();
    pr.progetto = { titolo: 'Esempio sintetico', sito: 'Sito di prova (dati inventati)', autore: '', note: 'Dati generati per provare l\'applicazione: non rappresentano un sito reale.' };
    const a = P.nuovaProva('CPTU', 'CPTU 1 – esempio sintetico');
    a.esempio = true; a.provenienza = 'Dati sintetici generati da LiquiSite';
    a.colonne = ['z', 'qc', 'fs', 'u2']; a.dati = cptu(); a.parametri = { ar: 0.8 };
    const b = P.nuovaProva('SPT', 'S1 SPT – esempio sintetico');
    b.esempio = true; b.provenienza = 'Dati sintetici generati da LiquiSite';
    b.dati = spt(); b.parametri = { CE: 1.0, CB: 1, CS: 1, sporgenza: 1.0, senzaRivestimento: false };
    pr.prove = [a, b];
    const strati = [
      { da: 0, a: 2.5, gamma: 18.5, gammaSat: 19.0, FC: null, descrizione: 'Limo argilloso' },
      { da: 2.5, a: 8.2, gamma: 18.0, gammaSat: 19.5, FC: 15, descrizione: 'Sabbia limosa' },
      { da: 8.2, a: 10.8, gamma: 18.5, gammaSat: 19.0, FC: null, descrizione: 'Argilla' },
      { da: 10.8, a: 16, gamma: 19.0, gammaSat: 20.5, FC: 8, descrizione: 'Sabbia densa' }
    ];
    const s1 = P.nuovoScenario(a, 'SLV – falda 2,0 m', 0);
    Object.assign(s1, { Mw: 6.37, amax: 0.26, zFalda: 2.0, strati: P.copia(strati) });
    s1.strati.forEach(s => { s.FC = null; }); // CPTU: FC stimato da Ic
    s1.opzioni = { Vs12: null, IcSoglia: 2.6, CFC: 0 };
    const s2 = P.nuovoScenario(b, 'SPT – falda 2,0 m', 1);
    Object.assign(s2, { metodo: 'bi2014Spt', Mw: 6.37, amax: 0.26, zFalda: 2.0, strati: P.copia(strati) });
    s2.strati[0].FC = 40; s2.strati[2].FC = 85;
    s2.opzioni = { Vs12: 190, IcSoglia: 2.6, CFC: 0 };
    pr.scenari = [s1, s2];
    pr.provaAttiva = a.id; pr.scenarioAttivo = s1.id;
    return pr;
  }

  return { progettoEsempio };
});
