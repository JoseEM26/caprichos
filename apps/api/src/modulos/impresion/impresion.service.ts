import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import {
  AREA_BEBIDAS,
  EstadoAdminImpresion,
  EstadoImpresora,
  RespuestaTomarTrabajos,
  RolImpresora,
  rolDeTrabajo,
  TipoTrabajoImpresion,
  TicketPagoDatos,
} from '@caprichos/compartido';
import {
  CrearLlaveDto,
  DescartarDto,
  LatidoDto,
  ReimprimirDto,
  ResultadoTrabajoDto,
  VaciarColaDto,
} from './dto';
import {
  CLAVE_GENERAL,
  claveDeTrabajo,
  claveEtiquetaArea,
  claveEtiquetaBebida,
  construirEtiquetaGeneral,
  construirEtiquetaPrueba,
  construirEtiquetasArea,
  construirEtiquetasBebida,
  construirTodasLasEtiquetas,
  construirTicketPago,
  construirTicketPrueba,
  construirTicketNotaMozo,
  construirTicketComandaSalon,
  construirTicketComandaArea,
  areasDeLineas,
} from './constructor-etiquetas';
import {
  consultarEstadoAgente,
  empaquetarDetalleLatido,
  estadoPorRol,
  leerParametroNumerico,
  rolesDeclarados,
} from './estado-impresion';
import {
  CONTEXTO_RUTEO_VACIO,
  ContextoRuteo,
  aplicaSegunReglas,
  destinoDeTrabajo,
  tiposDeRoles,
} from './ruteo-impresion';
import { leerReglasImpresion } from './reglas-impresion';
import { EventosGateway } from '../../comun/socket/eventos.gateway';

/** Estados de print_job que cuentan como "en cola" para el admin y para no reencolar dos veces. */
const TIPOS_ETIQUETA = ['ETIQUETA_GENERAL', 'ETIQUETA_AREA', 'ETIQUETA_BEBIDA'];

const ESTADOS_EN_COLA = ['PENDIENTE', 'IMPRIMIENDO'];

/** Una prueba de impresión por máquina cada 10 s (las pruebas no tienen pedido: pedido_id NULL). */
const ESPERA_PRUEBA_MS = 10 * 1000;

/** Estado técnico de print_job -> estado que ve el cajero en cada etiqueta. */
const ESTADO_ETIQUETA: Record<string, string> = {
  PENDIENTE: 'EN_COLA',
  IMPRIMIENDO: 'IMPRIMIENDO',
  IMPRESO: 'IMPRESA',
  FALLIDO: 'FALLIDA',
  VENCIDO: 'VENCIDA',
  DESCARTADO: 'DESCARTADA',
};

/** Roles que pueden descartar etiquetas de la cola. */
const ROLES_DESCARTAR = ['ADMIN', 'CAJERO'];

const FILTROS_COLA: Record<string, string> = {
  pendientes: 'PENDIENTE',
  en_curso: 'IMPRIMIENDO',
  impresos: 'IMPRESO',
  fallidos: 'FALLIDO',
  vencidos: 'VENCIDO',
  descartados: 'DESCARTADO',
};

const INCLUDE_LINEAS_PEDIDO = {
  lineas: {
    include: {
      area: true,
      producto: {
        include: {
          categoria: true,
        },
      },
      opcionesElegidas: true,
      sabores: true,
    },
  },
};

@Injectable()
export class ImpresionService {
  private readonly logger = new Logger(ImpresionService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly auditoria?: AuditoriaService,
    @Optional() private readonly eventos?: EventosGateway,
  ) {}

  /**
   * Toma de forma atómica (FOR UPDATE SKIP LOCKED) los trabajos PENDIENTE más antiguos.
   * Recupera además trabajos IMPRIMIENDO con más de 2 minutos sin resultado.
   * Antes de tomar, vence lo que ya no debe salir (pedido anulado o demasiado viejo).
   */
  async tomarTrabajos(
    max = 10,
    deviceKeyId?: bigint,
    roles?: RolImpresora[],
    areaId: bigint | null = null,
  ): Promise<RespuestaTomarTrabajos> {
    // Con roles, solo los trabajos de las máquinas que el agente puede imprimir ahora; el resto espera en cola.
    // Por área: un equipo de área solo toma lo suyo (destino_area_id); Caja (areaId null) toma lo de destino NULL.
    const tipos = roles ? tiposDeRoles(roles) : null;
    const limite = Math.min(Math.max(1, max || 10), 10);

    await this.vencerTrabajosObsoletos().catch((err: any) =>
      this.logger.warn(`Error al vencer trabajos de impresión: ${err.message}`),
    );

    // 1. Recuperar huérfanos (> 2 minutos en IMPRIMIENDO)
    const haceDosMinutos = new Date(Date.now() - 2 * 60 * 1000);
    try {
      await this.prisma.printJob.updateMany({
        where: {
          estado: 'IMPRIMIENDO',
          tomado_en: { lt: haceDosMinutos },
        },
        data: {
          estado: 'PENDIENTE',
        },
      });
    } catch (err: any) {
      this.logger.warn(`Error recuperando trabajos huérfanos: ${err.message}`);
    }

    // 2. Selección atómica con SKIP LOCKED
    return this.prisma.$transaction(async (tx) => {
      let ids: bigint[] = [];

      try {
        const filas: Array<{ id: bigint }> = tipos
          ? await tx.$queryRaw`
          SELECT id FROM "print_job"
          WHERE estado = 'PENDIENTE'
            AND destino_area_id IS NOT DISTINCT FROM ${areaId}::bigint
            AND tipo = ANY(${tipos}::text[])
          ORDER BY id ASC
          LIMIT ${limite}
          FOR UPDATE SKIP LOCKED
        `
          : await tx.$queryRaw`
          SELECT id FROM "print_job"
          WHERE estado = 'PENDIENTE'
            AND destino_area_id IS NOT DISTINCT FROM ${areaId}::bigint
          ORDER BY id ASC
          LIMIT ${limite}
          FOR UPDATE SKIP LOCKED
        `;
        ids = filas.map((f) => f.id);
      } catch (err: any) {
        // Fallback para entornos donde raw SQL no soporte FOR UPDATE SKIP LOCKED (ej: SQLite mock)
        this.logger.warn(`Fallo $queryRaw SKIP LOCKED, usando findMany: ${err.message}`);
        const filas = await tx.printJob.findMany({
          where: { estado: 'PENDIENTE', destino_area_id: areaId, ...(tipos ? { tipo: { in: tipos } } : {}) },
          orderBy: { id: 'asc' },
          take: limite,
          select: { id: true },
        });
        ids = filas.map((f) => f.id);
      }

      if (ids.length === 0) {
        return { trabajos: [] };
      }

      const ahora = new Date();
      await tx.printJob.updateMany({
        where: { id: { in: ids } },
        data: {
          estado: 'IMPRIMIENDO',
          tomado_en: ahora,
          device_key_id: deviceKeyId || null,
        },
      });

      const actualizados = await tx.printJob.findMany({
        where: { id: { in: ids } },
        orderBy: { id: 'asc' },
      });

      return {
        trabajos: actualizados.map((t) => ({
          id: t.id.toString(),
          tipo: t.tipo as TipoTrabajoImpresion,
          payload: t.payload as any,
          copia: t.copia,
          intentos: t.intentos,
        })),
      };
    });
  }

