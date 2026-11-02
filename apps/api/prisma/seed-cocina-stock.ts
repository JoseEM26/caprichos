import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

export async function main() {
  console.log('--- Iniciando seed-cocina-stock ---');

  // 1. Lugares de stock: Almacén central y uno por cada área de cocina existente
  const almacenCentral = await prisma.lugarStock.upsert({
    where: { nombre: 'Almacén central' },
    update: { tipo: 'ALMACEN', area_id: null },
    create: { nombre: 'Almacén central', tipo: 'ALMACEN', area_id: null },
  });
  console.log(`Lugar stock: ${almacenCentral.nombre} (id: ${almacenCentral.id})`);

  const areasCocina = await prisma.areaCocina.findMany();
  const mapaLugares = new Map<string, bigint>();
  mapaLugares.set('Almacén central', almacenCentral.id);

  for (const area of areasCocina) {
    const lugarArea = await prisma.lugarStock.upsert({
      where: { nombre: area.nombre },
      update: { tipo: 'AREA', area_id: area.id },
      create: { nombre: area.nombre, tipo: 'AREA', area_id: area.id },
    });
    mapaLugares.set(area.nombre, lugarArea.id);
    console.log(`Lugar stock: ${lugarArea.nombre} (id: ${lugarArea.id}, área: ${area.id})`);
  }

  // 2. Parámetros por defecto que falten
  await prisma.parametro.upsert({
    where: { clave: 'alta_demanda_min_base' },
    update: {},
    create: { clave: 'alta_demanda_min_base', valor: 0 },
  });
  console.log('Parámetro alta_demanda_min_base configurado.');

  // 3. 12 insumos de ejemplo con unidades y niveles
  const defsInsumos = [
    {
      nombre: 'Leche entera',
      unidad_compra: 'CAJA',
      unidad_almacen: 'L',
      unidad_receta: 'ML',
      factor_compra: new Prisma.Decimal(12),
      factor_receta: new Prisma.Decimal(1000),
      minimo: new Prisma.Decimal(10),
      intermedio: new Prisma.Decimal(25),
      maximo: new Prisma.Decimal(60),
      costo_unit: new Prisma.Decimal(4.5),
      lugarConsumo: 'Bebidas',
    },
    {
      nombre: 'Leche de almendras',
      unidad_compra: 'CAJA',
      unidad_almacen: 'L',
      unidad_receta: 'ML',
      factor_compra: new Prisma.Decimal(12),
      factor_receta: new Prisma.Decimal(1000),
      minimo: new Prisma.Decimal(5),
      intermedio: new Prisma.Decimal(12),
      maximo: new Prisma.Decimal(30),
      costo_unit: new Prisma.Decimal(8.5),
      lugarConsumo: 'Bebidas',
    },
    {
      nombre: 'Café en grano',
      unidad_compra: 'BOLSA',
      unidad_almacen: 'KG',
      unidad_receta: 'G',
      factor_compra: new Prisma.Decimal(1),
      factor_receta: new Prisma.Decimal(1000),
      minimo: new Prisma.Decimal(5),
      intermedio: new Prisma.Decimal(15),
      maximo: new Prisma.Decimal(40),
      costo_unit: new Prisma.Decimal(45.0),
      lugarConsumo: 'Bebidas',
    },
    {
      nombre: 'Azúcar blanca',
      unidad_compra: 'SACO',
      unidad_almacen: 'KG',
      unidad_receta: 'G',
      factor_compra: new Prisma.Decimal(50),
      factor_receta: new Prisma.Decimal(1000),
      minimo: new Prisma.Decimal(10),
      intermedio: new Prisma.Decimal(30),
      maximo: new Prisma.Decimal(100),
      costo_unit: new Prisma.Decimal(3.2),
      lugarConsumo: 'Bebidas',
    },
    {
      nombre: 'Harina sin preparar',
      unidad_compra: 'SACO',
      unidad_almacen: 'KG',
      unidad_receta: 'G',
      factor_compra: new Prisma.Decimal(50),
      factor_receta: new Prisma.Decimal(1000),
      minimo: new Prisma.Decimal(10),
      intermedio: new Prisma.Decimal(25),
      maximo: new Prisma.Decimal(80),
      costo_unit: new Prisma.Decimal(3.5),
      lugarConsumo: 'Salados',
    },
    {
      nombre: 'Huevos frescos',
      unidad_compra: 'JABA',
      unidad_almacen: 'UNIDAD',
      unidad_receta: 'UNIDAD',
      factor_compra: new Prisma.Decimal(30),
      factor_receta: new Prisma.Decimal(1),
      minimo: new Prisma.Decimal(60),
      intermedio: new Prisma.Decimal(120),
      maximo: new Prisma.Decimal(300),
      costo_unit: new Prisma.Decimal(0.5),
      lugarConsumo: 'Salados',
    },
    {
      nombre: 'Pollo deshilachado',
      unidad_compra: 'KG',
      unidad_almacen: 'KG',
      unidad_receta: 'G',
      factor_compra: new Prisma.Decimal(1),
      factor_receta: new Prisma.Decimal(1000),
      minimo: new Prisma.Decimal(5),
      intermedio: new Prisma.Decimal(12),
      maximo: new Prisma.Decimal(30),
      costo_unit: new Prisma.Decimal(18.0),
      lugarConsumo: 'Salados',
    },
    {
      nombre: 'Jamón inglés',
      unidad_compra: 'PAQUETE',
      unidad_almacen: 'KG',
      unidad_receta: 'G',
      factor_compra: new Prisma.Decimal(1),
      factor_receta: new Prisma.Decimal(1000),
      minimo: new Prisma.Decimal(3),
      intermedio: new Prisma.Decimal(8),
      maximo: new Prisma.Decimal(20),
      costo_unit: new Prisma.Decimal(26.0),
      lugarConsumo: 'Salados',
    },
    {
      nombre: 'Queso edam',
      unidad_compra: 'BARRA',
      unidad_almacen: 'KG',
      unidad_receta: 'G',
      factor_compra: new Prisma.Decimal(3),
      factor_receta: new Prisma.Decimal(1000),
      minimo: new Prisma.Decimal(3),
      intermedio: new Prisma.Decimal(9),
      maximo: new Prisma.Decimal(25),
      costo_unit: new Prisma.Decimal(32.0),
      lugarConsumo: 'Salados',
    },
    {
      nombre: 'Crema chantilly',
      unidad_compra: 'CAJA',
      unidad_almacen: 'L',
      unidad_receta: 'ML',
      factor_compra: new Prisma.Decimal(12),
      factor_receta: new Prisma.Decimal(1000),
      minimo: new Prisma.Decimal(4),
      intermedio: new Prisma.Decimal(10),
      maximo: new Prisma.Decimal(24),
      costo_unit: new Prisma.Decimal(14.0),
      lugarConsumo: 'Bebidas',
    },
    {
      nombre: 'Hielo',
      unidad_compra: 'BOLSA',
      unidad_almacen: 'KG',
      unidad_receta: 'G',
      factor_compra: new Prisma.Decimal(5),
      factor_receta: new Prisma.Decimal(1000),
      minimo: new Prisma.Decimal(20),
      intermedio: new Prisma.Decimal(50),
      maximo: new Prisma.Decimal(150),
      costo_unit: new Prisma.Decimal(1.0),
      lugarConsumo: 'Bebidas',
    },
    {
      nombre: 'Jarabe de chocolate',
      unidad_compra: 'BOTELLA',
      unidad_almacen: 'L',
      unidad_receta: 'ML',
      factor_compra: new Prisma.Decimal(1),
      factor_receta: new Prisma.Decimal(1000),
      minimo: new Prisma.Decimal(2),
      intermedio: new Prisma.Decimal(6),
      maximo: new Prisma.Decimal(15),
      costo_unit: new Prisma.Decimal(22.0),
      lugarConsumo: 'Bebidas',
    },
  ];

  const mapaInsumos = new Map<string, bigint>();
  for (const inf of defsInsumos) {
    const lugarId = mapaLugares.get(inf.lugarConsumo) || null;
    const insumo = await prisma.insumo.upsert({
      where: { nombre: inf.nombre },
      update: {
        unidad_compra: inf.unidad_compra,
        unidad_almacen: inf.unidad_almacen,
        unidad_receta: inf.unidad_receta,
        factor_compra: inf.factor_compra,
        factor_receta: inf.factor_receta,
        minimo: inf.minimo,
        intermedio: inf.intermedio,
        maximo: inf.maximo,
        costo_unit: inf.costo_unit,
        lugar_consumo_id: lugarId,
        activo: true,
      },
      create: {
        nombre: inf.nombre,
        unidad_compra: inf.unidad_compra,
        unidad_almacen: inf.unidad_almacen,
        unidad_receta: inf.unidad_receta,
        factor_compra: inf.factor_compra,
        factor_receta: inf.factor_receta,
        minimo: inf.minimo,
        intermedio: inf.intermedio,
        maximo: inf.maximo,
        costo_unit: inf.costo_unit,
        lugar_consumo_id: lugarId,
        activo: true,
      },
    });
    mapaInsumos.set(inf.nombre, insumo.id);

    // Stock inicial en lugar de consumo
    if (lugarId) {
      const stockExistente = await prisma.stock.findFirst({
        where: { insumo_id: insumo.id, lugar_id: lugarId },
      });
      if (stockExistente) {
        await prisma.stock.update({
          where: { id: stockExistente.id },
          data: { cantidad: inf.intermedio },
        });
      } else {
        await prisma.stock.create({
          data: {
            insumo_id: insumo.id,
            lugar_id: lugarId,
            cantidad: inf.intermedio,
          },
        });
      }
    }

    // Stock en almacén central
    const stockAlmacen = await prisma.stock.findFirst({
      where: { insumo_id: insumo.id, lugar_id: almacenCentral.id },
    });
    if (stockAlmacen) {
      await prisma.stock.update({
        where: { id: stockAlmacen.id },
        data: { cantidad: inf.maximo },
      });
    } else {
      await prisma.stock.create({
        data: {
          insumo_id: insumo.id,
          lugar_id: almacenCentral.id,
          cantidad: inf.maximo,
        },
      });
    }
  }
  console.log(`12 insumos y sus stocks iniciales creados/actualizados.`);

  // 4. Recetas para 3 productos de la carta real: CAPUCCINO, FRAPPE CAFÉ, WAFFLE FRUTOS DEL BOSQUE
  const productosCarta = await prisma.producto.findMany({
    where: {
      nombre: { in: ['CAPUCCINO', 'FRAPPE CAFÉ', 'WAFFLE FRUTOS DEL BOSQUE'] },
    },
    include: {
      tamanos: {
        include: {
          tamano_valor: true,
        },
      },
    },
  });

  const mapaProductos = new Map(productosCarta.map((p) => [p.nombre, p]));

  // 4.1. CAPUCCINO (id: 32)
  const capuccino = mapaProductos.get('CAPUCCINO');
  if (capuccino) {
    const lineasPorTamano: Record<string, { insumo: string; cantidad: number }[]> = {
      'Regular 12 oz': [
        { insumo: 'Café en grano', cantidad: 18 },
        { insumo: 'Leche entera', cantidad: 200 },
      ],
      'Grande 16 oz': [
        { insumo: 'Café en grano', cantidad: 24 },
        { insumo: 'Leche entera', cantidad: 260 },
      ],
      'Extra 21 oz': [
        { insumo: 'Café en grano', cantidad: 30 },
        { insumo: 'Leche entera', cantidad: 320 },
      ],
    };

    for (const pt of capuccino.tamanos) {
      const nombreTamano = pt.tamano_valor.nombre;
      const ingredientes = lineasPorTamano[nombreTamano];
      if (!ingredientes) continue;

      const receta = await prisma.receta.upsert({
        where: {
          producto_id_tamano_valor_id_es_produccion: {
            producto_id: capuccino.id,
            tamano_valor_id: pt.tamano_valor_id,
            es_produccion: false,
          },
        },
        update: {},
        create: {
          producto_id: capuccino.id,
          tamano_valor_id: pt.tamano_valor_id,
          es_produccion: false,
        },
      });

      for (const ing of ingredientes) {
        const insumoId = mapaInsumos.get(ing.insumo);
        if (!insumoId) continue;
        await prisma.recetaLinea.upsert({
          where: {
            receta_id_insumo_id: {
              receta_id: receta.id,
              insumo_id: insumoId,
            },
          },
          update: {
            cantidad: new Prisma.Decimal(ing.cantidad),
            producto_tamano_id: pt.id,
          },
          create: {
            receta_id: receta.id,
            insumo_id: insumoId,
            cantidad: new Prisma.Decimal(ing.cantidad),
            producto_tamano_id: pt.id,
          },
        });
      }
    }
    console.log('Recetas para CAPUCCINO configuradas.');
  }

  // 4.2. FRAPPE CAFÉ (id: 7)
  const frappeCafe = mapaProductos.get('FRAPPE CAFÉ');
  if (frappeCafe) {
    const lineasPorTamano: Record<string, { insumo: string; cantidad: number }[]> = {
      'Regular 12 oz': [
        { insumo: 'Café en grano', cantidad: 18 },
        { insumo: 'Leche entera', cantidad: 150 },
        { insumo: 'Hielo', cantidad: 150 },
        { insumo: 'Crema chantilly', cantidad: 30 },
      ],
      'Grande 16 oz': [
        { insumo: 'Café en grano', cantidad: 24 },
        { insumo: 'Leche entera', cantidad: 200 },
        { insumo: 'Hielo', cantidad: 200 },
        { insumo: 'Crema chantilly', cantidad: 40 },
      ],
      'Extra 21 oz': [
        { insumo: 'Café en grano', cantidad: 30 },
        { insumo: 'Leche entera', cantidad: 250 },
        { insumo: 'Hielo', cantidad: 250 },
        { insumo: 'Crema chantilly', cantidad: 50 },
      ],
    };

    for (const pt of frappeCafe.tamanos) {
      const nombreTamano = pt.tamano_valor.nombre;
      const ingredientes = lineasPorTamano[nombreTamano];
      if (!ingredientes) continue;

      const receta = await prisma.receta.upsert({
        where: {
          producto_id_tamano_valor_id_es_produccion: {
            producto_id: frappeCafe.id,
            tamano_valor_id: pt.tamano_valor_id,
            es_produccion: false,
          },
        },
        update: {},
        create: {
          producto_id: frappeCafe.id,
          tamano_valor_id: pt.tamano_valor_id,
          es_produccion: false,
        },
      });

      for (const ing of ingredientes) {
        const insumoId = mapaInsumos.get(ing.insumo);
        if (!insumoId) continue;
        await prisma.recetaLinea.upsert({
          where: {
            receta_id_insumo_id: {
              receta_id: receta.id,
              insumo_id: insumoId,
            },
          },
          update: {
            cantidad: new Prisma.Decimal(ing.cantidad),
            producto_tamano_id: pt.id,
          },
          create: {
            receta_id: receta.id,
            insumo_id: insumoId,
            cantidad: new Prisma.Decimal(ing.cantidad),
            producto_tamano_id: pt.id,
          },
        });
      }
    }
    console.log('Recetas para FRAPPE CAFÉ configuradas.');
  }

  // 4.3. WAFFLE FRUTOS DEL BOSQUE (id: 35)
  const waffle = mapaProductos.get('WAFFLE FRUTOS DEL BOSQUE');
  if (waffle) {
    const lineasPorTamano: Record<string, { insumo: string; cantidad: number }[]> = {
      '1/2 waffle': [
        { insumo: 'Harina sin preparar', cantidad: 100 },
        { insumo: 'Huevos frescos', cantidad: 1 },
        { insumo: 'Azúcar blanca', cantidad: 20 },
        { insumo: 'Crema chantilly', cantidad: 30 },
      ],
      'Waffle completo': [
        { insumo: 'Harina sin preparar', cantidad: 200 },
        { insumo: 'Huevos frescos', cantidad: 2 },
        { insumo: 'Azúcar blanca', cantidad: 40 },
        { insumo: 'Crema chantilly', cantidad: 60 },
      ],
    };

    for (const pt of waffle.tamanos) {
      const nombreTamano = pt.tamano_valor.nombre;
      const ingredientes = lineasPorTamano[nombreTamano];
      if (!ingredientes) continue;

      const receta = await prisma.receta.upsert({
        where: {
          producto_id_tamano_valor_id_es_produccion: {
            producto_id: waffle.id,
            tamano_valor_id: pt.tamano_valor_id,
            es_produccion: false,
          },
        },
        update: {},
        create: {
          producto_id: waffle.id,
          tamano_valor_id: pt.tamano_valor_id,
          es_produccion: false,
        },
      });

      for (const ing of ingredientes) {
        const insumoId = mapaInsumos.get(ing.insumo);
        if (!insumoId) continue;
        await prisma.recetaLinea.upsert({
          where: {
            receta_id_insumo_id: {
              receta_id: receta.id,
              insumo_id: insumoId,
            },
          },
          update: {
            cantidad: new Prisma.Decimal(ing.cantidad),
            producto_tamano_id: pt.id,
          },
          create: {
            receta_id: receta.id,
            insumo_id: insumoId,
            cantidad: new Prisma.Decimal(ing.cantidad),
            producto_tamano_id: pt.id,
          },
        });
      }
    }
    console.log('Recetas para WAFFLE FRUTOS DEL BOSQUE configuradas.');
  }

  // 5. Ajuste de opción: Bebida de almendra reemplaza Leche entera
  const opcionAlmendra = await prisma.opcion.findFirst({
    where: {
      valor: {
        nombre: 'Bebida de almendra',
      },
    },
  });

  const insumoAlmendraId = mapaInsumos.get('Leche de almendras');
  const insumoEnteraId = mapaInsumos.get('Leche entera');

  if (opcionAlmendra && insumoAlmendraId && insumoEnteraId) {
    await prisma.ajusteOpcion.upsert({
      where: {
        opcion_id_insumo_id: {
          opcion_id: opcionAlmendra.id,
          insumo_id: insumoAlmendraId,
        },
      },
      update: {
        efecto: 'REEMPLAZA',
        reemplaza_insumo_id: insumoEnteraId,
        cantidad: new Prisma.Decimal(200),
      },
      create: {
        opcion_id: opcionAlmendra.id,
        insumo_id: insumoAlmendraId,
        efecto: 'REEMPLAZA',
        reemplaza_insumo_id: insumoEnteraId,
        cantidad: new Prisma.Decimal(200),
      },
    });
    console.log('Ajuste de opción para Bebida de almendra configurado.');
  }

  console.log('--- seed-cocina-stock finalizado con éxito ---');
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
