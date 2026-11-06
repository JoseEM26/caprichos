import { BadRequestException, HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { RedisService } from '../../comun/redis/redis.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { normalizarCelularPeru } from '../usuarios/alertas-whatsapp.util';
import { formatearHora, obtenerFechaHoraLima } from '../local/local.util';
import { ReservasService } from './reservas.service';
import { CrearSolicitudWebDto } from './dto/crear-solicitud-web.dto';
import { diaCortoLima, textosNotificacionSolicitud } from './notificacion-solicitud';
import { horaUltimoInicio } from './horario-reserva';

/** Límite por IP: solicitudes del POST en una ventana de 10 minutos (Redis). */
export const RESERVA_WEB_MAX_POR_IP = 5;
export const RESERVA_WEB_VENTANA_IP_SEG = 600;

/** Ventana de días (YYYY-MM-DD) desde la fecha base, en UTC: se usa solo para contar días calendario. */
function sumarDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

function diasEntre(desde: string, hasta: string): number {
  return Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86400000);
}

/**
 * Reservas que el cliente pide desde la carta virtual. Crean una SolicitudReserva PENDIENTE
 * (sin conversación) que el local aprueba o rechaza en Reservas › Solicitudes. No manda WhatsApp:
 * el aviso al cliente sale solo al aprobar o rechazar, desde ReservasService.
 */
@Injectable()
export class ReservasCartaService {
  private readonly logger = new Logger(ReservasCartaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reservas: ReservasService,
    private readonly redisService: RedisService,
    private readonly eventos: EventosGateway,
  ) {}

  private async parametro(clave: string): Promise<unknown> {
    const p = await this.prisma.parametro.findUnique({ where: { clave } });
    return p?.valor;
  }

  private async entero(clave: string): Promise<number | null> {
    const v = await this.parametro(clave);
    const n = typeof v === 'number' ? v : typeof v === 'string' ? parseInt(v, 10) : NaN;
    return Number.isInteger(n) && n > 0 ? n : null;
  }

  private async asientosTotales(): Promise<number> {
    const mesas = await this.prisma.elementoPlano.findMany({
      where: { activo: true, tipo: 'MESA' },
      select: { asientos: true },
    });
    return mesas.reduce((sum, m) => sum + (m.asientos ?? 0), 0);
  }

  /** Parámetros de reservas web con sus valores por defecto (ver ParametrosOperacionTab). */
  private async configuracion() {
    const [activaValor, maxPendientes, diasMax, maxPersonas] = await Promise.all([
      this.parametro('reserva_web_activa'),
      this.entero('reserva_web_max_pendientes'),
      this.entero('reserva_web_dias_max'),
      this.entero('reserva_web_max_personas'),
    ]);
    return {
      activa: String(activaValor ?? 'si').toLowerCase().trim() !== 'no',
      maxPendientes: maxPendientes ?? 2,
      diasMax: diasMax ?? 30,
      // Sin parámetro: el tope es la suma de asientos de las mesas activas (no se puede sentar a más gente)
      personasMax: maxPersonas ?? (await this.asientosTotales()),
    };
  }

  /** Lo que la hoja de reserva necesita para ofrecer solo días y horas válidas. */
  async opciones(ahora: Date = new Date()) {
    const cfg = await this.configuracion();
    if (!cfg.activa) {
      return { activa: false, diasMax: cfg.diasMax, personasMax: cfg.personasMax, horarios: [], fechasCerradas: [], fechasEspeciales: [] };
    }

    const { fechaIso: hoy } = obtenerFechaHoraLima(ahora);
    const [horarios, especiales] = await Promise.all([
      this.prisma.horarioDia.findMany({ orderBy: { dia_semana: 'asc' } }),
      this.prisma.fechaEspecial.findMany({
        where: {
          fecha: { gte: new Date(`${hoy}T00:00:00.000Z`), lte: new Date(`${sumarDias(hoy, cfg.diasMax)}T00:00:00.000Z`) },
        },
      }),
    ]);

    // dia: 0 = domingo … 6 = sábado, igual que Date.getDay() en el navegador.
    // `ultimo` es la última hora en que puede empezar una reserva (la regla de horario-reserva.ts).
    // Un día sin una reserva posible se trata como cerrado, igual que en validarHorarioAtencion.
    const diasAbiertos = horarios
      .filter((h) => !h.cerrado && h.abre && h.cierra)
      .map((h) => ({ dia: h.dia_semana % 7, abre: formatearHora(h.abre)!, cierra: formatearHora(h.cierra)!, ultimo: horaUltimoInicio(formatearHora(h.abre), formatearHora(h.cierra)) }))
      .filter((h) => h.ultimo !== null) as { dia: number; abre: string; cierra: string; ultimo: string }[];

    const iso = (f: Date) => f.toISOString().slice(0, 10);
    const fechasEspecialesValidas = especiales
      .filter((f) => !f.cerrado && f.abre && f.cierra)
      .map((f) => ({ fecha: iso(f.fecha), abre: formatearHora(f.abre)!, cierra: formatearHora(f.cierra)!, ultimo: horaUltimoInicio(formatearHora(f.abre), formatearHora(f.cierra)) }));
    const fechasEspeciales = fechasEspecialesValidas.filter((f) => f.ultimo !== null) as { fecha: string; abre: string; cierra: string; ultimo: string }[];
    const fechasCerradas = especiales
      .filter((f) => f.cerrado || !f.abre || !f.cierra || !fechasEspeciales.some((e) => e.fecha === iso(f.fecha)))
      .map((f) => iso(f.fecha));

    return {
      activa: true,
      diasMax: cfg.diasMax,
      personasMax: cfg.personasMax,
      horarios: diasAbiertos,
      fechasCerradas,
      fechasEspeciales,
    };
  }