  /**
   * Procesa el resultado de un trabajo reportado por el agente local.
   */
  async registrarResultado(dto: ResultadoTrabajoDto): Promise<void> {
    let bigId: bigint;
    try {
      bigId = BigInt(dto.id);
    } catch {
      throw new BadRequestException({
        codigo: 'ID_INVALIDO',
        mensaje: 'Identificador de trabajo no válido',
      });
    }

    const trabajo = await this.prisma.printJob.findUnique({
      where: { id: bigId },
    });

    if (!trabajo) {
      throw new NotFoundException({
        codigo: 'TRABAJO_NO_ENCONTRADO',
        mensaje: 'Trabajo de impresión no encontrado',
      });
    }

    // Un trabajo descartado no se toca: el agente no debe devolverlo a la cola
    if (trabajo.estado === 'DESCARTADO') return;

    if (dto.ok) {
      await this.prisma.printJob.update({
        where: { id: bigId },
        data: {
          estado: 'IMPRESO',
          impreso_en: new Date(),
          error: null,
        },
      });
      return;
    }

    // Caso de error: incrementar intentos y volver a PENDIENTE o pasar a FALLIDO al 5to
    const nuevosIntentos = trabajo.intentos + 1;
    const pasaAFallido = nuevosIntentos >= 5;
    const estadoFinal = pasaAFallido ? 'FALLIDO' : 'PENDIENTE';
    const detalleError =
      dto.error?.trim() ||
      (pasaAFallido
        ? 'Límite de 5 intentos alcanzado'
        : 'Error de impresión reportado por el agente');

    await this.prisma.printJob.update({
      where: { id: bigId },
      data: {
        intentos: nuevosIntentos,
        estado: estadoFinal,
        error: detalleError,
      },
    });
  }

  /**
   * Guarda el latido periódico del agente en su DeviceKey.
   */
  async registrarLatido(dto: LatidoDto, deviceKeyId: bigint): Promise<void> {
    let antes: any = null;
    try {
      antes = await this.prisma.deviceKey.findUnique({ where: { id: deviceKeyId } });
    } catch {
      // sin estado previo: se emite el evento igual
    }
    const estadoAntes = JSON.stringify(estadoPorRol(antes));
    await this.prisma.deviceKey.update({
      where: { id: deviceKeyId },
      data: {
        ultimo_latido: new Date(),
        latido_version: dto.version,
        latido_impresora: dto.impresora,
        latido_detalle: empaquetarDetalleLatido(dto.detalle, dto.impresoras),
        ultima_conexion: new Date(),
      },
    });
    // Si cambió el estado de alguna máquina, las pantallas lo ven en vivo
    const ahora = {
      ultimo_latido: new Date(),
      latido_impresora: dto.impresora,
      latido_detalle: empaquetarDetalleLatido(dto.detalle, dto.impresoras),
    };
    const impresoras = estadoPorRol(ahora);
    if (JSON.stringify(impresoras) !== estadoAntes) {
      this.eventos?.emitirAdmin('impresion:estado', { impresoras });
    }
  }

  /**
   * Retorna el estado global del subsistema de impresión para el admin.
   */
  async obtenerEstadoAdmin(): Promise<EstadoAdminImpresion> {
    const agente = await this.prisma.deviceKey.findFirst({
      where: { tipo: 'AGENTE', activo: true },
      orderBy: { ultimo_latido: 'desc' },
    });

    const ahora = Date.now();
    const diffMs = agente?.ultimo_latido
      ? ahora - new Date(agente.ultimo_latido).getTime()
      : Infinity;
    const conectado = diffMs <= 60 * 1000;

    const [pendientes, fallidos] = await Promise.all([
      this.prisma.printJob.count({
        where: { estado: { in: ['PENDIENTE', 'IMPRIMIENDO'] } },
      }),
      this.prisma.printJob.count({
        where: { estado: 'FALLIDO' },
      }),
    ]);

    return {
      agente: conectado ? 'conectado' : 'sin_conexion',
      ultimoLatido: agente?.ultimo_latido ? agente.ultimo_latido.toISOString() : null,
      impresora: (agente?.latido_impresora as EstadoImpresora) || 'desconectada',
      impresoras: estadoPorRol(agente),
      pendientes,
      fallidos,
    };
  }

  /**
   * Lista trabajos de impresión con filtros y paginación para el admin.
   */
  async listarTrabajos(
    estado?: string,
    pedido?: string,
    pagina = 1,
    limite = 20,
  ) {
    const skip = Math.max(0, (pagina - 1) * limite);
    const take = Math.min(Math.max(1, limite), 100);

    const where: any = {};
    if (estado && estado !== 'TODOS') {
      where.estado = estado.toUpperCase().trim();
    }
    if (pedido && pedido.trim()) {
      const termino = pedido.trim();
      const num = Number(termino);
      where.OR = [
        { pedido: { codigo: { contains: termino, mode: 'insensitive' } } },
        ...(isNaN(num) ? [] : [{ pedido_id: BigInt(num) }]),
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.printJob.findMany({
        where,
        include: {
          pedido: {
            select: {
              id: true,
              codigo: true,
              cliente_nombre: true,
              modalidad: true,
              mesa_nombre: true,
            },
          },
        },
        orderBy: { id: 'desc' },
        skip,
        take,
      }),
      this.prisma.printJob.count({ where }),
    ]);

    return {
      items: items.map((t) => ({
        id: t.id.toString(),
        pedidoId: t.pedido_id?.toString() ?? null,
        destinoAreaId: t.destino_area_id?.toString() ?? null,
        pedidoCodigo: t.pedido?.codigo || '',
        clienteNombre: t.pedido?.cliente_nombre || '',
        tipo: t.tipo,
        estado: t.estado,
        intentos: t.intentos,
        error: t.error,
        copia: t.copia,
        en: t.en.toISOString(),
        tomadoEn: t.tomado_en?.toISOString() || null,
        impresoEn: t.impreso_en?.toISOString() || null,
        payload: t.payload,
      })),
      total,
      pagina,
      paginas: Math.ceil(total / take) || 1,
    };
  }

