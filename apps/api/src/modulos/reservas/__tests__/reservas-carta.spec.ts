jest.mock('../../../comun/socket/eventos.gateway', () => ({
  EventosGateway: class {
    emitirAdmin = jest.fn();
  },
}));

import { BadRequestException, HttpException } from '@nestjs/common';
import { ReservasCartaService, RESERVA_WEB_MAX_POR_IP, RESERVA_WEB_VENTANA_IP_SEG } from '../reservas-carta.service';
import { ReservasCartaController } from '../reservas-carta.controller';
import { CrearSolicitudWebDto } from '../dto/crear-solicitud-web.dto';

// Jueves 5 de noviembre de 2026, 15:00 en Lima
const AHORA = new Date('2026-11-05T15:00:00-05:00');

function dtoBase(extra: Partial<CrearSolicitudWebDto> = {}): CrearSolicitudWebDto {
  return Object.assign(new CrearSolicitudWebDto(), {
    nombre: 'Ana Quispe',
    telefono: '987654321',
    personas: 2,
    fecha: '2026-11-07',
    hora: '19:30',
    ...extra,
  });
}

describe('ReservasCartaService (carta web)', () => {
  let servicio: ReservasCartaService;
  let prisma: any;
  let redis: any;
  let reservas: any;
  let eventos: any;

  beforeEach(() => {
    prisma = {
      parametro: { findUnique: jest.fn().mockResolvedValue(null) },
      elementoPlano: { findMany: jest.fn().mockResolvedValue([{ asientos: 4 }, { asientos: 4 }]) },
      solicitudReserva: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({ id: 5n }),
      },
      notificacion: { create: jest.fn().mockResolvedValue({ id: 9n }) },
      horarioDia: { findMany: jest.fn().mockResolvedValue([]) },
      fechaEspecial: { findMany: jest.fn().mockResolvedValue([]) },
    };
    redis = {
      incr: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
    };
    reservas = { validarHorarioAtencion: jest.fn().mockResolvedValue(undefined) };
    eventos = { emitirAdmin: jest.fn() };
    servicio = new ReservasCartaService(prisma, reservas, { obtenerCliente: () => redis } as any, eventos);
  });

  const parametros = (valores: Record<string, unknown>) =>
    prisma.parametro.findUnique.mockImplementation(({ where }: any) =>
      Promise.resolve(where.clave in valores ? { clave: where.clave, valor: valores[where.clave] } : null),
    );

  const codigoDe = async (promesa: Promise<unknown>) => {
    try {
      await promesa;
    } catch (err: any) {
      return err.getResponse?.().codigo;
    }
    return null;
  };

  it('crea una solicitud PENDIENTE sin conversación, notifica a Caja y Salón y responde el resumen', async () => {
    const res = await servicio.crear(dtoBase({ nota: '  Mesa junto a la ventana  ' }), '10.0.0.1', AHORA);

    expect(prisma.solicitudReserva.create).toHaveBeenCalledWith({
      data: {
        conversacion_id: null,
        personas: 2,
        hora: new Date('2026-11-07T19:30:00-05:00'),
        estado: 'PENDIENTE',
        nombre: 'Ana Quispe',
        telefono: '987654321',
        nota: 'Mesa junto a la ventana',
      },
    });
    expect(prisma.notificacion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tipo: 'RESERVA_NUEVA',
        rol_destino: null,
        enlace: '/admin/reservas',
        titulo: 'Reserva nueva para 2 personas, sáb, 7 nov 19:30',
      }),
    });
    expect(eventos.emitirAdmin).toHaveBeenCalledWith('notificaciones:nueva', expect.objectContaining({ id: '9' }));
    expect(eventos.emitirAdmin).toHaveBeenCalledWith('reserva:solicitud_nueva', expect.objectContaining({ id: '5', personas: 2 }));
    expect(res).toEqual({ ok: true, solicitudId: '5', resumen: { personas: 2, fechaTexto: 'sáb, 7 nov', hora: '19:30' } });
  });

  it('no envía ningún WhatsApp al pedir la reserva (solo la campana para el local)', async () => {
    await servicio.crear(dtoBase(), '10.0.0.1', AHORA);
    // El servicio no depende del outbox de WhatsApp: solo escribe la solicitud y la notificación interna
    expect(Object.keys(servicio)).not.toContain('outbox');
    expect(prisma.solicitudReserva.create).toHaveBeenCalledTimes(1);
  });

  it('rechaza con LIMITE_PENDIENTES cuando el celular ya tiene el máximo de solicitudes pendientes', async () => {
    prisma.solicitudReserva.count.mockResolvedValue(2);
    expect(await codigoDe(servicio.crear(dtoBase(), '10.0.0.1', AHORA))).toBe('LIMITE_PENDIENTES');
    expect(prisma.solicitudReserva.count).toHaveBeenCalledWith({ where: { telefono: '987654321', estado: 'PENDIENTE' } });
    expect(prisma.solicitudReserva.create).not.toHaveBeenCalled();
  });

  it('respeta el parámetro reserva_web_max_pendientes', async () => {
    parametros({ reserva_web_max_pendientes: 3 });
    prisma.solicitudReserva.count.mockResolvedValue(2);
    await expect(servicio.crear(dtoBase(), '10.0.0.1', AHORA)).resolves.toMatchObject({ ok: true });
  });

  it('rechaza con FUERA_DE_HORARIO usando la validación de horario del formulario del admin', async () => {
    reservas.validarHorarioAtencion.mockRejectedValue(
      new BadRequestException({ codigo: 'FUERA_DE_HORARIO', mensaje: 'El local no atiende en el día de la semana seleccionado' }),
    );
    expect(await codigoDe(servicio.crear(dtoBase(), '10.0.0.1', AHORA))).toBe('FUERA_DE_HORARIO');
    expect(prisma.solicitudReserva.create).not.toHaveBeenCalled();
  });

  it('rechaza con HORA_PASADA cuando la hora ya pasó', async () => {
    expect(await codigoDe(servicio.crear(dtoBase({ fecha: '2026-11-05', hora: '14:00' }), '10.0.0.1', AHORA))).toBe('HORA_PASADA');
    expect(prisma.solicitudReserva.create).not.toHaveBeenCalled();
  });

  it('rechaza una fecha que no existe (31 de febrero) como VALIDACION', async () => {
    expect(await codigoDe(servicio.crear(dtoBase({ fecha: '2026-02-31' }), '10.0.0.1', AHORA))).toBe('VALIDACION');
  });

  it('rechaza más días de anticipación que reserva_web_dias_max', async () => {
    parametros({ reserva_web_dias_max: 7 });
    expect(await codigoDe(servicio.crear(dtoBase({ fecha: '2026-11-20' }), '10.0.0.1', AHORA))).toBe('VALIDACION');
  });

  it('rechaza un celular que no es peruano de 9 dígitos con VALIDACION', async () => {
    expect(await codigoDe(servicio.crear(dtoBase({ telefono: '812345678' }), '10.0.0.1', AHORA))).toBe('VALIDACION');
    expect(prisma.solicitudReserva.create).not.toHaveBeenCalled();
  });

  it('rechaza con DEMASIADAS_PERSONAS por encima del tope (suma de asientos si no hay parámetro)', async () => {
    // Dos mesas de 4 asientos: tope 8
    expect(await codigoDe(servicio.crear(dtoBase({ personas: 9 }), '10.0.0.1', AHORA))).toBe('DEMASIADAS_PERSONAS');
  });

  it('usa reserva_web_max_personas cuando está configurado', async () => {
    parametros({ reserva_web_max_personas: 12 });
    await expect(servicio.crear(dtoBase({ personas: 10 }), '10.0.0.1', AHORA)).resolves.toMatchObject({ ok: true });
  });

  it('responde RESERVAS_DESACTIVADAS cuando reserva_web_activa es «no»', async () => {
    parametros({ reserva_web_activa: 'no' });
    expect(await codigoDe(servicio.crear(dtoBase(), '10.0.0.1', AHORA))).toBe('RESERVAS_DESACTIVADAS');
    expect(prisma.solicitudReserva.create).not.toHaveBeenCalled();
  });

  it('limita por IP: la sexta solicitud en 10 minutos responde 429', async () => {
    redis.incr.mockResolvedValue(RESERVA_WEB_MAX_POR_IP + 1);
    const err = await servicio.crear(dtoBase(), '10.0.0.1', AHORA).catch((e) => e);
    expect(err).toBeInstanceOf(HttpException);
    expect(err.getStatus()).toBe(429);
    expect(err.getResponse().codigo).toBe('DEMASIADOS_INTENTOS');
    expect(prisma.solicitudReserva.create).not.toHaveBeenCalled();
  });

  it('abre la ventana de 10 minutos en la primera solicitud de la IP', async () => {
    await servicio.crear(dtoBase(), '10.0.0.1', AHORA);
    expect(redis.incr).toHaveBeenCalledWith('reservas:web:ip:10.0.0.1');
    expect(redis.expire).toHaveBeenCalledWith('reservas:web:ip:10.0.0.1', RESERVA_WEB_VENTANA_IP_SEG);
    expect(RESERVA_WEB_VENTANA_IP_SEG).toBe(600);
  });

  it('si Redis no responde, deja pasar la solicitud (el límite por celular sigue en la base)', async () => {
    redis.incr.mockRejectedValue(new Error('connection refused'));
    await expect(servicio.crear(dtoBase(), '10.0.0.1', AHORA)).resolves.toMatchObject({ ok: true });
  });

  it('el campo trampa lleno responde OK sin guardar nada', async () => {
    const res = await servicio.crear(dtoBase({ empresa: 'Bot SA' }), '10.0.0.1', AHORA);
    expect(res).toMatchObject({ ok: true, solicitudId: null });
    expect(prisma.solicitudReserva.create).not.toHaveBeenCalled();
    expect(prisma.notificacion.create).not.toHaveBeenCalled();
  });

  it('si la notificación falla, la solicitud queda guardada y se responde OK', async () => {
    prisma.notificacion.create.mockRejectedValue(new Error('db caída'));
    await expect(servicio.crear(dtoBase(), '10.0.0.1', AHORA)).resolves.toMatchObject({ ok: true, solicitudId: '5' });
  });

  describe('opciones', () => {
    it('devuelve días abiertos con dia 0 = domingo, fechas cerradas y horas especiales', async () => {
      parametros({ reserva_web_dias_max: 14, reserva_web_max_personas: 6 });
      prisma.horarioDia.findMany.mockResolvedValue([
        { dia_semana: 1, abre: new Date('1970-01-01T12:00:00Z'), cierra: new Date('1970-01-01T23:00:00Z'), cerrado: false },
        { dia_semana: 7, abre: null, cierra: null, cerrado: true },
      ]);
      prisma.fechaEspecial.findMany.mockResolvedValue([
        { fecha: new Date('2026-11-10T00:00:00Z'), cerrado: true, abre: null, cierra: null },
        { fecha: new Date('2026-11-11T00:00:00Z'), cerrado: false, abre: new Date('1970-01-01T14:00:00Z'), cierra: new Date('1970-01-01T22:00:00Z') },
      ]);

      const op = await servicio.opciones(AHORA);

      expect(op).toEqual({
        activa: true,
        diasMax: 14,
        personasMax: 6,
        horarios: [{ dia: 1, abre: '12:00', cierra: '23:00' }],
        fechasCerradas: ['2026-11-10'],
        fechasEspeciales: [{ fecha: '2026-11-11', abre: '14:00', cierra: '22:00' }],
      });
    });

    it('con reserva_web_activa en «no» responde activa false sin horarios', async () => {
      parametros({ reserva_web_activa: 'no' });
      const op = await servicio.opciones(AHORA);
      expect(op.activa).toBe(false);
      expect(prisma.horarioDia.findMany).not.toHaveBeenCalled();
    });
  });
});

