/*
 * GeoHub-LiquiSite — progetto di ESEMPIO SINTETICO
 * Copyright (C) 2026 Fabio Duronio — AGPL-3.0 con i termini aggiuntivi del file NOTICE.
 *
 * Dati inventati, generati con funzioni deterministiche (generatore pseudocasuale con seme
 * fisso), per provare il percorso completo. Non rappresentano alcun sito reale.
 *
 * Successione alluvionale tipo, falda a 1,8 m:
 *   0,0–1,2   riporto                          (sopra falda)
 *   1,2–3,4   limo argilloso                   Ic > 2,6 nella maggior parte dei punti
 *   3,4–7,2   sabbia limosa sciolta            con una lente limosa a 5,10–5,35 m
 *   7,2–8,6   alternanze di limo e sabbia limosa
 *   8,6–12,4  sabbia media mediamente addensata
 *   12,4–15,8 argilla limosa                   sovrappressioni interstiziali in u2
 *   15,8–20,0 ghiaia sabbiosa addensata        CPTU interrotta per rifiuto a 18,4 m
 * Sondaggio S1 accanto alla CPTU: SPT nei livelli granulari, FC da analisi di laboratorio,
 * due curve granulometriche per la verifica preliminare (§7.11.3.4.2).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./progetto.js'));
  else root.LiquiEsempio = factory(root.LiquiProgetto);
})(typeof self !== 'undefined' ? self : this, function (P) {
  'use strict';

  const r = (v, c) => Math.round(v * 10 ** c) / 10 ** c;
  const GW = 9.81, Z_FALDA = 1.8;

  /** Generatore pseudocasuale con seme fisso (mulberry32): stesso esempio a ogni apertura. */
  function generatore(seme) {
    let a = seme >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function gauss(rnd) {
    const u = Math.max(rnd(), 1e-12), v = rnd();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  const STRATI = [
    { da: 0, a: 1.2, gamma: 18.0, gammaSat: 19.0, FC: null, descrizione: 'Riporto' },
    { da: 1.2, a: 3.4, gamma: 18.5, gammaSat: 19.0, FC: null, descrizione: 'Limo argilloso' },
    { da: 3.4, a: 7.2, gamma: 18.0, gammaSat: 19.0, FC: null, descrizione: 'Sabbia limosa sciolta' },
    { da: 7.2, a: 8.6, gamma: 18.5, gammaSat: 19.2, FC: null, descrizione: 'Alternanze di limo e sabbia limosa' },
    { da: 8.6, a: 12.4, gamma: 19.0, gammaSat: 20.0, FC: null, descrizione: 'Sabbia media mediamente addensata' },
    { da: 12.4, a: 15.8, gamma: 19.0, gammaSat: 19.5, FC: null, descrizione: 'Argilla limosa' },
    { da: 15.8, a: 20.0, gamma: 20.0, gammaSat: 21.0, FC: null, descrizione: 'Ghiaia sabbiosa addensata' }
  ];

  /** Tensione verticale totale [kPa] con i pesi di volume della stratigrafia dell'esempio. */
  function sigmaV(z) {
    let sv = 0;
    for (const s of STRATI) {
      if (z <= s.da) break;
      const a = Math.min(z, s.a);
      const sopra = Math.max(0, Math.min(a, Z_FALDA) - s.da), sotto = Math.max(0, a - Math.max(s.da, Z_FALDA));
      sv += sopra * s.gamma + sotto * s.gammaSat;
    }
    return sv;
  }

  /**
   * Andamento medio per profondità: qc [MPa], rapporto d'attrito Rf [%], coefficiente Bq
   * delle sovrappressioni, ampiezza del disturbo casuale (scarto su ln qc).
   */
  function andamento(z) {
    if (z < 1.2) return { qc: 2.4, Rf: 2.6, Bq: 0, sd: 0.25 };
    if (z < 3.4) return { qc: 1.55 - 0.3 * (z - 1.2), Rf: 4.6, Bq: 0.22, sd: 0.08 };
    if (z < 7.2) {
      if (z >= 5.10 && z < 5.35) return { qc: 1.5, Rf: 3.6, Bq: 0.12, sd: 0.08 };
      return { qc: 3.2 + 0.55 * (z - 3.4), Rf: 1.25, Bq: 0.01, sd: 0.14 };
    }
    if (z < 8.6) {
      const sabbioso = Math.sin((z - 7.2) * Math.PI / 0.35) > 0;
      return sabbioso ? { qc: 3.4, Rf: 1.6, Bq: 0.03, sd: 0.12 } : { qc: 1.6, Rf: 3.4, Bq: 0.15, sd: 0.1 };
    }
    if (z < 12.4) return { qc: 12.0 + 1.2 * (z - 8.6), Rf: 0.6, Bq: -0.005, sd: 0.12 };
    if (z < 15.8) return { qc: 1.25 + 0.06 * (z - 12.4), Rf: 4.2, Bq: 0.3, sd: 0.06 };
    return { qc: 17 + 1.2 * (z - 15.8), Rf: 0.55, Bq: -0.01, sd: 0.1 };
  }

  /** CPTU con passo 2 cm da 0,60 m (preforo nel riporto) a 18,40 m (rifiuto). */
  function cptu() {
    const rnd = generatore(20261113);
    const passo = 0.02, z0 = 0.6, z1 = 18.4;
    const n = Math.round((z1 - z0) / passo) + 1;
    const grezzi = [];
    let eq = 0, ef = 0;
    for (let i = 0; i < n; i++) {
      const z = z0 + i * passo, m = andamento(z);
      eq = 0.85 * eq + Math.sqrt(1 - 0.85 ** 2) * gauss(rnd);  // disturbo correlato lungo la verticale
      ef = 0.8 * ef + Math.sqrt(1 - 0.8 ** 2) * gauss(rnd);
      const qc = m.qc * Math.exp(m.sd * eq), Rf = m.Rf * Math.exp(0.12 * ef);
      grezzi.push({ z, qc, Rf, Bq: m.Bq });
    }
    // media mobile su 10 cm: il cono risente di uno spessore finito di terreno
    const media = (k, campo) => {
      let s = 0, c = 0;
      for (let j = Math.max(0, k - 2); j <= Math.min(n - 1, k + 2); j++) { s += grezzi[j][campo]; c++; }
      return s / c;
    };
    const dati = [];
    for (let k = 0; k < n; k++) {
      const z = grezzi[k].z, qc = media(k, 'qc'), Rf = media(k, 'Rf'), Bq = media(k, 'Bq');
      const fs = qc * 1000 * Rf / 100;
      const u0 = Math.max(0, (z - Z_FALDA) * GW);
      const u2 = z < Z_FALDA ? 0 : Math.max(0, u0 + Bq * (qc * 1000 - sigmaV(z)));
      dati.push([r(z, 2), r(qc, 3), r(fs, 1), r(u2, 1)]);
    }
    return dati;
  }

  /** Sondaggio S1: SPT nei livelli granulari; FC da analisi granulometrica sul campione. */
  function spt() {
    return [[4.0, 9, 27], [5.5, 11, 22], [6.8, 13, 30], [9.5, 23, 7], [11.0, 27, 6], [16.5, 41, 5]];
  }

  /** Verifica preliminare dell'esempio: dati di sito e curve granulometriche (inventati). */
  function esclusioneEsempio() {
    return {
      faldaMediaStagionale: 2.4, pcSubOrizzontale: true, fondazioniSuperficiali: true,
      strati: [
        { da: 3.4, a: 7.2, sabbiaPulita: false, campione: 'S1-C2, 5,0–5,5 m',
          curva: [[0.006, 3], [0.01, 6], [0.03, 12], [0.075, 27], [0.1, 38], [0.2, 70], [0.4, 92], [1, 99], [2, 100]],
          decisione4: 'non soddisfatto', motivazione4: '' },
        { da: 8.6, a: 12.4, sabbiaPulita: true, campione: '', curva: null, decisione4: null, motivazione4: '' },
        { da: 15.8, a: 20, sabbiaPulita: false, campione: 'S1-C5, 16,5–17,0 m',
          curva: [[0.5, 1], [1.2, 3], [2, 8], [3, 12], [5, 22], [10, 42], [20, 68], [40, 90], [63, 100]],
          decisione4: 'soddisfatto', motivazione4: '' }
      ]
    };
  }

  function progettoEsempio() {
    const pr = P.nuovoProgetto();
    pr.progetto = {
      titolo: 'Esempio sintetico – piana alluvionale',
      sito: 'Sito inventato (dati sintetici)',
      autore: '',
      note: 'Dati inventati per provare l\'applicazione: non rappresentano un sito reale. Falda a 1,8 m dal p.c.; ' +
        'CPTU interrotta per rifiuto a 18,4 m; sondaggio S1 con SPT e FC da analisi di laboratorio; ' +
        'azione sismica e V*s,12 di fantasia, plausibili per una piana alluvionale.'
    };
    const a = P.nuovaProva('CPTU', 'CPTU 1 – esempio sintetico');
    a.esempio = true; a.provenienza = 'Dati sintetici generati da LiquiSite';
    a.colonne = ['z', 'qc', 'fs', 'u2']; a.dati = cptu(); a.parametri = { ar: 0.8 };
    const b = P.nuovaProva('SPT', 'S1 SPT – esempio sintetico');
    b.esempio = true; b.provenienza = 'Dati sintetici generati da LiquiSite';
    b.colonne = ['z', 'N', 'FC']; b.unita.FC = '%';
    b.dati = spt(); b.parametri = { CE: 1.0, CB: 1, CS: 1, sporgenza: 1.0, senzaRivestimento: false };
    pr.prove = [a, b];

    const s1 = P.nuovoScenario(a, 'SLV – falda 1,8 m', 0);
    Object.assign(s1, { Mw: 6.1, amax: 0.26, zFalda: Z_FALDA, strati: P.copia(STRATI) });
    s1.opzioni = { Vs12: null, IcSoglia: 2.6, CFC: 0, FSrif: P.FS_RIFERIMENTO };
    s1.esclusione = esclusioneEsempio();
    const s2 = P.nuovoScenario(b, 'S1 SPT – falda 1,8 m', 1);
    Object.assign(s2, { metodo: 'bi2014Spt', Mw: 6.1, amax: 0.26, zFalda: Z_FALDA, strati: P.copia(STRATI) });
    s2.opzioni = { Vs12: 178, IcSoglia: 2.6, CFC: 0, FSrif: P.FS_RIFERIMENTO };
    s2.esclusione = esclusioneEsempio();
    const s3 = P.nuovoScenario(a, 'SLV – falda alta 1,0 m', 2);
    Object.assign(s3, { Mw: 6.1, amax: 0.26, zFalda: 1.0, strati: P.copia(STRATI) });
    s3.opzioni = { Vs12: null, IcSoglia: 2.6, CFC: 0, FSrif: P.FS_RIFERIMENTO };
    pr.scenari = [s1, s2, s3];
    pr.provaAttiva = a.id; pr.scenarioAttivo = s1.id;
    return pr;
  }

  return { progettoEsempio };
});
