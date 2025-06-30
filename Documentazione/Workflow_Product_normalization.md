Product Matching & Normalization Workflow

Obiettivo: garantire l’affidabilità dell’abbinamento tra descrizioni prodotto in fatture di acquisto (XML/PDF) e un catalogo interno, minimizzando i falsi positivi grazie a un processo ibrido automatizzato + convalida manuale.

⸻

1. Panoramica
	1.	Normalizzazione delle descrizioni grezze estratte dal file.
	2.	Look-up esatto in catalogo Products.descriptions.
	3.	Fuzzy matching se il look-up esatto fallisce.
	4.	Creazione di nuovi record Product per descrizioni non abbinate automaticamente.
	5.	Batch di revisione manuale (merge / escludi) in UI dedicata.
	6.	Aggiornamento del catalogo con merge e ampliamento delle descriptions esistenti.

⸻

2. Schema Dati MongoDB

Products collection:
{
  _id: ObjectId,
  name: String,           // Nome ufficiale prodotto (etichetta)
  descriptions: [String], // Lista di descrizioni standard normalizzate
  metadata: {             // (opzionale) campi aggiuntivi
    createdAt: Date,
    updatedAt: Date
  }
}

Fatture importate memorizzano su ciascuna riga:

InvoiceLine {
  _id: ObjectId,
  invoiceId: ObjectId,
  productId: ObjectId | null,
  description: String,         // descrizione originale
  descriptionStd: String,      // descrizione normalizzata
  quantity: Number,
  unitPrice: Number,
  totalPrice: Number,
  matchConfidence: Number,     // 1.0 per esatti, 0.x per fuzzy
  matchedAt: Date,
  status: 'matched' | 'unmatched'
}


⸻

3. Dettaglio Workflow

3.1 Estrazione & Normalizzazione
	•	Al parsing (XML/PDF), per ogni riga estrarre: description, quantity, unitPrice.
	•	Passare description alla funzione normalize(str):

normalize = s => s
  .toLowerCase()
  .replace(/[^\w\s]/g, '')
  .replace(/\s+/g, ' ')
  .trim();


	•	Salvare descriptionStd nel record di linea.

3.2 Lookup Esatto
	•	Interrogare Products:

product = await Products.findOne({ descriptions: descriptionStd });


	•	Se trova: associare line.productId = product._id, matchConfidence = 1.0, status = 'matched'.

3.3 Fuzzy Matching
	•	Se lookup esatto fallisce:
	1.	Caricare in memoria tutti i { _id, descriptions }.
	2.	Usare fuse.js con opzione { keys: ['descriptions'], threshold: 0.2 }.
	3.	Se il miglior match ha score <= 0.2 (≥80% similarity):
	•	associare productId, matchConfidence = 1 - score, status = 'matched'.
	4.	Altrimenti lasciare status = 'unmatched' e productId = null.

3.4 Creazione Nuovi Prodotti
	•	Per ogni unmatched:

newProd = await Products.create({
  name: descriptionStd,
  descriptions: [descriptionStd]
});
line.productId = newProd._id;
line.status = 'pending_review';



3.5 Revisione Manuale (Batch UI)
	•	Endpoint GET /api/images/unmatched-products restituisce tutte le linee con status = 'pending_review'.
	•	UI React mostra:
	•	Tabella con descriptionStd e un menù fuzzy-suggest per associare a un prodotto esistente.
	•	Pulsanti:
	•	Merge: unisci descrizione in un Product esistente (aggiorna descriptions).
	•	Exclude: contrassegna come “unique” e finalizza status = 'matched' senza merge.

3.6 Propagazione Merge
	•	Quando admin esegue merge di descA in Product X:

await Products.findByIdAndUpdate(X, {
  $addToSet: { descriptions: descA }
});
await InvoiceLines.updateMany(
  { descriptionStd: descA },
  { productId: X, status: 'matched', matchConfidence: 1.0 }
);



⸻

4. Endpoint Express
	•	POST /api/invoices/import — upload + parsing + matching bulk.
	•	GET /api/invoices/pending-products — elenco lines in pending_review.
	•	POST /api/invoices/merge-product — body { descriptionStd, targetProductId }.
	•	POST /api/invoices/exclude-product — body { descriptionStd }.

5. Logging & Debug
	•	Loggare:
	•	Errori di parsing.
	•	Count di esatti vs fuzzy vs unmatched.
	•	Tempo medio di matching per linea.
	•	Metadati di debug nel DB: ad es. fuzzyScore nella linea.

⸻

Documentazione workflow generata il: (inserire data)

## Schizzo Interfaccia: Gestione Duplicati Prodotti

### 1. Struttura Generale

* **Header** (Breadcrumb): Home / Prodotti / Duplicati Import
* **Titolo Pagina**: "Verifica Duplicati Prodotti"
* **Barra di Stato**: indicatore passo (Import → Duplicati → Conferma)

### 2. Controllo dei Filtri

* **Campo di Ricerca** (per descrizione standardizzata)
* **Dropdown**: selezione fornitore per restringere ambito
* **Pulsante "Ricarica"** per rifare la ricerca fuzzy

### 3. Lista Duplicati

* **Layout a Tabella**:

  | ✓  | Descrizione Importata | Suggerimenti Prodotti Esistenti                          | Similarità | Azioni                         |
  | -- | --------------------- | -------------------------------------------------------- | ---------- | ------------------------------ |
  | ☑︎ | "tubo acciaio 10mm"   | - "Tubo acciaio Ø10mm" (85%)<br>- "Tubo inox 10mm" (78%) | 85%        | \[Unisci] \[Mantieni Separato] |

  * Checkbox per selezione multipla
  * Liste a comparsa al passaggio del mouse sui suggerimenti

### 4. Azioni Globali

* **Pulsante "Unisci Selezionati"**: unisce tutti i record scelti
* **Pulsante "Esporta CSV"**: esporta elenco anomalie

### 5. Feedback e Navigazione

* Notifiche toast per conferma di merge/scarto
* Breadcrumb di ritorno a "Elenco Prodotti"

### 6. Componenti Principali

* `DuplicateCheckPage`: container, carica dati da `/api/products/import/check`
* `DuplicateTable`: tabella con props `items: DuplicateRecord[]`
* `MatchCell`: cella che mostra suggerimenti e percentuali
* `ActionButtons`: component con `onMerge`, `onKeep`

---

