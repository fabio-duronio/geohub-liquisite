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
 *   8,6–12,4  sabbia media mediamente addensata  (qc1Ncs circa 120–140)
 *   12,4–13,2 limo argilloso                   sovrappressioni interstiziali in u2
 *   13,2–20,0 sabbia da media a densa          (qc1Ncs circa 130–150); CPTU spinta fino a 20 m
 * Le densità sono scelte coerenti con le descrizioni: nessun FS oltre la scala del grafico.
 * Sondaggio S1 accanto alla CPTU: SPT nei livelli granulari, coerenti con la CPTU, FC da analisi
 * di laboratorio, cinque curve granulometriche per la verifica preliminare (§7.11.3.4.2),
 * una per ogni strato saturo entro 20 m (il riporto non ha analisi).
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
    { da: 12.4, a: 13.2, gamma: 19.0, gammaSat: 19.5, FC: null, descrizione: 'Limo argilloso' },
    { da: 13.2, a: 20.0, gamma: 19.5, gammaSat: 20.5, FC: null, descrizione: 'Sabbia da media a densa' }
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
    if (z < 12.4) return { qc: 12.5 + 0.5 * (z - 8.6), Rf: 0.65, Bq: 0, sd: 0.06 };
    if (z < 13.2) return { qc: 1.7, Rf: 3.8, Bq: 0.2, sd: 0.06 };
    return { qc: 16.0 + 0.45 * (z - 13.2), Rf: 0.55, Bq: 0, sd: 0.05 };
  }

  /** CPTU con passo 2 cm da 0,60 m (preforo nel riporto) a 20,00 m. */
  function cptu() {
    const rnd = generatore(20261113);
    const passo = 0.02, z0 = 0.6, z1 = 20.0;
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
    return [[4.0, 9, 27], [5.5, 11, 22], [6.8, 13, 30], [9.5, 21, 7], [11.0, 23, 6], [14.5, 26, 5], [16.5, 28, 4], [18.5, 30, 4]];
  }

  /** Verifica preliminare dell'esempio: dati di sito e curve granulometriche (inventati). */
  function esclusioneEsempio() {
    return {
      faldaMediaStagionale: 2.4, pcSubOrizzontale: true, fondazioniSuperficiali: true,
      strati: [
        { da: 0, a: 1.2, sabbiaPulita: false, campione: '', curva: null, decisione4: null, motivazione4: '' },
        { da: 1.2, a: 3.4, sabbiaPulita: false, campione: 'S1-C1, 2,5–3,0 m',
          curva: [[0.0005, 10], [0.001, 18], [0.002, 34], [0.006, 60], [0.02, 85], [0.04, 96], [0.063, 99], [0.075, 100]],
          decisione4: 'soddisfatto', motivazione4: '' },
        { da: 3.4, a: 7.2, sabbiaPulita: false, campione: 'S1-C2, 5,0–5,5 m',
          curva: [[0.006, 3], [0.01, 6], [0.03, 12], [0.075, 27], [0.1, 38], [0.2, 70], [0.4, 92], [1, 99], [2, 100]],
          decisione4: 'non soddisfatto', motivazione4: '' },
        { da: 7.2, a: 8.6, sabbiaPulita: false, campione: 'S1-C3, 7,6–8,1 m',
          curva: [[0.001, 7], [0.002, 11], [0.006, 19], [0.02, 36], [0.063, 58], [0.075, 63], [0.125, 80], [0.25, 94], [0.5, 99], [1, 100]],
          decisione4: 'non soddisfatto',
          motivazione4: 'La curva tocca il fuso nel tratto sabbioso e lo strato alterna livelli di sabbia limosa: esclusione non dimostrata, la verifica si esegue.' },
        { da: 8.6, a: 12.4, sabbiaPulita: true, campione: 'S1-C4, 10,0–10,5 m',
          curva: [[0.063, 3], [0.075, 5], [0.125, 12], [0.25, 50], [0.5, 86], [1, 97], [2, 99], [4, 100]],
          decisione4: 'non soddisfatto', motivazione4: '' },
        { da: 12.4, a: 13.2, sabbiaPulita: false, campione: 'S1-C5, 12,6–13,0 m',
          curva: [[0.0005, 10], [0.001, 18], [0.002, 35], [0.006, 62], [0.01, 74], [0.02, 87], [0.03, 94], [0.04, 97], [0.063, 99.5], [0.075, 100]],
          decisione4: 'soddisfatto', motivazione4: '' },
        { da: 13.2, a: 20, sabbiaPulita: true, campione: 'S1-C6, 16,5–17,0 m',
          curva: [[0.063, 3], [0.075, 4], [0.125, 9], [0.25, 32], [0.5, 71], [1, 92], [2, 98], [4, 100]],
          decisione4: 'non soddisfatto', motivazione4: '' }
      ]
    };
  }

  function progettoEsempio() {
    const pr = P.nuovoProgetto();
    pr.progetto = {
      titolo: 'Esempio sintetico – piana alluvionale',
      sito: 'Sito inventato (dati sintetici)',
      // nessuna coordinata: il sito è inventato, la Mw dell'esempio è inserita a mano
      lat: null, lon: null, noteZS9: '',
      autore: '',
      note: 'Dati inventati per provare l\'applicazione: non rappresentano un sito reale. Falda a 1,8 m dal p.c.; ' +
        'CPTU spinta fino a 20 m; sondaggio S1 con SPT e FC da analisi di laboratorio; ' +
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
    s3.esclusione = esclusioneEsempio();
    // motivazione della Mw obbligatoria (decisione del 21/11/2026): valore illustrativo dell'esempio
    for (const s of [s1, s2, s3]) s.magnitudo = { origine: 'manuale', motivazione: 'Valore illustrativo dell\'esempio sintetico: sito inventato, nessuna fonte.' };
    pr.scenari = [s1, s2, s3];
    pr.provaAttiva = a.id; pr.scenarioAttivo = s1.id;
    return pr;
  }

  return { progettoEsempio };
});
