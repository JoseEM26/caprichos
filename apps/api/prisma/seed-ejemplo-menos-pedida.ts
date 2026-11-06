import { PrismaClient, Prisma } from '@prisma/client';

/**
 * Ejemplo solo local de la «opción menos pedida» en cocina: un frappé con grupo de leche (3 opciones) y de
 * endulzante (2), con el check `resaltar_opcion_menos_pedida` encendido, historial de 20 pedidos ENTREGADOS
 * de los últimos 30 días (códigos EJ-MP-*) y un pedido de mesa EN_COCINA (Barra) con 2 frappés y nota del cliente.
 *
 * SOLO base local de desarrollo: exige DATABASE_URL apuntando a localhost:5442/caprichos.
 * Idempotente: borra los EJ-MP-* y los recrea. Con --borrar quita esos pedidos y apaga el check si el seed lo encendió.
 *
 * Uso: con DATABASE_URL local, npx ts-node prisma/seed-ejemplo-menos-pedida.ts   (borrar: ... -- --borrar)
 */

const PREFIJO = 'EJ-MP-';
const CLAVE_MARCA = 'ejemplo_menos_pedida';
const CLIENTE_HISTORIAL = 'Ejemplo cocina';
const CLIENTE_MESA = 'Cliente Ejemplo';
const NOTA_MESA = 'Poco hielo, por favor';
const TOTAL_HISTORIAL = 20;
const CUENTA_LECHE_COMUN = 14; // de 20: el resto va a la segunda; la tercera queda en 0
const CUENTA_ENDULZANTE_MENOS = 5; // de 20: el resto Azúcar

/** Verifica que la base sea la local de desarrollo (nunca demo, e2e ni producción). */
function asegurarBaseLocal() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Falta DATABASE_URL (la base local caprichos, localhost:5442)');
  const u = new URL(url);
  const esLocal =
    ['localhost', '127.0.0.1'].includes(u.hostname) && u.port === '5442' && u.pathname.replace(/^\//, '') === 'caprichos';
  if (!esLocal) {
    throw new Error(`Este seed solo corre contra localhost:5442/caprichos (recibido ${u.hostname}:${u.port}${u.pathname})`);
  }
}

/** Borra los pedidos EJ-MP-* y todo lo que cuelga de ellos. Devuelve cuántos borró. */
async function limpiarPedidos(prisma: PrismaClient): Promise<number> {
  const previos = await prisma.pedido.findMany({ where: { codigo: { startsWith: PREFIJO } }, select: { id: true } });
  const ids = previos.map((p) => p.id);
  if (ids.length === 0) return 0;
  const lineas = await prisma.pedidoLinea.findMany({ where: { pedido_id: { in: ids } }, select: { id: true } });
  await prisma.$transaction([
    prisma.pedidoLineaOpcion.deleteMany({ where: { pedido_linea_id: { in: lineas.map((l) => l.id) } } }),
    prisma.pedidoLinea.deleteMany({ where: { pedido_id: { in: ids } } }),
    prisma.comandaArea.deleteMany({ where: { pedido_id: { in: ids } } }),
    prisma.pedidoMesa.deleteMany({ where: { pedido_id: { in: ids } } }),
    prisma.pedidoEstadoHistorial.deleteMany({ where: { pedido_id: { in: ids } } }),
    prisma.pedido.deleteMany({ where: { id: { in: ids } } }),
  ]);
  return ids.length;
}

/** Grupo de opciones del producto cuyo nombre cumple `patron`, con sus opciones activas en orden. */
function grupoPorNombre(producto: any, patron: RegExp) {
  const pg = producto.grupos.find((g: any) => patron.test(g.grupo.nombre));
  return pg ? (pg.grupo.opciones as any[]).map((o) => ({ ...o, grupoNombre: pg.grupo.nombre })) : [];
}

/**
 * Elige el frappé: debe tener grupo de leche y de endulzante con al menos dos opciones; entre ellos, el de más
 * leches (si ninguno llega a tres, usa el que tenga más y se avisa). Prefiere «FRAPPE CAFÉ» en empate.
 */
