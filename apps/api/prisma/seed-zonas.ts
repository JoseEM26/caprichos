import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

/**
 * Carga ZONAS_GEO e INFO_DEFAULT evaluando el script de la maqueta
 * en mockup/project/Main.dc.html sin alterar el entorno.
 */
function cargarDatosMaqueta() {
  const rutaCandidatos = [
    path.resolve(process.cwd(), 'mockup/project/Main.dc.html'),
    path.resolve(__dirname, '../../../mockup/project/Main.dc.html'),
    path.resolve(__dirname, '../../mockup/project/Main.dc.html'),
  ];

  let htmlPath = '';
  for (const cand of rutaCandidatos) {
    if (fs.existsSync(cand)) {
      htmlPath = cand;
      break;
    }
  }

  if (!htmlPath) {
    throw new Error('No se encontró el archivo mockup/project/Main.dc.html');
  }

  const html = fs.readFileSync(htmlPath, 'utf8');
  const m = html.match(/<script type="text\/x-dc" data-dc-script[^>]*>([\s\S]*?)<\/script>/);
  if (!m) {
    throw new Error('No se encontró el bloque data-dc-script en ' + htmlPath);
  }

  (globalThis as any).window = globalThis;
  (globalThis as any).localStorage = { getItem: () => null, setItem: () => {} };
  (globalThis as any).document = { createElement: () => ({ getContext: () => ({}) }) };
  (globalThis as any).DCLogic = class { constructor() {} };

  eval(m[1] + '\n;globalThis.__EXTRACT = { ZONAS_GEO, INFO_DEFAULT };');
  return (globalThis as any).__EXTRACT as {
    ZONAS_GEO: Array<{ z: string; p: Array<[number, number]> }>;
    INFO_DEFAULT: Record<string, any>;
  };
}

export async function main() {
  console.log('--- Iniciando seed-zonas desde la maqueta ---');
  const { ZONAS_GEO, INFO_DEFAULT } = cargarDatosMaqueta();

  // Zonas oficiales según FT-DEL-01 y V9
  const codigosZonas = ['Z2', 'Z3', 'Z4', 'Z5', 'Z7'];

  for (const codigo of codigosZonas) {
    const geo = ZONAS_GEO.find((item) => item.z === codigo);
    if (!geo) {
      console.warn(`No se encontró polígono para la zona ${codigo} en ZONAS_GEO.`);
      continue;
    }

    // Tarifas por confirmar con Kevin (D-03)
    // Se toma de INFO_DEFAULT['tar' + codigo]; si no existe, se usa el número de la zona en soles como fallback.
    const tarifaKey = `tar${codigo}`;
    const tarifaVal = INFO_DEFAULT[tarifaKey] !== undefined
      ? Number(INFO_DEFAULT[tarifaKey])
      : Number(codigo.replace(/\D/g, ''));

    await prisma.zonaReparto.upsert({
      where: { codigo },
      update: {
        tarifa: tarifaVal,
        poligono: geo.p,
        activa: true,
      },
      create: {
        codigo,
        tarifa: tarifaVal,
        poligono: geo.p,
        activa: true,
      },
    });

    console.log(`Zona ${codigo} registrada: tarifa S/ ${tarifaVal.toFixed(2)}, ${geo.p.length} puntos.`);
  }

  const totalZonas = await prisma.zonaReparto.count();
  console.log('--- Resumen seed-zonas ---');
  console.log(`- zona_reparto: ${totalZonas} filas.`);
}

if (require.main === module) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