  /**
   * Cola agrupada por pedido para el admin. `filtro`: pendientes (defecto), en_curso, impresos,
   * fallidos, vencidos, descartados o todos. `minutos` solo afecta al conteo de pendientes antiguas.
   */
  async listarCola(filtro = 'pendientes', pagina = 1, limite = 20, minutos = 30) {
    const take = Math.min(Math.max(1, limite || 20), 100);
    const pag = Math.max(1, pagina || 1);
    const estado = FILTROS_COLA[filtro];
    const mins = minutos > 0 ? minutos : 30;

    // ponytail: se agrupa en memoria con tope de 2000 trabajos; pasar a groupBy SQL si la cola crece
    const [trabajos, porEstado, antiguas] = await Promise.all([
      this.prisma.printJob.findMany({
        where: estado ? { estado } : {},
        include: { pedido: { select: { codigo: true, cliente_nombre: true } } },
        orderBy: { id: 'desc' },
        take: 2000,
      }),
      this.prisma.printJob.groupBy({ by: ['estado'], _count: { _all: true } }),
      this.prisma.printJob.count({
        where: { estado: 'PENDIENTE', en: { lt: new Date(Date.now() - mins * 60 * 1000) } },
      }),
    ]);

    const grupos = new Map<string, any>();
    for (const t of trabajos) {
      // Cada prueba va en su propio grupo (no tiene pedido)
      const esPrueba = t.pedido_id === null;
      const k = esPrueba ? `prueba-${t.id}` : t.pedido_id!.toString();
      let g = grupos.get(k);
      if (!g) {
        g = {
          pedidoId: esPrueba ? null : k,
          esPrueba,
          pedidoCodigo: esPrueba ? 'PRUEBA' : (t.pedido?.codigo || ''),
          clienteNombre: esPrueba ? 'Prueba de impresión' : (t.pedido?.cliente_nombre || ''),
          cantidad: 0,
          estados: {} as Record<string, number>,
          masAntiguaEn: t.en,
          error: null as string | null,
          trabajoIds: [] as string[],
        };
        grupos.set(k, g);
      }
      g.cantidad += 1;
      g.estados[t.estado] = (g.estados[t.estado] || 0) + 1;
      if (t.en < g.masAntiguaEn) g.masAntiguaEn = t.en;
      if (!g.error && t.error) g.error = t.error;
      g.trabajoIds.push(t.id.toString());
    }

    const todos = [...grupos.values()].sort((a, b) => a.masAntiguaEn - b.masAntiguaEn);
    const total = todos.length;
    const items = todos.slice((pag - 1) * take, pag * take).map((g) => ({
      ...g,
      masAntiguaEn: g.masAntiguaEn.toISOString(),
    }));

    const n = (e: string) => porEstado.find((x: any) => x.estado === e)?._count?._all ?? 0;
    return {
      items,
      total,
      pagina: pag,
      paginas: Math.ceil(total / take) || 1,
      resumen: {
        pendientes: n('PENDIENTE'),
        enCurso: n('IMPRIMIENDO'),
        fallidos: n('FALLIDO'),
        vencidos: n('VENCIDO'),
        descartados: n('DESCARTADO'),
        pendientesAntiguas: antiguas,
        minutosAntiguas: mins,
      },
    };
  }

  private exigirRolDescartar(usuario?: UsuarioAutenticado) {
    const rolesUsuario = (usuario?.roles ?? [usuario?.rol ?? '']).map((r) => String(r || '').toUpperCase());
    if (!rolesUsuario.some((r) => ROLES_DESCARTAR.includes(r))) {
      throw new ForbiddenException({
        codigo: 'SIN_PERMISO_DESCARTAR',
        mensaje: 'Solo Caja o un administrador pueden descartar etiquetas de la cola',
      });
    }
  }

  /** Marca DESCARTADO (nada se borra) y audita con el conteo. Solo toca lo que el agente aún no tomó. */
  private async descartar(
    where: any,
    motivo: string,
    accion: string,
    detalle: Record<string, unknown>,
    usuario?: UsuarioAutenticado,
    ip?: string,
  ) {
    const res = await this.prisma.printJob.updateMany({
      where,
      data: { estado: 'DESCARTADO', error: `Descartada: ${motivo}` },
    });
    if (this.auditoria && usuario) {
      await this.auditoria.registrar({
        categoria: 'CAMBIO',
        modulo: 'impresion',
        accion,
        entidad: 'print_job',
        partyId: usuario.partyId,
        motivo,
        despues: { descartadas: res.count, ...detalle },
        ip,
      });
    }
    this.eventos?.emitirAdmin('impresion:cola', { descartadas: res.count });
    return {
      ok: true,
      descartadas: res.count,
      mensaje: res.count > 0
        ? `Se descartaron ${res.count} etiqueta(s); no se imprimirán`
        : 'No había etiquetas para descartar',
    };
  }

  async vaciarCola(dto: VaciarColaDto, usuario?: UsuarioAutenticado, ip?: string) {
    this.exigirRolDescartar(usuario);
    const motivo = (dto.motivo || '').trim();
    if (motivo.length < 5) {
      throw new BadRequestException({
        codigo: 'MOTIVO_OBLIGATORIO',
        mensaje: 'Escribe el motivo (al menos 5 caracteres)',
      });
    }
    const where: any = { estado: 'PENDIENTE' };
    if (dto.alcance === 'ANTIGUAS') {
      const mins = dto.minutos && dto.minutos > 0 ? dto.minutos : 30;
      where.en = { lt: new Date(Date.now() - mins * 60 * 1000) };
    }
    if (dto.pedido_id) {
      try {
        where.pedido_id = BigInt(dto.pedido_id);
      } catch {
        throw new BadRequestException({ codigo: 'ID_INVALIDO', mensaje: 'Identificador de pedido no válido' });
      }
    }
    return this.descartar(
      where, motivo, 'VACIAR_COLA',
      { alcance: dto.alcance, minutos: dto.minutos ?? null, pedidoId: dto.pedido_id ?? null },
      usuario, ip,
    );
  }

