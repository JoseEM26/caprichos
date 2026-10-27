jest.mock('../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

import { RecordatorioReservasTarea } from '../servicios/recordatorio-reservas.tarea';
import { PrismaService } from '../../../comun/prisma/prisma.service';
import { RedisService } from '../../../comun/redis/redis.service';
import { Ventana24hService } from '../servicios/ventana-24h.service';
import { ReservasService } from '../../reservas/reservas.service';

describe('RecordatorioReservasTarea', () => {
  let tarea: RecordatorioReservasTarea;
  let mockPrisma: any;
  let mockRedisService: any;
  let mockVentana24h: any;
  let mockReservasService: any;

  beforeEach(() => {
    mockPrisma = {
      parametro: {
        findUnique: jest.fn(),
      },
      reserva: {
        findMany: jest.fn(),
        update: jest.fn(),
      },
    };

    mockRedisService = {
      obtenerCliente: jest.fn().mockReturnValue({
        set: jest.fn().mockResolvedValue('OK'),
        del: jest.fn().mockResolvedValue(1),
      }),
    };

    mockVentana24h = {
      enviarMensajeNegocio: jest.fn().mockResolvedValue({ id: 'wamid.123' }),
    };

    mockReservasService = {
      pasarNoAsistioVencidas: jest.fn().mockResolvedValue({ actualizadas: 1 }),
    };

    tarea = new RecordatorioReservasTarea(
      mockPrisma as PrismaService,
      mockRedisService as RedisService,
      mockVentana24h as Ventana24hService,
      mockReservasService as ReservasService,
    );
  });

  afterEach(() => {
    tarea.detener();
  });

  describe('esRecordatorioActivo', () => {
    it('retorna false si el parámetro no existe o es "no"', async () => {
      mockPrisma.parametro.findUnique.mockResolvedValue(null);
      expect(await tarea.esRecordatorioActivo()).toBe(false);

      mockPrisma.parametro.findUnique.mockResolvedValue({ clave: 'chatbot_reserva_recordatorio', valor: 'no' });
      expect(await tarea.esRecordatorioActivo()).toBe(false);
    });

    it('retorna true si el parámetro está en "si" o boolean true', async () => {
      mockPrisma.parametro.findUnique.mockResolvedValue({ clave: 'chatbot_reserva_recordatorio', valor: 'si' });
      expect(await tarea.esRecordatorioActivo()).toBe(true);

      mockPrisma.parametro.findUnique.mockResolvedValue({ clave: 'chatbot_reserva_recordatorio', valor: true });
      expect(await tarea.esRecordatorioActivo()).toBe(true);
    });
  });

  describe('ejecutarCiclo', () => {
    it('no envía recordatorios de 2h si chatbot_reserva_recordatorio es no (por defecto)', async () => {
      mockPrisma.parametro.findUnique.mockResolvedValue(null);
      mockPrisma.reserva.findMany.mockResolvedValue([]);

      const resultado = await tarea.ejecutarCiclo();
      expect(resultado.recordatoriosEnviados).toBe(0);
      expect(mockVentana24h.enviarMensajeNegocio).not.toHaveBeenCalled();
    });

    it('envía recordatorio 2h antes si el parámetro está activo y marca recordatorio_enviado una sola vez', async () => {
      mockPrisma.parametro.findUnique.mockResolvedValue({
        clave: 'chatbot_reserva_recordatorio',
        valor: 'si',
      });

      const ahora = new Date('2026-10-27T18:00:00.000Z');
      const horaReserva = new Date(ahora.getTime() + 120 * 60 * 1000); // 2 horas exactamente

      const mockReservas = [
        {
          id: 101n,
          nombre: 'Elena Torres',
          telefono: '987654321',
          personas: 4,
          hora: horaReserva,
          tolerancia_min: 15,
          estado: 'ACTIVA',
          recordatorio_enviado: false,
        },
      ];

      // Primera llamada: reservas para recordar. Segunda llamada: activas por vencer (vacío)
      mockPrisma.reserva.findMany
        .mockResolvedValueOnce(mockReservas)
        .mockResolvedValueOnce([]);

      mockPrisma.reserva.update.mockResolvedValue({ id: 101n, recordatorio_enviado: true });

      const resultado = await tarea.ejecutarCiclo(ahora);

      expect(resultado.recordatoriosEnviados).toBe(1);
      expect(mockVentana24h.enviarMensajeNegocio).toHaveBeenCalledWith(
        '51987654321',
        expect.objectContaining({
          plantillaClave: 'RESERVA_RECORDATORIO',
        }),
      );
      expect(mockPrisma.reserva.update).toHaveBeenCalledWith({
        where: { id: 101n },
        data: { recordatorio_enviado: true },
      });
    });

    it('notifica al cliente cuando la tolerancia de la reserva vence y se pasa a NO_ASISTIO', async () => {
      mockPrisma.parametro.findUnique.mockResolvedValue({
        clave: 'chatbot_reserva_recordatorio',
        valor: 'no',
      });

      const ahora = new Date('2026-10-27T20:20:00.000Z');
      const horaReserva = new Date('2026-10-27T20:00:00.000Z'); // Reserva a las 20:00, tolerancia 15m => expiró a las 20:15

      const mockActivas = [
        {
          id: 202n,
          nombre: 'Mario Vargas',
          telefono: '911223344',
          personas: 2,
          hora: horaReserva,
          tolerancia_min: 15,
          estado: 'ACTIVA',
        },
      ];

      mockPrisma.reserva.findMany.mockResolvedValue(mockActivas);

      const resultado = await tarea.ejecutarCiclo(ahora);

      expect(resultado.vencidosNotificados).toBe(1);
      expect(mockReservasService.pasarNoAsistioVencidas).toHaveBeenCalledWith(ahora);
      expect(mockVentana24h.enviarMensajeNegocio).toHaveBeenCalledWith(
        '51911223344',
        expect.objectContaining({
          plantillaClave: 'RESERVA_ACTUALIZACION',
        }),
      );
    });

    it('no ejecuta ciclos simultáneos si uno ya está en progreso', async () => {
      mockPrisma.parametro.findUnique.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(null), 50)),
      );
      mockPrisma.reserva.findMany.mockResolvedValue([]);

      const p1 = tarea.ejecutarCiclo();
      const p2 = tarea.ejecutarCiclo();

      const [res1, res2] = await Promise.all([p1, p2]);
      expect(res2).toEqual({ recordatoriosEnviados: 0, vencidosNotificados: 0 });
    });

    it('omite ejecución si otra réplica posee el candado distribuido en Redis', async () => {
      mockRedisService.obtenerCliente().set.mockResolvedValue(null);

      const res = await tarea.ejecutarCiclo();

      expect(res.bloqueadoPorOtraInstancia).toBe(true);
      expect(mockPrisma.reserva.findMany).not.toHaveBeenCalled();
    });
  });
});
