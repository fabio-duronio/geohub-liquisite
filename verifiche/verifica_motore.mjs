#!/usr/bin/env node
/*
 * verifica_motore.mjs — controlla il motore di LiquiSite sui valori pubblicati dagli autori.
 *
 * Uso:   node verifiche/verifica_motore.mjs            (codice di uscita 0 se tutto passa)
 *        node verifiche/verifica_motore.mjs --verbose
 *
 * Fonti dei valori attesi:
 *  - Cetin et al. (2018), MethodsX 5: esempio illustrativo, Tab. 3 (pag. 1563) ed Eq. 29–54.
 *  - Boulanger & Idriss (2014), Report UCD/CGM-14/01: valori dichiarati nel testo e letti dalle figure.
 *  - Kayen et al. (2013), J. Geotech. Geoenviron. Eng. 139(3): Fig. 6 e 7 (lettura indicativa).
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const L = require('../motore/liquisite.js');

const verbose = process.argv.includes('--verbose');
let ok = 0, ko = 0;
function check(nome, calcolato, atteso, tol) {
  const passa = Math.abs(calcolato - atteso) <= tol;
  passa ? ok++ : ko++;
  if (verbose || !passa) {
    console.log((passa ? '  ok   ' : '  ERRORE ') + nome + ': calcolato ' + calcolato.toFixed(4) +
      ', atteso ' + atteso + ' ± ' + tol);
  }
}

// ---------------------------------------------------------------------------
console.log('Funzioni di servizio');
check('Φ(0)', L.Phi(0), 0.5, 1e-7);
check('Φ(1,77) (MethodsX Eq. 43)', L.Phi(1.77), 0.9616, 1e-4);
check('Φ⁻¹(0,15)', L.PhiInv(0.15), -1.03643, 1e-5);
check('Φ⁻¹(Φ(-2,3))', L.PhiInv(L.Phi(-2.3)), -2.3, 1e-6);

// ---------------------------------------------------------------------------
console.log('Cetin et al. (2018) — esempio degli autori (MethodsX)');
// Profilo dell'esempio: falda a 3 m; γ = 18,4 sopra falda, 20 sotto (Fig. 3); sporgenza aste 1,2 m (pag. 1562).
const stratiCetin = [{ da: 0, a: 20, gamma: 18.4, gammaSat: 20 }];
const sisCetin = { amax: 0.28, Mw: 6.8 };
const vertCetin = { CE: 1, CB: 1, sporgenza: 1.2 }; // la Tab. 3 riporta N60: CE = 1
// Tab. 3: z, N60, CN, CR, N1,60, CSR (CSR solo nello strato potenzialmente liquefacibile)
const tab3 = [
  [0.5, 13, 2.00, 0.60, 15.6, null], [1.2, 17, 2.00, 0.68, 23.0, null], [1.8, 14, 1.75, 0.73, 17.8, null],
  [2.2, 24, 1.58, 0.76, 28.7, null], [2.8, 25, 1.40, 0.79, 27.8, null], [3.2, 12, 1.33, 0.81, 13.0, 0.186],
  [3.7, 7, 1.27, 0.84, 7.5, 0.199], [4.3, 11, 1.22, 0.86, 11.6, 0.212], [4.6, 15, 1.19, 0.88, 15.6, 0.218],
  [5.0, 10, 1.16, 0.89, 10.3, 0.224], [5.5, 11, 1.12, 0.91, 11.2, 0.231], [6.2, 11, 1.07, 0.93, 11.0, 0.238],
  [6.7, 15, 1.04, 0.95, 14.8, 0.242], [7.1, 11, 1.02, 0.96, 10.7, 0.245], [7.5, 10, 1.00, 0.97, 9.7, 0.247],
  [8.1, 11, 0.97, 0.98, 10.5, 0.249], [8.3, 34, 0.96, 0.99, 32.3, 0.250], [9.1, 35, 0.93, 1.00, 32.5, 0.251],
  [12.0, 35, 0.83, 1.00, 29.1, 0.243]
];
for (const [z, N60, CN, CR, N160, CSR] of tab3) {
  const t = L.tensioni(stratiCetin, 3.0, z);
  const e = L.cetin2018Spt({ z, N: N60, FC: 14, sv: t.sv, sve: t.sve }, sisCetin, vertCetin, { Vs12: 220 });
  // sopra falda (z < 3 m) il motore 0.3.0 restituisce 'non_applicabile' (NON_SATURO) con le
  // grandezze di normalizzazione in diagnostica: i valori attesi della Tab. 3 non cambiano
  check('z ' + z + ' m: stato ' + (z < 3 ? 'non_applicabile' : 'calcolato'), e.stato === (z < 3 ? 'non_applicabile' : 'calcolato') ? 1 : 0, 1, 0);
  const r = e.stato === 'calcolato' ? e : e.diagnostica;
  check('z ' + z + ' m: CN', r.CN, CN, 0.006);
  check('z ' + z + ' m: CR', r.CR, CR, 0.006);
  check('z ' + z + ' m: N1,60', r.N160, N160, 0.06);
  if (CSR != null) check('z ' + z + ' m: CSR', r.CSR, CSR, 0.0015);
}
// Strato critico, valori medi (Eq. 14–15, 29–54): z = 5,5 m, σv = 105,2, σ'v = 80,7, N1,60 = 11,4, FC = 14
{
  const sv = 105.2, sve = 80.7, z = 5.5;
  const CN = Math.sqrt(101.3 / sve), CR = L.crCetin(z + 1.2);
  const N = 11.4 / (CN * CR); // N tale che N1,60 = 11,4 con CE = CB = CS = 1
  const r = L.cetin2018Spt({ z, N, FC: 14, sv, sve }, sisCetin, vertCetin, { Vs12: 220 });
  check('rd (Eq. 29)', r.rd, 0.97, 0.005);
  check('CSR (Eq. 32)', r.CSR, 0.23, 0.005);
  check('CRR (Eq. 39)', r.CRR, 0.15, 0.005);
  check('N1,60,CS (Eq. 42)', r.N160cs, 12.9, 0.05);
  check('PL (Eq. 43)', r.PL, 0.96, 0.005);
  check('Kσ (Eq. 45)', r.Ksigma, 1.08, 0.005);
  check('KMw (Eq. 47)', r.KMw, 1.26, 0.005);
  check('CSR rif. (Eq. 49)', r.CSRrif, 0.17, 0.005);
  check('FS (Eq. 53, 0,15/0,23)', r.FS, 0.65, 0.02);
}

// ---------------------------------------------------------------------------
console.log('Boulanger & Idriss (2014) — valori del testo e delle figure');
const BI = L._BI;
check('MSFmax = 1,8 a (N1)60cs ≈ 27 (pag. 14)', 1.09 + Math.pow(27 / 31.5, 2), 1.8, 0.03);
check('MSFmax = 1,8 a qc1Ncs ≈ 160 (pag. 14)', 1.09 + Math.pow(160 / 180, 3), 1.8, 0.03);
check('MSFmax ≈ 1,10 a (N1)60cs ≈ 6 (pag. 14)', 1.09 + Math.pow(6 / 31.5, 2), 1.10, 0.04);
check('MSF(M 7,5) = 1 (Eq. 2.19)', BI.msf(7.5, 2.0), 1.0, 0.001);
check('MSF(M 5,25) = MSFmax (Eq. 2.18)', BI.msf(5.25, 2.0), 2.0, 0.001);
// MSFmax è il valore massimo che l'MSF può assumere per un terremoto di piccola magnitudo (App. A pag. 126;
// pag. 12; curve costanti sotto 5,25 nelle Fig. 2.6 e A.17): sotto M = 5,25 l'MSF resta MSFmax (audit v1.0.0, B3.1). Sopra 5,25 la formula non cambia.
check('MSF(M 5,0) = MSFmax: limite superiore (App. A pag. 126)', BI.msf(5.0, 2.0), 2.0, 1e-12);
check('MSF(M 4,5, MSFmax 2,2) = 2,2 (prima 2,776)', BI.msf(4.5, 2.2), 2.2, 1e-12);
check('MSF(M 4,0, MSFmax 1,1) = 1,1', BI.msf(4.0, 1.1), 1.1, 1e-12);
check('MSF(M 6,0) invariato sopra 5,25', BI.msf(6.0, 2.0), 1 + (2.0 - 1) * (Math.exp(-6 / 4) - Math.exp(-7.5 / 4)) / (Math.exp(-5.25 / 4) - Math.exp(-7.5 / 4)), 1e-12);
{
  let monotono = true, massimo = 0;
  for (let M = 3.5; M <= 9.0001; M += 0.05) for (const mx of [1.09, 1.5, 2.2]) {
    const v = BI.msf(M, mx), w = BI.msf(M + 0.05, mx);
    if (w > v + 1e-12) monotono = false;
    massimo = Math.max(massimo, v - mx);
  }
  check('MSF non crescente con M (3,5–9,0)', monotono ? 1 : 0, 1, 0);
  check('MSF mai oltre MSFmax (3,5–9,0)', massimo <= 1e-12 ? 1 : 0, 1, 0);
}
{
  const t = L.tensioni([{ da: 0, a: 20, gamma: 18, gammaSat: 19 }], 1, 6);
  const r = L.bi2014Spt({ z: 6, N: 10, FC: 10, sv: t.sv, sve: t.sve }, { amax: 0.25, Mw: 4.5 }, { CE: 1, CB: 1, CS: 1, sporgenza: 1 });
  check('SPT con Mw 4,5: MSF del punto = MSFmax del punto', r.MSF, r.MSFmax, 1e-12);
}
// Cetin 2018: Kσ limitato a 0,8–1,6 [SDEE Eq. 14, pag. 706], anche dentro CRR e PL (Eq. 10–11), dove
// −θ3·ln(σ'v/Pa) = θ6·ln Kσ (audit v1.0.0, B3.2). Prima, a 0,5 m con falda al p.c., Kσ = 2,83.
{
  const C = L._CETIN;
  const cet = (z, zw, N = 10) => { const t = L.tensioni([{ da: 0, a: 20, gamma: 18, gammaSat: 19 }], zw, z); return [t, L.cetin2018Spt({ z, N, FC: 10, sv: t.sv, sve: t.sve }, { amax: 0.25, Mw: 6.5 }, { CE: 1, CB: 1, CS: 1, sporgenza: 1 }, { Vs12: 180 })]; };
  const [t1, a] = cet(0.5, 0);
  check('Cetin, σ\'v basso: Kσ = 1,6 (Eq. 14)', a.Ksigma, 1.6, 1e-12);
  check('Cetin, σ\'v basso: avviso KSIGMA_LIMITATO', a.avvisi.some(x => x.codice === 'KSIGMA_LIMITATO') ? 1 : 0, 1, 0);
  const libero = Math.pow(t1.sve / C.PA, -C.t3 / C.t6);
  const baseLibera = a.N160 * (1 + C.t1 * 10) - C.t2 * Math.log(6.5) - C.t3 * Math.log(t1.sve / C.PA) + C.t4 * 10 + C.t5;
  check('Cetin, σ\'v basso: CRR = CRR senza limite × 1,6 / Kσ libero', a.CRR, Math.exp(baseLibera / C.t6) * 1.6 / libero, 1e-9);
  // PL coerente con il CRR limitato: PL = Φ(−θ6·ln(CRR/CSR)/σε) [SDEE Eq. 10–11]
  const phi = (x) => { const t = 1 / (1 + 0.2316419 * Math.abs(x)), d = Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI);
    const p = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429)))); return x >= 0 ? 1 - p : p; };
  check('Cetin, σ\'v basso: PL coerente con il CRR limitato', a.PL, phi(-C.t6 * Math.log(a.CRR / a.CSR) / C.se), 1e-6);
  const [, m] = cet(8, 1);
  check('Cetin, σ\'v nel campo: Kσ invariato', m.Ksigma, Math.pow((L.tensioni([{ da: 0, a: 20, gamma: 18, gammaSat: 19 }], 1, 8).sve) / C.PA, -C.t3 / C.t6), 1e-12);
  check('Cetin, σ\'v nel campo: nessun avviso KSIGMA_LIMITATO', m.avvisi.some(x => x.codice === 'KSIGMA_LIMITATO') ? 1 : 0, 0, 0);
  const t3 = L.tensioni([{ da: 0, a: 20, gamma: 26, gammaSat: 27 }], 20, 19.5);
  const d = L.cetin2018Spt({ z: 19.5, N: 10, FC: 10, sv: t3.sv + 1, sve: t3.sv }, { amax: 0.25, Mw: 6.5 }, { CE: 1, CB: 1, CS: 1, sporgenza: 1 }, { Vs12: 180 });
  check('Cetin, σ\'v alto (> 1,94 atm): Kσ = 0,8 (Eq. 14)', d.Ksigma, 0.8, 1e-12);
}
// Cetin 2018: C_R = 0,48 + 0,225·ln(d) [MethodsX Tab. 2, pag. 1562] senza minimo nella fonte; per
// d ≤ e^(−0,48/0,225) ≈ 0,118 m C_R ≤ 0 e N1,60 non ha senso: punto non applicabile (audit B3.3,
// decisione D4 del 25/11/2026). Sopra, formula come pubblicata (effetto cautelativo).
{
  const cetCorto = (z, sporgenza) => { const t = L.tensioni([{ da: 0, a: 20, gamma: 18, gammaSat: 19 }], 0, z); return L.cetin2018Spt({ z, N: 10, FC: 10, sv: t.sv, sve: t.sve }, { amax: 0.25, Mw: 6.5 }, { CE: 1, CB: 1, CS: 1, sporgenza }, { Vs12: 180 }); };
  const a = cetCorto(0.10, 0), b = cetCorto(0.118, 0), c = cetCorto(0.13, 0);
  check('Cetin, aste 0,10 m: non applicabile (C_R ≤ 0)', a.stato === 'non_applicabile' && a.codice === 'CR_NON_DEFINITO' ? 1 : 0, 1, 0);
  check('Cetin, aste 0,118 m: non applicabile (C_R ≤ 0)', b.stato === 'non_applicabile' ? 1 : 0, 1, 0);
  check('Cetin, aste 0,13 m: calcolato con C_R > 0 (formula invariata)', c.stato === 'calcolato' && c.CR > 0 ? 1 : 0, 1, 0);
  check('Cetin, aste 0,13 m: C_R = 0,48 + 0,225·ln(0,13)', c.CR, 0.48 + 0.225 * Math.log(0.13), 1e-12);
  check('Cetin, motivo con lunghezza e assenza di minimo nella fonte', /0,10 m.*Tab\. 2.*nessun.*minim/i.test(a.motivo) ? 1 : 0, 1, 0);
}
{
  // Kσ = 1,1 raggiunto a ≈ 0,4 atm per (N1)60cs = 15 (pag. 11)
  const Cs = 1 / (18.9 - 2.55 * Math.sqrt(15));
  check('σ\'v/Pa con Kσ = 1,1, (N1)60cs = 15 (pag. 11)', Math.exp(-0.1 / Cs), 0.4, 0.02);
}
{
  // Correzione per i fini (Fig. 2.7): Δ(N1)60 ≈ 5,5 per FC ≥ 35 %; Δqc1N ≈ 85 per qc1N = 100, FC = 100 %
  const dN = Math.exp(1.63 + 9.7 / 35.01 - Math.pow(15.7 / 35.01, 2));
  check('Δ(N1)60 a FC 35 % (Fig. 2.7b)', dN, 5.5, 0.2);
  const dq = (11.9 + 100 / 14.6) * Math.exp(1.63 - 9.7 / 102 - Math.pow(15.7 / 102, 2));
  check('Δqc1N a qc1N 100, FC 100 % (Fig. 2.7a)', dq, 85, 3);
}
{
  // Curve CRR (Fig. 2.8, lettura indicativa)
  const crrSpt = (n) => Math.exp(n / 14.1 + Math.pow(n / 126, 2) - Math.pow(n / 23.6, 3) + Math.pow(n / 25.4, 4) - 2.8);
  check('CRR SPT (N1)60cs = 20 (Fig. 2.8b)', crrSpt(20), 0.21, 0.015);
  const crrCpt = (q) => Math.exp(q / 113 + Math.pow(q / 1000, 2) - Math.pow(q / 140, 3) + Math.pow(q / 137, 4) - 2.80);
  check('CRR CPT qc1Ncs = 150 (Fig. 2.8a, FC ≤ 5 %)', crrCpt(150), 0.28, 0.03);
}
check('rd(z = 10 m, M 7,5) (Fig. 2.1)', BI.rd(10, 7.5), 0.88, 0.03);
{
  // FS = 1 nella relazione deterministica ↔ PL ≈ 16 % (pag. 78–80)
  const sv = 100, sve = 70, z = 6;
  const r0 = L.bi2014Cpt({ z, qc: 8, fs: 40, sv, sve, FC: 5 }, { amax: 0.25, Mw: 7.5 }, { tipo: 'CPTE' });
  // amax che porta FS a 1: CSR ∝ amax
  const amaxCrit = 0.25 * r0.FS;
  const r1 = L.bi2014Cpt({ z, qc: 8, fs: 40, sv, sve, FC: 5 }, { amax: amaxCrit, Mw: 7.5 }, { tipo: 'CPTE' });
  check('FS = 1 → PL (pag. 80: ≈ 16 %)', r1.PL, 0.1587, 0.001);
}
{
  // Esponente n (Robertson & Wride 1998): sabbia → 0,5; argilla → 1,0
  const sabbia = L.icRobertsonWride(10000, 50, 100, 70, 101.325);
  check('Ic sabbia: n = 0,5', sabbia.n, 0.5, 0);
  const argilla = L.icRobertsonWride(800, 40, 100, 70, 101.325);
  check('Ic argilla: n = 1,0', argilla.n, 1.0, 0);
}

// ---------------------------------------------------------------------------
console.log('Kayen et al. (2013) — Fig. 6 e 7 (lettura indicativa), Mw 7,5, σ\'v0 = 100 kPa');
{
  const sis = { amax: 0.2, Mw: 7.5 };
  const p = (Vs, FC) => ({ z: 5, Vs, FC, sv: 150, sve: 100 });
  const crr = (Vs, FC, PL) => {
    const r = L.kayen2013Vs(p(Vs, FC), sis, { Vs12: 180 });
    // CRR a probabilità PL, dalla stessa funzione di stato del motore
    const A = Math.pow(0.0073 * r.Vs1, 2.8011) - 2.6168 * Math.log(7.5) - 0.0099 * Math.log(100) + 0.0028 * FC;
    return { r, CRR: Math.exp((A + 0.4809 * L.PhiInv(PL)) / 1.946) };
  };
  check('CRR PL 15 %, Vs1 150 (Fig. 6)', crr(150, 0, 0.15).r.CRR15, 0.10, 0.02);
  check('CRR PL 15 %, Vs1 200 (Fig. 6)', crr(200, 0, 0.15).r.CRR15, 0.23, 0.03);
  check('CRR PL 50 %, Vs1 200, FC 0 (Fig. 7)', crr(200, 0, 0.5).CRR, 0.29, 0.03);
  const d = crr(200, 35, 0.5).CRR - crr(200, 0, 0.5).CRR;
  check('effetto FC 0→35 % piccolo (Fig. 7)', d, 0.014, 0.01);
  check('DWF(7,5) ≈ 1 (Eq. 17)', 15 * Math.pow(7.5, -1.342), 1.0, 0.01);
  // Coerenza Eq. 13 / Eq. 14: CSR = CRR15 → PL = 15 %
  // (rd dipende da amax: si controlla l'identità sulla funzione di stato, non variando amax)
  const r = crr(180, 0, 0.15).r;
  const A = Math.pow(0.0073 * r.Vs1, 2.8011) - 2.6168 * Math.log(7.5) - 0.0099 * Math.log(100);
  check('PL con CSR = CRR(15 %)', L.Phi(-(A - 1.946 * Math.log(r.CRR15)) / 0.4809), 0.15, 1e-6);
}

console.log('\nRisultato: ' + ok + ' controlli superati, ' + ko + ' non superati.');
process.exit(ko ? 1 : 0);
