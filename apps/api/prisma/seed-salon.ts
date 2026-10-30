import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface FloorJson {
  id: string;
  n: string;
  on: boolean;
}

interface ElementJson {
  id: string;
  t: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
  seats?: number;
  on?: boolean;
}

interface PlanoDefaultJson {
  floors: FloorJson[];
  dims: Record<string, any>;
  plan: Record<string, ElementJson[]>;
}

/**
 * Carga el archivo docs/analisis/plano-del-local.default.json
 */
function cargarPlanoDefault(): PlanoDefaultJson {
  const rutaCandidatos = [
    path.resolve(process.cwd(), 'docs/analisis/plano-del-local.default.json'),
    path.resolve(__dirname, '../../../docs/analisis/plano-del-local.default.json'),
    path.resolve(__dirname, '../../docs/analisis/plano-del-local.default.json'),
  ];

  let archivoPath = '';
  for (const cand of rutaCandidatos) {
    if (fs.existsSync(cand)) {
      archivoPath = cand;
      break;
    }
  }

  if (!archivoPath) {
    throw new Error('No se encontró el archivo docs/analisis/plano-del-local.default.json');
  }

  const raw = fs.readFileSync(archivoPath, 'utf8');
  return JSON.parse(raw) as PlanoDefaultJson;
}

/**
 * Mapeo de tipos del JSON al DDL de elemento_plano
 */
function mapearTipo(tipoJson: string): string {
  const normalizado = (tipoJson || '').toLowerCase().trim();
  switch (normalizado) {
    case 'mesa':
      return 'MESA';
    case 'cocina':
      return 'COCINA';
    case 'barra':
      return 'BARRA';
    case 'caja':
      return 'CAJA';
    case 'bano':
    case 'baños':
    case 'banos':
      return 'BANO';
    case 'pared':
      return 'PARED';
    case 'entrada':
      return 'ENTRADA';
    case 'escalera':
      return 'ESCALERA';
    default:
      return 'OTRO';
  }
}

export async function main() {
  console.log('--- Iniciando seed-salon: plano por defecto y configuración ---');

  // 1. Parámetros por defecto
  await prisma.parametro.upsert({
    where: { clave: 'reserva_tolerancia_min' },
    update: { valor: 15 },
    create: { clave: 'reserva_tolerancia_min', valor: 15 },
  });
  console.log('Parámetro configurado: reserva_tolerancia_min = 15');

  await prisma.parametro.upsert({
    where: { clave: 'tolerancia_reserva_min' },
    update: { valor: 15 },
    create: { clave: 'tolerancia_reserva_min', valor: 15 },
  });
  console.log('Parámetro configurado: tolerancia_reserva_min = 15');

  // 2. Cargar JSON del plano
  const planoData = cargarPlanoDefault();

  for (const floor of planoData.floors) {
    // Dimensiones según docs/analisis/plano-del-local.md: 20 columnas × 12 filas
    const cuadriculaAncho = 20;
    const cuadriculaAlto = 12;

    let piso = await prisma.piso.findFirst({
      where: { nombre: floor.n },
    });

    if (!piso) {
      piso = await prisma.piso.create({
        data: {
          nombre: floor.n,
          activo: floor.on,
          cuadricula_ancho: cuadriculaAncho,
          cuadricula_alto: cuadriculaAlto,
        },
      });
      console.log(`Piso creado: ${piso.nombre} (id: ${piso.id}, activo: ${piso.activo})`);
    } else {
      piso = await prisma.piso.update({
        where: { id: piso.id },
        data: {
          activo: floor.on,
          cuadricula_ancho: cuadriculaAncho,
          cuadricula_alto: cuadriculaAlto,
        },
      });
      console.log(`Piso actualizado: ${piso.nombre} (id: ${piso.id}, activo: ${piso.activo})`);
    }

    const elementosPiso = planoData.plan[floor.id] || [];

    for (const elem of elementosPiso) {
      const tipo = mapearTipo(elem.t);
      const nombre = elem.label || null;
      const activo = elem.on !== undefined ? elem.on : true;

      let numero: number | null = null;
      let asientos: number | null = null;

      if (tipo === 'MESA') {
        const matchNumero = (elem.label || '').match(/\d+/) || (elem.id || '').match(/\d+/);
        numero = matchNumero ? parseInt(matchNumero[0], 10) : null;
        asientos = elem.seats ?? 4;

        if (numero !== null) {
          const mesaExistente = await prisma.elementoPlano.findFirst({
            where: { tipo: 'MESA', numero },
          });

          if (mesaExistente) {
            await prisma.elementoPlano.update({
              where: { id: mesaExistente.id },
              data: {
                piso_id: piso.id,
                nombre,
                x: elem.x,
                y: elem.y,
                ancho: elem.w,
                alto: elem.h,
                asientos,
                activo,
              },
            });
          } else {
            await prisma.elementoPlano.create({
              data: {
                piso_id: piso.id,
                tipo: 'MESA',
                nombre,
                x: elem.x,
                y: elem.y,
                ancho: elem.w,
                alto: elem.h,
                numero,
                asientos,
                activo,
              },
            });
          }
        }
      } else {
        // Elementos no mesa (pared, cocina, barra, caja, bano, escalera, entrada, otro)
        const elemExistente = await prisma.elementoPlano.findFirst({
          where: {
            piso_id: piso.id,
            tipo,
            x: elem.x,
            y: elem.y,
          },
        });

        if (elemExistente) {
          await prisma.elementoPlano.update({
            where: { id: elemExistente.id },
            data: {
              nombre,
              ancho: elem.w,
              alto: elem.h,
              activo,
              numero: null,
              asientos: null,
            },
          });
        } else {
          await prisma.elementoPlano.create({
            data: {
              piso_id: piso.id,
              tipo,
              nombre,
              x: elem.x,
              y: elem.y,
              ancho: elem.w,
              alto: elem.h,
              numero: null,
              asientos: null,
              activo,
            },
          });
        }
      }
    }
  }

  const totalPisos = await prisma.piso.count();
  const totalElementos = await prisma.elementoPlano.count();
  const totalMesas = await prisma.elementoPlano.count({ where: { tipo: 'MESA' } });

  console.log('--- Resumen seed-salon ---');
  console.log(`- pisos: ${totalPisos}`);
  console.log(`- total elementos del plano: ${totalElementos}`);
  console.log(`- mesas creadas: ${totalMesas}`);
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
