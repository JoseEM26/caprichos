// El gateway y el salón importan módulos ESM: en estas pruebas bastan dobles (igual que los otros specs del servicio)
jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
jest.mock('../salon/salon.service', () => ({ SalonService: class {} }));
import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PedidosEstadoService } from './pedidos-estado.service';
import { MisPedidosQueryDto } from './dto/mis-pedidos-query.dto';
import { MAX_FILAS_MIS_PEDIDOS, ventanaMisPedidos } from './mis-pedidos-rango.util';

describe('Mis pedidos: fechas, búsqueda y filtros', () => {
  let prisma: any;
  let service: PedidosEstadoService;
  const mozo = { partyId: 7n, rol: 'MOZO', debeCambiar: false } as any;
  const admin = { partyId: 1n, rol: 'ADMIN', debeCambiar: false } as any;

  const pedido = (extra: Record<string, unknown>) => ({
    id: 1n,
    codigo: 'CP-M001',
    estado: 'ENTREGADO',
    modalidad: 'MESA',
    mesa_nombre: 'Mesa Prueba 3',
    total: '10',
    pago_estado: 'PAGADO',
    pago_metodo: 'YAPE',
    party_id: 7n,
    creado_en: new Date('2026-10-20T14:00:00Z'),
    pasa_cocina_en: null,
    lineas: [],
    comandas: [],
    vouchers: [],
    planPago: [],
    cliente_nombre: null,
    ...extra,
  });
  const where = () => prisma.pedido.findMany.mock.calls.at(-1)[0].where;

  beforeEach(() => {
    // Hoy es 29/10/2026 a las 10:00 en Lima (15:00 UTC)
    jest.useFakeTimers({ now: new Date('2026-10-29T15:00:00Z') });
    prisma = {
      pedido: { findMany: jest.fn().mockResolvedValue([]), groupBy: jest.fn().mockResolvedValue([]) },
      person: { findMany: jest.fn().mockResolvedValue([]) },
    };
    service = new PedidosEstadoService(prisma, {} as any, {} as any);
  });
  afterEach(() => jest.useRealTimers());

  describe('ventana de fechas (desde/hasta)', () => {
    it('desde y hasta inclusivos por día de Lima; hasta vacío es hoy', async () => {
      await service.misPedidos(mozo, 'hoy', { desde: '2026-10-03', hasta: '2026-10-09' });
      expect(where().creado_en).toEqual({
        gte: new Date('2026-10-03T05:00:00Z'),
        lt: new Date('2026-10-10T05:00:00Z'),
      });

      const res = await service.misPedidos(mozo, 'ayer', { desde: '2026-10-20' });
      expect(res.rango).toEqual({ desde: '2026-10-20', hasta: '2026-10-29' });
    });

    it('desde/hasta mandan sobre rango', async () => {
      const res = await service.misPedidos(mozo, 'ayer', { desde: '2026-10-01', hasta: '2026-10-15' });
      expect(res.rango).toEqual({ desde: '2026-10-01', hasta: '2026-10-15' });
    });

    it('admite exactamente 92 días y rechaza 93', async () => {
      await expect(service.misPedidos(mozo, 'hoy', { desde: '2026-07-30', hasta: '2026-10-29' })).resolves.toBeDefined();
      await expect(service.misPedidos(mozo, 'hoy', { desde: '2026-07-29', hasta: '2026-10-29' })).rejects.toThrow(
        'El rango no puede pasar de 92 días.',
      );
    });

    it('rechaza desde posterior a hasta, fechas futuras, fechas que no existen y desde ausente', async () => {
      await expect(service.misPedidos(mozo, 'hoy', { desde: '2026-10-10', hasta: '2026-10-09' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(service.misPedidos(mozo, 'hoy', { desde: '2026-10-20', hasta: '2026-10-30' })).rejects.toThrow(
        'no puede ser posterior a hoy',
      );
      await expect(service.misPedidos(mozo, 'hoy', { desde: '2026-02-30', hasta: '2026-03-01' })).rejects.toThrow(
        'no existe en el calendario',
      );
      await expect(service.misPedidos(mozo, 'hoy', { hasta: '2026-10-09' })).rejects.toThrow('Indica también la fecha de inicio');
    });

    it('rango «todas» sin fechas no pone límite de creado_en', async () => {
      const res = await service.misPedidos(mozo, 'todas');
      expect(where().creado_en).toBeUndefined();
      expect(res.rango).toEqual({ desde: null, hasta: '2026-10-29' });
    });
  });

  describe('búsqueda por texto (q)', () => {
    beforeEach(() => {
      prisma.pedido.findMany.mockResolvedValue([
        pedido({ id: 1n, codigo: 'CP-M001', cliente_nombre: 'Lucía Ortega', mesa_nombre: 'Mesa Prueba 3' }),
        pedido({ id: 2n, codigo: 'CP-M002', cliente_nombre: null, mesa_nombre: 'Terraza Prueba 1' }),
        pedido({ id: 3n, codigo: 'CP-M203', cliente_nombre: 'Rosa Paz', mesa_nombre: 'Barra' }),
      ]);
    });

    it('sin desde/hasta busca en los últimos 92 días aunque el rango sea hoy', async () => {
      const res = await service.misPedidos(mozo, 'hoy', { q: 'cp' });
      expect(where().creado_en).toEqual({ gte: new Date('2026-07-30T05:00:00Z') });
      expect(res.rango).toEqual({ desde: '2026-07-30', hasta: '2026-10-29' });
    });

    it('un texto vacío (solo espacios o guiones) no es búsqueda: sigue el rango de siempre', async () => {
      const res = await service.misPedidos(mozo, 'hoy', { q: '  - ' });
      expect(where().creado_en.gte).toEqual(new Date('2026-10-29T05:00:00Z'));
      expect(res.pedidos).toHaveLength(3);
    });

    it('por código: parcial, sin mayúsculas y con o sin guion', async () => {
      for (const q of ['m002', 'CP-M002', 'cpm002', 'Cp-M0']) {
        const res = await service.misPedidos(mozo, 'hoy', { q });
        expect(res.pedidos.map((p) => p.codigo)).toEqual(
          q === 'Cp-M0' ? ['CP-M001', 'CP-M002'] : ['CP-M002'],
        );
      }
    });

    it('por nombre del cliente sin tildes ni mayúsculas', async () => {
      const res = await service.misPedidos(mozo, 'hoy', { q: 'lucia ORTEGA' });
      expect(res.pedidos.map((p) => p.codigo)).toEqual(['CP-M001']);
    });

    it('por nombre de la mesa', async () => {
      const res = await service.misPedidos(mozo, 'hoy', { q: 'terraza' });
      expect(res.pedidos.map((p) => p.codigo)).toEqual(['CP-M002']);
    });

    it('el total y el resumen cuentan solo las coincidencias', async () => {
      const res = await service.misPedidos(mozo, 'hoy', { q: 'prueba' });
      expect(res.total).toBe(2);
      expect(res.resumen.cantidad).toBe(2);
    });

    it('con desde/hasta usa esas fechas, no las 92', async () => {
      await service.misPedidos(mozo, 'hoy', { q: 'cp', desde: '2026-10-01', hasta: '2026-10-29' });
      expect(where().creado_en.gte).toEqual(new Date('2026-10-01T05:00:00Z'));
    });
  });

  describe('filtros combinados', () => {
    it('estado en lista: EN_CURSO se expande y los demás van con «in»', async () => {
      await service.misPedidos(admin, 'hoy', { estado: 'EN_CURSO,ANULADO' });
      expect(where().estado).toEqual({ in: ['COLA', 'PREPARANDO', 'LISTO', 'EN_CAMINO', 'ANULADO'] });
    });

    it('un solo estado va exacto', async () => {
      await service.misPedidos(admin, 'hoy', { estado: 'LISTO' });
      expect(where().estado).toBe('LISTO');
    });

    it('modalidad, pago y método viajan como listas', async () => {
      await service.misPedidos(admin, 'hoy', { modalidad: 'MESA,DELIVERY', pago: 'PAGADO', metodo: 'YAPE,EFECTIVO' });
      const w = where();
      expect(w.modalidad).toEqual({ in: ['MESA', 'DELIVERY'] });
      expect(w.pago_estado).toBe('PAGADO');
      expect(w.pago_metodo).toEqual({ in: ['YAPE', 'EFECTIVO'] });
    });

    it('montoMin y montoMax filtran el total; montoMin mayor que montoMax es error', async () => {
      await service.misPedidos(admin, 'hoy', { montoMin: '12.5', montoMax: '80' });
      expect(where().total).toEqual({ gte: 12.5, lte: 80 });

      await expect(service.misPedidos(admin, 'hoy', { montoMin: '90', montoMax: '20' })).rejects.toThrow(
        'montoMin no puede ser mayor que montoMax.',
      );
    });

    it('todos los filtros se combinan con q y con la ventana', async () => {
      await service.misPedidos(mozo, 'hoy', {
        q: 'cp',
        estado: 'ENTREGADO',
        modalidad: 'MESA',
        pago: 'PAGADO',
        metodo: 'YAPE',
        montoMin: '5',
        desde: '2026-10-01',
        hasta: '2026-10-29',
      });
      const w = where();
      expect(w).toMatchObject({
        canal: 'MOZO',
        party_id: 7n,
        estado: 'ENTREGADO',
        modalidad: 'MESA',
        pago_estado: 'PAGADO',
        pago_metodo: 'YAPE',
        total: { gte: 5 },
      });
    });
  });

  describe('aislamiento por usuario', () => {
    it('un mozo nunca consulta pedidos de otro, aunque pida por mozo, q o filtros', async () => {
      await service.misPedidos(mozo, 'todas', { mozo: '8', q: 'cp', estado: 'COLA', modalidad: 'DELIVERY' });
      const w = where();
      expect(w.canal).toBe('MOZO');
      expect(w.party_id).toBe(7n);
    });

    it('la búsqueda en memoria no devuelve pedidos que el servidor no trajo del propio mozo', async () => {
      // Lo que devuelve la consulta ya viene acotado a party_id del mozo; el filtro q solo reduce
      prisma.pedido.findMany.mockResolvedValueOnce([pedido({ codigo: 'CP-M009', cliente_nombre: 'Cliente Demo' })]);
      const res = await service.misPedidos(mozo, 'hoy', { q: 'demo' });
      expect(res.pedidos.map((p) => p.codigo)).toEqual(['CP-M009']);
      expect(where().party_id).toBe(7n);
    });
  });

  describe('límite de filas', () => {
    it('corta en 200 filas, pero el total y el resumen cuentan todas', async () => {
      const filas = Array.from({ length: MAX_FILAS_MIS_PEDIDOS + 5 }, (_, i) =>
        pedido({ id: BigInt(i + 1), codigo: `CP-M${String(i + 1).padStart(3, '0')}`, total: '1' }),
      );
      prisma.pedido.findMany.mockResolvedValueOnce(filas);
      const res = await service.misPedidos(mozo, 'hoy');
      expect(res.pedidos).toHaveLength(MAX_FILAS_MIS_PEDIDOS);
      expect(res.truncado).toBe(true);
      expect(res.total).toBe(MAX_FILAS_MIS_PEDIDOS + 5);
      expect(res.resumen.cantidad).toBe(MAX_FILAS_MIS_PEDIDOS + 5);
    });

    it('sin cortes: truncado false', async () => {
      prisma.pedido.findMany.mockResolvedValueOnce([pedido({})]);
      const res = await service.misPedidos(mozo, 'hoy');
      expect(res.truncado).toBe(false);
      expect(res.total).toBe(1);
    });
  });

  describe('ventanaMisPedidos (unidad)', () => {
    const ahora = new Date('2026-10-29T15:00:00Z');
    it('rango hoy sin fechas: desde y hasta son hoy', () => {
      expect(ventanaMisPedidos('hoy', {}, ahora)).toMatchObject({ desde: '2026-10-29', hasta: '2026-10-29' });
    });
  });

  describe('validación del DTO', () => {
    const validar = async (plano: Record<string, unknown>) =>
      (await validate(plainToInstance(MisPedidosQueryDto, plano))).map((e) => e.property);

    it('acepta listas válidas y filtros combinados', async () => {
      expect(
        await validar({ estado: 'COLA,LISTO', modalidad: 'MESA', pago: 'PAGADO', metodo: 'YAPE', montoMin: '12.5', montoMax: '80', q: 'cp' }),
      ).toEqual([]);
    });

    it('rechaza valores fuera de la lista, montos mal escritos y texto demasiado largo', async () => {
      expect(await validar({ estado: 'COLA,FOO' })).toEqual(['estado']);
      expect(await validar({ modalidad: 'MARCIANO' })).toEqual(['modalidad']);
      expect(await validar({ pago: 'PAGADO,' })).toEqual(['pago']);
      expect(await validar({ metodo: 'BITCOIN' })).toEqual(['metodo']);
      expect(await validar({ montoMin: '12.345' })).toEqual(['montoMin']);
      expect(await validar({ montoMax: '-3' })).toEqual(['montoMax']);
      expect(await validar({ q: 'x'.repeat(61) })).toEqual(['q']);
      expect(await validar({ desde: '2026/10/01' })).toEqual(['desde']);
    });
  });
});
