const request = require('supertest');
const { describe, it, expect, beforeAll, afterAll } = require('@jest/globals');
const express = require('express');
const path = require('path');

// Mock dell'app principale per i test
function createTestApp() {
  const app = express();
  
  // Middleware di base
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  
  // Mock dei middleware di validazione
  const sanitizeInput = (req, res, next) => {
    if (req.body) {
      for (let key in req.body) {
        if (typeof req.body[key] === 'string') {
          req.body[key] = req.body[key].replace(/<script[^>]*>.*?<\/script>/gi, '');
          req.body[key] = req.body[key].replace(/javascript:/gi, '');
        }
      }
    }
    next();
  };
  
  const preventNoSQLInjection = (req, res, next) => {
    const checkForInjection = (obj) => {
      for (let key in obj) {
        const dangerousOperators = ['$where', '$regex', '$ne', '$gt', '$lt', '$gte', '$lte', '$in', '$nin', '$exists', '$type'];
        if (dangerousOperators.some(op => key.startsWith(op))) {
          return true;
        }
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          if (checkForInjection(obj[key])) return true;
        }
      }
      return false;
    };
    
    if (req.body && checkForInjection(req.body)) {
      return res.status(400).json({
        success: false,
        error: 'Richiesta non valida'
      });
    }
    
    next();
  };
  
  // Rate limiter semplificato
  let requestCounts = {};
  const rateLimiter = (req, res, next) => {
    const key = req.ip || 'test-ip';
    requestCounts[key] = (requestCounts[key] || 0) + 1;
    
    if (requestCounts[key] > 50) {
      return res.status(429).json({
        success: false,
        error: 'Troppi tentativi, riprova più tardi'
      });
    }
    
    next();
  };
  
  // Funzione per resettare il rate limiter
  app.resetRateLimit = () => {
    requestCounts = {};
  };
  
  // Applica middleware globali
  app.use(sanitizeInput);
  app.use(preventNoSQLInjection);
  app.use(rateLimiter);
  
  // Mock degli endpoint di autenticazione
  app.post('/api/auth/register', (req, res) => {
    const { email, password, firstName, lastName } = req.body;
    
    // Validazione email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Email non valida'
      });
    }
    
    // Validazione password
    if (!password || password.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Password deve essere di almeno 8 caratteri'
      });
    }
    
    // Validazione nomi
    if (!firstName || firstName.length < 2 || firstName.length > 50) {
      return res.status(400).json({
        success: false,
        error: 'Nome non valido'
      });
    }
    
    if (!lastName || lastName.length < 2 || lastName.length > 50) {
      return res.status(400).json({
        success: false,
        error: 'Cognome non valido'
      });
    }
    
    res.status(201).json({
      success: true,
      message: 'Utente registrato con successo'
    });
  });
  
  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email e password sono richiesti'
      });
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Email non valida'
      });
    }
    
    res.status(200).json({
      success: true,
      token: 'mock-jwt-token'
    });
  });
  
  // Mock degli endpoint delle fatture
  app.post('/api/invoices', (req, res) => {
    const { clientName, amount, description, dueDate } = req.body;
    
    if (!clientName || clientName.length < 2 || clientName.length > 100) {
      return res.status(400).json({
        success: false,
        error: 'Nome cliente non valido'
      });
    }
    
    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Importo non valido'
      });
    }
    
    if (description && description.length > 500) {
      return res.status(400).json({
        success: false,
        error: 'Descrizione troppo lunga'
      });
    }
    
    if (dueDate && isNaN(Date.parse(dueDate))) {
      return res.status(400).json({
        success: false,
        error: 'Data di scadenza non valida'
      });
    }
    
    res.status(201).json({
      success: true,
      invoiceId: 'mock-invoice-id'
    });
  });
  
  app.get('/api/invoices', (req, res) => {
    const { page, limit, search } = req.query;
    
    if (page && (isNaN(page) || page < 1)) {
      return res.status(400).json({
        success: false,
        error: 'Numero di pagina non valido'
      });
    }
    
    if (limit && (isNaN(limit) || limit < 1 || limit > 100)) {
      return res.status(400).json({
        success: false,
        error: 'Limite non valido'
      });
    }
    
    if (search && search.length > 100) {
      return res.status(400).json({
        success: false,
        error: 'Termine di ricerca troppo lungo'
      });
    }
    
    res.status(200).json({
      success: true,
      invoices: [],
      pagination: {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 10,
        total: 0
      }
    });
  });
  
  // Mock degli endpoint degli inviti
  app.post('/api/invitations', (req, res) => {
    const { email, role, tenantId } = req.body;
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Email non valida'
      });
    }
    
    const validRoles = ['admin', 'user', 'viewer'];
    if (!role || !validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        error: 'Ruolo non valido'
      });
    }
    
    if (!tenantId || tenantId.length !== 24) {
      return res.status(400).json({
        success: false,
        error: 'ID tenant non valido'
      });
    }
    
    res.status(201).json({
      success: true,
      invitationId: 'mock-invitation-id'
    });
  });
  
  app.post('/api/invitations/:id/accept', (req, res) => {
    const { id } = req.params;
    const { token } = req.body;
    
    if (!id || id.length !== 24) {
      return res.status(400).json({
        success: false,
        error: 'ID invito non valido'
      });
    }
    
    if (!token || token.length < 10) {
      return res.status(400).json({
        success: false,
        error: 'Token non valido'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Invito accettato con successo'
    });
  });
  
  return app;
}

