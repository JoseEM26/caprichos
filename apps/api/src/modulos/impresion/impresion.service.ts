import { CLAVES_FACTURACION, interpretarConfig } from '../comprobantes/facturacion/facturacion.config';
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
  EquipoEstadoImpresion,
  RespuestaLatido,
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
  InfoEquipoLatidoDto,
  ReimprimirDto,
  ResultadoTrabajoDto,
  VaciarColaDto,
} from './dto';
import {
  CLAVE_GENERAL,
  CLAVE_TICKET,
  formatearFecha,
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
import { MODALIDADES_SIMULACION, ModalidadSimulacion, construirPedidoSimulado } from './simulacion-pedido';
import { clasificarEquipos } from './identidad-equipo';
import {
  claveSeleccion,
  agenteConectado,
  consultarEstadoAgente,
  empaquetarDetalleLatido,
  leerCandidatasLatido,
  leerSeleccion,
  estadoPorRol,
  leerParametroNumerico,
} from './estado-impresion';
import {
  ContextoRuteo,
  aplicaSegunReglas,
  areasParaRuteo,
  destinoDeTrabajo,
  rolesDeConfig,
  tiposDeRoles,
} from './ruteo-impresion';
import { EquipoConfigService } from './equipo-config.service';
import { leerReglasImpresion, leerTamanosEtiqueta, leerTicketsPrimero, ordenarPorPrioridad } from './reglas-impresion';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { tamanoEfectivo } from '@caprichos/compartido';
import { ajustesPendientesUbicacion } from '../pedidos-admin/cambio-ubicacion.util';

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
/** Tope de papeles por pedido de reimpresión y de copias esperando en cola (anti doble clic y anti avalancha). */
const MAX_REIMPRESION_JUNTA = 30;
const MAX_COPIAS_EN_COLA = 60;

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
  /** Configuración por computadora (cada PC manda): ruteo, tomar y latido leen de aquí. */
  private readonly equipos: EquipoConfigService;

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly auditoria?: AuditoriaService,
    @Optional() private readonly eventos?: EventosGateway,
  ) {
    this.equipos = new EquipoConfigService(prisma, auditoria, eventos);
  }

  /**
   * Toma de forma atómica (FOR UPDATE SKIP LOCKED) los trabajos PENDIENTE más antiguos.
   * Recupera además trabajos IMPRIMIENDO con más de 2 minutos sin resultado.
   * Antes de tomar, vence lo que ya no debe salir (pedido anulado o demasiado viejo).
   */
  async tomarTrabajos(
    max = 10,
    deviceKeyId?: bigint,
    roles?: RolImpresora[],
    _areaIdObsoleto: bigint | null = null,
    pruebas = false,
  ): Promise<RespuestaTomarTrabajos> {
    // Cada PC toma SOLO lo que se le asignó (destino_equipo_id) y solo si está configurada, no en pausa y el trabajo
    // es de una máquina que tiene encendida. Las pruebas (sin pedido) salen siempre en la máquina que las pidió.
    const cfg = deviceKeyId !== undefined ? await this.equipos.configDe(deviceKeyId) : null;
    const rolesAgente: RolImpresora[] = roles ?? ['ETIQUETERA', 'TICKETERA'];
    const tiposAgente = tiposDeRoles(rolesAgente);
    const tiposConfig =
      cfg && cfg.configurado && !cfg.pausado ? tiposDeRoles(rolesAgente.filter((r) => rolesDeConfig(cfg).includes(r))) : [];
    const equipoId = deviceKeyId ?? null;
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

    // Tickets de pago y comandas primero (por defecto): un voucher no espera detrás de una fila de stickers
    const ticketsPrimero = await leerTicketsPrimero(this.prisma);

    // 2. Selección atómica con SKIP LOCKED
    return this.prisma.$transaction(async (tx) => {
      let ids: bigint[] = [];

      try {
        const filas: Array<{ id: bigint }> = await tx.$queryRaw`
          SELECT id FROM "print_job"
          WHERE estado = 'PENDIENTE'
            AND destino_equipo_id IS NOT DISTINCT FROM ${equipoId}::bigint
            AND ((pedido_id IS NOT NULL AND tipo = ANY(${tiposConfig}::text[]))
              OR (pedido_id IS NULL AND tipo = ANY(${tiposAgente}::text[]))
              OR (${pruebas}::boolean AND pedido_id IS NULL AND payload->'prueba'->>'impresoraId' IS NOT NULL))
          ORDER BY (CASE WHEN ${ticketsPrimero}::boolean AND tipo LIKE 'TICKET%' THEN 0 ELSE 1 END), id ASC
          LIMIT ${limite}
          FOR UPDATE SKIP LOCKED
        `;
        ids = filas.map((f) => f.id);
      } catch (err: any) {
        // Fallback para entornos donde raw SQL no soporte FOR UPDATE SKIP LOCKED (ej: SQLite mock)
        this.logger.warn(`Fallo $queryRaw SKIP LOCKED, usando findMany: ${err.message}`);
        const filas = await tx.printJob.findMany({
          where: {
            estado: 'PENDIENTE',
            destino_equipo_id: equipoId,
            OR: [
              { pedido_id: { not: null }, tipo: { in: tiposConfig } },
              { pedido_id: null, tipo: { in: tiposAgente } },
            ],
          },
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

      const actualizados = ordenarPorPrioridad(
        await tx.printJob.findMany({
          where: { id: { in: ids } },
          orderBy: { id: 'asc' },
        }),
        ticketsPrimero,
      );

      // El tamaño del sticker se lee al entregar: un trabajo que esperaba en cola sale con la medida vigente
      const tamanos = actualizados.some((t) => t.tipo === 'ETIQUETA_GENERAL' || t.tipo === 'ETIQUETA_BEBIDA')
        ? await leerTamanosEtiqueta(this.prisma)
        : null;
      // El tamaño propio de la PC reemplaza al general del local solo en ella; sin valor propio, hereda el general.
      // Una prueba «con este tamaño» ya trae el suyo.
      const medida = (propio: unknown, general: { anchoMm: number; altoMm: number }) => {
        const m = tamanoEfectivo(propio, general);
        return { anchoMm: m.anchoMm, altoMm: m.altoMm, ...(m.margenMm ? { margenMm: m.margenMm } : {}) };
      };
      const conTamano = (t: (typeof actualizados)[number]) => {
        const p = t.payload as any;
        if (!tamanos || p?.tamanoMm) return p;
        if (t.tipo === 'ETIQUETA_GENERAL') return { ...p, tamanoMm: medida(cfg?.tamanoGeneral, tamanos.general) };
        if (t.tipo === 'ETIQUETA_BEBIDA') return { ...p, tamanoMm: medida(cfg?.tamanoBebida, tamanos.bebida) };
        return p;
      };

      return {
        trabajos: actualizados.map((t) => ({
          id: t.id.toString(),
          tipo: t.tipo as TipoTrabajoImpresion,
          payload: conTamano(t),
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
    // Una prueba dirigida no se reintenta sola: el dueño ve el motivo y pulsa Reintentar
    const esPruebaDirigida = Boolean((trabajo.payload as any)?.prueba?.impresoraId);
    const pasaAFallido = nuevosIntentos >= 5 || esPruebaDirigida;
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
  async registrarLatido(dto: LatidoDto, deviceKeyId: bigint, ipPublica?: string): Promise<RespuestaLatido> {
    let antes: any = null;
    try {
      antes = await this.prisma.deviceKey.findUnique({ where: { id: deviceKeyId } });
    } catch {
      // sin estado previo: se emite el evento igual
    }
    const estadoAntes = JSON.stringify(estadoPorRol(antes));
    // Primer latido de una llave nueva: si es una PC ya conocida hereda su configuración (y la llave vieja se desactiva)
    if (antes && !antes.ultimo_latido && dto.equipo) {
      await this.equipos.reconocerYReutilizar(deviceKeyId, {
        uid: dto.equipo.equipoUid,
        hostname: dto.equipo.hostname,
        sistema: dto.equipo.sistema,
        ipLocal: dto.equipo.ipLocal,
      });
    }
    // Primero la config: una PC que late por primera vez queda «nueva, falta configurar»; una que ya imprimía se convierte
    const cfg = await this.equipos.configDe(deviceKeyId);
    const volvio = !agenteConectado(antes?.ultimo_latido);
    await this.prisma.deviceKey.update({
      where: { id: deviceKeyId },
      data: {
        ultimo_latido: new Date(),
        latido_version: dto.version,
        latido_impresora: dto.impresora,
        latido_detalle: empaquetarDetalleLatido(dto.detalle, dto.impresoras, dto.candidatas),
        ultima_conexion: new Date(),
        ...(dto.equipo
          ? {
              latido_hostname: dto.equipo.hostname?.slice(0, 120) ?? null,
              latido_sistema: dto.equipo.sistema?.slice(0, 120) ?? null,
              ...(dto.equipo.equipoUid ? { equipo_uid: dto.equipo.equipoUid.slice(0, 80) } : {}),
              latido_ip_local: dto.equipo.ipLocal?.length ? dto.equipo.ipLocal.slice(0, 8).join(',') : null,
            }
          : {}),
        ...(ipPublica ? { latido_ip_publica: String(ipPublica).split(',')[0].trim().replace(/^::ffff:/, '').slice(0, 64) } : {}),
      },
    });
    // Si cambió el estado de alguna máquina, las pantallas lo ven en vivo
    const ahora = {
      ultimo_latido: new Date(),
      latido_impresora: dto.impresora,
      latido_detalle: empaquetarDetalleLatido(dto.detalle, dto.impresoras, dto.candidatas),
    };
    const impresoras = estadoPorRol(ahora);
    if (JSON.stringify(impresoras) !== estadoAntes || volvio || !antes) {
      this.eventos?.emitirAdmin('impresion:estado', { impresoras, equipoId: deviceKeyId.toString() });
    }
    // Lo que no tenía PC (por ejemplo, porque aún no estaba configurada) se reubica en cuanto hay quien lo imprima
    if ((await this.equipos.contarSinReceptor()) > 0) {
      await this.equipos.reasignarPendientes().catch((err: any) => this.logger.warn(`No se pudo reubicar la cola: ${err.message}`));
    }
    // Lo que el dueño eligió y configuró para ESTA PC viaja en la respuesta; un programa viejo la ignora
    const seleccion = await this.leerSeleccionAgente(deviceKeyId);
    const equipo = {
      ticketera: cfg.ticketera,
      etiquetera: cfg.etiquetera,
      pausado: cfg.pausado,
      configurado: cfg.configurado,
      tamanoGeneral: cfg.tamanoGeneral ?? null,
      tamanoBebida: cfg.tamanoBebida ?? null,
    };
    return { ...(Object.keys(seleccion).length ? { seleccion } : {}), equipo };
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
      candidatas: conectado ? leerCandidatasLatido(agente?.latido_detalle) : [],
      seleccion: agente ? await this.leerSeleccionAgente(agente.id) : {},
      equipos: await this.estadoPorEquipo(ahora),
      eliminadas: await this.equiposArchivados(),
      sinReceptor: await this.equipos.contarSinReceptor(),
      tamanosLocal: await leerTamanosEtiqueta(this.prisma),
    };
  }

  /** PC eliminadas desde el panel o reemplazadas por una nueva vinculación: solo para consultar. */
  private async equiposArchivados() {
    try {
      const l = await this.prisma.deviceKey.findMany({
        where: { tipo: 'AGENTE', archivada_en: { not: null } },
        orderBy: { archivada_en: 'desc' },
        take: 20,
      });
      return l.map((e) => ({
        deviceKeyId: e.id.toString(),
        nombre: e.nombre,
        hostname: e.latido_hostname ?? null,
        ipLocal: e.latido_ip_local ? String(e.latido_ip_local).split(',').filter(Boolean) : [],
        ultimoLatido: e.ultimo_latido ? new Date(e.ultimo_latido).toISOString() : null,
        eliminadaEn: (e.eliminada_en ?? e.archivada_en)?.toISOString() ?? null,
      }));
    } catch {
      return [];
    }
  }

  /** Estado de cada computadora vinculada: el panel avisa cuál falta y cuánto espera en su cola. */
  private async estadoPorEquipo(ahora: number): Promise<EquipoEstadoImpresion[]> {
    try {
      const equipos = await this.prisma.deviceKey.findMany({
        where: { tipo: 'AGENTE', activo: true, archivada_en: null },
        orderBy: { id: 'asc' },
        include: { area: { select: { nombre: true } }, configImpresion: true },
      } as any);
      const ctx = await this.equipos.contexto();
      const clas = clasificarEquipos(equipos as any[], ahora);
      return await Promise.all(
        (equipos as any[]).map(async (e) => {
          const conectado = agenteConectado(e.ultimo_latido, ahora);
          return {
            deviceKeyId: e.id.toString(),
            nombre: e.nombre,
            areaId: e.area_id ? e.area_id.toString() : null,
            areaNombre: e.area?.nombre ?? null,
            conectado,
            impresoras: estadoPorRol(e, ahora),
            candidatas: conectado ? leerCandidatasLatido(e.latido_detalle) : [],
            seleccion: await this.leerSeleccionAgente(e.id),
            pendientes: await this.prisma.printJob.count({
              where: { estado: { in: ['PENDIENTE', 'IMPRIMIENDO'] }, destino_equipo_id: e.id },
            }),
            config: ctx.equipos.find((x) => x.id === e.id)?.config,
            ultimoLatido: e.ultimo_latido ? new Date(e.ultimo_latido).toISOString() : null,
            ipLocal: e.latido_ip_local ? String(e.latido_ip_local).split(',').filter(Boolean) : [],
            ipPublica: e.latido_ip_publica ?? null,
            hostname: e.latido_hostname ?? null,
            sistema: e.latido_sistema ?? null,
            version: e.latido_version ?? null,
            antigua: clas.get(e.id)?.antigua ?? false,
            repetidaDe: (() => {
              const r = clas.get(e.id)?.repetidaDe;
              const o = r ? (equipos as any[]).find((x) => x.id === r) : undefined;
              return o ? { deviceKeyId: o.id.toString(), nombre: o.nombre } : null;
            })(),
          };
        }),
      );
    } catch {
      return [];
    }
  }

  private async leerSeleccionAgente(deviceKeyId: bigint) {
    try {
      const p = await this.prisma.parametro.findUnique({ where: { clave: claveSeleccion(deviceKeyId) } });
      return leerSeleccion(p?.valor);
    } catch {
      return {};
    }
  }

  /** Agente conectado con el último latido, o error claro. Las impresoras que ve solo las conoce su programa. */
  private async agenteConectadoConCandidatas(equipoId?: string) {
    let id: bigint | undefined;
    try {
      id = equipoId ? BigInt(equipoId) : undefined;
    } catch {
      throw new BadRequestException({ codigo: 'ID_INVALIDO', mensaje: 'Equipo no válido' });
    }
    // Sin equipo: la computadora de Caja si hay, o la que latió último
    const orden = { ultimo_latido: { sort: 'desc', nulls: 'last' } } as const;
    const agente =
      (!id && (await this.prisma.deviceKey.findFirst({ where: { tipo: 'AGENTE', activo: true, area_id: null }, orderBy: orden }))) ||
      (await this.prisma.deviceKey.findFirst({ where: { tipo: 'AGENTE', activo: true, ...(id ? { id } : {}) }, orderBy: orden }));
    if (!agente || !agenteConectado(agente.ultimo_latido)) {
      throw new HttpException(
        { codigo: 'PROGRAMA_SIN_CONEXION', mensaje: 'El programa de impresión no está conectado: ábrelo en la computadora del local' },
        HttpStatus.CONFLICT,
      );
    }
    const candidatas = leerCandidatasLatido(agente.latido_detalle);
    if (!candidatas.length) {
      throw new HttpException(
        { codigo: 'PROGRAMA_SIN_LISTA', mensaje: 'Este programa no informa sus impresoras: actualiza el programa de impresión para elegir desde aquí' },
        HttpStatus.CONFLICT,
      );
    }
    return { agente, candidatas };
  }

  /** «Usar esta impresora»: se guarda por equipo; el programa la toma en su próximo latido y la deja guardada para siempre. */
  async elegirImpresora(rol: RolImpresora, impresoraId: string, usuario?: UsuarioAutenticado, ip?: string, equipoId?: string) {
    const { agente, candidatas } = await this.agenteConectadoConCandidatas(equipoId);
    const c = candidatas.find((x) => x.id === impresoraId);
    if (!c) {
      throw new HttpException(
        { codigo: 'IMPRESORA_NO_ENCONTRADA', mensaje: 'Esa impresora ya no aparece en el equipo del local. Actualiza la lista.' },
        HttpStatus.NOT_FOUND,
      );
    }
    const actual = await this.leerSeleccionAgente(agente.id);
    const valor = { ...actual, [rol]: impresoraId };
    await this.prisma.parametro.upsert({
      where: { clave: claveSeleccion(agente.id) },
      create: { clave: claveSeleccion(agente.id), valor: valor as any },
      update: { valor: valor as any },
    });
    if (this.auditoria && usuario) {
      await this.auditoria.registrar({
        categoria: 'CAMBIO',
        modulo: 'impresion',
        accion: 'IMPRESORA_ELEGIDA',
        entidad: 'device_key',
        entidadId: agente.id,
        partyId: usuario.partyId,
        despues: { rol, impresora: c.nombre },
        ip,
      });
    }
    this.eventos?.emitirAdmin('impresion:estado', {});
    return { ok: true, seleccion: valor, mensaje: `La ${rol === 'ETIQUETERA' ? 'etiquetera' : 'ticketera'} será: ${c.nombre}. El programa la guarda y la usará siempre.` };
  }

  /**
   * Lista trabajos de impresión con filtros y paginación para el admin.
   */
  async listarTrabajos(
    estado?: string,
    pedido?: string,
    pagina = 1,
    limite = 20,
    maquina?: string,
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

    // Conteo por máquina con el mismo filtro de estado/pedido (sin el de máquina), para las pestañas
    const [nStickers, nTickets] = await Promise.all([
      this.prisma.printJob.count({ where: { ...where, tipo: { in: tiposDeRoles(['ETIQUETERA']) } } }),
      this.prisma.printJob.count({ where: { ...where, tipo: { in: tiposDeRoles(['TICKETERA']) } } }),
    ]);
    if (maquina === 'ETIQUETERA' || maquina === 'TICKETERA') {
      where.tipo = { in: tiposDeRoles([maquina]) };
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
          deviceKey: { select: { nombre: true } },
          destinoArea: { select: { nombre: true } },
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
        maquina: rolDeTrabajo(t.tipo),
        equipoNombre: (t as any).deviceKey?.nombre ?? ((t as any).destinoArea?.nombre ? `PC de ${(t as any).destinoArea.nombre}` : 'Caja'),
      })),
      total,
      pagina,
      paginas: Math.ceil(total / take) || 1,
      conteo: { stickers: nStickers, tickets: nTickets },
    };
  }

  /**
   * Reimprimir = COPIA nueva de algo que ya existe (salió bien, falló, venció o se descartó), en la MISMA
   * máquina (mismo tipo y destino). No toca el original. «Reintentar» es otra cosa: reactiva el mismo trabajo.
   * Acepta una lista de ids o un grupo («STICKERS_FALLIDOS» / «TICKETS_FALLIDOS»). Devuelve qué se hizo y qué no, y por qué.
   */
  async reimprimirTrabajos(
    dto: { ids?: Array<string | number>; grupo?: string },
    usuario?: UsuarioAutenticado,
    ip?: string,
  ) {
    let ids: bigint[] = [];
    if (dto.grupo) {
      const rol = dto.grupo === 'STICKERS_FALLIDOS' ? 'ETIQUETERA' : dto.grupo === 'TICKETS_FALLIDOS' ? 'TICKETERA' : null;
      if (!rol) {
        throw new BadRequestException({ codigo: 'GRUPO_INVALIDO', mensaje: 'Grupo de reimpresión no válido' });
      }
      const f = await this.prisma.printJob.findMany({
        where: { estado: { in: ['FALLIDO', 'VENCIDO'] }, tipo: { in: tiposDeRoles([rol]) } },
        select: { id: true },
        orderBy: { id: 'desc' },
        take: MAX_REIMPRESION_JUNTA,
      });
      ids = f.map((x) => x.id);
    } else {
      try {
        ids = [...new Set((dto.ids ?? []).map((i) => String(i)))].map((i) => BigInt(i));
      } catch {
        throw new BadRequestException({ codigo: 'ID_INVALIDO', mensaje: 'Identificador no válido' });
      }
    }
    if (ids.length === 0) {
      throw new BadRequestException({ codigo: 'SIN_TRABAJOS', mensaje: 'No hay nada que reimprimir' });
    }
    if (ids.length > MAX_REIMPRESION_JUNTA) {
      throw new BadRequestException({
        codigo: 'DEMASIADOS',
        mensaje: `Se pueden reimprimir hasta ${MAX_REIMPRESION_JUNTA} papeles a la vez. Hazlo en tandas.`,
      });
    }
    const copiasEnCola = await this.prisma.printJob.count({ where: { copia: true, estado: { in: ESTADOS_EN_COLA } } });
    if (copiasEnCola + ids.length > MAX_COPIAS_EN_COLA) {
      throw new HttpException(
        { codigo: 'MUCHAS_COPIAS_EN_COLA', mensaje: 'Ya hay muchas copias esperando salir. Espera a que se impriman.' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const originales = await this.prisma.printJob.findMany({
      where: { id: { in: ids } },
      include: { pedido: { select: { estado: true, codigo: true } } },
    });
    const porId = new Map(originales.map((o) => [o.id.toString(), o]));
    const creados: any[] = [];
    const rechazados: Array<{ id: string; motivo: string }> = [];
    const hace5s = new Date(Date.now() - 5000);
    for (const id of ids) {
      const k = id.toString();
      const o: any = porId.get(k);
      const rechazar = (motivo: string) => rechazados.push({ id: k, motivo });
      if (!o) { rechazar('Ese papel ya no existe'); continue; }
      if (ESTADOS_EN_COLA.includes(o.estado)) { rechazar('Todavía está en cola: sale solo, no hace falta copia'); continue; }
      if (o.pedido_id && o.pedido?.estado === 'ANULADO') { rechazar('El pedido está anulado'); continue; }
      const reciente = await this.prisma.printJob.findFirst({
        where: {
          clave_idempotencia: { startsWith: `copia:${k}:` },
          OR: [{ estado: { in: ESTADOS_EN_COLA } }, { en: { gt: hace5s } }],
        },
        select: { id: true },
      });
      if (reciente) { rechazar('Ya pediste una copia hace un momento'); continue; }
      creados.push(
        await this.prisma.printJob.create({
          data: {
            pedido_id: o.pedido_id,
            area_id: o.area_id,
            destino_area_id: o.destino_area_id,
            destino_equipo_id: o.destino_equipo_id,
            tipo: o.tipo,
            payload: o.payload as any,
            copia: true,
            estado: 'PENDIENTE',
            clave_idempotencia: `copia:${k}:${Date.now()}`,
          },
        }),
      );
    }

    if (this.auditoria && usuario && creados.length > 0) {
      await this.auditoria.registrar({
        categoria: 'CAMBIO',
        modulo: 'impresion',
        accion: 'REIMPRIMIR_TRABAJOS',
        entidad: 'print_job',
        partyId: usuario.partyId,
        despues: {
          originales: ids.map(String),
          copias: creados.map((c) => c.id.toString()),
          rechazados: rechazados.length,
          grupo: dto.grupo ?? null,
        },
        ip,
      });
    }
    if (creados.length > 0) this.eventos?.emitirAdmin('impresion:cola', { reimpresas: creados.length });

    return {
      ok: creados.length > 0,
      creados: creados.length,
      rechazados,
      trabajoIds: creados.map((c) => c.id.toString()),
      mensaje:
        creados.length > 0
          ? `Se enviaron ${creados.length} copia(s) a imprimir${rechazados.length ? `; ${rechazados.length} no se copiaron` : ''}`
          : `No se creó ninguna copia: ${rechazados[0]?.motivo ?? 'nada que copiar'}`,
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
        where: { estado: { in: ['PENDIENTE', 'IMPRIMIENDO', 'FALLIDO'] }, en: { lt: new Date(Date.now() - mins * 60 * 1000) } },
      }),
    ]);

    const grupos = new Map<string, any>();
    for (const t of trabajos) {
      // Cada prueba va en su propio grupo (no tiene pedido)
      const esPrueba = t.pedido_id === null;
      const esSimulacion = esPrueba && Boolean((t.payload as any)?.simulacion);
      const k = esPrueba ? `prueba-${t.id}` : t.pedido_id!.toString();
      let g = grupos.get(k);
      if (!g) {
        g = {
          pedidoId: esPrueba ? null : k,
          esPrueba,
          esSimulacion,
          pedidoCodigo: esPrueba ? 'PRUEBA' : (t.pedido?.codigo || ''),
          clienteNombre: esSimulacion ? 'Simulación de pedido' : esPrueba ? 'Prueba de impresión' : (t.pedido?.cliente_nombre || ''),
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

  /** Marca DESCARTADO (nada se borra) y audita con el conteo. Incluye lo que el agente ya tomó: al reportar su resultado no se devuelve a la cola. */
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
    // Vaciar es vaciar: también lo que el programa ya tomó (IMPRIMIENDO, que a los 2 min volvería a PENDIENTE) y lo fallido
    const where: any = { estado: { in: ['PENDIENTE', 'IMPRIMIENDO', 'FALLIDO'] } };
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
      { id: bigId, estado: { in: ['PENDIENTE', 'IMPRIMIENDO', 'FALLIDO'] } },
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
      { pedido_id: pedidoId, estado: { in: ['PENDIENTE', 'IMPRIMIENDO', 'FALLIDO'] } },
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
        const destino = this.destinoJob(tipo, areaId, payload, ctx);
        await this.prisma.printJob.upsert({
          where: { clave_idempotencia: clave },
          create: {
            pedido_id: pedido.id,
            area_id: areaId,
            ...destino,
            tipo,
            clave_idempotencia: clave,
            payload: payload as any,
            copia: false,
            estado: 'PENDIENTE',
          },
          update: {}, // No sobreescribir si ya existe
        }).catch((e) => this.logger.debug(`${tipo} ya existe: ${e.message}`));
        if (destino.destino_equipo_id === null || destino.destino_area_id === null) cajas += 1;
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
      // El pedido del personal nace PAGADO sin Cobro: nunca pasaría por «cobrar», que es lo que saca el ticket.
      // Sale aquí (idempotente por clave: un solo ticket automático aunque se repita o se edite el pedido).
      if (pedido.es_personal) await this.encolarTicketPedido(pedido.id);
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
      const armado = await this.armarTicketPedido(pedidoId);
      if (!armado) {
        this.logger.warn(`No se encontró el pedido ${pedidoId} para encolar el ticket`);
        return;
      }
      const { pedido, payload } = armado;
      const clave = `${pedido.id}-TICKET_PAGO`;
      const destino = this.destinoJob('TICKET_PAGO', null, payload, await this.equipos.contexto());
      await this.prisma.printJob.upsert({
        where: { clave_idempotencia: clave },
        create: {
          pedido_id: pedido.id,
          ...destino,
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

  /** Ticket de pago del pedido tal como está hoy (con o sin Cobro: el del personal no lo tiene). */
  private async armarTicketPedido(pedidoId: bigint) {
    const pedido: any = await this.prisma.pedido.findUnique({
      where: { id: pedidoId },
      include: {
        lineas: { include: { opcionesElegidas: true, sabores: true, cortesia: true } },
        planPago: { orderBy: { orden: 'asc' } },
        cobros: { include: { pagos: true } },
        consumoPersonal: { include: { party: { include: { persona: true } } } },
      },
    });
    if (!pedido) return null;
    const [local, comprobante, ajuste] = await Promise.all([
      this.prisma.parametro.findUnique({ where: { clave: 'local_datos' } }).catch(() => null),
      this.prisma.comprobante.findFirst({ where: { pedido_id: pedido.id, anulado_en: null } }).catch(() => null),
      ajustesPendientesUbicacion(this.prisma, [pedido.id]).then((m) => m.get(String(pedido.id)) ?? null).catch(() => null),
    ]);
    const payload = construirTicketPago(pedido, (local?.valor as any) || {}, comprobante, ajuste, await this.igvPct(), await this.cuponParaTicket(pedido));
    return { pedido, payload };
  }

  /**
   * Cupón REAL para imprimir en el ticket: solo con el interruptor `impresion_cupon_en_ticket` en «Sí» y si el pedido
   * generó un cupón emitido VIGENTE (no canjeado, no vencido) de un cupón activo. Sin eso: null y el ticket no lleva sección.
   */
  async cuponParaTicket(pedido: { id: bigint }): Promise<{ codigo: string; descripcion: string | null; vence: string | null } | null> {
    try {
      const flag = await this.prisma.parametro.findUnique({ where: { clave: 'impresion_cupon_en_ticket' } });
      if (!['si', 'sí', 'true', '1'].includes(String(flag?.valor ?? '').trim().toLowerCase())) return null;
      const ahora = new Date();
      const emitido: any = await this.prisma.cuponEmitido.findFirst({
        where: {
          pedido_origen_id: pedido.id,
          estado: 'VIGENTE',
          anulado_en: null,
          OR: [{ vence_en: null }, { vence_en: { gt: ahora } }],
          cupon: { activo: true },
        },
        include: { cupon: true },
        orderBy: { id: 'desc' },
      });
      if (!emitido) return null;
      return { codigo: emitido.codigo, descripcion: emitido.cupon?.descripcion ?? null, vence: emitido.vence_en ? formatearFecha(emitido.vence_en) : null };
    } catch {
      return null;
    }
  }

  /** % de IGV vigente (parámetro facturacion_igv_pct); null si no se puede leer: el ticket sale sin desglose. */
  private async igvPct(): Promise<number | null> {
    try {
      const f = await this.prisma.parametro.findMany({ where: { clave: CLAVES_FACTURACION.igv } });
      return interpretarConfig(Object.fromEntries(f.map((x) => [x.clave, x.valor]))).igvPct;
    } catch {
      return null;
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
    const pedido: any = await this.prisma.pedido.findUnique({
      where: { id: pedidoId },
      include: { lineas: { include: { opcionesElegidas: true, sabores: true, cortesia: true } } },
    });
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
      await this.igvPct(),
    );
    const clave = `${pedido.id}-NOTA_MOZO-${comprobante.id}`;
    const destino = this.destinoJob('TICKET_PAGO', null, payload, await this.equipos.contexto());
    await this.prisma.printJob.upsert({
      where: { clave_idempotencia: clave },
      create: {
        pedido_id: pedido.id,
        ...destino,
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
   * «Simular un pedido completo»: un pedido FICTICIO (solo en memoria, sin fila en `pedido`, ni cobro, ni stock) pasa por
   * los MISMOS constructores y reglas que una venta real y se encola a las PC según su configuración. Solo ADMIN o CAJERO.
   * Las PC sin configurar no reciben nada (se explica cuáles y por qué).
   */
  async simularPedido(modalidadInput: unknown, usuario?: UsuarioAutenticado, ip?: string) {
    this.exigirRolDescartar(usuario);
    const modalidad = (typeof modalidadInput === 'string' ? modalidadInput : 'LLEVAR') as ModalidadSimulacion;
    if (!MODALIDADES_SIMULACION.includes(modalidad)) {
      throw new BadRequestException({ codigo: 'MODALIDAD_INVALIDA', mensaje: 'Elige En mesa, Para llevar, Delivery o Comer en el local' });
    }
    const areas = await this.prisma.areaCocina.findMany({ where: { activo: true }, select: { id: true, nombre: true }, orderBy: { id: 'asc' } });
    const pedido = construirPedidoSimulado(modalidad, areas);
    const { general, areas: etqAreas, bebidas } = construirTodasLasEtiquetas(pedido);
    const reglas = await leerReglasImpresion(this.prisma);
    const ctx = await this.contextoRuteo();
    const local = await this.prisma.parametro.findUnique({ where: { clave: 'local_datos' } }).catch(() => null);
    const pcs = await this.prisma.deviceKey.findMany({
      where: { tipo: 'AGENTE', activo: true, archivada_en: null, codigo_vinculo: null },
      select: { id: true, nombre: true },
      orderBy: { id: 'asc' },
    });
    const nombrePc = (id: bigint | null) => pcs.find((x) => x.id === id)?.nombre ?? 'Caja';

    const enviados = new Map<string, { equipoId: string; equipo: string; maquina: string; trabajos: string[] }>();
    const sinReceptor: string[] = [];
    let total = 0;
    const encolar = async (tipo: string, etiqueta: string, payload: any, areaId: bigint | null) => {
      const destino = this.destinoJob(tipo, areaId, payload, ctx);
      // Sin PC configurada que lo imprima: no se crea (una simulación no debe quedar esperando en cola)
      if (destino.destino_equipo_id === null) {
        sinReceptor.push(etiqueta);
        return;
      }
      await this.prisma.printJob.create({
        data: {
          pedido_id: null,
          area_id: areaId,
          ...destino,
          tipo,
          payload: { ...payload, simulacion: true } as any,
          copia: false,
          estado: 'PENDIENTE',
        },
      });
      total += 1;
      const maquina = tipo.startsWith('ETIQUETA') ? 'Etiquetera' : 'Ticketera';
      const clave = `${destino.destino_equipo_id}-${maquina}`;
      const g = enviados.get(clave) ?? { equipoId: String(destino.destino_equipo_id), equipo: nombrePc(destino.destino_equipo_id), maquina, trabajos: [] };
      g.trabajos.push(etiqueta);
      enviados.set(clave, g);
    };

    if (aplicaSegunReglas('ETIQUETA_GENERAL', modalidad, reglas)) await encolar('ETIQUETA_GENERAL', 'resumen', general, null);
    if (aplicaSegunReglas('ETIQUETA_AREA', modalidad, reglas)) {
      for (const a of etqAreas) {
        const areaId = pedido.lineas.find((l: any) => (l.area?.nombre || '').toUpperCase() === a.areaNombre)?.area_id ?? null;
        await encolar('ETIQUETA_AREA', `área ${a.areaNombre}`, a, areaId);
      }
    }
    if (aplicaSegunReglas('ETIQUETA_BEBIDA', modalidad, reglas)) {
      for (const b of bebidas) await encolar('ETIQUETA_BEBIDA', 'bebida', b, null);
    }
    if (aplicaSegunReglas('TICKET_COMANDA_SALON', modalidad, reglas)) {
      await encolar('TICKET_COMANDA_SALON', 'comanda', construirTicketComandaSalon(pedido), null);
    }
    if (aplicaSegunReglas('TICKET_COMANDA_AREA', modalidad, reglas)) {
      for (const areaId of areasDeLineas(pedido)) {
        const nombre = areas.find((a) => a.id === areaId)?.nombre ?? 'sin área';
        await encolar('TICKET_COMANDA_AREA', `comanda ${nombre}`, construirTicketComandaArea(pedido, areaId), areaId);
      }
    }
    await encolar('TICKET_PAGO', 'boleta', construirTicketPago(pedido, (local?.valor as any) || {}, null, null, await this.igvPct()), null);

    // PC que no recibieron nada y por qué
    const recibieron = new Set([...enviados.values()].map((g) => g.equipoId));
    const noRecibieron = ctx.equipos
      .filter((e) => !recibieron.has(String(e.id)))
      .map((e) => ({
        equipoId: String(e.id),
        equipo: nombrePc(e.id),
        motivo: !e.config.configurado
          ? 'sin configurar'
          : e.config.pausado
            ? 'en pausa'
            : !e.config.etiquetera && !e.config.ticketera
              ? 'sin ninguna máquina encendida'
              : 'ninguna regla le asigna nada con esta modalidad',
      }));
    const enviadosLista = [...enviados.values()].map((g) => ({ ...g, cantidad: g.trabajos.length }));
    const avisoSinReceptor = sinReceptor.length ? ` Sin PC que lo imprima: ${sinReceptor.join(', ')}.` : '';
    const mensaje = total
      ? `Se enviaron ${total} trabajos: ${enviadosLista.map((g) => `${g.maquina} de ${g.equipo}: ${g.cantidad} (${g.trabajos.join(', ')})`).join(' · ')}.${avisoSinReceptor}`
      : `No se envió nada: ninguna PC está configurada para imprimir esto.${avisoSinReceptor}`;
    if (this.auditoria && usuario) {
      await this.auditoria.registrar({
        categoria: 'CAMBIO',
        modulo: 'impresion',
        accion: 'SIMULAR_PEDIDO',
        entidad: 'print_job',
        partyId: usuario.partyId,
        despues: { modalidad, trabajos: total, noRecibieron: noRecibieron.map((n) => `${n.equipo}: ${n.motivo}`), sinReceptor },
        ip,
      });
    }
    this.eventos?.emitirAdmin('impresion:cola', { simulacion: true });
    return { ok: true, modalidad, total, enviados: enviadosLista, noRecibieron, sinReceptor, mensaje };
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
  async vincularAgente(codigoCrudo: string, equipo?: InfoEquipoLatidoDto): Promise<{ llave: string }> {
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
        ...(equipo?.equipoUid ? { equipo_uid: equipo.equipoUid.slice(0, 80) } : {}),
        ...(equipo?.hostname ? { latido_hostname: equipo.hostname.slice(0, 120) } : {}),
        ...(equipo?.sistema ? { latido_sistema: equipo.sistema.slice(0, 120) } : {}),
        ...(equipo?.ipLocal?.length ? { latido_ip_local: equipo.ipLocal.slice(0, 8).join(',') } : {}),
      },
    });
    // El programa nuevo dice quién es ya al canjear: si la PC era conocida, hereda su configuración sin pasos extra
    if (equipo?.equipoUid || (equipo?.hostname && equipo?.sistema)) {
      await this.equipos.reconocerYReutilizar(pendiente.id, {
        uid: equipo.equipoUid,
        hostname: equipo.hostname,
        sistema: equipo.sistema,
        ipLocal: equipo.ipLocal,
      });
    }
    return { llave };
  }

  /**
   * Reimpresión de etiquetas a petición del admin con copia=true.
   */
  async reimprimirEtiqueta(
    pedidoIdInput: string | number,
    dto: ReimprimirDto,
    usuario?: UsuarioAutenticado,
    ip?: string,
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

    if (['TICKET', 'TICKET_PAGO'].includes(dto.tipo.toUpperCase())) {
      return this.reimprimirTicketPago(pedidoId, usuario, ip);
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
            ...this.destinoJob(s.tipo, s.areaId, s.payload, ctx),
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
   * Reimprime el ticket de pago del pedido (copia nueva): no depende de que exista un Cobro, así sirve para el
   * consumo del personal y para pedidos pasados que no imprimieron. Si ya hay uno en cola no se duplica.
   */
  private async reimprimirTicketPago(pedidoId: bigint, usuario?: UsuarioAutenticado, ip?: string) {
    const armado = await this.armarTicketPedido(pedidoId);
    if (!armado) {
      throw new NotFoundException({ codigo: 'PEDIDO_NO_ENCONTRADO', mensaje: 'Pedido no encontrado' });
    }
    const { pedido, payload } = armado;
    const yaEnCola = await this.prisma.printJob.count({
      where: { pedido_id: pedido.id, tipo: 'TICKET_PAGO', estado: { in: ESTADOS_EN_COLA } },
    });
    if (yaEnCola > 0) {
      return { ok: true, mensaje: 'El ticket ya está en cola de impresión', cantidad: 0, omitidas: 1, noAplican: 0, trabajoIds: [] };
    }
    const trabajo = await this.prisma.printJob.create({
      data: {
        pedido_id: pedido.id,
        ...this.destinoJob('TICKET_PAGO', null, payload, await this.contextoRuteo()),
        tipo: 'TICKET_PAGO',
        payload: payload as any,
        copia: true,
        estado: 'PENDIENTE',
      },
    });
    if (this.auditoria && usuario) {
      await this.auditoria.registrar({
        categoria: 'CAMBIO',
        modulo: 'impresion',
        accion: 'REIMPRIMIR_TICKET_PEDIDO',
        entidad: 'pedido',
        entidadId: pedido.id,
        partyId: usuario.partyId,
        despues: { pedido: pedido.codigo, trabajoId: trabajo.id.toString(), personal: Boolean(pedido.es_personal) },
        ip,
      });
    }
    this.eventos?.emitirAdmin('impresion:cola', { pedidoId: pedido.id.toString(), tipo: 'TICKET_PAGO' });
    return { ok: true, mensaje: 'Se encoló el ticket de pago para reimpresión', cantidad: 1, omitidas: 0, noAplican: 0, trabajoIds: [trabajo.id.toString()] };
  }

  /** Etiquetas (general, por área y por vaso) del pedido tal como están hoy, con su clave estable y su contenido. */
  private async etiquetasActualesDePedido(pedidoId: bigint) {
    const pedido: any = await this.prisma.pedido.findUnique({
      where: { id: pedidoId },
      include: {
        lineas: { include: { area: true, producto: { include: { categoria: true } }, opcionesElegidas: true, sabores: true } },
      },
    });
    if (!pedido) return null;
    const lista: Array<{ tipo: string; clave: string; payload: any; areaId: bigint | null }> = [
      { tipo: 'ETIQUETA_GENERAL', clave: CLAVE_GENERAL, payload: construirEtiquetaGeneral(pedido), areaId: null },
    ];
    for (const a of construirEtiquetasArea(pedido)) {
      const areaId = pedido.lineas.find((l: any) => (l.area?.nombre || '').toUpperCase() === a.areaNombre)?.area_id ?? null;
      lista.push({ tipo: 'ETIQUETA_AREA', clave: claveEtiquetaArea(a.areaNombre), payload: a, areaId });
    }
    for (const b of construirEtiquetasBebida(pedido)) {
      lista.push({ tipo: 'ETIQUETA_BEBIDA', clave: claveEtiquetaBebida(b.bebidaIndex), payload: b, areaId: null });
    }
    return { pedido, lista };
  }

  /** Foto de las etiquetas del pedido (clave → contenido) para comparar después de editarlo. */
  async capturarEtiquetas(pedidoIdInput: bigint | string | number): Promise<Map<string, string>> {
    try {
      const r = await this.etiquetasActualesDePedido(BigInt(pedidoIdInput));
      return new Map((r?.lista ?? []).map((e) => [e.clave, JSON.stringify(e.payload)]));
    } catch {
      return new Map();
    }
  }

  /**
   * Tras editar un pedido: encola SOLO las etiquetas nuevas o cambiadas respecto de la foto de antes (las de líneas
   * que no cambiaron no se reimprimen). Si al pedido todavía no se le encoló ninguna, no hace nada: se imprimirán
   * completas al aceptarlo. Respeta las reglas de impresión y no duplica lo que ya está en cola. Nunca lanza error.
   */
  async encolarEtiquetasEditadas(pedidoIdInput: bigint | string | number, antes: Map<string, string>): Promise<number> {
    try {
      const pedidoId = BigInt(pedidoIdInput);
      const yaTenia = (await this.prisma.printJob.count({ where: { pedido_id: pedidoId, tipo: { in: TIPOS_ETIQUETA } } })) > 0;
      if (!yaTenia) return 0;
      const r = await this.etiquetasActualesDePedido(pedidoId);
      if (!r) return 0;
      const cambiadas = r.lista.filter((e) => antes.get(e.clave) !== JSON.stringify(e.payload));
      if (cambiadas.length === 0) return 0;
      const reglas = await leerReglasImpresion(this.prisma);
      const ctx = await this.contextoRuteo();
      const enCola = await this.prisma.printJob.findMany({
        where: { pedido_id: pedidoId, estado: { in: ESTADOS_EN_COLA } },
        select: { tipo: true, payload: true },
      });
      const claveEnCola = new Set(enCola.map((j) => claveDeTrabajo(j)));
      let n = 0;
      for (const e of cambiadas) {
        if (!aplicaSegunReglas(e.tipo, r.pedido.modalidad, reglas) || claveEnCola.has(e.clave)) continue;
        await this.prisma.printJob.create({
          data: {
            pedido_id: pedidoId,
            area_id: e.areaId,
            ...this.destinoJob(e.tipo, e.areaId, e.payload, ctx),
            tipo: e.tipo,
            payload: e.payload as any,
            copia: true,
            estado: 'PENDIENTE',
          },
        });
        n += 1;
      }
      return n;
    } catch (err: any) {
      this.logger.error(`Error al encolar etiquetas editadas del pedido ${pedidoIdInput}: ${err.message}`, err.stack);
      return 0;
    }
  }

  /**
   * Prueba de impresión: una etiqueta o un ticket de ejemplo, sin pedido real, por la cola normal.
   * No cuenta en pedidos ni dispara avisos (pedido_id NULL). Una cada 10 s por máquina.
   */
  async encolarPrueba(rol: RolImpresora, usuario?: UsuarioAutenticado, ip?: string, impresoraId?: string, equipoId?: string) {
    // Prueba dirigida a UNA impresora del equipo (para saber cuál es cuál): solo si el programa informó su lista
    let dirigida: { impresoraId: string; nombre: string } | null = null;
    let areaDestino: bigint | null = null;
    let equipoDestino: { id: bigint; areaId: bigint | null } | null = null;
    if (impresoraId) {
      const { agente, candidatas } = await this.agenteConectadoConCandidatas(equipoId);
      const c = candidatas.find((x) => x.id === impresoraId);
      if (!c) {
        throw new HttpException(
          { codigo: 'IMPRESORA_NO_ENCONTRADA', mensaje: 'Esa impresora ya no aparece en el equipo del local. Actualiza la lista.' },
          HttpStatus.NOT_FOUND,
        );
      }
      dirigida = { impresoraId: c.id, nombre: c.nombre };
      areaDestino = agente.area_id ?? null;
      equipoDestino = { id: agente.id, areaId: agente.area_id ?? null };
    } else {
      equipoDestino = await this.equipoDePrueba(rol, equipoId);
    }
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
        payload: {
          ...(esTicket ? construirTicketPrueba(local?.valor, quien) : construirEtiquetaPrueba(local?.valor, quien)),
          ...(dirigida ? { prueba: dirigida } : {}),
        } as any,
        copia: false,
        estado: 'PENDIENTE',
        destino_area_id: dirigida ? areaDestino : (equipoDestino?.areaId ?? null),
        destino_equipo_id: equipoDestino?.id ?? null,
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
        despues: { rol, ...(dirigida ? { impresora: dirigida.nombre } : {}) },
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

  /** PC que recibe una prueba sin impresora elegida: la pedida, o una conectada con esa máquina encendida (Caja si no hay). */
  private async equipoDePrueba(rol: RolImpresora, equipoId?: string): Promise<{ id: bigint; areaId: bigint | null } | null> {
    let id: bigint | undefined;
    try {
      id = equipoId ? BigInt(equipoId) : undefined;
    } catch {
      throw new BadRequestException({ codigo: 'ID_INVALIDO', mensaje: 'Equipo no válido' });
    }
    const ctx = await this.equipos.contexto();
    const orden = [...ctx.equipos].sort((a, b) => Number(b.conectado) - Number(a.conectado) || (a.id < b.id ? -1 : 1));
    const e = id !== undefined
      ? orden.find((x) => x.id === id)
      : (orden.find((x) => rolesDeConfig(x.config).includes(rol)) ?? orden.find((x) => x.areaId === null) ?? orden[0]);
    return e ? { id: e.id, areaId: e.areaId } : null;
  }

  /**
   * «Probar TODAS»: una hoja en cada impresora real que ve el programa, con «Impresora N de M» grande,
   * para saber cuál es cuál. El número sigue el orden de la lista que muestra el panel y el programa.
   * Una impresora que no dice si es de etiquetas o de tickets recibe las dos hojas.
   */
  async encolarPruebaTodas(usuario?: UsuarioAutenticado, ip?: string, equipoId?: string) {
    const { agente, candidatas } = await this.agenteConectadoConCandidatas(equipoId);
    const reciente = await this.prisma.printJob.findFirst({
      where: { pedido_id: null, en: { gt: new Date(Date.now() - ESPERA_PRUEBA_MS) }, destino_equipo_id: agente.id },
      select: { id: true },
    });
    if (reciente) {
      throw new HttpException(
        { codigo: 'PRUEBA_FRECUENTE', mensaje: 'Espera unos segundos antes de otra prueba de esta computadora' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const local = await this.prisma.parametro.findUnique({ where: { clave: 'local_datos' } }).catch(() => null);
    const trabajos: Array<{ trabajoId: string; impresoraId: string; rol: RolImpresora }> = [];
    for (let i = 0; i < candidatas.length; i++) {
      const c = candidatas[i];
      const roles: RolImpresora[] = c.sugerido ? [c.sugerido] : ['ETIQUETERA', 'TICKETERA'];
      for (const rol of roles) {
        const esTicket = rol === 'TICKETERA';
        const t = await this.prisma.printJob.create({
          data: {
            pedido_id: null,
            tipo: esTicket ? 'TICKET_PAGO' : 'ETIQUETA_GENERAL',
            payload: {
              ...(esTicket ? construirTicketPrueba(local?.valor, 'prueba') : construirEtiquetaPrueba(local?.valor, 'prueba')),
              prueba: { impresoraId: c.id, nombre: c.nombre, marca: `Impresora ${i + 1} de ${candidatas.length}` },
            } as any,
            copia: false,
            estado: 'PENDIENTE',
            destino_area_id: agente.area_id ?? null,
            destino_equipo_id: agente.id,
          },
        });
        trabajos.push({ trabajoId: t.id.toString(), impresoraId: c.id, rol });
      }
    }
    if (this.auditoria && usuario) {
      await this.auditoria.registrar({
        categoria: 'CAMBIO',
        modulo: 'impresion',
        accion: 'IMPRESION_PRUEBA_TODAS',
        entidad: 'device_key',
        entidadId: agente.id,
        partyId: usuario.partyId,
        despues: { impresoras: candidatas.length },
        ip,
      });
    }
    this.eventos?.emitirAdmin('impresion:cola', { prueba: true });
    return { ok: true, total: candidatas.length, trabajos, mensaje: `Se mandó una hoja de prueba a cada una de las ${candidatas.length} impresoras` };
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
    const tamanos = await leerTamanosEtiqueta(this.prisma);
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
    // El ticket de pago se muestra si el pedido es del personal (nunca pasa por Caja) o si ya tiene un trabajo de ticket
    if (pedido.es_personal || ultimoPorClave.has(CLAVE_TICKET)) {
      esperadas.push({
        clave: CLAVE_TICKET,
        tipo: 'TICKET_PAGO',
        titulo: pedido.es_personal ? 'Ticket de consumo del personal' : 'Ticket de pago',
        detalle: 'Ticketera de caja',
      });
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
      /** Medida de los stickers (mm) para la vista previa */
      tamanos,
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

  /** PC activas con su configuración y el área de bebidas. Sin datos: ningún equipo imprime y el trabajo espera en cola. */
  private contextoRuteo(): Promise<ContextoRuteo> {
    return this.equipos.contexto();
  }

  /** A qué PC va el trabajo según la configuración de cada una (null/null = nadie lo imprime todavía: espera con aviso). */
  private destinoJob(tipo: string, areaId: bigint | string | null, payload: any, ctx: ContextoRuteo) {
    const d = destinoDeTrabajo(tipo, areasParaRuteo(tipo, areaId, ctx.areaBebidasId, payload?.areaId), ctx);
    return { destino_equipo_id: d?.id ?? null, destino_area_id: d?.areaId ?? null };
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
