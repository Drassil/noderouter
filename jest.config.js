process.env = Object.assign(process.env, {NODE_ENV: 'test'});

module.exports = {
  rootDir: process.cwd(),
  collectCoverage: true,
  coverageDirectory: '<rootDir>/docs/coverage',
  testRegex: '.*\\.test\\.js$',
  json: false,
};
