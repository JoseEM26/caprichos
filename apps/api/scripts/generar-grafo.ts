import * as fs from 'fs';
import * as path from 'path';
import { ManualesCargadorService } from '../src/modulos/ayuda-admin/manuales-cargador.service';
import { AyudaGrafoService } from '../src/modulos/ayuda-admin/ayuda-grafo.service';

function main() {
  console.log('🔄 Generando grafo de documentación de ayuda...');

  // Determinar ruta de manuales oficiales
  const posiblesRutasManuales = [
    path.resolve(__dirname, '../src/modulos/ayuda-admin/manuales'),
    path.resolve(process.cwd(), 'src/modulos/ayuda-admin/manuales'),
    path.resolve(process.cwd(), 'apps/api/src/modulos/ayuda-admin/manuales'),
  ];

  const rutaManuales = posiblesRutasManuales.find((p) => fs.existsSync(p));
  if (!rutaManuales) {
    console.error('❌ No se encontró la carpeta de manuales en:', posiblesRutasManuales);
    process.exit(1);
  }

  const cargador = new ManualesCargadorService();
  cargador.cargarManuales(rutaManuales);

  const grafoService = new AyudaGrafoService(cargador);
  grafoService.construirGrafo();

  const resumen = grafoService.obtenerResumenGrafo();
  const diagramaMermaid = grafoService.generarMermaidGrafo();

  // Directorio de salida docs/ayuda/ en la raíz del repositorio
  const posiblesRutasDocs = [
    path.resolve(__dirname, '../../../docs/ayuda'),
    path.resolve(process.cwd(), '../../docs/ayuda'),
    path.resolve(process.cwd(), 'docs/ayuda'),
  ];

  // Buscar raíz del repositorio (donde está package.json principal o .git)
  let dirSalida = posiblesRutasDocs[0];
  for (const ruta of posiblesRutasDocs) {
    const padre = path.dirname(ruta);
    if (fs.existsSync(padre)) {
      dirSalida = ruta;
      break;
    }
  }

  if (!fs.existsSync(dirSalida)) {
    fs.mkdirSync(dirSalida, { recursive: true });
  }

  const rutaJson = path.join(dirSalida, 'grafo-ayuda.json');
  const rutaMd = path.join(dirSalida, 'grafo-ayuda.md');

  // 1. Escribir grafo-ayuda.json
  fs.writeFileSync(rutaJson, JSON.stringify(resumen, null, 2), 'utf-8');
  console.log(`✅ JSON guardado en: ${rutaJson}`);

  // 2. Escribir grafo-ayuda.md
  const numModulos = resumen.nodos.filter((n) => n.tipo === 'modulo').length;
  const numTareas = resumen.nodos.filter((n) => n.tipo === 'tarea').length;
  const numRoles = resumen.nodos.filter((n) => n.tipo === 'rol').length;
  const numPermisos = resumen.nodos.filter((n) => n.tipo === 'permiso').length;

  const contenidoMd = `# Grafo de Conocimiento de Documentación - Panel Administrativo

Este documento contiene la representación del grafo de conocimiento derivado automáticamente de los manuales Markdown oficiales en \`apps/api/src/modulos/ayuda-admin/manuales/\`.

Generado mediante el comando:
\`\`\`bash
pnpm --filter @caprichos/api ayuda:grafo
\`\`\`

## Métricas del Grafo

- **Nodos totales**: ${resumen.nodos.length}
  - Módulos: ${numModulos}
  - Tareas (\`## Como se hace\`): ${numTareas}
  - Roles del sistema: ${numRoles}
  - Permisos requeridos: ${numPermisos}
- **Aristas tipadas totales**: ${resumen.aristas.length}

## Diagrama Mermaid de Módulos y Relaciones

\`\`\`mermaid
${diagramaMermaid}
\`\`\`

## Listado de Módulos y Rutas

| Módulo | Título | Ruta |
| :--- | :--- | :--- |
${resumen.nodos
  .filter((n) => n.tipo === 'modulo')
  .map((m) => `| \`${m.modulo}\` | ${m.etiqueta.replace(/ \([^)]+\)$/, '')} | \`${m.ruta}\` |`)
  .join('\n')}
`;

  fs.writeFileSync(rutaMd, contenidoMd, 'utf-8');
  console.log(`✅ Markdown guardado en: ${rutaMd}`);
  console.log(`📊 Grafo completado con éxito: ${resumen.nodos.length} nodos, ${resumen.aristas.length} aristas.`);
}

main();