  /** Límite por IP con Redis: si Redis no responde, se deja pasar (el límite por celular sigue en la base). */
  private async limitarIp(ip?: string): Promise<void> {
    const clave = `reservas:web:ip:${ip ?? 'sin-ip'}`;
    try {
      const redis = this.redisService.obtenerCliente();
      const n = await redis.incr(clave);
      if (n === 1) await redis.expire(clave, RESERVA_WEB_VENTANA_IP_SEG);
      if (n > RESERVA_WEB_MAX_POR_IP) {
        throw new HttpException(
          { codigo: 'DEMASIADOS_INTENTOS', mensaje: 'Hay demasiados intentos desde tu conexión. Espera 10 minutos e inténtalo de nuevo.' },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.warn(`Límite de reservas web sin Redis: ${(err as Error).message}`);
    }
  }

  /** Crea la solicitud PENDIENTE y avisa a Caja y Salón. Valida en el mismo orden que el formulario. */
  async crear(dto: CrearSolicitudWebDto, ip?: string, ahora: Date = new Date()) {
    await this.limitarIp(ip);

    // Campo trampa: no se guarda nada, pero el robot recibe un OK como cualquiera
    if (dto.empresa?.trim()) {
      return { ok: true, solicitudId: null, resumen: { personas: dto.personas, fechaTexto: dto.fecha, hora: dto.hora } };
    }

    const cfg = await this.configuracion();
    if (!cfg.activa) {
      throw new BadRequestException({
        codigo: 'RESERVAS_DESACTIVADAS',
        mensaje: 'Por ahora no se reciben reservas desde la carta. Escríbenos o llámanos al local.',
      });
    }

    const celular = normalizarCelularPeru(dto.telefono);
    if (!celular.valido || !celular.celular9) {
      throw new BadRequestException({ codigo: 'VALIDACION', mensaje: 'El celular debe tener 9 dígitos y empezar con 9.' });
    }

    if (dto.personas > cfg.personasMax) {
      throw new BadRequestException({
        codigo: 'DEMASIADAS_PERSONAS',
        mensaje: `Por la carta puedes reservar para hasta ${cfg.personasMax} personas. Para un grupo más grande, escríbenos o llámanos.`,
      });
    }

    const fechaHora = new Date(`${dto.fecha}T${dto.hora}:00-05:00`);
    if (isNaN(fechaHora.getTime()) || obtenerFechaHoraLima(fechaHora).fechaIso !== dto.fecha) {
      throw new BadRequestException({ codigo: 'VALIDACION', mensaje: 'La fecha no es válida.' });
    }
    if (fechaHora.getTime() <= ahora.getTime()) {
      throw new BadRequestException({ codigo: 'HORA_PASADA', mensaje: 'La hora ya pasó. Elige otra hora o un día más adelante.' });
    }
    const { fechaIso: hoy } = obtenerFechaHoraLima(ahora);
    if (diasEntre(hoy, dto.fecha) > cfg.diasMax) {
      throw new BadRequestException({ codigo: 'VALIDACION', mensaje: `Solo puedes reservar con hasta ${cfg.diasMax} días de anticipación.` });
    }

    // Mismas reglas de horario que el formulario del admin (FUERA_DE_HORARIO con su mensaje)
    await this.reservas.validarHorarioAtencion(fechaHora);

    const pendientes = await this.prisma.solicitudReserva.count({
      where: { telefono: celular.celular9, estado: 'PENDIENTE' },
    });
    if (pendientes >= cfg.maxPendientes) {
      throw new BadRequestException({
        codigo: 'LIMITE_PENDIENTES',
        mensaje: `Ya tienes ${pendientes} solicitud${pendientes === 1 ? '' : 'es'} esperando respuesta del local. Espera a que te confirmen antes de pedir otra.`,
      });
    }

    const solicitud = await this.prisma.solicitudReserva.create({
      data: {
        conversacion_id: null,
        personas: dto.personas,
        hora: fechaHora,
        estado: 'PENDIENTE',
        nombre: dto.nombre,
        telefono: celular.celular9,
        nota: dto.nota?.trim() || null,
      },
    });

    const fechaTexto = diaCortoLima(fechaHora);
    await this.avisarSolicitud(solicitud.id, { personas: dto.personas, fechaHora, fechaTexto, hora: dto.hora, nombre: dto.nombre, telefono: celular.celular9, nota: dto.nota?.trim() || null });

    return {
      ok: true,
      solicitudId: solicitud.id.toString(),
      resumen: { personas: dto.personas, fechaTexto, hora: dto.hora },
    };
  }

  /** Campana RESERVA_NUEVA y evento en vivo. Si falla, la solicitud ya quedó guardada: solo se registra el error. */
  private async avisarSolicitud(
    solicitudId: bigint,
    datos: { personas: number; fechaHora: Date; fechaTexto: string; hora: string; nombre: string; telefono: string; nota: string | null },
  ) {
    try {
      const { titulo, mensaje } = textosNotificacionSolicitud(datos);
      const notif = await this.prisma.notificacion.create({
        data: { tipo: 'RESERVA_NUEVA', rol_destino: null, titulo, mensaje, enlace: '/admin/reservas' },
      });
      this.eventos.emitirAdmin('notificaciones:nueva', { id: notif.id.toString(), titulo });
      this.eventos.emitirAdmin('reserva:solicitud_nueva', {
        id: solicitudId.toString(),
        nombre: datos.nombre,
        personas: datos.personas,
        hora: datos.fechaHora.toISOString(),
      });
    } catch (err) {
      this.logger.error(`Error avisando solicitud de reserva web ${solicitudId}: ${(err as Error).message}`);
    }
  }
}