async function elegirProducto(prisma: PrismaClient) {
  const frappes = await prisma.producto.findMany({
    where: { nombre: { startsWith: 'FRAPPE' } },
    orderBy: { nombre: 'asc' },
    include: {
      categoria: true,
      grupos: { include: { grupo: { include: { opciones: { where: { activo: true }, include: { valor: true }, orderBy: [{ valor: { orden: 'asc' } }, { id: 'asc' }] } } } } },
    },
  });
  const candidatos = frappes
    .map((p) => ({ p, leche: grupoPorNombre(p, /leche/i), endulz: grupoPorNombre(p, /endúlz|endulz/i) }))
    .filter((c) => c.leche.length >= 2 && c.endulz.length >= 2);
  if (candidatos.length === 0) throw new Error('Ningún frappé tiene grupo de leche y de endulzante con al menos dos opciones');
  const maxLeche = Math.max(...candidatos.map((c) => c.leche.length));
  const elegido =
    candidatos.find((c) => c.p.nombre === 'FRAPPE CAFÉ' && c.leche.length === maxLeche) ??
    candidatos.find((c) => c.leche.length === maxLeche)!;
  if (elegido.leche.length < 3) {
    console.log(`AVISO: ningún frappé tiene 3 leches; uso ${elegido.p.nombre} con ${elegido.leche.length}.`);
  }
  return elegido;
}

/** Pedido por opción elegida (fila del pedido_linea_opcion y del campo `opciones` como lo guarda la app). */
function opcionElegida(o: any) {
  return {
    opcion_id: o.id,
    grupo_nombre: o.grupoNombre,
    opcion_nombre: o.valor.nombre,
    precio_unit: new Prisma.Decimal(0),
    precio_extra: new Prisma.Decimal(0),
  };
}

