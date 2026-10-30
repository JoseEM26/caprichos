// El gateway arrastra @nestjs/jwt (ESM): aquí solo se usa como tipo opcional.
jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

import { calcularRecargoReprogramacion, calcularMontoReprogramacion, montoPendienteReprogramacion } from './recargo-reprogramacion';

const base = { modo: 'IGUAL_ENVIO', montoFijo: 5, envioActual: 7, recargosPrevios: 0, tarifaZona: 7 };

describe('calcularRecargoReprogramacion (función pura)', () => {
  it('IGUAL_ENVIO: cobra lo mismo que el envío original del pedido', () => {
    expect(calcularRecargoReprogramacion(base)).toBe(7);
  });

  it('FIJO: cobra el monto fijo sin mirar el envío', () => {
    expect(calcularRecargoReprogramacion({ ...base, modo: 'FIJO', montoFijo: 5 })).toBe(5);
    expect(calcularRecargoReprogramacion({ ...base, modo: 'FIJO', montoFijo: 0 })).toBe(0);
  });

  it('SIN_COSTO: siempre 0', () => {
    expect(calcularRecargoReprogramacion({ ...base, modo: 'SIN_COSTO' })).toBe(0);
  });

  it('envío gratis por promoción (0): usa la tarifa normal de la zona', () => {
    expect(calcularRecargoReprogramacion({ ...base, envioActual: 0, tarifaZona: 4 })).toBe(4);
  });

  it('envío gratis y sin zona: 0', () => {
    expect(calcularRecargoReprogramacion({ ...base, envioActual: 0, tarifaZona: null })).toBe(0);
    expect(calcularRecargoReprogramacion({ ...base, envioActual: null, tarifaZona: null })).toBe(0);
  });

  it('segunda reprogramación no acumula: el envío ya incluye el recargo anterior y se descuenta', () => {
    // envío base 7 + recargo previo 7 = 14 guardado en el pedido; el nuevo recargo sigue siendo 7
    expect(calcularRecargoReprogramacion({ ...base, envioActual: 14, recargosPrevios: 7 })).toBe(7);
  });

  it('modo desconocido o vacío: cae al modo por defecto IGUAL_ENVIO', () => {
    expect(calcularRecargoReprogramacion({ ...base, modo: 'LO_QUE_SEA' })).toBe(7);
    expect(calcularRecargoReprogramacion({ ...base, modo: null })).toBe(7);
  });

  it('redondea a céntimos y nunca devuelve negativo', () => {
    expect(calcularRecargoReprogramacion({ ...base, modo: 'FIJO', montoFijo: 4.999 })).toBe(5);
    // envío base negativo se trata como 0; sin zona no hay tarifa de respaldo
    expect(calcularRecargoReprogramacion({ ...base, envioActual: 3, recargosPrevios: 9, tarifaZona: null })).toBe(0);
  });
});

describe('calcularMontoReprogramacion y montoPendienteReprogramacion (lectura de BD)', () => {
  function crearPrisma(opts: { modo?: string; incidentePendiente?: { recargo: unknown } | null; envio?: number }) {
    return {
      parametro: {
        findMany: jest.fn().mockResolvedValue([
          { clave: 'reprog_recargo_modo', valor: opts.modo ?? 'IGUAL_ENVIO' },
          { clave: 'reparto_recargo_reprogramacion', valor: 5 },
        ]),
      },
      pedido: {
        findUnique: jest.fn().mockResolvedValue({
          envio: opts.envio ?? 7,
          zona: { tarifa: 4 },
        }),
      },
      incidenteEntrega: {
        findMany: jest.fn().mockResolvedValue([{ recargo: 7 }]),
        findFirst: jest.fn().mockResolvedValue(opts.incidentePendiente ?? null),
      },
    } as any;
  }

  it('calcula con el modo guardado, los recargos previos y la tarifa de zona', async () => {
    const prisma = crearPrisma({ modo: 'IGUAL_ENVIO', envio: 14 });
    const r = await calcularMontoReprogramacion(prisma, BigInt(1));
    // envío 14 - recargo previo 7 = 7
    expect(r).toEqual({ monto: 7, modo: 'IGUAL_ENVIO' });
  });

  it('modo FIJO lee reparto_recargo_reprogramacion', async () => {
    const prisma = crearPrisma({ modo: 'FIJO' });
    expect((await calcularMontoReprogramacion(prisma, BigInt(1))).monto).toBe(5);
  });

  it('usa el monto guardado en el incidente pendiente (el que vio el cliente)', async () => {
    const prisma = crearPrisma({ incidentePendiente: { recargo: 9 } });
    expect(await montoPendienteReprogramacion(prisma, BigInt(1))).toBe(9);
  });

  it('sin incidente pendiente, calcula en ese momento', async () => {
    const prisma = crearPrisma({ incidentePendiente: null, envio: 7 });
    prisma.incidenteEntrega.findMany.mockResolvedValue([]); // sin recargos previos
    expect(await montoPendienteReprogramacion(prisma, BigInt(1))).toBe(7);
  });
});
