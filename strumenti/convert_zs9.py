#!/usr/bin/env python3
"""
convert_zs9.py — SismaSite (GeoHub)

Converte lo shapefile ufficiale della zonazione sismogenetica ZS9 (INGV) in un
file JSON compatto per il modulo moduli/zs9.js.

Uso:
    python3 strumenti/convert_zs9.py <ZS9.ZIP | cartella con zs9.shp/.dbf> [dati/zs9-data.json]

Fonte:
    ZS9.ZIP (zs9.shp, zs9.shx, zs9.dbf, file del 06/05/2004), pagina
    https://zonesismiche.mi.ingv.it/elaborazioni/dati_di_ingresso/
    Meletti C., Galadini F., Valensise G., Stucchi M., Basili R., Barba S.,
    Vannucci G., Boschi E. (2004). Zonazione sismogenetica ZS9 [Data set]. INGV,
    https://doi.org/10.13127/sh/zs9 — licenza CC BY 4.0 (scheda data.ingv.it/dataset/344).

Scelte:
- lettura diretta dei formati .shp/.dbf (solo libreria standard di Python);
- tipo di geometria atteso: POLYGON (5); 36 zone con ZS9_ID da 901 a 936;
- coordinate come nel file (gradi decimali lon/lat), arrotondate a 6 decimali
  (circa 0,1 m): nessuna riproiezione;
- il file non contiene un .prj: il datum non è dichiarato. Lo scarto tra i
  datum in uso in Italia (ED50, WGS84) è dell'ordine di 100 m, trascurabile
  alla scala delle zone; il modulo lo dichiara nei testi;
- ogni anello è salvato come array piatto [lon0, lat0, lon1, lat1, ...]
  chiuso (primo punto = ultimo punto);
- nessuna data di generazione nel file: dallo stesso ZS9.ZIP si ottiene sempre
  lo stesso file, byte per byte (l'impronta SHA-256 è riproducibile).

Controlli eseguiti (il programma si ferma se uno fallisce):
- 36 record, ZS9_ID unici e pari a 901..936;
- anelli chiusi, almeno 4 vertici, coordinate entro il riquadro dell'Italia.
"""
import io
import json
import os
import struct
import sys
import zipfile

ATTESI = set(range(901, 937))


def leggi_sorgente(src):
    """Restituisce (bytes .shp, bytes .dbf, nome del file sorgente)."""
    if os.path.isdir(src):
        nomi = {n.lower(): os.path.join(src, n) for n in os.listdir(src)}
        return open(nomi['zs9.shp'], 'rb').read(), open(nomi['zs9.dbf'], 'rb').read(), src
    with zipfile.ZipFile(src) as z:
        nomi = {os.path.basename(n).lower(): n for n in z.namelist()}
        return z.read(nomi['zs9.shp']), z.read(nomi['zs9.dbf']), os.path.basename(src)


def leggi_dbf(b):
    n = struct.unpack('<I', b[4:8])[0]
    hl, rl = struct.unpack('<HH', b[8:12])
    campi, o = [], 32
    while b[o] != 0x0D:
        nome = b[o:o + 11].split(b'\0')[0].decode('ascii')
        campi.append((nome, b[o + 16]))
        o += 32
    righe = []
    for i in range(n):
        r = b[hl + i * rl: hl + (i + 1) * rl]
        p, v = 1, {}
        for nome, ln in campi:
            v[nome] = r[p:p + ln].decode('latin-1').strip()
            p += ln
        righe.append(v)
    return righe


def leggi_shp(b):
    tipo = struct.unpack('<i', b[32:36])[0]
    if tipo != 5:
        raise SystemExit(f'tipo di geometria {tipo}: atteso POLYGON (5)')
    o, poligoni = 100, []
    while o < len(b):
        _, lung = struct.unpack('>ii', b[o:o + 8])
        c = o + 8
        st = struct.unpack('<i', b[c:c + 4])[0]
        if st != 5:
            raise SystemExit(f'record con geometria {st}: atteso POLYGON (5)')
        nparti, npunti = struct.unpack('<ii', b[c + 36:c + 44])
        parti = list(struct.unpack(f'<{nparti}i', b[c + 44:c + 44 + 4 * nparti]))
        pp = c + 44 + 4 * nparti
        pts = [struct.unpack('<2d', b[pp + 16 * k: pp + 16 * k + 16]) for k in range(npunti)]
        anelli = [pts[s:e] for s, e in zip(parti, parti[1:] + [npunti])]
        poligoni.append(anelli)
        o += 8 + 2 * lung
    return poligoni


