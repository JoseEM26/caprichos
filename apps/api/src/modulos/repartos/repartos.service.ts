import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import {
  COORDENADAS_LOCAL_DEFAULT,
  Coordenadas,
  PedidoRutaInput,
  RutaService,
} from './ruta.service';
import { FiltrarRepartosDto } from './dto/filtrar-repartos.dto';
import { ReportarFallaDto } from './dto/reportar-falla.dto';
import { ResolverFallaDto } from './dto/resolver-falla.dto';
import { ActualizarConfigRepartoDto } from './dto/actualizar-config-reparto.dto';

export type ColorEsperaReparto = 'VERDE' | 'RETRASADO' | 'TARDE' | 'MUY_TARDE';
export type ColorEspera = 'verde' | 'naranja' | 'rojo' | ColorEsperaReparto;

export interface ParametrosReparto {
  retrasadoMin: number;
  tardeMin: number;
  muyTardeMin: number;
  velocidadKmh: number;
  maxPedidos: number;
  msg3Seg: number;
  localCoords: Coordenadas;
  naranjaMin: number;
  rojoMin: number;
}

@Injectable()
export class RepartosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly rutaService: RutaService,
    @Optional() private readonly eventosGateway?: EventosGateway,
  ) {}

  private parsearId(id: bigint | string | number): bigint {
    try {
      return BigInt(id);
    } catch {
      throw new BadRequestException({
        codigo: 'ID_INVALIDO',
        mensaje: 'El identificador del pedido no es válido',
      });
    }
  }

  /**
   * Obtiene los parámetros operativos de reparto desde la tabla parametro o defaults.
   * Valores por defecto definidos por el dueño:
   * - Retrasado: 20 min
   * - Tarde: 30 min
   * - Muy tarde: 45 min
   * - Velocidad media: 25 km/h
   * - Máximo de pedidos por repartidor: 3
   */
  async obtenerParametrosReparto(): Promise<ParametrosReparto> {
    let retrasadoMin = 20;
    let tardeMin = 30;
    let muyTardeMin = 45;
    let velocidadKmh = 25;
    let maxPedidos = 3;
    let msg3Seg = 90;
    let localCoords = COORDENADAS_LOCAL_DEFAULT;

    try {
      const params = await this.prisma.parametro.findMany({
        where: {
          clave: {
            in: [
              'reparto_retrasado_min',
              'reparto_tarde_min',
              'reparto_muy_tarde_min',
              'reparto_velocidad_kmh',
              'reparto_max_pedidos',
              'rep_naranja_min',
              'rep_rojo_min',
              'rep_max_pedidos',
              'rep_msg3_seg',
              'local_lat',
              'local_lng',
              'local_datos',
            ],
          },
        },
      });

      let lat: number | undefined;
      let lng: number | undefined;

      for (const p of params) {
        if (p.clave === 'reparto_retrasado_min' && p.valor != null) {
          const v = Number(p.valor);
          if (!isNaN(v) && v > 0) retrasadoMin = v;
        }
        if (p.clave === 'reparto_tarde_min' && p.valor != null) {
          const v = Number(p.valor);
          if (!isNaN(v) && v > 0) tardeMin = v;
        }
        if (p.clave === 'reparto_muy_tarde_min' && p.valor != null) {
          const v = Number(p.valor);
          if (!isNaN(v) && v > 0) muyTardeMin = v;
        }
        if (p.clave === 'reparto_velocidad_kmh' && p.valor != null) {
          const v = Number(p.valor);
          if (!isNaN(v) && v > 0) velocidadKmh = v;
        }
        if (p.clave === 'reparto_max_pedidos' && p.valor != null) {
          const v = Number(p.valor);
          if (!isNaN(v) && v > 0) maxPedidos = v;
        } else if (p.clave === 'rep_max_pedidos' && p.valor != null) {
          const v = Number(p.valor);
          if (!isNaN(v) && v > 0 && maxPedidos === 3) maxPedidos = v;
        }
        if (p.clave === 'rep_msg3_seg' && p.valor != null) {
          const v = Number(p.valor);
          if (!isNaN(v) && v >= 0) msg3Seg = v;
        }
        if (p.clave === 'local_lat' && p.valor != null) {
          lat = Number(p.valor);
        }
        if (p.clave === 'local_lng' && p.valor != null) {
          lng = Number(p.valor);
        }
        if (p.clave === 'local_datos' && p.valor && typeof p.valor === 'object') {
          const d = p.valor as any;
          if (d.lat != null) lat = Number(d.lat);
          if (d.lng != null) lng = Number(d.lng);
        }
      }

      if (lat != null && lng != null && !isNaN(lat) && !isNaN(lng)) {
        localCoords = { lat, lng };
      }
    } catch {
      // Fallback a los defaults
    }

    return {
      retrasadoMin,
      tardeMin,
      muyTardeMin,
      velocidadKmh,
      maxPedidos,
      msg3Seg,
      localCoords,
      naranjaMin: tardeMin,
      rojoMin: muyTardeMin,
    };
  }

  /**
   * Calcula los minutos transcurridos y el color de espera según umbrales de reparto:
   * VERDE (< retrasadoMin), RETRASADO (amarillo), TARDE (naranja), MUY_TARDE (rojo palpitando).
   */
  calcularMinutosYColor(
    creadoEn: Date,
    ahora: Date = new Date(),
    retrasadoMin = 20,
    tardeMin = 30,
    muyTardeMin = 45,
  ): { minutosEspera: number; color: ColorEsperaReparto } {
    const diffMs = ahora.getTime() - new Date(creadoEn).getTime();
    const minutosEspera = Math.max(0, Math.floor(diffMs / 60000));

    let color: ColorEsperaReparto = 'VERDE';
    if (minutosEspera >= muyTardeMin) {
      color = 'MUY_TARDE';
    } else if (minutosEspera >= tardeMin) {
      color = 'TARDE';
    } else if (minutosEspera >= retrasadoMin) {
      color = 'RETRASADO';
    }

    return { minutosEspera, color };
  }

  /**
   * Mapea un pedido al formato de salida requerido para las vistas de reparto.
   */
  private formatearPedidoReparto(
    p: any,
    config: ParametrosReparto,
    ahora: Date = new Date(),
  ) {
    const { minutosEspera, color } = this.calcularMinutosYColor(
      p.creado_en,
      ahora,
      config.retrasadoMin,
      config.tardeMin,
      config.muyTardeMin,
    );

    const cobroPendienteEfectivo =
      p.pago_estado !== 'PAGADO' && p.pago_metodo === 'EFECTIVO';

    const totalNum = Number(p.total);
    const pagaConNum = p.paga_con != null ? Number(p.paga_con) : null;
    const vuelto =
      pagaConNum != null && pagaConNum > totalNum
        ? Number((pagaConNum - totalNum).toFixed(2))
        : 0;

    const cobro = p.pago_estado === 'PAGADO' ? 0 : totalNum;

    return {
      id: String(p.id),
      codigo: p.codigo,
      modalidad: p.modalidad,
      estado: p.estado,
      cliente_nombre: p.cliente_nombre,
      cliente_telefono: p.cliente_telefono,
      direccion: p.entrega_direccion,
      referencia: p.entrega_referencia,
      lat: p.entrega_lat != null ? Number(p.entrega_lat) : null,
      lng: p.entrega_lng != null ? Number(p.entrega_lng) : null,
      coordenadas:
        p.entrega_lat != null && p.entrega_lng != null
          ? { lat: Number(p.entrega_lat), lng: Number(p.entrega_lng) }
          : null,
      zona: p.zona?.codigo ?? null,
      zona_id: p.zona_id ? String(p.zona_id) : null,
      minutosEspera,
      color,
      total: totalNum,
      cobro,
      pago_estado: p.pago_estado,
      pago_metodo: p.pago_metodo,
      cobro_pendiente_efectivo: cobroPendienteEfectivo,
      cobroPendienteEfectivo,
      paga_con: pagaConNum,
      vuelto,
      repartidor_party_id: p.repartidor_party_id ? String(p.repartidor_party_id) : null,
      tomado_en: p.tomado_en,
      salio_en: p.salio_en,
      llego_en: p.llego_en,
      entregado_en: p.entregado_en,
      motivo_falla: p.motivo_falla,
      creado_en: p.creado_en,
    };
  }

  /**
   * 1) GET /admin/repartos/disponibles (repartos/ver):
   * Pedidos DELIVERY en estado LISTO sin repartidor, con posición, zona, minutos de espera,
   * color (verde/naranja/rojo), dirección, total, cobro pendiente en efectivo y paga_con.
   */
  async listarDisponibles() {
    const config = await this.obtenerParametrosReparto();
    const pedidos = await this.prisma.pedido.findMany({
      where: {
        modalidad: 'DELIVERY',
        estado: 'LISTO',
        repartidor_party_id: null,
        motivo_falla: null,
      },
      include: {
        zona: true,
      },
      orderBy: { creado_en: 'asc' },
    });

    const ahora = new Date();
    return pedidos.map((p) => this.formatearPedidoReparto(p, config, ahora));
  }

  /**
   * 1) GET /admin/repartos/mios (repartos/ver):
   * Pedidos del repartidor logueado en LISTO/EN_CAMINO con la ruta sugerida.
   * Devuelve { pedidos, orden: [ids], paso: [ids], ruta: [[lat,lng]...] }
   */
  async listarMios(usuario: UsuarioAutenticado) {
    const config = await this.obtenerParametrosReparto();
    const partyId = BigInt(usuario.partyId);

    const pedidosPropios = await this.prisma.pedido.findMany({
      where: {
        repartidor_party_id: partyId,
        estado: { in: ['LISTO', 'EN_CAMINO'] },
      },
      include: {
        zona: true,
      },
      orderBy: { creado_en: 'asc' },
    });

    const pedidosDisponibles = await this.prisma.pedido.findMany({
      where: {
        modalidad: 'DELIVERY',
        estado: 'LISTO',
        repartidor_party_id: null,
        motivo_falla: null,
        entrega_lat: { not: null },
        entrega_lng: { not: null },
      },
      include: {
        zona: true,
      },
      orderBy: { creado_en: 'asc' },
    });

    const ahora = new Date();
    const propiosFormateados = pedidosPropios.map((p) =>
      this.formatearPedidoReparto(p, config, ahora),
    );

    const inputPropios: PedidoRutaInput[] = pedidosPropios
      .filter((p) => p.entrega_lat != null && p.entrega_lng != null)
      .map((p) => ({
        id: String(p.id),
        codigo: p.codigo,
        lat: Number(p.entrega_lat),
        lng: Number(p.entrega_lng),
        minutosEspera: this.calcularMinutosYColor(
          p.creado_en,
          ahora,
          config.retrasadoMin,
          config.tardeMin,
          config.muyTardeMin,
        ).minutosEspera,
        zona: p.zona?.codigo ?? null,
      }));

    const inputDisponibles: PedidoRutaInput[] = pedidosDisponibles.map((p) => ({
      id: String(p.id),
      codigo: p.codigo,
      lat: Number(p.entrega_lat),
      lng: Number(p.entrega_lng),
      minutosEspera: this.calcularMinutosYColor(
        p.creado_en,
        ahora,
        config.retrasadoMin,
        config.tardeMin,
        config.muyTardeMin,
      ).minutosEspera,
      zona: p.zona?.codigo ?? null,
    }));

    const rutaCalculada = this.rutaService.calcularRuta(
      inputPropios,
      inputDisponibles,
      config.localCoords,
      {
        retrasadoMin: config.retrasadoMin,
        tardeMin: config.tardeMin,
        muyTardeMin: config.muyTardeMin,
      },
      config.maxPedidos,
      config.velocidadKmh,
    );

    return {
      pedidos: propiosFormateados,
      orden: rutaCalculada.orden,
      paso: rutaCalculada.paso,
      ruta: rutaCalculada.ruta,
      totalParadas: rutaCalculada.totalParadas,
      distanciaKm: rutaCalculada.distanciaKm,
      tiempoMin: rutaCalculada.tiempoMin,
      velocidadKmh: rutaCalculada.velocidadKmh,
    };
  }

  /**
   * 1) GET /admin/repartos?repartidor= (repartos/ver):
   * RQ-DEL-02-03: Si el usuario es REPARTIDOR, SOLO ve sus entregas asignadas
   * y los pedidos disponibles para tomar.
   * Caja y admin ven todos los repartidores y pedidos filtrables.
   */
  async listarTodos(filtros: FiltrarRepartosDto, usuario: UsuarioAutenticado) {
    const config = await this.obtenerParametrosReparto();
    const where: Prisma.PedidoWhereInput = {
      modalidad: 'DELIVERY',
    };

    if (usuario && usuario.rol === 'REPARTIDOR') {
      const miPartyId = BigInt(usuario.partyId);
      where.AND = [
        {
          OR: [
            { repartidor_party_id: miPartyId },
            {
              repartidor_party_id: null,
              estado: 'LISTO',
              motivo_falla: null,
            },
          ],
        },
      ];
      if (filtros.estado) {
        where.estado = filtros.estado;
      }
    } else {
      if (filtros.repartidor) {
        try {
          where.repartidor_party_id = BigInt(filtros.repartidor);
        } catch {
          // Ignora si no es numérico
        }
      }

      if (filtros.estado) {
        where.estado = filtros.estado;
      }
    }

    const pedidos = await this.prisma.pedido.findMany({
      where,
      include: {
        zona: true,
        repartidor: {
          include: {
            persona: true,
          },
        },
      },
      orderBy: { creado_en: 'desc' },
    });

    const ahora = new Date();
    return pedidos.map((p) => {
      let repartidorNombre: string | null = null;
      if (p.repartidor) {
        if (p.repartidor.persona) {
          repartidorNombre = `${p.repartidor.persona.nombres} ${p.repartidor.persona.apellidos || ''}`.trim();
        } else {
          repartidorNombre = `Repartidor #${p.repartidor.id}`;
        }
      }

      return {
        ...this.formatearPedidoReparto(p, config, ahora),
        repartidor: p.repartidor
          ? {
              id: String(p.repartidor.id),
              nombre: repartidorNombre,
            }
          : null,
      };
    });
  }

  /**
   * 2) GET /admin/repartos/config (repartos/ver):
   * Devuelve los parámetros operativos de reparto vigentes (umbrales, velocidad, límite y coordenadas).
   */
  async obtenerConfig() {
    const config = await this.obtenerParametrosReparto();
    return {
      retrasadoMin: config.retrasadoMin,
      tardeMin: config.tardeMin,
      muyTardeMin: config.muyTardeMin,
      velocidadKmh: config.velocidadKmh,
      maxPedidos: config.maxPedidos,
      localCoords: config.localCoords,
    };
  }

  /**
   * PUT /admin/repartos/config (configuracion/editar):
   * Actualiza umbrales y parámetros de reparto con validación de orden ascendente y rangos,
   * y registra auditoría de cambio por parámetro.
   */
  async actualizarConfig(
    dto: ActualizarConfigRepartoDto,
    usuarioActual?: UsuarioAutenticado,
    ip?: string,
  ) {
    const actual = await this.obtenerParametrosReparto();

    const nuevoRetrasado = dto.retrasadoMin ?? actual.retrasadoMin;
    const nuevoTarde = dto.tardeMin ?? actual.tardeMin;
    const nuevoMuyTarde = dto.muyTardeMin ?? actual.muyTardeMin;
    const nuevoVelocidad = dto.velocidadKmh ?? actual.velocidadKmh;
    const nuevoMaxPedidos = dto.maxPedidos ?? actual.maxPedidos;

    // Validación de orden ascendente estricto
    if (!(nuevoRetrasado < nuevoTarde && nuevoTarde < nuevoMuyTarde)) {
      throw new BadRequestException({
        codigo: 'ORDEN_UMBRALES_INVALIDO',
        mensaje:
          'Los umbrales deben estar en orden ascendente (retrasado < tarde < muy tarde)',
      });
    }

    // Validación de rangos razonables
    if (nuevoRetrasado < 1 || nuevoRetrasado > 180) {
      throw new BadRequestException({
        codigo: 'RANGO_INVALIDO',
        mensaje: 'El umbral retrasado debe estar entre 1 y 180 minutos',
      });
    }
    if (nuevoTarde < 2 || nuevoTarde > 240) {
      throw new BadRequestException({
        codigo: 'RANGO_INVALIDO',
        mensaje: 'El umbral tarde debe estar entre 2 y 240 minutos',
      });
    }
    if (nuevoMuyTarde < 3 || nuevoMuyTarde > 360) {
      throw new BadRequestException({
        codigo: 'RANGO_INVALIDO',
        mensaje: 'El umbral muy tarde debe estar entre 3 y 360 minutos',
      });
    }
    if (nuevoVelocidad < 5 || nuevoVelocidad > 100) {
      throw new BadRequestException({
        codigo: 'RANGO_INVALIDO',
        mensaje: 'La velocidad media debe estar entre 5 y 100 km/h',
      });
    }
    if (nuevoMaxPedidos < 1 || nuevoMaxPedidos > 20) {
      throw new BadRequestException({
        codigo: 'RANGO_INVALIDO',
        mensaje: 'El máximo de pedidos por repartidor debe estar entre 1 y 20',
      });
    }

    const updates: Array<{ clave: string; valor: number }> = [];
    if (dto.retrasadoMin !== undefined) {
      updates.push({ clave: 'reparto_retrasado_min', valor: dto.retrasadoMin });
    }
    if (dto.tardeMin !== undefined) {
      updates.push({ clave: 'reparto_tarde_min', valor: dto.tardeMin });
    }
    if (dto.muyTardeMin !== undefined) {
      updates.push({ clave: 'reparto_muy_tarde_min', valor: dto.muyTardeMin });
    }
    if (dto.velocidadKmh !== undefined) {
      updates.push({ clave: 'reparto_velocidad_kmh', valor: dto.velocidadKmh });
    }
    if (dto.maxPedidos !== undefined) {
      updates.push({ clave: 'reparto_max_pedidos', valor: dto.maxPedidos });
      updates.push({ clave: 'rep_max_pedidos', valor: dto.maxPedidos });
    }

    for (const u of updates) {
      const anterior = await this.prisma.parametro.findUnique({
        where: { clave: u.clave },
      });

      await this.prisma.parametro.upsert({
        where: { clave: u.clave },
        create: { clave: u.clave, valor: u.valor },
        update: { valor: u.valor },
      });

      await this.auditoria.registrar({
        categoria: 'CAMBIO',
        modulo: 'configuracion',
        accion: 'PARAMETRO',
        resultado: 'OK',
        entidad: 'parametro',
        antes: anterior ? { clave: u.clave, valor: anterior.valor } : null,
        despues: { clave: u.clave, valor: u.valor },
        partyId: usuarioActual?.partyId ? BigInt(usuarioActual.partyId) : undefined,
        ip,
      });
    }

    return this.obtenerConfig();
  }

  /**
   * 4) GET /admin/repartos/zonas (repartos/ver):
   * Devuelve las zonas de reparto registradas en BD con código, nombre, tarifa, activa,
   * polígono y centroide calculado (sin inventar datos).
   */
  async listarZonas() {
    const zonas = await this.prisma.zonaReparto.findMany({
      orderBy: { codigo: 'asc' },
    });

    return zonas.map((z) => {
      const poligono = (Array.isArray(z.poligono) ? z.poligono : []) as [number, number][];

      let centro: [number, number] | null = null;
      if (poligono.length > 0) {
        let sumLat = 0;
        let sumLng = 0;
        for (const p of poligono) {
          sumLat += Number(p[0]);
          sumLng += Number(p[1]);
        }
        centro = [
          Number((sumLat / poligono.length).toFixed(6)),
          Number((sumLng / poligono.length).toFixed(6)),
        ];
      }

      return {
        id: String(z.id),
        codigo: z.codigo,
        nombre: `Zona ${z.codigo}`,
        tarifa: Number(z.tarifa),
        activa: z.activa,
        puntos: poligono.length,
        poligono,
        centro,
      };
    });
  }

  /**
   * 4) GET /admin/repartos/resumen (repartos/ver):
   * Conteo por lado (Norte, Sur, Este, Oeste respecto del local) y por zona.
   */
  async obtenerResumen() {
    const config = await this.obtenerParametrosReparto();
    const pedidos = await this.prisma.pedido.findMany({
      where: {
        modalidad: 'DELIVERY',
        estado: 'LISTO',
        repartidor_party_id: null,
        motivo_falla: null,
        entrega_lat: { not: null },
        entrega_lng: { not: null },
      },
      include: {
        zona: true,
      },
    });

    const puntos = pedidos.map((p) => ({
      lat: Number(p.entrega_lat),
      lng: Number(p.entrega_lng),
      zona: p.zona?.codigo ?? null,
    }));

    return this.rutaService.calcularLadosYZonas(puntos, config.localCoords);
  }

  /**
   * 2) POST /admin/repartos/:id/tomar (repartos/tomar):
   * Asigna repartidor_party_id = usuario, tomado_en = ahora.
   * Límite rep_max_pedidos (3): 409 LIMITE_PEDIDOS «Ya llevas 3 pedidos: entrega alguno antes de tomar otro».
   * Concurrencia atómica: si otro lo tomó antes -> 409 YA_TOMADO.
   */
  async tomarPedido(
    id: string | bigint,
    usuario: UsuarioAutenticado,
    ip?: string,
  ) {
    const pedidoId = this.parsearId(id);
    const partyId = BigInt(usuario.partyId);
    const config = await this.obtenerParametrosReparto();

    // 1. Validar límite de pedidos simultáneos
    const pedidosActivos = await this.prisma.pedido.count({
      where: {
        repartidor_party_id: partyId,
        estado: { in: ['LISTO', 'EN_CAMINO'] },
      },
    });

    if (pedidosActivos >= config.maxPedidos) {
      throw new ConflictException({
        codigo: 'LIMITE_PEDIDOS',
        mensaje: `Ya llevas ${config.maxPedidos} pedidos: entrega alguno antes de tomar otro`,
      });
    }

    const ahora = new Date();

    // 2. Actualización condicional atómica para evitar colisiones concurrentes (RNF-CAP-010 / RN-CAP-024)
    const actualizados = await this.prisma.pedido.updateMany({
      where: {
        id: pedidoId,
        estado: 'LISTO',
        repartidor_party_id: null,
        motivo_falla: null,
        entrega_lat: { not: null },
        entrega_lng: { not: null },
      },
      data: {
        repartidor_party_id: partyId,
        tomado_en: ahora,
      },
    });

    if (actualizados.count === 0) {
      const pedidoExistente = await this.prisma.pedido.findUnique({
        where: { id: pedidoId },
      });

      if (!pedidoExistente) {
        throw new NotFoundException({
          codigo: 'PEDIDO_NO_ENCONTRADO',
          mensaje: 'Pedido no encontrado',
        });
      }

      if (pedidoExistente.repartidor_party_id !== null) {
        throw new ConflictException({
          codigo: 'YA_TOMADO',
          mensaje: 'Otro repartidor ya tomó este pedido',
        });
      }

      if (pedidoExistente.motivo_falla !== null) {
        throw new ConflictException({
          codigo: 'PEDIDO_EN_COORDINACION',
          mensaje: 'El pedido tiene una falla reportada y está en coordinación',
        });
      }

      if (pedidoExistente.estado !== 'LISTO') {
        throw new ConflictException({
          codigo: 'ESTADO_INVALIDO',
          mensaje: `El pedido no está listo para entrega (estado actual: ${pedidoExistente.estado})`,
        });
      }

      if (pedidoExistente.entrega_lat == null || pedidoExistente.entrega_lng == null) {
        throw new ConflictException({
          codigo: 'FALTA_UBICAR',
          mensaje: 'El pedido no tiene ubicación: caja debe ubicarlo antes de que se pueda tomar',
        });
      }

      throw new ConflictException({
        codigo: 'YA_TOMADO',
        mensaje: 'Otro repartidor ya tomó este pedido',
      });
    }

    const pedido = await this.prisma.pedido.findUniqueOrThrow({
      where: { id: pedidoId },
      include: { zona: true },
    });

    // Registrar en historial
    await this.prisma.pedidoEstadoHistorial.create({
      data: {
        pedido_id: pedidoId,
        estado_anterior: 'LISTO',
        estado_nuevo: 'LISTO',
        motivo: 'Tomado por repartidor',
        por_party_id: partyId,
        en: ahora,
      },
    });

    // Auditoría
    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'repartos',
      accion: 'TOMAR',
      resultado: 'OK',
      entidad: 'pedido',
      entidadId: pedidoId,
      partyId,
      ip,
    });

    // WebSocket
    this.eventosGateway?.emitirAdmin('pedido:estado', {
      id: Number(pedido.id),
      codigo: pedido.codigo,
      estado: pedido.estado,
      repartidor_party_id: Number(partyId),
    });

    return this.formatearPedidoReparto(pedido, config, ahora);
  }

  /**
   * 2) POST /admin/repartos/:id/salir (repartos/entregar):
   * LISTO -> EN_CAMINO, salio_en = ahora.
   * Registra aviso 1 «En camino» en mensaje_reparto como PENDIENTE.
   */
  async salir(id: string | bigint, usuario: UsuarioAutenticado, ip?: string) {
    const pedidoId = this.parsearId(id);
    const partyId = BigInt(usuario.partyId);
    const config = await this.obtenerParametrosReparto();

    const pedido = await this.prisma.pedido.findUnique({
      where: { id: pedidoId },
      include: { zona: true },
    });

    if (!pedido) {
      throw new NotFoundException({
        codigo: 'PEDIDO_NO_ENCONTRADO',
        mensaje: 'Pedido no encontrado',
      });
    }

    if (usuario.rol === 'REPARTIDOR' && pedido.repartidor_party_id !== partyId) {
      throw new ForbiddenException({
        codigo: 'NO_ASIGNADO',
        mensaje: 'Este pedido no está asignado a tu usuario',
      });
    }

    if (pedido.estado !== 'LISTO') {
      throw new BadRequestException({
        codigo: 'ESTADO_INVALIDO',
        mensaje: `Solo se puede salir con un pedido en estado LISTO (estado actual: ${pedido.estado})`,
      });
    }

    const ahora = new Date();

    const pedidoActualizado = await this.prisma.pedido.update({
      where: { id: pedidoId },
      data: {
        estado: 'EN_CAMINO',
        salio_en: ahora,
      },
      include: { zona: true },
    });

    // Registrar aviso 1 pendiente
    await this.prisma.mensajeReparto.upsert({
      where: {
        pedido_id_numero: {
          pedido_id: pedidoId,
          numero: 1,
        },
      },
      create: {
        pedido_id: pedidoId,
        numero: 1,
        enviado_en: ahora,
        estado: 'PENDIENTE',
      },
      update: {
        enviado_en: ahora,
        estado: 'PENDIENTE',
      },
    });

    // Historial
    await this.prisma.pedidoEstadoHistorial.create({
      data: {
        pedido_id: pedidoId,
        estado_anterior: 'LISTO',
        estado_nuevo: 'EN_CAMINO',
        motivo: 'En camino',
        por_party_id: partyId,
        en: ahora,
      },
    });

    // Auditoría
    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'repartos',
      accion: 'SALIR',
      resultado: 'OK',
      entidad: 'pedido',
      entidadId: pedidoId,
      partyId,
      ip,
    });

    // WebSocket
    this.eventosGateway?.emitirAdmin('pedido:estado', {
      id: Number(pedido.id),
      codigo: pedido.codigo,
      estado: 'EN_CAMINO',
    });

    return this.formatearPedidoReparto(pedidoActualizado, config, ahora);
  }

  /**
   * 2) POST /admin/repartos/:id/llegue (repartos/entregar):
   * llego_en = ahora.
   * Registra aviso 2 «He llegado» en mensaje_reparto como PENDIENTE.
   */
  async llegue(id: string | bigint, usuario: UsuarioAutenticado, ip?: string) {
    const pedidoId = this.parsearId(id);
    const partyId = BigInt(usuario.partyId);
    const config = await this.obtenerParametrosReparto();

    const pedido = await this.prisma.pedido.findUnique({
      where: { id: pedidoId },
      include: { zona: true },
    });

    if (!pedido) {
      throw new NotFoundException({
        codigo: 'PEDIDO_NO_ENCONTRADO',
        mensaje: 'Pedido no encontrado',
      });
    }

    if (usuario.rol === 'REPARTIDOR' && pedido.repartidor_party_id !== partyId) {
      throw new ForbiddenException({
        codigo: 'NO_ASIGNADO',
        mensaje: 'Este pedido no está asignado a tu usuario',
      });
    }

    if (pedido.estado !== 'EN_CAMINO') {
      throw new BadRequestException({
        codigo: 'ESTADO_INVALIDO',
        mensaje: `Solo se puede marcar llegada de un pedido EN_CAMINO (estado actual: ${pedido.estado})`,
      });
    }

    const ahora = new Date();

    const pedidoActualizado = await this.prisma.pedido.update({
      where: { id: pedidoId },
      data: {
        llego_en: ahora,
      },
      include: { zona: true },
    });

    // Registrar aviso 2 pendiente
    await this.prisma.mensajeReparto.upsert({
      where: {
        pedido_id_numero: {
          pedido_id: pedidoId,
          numero: 2,
        },
      },
      create: {
        pedido_id: pedidoId,
        numero: 2,
        enviado_en: ahora,
        estado: 'PENDIENTE',
      },
      update: {
        enviado_en: ahora,
        estado: 'PENDIENTE',
      },
    });

    // Historial
    await this.prisma.pedidoEstadoHistorial.create({
      data: {
        pedido_id: pedidoId,
        estado_anterior: pedido.estado,
        estado_nuevo: pedido.estado,
        motivo: 'He llegado',
        por_party_id: partyId,
        en: ahora,
      },
    });

    // Auditoría
    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'repartos',
      accion: 'LLEGUE',
      resultado: 'OK',
      entidad: 'pedido',
      entidadId: pedidoId,
      partyId,
      ip,
    });

    // WebSocket
    this.eventosGateway?.emitirAdmin('pedido:estado', {
      id: Number(pedido.id),
      codigo: pedido.codigo,
      estado: pedido.estado,
      llego_en: ahora,
    });

    return this.formatearPedidoReparto(pedidoActualizado, config, ahora);
  }

  /**
   * 2) POST /admin/repartos/:id/entregar (repartos/entregar):
   * EN_CAMINO -> ENTREGADO, entregado_en = ahora.
   * NO cobra el pedido si era contra entrega (efectivo/Yape); solo deja el dato del efectivo a rendir.
   */
  async entregar(
    id: string | bigint,
    usuario: UsuarioAutenticado,
    ip?: string,
  ) {
    const pedidoId = this.parsearId(id);
    const partyId = BigInt(usuario.partyId);
    const config = await this.obtenerParametrosReparto();

    const pedido = await this.prisma.pedido.findUnique({
      where: { id: pedidoId },
      include: { zona: true },
    });

    if (!pedido) {
      throw new NotFoundException({
        codigo: 'PEDIDO_NO_ENCONTRADO',
        mensaje: 'Pedido no encontrado',
      });
    }

    if (usuario.rol === 'REPARTIDOR' && pedido.repartidor_party_id !== partyId) {
      throw new ForbiddenException({
        codigo: 'NO_ASIGNADO',
        mensaje: 'Este pedido no está asignado a tu usuario',
      });
    }

    if (pedido.estado !== 'EN_CAMINO') {
      throw new BadRequestException({
        codigo: 'ESTADO_INVALIDO',
        mensaje: `Solo se puede entregar un pedido EN_CAMINO (estado actual: ${pedido.estado})`,
      });
    }

    if (pedido.modalidad === 'DELIVERY' && !pedido.repartidor_party_id) {
      throw new ConflictException({
        codigo: 'REPARTIDOR_REQUERIDO',
        mensaje: 'Asigna un repartidor antes de marcar el pedido como entregado',
      });
    }

    const ahora = new Date();

    const pedidoActualizado = await this.prisma.pedido.update({
      where: { id: pedidoId },
      data: {
        estado: 'ENTREGADO',
        entregado_en: ahora,
      },
      include: { zona: true },
    });

    const porRendirEfectivo =
      pedido.pago_estado !== 'PAGADO' && pedido.pago_metodo === 'EFECTIVO'
        ? Number(pedido.total)
        : 0;

    // Historial
    await this.prisma.pedidoEstadoHistorial.create({
      data: {
        pedido_id: pedidoId,
        estado_anterior: 'EN_CAMINO',
        estado_nuevo: 'ENTREGADO',
        motivo: 'Entregado',
        por_party_id: partyId,
        en: ahora,
      },
    });

    // Auditoría
    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'repartos',
      accion: 'ENTREGAR',
      resultado: 'OK',
      entidad: 'pedido',
      entidadId: pedidoId,
      partyId,
      ip,
    });

    // WebSocket
    this.eventosGateway?.emitirAdmin('pedido:estado', {
      id: Number(pedido.id),
      codigo: pedido.codigo,
      estado: 'ENTREGADO',
    });

    const formateado = this.formatearPedidoReparto(
      pedidoActualizado,
      config,
      ahora,
    );
    return {
      ...formateado,
      por_rendir_efectivo: porRendirEfectivo,
      efectivo_a_rendir: porRendirEfectivo,
    };
  }

  /**
   * 2) GET /admin/repartos/:id/mensajes (repartos/ver):
   * Consulta los avisos de reparto del pedido. Si pasó rep_msg3_seg (def 90s) desde el aviso 2
   * sin respuesta del cliente y no existe aviso 3, registra el aviso 3 como PENDIENTE.
   */
  async consultarMensajes(id: string | bigint) {
    const pedidoId = this.parsearId(id);
    const config = await this.obtenerParametrosReparto();

    const pedido = await this.prisma.pedido.findUnique({
      where: { id: pedidoId },
    });

    if (!pedido) {
      throw new NotFoundException({
        codigo: 'PEDIDO_NO_ENCONTRADO',
        mensaje: 'Pedido no encontrado',
      });
    }

    let mensajes = await this.prisma.mensajeReparto.findMany({
      where: { pedido_id: pedidoId },
      orderBy: { numero: 'asc' },
    });

    const mensaje2 = mensajes.find((m) => m.numero === 2);
    const mensaje3 = mensajes.find((m) => m.numero === 3);

    if (mensaje2 && !mensaje2.respondido_en && !mensaje3) {
      const ahora = new Date();
      const diffSeg =
        (ahora.getTime() - new Date(mensaje2.enviado_en).getTime()) / 1000;

      if (diffSeg >= config.msg3Seg) {
        await this.prisma.mensajeReparto.create({
          data: {
            pedido_id: pedidoId,
            numero: 3,
            enviado_en: ahora,
            estado: 'PENDIENTE',
          },
        });

        mensajes = await this.prisma.mensajeReparto.findMany({
          where: { pedido_id: pedidoId },
          orderBy: { numero: 'asc' },
        });
      }
    }

    return mensajes.map((m) => ({
      pedido_id: String(m.pedido_id),
      numero: m.numero,
      enviado_en: m.enviado_en,
      respondido_en: m.respondido_en,
      estado: m.estado,
    }));
  }

  /**
   * 3) POST /admin/repartos/:id/reportar (repartos/reportar):
   * Crea incidente_entrega (intento 1, 2...). Exige al menos 2 llamadas registradas para NO_CONTESTA (400 EVIDENCIA_INSUFICIENTE).
   * La foto es opcional y NO se borra. El pedido pasa a motivo_falla y estado LISTO sin repartidor.
   */
  async reportarFalla(
    id: string | bigint,
    dto: ReportarFallaDto,
    usuario: UsuarioAutenticado,
    ip?: string,
  ) {
    const pedidoId = this.parsearId(id);
    const partyId = BigInt(usuario.partyId);

    const pedido = await this.prisma.pedido.findUnique({
      where: { id: pedidoId },
    });

    if (!pedido) {
      throw new NotFoundException({
        codigo: 'PEDIDO_NO_ENCONTRADO',
        mensaje: 'Pedido no encontrado',
      });
    }

    // Regla DT-70: al menos 2 llamadas registradas si es NO_CONTESTA
    if (dto.motivo === 'NO_CONTESTA') {
      const llamadas = (dto.contactos || []).filter((c) => c.tipo === 'LLAMADA');
      if (llamadas.length < 2) {
        throw new BadRequestException({
          codigo: 'EVIDENCIA_INSUFICIENTE',
          mensaje:
            'Se requieren al menos 2 llamadas registradas como evidencia para el motivo NO_CONTESTA',
        });
      }
    }

    const cantidadIncidentes = await this.prisma.incidenteEntrega.count({
      where: { pedido_id: pedidoId },
    });
    const intento = cantidadIncidentes + 1;
    const ahora = new Date();

    const incidente = await this.prisma.incidenteEntrega.create({
      data: {
        pedido_id: pedidoId,
        motivo: dto.motivo,
        intento,
        contactos: dto.contactos as any,
        foto_archivo_id: dto.fotoArchivoId ? BigInt(dto.fotoArchivoId) : null,
        en: ahora,
      },
    });

    // DT-70 / RQ-DEL-03-05: pedido pasa a motivo_falla, queda en LISTO sin repartidor para coordinación
    const pedidoActualizado = await this.prisma.pedido.update({
      where: { id: pedidoId },
      data: {
        motivo_falla: dto.motivo,
        repartidor_party_id: null,
        estado: 'LISTO',
      },
    });

    // Historial
    await this.prisma.pedidoEstadoHistorial.create({
      data: {
        pedido_id: pedidoId,
        estado_anterior: pedido.estado,
        estado_nuevo: 'LISTO',
        motivo: `Falla de entrega: ${dto.motivo} (intento ${intento})`,
        por_party_id: partyId,
        en: ahora,
      },
    });

    // Auditoría
    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'repartos',
      accion: 'REPORTAR_FALLA',
      resultado: 'OK',
      entidad: 'pedido',
      entidadId: pedidoId,
      motivo: dto.motivo,
      partyId,
      ip,
    });

    // WebSocket
    this.eventosGateway?.emitirAdmin('pedido:estado', {
      id: Number(pedido.id),
      codigo: pedido.codigo,
      estado: 'LISTO',
      motivo_falla: dto.motivo,
      intento,
    });

    this.eventosGateway?.emitirAdmin('reparto:incidente', {
      pedidoId: Number(pedido.id),
      codigo: pedido.codigo,
      motivo: dto.motivo,
      intento,
    });

    return {
      ok: true,
      incidenteId: String(incidente.id),
      intento,
      pedido: {
        id: String(pedidoActualizado.id),
        codigo: pedidoActualizado.codigo,
        estado: pedidoActualizado.estado,
        motivo_falla: pedidoActualizado.motivo_falla,
      },
    };
  }

  /**
   * 3) POST /admin/repartos/:id/resolver (repartos/liquidar):
   * Caja o Admin resuelve la falla del pedido con nota y recargo/cierre opcional.
   */
  async resolverFalla(
    id: string | bigint,
    dto: ResolverFallaDto,
    usuario: UsuarioAutenticado,
    ip?: string,
  ) {
    const pedidoId = this.parsearId(id);
    const partyId = BigInt(usuario.partyId);

    const pedido = await this.prisma.pedido.findUnique({
      where: { id: pedidoId },
    });

    if (!pedido) {
      throw new NotFoundException({
        codigo: 'PEDIDO_NO_ENCONTRADO',
        mensaje: 'Pedido no encontrado',
      });
    }

    const ahora = new Date();
    const cierre = dto.cierre ?? 'REPROGRAMADO';

    const ultimoIncidente = await this.prisma.incidenteEntrega.findFirst({
      where: { pedido_id: pedidoId },
      orderBy: { en: 'desc' },
    });

    if (ultimoIncidente) {
      await this.prisma.incidenteEntrega.update({
        where: { id: ultimoIncidente.id },
        data: {
          cierre,
          recargo: dto.recargo != null ? new Prisma.Decimal(dto.recargo) : null,
          cerrado_por: partyId,
        },
      });
    }

    const dataActualizacion: Prisma.PedidoUncheckedUpdateInput = {
      motivo_falla: null,
    };

    if (dto.recargo != null && dto.recargo > 0) {
      const nuevoTotal = Number(pedido.total) + Number(dto.recargo);
      dataActualizacion.total = new Prisma.Decimal(nuevoTotal);
      if (pedido.envio != null) {
        dataActualizacion.envio = new Prisma.Decimal(
          Number(pedido.envio) + Number(dto.recargo),
        );
      }
    }

    if (cierre === 'DEVUELTO') {
      dataActualizacion.estado = 'ANULADO';
      dataActualizacion.anulado_en = ahora;
      dataActualizacion.anulado_por = partyId;
      dataActualizacion.motivo_anulacion = dto.nota;
    } else if (cierre === 'COBRADO_IGUAL') {
      dataActualizacion.repartidor_party_id = null;
    } else {
      dataActualizacion.estado = 'LISTO';
      dataActualizacion.repartidor_party_id = null;
    }

    const pedidoActualizado = await this.prisma.pedido.update({
      where: { id: pedidoId },
      data: dataActualizacion,
    });

    // Historial
    await this.prisma.pedidoEstadoHistorial.create({
      data: {
        pedido_id: pedidoId,
        estado_anterior: pedido.estado,
        estado_nuevo: pedidoActualizado.estado,
        motivo: `Falla resuelta: ${dto.nota} (${cierre})`,
        por_party_id: partyId,
        en: ahora,
      },
    });

    // Auditoría
    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'repartos',
      accion: 'RESOLVER_FALLA',
      resultado: 'OK',
      entidad: 'pedido',
      entidadId: pedidoId,
      motivo: dto.nota,
      partyId,
      ip,
    });

    // WebSocket
    this.eventosGateway?.emitirAdmin('pedido:estado', {
      id: Number(pedido.id),
      codigo: pedido.codigo,
      estado: pedidoActualizado.estado,
      motivo_falla: null,
    });

    return {
      ok: true,
      pedido: {
        id: String(pedidoActualizado.id),
        codigo: pedidoActualizado.codigo,
        estado: pedidoActualizado.estado,
        motivo_falla: pedidoActualizado.motivo_falla,
        total: Number(pedidoActualizado.total),
      },
    };
  }
}
