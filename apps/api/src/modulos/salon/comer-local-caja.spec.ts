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
import { obtenerModalidadPill, obtenerNombreCliente } from '../impresion/constructor-etiquetas';

describe('Comer en el local: Caja asigna mesa o manda a la lista', () => {
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
      pedidoMesa: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null), create: jest.fn(), updateMany: jest.fn().mockResolvedValue({ count: 1 }), count: jest.fn().mockResolvedValue(0), update: jest.fn() },
      cobro: { findFirst: jest.fn().mockResolvedValue(null) },
      rolPermiso: { findFirst: jest.fn().mockResolvedValue({ id: 1 }) },
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

  const pedido = { id: 5n, codigo: 'CP-5', modalidad: 'COMER_LOCAL', estado: 'COLA', pago_estado: 'PENDIENTE', espera_mesa_desde: null, cliente_nombre: 'Rosa' };
  const mesa = { id: 9n, tipo: 'MESA', activo: true, numero: 4, nombre: null };
  beforeEach(() => {
    prisma.pedido.findUnique.mockResolvedValue(pedido);
    prisma.elementoPlano.findUnique.mockResolvedValue(mesa);
  });

  describe('asignar mesa', () => {
    it('mesa libre: convierte a MESA, ocupa la mesa, audita y emite', async () => {
      const r = await service.asignarEspera('5', '9', caja, undefined, false, true);
      expect(prisma.pedido.updateMany.mock.calls[0][0]).toMatchObject({ where: { id: 5n, modalidad: 'COMER_LOCAL' }, data: { modalidad: 'MESA' } });
      expect(prisma.pedido.updateMany.mock.calls[1][0].data).toMatchObject({ espera_mesa_desde: null, mesa_nombre: 'Mesa 4' });
      expect(prisma.pedidoMesa.create.mock.calls[0][0].data).toMatchObject({ pedido_id: 5n, mesa_id: 9n, abierta: true });
      expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'ASIGNAR_MESA_COMER_LOCAL', antes: expect.objectContaining({ origen: 'AUTOGESTION_CARTA' }) }));
      expect(eventos.emitirAdmin).toHaveBeenCalledWith('salon:mesa', { mesaId: '9', estado: 'OCUPADA' });
      expect(eventos.emitirAdmin).toHaveBeenCalledWith('cocina:comanda', expect.anything());
      expect(r.mesa).toBe('Mesa 4');
    });
    it('mesa ocupada sin forzar: 409 MESA_OCUPADA y no abre transacción', async () => {
      prisma.pedidoMesa.findFirst.mockResolvedValue({ id: 1n });
      await expect(service.asignarEspera('5', '9', caja, undefined, false, true)).rejects.toMatchObject({ response: { codigo: 'MESA_OCUPADA' } });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
    it('mesa ocupada con forzar: desplaza al otro pedido a la lista de espera', async () => {
      const ocupante = { id: 77n, pedido: { id: 3n, codigo: 'CP-3', estado: 'PREPARANDO', pago_estado: 'PENDIENTE', cliente_nombre: 'Luis' } };
      prisma.pedidoMesa.findFirst.mockResolvedValue(ocupante);
      const r: any = await service.asignarEspera('5', '9', caja, undefined, true, true);
      expect(prisma.pedido.update.mock.calls[0][0].data).toMatchObject({ mesa_nombre: 'En espera de mesa', espera_desplazado_de: 'Mesa 4' });
      expect(r.desplazado).toMatchObject({ codigo: 'CP-3', aListaEspera: true });
    });
    it('pedido que no es COMER_LOCAL: 409 PEDIDO_NO_COMER_LOCAL', async () => {
      prisma.pedido.findUnique.mockResolvedValue({ ...pedido, modalidad: 'MESA' });
      await expect(service.asignarEspera('5', '9', caja, undefined, false, true)).rejects.toMatchObject({ response: { codigo: 'PEDIDO_NO_COMER_LOCAL' } });
    });
    it.each(['ANULADO', 'ENTREGADO', 'FINALIZADO'])('estado %s: 409 PEDIDO_NO_MOVIBLE', async (estado) => {
      prisma.pedido.findUnique.mockResolvedValue({ ...pedido, estado });
      await expect(service.asignarEspera('5', '9', caja, undefined, false, true)).rejects.toMatchObject({ response: { codigo: 'PEDIDO_NO_MOVIBLE' } });
    });
    it('cobrado (PAGADO o cobro vigente): 409 PEDIDO_NO_MOVIBLE', async () => {
      prisma.pedido.findUnique.mockResolvedValue({ ...pedido, pago_estado: 'PAGADO' });
      await expect(service.asignarEspera('5', '9', caja, undefined, false, true)).rejects.toMatchObject({ response: { codigo: 'PEDIDO_NO_MOVIBLE' } });
      prisma.pedido.findUnique.mockResolvedValue(pedido);
      prisma.cobro.findFirst.mockResolvedValue({ id: 1n });
      await expect(service.asignarEspera('5', '9', caja, undefined, false, true)).rejects.toMatchObject({ response: { codigo: 'PEDIDO_NO_MOVIBLE' } });
    });
    it('concurrencia: otro cajero lo convirtió antes (updateMany 0): 409 y no ocupa la mesa', async () => {
      prisma.pedido.updateMany.mockResolvedValue({ count: 0 });
      await expect(service.asignarEspera('5', '9', caja, undefined, false, true)).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.pedidoMesa.create).not.toHaveBeenCalled();
    });
    it('forzar ocupada sin permiso de liberar: 403', async () => {
      prisma.pedidoMesa.findFirst.mockResolvedValue({ id: 1n });
      prisma.rolPermiso.findFirst.mockResolvedValue(null);
      await expect(service.asignarEspera('5', '9', mozo, undefined, true, true)).rejects.toMatchObject({ response: { codigo: 'SIN_PERMISO' } });
    });
  });

  describe('mandar a lista de espera', () => {
    it('convierte a MESA en espera con su hora, personas, audita y emite', async () => {
      const r = await service.mandarComerLocalAEspera('5', 3, caja);
      const data = prisma.pedido.updateMany.mock.calls[0][0].data;
      expect(data).toMatchObject({ modalidad: 'MESA', mesa_nombre: 'En espera de mesa', espera_personas: 3 });
      expect(data.espera_mesa_desde).toBeInstanceOf(Date);
      expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'COMER_LOCAL_A_ESPERA' }));
      expect(eventos.emitirAdmin).toHaveBeenCalledWith('salon:espera', { pedidoId: '5', accion: 'ENTRA' });
      expect(r.enEsperaMesa).toBe(true);
    });
    it('sin personas no bloquea', async () => {
      await service.mandarComerLocalAEspera('5', undefined, caja);
      expect(prisma.pedido.updateMany.mock.calls[0][0].data.espera_personas).toBeNull();
    });
    it('no COMER_LOCAL, anulado o entregado: 409', async () => {
      prisma.pedido.findUnique.mockResolvedValue({ ...pedido, modalidad: 'MESA' });
      await expect(service.mandarComerLocalAEspera('5', undefined, caja)).rejects.toMatchObject({ response: { codigo: 'PEDIDO_NO_COMER_LOCAL' } });
      prisma.pedido.findUnique.mockResolvedValue({ ...pedido, estado: 'ANULADO' });
      await expect(service.mandarComerLocalAEspera('5', undefined, caja)).rejects.toMatchObject({ response: { codigo: 'PEDIDO_NO_MOVIBLE' } });
    });
    it('luego se asigna desde la lista con el flujo de siempre', async () => {
      prisma.pedido.findUnique.mockResolvedValue({ ...pedido, modalidad: 'MESA', espera_mesa_desde: new Date() });
      const r = await service.asignarEspera('5', '9', caja);
      expect(r.mesa).toBe('Mesa 4');
      expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'ASIGNAR_MESA_ESPERA' }));
    });
    it('aparece en GET espera (FIFO por hora de entrada)', async () => {
      const t = (min: number) => new Date(Date.now() - min * 60000);
      prisma.pedido.findMany.mockResolvedValue([
        { id: 5n, codigo: 'CP-5', estado: 'COLA', cliente_nombre: 'Rosa', cliente_telefono: '987654321', espera_desplazado_de: null, creado_en: t(9), espera_mesa_desde: t(2), espera_personas: 3, total: 10, lineas: [] },
        { id: 4n, codigo: 'CP-4', estado: 'COLA', cliente_nombre: 'Ana', cliente_telefono: '987654322', espera_desplazado_de: null, creado_en: t(9), espera_mesa_desde: t(8), espera_personas: null, total: 10, lineas: [] },
      ]);
      const r = await service.listarEspera(caja);
      expect(r.items.map((i) => i.codigo)).toEqual(['CP-4', 'CP-5']);
    });
  });
});
