module.exports = {
  projects: [
    {
      displayName: 'unit',
      testMatch: ['<rootDir>/tests/unit/**/*.test.js'],
      collectCoverage: true,
      coverageDirectory: 'coverage/unit'
    },
    {
      displayName: 'integration',
      testMatch: ['<rootDir>/tests/integration/**/*.test.js'],
      collectCoverage: true,
      coverageDirectory: 'coverage/integration'
    }
  ]
};
