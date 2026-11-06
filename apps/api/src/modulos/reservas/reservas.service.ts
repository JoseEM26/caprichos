import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { formatearHora, obtenerFechaHoraLima } from '../local/local.util';
import {
  aMinutos,
  franjasReserva,
  horaEnVentanaReserva,
  horaLegible,
  ultimoInicioReserva,
  ventanasSeSolapan,
} from './horario-reserva';
import { CrearReservaDto } from './dto/crear-reserva.dto';
import { ActualizarReservaDto } from './dto/actualizar-reserva.dto';
import { CancelarReservaDto } from './dto/cancelar-reserva.dto';
import { Ventana24hService } from '../chatbot/servicios/ventana-24h.service';
import { TEXTOS_RESERVA } from '../chatbot/conversacion/textos-reserva';
import { OutboxWhatsappService } from '../chatbot/servicios/outbox-whatsapp.service';

/** 'YYYY-MM-DD' (Lima) a 'DD/MM/YYYY' para el cliente. */
const fechaDeIso = (iso: string) => iso.split('-').reverse().join('/');

const MINUTO_MS = 60 * 1000;

/** Nombre de una mesa como lo ve el local. */
const nombreMesa = (m: { nombre?: string | null; numero?: number | null } | null | undefined) =>
  m?.nombre || (m?.numero ? `Mesa ${m.numero}` : 'Mesa');

/** Mesa ocupada en una franja. RESERVA: otra reserva ACTIVA se solapa. PEDIDO_ABIERTO: hay un pedido abierto hoy. */
export interface MesaOcupada {
  mesa_id: string;
  reserva_id: string;
  nombre: string;
  hora: string;
  motivo: 'RESERVA' | 'PEDIDO_ABIERTO';
}

/** Datos para calcular ocupación de un día: reservas ACTIVAS y, si el día es hoy, pedidos abiertos. */
interface DatosOcupacion {
  reservas: Array<{
    id: bigint;
    hora: Date;
    tolerancia_min: number;
    mesas: Array<{ mesa_id: bigint | null; mesa?: { nombre?: string | null; numero?: number | null } | null }>;
  }>;
  pedidosAbiertos: Array<{
    mesa_id: bigint | null;
    mesa?: { nombre?: string | null; numero?: number | null } | null;
  }>;
}

