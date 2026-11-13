# Validazione

Come sono controllati i calcoli di LiquiSite.

[← Torna al README](../README.md)

La validazione si articola su quattro livelli distinti.

- **Valori pubblicati dagli autori.** `verifica_motore.mjs` contiene tre gruppi di confronti:
  - l'esempio numerico completo di Cetin et al. (2018, MethodsX: Tab. 3 ed Eq. 29–54);
  - i valori dichiarati nel testo di Boulanger & Idriss (2014);
  - le letture delle figure di Boulanger & Idriss (2014) e di Kayen et al. (2013).
- **Seconda implementazione indipendente.** Gli script Python ricalcolano senza riusare codice dell'app:
  - `verifica_indipendente.py` copre i quattro metodi di innesco, su 8000 casi casuali;
  - `verifica_cedimenti.py` copre la deformazione volumetrica di Zhang et al. (2002) su 3000 casi, con scarto massimo 9·10⁻¹⁶. Ricalcola anche cedimento e LSN su profili casuali con integrazione numerica a passo 1 mm.
  - L'indice IL è ricontrollato per campionamento fitto su 300 profili casuali, con scarto massimo circa 6·10⁻¹³.
- **Casi analitici e proprietà.** Ecco cosa si controlla:
  - profili con soluzione esatta: IL = 50 per FS 0,5 su 0–20 m; cedimento di uno strato uniforme;
  - criteri di esclusione sulle soglie;
  - input non validi, dati mancanti e vuoti di indagine;
  - coerenza tra tabelle, CSV, grafici e progetto salvato;
  - prove casuali ripetibili (seme fisso).
- **Confronto con un calcolo pubblicato completo** (vedi sotto).

## Caso di riferimento: National Academies (2024), App. G

Fonte: *Pile Design for Downdrag: Examples and Supporting Materials*, Appendice G, Design Example 5 (Blytheville, Arkansas). È una verifica Boulanger & Idriss (2014) da CPTU, Evento 1: a_max 0,10 g, M_w 6,5, falda a 1 ft. Le Tabelle G3–G7 sono trascritte in `verifiche/dati/nasem2024-blytheville.json`; il test è `verifiche/verifica_riferimento.mjs`.

| Confronto | Esito |
|---|---|
| Punto calcolato in dettaglio a 24,93 ft (Tab. G4) | FS 1,090 contro 1,08 pubblicato |
| Profilo intero: 58 righe sotto falda entro 20 m (Tab. G5–G6) | C_N, q_c1N, q_c1Ncs entro lo 0,15 %; r_d, K_σ, MSF, CSR, CRR entro l'arrotondamento della tabella (2 decimali) |

**Note sul confronto.**

- **Ic.** L'esempio calcola l'esponente n con l'iterazione di Robertson (2009); LiquiSite usa la regola di Robertson & Wride (1998) adottata da Boulanger & Idriss (2014). Per confrontare la catena di calcolo il test impone il contenuto di fini ricavato dall'Ic pubblicato. Con l'Ic calcolato da LiquiSite il FS cambia di qualche punto percentuale, per esempio 1,13 contro 1,08 a 24,77 ft.
- **Convenzioni dell'esempio non adottate da LiquiSite:**
  - q_c1Ncs limitato a 254 anche fuori dal calcolo dell'esponente m;
  - CRR limitato a 2,0;
  - FS posto pari a 2,0 dove Ic ≥ 2,6;
  - peso di volume stimato dalla CPT.
- **Refusi del documento**, senza effetto sui valori numerici:
  - nella Tabella G7 la colonna «FS» contiene il parametro FS_α del metodo dei cedimenti, non il fattore di sicurezza;
  - nella Tabella G5 la colonna «σ'vo» contiene la tensione totale;
  - nelle formule stampate le Eq. 2, 8 e 20 contengono errori di trascrizione.
- **Cedimento.** L'esempio usa Yoshimine et al. (2006), non Zhang et al. (2002): il confronto è solo indicativo. Con Zhang si ottiene circa 1,8 in contro 2,46 in, anche perché sono pubblicate solo le righe a passo 0,984 ft.

## Eseguire le verifiche

Servono Node.js (18 o successivo) e Python 3, senza dipendenze esterne. Dalla radice del repository:

```bash
for f in verifiche/*.mjs; do node "$f"; done
python3 verifiche/verifica_indipendente.py
python3 verifiche/verifica_cedimenti.py
```

| Script | Contenuto | Controlli |
|---|---|---|
| `verifica_motore.mjs` | valori pubblicati dagli autori | 123 |
| `verifica_robustezza.mjs` | input non validi, soglie, stati di esito, convergenza | 262 |
| `verifica_esclusione.mjs` | criteri 1–4 e fusi digitalizzati della Fig. 7.11.1 | 33 |
| `verifica_profilo.mjs` | profilo, importazione, unità, CSV, progetto JSON | 107 |
| `verifica_il.mjs` | indice IL: profili analitici e seconda implementazione | 51 |
| `verifica_preliminare.mjs` | verifica preliminare per strato e per sito, carta di comportamento | 49 |
| `verifica_cedimenti.mjs` | equazioni di Zhang et al. (2002), cedimento, LSN | 50 |
| `verifica_riferimento.mjs` | caso pubblicato National Academies (2024) | 24 |
| `verifica_casuale.mjs` | prove casuali ripetibili (opzioni `--casi`, `--seme`) | 20 |
| `verifica_restituzione.mjs` | coerenza di Ic tra grafici, tabelle e CSV | 6 |
| `verifica_usabilita.mjs` | decimali, intestazioni senza dati, incolla da foglio elettronico | 12 |

In totale sono 737 controlli JavaScript, più i due confronti Python. Ogni script termina con codice di uscita diverso da zero se un controllo non è superato.

## Limiti della validazione

I test controllano che le equazioni siano implementate come pubblicate e che l'app le applichi in modo coerente. Non certificano l'idoneità dello strumento per un caso specifico: la scelta dei parametri e l'interpretazione dei risultati restano del professionista. Mancano confronti pubblicati completi per l'indice IL e per il cedimento calcolato con Zhang et al. (2002).
