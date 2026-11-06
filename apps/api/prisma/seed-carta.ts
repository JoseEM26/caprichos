import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

/** Unidades que lleva cada tamaño de la carta (donas y galletas con sabores). */
const UNIDADES_POR_TAMANO: Record<string, number> = { 'Unidad': 1, '1/2 docena': 6, 'Docena': 12 };

const prisma = new PrismaClient();

function slugify(text: string): string {
  return text
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}

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

  eval(m[1] + '\n;globalThis.__EXTRACT = { P, CATS, DULZOR, LECHE, SHOTS, TOPPINGS };');
  return (globalThis as any).__EXTRACT;
}

export async function main() {
  console.log('--- Iniciando seed-carta desde la maqueta ---');
  const { P, CATS, DULZOR, LECHE, SHOTS, TOPPINGS } = cargarDatosMaqueta();

  // 1. Áreas de cocina
  const areas = [
    { nombre: 'Bebidas', propia: true, impresora: 'ticketera_barra' },
    { nombre: 'Salados', propia: true, impresora: 'ticketera_cocina' },
    { nombre: 'Postres', propia: true, impresora: 'ticketera_postres' },
  ];

  const mapaAreas = new Map<string, bigint>();
  for (const a of areas) {
    const area = await prisma.areaCocina.upsert({
      where: { nombre: a.nombre },
      update: { propia: a.propia, impresora: a.impresora, activo: true },
      create: { nombre: a.nombre, propia: a.propia, impresora: a.impresora, activo: true },
    });
    mapaAreas.set(a.nombre, area.id);
  }

  // 2. Categorías
  const catAreaMap: Record<string, string> = {
    combos: 'Salados',
    frappes: 'Bebidas',
    iced: 'Bebidas',
    frozen: 'Bebidas',
    calientes: 'Bebidas',
    waffles: 'Salados',
    salados: 'Salados',
    croissants: 'Salados',
    complementos: 'Postres',
  };

  const mapaCategorias = new Map<string, bigint>();
  let ordenCat = 1;
  for (const cat of CATS) {
    if (cat.id === 'all') continue;
    const nombreArea = catAreaMap[cat.id] || 'Salados';
    const areaId = mapaAreas.get(nombreArea)!;

    const categoria = await prisma.categoria.upsert({
      where: { nombre: cat.n },
      update: { area_id: areaId, orden: ordenCat, lleva_opciones: true },
      create: { nombre: cat.n, area_id: areaId, orden: ordenCat, lleva_opciones: true },
    });
    mapaCategorias.set(cat.id, categoria.id);
    ordenCat++;
  }

  // 3. Lista y valores de Tamaños (TAMANO)
  const listaTamano = await prisma.lista.upsert({
    where: { codigo: 'TAMANO' },
    update: { nombre: 'Tamaños y presentaciones' },
    create: { codigo: 'TAMANO', nombre: 'Tamaños y presentaciones' },
  });

  const variantNames = Array.from(new Set(P.flatMap((p: any) => (p.variants || []).map((v: any) => v.n))));
  const mapaTamanos = new Map<string, bigint>();
  for (let i = 0; i < variantNames.length; i++) {
    const vName = variantNames[i] as string;
    const valor = await prisma.listaValor.upsert({
      where: { lista_id_nombre: { lista_id: listaTamano.id, nombre: vName } },
      update: { orden: i, activo: true },
      create: { lista_id: listaTamano.id, nombre: vName, orden: i, activo: true },
    });
    mapaTamanos.set(vName, valor.id);
  }

  // 4. Grupos de opciones y sus opciones
  const allGroupsMap = new Map<string, any>();
  const globalGroups = [DULZOR, LECHE, SHOTS, TOPPINGS];
  for (const g of globalGroups) {
    if (g && g.name) allGroupsMap.set(g.name, g);
  }
  for (const p of P) {
    if (p.groups) {
      for (const g of p.groups) {
        if (g && g.name && !allGroupsMap.has(g.name)) {
          allGroupsMap.set(g.name, g);
        }
      }
    }
  }

  const mapaGrupos = new Map<string, bigint>();
  for (const [gName, gData] of allGroupsMap.entries()) {
    const codigoLista = `GRP_${slugify(gName)}`;
    const listaGrupo = await prisma.lista.upsert({
      where: { codigo: codigoLista },
      update: { nombre: gName },
      create: { codigo: codigoLista, nombre: gName },
    });

    const grupo = await prisma.grupoOpciones.upsert({
      where: { nombre: gName },
      update: {
        lista_id: listaGrupo.id,
        minimo: gData.min || 0,
        maximo: Math.max(gData.max || 1, gData.min || 0),
        obligatorio: (gData.min || 0) > 0,
        activo: true,
      },
      create: {
        nombre: gName,
        lista_id: listaGrupo.id,
        minimo: gData.min || 0,
        maximo: Math.max(gData.max || 1, gData.min || 0),
        obligatorio: (gData.min || 0) > 0,
        activo: true,
      },
    });
    mapaGrupos.set(gName, grupo.id);

    // Opciones del grupo
    if (gData.opts && Array.isArray(gData.opts)) {
      for (let oIdx = 0; oIdx < gData.opts.length; oIdx++) {
        const opt = gData.opts[oIdx];
        const val = await prisma.listaValor.upsert({
          where: { lista_id_nombre: { lista_id: listaGrupo.id, nombre: opt.n } },
          update: { orden: oIdx, activo: true },
          create: { lista_id: listaGrupo.id, nombre: opt.n, orden: oIdx, activo: true },
        });

        await prisma.opcion.upsert({
          where: { grupo_id_valor_id: { grupo_id: grupo.id, valor_id: val.id } },
          update: { precio_extra: opt.p || 0, activo: true },
          create: {
            grupo_id: grupo.id,
            valor_id: val.id,
            precio_extra: opt.p || 0,
            activo: true,
          },
        });
      }
    }
  }

  // 5. Productos, tamaños, grupos asociados y sabores
  for (let pIdx = 0; pIdx < P.length; pIdx++) {
    const p = P[pIdx];
    // El combo cajita (con sus juguetes) lo asegura la migración 20261225100000 y seed-ofertas: no se siembra desde la maqueta
    if (p.name === 'COMBO CAJITA CAPRIKIDS') continue;
    const catId = mapaCategorias.get(p.cat) || mapaCategorias.get('complementos')!;
    const precioBase = p.variants && p.variants.length > 0 ? p.variants[0].p : 0;

    const producto = await prisma.producto.upsert({
      where: { nombre: p.name },
      update: {
        categoria_id: catId,
        descripcion: p.desc || null,
        precio: precioBase,
        orden: pIdx + 1,
        oculto: false,
      },
      create: {
        categoria_id: catId,
        nombre: p.name,
        descripcion: p.desc || null,
        precio: precioBase,
        orden: pIdx + 1,
        oculto: false,
        // Postres controla stock desde la instalación (igual que la migración 20261226200000)
        controla_stock: p.cat === 'complementos',
      },
    });

    // Tamaños del producto
    if (p.variants && Array.isArray(p.variants)) {
      for (const v of p.variants) {
        const tamanoValorId = mapaTamanos.get(v.n);
        if (tamanoValorId) {
          // Unidades por tamaño (stock por sabor): Unidad=1, 1/2 docena=6, Docena=12
          const unidades = UNIDADES_POR_TAMANO[v.n] ?? 1;
          await prisma.productoTamano.upsert({
            where: {
              producto_id_tamano_valor_id: {
                producto_id: producto.id,
                tamano_valor_id: tamanoValorId,
              },
            },
            update: { precio: v.p, activo: true, unidades },
            create: {
              producto_id: producto.id,
              tamano_valor_id: tamanoValorId,
              precio: v.p,
              activo: true,
              unidades,
            },
          });
        }
      }
    }

    // Grupos del producto
    if (p.groups && Array.isArray(p.groups)) {
      for (let gIdx = 0; gIdx < p.groups.length; gIdx++) {
        const g = p.groups[gIdx];
        const grupoId = mapaGrupos.get(g.name);
        if (grupoId) {
          await prisma.productoGrupo.upsert({
            where: {
              producto_id_grupo_id: {
                producto_id: producto.id,
                grupo_id: grupoId,
              },
            },
            update: { orden: gIdx },
            create: {
              producto_id: producto.id,
              grupo_id: grupoId,
              orden: gIdx,
            },
          });
        }

        // Si el grupo es de sabor, registrar en tabla sabor
        if (g.name && g.name.toLowerCase().includes('sabor') && g.opts) {
          for (const opt of g.opts) {
            await prisma.sabor.upsert({
              where: {
                producto_id_nombre: {
                  producto_id: producto.id,
                  nombre: opt.n,
                },
              },
              update: { activo: true },
              create: {
                producto_id: producto.id,
                nombre: opt.n,
                activo: true,
              },
            });
          }
        }
      }
    }
  }

  // 6. Horario por día por defecto (lunes cerrado, martes a domingo 14:00 - 22:00)
  for (let dia = 1; dia <= 7; dia++) {
    const esLunes = dia === 1;
    const abre = esLunes ? null : new Date('1970-01-01T14:00:00.000Z');
    const cierra = esLunes ? null : new Date('1970-01-01T22:00:00.000Z');

    await prisma.horarioDia.upsert({
      where: { dia_semana: dia },
      update: { cerrado: esLunes, abre, cierra },
      create: { dia_semana: dia, cerrado: esLunes, abre, cierra },
    });
  }

  console.log('--- Seed completado exitosamente. Conteo de filas: ---');
  const [
    totalAreas,
    totalCategorias,
    totalListas,
    totalListaValores,
    totalProductos,
    totalProductoTamanos,
    totalGrupos,
    totalOpciones,
    totalProductoGrupos,
    totalSabores,
    totalHorarios,
  ] = await Promise.all([
    prisma.areaCocina.count(),
    prisma.categoria.count(),
    prisma.lista.count(),
    prisma.listaValor.count(),
    prisma.producto.count(),
    prisma.productoTamano.count(),
    prisma.grupoOpciones.count(),
    prisma.opcion.count(),
    prisma.productoGrupo.count(),
    prisma.sabor.count(),
    prisma.horarioDia.count(),
  ]);

  console.log(`- area_cocina:     ${totalAreas}`);
  console.log(`- categoria:       ${totalCategorias}`);
  console.log(`- lista:           ${totalListas}`);
  console.log(`- lista_valor:     ${totalListaValores}`);
  console.log(`- producto:        ${totalProductos}`);
  console.log(`- producto_tamano: ${totalProductoTamanos}`);
  console.log(`- grupo_opciones:  ${totalGrupos}`);
  console.log(`- opcion:          ${totalOpciones}`);
  console.log(`- producto_grupo:  ${totalProductoGrupos}`);
  console.log(`- sabor:           ${totalSabores}`);
  console.log(`- horario_dia:     ${totalHorarios}`);
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
