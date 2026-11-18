jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
jest.mock('../reservas/reservas.service', () => ({ ReservasService: class {} }));

import { Test } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { SalonService } from './salon.service';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { PedidosService } from '../pedidos/pedidos.service';
import { ImpresionService } from '../impresion/impresion.service';

// «Comer en el local» de la carta sin mesa aparece en la lista de espera del mozo.
describe('Comer en el local de la carta en la lista de espera', () => {
  let service: SalonService;
  let prisma: any;
  let auditoria: any;
  const mozo: any = { partyId: '7', rol: 'MOZO', roles: ['MOZO'] };
  const hace = (min: number) => new Date(Date.now() - min * 60000);

  beforeEach(async () => {
    prisma = {
      elementoPlano: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn().mockResolvedValue({ id: 9n, tipo: 'MESA', activo: true, numero: 4, nombre: null }) },
      pedidoMesa: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null), create: jest.fn(), updateMany: jest.fn().mockResolvedValue({ count: 1 }), count: jest.fn().mockResolvedValue(0), update: jest.fn() },
      pedidoLinea: { count: jest.fn().mockResolvedValue(1) },
      cobro: { findFirst: jest.fn().mockResolvedValue(null) },
      rolPermiso: { findFirst: jest.fn().mockResolvedValue({ id: 1 }) },
      reservaMesa: { findMany: jest.fn().mockResolvedValue([]) },
      pedido: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn(), updateMany: jest.fn().mockResolvedValue({ count: 1 }), update: jest.fn() },
      $transaction: jest.fn().mockImplementation((cb) => cb(prisma)),
    };
    auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
    const m = await Test.createTestingModule({
      providers: [
        SalonService,
        { provide: PrismaService, useValue: prisma },
        { provide: PedidosService, useValue: { crear: jest.fn() } },
        { provide: AuditoriaService, useValue: auditoria },
        { provide: EventosGateway, useValue: { emitirAdmin: jest.fn() } },
        { provide: ImpresionService, useValue: { encolarEtiquetasPedido: jest.fn() } },
      ],
    }).compile();
    service = m.get(SalonService);
  });

  const carta = (id: bigint, codigo: string, min: number, lineas: any[]) => ({
    id, codigo, estado: 'COLA', cliente_nombre: 'Rosa', cliente_telefono: '987654321', creado_en: hace(min), total: 20, lineas,
  });
  const porModalidad = (mesa: any[], comer: any[]) =>
    prisma.pedido.findMany.mockImplementation(async (a: any) => (a.where.modalidad === 'MESA' ? mesa : comer));

  it('lista el pedido de la carta con su resumen «para llevar · aquí» y no exige mesa si hay una unidad aquí', async () => {
    porModalidad([], [carta(5n, 'CP-W005', 5, [
      { nombre: 'Donut', cantidad: 1, para_llevar: true },
      { nombre: 'Café', cantidad: 1, para_llevar: false },
    ])]);
    const r: any = await service.listarEspera(mozo);
    expect(r.total).toBe(1);
    expect(r.items[0]).toMatchObject({
      pedidoId: '5', codigo: 'CP-W005', origen: 'CARTA_COMER_LOCAL', nombre: 'Rosa', paraLlevar: 1, aqui: 1, productos: 2, minutos: 5, celular: '******321',
    });
    expect(r.items[0].lineas).toEqual([
      { nombre: 'Donut', cantidad: 1, paraLlevar: true },
      { nombre: 'Café', cantidad: 1, paraLlevar: false },
    ]);
  });

  it('consulta solo COMER_LOCAL de la carta, de hoy, vivos y con alguna unidad aquí', async () => {
    porModalidad([], []);
    await service.listarEspera(mozo);
    const where = prisma.pedido.findMany.mock.calls.find((c: any) => c[0].where.modalidad === 'COMER_LOCAL')[0].where;
    expect(where).toMatchObject({ modalidad: 'COMER_LOCAL', canal: 'CARTA', estado: { in: ['COLA', 'PREPARANDO', 'LISTO'] }, lineas: { some: { para_llevar: false } } });
    expect(where.creado_en.gte).toBeInstanceOf(Date);
  });

  it('todo para llevar no aparece aunque la consulta lo traiga', async () => {
    porModalidad([], [carta(6n, 'CP-W006', 2, [{ nombre: 'Donut', cantidad: 2, para_llevar: true }])]);
    const r: any = await service.listarEspera(mozo);
    expect(r.items).toEqual([]);
  });

  it('mezcla con la lista de mesa en orden de llegada (el más antiguo primero)', async () => {
    const mesaFila = { id: 4n, codigo: 'CP-M4', estado: 'COLA', cliente_nombre: 'Ana', cliente_telefono: null, espera_desplazado_de: null, creado_en: hace(12), espera_mesa_desde: hace(10), espera_personas: 2, total: 10, lineas: [] };
    porModalidad([mesaFila], [carta(5n, 'CP-W005', 3, [{ nombre: 'Café', cantidad: 1, para_llevar: false }])]);
    const r: any = await service.listarEspera(mozo);
    expect(r.items.map((i: any) => [i.codigo, i.origen])).toEqual([
      ['CP-M4', 'MESA'],
      ['CP-W005', 'CARTA_COMER_LOCAL'],
    ]);
  });

  it('el mozo asigna mesa al pedido de la carta: pasa a MESA conservando el canal y ocupa la mesa', async () => {
    prisma.pedido.findUnique.mockResolvedValue({ id: 5n, codigo: 'CP-W005', modalidad: 'COMER_LOCAL', canal: 'CARTA', estado: 'COLA', pago_estado: 'PENDIENTE', espera_mesa_desde: null, cliente_nombre: 'Rosa' });
    const r: any = await service.asignarEspera('5', '9', mozo, undefined, false, true);
    expect(r).toMatchObject({ ok: true, codigo: 'CP-W005', mesa: 'Mesa 4' });
    expect(prisma.pedido.updateMany.mock.calls[0][0]).toMatchObject({ where: { id: 5n, modalidad: 'COMER_LOCAL' }, data: { modalidad: 'MESA' } });
    expect(prisma.pedidoMesa.create).toHaveBeenCalled();
    expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'ASIGNAR_MESA_COMER_LOCAL' }));
  });

  it('un pedido todo para llevar no se sienta: 409 SOLO_PARA_LLEVAR y no cambia nada', async () => {
    prisma.pedido.findUnique.mockResolvedValue({ id: 6n, codigo: 'CP-W006', modalidad: 'COMER_LOCAL', canal: 'CARTA', estado: 'COLA', pago_estado: 'PENDIENTE', espera_mesa_desde: null });
    prisma.pedidoLinea.count.mockResolvedValue(0);
    await expect(service.asignarEspera('6', '9', mozo, undefined, false, true)).rejects.toMatchObject({ response: { codigo: 'SOLO_PARA_LLEVAR' } });
    expect(prisma.pedido.updateMany).not.toHaveBeenCalled();
    expect(prisma.pedidoMesa.create).not.toHaveBeenCalled();
  });

  it('un pedido ya pagado (en línea) aparece en la lista y el filtro no mira el pago ni los cobros', async () => {
    porModalidad([], [{ ...carta(7n, 'CP-W007', 4, [{ nombre: 'Torta', cantidad: 1, para_llevar: false }]), pago_estado: 'PAGADO' }]);
    const r: any = await service.listarEspera(mozo);
    expect(r.items.map((i: any) => i.codigo)).toEqual(['CP-W007']);
    const where = prisma.pedido.findMany.mock.calls.find((c: any) => c[0].where.modalidad === 'COMER_LOCAL')[0].where;
    expect(where).not.toHaveProperty('cobros');
    expect(where).not.toHaveProperty('OR');
  });

  it('asignar mesa a un pedido pagado conserva su cobro y su pago_estado', async () => {
    prisma.pedido.findUnique.mockResolvedValue({ id: 8n, codigo: 'CP-W008', modalidad: 'COMER_LOCAL', canal: 'CARTA', estado: 'COLA', pago_estado: 'PAGADO', espera_mesa_desde: null, cliente_nombre: 'Rosa' });
    prisma.cobro.findFirst.mockResolvedValue({ id: 3n });
    await service.asignarEspera('8', '9', mozo, undefined, false, true);
    const data = prisma.pedido.updateMany.mock.calls[0][0].data;
    expect(data).not.toHaveProperty('pago_estado');
    expect(prisma.cobro.findFirst).not.toHaveBeenCalled();
    expect(prisma.cobro.update).toBeUndefined();
  });

  it('un pedido ya sentado no se asigna otra vez', async () => {
    prisma.pedido.findUnique.mockResolvedValue({ id: 5n, codigo: 'CP-W005', modalidad: 'MESA', canal: 'CARTA', estado: 'COLA', pago_estado: 'PENDIENTE', espera_mesa_desde: null });
    await expect(service.asignarEspera('5', '9', mozo, undefined, false, true)).rejects.toBeInstanceOf(ConflictException);
  });
});
