Ecco il workflow aggiornato con lo stato reale di avanzamento:
	1.	Upload fattura
– UI drag-and-drop + form di upload su React
– Endpoint Express che riceve il file XML/PDF e lo salva (in “Data/…”)
✔️ Completato (con possibili ottimizzazioni future)
	
2.	Parsing file
– Riconoscimento formato (XML vs PDF)
– Estrazione metadati di header (Cedente, Cessionario/Ricevente, CodiceDestinatario, data, numero fattura, totale, IVA, ecc.)
– Estrazione linee di dettaglio (codice articolo, descrizione, quantità, prezzo unitario, sconti/maggiorazioni, totale riga)
✔️ Completato (con possibili ottimizzazioni future)
	
3.	Lookup Fornitore
– Estrazione dati identificativi del fornitore (P.IVA/C.F., nome, PEC, REA…)
– Se non esiste, creare nuovo document in suppliers; altrimenti aggiornare se necessario
✔️ Completato (con possibili ottimizzazioni future) --> Manca la visualizzazzione nell'endpoint
	
4.	Validazione Cliente
– Verifica che CodiceDestinatario del file corrisponda al tenant
– Scarto o segnalazione in caso di mismatch
✔️ Completato (con possibili ottimizzazioni future)
	
5.	Import Prodotti
– Normalizzazione descrizione → descriptionStd
– Fuzzy-lookup su products (text-index) → match o nuovo Product con codeInternal generico
– Aggiunta prezzo in prices con supplierVat, price, currency, lastUpdated
✔️ Completato (con possibili ottimizzazioni future)
	
6.	Gestione Duplicati Prodotti
– Rilevamento gruppi di potenziali duplicati via groupID su products
– Endpoint + UI per rivedere/ignorare/unire duplicati
✔️ Completato (con possibili ottimizzazioni future) rimane da fare test
	
7.	Salvataggio Fattura in Mongo
– Creazione di un documento Invoice con:
• tenantId, supplierId, header, metadati
• array di righe: riferimento a productId, quantità, prezzo, totale riga
– Link al file su disco (path)
✔️ Completato (con possibili ottimizzazioni future)

8. Sezione Fornitori in Dashboard
- Visualizzare i fornitori più rilevanti in termini di % di spesa
- sul totale
- Analizzare la spesa per fornitore in un dato range di date
- Cercare fornitori specifici e accedere ai dettagli della scheda fornitore
Questa scheda deve aiutare a rispondere ad una domanda specifica del mercato: 
Che potere contrattuale ho verso i miei fornitori?
✔️ Completato (con possibili ottimizzazioni future)
9. Sezione Dettaglio Fornitore
- Visualizzazione volumi mensili di spesa - Grafico a linee con trend mensile
- Prodotti più acquistati - Grafico a barre e tabella dettagliata
- Filtro per range di date - Possibilità di analizzare periodi specifici
- Ricerca prodotti specifici - Campo di ricerca per trovare prodotti
- Accesso ai dettagli prodotto - Pulsante per navigare alla scheda prodotto
- Analisi potere contrattuale - Sezione dedicata con suggerimenti
- Navigazione da lista fornitori - Click sul nome fornitore 
✔️ Completato (con possibili ottimizzazioni future "Confronto Prezzi con altri competitor")

10.	Sezione Fatture in Dashboard
– Lista fatture, ricerca, filtri per data/fornitore
– Visualizzazione dettaglio fattura con righe e prodotti
✔️ Completato (con possibili ottimizzazioni future)

11.	Sezione Prodotti in Dashboard
La sezione prodotti parte con una overview generale sui tuoi acquisti che
permette di:
– KPI cards: volumi mensili, prezzo medio vs ultimo, spesa totale
– Grafici mensili (Recharts) basati su collezione Invoice
- VISUALIZZARE I VOLUMI TOTALI DI ACQUISTO NEL TEMPO
- VISUALIZZARE I PRODOTTI PIÙ RILEVANTI IN TERMINI DI SPESA O VOLUME DI ACQUISTO
- VISUALIZZARE IL PREZZO MEDIO E LE QUANTITÀ COMPLESSIVE IN UN RANGE DI TEMPO FISSATO
- RICERCARE PRODOTTI SPECIFICI TRA TUTTI GLI ACQUISTI E ACCEDERE AI DETTAGLI DELLA
- SCHEDA PRODOTTO (Vedi "SCHEDA PRODOTTO")
Naviga tra tutti i tuoi prodotti individuando quelli più rilevantti
✔️ Completato (con possibili ottimizzazioni future)

12. Sezione dettaglio Prodotto
LA scheda prodotto è divisa in tre sezioni:
Overview QUESTA SEZIONE MOSTRA:
	- Volumi mensili di acquisto
	- Prezzo medio vs ultimo prezzo
	- Spesa e volume totali
Storico Acquisti	
	Le singole voci di acquisto effettuate in ordine cronologico con indicazione di quantità, spesa e prezzo applicato
	- Visualizzare storico completo delle transazioni con il fornitore
	- Data, quantità, prezzo unitario, totale
	- Filtro per periodo
	- Ordinamento per data
Imposta Alert
	Impostare alert di prezzo che monitorino automaticamente il rispetto degli accordi di Prezzo presi con I fornitori
	- Possibilità di impostare un alert per prezzo
	- Notifiche via email o PEC quando il prezzo supera un valore soglia
	- Backend per gestire la logica di verifica e invio notifiche
	- UI per configurare criteri (prodotto, soglia, frequenza)
Calcola Risparmio
	Calcolare il risparmio derivante da una nuova proposta di prezzo di un forniotre, sulla base dei volumi di acquisto effettivi degli ultimi 12 mesi
	- Input: prodotto, quantità, Unità di Misura
	- Output: costo totale
	- Confronto del Risparmio/Plus valenza
🚧 Da iniziare

13.	Alert Prezzi
– UI per creare alert su specifici prodotti/fornitori
– Backend per controlli periodici (cron job) e invio notifiche
🚧 Da iniziare


14.	Export PDF/Excel
– jsPDF / SheetJS sulle viste Invoices e Products
🚧 Da iniziare

15.	Settings & Admin
– Profilo utente, gestione tenant, piani di abbonamento
– Statistiche consumi/fatture per cliente
✔️ Completato (con possibili ottimizzazioni future)
