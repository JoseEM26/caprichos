module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  // Las pruebas del reinicio de datos (prisma/reset) y de la migración de datos (prisma/migracion-datos) viven junto a su script
  roots: ['<rootDir>', '<rootDir>/../prisma/reset', '<rootDir>/../prisma/migracion-datos'],
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  moduleNameMapper: {
    '^@caprichos/compartido$': '<rootDir>/../../../packages/compartido/src/index.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  maxWorkers: 4,
};
