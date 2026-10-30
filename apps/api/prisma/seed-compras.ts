import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function main() {
  console.log('--- Iniciando semilla de Proveedores y Compras (FT-COM-01..03) ---');

  // 1. Proveedores del mockup
  const proveedoresData = [
    {
      razonSocial: 'Lácteos del Sur S.A.C.',
      nombreComercial: 'Lácteos del Sur',
      ruc: '20554433221',
      telefono: '987654321',
      diasCredito: 15,
      cuentaPago: 'BCP Cta Cte: 193-45678901-0-22',
    },
    {
      razonSocial: 'Distribuidora San Jorge E.I.R.L.',
      nombreComercial: 'San Jorge Distribuciones',
      ruc: '20443322110',
      telefono: '976543210',
      diasCredito: 0, // Contado
      cuentaPago: 'Interbank Cta Cte: 200-300123456',
    },
    {
      razonSocial: 'Avícola Central S.A.C.',
      nombreComercial: 'Avícola Central',
      ruc: '20665544332',
      telefono: '965432109',
      diasCredito: 30,
      cuentaPago: 'BBVA Cta Cte: 0011-0123-0100045678',
    },
    {
      razonSocial: 'Empaques y Vasos del Perú S.A.C.',
      nombreComercial: 'Envases Perú',
      ruc: '20112233445',
      telefono: '954321098',
      diasCredito: 7,
      cuentaPago: 'BCP Cta Ahorros: 191-98765432-0-11',
    },
  ];

  const proveedoresMap = new Map<string, bigint>();

  for (const prov of proveedoresData) {
    let partyId: bigint;
    const docExistente = await prisma.partyIdentifier.findUnique({
      where: {
        tipo_numero: {
          tipo: 'RUC',
          numero: prov.ruc,
        },
      },
    });

    if (docExistente) {
      partyId = docExistente.party_id;
    } else {
      const party = await prisma.party.create({
        data: {
          tipo: 'ORGANIZACION',
          estado: 'ACTIVO',
          documentos: {
            create: {
              tipo: 'RUC',
              numero: prov.ruc,
            },
          },
          organizacion: {
            create: {
              razon_social: prov.razonSocial,
              nombre_comercial: prov.nombreComercial,
            },
          },
          contactos: {
            create: {
              tipo: 'WHATSAPP',
              valor: prov.telefono,
              principal: true,
            },
          },
        },
      });
      partyId = party.id;
    }

    // Asegurar rol PROVEEDOR
    let partyRole = await prisma.partyRole.findFirst({
      where: { party_id: partyId, rol: 'PROVEEDOR' },
    });

    if (!partyRole) {
      partyRole = await prisma.partyRole.create({
        data: {
          party_id: partyId,
          rol: 'PROVEEDOR',
        },
      });
    }

    // Asegurar supplier_detail
    await prisma.supplierDetail.upsert({
      where: { party_role_id: partyRole.id },
      update: {
        dias_credito: prov.diasCredito,
        cuenta_pago: prov.cuentaPago,
        activo: true,
      },
      create: {
        party_role_id: partyRole.id,
        dias_credito: prov.diasCredito,
        cuenta_pago: prov.cuentaPago,
        activo: true,
      },
    });

    proveedoresMap.set(prov.ruc, partyId);
    console.log(`Proveedor ${prov.razonSocial} (RUC: ${prov.ruc}) asegurado.`);
  }

  // 2. Asociar insumos a proveedores A, B, C si no los tienen
  const provLacteosId = proveedoresMap.get('20554433221');
  const provSanJorgeId = proveedoresMap.get('20443322110');

  const insumoLeche = await prisma.insumo.findFirst({
    where: { nombre: { contains: 'Leche', mode: 'insensitive' } },
  });
  if (insumoLeche && provLacteosId && provSanJorgeId) {
    await prisma.insumo.update({
      where: { id: insumoLeche.id },
      data: {
        proveedor_a: provLacteosId,
        proveedor_b: provSanJorgeId,
      },
    });
    console.log(`Insumo ${insumoLeche.nombre} configurado con Proveedor A y B.`);
  }

  // 3. Crear pedido a proveedor («POR_RECIBIR»)
  if (provLacteosId && insumoLeche) {
    let pedidoProv = await prisma.pedidoProveedor.findFirst({
      where: {
        proveedor_party_id: provLacteosId,
        estado: 'POR_RECIBIR',
      },
    });

    if (!pedidoProv) {
      pedidoProv = await prisma.pedidoProveedor.create({
        data: {
          proveedor_party_id: provLacteosId,
          estado: 'POR_RECIBIR',
          lineas: {
            create: {
              insumo_id: insumoLeche.id,
              cantidad_compra: 3.0, // 3 cajas
              recibido: 0,
            },
          },
        },
      });
      console.log(`Pedido a proveedor creado (ID: ${pedidoProv.id}) «POR_RECIBIR».`);
    }

    // 4. Crear compra registrada con factura a crédito
    const compraExistente = await prisma.compra.findFirst({
      where: {
        proveedor_party_id: provLacteosId,
        comprobante_tipo: 'FACTURA',
        comprobante_numero: 'F001-00045',
      },
    });

    if (!compraExistente) {
      await prisma.compra.create({
        data: {
          proveedor_party_id: provLacteosId,
          comprobante_tipo: 'FACTURA',
          comprobante_numero: 'F001-00045',
          condicion: 'CREDITO',
          total: 180.0,
          nota: '2 cajas recibidas, 1 pendiente de entrega',
          lineas: {
            create: {
              insumo_id: insumoLeche.id,
              cantidad_compra: 2.0,
              costo_unit: 60.0, // S/ 60 por caja
            },
          },
        },
      });
      console.log('Compra F001-00045 registrada a crédito.');
    }
  }

  console.log('--- Semilla de Proveedores y Compras finalizada con éxito ---');
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
