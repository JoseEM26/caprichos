jest.mock('../../../comun/socket/eventos.gateway', () => ({
  EventosGateway: class {
    emitirAdmin = jest.fn();
  },
}));

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ReservasService } from '../reservas.service';
import { PrismaService } from '../../../comun/prisma/prisma.service';
import { AuditoriaService } from '../../auditoria/auditoria.service';
import { EventosGateway } from '../../../comun/socket/eventos.gateway';
import { Ventana24hService } from '../../chatbot/servicios/ventana-24h.service';
import { UsuarioAutenticado } from '../../acceso/acceso.tipos';
import { horaToDate } from '../../local/local.util';
import { OutboxWhatsappService } from '../../chatbot/servicios/outbox-whatsapp.service';


const outboxMock = { encolar: jest.fn().mockResolvedValue(true), despertar: jest.fn(), limpiar: jest.fn(), resumen: jest.fn() };

describe('ReservasService - Solicitudes y Disponibilidad WhatsApp', () => {
  let service: ReservasService;
  let prisma: any;
  let auditoria: any;
  let eventosGateway: any;
  let ventana24hService: any;

  const mockUsuario: UsuarioAutenticado = {
    partyId: 10n,
    rol: 'ADMIN',
    debeCambiar: false,
  };

  beforeEach(async () => {
    prisma = {
      solicitudReserva: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      reserva: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      reservaMesa: {
        createMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      elementoPlano: {
        findMany: jest.fn(),
      },
      parametro: {
        findUnique: jest.fn(),
      },
      fechaEspecial: {
        findUnique: jest.fn(),
      },
      horarioDia: {
        findUnique: jest.fn(),
      },
      mensajeChat: {
        create: jest.fn().mockResolvedValue({ id: 101n }),
      },
      $transaction: jest.fn((cb) => cb(prisma)),
    };

    auditoria = {
      registrar: jest.fn().mockResolvedValue(true),
    };

    eventosGateway = {
      emitirAdmin: jest.fn(),
    };

    ventana24hService = {
      enviarMensajeNegocio: jest.fn().mockResolvedValue({ id: 'wamid.123' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReservasService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditoriaService, useValue: auditoria },
        { provide: EventosGateway, useValue: eventosGateway },
        { provide: Ventana24hService, useValue: ventana24hService },
        { provide: OutboxWhatsappService, useValue: outboxMock },
      ],
    }).compile();

    service = module.get<ReservasService>(ReservasService);
  });

  describe('obtenerFranjasDisponibles', () => {
    it('retorna arreglo vacío si la fecha es pasada', async () => {
      // Fecha en el pasado
      const franjas = await service.obtenerFranjasDisponibles('2020-01-01', 4);
      expect(franjas).toEqual([]);
    });

    it('retorna arreglo vacío si el local está cerrado ese día por horarioDia', async () => {
      const fechaFutura = '2026-11-15'; // Domingo futuro
      prisma.fechaEspecial.findUnique.mockResolvedValue(null);
      prisma.horarioDia.findUnique.mockResolvedValue({
        dia_semana: 0,
        cerrado: true,
      });

      const franjas = await service.obtenerFranjasDisponibles(fechaFutura, 2);
      expect(franjas).toEqual([]);
    });

    it('retorna arreglo vacío si el local está cerrado por fechaEspecial', async () => {
      const fechaFutura = '2026-12-25';
      prisma.fechaEspecial.findUnique.mockResolvedValue({
        fecha: new Date('2026-12-25T00:00:00.000Z'),
        cerrado: true,
      });

      const franjas = await service.obtenerFranjasDisponibles(fechaFutura, 2);
      expect(franjas).toEqual([]);
    });

    it('genera franjas de 30 minutos dentro del horario de atención excluyendo mesas ocupadas', async () => {
      const fechaFutura = '2026-11-10'; // Martes futuro
      prisma.fechaEspecial.findUnique.mockResolvedValue(null);
      prisma.horarioDia.findUnique.mockResolvedValue({
        dia_semana: 2,
        cerrado: false,
        abre: horaToDate('12:00'),
        cierra: horaToDate('15:00'), // Entre 13:00 y 14:00 (1h despues de abrir, 1h antes de cerrar)
      });

      // Mesas del local
      prisma.elementoPlano.findMany.mockResolvedValue([
        { id: 1n, tipo: 'MESA', activo: true, asientos: 4 },
        { id: 2n, tipo: 'MESA', activo: true, asientos: 2 },
      ]);
      prisma.parametro.findUnique.mockResolvedValue({ clave: 'reserva_tolerancia_min', valor: 15 });

      // Sin reservas existentes
      prisma.reserva.findMany.mockResolvedValue([]);

      const franjas = await service.obtenerFranjasDisponibles(fechaFutura, 2);
      expect(franjas.length).toBeGreaterThan(0);
      expect(typeof franjas[0]).toBe('string');
      expect(franjas[0]).toMatch(/^\d{2}:\d{2}$/);
    });
  });

  describe('listarSolicitudes', () => {
    it('retorna solicitudes serializadas filtradas por estado', async () => {
      const mockSolicitudes = [
        {
          id: 1n,
          conversacion_id: 10n,
          personas: 4,
          hora: new Date('2026-10-28T20:00:00-05:00'),
          estado: 'PENDIENTE',
          origen: 'WHATSAPP',
          nombre: 'Ana Lima',
          telefono: '987654321',
          nota: 'Cumpleaños',
          motivo_rechazo: null,
          reserva_id: null,
          creado_en: new Date(),
          conversacion: {
            id: 10n,
            nombre_contacto: 'Ana Lima',
            telefono: '987654321',
          },
        },
      ];

      prisma.solicitudReserva.findMany.mockResolvedValue(mockSolicitudes);

      const resultado = await service.listarSolicitudes({ estado: 'PENDIENTE' });
      expect(resultado).toHaveLength(1);
      expect(resultado[0].id).toBe('1');
      expect(resultado[0].nombre).toBe('Ana Lima');
      expect(resultado[0].estado).toBe('pendiente');
    });
  });

  describe('aprobarSolicitud', () => {
    it('lanza NotFoundException si la solicitud no existe', async () => {
      prisma.solicitudReserva.findUnique.mockResolvedValue(null);

      await expect(
        service.aprobarSolicitud(999, { mesas: [1] }, mockUsuario, '127.0.0.1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('lanza BadRequestException si la solicitud no está PENDIENTE', async () => {
      prisma.solicitudReserva.findUnique.mockResolvedValue({
        id: 1n,
        estado: 'APROBADA',
      });

      await expect(
        service.aprobarSolicitud(1, { mesas: [1] }, mockUsuario, '127.0.0.1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('aprueba la solicitud, crea la reserva, audita, emite socket y notifica al cliente por WhatsApp', async () => {
      const horaFutura = new Date('2026-11-20T20:00:00-05:00');
      const mockSolicitud = {
        id: 5n,
        conversacion_id: 20n,
        personas: 3,
        hora: horaFutura,
        estado: 'PENDIENTE',
        origen: 'WHATSAPP',
        nombre: 'Carlos Díaz',
        telefono: '912345678',
        nota: 'Silla de bebé',
        motivo_rechazo: null,
        reserva_id: null,
        creado_en: new Date(),
        conversacion: {
          id: 20n,
          nombre_contacto: 'Carlos Díaz',
          telefono: '912345678',
        },
      };

      prisma.solicitudReserva.findUnique.mockResolvedValue(mockSolicitud);

      // Mock de crear reserva
      prisma.fechaEspecial.findUnique.mockResolvedValue(null);
      prisma.horarioDia.findUnique.mockResolvedValue({
        dia_semana: 5,
        cerrado: false,
        abre: horaToDate('14:00'),
        cierra: horaToDate('23:00'),
      });
      prisma.elementoPlano.findMany.mockResolvedValue([
        { id: 1n, tipo: 'MESA', activo: true, asientos: 4 },
      ]);
      prisma.parametro.findUnique.mockResolvedValue({ clave: 'reserva_tolerancia_min', valor: 15 });

      const mockReservaCreada = {
        id: 77n,
        nombre: 'Carlos Díaz',
        telefono: '912345678',
        personas: 3,
        hora: horaFutura,
        tolerancia_min: 15,
        estado: 'ACTIVA',
        motivo_cancelacion: null,
        pedido_id: null,
        mesas: [{ id: 1n, mesa_id: 1n, mesa: { numero: 5, nombre: 'Mesa 5', asientos: 4 } }],
      };
      prisma.reserva.create.mockResolvedValue(mockReservaCreada);
      prisma.reservaMesa.createMany.mockResolvedValue({ count: 1 });

      // Mock de update de solicitud
      prisma.solicitudReserva.update.mockResolvedValue({
        ...mockSolicitud,
        estado: 'APROBADA',
        reserva_id: 77n,
      });

      const res = await service.aprobarSolicitud(
        5,
        { mesas: [1] },
        mockUsuario,
        '127.0.0.1',
      );

      expect(res.solicitud.estado).toBe('aprobada');
      expect(res.solicitud.reserva_id).toBe('77');
      expect(res.reserva.id).toBe('77');

      // Verifica auditoría
      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'APROBAR_SOLICITUD',
          entidad: 'solicitud_reserva',
          resultado: 'OK',
        }),
      );

      // Verifica socket emitido
      expect(eventosGateway.emitirAdmin).toHaveBeenCalledWith(
        'reserva:solicitud_cambio',
        expect.objectContaining({
          tipo: 'APROBADA',
          solicitudId: '5',
          reservaId: '77',
        }),
      );

      // Verifica mensaje enviado por WhatsApp
      expect(outboxMock.encolar).toHaveBeenCalledWith(
        expect.objectContaining({
          telefono: '912345678',
          carga: expect.objectContaining({ plantillaClave: 'RESERVA_CONFIRMADA' }),
        }), expect.anything(),
      );
    });
  });

  describe('aprobarSolicitud: hora y validaciones', () => {
    const horaVencida = new Date('2020-01-01T01:00:00.000Z');
    const horaFutura = '2099-01-10T20:00:00-05:00';

    const solicitudPendiente = (hora: Date, personas = 2) => ({
      id: 9n,
      conversacion_id: null,
      personas,
      hora,
      estado: 'PENDIENTE',
      origen: 'WHATSAPP',
      nombre: 'Lucía Ramos',
      telefono: '912345678',
      nota: null,
      motivo_rechazo: null,
      reserva_id: null,
      creado_en: new Date(),
      conversacion: null,
    });

    beforeEach(() => {
      outboxMock.encolar.mockClear();
      prisma.fechaEspecial.findUnique.mockResolvedValue(null);
      prisma.horarioDia.findUnique.mockResolvedValue({
        dia_semana: 6,
        cerrado: false,
        abre: horaToDate('10:00'),
        cierra: horaToDate('23:00'),
      });
      prisma.elementoPlano.findMany.mockResolvedValue([
        { id: 1n, tipo: 'MESA', activo: true, asientos: 4 },
      ]);
      prisma.parametro.findUnique.mockResolvedValue({ clave: 'reserva_tolerancia_min', valor: 15 });
      prisma.reserva.create.mockImplementation(async ({ data }: any) => ({
        id: 88n,
        nombre: data.nombre,
        telefono: data.telefono,
        personas: data.personas,
        hora: data.hora,
        tolerancia_min: 15,
        estado: 'ACTIVA',
        motivo_cancelacion: null,
        pedido_id: null,
        mesas: [],
      }));
    });

    it('hora de la solicitud ya pasada -> HORA_PASADA accionable y la solicitud sigue PENDIENTE', async () => {
      prisma.solicitudReserva.findUnique.mockResolvedValue(solicitudPendiente(horaVencida));

      await expect(
        service.aprobarSolicitud(9, { mesas: ['1'] }, mockUsuario, '127.0.0.1'),
      ).rejects.toMatchObject({
        response: {
          codigo: 'HORA_PASADA',
          mensaje: 'La hora solicitada ya pasó. Elige una hora nueva para aprobar la reserva.',
        },
      });

      expect(prisma.reserva.create).not.toHaveBeenCalled();
      expect(prisma.solicitudReserva.update).not.toHaveBeenCalled();
      expect(outboxMock.encolar).not.toHaveBeenCalled();
    });

    it('dto.hora futura reemplaza la hora vencida: aprueba con esa hora y encola el aviso', async () => {
      prisma.solicitudReserva.findUnique.mockResolvedValue(solicitudPendiente(horaVencida));

      const res = await service.aprobarSolicitud(
        9,
        { mesas: ['1'], hora: horaFutura },
        mockUsuario,
        '127.0.0.1',
      );

      expect(prisma.reserva.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ hora: new Date(horaFutura) }),
        }),
      );
      expect(res.reserva.hora).toBe(new Date(horaFutura).toISOString());
      expect(res.solicitud.estado).toBe('aprobada');
      expect(outboxMock.encolar).toHaveBeenCalledWith(
        expect.objectContaining({ telefono: '912345678' }),
        expect.anything(),
      );
    });

    it('mesas sin asientos suficientes -> ASIENTOS_INSUFICIENTES, no escribe y la solicitud sigue PENDIENTE', async () => {
      prisma.elementoPlano.findMany.mockResolvedValue([
        { id: 1n, tipo: 'MESA', activo: true, asientos: 2 },
      ]);
      prisma.solicitudReserva.findUnique.mockResolvedValue(
        solicitudPendiente(new Date(horaFutura), 4),
      );

      await expect(
        service.aprobarSolicitud(9, { mesas: ['1'] }, mockUsuario, '127.0.0.1'),
      ).rejects.toMatchObject({
        response: { codigo: 'ASIENTOS_INSUFICIENTES', mensaje: 'Faltan 2 asientos' },
      });

      expect(prisma.reserva.create).not.toHaveBeenCalled();
      expect(prisma.solicitudReserva.update).not.toHaveBeenCalled();
      expect(outboxMock.encolar).not.toHaveBeenCalled();
    });

    // Simula la fila real de solicitud_reserva y una transacción que deshace lo escrito si falla.
    const simularBdConFila = () => {
      let estadoFila = 'PENDIENTE';
      let reservasEnBd: any[] = [];
      prisma.solicitudReserva.findUnique.mockImplementation(async () => ({
        ...solicitudPendiente(new Date(horaFutura)),
        estado: estadoFila,
      }));
      prisma.solicitudReserva.updateMany.mockImplementation(async ({ where, data }: any) => {
        if (where.estado !== estadoFila) return { count: 0 };
        estadoFila = data.estado;
        return { count: 1 };
      });
      prisma.reserva.create.mockImplementation(async ({ data }: any) => {
        const r = {
          id: BigInt(100 + reservasEnBd.length),
          nombre: data.nombre,
          telefono: data.telefono,
          personas: data.personas,
          hora: data.hora,
          tolerancia_min: 15,
          estado: 'ACTIVA',
          motivo_cancelacion: null,
          pedido_id: null,
          mesas: [],
        };
        reservasEnBd.push(r);
        return r;
      });
      prisma.$transaction = jest.fn(async (cb: any) => {
        const antes = reservasEnBd.length;
        try {
          return await cb(prisma);
        } catch (err) {
          reservasEnBd = reservasEnBd.slice(0, antes);
          throw err;
        }
      });
      return { reservasEnBd: () => reservasEnBd, estadoFila: () => estadoFila };
    };

    it('dos aprobaciones seguidas de la misma solicitud: una gana, la otra SOLICITUD_NO_PENDIENTE y no queda reserva extra', async () => {
      const bd = simularBdConFila();

      const [primera, segunda] = await Promise.allSettled([
        service.aprobarSolicitud(9, { mesas: ['1'] }, mockUsuario, '127.0.0.1'),
        service.aprobarSolicitud(9, { mesas: ['1'] }, mockUsuario, '127.0.0.1'),
      ]);

      expect(primera.status).toBe('fulfilled');
      expect(segunda.status).toBe('rejected');
      expect((segunda as PromiseRejectedResult).reason).toMatchObject({
        response: { codigo: 'SOLICITUD_NO_PENDIENTE' },
      });
      expect(bd.reservasEnBd()).toHaveLength(1);
      expect(bd.estadoFila()).toBe('APROBADA');
      expect(outboxMock.encolar).toHaveBeenCalledTimes(1);
    });

    it('segunda aprobación después de la primera: SOLICITUD_NO_PENDIENTE sin crear otra reserva', async () => {
      const bd = simularBdConFila();

      await service.aprobarSolicitud(9, { mesas: ['1'] }, mockUsuario, '127.0.0.1');
      await expect(
        service.aprobarSolicitud(9, { mesas: ['1'] }, mockUsuario, '127.0.0.1'),
      ).rejects.toMatchObject({ response: { codigo: 'SOLICITUD_NO_PENDIENTE' } });

      expect(bd.reservasEnBd()).toHaveLength(1);
      expect(outboxMock.encolar).toHaveBeenCalledTimes(1);
    });
  });

  describe('rechazarSolicitud', () => {
    it('lanza BadRequestException si no se envía motivo o tiene menos de 5 caracteres', async () => {
      await expect(
        service.rechazarSolicitud(1, { motivo: 'no' }, mockUsuario, '127.0.0.1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('lanza NotFoundException si la solicitud no existe', async () => {
      prisma.solicitudReserva.findUnique.mockResolvedValue(null);

      await expect(
        service.rechazarSolicitud(99, { motivo: 'Local lleno para esa fecha' }, mockUsuario, '127.0.0.1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('rechaza la solicitud con motivo, audita, emite socket y notifica al cliente con alternativas', async () => {
      const horaFutura = new Date('2026-11-20T20:00:00-05:00');
      const mockSolicitud = {
        id: 8n,
        conversacion_id: 30n,
        personas: 6,
        hora: horaFutura,
        estado: 'PENDIENTE',
        origen: 'WHATSAPP',
        nombre: 'Lucía Méndez',
        telefono: '998877665',
        nota: null,
        motivo_rechazo: null,
        reserva_id: null,
        creado_en: new Date(),
        conversacion: {
          id: 30n,
          nombre_contacto: 'Lucía Méndez',
          telefono: '998877665',
        },
      };

      prisma.solicitudReserva.findUnique.mockResolvedValue(mockSolicitud);
      prisma.solicitudReserva.update.mockResolvedValue({
        ...mockSolicitud,
        estado: 'RECHAZADA',
        motivo_rechazo: 'Aforo completo en ese horario',
      });

      const res = await service.rechazarSolicitud(
        8,
        {
          motivo: 'Aforo completo en ese horario',
          alternativas: '18:00 o 21:30',
        },
        mockUsuario,
        '127.0.0.1',
      );

      expect(res.estado).toBe('rechazada');
      expect(res.motivo_rechazo).toBe('Aforo completo en ese horario');

      // Verifica auditoría
      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'RECHAZAR_SOLICITUD',
          entidad: 'solicitud_reserva',
          resultado: 'OK',
        }),
      );

      // Verifica socket emitido
      expect(eventosGateway.emitirAdmin).toHaveBeenCalledWith(
        'reserva:solicitud_cambio',
        expect.objectContaining({
          tipo: 'RECHAZADA',
          solicitudId: '8',
          motivo: 'Aforo completo en ese horario',
        }),
      );

      // Verifica WhatsApp al cliente
      expect(outboxMock.encolar).toHaveBeenCalledWith(
        expect.objectContaining({
          telefono: '998877665',
          carga: expect.objectContaining({ plantillaClave: 'RESERVA_ACTUALIZACION' }),
        }), expect.anything(),
      );
    });
  });
});
