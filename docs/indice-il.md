# Indice del potenziale di liquefazione IL (Iwasaki)

[← Torna al README](../README.md)

Modulo: `motore/indici.js` (separato da `motore/liquisite.js`, che resta invariato). Verifiche: `verifiche/verifica_il.mjs`.

## Formula

IL = ∫₀²⁰ F(z)·w(z) dz, con w(z) = 10 − 0,5·z e F = 1 − FS se FS ≤ 1, altrimenti 0.

F è la severità di Iwasaki, non il fattore di sicurezza: F = 0 vuol dire contributo nullo all'indice, F = 1 contributo massimo. Per evitare confusioni con un FS nullo, nell'app e in stampa si scrive «contributo nullo / massimo», mai «F = 0».

Attribuzione: Iwasaki et al. (1978). Fonti consultate integralmente e citate in stampa: Linee guida MS per le liquefazioni LQ v1.0 (2018), pag. 9; volume CNR-CentroMS *Pratiche correnti per le analisi di suscettibilità alla liquefazione negli studi di microzonazione sismica di livello 3* (2024), Eq. 3.73–3.74, pag. 36 (la 3.74d a pag. 37), che attribuisce esplicitamente l'indice a Iwasaki et al. (1978). La pubblicazione originale non è stata consultata direttamente; si citano le fonti effettivamente consultate mantenendo l'attribuzione originaria. Nota: la bibliografia delle Linee guida riporta Iwasaki et al. (1982).

Nessuna classe: classi e zone appartengono alla microzonazione; per la verifica di sito l'indice è riportato con il suo valore e il giudizio resta del progettista.

## Discretizzazione (scelta di LiquiSite)

- Ogni punto rappresenta l'intervallo fino a metà distanza dai punti adiacenti. Verso un vuoto maggiore di 3 volte il passo mediano, e agli estremi del profilo, il punto copre metà del passo mediano.
- F è costante nell'intervallo; l'integrale del peso è esatto: ∫ w dz = 10·(b − a) − 0,25·(b² − a²).
- Per le SPT ogni prova rappresenta quindi l'intervallo fino a metà distanza dalle prove adiacenti: è un'assunzione forte, dichiarata.

## Trattamento dei tratti

| Tratto | F | Note |
|---|---|---|
| Tratto | FS | Contributo all'indice | Note |
|---|---|---|---|
| Verificato | calcolato | (1 − FS)·w se FS ≤ 1, altrimenti nullo | |
| Sopra la falda di verifica | non applicabile | nullo | terreno non saturo; vale tra 0 e la falda anche senza dati |
| Ic oltre soglia (CNR 2024, §3.2.1.2, pag. 32: Ic ≤ 2,6, soglia adattabile tra 2,4 e 2,8) | **N.A.**, non calcolato | F(z) = 0 per **convenzione operativa di calcolo**, dichiarata | escluso dal criterio di applicabilità CPT: non equivale a un FS nullo e non coincide con la condizione FS > 1 della definizione di F(z); spessore riportato a parte; l'esclusione non dimostra l'assenza di perdita di resistenza ciclica (terreni fini sensibili o di transizione: verifica specifica con granulometria, limiti di Atterberg, criteri di suscettibilità) |
| Dato mancante, non valido, non calcolato, fuori stratigrafia, oltre 20 m, non indagato | non disponibile | ignoto | nullo in IL_min, massimo possibile (F = 1) in IL_max |

L'indice è **completo** solo se in 0–20 m non ci sono tratti ignoti; altrimenti si riporta l'intervallo IL_min–IL_max e lo spessore ignoto. Nessun tratto ignoto è considerato sicuro.

## Verifiche

- Profili analitici: FS 0,5 su 0–20 m → 50; FS 0 → 100; strato 5–10 m con FS 0 → 31,25; falda a 4 m con FS 0 sotto → 64; profilo fino a 10 m con FS 0,5 → IL_min 37,5, IL_max 62,5.
- Lettura mancante, vuoti di prova, tratti argillosi, SPT radi, input non validi.
- Seconda implementazione per campionamento fitto (200 000 campioni) su 300 profili casuali: differenza massima ~6·10⁻¹³.
- Collegamento con il profilo dell'esempio sintetico.

## Aperto

- Approfondimento da leggere in testo completo (segnalato dall'autore; testo completo non reperito, quindi non citato come fonte consultata): Iwasaki T., Arakawa T., Tokida K.-I. (1984). Simplified procedures for assessing soil liquefaction during earthquakes. International Journal of Soil Dynamics and Earthquake Engineering 3(1), 49–58. doi:10.1016/0261-7277(84)90027-5.
- Testo accessibile per un controllo incrociato (non ancora letto integralmente, quindi non citato come fonte): Iwasaki T., Tokida K., Tatsuoka F. (1981). Soil liquefaction potential evaluation with use of the simplified procedure. 1st Int. Conf. on Recent Advances in Geotechnical Earthquake Engineering and Soil Dynamics, St. Louis (Missouri S&T Scholars' Mine, accesso aperto).
- Almeno un caso completo di riferimento con IL pubblicato.
- Rappresentatività delle SPT (intervallo fino a metà distanza dalle prove adiacenti).
