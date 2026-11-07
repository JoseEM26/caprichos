import { SalonService } from '../salon/salon.service';
import { exigirDeliveryUbicado, DELIVERY_SIN_UBICACION_WHERE } from '../pedidos/delivery-ubicacion.util';
import { AvisosPedidoService } from '../chatbot/servicios/avisos-pedido.service';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import {
  calcularColor,
  calcularSiguienteMedianocheLima,
  ColorEspera,
  extraerNombreCombo,
  confirmarDespejarActivo,
  extraerOpciones,
  obtenerInicioDiaLima,
} from './cocina.util';
import { opcionesMenosPedidasPorProducto } from './opcion-menos-pedida';
import { asignarNumeroDia } from './numero-dia';

export interface DescuentoPedidoHook {
  descontarPedido(pedidoId: bigint | string | number): Promise<any> | any;
}

/** Área de cocina de una línea: la propia del producto, o la de su categoría. */
function areaDeLineaPedido(l: { area_id: bigint | null; producto?: { categoria?: { area_id: bigint | null } | null } | null }): bigint | null {
  return l.area_id ?? l.producto?.categoria?.area_id ?? null;
}

/** Modalidades que se despachan por producto (delivery sigue su flujo de reparto). */
const MODALIDADES_DESPACHO = ['MESA', 'RECOGER', 'LLEVAR'];
/**
 * La cocina ve un pedido mientras no esté anulado o rechazado. Que Caja lo pase a LISTO o ENTREGADO
 * no lo quita de cocina: solo la comanda despejada o despachada sale.
 */
const ESTADOS_FUERA_DE_COCINA = ['ANULADO', 'RECHAZADO'];
/** Estados en los que despejar la última área pasa el pedido a LISTO (con historial y avisos). */
const ESTADOS_PARA_LISTO = ['COLA', 'PREPARANDO'];
/** Ventana para deshacer un despeje: bajar unidades en esos segundos (mismo usuario) reabre el área. */
const VENTANA_DESHACER_DESPEJE_MS = 15_000;

/** Reparto por sabor de una línea («2 Fresa · 3 Oreo»), o null si la línea no lleva sabores repartidos. */
export function distribucionSabores(l: { sabores?: Array<{ sabor_nombre: string; cantidad: number }> | null }): string | null {
  const lista = l.sabores ?? [];
  return lista.length > 0 ? lista.map((s) => `${s.cantidad} ${s.sabor_nombre}`).join(' · ') : null;
}

/**
 * Líneas del pedido que pertenecen a un área, con los campos que usa la pantalla de cocina.
 * `marcadas`: por producto, las opciones «menos pedida»; cada opción elegida lleva `pocoPedida`.
 */
export function lineasDeArea(lineas: any[], areaId: bigint, marcadas: Map<string, Set<string>> = new Map()) {
  return lineas
    .filter((l) => (l.area_id ?? l.producto?.categoria?.area_id) === areaId)
    .map((l) => {
      const comboNombre = extraerNombreCombo(l);
      const menosPedidas = l.producto_id ? marcadas.get(String(l.producto_id)) : undefined;
      return {
        id: l.id.toString(),
        nombre: l.nombre,
        cantidad: l.cantidad,
        listas: l.listas ?? 0,
        despachadas: l.despachadas ?? 0,
        tamano: l.tamano ?? null,
        sabor: l.sabor ?? distribucionSabores(l),
        sabores: (l.sabores ?? []).map((s: any) => ({ nombre: s.sabor_nombre, cantidad: s.cantidad })),
        combo: comboNombre,
        combo_nombre: comboNombre,
        opciones: extraerOpciones(l).map((o) => ({
          ...o,
          pocoPedida: Boolean(o.id && menosPedidas?.has(o.id)),
        })),
        personas: l.nombres_persona ?? [],
        nota: l.nota ?? null,
      };
    });
}

