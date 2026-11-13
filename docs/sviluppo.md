# Sviluppo

Struttura del repository, avvio in locale, formato del progetto e regole per le modifiche.

[← Torna al README](../README.md)

## Struttura del repository

```
index.html          pagina dell'applicazione (nessuna compilazione)
assets/             logo, icone e immagine di anteprima per la condivisione
css/liquisite.css   foglio di stile (identità comune GeoHub)
motore/             calcoli, senza dipendenze dall'interfaccia
  liquisite.js        metodi di innesco, tensioni, criteri di esclusione 1–4
  indici.js           indice IL (Iwasaki)
  cedimenti.js        deformazione volumetrica (Zhang et al. 2002), cedimento, LSN
app/                interfaccia: nessuna formula di liquefazione
  progetto.js         formato del progetto, unità, firma degli input, validazione dei file
  profilo.js          collegamento prova → tensioni → motore; riepilogo; serie dei grafici
  esclusione.js       verifica preliminare §7.11.3.4.2 per strato e per sito
  importa.js          lettura di tabelle e CSV con conversioni esplicite
  esporta.js          CSV con protezione dalle formule
  grafici.js          profili, carta di comportamento e fusi (Chart.js, solo disegno)
  esempio.js          progetto di esempio sintetico (dati inventati, seme fisso)
  ui.js · workspace.js · import-workspace.js · guida-importa.js
dati/
  fusi-ntc2018.json   fusi della Fig. 7.11.1 digitalizzati
  fusi-ntc2018.js     stessi dati per il browser (verificati uguali al JSON)
strumenti/
  digitalizza_fusi.py ricava dati/fusi-ntc2018.json dalle immagini del testo ufficiale
verifiche/          script di controllo (vedi validazione.md) e dati del caso di riferimento
docs/               metodo, indici, cedimenti, uso, validazione, sviluppo
.github/            modelli per segnalare discrepanze di calcolo e proporre funzioni
README.md · CHANGELOG.md · LICENSE · NOTICE
```

I moduli sono in formato UMD. Funzionano sia nel browser, come script globali (`window.LiquiSite`, `window.LiquiProfilo`, …), sia in Node, con `require`: così le verifiche usano lo stesso codice dell'app.

## Avvio in locale

```bash
git clone https://github.com/fabio-duronio/geohub-liquisite.git
cd geohub-liquisite
python3 -m http.server 8000
```

Apri <http://localhost:8000/>. Non servono compilazione né installazione di dipendenze. Chart.js 4.4.4 e i caratteri IBM Plex sono caricati da CDN: senza rete l'app non funziona.

**Pubblicazione**: la cartella si pubblica così com'è su GitHub Pages (branch `main`, radice). Quando cambia un file statico, aggiorna il parametro `?v=` dei riferimenti in `index.html`, così i browser non usano copie vecchie in cache.

**Versioni**: la versione dell'app (`VERSIONE_APP` in `app/progetto.js`) e quella del motore (`VERSIONE_MOTORE` in `motore/liquisite.js`) sono distinte. La versione del motore entra nella firma degli input: se cambia, i risultati salvati diventano «non aggiornati».

## Formato del progetto (JSON, `versioneFormato` 1)

```
{ formato: 'geohub-liquisite-progetto', versioneFormato: 1,
  progetto: { titolo, sito, autore, note },
  prove: [{ id, nome, tipo: 'CPTE'|'CPTU'|'SPT'|'VS', provenienza, esempio,
            unita: { z: 'm'|'cm', qc: 'MPa'|'kPa', fs: 'kPa'|'MPa', u2: 'kPa'|'MPa', … },
            colonne: ['z', …], dati: [[numero|null, …]],
            parametri: { CE, CB, CS, sporgenza, senzaRivestimento | ar } }],
  scenari: [{ id, nome, colore, provaId, metodo, Mw, amax, zFalda,
              strati: [{ da, a, gamma, gammaSat, FC|null, descrizione }],
              opzioni: { Vs12, IcSoglia, CFC, FSrif },
              esclusione: { faldaMediaStagionale, pcSubOrizzontale, fondazioniSuperficiali,
                            strati: [{ da, a, sabbiaPulita, curva, campione, decisione4, motivazione4 }] },
              note }],
  provaAttiva, scenarioAttivo,
  risultati: { [scenarioId]: { versioneMotore, firma, calcolatoIl, configurazione, righe, riepilogo } } }
```

- **Dati della prova.** Sono conservati come inseriti, nelle unità dichiarate; la conversione nelle unità del motore avviene solo al calcolo.
- **Controlli all'apertura.** Il file viene validato: formato, versione, tipi di prova, unità, numeri, compatibilità tra metodo e prova, riferimenti tra scenari e prove.
- **Risultati salvati.** Sono marcati `origine: 'file'` e mostrati come non aggiornati finché non si ricalcola.
- **Progetti precedenti.** I file senza `FSrif` o senza `esclusione` si aprono con i valori predefiniti.
- **Firma degli input.** È un'impronta FNV-1a di prova, scenario e versione del motore. Non la modificano nome, note, FS di riferimento e dati della verifica preliminare, perché riguardano la lettura dei risultati e non il calcolo.

## Regole per le modifiche

- **Formule.** Stanno solo in `motore/`. L'interfaccia non duplica né corregge formule, nemmeno per migliorare un grafico.
- **Metodi.** Ogni metodo è un blocco chiuso, con equazioni lette sulla pubblicazione originale e citate con pagina o numero di equazione.
- **Refusi delle fonti.** Vanno documentati in [Metodo di calcolo](metodo.md#refusi-delle-fonti-e-scelte-adottate) con la scelta adottata.
- **Dati mancanti o non calcolati.** Non diventano mai zero né esclusioni favorevoli. I tratti non indagati sono dati come intervalli (minimo–massimo), mai come sicuri.
- **Conversioni.** Nessuna conversione universale DPSH → SPT; le CPT a punta meccanica non sono supportate.
- **Testi dell'interfaccia.**
  - Nessuna frase del tipo «sito sicuro» o «terreno non liquefacibile»: l'esclusione si scrive «verifica omessa ai sensi del §7.11.3.4.2».
  - Nessuna classe di microzonazione per IL e LSN.
- **Stampa.** È A4 verticale, pensata come allegato alla relazione.
- **Verifiche.** Ogni modifica al calcolo va accompagnata da verifiche in `verifiche/`. Prima di pubblicare, esegui tutti gli script (vedi [Validazione](validazione.md#eseguire-le-verifiche)) e controlla nel browser importazione, ricalcolo, stampa e vista mobile.
