#!/usr/bin/env python3
"""
verifica_zs9.py — SismaSite (GeoHub)

Verifica indipendente del modulo moduli/zs9.js (v1.2.0): stessa procedura
(Linee guida LQ v1.0, pag. 30–31) riscritta in Python con librerie diverse,
e confronto dei risultati su località di controllo e punti casuali.

Differenze dall'implementazione JavaScript:
- appartenenza alla zona con shapely (Polygon.covers: il bordo è interno);
- distanza dal bordo con GeographicLib (Karney 2013, tramite pyproj.Geod) su
  lati infittiti in lon/lat (passo 1 km, poi 5 m sui lati candidati), invece
  della formula di Vincenty con ricerca a sezione aurea;
- facoltativo: rilettura dello shapefile originale con pyshp e confronto
  vertice per vertice con dati/zs9-data.json.

Uso:
    pip install pyproj shapely numpy [pyshp]
    python3 verifiche/verifica_zs9.py [ZS9.ZIP]

Richiede Node.js per eseguire il modulo JavaScript. Esce con codice 1 se un
controllo fallisce. Tolleranza sulle distanze: 5 m.
"""
import hashlib
import json
import math
import os
import random
import subprocess
import sys
import zipfile

import numpy as np
from pyproj import Geod
from shapely.geometry import Point, Polygon

RADICE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATI = os.path.join(RADICE, 'dati', 'zs9-data.json')
MODULO = os.path.join(RADICE, 'moduli', 'zs9.js')
SHA256_ATTESO = '3a15606a05e51713a2ca66065a53343e39da8b392d061141c5efa9e196ea1dc0'
TOLL_KM = 0.005

# Linee guida LQ v1.0, Tab. A1.1 (pag. 31) — trascritta qui in modo indipendente
TAB = {5.45: [922, 936], 5.91: [928],
       6.14: [901, 902, 903, 904, 907, 908, 909, 911, 912, 913, 914, 916, 917, 920, 921, 926, 932, 933, 934],
       6.37: [910, 918, 919], 6.60: [905, 906, 915, 930], 6.83: [924, 925, 931],
       7.06: [923, 927], 7.29: [929, 935]}
MW = {z: m for m, zz in TAB.items() for z in zz}
# App. 2 a ZS9 (INGV 2004), Fig. 19: «bordi morbidi» in km, letti sui colori della figura
FIG19 = {0: [913, 915, 918, 919, 923, 927, 929], 1: [921, 922, 936], 3: [904, 912, 917, 926, 928, 930],
         5: [901, 902, 903, 908, 909, 914, 916, 920, 924, 925, 931, 932, 933, 934], 8: [910, 911], 10: [905, 906, 907, 935]}
BORDO = {z: k for k, zz in FIG19.items() for z in zz}

LOC = [("L'Aquila", 42.3498, 13.3995), ('Sulmona', 42.0480, 13.9262), ('Avezzano', 42.0310, 13.4260),
       ('Norcia', 42.7925, 13.0930), ('Teramo', 42.6589, 13.7044), ('Chieti', 42.3510, 14.1675),
       ('Mirandola', 44.8870, 11.0660), ('Vigarano Mainarda', 44.8410, 11.4960), ('Pescara', 42.4618, 14.2161),
       ('Francavilla al Mare', 42.4210, 14.2870), ('Ortona', 42.3550, 14.4030), ('Lanciano', 42.2310, 14.3900),
       ('Vasto', 42.1120, 14.7080)]
ATTESI = {"L'Aquila": (True, 923, 7.06), 'Sulmona': (True, 923, 7.06), 'Avezzano': (True, 923, 7.06),
          'Norcia': (True, 923, 7.06), 'Teramo': (True, 918, 6.37), 'Chieti': (True, 918, 6.37),
          'Mirandola': (True, 912, 6.14), 'Vigarano Mainarda': (True, 912, 6.14)}

errori = []
geod = Geod(ellps='WGS84')


def check(cond, msg):
    print(('OK   ' if cond else 'ERR  ') + msg)
    if not cond:
        errori.append(msg)


