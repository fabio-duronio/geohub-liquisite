# Cedimento post-sismico da CPT e LSN

[← Torna al README](../README.md)

Modulo: `motore/cedimenti.js`. Solo con il metodo CPT (Boulanger & Idriss 2014).

**Stato (decisione del 21/11/2026).** Il cedimento di Zhang et al. (2002) resta nell'app; la replica completa delle tabelle dei due casi richiede dati non pubblicati. Il calcolo del cedimento è confrontato con la Fig. 5 dell'articolo (vedi Verifiche). L'**LSN è sperimentale** fino a una validazione indipendente: è indicato così nell'app, in stampa e nel CSV.

## Fonti
- Zhang G., Robertson P.K., Brachman R.W.I. (2002). *Estimating liquefaction-induced ground settlements from CPT for level ground*. Can. Geotech. J. 39: 1168–1180. Cedimento S = Σ εv,i·Δz,i (Eq. 1, pag. 1171); εv [%] in funzione di FS e (qc1N)cs, Appendice A, Eq. A1–A14 (pag. 1180), curve della Fig. 3 ricavate da Ishihara e Yoshimine (1992).
- Tonkin & Taylor (2015). Appendix A, *Assessment of Liquefaction Vulnerability in Christchurch*. LSN = 1000·∫ εv/z dz, con εv da Zhang et al. (2002) (§A4.3.5); studi di Christchurch sui primi 10 m (§A4.3); calcolo con B&I 2014 secondo MBIE 2014 (§A4.3.2).

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
- Tratti non indagati o senza risultato: S e LSN come intervalli; minimo con contributo nullo, massimo con la deformazione della curva limite 102·33^−0,82 = 5,80 %. Sono **limiti convenzionali del modello**, non un intervallo di confidenza né un massimo fisico garantito: con (qc1N)cs < 33 la deformazione reale può essere maggiore.
- Integrazione su 0–20 m; LSN anche su 0–10 m per confronto.
- In LSN εv entra come decimale: lo specifica la guida MBIE-NZGS «Earthquake geotechnical engineering practice», Modulo 3, nota 7 alla definizione di van Ballegooy et al. (2014) (https://www.building.govt.nz/assets/Uploads/building-code-compliance/b-stability/b1-structure/geotechnical-guidelines/module-3-liquefaction-hazards-version-1.pdf). Forma equivalente in letteratura: 10·εv[%]/z. Integrale ∫dz/z esatto in ogni tratto. Con falda al piano campagna e superficie senza dati il massimo non è limitato e viene segnalato.
- Combinazione dichiarata: curve ricavate con (qc1N)cs e FS di Robertson e Wride (1998), applicate con quelli di Boulanger e Idriss (2014).
- Partizione della verticale: la stessa dell'indice IL.
- Solo con il metodo CPT; nessuno spostamento laterale; nessuna classe di LSN.

## Verifiche
- `verifiche/verifica_cedimenti.mjs`: equazioni ai valori discreti, convenzioni, casi analitici (strato uniforme, prova interrotta, falda al p.c.), collegamento al profilo, CSV.
- `verifiche/verifica_cedimenti.py`: seconda implementazione dalle equazioni e integrazione numerica di S e LSN a passo 1 mm su profili casuali.
- `verifiche/verifica_riferimento.mjs`: confronto solo indicativo con il caso di National Academies (2024), che usa un metodo di cedimento diverso (vedi [Validazione](validazione.md)).
- `verifiche/verifica_casi_pubblicati.mjs`: profilo di esempio del Marina District, Fig. 5 di Zhang et al. (2002), con (qc1N)cs e FS digitalizzati: cedimento 10,36 cm contro 10,2 cm della figura (indicativo). La replica delle Tabelle 1 e 3 (Marina District, Treasure Island) richiede le CPT originali, che l'articolo non pubblica: non reperite.
