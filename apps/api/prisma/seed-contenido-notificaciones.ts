import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

export async function main() {
  console.log('--- Iniciando semilla de Contenidos, Notificaciones, Pantallas y Diseñador (FT-INF, FT-CON, FT-CAR, FT-COC) ---');

  // 1. Notificaciones del sistema con historial (TABLES.notificaciones del mockup)
  const notificacionesData = [
    {
      tipo: 'PEDIDO_POR_CONFIRMAR',
      titulo: 'Pedido por confirmar',
      mensaje: 'Hay pedidos fuera del local por confirmar: contacta al cliente por WhatsApp y confirma el pago',
      leida: false,
    },
    {
      tipo: 'STOCK_BAJO',
      titulo: 'Stock bajo',
      mensaje: 'Crema chantilly y leche sin lactosa bajo el mínimo',
      leida: false,
    },
    {
      tipo: 'DELIVERY_POR_CONFIRMAR',
      titulo: 'Delivery por confirmar',
      mensaje: 'Un pedido de delivery espera confirmación',
      leida: false,
    },
    {
      tipo: 'ERROR_IMPRESORA',
      titulo: 'Error de impresora',
      mensaje: 'La impresora de cocina no responde',
      leida: false,
    },
    {
      tipo: 'COMPROBANTE_PENDIENTE',
      titulo: 'Comprobante pendiente',
      mensaje: 'Hay comprobantes sin enviar a la entidad tributaria',
      leida: true,
    },
    {
      tipo: 'MENSAJE_INTERNO',
      titulo: 'Mensaje interno',
      mensaje: 'Cambio de turno: caja 2 abre a las 18:00',
      leida: true,
    },
  ];

  for (const n of notificacionesData) {
    const existe = await prisma.notificacion.findFirst({
      where: { titulo: n.titulo, mensaje: n.mensaje },
    });
    if (!existe) {
      await prisma.notificacion.create({
        data: {
          tipo: n.tipo,
          titulo: n.titulo,
          mensaje: n.mensaje,
          leida_en: n.leida ? new Date('2026-10-15T18:00:00Z') : null,
        },
      });
      console.log(`Notificación creada: [${n.titulo}] (Leída: ${n.leida}).`);
    }
  }

  // 2. Novedades (NEWS_DEFAULT del mockup)
  const novedadesData = [
    {
      tipo: 'BANNER',
      titulo: 'Fin de semana de waffles',
      texto: 'Sábados y domingos: waffles recién hechos con tu bebida favorita.',
      orden: 1,
      activo: true,
    },
    {
      tipo: 'PROMOCION',
      titulo: 'Martes de 2x1 en Latte Coffe',
      texto: 'Todos los martes, dos Latte Coffe al precio de uno. Pueden ser de sabores distintos.',
      orden: 2,
      activo: true,
    },
    {
      tipo: 'VIDEO',
      titulo: 'Así preparamos nuestro Frappe Oreo',
      texto: 'Mira el paso a paso en nuestro TikTok.',
      video_url: 'https://www.tiktok.com/@caprichos',
      orden: 3,
      activo: true,
    },
    {
      tipo: 'AVISO',
      titulo: 'Nuevo: Frappe Maracuyá Tropical',
      texto: 'Llegó para quedarse unas semanas. Pruébalo antes de que se acabe.',
      orden: 4,
      activo: true,
    },
    {
      tipo: 'EVENTO',
      titulo: 'Chocolatada navideña',
      texto: 'Entrada libre. Habrá sorpresas para los niños.',
      evento_lugar: 'En el local',
      evento_fecha: new Date('2026-12-24T18:00:00Z'),
      orden: 5,
      activo: true,
    },
  ];

  for (const nov of novedadesData) {
    const existe = await prisma.novedad.findFirst({
      where: { titulo: nov.titulo },
    });
    if (!existe) {
      await prisma.novedad.create({
        data: nov,
      });
      console.log(`Novedad creada: "${nov.titulo}".`);
    }
  }

  // 3. Destacadas (HL_DEFAULT del mockup)
  const destacadasData = [
    { titulo: 'Clientes felices', orden: 1 },
    { titulo: 'Nuestro local', orden: 2 },
    { titulo: 'Nuestro equipo', orden: 3 },
    { titulo: 'Eventos', orden: 4 },
    { titulo: 'Detrás de cámaras', orden: 5 },
  ];

  for (const des of destacadasData) {
    const existe = await prisma.destacada.findFirst({
      where: { titulo: des.titulo },
    });
    if (!existe) {
      await prisma.destacada.create({
        data: {
          titulo: des.titulo,
          orden: des.orden,
          archivada: false,
        },
      });
      console.log(`Destacada creada: "${des.titulo}".`);
    }
  }

  // 4. Versión de la Carta y Decoración festiva (FT-CON-02/03)
  const versionPublicada = await prisma.versionCarta.findFirst({
    where: { estado: 'PUBLICADA' },
  });

  if (!versionPublicada) {
    await prisma.versionCarta.create({
      data: {
        estado: 'PUBLICADA',
        organizacion: 'SECCIONES',
        decoracion: 'HALLOWEEN',
        contenido: {
          secciones: ['Frappes', 'Bebidas Calientes', 'Bebidas Frías', 'Waffles', 'Postres'],
          destacados: ['FRAPPE OREO', 'LATTE COFFE', 'DONAS ARTESANALES'],
        },
        publicada_en: new Date(),
      },
    });
    console.log('Versión de carta publicada con decoración HALLOWEEN.');
  }

  // Guardar paleta de colores personalizada en la tabla parametro
  const paletaColores = {
    tema: 'HALLOWEEN',
    primario: '#ff7700',
    secundario: '#1a1a24',
    fondo: '#faf8f5',
    texto: '#0b2c3e',
    acento: '#7b2cbf',
  };

  await prisma.parametro.upsert({
    where: { clave: 'carta_paleta_decoracion' },
    update: { valor: paletaColores },
    create: { clave: 'carta_paleta_decoracion', valor: paletaColores },
  });
  console.log('Parámetro carta_paleta_decoracion guardado.');

  // 5. Ranking de más vendidos del mes (TOP_CAT del mockup)
  const mesActual = '2026-10';
  const prods = await prisma.producto.findMany({ take: 7 });

  if (prods.length > 0) {
    let puesto = 1;
    for (const p of prods) {
      await prisma.rankingMes.upsert({
        where: {
          anio_mes_producto_id: {
            anio_mes: mesActual,
            producto_id: p.id,
          },
        },
        update: { unidades: 45 - puesto * 3, puesto: puesto },
        create: {
          anio_mes: mesActual,
          producto_id: p.id,
          unidades: 45 - puesto * 3,
          puesto: puesto,
        },
      });
      puesto++;
    }
    console.log(`Ranking del mes ${mesActual} registrado con ${prods.length} productos.`);
  }

  // 6. Mensajes y opiniones de la carta (buzón)
  const opinionesData = [
    {
      tipo: 'FELICITACION',
      nombre: 'Lucía Torres',
      contacto: '987112233',
      texto: 'Los frappes con chantilly son increíbles, la atención del personal muy amable.',
    },
    {
      tipo: 'SUGERENCIA',
      nombre: 'Carlos Mendoza',
      contacto: 'carlos@ejemplo.com',
      texto: 'Sería genial que agreguen opciones con leche de almendras o avena.',
    },
  ];

  for (const op of opinionesData) {
    const existe = await prisma.mensajeCarta.findFirst({
      where: { texto: op.texto },
    });
    if (!existe) {
      await prisma.mensajeCarta.create({
        data: op,
      });
      console.log(`Mensaje de carta registrado: [${op.tipo}] "${op.nombre}".`);
    }
  }

  // 7. Pantallas TV de cocina y barra con códigos de vínculo (FT-COC-01)
  const areaCocina = await prisma.areaCocina.findFirst({ where: { nombre: 'Cocina' } });
  const areaBarra = await prisma.areaCocina.findFirst({ where: { nombre: 'Barra' } });

  const tvCocinaHash = crypto.createHash('sha256').update('tv-cocina-key-2026').digest('hex');
  const tvBarraHash = crypto.createHash('sha256').update('tv-barra-key-2026').digest('hex');
  const tvPruebaHash = crypto.createHash('sha256').update('tv-prueba-key-2026').digest('hex');

  await prisma.deviceKey.upsert({
    where: { llave_hash: tvCocinaHash },
    update: { activo: true, area_id: areaCocina ? areaCocina.id : null },
    create: {
      tipo: 'TV',
      nombre: 'TV cocina',
      llave_hash: tvCocinaHash,
      area_id: areaCocina ? areaCocina.id : null,
      activo: true,
      ultima_conexion: new Date(),
    },
  });

  await prisma.deviceKey.upsert({
    where: { llave_hash: tvBarraHash },
    update: { activo: true, area_id: areaBarra ? areaBarra.id : null },
    create: {
      tipo: 'TV',
      nombre: 'TV barra',
      llave_hash: tvBarraHash,
      area_id: areaBarra ? areaBarra.id : null,
      activo: true,
      ultima_conexion: new Date(),
    },
  });

  await prisma.deviceKey.upsert({
    where: { llave_hash: tvPruebaHash },
    update: { activo: false, codigo_vinculo: '4829' },
    create: {
      tipo: 'TV',
      nombre: 'TV de prueba',
      llave_hash: tvPruebaHash,
      codigo_vinculo: '4829',
      codigo_expira_en: new Date(Date.now() + 86400000),
      activo: false,
    },
  });
  console.log('Pantallas TV de cocina y barra configuradas.');

  console.log('--- Semilla de Contenidos, Notificaciones y Pantallas finalizada con éxito ---');
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
