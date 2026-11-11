/**
 * Genera la plantilla de Excel de almacén (lógica en src/scripts/plantilla-almacen.ts). Sin base de datos ni datos reales.
 *
 *   cd apps/api && npx ts-node --transpile-only scripts/generar-plantilla-almacen.ts [salida.xlsx]
 *   (sin argumento escribe docs/plantillas/Plantilla-Almacen-Caprichos.xlsx)
 */
import * as fs from 'fs';
import * as path from 'path';
import { generarPlantilla } from '../src/scripts/plantilla-almacen';

const salida = process.argv[2] || path.resolve(__dirname, '../../../docs/plantillas/Plantilla-Almacen-Caprichos.xlsx');
fs.mkdirSync(path.dirname(salida), { recursive: true });
fs.writeFileSync(salida, generarPlantilla());
console.log(`Plantilla escrita en ${salida}`);
