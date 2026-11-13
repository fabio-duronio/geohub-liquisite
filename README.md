# LiquiSite

**Verifica a liquefazione del sito secondo le NTC 2018**, direttamente nel browser.

> **Stato: prima versione web (v0.1).** Prova → scenario → calcolo → profili e tabelle → confronto tra scenari → CSV, JSON, PNG e stampa. Uso e limiti in [Applicazione web](docs/app.md).

Applicazione web per geologi della famiglia GeoHub: esclusione della verifica (NTC 2018 §7.11.3.4.2) e verifica puntuale con metodi semplificati da prove SPT, CPT/CPTU e misure di V_s, secondo il **D.M. 17/01/2018 (NTC 2018)** e la **Circolare n. 7/2019**. I calcoli avvengono nel browser; nessun dato viene inviato a server.

## Metodi

| Prova | Metodo | Ruolo |
|---|---|---|
| SPT | Boulanger & Idriss (2014) | principale o controllo |
| SPT | Cetin et al. (2018) | principale o controllo |
| CPT/CPTU | Boulanger & Idriss (2014) | principale |
| V_s | Kayen et al. (2013) | solo confronto |

Ogni metodo usa solo le proprie funzioni; le equazioni sono state lette sulle pubblicazioni originali e sono citate nel codice. Dettagli in [Metodo di calcolo](docs/metodo.md).

## Perimetro d'uso

È uno strumento di supporto per il professionista. Non impone un fattore di sicurezza minimo (le NTC non lo fissano: il margine è valutato e motivato dal progettista), non usa classi o zone della microzonazione sismica e non sostituisce la relazione geologica.

## Verifiche

```bash
node verifiche/verifica_motore.mjs              # valori pubblicati dagli autori
node verifiche/verifica_esclusione.mjs          # criteri di esclusione e fusi della Fig. 7.11.1
node verifiche/verifica_robustezza.mjs          # input non validi, casi limite, stati di esito
node verifiche/verifica_profilo.mjs             # livello applicativo: profilo, importazione, CSV, JSON
node verifiche/verifica_il.mjs                  # indice IL (Iwasaki): profili analitici e seconda implementazione
node verifiche/verifica_preliminare.mjs          # verifica preliminare §7.11.3.4.2 e carta di comportamento CPT
node verifiche/verifica_cedimenti.mjs            # cedimento da CPT (Zhang et al. 2002) e LSN
python3 verifiche/verifica_cedimenti.py         # seconda implementazione di εv, S e LSN
node verifiche/verifica_riferimento.mjs          # confronto con un calcolo pubblicato (National Academies 2024, App. G): punto e profilo
node verifiche/verifica_casuale.mjs             # prove casuali ripetibili (seme fisso) su profilo, IL, CSV, JSON e importazione
python3 verifiche/verifica_indipendente.py      # seconda implementazione, 8000 casi
```

## Licenza

AGPL-3.0 con termini aggiuntivi: vedi [LICENSE](LICENSE) e [NOTICE](NOTICE).

Basato su LiquiSite di Fabio Duronio, geologo — <https://github.com/fabio-duronio/geohub-liquisite>