def anelli(z):
    return [list(zip(r[0::2], r[1::2])) for r in z['anelli']]


def dist_lato_km(lat, lon, a, b, passo_km):
    (x1, y1), (x2, y2) = a, b
    lung = geod.inv(x1, y1, x2, y2)[2] / 1000
    n = max(2, int(math.ceil(lung / passo_km)) + 1)
    t = np.linspace(0, 1, n)
    xs, ys = x1 + t * (x2 - x1), y1 + t * (y2 - y1)
    d = geod.inv(np.full(n, lon), np.full(n, lat), xs, ys)[2]
    return float(d.min()) / 1000


def dist_zona_km(lat, lon, z):
    lati = [(r[i], r[i + 1]) for r in anelli(z) for i in range(len(r) - 1)]
    grezze = [dist_lato_km(lat, lon, a, b, 1.0) for a, b in lati]
    m = min(grezze)
    fini = [dist_lato_km(lat, lon, a, b, 0.005) for (a, b), g in zip(lati, grezze) if g <= m + 1.0]
    return min(fini)


def valuta_py(lat, lon, D, poligoni):
    dentro = [z['id'] for z in D['zone'] if poligoni[z['id']].covers(Point(lon, lat))]
    if dentro:
        zona = max(dentro, key=lambda q: (MW[q], -q))
        return {'dentro': True, 'zona': zona, 'mw': MW[zona], 'tabella': None}
    tab = []
    for z in D['zone']:
        r = dist_zona_km(lat, lon, z)
        ms = 1 + 3 * math.log10(r)
        tab.append({'zona': z['id'], 'r_km': r, 'ms': ms, 'm': MW[z['id']], 'ammissibile': ms < MW[z['id']]})
    contano = [t['m'] for t in tab if t['ammissibile']]
    return {'dentro': False, 'zona': None, 'mw': max(contano) if contano else None, 'tabella': tab}


def valuta_js(punti):
    script = ("const Z=require(process.argv[1]),D=require(process.argv[2]);"
              "const P=JSON.parse(require('fs').readFileSync(0,'utf8'));"
              "process.stdout.write(JSON.stringify(P.map(([a,b])=>{const r=Z.valuta(a,b,D);"
              "return {esito:r.esito,dentro:r.dentro,zona:r.zona,mw:r.mw,tabella:r.tabella,avvisi:r.avvisi.map(a=>a.codice)};})));")
    out = subprocess.run(['node', '-e', script, MODULO, DATI], input=json.dumps(punti),
                         capture_output=True, text=True, check=True).stdout
    return json.loads(out)


def confronta(nome, py, js):
    if py['dentro'] != js['dentro'] or py['zona'] != js['zona'] or py['mw'] != js['mw']:
        return f'{nome}: Python {py["zona"]}/{py["mw"]}, JS {js["zona"]}/{js["mw"]}'
    if py['tabella']:
        tj = {t['zona']: t for t in js['tabella']}
        for t in py['tabella']:
            q = tj[t['zona']]
            if abs(t['r_km'] - q['r_km']) > TOLL_KM:
                return f'{nome}: zona {t["zona"]}, R Python {t["r_km"]:.4f} km, JS {q["r_km"]:.4f} km'
            if t['ammissibile'] != q['ammissibile']:
                return f'{nome}: zona {t["zona"]}, esito Ms < M diverso'
    return None


