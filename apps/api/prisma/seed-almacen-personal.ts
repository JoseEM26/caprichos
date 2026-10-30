import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function main() {
  console.log('--- Iniciando semilla de Almacén, Producción, Personal e Iniciativas (FT-ALM, FT-USR, FT-INI) ---');

  // 1. Lugares de stock: Almacén central, Cocina, Barra, Producción, Merma
  const lugares = [
    { nombre: 'Almacén central', tipo: 'ALMACEN' },
    { nombre: 'Cocina', tipo: 'AREA' },
    { nombre: 'Barra', tipo: 'AREA' },
    { nombre: 'Producción', tipo: 'AREA' },
  ];

  const lugaresMap = new Map<string, bigint>();
  for (const lug of lugares) {
    const l = await prisma.lugarStock.upsert({
      where: { nombre: lug.nombre },
      update: { tipo: lug.tipo },
      create: { nombre: lug.nombre, tipo: lug.tipo },
    });
    lugaresMap.set(lug.nombre, l.id);
  }

  // 2. Producción por tanda: Donas Artesanales (PRD-014)
  const recetaDona = await prisma.receta.findFirst({
    where: { producto: { nombre: { contains: 'DONAS', mode: 'insensitive' } } },
  });

  const adminUser = await prisma.userAccount.findFirst({ where: { rol: 'ADMIN' } });
  const adminId = adminUser ? adminUser.id : BigInt(1);

  if (recetaDona) {
    const prodExistente = await prisma.produccion.findFirst({
      where: { receta_id: recetaDona.id, tandas: 2 },
    });
    if (!prodExistente) {
      await prisma.produccion.create({
        data: {
          receta_id: recetaDona.id,
          tandas: 2,
          unidades: 24, // 24 unidades producidas
          por: adminId,
        },
      });
      console.log('Producción por tanda registrada: 24 donas artesanales.');
    }
  }

  // 3. Pedidos internos (REQ-044, REQ-045)
  const areaCocina = await prisma.areaCocina.findFirst({
    where: { nombre: 'Cocina' },
  });

  if (areaCocina) {
    const reqExistente = await prisma.pedidoInterno.findFirst({
      where: { area_id: areaCocina.id, estado: 'ENTREGADO' },
    });
    if (!reqExistente) {
      await prisma.pedidoInterno.create({
        data: {
          area_id: areaCocina.id,
          detalle: [
            { insumo: 'Pan de molde', cantidad: 3, unidad: 'bolsas' },
            { insumo: 'Harina pastelera', cantidad: 6, unidad: 'kg' },
          ],
          estado: 'ENTREGADO',
          por: adminId,
          entregado_por: adminId,
          entregado_en: new Date(),
        },
      });
      console.log('Pedido interno de cocina entregado (REQ-044).');
    }
  }

  // 4. Personal, descuentos y consumos a crédito (Marta, Luis, Rosa, Pedro, Elena, Jorge)
  const colaboradores = [
    { dni: '90000001', nombres: 'Marta', apellidos: 'Gómez', rol: 'CAJERO', descuento: 25.0, consumo: 48.0, fecha: new Date('2026-10-01') },
    { dni: '90000002', nombres: 'Luis', apellidos: 'Paredes', rol: 'COCINA', descuento: 25.0, consumo: 31.5, fecha: new Date('2026-10-08') },
    { dni: '90000003', nombres: 'Rosa', apellidos: 'Flores', rol: 'MOZO', descuento: 25.0, consumo: 22.5, fecha: new Date('2026-09-30') },
    { dni: '90000004', nombres: 'Pedro', apellidos: 'Vargas', rol: 'ALMACEN', descuento: 25.0, consumo: 18.0, fecha: new Date('2026-10-10') },
    { dni: '90000005', nombres: 'Elena', apellidos: 'Torres', rol: 'COCINA', descuento: 25.0, consumo: 40.0, fecha: new Date('2026-09-24') },
    { dni: '90000006', nombres: 'Jorge', apellidos: 'Salas', rol: 'REPARTIDOR', descuento: 25.0, consumo: 26.4, fecha: new Date('2026-10-12') },
  ];

  for (const c of colaboradores) {
    let partyId: bigint;
    const doc = await prisma.partyIdentifier.findUnique({
      where: { tipo_numero: { tipo: 'DNI', numero: c.dni } },
    });

    if (doc) {
      partyId = doc.party_id;
    } else {
      const p = await prisma.party.create({
        data: {
          tipo: 'PERSONA',
          estado: 'ACTIVO',
          persona: {
            create: {
              nombres: c.nombres,
              apellidos: c.apellidos,
            },
          },
          documentos: {
            create: {
              tipo: 'DNI',
              numero: c.dni,
            },
          },
        },
      });
      partyId = p.id;
    }

    // Rol TRABAJADOR
    let partyRole = await prisma.partyRole.findFirst({
      where: { party_id: partyId, rol: 'TRABAJADOR' },
    });
    if (!partyRole) {
      partyRole = await prisma.partyRole.create({
        data: { party_id: partyId, rol: 'TRABAJADOR' },
      });
    }

    // Configurar employee_detail (descuento del 25%)
    await prisma.employeeDetail.upsert({
      where: { party_role_id: partyRole.id },
      update: { descuento_pct: c.descuento },
      create: { party_role_id: partyRole.id, descuento_pct: c.descuento },
    });

    // Consumo personal asociado
    const pedidoPersonal = await prisma.pedido.findFirst({
      where: { es_personal: true, party_id: partyId },
    });

    if (!pedidoPersonal) {
      const nuevoPed = await prisma.pedido.create({
        data: {
          codigo: `CP-P${c.dni.slice(-2)}`,
          canal: 'MOSTRADOR',
          modalidad: 'LLEVAR',
          estado: 'ENTREGADO',
          es_personal: true,
          party_id: partyId,
          cliente_nombre: `${c.nombres} ${c.apellidos}`,
          subtotal: c.consumo / 0.75,
          descuento: (c.consumo / 0.75) * 0.25,
          total: c.consumo,
          pago_metodo: 'CREDITO_PERSONAL',
          pago_estado: 'PAGADO',
        },
      });

      await prisma.consumoPersonal.create({
        data: {
          party_id: partyId,
          fecha: c.fecha,
          pedido_id: nuevoPed.id,
          monto: c.consumo,
        },
      });
      console.log(`Consumo de personal registrado: ${c.nombres} (${nuevoPed.codigo}) S/ ${c.consumo}.`);
    }
  }

  // 5. Iniciativas del equipo (IN-0001, IN-0002, IN-0003) del mockup
  const iniciativasData = [
    {
      codigo: 'IN-0003',
      tipo: 'IDEA',
      area: 'CARTA_WEB',
      titulo: 'Combo desayuno: waffle + café',
      detalle: 'Muchos clientes piden waffle con café por la mañana. Un combo con precio cerrado vendería más y acorta la caja.',
      estado: 'HECHA',
      comentarios: [
        { autorDni: '11223344', texto: 'Buena idea. Ya está armado como combo en Ofertas.' },
      ],
    },
    {
      codigo: 'IN-0002',
      tipo: 'MEJORA',
      area: 'COCINA',
      titulo: 'Nombre del cliente más grande en la etiqueta',
      detalle: 'En hora punta cuesta leer el nombre en las etiquetas de los frappes.',
      estado: 'NUEVA',
      comentarios: [],
    },
    {
      codigo: 'IN-0001',
      tipo: 'QUEJA',
      area: 'PEDIDOS_CAJA',
      titulo: 'La tablet de los mozos se queda sin batería',
      detalle: 'A media tarde marca 4% y hay que ir a cargarla en plena atención. Adjunto la captura.',
      estado: 'EN_REVISION',
      comentarios: [
        { autorDni: '11223344', texto: 'Vamos a revisar un cargador de pared cerca de la barra.' },
      ],
    },
  ];

  for (const ini of iniciativasData) {
    let iniRec = await prisma.iniciativa.findUnique({
      where: { codigo: ini.codigo },
    });

    if (!iniRec) {
      iniRec = await prisma.iniciativa.create({
        data: {
          codigo: ini.codigo,
          tipo: ini.tipo,
          area: ini.area,
          titulo: ini.titulo,
          detalle: ini.detalle,
          estado: ini.estado,
          creado_por: adminId,
        },
      });
      console.log(`Iniciativa creada: ${ini.codigo} - ${ini.titulo} [${ini.estado}].`);
    }

    for (const com of ini.comentarios) {
      const existeCom = await prisma.iniciativaComentario.findFirst({
        where: { iniciativa_id: iniRec.id, texto: com.texto },
      });
      if (!existeCom) {
        await prisma.iniciativaComentario.create({
          data: {
            iniciativa_id: iniRec.id,
            texto: com.texto,
            creado_por: adminId,
          },
        });
        console.log(`Comentario agregado a iniciativa ${ini.codigo}.`);
      }
    }
  }

  console.log('--- Semilla de Almacén, Personal e Iniciativas finalizada con éxito ---');
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
