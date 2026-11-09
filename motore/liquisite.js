/*
 * GeoHub-LiquiSite — motore di calcolo della verifica a liquefazione
 * Copyright (C) 2026 Fabio Duronio — AGPL-3.0 con i termini aggiuntivi del file NOTICE.
 *
 * Contenuto: tensioni litostatiche e quattro metodi semplificati, ciascuno come
 * blocco chiuso con le proprie funzioni (rd, normalizzazioni, Kσ, MSF/KMw,
 * correzione per i fini). Nessun componente è condiviso tra metodi
 * (Boulanger & Idriss 2014, pag. 8).
 *
 *   bi2014Spt  — Boulanger R.W., Idriss I.M. (2014). CPT and SPT based liquefaction
 *                triggering procedures. Report UCD/CGM-14/01, UC Davis.
 *                Correzioni di N60: Idriss I.M., Boulanger R.W. (2010). SPT-based
 *                liquefaction triggering procedures. Report UCD/CGM-10/02, UC Davis.
 *   bi2014Cpt  — Boulanger & Idriss (2014), come sopra; esponente n per Ic da
 *                Robertson P.K., Wride C.E. (1998). Can. Geotech. J. 35, 442–459.
 *   cetin2018Spt — Cetin K.O. et al. (2018). SPT-based probabilistic and deterministic
 *                assessment of seismic soil liquefaction triggering hazard. Soil Dyn.
 *                Earthq. Eng. 115, 698–709; procedura applicativa: Cetin K.O. et al.
 *                (2018). MethodsX 5, 1556–1575.
 *   kayen2013Vs — Kayen R. et al. (2013). Shear-wave velocity-based probabilistic and
 *                deterministic assessment of seismic soil liquefaction potential.
 *                J. Geotech. Geoenviron. Eng. 139(3), 407–419.
 *
 * Unità: profondità in m dal piano campagna (positive verso il basso); tensioni in kPa;
 * accelerazioni in g; qc in MPa; fs e u2 in kPa; velocità in m/s; FC in %.
 * Ogni formula riporta tra parentesi quadre la fonte: [autore anno, Eq., pag.].
 * Le pagine sono quelle stampate delle pubblicazioni.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LiquiSite = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const VERSIONE_MOTORE = '0.2.0';
  const GAMMA_W = 9.81; // kN/m³

  // ---------------------------------------------------------------------------
  // Funzioni di servizio: distribuzione normale standard
  // ---------------------------------------------------------------------------

  // erfc con approssimazione di Chebyshev (errore relativo < 1,2e-7).
  function erfc(x) {
    const z = Math.abs(x);
    const t = 1 / (1 + 0.5 * z);
    const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 +
      t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 +
      t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
    return x >= 0 ? r : 2 - r;
  }

  /** Funzione di ripartizione della normale standard Φ(x). */
  function Phi(x) {
    return 0.5 * erfc(-x / Math.SQRT2);
  }

  /** Inversa Φ⁻¹(p), algoritmo di Acklam con un passo di affinamento di Halley. */
  function PhiInv(p) {
    if (!(p > 0 && p < 1)) throw new RangeError('PhiInv: p deve essere tra 0 e 1 esclusi');
    const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02,
      1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
    const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02,
      6.680131188771972e+01, -1.328068155288572e+01];
    const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00,
      -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
    const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00,
      3.754408661907416e+00];
    const pl = 0.02425;
    let x;
    if (p < pl) {
      const q = Math.sqrt(-2 * Math.log(p));
      x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
        ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    } else if (p <= 1 - pl) {
      const q = p - 0.5, r = q * q;
      x = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
        (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
    } else {
      const q = Math.sqrt(-2 * Math.log(1 - p));
      x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
        ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
    const e = Phi(x) - p;
    const u = e * Math.sqrt(2 * Math.PI) * Math.exp(x * x / 2);
    return x - u / (1 + x * u / 2);
  }

  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

  // ---------------------------------------------------------------------------
  // Tensioni litostatiche
  // ---------------------------------------------------------------------------

  /**
   * Tensione verticale totale, pressione interstiziale e tensione efficace alla profondità z.
   * strati: [{ da, a, gamma, gammaSat }] in m e kN/m³, contigui a partire da 0.
   * zFalda: profondità della falda di verifica (m dal p.c.). Pressione idrostatica.
   */
  function tensioni(strati, zFalda, z) {
    if (!Array.isArray(strati) || strati.length === 0) throw new Error('tensioni: nessuno strato');
    let sv = 0;
    let zc = 0;
    const ordinati = strati.slice().sort((p, q) => p.da - q.da);
    for (const s of ordinati) {
      if (Math.abs(s.da - zc) > 1e-6) throw new Error('tensioni: strati non contigui a ' + zc + ' m');
      const fine = Math.min(s.a, z);
      if (fine > zc) {
        // parte sopra falda con gamma, parte sotto falda con gammaSat
        const sopra = Math.max(0, Math.min(fine, zFalda) - zc);
        const sotto = (fine - zc) - sopra;
        sv += sopra * s.gamma + sotto * s.gammaSat;
      }
      zc = s.a;
      if (zc >= z) break;
    }
    if (zc < z - 1e-9) throw new Error('tensioni: gli strati non arrivano a ' + z + ' m');
    const u = Math.max(0, z - zFalda) * GAMMA_W;
    return { sv, u, sve: sv - u };
  }

  // ---------------------------------------------------------------------------
  // BOULANGER & IDRISS (2014) — blocco comune a SPT e CPT
  // ---------------------------------------------------------------------------
  const BI = {
    PA: 101.325, // pressione atmosferica, kPa

    /** rd [B&I 2014, Eq. 2.14a–c, pag. 8]; z in m, argomenti del seno in radianti. */
    rd(z, M) {
      const alfa = -1.012 - 1.126 * Math.sin(z / 11.73 + 5.133);
      const beta = 0.106 + 0.118 * Math.sin(z / 11.28 + 5.142);
      return Math.exp(alfa + beta * M);
    },

    /**
     * MSF [B&I 2014, Eq. 2.18, pag. 14], forma esatta. L'Eq. 2.19 ne è la versione con i
     * termini fissi arrotondati (8,64 e 1,325): differenza relativa ≤ 2·10⁻⁴.
     */
    msf(M, MSFmax) {
      const e = Math.exp;
      return 1 + (MSFmax - 1) * (e(-M / 4) - e(-7.5 / 4)) / (e(-5.25 / 4) - e(-7.5 / 4));
    },

    /** Kσ [B&I 2014, Eq. 2.16a, pag. 11]: Kσ = 1 − Cσ·ln(σ'v/Pa) ≤ 1,1. */
    ksigma(Csigma, sve) {
      return Math.min(1 - Csigma * Math.log(sve / BI.PA), 1.1);
    },

    /** CSR al sito [B&I 2014, Eq. 2.2, pag. 5]. */
    csr(amax, sv, sve, rd) {
      return 0.65 * (sv / sve) * amax * rd;
    }
  };

  /** CR per la lunghezza delle aste [I&B 2010, pag. 9, valori di Youd et al. 2001]. */
  function crIdrissBoulanger2010(lunghezzaAste) {
    if (lunghezzaAste < 3) return 0.75;
    if (lunghezzaAste < 4) return 0.80;
    if (lunghezzaAste < 6) return 0.85;
    if (lunghezzaAste < 10) return 0.95;
    return 1.00;
  }

  /**
   * Boulanger & Idriss (2014) da SPT, deterministico.
   * punto: { z, N, FC, sv, sve }  sisma: { amax, Mw }
   * verticale: { CE, CB=1, CS=1, sporgenza (m) }
   * La relazione probabilistica da SPT (Boulanger & Idriss 2012a) non è inclusa: PL = null.
   */
  function bi2014Spt(punto, sisma, verticale) {
    const avvisi = [];
    const { z, N, FC, sv, sve } = punto;
    const { amax, Mw } = sisma;
    const CE = verticale.CE, CB = verticale.CB ?? 1, CS = verticale.CS ?? 1;
    if (!(CE > 0)) throw new Error('bi2014Spt: CE mancante');

    // N60 e (N1)60 [I&B 2010, Eq. 2.3, pag. 5]
    const lunghezzaAste = (verticale.sporgenza ?? 0) + z;
    const CR = crIdrissBoulanger2010(lunghezzaAste);
    if (lunghezzaAste > 30) avvisi.push('Aste oltre 30 m: CR = 1,00 fuori dalla tabella di I&B 2010 (pag. 9).');
    const N60 = N * CE * CB * CR * CS;

    // Δ(N1)60 [B&I 2014, Eq. 2.23, pag. 15]
    const dN = Math.exp(1.63 + 9.7 / (FC + 0.01) - Math.pow(15.7 / (FC + 0.01), 2));

    // CN iterativo [B&I 2014, Eq. 2.15a e 2.15c, pag. 10]; (N1)60cs limitato a ≤ 46 nella m
    let N160cs = N60 + dN, CN = 1, N160 = N60;
    for (let i = 0; i < 100; i++) {
      const m = 0.784 - 0.0768 * Math.sqrt(Math.min(Math.max(N160cs, 0), 46));
      CN = Math.min(Math.pow(BI.PA / sve, m), 1.7);
      N160 = CN * N60;
      const nuovo = N160 + dN;
      if (Math.abs(nuovo - N160cs) < 1e-9) { N160cs = nuovo; break; }
      N160cs = nuovo;
    }
    if (CN >= 1.7 - 1e-12) avvisi.push('CN limitato a 1,7 (σ\'v basso) [B&I 2014, pag. 10].');

    const rd = BI.rd(z, Mw);
    const CSR = BI.csr(amax, sv, sve, rd);

    // Cσ [B&I 2014, Eq. 2.16c, pag. 11]; (N1)60cs ≤ 37 equivale a Cσ ≤ 0,3
    const Csigma = Math.min(1 / (18.9 - 2.55 * Math.sqrt(Math.min(Math.max(N160cs, 0), 37))), 0.3);
    const Ksigma = BI.ksigma(Csigma, sve);

    // MSFmax e MSF [B&I 2014, Eq. 2.21 e 2.19, pag. 14]
    const MSFmax = Math.min(1.09 + Math.pow(N160cs / 31.5, 2), 2.2);
    const MSF = BI.msf(Mw, MSFmax);

    // CRR per M = 7,5 e σ'v = 1 atm [B&I 2014, Eq. 2.25, pag. 17]
    const n = N160cs;
    const CRR75 = Math.exp(n / 14.1 + Math.pow(n / 126, 2) - Math.pow(n / 23.6, 3) + Math.pow(n / 25.4, 4) - 2.8);
    // CRR al sito [B&I 2014, Eq. 2.7, pag. 6]
    const CRR = CRR75 * MSF * Ksigma;
    const FS = CRR / CSR;

    return {
      metodo: 'bi2014Spt', z, stato: 'calcolato',
      lunghezzaAste, CR, N60, CN, N160, dN160: dN, N160cs,
      rd, CSR, Csigma, Ksigma, MSFmax, MSF, CSR75: CSR / (MSF * Ksigma),
      CRR75, CRR, FS, PL: null, avvisi
    };
  }

  /**
   * Indice di comportamento Ic con la regola per l'esponente n di Robertson & Wride (1998),
   * pag. 449 e Fig. 12. Q e F secondo [B&I 2014, Eq. 2.26–2.28, pag. 19].
   * qt in kPa.
   */
  function icRobertsonWride(qt, fs, sv, sve, PA) {
    const net = qt - sv;
    if (!(net > 0) || !(fs > 0)) return null;
    const F = fs / net * 100;
    const ic = (nExp) => {
      const Q = (net / PA) * Math.pow(PA / sve, nExp);
      return { Q, Ic: Math.sqrt(Math.pow(3.47 - Math.log10(Q), 2) + Math.pow(1.22 + Math.log10(F), 2)) };
    };
    const r1 = ic(1.0);
    if (r1.Ic > 2.6) return { n: 1.0, Q: r1.Q, F, Ic: r1.Ic };
    const r05 = ic(0.5);
    if (r05.Ic <= 2.6) return { n: 0.5, Q: r05.Q, F, Ic: r05.Ic };
    const r075 = ic(0.75);
    return { n: 0.75, Q: r075.Q, F, Ic: r075.Ic };
  }

  /**
   * Boulanger & Idriss (2014) da CPT/CPTU (punta elettrica).
   * punto: { z, qc (MPa), fs (kPa), u2 (kPa, facoltativo), sv, sve, FC (facoltativo, misurato) }
   * opz: { ar (rapporto d'area, default 0,8), IcSoglia (default 2,6), CFC (default 0) }
   */
  function bi2014Cpt(punto, sisma, opz = {}) {
    const avvisi = [];
    const { z, qc, fs, sv, sve } = punto;
    const { amax, Mw } = sisma;
    const ar = opz.ar ?? 0.8;
    const IcSoglia = opz.IcSoglia ?? 2.6;
    const CFC = opz.CFC ?? 0;
    const PA = BI.PA;

    // qt [B&I 2014, Eq. 2.3, pag. 6]; u2 assente → qt = qc
    const qt = qc * 1000 + (1 - ar) * (punto.u2 ?? 0);

    const cls = icRobertsonWride(qt, fs, sv, sve, PA);
    if (!cls) return { metodo: 'bi2014Cpt', z, stato: 'non calcolabile', avvisi: ['qt − σv o fs non positivi.'] };

    let FC, origineFC;
    if (punto.FC != null) { FC = punto.FC; origineFC = 'misurato'; }
    else {
      // [B&I 2014, Eq. 2.30, pag. 21]
      FC = clamp(80 * (cls.Ic + CFC) - 137, 0, 100);
      origineFC = 'stimato da Ic (C_FC = ' + CFC + ')';
    }

    if (cls.Ic > IcSoglia) {
      return { metodo: 'bi2014Cpt', z, stato: 'escluso', qt, ...cls, FC, origineFC,
        avvisi: ['Ic = ' + cls.Ic.toFixed(2) + ' > soglia ' + IcSoglia + ': comportamento argilloso, escluso dalla verifica [B&I 2014, pag. 21 e 99].'] };
    }

    // qc1N e qc1Ncs iterativi [B&I 2014, Eq. 2.4, 2.10, 2.15a–b, 2.22]
    const qcN = qt / PA;
    let qc1Ncs = qcN, qc1N = qcN, CN = 1, dq = 0;
    for (let i = 0; i < 200; i++) {
      const m = 1.338 - 0.249 * Math.pow(clamp(qc1Ncs, 21, 254), 0.264);
      CN = Math.min(Math.pow(PA / sve, m), 1.7);
      qc1N = CN * qcN;
      dq = (11.9 + qc1N / 14.6) * Math.exp(1.63 - 9.7 / (FC + 2) - Math.pow(15.7 / (FC + 2), 2));
      const nuovo = qc1N + dq;
      if (Math.abs(nuovo - qc1Ncs) < 1e-9) { qc1Ncs = nuovo; break; }
      qc1Ncs = nuovo;
    }
    if (CN >= 1.7 - 1e-12) avvisi.push('CN limitato a 1,7 (σ\'v basso) [B&I 2014, pag. 10].');

    const rd = BI.rd(z, Mw);
    const CSR = BI.csr(amax, sv, sve, rd);
    // Cσ [B&I 2014, Eq. 2.16b, pag. 11]; qc1Ncs ≤ 211 equivale a Cσ ≤ 0,3
    const Csigma = Math.min(1 / (37.3 - 8.27 * Math.pow(Math.min(qc1Ncs, 211), 0.264)), 0.3);
    const Ksigma = BI.ksigma(Csigma, sve);
    // [B&I 2014, Eq. 2.20 e 2.19, pag. 14]
    const MSFmax = Math.min(1.09 + Math.pow(qc1Ncs / 180, 3), 2.2);
    const MSF = BI.msf(Mw, MSFmax);

    // [B&I 2014, Eq. 2.24, pag. 17]
    const q = qc1Ncs;
    const poli = q / 113 + Math.pow(q / 1000, 2) - Math.pow(q / 140, 3) + Math.pow(q / 137, 4);
    const CRR75 = Math.exp(poli - 2.80);
    const CRR = CRR75 * MSF * Ksigma;
    const FS = CRR / CSR;
    const CSR75 = CSR / (MSF * Ksigma);
    // PL condizionata [B&I 2014, Eq. 5.26, pag. 78]: Co = 2,60, σlnR = 0,20
    const PL = Phi(-(poli - 2.60 - Math.log(CSR75)) / 0.20);

    return {
      metodo: 'bi2014Cpt', z, stato: 'calcolato',
      qt, ...cls, FC, origineFC, qcN, CN, qc1N, dqc1N: dq, qc1Ncs,
      rd, CSR, Csigma, Ksigma, MSFmax, MSF, CSR75, CRR75, CRR, FS, PL, avvisi
    };
  }

  // ---------------------------------------------------------------------------
  // rd di Cetin & Seed (2004), usato da Cetin et al. (2018) e Kayen et al. (2013)
  // [Cetin et al. 2018, MethodsX, Eq. 26–27, pag. 1566–1567; Kayen et al. 2013, Eq. 4]
  // ---------------------------------------------------------------------------
  function rdCetin(d, Mw, amax, Vs12) {
    const A = -23.013 - 2.949 * amax + 0.999 * Mw + 0.0525 * Vs12;
    const den = 1 + A / (16.258 + 0.201 * Math.exp(0.341 * (0.0785 * Vs12 + 7.586)));
    if (d < 20) {
      return (1 + A / (16.258 + 0.201 * Math.exp(0.341 * (-d + 0.0785 * Vs12 + 7.586)))) / den;
    }
    const num20 = 1 + A / (16.258 + 0.201 * Math.exp(0.341 * (-20 + 0.0785 * Vs12 + 7.586)));
    return num20 / den - 0.046 * (d - 20);
  }

  // ---------------------------------------------------------------------------
  // CETIN et al. (2018) da SPT
  // ---------------------------------------------------------------------------
  const CETIN = {
    PA: 101.3, // kPa, come negli autori [MethodsX pag. 1558]
    t1: 0.00167, t2: 27.352, t3: 3.958, t4: 0.089, t5: 16.084, t6: 11.771, t7: 0.392, se: 2.95 // [Tab. 1/Tab. 7]
  };

  /**
   * CR [Cetin et al. 2018, MethodsX, Tab. 2, pag. 1562]: 0,48 + 0,225·ln(d) per d ≤ 10 m.
   * Per 10–30 m la tabella stampa «0,48»: refuso, si usa 1,0 (continuità a 10 m;
   * Tab. 3 dell'esempio degli autori; Youd et al. 2001 tramite I&B 2010 pag. 9).
   */
  function crCetin(d) {
    return d <= 10 ? 0.48 + 0.225 * Math.log(d) : 1.0;
  }

  /**
   * punto: { z, N, FC, sv, sve }  sisma: { amax, Mw }
   * verticale: { CE, CB=1, sporgenza (m), senzaRivestimento=false, CS (facoltativo) }
   * opz: { Vs12 (m/s, obbligatorio) }
   */
  function cetin2018Spt(punto, sisma, verticale, opz) {
    const avvisi = [];
    const C = CETIN;
    const { z, N, sv, sve } = punto;
    const { amax, Mw } = sisma;
    let Vs12 = opz && opz.Vs12;
    if (!(Vs12 > 0)) throw new Error('cetin2018Spt: V*s,12 mancante');
    if (Vs12 > 230) { avvisi.push('V*s,12 = ' + Vs12 + ' m/s > 230: si usa 230 m/s come raccomandato dagli autori [Cetin 2018 SDEE, pag. 703–704].'); Vs12 = 230; }
    if (Vs12 < 90) avvisi.push('V*s,12 < 90 m/s: nessun caso della banca dati [Cetin 2018 SDEE, pag. 703–704].');
    if (Mw < 5.5 || Mw > 8.4) avvisi.push('Mw fuori dall\'intervallo 5,5–8,4 di KMw [Cetin 2018 SDEE, Eq. 15].');

    let FC = punto.FC;
    if (FC < 5 || FC > 35) { avvisi.push('FC = ' + FC + ' % limitato all\'intervallo 5–35 % [Cetin 2018, pag. 705].'); FC = clamp(FC, 5, 35); }

    const CE = verticale.CE, CB = verticale.CB ?? 1;
    if (!(CE > 0)) throw new Error('cetin2018Spt: CE mancante');
    const d = (verticale.sporgenza ?? 0) + z;
    const CR = crCetin(d);
    // CN [MethodsX Tab. 2]: (Pa/σ'v)^0,5 ≤ 2,0
    const CN = Math.min(Math.sqrt(C.PA / sve), 2.0);
    // N1,60 [MethodsX Eq. 6]; CS = 1 + N1,60/100 tra 1,10 e 1,30 se il campionatore è senza rivestimento (T-2)
    let CS = verticale.CS ?? 1, N160 = N * CN * CR * CB * CE * CS;
    if (verticale.senzaRivestimento) {
      for (let i = 0; i < 50; i++) {
        CS = clamp(1 + N160 / 100, 1.10, 1.30);
        const nuovo = N * CN * CR * CB * CE * CS;
        if (Math.abs(nuovo - N160) < 1e-9) { N160 = nuovo; break; }
        N160 = nuovo;
      }
    }

    const rd = rdCetin(z, Mw, amax, Vs12);
    // CSR [MethodsX Eq. 31]
    const CSR = 0.65 * amax * (sv / sve) * rd;

    // Funzione di stato [Cetin 2018 SDEE Eq. 10–11; MethodsX Eq. 1–2]
    const base = N160 * (1 + C.t1 * FC) - C.t2 * Math.log(Mw) - C.t3 * Math.log(sve / C.PA) + C.t4 * FC + C.t5;
    const PL = Phi(-(base - C.t6 * Math.log(CSR)) / C.se);
    const CRR = Math.exp(base / C.t6); // PL = 50 % → Φ⁻¹ = 0
    const FS = CRR / CSR; // [MethodsX Eq. 52]

    // Grandezze di riferimento [MethodsX Eq. 40–41, 44, 46, 48]
    const dN = FC * (C.t1 * N160 + C.t4);
    const Ksigma = Math.pow(sve / C.PA, -C.t3 / C.t6);
    const KMw = Math.pow(Mw / 7.5, -C.t2 / C.t6);
    const CSRrif = CSR / (Ksigma * KMw);
    const sveAtm = sve / C.PA;
    if (sveAtm < 0.25 || sveAtm > 1.8) avvisi.push('σ\'v = ' + sveAtm.toFixed(2) + ' atm fuori da 0,25–1,8 atm per Kσ [Cetin 2018, pag. 706].');
    if (CSRrif > 0.6) avvisi.push('CSR di riferimento > 0,6 [Cetin 2018 SDEE, Eq. 13].');

    return {
      metodo: 'cetin2018Spt', z, stato: 'calcolato',
      lunghezzaAste: d, CR, CN, CS, N160, dN160: dN, N160cs: N160 + dN, FCusato: FC,
      Vs12, rd, CSR, Ksigma, KMw, CSRrif, CRR, FS, PL, avvisi
    };
  }

  // ---------------------------------------------------------------------------
  // KAYEN et al. (2013) da Vs — solo confronto
  // ---------------------------------------------------------------------------
  /**
   * punto: { z, Vs, FC (default 0), sv, sve }  sisma: { amax, Mw }  opz: { Vs12 }
   * Segno di Φ⁻¹(PL) nell'Eq. 14: la versione editoriale stampa «−», l'inversione
   * dell'Eq. 13 dà «+» ed è coerente con la Fig. 6 (vedi docs/metodo.md).
   */
  function kayen2013Vs(punto, sisma, opz) {
    const avvisi = [];
    const PA = 100; // kPa [Kayen 2013, Eq. 2]
    const { z, Vs, sv, sve } = punto;
    const FC = punto.FC ?? 0;
    const { amax, Mw } = sisma;
    const Vs12 = opz && opz.Vs12;
    if (!(Vs12 > 0)) throw new Error('kayen2013Vs: V*s,12 mancante');
    if (Mw < 5.5 || Mw > 9.0) avvisi.push('Mw fuori dall\'intervallo 5,5–9,0 della DWF [Kayen 2013, Eq. 17].');
    if (sve > 180) avvisi.push('σ\'v0 > 180 kPa: oltre la banca dati, Kσ assunto pari a 1 [Kayen 2013, pag. 410–411].');

    // Vs1 [Kayen 2013, Eq. 2], CVs ≤ 1,5
    const CVs = Math.min(Math.pow(PA / sve, 0.25), 1.5);
    const Vs1 = Vs * CVs;
    const rd = rdCetin(z, Mw, amax, Vs12);
    const CSR = 0.65 * amax * (sv / sve) * rd; // [Eq. 3]

    const A = Math.pow(0.0073 * Vs1, 2.8011) - 2.6168 * Math.log(Mw) - 0.0099 * Math.log(sve) + 0.0028 * FC;
    // PL [Kayen 2013, Eq. 13]
    const PL = Phi(-(A - 1.946 * Math.log(CSR)) / 0.4809);
    // CRR a PL = 15 % [Eq. 14 con il segno ricavato dall'Eq. 13]
    const CRR15 = Math.exp((A + 0.4809 * PhiInv(0.15)) / 1.946);
    const FS = CRR15 / CSR; // [Eq. 16]
    const DWF = 15 * Math.pow(Mw, -1.342); // [Eq. 17], solo informativo

    return { metodo: 'kayen2013Vs', z, stato: 'calcolato', CVs, Vs1, Vs12, rd, CSR, CRR15, FS, PL, DWF, avvisi };
  }

  // ---------------------------------------------------------------------------
  // ESCLUSIONE DELLA VERIFICA — NTC 2018 §7.11.3.4.2
  // Basta un criterio soddisfatto. L'esito si esprime come «verifica omessa ai sensi del
  // §7.11.3.4.2», mai come «terreno non liquefacibile».
  // ---------------------------------------------------------------------------

  /** Criterio 1: amax attesa al p.c. in campo libero < 0,1 g. */
  function criterio1(amax) {
    const soddisfatto = amax < 0.1;
    return {
      criterio: 1, soddisfatto, valore: amax, soglia: 0.1, margine: 0.1 - amax,
      nota: soddisfatto ? null : 'amax ≥ 0,1 g: approfondire le indagini per verificare gli altri tre criteri (Circolare 7/2019, C7.11.3.4).'
    };
  }

  /** Criterio 2: falda media stagionale > 15 m, p.c. sub-orizzontale e fondazioni superficiali. */
  function criterio2(zFalda, pcSubOrizzontale, fondazioniSuperficiali) {
    const soddisfatto = zFalda > 15 && !!pcSubOrizzontale && !!fondazioniSuperficiali;
    return { criterio: 2, soddisfatto, valore: zFalda, soglia: 15, margine: zFalda - 15,
      condizioni: { falda: zFalda > 15, pcSubOrizzontale: !!pcSubOrizzontale, fondazioniSuperficiali: !!fondazioniSuperficiali } };
  }

  /**
   * Criterio 3: depositi di sabbie pulite con (N1)60 > 30 oppure qc1N > 180.
   * valore: (N1)60 o qc1N calcolato con la normalizzazione del metodo principale
   * (decisione del 10/11/2026); il nome del metodo va riportato in stampa.
   * margineRelativo < 0,10 → avviso di robustezza (scelta di LiquiSite, non normativa).
   */
  function criterio3(tipo, valore, sabbiaPulita) {
    const soglia = tipo === 'CPT' ? 180 : 30;
    const soddisfatto = !!sabbiaPulita && valore > soglia;
    const margineRelativo = (valore - soglia) / soglia;
    const avvisi = [];
    if (!sabbiaPulita) avvisi.push('Il criterio vale per depositi di sabbie pulite.');
    if (soddisfatto && margineRelativo < 0.10) avvisi.push('Valore di poco superiore alla soglia (meno del 10 %): condizione debole.');
    return { criterio: 3, tipo, soddisfatto, valore, soglia, margineRelativo, avvisi };
  }

  /** Interpolazione lineare di y su x crescente; null fuori intervallo. */
  function interp(xs, ys, x) {
    for (let i = 0; i < xs.length - 1; i++) {
      if (xs[i] <= x && x <= xs[i + 1] && xs[i + 1] > xs[i]) {
        return ys[i] + (ys[i + 1] - ys[i]) * (x - xs[i]) / (xs[i + 1] - xs[i]);
      }
    }
    return null;
  }

  /** log10(d) in funzione del passante, da una curva [[d mm, p %], …]; ordina per p. */
  function curvaLogD(curva) {
    const pts = curva.filter(([d, p]) => d > 0).map(([d, p]) => [p, Math.log10(d)]).sort((a, b) => a[0] - b[0]);
    return { ps: pts.map(x => x[0]), ls: pts.map(x => x[1]) };
  }

  /** Coefficiente di uniformità Uc = D60/D10 (interpolazione su log d); null se non determinabile. */
  function coeffUniformita(curva) {
    const c = curvaLogD(curva);
    const l10 = interp(c.ps, c.ls, 10), l60 = interp(c.ps, c.ls, 60);
    if (l10 == null || l60 == null) return { Uc: null, D10: l10 == null ? null : 10 ** l10, D60: l60 == null ? null : 10 ** l60 };
    return { Uc: 10 ** (l60 - l10), D10: 10 ** l10, D60: 10 ** l60 };
  }

  const TOLLERANZA_FUSI = 0.03; // decadi di d: ≈ 3 pixel della figura ufficiale (spessore della curva)

  /**
   * Posizione di una curva granulometrica rispetto a un fuso, per passante intero dal 2 al 98 %.
   * fuso: { sinistra: [[p, d], …], destra: [[p, d], …] } (dati/fusi-ntc2018.json).
   * Esito: 'interna' (tutti i punti dentro il fuso oltre la tolleranza), 'esterna' (tutti fuori
   * oltre la tolleranza), altrimenti 'tocca' (l'app non propone un esito).
   */
  function confrontaFuso(curva, fuso, tol = TOLLERANZA_FUSI) {
    const c = curvaLogD(curva);
    const sx = { ps: fuso.sinistra.map(x => x[0]), ls: fuso.sinistra.map(x => Math.log10(x[1])) };
    const dx = { ps: fuso.destra.map(x => x[0]), ls: fuso.destra.map(x => Math.log10(x[1])) };
    let dentro = 0, fuori = 0, bordo = 0;
    const dettaglio = [];
    for (let p = 2; p <= 98; p++) {
      const l = interp(c.ps, c.ls, p), lsx = interp(sx.ps, sx.ls, p), ldx = interp(dx.ps, dx.ls, p);
      if (l == null || lsx == null || ldx == null) continue;
      let stato;
      if (l > lsx + tol && l < ldx - tol) { stato = 'dentro'; dentro++; }
      else if (l < lsx - tol || l > ldx + tol) { stato = 'fuori'; fuori++; }
      else { stato = 'bordo'; bordo++; }
      dettaglio.push({ p, d: 10 ** l, stato });
    }
    const n = dentro + fuori + bordo;
    let esito;
    if (n === 0) esito = 'non confrontabile';
    else if (dentro === n) esito = 'interna';
    else if (fuori === n) esito = 'esterna';
    else esito = 'tocca';
    return { esito, punti: n, dentro, fuori, bordo, tolleranzaDecadi: tol, dettaglio };
  }

  /**
   * Criterio 4: distribuzione granulometrica esterna ai fusi della Fig. 7.11.1
   * ((a) se Uc < 3,5; (b) se Uc > 3,5). Esito PROPOSTO dall'app: il geologo lo conferma
   * o lo corregge con motivazione (decisione del 10/11/2026).
   * Se Uc non è determinabile o vale 3,5: confronto con entrambi i fusi; proposta
   * «soddisfatto» solo se la curva è esterna a entrambi.
   */
  function criterio4(curva, fusi, tol = TOLLERANZA_FUSI) {
    const u = coeffUniformita(curva);
    const avvisi = [];
    let confronti;
    if (u.Uc != null && u.Uc < 3.5) confronti = { a: confrontaFuso(curva, fusi.a_Uc_minore_3_5, tol) };
    else if (u.Uc != null && u.Uc > 3.5) confronti = { b: confrontaFuso(curva, fusi.b_Uc_maggiore_3_5, tol) };
    else {
      avvisi.push(u.Uc == null
        ? 'Uc non determinabile (la curva non copre il 10 % e il 60 % di passante): confronto con entrambi i fusi.'
        : 'Uc = 3,5: confronto con entrambi i fusi.');
      confronti = { a: confrontaFuso(curva, fusi.a_Uc_minore_3_5, tol), b: confrontaFuso(curva, fusi.b_Uc_maggiore_3_5, tol) };
    }
    const esiti = Object.values(confronti).map(c => c.esito);
    let proposta;
    if (esiti.every(e => e === 'esterna')) proposta = 'soddisfatto';
    else if (esiti.some(e => e === 'interna')) proposta = 'non soddisfatto';
    else proposta = 'nessuna proposta';
    if (proposta === 'nessuna proposta') avvisi.push('La curva tocca o interseca il fuso entro la tolleranza: la valutazione spetta al geologo.');
    return { criterio: 4, ...u, confronti, proposta, avvisi,
      fonte: 'NTC 2018, Fig. 7.11.1 (fusi digitalizzati dall\'immagine ufficiale, tolleranza ' + tol + ' decadi di d)' };
  }

  // ---------------------------------------------------------------------------
  // Avvisi comuni di profondità
  // ---------------------------------------------------------------------------
  function avvisiProfondita(z) {
    const a = [];
    if (z > 20) a.push('Profondità oltre 20 m: fuori dal campo di calcolo di LiquiSite.');
    else if (z > 12) a.push('Profondità oltre 12 m: rd incerto, valutare l\'analisi di risposta sismica locale [B&I 2014, pag. 9].');
    return a;
  }

  return {
    VERSIONE_MOTORE, GAMMA_W,
    Phi, PhiInv, tensioni,
    bi2014Spt, bi2014Cpt, cetin2018Spt, kayen2013Vs,
    rdCetin, crCetin, crIdrissBoulanger2010, icRobertsonWride, avvisiProfondita,
    criterio1, criterio2, criterio3, criterio4, confrontaFuso, coeffUniformita, TOLLERANZA_FUSI,
    _BI: BI, _CETIN: CETIN
  };
});
