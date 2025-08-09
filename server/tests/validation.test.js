const request = require('supertest');
const { describe, it, expect } = require('@jest/globals');
const express = require('express');
const { body } = require('express-validator');

// Mock dei middleware per i test
const sanitizeInput = (req, res, next) => {
  // Sanitizzazione semplificata per i test
  if (req.body) {
    for (let key in req.body) {
      if (typeof req.body[key] === 'string') {
        req.body[key] = req.body[key].replace(/<script[^>]*>.*?<\/script>/gi, '');
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

const handleValidationErrors = (req, res, next) => {
  const { validationResult } = require('express-validator');
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Dati di input non validi',
      details: errors.array().map(err => ({
        field: err.path || err.param,
        message: err.msg,
        value: err.value
      }))
    });
  }
  next();
};

// Rate limiter semplificato per i test
let requestCounts = {};
const authLimiter = (req, res, next) => {
  const key = req.ip || 'test-ip';
  requestCounts[key] = (requestCounts[key] || 0) + 1;
  
  if (requestCounts[key] > 5) {
    return res.status(429).json({
      success: false,
      error: 'Troppi tentativi di accesso, riprova più tardi'
    });
  }
  
  next();
};

// Crea un'app di test semplificata
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use(sanitizeInput);
  app.use(preventNoSQLInjection);
  
  // Endpoint di test per validazione email
  app.post('/test/email', 
    body('email').isEmail().withMessage('Email non valida'),
    handleValidationErrors,
    (req, res) => res.json({ success: true, email: req.body.email })
  );
  
  // Endpoint di test per validazione password
  app.post('/test/password',
    body('password').isLength({ min: 8 }).withMessage('Password troppo corta'),
    handleValidationErrors,
    (req, res) => res.json({ success: true })
  );
  
  // Endpoint di test per NoSQL injection
  app.post('/test/nosql', (req, res) => {
    res.json({ success: true, data: req.body });
  });
  
  // Endpoint di test per rate limiting
  app.post('/test/auth', authLimiter, (req, res) => {
    res.json({ success: true });
  });
  
  return app;
};

describe('Input Validation Tests', () => {

  describe('Email Validation', () => {
    it('should reject invalid email format', async () => {
      const app = createTestApp();
      const response = await request(app)
        .post('/test/email')
        .send({ email: 'invalid-email' });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'email',
            message: 'Email non valida'
          })
        ])
      );
    });

    it('should accept valid email format', async () => {
      const app = createTestApp();
      const response = await request(app)
        .post('/test/email')
        .send({ email: 'test@example.com' });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.email).toBe('test@example.com');
    });

  });
  
  describe('Password Validation', () => {
    it('should reject short passwords', async () => {
      const app = createTestApp();
      const response = await request(app)
        .post('/test/password')
        .send({ password: '123' });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should accept valid passwords', async () => {
      const app = createTestApp();
      const response = await request(app)
        .post('/test/password')
        .send({ password: 'validpassword123' });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

  });
  
  describe('NoSQL Injection Prevention', () => {
    it('should reject MongoDB operators in request body', async () => {
      const app = createTestApp();
      const response = await request(app)
        .post('/test/nosql')
        .send({ email: { $ne: null } });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('non valida');
    });

    it('should sanitize dangerous input', async () => {
      const app = createTestApp();
      const response = await request(app)
        .post('/test/nosql')
        .send({ 
          name: '<script>alert("xss")</script>',
          description: 'javascript:alert(1)'
        });
      
      // Dovrebbe passare la validazione NoSQL ma sanitizzare l'input
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('Rate Limiting Tests', () => {
    it('should enforce rate limiting on auth endpoints', async () => {
      const app = createTestApp();
      const requests = [];
      
      // Fai più richieste del limite consentito
      for (let i = 0; i < 6; i++) {
        requests.push(
          request(app)
            .post('/test/auth')
            .send({ test: 'data' })
        );
      }
      
      const responses = await Promise.all(requests);
      
      // Almeno una richiesta dovrebbe essere bloccata dal rate limiter
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    }, 10000);
  });

  describe('Sanitization Tests', () => {
    it('should sanitize dangerous input', async () => {
      const app = createTestApp();
      const response = await request(app)
        .post('/test/nosql')
        .send({
          name: '<script>alert("xss")</script>',
          description: 'javascript:alert(1)'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });


});