// Setup per i test Jest

// Configura le variabili d'ambiente per i test
process.env.NODE_ENV = 'test';
process.env.PORT = '0'; // Usa porta random per i test
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.FIREBASE_PROJECT_ID = 'test-project';

// Aumenta il timeout per i test di rate limiting
jest.setTimeout(15000);