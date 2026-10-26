import {
  BadRequestException,
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
  EstadoAdminImpresion,
  EstadoImpresora,
  RespuestaTomarTrabajos,
  TipoEtiqueta,
} from '@caprichos/compartido';
import {
  CrearLlaveDto,
  LatidoDto,
  ReimprimirDto,
  ResultadoTrabajoDto,
} from './dto';
import {
  construirEtiquetaGeneral,
  construirEtiquetasArea,
  construirEtiquetasBebida,
  construirTodasLasEtiquetas,
} from './constructor-etiquetas';

@Injectable()
export class ImpresionService {
  private readonly logger = new Logger(ImpresionService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly auditoria?: AuditoriaService,
  ) {}

  /**
   * Toma de forma atómica (FOR UPDATE SKIP LOCKED) los trabajos PENDIENTE más antiguos.
   * Recupera además trabajos IMPRIMIENDO con más de 2 minutos sin resultado.
   */
  async tomarTrabajos(
    max = 10,
    deviceKeyId?: bigint,
  ): Promise<RespuestaTomarTrabajos> {
    const limite = Math.min(Math.max(1, max || 10), 10);

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
        const filas: Array<{ id: bigint }> = await tx.$queryRaw`
          SELECT id FROM "print_job"
          WHERE estado = 'PENDIENTE'
          ORDER BY id ASC
          LIMIT ${limite}
          FOR UPDATE SKIP LOCKED
        `;
        ids = filas.map((f) => f.id);
      } catch (err: any) {
        // Fallback para entornos donde raw SQL no soporte FOR UPDATE SKIP LOCKED (ej: SQLite mock)
        this.logger.warn(`Fallo $queryRaw SKIP LOCKED, usando findMany: ${err.message}`);
        const filas = await tx.printJob.findMany({
          where: { estado: 'PENDIENTE' },
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
          tipo: t.tipo as TipoEtiqueta,
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
    await this.prisma.deviceKey.update({
      where: { id: deviceKeyId },
      data: {
        ultimo_latido: new Date(),
        latido_version: dto.version,
        latido_impresora: dto.impresora,
        latido_detalle: dto.detalle?.trim() || null,
        ultima_conexion: new Date(),
      },
    });
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
        pedidoId: t.pedido_id.toString(),
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
            },
          },
        },
      });

      if (!pedido) {
        this.logger.warn(`No se encontró el pedido ${pedidoId} para encolar etiquetas`);
        return;
      }

      const { general, areas, bebidas } = construirTodasLasEtiquetas(pedido);

      // 1. Encolar General
      const claveGeneral = `${pedido.id}-ETIQUETA_GENERAL`;
      await this.prisma.printJob.upsert({
        where: { clave_idempotencia: claveGeneral },
        create: {
          pedido_id: pedido.id,
          tipo: 'ETIQUETA_GENERAL',
          clave_idempotencia: claveGeneral,
          payload: general as any,
          copia: false,
          estado: 'PENDIENTE',
        },
        update: {}, // No sobreescribir si ya existe
      }).catch((e) => this.logger.debug(`General ya existe: ${e.message}`));

      // 2. Encolar Áreas
      for (const a of areas) {
        const areaIdVal = pedido.lineas.find(
          (l: any) => (l.area?.nombre || '').toUpperCase() === a.areaNombre,
        )?.area_id;

        const claveArea = `${pedido.id}-ETIQUETA_AREA-${areaIdVal || a.areaNombre}`;
        await this.prisma.printJob.upsert({
          where: { clave_idempotencia: claveArea },
          create: {
            pedido_id: pedido.id,
            area_id: areaIdVal || null,
            tipo: 'ETIQUETA_AREA',
            clave_idempotencia: claveArea,
            payload: a as any,
            copia: false,
            estado: 'PENDIENTE',
          },
          update: {},
        }).catch((e) => this.logger.debug(`Área ya existe: ${e.message}`));
      }

      // 3. Encolar Bebidas
      for (const b of bebidas) {
        const claveBebida = `${pedido.id}-ETIQUETA_BEBIDA-${b.bebidaIndex}`;
        await this.prisma.printJob.upsert({
          where: { clave_idempotencia: claveBebida },
          create: {
            pedido_id: pedido.id,
            tipo: 'ETIQUETA_BEBIDA',
            clave_idempotencia: claveBebida,
            payload: b as any,
            copia: false,
            estado: 'PENDIENTE',
          },
          update: {},
        }).catch((e) => this.logger.debug(`Bebida ya existe: ${e.message}`));
      }

      this.logger.log(`Encoladas etiquetas automáticas para pedido ${pedido.codigo} (id: ${pedido.id})`);
    } catch (err: any) {
      // El encolado NUNCA bloquea ni hace fallar la aceptación del pedido
      this.logger.error(`Error en encolado de etiquetas para pedido ${pedidoIdInput}: ${err.message}`, err.stack);
    }
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
    const trabajosCreados: any[] = [];

    if (tipoReq === 'GENERAL' || tipoReq === 'ETIQUETA_GENERAL') {
      const general = construirEtiquetaGeneral(pedido);
      const j = await this.prisma.printJob.create({
        data: {
          pedido_id: pedido.id,
          tipo: 'ETIQUETA_GENERAL',
          payload: general as any,
          copia: true,
          estado: 'PENDIENTE',
        },
      });
      trabajosCreados.push(j);
    } else if (tipoReq === 'AREA' || tipoReq === 'ETIQUETA_AREA') {
      const areas = construirEtiquetasArea(pedido);
      const filtradas = dto.area_id
        ? areas.filter((a) => {
            const areaIdNum = String(dto.area_id);
            const line = pedido.lineas.find(
              (l: any) => l.area_id?.toString() === areaIdNum || (l.area?.nombre || '').toUpperCase() === a.areaNombre,
            );
            return Boolean(line);
          })
        : areas;

      for (const a of filtradas) {
        const areaIdVal = pedido.lineas.find(
          (l: any) => (l.area?.nombre || '').toUpperCase() === a.areaNombre,
        )?.area_id;

        const j = await this.prisma.printJob.create({
          data: {
            pedido_id: pedido.id,
            area_id: areaIdVal || null,
            tipo: 'ETIQUETA_AREA',
            payload: a as any,
            copia: true,
            estado: 'PENDIENTE',
          },
        });
        trabajosCreados.push(j);
      }
    } else if (tipoReq === 'BEBIDA' || tipoReq === 'ETIQUETA_BEBIDA') {
      const bebidas = construirEtiquetasBebida(pedido);
      const filtradas =
        dto.indice && dto.indice > 0
          ? bebidas.filter((b) => b.bebidaIndex === Number(dto.indice))
          : bebidas;

      for (const b of filtradas) {
        const j = await this.prisma.printJob.create({
          data: {
            pedido_id: pedido.id,
            tipo: 'ETIQUETA_BEBIDA',
            payload: b as any,
            copia: true,
            estado: 'PENDIENTE',
          },
        });
        trabajosCreados.push(j);
      }
    } else {
      throw new BadRequestException({
        codigo: 'TIPO_INVALIDO',
        mensaje: `Tipo de etiqueta desconocido: ${dto.tipo}`,
      });
    }

    return {
      ok: true,
      mensaje: `Se encolaron ${trabajosCreados.length} etiqueta(s) para reimpresión`,
      cantidad: trabajosCreados.length,
      trabajoIds: trabajosCreados.map((t) => t.id.toString()),
    };
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