  async descartarTrabajo(id: string | number, dto: DescartarDto, usuario?: UsuarioAutenticado, ip?: string) {
    this.exigirRolDescartar(usuario);
    let bigId: bigint;
    try {
      bigId = BigInt(id);
    } catch {
      throw new BadRequestException({ codigo: 'ID_INVALIDO', mensaje: 'Identificador no válido' });
    }
    const motivo = dto?.motivo?.trim() || 'Descartada desde la cola de impresión';
    return this.descartar(
      { id: bigId, estado: { in: ['PENDIENTE', 'FALLIDO'] } },
      motivo, 'DESCARTAR_TRABAJO', { trabajoId: bigId.toString() }, usuario, ip,
    );
  }

  async descartarPedido(pedidoIdInput: string | number, dto: DescartarDto, usuario?: UsuarioAutenticado, ip?: string) {
    this.exigirRolDescartar(usuario);
    let pedidoId: bigint;
    try {
      pedidoId = BigInt(pedidoIdInput);
    } catch {
      throw new BadRequestException({ codigo: 'ID_INVALIDO', mensaje: 'Identificador de pedido no válido' });
    }
    const motivo = dto?.motivo?.trim() || 'Descartada desde la cola de impresión';
    return this.descartar(
      { pedido_id: pedidoId, estado: { in: ['PENDIENTE', 'FALLIDO'] } },
      motivo, 'DESCARTAR_PEDIDO', { pedidoId: pedidoId.toString() }, usuario, ip,
    );
  }

  /**
   * Pasa un trabajo FALLIDO a PENDIENTE para reintentarlo.
   */
  async reintentarTrabajo(id: string | number) {
    let bigId: bigint;
    try {
      bigId = BigInt(id);
    } catch {
      throw new BadRequestException({
        codigo: 'ID_INVALIDO',
        mensaje: 'Identificador no válido',
      });
    }

    const trabajo = await this.prisma.printJob.findUnique({
      where: { id: bigId },
    });

    if (!trabajo) {
      throw new NotFoundException({
        codigo: 'TRABAJO_NO_ENCONTRADO',
        mensaje: 'Trabajo de impresión no encontrado',
      });
    }

    const actualizado = await this.prisma.printJob.update({
      where: { id: bigId },
      data: {
        estado: 'PENDIENTE',
        intentos: 0,
        error: null,
        tomado_en: null,
      },
    });

    return {
      ok: true,
      mensaje: 'Trabajo devuelto a la cola de impresión',
      id: actualizado.id.toString(),
    };
  }

  /**
   * Encolado automático de etiquetas al aceptar Caja el pedido.
   * Totalmente idempotente por clave_idempotencia (una general, una por área, una por vaso).
   * Nunca bloquea ni lanza errores hacia el llamador.
   */
  async encolarEtiquetasPedido(pedidoIdInput: bigint | string | number): Promise<void> {
    try {
      const pedidoId = BigInt(pedidoIdInput);

      const pedido: any = await this.prisma.pedido.findUnique({
        where: { id: pedidoId },
        include: {
          lineas: {
            include: {
              area: true,
              producto: {
                include: {
                  categoria: true,
                },
              },
              opcionesElegidas: true,
              sabores: true,
            },
          },
        },
      });

      if (!pedido) {
        this.logger.warn(`No se encontró el pedido ${pedidoId} para encolar etiquetas`);
        return;
      }

      const { general, areas, bebidas } = construirTodasLasEtiquetas(pedido);
      const reglas = await leerReglasImpresion(this.prisma);
      const ctx = await this.contextoRuteo();
      // Solo el primer encolado del pedido avisa a Caja (los reintentos de la misma aceptación no repiten el aviso)
      const yaTenia = (await this.prisma.printJob.count({ where: { pedido_id: pedido.id, tipo: { in: TIPOS_ETIQUETA } } })) > 0;

      // Cada trabajo se encola si la regla de su tipo y modalidad lo pide; su destino sale del ruteo (NULL = Caja)
      let cajas = 0;
      const encolar = async (tipo: string, clave: string, payload: any, areaId: bigint | null) => {
        const destino = destinoDeTrabajo(tipo, areaId, ctx);
        await this.prisma.printJob.upsert({
          where: { clave_idempotencia: clave },
          create: {
            pedido_id: pedido.id,
            area_id: areaId,
            destino_area_id: destino,
            tipo,
            clave_idempotencia: clave,
            payload: payload as any,
            copia: false,
            estado: 'PENDIENTE',
          },
          update: {}, // No sobreescribir si ya existe
        }).catch((e) => this.logger.debug(`${tipo} ya existe: ${e.message}`));
        if (destino === null) cajas += 1;
      };

      if (aplicaSegunReglas('ETIQUETA_GENERAL', pedido.modalidad, reglas)) {
        await encolar('ETIQUETA_GENERAL', `${pedido.id}-ETIQUETA_GENERAL`, general, null);
      }

      if (aplicaSegunReglas('ETIQUETA_AREA', pedido.modalidad, reglas)) {
        for (const a of areas) {
          const areaIdVal = pedido.lineas.find(
            (l: any) => (l.area?.nombre || '').toUpperCase() === a.areaNombre,
          )?.area_id ?? null;
          await encolar('ETIQUETA_AREA', `${pedido.id}-ETIQUETA_AREA-${areaIdVal || a.areaNombre}`, a, areaIdVal);
        }
      }

      if (aplicaSegunReglas('ETIQUETA_BEBIDA', pedido.modalidad, reglas)) {
        for (const b of bebidas) {
          await encolar('ETIQUETA_BEBIDA', `${pedido.id}-ETIQUETA_BEBIDA-${b.bebidaIndex}`, b, null);
        }
      }

      // Comanda completa de salón: a la ticketera de Caja (solo mesa/local, con la regla activa)
      if (aplicaSegunReglas('TICKET_COMANDA_SALON', pedido.modalidad, reglas)) {
        await encolar('TICKET_COMANDA_SALON', `${pedido.id}-TICKET_COMANDA_SALON`, construirTicketComandaSalon(pedido), null);
      }

      // Comanda por área (apagada por defecto): una hoja por área a su ticketera, o a Caja si no tiene
      if (aplicaSegunReglas('TICKET_COMANDA_AREA', pedido.modalidad, reglas)) {
        for (const areaId of areasDeLineas(pedido)) {
          await encolar(
            'TICKET_COMANDA_AREA',
            `${pedido.id}-TICKET_COMANDA_AREA-${areaId ?? 'SIN_AREA'}`,
            construirTicketComandaArea(pedido, areaId),
            areaId,
          );
        }
      }

      this.logger.log(`Encoladas etiquetas automáticas para pedido ${pedido.codigo} (id: ${pedido.id})`);

      if (!yaTenia && cajas > 0) {
        await this.avisarSiNoHayImpresora(pedido, cajas);
      }
    } catch (err: any) {
      // El encolado NUNCA bloquea ni hace fallar la aceptación del pedido
      this.logger.error(`Error en encolado de etiquetas para pedido ${pedidoIdInput}: ${err.message}`, err.stack);
    }
  }

