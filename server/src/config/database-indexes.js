/**
 * Database Indexes Configuration
 * Definisce tutti gli indici necessari per ottimizzare le performance del database MongoDB
 */

const databaseIndexes = {
  // User Collection Indexes
  users: [
    // Indice composto per query per tenant
    { fields: { tenantId: 1, email: 1 }, options: { unique: true, name: 'tenant_email_unique' } },
    { fields: { tenantId: 1, role: 1 }, options: { name: 'tenant_role_idx' } },
    { fields: { tenantId: 1, isActive: 1 }, options: { name: 'tenant_active_idx' } },
    // Indice per Firebase UID
    { fields: { firebaseUid: 1 }, options: { unique: true, sparse: true, name: 'firebase_uid_idx' } },
    // Indice per query di autenticazione
    { fields: { email: 1, isActive: 1 }, options: { name: 'auth_lookup_idx' } }
  ],

  // Invoice Collection Indexes
  invoices: [
    // Indici principali per tenant
    { fields: { tenantId: 1, uploadDate: -1 }, options: { name: 'tenant_upload_date_idx' } },
    { fields: { tenantId: 1, status: 1 }, options: { name: 'tenant_status_idx' } },
    { fields: { tenantId: 1, supplierId: 1 }, options: { name: 'tenant_supplier_idx' } },
    
    // Indici per analisi e reporting
    // Sostituire
    { fields: { tenantId: 1, 'invoiceData.dataDocumento': -1 }, options: { name: 'tenant_invoice_date_idx' } },
    { fields: { tenantId: 1, 'invoiceData.totaleDocumento': 1 }, options: { name: 'tenant_total_amount_idx' } },
    
    // Con
    { fields: { tenantId: 1, 'invoiceDate': -1 }, options: { name: 'tenant_invoice_date_idx' } },
    { fields: { tenantId: 1, 'totalAmount': 1 }, options: { name: 'tenant_total_amount_idx' } },
    
    // Indici per ricerca prodotti
    { fields: { tenantId: 1, 'lineItems.productId': 1 }, options: { name: 'tenant_product_items_idx' } },
    { fields: { tenantId: 1, 'lineItems.matchedProductId': 1 }, options: { name: 'tenant_matched_products_idx' } },
    
    // Indice per numero documento (ricerca duplicati)
    { fields: { tenantId: 1, 'invoiceData.numeroDocumento': 1, supplierId: 1 }, options: { name: 'duplicate_check_idx' } },
    
    // Indice per processing jobs
    { fields: { processingJobId: 1 }, options: { sparse: true, name: 'processing_job_idx' } },
    
    // Indice per validazione
    { fields: { tenantId: 1, 'validationErrors.0': 1 }, options: { sparse: true, name: 'validation_errors_idx' } }
  ],

  // Product Collection Indexes
  products: [
    // Indici principali per tenant
    { fields: { tenantId: 1, codeInternal: 1 }, options: { unique: true, name: 'tenant_code_unique' } },
    { fields: { tenantId: 1, descriptionStd: 1 }, options: { name: 'tenant_description_std_idx' } },
    { fields: { tenantId: 1, category: 1 }, options: { name: 'tenant_category_idx' } },
    { fields: { tenantId: 1, approvalStatus: 1 }, options: { name: 'tenant_approval_idx' } },
    
    // Indici per ricerca duplicati
    { fields: { tenantId: 1, descriptionStd: 1, ignoredDuplicate: 1 }, options: { name: 'duplicate_detection_idx' } },
    
    // Indici per prezzi e fornitori
    { fields: { tenantId: 1, 'prices.supplierId': 1 }, options: { name: 'tenant_supplier_prices_idx' } },
    { fields: { tenantId: 1, 'prices.date': -1 }, options: { name: 'tenant_price_date_idx' } },
    
    // Indice per ricerca testuale
    { fields: { description: 'text', 'descriptions.description': 'text' }, options: { name: 'product_text_search_idx' } }
  ],

  // Supplier Collection Indexes
  suppliers: [
    // Indici già esistenti nel modello
    { fields: { tenantId: 1, vatNumber: 1 }, options: { unique: true, name: 'tenant_vat_unique' } },
    { fields: { tenantId: 1, codiceFiscale: 1 }, options: { unique: true, sparse: true, name: 'tenant_cf_unique' } },
    { fields: { tenantId: 1, name: 1 }, options: { name: 'tenant_name_idx' } },
    
    // Indici aggiuntivi per performance
    { fields: { tenantId: 1, isActive: 1 }, options: { name: 'tenant_active_suppliers_idx' } },
    { fields: { tenantId: 1, name: 1, isActive: 1 }, options: { name: 'tenant_active_name_idx' } }
  ],

  // Tenant Collection Indexes
  tenants: [
    // Indici per ricerca e validazione
    { fields: { name: 1 }, options: { name: 'tenant_name_idx' } },
    { fields: { vatNumber: 1 }, options: { unique: true, sparse: true, name: 'tenant_vat_unique' } },
    { fields: { codiceFiscale: 1 }, options: { unique: true, sparse: true, name: 'tenant_cf_unique' } },
    { fields: { isActive: 1 }, options: { name: 'tenant_active_idx' } },
    { fields: { createdAt: -1 }, options: { name: 'tenant_created_idx' } }
  ],

  // Invitation Collection Indexes
  invitations: [
    // Indice già esistente nel modello
    { fields: { expiresAt: 1 }, options: { expireAfterSeconds: 0, name: 'invitation_expiry_idx' } },
    
    // Indici aggiuntivi
    { fields: { tenantId: 1, email: 1 }, options: { name: 'tenant_email_invitation_idx' } },
    { fields: { tenantId: 1, status: 1 }, options: { name: 'tenant_status_invitation_idx' } },
    { fields: { invitedBy: 1 }, options: { name: 'invited_by_idx' } },
    { fields: { createdAt: -1 }, options: { name: 'invitation_created_idx' } }
  ],

  // Alert Collection Indexes
  alerts: [
    // Indici già esistenti nel modello (compound indexes)
    { fields: { tenantId: 1, userId: 1, productId: 1, type: 1 }, options: { name: 'alert_compound_idx' } },
    { fields: { tenantId: 1, isActive: 1 }, options: { name: 'tenant_active_alerts_idx' } },
    
    // Indici aggiuntivi per performance
    { fields: { tenantId: 1, type: 1, isActive: 1 }, options: { name: 'tenant_type_active_idx' } },
    { fields: { tenantId: 1, lastTriggered: -1 }, options: { name: 'tenant_last_triggered_idx' } },
    { fields: { tenantId: 1, createdAt: -1 }, options: { name: 'tenant_alert_created_idx' } }
  ],

  // ProcessingJob Collection Indexes
  processingjobs: [
    { fields: { tenantId: 1, status: 1 }, options: { name: 'tenant_job_status_idx' } },
    { fields: { tenantId: 1, createdAt: -1 }, options: { name: 'tenant_job_created_idx' } },
    { fields: { tenantId: 1, jobType: 1 }, options: { name: 'tenant_job_type_idx' } },
    { fields: { status: 1, createdAt: -1 }, options: { name: 'job_status_created_idx' } }
  ],

  // Subscription Collection Indexes
  subscriptions: [
    { fields: { tenantId: 1 }, options: { unique: true, name: 'tenant_subscription_unique' } },
    { fields: { status: 1 }, options: { name: 'subscription_status_idx' } },
    { fields: { tenantId: 1, status: 1 }, options: { name: 'tenant_sub_status_idx' } },
    { fields: { expiresAt: 1 }, options: { name: 'subscription_expiry_idx' } }
  ],

  // TenantRegistrationToken Collection Indexes
  tenantregistrationtokens: [
    { fields: { token: 1 }, options: { unique: true, name: 'registration_token_unique' } },
    { fields: { tenantId: 1 }, options: { name: 'tenant_registration_idx' } },
    { fields: { expiresAt: 1 }, options: { expireAfterSeconds: 0, name: 'token_expiry_idx' } },
    { fields: { isUsed: 1 }, options: { name: 'token_used_idx' } }
  ]
};

export default databaseIndexes;