module.exports = {
    rootDir: './',
    setupFilesAfterEnv: ['<rootDir>/src/setupTests.js'],
    testEnvironment: 'jsdom',
    moduleNameMapper: {
      '\\.(css|less|scss)$': 'identity-obj-proxy'
    }
  };
  