  /**
   * Encola el ticket/voucher de pago del pedido para la ticketera. Idempotente por pedido+tipo
   * (clave `<pedido>-TICKET_PAGO`): reintentar el cobro no duplica el ticket. Nunca bloquea el cobro.
   * Reimprimirlo es crear otro trabajo desde el admin, no reintentar el cobro.
   */
  async encolarTicketPedido(pedidoIdInput: bigint | string | number): Promise<void> {
    try {
      const pedidoId = BigInt(pedidoIdInput);
      const pedido: any = await this.prisma.pedido.findUnique({
        where: { id: pedidoId },
        include: {
          lineas: true,
          planPago: { orderBy: { orden: 'asc' } },
          cobros: { include: { pagos: true } },
        },
      });
      if (!pedido) {
        this.logger.warn(`No se encontró el pedido ${pedidoId} para encolar el ticket`);
        return;
      }
      const [local, comprobante] = await Promise.all([
        this.prisma.parametro.findUnique({ where: { clave: 'local_datos' } }).catch(() => null),
        this.prisma.comprobante.findFirst({ where: { pedido_id: pedido.id, anulado_en: null } }).catch(() => null),
      ]);
      const payload = construirTicketPago(pedido, (local?.valor as any) || {}, comprobante);
      const clave = `${pedido.id}-TICKET_PAGO`;
      await this.prisma.printJob.upsert({
        where: { clave_idempotencia: clave },
        create: {
          pedido_id: pedido.id,
          tipo: 'TICKET_PAGO',
          clave_idempotencia: clave,
          payload: payload as any,
          copia: false,
          estado: 'PENDIENTE',
        },
        update: {},
      });
      const estado = await consultarEstadoAgente(this.prisma).catch(() => null);
      if (estado) {
        this.eventos?.emitirAdmin('impresion:cola', { pedidoId: pedido.id.toString(), tipo: 'TICKET_PAGO' });
      }
    } catch (err: any) {
      this.logger.error(`Error al encolar el ticket del pedido ${pedidoIdInput}: ${err.message}`, err.stack);
    }
  }

  /**
   * Nota de venta que el mozo envía a Caja: se imprime en la ticketera de Caja con su correlativo.
   * La clave es por comprobante: reenviar el pedido no vuelve a imprimir la misma nota.
   */
  async encolarNotaMozo(
    pedidoIdInput: bigint | string | number,
    comprobante: { id: string | number | bigint; tipo: string; numero_texto: string },
    datos: { pagos: Array<{ medio: string; monto: number }>; recibido: number | null; mozo: string | null },
  ): Promise<void> {
    const pedidoId = BigInt(pedidoIdInput);
    const pedido: any = await this.prisma.pedido.findUnique({ where: { id: pedidoId }, include: { lineas: true } });
    if (!pedido) {
      throw new NotFoundException({ codigo: 'PEDIDO_NO_ENCONTRADO', mensaje: 'Pedido no encontrado' });
    }
    const local = await this.prisma.parametro.findUnique({ where: { clave: 'local_datos' } }).catch(() => null);
    const payload = construirTicketNotaMozo(
      pedido,
      (local?.valor as any) || {},
      { tipo: comprobante.tipo, numero_texto: comprobante.numero_texto },
      datos.pagos,
      datos.recibido,
      datos.mozo,
    );
    const clave = `${pedido.id}-NOTA_MOZO-${comprobante.id}`;
    await this.prisma.printJob.upsert({
      where: { clave_idempotencia: clave },
      create: {
        pedido_id: pedido.id,
        tipo: 'TICKET_PAGO',
        clave_idempotencia: clave,
        payload: payload as any,
        copia: false,
        estado: 'PENDIENTE',
      },
      update: {},
    });
    const estado = await consultarEstadoAgente(this.prisma).catch(() => null);
    if (estado) {
      this.eventos?.emitirAdmin('impresion:cola', { pedidoId: pedido.id.toString(), tipo: 'TICKET_PAGO' });
    }
  }

  /**
   * Código de vinculación de un solo uso (15 min) para instalar el programa del local sin pasar
   * secretos por pantalla. Crea un agente inactivo que espera el código; `host` se añade tras la @.
   */
  async generarCodigoVinculoAgente(host: string, usuario?: UsuarioAutenticado, ip?: string) {
    const alfabeto = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    const bytes = crypto.randomBytes(8);
    const codigo = Array.from(bytes, (b) => alfabeto[b % alfabeto.length]).join('');
    const expira = new Date(Date.now() + 15 * 60 * 1000);
    // un solo código vigente: los pendientes anteriores se borran
    await this.prisma.deviceKey.deleteMany({
      where: { tipo: 'AGENTE', activo: false, codigo_vinculo: { not: null } },
    });
    const nuevo = await this.prisma.deviceKey.create({
      data: {
        tipo: 'AGENTE',
        nombre: 'Programa del local',
        llave_hash: crypto.randomBytes(32).toString('hex'),
        activo: false,
        codigo_vinculo: codigo,
        codigo_expira_en: expira,
      },
    });
    if (this.auditoria && usuario) {
      await this.auditoria.registrar({
        categoria: 'CAMBIO',
        modulo: 'impresion',
        accion: 'GENERAR_CODIGO_VINCULO_AGENTE',
        entidad: 'device_key',
        entidadId: nuevo.id,
        partyId: usuario.partyId,
        ip,
      });
    }
    return { codigo: host ? `${codigo}@${host}` : codigo, expiraEn: expira.toISOString() };
  }

  /** El programa del local canjea el código por su llave (se muestra una sola vez). */
  async vincularAgente(codigoCrudo: string): Promise<{ llave: string }> {
    const codigo = (codigoCrudo || '').split('@')[0].trim().toUpperCase();
    const pendiente = codigo
      ? await this.prisma.deviceKey.findFirst({ where: { tipo: 'AGENTE', codigo_vinculo: codigo, activo: false } })
      : null;
    if (!pendiente || !pendiente.codigo_expira_en || pendiente.codigo_expira_en < new Date()) {
      throw new BadRequestException({
        codigo: 'CODIGO_INVALIDO',
        mensaje: 'El código no existe o ya venció. Genera uno nuevo en Caprichos.',
      });
    }
    const llave = `agk_${crypto.randomBytes(24).toString('hex')}`;
    await this.prisma.deviceKey.update({
      where: { id: pendiente.id },
      data: {
        llave_hash: crypto.createHash('sha256').update(llave).digest('hex'),
        activo: true,
        codigo_vinculo: null,
        codigo_expira_en: null,
        ultima_conexion: new Date(),
      },
    });
    return { llave };
  }

