#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
verifica_cedimenti.py — seconda implementazione, scritta dalle equazioni dell'articolo e non
dal codice JavaScript, della deformazione volumetrica di Zhang et al. (2002, App. A, Eq.
A1–A14), del cedimento (Eq. 1) e dell'LSN (Tonkin & Taylor 2015, App. A, §A4.3.5), con le
convenzioni di LiquiSite. Confronta con motore/cedimenti.js (via Node):
  1. εv su casi casuali di FS e (qc1N)cs, compresi i bordi;
  2. S e LSN su profili casuali regolari, con LSN integrato numericamente a passi fini
     (verifica indipendente dell'integrale esatto ∫ dz / z).

Uso: python3 verifiche/verifica_cedimenti.py [--casi 3000] [--seme 11]
"""
import argparse
import json
import math
import os
import random
import subprocess
import sys

QUI = os.path.dirname(os.path.abspath(__file__))
MODULO = os.path.join(QUI, '..', 'motore', 'cedimenti.js')

# Eq. A1–A14: per ogni FS, elenco di (coefficiente, esponente, qmin, qmax)
ZHANG = {
    0.5: [(102, -0.82, 33, 200)],
    0.6: [(102, -0.82, 33, 147), (2411, -1.45, 147, 200)],
    0.7: [(102, -0.82, 33, 110), (1701, -1.42, 110, 200)],
    0.8: [(102, -0.82, 33, 80), (1690, -1.46, 80, 200)],
    0.9: [(102, -0.82, 33, 60), (1430, -1.48, 60, 200)],
    1.0: [(64, -0.93, 33, 200)],
    1.1: [(11, -0.65, 33, 200)],
    1.2: [(9.7, -0.69, 33, 200)],
    1.3: [(7.6, -0.71, 33, 200)],
    2.0: [(0.0, 0.0, 33, 200)],
}
FS_NOTI = sorted(ZHANG)


def curva(fs, q):
    for c, e, qa, qb in ZHANG[fs]:
        if qa <= q <= qb:
            return c * q ** e
    raise ValueError


def eps(fs, q):
    q = min(200.0, max(33.0, q))
    if fs >= 2.0:
        return 0.0
    if fs <= 0.5:
        return curva(0.5, q)
    for f0, f1 in zip(FS_NOTI, FS_NOTI[1:]):
        if f0 <= fs <= f1:
            t = (fs - f0) / (f1 - f0)
            return (1 - t) * curva(f0, q) + t * curva(f1, q)
    raise ValueError


EPS_LIM = curva(0.5, 33.0)

RUNNER = r"""
const C = require(process.argv[1]);
let s = ''; process.stdin.on('data', d => s += d); process.stdin.on('end', () => {
  const inp = JSON.parse(s);
  const e = inp.eps.map(([f, q]) => C.deformazioneVolumetrica(f, q).epsV);
  const p = inp.profili.map(x => { const r = C.cedimentoLSN(x.punti, x.falda); return [r.Smin, r.Smax, r.LSNmin, r.LSNmax, r.LSN10min, r.LSN10max]; });
  process.stdout.write(JSON.stringify({ e, p }));
});
"""


def profilo(rng):
    passo = rng.choice([0.02, 0.05, 0.1])
    z0 = round(rng.uniform(0.3, 2.0) / passo) * passo
    n = int((rng.uniform(5, 19) - z0) / passo)
    falda = round(rng.uniform(0.5, 4.0), 2)
    punti = []
    for i in range(n):
        z = round(z0 + i * passo, 4)
        if z <= falda:
            punti.append({'z': z, 'categoria': 'sopraFalda'})
            continue
        u = rng.random()
        if u < 0.1:
            punti.append({'z': z, 'categoria': 'argilloso'})
        elif u < 0.13:
            punti.append({'z': z, 'categoria': 'ignoto'})
        else:
            punti.append({'z': z, 'categoria': 'FS', 'FS': rng.uniform(0.2, 2.5), 'qc1Ncs': rng.uniform(20, 240)})
    return {'punti': punti, 'falda': falda, 'passo': passo}


def attesi(pr):
    """Cedimento e LSN con integrazione numerica a passi fini: ogni punto rappresenta ±passo/2,
    tratti senza punti tra 0 e 20 m (sotto falda) ignoti; sopra falda contributo nullo."""
    passo, falda = pr['passo'], pr['falda']
    per = {}
    for p in pr['punti']:
        per[round(p['z'] / passo)] = p

    def stato(z):
        if z <= falda:
            return ('zero', 0)
        p = per.get(round(z / passo))
        if p is None or abs(p['z'] - z) > passo / 2 + 1e-12:
            return ('ignoto', 0)
        if p['categoria'] == 'FS':
            return ('noto', eps(p['FS'], p['qc1Ncs']))
        if p['categoria'] == 'ignoto':
            return ('ignoto', 0)
        if p['categoria'] == 'sopraFalda':
            return ('ignoto', 0)
        return ('zero', 0)

    h = 1e-3
    S = [0.0, 0.0]; L = [0.0, 0.0]; L10 = [0.0, 0.0]
    z = h / 2
    while z < 20:
        tipo, e = stato(z)
        lo, hi = (0.0, EPS_LIM) if tipo == 'ignoto' else (e, e)
        for i, v in enumerate((lo, hi)):
            S[i] += v / 100 * h
            L[i] += 1000 * v / 100 / z * h
            if z < 10:
                L10[i] += 1000 * v / 100 / z * h
        z += h
    return [S[0], S[1], L[0], L[1], L10[0], L10[1]]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--casi', type=int, default=3000)
    ap.add_argument('--seme', type=int, default=11)
    a = ap.parse_args()
    rng = random.Random(a.seme)
    casi = [[rng.choice([rng.uniform(0, 2.6)] * 3 + FS_NOTI), rng.choice([rng.uniform(5, 260)] * 3 + [33, 60, 80, 110, 147, 200])] for _ in range(a.casi)]
    profili = [profilo(rng) for _ in range(40)]
    out = subprocess.run(['node', '-e', RUNNER, MODULO], input=json.dumps({'eps': casi, 'profili': profili}), capture_output=True, text=True, check=True)
    r = json.loads(out.stdout)
    errori = 0
    dmax = 0.0
    for (f, q), v in zip(casi, r['e']):
        d = abs(v - eps(f, q))
        dmax = max(dmax, d)
        if d > 1e-9:
            errori += 1
            if errori < 10:
                print('εv diverso', f, q, v, eps(f, q))
    print(f'εv: {len(casi)} casi, differenza massima {dmax:.2e} %')
    dmaxp = 0.0
    for pr, v in zip(profili, r['p']):
        at = attesi(pr)
        for k, (x, y) in enumerate(zip(v, at)):
            tol = 2e-3 * max(1.0, abs(y)) if k < 2 else 1e-2 * max(1.0, abs(y))
            dmaxp = max(dmaxp, abs(x - y) / max(1.0, abs(y)))
            if abs(x - y) > tol:
                errori += 1
                if errori < 10:
                    print('profilo diverso', k, x, y)
    print(f'S e LSN: {len(profili)} profili, scarto relativo massimo {dmaxp:.2e} (integrazione numerica a passo 1 mm)')
    print('Risultato:', 'tutti i casi coincidono' if errori == 0 else f'{errori} differenze')
    sys.exit(1 if errori else 0)


if __name__ == '__main__':
    main()
