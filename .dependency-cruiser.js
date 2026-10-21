/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'modulo-sin-importes-internos',
      comment:
        'Un módulo de apps/api/src/modulos no puede importar archivos internos de otro módulo. Debe usar solo su interfaz pública (index.ts).',
      severity: 'error',
      from: {
        path: '^apps/api/src/modulos/([^/]+)/.+'
      },
      to: {
        path: '^apps/api/src/modulos/([^/]+)/.+',
        pathNot: '^apps/api/src/modulos/($1/|[^/]+/index\\.ts$)'
      }
    }
  ],
  options: {
    doNotFollow: {
      path: 'node_modules'
    },
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: 'tsconfig.base.json'
    }
  }
};
