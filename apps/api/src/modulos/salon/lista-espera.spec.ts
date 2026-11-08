jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
jest.mock('../reservas/reservas.service', () => ({ ReservasService: class {} }));

import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { SalonService } from './salon.service';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { PedidosService } from '../pedidos/pedidos.service';
import { ImpresionService } from '../impresion/impresion.service';
import { obtenerModalidadPill, obtenerNombreCliente } from '../impresion/constructor-etiquetas';

describe('Lista de espera de mesa', () => {
  let service: SalonService;
  let prisma: any;
  let pedidos: any;
  let auditoria: any;
  let eventos: any;
  const mozo: any = { partyId: '7', rol: 'MOZO', roles: ['MOZO'] };
  const caja: any = { partyId: '8', rol: 'CAJERO', roles: ['CAJERO'] };
  const base = { enEsperaMesa: true, lineas: [{ productoId: 1, cantidad: 1 }] } as any;

  beforeEach(async () => {
    prisma = {
      elementoPlano: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn() },
      pedidoMesa: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
      reservaMesa: { findMany: jest.fn().mockResolvedValue([]) },
      pedido: { findMany: jest.fn(), findUnique: jest.fn(), updateMany: jest.fn().mockResolvedValue({ count: 1 }), update: jest.fn() },
      $transaction: jest.fn().mockImplementation((cb) => cb(prisma)),
    };
    pedidos = { crear: jest.fn() };
    auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
    eventos = { emitirAdmin: jest.fn() };
    const m = await Test.createTestingModule({
      providers: [
        SalonService,
        { provide: PrismaService, useValue: prisma },
        { provide: PedidosService, useValue: pedidos },
        { provide: AuditoriaService, useValue: auditoria },
        { provide: EventosGateway, useValue: eventos },
        { provide: ImpresionService, useValue: { encolarEtiquetasPedido: jest.fn().mockResolvedValue(undefined) } },
      ],
    }).compile();
    service = m.get(SalonService);
  });

  describe('crear en espera (abrirPedido)', () => {
    it('sin nombre da 400', async () => {
      await expect(service.abrirPedido({ ...base, cliente: { telefono: '987654321' } }, mozo)).rejects.toBeInstanceOf(BadRequestException);
    });
    it('sin celular válido da 400', async () => {
      await expect(service.abrirPedido({ ...base, cliente: { nombre: 'Miguel' } }, mozo)).rejects.toMatchObject({ response: { codigo: 'TELEFONO_REQUERIDO' } });
      await expect(service.abrirPedido({ ...base, cliente: { nombre: 'Miguel', telefono: '12345' } }, mozo)).rejects.toBeInstanceOf(BadRequestException);
    });
    it('con nombre y celular crea sin mesa, marca la espera y avisa', async () => {
      pedidos.crear.mockImplementation(async (_dto: any, _k: any, origen: any) => {
        await origen.enTransaccion(prisma, { id: 5n });
        return { id: 5n, codigo: 'CP-M005' };
      });
      const r: any = await service.abrirPedido({ ...base, personas: 3, cliente: { nombre: 'Miguel', telefono: '987654321' } }, mozo);
      expect(pedidos.crear.mock.calls[0][0].mesa).toBe('En espera de mesa');
      expect(pedidos.crear.mock.calls[0][2].mesasIds).toEqual([]);
      expect(prisma.pedido.update.mock.calls[0][0].data).toMatchObject({ espera_personas: 3 });
      expect(prisma.pedido.update.mock.calls[0][0].data.espera_mesa_desde).toBeInstanceOf(Date);
      expect(prisma.pedidoMesa.create).not.toHaveBeenCalled();
      expect(r.enEsperaMesa).toBe(true);
      expect(eventos.emitirAdmin).toHaveBeenCalledWith('salon:espera', expect.objectContaining({ accion: 'ENTRA' }));
    });
  });

  describe('listarEspera', () => {
    const fila = (id: bigint, min: number, tel = '987654321') => ({
      id, codigo: `CP-${id}`, estado: 'COLA', cliente_nombre: `C${id}`, cliente_telefono: tel,
      espera_mesa_desde: new Date(Date.now() - min * 60000), espera_personas: 2, total: 30, lineas: [{ cantidad: 2 }, { cantidad: 1 }],
    });
    it('devuelve FIFO, minutos, productos y contador; celular completo solo Caja/Admin', async () => {
      prisma.pedido.findMany.mockResolvedValue([fila(1n, 12), fila(2n, 3)]);
      const c: any = await service.listarEspera(caja);
      expect(prisma.pedido.findMany.mock.calls[0][0].orderBy[0]).toEqual({ espera_mesa_desde: 'asc' });
      expect(c.total).toBe(2);
      expect(c.items[0]).toMatchObject({ pedidoId: '1', minutos: 12, productos: 3, celular: '987654321' });
      const m: any = await service.listarEspera(mozo);
      expect(m.items[0].celular).toBe('******321');
    });
  });

  describe('asignarEspera', () => {
    const pedido = { id: 5n, codigo: 'CP-M005', estado: 'COLA', espera_mesa_desde: new Date() };
    const mesa = { id: 9n, tipo: 'MESA', activo: true, numero: 4, nombre: null };
    it('asigna a mesa libre: ocupa la mesa, limpia la espera, audita y emite', async () => {
      prisma.pedido.findUnique.mockResolvedValue(pedido);
      prisma.elementoPlano.findUnique.mockResolvedValue(mesa);
      const r = await service.asignarEspera('5', '9', mozo);
      expect(prisma.pedido.updateMany.mock.calls[0][0].data).toMatchObject({ espera_mesa_desde: null, mesa_nombre: 'Mesa 4' });
      expect(prisma.pedidoMesa.create.mock.calls[0][0].data).toMatchObject({ pedido_id: 5n, mesa_id: 9n, abierta: true, principal: true });
      expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'ASIGNAR_MESA_ESPERA', entidadId: 5n }));
      expect(eventos.emitirAdmin).toHaveBeenCalledWith('salon:mesa', { mesaId: '9', estado: 'OCUPADA' });
      expect(eventos.emitirAdmin).toHaveBeenCalledWith('salon:espera', expect.objectContaining({ accion: 'SALE' }));
      expect(r.mesa).toBe('Mesa 4');
    });
    it('mesa ocupada da 409', async () => {
      prisma.pedido.findUnique.mockResolvedValue(pedido);
      prisma.elementoPlano.findUnique.mockResolvedValue(mesa);
      prisma.pedidoMesa.findFirst.mockResolvedValue({ id: 1n });
      await expect(service.asignarEspera('5', '9', mozo)).rejects.toBeInstanceOf(ConflictException);
    });
    it('pedido ya asignado o anulado da 409', async () => {
      prisma.elementoPlano.findUnique.mockResolvedValue(mesa);
      prisma.pedido.findUnique.mockResolvedValue({ ...pedido, espera_mesa_desde: null });
      await expect(service.asignarEspera('5', '9', mozo)).rejects.toMatchObject({ response: { codigo: 'PEDIDO_NO_EN_ESPERA' } });
      prisma.pedido.findUnique.mockResolvedValue({ ...pedido, estado: 'ANULADO' });
      await expect(service.asignarEspera('5', '9', mozo)).rejects.toBeInstanceOf(ConflictException);
    });
    it('carrera: otro la asignó antes (updateMany 0) da 409', async () => {
      prisma.pedido.findUnique.mockResolvedValue(pedido);
      prisma.elementoPlano.findUnique.mockResolvedValue(mesa);
      prisma.pedido.updateMany.mockResolvedValue({ count: 0 });
      await expect(service.asignarEspera('5', '9', mozo)).rejects.toBeInstanceOf(ConflictException);
    });
  });

  it('etiquetas y tickets muestran «En espera de mesa»', () => {
    const p = { mesa_nombre: 'En espera de mesa', modalidad: 'MESA' };
    expect(obtenerModalidadPill(p)).toBe('EN ESPERA DE MESA');
    expect(obtenerNombreCliente(p)).toBe('EN ESPERA DE MESA');
  });
});
