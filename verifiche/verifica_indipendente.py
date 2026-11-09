#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
verifica_indipendente.py — seconda implementazione dei quattro metodi, scritta dalle
schede dei metodi (equazioni lette sulle pubblicazioni originali) e non dal codice
JavaScript. Genera casi casuali, li fa calcolare al motore (motore/liquisite.js, via
Node) e confronta i risultati.

Uso:
    python3 verifiche/verifica_indipendente.py            # 2000 casi per metodo
    python3 verifiche/verifica_indipendente.py --casi 500 --seme 7

Requisiti: Python 3.8+ e Node.js (solo libreria standard).
"""
import argparse
import json
import math
import os
import random
import subprocess
import sys
from statistics import NormalDist

PHI = NormalDist().cdf
PHI_INV = NormalDist().inv_cdf
QUI = os.path.dirname(os.path.abspath(__file__))
MOTORE = os.path.join(QUI, '..', 'motore', 'liquisite.js')

# ---------------------------------------------------------------------------
# Boulanger & Idriss (2014)
# ---------------------------------------------------------------------------
PA_BI = 101.325


def rd_bi(z, M):  # Eq. 2.14
    a = -1.012 - 1.126 * math.sin(z / 11.73 + 5.133)
    b = 0.106 + 0.118 * math.sin(z / 11.28 + 5.142)
    return math.exp(a + b * M)


def msf_bi(M, msfmax):  # Eq. 2.18 in forma generale (non la forma numerica 2.19)
    e = math.exp
    return 1 + (msfmax - 1) * (e(-M / 4) - e(-7.5 / 4)) / (e(-5.25 / 4) - e(-7.5 / 4))


def cr_ib2010(L):  # I&B 2010 pag. 9
    for soglia, val in ((3, 0.75), (4, 0.80), (6, 0.85), (10, 0.95)):
        if L < soglia:
            return val
    return 1.00


def bi_spt(p):
    N60 = p['N'] * p['CE'] * p['CB'] * p['CS'] * cr_ib2010(p['sporgenza'] + p['z'])
    FC = p['FC']
    dN = math.exp(1.63 + 9.7 / (FC + 0.01) - (15.7 / (FC + 0.01)) ** 2)  # Eq. 2.23
    n160cs = N60
    for _ in range(500):  # punto fisso su (N1)60cs
        m = 0.784 - 0.0768 * math.sqrt(min(max(n160cs, 0), 46))  # Eq. 2.15c
        CN = min((PA_BI / p['sve']) ** m, 1.7)  # Eq. 2.15a
        nuovo = CN * N60 + dN
        if abs(nuovo - n160cs) < 1e-11:
            break
        n160cs = nuovo
    n160cs = nuovo
    rd = rd_bi(p['z'], p['Mw'])
    csr = 0.65 * p['amax'] * p['sv'] / p['sve'] * rd
    cs = min(1 / (18.9 - 2.55 * math.sqrt(min(max(n160cs, 0), 37))), 0.3)  # Eq. 2.16c
    ks = min(1 - cs * math.log(p['sve'] / PA_BI), 1.1)  # Eq. 2.16a
    msf = msf_bi(p['Mw'], min(1.09 + (n160cs / 31.5) ** 2, 2.2))  # Eq. 2.21
    x = n160cs
    crr75 = math.exp(x / 14.1 + (x / 126) ** 2 - (x / 23.6) ** 3 + (x / 25.4) ** 4 - 2.8)  # Eq. 2.25
    return {'N160cs': n160cs, 'CSR': csr, 'FS': crr75 * msf * ks / csr}


def bi_cpt(p):
    qt = p['qc'] * 1000 + (1 - p['ar']) * p['u2']
    net = qt - p['sv']
    F = p['fs'] / net * 100

    def ic(n):
        Q = net / PA_BI * (PA_BI / p['sve']) ** n
        return math.hypot(3.47 - math.log10(Q), 1.22 + math.log10(F))

    # Robertson & Wride (1998) pag. 449
    i1 = ic(1.0)
    if i1 > 2.6:
        Ic = i1
    else:
        i05 = ic(0.5)
        Ic = i05 if i05 <= 2.6 else ic(0.75)
    if Ic > 2.6:
        return {'stato': 'escluso'}
    FC = min(max(80 * Ic - 137, 0), 100)  # Eq. 2.30, C_FC = 0
    qcN = qt / PA_BI
    q = qcN
    for _ in range(1000):
        m = 1.338 - 0.249 * min(max(q, 21), 254) ** 0.264  # Eq. 2.15b
        CN = min((PA_BI / p['sve']) ** m, 1.7)
        q1 = CN * qcN
        nuovo = q1 + (11.9 + q1 / 14.6) * math.exp(1.63 - 9.7 / (FC + 2) - (15.7 / (FC + 2)) ** 2)  # Eq. 2.22
        if abs(nuovo - q) < 1e-11:
            break
        q = nuovo
    q = nuovo
    rd = rd_bi(p['z'], p['Mw'])
    csr = 0.65 * p['amax'] * p['sv'] / p['sve'] * rd
    cs = min(1 / (37.3 - 8.27 * min(q, 211) ** 0.264), 0.3)  # Eq. 2.16b
    ks = min(1 - cs * math.log(p['sve'] / PA_BI), 1.1)
    msf = msf_bi(p['Mw'], min(1.09 + (q / 180) ** 3, 2.2))  # Eq. 2.20
    g = q / 113 + (q / 1000) ** 2 - (q / 140) ** 3 + (q / 137) ** 4
    crr = math.exp(g - 2.80) * msf * ks  # Eq. 2.24
    csr75 = csr / (msf * ks)
    pl = PHI(-(g - 2.60 - math.log(csr75)) / 0.20)  # Eq. 5.26
    return {'stato': 'calcolato', 'qc1Ncs': q, 'CSR': csr, 'FS': crr / csr, 'PL': pl}


# ---------------------------------------------------------------------------
# Cetin et al. (2018) e Kayen et al. (2013)
# ---------------------------------------------------------------------------
def rd_cetin(d, Mw, amax, V):  # MethodsX Eq. 26–27
    A = -23.013 - 2.949 * amax + 0.999 * Mw + 0.0525 * V
    den = 1 + A / (16.258 + 0.201 * math.exp(0.341 * (0.0785 * V + 7.586)))
    dd = min(d, 20)
    num = 1 + A / (16.258 + 0.201 * math.exp(0.341 * (-dd + 0.0785 * V + 7.586)))
    return num / den - (0.046 * (d - 20) if d >= 20 else 0)


T = dict(t1=0.00167, t2=27.352, t3=3.958, t4=0.089, t5=16.084, t6=11.771, se=2.95)


def cetin(p):
    FC = min(max(p['FC'], 5), 35)
    d = p['sporgenza'] + p['z']
    CR = 0.48 + 0.225 * math.log(d) if d <= 10 else 1.0
    CN = min(math.sqrt(101.3 / p['sve']), 2.0)
    n = p['N'] * CN * CR * p['CB'] * p['CE']
    V = min(p['Vs12'], 230)
    csr = 0.65 * p['amax'] * p['sv'] / p['sve'] * rd_cetin(p['z'], p['Mw'], p['amax'], V)
    s = n * (1 + T['t1'] * FC) - T['t2'] * math.log(p['Mw']) - T['t3'] * math.log(p['sve'] / 101.3) + T['t4'] * FC + T['t5']
    pl = PHI(-(s - T['t6'] * math.log(csr)) / T['se'])
    return {'CSR': csr, 'FS': math.exp(s / T['t6']) / csr, 'PL': pl}


def kayen(p):
    vs1 = p['Vs'] * min((100 / p['sve']) ** 0.25, 1.5)
    csr = 0.65 * p['amax'] * p['sv'] / p['sve'] * rd_cetin(p['z'], p['Mw'], p['amax'], p['Vs12'])
    A = (0.0073 * vs1) ** 2.8011 - 2.6168 * math.log(p['Mw']) - 0.0099 * math.log(p['sve']) + 0.0028 * p['FC']
    pl = PHI(-(A - 1.946 * math.log(csr)) / 0.4809)
    crr15 = math.exp((A + 0.4809 * PHI_INV(0.15)) / 1.946)
    return {'CSR': csr, 'FS': crr15 / csr, 'PL': pl}


# ---------------------------------------------------------------------------
RUNNER = r"""
const L = require(process.argv[1]);
const casi = JSON.parse(require('fs').readFileSync(0, 'utf8'));
const out = casi.map(([m, p]) => {
  const s = { amax: p.amax, Mw: p.Mw };
  const pt = { z: p.z, N: p.N, FC: p.FC, sv: p.sv, sve: p.sve, qc: p.qc, fs: p.fs, u2: p.u2, Vs: p.Vs };
  if (m === 'bi_spt') return L.bi2014Spt(pt, s, { CE: p.CE, CB: p.CB, CS: p.CS, sporgenza: p.sporgenza });
  if (m === 'bi_cpt') { delete pt.FC; return L.bi2014Cpt(pt, s, { ar: p.ar }); }
  if (m === 'cetin') return L.cetin2018Spt(pt, s, { CE: p.CE, CB: p.CB, sporgenza: p.sporgenza }, { Vs12: p.Vs12 });
  return L.kayen2013Vs(pt, s, { Vs12: p.Vs12 });
});
process.stdout.write(JSON.stringify(out));
"""


def caso(rng):
    z = rng.uniform(1.0, 19.5)
    zw = rng.uniform(0.0, min(z, 6))
    g, gs = rng.uniform(16, 20), rng.uniform(18, 21.5)
    sv = g * zw + gs * (z - zw)
    sve = sv - 9.81 * (z - zw)
    return dict(z=z, sv=sv, sve=sve, amax=rng.uniform(0.05, 0.5), Mw=rng.uniform(5.5, 7.8),
                N=rng.uniform(1, 45), FC=rng.uniform(0, 60), CE=rng.uniform(0.8, 1.3),
                CB=rng.choice([1.0, 1.05, 1.15]), CS=rng.choice([1.0, 1.1]), sporgenza=rng.uniform(0.5, 2.0),
                qc=rng.uniform(0.5, 25), fs=rng.uniform(2, 200), u2=rng.uniform(0, 300), ar=rng.uniform(0.65, 0.85),
                Vs=rng.uniform(100, 320), Vs12=rng.uniform(100, 280))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--casi', type=int, default=2000)
    ap.add_argument('--seme', type=int, default=2026)
    a = ap.parse_args()
    rng = random.Random(a.seme)
    metodi = {'bi_spt': bi_spt, 'bi_cpt': bi_cpt, 'cetin': cetin, 'kayen': kayen}
    casi = [(m, caso(rng)) for m in metodi for _ in range(a.casi)]
    res = subprocess.run(['node', '-e', RUNNER, MOTORE], input=json.dumps(casi),
                         capture_output=True, text=True, check=True)
    js = json.loads(res.stdout)
    errori = 0
    massimi = {m: 0.0 for m in metodi}
    for (m, p), r in zip(casi, js):
        atteso = metodi[m](p)
        if atteso.get('stato') == 'escluso' or r.get('stato') != 'calcolato':
            if atteso.get('stato', 'calcolato') != r.get('stato'):
                errori += 1
                print('stato diverso', m, p, r.get('stato'))
            continue
        for k in ('CSR', 'FS', 'PL'):
            if k in atteso and atteso[k] is not None:
                diff = abs(r[k] - atteso[k]) / max(abs(atteso[k]), 1e-9)
                massimi[m] = max(massimi[m], diff)
                if diff > 1e-6:
                    errori += 1
                    if errori <= 10:
                        print('differenza', m, k, r[k], atteso[k])
    for m, v in massimi.items():
        print(f'{m:7s}: differenza relativa massima {v:.2e}')
    print('Risultato:', 'tutti i casi coincidono' if errori == 0 else f'{errori} differenze')
    sys.exit(1 if errori else 0)


if __name__ == '__main__':
    main()
