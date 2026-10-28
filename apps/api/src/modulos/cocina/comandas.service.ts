import { SalonService } from '../salon/salon.service';
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
  extraerOpciones,
  obtenerInicioDiaLima,
} from './cocina.util';

export interface DescuentoPedidoHook {
  descontarPedido(pedidoId: bigint | string | number): Promise<any> | any;
}

/** Líneas del pedido que pertenecen a un área, con los campos que usa la pantalla de cocina. */
function lineasDeArea(lineas: any[], areaId: bigint) {
  return lineas
    .filter((l) => (l.area_id ?? l.producto?.categoria?.area_id) === areaId)
    .map((l) => {
      const comboNombre = extraerNombreCombo(l);
      return {
        id: l.id.toString(),
        nombre: l.nombre,
        cantidad: l.cantidad,
        tamano: l.tamano ?? null,
        sabor: l.sabor ?? null,
        combo: comboNombre,
        combo_nombre: comboNombre,
        opciones: extraerOpciones(l),
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

    for (const areaId of areasACrear) {
      await this.prisma.comandaArea.create({
        data: {
          pedido_id: pId,
          area_id: areaId,
          estado: 'EN_COCINA',
          llego_en: llegoEn,
        },
      });
    }

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
              estado: { in: ['COLA', 'PREPARANDO'] },
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
          estado: { in: ['COLA', 'PREPARANDO'] },
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
          lineas: lineasDeArea(p.lineas, x.area_id),
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
        llego_en: c.llego_en,
        creado_en: p.creado_en,
        lineas: lineasDeArea(p.lineas, area.id),
        // Aditivo: la propia área ya despejó (solo seguimiento) y el estado de las áreas del pedido
        despejada: c.estado === 'DESPEJADA',
        areas,
      };
    });

    // Pendientes de mi área primero; las de solo seguimiento después (sort estable: conserva la hora de llegada)
    return lista.sort((x, y) => Number(x.despejada) - Number(y.despejada));
  }

  /**
   * POST /admin/cocina/comandas/:pedidoId/:areaId/despejar
   * Marca la comanda despejada (hora y usuario).
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

    if (pedido.estado === 'ANULADO' || !['COLA', 'PREPARANDO'].includes(pedido.estado)) {
      throw new ConflictException({
        codigo: 'ESTADO_INVALIDO',
        mensaje: `No se puede despejar un pedido en estado ${pedido.estado}`,
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

    if (comanda.estado === 'DESPEJADA') {
      throw new ConflictException({
        codigo: 'COMANDA_YA_DESPEJADA',
        mensaje: 'La comanda ya ha sido despejada',
      });
    }

    const ahora = new Date();

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

    if (completo) {
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
          sabor: l.sabor ?? null,
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
        llego_en: llegoEn,
        despejada_en: despejadaEn,
        despejada_por: c.despejada_por?.toString() ?? null,
        tiempoPreparacionMin,
        lineas: lineasArea,
      };
    });
  }

  /**
   * GET /admin/cocina/despacho
   * Cada pedido en COLA/PREPARANDO/LISTO del día con cliente (nombre), código
   * y por área si ya despejó o falta; marca «Completo» cuando todas despejaron.
   * NUNCA devuelve teléfono ni dirección.
   */
  async despacho() {
    await this.sincronizarPendientes();

    const inicioDiaLima = obtenerInicioDiaLima();
    const finDiaLima = calcularSiguienteMedianocheLima();

    const pedidos = await this.prisma.pedido.findMany({
      where: {
        creado_en: {
          gte: inicioDiaLima,
          lt: finDiaLima,
        },
        estado: { in: ['COLA', 'PREPARANDO', 'LISTO'] },
      },
      include: {
        comandas: {
          include: {
            area: true,
          },
        },
      },
    });

    // Orden FIFO: hora de llegada ascendente (desempate por id)
    pedidos.sort((a, b) => {
      const horaA = new Date(a.pasa_cocina_en ?? a.creado_en).getTime();
      const horaB = new Date(b.pasa_cocina_en ?? b.creado_en).getTime();
      if (horaA !== horaB) return horaA - horaB;
      return Number(a.id - b.id);
    });

    return pedidos.map((p) => {
      const comandas = p.comandas ?? [];
      const areas = comandas.map((c) => ({
        areaId: c.area_id.toString(),
        areaNombre: c.area.nombre,
        despejado: c.estado === 'DESPEJADA',
        estado: c.estado,
        despejada_en: c.despejada_en,
      }));

      const completo = comandas.length > 0 && comandas.every((c) => c.estado === 'DESPEJADA');

      const mesa =
        (p as any).mesa ??
        (p.modalidad === 'MESA' ? ((p as any).mesa_numero ?? p.entrega_referencia ?? null) : null);

      return {
        id: p.id.toString(),
        codigo: p.codigo,
        ticket: p.codigo,
        cliente: p.cliente_nombre ?? null,
        cliente_nombre: p.cliente_nombre ?? null,
        estado: p.estado,
        canal: p.canal,
        modalidad: p.modalidad,
        mesa,
        llego_en: p.pasa_cocina_en ?? p.creado_en,
        creado_en: p.creado_en,
        listo_en: p.listo_en,
        areas,
        completo,
        estadoDespacho: completo ? 'Completo' : 'Pendiente',
      };
    });
  }
}
