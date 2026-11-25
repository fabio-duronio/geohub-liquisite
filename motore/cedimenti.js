/*
 * GeoHub-LiquiSite — cedimento post-sismico da CPT
 * Copyright (C) 2026 Fabio Duronio — AGPL-3.0 con i termini aggiuntivi del file NOTICE.
 *
 * Fonti lette per intero:
 *  - Zhang G., Robertson P.K., Brachman R.W.I. (2002). Estimating liquefaction-induced ground
 *    settlements from CPT for level ground. Can. Geotech. J. 39: 1168–1180.
 *    Deformazione volumetrica post-liquefazione εv [%] in funzione di FS e (qc1N)cs:
 *    Appendice A, Eq. A1–A14, pag. 1180 (curve della Fig. 3, da Ishihara e Yoshimine 1992).
 *    Cedimento S = Σ εv,i · Δz,i (Eq. 1, pag. 1171).
 *    Nell'Eq. A14 il campo stampato «33 ≤ (qc1N)cs ≤ 20» è un refuso per 200 (stesso campo
 *    delle Eq. A10–A13 e della Fig. 3).
 *  - Tonkin & Taylor (2015), Appendix A «Assessment of Liquefaction Vulnerability in
 *    Christchurch»: applicazione delle curve di Zhang con (qc1N)cs e FS di Boulanger e Idriss (2014).
 *
 * L'indice LSN non è calcolato dalla versione 1.0 (decisione del 22/11/2026): la definizione
 * originale (van Ballegooy et al. 2014) non è stata letta.
 *
 * Convenzioni adottate, dichiarate nei risultati:
 *  - εv tra due curve di FS: interpolazione lineare in FS; FS ≤ 0,5: curva limite; FS ≥ 2,0: 0;
 *    tra 1,3 e 2,0 interpolazione lineare verso zero;
 *  - (qc1N)cs fuori da 33–200: ricondotto al limite più vicino, con avviso; sotto 33 la scelta
 *    può sottostimare εv rispetto all'estrapolazione della curva limite (non cautelativo);
 *  - tratti con Ic oltre la soglia e tratti sopra falda: εv = 0, secondo le ipotesi del modello;
 *  - tratti non indagati o senza risultato: S come intervallo, con contributo nullo
 *    (minimo) e deformazione della curva limite (massimo): limiti convenzionali del modello, non un
 *    intervallo di confidenza né un massimo fisico; nessun tratto ignoto è considerato sicuro;
 *  - integrazione 0–20 m.
 * Le curve sono state ricavate con (qc1N)cs e FS di Robertson e Wride (1998); qui si usano
 * (qc1N)cs e FS del metodo dello scenario (Boulanger e Idriss 2014), come nello studio
 * dell'Appendice A: combinazione dichiarata nei risultati.
 * La partizione della verticale in tratti è quella dell'indice IL (motore/indici.js).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./indici.js'));
  else root.LiquiCedimenti = factory(root.LiquiIndici);
})(typeof self !== 'undefined' ? self : this, function (IND) {
  'use strict';

  const VERSIONE_CEDIMENTI = '0.3.0';
  const Z_MAX = 20;
  const Q_MIN = 33, Q_MAX = 200;
  const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

  /**
   * Curve di Zhang et al. (2002), Appendice A: per ogni FS, tratti εv = a · q^b [%]
   * validi per q ∈ [da, a] (q = (qc1N)cs).
   */
  const CURVE = Object.freeze([
    { FS: 0.5, tratti: [{ a: 102, b: -0.82, da: 33, al: 200, eq: 'A1' }] },
    { FS: 0.6, tratti: [{ a: 102, b: -0.82, da: 33, al: 147, eq: 'A2' }, { a: 2411, b: -1.45, da: 147, al: 200, eq: 'A3' }] },
    { FS: 0.7, tratti: [{ a: 102, b: -0.82, da: 33, al: 110, eq: 'A4' }, { a: 1701, b: -1.42, da: 110, al: 200, eq: 'A5' }] },
    { FS: 0.8, tratti: [{ a: 102, b: -0.82, da: 33, al: 80, eq: 'A6' }, { a: 1690, b: -1.46, da: 80, al: 200, eq: 'A7' }] },
    { FS: 0.9, tratti: [{ a: 102, b: -0.82, da: 33, al: 60, eq: 'A8' }, { a: 1430, b: -1.48, da: 60, al: 200, eq: 'A9' }] },
    { FS: 1.0, tratti: [{ a: 64, b: -0.93, da: 33, al: 200, eq: 'A10' }] },
    { FS: 1.1, tratti: [{ a: 11, b: -0.65, da: 33, al: 200, eq: 'A11' }] },
    { FS: 1.2, tratti: [{ a: 9.7, b: -0.69, da: 33, al: 200, eq: 'A12' }] },
    { FS: 1.3, tratti: [{ a: 7.6, b: -0.71, da: 33, al: 200, eq: 'A13' }] },
    { FS: 2.0, tratti: [{ a: 0, b: 0, da: 33, al: 200, eq: 'A14' }] }
  ]);

  /** εv [%] sulla curva di indice k, con q già nel campo 33–200. */
  function epsCurva(k, q) {
    const c = CURVE[k];
    // ai punti di raccordo (es. q = 147 per FS 0,6) vale il primo tratto, come nell'elenco delle equazioni
    const t = c.tratti.find(t => q >= t.da && q <= t.al) || c.tratti[c.tratti.length - 1];
    return t.a === 0 ? 0 : t.a * Math.pow(q, t.b);
  }

  /**
   * Deformazione volumetrica post-liquefazione εv [%].
   * FS ≥ 0 e qc1Ncs > 0, numeri finiti. Esito: { epsV, qUsato, limitato: null | 'sotto' | 'sopra' }.
   */
  function deformazioneVolumetrica(FS, qc1Ncs) {
    if (!isNum(FS) || FS < 0) throw new RangeError('deformazioneVolumetrica: FS deve essere un numero ≥ 0');
    if (!isNum(qc1Ncs) || qc1Ncs <= 0) throw new RangeError('deformazioneVolumetrica: (qc1N)cs deve essere un numero > 0');
    const limitato = qc1Ncs < Q_MIN ? 'sotto' : qc1Ncs > Q_MAX ? 'sopra' : null;
    const q = Math.min(Q_MAX, Math.max(Q_MIN, qc1Ncs));
    if (FS >= 2.0) return { epsV: 0, qUsato: q, limitato };
    if (FS <= 0.5) return { epsV: epsCurva(0, q), qUsato: q, limitato };
    let k = 0;
    while (k < CURVE.length - 1 && !(FS >= CURVE[k].FS && FS <= CURVE[k + 1].FS)) k++;
    const f0 = CURVE[k].FS, f1 = CURVE[k + 1].FS;
    const e0 = epsCurva(k, q), e1 = epsCurva(k + 1, q);
    return { epsV: e0 + (e1 - e0) * (FS - f0) / (f1 - f0), qUsato: q, limitato };
  }

  /** Deformazione limite [%]: curva limite al limite inferiore del campo, (qc1N)cs = 33. */
  const EPS_LIMITE = epsCurva(0, Q_MIN);


  /**
   * Cedimento post-sismico S.
   * punti: [{ z, categoria: 'FS'|'sopraFalda'|'argilloso'|'addensato'|'ignoto', FS?, qc1Ncs? }] (come per IL,
   *        con (qc1N)cs per i punti 'FS'). zFalda: falda di verifica [m].
   * Esito: { stato, Smin, Smax [m], completo, punti, tratti,
   *          conteggi, assunzioni, avvisi, fonte }.
   */
  function cedimento(punti, zFalda, opz = {}) {
    if (!Array.isArray(punti)) return { stato: 'input_non_valido', errori: [{ campo: 'punti', codice: 'MANCANTE', motivo: 'atteso un elenco di punti' }] };
    const errQ = punti.findIndex(p => p && p.categoria === 'FS' && !(isNum(p.qc1Ncs) && p.qc1Ncs > 0));
    if (errQ >= 0) return { stato: 'input_non_valido', errori: [{ campo: 'punti[' + errQ + '].qc1Ncs', codice: 'FUORI_DOMINIO', motivo: '(qc1N)cs: numero > 0 per i punti con FS' }] };
    const il = IND.indiceIL(punti, zFalda, opz);
    if (il.stato !== 'calcolato') return il;
    const perZ = new Map(punti.filter(p => p.categoria === 'FS').map(p => [p.z, p]));

    let Smin = 0, Smax = 0;
    const conteggi = { sotto33: 0, sopra200: 0 };
    const visti = new Set();
    const tratti = [];
    for (const t of il.tratti) {
      const da = Math.min(t.da, Z_MAX), a = Math.min(t.a, Z_MAX);
      if (!(a > da)) continue;
      let eMin = 0, eMax = 0, d = null;
      if (t.categoria === 'FS') {
        const p = perZ.get(t.zPunto);
        d = deformazioneVolumetrica(t.FS, p.qc1Ncs);
        eMin = eMax = d.epsV;
        if (d.limitato && !visti.has(t.zPunto)) { visti.add(t.zPunto); conteggi[d.limitato === 'sotto' ? 'sotto33' : 'sopra200']++; }
      } else if (t.categoria === 'ignoto') { eMin = 0; eMax = EPS_LIMITE; }
      const dz = a - da;
      Smin += eMin / 100 * dz; Smax += eMax / 100 * dz;
      tratti.push({ da, a, categoria: t.categoria, zPunto: t.zPunto, FS: t.FS, epsMin: eMin, epsMax: eMax, qUsato: d ? d.qUsato : null, Smin, Smax });
    }
    const completo = il.completo;
    const avvisi = [];
    if (conteggi.sotto33) avvisi.push({ codice: 'ZHANG_Q_SOTTO_33', messaggio: conteggi.sotto33 + ' punti con (qc1N)cs < 33 ricondotti a 33: εv può essere sottostimata rispetto all\'estrapolazione della curva limite (stima non cautelativa).' });
    if (conteggi.sopra200) avvisi.push({ codice: 'ZHANG_Q_SOPRA_200', messaggio: conteggi.sopra200 + ' punti con (qc1N)cs > 200 ricondotti a 200, limite superiore delle equazioni.' });
    const assunzioni = [
      { codice: 'ZHANG_CURVE', descrizione: 'εv da Zhang et al. (2002), Eq. A1–A14 (curve di Ishihara e Yoshimine 1992), con interpolazione lineare in FS tra le curve; FS ≤ 0,5: curva limite; FS ≥ 2,0: εv = 0; (qc1N)cs fuori da 33–200 ricondotto al limite più vicino.' },
      { codice: 'ZHANG_COMBINAZIONE', descrizione: 'Le curve sono state ricavate con (qc1N)cs e FS di Robertson e Wride (1998); qui si applicano con (qc1N)cs e FS di Boulanger e Idriss (2014), come nello studio di Tonkin & Taylor (2015, App. A).' },
      { codice: 'ZHANG_ESCLUSI', descrizione: 'Tratti con Ic oltre la soglia dello scenario, tratti sopra falda e tratti oltre il campo della correlazione per addensamento (qc1Ncs > 211, scelta di LiquiSite; per Zhang et al. 2002 con FS ≥ 2 εv = 0): εv = 0.' },
      { codice: 'ZHANG_AMBITO', descrizione: 'Piano campagna sub-orizzontale, lontano da scarpate libere: deformazione volumetrica = deformazione verticale. Gli autori indicano il metodo per progetti a rischio basso o medio e come stima preliminare per gli altri; nessuno spostamento laterale è calcolato.' },
      { codice: 'ZHANG_INTEGRAZIONE', descrizione: 'Cedimento S = Σ εv · Δz (Zhang et al. 2002, Eq. 1) su 0–20 m, con la partizione della verticale dell\'indice IL.' }
    ];
    if (il.spessori.escluso > 0) assunzioni.push({ codice: 'ZHANG_STRATI_ESCLUSI', descrizione: 'Strati esclusi motivatamente (' + il.spessori.escluso.toFixed(2).replace('.', ',') + ' m entro 20 m, convenzione applicativa di GeoHub): εv = 0, anche dove ci sono prove; spessore distinto dai tratti senza risultato.' });
    if (!completo) assunzioni.push({ codice: 'CEDIMENTI_INCOMPLETO', descrizione: 'Tratti senza risultato in 0–20 m (' + il.spessori.ignoto.toFixed(2).replace('.', ',') + ' m): cedimento compreso tra il minimo (contributo nullo) e il massimo (deformazione della curva limite di Zhang et al. 2002, ' + EPS_LIMITE.toFixed(2).replace('.', ',') + ' %). I due valori sono limiti convenzionali del modello, non un intervallo di confidenza né un massimo fisico garantito: con (qc1N)cs < 33 la deformazione può essere maggiore.' });
    return {
      stato: 'calcolato', versione: VERSIONE_CEDIMENTI, completo,
      Smin, Smax, S: completo ? Smin : null,
      epsLimite: EPS_LIMITE, tratti, conteggi, spessori: il.spessori, avvisi, assunzioni,
      fonte: 'Zhang, Robertson e Brachman (2002), Can. Geotech. J. 39: 1168–1180, Eq. 1 e App. A.'
    };
  }

  return { VERSIONE_CEDIMENTI, CURVE, EPS_LIMITE, Q_MIN, Q_MAX, deformazioneVolumetrica, cedimento };
});
