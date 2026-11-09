// Empaqueta dist/entrada.js en un solo .cjs inyectando la versión de compilación (AGENTE_VERSION / AGENTE_COMMIT).
import { build } from 'esbuild';

const version = process.env.AGENTE_VERSION || '0.1.0-dev';
const commit = process.env.AGENTE_COMMIT || 'dev';
await build({
  entryPoints: ['dist/entrada.js'],
  bundle: true,
  platform: 'node',
  target: 'node22',
  outfile: 'dist-bundle/agente.cjs',
  logLevel: 'warning',
  define: { __AGENTE_VERSION__: JSON.stringify(version), __AGENTE_COMMIT__: JSON.stringify(commit) },
});
