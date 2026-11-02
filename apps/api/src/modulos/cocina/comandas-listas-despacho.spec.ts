import { BadRequestException, ConflictException } from '@nestjs/common';
import { ComandasService } from './comandas.service';
import { MATRIZ } from '../acceso/permisos';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';

jest.mock('../salon/salon.service', () => ({ SalonService: class {} }));
jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

const usuario: UsuarioAutenticado = { partyId: 100n, rol: 'COCINA', debeCambiar: false } as UsuarioAutenticado;

/** Línea de cocina tal como la lee el servicio: área del propio ítem o de su categoría. */
const linea = (id: bigint, cantidad: number, listas = 0, despachadas = 0, area = 5n) => ({
  id,
  cantidad,
  listas,
  despachadas,
  area_id: area,
  producto: { categoria: { area_id: area } },
});

describe('ComandasService: listo por producto y despacho', () => {
  let service: ComandasService;
  let prisma: any;
  let auditoria: any;
  let eventos: any;
  let salon: any;

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn(async (fn: any) => fn(prisma)),
      parametro: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn().mockResolvedValue(null) },
      pedido: { findUnique: jest.fn(), update: jest.fn() },
      pedidoLinea: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), update: jest.fn() },
      comandaArea: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      pedidoEstadoHistorial: { create: jest.fn() },
    };
    auditoria = { registrar: jest.fn().mockResolvedValue(true) };
    eventos = { emitirAdmin: jest.fn() };
    salon = { marcarEntregadoMesa: jest.fn().mockResolvedValue({ ok: true }), avisarListo: jest.fn() };
    service = new ComandasService(prisma, auditoria, eventos, undefined, salon);
  });

  describe('marcarListas', () => {
    const lineaBd = (cantidad: number, listas: number, despachadas = 0) => ({
      id: 10n,
      pedido_id: 1n,
      cantidad,
      listas,
      despachadas,
      area_id: 5n,
      producto: { categoria: { area_id: 5n } },
    });

    it('sube una unidad y la línea queda en 1 de 3, sin despejar el área', async () => {
      prisma.pedidoLinea.findUnique.mockResolvedValue(lineaBd(3, 0));
      prisma.pedido.findUnique.mockResolvedValue({ id: 1n, codigo: 'A-1', estado: 'COLA' });
      prisma.comandaArea.findUnique.mockResolvedValue({ estado: 'EN_COCINA' });

      const res = await service.marcarListas(10n, 1, usuario);

      expect(prisma.pedidoLinea.update).toHaveBeenCalledWith({ where: { id: 10n }, data: { listas: 1, listo_en: null } });
      expect(res).toMatchObject({ listas: 1, cantidad: 3, despejada: false });
    });

    it('al llegar a la cantidad fija listo_en', async () => {
      prisma.pedidoLinea.findUnique.mockResolvedValue(lineaBd(2, 1));
      prisma.pedido.findUnique.mockResolvedValue({ id: 1n, codigo: 'A-1', estado: 'COLA' });
      prisma.comandaArea.findUnique.mockResolvedValue({ estado: 'EN_COCINA' });
      prisma.pedidoLinea.findMany.mockResolvedValue([]);

      await service.marcarListas(10n, 2, usuario);

      const data = prisma.pedidoLinea.update.mock.calls[0][0].data;
      expect(data.listas).toBe(2);
      expect(data.listo_en).toBeInstanceOf(Date);
    });

    it('rechaza unidades fuera de 0..cantidad', async () => {
      prisma.pedidoLinea.findUnique.mockResolvedValue(lineaBd(3, 0));
      prisma.pedido.findUnique.mockResolvedValue({ id: 1n, codigo: 'A-1', estado: 'COLA' });
      prisma.comandaArea.findUnique.mockResolvedValue({ estado: 'EN_COCINA' });

      await expect(service.marcarListas(10n, 4, usuario)).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.marcarListas(10n, -1, usuario)).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.pedidoLinea.update).not.toHaveBeenCalled();
    });

    it('no bajar de lo ya despachado', async () => {
      prisma.pedidoLinea.findUnique.mockResolvedValue(lineaBd(3, 2, 2));
      prisma.pedido.findUnique.mockResolvedValue({ id: 1n, codigo: 'A-1', estado: 'COLA' });
      prisma.comandaArea.findUnique.mockResolvedValue({ estado: 'EN_COCINA' });

      await expect(service.marcarListas(10n, 1, usuario)).rejects.toMatchObject({
        response: { codigo: 'DESPACHADAS_MAYOR' },
      });
    });

    it('línea de un área sin comanda en el pedido (ajena) da 409', async () => {
      prisma.pedidoLinea.findUnique.mockResolvedValue(lineaBd(3, 0));
      prisma.pedido.findUnique.mockResolvedValue({ id: 1n, codigo: 'A-1', estado: 'COLA' });
      prisma.comandaArea.findUnique.mockResolvedValue(null);

      await expect(service.marcarListas(10n, 1, usuario)).rejects.toBeInstanceOf(ConflictException);
    });

    it('completar todas las líneas del área la despeja; el pedido pasa a LISTO si era COLA', async () => {
      prisma.pedidoLinea.findUnique.mockResolvedValue(lineaBd(1, 0));
      prisma.pedido.findUnique.mockResolvedValue({ id: 1n, codigo: 'A-1', estado: 'COLA', pasa_cocina_en: null });
      prisma.comandaArea.findUnique.mockResolvedValue({ estado: 'EN_COCINA' });
      // Tras el update, la única línea del área queda completa
      prisma.pedidoLinea.findMany.mockResolvedValue([linea(10n, 1, 1, 0, 5n)]);
      // La otra área ya despejó: con esta, el pedido completo
      prisma.comandaArea.findMany.mockResolvedValue([
        { pedido_id: 1n, area_id: 5n, estado: 'EN_COCINA' },
        { pedido_id: 1n, area_id: 6n, estado: 'DESPEJADA' },
      ]);

      const res = await service.marcarListas(10n, 1, usuario);

      expect(res.despejada).toBe(true);
      expect(prisma.pedido.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ estado: 'LISTO' }) }),
      );
    });

    describe('deshacer un despeje (15 s, mismo usuario)', () => {
      const area = (despejadaHaceMs: number, despejadaPor: bigint = 100n) => ({
        estado: 'DESPEJADA',
        despejada_en: new Date(Date.now() - despejadaHaceMs),
        despejada_por: despejadaPor,
      });

      it('bajar una unidad dentro de 15 s reabre el área (quita despejada_en) y el pedido LISTO vuelve a COLA', async () => {
        prisma.pedidoLinea.findUnique.mockResolvedValue(lineaBd(1, 1));
        prisma.pedido.findUnique.mockResolvedValue({ id: 1n, codigo: 'A-1', estado: 'LISTO' });
        prisma.comandaArea.findUnique.mockResolvedValue(area(5000));

        const res = await service.marcarListas(10n, 0, usuario);

        expect(prisma.comandaArea.update).toHaveBeenCalledWith({
          where: { pedido_id_area_id: { pedido_id: 1n, area_id: 5n } },
          data: { estado: 'EN_COCINA', despejada_en: null, despejada_por: null },
        });
        expect(prisma.pedido.update).toHaveBeenCalledWith({ where: { id: 1n }, data: { estado: 'COLA' } });
        expect(res).toMatchObject({ reabierta: true, despejada: false, listas: 0 });
      });

      it('si Caja ya cerró el pedido, reabre el área pero no cambia el estado del pedido', async () => {
        prisma.pedidoLinea.findUnique.mockResolvedValue(lineaBd(1, 1));
        prisma.pedido.findUnique.mockResolvedValue({ id: 1n, codigo: 'A-1', estado: 'ENTREGADO' });
        prisma.comandaArea.findUnique.mockResolvedValue(area(5000));

        const res = await service.marcarListas(10n, 0, usuario);

        expect(prisma.comandaArea.update).toHaveBeenCalled();
        expect(prisma.pedido.update).not.toHaveBeenCalled();
        expect(res.reabierta).toBe(true);
      });

      it('pasados 15 s no reabre: la línea baja pero el área sigue despejada', async () => {
        prisma.pedidoLinea.findUnique.mockResolvedValue(lineaBd(1, 1));
        prisma.pedido.findUnique.mockResolvedValue({ id: 1n, codigo: 'A-1', estado: 'LISTO' });
        prisma.comandaArea.findUnique.mockResolvedValue(area(16000));

        const res = await service.marcarListas(10n, 0, usuario);

        expect(prisma.comandaArea.update).not.toHaveBeenCalled();
        expect(prisma.pedido.update).not.toHaveBeenCalled();
        expect(res.reabierta).toBe(false);
      });

      it('otro usuario no reabre el área despejada', async () => {
        prisma.pedidoLinea.findUnique.mockResolvedValue(lineaBd(1, 1));
        prisma.pedido.findUnique.mockResolvedValue({ id: 1n, codigo: 'A-1', estado: 'LISTO' });
        prisma.comandaArea.findUnique.mockResolvedValue(area(5000, 999n));

        const res = await service.marcarListas(10n, 0, usuario);

        expect(prisma.comandaArea.update).not.toHaveBeenCalled();
        expect(res.reabierta).toBe(false);
      });
    });
  });

  describe('despejar', () => {
    it('marca completas las líneas del área', async () => {
      prisma.pedido.findUnique.mockResolvedValue({ id: 1n, codigo: 'A-1', estado: 'PREPARANDO', comandas: [] });
      prisma.comandaArea.findUnique.mockResolvedValue({ estado: 'EN_COCINA' });
      prisma.pedidoLinea.findMany.mockResolvedValue([linea(10n, 3, 1, 0), linea(11n, 1, 0, 0, 6n)]);
      prisma.comandaArea.findMany.mockResolvedValue([{ area_id: 5n, estado: 'DESPEJADA' }]);

      await service.despejar(1n, 5n, usuario);

      expect(prisma.pedidoLinea.update).toHaveBeenCalledTimes(1);
      expect(prisma.pedidoLinea.update).toHaveBeenCalledWith({
        where: { id: 10n },
        data: expect.objectContaining({ listas: 3, listo_en: expect.any(Date) }),
      });
    });

    it('pedido ya ENTREGADO por Caja: despejar no cambia el estado, no repite historial ni avisos', async () => {
      prisma.pedido.findUnique.mockResolvedValue({ id: 1n, codigo: 'A-1', estado: 'ENTREGADO', comandas: [] });
      prisma.comandaArea.findUnique.mockResolvedValue({ estado: 'EN_COCINA' });
      prisma.comandaArea.findMany.mockResolvedValue([{ area_id: 5n, estado: 'DESPEJADA' }]);

      const res = await service.despejar(1n, 5n, usuario);

      expect(res.ok).toBe(true);
      expect(prisma.pedido.update).not.toHaveBeenCalled();
      expect(prisma.pedidoEstadoHistorial.create).not.toHaveBeenCalled();
      expect(salon.avisarListo).not.toHaveBeenCalled();
    });
  });

  describe('despachar', () => {
    const pedidoBd = (over: Record<string, unknown> = {}) => ({
      id: 1n,
      codigo: 'A-1',
      estado: 'COLA',
      modalidad: 'MESA',
      pasa_cocina_en: null,
      entregado_mesa_en: null,
      lineas: [],
      ...over,
    });

    it('sin líneas despacha solo lo listo y pendiente de salir', async () => {
      prisma.pedido.findUnique.mockResolvedValue(
        pedidoBd({
          estado: 'PREPARANDO',
          lineas: [linea(10n, 3, 2, 0), linea(11n, 1, 0, 0)],
        }),
      );

      const res = await service.despachar(1n, undefined, usuario);

      expect(prisma.pedidoLinea.update).toHaveBeenCalledTimes(1);
      expect(prisma.pedidoLinea.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 10n }, data: expect.objectContaining({ despachadas: 2 }) }),
      );
      expect(res.despachadas).toEqual([{ lineaId: '10', unidades: 2 }]);
      expect(res.completo).toBe(false);
    });

    it('delivery rechaza despachar (400)', async () => {
      prisma.pedido.findUnique.mockResolvedValue(pedidoBd({ modalidad: 'DELIVERY', lineas: [linea(10n, 1, 1, 0)] }));

      await expect(service.despachar(1n, undefined, usuario)).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.pedidoLinea.update).not.toHaveBeenCalled();
    });

    it('no deja despachar más de lo listo (409)', async () => {
      prisma.pedido.findUnique.mockResolvedValue(pedidoBd({ lineas: [linea(10n, 3, 1, 0)] }));

      await expect(
        service.despachar(1n, [{ lineaId: 10, unidades: 2 }], usuario),
      ).rejects.toMatchObject({ response: { codigo: 'SIN_LISTAS_SUFICIENTES' } });
    });

    it('mesa con todo despachado: el pedido queda LISTO y entregado en mesa', async () => {
      prisma.pedido.findUnique.mockResolvedValue(pedidoBd({ estado: 'COLA', lineas: [linea(10n, 1, 1, 0)] }));

      const res = await service.despachar(1n, [{ lineaId: 10, unidades: 1 }], usuario);

      expect(res.completo).toBe(true);
      expect(prisma.pedido.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ estado: 'LISTO' }) }),
      );
      expect(salon.marcarEntregadoMesa).toHaveBeenCalledWith(1n, usuario, undefined);
    });

    it('para llevar con todo despachado: pasa a ENTREGADO con historial, sin marcar mesa', async () => {
      prisma.pedido.findUnique.mockResolvedValue(
        pedidoBd({ estado: 'LISTO', modalidad: 'RECOGER', lineas: [linea(10n, 2, 2, 0)] }),
      );

      await service.despachar(1n, undefined, usuario);

      expect(prisma.pedido.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ estado: 'ENTREGADO' }) }),
      );
      expect(prisma.pedidoEstadoHistorial.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ estado_nuevo: 'ENTREGADO' }) }),
      );
      expect(salon.marcarEntregadoMesa).not.toHaveBeenCalled();
    });

    it('pedido ya ENTREGADO por Caja: solo registra el despacho', async () => {
      prisma.pedido.findUnique.mockResolvedValue(
        pedidoBd({ estado: 'ENTREGADO', modalidad: 'LLEVAR', lineas: [linea(10n, 1, 1, 0)] }),
      );

      const res = await service.despachar(1n, undefined, usuario);

      expect(res.estado).toBe('ENTREGADO');
      expect(prisma.pedido.update).not.toHaveBeenCalled();
      expect(prisma.pedidoEstadoHistorial.create).not.toHaveBeenCalled();
      expect(prisma.pedidoLinea.update).toHaveBeenCalledTimes(1);
    });

    it('anulado no se despacha (409)', async () => {
      prisma.pedido.findUnique.mockResolvedValue(pedidoBd({ estado: 'ANULADO', lineas: [linea(10n, 1, 1, 0)] }));

      await expect(service.despachar(1n, undefined, usuario)).rejects.toBeInstanceOf(ConflictException);
    });
  });

  it('la visibilidad en cocina depende de la comanda, no del estado del pedido (solo fuera anulado/rechazado)', async () => {
    prisma.areaCocina = { findFirst: jest.fn().mockResolvedValue({ id: 5n, nombre: 'Salados', activo: true }) };
    prisma.comandaArea.findMany.mockResolvedValue([]);
    await service.listarComandas('5', false);
    const where = prisma.comandaArea.findMany.mock.calls[0][0].where;
    expect(where.pedido.estado).toEqual({ notIn: ['ANULADO', 'RECHAZADO'] });
  });

  it('el permiso cocina/despachar va a COCINA, MOZO y SUPERVISOR (ADMIN lo tiene todo)', () => {
    for (const rol of ['COCINA', 'MOZO', 'SUPERVISOR', 'ADMIN']) {
      expect(MATRIZ[rol]).toContain('cocina/despachar');
    }
  });
});
