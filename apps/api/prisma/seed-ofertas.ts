import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Combo cajita: la misma SQL que la migración (idempotente), para bases nuevas que no la corrieron antes de la carta. */
const MIGRACION_COMBO_CAJITA = path.join(__dirname, 'migrations/20261225100000_combo_cajita_caprikids/migration.sql');

export async function main() {
  console.log('--- Iniciando semilla de ofertas, promociones, cupones y parámetros ---');

  // 1. Parámetros por defecto de fidelización/puntos (si faltan)
  const parametros = [
    { clave: 'puntos_porcentaje', valor: 5 },
    { clave: 'carta_aviso_entrada', valor: 'no' },
  ];

  for (const p of parametros) {
    const existente = await prisma.parametro.findUnique({ where: { clave: p.clave } });
    if (!existente) {
      await prisma.parametro.create({
        data: {
          clave: p.clave,
          valor: p.valor,
        },
      });
      console.log(`Parametro ${p.clave} creado con valor ${p.valor}`);
    } else {
      console.log(`Parametro ${p.clave} ya existía.`);
    }
  }

  // 2. Regla de acumulación única (id = 1)
  await prisma.reglaAcumulacion.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      cupon_con_descuento: false,
      promo_con_descuento: false,
      cupones_por_comprobante: 2,
      texto_pie: 'Cupones válidos por 15 días para tu siguiente compra en salón o carta.',
    },
  });
  console.log('Regla de acumulación por defecto asegurada.');

  // 3. Buscar productos base y categorías existentes para referenciar
  const prodDuoCompartir = await prisma.producto.findFirst({
    where: { nombre: { contains: 'COMPARTIR', mode: 'insensitive' } },
  });
  const prodDuoIrresistible = await prisma.producto.findFirst({
    where: { nombre: { contains: 'IRRESISTIBLE', mode: 'insensitive' } },
  });

  const catFrappes = await prisma.categoria.findFirst({
    where: { nombre: { contains: 'FRAPPE', mode: 'insensitive' } },
  });
  const catWaffles = await prisma.categoria.findFirst({
    where: { nombre: { contains: 'WAFFLE', mode: 'insensitive' } },
  });
  const catIced = await prisma.categoria.findFirst({
    where: { nombre: { contains: 'ICED', mode: 'insensitive' } },
  });
  const catCalientes = await prisma.categoria.findFirst({
    where: { nombre: { contains: 'CALIENTE', mode: 'insensitive' } },
  });

  const prodClubSandwich = await prisma.producto.findFirst({
    where: { nombre: { contains: 'CLUB', mode: 'insensitive' } },
  });
  const prodLatte = await prisma.producto.findFirst({
    where: { nombre: { contains: 'LATTE', mode: 'insensitive' } },
  });
  const prodIced = await prisma.producto.findFirst({
    where: { nombre: { contains: 'ICED COFFE', mode: 'insensitive' } },
  });

  const complementosProds = await prisma.producto.findMany({
    where: {
      OR: [
        { nombre: { contains: 'DONAS', mode: 'insensitive' } },
        { nombre: { contains: 'GALLETA', mode: 'insensitive' } },
        { nombre: { contains: 'EMPANADA', mode: 'insensitive' } },
        { nombre: { contains: 'KEKE', mode: 'insensitive' } },
        { nombre: { contains: 'CARROT', mode: 'insensitive' } },
      ],
    },
    take: 8,
  });

  const tamanoRegular = await prisma.listaValor.findFirst({
    where: { nombre: { contains: 'Regular', mode: 'insensitive' } },
  });
  const tamanoGrande = await prisma.listaValor.findFirst({
    where: { nombre: { contains: 'Grande', mode: 'insensitive' } },
  });

  // 3b. Combo cajita CAPRIKIDS: productos, juguetes, oferta y partes (idempotente, igual que la migración)
  await prisma.$executeRawUnsafe(fs.readFileSync(MIGRACION_COMBO_CAJITA, 'utf8'));
  console.log('Combo cajita CAPRIKIDS asegurado.');

  // 4. Combos de ejemplo (2 combos)
  // Combo 1: Combo Dúo Para Compartir
  const combo1Nombre = 'Combo Dúo Para Compartir';
  const combo1 = await prisma.oferta.upsert({
    where: { nombre: combo1Nombre },
    update: {
      tipo: 'COMBO',
      descripcion: '2 bebidas a elección (Frappés o Iced) con precio especial por tamaño',
      alcance_producto_id: prodDuoCompartir?.id ?? null,
      canales: ['CARTA', 'ADMIN', 'BOT'],
      activo: true,
      orden: 1,
    },
    create: {
      tipo: 'COMBO',
      nombre: combo1Nombre,
      descripcion: '2 bebidas a elección (Frappés o Iced) con precio especial por tamaño',
      alcance_producto_id: prodDuoCompartir?.id ?? null,
      canales: ['CARTA', 'ADMIN', 'BOT'],
      activo: true,
      orden: 1,
    },
  });

  // Precios y partes combo 1
  if (tamanoRegular) {
    await prisma.comboPrecio.upsert({
      where: {
        oferta_id_tamano_valor_id: {
          oferta_id: combo1.id,
          tamano_valor_id: tamanoRegular.id,
        },
      },
      update: { precio: 33.00 },
      create: {
        oferta_id: combo1.id,
        tamano_valor_id: tamanoRegular.id,
        precio: 33.00,
      },
    });
  }
  if (tamanoGrande) {
    await prisma.comboPrecio.upsert({
      where: {
        oferta_id_tamano_valor_id: {
          oferta_id: combo1.id,
          tamano_valor_id: tamanoGrande.id,
        },
      },
      update: { precio: 37.00 },
      create: {
        oferta_id: combo1.id,
        tamano_valor_id: tamanoGrande.id,
        precio: 37.00,
      },
    });
  }

  // Combo 1 partes: 2 bebidas a elección + 1 complemento
  await prisma.comboParte.deleteMany({ where: { oferta_id: combo1.id } });
  const catsCombo1 = [catFrappes?.id, catIced?.id, catCalientes?.id].filter((id): id is bigint => id !== undefined && id !== null);
  await prisma.comboParte.create({
    data: {
      oferta_id: combo1.id,
      tipo: 'A_ELECCION',
      cantidad: 2,
      categorias: catsCombo1,
      productos: [],
    },
  });
  if (complementosProds.length > 0) {
    await prisma.comboParte.create({
      data: {
        oferta_id: combo1.id,
        tipo: 'UNA_DE',
        cantidad: 1,
        categorias: [],
        productos: complementosProds.map((p) => p.id),
      },
    });
  }
  console.log(`Combo 1 "${combo1Nombre}" asegurado.`);

  // Combo 2: Combo Dúo Irresistible
  const combo2Nombre = 'Combo Dúo Irresistible';
  const combo2 = await prisma.oferta.upsert({
    where: { nombre: combo2Nombre },
    update: {
      tipo: 'COMBO',
      descripcion: '1 Frappé + 1 Waffle a elección',
      alcance_producto_id: prodDuoIrresistible?.id ?? null,
      canales: ['CARTA', 'ADMIN', 'BOT'],
      activo: true,
      orden: 2,
    },
    create: {
      tipo: 'COMBO',
      nombre: combo2Nombre,
      descripcion: '1 Frappé + 1 Waffle a elección',
      alcance_producto_id: prodDuoIrresistible?.id ?? null,
      canales: ['CARTA', 'ADMIN', 'BOT'],
      activo: true,
      orden: 2,
    },
  });

  if (tamanoRegular) {
    await prisma.comboPrecio.upsert({
      where: {
        oferta_id_tamano_valor_id: {
          oferta_id: combo2.id,
          tamano_valor_id: tamanoRegular.id,
        },
      },
      update: { precio: 37.00 },
      create: {
        oferta_id: combo2.id,
        tamano_valor_id: tamanoRegular.id,
        precio: 37.00,
      },
    });
  }
  if (tamanoGrande) {
    await prisma.comboPrecio.upsert({
      where: {
        oferta_id_tamano_valor_id: {
          oferta_id: combo2.id,
          tamano_valor_id: tamanoGrande.id,
        },
      },
      update: { precio: 41.00 },
      create: {
        oferta_id: combo2.id,
        tamano_valor_id: tamanoGrande.id,
        precio: 41.00,
      },
    });
  }

  await prisma.comboParte.deleteMany({ where: { oferta_id: combo2.id } });
  const catsCombo2 = [catFrappes?.id].filter((id): id is bigint => id !== undefined && id !== null);
  await prisma.comboParte.create({
    data: {
      oferta_id: combo2.id,
      tipo: 'A_ELECCION',
      cantidad: 2,
      categorias: catsCombo2,
      productos: [],
    },
  });
  if (prodClubSandwich) {
    const parteClub = await prisma.comboParte.create({
      data: {
        oferta_id: combo2.id,
        tipo: 'FIJO',
        cantidad: 1,
        categorias: [],
        productos: [prodClubSandwich.id],
      },
    });
    // Plan B, C y D si el Club Sándwich se agota: salados parecidos que existan en la carta (por nombre)
    const reemplazosClub: { id: bigint }[] = [];
    for (const nombre of ['SÁNDWICH CLÁSICO', 'CROISSANT DE JAMÓN Y QUESO', 'EMPANADA ARTESANAL']) {
      const prod = await prisma.producto.findFirst({ where: { nombre: { equals: nombre, mode: 'insensitive' } } });
      if (prod && prod.id !== prodClubSandwich.id) reemplazosClub.push({ id: prod.id });
    }
    await prisma.comboParteReemplazo.createMany({
      data: reemplazosClub.map((r, orden) => ({ combo_parte_id: parteClub.id, producto_id: r.id, orden })),
      skipDuplicates: true,
    });
  }
  console.log(`Combo 2 "${combo2Nombre}" asegurado.`);

  // Promos 2x1
  if (prodLatte) {
    await prisma.oferta.upsert({
      where: { nombre: '2x1 LATTE COFFE' },
      update: {
        tipo: 'LLEVA_PAGA',
        descripcion: '2x1 en Latte Coffe los martes',
        alcance_producto_id: prodLatte.id,
        lleva: 2,
        paga: 1,
        descuento_valor: prodLatte.precio,
        dias: [2], // martes
        canales: ['CARTA', 'ADMIN', 'BOT'],
        activo: true,
        orden: 3,
      },
      create: {
        tipo: 'LLEVA_PAGA',
        nombre: '2x1 LATTE COFFE',
        descripcion: '2x1 en Latte Coffe los martes',
        alcance_producto_id: prodLatte.id,
        lleva: 2,
        paga: 1,
        descuento_valor: prodLatte.precio,
        dias: [2],
        canales: ['CARTA', 'ADMIN', 'BOT'],
        activo: true,
        orden: 3,
      },
    });
    console.log('2x1 LATTE COFFE asegurado.');
  }

  if (prodIced) {
    await prisma.oferta.upsert({
      where: { nombre: '2x1 ICED COFFE' },
      update: {
        tipo: 'LLEVA_PAGA',
        descripcion: '2x1 en Iced Coffe todos los días',
        alcance_producto_id: prodIced.id,
        lleva: 2,
        paga: 1,
        descuento_valor: prodIced.precio,
        dias: [],
        canales: ['CARTA', 'ADMIN', 'BOT'],
        activo: true,
        orden: 4,
      },
      create: {
        tipo: 'LLEVA_PAGA',
        nombre: '2x1 ICED COFFE',
        descripcion: '2x1 en Iced Coffe todos los días',
        alcance_producto_id: prodIced.id,
        lleva: 2,
        paga: 1,
        descuento_valor: prodIced.precio,
        dias: [],
        canales: ['CARTA', 'ADMIN', 'BOT'],
        activo: true,
        orden: 4,
      },
    });
    console.log('2x1 ICED COFFE asegurado.');
  }

  // 5. Descuento automático: 10 % en waffles los martes (RN-CAP-132, día 2 = martes)
  const descMartesNombre = 'Martes de Waffles 10% OFF';
  await prisma.oferta.upsert({
    where: { nombre: descMartesNombre },
    update: {
      tipo: 'DESCUENTO',
      descripcion: '10 % de descuento automático en waffles los martes',
      alcance_categoria_id: catWaffles?.id ?? null,
      descuento_tipo: 'PORCENTAJE',
      descuento_valor: 10.00,
      compra_minima: 15.00,
      dias: [2], // Martes (1=Lunes, 2=Martes...)
      canales: ['CARTA', 'ADMIN', 'BOT'],
      no_suma_beneficios: false,
      activo: true,
      orden: 5,
    },
    create: {
      tipo: 'DESCUENTO',
      nombre: descMartesNombre,
      descripcion: '10 % de descuento automático en waffles los martes',
      alcance_categoria_id: catWaffles?.id ?? null,
      descuento_tipo: 'PORCENTAJE',
      descuento_valor: 10.00,
      compra_minima: 15.00,
      dias: [2], // Martes
      canales: ['CARTA', 'ADMIN', 'BOT'],
      no_suma_beneficios: false,
      activo: true,
      orden: 5,
    },
  });
  console.log(`Descuento automático "${descMartesNombre}" asegurado.`);

  const descHappyHour = 'Happy hour de la tarde';
  await prisma.oferta.upsert({
    where: { nombre: descHappyHour },
    update: {
      tipo: 'DESCUENTO',
      descripcion: '15 % de descuento en toda la carta por la tarde',
      alcance_categoria_id: null,
      descuento_tipo: 'PORCENTAJE',
      descuento_valor: 15.00,
      compra_minima: 0,
      dias: [1, 2, 3, 4, 5],
      hora_desde: new Date('1970-01-01T15:00:00Z'),
      hora_hasta: new Date('1970-01-01T17:00:00Z'),
      canales: ['CARTA', 'ADMIN', 'BOT'],
      no_suma_beneficios: false,
      activo: true,
      orden: 6,
    },
    create: {
      tipo: 'DESCUENTO',
      nombre: descHappyHour,
      descripcion: '15 % de descuento en toda la carta por la tarde',
      alcance_categoria_id: null,
      descuento_tipo: 'PORCENTAJE',
      descuento_valor: 15.00,
      compra_minima: 0,
      dias: [1, 2, 3, 4, 5],
      hora_desde: new Date('1970-01-01T15:00:00Z'),
      hora_hasta: new Date('1970-01-01T17:00:00Z'),
      canales: ['CARTA', 'ADMIN', 'BOT'],
      no_suma_beneficios: false,
      activo: true,
      orden: 6,
    },
  });
  console.log(`Descuento automático "${descHappyHour}" asegurado.`);

  // 6. Cupones de ejemplo (2 cupones: uno de monto fijo, uno de porcentaje)
  // Cupón 1: Monto fijo (compartido con tope)
  const cuponFijo = await prisma.cupon.upsert({
    where: { codigo_base: 'BIENVENIDO5' },
    update: {
      modo: 'COMPARTIDO',
      descripcion: 'Descuento de S/ 5 en tu pedido superior a S/ 25',
      descuento_tipo: 'MONTO',
      descuento_valor: 5.00,
      compra_minima: 25.00,
      tope_usos: 100,
      max_por_cliente: 1,
      requiere_cuenta: false,
      canales: ['CARTA', 'CAJA', 'BOT'],
      activo: true,
      orden: 1,
    },
    create: {
      modo: 'COMPARTIDO',
      codigo_base: 'BIENVENIDO5',
      descripcion: 'Descuento de S/ 5 en tu pedido superior a S/ 25',
      descuento_tipo: 'MONTO',
      descuento_valor: 5.00,
      compra_minima: 25.00,
      tope_usos: 100,
      max_por_cliente: 1,
      requiere_cuenta: false,
      canales: ['CARTA', 'CAJA', 'BOT'],
      activo: true,
      orden: 1,
    },
  });
  console.log(`Cupón fijo "${cuponFijo.codigo_base}" asegurado.`);

  // Cupón 2: Porcentaje (único para comprobante, vence a los 15 días)
  const cuponPorcentaje = await prisma.cupon.upsert({
    where: { codigo_base: 'VUELVE15' },
    update: {
      modo: 'UNICO_COMPROBANTE',
      descripcion: '15 % de descuento para tu próxima visita impreso en comprobante',
      descuento_tipo: 'PORCENTAJE',
      descuento_valor: 15.00,
      compra_minima: 20.00,
      dias_validez: 15,
      canales: ['CARTA', 'CAJA', 'BOT'],
      activo: true,
      orden: 2,
    },
    create: {
      modo: 'UNICO_COMPROBANTE',
      codigo_base: 'VUELVE15',
      descripcion: '15 % de descuento para tu próxima visita impreso en comprobante',
      descuento_tipo: 'PORCENTAJE',
      descuento_valor: 15.00,
      compra_minima: 20.00,
      dias_validez: 15,
      canales: ['CARTA', 'CAJA', 'BOT'],
      activo: true,
      orden: 2,
    },
  });
  console.log(`Cupón porcentaje "${cuponPorcentaje.codigo_base}" asegurado.`);

  // Cupón emitido de ejemplo para VUELVE15
  const codigoEjemplo = 'V15-TEST-9482';
  const emitidoExistente = await prisma.cuponEmitido.findUnique({
    where: { codigo: codigoEjemplo },
  });
  if (!emitidoExistente) {
    const fechaVence = new Date();
    fechaVence.setDate(fechaVence.getDate() + 15);
    await prisma.cuponEmitido.create({
      data: {
        cupon_id: cuponPorcentaje.id,
        codigo: codigoEjemplo,
        vence_en: fechaVence,
        estado: 'VIGENTE',
      },
    });
    console.log(`Cupón emitido de ejemplo "${codigoEjemplo}" creado.`);
  }

  console.log('--- Semilla de ofertas completada con éxito ---');
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
