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

    reservasMock = {
      marcarPedidoDeReserva: jest.fn().mockResolvedValue(undefined),
      validarMesasYAsientos: jest.fn().mockResolvedValue(undefined),
    };
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

  describe('2b. Cortesía en un pedido de mesa (abrirPedido)', () => {
    beforeEach(() => {
      prismaMock.elementoPlano.findMany.mockResolvedValue([{ id: 6n, numero: 6, tipo: 'MESA', activo: true }]);
      prismaMock.pedidoMesa.findMany.mockResolvedValue([]);
      prismaMock.reservaMesa.findMany.mockResolvedValue([]);
      pedidosServiceMock.crear.mockResolvedValue({ id: '81', codigo: 'CP-M081', total: 10 });
    });

    const dtoConCortesia: any = {
      mesas: [6],
      lineas: [{ productoId: 1, cantidad: 1, cortesia: { motivo: 'ERROR_COCINA' } }],
      cliente: { nombre: 'Ana Ruiz' },
    };

    it('CAJERO (con cortesias/dar) puede dar cortesía en mesa: el pedido recibe puedeCortesia y el supervisor que presentó código', async () => {
      await service.abrirPedido({ ...dtoConCortesia, canal: 'CAJA' }, { partyId: 9n, rol: 'CAJERO', debeCambiar: false }, 'k-c1', 77n);

      const [, , opciones] = pedidosServiceMock.crear.mock.calls[0];
      expect(opciones).toMatchObject({ canal: 'CAJA', puedeCortesia: true, supervisorCortesiaPartyId: 77n });
    });

    it('ADMIN tambien puede dar cortesía en mesa (sin código de supervisor)', async () => {
      await service.abrirPedido(dtoConCortesia, { partyId: 1n, rol: 'ADMIN', debeCambiar: false }, 'k-a1');

      const [, , opciones] = pedidosServiceMock.crear.mock.calls[0];
      expect(opciones).toMatchObject({ puedeCortesia: true, supervisorCortesiaPartyId: undefined });
    });

    it('MOZO tiene cortesias/dar (libre): el pedido de mesa llega con puedeCortesia', async () => {
      await service.abrirPedido(dtoConCortesia, { partyId: 10n, rol: 'MOZO', debeCambiar: false }, 'k-m1');

      const [, , opciones] = pedidosServiceMock.crear.mock.calls[0];
      expect(opciones.puedeCortesia).toBe(true);
    });

    it('COCINA no tiene cortesias/dar: llega sin puedeCortesia (la creación responde 403)', async () => {
      await service.abrirPedido(dtoConCortesia, { partyId: 10n, rol: 'COCINA', debeCambiar: false }, 'k-m2');

      const [, , opciones] = pedidosServiceMock.crear.mock.calls[0];
      expect(opciones.puedeCortesia).toBe(false);
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

    it('deja un aviso en la campana del mozo: «Mesa N lista para llevar»', async () => {
      prismaMock.notificacion = { create: jest.fn().mockResolvedValue({ id: 5n }) };
      prismaMock.pedido.findUnique.mockResolvedValue({
        id: 401n, codigo: 'CP-W016', modalidad: 'MESA', party_id: 88n,
        mesas: [{ mesa_id: 1n, mesa: { numero: 4 } }], historial: [],
      });
      await service.avisarListo(401);
      expect(prismaMock.notificacion.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ tipo: 'MESA_LISTA', party_destino: 88n, titulo: 'Mesa 4 lista para llevar' }),
      });
    });
  });

  describe('Nombre corto del cliente en la mesa (clienteNombre)', () => {
    const mesaConPedido = (cliente_nombre: string | null) => [
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
              estado: 'COLA',
              total: 24,
              cliente_nombre,
              party: null,
              historial: [],
              lineas: [],
            },
          },
        ],
        reservasMesa: [],
      },
    ];

    it('obtenerMesas devuelve cliente con el nombre del pedido (null si no hay)', async () => {
      prismaMock.piso.findMany.mockResolvedValue([
        { id: 1n, nombre: 'Piso 1', activo: true, cuadricula_ancho: 20, cuadricula_alto: 12, elementos: mesaConPedido('Ana') },
      ]);
      const con: any = await service.obtenerMesas();
      expect(con.pisos[0].mesas[0].pedido.cliente).toBe('Ana');

      prismaMock.piso.findMany.mockResolvedValue([
        { id: 1n, nombre: 'Piso 1', activo: true, cuadricula_ancho: 20, cuadricula_alto: 12, elementos: mesaConPedido(null) },
      ]);
      const sin: any = await service.obtenerMesas();
      expect(sin.pisos[0].mesas[0].pedido.cliente).toBeNull();
    });

    it('obtenerMesas dice si la mesa es la principal del pedido y su orden (para quitar mesa)', async () => {
      const elementos = [
        {
          ...mesaConPedido('Ana')[0],
          pedidosMesa: [{ id: 502n, abierta: true, principal: false, orden: 2, pedido: mesaConPedido('Ana')[0].pedidosMesa[0].pedido }],
        },
      ];
      prismaMock.piso.findMany.mockResolvedValue([{ id: 1n, nombre: 'Piso 1', activo: true, cuadricula_ancho: 20, cuadricula_alto: 12, elementos }]);
      const r: any = await service.obtenerMesas();
      expect(r.pisos[0].mesas[0].pedido).toMatchObject({ id: '1001', esPrincipal: false, orden: 2 });
    });

    it('sin cliente.nombre, clienteNombre pasa como nombre del pedido de mesa', async () => {
      prismaMock.elementoPlano.findMany.mockResolvedValue([{ id: 6n, numero: 6, tipo: 'MESA', activo: true }]);
      prismaMock.pedidoMesa.findMany.mockResolvedValue([]);
      prismaMock.reservaMesa.findMany.mockResolvedValue([]);
      pedidosServiceMock.crear.mockResolvedValue({ id: '83', codigo: 'CP-M083', total: 10 });

      await service.abrirPedido({ mesas: [6], lineas: [{ productoId: 1, cantidad: 1 }], clienteNombre: '  Ana  ' });

      const [dtoEnviado] = pedidosServiceMock.crear.mock.calls[0];
      expect(dtoEnviado.cliente.nombre).toBe('Ana');
    });

    it('cliente.nombre manda sobre clienteNombre; con cuenta (teléfono) clienteNombre no cambia el nombre', async () => {
      prismaMock.elementoPlano.findMany.mockResolvedValue([{ id: 6n, numero: 6, tipo: 'MESA', activo: true }]);
      prismaMock.pedidoMesa.findMany.mockResolvedValue([]);
      prismaMock.reservaMesa.findMany.mockResolvedValue([]);
      pedidosServiceMock.crear.mockResolvedValue({ id: '84', codigo: 'CP-M084', total: 10 });

      await service.abrirPedido({
        mesas: [6],
        lineas: [{ productoId: 1, cantidad: 1 }],
        cliente: { nombre: 'Lucía Pérez' },
        clienteNombre: 'Ana',
      });
      await service.abrirPedido({
        mesas: [6],
        lineas: [{ productoId: 1, cantidad: 1 }],
        clienteTelefono: '912340170',
        clienteNombre: 'Ana',
      });

      expect(pedidosServiceMock.crear.mock.calls[0][0].cliente.nombre).toBe('Lucía Pérez');
      expect(pedidosServiceMock.crear.mock.calls[1][0].cliente.nombre).toBe('');
    });

    it('el DTO rechaza un nombre corto de más de 40 caracteres', async () => {
      const { validate } = await import('class-validator');
      const { plainToInstance } = await import('class-transformer');
      const { AbrirPedidoMesaDto } = await import('./dto/abrir-pedido-mesa.dto');
      const dto = plainToInstance(AbrirPedidoMesaDto, {
        mesas: [6],
        lineas: [],
        clienteNombre: 'x'.repeat(41),
      });
      const errores = await validate(dto, { whitelist: false });
      expect(errores.map((e) => e.property)).toContain('clienteNombre');
    });
  });

  describe('7. Cambiar de mesa (cambiarMesaPedido)', () => {
    const mesaLibre = (id: bigint, numero: number) => ({ id, tipo: 'MESA', numero, nombre: null, activo: true });

    it('mesa destino ocupada -> 409 MESA_OCUPADA y no mueve nada', async () => {
      prismaMock.pedido.findUnique.mockResolvedValue({
        id: 300n, codigo: 'P-0300', modalidad: 'MESA', estado: 'COLA',
        mesas: [{ mesa_id: 8n, mesa_nombre: 'Mesa 1', abierta: true, mesa: { numero: 1 } }],
      });
      prismaMock.elementoPlano.findUnique.mockResolvedValue(mesaLibre(9n, 5));
      prismaMock.pedidoMesa.findFirst.mockResolvedValue({ id: 1n, mesa_id: 9n, abierta: true });

      await expect(service.cambiarMesaPedido('300', '9', undefined, undefined)).rejects.toMatchObject({
        response: { codigo: 'MESA_OCUPADA', mensaje: 'La mesa 5 ya está ocupada' },
      });
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
      expect(auditoriaMock.registrar).not.toHaveBeenCalled();
    });

    it('cierra la mesa vieja, abre la nueva, actualiza el nombre del pedido, audita y emite', async () => {
      prismaMock.pedido.findUnique.mockResolvedValue({
        id: 300n, codigo: 'P-0300', modalidad: 'MESA', estado: 'COLA',
        mesas: [{ mesa_id: 8n, mesa_nombre: 'Mesa 1', abierta: true, mesa: { numero: 1 } }],
      });
      prismaMock.elementoPlano.findUnique.mockResolvedValue(mesaLibre(9n, 5));
      prismaMock.pedidoMesa.findFirst.mockResolvedValue(null);

      const res = await service.cambiarMesaPedido('300', '9', { partyId: '7' } as any, '10.0.0.1');

      expect(prismaMock.pedidoMesa.updateMany).toHaveBeenCalledWith({
        where: { pedido_id: 300n, abierta: true },
        data: { abierta: false },
      });
      expect(prismaMock.pedidoMesa.create).toHaveBeenCalledWith({
        data: { pedido_id: 300n, mesa_id: 9n, mesa_nombre: 'Mesa 5', abierta: true, principal: true, orden: 1 },
      });
      expect(prismaMock.pedido.update).toHaveBeenCalledWith({ where: { id: 300n }, data: { mesa_nombre: 'Mesa 5' } });
      expect(auditoriaMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'CAMBIAR_MESA',
          entidad: 'pedido',
          entidadId: 300n,
          antes: { mesas: [{ mesaId: '8', mesa: 'Mesa 1' }] },
          despues: { mesaId: '9', mesa: 'Mesa 5' },
          partyId: 7n,
          ip: '10.0.0.1',
        }),
      );
      expect(eventosGatewayMock.emitirAdmin).toHaveBeenCalledWith('salon:mesa', { mesaId: '8', estado: 'LIBRE' });
      expect(eventosGatewayMock.emitirAdmin).toHaveBeenCalledWith('salon:mesa', { mesaId: '9', estado: 'OCUPADA' });
      expect(res).toMatchObject({ ok: true, pedidoId: '300', mesaId: '9', mesa: 'Mesa 5' });
    });

    it('varias mesas juntas pasan a una sola: cierra todas y abre solo la destino', async () => {
      prismaMock.pedido.findUnique.mockResolvedValue({
        id: 300n, codigo: 'P-0300', modalidad: 'MESA', estado: 'PREPARANDO',
        mesas: [
          { mesa_id: 8n, mesa_nombre: 'Mesa 1', abierta: true, mesa: { numero: 1 } },
          { mesa_id: 6n, mesa_nombre: 'Mesa 2', abierta: true, mesa: { numero: 2 } },
        ],
      });
      prismaMock.elementoPlano.findUnique.mockResolvedValue(mesaLibre(9n, 5));
      prismaMock.pedidoMesa.findFirst.mockResolvedValue(null);

      await service.cambiarMesaPedido('300', '9');

      expect(prismaMock.pedidoMesa.updateMany).toHaveBeenCalledTimes(1);
      expect(prismaMock.pedidoMesa.create).toHaveBeenCalledTimes(1);
      const avisos = eventosGatewayMock.emitirAdmin.mock.calls.filter((c: any[]) => c[0] === 'salon:mesa');
      expect(avisos).toEqual(
        expect.arrayContaining([
          ['salon:mesa', { mesaId: '8', estado: 'LIBRE' }],
          ['salon:mesa', { mesaId: '6', estado: 'LIBRE' }],
          ['salon:mesa', { mesaId: '9', estado: 'OCUPADA' }],
        ]),
      );
    });

    it('pedido que no está abierto en ninguna mesa -> 409 PEDIDO_SIN_MESA', async () => {
      prismaMock.pedido.findUnique.mockResolvedValue({ id: 300n, codigo: 'P-0300', modalidad: 'MESA', estado: 'LISTO', mesas: [] });

      await expect(service.cambiarMesaPedido('300', '9')).rejects.toMatchObject({
        response: { codigo: 'PEDIDO_SIN_MESA' },
      });
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('pedido inexistente -> 404 PEDIDO_NO_ENCONTRADO', async () => {
      prismaMock.pedido.findUnique.mockResolvedValue(null);

      await expect(service.cambiarMesaPedido('999', '9')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('mesa destino inexistente o que no es mesa -> 404 MESA_NO_ENCONTRADA', async () => {
      prismaMock.pedido.findUnique.mockResolvedValue({
        id: 300n, codigo: 'P-0300', modalidad: 'MESA', estado: 'COLA',
        mesas: [{ mesa_id: 8n, mesa_nombre: 'Mesa 1', abierta: true, mesa: { numero: 1 } }],
      });
      prismaMock.elementoPlano.findUnique.mockResolvedValue({ id: 9n, tipo: 'PARED', activo: true });

      await expect(service.cambiarMesaPedido('300', '9')).rejects.toMatchObject({
        response: { codigo: 'MESA_NO_ENCONTRADA' },
      });
    });

    it('pedido que no es de mesa (DELIVERY) -> 400 MODALIDAD_INVALIDA', async () => {
      prismaMock.pedido.findUnique.mockResolvedValue({ id: 300n, codigo: 'P-0300', modalidad: 'DELIVERY', estado: 'COLA', mesas: [] });

      await expect(service.cambiarMesaPedido('300', '9')).rejects.toMatchObject({
        response: { codigo: 'MODALIDAD_INVALIDA' },
      });
    });
  });
  describe('8. Pedido con varias mesas (abrir, sumar, quitar, mover y liberar)', () => {
    const mesaActiva = (id: bigint, numero: number, asientos = 4) => ({ id, tipo: 'MESA', numero, nombre: null, activo: true, asientos });
    const filaMesa = (id: bigint, pedidoMesaId: bigint, numero: number, extra: any = {}) => ({
      id: pedidoMesaId,
      pedido_id: 300n,
      mesa_id: id,
      mesa_nombre: `Mesa ${numero}`,
      abierta: true,
      principal: false,
      orden: 1,
      mesa: { numero, nombre: null },
      ...extra,
    });

    it('abrir con 3 mesas: la primera es la principal, el pedido se llama «Mesas 3, 4 y 5» y se crean 3 filas', async () => {
      prismaMock.elementoPlano.findMany.mockResolvedValue([mesaActiva(3n, 3), mesaActiva(4n, 4), mesaActiva(5n, 5)]);
      prismaMock.pedidoMesa.findMany.mockResolvedValue([]);
      prismaMock.reservaMesa.findMany.mockResolvedValue([]);
      pedidosServiceMock.crear.mockImplementation(async (_dto: any, _k: any, origen: any) => {
        await origen.enTransaccion(prismaMock, { id: 900n, codigo: 'CP-W900' });
        return { id: '900', codigo: 'CP-W900', estado: 'COLA' };
      });

      await service.abrirPedido({ mesas: [3, 4, 5], lineas: [{ productoId: 1, cantidad: 1 }], cliente: { nombre: 'Lucía Pérez' } });

      expect(pedidosServiceMock.crear.mock.calls[0][2].mesaNombre).toBe('Mesas 3, 4 y 5');
      const filas = prismaMock.pedidoMesa.create.mock.calls.map((c: any[]) => c[0].data);
      expect(filas).toEqual([
        expect.objectContaining({ mesa_id: 3n, principal: true, orden: 1 }),
        expect.objectContaining({ mesa_id: 4n, principal: false, orden: 2 }),
        expect.objectContaining({ mesa_id: 5n, principal: false, orden: 3 }),
      ]);
    });

    it('abrir con 2 mesas el nombre del pedido es «Mesas 3 y 4»', async () => {
      prismaMock.elementoPlano.findMany.mockResolvedValue([mesaActiva(3n, 3), mesaActiva(4n, 4)]);
      prismaMock.pedidoMesa.findMany.mockResolvedValue([]);
      prismaMock.reservaMesa.findMany.mockResolvedValue([]);
      pedidosServiceMock.crear.mockResolvedValue({ id: '901', codigo: 'CP-W901' });

      await service.abrirPedido({ mesas: ['3', '4'], lineas: [{ productoId: 1, cantidad: 1 }], cliente: { nombre: 'Lucía Pérez' } });

      expect(pedidosServiceMock.crear.mock.calls[0][2].mesaNombre).toBe('Mesas 3 y 4');
    });

    it('más de 6 mesas -> 400 MESAS_LIMITE sin tocar la base', async () => {
      await expect(
        service.abrirPedido({ mesas: [1, 2, 3, 4, 5, 6, 7], lineas: [], cliente: { nombre: 'Lucía' } }),
      ).rejects.toMatchObject({ response: { codigo: 'MESAS_LIMITE' } });
      expect(prismaMock.elementoPlano.findMany).not.toHaveBeenCalled();
    });

    it('la misma mesa dos veces -> 400 MESA_REPETIDA', async () => {
      await expect(
        service.abrirPedido({ mesas: [4, 4], lineas: [], cliente: { nombre: 'Lucía' } }),
      ).rejects.toMatchObject({ response: { codigo: 'MESA_REPETIDA' } });
      expect(prismaMock.elementoPlano.findMany).not.toHaveBeenCalled();
    });

    it('una de las varias mesas ocupada -> 409 MESA_OCUPADA con el nombre de esa mesa', async () => {
      prismaMock.elementoPlano.findMany.mockResolvedValue([mesaActiva(3n, 3), mesaActiva(4n, 4)]);
      prismaMock.pedidoMesa.findMany.mockResolvedValue([{ mesa_id: 4n, abierta: true, mesa: { numero: 4 } }]);

      await expect(
        service.abrirPedido({ mesas: [3, 4], lineas: [], cliente: { nombre: 'Lucía' } }),
      ).rejects.toMatchObject({ response: { codigo: 'MESA_OCUPADA', mensaje: 'La mesa 4 ya está ocupada' } });
      expect(pedidosServiceMock.crear).not.toHaveBeenCalled();
    });

    it('con personas, la capacidad se valida como en reservas (y confirmarCapacidad la deja pasar)', async () => {
      prismaMock.elementoPlano.findMany.mockResolvedValue([mesaActiva(3n, 3), mesaActiva(4n, 4)]);
      prismaMock.pedidoMesa.findMany.mockResolvedValue([]);
      prismaMock.reservaMesa.findMany.mockResolvedValue([]);
      pedidosServiceMock.crear.mockResolvedValue({ id: '902', codigo: 'CP-W902' });
      reservasMock.validarMesasYAsientos.mockRejectedValueOnce({ response: { codigo: 'ASIENTOS_INSUFICIENTES' } });

      await expect(
        service.abrirPedido({ mesas: [3, 4], personas: 10, lineas: [], cliente: { nombre: 'Lucía' } }),
      ).rejects.toMatchObject({ response: { codigo: 'ASIENTOS_INSUFICIENTES' } });
      expect(reservasMock.validarMesasYAsientos).toHaveBeenCalledWith([3n, 4n], 10, false);

      await service.abrirPedido({ mesas: [3, 4], personas: 10, confirmarCapacidad: true, lineas: [], cliente: { nombre: 'Lucía' } });
      expect(reservasMock.validarMesasYAsientos).toHaveBeenLastCalledWith([3n, 4n], 10, true);
    });

    it('sumar mesas a un pedido abierto: crea las filas al final, reordena y pone el nombre con todas las mesas', async () => {
      prismaMock.pedido.findUnique.mockResolvedValue({
        id: 300n, codigo: 'P-0300', modalidad: 'MESA', estado: 'COLA',
        mesas: [{ mesa_id: 8n, abierta: true, principal: true, orden: 1, mesa: { numero: 8 }, mesa_nombre: 'Mesa 8' }],
      });
      prismaMock.elementoPlano.findMany.mockResolvedValue([mesaActiva(9n, 9), mesaActiva(10n, 10)]);
      prismaMock.pedidoMesa.findFirst.mockResolvedValue(null);
      prismaMock.pedidoMesa.findMany.mockResolvedValue([
        filaMesa(8n, 1n, 8, { principal: true, orden: 1 }),
        filaMesa(9n, 2n, 9, { orden: 2 }),
        filaMesa(10n, 3n, 10, { orden: 3 }),
      ]);

      const res = await service.agregarMesasPedido('300', ['9', '10'], { partyId: '7' } as any, '10.0.0.1');

      expect(prismaMock.pedidoMesa.create).toHaveBeenCalledTimes(2);
      expect(prismaMock.pedidoMesa.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ pedido_id: 300n, mesa_id: 9n, abierta: true, principal: false, orden: 2 }),
      });
      expect(prismaMock.pedido.update).toHaveBeenCalledWith({
        where: { id: 300n },
        data: { mesa_nombre: 'Mesas 8, 9 y 10' },
      });
      expect(auditoriaMock.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'AGREGAR_MESA', entidadId: 300n }));
      expect(eventosGatewayMock.emitirAdmin).toHaveBeenCalledWith('salon:mesa', { mesaId: '9', estado: 'OCUPADA' });
      expect(res).toMatchObject({ ok: true, pedidoId: '300', mesa: 'Mesas 8, 9 y 10' });
    });

    it('sumar una mesa que ya es del pedido -> 409 MESA_REPETIDA', async () => {
      prismaMock.pedido.findUnique.mockResolvedValue({
        id: 300n, codigo: 'P-0300', modalidad: 'MESA', estado: 'COLA',
        mesas: [{ mesa_id: 8n, abierta: true, principal: true, orden: 1, mesa: { numero: 8 } }],
      });

      await expect(service.agregarMesasPedido('300', ['8'])).rejects.toMatchObject({ response: { codigo: 'MESA_REPETIDA' } });
      expect(prismaMock.pedidoMesa.create).not.toHaveBeenCalled();
    });

    it('sumar hasta pasar de 6 mesas -> 400 MESAS_LIMITE', async () => {
      prismaMock.pedido.findUnique.mockResolvedValue({
        id: 300n, codigo: 'P-0300', modalidad: 'MESA', estado: 'COLA',
        mesas: [1, 2, 3, 4, 5].map((n, i) => ({ mesa_id: BigInt(n), abierta: true, principal: i === 0, orden: i + 1, mesa: { numero: n } })),
      });

      await expect(service.agregarMesasPedido('300', ['9', '10'])).rejects.toMatchObject({ response: { codigo: 'MESAS_LIMITE' } });
    });

    it('sumar una mesa ocupada por otro pedido -> 409 MESA_OCUPADA', async () => {
      prismaMock.pedido.findUnique.mockResolvedValue({
        id: 300n, codigo: 'P-0300', modalidad: 'MESA', estado: 'COLA',
        mesas: [{ mesa_id: 8n, abierta: true, principal: true, orden: 1, mesa: { numero: 8 } }],
      });
      prismaMock.elementoPlano.findMany.mockResolvedValue([mesaActiva(9n, 9)]);
      prismaMock.pedidoMesa.findFirst.mockResolvedValue({ mesa_id: 9n, abierta: true, mesa: { numero: 9 } });

      await expect(service.agregarMesasPedido('300', ['9'])).rejects.toMatchObject({
        response: { codigo: 'MESA_OCUPADA', mensaje: 'La mesa 9 ya está ocupada' },
      });
    });

    it('quitar una mesa libera solo esa y, si era la principal, la siguiente pasa a serlo', async () => {
      prismaMock.pedido.findUnique.mockResolvedValue({
        id: 300n, codigo: 'P-0300', modalidad: 'MESA', estado: 'COLA',
        mesas: [
          { id: 1n, mesa_id: 8n, abierta: true, principal: true, orden: 1, mesa: { numero: 8 } },
          { id: 2n, mesa_id: 9n, abierta: true, principal: false, orden: 2, mesa: { numero: 9 } },
        ],
      });
      prismaMock.pedidoMesa.findMany.mockResolvedValue([filaMesa(9n, 2n, 9, { principal: false, orden: 2 })]);

      const res = await service.quitarMesaPedido('300', '8', { partyId: '7' } as any);

      expect(prismaMock.pedidoMesa.update).toHaveBeenCalledWith({ where: { id: 1n }, data: { abierta: false } });
      expect(prismaMock.pedidoMesa.update).toHaveBeenCalledWith({ where: { id: 2n }, data: { principal: true, orden: 1 } });
      expect(prismaMock.pedido.update).toHaveBeenCalledWith({ where: { id: 300n }, data: { mesa_nombre: 'Mesa 9' } });
      expect(eventosGatewayMock.emitirAdmin).toHaveBeenCalledWith('salon:mesa', { mesaId: '8', estado: 'LIBRE' });
      expect(eventosGatewayMock.emitirAdmin).not.toHaveBeenCalledWith('salon:mesa', { mesaId: '9', estado: 'LIBRE' });
      expect(auditoriaMock.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'QUITAR_MESA' }));
      expect(res).toMatchObject({ ok: true, mesa: 'Mesa 9' });
    });

    it('no se puede quitar la única mesa -> 409 ULTIMA_MESA; una mesa que no es del pedido -> 404', async () => {
      prismaMock.pedido.findUnique.mockResolvedValue({
        id: 300n, codigo: 'P-0300', modalidad: 'MESA', estado: 'COLA',
        mesas: [{ id: 1n, mesa_id: 8n, abierta: true, principal: true, orden: 1, mesa: { numero: 8 } }],
      });
      await expect(service.quitarMesaPedido('300', '8')).rejects.toMatchObject({ response: { codigo: 'ULTIMA_MESA' } });

      await expect(service.quitarMesaPedido('300', '9')).rejects.toMatchObject({ response: { codigo: 'MESA_NO_EN_PEDIDO' } });
      expect(prismaMock.pedidoMesa.update).not.toHaveBeenCalled();
    });

    it('pedido anulado no admite sumar ni quitar mesas', async () => {
      prismaMock.pedido.findUnique.mockResolvedValue({
        id: 300n, codigo: 'P-0300', modalidad: 'MESA', estado: 'ANULADO',
        mesas: [{ mesa_id: 8n, abierta: true, mesa: { numero: 8 } }],
      });
      await expect(service.agregarMesasPedido('300', ['9'])).rejects.toMatchObject({ response: { codigo: 'ESTADO_INVALIDO' } });
      await expect(service.quitarMesaPedido('300', '8')).rejects.toMatchObject({ response: { codigo: 'ESTADO_INVALIDO' } });
    });

    it('cambiar una sola mesa del pedido (desdeMesaId) conserva su posición y no toca las demás', async () => {
      prismaMock.pedido.findUnique.mockResolvedValue({
        id: 300n, codigo: 'P-0300', modalidad: 'MESA', estado: 'COLA',
        mesas: [
          { id: 1n, mesa_id: 8n, abierta: true, principal: true, orden: 1, mesa: { numero: 8 } },
          { id: 2n, mesa_id: 6n, abierta: true, principal: false, orden: 2, mesa: { numero: 6 } },
        ],
      });
      prismaMock.elementoPlano.findUnique.mockResolvedValue(mesaActiva(9n, 9));
      prismaMock.pedidoMesa.findFirst.mockResolvedValue(null);
      prismaMock.pedidoMesa.findMany.mockResolvedValue([
        filaMesa(8n, 1n, 8, { principal: true, orden: 1 }),
        filaMesa(9n, 3n, 9, { orden: 2 }),
      ]);

      await service.cambiarMesaPedido('300', '9', undefined, undefined, '6');

      expect(prismaMock.pedidoMesa.update).toHaveBeenCalledWith({ where: { id: 2n }, data: { abierta: false } });
      expect(prismaMock.pedidoMesa.create).toHaveBeenCalledWith({
        data: { pedido_id: 300n, mesa_id: 9n, mesa_nombre: 'Mesa 9', abierta: true, principal: false, orden: 2 },
      });
      expect(prismaMock.pedidoMesa.updateMany).not.toHaveBeenCalledWith(expect.objectContaining({ data: { abierta: false } }));
      const libres = eventosGatewayMock.emitirAdmin.mock.calls.filter((c: any[]) => c[0] === 'salon:mesa' && c[1].estado === 'LIBRE');
      expect(libres).toEqual([['salon:mesa', { mesaId: '6', estado: 'LIBRE' }]]);
    });

    it('cambiar desde una mesa que no es del pedido -> 404 MESA_NO_EN_PEDIDO', async () => {
      prismaMock.pedido.findUnique.mockResolvedValue({
        id: 300n, codigo: 'P-0300', modalidad: 'MESA', estado: 'COLA',
        mesas: [{ id: 1n, mesa_id: 8n, abierta: true, principal: true, orden: 1, mesa: { numero: 8 } }],
      });
      prismaMock.elementoPlano.findUnique.mockResolvedValue(mesaActiva(9n, 9));

      await expect(service.cambiarMesaPedido('300', '9', undefined, undefined, '7')).rejects.toMatchObject({
        response: { codigo: 'MESA_NO_EN_PEDIDO' },
      });
    });
  });
});
