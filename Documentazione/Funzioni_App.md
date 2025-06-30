## Comportamento Automatico del Sistema per import prodotti da FT
### Phase 1 - Ricerca Prodotti Esistenti
Il sistema cercherà automaticamente prodotti esistenti nel database usando:

- Descrizione del prodotto (similarità semantica)
- Codice prodotto (se presente)
- Soglia di confidenza configurata
### Phase 2 - Gestione Automatica
Per ogni riga della fattura:

1. Se trova un prodotto esistente con alta confidenza:
   
   - ✅ matchedProductId : ID del prodotto trovato
   - ✅ productMatchingStatus : 'matched'
   - ✅ codeInternal : Codice del prodotto esistente
2. Se NON trova un prodotto esistente :
   
   - ✅ Crea automaticamente un nuovo prodotto
   - ✅ approvalStatus : 'approved' (approvato automaticamente)
   - ✅ codeInternal : Generato automaticamente (es. PROD_001234 )
   - ✅ matchedProductId : ID del nuovo prodotto creato
   - ✅ productMatchingStatus : 'matched'
   - ✅ approvedAt : Data corrente
   - ✅ approvalNotes : "Approvato automaticamente durante l'importazione"
## 📊 Risultato Finale
- Nessuna revisione manuale richiesta
- Tutti i prodotti immediatamente disponibili
- Overview e cronologia acquisti aggiornati correttamente
- Status prodotti: "Approvato" (non più "Da Approvare")
- Tutti i campi popolati correttamente
## 🎯 Vantaggi
- Importazione completamente automatica
- Zero intervento manuale
- Dati consistenti e completi
- Prodotti immediatamente utilizzabili