# Indice del potenziale di liquefazione IL (Iwasaki)

[← Torna al README](../README.md)

Modulo: `motore/indici.js`, separato dal motore di innesco: usa i FS già calcolati. Verifiche: `verifiche/verifica_il.mjs`.

## Formula

IL = ∫₀²⁰ F(z)·w(z) dz, con w(z) = 10 − 0,5·z e F = 1 − FS se FS ≤ 1, altrimenti 0.

F è la severità di Iwasaki, non il fattore di sicurezza: F = 0 vuol dire contributo nullo all'indice, F = 1 contributo massimo. Per evitare confusioni con un FS nullo, nell'app e in stampa si scrive «contributo nullo / massimo», mai «F = 0».

Attribuzione: Iwasaki et al. (1978). Fonti consultate integralmente e citate in stampa: Linee guida MS per le liquefazioni LQ v1.0 (2018), pag. 9; volume CNR-CentroMS *Pratiche correnti per le analisi di suscettibilità alla liquefazione negli studi di microzonazione sismica di livello 3* (2024), Eq. 3.73–3.74, pag. 36 (la 3.74d a pag. 37), che attribuisce esplicitamente l'indice a Iwasaki et al. (1978). Formula verificata il 21/11/2026 su due testi degli stessi autori, letti per intero: Iwasaki T., Tokida K., Tatsuoka F. (1981), *Soil liquefaction potential evaluation with use of the simplified procedure*, 1st Int. Conf. on Recent Advances in Geotechnical Earthquake Engineering and Soil Dynamics, St. Louis, Eq. (5), pag. 210; Tatsuoka F., Iwasaki T., Tokida K., Yasuda S., Hirose M., Imai T., Kon-no M. (1980), *Standard penetration tests and soil liquefaction potential evaluation*, Soils and Foundations 20(4), 95–111, Eq. (29a), pag. 107. Coincidono con la formula usata. La pubblicazione del 1978 (Proc. 2nd Int. Conf. on Microzonation, San Francisco, pp. 885–896; Vol. II secondo Tatsuoka et al. 1980, Vol. 1 secondo altre bibliografie) non è stata reperita. Nota: la bibliografia delle Linee guida riporta Iwasaki et al. (1982).

Nessuna classe: classi e zone appartengono alla microzonazione; per la verifica di sito l'indice è riportato con il suo valore e il giudizio resta del progettista. Le classi di Youd (2001) e delle Linee guida LQ sono escluse dalla versione 1.0; nessuna nuova classe senza una fonte verificata (decisione del 21/11/2026).

## Discretizzazione (scelta di LiquiSite)

- Ogni punto rappresenta l'intervallo fino a metà distanza dai punti adiacenti. Se la falda di verifica cade tra due punti consecutivi, il confine tra i due è la falda stessa: il punto non saturo non si estende sotto la falda e quello saturo arriva fino alla falda. Verso un vuoto maggiore di 3 volte il passo mediano, e agli estremi del profilo, il punto copre metà del passo mediano.
- F è costante nell'intervallo; l'integrale del peso è esatto: ∫ w dz = 10·(b − a) − 0,25·(b² − a²).
- **Prove SPT** (decisione del 21/11/2026): la rappresentatività di ogni prova è limitata allo strato della stratigrafia che la contiene. L'intervallo del punto, calcolato come sopra, è tagliato ai limiti dello strato: nessuna estensione automatica ad altri strati. Le parti di strati senza prova restano senza risultato e allargano l'intervallo IL_min–IL_max. L'assunzione è dichiarata nei risultati (`IL_LIMITE_STRATO`). Le prove CPT, a profilo continuo, non sono interessate.

## Trattamento dei tratti

| Tratto | FS | Contributo all'indice | Note |
|---|---|---|---|
| Verificato | calcolato | (1 − FS)·w se FS ≤ 1, altrimenti nullo | |
| Sopra la falda di verifica | non applicabile | nullo | terreno non saturo; vale tra 0 e la falda anche senza dati |
| Ic oltre soglia (CNR 2024, §3.2.1.2, pag. 32: Ic ≤ 2,6, soglia adattabile tra 2,4 e 2,8) | **N.A.**, non calcolato | F(z) = 0 per **convenzione operativa di calcolo**, dichiarata | escluso dal criterio di applicabilità CPT: non equivale a un FS nullo e non coincide con la condizione FS > 1 della definizione di F(z); spessore riportato a parte; l'esclusione non dimostra l'assenza di perdita di resistenza ciclica (terreni fini sensibili o di transizione: verifica specifica con granulometria, limiti di Atterberg, criteri di suscettibilità) |
| Dato mancante, non valido, non calcolato, fuori stratigrafia, oltre 20 m, non indagato | non disponibile | ignoto | nullo in IL_min, massimo possibile (F = 1) in IL_max |

L'indice è **completo** solo se in 0–20 m non ci sono tratti ignoti; altrimenti si riporta l'intervallo IL_min–IL_max e lo spessore ignoto. IL_min e IL_max sono **limiti convenzionali del modello** (tratti ignoti con contributo nullo e con contributo massimo del modello): non sono un intervallo di confidenza né un massimo fisico garantito. Nessun tratto ignoto è considerato sicuro.

## Verifiche

- Profili analitici: FS 0,5 su 0–20 m → 50; FS 0 → 100; strato 5–10 m con FS 0 → 31,25; falda a 4 m con FS 0 sotto → 64; profilo fino a 10 m con FS 0,5 → IL_min 37,5, IL_max 62,5.
- Lettura mancante, vuoti di prova, tratti argillosi, SPT radi, input non validi.
- Limiti di strato per le SPT: copertura ridotta allo strato, valore atteso su un caso analitico, limiti non validi rifiutati, nessun effetto sulle CPT.
- Seconda implementazione per campionamento fitto (200 000 campioni) su 300 profili casuali: differenza massima ~6·10⁻¹³.
- Collegamento con il profilo dell'esempio sintetico.

- Casi pubblicati, solo indicativi (`verifiche/verifica_casi_pubblicati.mjs`): profili FL digitalizzati dalle Fig. 2 e 3 di Iwasaki et al. (1981). Showa Bridge Br. 1 (Tab. 1, PL 28,2): LiquiSite dà 20,9–42,2, perché la figura non ha FL sopra 2,5 m; estendendo il primo valore fino al piano campagna si ottiene 29,5. Nishi Oh-Hata-Cho (Tab. 1, PL 0,4): 0,11–1,07.

## Sviluppi

- Pubblicazione del 1978 non reperita (decisione del 21/11/2026: nessuna eccezione dichiarata alla regola delle fonti originali). La formula è verificata sui testi del 1980 e del 1981 degli stessi autori.
- Un caso con profilo tabellato, non digitalizzato, renderebbe il confronto non solo indicativo.
