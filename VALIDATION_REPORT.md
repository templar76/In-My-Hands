# Report Validazione Input API - InMyHands

## Panoramica
È stata implementata una validazione robusta degli input per tutti gli endpoint API del progetto InMyHands, con focus particolare su sicurezza, prevenzione degli attacchi e protezione dei dati.

## Componenti Implementati

### 1. Middleware di Validazione Generale (`server/src/middleware/validation.js`)

#### Funzionalità Principali:
- **Sanitizzazione Input**: Rimozione di script, JavaScript, event handlers e template literals
- **Prevenzione NoSQL Injection**: Blocco di operatori MongoDB pericolosi ($where, $regex, $ne, etc.)
- **Validazione ObjectId**: Controllo formato MongoDB ObjectId
- **Validazione Email**: Regex pattern e sanitizzazione
- **Validazione Paginazione**: Controlli su page/limit con valori massimi
- **Limitazione Payload**: Controllo dimensione richieste (10MB)
- **Validazione Ricerca**: Controlli su lunghezza e caratteri permessi
- **Validazione Ordinamento**: Whitelist di campi ordinabili

#### Middleware Specifici:
- `handleValidationErrors`: Gestione errori con logging dettagliato
- `sanitizeInput`: Sanitizzazione ricorsiva con prevenzione DoS
- `preventNoSQLInjection`: Blocco operatori MongoDB pericolosi
- `limitPayloadSize`: Limitazione dimensione payload
- `validateSearchQuery`: Validazione query di ricerca
- `validateSortOptions`: Validazione opzioni di ordinamento

### 2. Middleware di Rate Limiting (`server/src/middleware/rateLimiter.js`)

#### Rate Limiters Implementati:
- **generalLimiter**: 100 richieste/15min per IP+User-Agent
- **authLimiter**: 5 tentativi/15min per autenticazione
- **uploadLimiter**: 10 upload/ora per utente
- **criticalLimiter**: 3 richieste/15min per operazioni critiche
- **searchLimiter**: 50 ricerche/15min
- **createLimiter**: 20 creazioni/15min

#### Funzionalità:
- Supporto Redis opzionale per distribuzione
- Logging dettagliato degli eventi
- Skip automatico per health checks
- Key generator personalizzati per diversi scenari

### 3. Validazione Inviti (`server/src/middleware/invitationValidation.js`)

#### Validazioni Specifiche:
- **Email**: Formato e sanitizzazione
- **Ruoli**: Whitelist di ruoli validi
- **Token**: Lunghezza e formato
- **Tenant ID**: Formato ObjectId
- **Consistenza**: Autorizzazione utente per tenant
- **Limiti**: Controllo numero inviti per tenant

#### Catene di Validazione:
- `validateAcceptInvitation`: Validazione accettazione inviti
- `validateCreateInvitation`: Validazione creazione inviti
- `validateTenantParam`: Validazione parametri tenant
- `validateInvitationParam`: Validazione parametri invito
- `checkExistingUser`: Controllo utenti esistenti
- `validateCreateTenantUser`: Validazione creazione utenti tenant

### 4. Integrazione Route

#### Route Protette:
- **Autenticazione** (`/api/auth/*`): authLimiter + validazione credenziali
- **Fatture** (`/api/invoices/*`): generalLimiter + validazione dati business
- **Inviti** (`/api/invitations/*`): criticalLimiter + validazione specifica
- **Upload** (`/api/upload/*`): uploadLimiter + validazione file

## Test di Sicurezza

### Suite di Test Implementate

#### 1. Test di Validazione Base (`server/tests/validation.test.js`)
- Validazione email (formato, sanitizzazione)
- Validazione password (lunghezza, complessità)
- Prevenzione NoSQL injection
- Test rate limiting
- Sanitizzazione HTML/JavaScript

#### 2. Test Endpoint Completi (`server/tests/endpoints.test.js`)
- **Autenticazione**: 6 test per registrazione/login
- **Fatture**: 5 test per creazione/ricerca
- **Inviti**: 5 test per creazione/accettazione
- **Sicurezza**: 3 test per middleware di sicurezza

### Risultati Test
- **27 test totali**: Tutti superati ✅
- **Copertura**: Endpoint critici, validazione input, rate limiting
- **Scenari**: Email invalide, injection attacks, rate limiting, sanitizzazione

## Protezioni Implementate

### 1. Injection Attacks
- **XSS**: Rimozione script tags, event handlers, javascript: URLs
- **NoSQL Injection**: Blocco operatori MongoDB ($where, $regex, etc.)
- **Template Injection**: Rimozione template literals

### 2. DoS Protection
- **Rate Limiting**: Multipli livelli per diversi endpoint
- **Payload Size**: Limitazione a 10MB
- **Deep Nesting**: Prevenzione oggetti troppo annidati
- **String Length**: Troncamento stringhe eccessive

### 3. Data Validation
- **Type Checking**: Validazione tipi di dato
- **Format Validation**: Email, ObjectId, date
- **Range Validation**: Lunghezza stringhe, valori numerici
- **Whitelist Validation**: Ruoli, campi ordinamento

### 4. Business Logic
- **Authorization**: Controllo accesso tenant
- **Consistency**: Validazione coerenza dati
- **Limits**: Controllo limiti business (inviti per tenant)

## Configurazione e Deployment

### Variabili Ambiente
```env
NODE_ENV=production
REDIS_URL=redis://localhost:6379  # Opzionale per rate limiting distribuito
```

### Dipendenze Aggiunte
- `validator`: Sanitizzazione e validazione
- `rate-limit-redis`: Rate limiting distribuito
- `jest`, `supertest`: Testing

### Middleware Stack
```javascript
// Ordine di applicazione middleware
app.use(helmet());
app.use(express.json({ limit: '10mb' }));
app.use(limitPayloadSize);
app.use(sanitizeInput);
app.use(preventNoSQLInjection);
app.use(generalLimiter);
// ... route specifiche con rate limiter dedicati
```

## Metriche e Monitoring

### Logging Implementato
- **Errori di Validazione**: Campo, valore, messaggio
- **Rate Limiting**: IP, endpoint, timestamp
- **Injection Attempts**: Tipo attacco, payload
- **User Context**: User-Agent, Tenant ID, User ID

### Raccomandazioni Monitoring
- Monitorare rate limiting events
- Alerting su injection attempts
- Dashboard errori di validazione
- Metriche performance middleware

## Prossimi Passi

### Miglioramenti Futuri
1. **CAPTCHA**: Per endpoint critici dopo rate limiting
2. **IP Whitelisting**: Per API amministrative
3. **Request Signing**: Per API B2B
4. **Advanced Threat Detection**: ML-based anomaly detection
5. **Audit Logging**: Tracciamento completo azioni utente

### Manutenzione
- Review periodica whitelist ruoli
- Aggiornamento regex validazione
- Tuning rate limiting basato su metriche
- Test penetration periodici

## Conclusioni

La validazione implementata fornisce una protezione robusta contro:
- ✅ Injection attacks (XSS, NoSQL, Template)
- ✅ DoS attacks (Rate limiting, payload size)
- ✅ Data corruption (Type validation, sanitization)
- ✅ Business logic bypass (Authorization, consistency)

Tutti i test di sicurezza sono superati e il sistema è pronto per il deployment in produzione.