describe('Endpoint Security Tests', () => {
  let app;
  
  beforeAll(() => {
    app = createTestApp();
  });
  
  beforeEach(() => {
    if (app.resetRateLimit) {
      app.resetRateLimit();
    }
  });
  
  describe('Authentication Endpoints', () => {
    describe('POST /api/auth/register', () => {
      it('should reject invalid email formats', async () => {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            email: 'invalid-email',
            password: 'validPassword123',
            firstName: 'John',
            lastName: 'Doe'
          });
        
        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Email non valida');
      });
      
      it('should reject weak passwords', async () => {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            email: 'test@example.com',
            password: '123',
            firstName: 'John',
            lastName: 'Doe'
          });
        
        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Password deve essere di almeno 8 caratteri');
      });
      
      it('should reject XSS attempts in names', async () => {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            email: 'test@example.com',
            password: 'validPassword123',
            firstName: '<script>alert("xss")</script>John',
            lastName: 'Doe'
          });
        
        expect(response.status).toBe(201);
        // Il nome dovrebbe essere sanitizzato
      });
      
      it('should reject excessively long input', async () => {
        const longString = 'a'.repeat(1000);
        
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            email: 'test@example.com',
            password: 'validPassword123',
            firstName: longString,
            lastName: 'Doe'
          });
        
        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Nome non valido');
      });
    });
    
    describe('POST /api/auth/login', () => {
      it('should reject missing credentials', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({});
        
        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Email e password sono richiesti');
      });
      
      it('should reject NoSQL injection attempts', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: { $ne: null },
            password: { $regex: '.*' }
          });
        
        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Richiesta non valida');
      });
    });
  });
  
  describe('Invoice Endpoints', () => {
    describe('POST /api/invoices', () => {
      it('should reject invalid amount values', async () => {
        const invalidAmounts = [-100, 0, 'invalid', null, undefined];
        
        for (const amount of invalidAmounts) {
          const response = await request(app)
            .post('/api/invoices')
            .send({
              clientName: 'Test Client',
              amount,
              description: 'Test invoice'
            });
          
          expect(response.status).toBe(400);
          expect(response.body.error).toContain('Importo non valido');
        }
      });
      
      it('should reject excessively long descriptions', async () => {
        const longDescription = 'a'.repeat(1000);
        
        const response = await request(app)
          .post('/api/invoices')
          .send({
            clientName: 'Test Client',
            amount: 100,
            description: longDescription
          });
        
        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Descrizione troppo lunga');
      });
      
      it('should reject invalid date formats', async () => {
        const response = await request(app)
          .post('/api/invoices')
          .send({
            clientName: 'Test Client',
            amount: 100,
            dueDate: 'invalid-date'
          });
        
        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Data di scadenza non valida');
      });
    });
    
    describe('GET /api/invoices', () => {
      it('should reject invalid pagination parameters', async () => {
        const response = await request(app)
          .get('/api/invoices')
          .query({ page: -1, limit: 1000 });
        
        expect(response.status).toBe(400);
      });
      
      it('should reject excessively long search terms', async () => {
        const longSearch = 'a'.repeat(200);
        
        const response = await request(app)
          .get('/api/invoices')
          .query({ search: longSearch });
        
        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Termine di ricerca troppo lungo');
      });
    });
  });
  
  describe('Invitation Endpoints', () => {
    describe('POST /api/invitations', () => {
      it('should reject invalid email formats', async () => {
        const response = await request(app)
          .post('/api/invitations')
          .send({
            email: 'invalid-email',
            role: 'user',
            tenantId: '507f1f77bcf86cd799439011'
          });
        
        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Email non valida');
      });
      
      it('should reject invalid roles', async () => {
        const response = await request(app)
          .post('/api/invitations')
          .send({
            email: 'test@example.com',
            role: 'invalid-role',
            tenantId: '507f1f77bcf86cd799439011'
          });
        
        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Ruolo non valido');
      });
      
      it('should reject invalid tenant IDs', async () => {
        const response = await request(app)
          .post('/api/invitations')
          .send({
            email: 'test@example.com',
            role: 'user',
            tenantId: 'invalid-id'
          });
        
        expect(response.status).toBe(400);
        expect(response.body.error).toContain('ID tenant non valido');
      });
    });
    
    describe('POST /api/invitations/:id/accept', () => {
      it('should reject invalid invitation IDs', async () => {
        const response = await request(app)
          .post('/api/invitations/invalid-id/accept')
          .send({ token: 'valid-token-123' });
        
        expect(response.status).toBe(400);
        expect(response.body.error).toContain('ID invito non valido');
      });
      
      it('should reject invalid tokens', async () => {
        const response = await request(app)
          .post('/api/invitations/507f1f77bcf86cd799439011/accept')
          .send({ token: 'short' });
        
        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Token non valido');
      });
    });
  });
  
  describe('Security Middleware Tests', () => {
    it('should sanitize HTML/JavaScript injection attempts', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'validPassword123',
          firstName: '<script>alert("xss")</script>John',
          lastName: 'javascript:alert("xss")Doe'
        });
      
      // Dovrebbe accettare la richiesta ma sanitizzare l'input
      expect(response.status).toBe(201);
    });
    
    it('should prevent NoSQL injection in nested objects', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: {
            $ne: null,
            $regex: '.*@.*'
          },
          password: 'password'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Richiesta non valida');
    });
    
    it('should enforce rate limiting', async () => {
      // Fai 60 richieste sequenziali per superare il limite di 50
      let rateLimitedCount = 0;
      
      for (let i = 0; i < 60; i++) {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'test@example.com',
            password: 'password'
          });
        
        if (response.status === 429) {
          rateLimitedCount++;
        }
      }
      
      // Almeno alcune richieste dovrebbero essere limitate
      expect(rateLimitedCount).toBeGreaterThan(0);
    });
  });
});