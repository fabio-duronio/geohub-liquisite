#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
digitalizza_fusi.py — ricava le coordinate dei fusi granulometrici della Fig. 7.11.1
delle NTC 2018 dalle immagini del testo ufficiale.

Fonte: D.M. 17/01/2018, S.O. n. 8 alla G.U. n. 42 del 20/02/2018, pag. 280
(pagina 284 del PDF della Gazzetta). Le due figure sono immagini raster
(605×395 e 605×405 pixel): non esistono coordinate numeriche ufficiali.

Metodo:
  1. calibrazione degli assi sulle linee della griglia (decadi del diametro su scala
     logaritmica da 0,001 a 100 mm; passante dallo 0 al 100 %);
  2. pixel della curva = pixel neri non appartenenti alle linee della griglia;
  3. ciascuna curva è seguita per continuità dal basso verso l'alto, riga per riga,
     prendendo il centro del tratto nero più vicino alla posizione precedente;
  4. il risultato è campionato a passi interi di passante (2–98 %).

Uso (con le immagini estratte dal PDF, ad es. pdfimages -f 284 -l 284 -png):
    python3 strumenti/digitalizza_fusi.py img-000.png img-001.png dati/fusi-ntc2018.json
Richiede: Pillow, numpy.
"""
import json
import math
import sys

import numpy as np
from PIL import Image


def calibra(a):
    """Colonne delle decadi e righe della griglia dalle linee scure lunghe."""
    scuro = a < 160
    colonne = [i for i, v in enumerate(scuro.sum(0)) if v > 150]
    righe = [i for i, v in enumerate(scuro.sum(1)) if v > 300]
    # le decadi sono le linee distanziate in modo regolare di circa 95 px
    x0 = colonne[0]
    dec = [c for c in colonne if any(abs(c - (x0 + k * 95.2)) < 2.5 for k in range(6))]
    if len(dec) != 6:
        raise RuntimeError('calibrazione x non riuscita: %s' % dec)
    passo_x = (dec[-1] - dec[0]) / 5.0
    y100, y0 = righe[1], righe[-1]  # righe[0] è il bordo superiore delle etichette Limo/Sabbia/Ghiaia
    return dec[0], passo_x, y0, y100, set(colonne), set(righe)


def segui(a, griglia_x, griglia_y, y0, y100, x_inizio, verso_destra_max=60):
    """Segue una curva dal basso (y0) verso l'alto (y100) partendo vicino a x_inizio."""
    h, w = a.shape
    nero = a < 90
    punti = []
    x_prec = x_inizio
    for y in range(y0 - 3, y100 - 1, -1):
        if y in griglia_y:
            continue
        riga = nero[y].copy()
        for c in griglia_x:  # colma le linee verticali della griglia
            if 0 < c < w - 1 and riga[c - 1] and riga[c + 1]:
                riga[c] = True
            elif c < w:
                riga[c] = riga[c] and (c > 0 and riga[c - 1] or c < w - 1 and riga[c + 1])
        tratti, i = [], 0
        while i < w:
            if riga[i]:
                j = i
                while j + 1 < w and riga[j + 1]:
                    j += 1
                if 2 <= j - i + 1 <= 6:  # esclude freccia orizzontale e testi larghi
                    tratti.append((i + j) / 2.0)
                i = j + 1
            else:
                i += 1
        vicini = [t for t in tratti if abs(t - x_prec) <= 4]
        if not vicini:
            continue
        x = min(vicini, key=lambda t: abs(t - x_prec))
        punti.append((x, y))
        x_prec = x
    return punti


def campiona(punti, x0, passo_x, y0, y100):
    """Converte in (d mm, p %) e ricampiona a passante intero con interpolazione su log d."""
    pd = sorted(((y0 - y) / (y0 - y100) * 100.0, -3 + (x - x0) / passo_x) for x, y in punti)
    p_min, p_max = pd[0][0], pd[-1][0]
    out = []
    for p in range(math.ceil(p_min), math.floor(p_max) + 1):
        for (pa, la), (pb, lb) in zip(pd, pd[1:]):
            if pa <= p <= pb and pb > pa:
                out.append([p, round(10 ** (la + (lb - la) * (p - pa) / (pb - pa)), 5)])
                break
    return out


def digitalizza(file, inizi):
    a = np.array(Image.open(file).convert('L')).astype(int)
    x0, passo_x, y0, y100, gx, gy = calibra(a)
    curve = [campiona(segui(a, gx, gy, y0, y100, xi), x0, passo_x, y0, y100) for xi in inizi]
    return {'calibrazione': {'x_0_001mm': x0, 'px_per_decade': round(passo_x, 2), 'y_0pct': y0, 'y_100pct': y100},
            'sinistra': curve[0], 'destra': curve[1]}


def main():
    fa, fb, uscita = sys.argv[1:4]
    # posizioni di partenza (pixel) dei piedi delle curve, lette sulle immagini
    risultato = {
        'fonte': 'D.M. 17/01/2018 (NTC 2018), Fig. 7.11.1, S.O. n. 8 alla G.U. n. 42 del 20/02/2018, pag. 280',
        'metodo': 'digitalizzazione delle immagini ufficiali con strumenti/digitalizza_fusi.py; '
                  'coppie [passante %, diametro mm]; curva sinistra = limite fine, destra = limite grossolano',
        'risoluzione': '1 pixel ≈ 0,0105 decadi in d (≈ 2,5 %) e ≈ 0,35 % di passante; spessore delle curve ≈ 3 pixel',
        'a_Uc_minore_3_5': digitalizza(fa, [182, 366]),
        'b_Uc_maggiore_3_5': digitalizza(fb, [117, 356]),
    }
    with open(uscita, 'w', encoding='utf-8') as f:
        json.dump(risultato, f, ensure_ascii=False, indent=1)
    for k in ('a_Uc_minore_3_5', 'b_Uc_maggiore_3_5'):
        r = risultato[k]
        print(k, r['calibrazione'], 'sinistra', r['sinistra'][0], r['sinistra'][-1], len(r['sinistra']),
              'destra', r['destra'][0], r['destra'][-1], len(r['destra']))


if __name__ == '__main__':
    main()
