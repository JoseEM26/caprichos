import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { formatearHora, obtenerFechaHoraLima } from '../local/local.util';
import { CrearReservaDto } from './dto/crear-reserva.dto';
import { ActualizarReservaDto } from './dto/actualizar-reserva.dto';
import { CancelarReservaDto } from './dto/cancelar-reserva.dto';

@Injectable()
export class ReservasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly eventosGateway: EventosGateway,
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
    const fechaHora = new Date(dto.hora);
    if (isNaN(fechaHora.getTime())) {
      throw new BadRequestException({
        codigo: 'FORMATO_INVALIDO',
        mensaje: 'La hora de la reserva no es válida',
      });
    }

    if (fechaHora.getTime() <= ahora.getTime()) {
      throw new BadRequestException({
        codigo: 'HORA_PASADA',
        mensaje: 'La hora de la reserva ya pasó',
      });
    }

    await this.validarHorarioAtencion(fechaHora);

    const mesaIds = dto.mesas.map((id) => BigInt(id));
    await this.validarMesasYAsientos(mesaIds, dto.personas);

    const toleranciaMin = await this.obtenerToleranciaMin();

    const reserva = await this.prisma.reserva.create({
      data: {
        nombre: dto.nombre.trim(),
        telefono: dto.telefono.trim(),
        personas: dto.personas,
        hora: fechaHora,
        tolerancia_min: toleranciaMin,
        estado: 'ACTIVA',
        mesas: {
          create: mesaIds.map((mesaId) => ({
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

    return this.serializarReserva(reserva);
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
}