def area_firmata(an):
    return 0.5 * sum(x0 * y1 - x1 * y0 for (x0, y0), (x1, y1) in zip(an, an[1:]))


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    src = sys.argv[1]
    dst = sys.argv[2] if len(sys.argv) > 2 else os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'dati', 'zs9-data.json')
    shp, dbf, nome_src = leggi_sorgente(src)
    attributi, geometrie = leggi_dbf(dbf), leggi_shp(shp)
    if len(attributi) != len(geometrie) or len(geometrie) != 36:
        raise SystemExit(f'record: {len(geometrie)} geometrie, {len(attributi)} attributi; attesi 36')

    zone, n_vertici = [], 0
    for att, anelli in zip(attributi, geometrie):
        zid = int(att['ZS9_ID'])
        out = []
        for an in anelli:
            if len(an) < 4 or an[0] != an[-1]:
                raise SystemExit(f'zona {zid}: anello non chiuso o con meno di 4 vertici')
            for x, y in an:
                if not (6 <= x <= 19.5 and 36 <= y <= 47.5):
                    raise SystemExit(f'zona {zid}: vertice fuori dal riquadro dell\'Italia ({x}, {y})')
            piatto = []
            for x, y in an:
                piatto += [round(x, 6), round(y, 6)]
            out.append(piatto)
            n_vertici += len(an)
        zone.append({'id': zid, 'anelli': out,
                     'n_anelli': len(anelli),
                     'area_firmata_gradi2': [round(area_firmata(a), 4) for a in anelli]})
    ids = [z['id'] for z in zone]
    if set(ids) != ATTESI or len(ids) != 36:
        raise SystemExit('ZS9_ID diversi da 901..936')
    zone.sort(key=lambda z: z['id'])
    for z in zone:   # informazioni di controllo, non servono al modulo
        del z['n_anelli'], z['area_firmata_gradi2']

    dati = {
        'meta': {
            'formato': 'geohub-zs9/1',
            'contenuto': 'Zonazione sismogenetica ZS9: 36 zone (ZS9_ID 901-936), poligoni in gradi decimali [lon, lat]',
            'fonte': 'Istituto Nazionale di Geofisica e Vulcanologia (INGV)',
            'file_sorgente': 'ZS9.ZIP (zs9.shp, zs9.dbf, file del 06/05/2004)',
            'url': 'https://zonesismiche.mi.ingv.it/elaborazioni/dati_di_ingresso/',
            'doi': '10.13127/sh/zs9',
            'licenza': 'CC BY 4.0',
            'citazione': 'Meletti C., Galadini F., Valensise G., Stucchi M., Basili R., Barba S., Vannucci G., Boschi E. (2004). Zonazione sismogenetica ZS9 [Data set]. Istituto Nazionale di Geofisica e Vulcanologia (INGV). https://doi.org/10.13127/sh/zs9',
            'datum': 'non dichiarato (shapefile senza .prj); scarto tra i datum in uso dell\'ordine di 100 m',
            'modifiche': 'conversione in JSON; coordinate arrotondate a 6 decimali; nessuna riproiezione',
            'n_zone': 36,
            'n_vertici': n_vertici,
            'generatore': 'strumenti/convert_zs9.py',
        },
        'zone': zone,
    }
    with open(dst, 'w', encoding='utf-8') as f:
        json.dump(dati, f, ensure_ascii=False, separators=(',', ':'))
        f.write('\n')
    print(f'{dst}: 36 zone, {n_vertici} vertici, {os.path.getsize(dst)} byte')


if __name__ == '__main__':
    main()