@Injectable()
export class ComandasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    @Optional() private readonly eventosGateway?: EventosGateway,
    @Optional()
    @Inject('DESCUENTO_PEDIDO')
    private readonly descuentoService?: DescuentoPedidoHook,
    @Optional() private readonly salonService?: SalonService,
    @Optional() private readonly avisos?: AvisosPedidoService,
  ) {}

  private parsearId(id: bigint | string | number, entidad = 'pedido'): bigint {
    try {
      return BigInt(id);
    } catch {
      throw new BadRequestException({
        codigo: 'ID_INVALIDO',
        mensaje: `El identificador de ${entidad} no es válido`,
      });
    }
  }

  /**
   * Obtiene los umbrales configurados para alertas de espera en cocina (DT-69).
   */
  async obtenerUmbrales(): Promise<{ naranjaMin: number; rojoMin: number }> {
    let naranjaMin = 35;
    let rojoMin = 50;

    try {
      const params = await this.prisma.parametro.findMany({
        where: {
          clave: { in: ['rep_naranja_min', 'rep_rojo_min'] },
        },
      });

      for (const p of params) {
        if (p.clave === 'rep_naranja_min' && p.valor !== null && p.valor !== undefined) {
          const val = typeof p.valor === 'number' ? p.valor : Number(p.valor);
          if (!isNaN(val) && val >= 0) naranjaMin = val;
        }
        if (p.clave === 'rep_rojo_min' && p.valor !== null && p.valor !== undefined) {
          const val = typeof p.valor === 'number' ? p.valor : Number(p.valor);
          if (!isNaN(val) && val >= 0) rojoMin = val;
        }
      }
    } catch {
      // Usar valores por defecto (35 y 50) si falla la consulta
    }

    return { naranjaMin, rojoMin };
  }

  /**
   * Sincroniza las comandas de un pedido de forma idempotente.
   * Crea una fila de comanda_area por cada área que tenga líneas del pedido.
   * Si las crea por primera vez, llama a DescuentoService.descontarPedido(pedidoId) si existe.
   */
  async sincronizarPedido(pedidoId: bigint | string | number): Promise<number> {
    const pId = this.parsearId(pedidoId, 'pedido');

    const pedido = await this.prisma.pedido.findUnique({
      where: { id: pId },
      include: {
        lineas: {
          include: {
            area: true,
            producto: {
              include: {
                categoria: {
                  include: {
                    area: true,
                  },
                },
              },
            },
            opcionesElegidas: true,
            sabores: true,
          },
        },
        comandas: true,
      },
    });

    if (!pedido) {
      throw new NotFoundException({
        codigo: 'PEDIDO_NO_ENCONTRADO',
        mensaje: 'Pedido no encontrado',
      });
    }

    const comandasExistentes = pedido.comandas ?? [];
    const areasExistentesSet = new Set(
      comandasExistentes.map((c) => c.area_id.toString()),
    );

    // Identificar las áreas involucradas en las líneas del pedido
    const areasRequeridasMap = new Map<string, bigint>();

    for (const linea of pedido.lineas) {
      let areaId: bigint | null = null;

      if (linea.area_id) {
        areaId = linea.area_id;
      } else if (linea.producto?.categoria?.area_id) {
        areaId = linea.producto.categoria.area_id;
      }

      if (areaId) {
        areasRequeridasMap.set(areaId.toString(), areaId);
      }
    }

    const areasACrear: bigint[] = [];
    for (const [areaIdStr, areaIdBigInt] of areasRequeridasMap.entries()) {
      if (!areasExistentesSet.has(areaIdStr)) {
        areasACrear.push(areaIdBigInt);
      }
    }

    if (areasACrear.length === 0) {
      return 0; // Idempotente: ya están creadas todas
    }

    const esPrimeraVez = comandasExistentes.length === 0;
    const ahora = new Date();
    const llegoEn = pedido.pasa_cocina_en ?? pedido.creado_en ?? ahora;

    // Primera llegada a cocina: comandas y número del día en una misma transacción
    await this.prisma.$transaction(async (tx) => {
      for (const areaId of areasACrear) {
        await tx.comandaArea.create({
          data: {
            pedido_id: pId,
            area_id: areaId,
            estado: 'EN_COCINA',
            llego_en: llegoEn,
          },
        });
      }
      if (esPrimeraVez && pedido.numero_dia == null) {
        await asignarNumeroDia(tx, pId, ahora);
      }
    });

    // Gancho de descuento: sólo si se crearon comandas por primera vez y el servicio existe
    if (esPrimeraVez && this.descuentoService?.descontarPedido) {
      try {
        await this.descuentoService.descontarPedido(pId);
      } catch {
        // No fallar si el servicio de descuento no está disponible o falla
      }
    }

    return areasACrear.length;
  }

  /**
   * Sincroniza todos los pedidos en COLA o PREPARANDO que no tengan comanda_area.
   */
  async sincronizarPendientes(): Promise<void> {
    const pedidosSinComandas = await this.prisma.pedido.findMany({
      where: {
        estado: { in: ['COLA', 'PREPARANDO'] },
        comandas: { none: {} },
        // Delivery sin ubicación (punto o zona): no llega a cocina
        NOT: { ...DELIVERY_SIN_UBICACION_WHERE, OR: [...DELIVERY_SIN_UBICACION_WHERE.OR] },
      },
      select: { id: true },
    });

    for (const p of pedidosSinComandas) {
      try {
        await this.sincronizarPedido(p.id);
      } catch {
        // Continuar con los demás pedidos si uno falla
      }
    }
  }

  /**
   * Resuelve una referencia de área (ID numérico o nombre) a un registro AreaCocina.
   */
  async buscarArea(referencia: string) {
    const refLimpia = referencia.trim();
    const esNumero = !isNaN(Number(refLimpia));
    const refNum = esNumero ? BigInt(refLimpia) : null;

    const area = await this.prisma.areaCocina.findFirst({
      where: {
        OR: [
          ...(refNum !== null ? [{ id: refNum }] : []),
          { nombre: { equals: refLimpia, mode: 'insensitive' } },
        ],
      },
    });

    if (!area) {
      throw new NotFoundException({
        codigo: 'AREA_NO_ENCONTRADA',
        mensaje: `El área de cocina '${referencia}' no existe`,
      });
    }

    return area;
  }

  /**
   * GET /admin/cocina/areas
   * Áreas activas con el número de comandas pendientes (estado EN_COCINA de pedidos en COLA/PREPARANDO).
   */
  async listarAreas() {
    const areas = await this.prisma.areaCocina.findMany({
      where: { activo: true },
      orderBy: { id: 'asc' },
    });

    const conteos = await Promise.all(
      areas.map(async (area) => {
        const pendientes = await this.prisma.comandaArea.count({
          where: {
            area_id: area.id,
            estado: 'EN_COCINA',
            pedido: {
              estado: { notIn: ESTADOS_FUERA_DE_COCINA },
            },
          },
        });

        return {
          id: area.id.toString(),
          nombre: area.nombre,
          propia: area.propia,
          comandasPendientes: pendientes,
          comandas_pendientes: pendientes,
        };
      }),
    );

    return conteos;
  }

  /**
   * Opciones «menos pedida» de los productos dados (ids repetidos o nulos se ignoran).
   * Si el cálculo falla, la cocina sigue funcionando sin resaltado.
   */
  private async opcionesMenosPedida(productoIds: Array<string | null>): Promise<Map<string, Set<string>>> {
    const ids = productoIds.filter((id): id is string => !!id);
    if (ids.length === 0) return new Map();
    try {
      return await opcionesMenosPedidasPorProducto(this.prisma, ids);
    } catch {
      return new Map();
    }
  }

  /**
   * GET /admin/cocina/ajustes
   * Ajustes de la pantalla de cocina que lee el personal. Hoy: si despejar pide confirmación (por defecto, sí).
   */
  async obtenerAjustes(): Promise<{ confirmarDespejar: boolean }> {
    const p = await this.prisma.parametro.findUnique({ where: { clave: 'cocina_confirmar_despejar' } });
    return { confirmarDespejar: confirmarDespejarActivo(p?.valor) };
  }

  /**
   * GET /admin/cocina/comandas?area=<id o código>
   * Sincroniza pedidos en COLA/PREPARANDO y devuelve comandas pendientes del área.
   * NUNCA devuelve teléfono ni dirección (RQ-COC-01-12).
   * Orden: más antiguas primero.
   */
  async listarComandas(areaRef?: string, sincronizar = true): Promise<any[]> {
    // 1. Sincronizar pedidos pendientes primero
    if (sincronizar) {
      await this.sincronizarPendientes();
    }

    // Vista general (RQ-COC-01-09): sin área devuelve las comandas de todas las áreas, orden FIFO por hora de llegada (desempate por id)
    if (!areaRef) {
      const areas = await this.prisma.areaCocina.findMany({ where: { activo: true }, orderBy: { id: 'asc' } });
      const listas = await Promise.all(areas.map((a) => this.listarComandas(a.id.toString(), false)));
      return listas.flat().sort((x: any, y: any) => {
        if (x.despejada !== y.despejada) return x.despejada ? 1 : -1;
        const tX = new Date(x.creado_en || x.llego_en).getTime();
        const tY = new Date(y.creado_en || y.llego_en).getTime();
        if (tX !== tY) return tX - tY;
        return Number(BigInt(x.pedidoId) - BigInt(y.pedidoId));
      });
    }

    // 2. Buscar el área
    const area = await this.buscarArea(areaRef);
    const umbrales = await this.obtenerUmbrales();
    const ahora = new Date();

    // 3. Comandas del área: pendientes (EN_COCINA) y, como seguimiento, las ya despejadas
    // aquí mientras el pedido siga pendiente en otra área. Cuando todas despejan, el pedido
    // sale a LISTO y deja de aparecer.
    const comandas = await this.prisma.comandaArea.findMany({
      where: {
        area_id: area.id,
        pedido: {
          estado: { notIn: ESTADOS_FUERA_DE_COCINA },
          NOT: { ...DELIVERY_SIN_UBICACION_WHERE, OR: [...DELIVERY_SIN_UBICACION_WHERE.OR] },
        },
        OR: [
          { estado: 'EN_COCINA' },
          { estado: 'DESPEJADA', pedido: { comandas: { some: { estado: 'EN_COCINA' } } } },
        ],
      },
      include: {
        pedido: {
          include: {
            comandas: {
              include: {
                area: true,
              },
            },
            lineas: {
              include: {
                area: true,
                producto: {
                  include: {
                    categoria: {
                      include: {
                        area: true,
                      },
                    },
                  },
                },
                opcionesElegidas: true,
                sabores: true,
              },
            },
          },
        },
      },
      orderBy: [
        { llego_en: 'asc' },
        { pedido_id: 'asc' },
      ],
    });

    // Opciones «menos pedida» de los productos de estos pedidos (caché de 10 min, una consulta por producto)
    const marcadas = await this.opcionesMenosPedida(
      comandas.flatMap((c) => c.pedido.lineas.map((l) => (l.producto_id ? l.producto_id.toString() : null))),
    );

    const lista = comandas.map((c) => {
      const p = c.pedido;
      const creadoEn = new Date(p.creado_en);
      const diffMs = ahora.getTime() - creadoEn.getTime();
      const minutos = Math.max(0, Math.floor(diffMs / 60000));
      const color: ColorEspera = calcularColor(minutos, umbrales.naranjaMin, umbrales.rojoMin);

      // Estado de todas las áreas del pedido (también la propia), con las líneas de cada una
      const comandasPedido: Array<{ area_id: bigint; estado: string; area?: { nombre: string } | null }> =
        [...(p.comandas ?? [])];
      if (!comandasPedido.some((x) => x.area_id === c.area_id)) comandasPedido.push(c);
      const areas = comandasPedido
        .map((x) => ({
          areaId: x.area_id.toString(),
          areaNombre: x.area_id === area.id ? area.nombre : (x.area?.nombre ?? ''),
          despejada: x.estado === 'DESPEJADA',
          lineas: lineasDeArea(p.lineas, x.area_id, marcadas),
        }))
        .sort((x, y) => Number(BigInt(x.areaId) - BigInt(y.areaId)));

      const mesa =
        (p as any).mesa ??
        (p.modalidad === 'MESA' ? ((p as any).mesa_numero ?? p.entrega_referencia ?? null) : null);

      return {
        id: `${c.pedido_id}-${c.area_id}`,
        pedidoId: c.pedido_id.toString(),
        areaId: c.area_id.toString(),
        areaNombre: area.nombre,
        ticket: p.codigo,
        codigo: p.codigo,
        canal: p.canal,
        modalidad: p.modalidad,
        cliente: p.cliente_nombre ?? null,
        mesa,
        nota: p.nota ?? null,
        minutos,
        minutosEspera: minutos,
        color,
        colorEspera: color,
        // Referencial: número del día en cocina (null si el pedido es anterior a la función)
        numeroDia: p.numero_dia ?? null,
        // Hora del servidor y umbrales: el navegador cuenta el tiempo en vivo con ellos
        ahoraServidor: ahora.toISOString(),
        umbrales,
        llego_en: c.llego_en,
        creado_en: p.creado_en,
        lineas: lineasDeArea(p.lineas, area.id, marcadas),
        // Aditivo: la propia área ya despejó (solo seguimiento) y el estado de las áreas del pedido
        despejada: c.estado === 'DESPEJADA',
        areas,
      };
    });

    // Pendientes de mi área primero; las de solo seguimiento después (sort estable: conserva la hora de llegada)
    return lista.sort((x, y) => Number(x.despejada) - Number(y.despejada));
  }

  /** Líneas del pedido que van a cocina (con área), con lo necesario para contar unidades. */
  private async lineasDeCocina(pId: bigint) {
    const lineas = await this.prisma.pedidoLinea.findMany({
      where: { pedido_id: pId },
      select: {
        id: true,
        cantidad: true,
        listas: true,
        despachadas: true,
        area_id: true,
        producto: { select: { categoria: { select: { area_id: true } } } },
      },
    });
    return lineas.filter((l) => areaDeLineaPedido(l) !== null);
  }

  /**
   * GET /admin/cocina/comandas?area=<id o código>
   * Sincroniza pedidos en COLA/PREPARANDO y devuelve comandas pendientes del área.
   * Si todas las áreas del pedido están despejadas, pasa a LISTO.
   * Si el pedido es ANULADO o no está en COLA/PREPARANDO da 409.
   */
  async despejar(
    pedidoId: bigint | string | number,
    areaId: bigint | string | number,
    usuarioActual: UsuarioAutenticado,
    ip?: string,
  ) {
    const pId = this.parsearId(pedidoId, 'pedido');
    const aId = this.parsearId(areaId, 'area');

    const pedido = await this.prisma.pedido.findUnique({
      where: { id: pId },
      include: {
        comandas: true,
      },
    });

    if (!pedido) {
      throw new NotFoundException({
        codigo: 'PEDIDO_NO_ENCONTRADO',
        mensaje: 'Pedido no encontrado',
      });
    }

    if (ESTADOS_FUERA_DE_COCINA.includes(pedido.estado)) {
      throw new ConflictException({
        codigo: 'ESTADO_INVALIDO',
        mensaje: `No se puede despejar un pedido en estado ${pedido.estado}`,
      });
    }
    exigirDeliveryUbicado(pedido);

    const comanda = await this.prisma.comandaArea.findUnique({
      where: {
        pedido_id_area_id: {
          pedido_id: pId,
          area_id: aId,
        },
      },
    });

    if (!comanda) {
      throw new NotFoundException({
        codigo: 'COMANDA_NO_ENCONTRADA',
        mensaje: 'Comanda no encontrada para el área especificada',
      });
    }

    if (comanda.estado === 'DESPEJADA') {
      throw new ConflictException({
        codigo: 'COMANDA_YA_DESPEJADA',
        mensaje: 'La comanda ya ha sido despejada',
      });
    }

    const ahora = new Date();

    // Despejar el área significa que todo lo suyo sale: sus líneas quedan completas
    await this.completarLineasDeArea(pId, aId, ahora);

    // Actualizar comanda a DESPEJADA
    await this.prisma.comandaArea.update({
      where: {
        pedido_id_area_id: {
          pedido_id: pId,
          area_id: aId,
        },
      },
      data: {
        estado: 'DESPEJADA',
        despejada_en: ahora,
        despejada_por: usuarioActual.partyId,
      },
    });

    // Evaluar si todas las áreas del pedido están despejadas
    const todasComandas = await this.prisma.comandaArea.findMany({
      where: { pedido_id: pId },
    });

    const completo =
      todasComandas.length > 0 &&
      todasComandas.every((c) => (c.area_id === aId ? true : c.estado === 'DESPEJADA'));

    // Idempotente: si Caja ya pasó el pedido a LISTO o ENTREGADO, no se regresa ni se repite historial/avisos
    if (completo && ESTADOS_PARA_LISTO.includes(pedido.estado)) {
      // Transición del pedido a LISTO (con historial, auditoría y evento socket)
      await this.prisma.$transaction(async (tx) => {
        await tx.pedido.update({
          where: { id: pId },
          data: {
            estado: 'LISTO',
            listo_en: ahora,
            pasa_cocina_en: pedido.pasa_cocina_en ?? ahora,
          },
        });
        await tx.pedidoEstadoHistorial.create({
          data: {
            pedido_id: pId,
            estado_anterior: pedido.estado,
            estado_nuevo: 'LISTO',
            motivo: 'Todas las áreas de cocina despejadas',
            por_party_id: usuarioActual.partyId,
            en: ahora,
          },
        });
        // el cliente delivery recibe el aviso de que su pedido está listo (idempotente, misma transacción)
        await this.avisos?.avisar(pId, 'LISTO', {}, tx);
      });
      this.avisos?.despertar();

      await this.auditoria.registrar({
        categoria: 'CAMBIO',
        modulo: 'pedidos',
        accion: 'CAMBIAR_ESTADO',
        resultado: 'OK',
        entidad: 'pedido',
        entidadId: pId,
        antes: { estado: pedido.estado },
        despues: { estado: 'LISTO', motivo: 'Todas las áreas despejadas' },
        motivo: 'Todas las áreas despejadas',
        partyId: usuarioActual.partyId,
        ip,
      });

      this.eventosGateway?.emitirAdmin('pedido:estado', {
        id: Number(pedido.id),
        codigo: pedido.codigo,
        estado: 'LISTO',
      });


      // el mozo que tomó el pedido de mesa recibe el aviso de que está listo (RQ-SAL-02-10)
      if (pedido.modalidad === 'MESA') {
        try {
          await this.salonService?.avisarListo(pedido.id);
        } catch {
          // el aviso es informativo
        }
      }
    }

    // Auditoría de despeje de comanda
    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'cocina',
      accion: 'DESPEJAR_COMANDA',
      resultado: 'OK',
      entidad: 'comanda_area',
      entidadId: pId,
      antes: { estado: comanda.estado },
      despues: { estado: 'DESPEJADA', completo },
      partyId: usuarioActual.partyId,
      ip,
    });

    // Evento de comanda despejada
    this.eventosGateway?.emitirAdmin('cocina:comanda', {
      pedidoId: Number(pedido.id),
      areaId: Number(aId),
      completo,
    });

    return {
      ok: true,
      pedidoId: pId.toString(),
      areaId: aId.toString(),
      estado: 'DESPEJADA',
      completo,
    };
  }

  /** Marca completas (listas = cantidad) las líneas de un área: al despejarla, todo lo suyo sale. */
  private async completarLineasDeArea(pId: bigint, aId: bigint, ahora: Date) {
    const lineas = (await this.lineasDeCocina(pId)).filter((l) => areaDeLineaPedido(l) === aId);
    for (const l of lineas) {
      if (l.listas < l.cantidad) {
        await this.prisma.pedidoLinea.update({
          where: { id: l.id },
          data: { listas: l.cantidad, listo_en: ahora },
        });
      }
    }
  }

  /**
   * POST /admin/cocina/lineas/:lineaId/listas { listas }
   * Fija las unidades listas de una línea (0..cantidad). Si todas las líneas del área quedan completas,
   * despeja el área (mismo efecto que el botón Listo). Deshacer: bajar unidades de un área despejada por el
   * mismo usuario hace menos de 15 s la reabre (quita despejada_en). Si el despeje había pasado el pedido a
   * LISTO, vuelve a COLA; si Caja ya lo cerró, el estado del pedido no cambia.
   */
  async marcarListas(
    lineaId: bigint | string | number,
    listas: number,
    usuarioActual: UsuarioAutenticado,
    ip?: string,
  ) {
    const lId = this.parsearId(lineaId, 'línea');
    const linea = await this.prisma.pedidoLinea.findUnique({
      where: { id: lId },
      select: {
        id: true,
        pedido_id: true,
        cantidad: true,
        listas: true,
        despachadas: true,
        area_id: true,
        producto: { select: { categoria: { select: { area_id: true } } } },
      },
    });
    if (!linea) {
      throw new NotFoundException({ codigo: 'LINEA_NO_ENCONTRADA', mensaje: 'Línea no encontrada' });
    }

    const pId = linea.pedido_id;
    const pedido = await this.prisma.pedido.findUnique({
      where: { id: pId },
      select: { id: true, codigo: true, estado: true },
    });
    if (!pedido || ESTADOS_FUERA_DE_COCINA.includes(pedido.estado)) {
      throw new ConflictException({
        codigo: 'ESTADO_INVALIDO',
        mensaje: 'No se pueden marcar unidades de un pedido anulado o rechazado',
      });
    }

    const aId = areaDeLineaPedido(linea);
    if (aId === null) {
      throw new ConflictException({ codigo: 'LINEA_SIN_AREA', mensaje: 'La línea no pasa por cocina' });
    }

    const comanda = await this.prisma.comandaArea.findUnique({
      where: { pedido_id_area_id: { pedido_id: pId, area_id: aId } },
    });
    if (!comanda) {
      throw new ConflictException({
        codigo: 'AREA_AJENA',
        mensaje: 'La línea no tiene comanda de su área en este pedido',
      });
    }

    if (!Number.isInteger(listas) || listas < 0 || listas > linea.cantidad) {
      throw new BadRequestException({
        codigo: 'LISTAS_INVALIDAS',
        mensaje: `Las unidades listas deben estar entre 0 y ${linea.cantidad}`,
      });
    }
    if (listas < linea.despachadas) {
      throw new ConflictException({
        codigo: 'DESPACHADAS_MAYOR',
        mensaje: `Ya se despacharon ${linea.despachadas} unidades: no puedes bajar de ese número`,
      });
    }

    const ahora = new Date();
    const completa = listas === linea.cantidad;
    // listo_en: se fija al llegar a cantidad; se conserva si ya estaba completa; se borra al bajar
    const listoEn = !completa ? null : linea.listas < linea.cantidad ? ahora : undefined;
    await this.prisma.pedidoLinea.update({
      where: { id: lId },
      data: { listas, listo_en: listoEn },
    });

    // Deshacer un despeje reciente: el mismo usuario baja una unidad dentro de la ventana y el área vuelve a cocina
    let reabierta = false;
    const haceMs = comanda.despejada_en ? ahora.getTime() - new Date(comanda.despejada_en).getTime() : Infinity;
    if (
      !completa &&
      listas < linea.listas &&
      comanda.estado === 'DESPEJADA' &&
      comanda.despejada_por != null &&
      comanda.despejada_por === usuarioActual.partyId &&
      haceMs <= VENTANA_DESHACER_DESPEJE_MS
    ) {
      await this.prisma.comandaArea.update({
        where: { pedido_id_area_id: { pedido_id: pId, area_id: aId } },
        data: { estado: 'EN_COCINA', despejada_en: null, despejada_por: null },
      });
      if (pedido.estado === 'LISTO') {
        await this.prisma.pedido.update({ where: { id: pId }, data: { estado: 'COLA' } });
        await this.prisma.pedidoEstadoHistorial.create({
          data: {
            pedido_id: pId,
            estado_anterior: 'LISTO',
            estado_nuevo: 'COLA',
            motivo: 'Despeje deshecho desde cocina',
            por_party_id: usuarioActual.partyId,
            en: ahora,
          },
        });
        this.eventosGateway?.emitirAdmin('pedido:estado', { id: Number(pId), codigo: pedido.codigo, estado: 'COLA' });
      }
      reabierta = true;
    }

    let despejada = false;
    if (completa && comanda.estado === 'EN_COCINA') {
      const lineasArea = (await this.lineasDeCocina(pId)).filter((l) => areaDeLineaPedido(l) === aId);
      if (lineasArea.every((l) => l.listas >= l.cantidad)) {
        await this.despejar(pId, aId, usuarioActual, ip);
        despejada = true;
      }
    }

    if (!despejada) {
      this.eventosGateway?.emitirAdmin('cocina:comanda', {
        pedidoId: Number(pId),
        areaId: Number(aId),
        completo: false,
      });
    }
    this.eventosGateway?.emitirAdmin('pedido:progreso', { id: Number(pId), codigo: pedido.codigo });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'cocina',
      accion: 'MARCAR_LISTAS',
      resultado: 'OK',
      entidad: 'pedido_linea',
      entidadId: lId,
      antes: { listas: linea.listas },
      despues: { listas, despejada, reabierta },
      partyId: usuarioActual.partyId,
      ip,
    });

    return {
      ok: true,
      lineaId: lId.toString(),
      pedidoId: pId.toString(),
      areaId: aId.toString(),
      listas,
      cantidad: linea.cantidad,
      despejada,
      reabierta,
    };
  }

  /**
   * POST /admin/cocina/pedidos/:pedidoId/despachar { lineas? }
   * Entrega al cliente o al mozo lo que está listo (sin líneas: todo lo listo pendiente de salir).
   * Solo mesa y para llevar/recoger; delivery sigue su reparto. Cuando todo está despachado, el pedido
   * queda listo y entregado (mesa: entregado en mesa; recoger/llevar: ENTREGADO). Si Caja ya lo entregó,
   * solo se registra el despacho.
   */
  async despachar(
    pedidoId: bigint | string | number,
    lineasPedidas: Array<{ lineaId: string | number; unidades: number }> | undefined,
    usuarioActual: UsuarioAutenticado,
    ip?: string,
  ) {
    const pId = this.parsearId(pedidoId, 'pedido');
    const pedido = await this.prisma.pedido.findUnique({
      where: { id: pId },
      include: {
        lineas: {
          select: {
            id: true,
            cantidad: true,
            listas: true,
            despachadas: true,
            area_id: true,
            producto: { select: { categoria: { select: { area_id: true } } } },
          },
        },
      },
    });
    if (!pedido) {
      throw new NotFoundException({ codigo: 'PEDIDO_NO_ENCONTRADO', mensaje: 'Pedido no encontrado' });
    }
    if (ESTADOS_FUERA_DE_COCINA.includes(pedido.estado)) {
      throw new ConflictException({
        codigo: 'ESTADO_INVALIDO',
        mensaje: `No se puede despachar un pedido en estado ${pedido.estado}`,
      });
    }
    if (!MODALIDADES_DESPACHO.includes(pedido.modalidad)) {
      throw new BadRequestException({
        codigo: 'MODALIDAD_INVALIDA',
        mensaje: 'Solo se despacha por producto en mesa o para llevar; delivery sigue su reparto',
      });
    }

    const lineasCocina = pedido.lineas.filter((l) => areaDeLineaPedido(l) !== null);
    const porId = new Map(lineasCocina.map((l) => [l.id.toString(), l]));

    // Unidades a despachar por línea
    const aDespachar = new Map<string, number>();
    if (lineasPedidas?.length) {
      for (const d of lineasPedidas) {
        const id = String(d.lineaId);
        const linea = porId.get(id);
        if (!linea) {
          throw new NotFoundException({ codigo: 'LINEA_NO_ENCONTRADA', mensaje: 'Línea no encontrada en el pedido' });
        }
        if (!Number.isInteger(d.unidades) || d.unidades < 1) {
          throw new BadRequestException({
            codigo: 'UNIDADES_INVALIDAS',
            mensaje: 'Las unidades a despachar deben ser al menos 1',
          });
        }
        aDespachar.set(id, (aDespachar.get(id) ?? 0) + d.unidades);
      }
      for (const [id, unidades] of aDespachar) {
        const linea = porId.get(id)!;
        const disponibles = linea.listas - linea.despachadas;
        if (unidades > disponibles) {
          throw new ConflictException({
            codigo: 'SIN_LISTAS_SUFICIENTES',
            mensaje: `Solo hay ${Math.max(0, disponibles)} unidades listas para despachar`,
          });
        }
      }
    } else {
      for (const l of lineasCocina) {
        const disponibles = l.listas - l.despachadas;
        if (disponibles > 0) aDespachar.set(l.id.toString(), disponibles);
      }
    }
    if (aDespachar.size === 0) {
      throw new ConflictException({
        codigo: 'NADA_LISTO_PARA_DESPACHAR',
        mensaje: 'No hay unidades listas por despachar',
      });
    }

    const ahora = new Date();
    // Con todo despachado, la cocina ya cumplió: las comandas pendientes salen
    const completo = lineasCocina.every((l) => {
      const extra = aDespachar.get(l.id.toString()) ?? 0;
      return l.despachadas + extra >= l.cantidad;
    });

    let estadoFinal: string = pedido.estado;
    await this.prisma.$transaction(async (tx) => {
      for (const [id, unidades] of aDespachar) {
        const linea = porId.get(id)!;
        await tx.pedidoLinea.update({
          where: { id: BigInt(id) },
          data: { despachadas: linea.despachadas + unidades, despachado_en: ahora },
        });
      }
      if (!completo) return;

      await tx.comandaArea.updateMany({
        where: { pedido_id: pId, estado: 'EN_COCINA' },
        data: { estado: 'DESPEJADA', despejada_en: ahora, despejada_por: usuarioActual.partyId },
      });

      if (ESTADOS_PARA_LISTO.includes(pedido.estado)) {
        await tx.pedido.update({
          where: { id: pId },
          data: { estado: 'LISTO', listo_en: ahora, pasa_cocina_en: pedido.pasa_cocina_en ?? ahora },
        });
        await tx.pedidoEstadoHistorial.create({
          data: {
            pedido_id: pId,
            estado_anterior: pedido.estado,
            estado_nuevo: 'LISTO',
            motivo: 'Todo despachado',
            por_party_id: usuarioActual.partyId,
            en: ahora,
          },
        });
        await this.avisos?.avisar(pId, 'LISTO', {}, tx);
        estadoFinal = 'LISTO';
      }

      // Para llevar o recoger, lo despachado completo es lo entregado (mesa va por entregado en mesa)
      if (pedido.modalidad !== 'MESA' && estadoFinal === 'LISTO') {
        await tx.pedido.update({
          where: { id: pId },
          data: { estado: 'ENTREGADO', entregado_en: ahora },
        });
        await tx.pedidoEstadoHistorial.create({
          data: {
            pedido_id: pId,
            estado_anterior: 'LISTO',
            estado_nuevo: 'ENTREGADO',
            motivo: 'Despachado completo',
            por_party_id: usuarioActual.partyId,
            en: ahora,
          },
        });
        await this.avisos?.avisar(pId, 'ENTREGADO', {}, tx);
        estadoFinal = 'ENTREGADO';
      }
    });

    if (estadoFinal !== pedido.estado) {
      this.avisos?.despertar();
      await this.auditoria.registrar({
        categoria: 'CAMBIO',
        modulo: 'pedidos',
        accion: 'CAMBIAR_ESTADO',
        resultado: 'OK',
        entidad: 'pedido',
        entidadId: pId,
        antes: { estado: pedido.estado },
        despues: { estado: estadoFinal, motivo: 'Despacho completo' },
        motivo: 'Despacho completo',
        partyId: usuarioActual.partyId,
        ip,
      });
      this.eventosGateway?.emitirAdmin('pedido:estado', {
        id: Number(pId),
        codigo: pedido.codigo,
        estado: estadoFinal,
      });
      if (estadoFinal === 'LISTO' && pedido.modalidad === 'MESA') {
        try {
          await this.salonService?.avisarListo(pId);
        } catch {
          // el aviso es informativo
        }
      }
    }

    // Mesa: lo despachado completo queda entregado en mesa (reusa la lógica del salón)
    if (completo && pedido.modalidad === 'MESA' && estadoFinal === 'LISTO' && !pedido.entregado_mesa_en) {
      await this.salonService?.marcarEntregadoMesa(pId, usuarioActual, ip);
    }

    const despachadas = [...aDespachar].map(([lineaId, unidades]) => ({ lineaId, unidades }));
    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'cocina',
      accion: 'DESPACHAR',
      resultado: 'OK',
      entidad: 'pedido',
      entidadId: pId,
      despues: { lineas: despachadas, completo, estado: estadoFinal },
      partyId: usuarioActual.partyId,
      ip,
    });

    this.eventosGateway?.emitirAdmin('pedido:progreso', { id: Number(pId), codigo: pedido.codigo });
    this.eventosGateway?.emitirAdmin('cocina:comanda', { pedidoId: Number(pId), areaId: null, completo });

    return { ok: true, pedidoId: pId.toString(), despachadas, completo, estado: estadoFinal };
  }

  /**
   * POST /admin/cocina/comandas/:pedidoId/:areaId/devolver
   * Vuelve la comanda a pendiente (EN_COCINA).
   * Si el pedido estaba LISTO regresa a COLA (historial y auditoría).
   * Si ya salió (EN_CAMINO o ENTREGADO) da 409.
   */
  async devolver(
    pedidoId: bigint | string | number,
    areaId: bigint | string | number,
    usuarioActual: UsuarioAutenticado,
    ip?: string,
  ) {
    const pId = this.parsearId(pedidoId, 'pedido');
    const aId = this.parsearId(areaId, 'area');

    const pedido = await this.prisma.pedido.findUnique({
      where: { id: pId },
    });

    if (!pedido) {
      throw new NotFoundException({
        codigo: 'PEDIDO_NO_ENCONTRADO',
        mensaje: 'Pedido no encontrado',
      });
    }

    if (['EN_CAMINO', 'ENTREGADO', 'ANULADO', 'RECHAZADO'].includes(pedido.estado)) {
      throw new ConflictException({
        codigo: 'ESTADO_INVALIDO',
        mensaje: `No se puede devolver una comanda de un pedido que ya está en ${pedido.estado}`,
      });
    }

    const comanda = await this.prisma.comandaArea.findUnique({
      where: {
        pedido_id_area_id: {
          pedido_id: pId,
          area_id: aId,
        },
      },
    });

    if (!comanda) {
      throw new NotFoundException({
        codigo: 'COMANDA_NO_ENCONTRADA',
        mensaje: 'Comanda no encontrada para el área especificada',
      });
    }

    if (comanda.estado !== 'DESPEJADA') {
      throw new ConflictException({
        codigo: 'COMANDA_NO_DESPEJADA',
        mensaje: 'La comanda no está despejada',
      });
    }

    const ahora = new Date();

    // Actualizar comanda a EN_COCINA
    await this.prisma.comandaArea.update({
      where: {
        pedido_id_area_id: {
          pedido_id: pId,
          area_id: aId,
        },
      },
      data: {
        estado: 'EN_COCINA',
        devuelta_en: ahora,
        devuelta_por: usuarioActual.partyId,
      },
    });

    // Si el pedido estaba en LISTO, regresar a COLA
    if (pedido.estado === 'LISTO') {
      await this.prisma.pedido.update({
        where: { id: pId },
        data: {
          estado: 'COLA',
        },
      });

      await this.prisma.pedidoEstadoHistorial.create({
        data: {
          pedido_id: pId,
          estado_anterior: 'LISTO',
          estado_nuevo: 'COLA',
          motivo: 'Comanda devuelta a cocina',
          por_party_id: usuarioActual.partyId,
          en: ahora,
        },
      });

      await this.auditoria.registrar({
        categoria: 'CAMBIO',
        modulo: 'pedidos',
        accion: 'CAMBIAR_ESTADO',
        resultado: 'OK',
        entidad: 'pedido',
        entidadId: pId,
        antes: { estado: 'LISTO' },
        despues: { estado: 'COLA', motivo: 'Comanda devuelta a cocina' },
        motivo: 'Comanda devuelta a cocina',
        partyId: usuarioActual.partyId,
        ip,
      });

      this.eventosGateway?.emitirAdmin('pedido:estado', {
        id: Number(pedido.id),
        codigo: pedido.codigo,
        estado: 'COLA',
      });
    }

    // Auditoría de devolución de comanda
    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'cocina',
      accion: 'DEVOLVER_COMANDA',
      resultado: 'OK',
      entidad: 'comanda_area',
      entidadId: pId,
      antes: { estado: comanda.estado },
      despues: { estado: 'EN_COCINA' },
      partyId: usuarioActual.partyId,
      ip,
    });

    // Evento socket
    this.eventosGateway?.emitirAdmin('cocina:comanda', {
      pedidoId: Number(pedido.id),
      areaId: Number(aId),
      completo: false,
    });

    return {
      ok: true,
      pedidoId: pId.toString(),
      areaId: aId.toString(),
      estado: 'EN_COCINA',
      completo: false,
    };
  }

  /**
   * GET /admin/cocina/historial?area=
   * Lo despejado hoy (hora local de Lima) con hora de llegada y de despeje.
   */
  async historial(areaRef?: string) {
    const inicioDiaLima = obtenerInicioDiaLima();
    const finDiaLima = calcularSiguienteMedianocheLima();

    let areaIdFiltro: bigint | null = null;
    if (areaRef && areaRef.trim().length > 0) {
      const area = await this.buscarArea(areaRef);
      areaIdFiltro = area.id;
    }

    const comandas = await this.prisma.comandaArea.findMany({
      where: {
        estado: 'DESPEJADA',
        despejada_en: {
          gte: inicioDiaLima,
          lt: finDiaLima,
        },
        ...(areaIdFiltro !== null ? { area_id: areaIdFiltro } : {}),
      },
      include: {
        area: true,
        pedido: {
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
        },
      },
      orderBy: [
        { despejada_en: 'desc' },
        { pedido_id: 'desc' },
      ],
    });

    return comandas.map((c) => {
      const p = c.pedido;
      const llegoEn = c.llego_en;
      const despejadaEn = c.despejada_en;
      const diffMs =
        despejadaEn && llegoEn ? new Date(despejadaEn).getTime() - new Date(llegoEn).getTime() : 0;
      const tiempoPreparacionMin = Math.max(0, Math.floor(diffMs / 60000));

      const lineasArea = p.lineas
        .filter((l) => {
          const lineaAreaId = l.area_id ?? l.producto?.categoria?.area_id;
          return lineaAreaId === c.area_id;
        })
        .map((l) => ({
          id: l.id.toString(),
          nombre: l.nombre,
          cantidad: l.cantidad,
          tamano: l.tamano ?? null,
          sabor: l.sabor ?? distribucionSabores(l),
          sabores: (l.sabores ?? []).map((s: any) => ({ nombre: s.sabor_nombre, cantidad: s.cantidad })),
          combo: extraerNombreCombo(l),
          opciones: extraerOpciones(l),
          personas: l.nombres_persona ?? [],
          nota: l.nota ?? null,
        }));

      const mesa =
        (p as any).mesa ??
        (p.modalidad === 'MESA' ? ((p as any).mesa_numero ?? p.entrega_referencia ?? null) : null);

      return {
        id: `${c.pedido_id}-${c.area_id}`,
        pedidoId: c.pedido_id.toString(),
        areaId: c.area_id.toString(),
        areaNombre: c.area.nombre,
        ticket: p.codigo,
        codigo: p.codigo,
        canal: p.canal,
        modalidad: p.modalidad,
        cliente: p.cliente_nombre ?? null,
        mesa,
        numeroDia: p.numero_dia ?? null,
        llego_en: llegoEn,
        despejada_en: despejadaEn,
        despejada_por: c.despejada_por?.toString() ?? null,
        tiempoPreparacionMin,
        lineas: lineasArea,
      };
    });
  }
}
