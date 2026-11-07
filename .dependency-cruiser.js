/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'modulo-sin-importes-internos',
      comment:
        'Un módulo de apps/api/src/modulos no puede importar archivos internos de otro módulo. Debe usar solo su interfaz pública (index.ts).',
      severity: 'error',
      from: {
        path: '^apps/api/src/modulos/([^/]+)/.+',
        // Excepción 1: una prueba unitaria importa legítimamente el servicio ajeno que va a simular.
        pathNot: '\\.spec\\.ts$'
      },
      to: {
        path: '^apps/api/src/modulos/([^/]+)/.+',
        pathNot: [
          '^apps/api/src/modulos/($1/|[^/]+/index\\.ts$)',
          // Excepción 2: API pública transversal de seguridad (guard, decorador, tipos, permisos y roles),
          // usada por diseño en cada controlador. Esta lista solo crece con aprobación.
          '^apps/api/src/modulos/acceso/(acceso\\.guard|permiso\\.decorator|acceso\\.tipos|permisos|roles-usuario)\\.ts$',
          // Excepción 3: auditoría es transversal (se registra en casi todo endpoint). Solo servicio y módulo.
          '^apps/api/src/modulos/auditoria/auditoria\\.(service|module)\\.ts$'
        ]
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