describe('ReservasCartaController (validación del cuerpo)', () => {
  it('responde VALIDACION con el primer mensaje en español cuando faltan datos', async () => {
    const servicioFalso = { crear: jest.fn() } as any;
    const controlador = new ReservasCartaController(servicioFalso);
    const err = await controlador.crear({ nombre: 'A', telefono: '987654321', personas: 2, fecha: '2026-11-07', hora: '19:30' } as any, { ip: '1.1.1.1' } as any).catch((e) => e);
    expect(err).toBeInstanceOf(BadRequestException);
    expect(err.getResponse()).toEqual({ codigo: 'VALIDACION', mensaje: 'El nombre debe tener entre 2 y 60 caracteres' });
    expect(servicioFalso.crear).not.toHaveBeenCalled();
  });

  it('pasa el DTO limpio (nombre recortado) al servicio cuando es válido', async () => {
    const servicioFalso = { crear: jest.fn().mockResolvedValue({ ok: true }) } as any;
    const controlador = new ReservasCartaController(servicioFalso);
    await controlador.crear({ nombre: '  Ana Quispe ', telefono: '987654321', personas: '3', fecha: '2026-11-07', hora: '19:30' } as any, { ip: '1.1.1.1' } as any);
    const dto = servicioFalso.crear.mock.calls[0][0];
    expect(dto.nombre).toBe('Ana Quispe');
    expect(dto.personas).toBe(3);
    expect(servicioFalso.crear.mock.calls[0][1]).toBe('1.1.1.1');
  });
});
