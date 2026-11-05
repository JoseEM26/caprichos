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
import { CrearReservaDto } from './dto/crear-reserva.dto';
import { ActualizarReservaDto } from './dto/actualizar-reserva.dto';
import { CancelarReservaDto } from './dto/cancelar-reserva.dto';
import { Ventana24hService } from '../chatbot/servicios/ventana-24h.service';
import { TEXTOS_RESERVA } from '../chatbot/conversacion/textos-reserva';
import { generarFranjasPorDefecto } from '../chatbot/conversacion/flujos/reserva/flujo-reserva';
import { OutboxWhatsappService } from '../chatbot/servicios/outbox-whatsapp.service';

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
   * Valida que la hora caiga dentro del horario de atención del día (hora Lima),
   * considerando fechas especiales y horario regular por día de semana.
   */
  async validarHorarioAtencion(fechaHora: Date): Promise<void> {
    const { fechaIso, horaMinutos, diaSemana } = obtenerFechaHoraLima(fechaHora);

    // 1. Fecha especial para el día (anclada a 00:00:00.000Z)
    const fechaDate = new Date(`${fechaIso}T00:00:00.000Z`);
    const fechaEspecial = await this.prisma.fechaEspecial.findUnique({
      where: { fecha: fechaDate },
    });

    let abre: string | null = null;
    let cierra: string | null = null;

    if (fechaEspecial) {
      if (fechaEspecial.cerrado) {
        throw new BadRequestException({
          codigo: 'FUERA_DE_HORARIO',
          mensaje: `El local se encuentra cerrado en la fecha indicada (${fechaEspecial.motivo || 'Fecha especial'})`,
        });
      }
      abre = formatearHora(fechaEspecial.abre);
      cierra = formatearHora(fechaEspecial.cierra);
    } else {
      const horario = await this.prisma.horarioDia.findUnique({
        where: { dia_semana: diaSemana },
      });

      if (!horario || horario.cerrado || !horario.abre || !horario.cierra) {
        throw new BadRequestException({
          codigo: 'FUERA_DE_HORARIO',
          mensaje: 'El local no atiende en el día de la semana seleccionado',
        });
      }
      abre = formatearHora(horario.abre);
      cierra = formatearHora(horario.cierra);
    }

    if (!abre || !cierra || horaMinutos < abre || horaMinutos > cierra) {
      throw new BadRequestException({
        codigo: 'FUERA_DE_HORARIO',
        mensaje: `La hora seleccionada (${horaMinutos}) está fuera del horario de atención (${abre ?? '--'} a ${cierra ?? '--'})`,
      });
    }
  }

  /**
   * Valida existencia de mesas, que estén activas, sean de tipo MESA,
   * y que la suma de sus asientos alcance para el número de personas.
   */
  async validarMesasYAsientos(mesaIds: bigint[], personas: number): Promise<void> {
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
    if (totalAsientos < personas) {
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

    for (const r of vencidas) {
      await this.prisma.reserva.update({
        where: { id: r.id },
        data: { estado: 'NO_ASISTIO' },
      });

      await this.auditoria.registrar({
        categoria: 'CAMBIO',
        modulo: 'reservas',
        accion: 'EXPIRAR_TOLERANCIA',
        resultado: 'OK',
        entidad: 'reserva',
        entidadId: r.id,
        antes: { estado: 'ACTIVA' },
        despues: { estado: 'NO_ASISTIO', actor: 'sistema' },
        motivo: 'Tolerancia vencida (sistema)',
      });

      this.eventosGateway?.emitirAdmin?.('reserva:cambio', {
        tipo: 'NO_ASISTIO',
        reservaId: r.id.toString(),
        actor: 'sistema',
      });
    }

    return vencidas.length;
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
    await this.validarNuevaReserva(fechaHora, mesaIds, dto.personas);

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

  /** Horario de atención y mesas/asientos de una reserva nueva. No escribe nada. */
  private async validarNuevaReserva(fechaHora: Date, mesaIds: bigint[], personas: number) {
    await this.validarHorarioAtencion(fechaHora);
    await this.validarMesasYAsientos(mesaIds, personas);
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
      await this.validarMesasYAsientos(nuevosMesaIds, nuevasPersonas);
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
   * Obtiene las franjas horarias disponibles para una fecha (YYYY-MM-DD) y número de personas.
   * Valida horario de atención (excluye si está cerrado, usa hora_inicio = abre + 1h, hora_fin = cierra - 1h en pasos de 30m).
   * Filtra las franjas que no tengan mesas con asientos suficientes libres.
   */
  async obtenerFranjasDisponibles(
    fechaIso: string,
    personas: number,
    ahora: Date = new Date(),
  ): Promise<string[]> {
    // 1. Obtener horario del día (America/Lima)
    const fechaDate = new Date(`${fechaIso}T00:00:00.000Z`);
    const fechaEspecial = await this.prisma.fechaEspecial.findUnique({
      where: { fecha: fechaDate },
    });

    let abre: string | null = null;
    let cierra: string | null = null;

    if (fechaEspecial) {
      if (fechaEspecial.cerrado) {
        return [];
      }
      abre = formatearHora(fechaEspecial.abre);
      cierra = formatearHora(fechaEspecial.cierra);
    } else {
      const d = new Date(`${fechaIso}T12:00:00-05:00`);
      const { diaSemana } = obtenerFechaHoraLima(d);
      const horario = await this.prisma.horarioDia.findUnique({
        where: { dia_semana: diaSemana },
      });

      if (!horario || horario.cerrado || !horario.abre || !horario.cierra) {
        return [];
      }
      abre = formatearHora(horario.abre);
      cierra = formatearHora(horario.cierra);
    }

    if (!abre || !cierra) {
      return [];
    }

    // 2. Generar slots cada 30 minutos (1h después de abrir hasta 1h antes de cerrar)
    const franjasBase = generarFranjasPorDefecto(abre, cierra);

    // 3. Si la fecha es hoy, filtrar slots pasados
    const { fechaIso: hoyLima, horaMinutos: horaActualLima } = obtenerFechaHoraLima(ahora);
    const franjasFuturas = franjasBase.filter((h) => {
      if (fechaIso === hoyLima) {
        return h > horaActualLima;
      }
      return true;
    });

    // 4. Consultar mesas activas
    const mesasActivas = await this.prisma.elementoPlano.findMany({
      where: { activo: true, tipo: 'MESA' },
    });

    const totalAsientosSalon = mesasActivas.reduce((sum, m) => sum + (m.asientos ?? 0), 0);
    if (totalAsientosSalon < personas) {
      return [];
    }

    // 5. Consultar reservas activas del día
    const inicioDia = new Date(`${fechaIso}T00:00:00-05:00`);
    const finDia = new Date(`${fechaIso}T23:59:59.999-05:00`);

    const reservasDia = await this.prisma.reserva.findMany({
      where: {
        estado: { in: ['ACTIVA', 'SENTADA'] },
        hora: { gte: inicioDia, lte: finDia },
      },
      include: { mesas: true },
    });

    const toleranciaMin = await this.obtenerToleranciaMin();

    // 6. Para cada franja, comprobar si hay mesas suficientes disponibles
    const franjasDisponibles: string[] = [];

    for (const horaSlot of franjasFuturas) {
      const slotTime = new Date(`${fechaIso}T${horaSlot}:00-05:00`).getTime();
      const mesasOcupadasIds = new Set<string>();

      for (const res of reservasDia) {
        const resTime = res.hora.getTime();
        const duracionReservaMs = 60 * 60 * 1000;
        if (
          slotTime >= resTime - toleranciaMin * 60 * 1000 &&
          slotTime < resTime + duracionReservaMs
        ) {
          for (const rm of res.mesas) {
            if (rm.mesa_id) {
              mesasOcupadasIds.add(rm.mesa_id.toString());
            }
          }
        }
      }

      const mesasLibres = mesasActivas.filter((m) => !mesasOcupadasIds.has(m.id.toString()));
      const asientosLibres = mesasLibres.reduce((sum, m) => sum + (m.asientos ?? 0), 0);

      if (asientosLibres >= personas) {
        franjasDisponibles.push(horaSlot);
      }
    }

    return franjasDisponibles;
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
    await this.validarNuevaReserva(fechaHora, mesaIds, personas);
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
      const actualizada = await tx.solicitudReserva.update({
        where: { id: sId },
        data: {
          estado: 'APROBADA',
          reserva_id: reservaCreada.id,
        },
        include: { conversacion: true },
      });
      // Mensaje al cliente: se encola en la misma transacción que la solicitud (outbox)
      const { fechaIso: fechaLima, horaMinutos: horaLima } = obtenerFechaHoraLima(fechaHora);
      const msgConfirmacion = TEXTOS_RESERVA.reservaConfirmadaCliente({
        personas,
        fechaTexto: fechaLima,
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
            variablesPlantilla: [nombre, `${fechaLima} ${horaLima}`, String(personas)],
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
      const actualizada = await tx.solicitudReserva.update({
        where: { id: sId },
        data: {
          estado: 'RECHAZADA',
          motivo_rechazo: dto.motivo.trim(),
        },
        include: { conversacion: true },
      });
      const { fechaIso: fechaLima, horaMinutos: horaLima } = solicitud.hora
        ? obtenerFechaHoraLima(solicitud.hora)
        : { fechaIso: '', horaMinutos: '' };

      const msgRechazo = TEXTOS_RESERVA.reservaRechazadaCliente({
        nombre,
        fechaTexto: fechaLima,
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