  /**
   * Reimpresión de etiquetas a petición del admin con copia=true.
   */
  async reimprimirEtiqueta(
    pedidoIdInput: string | number,
    dto: ReimprimirDto,
  ) {
    let pedidoId: bigint;
    try {
      pedidoId = BigInt(pedidoIdInput);
    } catch {
      throw new BadRequestException({
        codigo: 'ID_INVALIDO',
        mensaje: 'Identificador de pedido no válido',
      });
    }

    const pedido: any = await this.prisma.pedido.findUnique({
      where: { id: pedidoId },
      include: {
        lineas: {
          include: {
            area: true,
            producto: {
              include: {
                categoria: true,
              },
            },
            opcionesElegidas: true,
            sabores: true,
          },
        },
      },
    });

    if (!pedido) {
      throw new NotFoundException({
        codigo: 'PEDIDO_NO_ENCONTRADO',
        mensaje: 'Pedido no encontrado',
      });
    }

    const tipoReq = dto.tipo.toUpperCase();
    const quiereGeneral = ['TODAS', 'GENERAL', 'ETIQUETA_GENERAL'].includes(tipoReq);
    const quiereAreas = ['TODAS', 'AREA', 'ETIQUETA_AREA'].includes(tipoReq);
    const quiereBebidas = ['TODAS', 'BEBIDA', 'ETIQUETA_BEBIDA'].includes(tipoReq);
    if (!quiereGeneral && !quiereAreas && !quiereBebidas) {
      throw new BadRequestException({
        codigo: 'TIPO_INVALIDO',
        mensaje: `Tipo de etiqueta desconocido: ${dto.tipo}`,
      });
    }

    // Lista de etiquetas pedidas, cada una con su clave estable dentro del pedido
    const seleccion: Array<{ tipo: string; clave: string; payload: any; areaId: bigint | null }> = [];
    if (quiereGeneral) {
      seleccion.push({
        tipo: 'ETIQUETA_GENERAL',
        clave: CLAVE_GENERAL,
        payload: construirEtiquetaGeneral(pedido),
        areaId: null,
      });
    }
    if (quiereAreas) {
      for (const a of construirEtiquetasArea(pedido)) {
        const areaId = pedido.lineas.find(
          (l: any) => (l.area?.nombre || '').toUpperCase() === a.areaNombre,
        )?.area_id ?? null;
        if (dto.area_id && String(areaId) !== String(dto.area_id)) continue;
        seleccion.push({
          tipo: 'ETIQUETA_AREA',
          clave: claveEtiquetaArea(a.areaNombre),
          payload: a,
          areaId,
        });
      }
    }
    if (quiereBebidas) {
      for (const b of construirEtiquetasBebida(pedido)) {
        if (dto.indice && b.bebidaIndex !== Number(dto.indice)) continue;
        seleccion.push({
          tipo: 'ETIQUETA_BEBIDA',
          clave: claveEtiquetaBebida(b.bebidaIndex),
          payload: b,
          areaId: null,
        });
      }
    }
    const pedidas = dto.clave ? seleccion.filter((s) => s.clave === dto.clave) : seleccion;
    // Por defecto se respetan las reglas (modalidad y activos); solo `forzar` las salta, a propósito
    const reglas = await leerReglasImpresion(this.prisma);
    const ctx = await this.contextoRuteo();
    const aplicables = dto.forzar ? pedidas : pedidas.filter((s) => aplicaSegunReglas(s.tipo, pedido.modalidad, reglas));
    const noAplican = pedidas.length - aplicables.length;

    // Una etiqueta que ya está en cola no se duplica: el cajero no imprime dos veces lo mismo
    const enCola = await this.prisma.printJob.findMany({
      where: { pedido_id: pedido.id, estado: { in: ESTADOS_EN_COLA } },
      select: { tipo: true, payload: true },
    });
    const claveEnCola = new Set(enCola.map((j) => claveDeTrabajo(j)));
    const nuevas = aplicables.filter((s) => !claveEnCola.has(s.clave));

    const trabajosCreados: any[] = [];
    for (const s of nuevas) {
      trabajosCreados.push(
        await this.prisma.printJob.create({
          data: {
            pedido_id: pedido.id,
            area_id: s.areaId,
            destino_area_id: destinoDeTrabajo(s.tipo, s.areaId, ctx),
            tipo: s.tipo,
            payload: s.payload as any,
            copia: true,
            estado: 'PENDIENTE',
          },
        }),
      );
    }

    const omitidas = aplicables.length - nuevas.length;
    return {
      ok: true,
      mensaje: nuevas.length > 0
        ? `Se encolaron ${trabajosCreados.length} etiqueta(s) para reimpresión`
        : noAplican > 0 && omitidas === 0
          ? 'Esas etiquetas no aplican a este pedido según la configuración de impresión'
          : 'Esas etiquetas ya están en cola de impresión',
      cantidad: trabajosCreados.length,
      omitidas,
      noAplican,
      trabajoIds: trabajosCreados.map((t) => t.id.toString()),
    };
  }

