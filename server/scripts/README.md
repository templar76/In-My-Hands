# Script di Migrazione - Product Descriptions

## Panoramica

Questo documento descrive le modifiche apportate al sistema per risolvere il problema del campo `descriptions` vuoto nella collezione `products`.

## Problema Identificato

Il campo `descriptions` nei documenti della collezione `products` era vuoto per tutti i record perché:

1. **Import automatico**: Durante l'importazione automatica delle fatture, quando veniva trovato un prodotto esistente, veniva aggiunto solo il prezzo ma non la descrizione alternativa
2. **Approvazione manuale**: Quando veniva approvato manualmente un abbinamento, la descrizione della fattura non veniva aggiunta come descrizione alternativa
3. **Prodotti esistenti**: I prodotti già presenti nel database non avevano il campo `descriptions` popolato

## Soluzioni Implementate

### 1. Modifica Import Automatico

**File**: `src/controllers/invoiceController.js`

- Aggiunta chiamata a `ProductMatchingService.addAlternativeDescription()` dopo il salvataggio di un prodotto abbinato automaticamente
- La descrizione della fattura viene ora aggiunta come descrizione alternativa con source 'invoice'

### 2. Modifica Approvazione Manuale

**File**: `src/controllers/manualReviewController.js`

- Aggiunta chiamata a `ProductMatchingService.addAlternativeDescription()` nella funzione `approveMatch`
- La descrizione della fattura viene aggiunta come descrizione alternativa con source 'manual_review'
- Migliorata la creazione del campo `descriptions` nella funzione `createProductFromLine` per includere tutti i campi richiesti

### 3. Script di Migrazione

**File**: `scripts/migrateProductDescriptions.js`

- Script per popolare retroattivamente il campo `descriptions` per i prodotti esistenti
- Raccoglie tutte le descrizioni uniche dalle fatture già importate
- Aggiunge la descrizione principale del prodotto e tutte le descrizioni dalle fatture associate

## Come Utilizzare lo Script di Migrazione

### Prerequisiti

- Node.js installato
- Accesso al database MongoDB
- File `.env` configurato con `MONGO_URI`

### Esecuzione

```bash
cd server
node scripts/migrateProductDescriptions.js
```

### Output Atteso

```
Connessione a MongoDB...
Connesso a MongoDB
Trovati X prodotti da migrare
Migrando prodotto [ID] - [Descrizione]
✓ Prodotto [ID] migrato con Y descrizioni

=== RISULTATI MIGRAZIONE ===
Prodotti migrati con successo: X
Errori: 0
Totale prodotti processati: X
Disconnesso da MongoDB
Migrazione completata
```

## Struttura del Campo Descriptions

Ogni elemento nell'array `descriptions` contiene:

```javascript
{
  text: String,           // Testo originale della descrizione
  normalized: String,     // Testo normalizzato per il matching
  source: String,         // Fonte: 'original', 'invoice', 'manual_review', 'supplier'
  frequency: Number,      // Frequenza di apparizione
  lastSeen: Date,         // Ultima volta vista
  addedBy: ObjectId,      // ID dell'utente che l'ha aggiunta (null per migrazione)
  confidence: Number      // Livello di confidenza (0-1)
}
```

## Benefici delle Modifiche

1. **Miglior Matching**: Più descrizioni alternative migliorano l'accuratezza del matching automatico
2. **Tracciabilità**: Ogni descrizione ha informazioni sulla fonte e frequenza
3. **Retrocompatibilità**: I prodotti esistenti vengono migrati automaticamente
4. **Consistenza**: Tutte le future importazioni e approvazioni popolano correttamente il campo

## Monitoraggio

Dopo l'implementazione, è possibile verificare che il campo `descriptions` sia popolato correttamente:

```javascript
// Verifica prodotti con descriptions vuoto
db.products.find({ 
  $or: [
    { descriptions: { $exists: false } },
    { descriptions: { $size: 0 } }
  ]
}).count()

// Verifica struttura descriptions
db.products.findOne({ descriptions: { $exists: true, $ne: [] } }, { descriptions: 1 })
```

## Note Tecniche

- Lo script di migrazione è idempotente: può essere eseguito più volte senza duplicare le descrizioni
- Le descrizioni vengono normalizzate usando `ProductMatchingService.normalizeDescription()`
- La migrazione gestisce automaticamente gli errori e continua con i prodotti successivi
- Il campo `addedBy` è `null` per le descrizioni aggiunte durante la migrazione