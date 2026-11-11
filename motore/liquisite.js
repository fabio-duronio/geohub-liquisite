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
 *
 * CONVENZIONE DEI RISULTATI (dalla versione 0.3.0)
 * Ogni funzione di calcolo restituisce un oggetto con `stato`:
 *   'calcolato'          calcolo riuscito (possono esserci avvisi);
 *   'input_non_valido'   dato impossibile o di tipo errato → `errori` [{campo, codice, motivo}];
 *   'dati_insufficienti' manca un dato necessario o la copertura non basta;
 *   'non_applicabile'    il metodo o LiquiSite non si applicano al punto (`motivo`, `codice`);
 *   'non_convergente'    un ciclo iterativo non ha raggiunto la tolleranza;
 *   'errore_numerico'    una grandezza calcolata non è un numero finito.
 * Solo con stato 'calcolato' i campi FS, CRR, CSR e PL sono valori utilizzabili.
 * Gli avvisi sono oggetti {codice, tipo, messaggio}; tipo:
 *   'fuori_campo'  fuori dal campo di calibrazione del metodo (il calcolo prosegue);
 *   'limite_app'   limite o scelta di LiquiSite, non della fonte;
 *   'assunzione'   valore predefinito o ipotesi adottata dal motore;
 *   'nota'         informazione.
 * Le funzioni non lanciano eccezioni per dati errati: restituiscono 'input_non_valido'.
 * Nessuna conversione implicita: numeri e booleani devono essere del tipo giusto.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LiquiSite = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const VERSIONE_MOTORE = '0.3.0';
  const GAMMA_W = 9.81; // kN/m³

  const STATI = Object.freeze({
    CALCOLATO: 'calcolato',
    INPUT_NON_VALIDO: 'input_non_valido',
    DATI_INSUFFICIENTI: 'dati_insufficienti',
    NON_APPLICABILE: 'non_applicabile',
    NON_CONVERGENTE: 'non_convergente',
    ERRORE_NUMERICO: 'errore_numerico'
  });

  /** Limite di profondità di LiquiSite (scelta dell'app, non delle fonti). */
  const Z_MAX_APP = 20;

  // ---------------------------------------------------------------------------
  // Validazione centralizzata
  // ---------------------------------------------------------------------------

  const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

  /** Raccoglie gli errori di validazione di una chiamata. */
  function Validatore(prefisso) {
    this.prefisso = prefisso ? prefisso + '.' : '';
    this.errori = [];
  }
  Validatore.prototype.errore = function (campo, codice, motivo) {
    this.errori.push({ campo: this.prefisso + campo, codice, motivo });
  };
  /**
   * Numero finito con limiti facoltativi.
   * opz: { min, max, minEscluso, maxEscluso, facoltativo }
   * Restituisce il valore se valido, altrimenti undefined.
   */
  Validatore.prototype.num = function (campo, v, opz = {}) {
    if (v === undefined && opz.facoltativo) return undefined;
    if (!isNum(v)) {
      this.errore(campo, v === undefined || v === null || v === '' ? 'MANCANTE' : 'NON_NUMERICO',
        'atteso un numero finito, ricevuto ' + (v === '' ? 'stringa vuota' : JSON.stringify(v)));
      return undefined;
    }
    if (opz.min !== undefined && v < opz.min) { this.errore(campo, 'FUORI_DOMINIO', 'deve essere ≥ ' + opz.min); return undefined; }
    if (opz.minEscluso !== undefined && v <= opz.minEscluso) { this.errore(campo, 'FUORI_DOMINIO', 'deve essere > ' + opz.minEscluso); return undefined; }
    if (opz.max !== undefined && v > opz.max) { this.errore(campo, 'FUORI_DOMINIO', 'deve essere ≤ ' + opz.max); return undefined; }
    if (opz.maxEscluso !== undefined && v >= opz.maxEscluso) { this.errore(campo, 'FUORI_DOMINIO', 'deve essere < ' + opz.maxEscluso); return undefined; }
    return v;
  };
  Validatore.prototype.bool = function (campo, v, opz = {}) {
    if (v === undefined && opz.facoltativo) return undefined;
    if (typeof v !== 'boolean') {
      this.errore(campo, v === undefined || v === null ? 'MANCANTE' : 'NON_BOOLEANO',
        'atteso true o false, ricevuto ' + JSON.stringify(v));
      return undefined;
    }
    return v;
  };
  Validatore.prototype.scelta = function (campo, v, ammessi) {
    if (!ammessi.includes(v)) {
      this.errore(campo, v === undefined || v === null ? 'MANCANTE' : 'VALORE_NON_AMMESSO',
        'valori ammessi: ' + ammessi.join(', ') + '; ricevuto ' + JSON.stringify(v));
      return undefined;
    }
    return v;
  };
  Validatore.prototype.oggetto = function (campo, v) {
    if (v === null || typeof v !== 'object' || Array.isArray(v)) {
      this.errore(campo, 'MANCANTE', 'atteso un oggetto');
      return false;
    }
    return true;
  };
  Validatore.prototype.ok = function () { return this.errori.length === 0; };

  const avviso = (codice, tipo, messaggio) => ({ codice, tipo, messaggio });

  function nonValido(metodo, z, errori) {
    return { metodo, z: isNum(z) ? z : null, stato: STATI.INPUT_NON_VALIDO, errori, avvisi: [] };
  }
  function nonApplicabile(metodo, z, codice, motivo, extra = {}) {
    return { metodo, z, stato: STATI.NON_APPLICABILE, codice, motivo, avvisi: [], ...extra };
  }
  function datiInsufficienti(metodo, z, codice, motivo, extra = {}) {
    return { metodo, z, stato: STATI.DATI_INSUFFICIENTI, codice, motivo, avvisi: [], ...extra };
  }

  /**
   * Chiusura comune dei metodi: controllo di finitezza e precondizione di saturazione.
   * Se u = σv − σ'v è nulla il punto non è sotto la falda: esito 'non_applicabile' con le
   * grandezze calcolate in `diagnostica` (utili per la normalizzazione, non per la verifica).
   */
  function chiudi(ris, chiavi, punto) {
    const r = controllaFiniti(ris, chiavi);
    if (r.stato !== STATI.CALCOLATO) return r;
    if (punto.sv - punto.sve < 1e-9) {
      return nonApplicabile(ris.metodo, ris.z, 'NON_SATURO',
        'pressione interstiziale nulla (σ\'v = σv): il punto non è sotto la falda di verifica. Le grandezze in diagnostica non costituiscono una verifica.',
        { diagnostica: ris });
    }
    return r;
  }

  /** Controlla che tutte le grandezze indicate siano numeri finiti. */
  function controllaFiniti(ris, chiavi) {
    const nonFiniti = chiavi.filter(k => ris[k] !== null && !isNum(ris[k]));
    if (nonFiniti.length === 0) return ris;
    return {
      metodo: ris.metodo, z: ris.z, stato: STATI.ERRORE_NUMERICO,
      motivo: 'grandezze non finite: ' + nonFiniti.join(', '), campi: nonFiniti,
      diagnostica: ris, avvisi: ris.avvisi
    };
  }

  /**
   * Iterazione a punto fisso. passo(x) → nuovo x. Criterio di arresto:
   * |x_{k+1} − x_k| < tol (assoluta). Restituisce {x, convergenza}.
   */
  function iteraPuntoFisso(x0, passo, tol, maxIter) {
    let x = x0, residuo = Infinity, k = 0;
    for (k = 1; k <= maxIter; k++) {
      const nuovo = passo(x);
      residuo = Math.abs(nuovo - x);
      x = nuovo;
      if (!isNum(x)) break;
      if (residuo < tol) return { x, convergenza: { convergente: true, numeroIterazioni: k, residuoFinale: residuo, tolleranza: tol, maxIterazioni: maxIter } };
    }
    return { x, convergenza: { convergente: false, numeroIterazioni: Math.min(k, maxIter), residuoFinale: residuo, tolleranza: tol, maxIterazioni: maxIter } };
  }

  function nonConvergente(metodo, z, convergenza, diagnostica, avvisi) {
    return {
      metodo, z, stato: STATI.NON_CONVERGENTE,
      motivo: 'iterazione non convergente dopo ' + convergenza.numeroIterazioni + ' passi (residuo ' + convergenza.residuoFinale + ')',
      convergenza, diagnostica, avvisi
    };
  }

  /**
   * Controlli comuni dei metodi puntuali. Precondizioni dichiarate:
   *  - z ≥ 0, σv > 0, 0 < σ'v ≤ σv, amax ≥ 0, 0 < Mw ≤ 10;
   *  - il punto deve essere saturo, sotto la falda di verifica: lo stabilisce il livello del
   *    profilo (z > zFalda). Il motore controlla che u = σv − σ'v sia positiva; se è nulla il
   *    calcolo viene eseguito ma l'esito è 'non_applicabile' (codice NON_SATURO) con le
   *    grandezze in `diagnostica` (vedi chiudi()).
   * Restituisce null se tutto va bene, altrimenti l'esito da restituire.
   */
  function controlliComuni(metodo, V, punto, sisma) {
    if (!V.oggetto('punto', punto) || !V.oggetto('sisma', sisma)) return nonValido(metodo, null, V.errori);
    const z = V.num('punto.z', punto.z, { min: 0 });
    const sv = V.num('punto.sv', punto.sv, { minEscluso: 0 });
    const sve = V.num('punto.sve', punto.sve, { minEscluso: 0 });
    V.num('sisma.amax', sisma.amax, { min: 0 });
    V.num('sisma.Mw', sisma.Mw, { minEscluso: 0, max: 10 });
    if (sv !== undefined && sve !== undefined && sve > sv) V.errore('punto.sve', 'INCOERENTE', 'σ\'v maggiore di σv');
    if (!V.ok()) return nonValido(metodo, z, V.errori);
    if (z > Z_MAX_APP) return nonApplicabile(metodo, z, 'OLTRE_LIMITE_APP', 'profondità oltre ' + Z_MAX_APP + ' m: fuori dal campo di calcolo di LiquiSite (limite dell\'app, non del metodo).');
    if (sisma.amax === 0) return nonApplicabile(metodo, z, 'AMAX_NULLA', 'amax = 0: azione sismica nulla, CSR = 0 e FS non definito.');
    return null;
  }

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
    if (!(isNum(p) && p > 0 && p < 1)) throw new RangeError('PhiInv: p deve essere un numero tra 0 e 1 esclusi');
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
   * strati: [{ da, a, gamma, gammaSat }] in m e kN/m³, contigui a partire da 0, senza vuoti
   *         né sovrapposizioni; gamma sopra falda, gammaSat sotto falda.
   * zFalda: profondità della falda di verifica (m dal p.c., ≥ 0). Pressione idrostatica.
   *         Falda sopra il piano campagna: condizione non supportata (input_non_valido).
   * Esito: { stato: 'calcolato', sv, u, sve } oppure { stato: 'input_non_valido', errori }.
   */
  function tensioni(strati, zFalda, z) {
    const V = new Validatore();
    const zz = V.num('z', z, { min: 0 });
    const zw = V.num('zFalda', zFalda);
    if (zw !== undefined && zw < 0) V.errore('zFalda', 'FALDA_SOPRA_PC', 'falda sopra il piano campagna: condizione non supportata da LiquiSite');
    if (!Array.isArray(strati) || strati.length === 0) {
      V.errore('strati', 'MANCANTE', 'nessuno strato');
      return { stato: STATI.INPUT_NON_VALIDO, errori: V.errori };
    }
    strati.forEach((s, i) => {
      if (!V.oggetto('strati[' + i + ']', s)) return;
      const da = V.num('strati[' + i + '].da', s.da, { min: 0 });
      const a = V.num('strati[' + i + '].a', s.a);
      if (da !== undefined && a !== undefined && !(a > da)) V.errore('strati[' + i + ']', 'SPESSORE_NON_POSITIVO', 'a deve essere maggiore di da');
      V.num('strati[' + i + '].gamma', s.gamma, { minEscluso: 0 });
      V.num('strati[' + i + '].gammaSat', s.gammaSat, { minEscluso: 0 });
    });
    if (!V.ok()) return { stato: STATI.INPUT_NON_VALIDO, errori: V.errori };

    const ordinati = strati.slice().sort((p, q) => p.da - q.da);
    let zc = 0;
    for (let i = 0; i < ordinati.length; i++) {
      const s = ordinati[i];
      if (s.da > zc + 1e-6) V.errore('strati', 'VUOTO', 'vuoto tra ' + zc + ' e ' + s.da + ' m');
      else if (s.da < zc - 1e-6) V.errore('strati', 'SOVRAPPOSIZIONE', 'strati sovrapposti tra ' + s.da + ' e ' + zc + ' m');
      zc = Math.max(zc, s.a);
    }
    if (zz !== undefined && zc < zz - 1e-9) V.errore('strati', 'COPERTURA_INSUFFICIENTE', 'gli strati arrivano a ' + zc + ' m, richiesto ' + zz + ' m');
    if (!V.ok()) return { stato: STATI.INPUT_NON_VALIDO, errori: V.errori };

    let sv = 0;
    for (const s of ordinati) {
      const fine = Math.min(s.a, zz);
      if (fine > s.da) {
        // parte sopra falda con gamma, parte sotto falda con gammaSat
        const sopra = Math.max(0, Math.min(fine, zw) - s.da);
        const sotto = (fine - s.da) - sopra;
        sv += sopra * s.gamma + sotto * s.gammaSat;
      }
      if (s.a >= zz) break;
    }
    const u = Math.max(0, zz - zw) * GAMMA_W;
    const sve = sv - u;
    if (zz > 0 && !(sve > 0)) {
      return { stato: STATI.INPUT_NON_VALIDO, errori: [{ campo: 'strati', codice: 'SVE_NON_POSITIVA', motivo: 'tensione efficace non positiva a ' + zz + ' m: pesi di volume incoerenti con la falda' }] };
    }
    return { stato: STATI.CALCOLATO, sv, u, sve };
  }

  // ---------------------------------------------------------------------------
  // Avvisi di profondità: limite di LiquiSite e raccomandazioni delle singole fonti
  // ---------------------------------------------------------------------------

  /** Avvisi per Boulanger & Idriss (2014). */
  function avvisiProfonditaBI(z) {
    const a = [];
    if (z > 10) a.push(avviso('RD_INCERTO_BI', 'fuori_campo',
      'Profondità oltre circa 10 m: l\'incertezza di rd diventa grande e la banca dati arriva a circa 10–12 m; valutare l\'analisi di risposta sismica locale [B&I 2014, pag. 9].'));
    return a;
  }

  /** Avvisi comuni di profondità (compatibilità con la versione 0.2.0): solo il limite dell'app. */
  function avvisiProfondita(z) {
    if (!isNum(z)) return [avviso('Z_NON_VALIDA', 'limite_app', 'Profondità non valida.')];
    return z > Z_MAX_APP ? [avviso('OLTRE_LIMITE_APP', 'limite_app', 'Profondità oltre ' + Z_MAX_APP + ' m: fuori dal campo di calcolo di LiquiSite.')] : [];
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

  /** Coefficienti dell'attrezzatura SPT comuni ai metodi; restituisce le assunzioni adottate. */
  function leggiVerticaleSpt(V, verticale, avvisi) {
    if (!V.oggetto('verticale', verticale)) return null;
    const CE = V.num('verticale.CE', verticale.CE, { minEscluso: 0 });
    let CB = V.num('verticale.CB', verticale.CB, { minEscluso: 0, facoltativo: true });
    let CS = V.num('verticale.CS', verticale.CS, { minEscluso: 0, facoltativo: true });
    let sporgenza = V.num('verticale.sporgenza', verticale.sporgenza, { min: 0, facoltativo: true });
    if (CB === undefined && verticale.CB === undefined) { CB = 1; avvisi.push(avviso('CB_PREDEFINITO', 'assunzione', 'CB non indicato: si assume 1 (foro di diametro standard).')); }
    if (CS === undefined && verticale.CS === undefined) { CS = 1; avvisi.push(avviso('CS_PREDEFINITO', 'assunzione', 'CS non indicato: si assume 1 (campionatore standard).')); }
    if (sporgenza === undefined && verticale.sporgenza === undefined) { sporgenza = 0; avvisi.push(avviso('SPORGENZA_PREDEFINITA', 'assunzione', 'Sporgenza delle aste non indicata: si assume 0 m.')); }
    return { CE, CB, CS, sporgenza };
  }

  /**
   * Boulanger & Idriss (2014) da SPT, deterministico.
   * punto: { z, N, FC, sv, sve }  sisma: { amax, Mw }
   * verticale: { CE, CB (default 1), CS (default 1), sporgenza (m, default 0) }
   * opz: { maxIterazioni (default 100) }
   * La relazione probabilistica da SPT (Boulanger & Idriss 2012a) non è inclusa: PL = null.
   */
  function bi2014Spt(punto, sisma, verticale, opz) {
    const metodo = 'bi2014Spt';
    if (opz === undefined || opz === null) opz = {};
    const V = new Validatore();
    const avvisi = [];
    const pre = controlliComuni(metodo, V, punto, sisma);
    if (pre && pre.stato === STATI.INPUT_NON_VALIDO) return pre;
    V.num('punto.N', punto.N, { min: 0 });
    V.num('punto.FC', punto.FC, { min: 0, max: 100 });
    const vert = leggiVerticaleSpt(V, verticale, avvisi);
    const maxIter = V.num('opz.maxIterazioni', opz.maxIterazioni, { min: 1, facoltativo: true }) ?? 100;
    if (!V.ok()) return nonValido(metodo, punto.z, V.errori);
    if (pre) return pre;

    const { z, N, FC, sv, sve } = punto;
    const { amax, Mw } = sisma;
    const { CE, CB, CS } = vert;
    avvisi.push(...avvisiProfonditaBI(z));

    // N60 e (N1)60 [I&B 2010, Eq. 2.3, pag. 5]
    const lunghezzaAste = vert.sporgenza + z;
    const CR = crIdrissBoulanger2010(lunghezzaAste);
    if (lunghezzaAste > 30) avvisi.push(avviso('ASTE_OLTRE_30M', 'fuori_campo', 'Aste oltre 30 m: CR = 1,00 fuori dalla tabella di I&B 2010 (pag. 9).'));
    const N60 = N * CE * CB * CR * CS;

    // Δ(N1)60 [B&I 2014, Eq. 2.23, pag. 15]
    const dN = Math.exp(1.63 + 9.7 / (FC + 0.01) - Math.pow(15.7 / (FC + 0.01), 2));

    // CN iterativo [B&I 2014, Eq. 2.15a e 2.15c, pag. 10]; (N1)60cs limitato a ≤ 46 nella m
    let CN = 1, N160 = N60;
    const passo = (N160cs) => {
      const m = 0.784 - 0.0768 * Math.sqrt(Math.min(Math.max(N160cs, 0), 46));
      CN = Math.min(Math.pow(BI.PA / sve, m), 1.7);
      N160 = CN * N60;
      return N160 + dN;
    };
    const it = iteraPuntoFisso(N60 + dN, passo, 1e-9, maxIter);
    const N160cs = it.x;
    if (!it.convergenza.convergente) return nonConvergente(metodo, z, it.convergenza, { N60, CN, N160, N160cs }, avvisi);
    if (CN >= 1.7 - 1e-12) avvisi.push(avviso('CN_LIMITATO', 'nota', 'CN limitato a 1,7 (σ\'v basso) [B&I 2014, pag. 10].'));

    const rd = BI.rd(z, Mw);
    const CSR = BI.csr(amax, sv, sve, rd);

    // Cσ [B&I 2014, Eq. 2.16c, pag. 11]; (N1)60cs ≤ 37 equivale a Cσ ≤ 0,3
    const Csigma = Math.min(1 / (18.9 - 2.55 * Math.sqrt(Math.min(Math.max(N160cs, 0), 37))), 0.3);
    const Ksigma = BI.ksigma(Csigma, sve);

    // MSFmax e MSF [B&I 2014, Eq. 2.21 e 2.18, pag. 14]
    const MSFmax = Math.min(1.09 + Math.pow(N160cs / 31.5, 2), 2.2);
    const MSF = BI.msf(Mw, MSFmax);

    // CRR per M = 7,5 e σ'v = 1 atm [B&I 2014, Eq. 2.25, pag. 17]
    const n = N160cs;
    const CRR75 = Math.exp(n / 14.1 + Math.pow(n / 126, 2) - Math.pow(n / 23.6, 3) + Math.pow(n / 25.4, 4) - 2.8);
    // CRR al sito [B&I 2014, Eq. 2.7, pag. 6]
    const CRR = CRR75 * MSF * Ksigma;
    const FS = CRR / CSR;

    return chiudi({
      metodo, z, stato: STATI.CALCOLATO,
      lunghezzaAste, CR, CE, CB, CS, N60, CN, N160, dN160: dN, N160cs,
      rd, CSR, Csigma, Ksigma, MSFmax, MSF, CSR75: CSR / (MSF * Ksigma),
      CRR75, CRR, FS, PL: null, convergenza: it.convergenza, avvisi
    }, ['N60', 'CN', 'N160', 'N160cs', 'rd', 'CSR', 'Ksigma', 'MSF', 'CRR75', 'CRR', 'FS'], punto);
  }

  /**
   * Indice di comportamento Ic con la regola per l'esponente n di Robertson & Wride (1998),
   * pag. 449 e Fig. 12. Q e F secondo [B&I 2014, Eq. 2.26–2.28, pag. 19].
   * qt in kPa. Restituisce null se qt − σv o fs non sono positivi.
   */
  function icRobertsonWride(qt, fs, sv, sve, PA) {
    if (![qt, fs, sv, sve, PA].every(isNum) || !(sve > 0) || !(PA > 0)) return null;
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

  /** Tipi di prova penetrometrica statica supportati. */
  const TIPI_CPT = ['CPTE', 'CPTU'];

  /**
   * Boulanger & Idriss (2014) da prova penetrometrica statica a punta elettrica.
   * punto: { z, qc (MPa), fs (kPa), u2 (kPa), sv, sve, FC (facoltativo, misurato) }
   * opz: {
   *   tipo: 'CPTE' (punta elettrica senza misura di u) | 'CPTU' (piezocono) — obbligatorio;
   *   ar: rapporto d'area (solo CPTU; se assente si usa 0,8 e lo si segnala);
   *   IcSoglia (default 2,6), CFC (default 0), maxIterazioni (default 200)
   * }
   * CPTE: qt = qc (nessuna misura di u2; u2 non va fornita).
   * CPTU: u2 obbligatoria; se manca → 'dati_insufficienti' (non si assume u2 = 0).
   * CPT a punta meccanica: non supportata (sottostima la suscettibilità; volume CNR-CentroMS
   * 2024, pag. 27).
   */
  function bi2014Cpt(punto, sisma, opz) {
    const metodo = 'bi2014Cpt';
    const V = new Validatore();
    const avvisi = [];
    const assunzioni = [];
    const pre = controlliComuni(metodo, V, punto, sisma);
    if (pre && pre.stato === STATI.INPUT_NON_VALIDO) return pre;
    if (opz === null || typeof opz !== 'object') { V.errore('opz', 'MANCANTE', 'atteso un oggetto con almeno opz.tipo'); return nonValido(metodo, punto.z, V.errori); }
    const tipo = V.scelta('opz.tipo', opz.tipo, TIPI_CPT);
    V.num('punto.qc', punto.qc, { minEscluso: 0 });
    V.num('punto.fs', punto.fs, { min: 0 });
    if (punto.FC !== undefined) V.num('punto.FC', punto.FC, { min: 0, max: 100 });
    const IcSoglia = V.num('opz.IcSoglia', opz.IcSoglia, { minEscluso: 0, facoltativo: true }) ?? 2.6;
    const CFC = V.num('opz.CFC', opz.CFC, { facoltativo: true }) ?? 0;
    const maxIter = V.num('opz.maxIterazioni', opz.maxIterazioni, { min: 1, facoltativo: true }) ?? 200;
    let ar = null;
    if (tipo === 'CPTE') {
      if (punto.u2 !== undefined) V.errore('punto.u2', 'INCOERENTE', 'u2 fornita per una prova CPTE: indicare tipo CPTU');
      if (opz.ar !== undefined) V.errore('opz.ar', 'INCOERENTE', 'ar si usa solo con tipo CPTU');
    } else if (tipo === 'CPTU') {
      if (punto.u2 !== undefined) V.num('punto.u2', punto.u2);
      if (opz.ar !== undefined) ar = V.num('opz.ar', opz.ar, { minEscluso: 0, max: 1 });
    }
    if (!V.ok()) return nonValido(metodo, punto.z, V.errori);
    if (pre) return pre;

    const { z, qc, fs, sv, sve } = punto;
    const { amax, Mw } = sisma;
    const PA = BI.PA;
    avvisi.push(...avvisiProfonditaBI(z));
    if (IcSoglia < 2.4 || IcSoglia > 2.8) avvisi.push(avviso('IC_SOGLIA_INSOLITA', 'fuori_campo', 'Soglia di Ic = ' + IcSoglia + ' fuori dai valori 2,4–2,8 indicati per l\'analisi di sensibilità [B&I 2014, pag. 99].'));

    // qt [B&I 2014, Eq. 2.3, pag. 6]
    let qt;
    if (tipo === 'CPTE') {
      qt = qc * 1000;
      assunzioni.push({ codice: 'QT_UGUALE_QC', descrizione: 'CPTE senza misura di u2: qt = qc.' });
    } else {
      if (punto.u2 === undefined) return datiInsufficienti(metodo, z, 'U2_MANCANTE', 'CPTU senza u2 al punto: dato mancante, non si assume u2 = 0.');
      if (ar === null) {
        ar = 0.8;
        assunzioni.push({ codice: 'AR_PREDEFINITO', descrizione: 'Rapporto d\'area non indicato: ar = 0,8 (valore predefinito di LiquiSite).' });
        avvisi.push(avviso('AR_PREDEFINITO', 'assunzione', 'Rapporto d\'area non indicato: si usa ar = 0,8 (valore predefinito di LiquiSite).'));
      }
      qt = qc * 1000 + (1 - ar) * punto.u2;
    }

    const cls = icRobertsonWride(qt, fs, sv, sve, PA);
    if (!cls) return datiInsufficienti(metodo, z, 'IC_NON_CALCOLABILE', 'Ic non calcolabile: qt − σv o fs non positivi.', { qt, tipo, ar, assunzioni });

    let FC, origineFC;
    if (punto.FC !== undefined) { FC = punto.FC; origineFC = 'misurato'; }
    else {
      // [B&I 2014, Eq. 2.30, pag. 21]
      FC = clamp(80 * (cls.Ic + CFC) - 137, 0, 100);
      origineFC = 'stimato da Ic (C_FC = ' + CFC + ')';
    }

    if (cls.Ic > IcSoglia) {
      return nonApplicabile(metodo, z, 'IC_OLTRE_SOGLIA',
        'Ic = ' + cls.Ic.toFixed(2) + ' > soglia ' + IcSoglia + ': comportamento di tipo argilloso, il metodo non si applica a questo punto [B&I 2014, pag. 21 e 99]. ' +
        'Non è un\'esclusione ai sensi del §7.11.3.4.2 delle NTC 2018 e non dimostra l\'assenza di problemi ciclici: il comportamento dei terreni fini va valutato con altri criteri.',
        { tipo, qt, ar, ...cls, FC, origineFC, IcSoglia, assunzioni });
    }

    // qc1N e qc1Ncs iterativi [B&I 2014, Eq. 2.4, 2.10, 2.15a–b, 2.22]
    const qcN = qt / PA;
    let qc1N = qcN, CN = 1, dq = 0;
    const passo = (qc1Ncs) => {
      const m = 1.338 - 0.249 * Math.pow(clamp(qc1Ncs, 21, 254), 0.264);
      CN = Math.min(Math.pow(PA / sve, m), 1.7);
      qc1N = CN * qcN;
      dq = (11.9 + qc1N / 14.6) * Math.exp(1.63 - 9.7 / (FC + 2) - Math.pow(15.7 / (FC + 2), 2));
      return qc1N + dq;
    };
    const it = iteraPuntoFisso(qcN, passo, 1e-9, maxIter);
    const qc1Ncs = it.x;
    if (!it.convergenza.convergente) return nonConvergente(metodo, z, it.convergenza, { qt, qcN, CN, qc1N, qc1Ncs }, avvisi);
    if (CN >= 1.7 - 1e-12) avvisi.push(avviso('CN_LIMITATO', 'nota', 'CN limitato a 1,7 (σ\'v basso) [B&I 2014, pag. 10].'));

    const rd = BI.rd(z, Mw);
    const CSR = BI.csr(amax, sv, sve, rd);
    // Cσ [B&I 2014, Eq. 2.16b, pag. 11]; qc1Ncs ≤ 211 equivale a Cσ ≤ 0,3
    const Csigma = Math.min(1 / (37.3 - 8.27 * Math.pow(Math.min(qc1Ncs, 211), 0.264)), 0.3);
    const Ksigma = BI.ksigma(Csigma, sve);
    // [B&I 2014, Eq. 2.20 e 2.18, pag. 14]
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

    return chiudi({
      metodo, z, stato: STATI.CALCOLATO, tipo, ar,
      qt, ...cls, FC, origineFC, IcSoglia, qcN, CN, qc1N, dqc1N: dq, qc1Ncs,
      rd, CSR, Csigma, Ksigma, MSFmax, MSF, CSR75, CRR75, CRR, FS, PL,
      convergenza: it.convergenza, assunzioni, avvisi
    }, ['qt', 'Ic', 'qc1N', 'qc1Ncs', 'rd', 'CSR', 'Ksigma', 'MSF', 'CRR75', 'CRR', 'FS', 'PL'], punto);
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
   * d > 0 (lunghezza delle aste in m).
   */
  function crCetin(d) {
    if (!(isNum(d) && d > 0)) throw new RangeError('crCetin: d deve essere un numero positivo');
    return d <= 10 ? 0.48 + 0.225 * Math.log(d) : 1.0;
  }

  /**
   * punto: { z, N, FC, sv, sve }  sisma: { amax, Mw }
   * verticale: { CE, CB (default 1), sporgenza (m, default 0), senzaRivestimento (booleano, default false), CS (facoltativo) }
   * opz: { Vs12 (m/s, obbligatorio), maxIterazioni (default 50) }
   */
  function cetin2018Spt(punto, sisma, verticale, opz) {
    const metodo = 'cetin2018Spt';
    const C = CETIN;
    const V = new Validatore();
    const avvisi = [];
    const pre = controlliComuni(metodo, V, punto, sisma);
    if (pre && pre.stato === STATI.INPUT_NON_VALIDO) return pre;
    V.num('punto.N', punto.N, { min: 0 });
    V.num('punto.FC', punto.FC, { min: 0, max: 100 });
    const vert = leggiVerticaleSpt(V, verticale, []); // le assunzioni si registrano dopo la validazione
    const senzaRiv = vert ? V.bool('verticale.senzaRivestimento', verticale.senzaRivestimento, { facoltativo: true }) : undefined;
    let Vs12;
    if (opz === null || typeof opz !== 'object') V.errore('opz', 'MANCANTE', 'atteso un oggetto con opz.Vs12');
    else Vs12 = V.num('opz.Vs12', opz.Vs12, { minEscluso: 0 });
    const maxIter = (opz && typeof opz === 'object') ? (V.num('opz.maxIterazioni', opz.maxIterazioni, { min: 1, facoltativo: true }) ?? 50) : 50;
    if (!V.ok()) return nonValido(metodo, punto.z, V.errori);
    if (pre) return pre;

    const { z, N, sv, sve } = punto;
    const { amax, Mw } = sisma;
    if (verticale.CB === undefined) avvisi.push(avviso('CB_PREDEFINITO', 'assunzione', 'CB non indicato: si assume 1 (foro di diametro standard).'));
    if (verticale.sporgenza === undefined) avvisi.push(avviso('SPORGENZA_PREDEFINITA', 'assunzione', 'Sporgenza delle aste non indicata: si assume 0 m.'));
    if (verticale.CS === undefined && senzaRiv !== true) avvisi.push(avviso('CS_PREDEFINITO', 'assunzione', 'CS non indicato: si assume 1 (campionatore standard).'));
    if (Vs12 > 230) { avvisi.push(avviso('VS12_LIMITATA', 'fuori_campo', 'V*s,12 = ' + Vs12 + ' m/s > 230: si usa 230 m/s come raccomandato dagli autori [Cetin 2018 SDEE, pag. 703–704].')); Vs12 = 230; }
    if (Vs12 < 90) avvisi.push(avviso('VS12_BASSA', 'fuori_campo', 'V*s,12 < 90 m/s: nessun caso della banca dati [Cetin 2018 SDEE, pag. 703–704].'));
    if (Mw < 5.5 || Mw > 8.4) avvisi.push(avviso('MW_FUORI_CAMPO', 'fuori_campo', 'Mw fuori dall\'intervallo 5,5–8,4 di KMw [Cetin 2018 SDEE, Eq. 15].'));

    let FC = punto.FC;
    if (FC < 5 || FC > 35) { avvisi.push(avviso('FC_LIMITATO', 'fuori_campo', 'FC = ' + FC + ' % limitato all\'intervallo 5–35 % [Cetin 2018, pag. 705].')); FC = clamp(FC, 5, 35); }

    const { CE, CB } = vert;
    const d = vert.sporgenza + z;
    if (!(d > 0)) return nonValido(metodo, z, [{ campo: 'punto.z', codice: 'ASTE_NULLE', motivo: 'lunghezza delle aste (sporgenza + z) nulla: CR non definito' }]);
    const CR = crCetin(d);
    // CN [MethodsX Tab. 2]: (Pa/σ'v)^0,5 ≤ 2,0
    const CN = Math.min(Math.sqrt(C.PA / sve), 2.0);
    // N1,60 [MethodsX Eq. 6]; CS = 1 + N1,60/100 tra 1,10 e 1,30 se il campionatore è senza rivestimento (T-2)
    let CS = verticale.CS !== undefined ? verticale.CS : 1;
    let N160 = N * CN * CR * CB * CE * CS;
    let convergenza = null;
    if (senzaRiv === true) {
      const it = iteraPuntoFisso(N160, (x) => { CS = clamp(1 + x / 100, 1.10, 1.30); return N * CN * CR * CB * CE * CS; }, 1e-9, maxIter);
      convergenza = it.convergenza;
      N160 = it.x;
      if (!convergenza.convergente) return nonConvergente(metodo, z, convergenza, { CN, CR, CS, N160 }, avvisi);
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
    if (sveAtm < 0.25 || sveAtm > 1.8) avvisi.push(avviso('SVE_FUORI_CAMPO', 'fuori_campo', 'σ\'v = ' + sveAtm.toFixed(2) + ' atm fuori da 0,25–1,8 atm per Kσ [Cetin 2018, pag. 706].'));
    if (CSRrif > 0.6) avvisi.push(avviso('CSR_RIF_ALTO', 'fuori_campo', 'CSR di riferimento > 0,6 [Cetin 2018 SDEE, Eq. 13].'));

    return chiudi({
      metodo, z, stato: STATI.CALCOLATO,
      lunghezzaAste: d, CR, CN, CS, N160, dN160: dN, N160cs: N160 + dN, FCusato: FC,
      Vs12, rd, CSR, Ksigma, KMw, CSRrif, CRR, FS, PL, convergenza, avvisi
    }, ['CR', 'CN', 'N160', 'rd', 'CSR', 'CRR', 'FS', 'PL'], punto);
  }

  // ---------------------------------------------------------------------------
  // KAYEN et al. (2013) da Vs — solo confronto
  // ---------------------------------------------------------------------------
  /**
   * punto: { z, Vs, FC (facoltativo: se assente 0, segnalato), sv, sve }  sisma: { amax, Mw }  opz: { Vs12 }
   * Segno di Φ⁻¹(PL) nell'Eq. 14: la versione editoriale stampa «−», l'inversione
   * dell'Eq. 13 dà «+» ed è coerente con la Fig. 6 (vedi docs/metodo.md).
   * Tensione efficace: le Eq. 13–14 contengono sempre il termine −0,0099·ln(σ'v0); gli autori
   * fissano Kσ = 1 solo per presentare CSR* (Eq. 15) e dichiarano la banca dati non adatta a
   * valutare Kσ oltre 200 kPa (siti entro 22 m e 180 kPa) [Kayen 2013, pag. 413–414].
   */
  function kayen2013Vs(punto, sisma, opz) {
    const metodo = 'kayen2013Vs';
    const PA = 100; // kPa [Kayen 2013, Eq. 2]
    const V = new Validatore();
    const avvisi = [];
    const pre = controlliComuni(metodo, V, punto, sisma);
    if (pre && pre.stato === STATI.INPUT_NON_VALIDO) return pre;
    V.num('punto.Vs', punto.Vs, { minEscluso: 0 });
    if (punto.FC !== undefined) V.num('punto.FC', punto.FC, { min: 0, max: 100 });
    let Vs12;
    if (opz === null || typeof opz !== 'object') V.errore('opz', 'MANCANTE', 'atteso un oggetto con opz.Vs12');
    else Vs12 = V.num('opz.Vs12', opz.Vs12, { minEscluso: 0 });
    if (!V.ok()) return nonValido(metodo, punto.z, V.errori);
    if (pre) return pre;

    const { z, Vs, sv, sve } = punto;
    const { amax, Mw } = sisma;
    let FC = punto.FC;
    if (FC === undefined) {
      FC = 0;
      avvisi.push(avviso('FC_ASSENTE', 'assunzione', 'FC non indicato: si usa FC = 0 (nessuna correzione per i fini).'));
    }
    if (Mw < 5.5 || Mw > 9.0) avvisi.push(avviso('MW_FUORI_CAMPO', 'fuori_campo', 'Mw fuori dall\'intervallo 5,5–9,0 della DWF [Kayen 2013, Eq. 17].'));
    if (sve > 180) avvisi.push(avviso('SVE_OLTRE_BANCA_DATI', 'fuori_campo',
      'σ\'v0 = ' + sve.toFixed(1) + ' kPa > 180 kPa: oltre i siti della banca dati (entro 22 m e 180 kPa); gli autori non la ritengono adatta a valutare Kσ oltre 200 kPa. ' +
      'Le Eq. 13–14 si applicano senza modifiche; Kσ = 1 riguarda solo CSR* dell\'Eq. 15 [Kayen 2013, pag. 413–414].'));

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

    return chiudi({ metodo, z, stato: STATI.CALCOLATO, CVs, Vs1, Vs12, FCusato: FC, rd, CSR, CRR15, FS, PL, DWF, avvisi },
      ['Vs1', 'rd', 'CSR', 'CRR15', 'FS', 'PL'], punto);
  }

  // ---------------------------------------------------------------------------
  // ESCLUSIONE DELLA VERIFICA — NTC 2018 §7.11.3.4.2
  // Basta un criterio soddisfatto. L'esito si esprime come «verifica omessa ai sensi del
  // §7.11.3.4.2», mai come «terreno non liquefacibile».
  // Esito comune: { criterio, stato: 'valutato' | 'input_non_valido' | 'dati_insufficienti',
  //                 soddisfatto: true | false | null, errori? }.
  // Con stato diverso da 'valutato', soddisfatto è sempre null.
  // ---------------------------------------------------------------------------

  const VALUTATO = 'valutato';
  function criterioNonValido(criterio, errori) {
    return { criterio, stato: STATI.INPUT_NON_VALIDO, soddisfatto: null, errori };
  }

  /** Criterio 1: amax attesa al p.c. in campo libero < 0,1 g. amax: numero finito ≥ 0 (g). */
  function criterio1(amax) {
    const V = new Validatore();
    V.num('amax', amax, { min: 0 });
    if (!V.ok()) return criterioNonValido(1, V.errori);
    const soddisfatto = amax < 0.1;
    return {
      criterio: 1, stato: VALUTATO, soddisfatto, valore: amax, soglia: 0.1, margine: 0.1 - amax,
      nota: soddisfatto ? null : 'amax ≥ 0,1 g: approfondire le indagini per verificare gli altri tre criteri (Circolare 7/2019, C7.11.3.4).'
    };
  }

  /**
   * Criterio 2: falda media stagionale > 15 m, p.c. sub-orizzontale e fondazioni superficiali.
   * zFalda: profondità della falda media stagionale in m dal piano campagna, positiva verso il
   * basso (≥ 0; falda sopra il p.c. non supportata). Gli altri due argomenti: booleani veri.
   */
  function criterio2(zFalda, pcSubOrizzontale, fondazioniSuperficiali) {
    const V = new Validatore();
    V.num('zFalda', zFalda, { min: 0 });
    V.bool('pcSubOrizzontale', pcSubOrizzontale);
    V.bool('fondazioniSuperficiali', fondazioniSuperficiali);
    if (!V.ok()) return criterioNonValido(2, V.errori);
    const soddisfatto = zFalda > 15 && pcSubOrizzontale && fondazioniSuperficiali;
    return { criterio: 2, stato: VALUTATO, soddisfatto, valore: zFalda, soglia: 15, margine: zFalda - 15,
      condizioni: { falda: zFalda > 15, pcSubOrizzontale, fondazioniSuperficiali } };
  }

  /** Grandezza e soglia del criterio 3 per tipo di prova. */
  const SOGLIE_CRITERIO3 = Object.freeze({
    SPT: { grandezza: '(N1)60', soglia: 30 },
    CPTE: { grandezza: 'qc1N', soglia: 180 },
    CPTU: { grandezza: 'qc1N', soglia: 180 }
  });

  /**
   * Criterio 3: depositi di sabbie pulite con (N1)60 > 30 oppure qc1N > 180.
   * tipo: 'SPT' | 'CPTE' | 'CPTU' (altri tipi rifiutati).
   * valore: (N1)60 o qc1N calcolato con la normalizzazione del metodo principale
   * (decisione del 10/11/2026); il nome del metodo va riportato in stampa.
   * sabbiaPulita: booleano.
   * L'esito riguarda il singolo dato esaminato: da solo non dimostra l'esclusione dell'intero
   * deposito, che richiede il giudizio sull'insieme dei dati.
   * margineRelativo < 0,10 → avviso di robustezza (scelta di LiquiSite, non normativa).
   */
  function criterio3(tipo, valore, sabbiaPulita) {
    const V = new Validatore();
    V.scelta('tipo', tipo, Object.keys(SOGLIE_CRITERIO3));
    V.num('valore', valore, { min: 0 });
    V.bool('sabbiaPulita', sabbiaPulita);
    if (!V.ok()) return criterioNonValido(3, V.errori);
    const { grandezza, soglia } = SOGLIE_CRITERIO3[tipo];
    const soddisfatto = sabbiaPulita && valore > soglia;
    const margineRelativo = (valore - soglia) / soglia;
    const avvisi = [];
    if (!sabbiaPulita) avvisi.push(avviso('NON_SABBIA_PULITA', 'nota', 'Il criterio vale per depositi di sabbie pulite.'));
    if (soddisfatto && margineRelativo < 0.10) avvisi.push(avviso('MARGINE_DEBOLE', 'limite_app', 'Valore di poco superiore alla soglia (meno del 10 %): condizione debole.'));
    return { criterio: 3, stato: VALUTATO, tipo, grandezza, soddisfatto, valore, soglia, margineRelativo, avvisi,
      ambito: 'esito riferito al dato esaminato, non all\'intero deposito' };
  }

  /** Interpolazione lineare di y su x non decrescente; null fuori intervallo. */
  function interp(xs, ys, x) {
    for (let i = 0; i < xs.length - 1; i++) {
      if (xs[i] <= x && x <= xs[i + 1] && xs[i + 1] > xs[i]) {
        return ys[i] + (ys[i + 1] - ys[i]) * (x - xs[i]) / (xs[i + 1] - xs[i]);
      }
    }
    if (xs.length > 0 && xs.includes(x)) return ys[xs.indexOf(x)];
    return null;
  }

  /**
   * Valida una curva granulometrica [[d mm, p %], …].
   * Regole: almeno 2 punti; d numero finito > 0; p numero finito tra 0 e 100; nessun diametro
   * ripetuto; passante non decrescente al crescere di d. Nessun dato viene scartato in silenzio.
   * Restituisce { V, punti } con i punti ordinati per d crescente.
   */
  function validaCurva(curva, campo = 'curva') {
    const V = new Validatore();
    if (!Array.isArray(curva) || curva.length < 2) {
      V.errore(campo, 'PUNTI_INSUFFICIENTI', 'servono almeno 2 punti [d, p]');
      return { V, punti: [] };
    }
    curva.forEach((pt, i) => {
      if (!Array.isArray(pt) || pt.length !== 2) { V.errore(campo + '[' + i + ']', 'FORMATO', 'atteso [d mm, p %]'); return; }
      V.num(campo + '[' + i + '].d', pt[0], { minEscluso: 0 });
      V.num(campo + '[' + i + '].p', pt[1], { min: 0, max: 100 });
    });
    if (!V.ok()) return { V, punti: [] };
    const punti = curva.map(([d, p]) => ({ d, p })).sort((a, b) => a.d - b.d);
    for (let i = 1; i < punti.length; i++) {
      if (punti[i].d === punti[i - 1].d) V.errore(campo, 'DIAMETRO_DUPLICATO', 'diametro ripetuto: ' + punti[i].d + ' mm');
      else if (punti[i].p < punti[i - 1].p) V.errore(campo, 'CURVA_NON_MONOTONA', 'passante decrescente tra ' + punti[i - 1].d + ' e ' + punti[i].d + ' mm');
    }
    return { V, punti };
  }

  /** log10(d) in funzione del passante, da punti validati e ordinati per d. */
  function curvaLogD(punti) {
    return { ps: punti.map(x => x.p), ls: punti.map(x => Math.log10(x.d)) };
  }

  /** Coefficiente di uniformità Uc = D60/D10 (interpolazione su log d); null se non determinabile. */
  function coeffUniformita(curva) {
    const { V, punti } = validaCurva(curva);
    if (!V.ok()) return { stato: STATI.INPUT_NON_VALIDO, errori: V.errori, Uc: null, D10: null, D60: null };
    const c = curvaLogD(punti);
    const l10 = interp(c.ps, c.ls, 10), l60 = interp(c.ps, c.ls, 60);
    if (l10 == null || l60 == null) return { stato: STATI.DATI_INSUFFICIENTI, Uc: null, D10: l10 == null ? null : 10 ** l10, D60: l60 == null ? null : 10 ** l60 };
    return { stato: STATI.CALCOLATO, Uc: 10 ** (l60 - l10), D10: 10 ** l10, D60: 10 ** l60 };
  }

  const TOLLERANZA_FUSI = 0.03; // decadi di d: ≈ 3 pixel della figura ufficiale (spessore della curva)
  const P_FUSO_MIN = 2, P_FUSO_MAX = 98; // passanti digitalizzati dei fusi
  /**
   * Copertura minima della curva per proporre «soddisfatto» (esclusione): la curva deve
   * coprire almeno il passante dal 10 % al 90 %. Politica prudenziale di LiquiSite, non
   * requisito normativo: sotto questa copertura la distribuzione non è abbastanza nota.
   */
  const COPERTURA_MINIMA = Object.freeze({ pDa: 10, pA: 90 });

  /**
   * Posizione di una curva granulometrica rispetto a un fuso.
   * fuso: { sinistra: [[p, d], …], destra: [[p, d], …] } (dati/fusi-ntc2018.json).
   * Il confronto è esatto sul tratto comune di passante: nel piano (p, log d) curva e limiti
   * sono spezzate, quindi si valutano tutti i vertici della curva e tutti i vertici dei limiti
   * che cadono nel tratto (le differenze sono lineari tra due punti consecutivi). Un passaggio
   * da «fuori lato fine» a «fuori lato grosso» indica un attraversamento del fuso.
   * Esito: 'interna' (tutti i punti dentro oltre la tolleranza), 'esterna' (tutti fuori oltre la
   * tolleranza e dallo stesso lato), 'non confrontabile', altrimenti 'tocca'.
   */
  function confrontaFuso(curva, fuso, tol = TOLLERANZA_FUSI) {
    const { V, punti } = validaCurva(curva);
    if (!V.ok()) return { esito: 'input non valido', stato: STATI.INPUT_NON_VALIDO, errori: V.errori };
    const sx = { ps: fuso.sinistra.map(x => x[0]), ls: fuso.sinistra.map(x => Math.log10(x[1])) };
    const dx = { ps: fuso.destra.map(x => x[0]), ls: fuso.destra.map(x => Math.log10(x[1])) };
    const pLo = Math.max(P_FUSO_MIN, sx.ps[0], dx.ps[0]);
    const pHi = Math.min(P_FUSO_MAX, sx.ps[sx.ps.length - 1], dx.ps[dx.ps.length - 1]);
    const vertFuso = Array.from(new Set([...sx.ps, ...dx.ps])).sort((a, b) => a - b);

    // punti di valutazione lungo la curva, nel tratto [pLo, pHi]
    const valutazioni = [];
    for (let i = 0; i < punti.length - 1; i++) {
      const A = punti[i], B = punti[i + 1];
      const la = Math.log10(A.d), lb = Math.log10(B.d);
      if (B.p < pLo || A.p > pHi) continue;
      if (A.p === B.p) { valutazioni.push({ p: A.p, l: la }, { p: B.p, l: lb }); continue; }
      const p1 = Math.max(A.p, pLo), p2 = Math.min(B.p, pHi);
      const lin = (p) => la + (lb - la) * (p - A.p) / (B.p - A.p);
      valutazioni.push({ p: p1, l: lin(p1) });
      for (const pv of vertFuso) if (pv > p1 && pv < p2) valutazioni.push({ p: pv, l: lin(pv) });
      valutazioni.push({ p: p2, l: lin(p2) });
    }
    let dentro = 0, fuori = 0, bordo = 0, attraversamenti = 0, latoPrec = null;
    const dettaglio = [];
    for (const { p, l } of valutazioni) {
      const lsx = interp(sx.ps, sx.ls, p), ldx = interp(dx.ps, dx.ls, p);
      if (lsx == null || ldx == null) continue;
      let stato;
      if (l > lsx + tol && l < ldx - tol) { stato = 'dentro'; dentro++; }
      else if (l < lsx - tol) { stato = 'fuori_fine'; fuori++; }
      else if (l > ldx + tol) { stato = 'fuori_grosso'; fuori++; }
      else { stato = 'bordo'; bordo++; }
      if (stato.startsWith('fuori')) {
        if (latoPrec && latoPrec !== stato) attraversamenti++;
        latoPrec = stato;
      }
      dettaglio.push({ p, d: 10 ** l, stato });
    }
    const n = dentro + fuori + bordo;
    let esito;
    if (n === 0) esito = 'non confrontabile';
    else if (dentro === n) esito = 'interna';
    else if (fuori === n && attraversamenti === 0) esito = 'esterna';
    else esito = 'tocca';
    const pCurvaMin = punti[0].p, pCurvaMax = punti[punti.length - 1].p;
    const copertura = {
      pCurvaMin, pCurvaMax,
      confrontoDa: n ? Math.max(pCurvaMin, pLo) : null,
      confrontoA: n ? Math.min(pCurvaMax, pHi) : null
    };
    return { esito, stato: VALUTATO, punti: n, dentro, fuori, bordo, attraversamenti, copertura, tolleranzaDecadi: tol, dettaglio };
  }

  /**
   * Criterio 4: distribuzione granulometrica esterna ai fusi della Fig. 7.11.1
   * ((a) se Uc < 3,5; (b) se Uc > 3,5). Esito PROPOSTO dall'app: il geologo lo conferma
   * o lo corregge con motivazione (decisione del 10/11/2026).
   * Se Uc non è determinabile o vale 3,5: confronto con entrambi i fusi.
   * Proposta «soddisfatto» solo se: curva esterna a tutti i fusi confrontati E copertura
   * della curva almeno dal 10 % al 90 % di passante (COPERTURA_MINIMA, scelta prudenziale
   * di LiquiSite). Con copertura insufficiente: stato 'dati_insufficienti'; si propone
   * «non soddisfatto» solo se la parte nota è interna al fuso, altrimenti nessuna proposta.
   */
  function criterio4(curva, fusi, tol = TOLLERANZA_FUSI) {
    const { V, punti } = validaCurva(curva);
    if (!V.ok()) return { ...criterioNonValido(4, V.errori), proposta: 'nessuna proposta' };
    const u = coeffUniformita(curva);
    const avvisi = [];
    let confronti;
    if (u.Uc != null && u.Uc < 3.5) confronti = { a: confrontaFuso(curva, fusi.a_Uc_minore_3_5, tol) };
    else if (u.Uc != null && u.Uc > 3.5) confronti = { b: confrontaFuso(curva, fusi.b_Uc_maggiore_3_5, tol) };
    else {
      avvisi.push(avviso('UC_INDETERMINATO', 'nota', u.Uc == null
        ? 'Uc non determinabile (la curva non copre il 10 % e il 60 % di passante): confronto con entrambi i fusi.'
        : 'Uc = 3,5: confronto con entrambi i fusi.'));
      confronti = { a: confrontaFuso(curva, fusi.a_Uc_minore_3_5, tol), b: confrontaFuso(curva, fusi.b_Uc_maggiore_3_5, tol) };
    }
    const pMin = punti[0].p, pMax = punti[punti.length - 1].p;
    const coperturaSufficiente = pMin <= COPERTURA_MINIMA.pDa && pMax >= COPERTURA_MINIMA.pA;
    const copertura = { pCurvaMin: pMin, pCurvaMax: pMax, richiesta: COPERTURA_MINIMA, sufficiente: coperturaSufficiente };
    const esiti = Object.values(confronti).map(c => c.esito);

    let proposta, stato = VALUTATO;
    if (!coperturaSufficiente) {
      stato = STATI.DATI_INSUFFICIENTI;
      avvisi.push(avviso('COPERTURA_INSUFFICIENTE', 'limite_app',
        'La curva copre il passante dal ' + pMin + ' al ' + pMax + ' %: per proporre l\'esclusione LiquiSite richiede almeno ' +
        COPERTURA_MINIMA.pDa + '–' + COPERTURA_MINIMA.pA + ' % (scelta prudenziale dell\'app, non requisito normativo).'));
      proposta = esiti.some(e => e === 'interna') ? 'non soddisfatto' : 'nessuna proposta';
    } else if (esiti.every(e => e === 'esterna')) proposta = 'soddisfatto';
    else if (esiti.some(e => e === 'interna')) proposta = 'non soddisfatto';
    else proposta = 'nessuna proposta';
    if (stato === VALUTATO && proposta === 'nessuna proposta') avvisi.push(avviso('CURVA_TOCCA_FUSO', 'nota', 'La curva tocca o interseca il fuso entro la tolleranza: la valutazione spetta al geologo.'));
    if (coperturaSufficiente && (pMin > P_FUSO_MIN || pMax < P_FUSO_MAX)) avvisi.push(avviso('COPERTURA_PARZIALE', 'nota',
      'Confronto limitato al passante ' + Math.max(pMin, P_FUSO_MIN) + '–' + Math.min(pMax, P_FUSO_MAX) + ' %: fuori da questo tratto la posizione della curva non è nota.'));
    return { criterio: 4, stato, soddisfatto: null, Uc: u.Uc, D10: u.D10, D60: u.D60, copertura, confronti, proposta, avvisi,
      fonte: 'NTC 2018, Fig. 7.11.1 (fusi digitalizzati dall\'immagine ufficiale, tolleranza ' + tol + ' decadi di d)' };
  }

  return {
    VERSIONE_MOTORE, GAMMA_W, STATI, Z_MAX_APP, TIPI_CPT,
    Phi, PhiInv, tensioni,
    bi2014Spt, bi2014Cpt, cetin2018Spt, kayen2013Vs,
    rdCetin, crCetin, crIdrissBoulanger2010, icRobertsonWride, avvisiProfondita, avvisiProfonditaBI,
    criterio1, criterio2, criterio3, criterio4, confrontaFuso, coeffUniformita, validaCurva,
    TOLLERANZA_FUSI, COPERTURA_MINIMA, SOGLIE_CRITERIO3,
    _BI: BI, _CETIN: CETIN
  };
});
