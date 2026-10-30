import { PrismaClient, Prisma } from '@prisma/client';
import { obtenerDbUrl, NOMBRE_DB } from './credenciales';

let prismaInstance: PrismaClient | null = null;

export function obtenerPrismaTest(): PrismaClient {
  if (!prismaInstance) {
    const url = obtenerDbUrl(NOMBRE_DB);
    prismaInstance = new PrismaClient({
      datasources: {
        db: { url },
      },
      log: ['error'],
    });
  }
  return prismaInstance;
}

export async function desconectarDb(): Promise<void> {
  if (prismaInstance) {
    await prismaInstance.$disconnect();
    prismaInstance = null;
  }
}

/**
 * Consulta el stock disponible de un insumo por nombre o id.
 * Suma el stock en todos los lugares (almacén, barra, cocina).
 */
export async function obtenerStockInsumo(
  nombreOId: string | bigint | number,
  lugarNombre?: string,
): Promise<number | null> {
  const prisma = obtenerPrismaTest();

  let insumoId: bigint | null = null;
  if (typeof nombreOId === 'bigint') {
    insumoId = nombreOId;
  } else if (typeof nombreOId === 'number') {
    insumoId = BigInt(nombreOId);
  } else if (/^\d+$/.test(nombreOId)) {
    insumoId = BigInt(nombreOId);
  } else {
    const insumo = await prisma.insumo.findFirst({
      where: { nombre: { contains: nombreOId, mode: 'insensitive' } },
    });
    if (!insumo) return null;
    insumoId = insumo.id;
  }

  const whereClause: any = { insumo_id: insumoId };
  if (lugarNombre) {
    whereClause.lugar = { nombre: { contains: lugarNombre, mode: 'insensitive' } };
  }

  const stocks = await prisma.stock.findMany({
    where: whereClause,
  });

  if (stocks.length === 0) return 0;
  return stocks.reduce((acc, s) => acc + Number(s.cantidad), 0);
}

/**
 * Consulta el estado actual de un pedido por id o código.
 */
export async function obtenerEstadoPedido(
  codigoOId: string | bigint | number,
): Promise<string | null> {
  const prisma = obtenerPrismaTest();

  let whereClause: any = {};
  if (typeof codigoOId === 'bigint' || typeof codigoOId === 'number') {
    whereClause = { id: BigInt(codigoOId) };
  } else if (/^\d+$/.test(codigoOId)) {
    whereClause = {
      OR: [{ id: BigInt(codigoOId) }, { codigo: codigoOId }],
    };
  } else {
    whereClause = { codigo: codigoOId };
  }

  const pedido = await prisma.pedido.findFirst({
    where: whereClause,
    select: { estado: true },
  });

  return pedido ? pedido.estado : null;
}

/**
 * Consulta el pedido completo con sus líneas, cobros e historial.
 */
export async function obtenerPedidoConDetalle(
  codigoOId: string | bigint | number,
) {
  const prisma = obtenerPrismaTest();

  let whereClause: any = {};
  if (typeof codigoOId === 'bigint' || typeof codigoOId === 'number') {
    whereClause = { id: BigInt(codigoOId) };
  } else if (/^\d+$/.test(codigoOId)) {
    whereClause = {
      OR: [{ id: BigInt(codigoOId) }, { codigo: codigoOId }],
    };
  } else {
    whereClause = { codigo: codigoOId };
  }

  return prisma.pedido.findFirst({
    where: whereClause,
    include: {
      lineas: {
        include: {
          opcionesElegidas: true,
        },
      },
      cobros: {
        include: {
          pagos: true,
        },
      },
      historial: true,
    },
  });
}

/**
 * Asegura que la caja de hoy esté abierta en la base de datos caprichos_test para pruebas de cobro.
 */
export async function asegurarCajaAbierta(aperturaMonto = 100): Promise<void> {
  const prisma = obtenerPrismaTest();
  const ahora = new Date();
  const limaStr = ahora.toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
  const fechaDate = new Date(`${limaStr}T00:00:00.000Z`);

  const existente = await prisma.caja.findUnique({
    where: { fecha: fechaDate },
  });

  if (!existente) {
    const admin = await prisma.partyIdentifier.findFirst({
      where: { numero: '20000001' },
    });
    const partyId = admin?.party_id || BigInt(1);

    await prisma.caja.create({
      data: {
        fecha: fechaDate,
        apertura: new Prisma.Decimal(aperturaMonto),
        estado: 'ABIERTA',
        abierta_por: partyId,
      },
    });
  } else if (existente.estado !== 'ABIERTA') {
    await prisma.caja.update({
      where: { id: existente.id },
      data: { estado: 'ABIERTA' },
    });
  }
}

/**
 * Consulta el stock disponible de un producto terminado (elaborado) por nombre o id.
 */
export async function obtenerStockProducto(
  nombreOId: string | bigint | number,
  lugarNombre?: string,
): Promise<number | null> {
  const prisma = obtenerPrismaTest();

  let prodId: bigint | null = null;
  if (typeof nombreOId === 'bigint') {
    prodId = nombreOId;
  } else if (typeof nombreOId === 'number') {
    prodId = BigInt(nombreOId);
  } else if (/^\d+$/.test(nombreOId)) {
    prodId = BigInt(nombreOId);
  } else {
    const prod = await prisma.producto.findFirst({
      where: { nombre: { contains: nombreOId, mode: 'insensitive' } },
    });
    if (!prod) return null;
    prodId = prod.id;
  }

  const whereClause: any = { producto_id: prodId };
  if (lugarNombre) {
    whereClause.lugar = { nombre: { contains: lugarNombre, mode: 'insensitive' } };
  }

  const stocks = await prisma.stock.findMany({
    where: whereClause,
  });

  if (stocks.length === 0) return 0;
  return stocks.reduce((acc, s) => acc + Number(s.cantidad), 0);
}

/**
 * Consulta el último movimiento de stock registrado.
 */
export async function obtenerUltimoMovimientoStock(filtros?: {
  insumoId?: bigint | number;
  productoId?: bigint | number;
  tipo?: string;
}) {
  const prisma = obtenerPrismaTest();
  const where: any = {};
  if (filtros?.insumoId) where.insumo_id = BigInt(filtros.insumoId);
  if (filtros?.productoId) where.producto_id = BigInt(filtros.productoId);
  if (filtros?.tipo) where.tipo = filtros.tipo;

  return prisma.movimientoStock.findFirst({
    where,
    orderBy: { en: 'desc' },
    include: { insumo: true, producto: true, lugar: true },
  });
}


