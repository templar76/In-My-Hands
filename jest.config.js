export default {
  testEnvironment: 'node',
  transform: {},
  testMatch: [
    '**/tests/**/*.test.js'
  ],
  collectCoverageFrom: [
    'server/src/**/*.js',
    '!server/src/config/**',
    '!server/src/utils/logger.js'
  ],
  moduleFileExtensions: ['js', 'json'],
  testTimeout: 10000
};