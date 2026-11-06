jest.mock('../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

import { RecordatorioReservasTarea } from '../servicios/recordatorio-reservas.tarea';
import { PrismaService } from '../../../comun/prisma/prisma.service';
import { RedisService } from '../../../comun/redis/redis.service';
import { Ventana24hService } from '../servicios/ventana-24h.service';
import { ReservasService } from '../../reservas/reservas.service';

const mockOutbox: any = { encolar: jest.fn().mockResolvedValue(true), despertar: jest.fn(), procesarLote: jest.fn().mockResolvedValue({}), limpiar: jest.fn().mockResolvedValue({}) };

describe('RecordatorioReservasTarea', () => {
  let tarea: RecordatorioReservasTarea;
  let mockPrisma: any;
  let mockRedisService: any;
  let mockVentana24h: any;
  let mockReservasService: any;

  beforeEach(() => {
    mockPrisma = {
      $transaction: jest.fn(async (fn: any) => fn(mockPrisma)),
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
      mockOutbox,
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
      const horaReserva = new Date(ahora.getTime() + 30 * 60 * 1000); // 30 min exactamente

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
          mesas: [{ mesa_id: 1n, mesa: { nombre: null, numero: 3 } }],
        },
      ];

      // Primera llamada: reservas para recordar. Segunda llamada: activas por vencer (vacío)
      mockPrisma.reserva.findMany
        .mockResolvedValueOnce(mockReservas)
        .mockResolvedValueOnce([]);

      mockPrisma.reserva.update.mockResolvedValue({ id: 101n, recordatorio_enviado: true });

      const resultado = await tarea.ejecutarCiclo(ahora);

      expect(resultado.recordatoriosEnviados).toBe(1);
      expect(mockOutbox.encolar).toHaveBeenCalledWith(expect.objectContaining({ telefono: '51987654321', carga: expect.objectContaining({ plantillaClave: 'RESERVA_RECORDATORIO' }) }), expect.anything());
      const textoEnviado = mockOutbox.encolar.mock.calls.at(-1)[0].carga.textoLibre as string;
      expect(textoEnviado).toContain('en 30 min');
      expect(textoEnviado).toContain('Mesa 3');
      expect(mockPrisma.reserva.update).toHaveBeenCalledWith({
        where: { id: 101n },
        data: { recordatorio_enviado: true },
      });
    });

    it('la búsqueda del recordatorio es solo la ventana hasta reserva_recordatorio_min (30 por defecto)', async () => {
      mockPrisma.parametro.findUnique.mockResolvedValue({ clave: 'chatbot_reserva_recordatorio', valor: 'si' });
      mockPrisma.reserva.findMany.mockResolvedValue([]);

      const ahora = new Date('2026-10-27T18:00:00.000Z');
      await tarea.ejecutarCiclo(ahora);

      const where = mockPrisma.reserva.findMany.mock.calls[0][0].where;
      expect(where.estado).toBe('ACTIVA');
      expect(where.recordatorio_enviado).toBe(false);
      expect(where.hora.gte).toEqual(ahora);
      expect(where.hora.lte).toEqual(new Date(ahora.getTime() + 30 * 60 * 1000));
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
      expect(mockOutbox.encolar).toHaveBeenCalledWith(expect.objectContaining({ telefono: '51911223344', carga: expect.objectContaining({ plantillaClave: 'RESERVA_ACTUALIZACION' }) }));
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