  /**
   * Prueba de impresión: una etiqueta o un ticket de ejemplo, sin pedido real, por la cola normal.
   * No cuenta en pedidos ni dispara avisos (pedido_id NULL). Una cada 10 s por máquina.
   */
  async encolarPrueba(rol: RolImpresora, usuario?: UsuarioAutenticado, ip?: string) {
    const reciente = await this.prisma.printJob.findFirst({
      where: {
        pedido_id: null,
        tipo: { in: tiposDeRoles([rol]) },
        en: { gt: new Date(Date.now() - ESPERA_PRUEBA_MS) },
      },
      select: { id: true },
    });
    if (reciente) {
      throw new HttpException(
        { codigo: 'PRUEBA_FRECUENTE', mensaje: 'Espera unos segundos antes de otra prueba de esta máquina' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const local = await this.prisma.parametro.findUnique({ where: { clave: 'local_datos' } }).catch(() => null);
    const persona = usuario
      ? await this.prisma.party.findUnique({ where: { id: usuario.partyId }, include: { persona: true } }).catch(() => null)
      : null;
    const quien = persona?.persona?.nombres?.split(' ')[0] || 'personal de caja';

    const esTicket = rol === 'TICKETERA';
    const trabajo = await this.prisma.printJob.create({
      data: {
        pedido_id: null,
        tipo: esTicket ? 'TICKET_PAGO' : 'ETIQUETA_GENERAL',
        payload: (esTicket
          ? construirTicketPrueba(local?.valor, quien)
          : construirEtiquetaPrueba(local?.valor, quien)) as any,
        copia: false,
        estado: 'PENDIENTE',
      },
    });

    if (this.auditoria && usuario) {
      await this.auditoria.registrar({
        categoria: 'CAMBIO',
        modulo: 'impresion',
        accion: 'IMPRESION_PRUEBA',
        entidad: 'print_job',
        entidadId: trabajo.id,
        partyId: usuario.partyId,
        despues: { rol },
        ip,
      });
    }
    this.eventos?.emitirAdmin('impresion:cola', { prueba: true, rol });

    return {
      ok: true,
      trabajoId: trabajo.id.toString(),
      mensaje: esTicket
        ? 'Ticket de prueba enviado a la cola de la ticketera'
        : 'Etiqueta de prueba enviada a la cola de la etiquetera',
    };
  }

  /** Estado de una prueba (la pantalla lo consulta hasta que sale o falla). */
  async obtenerPrueba(id: string) {
    let bigId: bigint;
    try {
      bigId = BigInt(id);
    } catch {
      throw new BadRequestException({ codigo: 'ID_INVALIDO', mensaje: 'Identificador no válido' });
    }
    const t = await this.prisma.printJob.findFirst({ where: { id: bigId, pedido_id: null } });
    if (!t) {
      throw new NotFoundException({ codigo: 'PRUEBA_NO_ENCONTRADA', mensaje: 'Prueba de impresión no encontrada' });
    }
    return {
      id: t.id.toString(),
      rol: rolDeTrabajo(t.tipo),
      estado: t.estado,
      intentos: t.intentos,
      error: t.error,
    };
  }

  /**
   * Marca como VENCIDO lo que no debe salir ya: trabajos de pedidos ANULADO y los que
   * llevan más de impresion_vence_min (por defecto 180) esperando. Siguen visibles y
   * se pueden reimprimir desde la pestaña Etiquetas. Solo aplica a las automáticas
   * (copia=false): una reimpresión pedida a mano es una decisión explícita y sale igual.
   */
  async vencerTrabajosObsoletos(ahora = Date.now()): Promise<number> {
    const minutos = await leerParametroNumerico(this.prisma, 'impresion_vence_min', 180);
    const anulados = await this.prisma.printJob.updateMany({
      where: { estado: 'PENDIENTE', copia: false, pedido: { is: { estado: 'ANULADO' } } },
      data: { estado: 'VENCIDO', error: 'Pedido anulado: la etiqueta ya no se imprime' },
    });
    const viejos = await this.prisma.printJob.updateMany({
      where: { estado: 'PENDIENTE', copia: false, en: { lt: new Date(ahora - minutos * 60 * 1000) } },
      data: { estado: 'VENCIDO', error: `Vencida: esperó más de ${minutos} min sin imprimirse` },
    });
    return anulados.count + viejos.count;
  }

  /**
   * Estado de cada etiqueta del pedido (general, una por área y una por vaso de bebida),
   * tomado del último print_job de cada una. Las etiquetas sin trabajo salen SIN_TRABAJO.
   */
  async estadoEtiquetasPedido(pedidoIdInput: string | number) {
    let pedidoId: bigint;
    try {
      pedidoId = BigInt(pedidoIdInput);
    } catch {
      throw new BadRequestException({ codigo: 'ID_INVALIDO', mensaje: 'Identificador de pedido no válido' });
    }

    const pedido: any = await this.prisma.pedido.findUnique({
      where: { id: pedidoId },
      include: INCLUDE_LINEAS_PEDIDO,
    });
    if (!pedido) {
      throw new NotFoundException({ codigo: 'PEDIDO_NO_ENCONTRADO', mensaje: 'Pedido no encontrado' });
    }

    const { areas, bebidas } = construirTodasLasEtiquetas(pedido);
    const reglas = await leerReglasImpresion(this.prisma);
    const esperadas = [
      ...(aplicaSegunReglas('ETIQUETA_GENERAL', pedido.modalidad, reglas)
        ? [{ clave: CLAVE_GENERAL, tipo: 'ETIQUETA_GENERAL', titulo: 'General del pedido', detalle: 'Resumen con total, etiquetera de caja' }]
        : []),
      ...(aplicaSegunReglas('ETIQUETA_AREA', pedido.modalidad, reglas) ? areas : []).map((a) => ({
        clave: claveEtiquetaArea(a.areaNombre),
        tipo: 'ETIQUETA_AREA',
        titulo: `Área ${a.areaNombre}`,
        detalle: 'Etiqueta de la cocina de esta área',
      })),
      ...(aplicaSegunReglas('ETIQUETA_BEBIDA', pedido.modalidad, reglas) ? bebidas : []).map((b) => ({
        clave: claveEtiquetaBebida(b.bebidaIndex),
        tipo: 'ETIQUETA_BEBIDA',
        titulo: `Bebida ${b.bebidaIndex} de ${b.totalBebidas}`,
        detalle: [b.bebidaNombre, b.tamano, b.persona ? `para ${b.persona}` : null]
          .filter(Boolean)
          .join(' · '),
      })),
    ];

    const trabajos = await this.prisma.printJob.findMany({
      where: { pedido_id: pedido.id },
      orderBy: { id: 'desc' },
    });
    const ultimoPorClave = new Map<string, any>();
    for (const t of trabajos) {
      const clave = claveDeTrabajo(t);
      if (clave && !ultimoPorClave.has(clave)) ultimoPorClave.set(clave, t);
    }

    const etiquetas = esperadas.map((e) => {
      const t = ultimoPorClave.get(e.clave);
      return {
        clave: e.clave,
        tipo: e.tipo,
        titulo: e.titulo,
        detalle: e.detalle,
        estado: t ? ESTADO_ETIQUETA[t.estado] ?? t.estado : 'SIN_TRABAJO',
        trabajoId: t ? t.id.toString() : null,
        intentos: t?.intentos ?? 0,
        error: t?.error ?? null,
        copia: t?.copia ?? false,
        en: t?.en ? t.en.toISOString() : null,
        impresoEn: t?.impreso_en ? t.impreso_en.toISOString() : null,
      };
    });

    const contar = (estados: string[]) => etiquetas.filter((e) => estados.includes(e.estado)).length;
    return {
      pedidoId: String(pedido.id),
      codigo: pedido.codigo,
      etiquetas,
      resumen: {
        total: etiquetas.length,
        impresas: contar(['IMPRESA']),
        enCola: contar(['EN_COLA', 'IMPRIMIENDO']),
        fallidas: contar(['FALLIDA']),
        vencidas: contar(['VENCIDA']),
        sinTrabajo: contar(['SIN_TRABAJO']),
      },
    };
  }

  /** Equipos de área activos con sus roles declarados y el id del área de bebidas (por nombre). Sin datos: todo a Caja. */
  private async contextoRuteo(): Promise<ContextoRuteo> {
    try {
      const [equipos, bebidas] = await Promise.all([
        this.prisma.deviceKey.findMany({
          where: { tipo: 'AGENTE', activo: true, area_id: { not: null } },
          select: { area_id: true, latido_impresora: true, latido_detalle: true },
        }),
        this.prisma.areaCocina.findMany({ where: { nombre: AREA_BEBIDAS, activo: true }, select: { id: true } }),
      ]);
      return {
        equipos: (equipos ?? [])
          .filter((e) => e.area_id !== null)
          .map((e) => ({ areaId: e.area_id as bigint, roles: rolesDeclarados(e) })),
        areaBebidasId: bebidas?.[0]?.id ?? null,
      };
    } catch (err: any) {
      this.logger.warn(`No se pudo leer el ruteo de impresión, todo sale en Caja: ${err.message}`);
      return CONTEXTO_RUTEO_VACIO;
    }
  }

  /**
   * Al encolar las etiquetas de un pedido nuevo: si el agente no está o la impresora
   * tiene problema, avisa a CAJERO y ADMIN en la campana y en vivo. Nunca lanza error.
   */
  private async avisarSiNoHayImpresora(pedido: any, cantidad: number): Promise<void> {
    try {
      const estado = await consultarEstadoAgente(this.prisma);
      if (estado.sinProblema) return;

      const motivo = estado.conectado
        ? 'la impresora de Caja reporta un problema (sin papel, error o desconectada)'
        : 'la impresora de Caja no está conectada';
      const mensaje = `El pedido ${pedido.codigo} tiene ${cantidad} etiquetas esperando: ${motivo}`;
      const enlace = `/admin/caja?pedido=${pedido.id}`;

      for (const rol of ['CAJERO', 'ADMIN']) {
        await this.prisma.notificacion.create({
          data: {
            tipo: 'IMPRESORA_SIN_CONEXION',
            rol_destino: rol,
            titulo: 'Impresora de Caja sin conexión',
            mensaje,
            enlace,
          },
        });
      }

      this.eventos?.emitirAdmin('impresion:sin_conexion', {
        pedidoId: pedido.id.toString(),
        codigo: pedido.codigo,
        cantidad,
        conectado: estado.conectado,
        impresora: estado.impresora,
      });
    } catch (err: any) {
      this.logger.warn(`No se pudo avisar que la impresora está sin conexión: ${err.message}`);
    }
  }

  /**
   * Gestión de llaves del agente: crear llave segura con hash SHA-256.
   * La clave sin cifrar se retorna una única vez y solo se almacena su hash.
   */
  async crearLlaveAgente(
    dto: CrearLlaveDto,
    usuario?: UsuarioAutenticado,
    ip?: string,
  ) {
    const rawKey = `agk_${crypto.randomBytes(24).toString('hex')}`;
    const hash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const nombre = dto.nombre?.trim() || 'Agente Local Caja';

    const nueva = await this.prisma.deviceKey.create({
      data: {
        tipo: 'AGENTE',
        nombre,
        llave_hash: hash,
        activo: true,
      },
    });

    if (this.auditoria && usuario) {
      await this.auditoria.registrar({
        categoria: 'CAMBIO',
        modulo: 'impresion',
        accion: 'CREAR_LLAVE_AGENTE',
        entidad: 'device_key',
        entidadId: nueva.id,
        partyId: usuario.partyId,
        despues: { nombre, activo: true },
        ip,
      });
    }

    return {
      id: nueva.id.toString(),
      nombre: nueva.nombre,
      llave: rawKey,
      creadoEn: nueva.creado_en.toISOString(),
      mensaje: 'Guarda esta llave en un lugar seguro. No se volverá a mostrar.',
    };
  }

  /**
   * Desactivar llave de agente (nada se elimina).
   */
  async desactivarLlaveAgente(
    idInput: string | number,
    usuario?: UsuarioAutenticado,
    ip?: string,
  ) {
    let bigId: bigint;
    try {
      bigId = BigInt(idInput);
    } catch {
      throw new BadRequestException({
        codigo: 'ID_INVALIDO',
        mensaje: 'Identificador no válido',
      });
    }

    const dispositivo = await this.prisma.deviceKey.findUnique({
      where: { id: bigId },
    });

    if (!dispositivo || dispositivo.tipo !== 'AGENTE') {
      throw new NotFoundException({
        codigo: 'LLAVE_NO_ENCONTRADA',
        mensaje: 'Llave del agente no encontrada',
      });
    }

    await this.prisma.deviceKey.update({
      where: { id: bigId },
      data: { activo: false },
    });

    if (this.auditoria && usuario) {
      await this.auditoria.registrar({
        categoria: 'CAMBIO',
        modulo: 'impresion',
        accion: 'DESACTIVAR_LLAVE_AGENTE',
        entidad: 'device_key',
        entidadId: bigId,
        partyId: usuario.partyId,
        despues: { activo: false },
        ip,
      });
    }

    return {
      ok: true,
      mensaje: 'Llave del agente desactivada correctamente',
    };
  }

  /**
   * Listar todas las llaves de tipo AGENTE para el admin.
   */
  async listarLlavesAgente() {
    const llaves = await this.prisma.deviceKey.findMany({
      where: { tipo: 'AGENTE' },
      orderBy: { id: 'desc' },
    });

    return llaves.map((ll) => {
      const sufijoHash = ll.llave_hash.slice(-4).toUpperCase();
      return {
        id: ll.id.toString(),
        nombre: ll.nombre,
        activo: ll.activo,
        creadoEn: ll.creado_en.toISOString(),
        ultimoLatido: ll.ultimo_latido ? ll.ultimo_latido.toISOString() : null,
        version: ll.latido_version || null,
        impresora: ll.latido_impresora || null,
        llaveMuestra: `Termina en ...${sufijoHash}`,
      };
    });
  }
}
