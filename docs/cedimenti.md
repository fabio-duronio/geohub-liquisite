# Cedimento post-sismico da CPT

[← Torna al README](../README.md)

Modulo: `motore/cedimenti.js`. Solo con il metodo CPT (Boulanger & Idriss 2014).

**Stato (decisioni del 22/11/2026, versione 1.0).** Il cedimento di Zhang et al. (2002) è chiuso: le equazioni sono implementate come pubblicate nell'originale, letto per intero, e le convenzioni elencate sotto sono decise e dichiarate nei risultati. Il confronto numerico completo con le Tabelle 1 e 3 dell'articolo non è possibile, perché le CPT dei due casi non sono pubblicate; resta il confronto con la Fig. 5 (vedi Verifiche).

L'**indice LSN non è calcolato** dalla versione 1.0 (modulo `cedimenti.js` 0.2.0): la definizione originale (van Ballegooy et al. 2014) non è stata letta. Potrà tornare in una versione successiva solo dopo la lettura della fonte originale.

## Fonti
- Zhang G., Robertson P.K., Brachman R.W.I. (2002). *Estimating liquefaction-induced ground settlements from CPT for level ground*. Can. Geotech. J. 39: 1168–1180. Cedimento S = Σ εv,i·Δz,i (Eq. 1, pag. 1171); εv [%] in funzione di FS e (qc1N)cs, Appendice A, Eq. A1–A14 (pag. 1180), curve della Fig. 3 ricavate da Ishihara e Yoshimine (1992).
- Tonkin & Taylor (2015). Appendix A, *Assessment of Liquefaction Vulnerability in Christchurch*: curve di Zhang et al. (2002) applicate con (qc1N)cs e FS di B&I 2014, secondo MBIE 2014 (§A4.3.2). Usata solo per dichiarare questa combinazione.

## Equazioni (Zhang et al. 2002, App. A)
| FS | εv [%] | campo di (qc1N)cs |
|---|---|---|
| ≤ 0,5 | 102·q^−0,82 | 33–200 |
| 0,6 | 102·q^−0,82 / 2411·q^−1,45 | 33–147 / 147–200 |
| 0,7 | 102·q^−0,82 / 1701·q^−1,42 | 33–110 / 110–200 |
| 0,8 | 102·q^−0,82 / 1690·q^−1,46 | 33–80 / 80–200 |
| 0,9 | 102·q^−0,82 / 1430·q^−1,48 | 33–60 / 60–200 |
| 1,0 | 64·q^−0,93 | 33–200 |
| 1,1 | 11·q^−0,65 | 33–200 |
| 1,2 | 9,7·q^−0,69 | 33–200 |
| 1,3 | 7,6·q^−0,71 | 33–200 |
| 2,0 | 0 | 33–200 (stampato «≤ 20»: refuso) |

Proprietà delle equazioni pubblicate, verificate: ai raccordi tra i due tratti (FS 0,6–0,9) ci sono piccoli salti (massimo circa 6 % a FS 0,9, q = 60); oltre i raccordi le curve 0,6–0,9 superano la curva limite al massimo dell'1,7 %. LiquiSite usa le equazioni come stampate, senza correzioni.

## Convenzioni adottate
- Interpolazione lineare in FS tra le curve; FS ≤ 0,5: curva limite; FS ≥ 2,0: εv = 0.
- (qc1N)cs fuori da 33–200 ricondotto al limite più vicino, con avviso; sotto 33 la scelta può sottostimare εv rispetto all'estrapolazione della curva limite (non cautelativa).
- Ic oltre la soglia dello scenario (2,6 predefinita) e punti sopra falda: εv = 0.
- Tratti non indagati o senza risultato: S come intervallo; minimo con contributo nullo, massimo con la deformazione della curva limite 102·33^−0,82 = 5,80 %. Sono **limiti convenzionali del modello**, non un intervallo di confidenza né un massimo fisico garantito: con (qc1N)cs < 33 la deformazione reale può essere maggiore.
- Integrazione su 0–20 m.
- Combinazione dichiarata: curve ricavate con (qc1N)cs e FS di Robertson e Wride (1998), applicate con quelli di Boulanger e Idriss (2014).
- Partizione della verticale: la stessa dell'indice IL.
- Solo con il metodo CPT; nessuno spostamento laterale.

## Verifiche
- `verifiche/verifica_cedimenti.mjs`: equazioni ai valori discreti, convenzioni, casi analitici (strato uniforme, prova interrotta, falda al p.c.), collegamento al profilo, CSV, assenza dell'LSN.
- `verifiche/verifica_cedimenti.py`: seconda implementazione dalle equazioni e integrazione numerica di S a passo 1 mm su profili casuali.
- `verifiche/verifica_riferimento.mjs`: confronto solo indicativo con il caso di National Academies (2024), che usa un metodo di cedimento diverso (vedi [Validazione](validazione.md)).
- `verifiche/verifica_casi_pubblicati.mjs`: profilo di esempio del Marina District, Fig. 5 di Zhang et al. (2002), con (qc1N)cs e FS digitalizzati: cedimento 10,36 cm contro 10,2 cm della figura (indicativo). La replica delle Tabelle 1 e 3 (Marina District, Treasure Island) richiede le CPT originali, che l'articolo non pubblica: non reperite.
