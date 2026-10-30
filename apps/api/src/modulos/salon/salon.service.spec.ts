jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
jest.mock('../reservas/reservas.service', () => ({ ReservasService: class {} }));

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { SalonService } from './salon.service';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { PedidosService } from '../pedidos/pedidos.service';
import { ReservasService } from '../reservas/reservas.service';
import { ImpresionService } from '../impresion/impresion.service';

describe('SalonService', () => {
  let service: SalonService;
  let reservasMock: any;
  let impresionMock: any;
  let prismaMock: any;
  let pedidosServiceMock: any;
  let auditoriaMock: any;
  let eventosGatewayMock: any;

  beforeEach(async () => {
    prismaMock = {
      piso: {
        findMany: jest.fn(),
      },
      elementoPlano: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      pedidoMesa: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      reservaMesa: {
        findMany: jest.fn(),
      },
      pedido: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      person: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation((cb) => cb(prismaMock)),
    };

    pedidosServiceMock = {
      crear: jest.fn(),
    };

    auditoriaMock = {
      registrar: jest.fn().mockResolvedValue(undefined),
    };

    reservasMock = { marcarPedidoDeReserva: jest.fn().mockResolvedValue(undefined) };
    impresionMock = { encolarEtiquetasPedido: jest.fn().mockResolvedValue(undefined) };
    eventosGatewayMock = {
      emitirAdmin: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalonService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: PedidosService, useValue: pedidosServiceMock },
        { provide: AuditoriaService, useValue: auditoriaMock },
        { provide: EventosGateway, useValue: eventosGatewayMock },
        { provide: ReservasService, useValue: reservasMock },
        { provide: ImpresionService, useValue: impresionMock },
      ],
    }).compile();

    service = module.get<SalonService>(SalonService);
  });

  describe('1. Estado derivado con reserva (obtenerMesas)', () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    it('devuelve mesas activas por piso con estado derivado LIBRE u OCUPADA y marca de reserva activa', async () => {
      // 15:00 del 21/10 en Lima; la reserva es a las 19:00 de Lima de ese mismo día
      jest.useFakeTimers().setSystemTime(new Date('2026-10-21T20:00:00.000Z'));
      const horaReservaHoy = new Date('2026-10-22T00:00:00.000Z');

      prismaMock.piso.findMany.mockResolvedValue([
        {
          id: 1n,
          nombre: 'Piso 1',
          activo: true,
          cuadricula_ancho: 20,
          cuadricula_alto: 12,
          elementos: [
            {
              id: 101n,
              piso_id: 1n,
              tipo: 'MESA',
              numero: 1,
              nombre: 'Mesa 1',
              asientos: 4,
              x: 1,
              y: 1,
              ancho: 2,
              alto: 2,
              activo: true,
              pedidosMesa: [
                {
                  id: 501n,
                  abierta: true,
                  pedido: {
                    id: 1001n,
                    codigo: 'CP-W001',
                    party: {
                      persona: { nombres: 'Juan', apellidos: 'Mozo' },
                    },
                    historial: [],
                  },
                },
              ],
              reservasMesa: [],
            },
            {
              id: 102n,
              piso_id: 1n,
              tipo: 'MESA',
              numero: 2,
              nombre: 'Mesa 2',
              asientos: 2,
              x: 4,
              y: 1,
              ancho: 2,
              alto: 2,
              activo: true,
              pedidosMesa: [],
              reservasMesa: [
                {
                  reserva: {
                    id: 701n,
                    nombre: 'Carlos Perez',
                    telefono: '987654321',
                    personas: 2,
                    hora: horaReservaHoy,
                    estado: 'ACTIVA',
                  },
                },
              ],
            },
          ],
        },
      ]);

      const res = await service.obtenerMesas();

      expect(res.pisos).toHaveLength(1);
      const piso1 = res.pisos[0];
      expect(piso1.mesas).toHaveLength(2);

      // Mesa 1: OCUPADA con pedido y nombre del mozo
      expect(piso1.mesas[0].id).toBe('101');
      expect(piso1.mesas[0].estado).toBe('OCUPADA');
      expect(piso1.mesas[0].pedidoCodigo).toBe('CP-W001');
      expect(piso1.mesas[0].mozo).toBe('Juan Mozo');
      expect(piso1.mesas[0].reserva).toBeNull();

      // Mesa 2: LIBRE con marca de reserva activa de hoy
      expect(piso1.mesas[1].id).toBe('102');
      expect(piso1.mesas[1].estado).toBe('LIBRE');
      expect(piso1.mesas[1].pedido).toBeNull();
      expect(piso1.mesas[1].reserva).toEqual(
        expect.objectContaining({
          id: '701',
          nombre: 'Carlos Perez',
          personas: 2,
        }),
      );
    });
  });

  describe('1b. «Hoy» se calcula con la hora de Lima, no la del servidor', () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    it('una reserva de las 18:00 de Lima cuenta como de hoy aunque en UTC ya sea el día siguiente, y la de mañana no', async () => {
      // 20:00 del 21/10 en Lima = 01:00 UTC del 22/10
      jest.useFakeTimers().setSystemTime(new Date('2026-10-22T01:00:00.000Z'));
      const mesaConReservas = (reservas: any[]) => ({
        id: 101n,
        piso_id: 1n,
        tipo: 'MESA',
        numero: 1,
        nombre: 'Mesa 1',
        asientos: 4,
        x: 1,
        y: 1,
        ancho: 2,
        alto: 2,
        activo: true,
        pedidosMesa: [],
        reservasMesa: reservas,
      });
      prismaMock.piso.findMany.mockResolvedValue([
        {
          id: 1n,
          nombre: 'Piso 1',
          activo: true,
          cuadricula_ancho: 20,
          cuadricula_alto: 12,
          elementos: [
            mesaConReservas([
              // 18:00 del 21/10 en Lima = 23:00 UTC del 21/10: es de hoy en Lima
              { reserva: { id: 1n, estado: 'ACTIVA', hora: new Date('2026-10-21T23:00:00.000Z'), nombre: 'Rosa', personas: 2 } },
            ]),
            { ...mesaConReservas([
              // 09:00 del 22/10 en Lima = 14:00 UTC del 22/10: es de mañana en Lima
              { reserva: { id: 2n, estado: 'ACTIVA', hora: new Date('2026-10-22T14:00:00.000Z'), nombre: 'Luis', personas: 2 } },
            ]), id: 102n, numero: 2, nombre: 'Mesa 2' },
          ],
        },
      ]);

      const r: any = await service.obtenerMesas();
      const mesas = r.pisos ? r.pisos[0].mesas : r[0].mesas;
      const m1 = mesas.find((m: any) => m.numero === 1);
      const m2 = mesas.find((m: any) => m.numero === 2);
      expect(m1.reserva).toBeTruthy();
      expect(m2.reserva).toBeFalsy();
    });
  });

  describe('2. Abrir pedidos en mesa (abrirPedido)', () => {
    it('mesa ocupada -> 409 MESA_OCUPADA con «La mesa N ya está ocupada» (fail-fast)', async () => {
      prismaMock.elementoPlano.findMany.mockResolvedValue([
        { id: 3n, numero: 3, tipo: 'MESA', activo: true },
      ]);
      prismaMock.pedidoMesa.findMany.mockResolvedValue([
        { id: 10n, mesa_id: 3n, abierta: true, mesa: { numero: 3 } },
      ]);

      await expect(
        service.abrirPedido({
          mesas: [3],
          lineas: [{ productoId: 1, cantidad: 1 }],
          cliente: { nombre: 'Lucía Pérez' },
        }),
      ).rejects.toThrow(ConflictException);

      try {
        await service.abrirPedido({
          mesas: [3],
          lineas: [{ productoId: 1, cantidad: 1 }],
          cliente: { nombre: 'Lucía Pérez' },
        });
      } catch (err: any) {
        expect(err.getResponse()).toEqual({
          codigo: 'MESA_OCUPADA',
          mensaje: 'La mesa 3 ya está ocupada',
        });
      }
    });

    it('dos mozos a la vez -> el segundo recibe 409 MESA_OCUPADA por la restricción única', async () => {
      prismaMock.elementoPlano.findMany.mockResolvedValue([
        { id: 3n, numero: 3, tipo: 'MESA', activo: true },
      ]);
      // En fail-fast parecía libre
      prismaMock.pedidoMesa.findMany.mockResolvedValue([]);

      // Simulamos la carrera: la BD lanza error de restricción única ux_mesa_un_pedido_abierto (P2002)
      pedidosServiceMock.crear.mockImplementation(async (dto: any, idemp: any, origen: any) => {
        const errorP2002: any = new Error('Unique constraint failed on the constraint: `ux_mesa_un_pedido_abierto`');
        errorP2002.code = 'P2002';
        throw errorP2002;
      });

      await expect(
        service.abrirPedido({
          mesas: [3],
          lineas: [{ productoId: 1, cantidad: 1 }],
          cliente: { nombre: 'Lucía Pérez' },
        }),
      ).rejects.toThrow(ConflictException);

      try {
        await service.abrirPedido({
          mesas: [3],
          lineas: [{ productoId: 1, cantidad: 1 }],
          cliente: { nombre: 'Lucía Pérez' },
        });
      } catch (err: any) {
        expect(err.getResponse()).toEqual({
          codigo: 'MESA_OCUPADA',
          mensaje: 'La mesa 3 ya está ocupada',
        });
      }
    });

    it('pedido de mesa con pago dividido reenvía el plan a la creación compartida (pedidosService.crear)', async () => {
      prismaMock.elementoPlano.findMany.mockResolvedValue([
        { id: 6n, numero: 6, tipo: 'MESA', activo: true },
      ]);
      prismaMock.pedidoMesa.findMany.mockResolvedValue([]);
      prismaMock.reservaMesa.findMany.mockResolvedValue([]);
      pedidosServiceMock.crear.mockResolvedValue({ id: '77', codigo: 'CP-M077', total: 30 });

      const plan = [
        { medio: 'EFECTIVO', monto: 10 },
        { medio: 'YAPE', monto: 20 },
      ];
      await service.abrirPedido({
        mesas: [6],
        lineas: [{ productoId: 1, cantidad: 1 }],
        cliente: { nombre: 'Lucía Pérez' },
        pago: { metodo: 'YAPE', plan } as any,
      });

      const [dtoEnviado] = pedidosServiceMock.crear.mock.calls[0];
      expect(dtoEnviado.pago.plan).toEqual(plan);
      expect(dtoEnviado.modalidad).toBe('MESA');
    });

    it('al abrir un pedido de mesa encola sus etiquetas (la mesa entra directo a cocina)', async () => {
      prismaMock.elementoPlano.findMany.mockResolvedValue([{ id: 6n, numero: 6, tipo: 'MESA', activo: true }]);
      prismaMock.pedidoMesa.findMany.mockResolvedValue([]);
      prismaMock.reservaMesa.findMany.mockResolvedValue([]);
      pedidosServiceMock.crear.mockResolvedValue({ id: '79', codigo: 'CP-M079', total: 10 });

      await service.abrirPedido({ mesas: [6], lineas: [{ productoId: 1, cantidad: 1 }], cliente: { nombre: 'Ana' } });

      expect(impresionMock.encolarEtiquetasPedido).toHaveBeenCalledWith('79');
    });

    it('si encolar las etiquetas falla, la mesa igual queda abierta', async () => {
      prismaMock.elementoPlano.findMany.mockResolvedValue([{ id: 6n, numero: 6, tipo: 'MESA', activo: true }]);
      prismaMock.pedidoMesa.findMany.mockResolvedValue([]);
      prismaMock.reservaMesa.findMany.mockResolvedValue([]);
      pedidosServiceMock.crear.mockResolvedValue({ id: '80', codigo: 'CP-M080', total: 10 });
      impresionMock.encolarEtiquetasPedido.mockRejectedValueOnce(new Error('sin cola'));

      await expect(
        service.abrirPedido({ mesas: [6], lineas: [{ productoId: 1, cantidad: 1 }], cliente: { nombre: 'Ana' } }),
      ).resolves.toMatchObject({ codigo: 'CP-M080' });
    });

    it('pedido de mesa con clienteTelefono lo reenvía a la creación compartida (suma puntos al cobrar)', async () => {
      prismaMock.elementoPlano.findMany.mockResolvedValue([{ id: 6n, numero: 6, tipo: 'MESA', activo: true }]);
      prismaMock.pedidoMesa.findMany.mockResolvedValue([]);
      prismaMock.reservaMesa.findMany.mockResolvedValue([]);
      pedidosServiceMock.crear.mockResolvedValue({ id: '78', codigo: 'CP-M078', total: 10 });

      await service.abrirPedido({ mesas: [6], lineas: [{ productoId: 1, cantidad: 1 }], clienteTelefono: '912340170' });

      expect(pedidosServiceMock.crear.mock.calls[0][0].clienteTelefono).toBe('912340170');
    });

    it('pedido de mesa con clientePartyId lo reenvía a la creación compartida sin nombre ni teléfono de relleno', async () => {
      prismaMock.elementoPlano.findMany.mockResolvedValue([{ id: 6n, numero: 6, tipo: 'MESA', activo: true }]);
      prismaMock.pedidoMesa.findMany.mockResolvedValue([]);
      prismaMock.reservaMesa.findMany.mockResolvedValue([]);
      pedidosServiceMock.crear.mockResolvedValue({ id: '79', codigo: 'CP-M079', total: 10 });

      await service.abrirPedido({ mesas: [6], lineas: [{ productoId: 1, cantidad: 1 }], clientePartyId: '77' });

      const [dtoEnviado] = pedidosServiceMock.crear.mock.calls[0];
      expect(dtoEnviado.clientePartyId).toBe('77');
      expect(dtoEnviado.cliente).toEqual({ nombre: '', telefono: '' });
    });

    it('mesa sin cuenta y sin nombre (o de 1 letra) -> 400 CLIENTE_NOMBRE_REQUERIDO', async () => {
      prismaMock.elementoPlano.findMany.mockResolvedValue([{ id: 6n, numero: 6, tipo: 'MESA', activo: true }]);
      prismaMock.pedidoMesa.findMany.mockResolvedValue([]);

      await expect(
        service.abrirPedido({ mesas: [6], lineas: [{ productoId: 1, cantidad: 1 }] }),
      ).rejects.toMatchObject({ response: { codigo: 'CLIENTE_NOMBRE_REQUERIDO' } });
      await expect(
        service.abrirPedido({ mesas: [6], lineas: [{ productoId: 1, cantidad: 1 }], cliente: { nombre: 'A' } }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(pedidosServiceMock.crear).not.toHaveBeenCalled();
    });

    it('mesa con nombre y sin teléfono guarda sin teléfono real (no usa el relleno 999999999)', async () => {
      prismaMock.elementoPlano.findMany.mockResolvedValue([{ id: 6n, numero: 6, tipo: 'MESA', activo: true }]);
      prismaMock.pedidoMesa.findMany.mockResolvedValue([]);
      prismaMock.reservaMesa.findMany.mockResolvedValue([]);
      pedidosServiceMock.crear.mockResolvedValue({ id: '81', codigo: 'CP-M081', total: 10 });

      await service.abrirPedido({ mesas: [6], lineas: [{ productoId: 1, cantidad: 1 }], cliente: { nombre: 'Lucía Pérez' } });

      const [dtoEnviado] = pedidosServiceMock.crear.mock.calls[0];
      expect(dtoEnviado.cliente).toEqual({ nombre: 'Lucía Pérez', telefono: '' });
    });

    it('mesa con nombre y teléfono válido lo pasa normalizado; el relleno 999999999 cuenta como sin teléfono', async () => {
      prismaMock.elementoPlano.findMany.mockResolvedValue([{ id: 6n, numero: 6, tipo: 'MESA', activo: true }]);
      prismaMock.pedidoMesa.findMany.mockResolvedValue([]);
      prismaMock.reservaMesa.findMany.mockResolvedValue([]);
      pedidosServiceMock.crear.mockResolvedValue({ id: '82', codigo: 'CP-M082', total: 10 });

      await service.abrirPedido({
        mesas: [6],
        lineas: [{ productoId: 1, cantidad: 1 }],
        cliente: { nombre: 'Lucía Pérez', telefono: '+51 987 654 321' },
      });
      expect(pedidosServiceMock.crear.mock.calls[0][0].cliente).toEqual({ nombre: 'Lucía Pérez', telefono: '987654321' });

      await service.abrirPedido({
        mesas: [6],
        lineas: [{ productoId: 1, cantidad: 1 }],
        cliente: { nombre: 'Lucía Pérez', telefono: '999999999' },
      });
      expect(pedidosServiceMock.crear.mock.calls[1][0].cliente).toEqual({ nombre: 'Lucía Pérez', telefono: '' });
    });

    it('mesa con teléfono que no es de 9 dígitos que empiezan en 9 -> 400 TELEFONO_INVALIDO', async () => {
      prismaMock.elementoPlano.findMany.mockResolvedValue([{ id: 6n, numero: 6, tipo: 'MESA', activo: true }]);
      prismaMock.pedidoMesa.findMany.mockResolvedValue([]);

      await expect(
        service.abrirPedido({
          mesas: [6],
          lineas: [{ productoId: 1, cantidad: 1 }],
          cliente: { nombre: 'Lucía Pérez', telefono: '12345' },
        }),
      ).rejects.toMatchObject({ response: { codigo: 'TELEFONO_INVALIDO' } });
      expect(pedidosServiceMock.crear).not.toHaveBeenCalled();
    });

    it('varias mesas en un pedido (RN-CAP-108) crea pedidos_mesa y emite salon:mesa para todas', async () => {
      prismaMock.elementoPlano.findMany.mockResolvedValue([
        { id: 4n, numero: 4, tipo: 'MESA', activo: true },
        { id: 5n, numero: 5, tipo: 'MESA', activo: true },
      ]);
      prismaMock.pedidoMesa.findMany.mockResolvedValue([]);
      prismaMock.reservaMesa.findMany.mockResolvedValue([]);

      pedidosServiceMock.crear.mockImplementation(async (dto: any, idemp: any, origen: any) => {
        // Ejecutar callback de transacción
        await origen.enTransaccion(prismaMock, { id: 800n, codigo: 'CP-W008' });
        return {
          id: '800',
          codigo: 'CP-W008',
          estado: 'COLA',
          subtotal: 50,
          total: 50,
          mensaje: 'Pedido enviado a cocina',
        };
      });

      const res = await service.abrirPedido(
        {
          mesas: [4, 5],
          lineas: [{ productoId: 1, cantidad: 2 }],
          cliente: { nombre: 'Lucía Pérez' },
        },
        { partyId: 12n, rol: 'MOZO' } as any,
      );

      expect(res.codigo).toBe('CP-W008');
      expect(res.mesas).toHaveLength(2);
      expect(prismaMock.pedidoMesa.create).toHaveBeenCalledTimes(2);

      // Emite salon:mesa para ambas mesas
      expect(eventosGatewayMock.emitirAdmin).toHaveBeenCalledWith('salon:mesa', {
        mesaId: '4',
        estado: 'OCUPADA',
      });
      expect(eventosGatewayMock.emitirAdmin).toHaveBeenCalledWith('salon:mesa', {
        mesaId: '5',
        estado: 'OCUPADA',
      });
    });

    it('al sentar una reserva el pedido queda asociado a ella; si falla, el pedido igual se abre', async () => {
      prismaMock.elementoPlano.findMany.mockResolvedValue([{ id: 4n, numero: 4, tipo: 'MESA', activo: true }]);
      prismaMock.pedidoMesa.findMany.mockResolvedValue([]);
      prismaMock.reservaMesa.findMany.mockResolvedValue([]);
      pedidosServiceMock.crear.mockImplementation(async (dto: any, idemp: any, origen: any) => {
        await origen.enTransaccion(prismaMock, { id: 801n, codigo: 'CP-W009' });
        return { id: '801', codigo: 'CP-W009', estado: 'COLA', subtotal: 20, total: 20, mensaje: 'ok' };
      });

      const res = await service.abrirPedido(
        { mesas: [4], lineas: [{ productoId: 1, cantidad: 1 }], cliente: { nombre: 'Lucía Pérez' }, reservaId: 55 },
        { partyId: 12n, rol: 'MOZO' } as any,
      );
      expect(res.codigo).toBe('CP-W009');
      expect(reservasMock.marcarPedidoDeReserva).toHaveBeenCalledWith(55, '801');

      reservasMock.marcarPedidoDeReserva.mockRejectedValue(new Error('reserva ya no existe'));
      const res2 = await service.abrirPedido(
        { mesas: [4], lineas: [{ productoId: 1, cantidad: 1 }], cliente: { nombre: 'Lucía Pérez' }, reservaId: 56 },
        { partyId: 12n, rol: 'MOZO' } as any,
      );
      expect(res2.codigo).toBe('CP-W009');
    });

    it('si hay reserva activa en la mesa, incluye aviso en la respuesta sin bloquear', async () => {
      prismaMock.elementoPlano.findMany.mockResolvedValue([
        { id: 6n, numero: 6, tipo: 'MESA', activo: true },
      ]);
      prismaMock.pedidoMesa.findMany.mockResolvedValue([]);
      prismaMock.reservaMesa.findMany.mockResolvedValue([
        {
          reserva: {
            id: 99n,
            nombre: 'Ana Lopez',
            personas: 4,
            hora: new Date('2026-10-21T21:00:00Z'),
            estado: 'ACTIVA',
          },
        },
      ]);

      pedidosServiceMock.crear.mockResolvedValue({
        id: '801',
        codigo: 'CP-W009',
        estado: 'COLA',
        subtotal: 30,
        total: 30,
        mensaje: 'Pedido enviado a cocina',
      });

      const res = await service.abrirPedido({
        mesas: [6],
        lineas: [{ productoId: 1, cantidad: 1 }],
        cliente: { nombre: 'Lucía Pérez' },
      });

      expect(res.codigo).toBe('CP-W009');
      expect(res.aviso).toContain('reserva activa para hoy');
      expect(res.aviso).toContain('Ana Lopez');
    });
  });

  describe('3. Liberar mesa manual (liberarMesaManual)', () => {
    it('liberar sin motivo o con menos de 5 caracteres -> 400 MOTIVO_INVALIDO', async () => {
      prismaMock.elementoPlano.findUnique.mockResolvedValue({
        id: 7n,
        tipo: 'MESA',
      });

      await expect(service.liberarMesaManual(7, { motivo: '' })).rejects.toThrow(BadRequestException);
      await expect(service.liberarMesaManual(7, { motivo: 'abc' })).rejects.toThrow(BadRequestException);

      try {
        await service.liberarMesaManual(7, { motivo: '1234' });
      } catch (err: any) {
        expect(err.getResponse()).toEqual({
          codigo: 'MOTIVO_INVALIDO',
          mensaje: 'El motivo es obligatorio y debe tener al menos 5 caracteres',
        });
      }
    });

    it('liberar con pedido en cocina (COLA/PREPARANDO) -> 409 PEDIDO_EN_COCINA', async () => {
      prismaMock.elementoPlano.findUnique.mockResolvedValue({
        id: 7n,
        tipo: 'MESA',
      });
      prismaMock.pedidoMesa.findFirst.mockResolvedValue({
        id: 20n,
        abierta: true,
        pedido: {
          id: 50n,
          estado: 'COLA',
        },
      });

      await expect(
        service.liberarMesaManual(7, { motivo: 'Cliente se fue sin pagar' }),
      ).rejects.toThrow(ConflictException);

      try {
        await service.liberarMesaManual(7, { motivo: 'Cliente se fue sin pagar' });
      } catch (err: any) {
        expect(err.getResponse()).toEqual({
          codigo: 'PEDIDO_EN_COCINA',
          mensaje: 'El pedido sigue activo en cocina. Debe anularlo antes de liberar la mesa.',
        });
      }
    });

    it('liberar con motivo válido audita, actualiza y emite salon:mesa LIBRE', async () => {
      prismaMock.elementoPlano.findUnique.mockResolvedValue({
        id: 7n,
        tipo: 'MESA',
      });
      prismaMock.pedidoMesa.findFirst.mockResolvedValue({
        id: 20n,
        abierta: true,
        pedido: {
          id: 50n,
          estado: 'ENTREGADO',
        },
      });

      const res = await service.liberarMesaManual(
        7,
        { motivo: 'Limpieza de mesa terminada' },
        { partyId: 10n } as any,
        '192.168.1.1',
      );

      expect(res.ok).toBe(true);
      expect(prismaMock.pedidoMesa.update).toHaveBeenCalledWith({
        where: { id: 20n },
        data: { abierta: false },
      });
      expect(auditoriaMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          modulo: 'mesas',
          accion: 'LIBERAR_MANUAL',
          motivo: 'Limpieza de mesa terminada',
        }),
      );
      expect(eventosGatewayMock.emitirAdmin).toHaveBeenCalledWith('salon:mesa', {
        mesaId: '7',
        estado: 'LIBRE',
      });
    });
    it('forzar=true libera aunque el pedido esté en COLA/PREPARANDO, cierra todas las filas abiertas y audita LIBERAR_FORZADO', async () => {
      prismaMock.elementoPlano.findUnique.mockResolvedValue({ id: 7n, tipo: 'MESA' });
      prismaMock.pedidoMesa.findMany.mockResolvedValue([
        { id: 20n, pedido_id: 50n, abierta: true, pedido: { id: 50n, estado: 'PREPARANDO' } },
        { id: 21n, pedido_id: 51n, abierta: true, pedido: { id: 51n, estado: 'COLA' } },
      ]);

      const res = await service.liberarMesaManual(
        7,
        { motivo: 'Cliente se fue, mesa trabada', forzar: true },
        { partyId: 10n } as any,
        '192.168.1.1',
      );

      expect(res.ok).toBe(true);
      expect(prismaMock.pedidoMesa.updateMany).toHaveBeenCalledWith({
        where: { mesa_id: 7n, abierta: true },
        data: { abierta: false },
      });
      expect(prismaMock.pedidoMesa.update).not.toHaveBeenCalled();
      expect(prismaMock.pedido.update).not.toHaveBeenCalled();
      expect(auditoriaMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          modulo: 'mesas',
          accion: 'LIBERAR_FORZADO',
          motivo: 'Cliente se fue, mesa trabada',
          ip: '192.168.1.1',
          despues: expect.objectContaining({
            pedidos: [
              { pedidoId: '50', estado: 'PREPARANDO' },
              { pedidoId: '51', estado: 'COLA' },
            ],
          }),
        }),
      );
      expect(eventosGatewayMock.emitirAdmin).toHaveBeenCalledWith('salon:mesa', {
        mesaId: '7',
        estado: 'LIBRE',
      });
    });

    it('forzar=true con motivo corto sigue rechazando con 400 MOTIVO_INVALIDO', async () => {
      prismaMock.elementoPlano.findUnique.mockResolvedValue({ id: 7n, tipo: 'MESA' });

      await expect(
        service.liberarMesaManual(7, { motivo: 'abc', forzar: true }),
      ).rejects.toThrow(BadRequestException);
      expect(prismaMock.pedidoMesa.updateMany).not.toHaveBeenCalled();
      expect(auditoriaMock.registrar).not.toHaveBeenCalled();
    });

    it('sin forzar, un pedido en cocina sigue dando 409 y no libera ni audita', async () => {
      prismaMock.elementoPlano.findUnique.mockResolvedValue({ id: 7n, tipo: 'MESA' });
      prismaMock.pedidoMesa.findFirst.mockResolvedValue({
        id: 20n,
        abierta: true,
        pedido: { id: 50n, estado: 'COLA' },
      });

      await expect(
        service.liberarMesaManual(7, { motivo: 'Cliente se fue', forzar: false }),
      ).rejects.toThrow(ConflictException);
      expect(prismaMock.pedidoMesa.updateMany).not.toHaveBeenCalled();
      expect(auditoriaMock.registrar).not.toHaveBeenCalled();
    });
  });

  describe('4. liberarMesasDePedido idempotente', () => {
    it('cierra pedido_mesa abiertas del pedido y emite salon:mesa', async () => {
      prismaMock.pedidoMesa.findMany.mockResolvedValue([
        { id: 101n, pedido_id: 300n, mesa_id: 8n, abierta: true },
        { id: 102n, pedido_id: 300n, mesa_id: 9n, abierta: true },
      ]);

      const res = await service.liberarMesasDePedido(300);

      expect(res.liberadas).toBe(2);
      expect(prismaMock.pedidoMesa.updateMany).toHaveBeenCalledWith({
        where: { pedido_id: 300n, abierta: true },
        data: { abierta: false },
      });
      expect(eventosGatewayMock.emitirAdmin).toHaveBeenCalledWith('salon:mesa', {
        mesaId: '8',
        estado: 'LIBRE',
      });
      expect(eventosGatewayMock.emitirAdmin).toHaveBeenCalledWith('salon:mesa', {
        mesaId: '9',
        estado: 'LIBRE',
      });
    });

    it('llamada idempotente cuando ya no hay mesas abiertas retorna 0 sin fallar', async () => {
      prismaMock.pedidoMesa.findMany.mockResolvedValue([]);

      const res = await service.liberarMesasDePedido(300);

      expect(res.liberadas).toBe(0);
      expect(prismaMock.pedidoMesa.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('5. Entregado en mesa (marcarEntregadoMesa)', () => {
    it('solo pedidos MESA en LISTO pueden marcarse como entregados en mesa', async () => {
      // Caso 1: modalidad no MESA
      prismaMock.pedido.findUnique.mockResolvedValue({
        id: 900n,
        modalidad: 'DELIVERY',
        estado: 'LISTO',
      });
      await expect(service.marcarEntregadoMesa(900)).rejects.toThrow(BadRequestException);

      // Caso 2: no está en LISTO
      prismaMock.pedido.findUnique.mockResolvedValue({
        id: 901n,
        modalidad: 'MESA',
        estado: 'PREPARANDO',
      });
      await expect(service.marcarEntregadoMesa(901)).rejects.toThrow(ConflictException);

      // Caso 3: éxito cuando MESA y LISTO
      prismaMock.pedido.findUnique.mockResolvedValue({
        id: 902n,
        modalidad: 'MESA',
        estado: 'LISTO',
        codigo: 'CP-W010',
      });
      prismaMock.pedido.update.mockResolvedValue({
        id: 902n,
        codigo: 'CP-W010',
      });

      const res = await service.marcarEntregadoMesa(902, { partyId: 10n } as any);

      expect(res.ok).toBe(true);
      expect(res.codigo).toBe('CP-W010');
      expect(auditoriaMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          modulo: 'mesas',
          accion: 'ENTREGADO_MESA',
        }),
      );
    });
  });

  describe('6. Avisar listo (avisarListo)', () => {
    it('emite salon:listo { pedidoId, codigo, mesas, mozoPartyId }', async () => {
      prismaMock.pedido.findUnique.mockResolvedValue({
        id: 400n,
        codigo: 'CP-W015',
        modalidad: 'MESA',
        party_id: 88n,
        mesas: [
          { mesa_id: 1n, mesa: { numero: 1 } },
          { mesa_id: 2n, mesa: { numero: 2 } },
        ],
        historial: [],
      });

      await service.avisarListo(400);

      expect(eventosGatewayMock.emitirAdmin).toHaveBeenCalledWith('salon:listo', {
        pedidoId: '400',
        codigo: 'CP-W015',
        mesas: [1, 2],
        mozoPartyId: '88',
      });
    });
  });
});
