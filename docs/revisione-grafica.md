# Revisione della restituzione grafica di LiquiSite

> Documento della prima revisione. Per le scelte aggiornate leggere `AGENTS.md` e [Decisioni e attività](decisioni-e-attivita.md). La stampa orizzontale descritta qui è stata sostituita dalla stampa A4 **verticale**, su richiesta dell’utente.

Base: repository pubblico `fabio-duronio/geohub-liquisite`, commit `1793470`, motore 0.3.0.

Questa è una proposta di revisione locale. Non è stata pubblicata sul repository né su GitHub Pages.

## Modifiche

- Eliminata la colonna permanente dei parametri: risultati a tutta larghezza.
- Configurazione in finestra accessibile tramite «Impostazioni del progetto», con sezioni Progetto, Prova, Scenario e metodo, Falda e strati. Il tasto Esc chiude la finestra.
- Azione Calcola scenario sempre raggiungibile sopra i risultati.
- Tavole preimpostate: Verifica; Dati e interpretazione; Tensioni e coefficienti; FS e probabilità (se il metodo la calcola).
- Tavola CPT predefinita con quattro profili: Ic, resistenza normalizzata, CSR/CRR, FS.
- Pannelli personalizzabili; fino a quattro colonne su desktop, due su tablet, una su mobile.
- CSR rossa tratteggiata e CRR verde continua. Fascia rossa per FS < 1 e verde tenue per FS ≥ 1; nessuna classificazione normativa o giudizio di sicurezza.
- Campitura dell'indice Ic rispetto alla soglia impostata; riempimenti discontinui che rispettano i segmenti originali.
- Altezze degli assi e delle legende uniformate per allineare le profondità dei pannelli.
- Stampa A4 orizzontale con quattro profili affiancati, identificazione della prova, scenario e indicazione dei dati sintetici.
- Schermata iniziale con azioni per caricare l'esempio o importare una prova.
- Correzione di coerenza: Ic già calcolato nei punti IC_OLTRE_SOGLIA viene ora riportato anche in tabella e CSV, come nel grafico; nessun FS viene inventato per questi punti.

## Cosa non è cambiato

`motore/liquisite.js` è identico alla versione del commit di base. Nessuna formula, nessun coefficiente e nessun parametro del metodo è stato modificato. Il campione CPTu standard mantiene FS minimo 0.5109567645853463 a 8 m.

LPI, cedimenti, spostamenti laterali e sezioni spaziali non sono implementati. PL è una probabilità puntuale del metodo, non l'indice LPI. Le fasce colorate FS non colmano l'assenza di questi calcoli.

## File modificati o aggiunti

- index.html
- css/liquisite.css
- app/ui.js
- app/grafici.js
- app/workspace.js (nuovo)
- app/profilo.js (helper per l'esposizione coerente di Ic)
- app/esporta.js
- verifiche/verifica_restituzione.mjs (nuovo)
- docs/app.md
- docs/revisione-grafica.md (questo documento)

## Verifica

Eseguire dalla radice:

```sh
node verifiche/verifica_motore.mjs
node verifiche/verifica_esclusione.mjs
node verifiche/verifica_robustezza.mjs
node verifiche/verifica_profilo.mjs
node verifiche/verifica_restituzione.mjs
python3 verifiche/verifica_indipendente.py
```

I test preesistenti totalizzano 514 controlli JavaScript. La nuova regressione aggiunge 6 controlli. Il confronto Python comprende 8.000 casi.

Sono stati inoltre provati in Chromium sia il sito pubblicato sia questa revisione: esempio CPTu, SPT, importazione CSV/incolla, navigazione schede, variazione dell'accelerazione e invalidazione dei risultati, ricalcolo, duplicazione/confronto degli scenari, salvataggio JSON e riapertura, download CSV e PNG, generazione della stampa, input accelerazione mancante, viewport mobile 390 px. Nessun errore JavaScript rilevato nei percorsi provati. PDF generato e controllato visivamente. Non è una verifica esaustiva di tutti i browser, input, stampanti o metodi su casi reali.

## Come provare e integrare

Avviare un server statico dalla radice, per esempio `python3 -m http.server 8080`, e aprire la pagina nel browser. Chart.js e i font sono ancora caricati da CDN: non viene garantito il funzionamento offline.

Nel repository originale creare un branch prima di applicare le modifiche. La patch è riferita a `1793470`: se il repository è avanzato, controllare il diff e risolvere i conflitti, senza sovrascrivere modifiche successive. Dopo l'integrazione rieseguire i test, controllare l'anteprima GitHub Pages e poi pubblicare.

Non basta applicare soltanto il CSS: HTML, grafici, interfaccia e nuovo script workspace sono coordinati.