def main():
    raw = open(DATI, 'rb').read()
    sha = hashlib.sha256(raw).hexdigest()
    check(sha == SHA256_ATTESO, f'dati/zs9-data.json: SHA-256 {sha}')
    D = json.loads(raw)
    check(sorted(z['id'] for z in D['zone']) == list(range(901, 937)), 'dati: 36 zone 901–936')
    check(sorted(MW) == list(range(901, 937)), 'Tab. A1.1 (trascrizione indipendente): 36 zone')
    check(sorted(BORDO) == list(range(901, 937)), 'Fig. 19 di App. 2 (trascrizione indipendente): 36 zone')

    poligoni = {}
    for z in D['zone']:
        rr = anelli(z)
        poligoni[z['id']] = Polygon(rr[0], rr[1:])
    check(all(p.is_valid for p in poligoni.values()), 'shapely: 36 poligoni validi (nessun lato che si interseca)')
    # sovrapposizioni: area dell'intersezione tra zone diverse
    sovr = 0.0
    ids = sorted(poligoni)
    for i, a in enumerate(ids):
        for b in ids[i + 1:]:
            if poligoni[a].intersects(poligoni[b]):
                sovr = max(sovr, poligoni[a].intersection(poligoni[b]).area)
    check(sovr < 1e-9, f'zone senza sovrapposizioni (area massima di intersezione {sovr:.2e} gradi²)')

    if len(sys.argv) > 1:
        import shapefile  # pyshp
        with zipfile.ZipFile(sys.argv[1]) as zf:
            nomi = {os.path.basename(n).lower(): n for n in zf.namelist()}
            import io
            sf = shapefile.Reader(shp=io.BytesIO(zf.read(nomi['zs9.shp'])), dbf=io.BytesIO(zf.read(nomi['zs9.dbf'])),
                                  shx=io.BytesIO(zf.read(nomi['zs9.shx'])))
            orig = {int(rec['ZS9_ID']): sh.points for rec, sh in zip(sf.records(), sf.shapes())}
        diff = 0.0
        for z in D['zone']:
            pts = [p for r in anelli(z) for p in r]
            diff = max(diff, max(max(abs(a[0] - b[0]), abs(a[1] - b[1])) for a, b in zip(pts, orig[z['id']])))
            if len(pts) != len(orig[z['id']]):
                diff = float('inf')
        check(diff <= 5e-7, f'shapefile originale (pyshp) e JSON: stessi vertici, scarto massimo {diff:.1e}°')

    # località di controllo
    js = valuta_js([[la, lo] for _, la, lo in LOC])
    for (nome, la, lo), j in zip(LOC, js):
        p = valuta_py(la, lo, D, poligoni)
        e = confronta(nome, p, j)
        att = ATTESI.get(nome)
        if att:
            ok_att = (p['dentro'], p['zona'], p['mw']) == att
        else:
            ok_att = (not p['dentro']) and p['mw'] == 7.06 and len(p['tabella']) == 36
        dett = (f'zona {p["zona"]}' if p['dentro'] else
                f'fuori zona, R min {min(t["r_km"] for t in p["tabella"]):.3f} km, Mw {p["mw"]}')
        check(e is None and ok_att, f'{nome}: {dett}; Python = JS' + (f' — {e}' if e else ''))

    # punti casuali nell'area delle zone (seme fisso: risultato riproducibile)
    random.seed(20261115)
    punti = [[random.uniform(37.0, 46.5), random.uniform(7.0, 18.5)] for _ in range(150)]
    js = valuta_js(punti)
    discord, dmax, n_fuori = [], 0.0, 0
    for (la, lo), j in zip(punti, js):
        p = valuta_py(la, lo, D, poligoni)
        e = confronta(f'({la:.4f}, {lo:.4f})', p, j)
        if e:
            discord.append(e)
        if p['tabella']:
            atteso = any(t['r_km'] < max(BORDO[t['zona']], 0.5) for t in p['tabella'])
            if atteso != ('vicino_bordo' in j['avvisi']):
                discord.append(f'({la:.4f}, {lo:.4f}): avviso sul bordo atteso {atteso}')
            n_fuori += 1
            tj = {t['zona']: t['r_km'] for t in j['tabella']}
            dmax = max(dmax, max(abs(t['r_km'] - tj[t['zona']]) for t in p['tabella']))
    check(not discord, f'150 punti casuali ({n_fuori} esterni, {n_fuori * 36} distanze): esito, zona, Mw e avviso sul bordo identici; '
                       f'scarto massimo sulle distanze {dmax * 1000:.2f} m' + ('' if not discord else ' — ' + discord[0]))

    print(f'\n{"Tutti i controlli superati." if not errori else str(len(errori)) + " controlli falliti."}')
    sys.exit(1 if errori else 0)


if __name__ == '__main__':
    main()