@Injectable()
export class ReservasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly eventosGateway: EventosGateway,
    @Optional()
    @Inject(forwardRef(() => Ventana24hService))
    private readonly ventana24hService?: Ventana24hService,
    @Optional() private readonly outbox?: OutboxWhatsappService,
  ) {}

  /**
   * Serializa un registro de reserva convirtiendo BigInt a string para JSON.
   */
  serializarReserva(r: any) {
    return {
      id: r.id.toString(),
      nombre: r.nombre,
      telefono: r.telefono,
      personas: r.personas,
      hora: r.hora instanceof Date ? r.hora.toISOString() : r.hora,
      tolerancia_min: r.tolerancia_min,
      estado: r.estado,
      motivo_cancelacion: r.motivo_cancelacion ?? null,
      pedido_id:
        r.pedido_id !== null && r.pedido_id !== undefined
          ? r.pedido_id.toString()
          : null,
      mesas: (r.mesas ?? []).map((rm: any) => ({
        id: rm.id?.toString(),
        mesa_id:
          rm.mesa_id !== null && rm.mesa_id !== undefined
            ? rm.mesa_id.toString()
            : null,
        numero: rm.mesa?.numero ?? null,
        nombre: rm.mesa?.nombre ?? null,
        asientos: rm.mesa?.asientos ?? null,
      })),
    };
  }

  /**
   * Obtiene la tolerancia en minutos para reservas desde el parámetro del sistema.
   * Por defecto 15 minutos.
   */
  async obtenerToleranciaMin(): Promise<number> {
    const param = await this.prisma.parametro.findUnique({
      where: { clave: 'reserva_tolerancia_min' },
    });

    if (param?.valor !== undefined && param?.valor !== null) {
      if (typeof param.valor === 'number') {
        return param.valor;
      }
      if (typeof param.valor === 'string') {
        const num = parseInt(param.valor, 10);
        if (!isNaN(num) && num > 0) return num;
      }
      if (typeof param.valor === 'object' && 'minutos' in (param.valor as any)) {
        const num = Number((param.valor as any).minutos);
        if (!isNaN(num) && num > 0) return num;
      }
    }

    return 15;
  }

  /**
   * Horario del día (hora Lima) para reservas y para la carta: una fecha especial manda sobre el día
   * de la semana. Devuelve abre/cierra 'HH:mm' o null si el local no atiende ese día.
   */
  async horarioDelDia(fechaIso: string): Promise<{ abre: string | null; cierra: string | null; motivo: string | null; cerrado: boolean }> {
    const fechaEspecial = await this.prisma.fechaEspecial.findUnique({
      where: { fecha: new Date(`${fechaIso}T00:00:00.000Z`) },
    });
    if (fechaEspecial) {
      if (fechaEspecial.cerrado) {
        return { abre: null, cierra: null, motivo: fechaEspecial.motivo || 'Fecha especial', cerrado: true };
      }
      return {
        abre: formatearHora(fechaEspecial.abre),
        cierra: formatearHora(fechaEspecial.cierra),
        motivo: fechaEspecial.motivo || null,
        cerrado: false,
      };
    }
    const diaSemana = obtenerFechaHoraLima(new Date(`${fechaIso}T12:00:00-05:00`)).diaSemana;
    const horario = await this.prisma.horarioDia.findUnique({ where: { dia_semana: diaSemana } });
    if (!horario || horario.cerrado) {
      return { abre: null, cierra: null, motivo: null, cerrado: true };
    }
    return { abre: formatearHora(horario.abre), cierra: formatearHora(horario.cierra), motivo: null, cerrado: false };
  }

  /**
   * Valida que la hora de la reserva (hora Lima) pueda iniciarse en el horario del día:
   * desde la apertura hasta cierre - MARGEN_CIERRE_MIN. El mensaje dice el horario real del día.
   */
  async validarHorarioAtencion(fechaHora: Date): Promise<void> {
    const { fechaIso, horaMinutos } = obtenerFechaHoraLima(fechaHora);
    const dia = await this.horarioDelDia(fechaIso);

    if (dia.cerrado) {
      const motivo = dia.motivo && dia.motivo !== 'Fecha especial' ? ` (${dia.motivo})` : '';
      throw new BadRequestException({
        codigo: 'FUERA_DE_HORARIO',
        mensaje: `El local no atiende ese día${motivo}. Elige otra fecha.`,
      });
    }

    if (!horaEnVentanaReserva(horaMinutos, dia.abre, dia.cierra)) {
      const ultimo = ultimoInicioReserva(dia.abre, dia.cierra);
      const cola =
        ultimo !== null ? ` La última reserva empieza a las ${horaLegible(ultimo)}.` : '';
      throw new BadRequestException({
        codigo: 'FUERA_DE_HORARIO',
        mensaje: `Atendemos de ${horaLegible(aMinutos(dia.abre ?? '00:00'))} a ${horaLegible(aMinutos(dia.cierra ?? '00:00'))}.${cola} Elige otra hora.`,
      });
    }
  }

  /**
   * Valida existencia de mesas, que estén activas, sean de tipo MESA,
   * y que la suma de sus asientos alcance para el número de personas.
   */
  async validarMesasYAsientos(
    mesaIds: bigint[],
    personas: number,
    confirmarCapacidad = false,
  ): Promise<void> {
    if (new Set(mesaIds.map((id) => id.toString())).size !== mesaIds.length) {
      throw new BadRequestException({
        codigo: 'MESA_REPETIDA',
        mensaje: 'Una mesa aparece dos veces en la reserva. Elige cada mesa una sola vez.',
      });
    }

    if (mesaIds.length === 0) {
      throw new BadRequestException({
        codigo: 'ASIENTOS_INSUFICIENTES',
        mensaje: `Faltan ${personas} asientos`,
      });
    }

    const mesasDb = await this.prisma.elementoPlano.findMany({
      where: { id: { in: mesaIds } },
    });

    if (mesasDb.length !== mesaIds.length) {
      throw new BadRequestException({
        codigo: 'MESA_INVALIDA',
        mensaje: 'Una o más mesas seleccionadas no existen',
      });
    }

    const invalidas = mesasDb.filter((m) => !m.activo || m.tipo !== 'MESA');
    if (invalidas.length > 0) {
      throw new BadRequestException({
        codigo: 'MESA_INVALIDA',
        mensaje: 'Una o más mesas seleccionadas no existen, no están activas o no son mesas',
      });
    }

    const totalAsientos = mesasDb.reduce((sum, m) => sum + (m.asientos ?? 0), 0);
    // Menos asientos que personas: se permite solo si el local lo confirma (confirmarCapacidad)
    if (totalAsientos < personas && !confirmarCapacidad) {
      const faltan = personas - totalAsientos;
      throw new BadRequestException({
        codigo: 'ASIENTOS_INSUFICIENTES',
        mensaje: `Faltan ${faltan} asientos`,
      });
    }
  }

  /**
   * Pasa a NO_ASISTIO las reservas ACTIVAS cuya hora + tolerancia ya pasó.
   * Se ejecuta de forma idempotente al consultar y audita con actor «sistema».
   */
  async pasarNoAsistioVencidas(ahora: Date = new Date()): Promise<number> {
    const activas = await this.prisma.reserva.findMany({
      where: { estado: 'ACTIVA' },
      include: { mesas: true },
    });

    const vencidas = activas.filter((r) => {
      const expira = new Date(r.hora.getTime() + r.tolerancia_min * 60 * 1000);
      return ahora.getTime() >= expira.getTime();
    });

    let liberadas = 0;
    for (const r of vencidas) {
      // Solo si sigue ACTIVA: otra pasada (otra réplica o una consulta) no la cuenta ni audita de nuevo
      const { count } = await this.prisma.reserva.updateMany({
        where: { id: r.id, estado: 'ACTIVA' },
        data: { estado: 'NO_ASISTIO' },
      });
      if (count !== 1) continue;
      liberadas++;

      await this.auditoria.registrar({
        categoria: 'CAMBIO',
        modulo: 'reservas',
        accion: 'EXPIRAR_TOLERANCIA',
        resultado: 'OK',
        entidad: 'reserva',
        entidadId: r.id,
        antes: { estado: 'ACTIVA' },
        despues: { estado: 'NO_ASISTIO', actor: 'sistema' },
        motivo: `Sin llegada: pasaron ${r.tolerancia_min} min de tolerancia`,
      });

      this.eventosGateway?.emitirAdmin?.('reserva:cambio', {
        tipo: 'NO_ASISTIO',
        reservaId: r.id.toString(),
        actor: 'sistema',
      });
    }

    return liberadas;
  }

  /**
   * 1) POST /admin/reservas (reservas/crear)
   * Registra una reserva en un solo formulario.
   */
  async crear(
    dto: CrearReservaDto,
    usuario?: UsuarioAutenticado,
    ip?: string,
    ahora: Date = new Date(),
  ) {
    const fechaHora = this.parsearHora(dto.hora);

    if (fechaHora.getTime() <= ahora.getTime()) {
      throw new BadRequestException({
        codigo: 'HORA_PASADA',
        mensaje: 'La hora de la reserva ya pasó',
      });
    }

    const mesaIds = dto.mesas.map((id) => BigInt(id));
    await this.validarNuevaReserva(fechaHora, mesaIds, dto.personas, {
      confirmarCapacidad: dto.confirmarCapacidad,
      ahora,
    });

    const reserva = await this.insertarReserva(this.prisma, {
      nombre: dto.nombre,
      telefono: dto.telefono,
      personas: dto.personas,
      fechaHora,
      mesaIds,
      toleranciaMin: await this.obtenerToleranciaMin(),
    });

    await this.registrarReservaCreada(reserva, mesaIds, usuario, ip);

    return this.serializarReserva(reserva);
  }

  private parsearHora(hora: string): Date {
    const fechaHora = new Date(hora);
    if (isNaN(fechaHora.getTime())) {
      throw new BadRequestException({
        codigo: 'FORMATO_INVALIDO',
        mensaje: 'La hora de la reserva no es válida',
      });
    }
    return fechaHora;
  }

  /** Horario, mesas, asientos y choques de una reserva. No escribe nada. */
  private async validarNuevaReserva(
    fechaHora: Date,
    mesaIds: bigint[],
    personas: number,
    opciones: { confirmarCapacidad?: boolean; excluirReservaId?: bigint | null; ahora?: Date } = {},
  ) {
    await this.validarHorarioAtencion(fechaHora);
    await this.validarMesasYAsientos(mesaIds, personas, opciones.confirmarCapacidad === true);
    await this.validarMesasLibres(fechaHora, mesaIds, opciones.excluirReservaId ?? null, opciones.ahora);
  }

  /** Inserta la reserva con sus mesas. Recibe el cliente para correr dentro de una transacción. */
  private insertarReserva(
    cliente: Pick<PrismaService, 'reserva'>,
    datos: {
      nombre: string;
      telefono: string;
      personas: number;
      fechaHora: Date;
      mesaIds: bigint[];
      toleranciaMin: number;
    },
  ) {
    return cliente.reserva.create({
      data: {
        nombre: datos.nombre.trim(),
        telefono: datos.telefono.trim(),
        personas: datos.personas,
        hora: datos.fechaHora,
        tolerancia_min: datos.toleranciaMin,
        estado: 'ACTIVA',
        mesas: {
          create: datos.mesaIds.map((mesaId) => ({
            mesa_id: mesaId,
          })),
        },
      },
      include: {
        mesas: {
          include: {
            mesa: true,
          },
        },
      },
    });
  }

  private async registrarReservaCreada(
    reserva: { id: bigint; nombre: string; telefono: string; personas: number; hora: Date; tolerancia_min: number; estado: string },
    mesaIds: bigint[],
    usuario?: UsuarioAutenticado,
    ip?: string,
  ) {
    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'reservas',
      accion: 'CREAR_RESERVA',
      resultado: 'OK',
      entidad: 'reserva',
      entidadId: reserva.id,
      despues: {
        id: reserva.id.toString(),
        nombre: reserva.nombre,
        telefono: reserva.telefono,
        personas: reserva.personas,
        hora: reserva.hora.toISOString(),
        tolerancia_min: reserva.tolerancia_min,
        estado: reserva.estado,
        mesas: mesaIds.map((id) => id.toString()),
      },
      partyId: usuario?.partyId ? BigInt(usuario.partyId) : undefined,
      ip,
    });

    this.eventosGateway?.emitirAdmin?.('reserva:cambio', {
      tipo: 'CREADA',
      reserva: this.serializarReserva(reserva),
    });
  }

  /**
   * 2) GET /admin/reservas?desde=&hasta=&estado= (reservas/ver)
   * Lista reservas. Antes de responder pasa a NO_ASISTIO las vencidas.
   */
  async listar(
    filtros: { desde?: string; hasta?: string; estado?: string },
    ahora: Date = new Date(),
  ) {
    await this.pasarNoAsistioVencidas(ahora);

    const where: any = {};
    if (filtros.estado) {
      where.estado = filtros.estado;
    }
    if (filtros.desde || filtros.hasta) {
      where.hora = {};
      if (filtros.desde) {
        const d =
          filtros.desde.length === 10
            ? new Date(`${filtros.desde}T00:00:00-05:00`)
            : new Date(filtros.desde);
        where.hora.gte = d;
      }
      if (filtros.hasta) {
        const h =
          filtros.hasta.length === 10
            ? new Date(`${filtros.hasta}T23:59:59.999-05:00`)
            : new Date(filtros.hasta);
        where.hora.lte = h;
      }
    }

    const reservas = await this.prisma.reserva.findMany({
      where,
      include: {
        mesas: {
          include: {
            mesa: true,
          },
        },
      },
      orderBy: { hora: 'asc' },
    });

    return reservas.map((r) => this.serializarReserva(r));
  }

  /**
   * 2) GET /admin/reservas/calendario?mes=YYYY-MM (reservas/ver)
   * Cantidad de reservas ACTIVAS por día del mes indicado (hora Lima).
   */
  async calendario(mes: string, ahora: Date = new Date()) {
    if (!mes || !/^\d{4}-\d{2}$/.test(mes)) {
      throw new BadRequestException({
        codigo: 'FORMATO_INVALIDO',
        mensaje: 'mes debe tener formato YYYY-MM',
      });
    }

    await this.pasarNoAsistioVencidas(ahora);

    const [yearStr, monthStr] = mes.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);

    const diasEnMes = new Date(year, month, 0).getDate();
    const inicioMes = new Date(`${mes}-01T00:00:00-05:00`);
    const finMes = new Date(`${mes}-${String(diasEnMes).padStart(2, '0')}T23:59:59.999-05:00`);

    const reservas = await this.prisma.reserva.findMany({
      where: {
        estado: 'ACTIVA',
        hora: {
          gte: inicioMes,
          lte: finMes,
        },
      },
    });

    const conteoPorDia: Record<string, number> = {};
    for (let d = 1; d <= diasEnMes; d++) {
      const diaIso = `${mes}-${String(d).padStart(2, '0')}`;
      conteoPorDia[diaIso] = 0;
    }

    for (const r of reservas) {
      const { fechaIso } = obtenerFechaHoraLima(r.hora);
      if (conteoPorDia[fechaIso] !== undefined) {
        conteoPorDia[fechaIso] += 1;
      }
    }

    return Object.entries(conteoPorDia).map(([fecha, cantidad]) => ({
      fecha,
      cantidad,
    }));
  }

  /**
   * 2) GET /admin/reservas/agenda?fecha=YYYY-MM-DD (reservas/ver)
   * Agenda del día por hora (hora Lima).
   */
  async agenda(fecha: string, ahora: Date = new Date()) {
    if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      throw new BadRequestException({
        codigo: 'FORMATO_INVALIDO',
        mensaje: 'fecha debe tener formato YYYY-MM-DD',
      });
    }

    await this.pasarNoAsistioVencidas(ahora);

    const inicioDia = new Date(`${fecha}T00:00:00-05:00`);
    const finDia = new Date(`${fecha}T23:59:59.999-05:00`);

    const reservas = await this.prisma.reserva.findMany({
      where: {
        hora: {
          gte: inicioDia,
          lte: finDia,
        },
      },
      include: {
        mesas: {
          include: {
            mesa: true,
          },
        },
      },
      orderBy: { hora: 'asc' },
    });

    return reservas.map((r) => this.serializarReserva(r));
  }

  /**
   * 2) GET /admin/reservas/mesa/:mesaId/hoy (reservas/ver)
   * Reservas activas de hoy (hora Lima) de una mesa específica (marca en plano).
   */
  async reservasMesaHoy(mesaId: bigint | string | number, ahora: Date = new Date()) {
    await this.pasarNoAsistioVencidas(ahora);

    const mId = BigInt(mesaId);
    const { fechaIso } = obtenerFechaHoraLima(ahora);
    const inicioDia = new Date(`${fechaIso}T00:00:00-05:00`);
    const finDia = new Date(`${fechaIso}T23:59:59.999-05:00`);

    const reservas = await this.prisma.reserva.findMany({
      where: {
        estado: 'ACTIVA',
        hora: {
          gte: inicioDia,
          lte: finDia,
        },
        mesas: {
          some: {
            mesa_id: mId,
          },
        },
      },
      include: {
        mesas: {
          include: {
            mesa: true,
          },
        },
      },
      orderBy: { hora: 'asc' },
    });

    return reservas.map((r) => this.serializarReserva(r));
  }

  /**
   * 3) PATCH /admin/reservas/:id (reservas/editar)
   * Edita nombre, teléfono, personas, hora y mesas solo si está ACTIVA.
   */
  async actualizar(
    id: bigint | string | number,
    dto: ActualizarReservaDto,
    usuario?: UsuarioAutenticado,
    ip?: string,
    ahora: Date = new Date(),
  ) {
    const rId = BigInt(id);
    const actual = await this.prisma.reserva.findUnique({
      where: { id: rId },
      include: {
        mesas: {
          include: {
            mesa: true,
          },
        },
      },
    });

    if (!actual) {
      throw new NotFoundException({
        codigo: 'RESERVA_NO_ENCONTRADA',
        mensaje: 'La reserva solicitada no existe',
      });
    }

    if (actual.estado !== 'ACTIVA') {
      throw new BadRequestException({
        codigo: 'RESERVA_NO_ACTIVA',
        mensaje: 'Solo se pueden editar reservas en estado ACTIVA',
      });
    }

    let nuevaHora = actual.hora;
    if (dto.hora) {
      const parsedHora = new Date(dto.hora);
      if (isNaN(parsedHora.getTime())) {
        throw new BadRequestException({
          codigo: 'FORMATO_INVALIDO',
          mensaje: 'La hora de la reserva no es válida',
        });
      }
      if (parsedHora.getTime() <= ahora.getTime()) {
        throw new BadRequestException({
          codigo: 'HORA_PASADA',
          mensaje: 'La hora de la reserva ya pasó',
        });
      }
      await this.validarHorarioAtencion(parsedHora);
      nuevaHora = parsedHora;
    }

    const nuevasPersonas = dto.personas ?? actual.personas;

    let nuevosMesaIds: bigint[];
    if (dto.mesas) {
      nuevosMesaIds = dto.mesas.map((m) => BigInt(m));
    } else {
      nuevosMesaIds = actual.mesas
        .map((rm) => rm.mesa_id)
        .filter((mid): mid is bigint => mid !== null);
    }

    if (dto.personas !== undefined || dto.mesas !== undefined) {
      await this.validarMesasYAsientos(nuevosMesaIds, nuevasPersonas, dto.confirmarCapacidad === true);
    }
    if (dto.hora !== undefined || dto.personas !== undefined || dto.mesas !== undefined) {
      await this.validarMesasLibres(nuevaHora, nuevosMesaIds, rId);
    }

    const reservaActualizada = await this.prisma.$transaction(async (tx) => {
      if (dto.mesas) {
        await tx.reservaMesa.deleteMany({
          where: { reserva_id: rId },
        });
        await tx.reservaMesa.createMany({
          data: nuevosMesaIds.map((mid) => ({
            reserva_id: rId,
            mesa_id: mid,
          })),
        });
      }

      return tx.reserva.update({
        where: { id: rId },
        data: {
          nombre: dto.nombre !== undefined ? dto.nombre.trim() : undefined,
          telefono: dto.telefono !== undefined ? dto.telefono.trim() : undefined,
          personas: dto.personas !== undefined ? dto.personas : undefined,
          hora: dto.hora !== undefined ? nuevaHora : undefined,
        },
        include: {
          mesas: {
            include: {
              mesa: true,
            },
          },
        },
      });
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'reservas',
      accion: 'EDITAR_RESERVA',
      resultado: 'OK',
      entidad: 'reserva',
      entidadId: rId,
      antes: {
        nombre: actual.nombre,
        telefono: actual.telefono,
        personas: actual.personas,
        hora: actual.hora.toISOString(),
        mesas: actual.mesas.map((rm) => rm.mesa_id?.toString()),
      },
      despues: {
        nombre: reservaActualizada.nombre,
        telefono: reservaActualizada.telefono,
        personas: reservaActualizada.personas,
        hora: reservaActualizada.hora.toISOString(),
        mesas: nuevosMesaIds.map((mid) => mid.toString()),
      },
      partyId: usuario?.partyId ? BigInt(usuario.partyId) : undefined,
      ip,
    });

    this.eventosGateway?.emitirAdmin?.('reserva:cambio', {
      tipo: 'EDITADA',
      reserva: this.serializarReserva(reservaActualizada),
    });

    return this.serializarReserva(reservaActualizada);
  }

  /**
   * 3) POST /admin/reservas/:id/cancelar (reservas/editar)
   * Motivo obligatorio (5 o más caracteres). Pasa a CANCELADA, no se elimina nunca (RN-CAP-014).
   */
  async cancelar(
    id: bigint | string | number,
    dto: CancelarReservaDto,
    usuario?: UsuarioAutenticado,
    ip?: string,
  ) {
    if (
      !dto?.motivo ||
      typeof dto.motivo !== 'string' ||
      dto.motivo.trim().length < 5
    ) {
      throw new BadRequestException({
        codigo: 'MOTIVO_REQUERIDO',
        mensaje: 'El motivo de cancelación es obligatorio (mínimo 5 caracteres)',
      });
    }

    const rId = BigInt(id);
    const actual = await this.prisma.reserva.findUnique({
      where: { id: rId },
      include: {
        mesas: {
          include: {
            mesa: true,
          },
        },
      },
    });

    if (!actual) {
      throw new NotFoundException({
        codigo: 'RESERVA_NO_ENCONTRADA',
        mensaje: 'La reserva no existe',
      });
    }

    const reserva = await this.prisma.reserva.update({
      where: { id: rId },
      data: {
        estado: 'CANCELADA',
        motivo_cancelacion: dto.motivo.trim(),
      },
      include: {
        mesas: {
          include: {
            mesa: true,
          },
        },
      },
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'reservas',
      accion: 'CANCELAR_RESERVA',
      resultado: 'OK',
      entidad: 'reserva',
      entidadId: rId,
      antes: { estado: actual.estado },
      despues: { estado: 'CANCELADA', motivo: dto.motivo.trim() },
      motivo: dto.motivo.trim(),
      partyId: usuario?.partyId ? BigInt(usuario.partyId) : undefined,
      ip,
    });

    this.eventosGateway?.emitirAdmin?.('reserva:cambio', {
      tipo: 'CANCELADA',
      reservaId: rId.toString(),
      motivo: dto.motivo.trim(),
    });

    return this.serializarReserva(reserva);
  }

  /**
   * 3) POST /admin/reservas/:id/sentar (reservas/editar)
   * Marca SENTADA y devuelve { mesas: [ids], personas, nombre }.
   */
  async sentar(
    id: bigint | string | number,
    usuario?: UsuarioAutenticado,
    ip?: string,
  ) {
    const rId = BigInt(id);
    const actual = await this.prisma.reserva.findUnique({
      where: { id: rId },
      include: {
        mesas: true,
      },
    });

    if (!actual) {
      throw new NotFoundException({
        codigo: 'RESERVA_NO_ENCONTRADA',
        mensaje: 'La reserva no existe',
      });
    }

    if (actual.estado !== 'ACTIVA') {
      throw new BadRequestException({
        codigo: 'RESERVA_NO_ACTIVA',
        mensaje: 'Solo se puede sentar una reserva ACTIVA',
      });
    }

    const reserva = await this.prisma.reserva.update({
      where: { id: rId },
      data: { estado: 'SENTADA' },
      include: { mesas: true },
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'reservas',
      accion: 'SENTAR_RESERVA',
      resultado: 'OK',
      entidad: 'reserva',
      entidadId: rId,
      antes: { estado: 'ACTIVA' },
      despues: { estado: 'SENTADA' },
      partyId: usuario?.partyId ? BigInt(usuario.partyId) : undefined,
      ip,
    });

    this.eventosGateway?.emitirAdmin?.('reserva:cambio', {
      tipo: 'SENTADA',
      reservaId: rId.toString(),
    });

    const mesaIds = reserva.mesas
      .map((rm) => rm.mesa_id)
      .filter((mid): mid is bigint => mid !== null)
      .map((mid) => mid.toString());

    return {
      mesas: mesaIds,
      personas: reserva.personas,
      nombre: reserva.nombre,
    };
  }

  /**
   * Método público que el integrador llamará al abrir el pedido desde una reserva.
   */
  async marcarPedidoDeReserva(
    reservaId: bigint | string | number,
    pedidoId: bigint | string | number,
  ) {
    const rId = BigInt(reservaId);
    const pId = BigInt(pedidoId);

    const reserva = await this.prisma.reserva.update({
      where: { id: rId },
      data: {
        pedido_id: pId,
        estado: 'SENTADA',
      },
      include: {
        mesas: {
          include: {
            mesa: true,
          },
        },
      },
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'reservas',
      accion: 'ASOCIAR_PEDIDO',
      resultado: 'OK',
      entidad: 'reserva',
      entidadId: rId,
      despues: {
        pedido_id: pId.toString(),
        estado: 'SENTADA',
      },
    });

    this.eventosGateway?.emitirAdmin?.('reserva:cambio', {
      tipo: 'ASOCIADA_A_PEDIDO',
      reservaId: rId.toString(),
      pedidoId: pId.toString(),
    });

    return this.serializarReserva(reserva);
  }

  /**
   * Franjas de inicio (hora Lima) con mesas suficientes libres para `personas`.
   * Usa las mismas reglas que validarHorarioAtencion (horario del día y cierre - duración)
   * y el mismo cruce de mesas que validarMesasLibres, así que nunca sugiere una hora que luego se rechaza.
   */
  async obtenerFranjasDisponibles(
    fechaIso: string,
    personas: number,
    ahora: Date = new Date(),
  ): Promise<string[]> {
    const dia = await this.horarioDelDia(fechaIso);
    if (dia.cerrado) return [];

    const { fechaIso: hoyLima, horaMinutos: horaActualLima } = obtenerFechaHoraLima(ahora);
    const franjasFuturas = franjasReserva(dia.abre, dia.cierra).filter(
      (h) => fechaIso !== hoyLima || h > horaActualLima,
    );

    const mesasActivas = await this.prisma.elementoPlano.findMany({
      where: { activo: true, tipo: 'MESA' },
    });
    const totalAsientosSalon = mesasActivas.reduce((sum, m) => sum + (m.asientos ?? 0), 0);
    if (totalAsientosSalon < personas) return [];

    const datos = await this.cargarOcupacionDia(fechaIso, ahora);
    const tolerancia = await this.obtenerToleranciaMin();

    const franjasDisponibles: string[] = [];
    for (const horaSlot of franjasFuturas) {
      const inicio = new Date(`${fechaIso}T${horaSlot}:00-05:00`).getTime();
      const ocupadasIds = new Set(
        this.ocupadasEnVentana(datos, inicio, inicio + tolerancia * MINUTO_MS).map((o) => o.mesa_id),
      );
      const asientosLibres = mesasActivas
        .filter((m) => !ocupadasIds.has(m.id.toString()))
        .reduce((sum, m) => sum + (m.asientos ?? 0), 0);
      if (asientosLibres >= personas) franjasDisponibles.push(horaSlot);
    }
    return franjasDisponibles;
  }

  /**
   * Datos de ocupación de un día (hora Lima): reservas ACTIVAS del día y, solo si el día es hoy,
   * los pedidos abiertos con mesa. SENTADA no cuenta: la mesa la ocupa el pedido abierto.
   */
  private async cargarOcupacionDia(fechaIso: string, ahora: Date): Promise<DatosOcupacion> {
    const inicioDia = new Date(`${fechaIso}T00:00:00-05:00`);
    const finDia = new Date(`${fechaIso}T23:59:59.999-05:00`);
    const esHoy = obtenerFechaHoraLima(ahora).fechaIso === fechaIso;
    const [reservas, pedidosAbiertos] = await Promise.all([
      this.prisma.reserva.findMany({
        where: { estado: 'ACTIVA', hora: { gte: inicioDia, lte: finDia } },
        include: { mesas: { include: { mesa: true } } },
      }),
      // ponytail: el pedido abierto bloquea todo el día de hoy; sin hora de cierre no se sabe cuánto dura
      esHoy
        ? this.prisma.pedidoMesa.findMany({
            where: { abierta: true, mesa_id: { not: null } },
            include: { mesa: true },
          })
        : Promise.resolve([]),
    ]);
    return { reservas, pedidosAbiertos };
  }

  /**
   * Mesas ocupadas en la ventana [inicio, fin) (ms): reservas ACTIVAS cuya ventana
   * [hora, hora + tolerancia] se solapa, y pedidos abiertos del día. Excluye una reserva si se indica.
   */
  private ocupadasEnVentana(
    datos: DatosOcupacion,
    inicio: number,
    fin: number,
    excluirReservaId?: bigint | null,
  ): MesaOcupada[] {
    const ocupadas: MesaOcupada[] = [];
    for (const r of datos.reservas) {
      if (excluirReservaId && r.id === excluirReservaId) continue;
      const rInicio = r.hora.getTime();
      if (!ventanasSeSolapan(inicio, fin, rInicio, rInicio + r.tolerancia_min * MINUTO_MS)) continue;
      for (const rm of r.mesas) {
        if (rm.mesa_id === null) continue;
        ocupadas.push({
          mesa_id: rm.mesa_id.toString(),
          reserva_id: r.id.toString(),
          nombre: nombreMesa(rm.mesa),
          hora: horaLegible(aMinutos(obtenerFechaHoraLima(r.hora).horaMinutos)),
          motivo: 'RESERVA',
        });
      }
    }
    for (const p of datos.pedidosAbiertos) {
      if (p.mesa_id === null) continue;
      ocupadas.push({
        mesa_id: p.mesa_id.toString(),
        reserva_id: '',
        nombre: nombreMesa(p.mesa),
        hora: '',
        motivo: 'PEDIDO_ABIERTO',
      });
    }
    return ocupadas;
  }

  /**
   * Mesas ocupadas si se reserva a esa hora: la ventana [hora, hora + tolerancia] se solapa con otra
   * reserva ACTIVA, o la mesa tiene un pedido abierto (si la fecha es hoy). Sirve al croquis y a la validación.
   */
  async mesasOcupadasEn(
    fechaHora: Date,
    excluirReservaId?: bigint | null,
    ahora: Date = new Date(),
  ): Promise<MesaOcupada[]> {
    const tolerancia = await this.obtenerToleranciaMin();
    const { fechaIso } = obtenerFechaHoraLima(fechaHora);
    const datos = await this.cargarOcupacionDia(fechaIso, ahora);
    const inicio = fechaHora.getTime();
    return this.ocupadasEnVentana(datos, inicio, inicio + tolerancia * MINUTO_MS, excluirReservaId);
  }

  /** Rechaza si alguna de las mesas ya está ocupada a esa hora (otra reserva que se solapa o pedido abierto). */
  async validarMesasLibres(
    fechaHora: Date,
    mesaIds: bigint[],
    excluirReservaId?: bigint | null,
    ahora: Date = new Date(),
  ): Promise<void> {
    const ids = new Set(mesaIds.map((id) => id.toString()));
    const choque = (await this.mesasOcupadasEn(fechaHora, excluirReservaId, ahora)).find((o) => ids.has(o.mesa_id));
    if (choque) {
      throw new BadRequestException({
        codigo: 'MESA_OCUPADA',
        mensaje:
          choque.motivo === 'PEDIDO_ABIERTO'
            ? `${choque.nombre} tiene un pedido abierto. Elige otra mesa.`
            : `${choque.nombre} ya tiene otra reserva a las ${choque.hora}. Elige otra mesa u otra hora.`,
      });
    }
  }

  /**
   * Aviso suave, nunca bloquea: otra reserva ACTIVA de esa mesa empieza menos de 2 horas antes.
   * Sirve al croquis y a la aprobación («puede seguir ocupada»).
   */
  async avisosMesasReserva(
    fechaHora: Date,
    mesaIds: bigint[],
    excluirReservaId?: bigint | null,
    ahora: Date = new Date(),
  ): Promise<string[]> {
    const { fechaIso } = obtenerFechaHoraLima(fechaHora);
    const datos = await this.cargarOcupacionDia(fechaIso, ahora);
    const ids = new Set(mesaIds.map((id) => id.toString()));
    const avisos: string[] = [];
    for (const r of datos.reservas) {
      if (excluirReservaId && r.id === excluirReservaId) continue;
      const antes = fechaHora.getTime() - r.hora.getTime();
      if (antes <= 0 || antes >= 2 * 60 * MINUTO_MS) continue;
      if (!r.mesas.some((rm) => rm.mesa_id !== null && ids.has(rm.mesa_id.toString()))) continue;
      avisos.push(
        `Esa mesa tiene otra reserva a las ${horaLegible(aMinutos(obtenerFechaHoraLima(r.hora).horaMinutos))}; puede seguir ocupada.`,
      );
    }
    return avisos;
  }

  /**
   * POST /admin/reservas/:id/reactivar (reservas/editar)
   * Reactiva una reserva «No llegó» de hoy cuando el cliente llega tarde. La tolerancia se extiende
   * desde la llegada (minutos tarde + tolerancia) para que no vuelva a vencer enseguida.
   * No se reactiva si otra reserva o un pedido abierto ya tomó la mesa.
   */
  async reactivar(
    id: bigint | string | number,
    usuario?: UsuarioAutenticado,
    ip?: string,
    ahora: Date = new Date(),
  ) {
    const rId = BigInt(id);
    const actual = await this.prisma.reserva.findUnique({
      where: { id: rId },
      include: { mesas: { include: { mesa: true } } },
    });
    if (!actual) {
      throw new NotFoundException({ codigo: 'RESERVA_NO_ENCONTRADA', mensaje: 'La reserva no existe' });
    }
    if (actual.estado !== 'NO_ASISTIO') {
      throw new BadRequestException({
        codigo: 'RESERVA_NO_REACTIVABLE',
        mensaje: 'Solo se reactivan reservas en «No llegó»',
      });
    }
    const hoy = obtenerFechaHoraLima(ahora).fechaIso;
    if (obtenerFechaHoraLima(actual.hora).fechaIso !== hoy) {
      throw new BadRequestException({
        codigo: 'RESERVA_NO_REACTIVABLE',
        mensaje: 'Solo se reactiva una reserva de hoy',
      });
    }

    const tolerancia = await this.obtenerToleranciaMin();
    const minutosTarde = Math.max(0, Math.ceil((ahora.getTime() - actual.hora.getTime()) / MINUTO_MS));
    const nuevaTolerancia = minutosTarde + tolerancia;

    const datos = await this.cargarOcupacionDia(hoy, ahora);
    const ids = new Set(actual.mesas.filter((m) => m.mesa_id !== null).map((m) => m.mesa_id!.toString()));
    // La mesa se retiene desde ahora (la llegada) hasta ahora + tolerancia
    const choque = this
      .ocupadasEnVentana(datos, ahora.getTime(), ahora.getTime() + tolerancia * MINUTO_MS, rId)
      .find((o) => ids.has(o.mesa_id));
    if (choque) {
      throw new BadRequestException({
        codigo: 'MESA_OCUPADA',
        mensaje:
          choque.motivo === 'PEDIDO_ABIERTO'
            ? `${choque.nombre} tiene un pedido abierto. No se puede reactivar.`
            : `${choque.nombre} ya tiene otra reserva a las ${choque.hora}. No se puede reactivar.`,
      });
    }

    const reserva = await this.prisma.reserva.update({
      where: { id: rId },
      data: { estado: 'ACTIVA', tolerancia_min: nuevaTolerancia },
      include: { mesas: { include: { mesa: true } } },
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'reservas',
      accion: 'REACTIVAR_RESERVA',
      resultado: 'OK',
      entidad: 'reserva',
      entidadId: rId,
      antes: { estado: 'NO_ASISTIO', tolerancia_min: actual.tolerancia_min },
      despues: { estado: 'ACTIVA', tolerancia_min: nuevaTolerancia },
      motivo: 'Llegó tarde: reserva reactivada por el local',
      partyId: usuario?.partyId ? BigInt(usuario.partyId) : undefined,
      ip,
    });

    this.eventosGateway?.emitirAdmin?.('reserva:cambio', {
      tipo: 'REACTIVADA',
      reservaId: rId.toString(),
    });

    return this.serializarReserva(reserva);
  }

  /**
   * Serializa una solicitud de reserva para respuestas JSON.
   */
  serializarSolicitud(s: any) {
    return {
      id: s.id.toString(),
      conversacion_id: s.conversacion_id ? s.conversacion_id.toString() : null,
      personas: s.personas,
      hora: s.hora instanceof Date ? s.hora.toISOString() : s.hora,
      estado: (s.estado || 'PENDIENTE').toLowerCase(),
      reserva_id: s.reserva_id ? s.reserva_id.toString() : null,
      nombre: s.nombre || s.conversacion?.nombre_contacto || null,
      telefono: s.telefono || s.conversacion?.telefono || null,
      nota: s.nota || null,
      motivo_rechazo: s.motivo_rechazo || null,
      creado_en: s.creado_en instanceof Date ? s.creado_en.toISOString() : s.creado_en || null,
    };
  }

  /**
   * Lista solicitudes de reserva.
   */
  async listarSolicitudes(filtros?: { estado?: string }) {
    const where: any = {};
    if (filtros?.estado) {
      where.estado = filtros.estado.toUpperCase();
    }

    const solicitudes = await this.prisma.solicitudReserva.findMany({
      where,
      include: {
        conversacion: true,
        reserva: {
          include: {
            mesas: {
              include: { mesa: true },
            },
          },
        },
      },
      orderBy: { id: 'desc' },
    });

    return solicitudes.map((s) => this.serializarSolicitud(s));
  }

  /**
   * Aprueba una solicitud de reserva: crea la reserva con las mesas indicadas
   * y notifica al cliente por WhatsApp.
   */
  async aprobarSolicitud(
    id: bigint | string | number,
    dto: {
      mesas: (string | number)[];
      personas?: number;
      hora?: string;
      nombre?: string;
      telefono?: string;
      confirmarCapacidad?: boolean;
    },
    usuario?: UsuarioAutenticado,
    ip?: string,
  ) {
    const sId = BigInt(id);
    const solicitud = await this.prisma.solicitudReserva.findUnique({
      where: { id: sId },
      include: { conversacion: true },
    });

    if (!solicitud) {
      throw new NotFoundException({
        codigo: 'SOLICITUD_NO_ENCONTRADA',
        mensaje: 'La solicitud de reserva no existe',
      });
    }

    if (solicitud.estado !== 'PENDIENTE') {
      throw new BadRequestException({
        codigo: 'SOLICITUD_NO_PENDIENTE',
        mensaje: `La solicitud ya se encuentra ${solicitud.estado.toLowerCase()}`,
      });
    }

    const nombre = dto.nombre?.trim() || solicitud.nombre?.trim() || solicitud.conversacion?.nombre_contacto?.trim() || 'Cliente';
    const telefono = dto.telefono?.trim() || solicitud.telefono?.trim() || solicitud.conversacion?.telefono?.trim() || '';
    const personas = dto.personas ?? solicitud.personas ?? 2;
    const horaEfectiva = dto.hora || (solicitud.hora ? solicitud.hora.toISOString() : new Date().toISOString());
    const fechaHora = this.parsearHora(horaEfectiva);

    if (fechaHora.getTime() <= Date.now()) {
      throw new BadRequestException({
        codigo: 'HORA_PASADA',
        mensaje: 'La hora solicitada ya pasó. Elige una hora nueva para aprobar la reserva.',
      });
    }

    // Todas las validaciones antes de escribir: si fallan, la solicitud sigue PENDIENTE.
    const mesaIds = dto.mesas.map((id) => BigInt(id));
    await this.validarNuevaReserva(fechaHora, mesaIds, personas, {
      confirmarCapacidad: dto.confirmarCapacidad,
    });
    const toleranciaMin = await this.obtenerToleranciaMin();

    // Reserva, solicitud y aviso al cliente en una sola transacción: no queda reserva huérfana
    // si algo falla, y reintentar no crea una segunda reserva.
    const { solicitudActualizada, reserva } = await this.prisma.$transaction(async (tx) => {
      const reservaCreada = await this.insertarReserva(tx, {
        nombre,
        telefono,
        personas,
        fechaHora,
        mesaIds,
        toleranciaMin,
      });
      // Solo transiciona si sigue PENDIENTE: dos aprobaciones seguidas no crean dos reservas.
      // Si no es 1, el throw deshace también la reserva creada arriba.
      const { count } = await tx.solicitudReserva.updateMany({
        where: { id: sId, estado: 'PENDIENTE' },
        data: { estado: 'APROBADA', reserva_id: reservaCreada.id },
      });
      if (count !== 1) {
        throw new BadRequestException({
          codigo: 'SOLICITUD_NO_PENDIENTE',
          mensaje: 'La solicitud ya fue atendida por otra persona. Actualiza la pantalla.',
        });
      }
      const actualizada = { ...solicitud, estado: 'APROBADA', reserva_id: reservaCreada.id };
      // Mensaje al cliente: se encola en la misma transacción que la solicitud (outbox)
      const { fechaIso: fechaLima, horaMinutos: horaLima } = obtenerFechaHoraLima(fechaHora);
      const msgConfirmacion = TEXTOS_RESERVA.reservaConfirmadaCliente({
        personas,
        fechaTexto: fechaDeIso(fechaLima),
        hora: horaLima,
        toleranciaMin: reservaCreada.tolerancia_min || 15,
      });

      if (this.outbox && telefono) {
        await this.outbox.encolar({
          telefono,
          tipo: 'TEXTO',
          clave: `reserva-confirmada-${solicitud.id}`,
          origen: 'RESERVA',
          carga: {
            textoLibre: msgConfirmacion,
            plantillaClave: 'RESERVA_CONFIRMADA',
            variablesPlantilla: [nombre, `${fechaDeIso(fechaLima)} ${horaLima}`, String(personas)],
            autor: 'PERSONA',
            nombre,
            etapa: 'SOLICITUD_APROBADA',
          },
        }, tx);
      }
      return { solicitudActualizada: actualizada, reserva: reservaCreada };
    });
    this.outbox?.despertar();

    await this.registrarReservaCreada(reserva, mesaIds, usuario, ip);

    // Auditoría
    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'reservas',
      accion: 'APROBAR_SOLICITUD',
      resultado: 'OK',
      entidad: 'solicitud_reserva',
      entidadId: sId,
      despues: {
        solicitudId: sId.toString(),
        reservaId: reserva.id.toString(),
        mesas: dto.mesas,
      },
      partyId: usuario?.partyId ? BigInt(usuario.partyId) : undefined,
      ip,
    });

    // Socket
    this.eventosGateway?.emitirAdmin?.('reserva:solicitud_cambio', {
      tipo: 'APROBADA',
      solicitudId: sId.toString(),
      reservaId: reserva.id.toString(),
    });

    return {
      solicitud: this.serializarSolicitud(solicitudActualizada),
      reserva: this.serializarReserva(reserva),
    };
  }

  /**
   * Rechaza una solicitud de reserva con motivo y alternativas opcionales,
   * y notifica al cliente por WhatsApp.
   */
  async rechazarSolicitud(
    id: bigint | string | number,
    dto: { motivo: string; alternativas?: string },
    usuario?: UsuarioAutenticado,
    ip?: string,
  ) {
    if (!dto?.motivo || dto.motivo.trim().length < 5) {
      throw new BadRequestException({
        codigo: 'MOTIVO_REQUERIDO',
        mensaje: 'El motivo de rechazo es obligatorio (mínimo 5 caracteres)',
      });
    }

    const sId = BigInt(id);
    const solicitud = await this.prisma.solicitudReserva.findUnique({
      where: { id: sId },
      include: { conversacion: true },
    });

    if (!solicitud) {
      throw new NotFoundException({
        codigo: 'SOLICITUD_NO_ENCONTRADA',
        mensaje: 'La solicitud de reserva no existe',
      });
    }

    if (solicitud.estado !== 'PENDIENTE') {
      throw new BadRequestException({
        codigo: 'SOLICITUD_NO_PENDIENTE',
        mensaje: `La solicitud ya se encuentra ${solicitud.estado.toLowerCase()}`,
      });
    }

    const nombre = solicitud.nombre || solicitud.conversacion?.nombre_contacto || 'Cliente';
    const telefono = solicitud.telefono || solicitud.conversacion?.telefono || '';
    const solicitudActualizada = await this.prisma.$transaction(async (tx) => {
      // Solo rechaza si sigue PENDIENTE: un rechazo tardío no pisa una aprobación.
      const { count } = await tx.solicitudReserva.updateMany({
        where: { id: sId, estado: 'PENDIENTE' },
        data: { estado: 'RECHAZADA', motivo_rechazo: dto.motivo.trim() },
      });
      if (count !== 1) {
        throw new BadRequestException({
          codigo: 'SOLICITUD_NO_PENDIENTE',
          mensaje: 'La solicitud ya fue atendida por otra persona. Actualiza la pantalla.',
        });
      }
      const actualizada = {
        ...solicitud,
        estado: 'RECHAZADA',
        motivo_rechazo: dto.motivo.trim(),
      };
      const { fechaIso: fechaLima, horaMinutos: horaLima } = solicitud.hora
        ? obtenerFechaHoraLima(solicitud.hora)
        : { fechaIso: '', horaMinutos: '' };

      const msgRechazo = TEXTOS_RESERVA.reservaRechazadaCliente({
        nombre,
        fechaTexto: fechaDeIso(fechaLima),
        hora: horaLima,
        motivo: dto.motivo.trim(),
        alternativas: dto.alternativas,
      });

      if (this.outbox && telefono) {
        await this.outbox.encolar({
          telefono,
          tipo: 'TEXTO',
          clave: `reserva-rechazada-${solicitud.id}`,
          origen: 'RESERVA',
          carga: {
            textoLibre: msgRechazo,
            plantillaClave: 'RESERVA_ACTUALIZACION',
            variablesPlantilla: [nombre, `Solicitud no confirmada: ${dto.motivo.trim()}`],
            autor: 'PERSONA',
            nombre,
            etapa: 'SOLICITUD_RECHAZADA',
          },
        }, tx);
      }
      return actualizada;
    });
    this.outbox?.despertar();

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'reservas',
      accion: 'RECHAZAR_SOLICITUD',
      resultado: 'OK',
      entidad: 'solicitud_reserva',
      entidadId: sId,
      despues: {
        solicitudId: sId.toString(),
        motivo: dto.motivo.trim(),
        alternativas: dto.alternativas,
      },
      partyId: usuario?.partyId ? BigInt(usuario.partyId) : undefined,
      ip,
    });

    this.eventosGateway?.emitirAdmin?.('reserva:solicitud_cambio', {
      tipo: 'RECHAZADA',
      solicitudId: sId.toString(),
      motivo: dto.motivo.trim(),
    });

    // Enviar WhatsApp al cliente

    return this.serializarSolicitud(solicitudActualizada);
  }
}
