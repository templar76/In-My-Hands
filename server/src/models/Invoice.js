

import mongoose from 'mongoose';
const { Schema } = mongoose;

const InvoiceSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  supplierId: { type: Schema.Types.ObjectId, ref: 'Supplier', required: true },
  // Dati di trasmissione SDI
  transmissionData: {
    idTrasmittente: {
      idPaese: { type: String },
      idCodice: { type: String }
    },
    progressivoInvio: { type: String },
    formatoTrasmissione: { type: String },
    codiceDestinatario: { type: String },
    contattiTrasmittente: {
      telefono: { type: String },
      email: { type: String }
    }
  },
  supplier: {
    name: { type: String, required: true },
    pIva: { type: String, required: true },
    codiceFiscale: { type: String },
    pec: { type: String },
    sdiCode: { type: String },
    address: { type: String },
    // Dati REA estesi
    iscrizioneREA: {
      ufficio: { type: String },
      numeroREA: { type: String },
      capitaleSociale: { type: Number },
      socioUnico: { type: String },
      statoLiquidazione: { type: String }
    },
    // Contatti dettagliati
    contatti: {
      telefono: { type: String },
      fax: { type: String },
      email: { type: String }
    }
  },
  customer: {
    name: { type: String, required: true },
    pIva: { type: String, required: true },
    codiceFiscale: { type: String },
    pec: { type: String },
    sdiCode: { type: String },
    address: { type: String }
  },
  // Riferimenti documenti
  documentReferences: {
    ordineAcquisto: [{
      idDocumento: { type: String },
      data: { type: Date },
      numeroItem: { type: String },
      codiceCommessaConvenzione: { type: String },
      codiceCUP: { type: String },
      codiceCIG: { type: String }
    }],
    contratto: [{
      idDocumento: { type: String },
      data: { type: Date },
      numeroItem: { type: String },
      codiceCommessaConvenzione: { type: String },
      codiceCUP: { type: String },
      codiceCIG: { type: String }
    }],
    convenzione: [{
      idDocumento: { type: String },
      data: { type: Date },
      numeroItem: { type: String },
      codiceCommessaConvenzione: { type: String },
      codiceCUP: { type: String },
      codiceCIG: { type: String }
    }],
    ricezione: [{
      idDocumento: { type: String },
      data: { type: Date },
      numeroItem: { type: String }
    }],
    fatturePrecedenti: [{
      idDocumento: { type: String },
      data: { type: Date }
    }]
  },
  // Dati DDT
  datiDDT: [{
    numeroDDT: { type: String },
    dataDDT: { type: Date },
    riferimentoNumeroLinea: [{ type: Number }]
  }],
  // Dati trasporto
  datiTrasporto: {
    datiAnagraficiVettore: {
      idFiscaleIVA: {
        idPaese: { type: String },
        idCodice: { type: String }
      },
      codiceFiscale: { type: String },
      anagrafica: {
        denominazione: { type: String },
        nome: { type: String },
        cognome: { type: String }
      },
      numeroLicenzaGuida: { type: String }
    },
    mezzoTrasporto: { type: String },
    causaTrasporto: { type: String },
    numeroColli: { type: Number },
    descrizione: { type: String },
    unitaMisuraPeso: { type: String },
    pesoLordo: { type: Number },
    pesoNetto: { type: Number },
    dataOraRitiro: { type: Date },
    dataInizioTrasporto: { type: Date },
    tipoResa: { type: String },
    indirizzoResa: {
      indirizzo: { type: String },
      numeroCivico: { type: String },
      cap: { type: String },
      comune: { type: String },
      provincia: { type: String },
      nazione: { type: String }
    },
    dataOraConsegna: { type: Date }
  },
  // Allegati
  allegati: [{
    nomeAttachment: { type: String },
    algoritmoCompressione: { type: String },
    formatoAttachment: { type: String },
    descrizioneAttachment: { type: String },
    attachment: { type: String } // Base64 encoded
  }],
  invoiceNumber: { type: String, required: true },
  invoiceDate: { type: Date, required: true },
  totalAmount: { type: Number, required: true },
  totalVAT: { type: Number, default: 0 },
  currency: { type: String, default: 'EUR' },
  lineItems: [
    {
      lineNumber: { type: Number },
      description: { type: String, required: true },
      quantity: { type: Number, required: true },
      unitPrice: { type: Number, required: true },
      total: { type: Number, required: true },
      vatRate: { type: Number },
      // Product Matching Fields
      productMatchingStatus: {
        type: String,
        enum: ['pending', 'matched', 'unmatched', 'pending_review', 'approved', 'rejected'],
        default: 'pending'
      },
      matchConfidence: { type: Number, min: 0, max: 1 },
      matchedProductId: { type: Schema.Types.ObjectId, ref: 'Product' },
      codeInternal: { type: String }, // AGGIUNTO: Campo per il codice interno del prodotto
      matchingMethod: {
        type: String,
        enum: ['exact', 'fuzzy', 'manual', 'ml_assisted']
      },
      reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
      reviewedAt: { type: Date },
      reviewNotes: { type: String },
      alternativeMatches: [{
        productId: { type: Schema.Types.ObjectId, ref: 'Product' },
        confidence: { type: Number, min: 0, max: 1 },
        reason: { type: String }
      }],
      normalizedDescription: { type: String },
      matchingMetadata: { type: Schema.Types.Mixed },
      unitOfMeasure: { type: String },
      discount: { type: Number, default: 0 },
      surcharge: { type: Number, default: 0 },
      code: { type: String },
      reason: { type: String },
      // Sconti e maggiorazioni dettagliati
      scontiMaggiorazioni: [{
        tipo: { type: String, enum: ['SC', 'MG'] }, // SC=Sconto, MG=Maggiorazione
        percentuale: { type: Number },
        importo: { type: Number }
      }],
      // Altri dati riga
      altriDatiGestionali: [{
        tipoDato: { type: String },
        riferimentoTesto: { type: String },
        riferimentoNumero: { type: Number },
        riferimentoData: { type: Date }
      }],
      // Ritenute
      ritenuta: {
        tipoRitenuta: { type: String },
        importoRitenuta: { type: Number },
        aliquotaRitenuta: { type: Number },
        causaleRitenuta: { type: String }
      },
      discountSurcharge: { type: Schema.Types.Mixed }
    }
  ],
  vatSummary: [
    {
      vatRate: { type: Number },
      taxableAmount: { type: Number },
      vatAmount: { type: Number },
      exemptionNature: { type: String },
      exemptionReference: { type: String },
      // Esigibilità IVA
      esigibilitaIVA: { type: String, enum: ['I', 'D', 'S'] }, // I=Immediata, D=Differita, S=Scissione pagamenti
      // Riferimento normativo
      riferimentoNormativo: { type: String },
      // Altri dati IVA
      speseAccessorie: { type: Number },
      arrotondamento: { type: Number }
    }
  ],
  paymentData: [
    {
      paymentMethod: { type: String },
      dueDate: { type: Date },
      amount: { type: Number },
      beneficiary: { type: String },
      iban: { type: String }
    }
  ],
  path: { type: String, required: true },
  rawMetadata: { type: Schema.Types.Mixed }
}, {
  timestamps: true
});

export default mongoose.model('Invoice', InvoiceSchema);