export async function main() {
  asegurarBaseLocal();
  const prisma = new PrismaClient();
  try {
    if (process.argv.includes('--borrar')) {
      const borrados = await limpiarPedidos(prisma);
      const marca = await prisma.parametro.findUnique({ where: { clave: CLAVE_MARCA } });
      const valor = (marca?.valor ?? {}) as { producto_id?: string; encendio_por_seed?: boolean };
      if (valor.encendio_por_seed && valor.producto_id) {
        await prisma.producto.update({
          where: { id: BigInt(valor.producto_id) },
          data: { resaltar_opcion_menos_pedida: false },
        });
        console.log(`Check apagado en el producto ${valor.producto_id} (lo había encendido el seed).`);
      }
      await prisma.parametro.deleteMany({ where: { clave: CLAVE_MARCA } });
      console.log(`Pedidos ${PREFIJO}* borrados: ${borrados}`);
      return;
    }

    // 1. Limpieza de una corrida anterior (idempotencia)
    const borradosAntes = await limpiarPedidos(prisma);
    console.log(`Pedidos ${PREFIJO}* anteriores borrados: ${borradosAntes}`);

    // 2. Producto y grupos
    const { p: producto, leche, endulz } = await elegirProducto(prisma);
    const [lecheComun, lecheOtra, lecheNunca] = leche;
    const [endulzComun, endulzMenos, endulzNunca] = endulz;
    const area = producto.categoria.area_id;
    const precio = new Prisma.Decimal(producto.precio);
    console.log(`Producto: ${producto.nombre} (id ${producto.id}), área ${area}`);
    console.log(`Leche: ${leche.map((o) => o.valor.nombre).join(' | ')}`);
    console.log(`Endulzante: ${endulz.map((o) => o.valor.nombre).join(' | ')}`);

    // 3. Check encendido (se recuerda si lo encendió el seed, para --borrar)
    const eraEncendido = producto.resaltar_opcion_menos_pedida;
    await prisma.producto.update({ where: { id: producto.id }, data: { resaltar_opcion_menos_pedida: true } });
    await prisma.parametro.upsert({
      where: { clave: CLAVE_MARCA },
      update: { valor: { producto_id: producto.id.toString(), encendio_por_seed: !eraEncendido } },
      create: { clave: CLAVE_MARCA, valor: { producto_id: producto.id.toString(), encendio_por_seed: !eraEncendido } },
    });

    // 4. Historial de 20 pedidos entregados en los últimos 30 días
    const DIA = 24 * 60 * 60 * 1000;
    const ahora = Date.now();
    const resumenHistorial: Record<string, number> = {};
    for (let i = 0; i < TOTAL_HISTORIAL; i++) {
      const lecheElegida = i < CUENTA_LECHE_COMUN ? lecheComun : lecheOtra;
      const endulzElegido = i % 4 === 3 ? endulzMenos : endulzComun; // 5 de 20 (i = 3, 7, 11, 15, 19)
      const opciones = [lecheElegida, endulzElegido];
      resumenHistorial[lecheElegida.valor.nombre] = (resumenHistorial[lecheElegida.valor.nombre] ?? 0) + 1;
      resumenHistorial[endulzElegido.valor.nombre] = (resumenHistorial[endulzElegido.valor.nombre] ?? 0) + 1;
      const creado = new Date(ahora - (2 + i) * DIA);
      await prisma.pedido.create({
        data: {
          codigo: `${PREFIJO}${String(i + 1).padStart(3, '0')}`,
          canal: 'CARTA',
          modalidad: 'RECOGER',
          estado: 'ENTREGADO',
          cliente_nombre: CLIENTE_HISTORIAL,
          subtotal: precio,
          descuento: new Prisma.Decimal(0),
          envio: new Prisma.Decimal(0),
          total: precio,
          pago_metodo: 'EFECTIVO',
          pago_estado: 'PAGADO',
          creado_en: creado,
          entregado_en: new Date(creado.getTime() + 20 * 60_000),
          historial: { create: [{ estado_anterior: null, estado_nuevo: 'ENTREGADO', en: creado }] },
          lineas: {
            create: [
              {
                producto_id: producto.id,
                nombre: producto.nombre,
                cantidad: 1,
                precio_unit: precio,
                subtotal: precio,
                area_id: area,
                opciones: opciones.map((o) => ({ id: o.id.toString(), nombre: o.valor.nombre, precio_extra: 0, grupo: o.grupoNombre })),
                opcionesElegidas: { create: opciones.map(opcionElegida) },
              },
            ],
          },
        },
      });
    }

    // 5. Pedido de mesa en cocina: 2 frappés (uno con la leche que nunca se pide; otro con la más común y el endulzante menos pedido)
    const mesasOcupadas = new Set(
      (await prisma.pedidoMesa.findMany({ where: { abierta: true, mesa_id: { not: null } }, select: { mesa_id: true } })).map(
        (m) => m.mesa_id!.toString(),
      ),
    );
    const mesa = (await prisma.elementoPlano.findMany({ where: { tipo: 'MESA', activo: true }, orderBy: { numero: 'asc' } })).find(
      (m) => !mesasOcupadas.has(m.id.toString()),
    );
    if (!mesa) throw new Error('No hay mesas libres para el pedido de ejemplo');

    const lineasMesa = [
      [lecheNunca ?? lecheOtra, endulzComun],
      [lecheComun, endulzMenos],
    ] as const;
    const ahoraDate = new Date(ahora);
    await prisma.pedido.create({
      data: {
        codigo: `${PREFIJO}${String(TOTAL_HISTORIAL + 1).padStart(3, '0')}`,
        canal: 'MOZO',
        modalidad: 'MESA',
        estado: 'PREPARANDO',
        cliente_nombre: CLIENTE_MESA,
        mesa_nombre: mesa.nombre,
        entrega_referencia: mesa.nombre,
        nota: NOTA_MESA,
        pago_metodo: 'EFECTIVO',
        pago_estado: 'PENDIENTE',
        subtotal: precio.mul(2),
        descuento: new Prisma.Decimal(0),
        total: precio.mul(2),
        creado_en: ahoraDate,
        pasa_cocina_en: ahoraDate,
        historial: {
          create: [
            { estado_anterior: null, estado_nuevo: 'COLA', en: ahoraDate },
            { estado_anterior: 'COLA', estado_nuevo: 'PREPARANDO', en: ahoraDate },
          ],
        },
        lineas: {
          create: lineasMesa.map(([leche, endulzante]) => {
            const opciones = [leche, endulzante];
            return {
              producto_id: producto.id,
              nombre: producto.nombre,
              cantidad: 1,
              precio_unit: precio,
              subtotal: precio,
              area_id: area,
              opciones: opciones.map((o) => ({ id: o.id.toString(), nombre: o.valor.nombre, precio_extra: 0, grupo: o.grupoNombre })),
              opcionesElegidas: { create: opciones.map(opcionElegida) },
            };
          }),
        },
        mesas: { create: { mesa_id: mesa.id, mesa_nombre: mesa.nombre, abierta: true } },
        comandas: { create: { area_id: area, estado: 'EN_COCINA', llego_en: ahoraDate } },
      },
    });

    // 6. Resumen
    console.log(`Historial (${TOTAL_HISTORIAL} pedidos ${PREFIJO}001..): ${JSON.stringify(resumenHistorial)}`);
    console.log(`Pedido de mesa: ${PREFIJO}${TOTAL_HISTORIAL + 1} en ${mesa.nombre}, área ${area} (EN_COCINA)`);
    console.log(`Nota del cliente: «${NOTA_MESA}»`);
    if (endulzNunca) console.log(`(Hay una tercera opción de endulzante, ${endulzNunca.valor.nombre}, sin elecciones.)`);
    console.log('Para ver el resaltado, la caché de 10 min debe vencer o reiniciar la API (touch de un archivo en apps/api/src).');
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
