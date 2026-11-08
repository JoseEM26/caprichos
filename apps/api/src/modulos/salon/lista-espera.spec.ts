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

  describe('crear en espera: pago y comprobante igual que un pedido de mesa', () => {
    const crearConPago = async (extra: any) => {
      pedidos.crear.mockImplementation(async (_dto: any, _k: any, origen: any) => {
        await origen.enTransaccion(prisma, { id: 6n });
        return { id: 6n, codigo: 'CP-M006' };
      });
      await service.abrirPedido({ ...base, cliente: { nombre: 'Lucía', telefono: '978456123' }, canal: 'CAJA', ...extra }, caja);
      return pedidos.crear.mock.calls[0][0];
    };
    it.each([
      ['efectivo', { pago: { metodo: 'EFECTIVO' } }],
      ['yape', { pago: { metodo: 'YAPE' } }],
      ['pago dividido', { pago: { metodo: 'EFECTIVO', plan: [{ metodo: 'EFECTIVO', monto: 5 }, { metodo: 'YAPE', monto: 9.5 }] } }],
      ['boleta con DNI opcional vacío', { comprobante: { tipo: 'BOLETA' } }],
      ['factura', { comprobante: { tipo: 'FACTURA', numeroDocumento: '20123456789', razonSocial: 'ACME SAC' } }],
    ])('%s: no se rechaza y viaja tal cual a pedidos.crear sin mesa', async (_n, extra) => {
      const dto = await crearConPago(extra);
      expect(dto.mesa).toBe('En espera de mesa');
      if ((extra as any).pago) expect(dto.pago).toEqual((extra as any).pago);
      if ((extra as any).comprobante) expect(dto.comprobante).toEqual((extra as any).comprobante);
      expect(prisma.pedidoMesa.create).not.toHaveBeenCalled();
      expect(prisma.pedido.update.mock.calls[0][0].data.espera_mesa_desde).toBeInstanceOf(Date);
    });
    it('con cuenta de cliente (sin nombre escrito) sale de la cuenta y manda el celular', async () => {
      pedidos.crear.mockImplementation(async (_d: any, _k: any, o: any) => { await o.enTransaccion(prisma, { id: 7n }); return { id: 7n }; });
      await service.abrirPedido({ ...base, cliente: { nombre: 'Cuenta', telefono: '978456123' }, clientePartyId: '55' }, caja);
      expect(pedidos.crear.mock.calls[0][0]).toMatchObject({ clientePartyId: '55', cliente: { telefono: '978456123' } });
    });
  });

  describe('listarEspera', () => {
    const fila = (id: bigint, min: number, tel = '987654321') => ({
      id, codigo: `CP-${id}`, estado: 'COLA', cliente_nombre: `C${id}`, cliente_telefono: tel,
      espera_mesa_desde: new Date(Date.now() - min * 60000), creado_en: new Date(), espera_desplazado_de: null, espera_personas: 2, total: 30, lineas: [{ cantidad: 2 }, { cantidad: 1 }],
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

  describe('asignar a mesa ocupada (forzarOcupada)', () => {
    const pedido = { id: 5n, codigo: 'CP-M005', estado: 'COLA', espera_mesa_desde: new Date(), cliente_nombre: 'Rosa' };
    const mesa = { id: 9n, tipo: 'MESA', activo: true, numero: 4, nombre: null };
    const ocupante = { id: 77n, pedido_id: 3n, pedido: { id: 3n, codigo: 'CP-M003', estado: 'PREPARANDO', pago_estado: 'PENDIENTE', cliente_nombre: 'Luis' } };
    beforeEach(() => {
      prisma.pedido.findUnique.mockResolvedValue(pedido);
      prisma.elementoPlano.findUnique.mockResolvedValue(mesa);
      prisma.pedidoMesa.findFirst.mockResolvedValue(ocupante);
    });
    it('sin forzarOcupada da 409 MESA_OCUPADA y no toca nada', async () => {
      await expect(service.asignarEspera('5', '9', caja)).rejects.toMatchObject({ response: { codigo: 'MESA_OCUPADA' } });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
    it('con forzarOcupada: desplazado a espera (una transacción), entrante ocupa, audita y emite', async () => {
      const r: any = await service.asignarEspera('5', '9', caja, undefined, true);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.pedidoMesa.updateMany).toHaveBeenCalledWith({ where: { id: 77n, abierta: true }, data: { abierta: false } });
      const upd = prisma.pedido.update.mock.calls[0][0];
      expect(upd.where).toEqual({ id: 3n });
      expect(upd.data).toMatchObject({ mesa_nombre: 'En espera de mesa', espera_desplazado_de: 'Mesa 4' });
      expect(upd.data.espera_mesa_desde).toBeInstanceOf(Date);
      expect(upd.data.estado).toBeUndefined(); // líneas, estado y pagos intactos
      expect(prisma.pedidoMesa.create.mock.calls[0][0].data).toMatchObject({ pedido_id: 5n, mesa_id: 9n, abierta: true });
      expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'DESPLAZAR_A_ESPERA', entidadId: 3n }));
      expect(eventos.emitirAdmin).toHaveBeenCalledWith('salon:espera', { pedidoId: '3', accion: 'ENTRA' });
      expect(r.desplazado).toMatchObject({ codigo: 'CP-M003', aListaEspera: true });
    });
    it('pedido desplazado con varias mesas conserva las otras y no entra a la lista', async () => {
      prisma.pedidoMesa.count.mockResolvedValue(1);
      prisma.pedidoMesa.findMany.mockResolvedValue([]);
      const r: any = await service.asignarEspera('5', '9', caja, undefined, true);
      expect(r.desplazado.aListaEspera).toBe(false);
      expect(prisma.pedido.update.mock.calls[0][0].data.espera_mesa_desde).toBeUndefined();
      expect(eventos.emitirAdmin).not.toHaveBeenCalledWith('salon:espera', { pedidoId: '3', accion: 'ENTRA' });
    });
    it('desplazado cobrado, finalizado o con cobro vigente da 409 PEDIDO_NO_MOVIBLE', async () => {
      prisma.pedidoMesa.findFirst.mockResolvedValue({ ...ocupante, pedido: { ...ocupante.pedido, estado: 'FINALIZADO' } });
      await expect(service.asignarEspera('5', '9', caja, undefined, true)).rejects.toMatchObject({ response: { codigo: 'PEDIDO_NO_MOVIBLE' } });
      prisma.pedidoMesa.findFirst.mockResolvedValue({ ...ocupante, pedido: { ...ocupante.pedido, pago_estado: 'PAGADO' } });
      await expect(service.asignarEspera('5', '9', caja, undefined, true)).rejects.toMatchObject({ response: { codigo: 'PEDIDO_NO_MOVIBLE' } });
      prisma.pedidoMesa.findFirst.mockResolvedValue(ocupante);
      prisma.cobro.findFirst.mockResolvedValue({ id: 1n });
      await expect(service.asignarEspera('5', '9', caja, undefined, true)).rejects.toMatchObject({ response: { codigo: 'PEDIDO_NO_MOVIBLE' } });
    });
    it('sin permiso de liberar mesas da 403; ADMIN pasa sin consultar', async () => {
      prisma.rolPermiso.findFirst.mockResolvedValue(null);
      await expect(service.asignarEspera('5', '9', mozo, undefined, true)).rejects.toMatchObject({ response: { codigo: 'SIN_PERMISO' } });
      await service.asignarEspera('5', '9', { partyId: '1', rol: 'ADMIN', roles: ['ADMIN'] } as any, undefined, true);
      expect(prisma.rolPermiso.findFirst).toHaveBeenCalledTimes(1);
    });
    it('concurrencia: la fila se cerró antes (updateMany 0) o el entrante ya fue tomado da 409', async () => {
      prisma.pedidoMesa.updateMany.mockResolvedValue({ count: 0 });
      await expect(service.asignarEspera('5', '9', caja, undefined, true)).rejects.toMatchObject({ response: { codigo: 'MESA_OCUPADA' } });
      prisma.pedidoMesa.updateMany.mockResolvedValue({ count: 1 });
      prisma.pedido.updateMany.mockResolvedValue({ count: 0 });
      await expect(service.asignarEspera('5', '9', caja, undefined, true)).rejects.toMatchObject({ response: { codigo: 'PEDIDO_NO_EN_ESPERA' } });
    });
  });

  describe('orden de la lista', () => {
    it('desplazados primero (por hora de desplazamiento), luego los demás FIFO', async () => {
      const f = (id: bigint, min: number, dep: string | null) => ({
        id, codigo: `C${id}`, estado: 'COLA', cliente_nombre: 'X', cliente_telefono: '987654321', espera_desplazado_de: dep,
        creado_en: new Date(), espera_mesa_desde: new Date(Date.now() - min * 60000), espera_personas: null, total: 1, lineas: [],
      });
      prisma.pedido.findMany.mockResolvedValue([f(1n, 30, null), f(2n, 5, 'Mesa 2'), f(3n, 8, 'Mesa 7'), f(4n, 10, null)]);
      const r: any = await service.listarEspera(caja);
      expect(r.items.map((i: any) => i.pedidoId)).toEqual(['3', '2', '1', '4']);
      expect(r.items[0].movidoDesde).toBe('Mesa 7');
      expect(r.items[2].movidoDesde).toBeNull();
    });
  });

  it('etiquetas y tickets muestran «En espera de mesa»', () => {
    const p = { mesa_nombre: 'En espera de mesa', modalidad: 'MESA' };
    expect(obtenerModalidadPill(p)).toBe('EN ESPERA DE MESA');
    expect(obtenerNombreCliente(p)).toBe('EN ESPERA DE MESA');
  });
});
