/*
 * GeoHub-LiquiSite — indice del potenziale di liquefazione IL (Iwasaki)
 * Copyright (C) 2026 Fabio Duronio — AGPL-3.0 con i termini aggiuntivi del file NOTICE.
 *
 * Modulo separato dal motore di innesco (motore/liquisite.js): usa solo i FS già calcolati.
 *
 * FORMULA di Iwasaki et al. (1978), come riportata nelle fonti consultate integralmente:
 * Linee guida MS per le liquefazioni LQ v1.0 (2018), pag. 9, nota 3; volume CNR-CentroMS
 * (2024), Eq. 3.73–3.74, pag. 36–37, che attribuisce esplicitamente l'indice a Iwasaki et al.
 * (1978):
 *
 *   IL = ∫₀²⁰ F(z) · w(z) dz      w(z) = 10 − 0,5·z      F = 1 − FS se FS ≤ 1, altrimenti 0
 *
 * F è la «severità» di Iwasaki, NON il fattore di sicurezza: F = 0 significa contributo nullo
 * all'indice (FS ≥ 1), F = 1 contributo massimo (FS = 0). Nei testi per l'utente si scrive
 * «contributo nullo / massimo», mai «F = 0», per non confonderlo con un FS nullo.
 *
 * Nessuna classe di IL: classi e zone sono strumenti della microzonazione sismica; per la
 * verifica di sito si riporta il valore e il giudizio resta del progettista.
 *
 * DISCRETIZZAZIONE (scelta di LiquiSite, dichiarata nei risultati):
 *  - ogni punto rappresenta l'intervallo fino a metà distanza dai punti adiacenti; verso un
 *    vuoto maggiore di `vuotoMax` (default 3 volte il passo mediano) metà del passo mediano;
 *    il primo e l'ultimo punto si estendono di metà del passo verso l'esterno;
 *  - F è costante nell'intervallo del punto; l'integrale di w è calcolato esattamente:
 *    ∫ w dz = 10·(b − a) − 0,25·(b² − a²).
 *
 * TRATTAMENTO DEI TRATTI (nessun tratto ignoto viene considerato sicuro):
 *  - 'FS'         punto calcolato: F = max(0, 1 − FS);
 *  - 'sopraFalda' terreno non saturo: F = 0 (tra 0 e la falda vale sempre, anche senza dati);
 *  - 'argilloso'  escluso dalla verifica per comportamento argilloso (Ic oltre soglia): FS non
 *                 applicabile (N.A.); F(z) = 0 per convenzione operativa di calcolo dichiarata
 *                 (non è un FS nullo e non coincide con la condizione FS > 1); spessore
 *                 riportato a parte;
 *  - 'ignoto'     dato mancante, non valido, non calcolato, profondità non indagata:
 *                 F non noto → contributo compreso tra 0 (F = 0) e w (F = 1).
 * Risultato: IL_min (tratti ignoti con F = 0) e IL_max (tratti ignoti con F = 1). L'indice è
 * «completo» solo se non ci sono tratti ignoti in 0–20 m; altrimenti è un intervallo.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LiquiIndici = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const VERSIONE_INDICI = '0.1.0';
  const Z_IL = 20;
  const CATEGORIE = ['FS', 'sopraFalda', 'argilloso', 'ignoto'];
  const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

  /** Peso di Iwasaki w(z) = 10 − 0,5 z [m⁻¹], per 0 ≤ z ≤ 20. */
  const peso = (z) => 10 - 0.5 * z;

  /** ∫ₐᵇ w(z) dz, esatto, con a e b limitati a 0–20 m. */
  function integralePeso(a, b) {
    a = Math.max(0, Math.min(Z_IL, a)); b = Math.max(0, Math.min(Z_IL, b));
    if (!(b > a)) return 0;
    return 10 * (b - a) - 0.25 * (b * b - a * a);
  }

  /** F di Iwasaki: 1 − FS se FS ≤ 1, altrimenti 0. */
  function fattoreF(FS) {
    if (!isNum(FS) || FS < 0) throw new RangeError('fattoreF: FS deve essere un numero ≥ 0');
    return FS <= 1 ? 1 - FS : 0;
  }

  /** Passo mediano tra profondità consecutive. */
  function passoMediano(zs) {
    const p = [];
    for (let i = 1; i < zs.length; i++) p.push(zs[i] - zs[i - 1]);
    p.sort((a, b) => a - b);
    return p.length ? p[Math.floor(p.length / 2)] : null;
  }

  /**
   * Intervalli rappresentati dai punti, senza sovrapposizioni.
   * punti: [{ z, categoria, FS? }] ordinati e con z distinte.
   */
  function intervalliDeiPunti(punti, vuotoMax, mediano) {
    const n = punti.length;
    const meta = (mediano || 0) / 2;
    return punti.map((p, i) => {
      const prec = i > 0 ? punti[i - 1].z : null, succ = i < n - 1 ? punti[i + 1].z : null;
      const sopra = prec === null ? meta : (p.z - prec > vuotoMax ? meta : (p.z - prec) / 2);
      const sotto = succ === null ? meta : (succ - p.z > vuotoMax ? meta : (succ - p.z) / 2);
      return { da: p.z - sopra, a: p.z + sotto, z: p.z, categoria: p.categoria, FS: p.FS ?? null };
    });
  }

  /**
   * Calcola IL.
   * punti: [{ z (m), categoria: 'FS'|'sopraFalda'|'argilloso'|'ignoto', FS (se 'FS') }]
   * zFalda: profondità della falda di verifica (m, ≥ 0)
   * opz: { vuotoMax (m) } — default 3 × passo mediano
   * Esito: { stato, ILmin, ILmax, completo, IL, spessori, tratti, curva, assunzioni, errori? }
   */
  function indiceIL(punti, zFalda, opz = {}) {
    const errori = [];
    if (!isNum(zFalda) || zFalda < 0) errori.push({ campo: 'zFalda', codice: 'FUORI_DOMINIO', motivo: 'falda: numero ≥ 0' });
    if (!Array.isArray(punti)) errori.push({ campo: 'punti', codice: 'MANCANTE', motivo: 'atteso un elenco di punti' });
    else punti.forEach((p, i) => {
      if (!p || !isNum(p.z) || p.z < 0) errori.push({ campo: 'punti[' + i + '].z', codice: 'FUORI_DOMINIO', motivo: 'profondità: numero ≥ 0' });
      else if (!CATEGORIE.includes(p.categoria)) errori.push({ campo: 'punti[' + i + '].categoria', codice: 'VALORE_NON_AMMESSO', motivo: 'categoria non riconosciuta' });
      else if (p.categoria === 'FS' && !(isNum(p.FS) && p.FS >= 0)) errori.push({ campo: 'punti[' + i + '].FS', codice: 'FUORI_DOMINIO', motivo: 'FS: numero ≥ 0' });
    });
    if (opz.vuotoMax !== undefined && !(isNum(opz.vuotoMax) && opz.vuotoMax > 0)) errori.push({ campo: 'opz.vuotoMax', codice: 'FUORI_DOMINIO', motivo: 'numero > 0' });
    if (errori.length) return { stato: 'input_non_valido', errori };

    const ord = punti.slice().sort((a, b) => a.z - b.z);
    for (let i = 1; i < ord.length; i++) {
      if (ord[i].z === ord[i - 1].z) return { stato: 'input_non_valido', errori: [{ campo: 'punti', codice: 'PROFONDITA_RIPETUTA', motivo: 'profondità ripetuta: ' + ord[i].z + ' m' }] };
    }
    const mediano = passoMediano(ord.map(p => p.z));
    const vuotoMax = opz.vuotoMax ?? (mediano ? 3 * mediano : Infinity);
    const base = ord.length ? intervalliDeiPunti(ord, vuotoMax, mediano) : [];

    // Copertura di 0–20 m: falda (sempre nota), intervalli dei punti, resto ignoto.
    // Si costruisce una partizione su tutti i bordi e si assegna a ogni pezzo la categoria.
    const bordi = new Set([0, Z_IL, Math.min(Z_IL, zFalda)]);
    for (const t of base) { bordi.add(Math.max(0, Math.min(Z_IL, t.da))); bordi.add(Math.max(0, Math.min(Z_IL, t.a))); }
    const b = [...bordi].sort((x, y) => x - y);
    const tratti = [];
    for (let i = 0; i < b.length - 1; i++) {
      const da = b[i], a = b[i + 1];
      if (!(a - da > 1e-12)) continue;
      const m = (da + a) / 2;
      let cat = 'ignoto', FS = null, zPunto = null;
      if (m <= zFalda) cat = 'sopraFalda';
      else {
        const t = base.find(t => t.da <= m && m < t.a);
        if (t) {
          zPunto = t.z;
          if (t.categoria === 'FS') { cat = 'FS'; FS = t.FS; }
          else if (t.categoria === 'sopraFalda') cat = 'ignoto'; // punto non saturo sotto la falda di verifica: incoerente, resta ignoto
          else cat = t.categoria;
        }
      }
      const W = integralePeso(da, a);
      const F = cat === 'FS' ? fattoreF(FS) : (cat === 'ignoto' ? null : 0);
      const ultimo = tratti[tratti.length - 1];
      if (ultimo && ultimo.categoria === cat && ultimo.FS === FS && ultimo.zPunto === zPunto && Math.abs(ultimo.a - da) < 1e-12) {
        ultimo.a = a; ultimo.W += W; ultimo.contributo = F === null ? null : F * ultimo.W;
      } else tratti.push({ da, a, categoria: cat, zPunto, FS, F, W, contributo: F === null ? null : F * W });
    }

    let ILmin = 0, ILmax = 0;
    const spessori = { FS: 0, sopraFalda: 0, argilloso: 0, ignoto: 0, liquefacibileFSmin1: 0 };
    const curva = [{ z: 0, ILmin: 0, ILmax: 0 }];
    for (const t of tratti) {
      spessori[t.categoria] += t.a - t.da;
      if (t.categoria === 'FS' && t.F > 0) spessori.liquefacibileFSmin1 += t.a - t.da;
      if (t.F === null) ILmax += t.W;
      else { ILmin += t.contributo; ILmax += t.contributo; }
      curva.push({ z: t.a, ILmin, ILmax });
    }
    const completo = spessori.ignoto < 1e-9;
    const assunzioni = [
      { codice: 'IL_INTERVALLI', descrizione: 'Ogni punto rappresenta l\'intervallo fino a metà distanza dai punti adiacenti (metà del passo mediano verso i vuoti oltre ' + (isFinite(vuotoMax) ? vuotoMax.toFixed(2) : '∞') + ' m e agli estremi); F costante nell\'intervallo, integrale di w esatto.' },
      { codice: 'IL_SOPRA_FALDA', descrizione: 'Tra il piano campagna e la falda di verifica contributo nullo all\'indice: terreno non saturo.' }
    ];
    if (spessori.argilloso > 0) assunzioni.push({ codice: 'IL_ARGILLOSO', descrizione: 'Tratti esclusi per Ic oltre la soglia adottata (CNR-CentroMS 2024, §3.2.1.2, pag. 32: dati CPT con Ic ≤ 2,6, soglia adattabile tra 2,4 e 2,8): FS non applicabile (N.A.), non calcolato. Per convenzione operativa di calcolo il contributo F(z) di questi tratti all\'indice è assunto pari a zero (' + spessori.argilloso.toFixed(2) + ' m): non equivale a un fattore di sicurezza nullo e non coincide con la condizione FS > 1 della definizione di F(z). L\'esclusione non dimostra l\'assenza di perdita di resistenza ciclica: nei terreni fini sensibili o di transizione serve una verifica specifica (granulometria, limiti di Atterberg, criteri di suscettibilità).' });
    if (!completo) assunzioni.push({ codice: 'IL_INCOMPLETO', descrizione: 'Tratti senza risultato in 0–20 m (' + spessori.ignoto.toFixed(2) + ' m: dati mancanti, non calcolati o profondità non indagate): IL compreso tra IL_min (contributo nullo in quei tratti) e IL_max (contributo massimo possibile in quei tratti).' });
    return {
      stato: 'calcolato', versione: VERSIONE_INDICI,
      ILmin, ILmax, completo, IL: completo ? ILmin : null,
      spessori, tratti, curva, passoMediano: mediano, vuotoMax: isFinite(vuotoMax) ? vuotoMax : null, assunzioni,
      fonte: 'Iwasaki et al. (1978), formulazione riportata nelle Linee guida MS-LQ (2018, pag. 9) e nel volume CNR-CentroMS «Pratiche correnti per le analisi di suscettibilità alla liquefazione negli studi di microzonazione sismica di livello 3» (2024, Eq. 3.73–3.74, pag. 36). Senza classi.'
    };
  }

  return { VERSIONE_INDICI, Z_IL, peso, integralePeso, fattoreF, indiceIL };
});
