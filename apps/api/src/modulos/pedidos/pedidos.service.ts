import { calcularDescuentoPersonal, fechaDiaLima, resolverPctPersonal, validarColaborador } from '../creditos/descuento-personal';
import { montoElegiblePuntos } from '../ofertas/puntos-elegibles.util';
import { PuntosService } from '../clientes/puntos.service';
import { totalPedido } from '../../comun/total-pedido';
import { DireccionesClienteService } from '../clientes/direcciones-cliente.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  forwardRef,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { LocalService } from '../local/local.service';
import { ZonasService } from '../zonas/zonas.service';
import { calcularEnvioDelivery, PromoEnvioGratis } from '../ofertas/envio-gratis-promo';
import { OfertasService } from '../ofertas/ofertas.service';
import { ParteResueltaCombo } from '../ofertas/ofertas.tipos';
import { esGrupoBebidaDuplicado } from '../ofertas/combo-grupos.util';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { CrearPedidoDto, EntregaDto, LineaPedidoDto } from './dto/crear-pedido.dto';
import { generarTokenSeguimiento } from './seguimiento.tokens';
import { RedisService } from '../../comun/redis/redis.service';
import { textoParecePunto } from '../clientes/direcciones-cliente.service';
import { AvisosInternosService } from '../chatbot/avisos-internos/avisos-internos.service';
import { AvisosPedidoService } from '../chatbot/servicios/avisos-pedido.service';
import { TELEFONO_PLACEHOLDER, tieneTelefonoReal } from '../chatbot/utilidades/enmascarar.util';
import { PagoPlanService } from './pago-plan.service';
import { regresoAgotado } from '../catalogo/catalogo.service';
import { PartyPuntosService } from '../clientes/party-puntos.service';
import { Cumpleanos, exigirCumpleanos } from '../clientes/cumpleanos.util';
import { esComprobanteElegible, validarRuc } from '../comprobantes/comprobantes.util';
import { RucService, rucValido } from '../ruc';
import { leerConfigPropina } from '../propinas/propinas.service';
import { normalizarPropina, propinaActivaParaCanal } from '../propinas/propinas.util';
import { StockService } from '../stock/stock.service';
import { LineaVentaProducto, controlaPorSabor, descontarVentaProductos, validarSaboresLinea } from '../stock/producto-controlado';
import { RequisitoOpcion, lineasDeRequisitosOpcion, requisitosDeOpciones, requisitosFaltantes, saldosDeRequisitos } from '../stock/opcion-requiere';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { validarMotivoCortesia } from '../cortesias/cortesia.tipos';

/** Cortesía de una línea: solo con permiso cortesias/dar; sin oferta (la promoción ya tiene su precio). */
function validarCortesiaLinea(l: { ofertaId?: unknown; cortesia?: { motivo: string; nota?: string } }, origen?: OrigenPedido) {
  if (!origen?.puedeCortesia || origen.usuarioPartyId === undefined) {
    throw new ForbiddenException({ codigo: 'SIN_PERMISO_CORTESIA', mensaje: 'No tienes permiso para dar cortesías' });
  }
  if (l.ofertaId) {
    throw new BadRequestException({ codigo: 'CORTESIA_EN_OFERTA', mensaje: 'Un combo o una promoción no puede ser cortesía' });
  }
  return validarMotivoCortesia(l.cortesia?.motivo, l.cortesia?.nota);
}

/** Pista pública de la dirección anterior: nunca la dirección completa (ver enmascararDireccion). */
export type PistaDireccion = { existe: false } | { existe: true; zona: string | null; direccion: string | null };

/** Bebida (lleva un nombre por unidad para el envase), según su categoría o su área de cocina. */
function esBebidaPorNombres(categoria?: string | null, area?: string | null): boolean {
  const catNombre = (categoria || '').toUpperCase();
  const areaNombre = (area || '').toUpperCase();
  return (
    catNombre.includes('FRAPPE') ||
    catNombre.includes('ICED') ||
    catNombre.includes('FROZEN') ||
    catNombre.includes('CALIENTE') ||
    catNombre.includes('BEBIDA') ||
    areaNombre.includes('BARRA') ||
    areaNombre.includes('BEBIDA')
  );
}

/**
 * Dirección con la mayor parte oculta: «Av. Los G••••». Se ven la vía corta («Av.») y un conector corto
 * («Los»); la palabra siguiente solo deja su inicial y el resto se oculta. Los números no se muestran.
 * Sin texto útil (vacío o solo coordenadas): null.
 */
export function enmascararDireccion(texto: string | null | undefined): string | null {
  const limpio = texto?.trim();
  if (!limpio || textoParecePunto(limpio)) return null;
  const palabras = limpio.split(/\s+/).filter((p) => !/^\d+$/.test(p)).slice(0, 3);
  return palabras
    .map((p, i) => {
      if (/\d/.test(p)) return '•••';
      if (i < 2 && p.length <= (i === 0 ? 4 : 3)) return p;
      return `${p[0]}••••`;
    })
    .join(' ') || null;
}

export interface OrigenPedido {
  canal?: 'CARTA' | 'MOZO' | 'CAJA' | 'WHATSAPP' | 'BOT';
  usuarioPartyId?: bigint | string | number;
  /** Cliente con cuenta que hace el pedido en la carta (suma puntos) */
  clientePartyId?: bigint | string | number;
  /** Teléfono de quien escribe por WhatsApp: si tiene cuenta, el pedido queda a su nombre */
  telefonoRemitente?: string;
  /** WhatsApp: celular elegido para sumar puntos (puede no ser el de quien escribe); gana sobre telefonoRemitente */
  telefonoPuntos?: string;
  /** WhatsApp: el cliente eligió no sumar puntos; no se busca ninguna cuenta por teléfono */
  sinCuentaCliente?: boolean;
  esPersonal?: boolean;
  /** Pedido del personal: cargarlo a su crédito (por defecto) o cobrárselo ahora (admin, caja o mozo: creditos/cobrar_ahora). */
  pagoPersonal?: { modo: 'CREDITO' | 'AHORA'; medio?: string; pagaCon?: number };
  puedeCobrarAhora?: boolean;
  /** Quien da cortesías (permiso cortesias/dar). */
  puedeCortesia?: boolean;
  mesasIds?: (bigint | string | number)[];
  mesaNombre?: string;
  omitirChequeoCarta?: boolean;
  /** Pedido extra: id del pedido original al que se enlaza. El envío del extra siempre es 0 (ya se cobró en el original). */
  pedidoOrigenId?: bigint | string | number;
  enTransaccion?: (tx: Prisma.TransactionClient, pedido: any) => Promise<void>;
}

@Injectable()
export class PedidosService {
  private readonly logger = new Logger(PedidosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly localService: LocalService,
    private readonly zonasService: ZonasService,
    private readonly eventosGateway: EventosGateway,
    private readonly ofertasService: OfertasService,
    private readonly pagoPlan: PagoPlanService,
    @Optional() private readonly puntosService?: PuntosService,
    @Optional()
    @Inject(forwardRef(() => AvisosInternosService))
    private readonly avisosInternosService?: AvisosInternosService,
    @Optional()
    @Inject(forwardRef(() => AvisosPedidoService))
    private readonly avisosPedidoService?: AvisosPedidoService,
    @Optional() private readonly direcciones?: DireccionesClienteService,
    @Optional() private readonly puntosParty?: PartyPuntosService,
    @Optional() private readonly redis?: RedisService,
    @Optional() private readonly stockService?: StockService,
    @Optional() private readonly auditoria?: AuditoriaService,
    @Optional() private readonly rucService?: RucService,
  ) {}

  /** Último pedido de delivery con dirección de ese celular (carta sin sesión). Null si no hay. */
  private async ultimoPedidoDeliveryDelCelular(tel: string) {
    return this.prisma.pedido.findFirst({
      where: {
        cliente_telefono: tel,
        modalidad: 'DELIVERY',
        OR: [{ entrega_direccion: { not: null } }, { entrega_lat: { not: null } }],
      },
      orderBy: { id: 'desc' },
      select: { entrega_direccion: true, entrega_referencia: true, entrega_lat: true, entrega_lng: true, entrega_origen: true, zona_id: true },
    });
  }

  /**
   * Pista pública para la carta sin sesión: si ese celular tuvo un delivery con dirección, la zona y el texto
   * con la mayor parte oculta. La dirección completa nunca sale de aquí; el pedido la toma del servidor.
   */
  async pistaUltimaDireccion(telefono: string, ip?: string): Promise<PistaDireccion> {
    await this.limitarPista(telefono, ip);
    const ultimo = await this.ultimoPedidoDeliveryDelCelular(telefono);
    if (!ultimo) return { existe: false };
    const zona = ultimo.zona_id ? await this.prisma.zonaReparto.findUnique({ where: { id: ultimo.zona_id }, select: { codigo: true } }) : null;
    return { existe: true, zona: zona?.codigo ?? null, direccion: enmascararDireccion(ultimo.entrega_direccion) };
  }

  /** Límite por celular (10 por hora) y por IP (30 por hora). Si Redis no responde, no bloquea. */
  private async limitarPista(tel: string, ip?: string): Promise<void> {
    if (!this.redis) return;
    try {
      const r = this.redis.obtenerCliente();
      const limites: [string, number][] = [[`pedidos:pista:tel:${tel}`, 10]];
      if (ip) limites.push([`pedidos:pista:ip:${ip}`, 30]);
      for (const [clave, max] of limites) {
        const n = await r.incr(clave);
        if (n === 1) await r.expire(clave, 3600);
        if (n > max) {
          throw new HttpException(
            { codigo: 'DEMASIADAS_CONSULTAS', mensaje: 'Espera un poco antes de volver a consultar.' },
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
      }
    } catch (err) {
      if (err instanceof HttpException) throw err;
    }
  }

  /**
   * Cliente con cuenta del pedido: celular (solo MOZO/CAJA), cuenta de la carta o teléfono de WhatsApp.
   * Null = invitado. Un clienteTelefono de carta o WhatsApp se ignora.
   */
  /** «Pagar ahora» del personal: permiso, medio, paga con (efectivo, obligatorio) y caja abierta (efectivo y tarjeta). */
  private async validarCobroAhoraPersonal(origen: OrigenPedido, total: number): Promise<{ medio: string; pagaCon: number }> {
    if (!origen.puedeCobrarAhora || origen.usuarioPartyId === undefined) {
      throw new ForbiddenException({ codigo: 'SIN_PERMISO_COBRAR_AHORA', mensaje: 'No tienes permiso para cobrarle al trabajador en el momento' });
    }
    const medio = String(origen.pagoPersonal?.medio ?? '').trim().toUpperCase();
    if (!['EFECTIVO', 'YAPE', 'PLIN', 'TARJETA', 'TRANSFERENCIA'].includes(medio)) {
      throw new BadRequestException({ codigo: 'MEDIO_REQUERIDO', mensaje: 'Elige con qué paga el trabajador' });
    }
    const pagaCon = Number(origen.pagoPersonal?.pagaCon ?? 0);
    if (medio === 'EFECTIVO' && total > 0) {
      if (!(pagaCon > 0)) {
        throw new BadRequestException({ codigo: 'PAGA_CON_REQUERIDO', mensaje: 'Escribe con cuánto paga el trabajador (en efectivo)' });
      }
      if (pagaCon < total) {
        throw new BadRequestException({ codigo: 'PAGA_CON_MENOR_AL_TOTAL', mensaje: `El monto con el que paga (S/ ${pagaCon}) no puede ser menor al total (S/ ${total})` });
      }
    }
    if ((medio === 'EFECTIVO' || medio === 'TARJETA') && total > 0) {
      const caja = await this.prisma.caja.findFirst({ where: { estado: 'ABIERTA' }, select: { id: true } });
      if (!caja) throw new ConflictException({ codigo: 'CAJA_CERRADA', mensaje: 'Abre la caja para cobrar en efectivo o con tarjeta' });
    }
    return { medio, pagaCon };
  }

  /**
   * Propina del pedido (monto en soles). Sin interruptor encendido para el canal, se ignora (0). Con
   * propina inválida o sobre el tope, rechaza. Sin propina no toca la configuración.
   */
  private async validarPropina(valor: unknown, canal: string): Promise<number> {
    if (valor === undefined || valor === null || valor === '') return 0;
    const cfg = await leerConfigPropina(this.prisma);
    if (!propinaActivaParaCanal(cfg.activa, canal)) return 0;
    const r = normalizarPropina(valor, cfg.tope);
    if (!r.valido) {
      throw new BadRequestException({
        codigo: 'PROPINA_INVALIDA',
        mensaje: `La propina debe ser un monto en soles, con hasta 2 decimales y no mayor a S/ ${cfg.tope}`,
      });
    }
    return r.monto;
  }

  private async clienteIdentificado(dto: CrearPedidoDto, origen?: OrigenPedido): Promise<bigint | null> {
    const canal = origen?.canal ?? 'CARTA';
    if (canal === 'MOZO' || canal === 'CAJA') {
      if (!this.direcciones) return null;
      const noEncontrado = () =>
        new NotFoundException({
          codigo: 'CLIENTE_NO_ENCONTRADO',
          mensaje: 'No hay una cuenta de cliente con ese celular. Puedes atender como invitado.',
        });
      if (dto.clienteTelefono) {
        const partyId = await this.direcciones.resolverPartyPorTelefono(dto.clienteTelefono);
        if (partyId) return partyId;
        // Sin cuenta: el celular suma puntos en un party de puntos (si es inválido o la cuenta está desactivada, no)
        const nuevo = (await this.puntosParty?.resolverOCrear(dto.clienteTelefono)) ?? null;
        if (!nuevo) throw noEncontrado();
        return nuevo;
      }
      if (dto.clientePartyId) {
        const partyId = BigInt(dto.clientePartyId);
        if (!(await this.direcciones.datosCuentaActiva(partyId))) throw noEncontrado();
        return partyId;
      }
      return null;
    }
    if (origen?.sinCuentaCliente) return null;
    if (origen?.clientePartyId) {
      const partyId = BigInt(origen.clientePartyId);
      // Elegida en WhatsApp: debe ser un cliente con cuenta activa y rol CLIENTE vigente; si no, queda como invitado
      if (canal === 'WHATSAPP' || canal === 'BOT') {
        const rol = await this.prisma.partyRole.findFirst({ where: { party_id: partyId, rol: 'CLIENTE', hasta: null }, select: { id: true } });
        const cuenta = this.direcciones ? await this.direcciones.datosCuentaActiva(partyId) : null;
        return rol && cuenta ? partyId : null;
      }
      return partyId;
    }
    // Sin sesión: el celular (carta o WhatsApp) suma puntos en su party de puntos. En WhatsApp manda el celular elegido.
    const telefonoPuntos = canal === 'CARTA' ? undefined : (origen?.telefonoPuntos ?? origen?.telefonoRemitente);
    if (telefonoPuntos && this.direcciones) {
      const cuenta = await this.direcciones.resolverPartyPorTelefono(telefonoPuntos);
      if (cuenta) return cuenta;
    }
    const telefono = canal === 'CARTA' ? dto.cliente?.telefono : telefonoPuntos;
    if (!telefono || !this.puntosParty) return null;
    return this.puntosParty.resolverOCrear(telefono);
  }


  /**
   * Valida las líneas de un pedido contra la carta (producto, tamaño, opciones, sabores, combos, stock de opciones)
   * y calcula sus precios en el servidor. La usan la creación y la edición de pedidos.
   */
  async calcularLineasPedido(lineasDto: LineaPedidoDto[], clienteNombre: string | null, origen?: OrigenPedido, modalidad?: string) {
    const productoIds = lineasDto.map((l) => BigInt(l.productoId));
    const productosDb = await this.prisma.producto.findMany({
      where: { id: { in: productoIds } },
      include: {
        categoria: {
          include: { area: true },
        },
        tamanos: {
          include: { tamano_valor: true },
        },
        grupos: {
          include: {
            grupo: {
              include: {
                opciones: {
                  include: { valor: true },
                },
              },
            },
          },
        },
        sabores: true,
        // Anfitrión de una oferta COMBO: sus pasos son los grupos del combo, no una mezcla de sabores propia
        ofertasAlcance: { where: { tipo: 'COMBO' }, select: { id: true }, take: 1 },
      },
    });

    const ahora = new Date();
    const lineasCalculadas: any[] = [];
    let subtotalCalculado = 0;

    for (let i = 0; i < lineasDto.length; i++) {
      const l = lineasDto[i];
      const prodId = BigInt(l.productoId);
      const prodDb = productosDb.find((p) => p.id === prodId);

      if (!prodDb || prodDb.oculto) {
        throw new NotFoundException({
          codigo: 'PRODUCTO_NO_ENCONTRADO',
          mensaje: `Producto con ID ${l.productoId} no encontrado o no disponible`,
        });
      }

      // Validar si el producto está agotado
      if (prodDb.agotado_hasta && new Date(prodDb.agotado_hasta) > ahora) {
        throw new HttpException(
          {
            codigo: 'PRODUCTO_AGOTADO',
            mensaje: `El producto ${prodDb.nombre} se encuentra agotado`,
            // Hora de regreso (ISO) si es temporal; null si hay que reactivarlo a mano
            volverA: regresoAgotado(prodDb.agotado_hasta),
          },
          HttpStatus.CONFLICT,
        );
      }

      const cantidad = Math.max(1, Math.floor(Number(l.cantidad) || 1));

      // Determinar precio base y tamaño
      let precioBase = 0;
      let tamanoNombre: string | null = null;
      let unidadesTamano = 1;
      let tamanoValorIdLinea: bigint | null = null;

      if (prodDb.tamanos.length > 0) {
        if (!l.tamanoId) {
          throw new BadRequestException({
            codigo: 'TAMANO_REQUERIDO',
            mensaje: `Debe seleccionar un tamaño para el producto ${prodDb.nombre}`,
          });
        }
        const tamId = BigInt(l.tamanoId);
        const tamDb = prodDb.tamanos.find((t) => t.id === tamId);
        if (!tamDb) {
          throw new BadRequestException({
            codigo: 'TAMANO_INVALIDO',
            mensaje: `El tamaño no pertenece al producto ${prodDb.nombre}`,
          });
        }
        precioBase = Number(tamDb.precio);
        tamanoNombre = tamDb.tamano_valor?.nombre || `Tamaño ${tamDb.id}`;
        unidadesTamano = tamDb.unidades ?? 1;
        tamanoValorIdLinea = tamDb.tamano_valor_id;
      } else {
        precioBase = Number(prodDb.precio);
      }

      // Producto por sabor (controla stock y tiene sabores activos): sus unidades se reparten entre sabores
      const porSabor = controlaPorSabor(prodDb);
      const saboresLinea = porSabor
        ? validarSaboresLinea(prodDb, unidadesTamano, cantidad, l.sabores, ahora)
        : [];

      // Validar grupos y opciones del producto. Por sabor, sus grupos obligatorios heredados (p. ej. «Sabor»
      // de donas) no aplican: no se exigen ni se aceptan sus opciones. Solo cuentan las opciones activas y los
      // grupos que tienen alguna (un grupo vacío, como «Galleta 1 · Sabor» sin sabores, no bloquea el combo).
      const gruposActivos = prodDb.grupos
        .map((pg) => pg.grupo)
        .filter((g) => g.activo && !(porSabor && (g.obligatorio || g.minimo > 0)))
        .map((g) => ({ ...g, opciones: g.opciones.filter((o) => o.activo) }))
        .filter((g) => g.opciones.length > 0);

      const todasLasOpcionesDelProducto = gruposActivos.flatMap((g) => g.opciones);

      const opcionIdsEnviadas = (l.opciones || []).map((id) => BigInt(id));
      const opcionesElegidasInfo: any[] = [];

      for (const opId of opcionIdsEnviadas) {
        const opDb = todasLasOpcionesDelProducto.find((o) => o.id === opId);
        if (!opDb) {
          throw new BadRequestException({
            codigo: 'OPCIONES_INVALIDAS',
            mensaje: `La opción seleccionada no pertenece a los grupos del producto ${prodDb.nombre}`,
          });
        }
        const nombreOpcion = opDb.valor?.nombre || `Opción ${opDb.id}`;

        if (!opDb.activo) {
          throw new BadRequestException({
            codigo: 'OPCIONES_INVALIDAS',
            mensaje: `La opción ${nombreOpcion} no se encuentra activa`,
          });
        }
        if (opDb.agotado_hasta && new Date(opDb.agotado_hasta) > ahora) {
          throw new HttpException(
            {
              codigo: 'OPCION_AGOTADA',
              mensaje: `La opción ${nombreOpcion} está agotada`,
            },
            HttpStatus.CONFLICT,
          );
        }

        const grupoPadre = gruposActivos.find((g) => g.id === opDb.grupo_id);
        opcionesElegidasInfo.push({
          id: opDb.id,
          nombre: nombreOpcion,
          precio_extra: Number(opDb.precio_extra),
          grupo_id: opDb.grupo_id,
          grupo_nombre: grupoPadre?.nombre || 'Opciones',
        });
      }

      // Opciones ligadas a stock (opcion_requiere): lo que consume cada una se suma en orden con las anteriores
      // de la misma línea; la primera que no alcanza responde 409 (cubre «Dona 1» y «Dona 2» con el mismo sabor).
      const reqsOpciones = await requisitosDeOpciones(this.prisma, opcionesElegidasInfo.map((o) => o.id));
      // Stock que consume esta línea por sus opciones (cantidad de la línea incluida); se descuenta al crear el pedido
      const requisitosStockLinea: RequisitoOpcion[] = [];
      if (reqsOpciones.size > 0) {
        const saldos = await saldosDeRequisitos(this.prisma, [...reqsOpciones.values()].flat());
        const acumulado: RequisitoOpcion[] = [];
        for (const op of opcionesElegidasInfo) {
          const reqsOp = (reqsOpciones.get(op.id.toString()) ?? []).map((r) => ({ ...r, cantidad: r.cantidad * cantidad }));
          requisitosStockLinea.push(...reqsOp);
          acumulado.push(...reqsOp);
          if (requisitosFaltantes(acumulado, saldos, ahora).length > 0) {
            throw new ConflictException({
              codigo: 'OPCION_AGOTADA',
              mensaje: `No hay stock suficiente para elegir «${op.nombre}»`,
              opcionId: op.id.toString(),
            });
          }
        }
      }

      // Combo: la parte FIJO debe ser el principal o un reemplazo disponible (409 si no); las A_ELECCION, lo elegido.
      // Cada parte sale en su propia línea hija (cocina y stock); la madre sigue llevando el precio del combo.
      const combo: { nota: string; partes: ParteResueltaCombo[]; conBebidas?: boolean; recargoPorCombo?: number } = l.ofertaId
        ? await this.ofertasService.resolverPartesCombo(l.ofertaId, l.comboElecciones ?? [], cantidad, origen?.canal || 'CARTA', tamanoValorIdLinea, modalidad)
        : { nota: '', partes: [] };
      // Validar reglas por cada grupo (obligatorio, mínimo, máximo)
      for (const grupo of gruposActivos) {
        // Combo con bebidas por categoría: las bebidas se eligen en esa parte; los grupos «Bebida N · Sabor» del anfitrión no se exigen
        if (combo.conBebidas && esGrupoBebidaDuplicado(grupo.nombre)) continue;
        const opcionesDeEsteGrupo = opcionesElegidasInfo.filter(
          (o) => o.grupo_id === grupo.id,
        );

        if (grupo.obligatorio && opcionesDeEsteGrupo.length === 0) {
          throw new BadRequestException({
            codigo: 'OPCIONES_INVALIDAS',
            mensaje: `El grupo ${grupo.nombre} es obligatorio`,
          });
        }

        if (opcionesDeEsteGrupo.length < grupo.minimo) {
          throw new BadRequestException({
            codigo: 'OPCIONES_INVALIDAS',
            mensaje: `El grupo ${grupo.nombre} requiere al menos ${grupo.minimo} opción(es)`,
          });
        }

        if (opcionesDeEsteGrupo.length > grupo.maximo) {
          throw new BadRequestException({
            codigo: 'OPCIONES_INVALIDAS',
            mensaje: `El grupo ${grupo.nombre} permite como máximo ${grupo.maximo} opción(es)`,
          });
        }
      }

      // Precio de la línea = (precio base + suma de precio_extra) * cantidad
      const sumaExtras = opcionesElegidasInfo.reduce(
        (acc, op) => acc + op.precio_extra,
        0,
      ) + (combo.recargoPorCombo ?? 0); // extras de partes opcionales del combo, recalculados aquí
      const precioUnitarioLista = Number((precioBase + sumaExtras).toFixed(2));
      const valorListaLinea = Number((precioUnitarioLista * cantidad).toFixed(2));
      // Cortesía (venta a costo 0): la línea sale a S/ 0; su valor de lista queda guardado (no suma al pedido)
      const cortesiaLinea = l.cortesia ? validarCortesiaLinea(l, origen) : null;
      const precioUnitario = cortesiaLinea ? 0 : precioUnitarioLista;
      const lineaSubtotal = cortesiaLinea ? 0 : valorListaLinea;
      subtotalCalculado += lineaSubtotal;

      // Bebidas llevan personas[] con tantos nombres como unidades
      const esBebida = esBebidaPorNombres(prodDb.categoria?.nombre, prodDb.categoria?.area?.nombre);

      const personasAsignadas: string[] = [];
      if (esBebida) {
        for (let unit = 0; unit < cantidad; unit++) {
          const personaIngresada = l.personas?.[unit]?.trim();
          personasAsignadas.push(
            personaIngresada && personaIngresada.length > 0
              ? personaIngresada
              : (clienteNombre || 'Mesa'),
          );
        }
      } else {
        if (Array.isArray(l.personas)) {
          personasAsignadas.push(...l.personas.map((p) => p.trim()));
        }
      }

      const contenedora = combo.partes.length > 0;

      lineasCalculadas.push({
        productoId: prodDb.id,
        ofertaId: l.ofertaId ? BigInt(l.ofertaId) : null,
        categoriaId: prodDb.categoria_id,
        noSumaBeneficios: prodDb.no_suma_beneficios,
        nombre: prodDb.nombre,
        tamano: tamanoNombre,
        cantidad,
        // unidades que consume cada tamaño (1/2 docena = 6): el stock se descuenta en unidades
        unidadesTamano,
        precioUnitario,
        subtotal: lineaSubtotal,
        cortesia: cortesiaLinea ? { ...cortesiaLinea, valorLista: valorListaLinea } : null,
        // Línea madre de combo: sin producto ni área propios; la cocina ve solo sus hijas
        contenedora,
        areaId: contenedora ? null : (prodDb.categoria?.area_id ?? null),
        nota: [combo.nota, l.nota?.trim()].filter(Boolean).join(' · ') || null,
        nombresPersona: personasAsignadas,
        personasEntrada: Array.isArray(l.personas) ? l.personas : [],
        partesCombo: combo.partes,
        opciones: opcionesElegidasInfo,
        sabores: saboresLinea,
        // La cortesía también consume lo que lleva (producto y opciones ligadas a stock): solo cambia el precio.
        // Si una parte de combo ya descuenta ese producto, no se cuenta dos veces.
        requisitosOpcion: requisitosStockLinea.filter((r) => !combo.partes.some((p: ParteResueltaCombo) => String(p.productoId) === r.productoId)),
      });
    }

    subtotalCalculado = Number(subtotalCalculado.toFixed(2));
    if (lineasCalculadas.every((l) => l.cortesia)) {
      throw new BadRequestException({
        codigo: 'PEDIDO_SOLO_CORTESIA',
        mensaje: 'Un pedido solo de cortesías no se cobra: regístralas por separado',
      });
    }
    return { lineasCalculadas, subtotalCalculado };
  }

  /** Escribe las líneas calculadas (con sus opciones, sabores, hijas de combo y cortesías) dentro de la transacción del pedido. */
  async escribirLineasPedido(
    tx: Prisma.TransactionClient,
    pedidoId: bigint,
    lineasCalculadas: any[],
    clienteNombre: string | null,
    origen?: OrigenPedido,
  ) {
    // Crear líneas y opciones
    for (const lin of lineasCalculadas) {
      const lineaDb = await tx.pedidoLinea.create({
        data: {
          pedido_id: pedidoId,
          producto_id: lin.contenedora ? null : lin.productoId,
          oferta_id: lin.ofertaId ?? null,
          nombre: lin.nombre,
          tamano: lin.tamano,
          cantidad: lin.cantidad,
          precio_unit: new Prisma.Decimal(lin.precioUnitario),
          subtotal: new Prisma.Decimal(lin.subtotal),
          area_id: lin.areaId,
          nombres_persona: lin.nombresPersona,
          nota: lin.nota,
          es_cortesia: !!lin.cortesia,
          opciones: lin.opciones.map((o: any) => ({
            id: o.id.toString(),
            nombre: o.nombre,
            precio_extra: o.precio_extra,
            grupo: o.grupo_nombre,
          })),
        },
      });

      if (lin.cortesia) {
        await tx.cortesia.create({
          data: {
            producto_id: lin.productoId,
            cantidad: lin.cantidad,
            valor_lista: new Prisma.Decimal(lin.cortesia.valorLista),
            motivo: lin.cortesia.motivo,
            nota: lin.cortesia.nota,
            pedido_id: pedidoId,
            pedido_linea_id: lineaDb.id,
            dada_por_party_id: BigInt(origen!.usuarioPartyId!),
            autorizada_por_party_id: null,
          },
        });
      }

      // Partes del combo: una línea hija por producto, sin cobro (el precio ya va en la madre)
      // Los nombres de envase se reparten en orden entre las bebidas del combo (Bebida 1, Bebida 2...)
      let nombreSiguiente = 0;
      for (const parte of lin.partesCombo) {
        const esBebidaParte = esBebidaPorNombres(parte.categoriaNombre ?? undefined, parte.areaNombre ?? undefined);
        const hija = await tx.pedidoLinea.create({
          data: {
            pedido_id: pedidoId,
            producto_id: parte.productoId,
            linea_combo_id: lineaDb.id,
            nombre: parte.nombre,
            cantidad: parte.cantidad,
            tamano: parte.tamano ?? null,
            precio_unit: new Prisma.Decimal(0),
            subtotal: new Prisma.Decimal(0),
            area_id: parte.areaId,
            nombres_persona: esBebidaParte
              ? Array.from({ length: parte.cantidad }, (_, u) => lin.personasEntrada[nombreSiguiente + u]?.trim() || clienteNombre || 'Mesa')
              : [],
            nota: parte.nota,
          },
        });
        if (esBebidaParte) nombreSiguiente += parte.cantidad;
        // Producto por sabor de la parte: sus sabores siguen a la línea hija (igual que en una línea normal)
        for (const sb of parte.sabores ?? []) {
          await tx.pedidoLineaSabor.create({
            data: { pedido_linea_id: hija.id, sabor_id: sb.saborId, sabor_nombre: sb.nombre, cantidad: sb.cantidad },
          });
        }
      }

      for (const op of lin.opciones) {
        await tx.pedidoLineaOpcion.create({
          data: {
            pedido_linea_id: lineaDb.id,
            opcion_id: op.id,
            grupo_nombre: op.grupo_nombre,
            opcion_nombre: op.nombre,
            precio_unit: new Prisma.Decimal(op.precio_extra),
            precio_extra: new Prisma.Decimal(op.precio_extra),
          },
        });
      }

      for (const sb of lin.sabores) {
        await tx.pedidoLineaSabor.create({
          data: {
            pedido_linea_id: lineaDb.id,
            sabor_id: sb.saborId,
            sabor_nombre: sb.nombre,
            cantidad: sb.cantidad,
          },
        });
      }
    }
  }

  /** Lo que consumen del stock las líneas calculadas: sus opciones ligadas a stock, el producto de cada línea y las partes de sus combos. */
  async ventaDeLineas(db: any, lineasCalculadas: any[]): Promise<LineaVentaProducto[]> {
    const ventaOpciones = await lineasDeRequisitosOpcion(db, lineasCalculadas.flatMap((l) => l.requisitosOpcion));
    return [
      ...ventaOpciones,
      ...lineasCalculadas
        .filter((l) => !l.contenedora)
        .map((l) => ({ productoId: l.productoId, cantidad: l.cantidad * (l.unidadesTamano ?? 1), areaId: l.areaId, sabores: l.sabores })),
      ...lineasCalculadas.flatMap((l) =>
        l.partesCombo.map((p: ParteResueltaCombo) => ({
          productoId: p.productoId,
          // unidades que consume el tamaño de la parte (1/2 docena = 6), igual que la línea normal
          cantidad: p.cantidad * (p.unidadesTamano ?? 1),
          areaId: p.areaId,
          sabores: p.sabores,
        })),
      ),
    ];
  }

  /** Descuenta el stock de los productos que lo controlan (y de las opciones ligadas a stock) de las líneas calculadas. */
  async descontarStockLineas(tx: Prisma.TransactionClient, pedidoId: bigint, por: bigint, lineasCalculadas: any[]) {
    // Productos que controlan stock: se descuentan ya (todos los canales) y el tope corta el pedido entero
    return descontarVentaProductos(tx, pedidoId, await this.ventaDeLineas(tx, lineasCalculadas), por);
  }

  /**
   * Crea un nuevo pedido desde la carta virtual con validaciones completas y cálculo en el servidor.
   */
  async crear(
    dto: CrearPedidoDto,
    idempotencyKey?: string,
    origen?: OrigenPedido,
  ) {
    if (!idempotencyKey || typeof idempotencyKey !== 'string' || idempotencyKey.trim().length === 0) {
      throw new BadRequestException({
        codigo: 'CLAVE_REQUERIDA',
        mensaje: 'La cabecera Idempotency-Key es obligatoria para enviar un pedido',
      });
    }

    const claveIdempotencia = idempotencyKey.trim();

    // 1. Idempotencia: si ya existe un pedido con esa clave, se devuelve el pedido existente (RQ-PED-03-09)
    const pedidoExistente = await this.prisma.pedido.findUnique({
      where: { clave_idempotencia: claveIdempotencia },
    });

    if (pedidoExistente) {
      return {
        id: pedidoExistente.id.toString(),
        codigo: pedidoExistente.codigo,
        estado: pedidoExistente.estado,
        seguimientoToken: generarTokenSeguimiento(pedidoExistente.id),
        subtotal: Number(pedidoExistente.subtotal),
        descuento: Number(pedidoExistente.descuento || 0),
        envio: pedidoExistente.envio !== null ? Number(pedidoExistente.envio) : null,
        total: Number(pedidoExistente.total),
        mensaje:
          origen?.canal === 'MOZO'
            ? 'Pedido enviado a cocina'
            : 'Un asesor te escribirá para coordinar el pago',
      };
    }

    // 2. Horario: el guard único. Solo el personal (Mozo/Caja o pedido del panel) puede saltarlo;
    // carta, WhatsApp, bot e IA jamás, aunque alguien pase omitirChequeoCarta.
    const canalCliente = !origen?.canal || origen.canal === 'CARTA' || origen.canal === 'WHATSAPP' || origen.canal === 'BOT';
    const omitirCarta =
      !canalCliente && (origen?.canal === 'MOZO' || origen?.canal === 'CAJA' || origen?.omitirChequeoCarta === true);
    if (!omitirCarta) {
      await this.localService.exigirLocalAbierto();
    }

    // 3. Validar datos de cliente (opcional para pedidos de mozo/caja en panel admin)
    const esMozo =
      origen?.canal === 'MOZO' ||
      origen?.canal === 'CAJA' ||
      origen?.omitirChequeoCarta === true;
    let clienteNombre: string | null = null;
    let telefonoLimpio: string | null = null;
    let cumpleCliente: Cumpleanos | null = null;
    let direccionReutilizada: EntregaDto | null = null;
    // Alta de cliente por celular desde la carta sin sesión: el party de puntos recibe el nombre
    let altaPorCelular = false;

    if (esMozo) {
      clienteNombre =
        dto.cliente?.nombre?.trim() ||
        origen?.mesaNombre ||
        (dto.mesa ? `Mesa ${dto.mesa}` : 'Mesa');
      telefonoLimpio = dto.cliente?.telefono?.trim() || null;
      if (telefonoLimpio && (!/^9\d{8}$/.test(telefonoLimpio) || telefonoLimpio === TELEFONO_PLACEHOLDER)) {
        throw new BadRequestException({
          codigo: 'TELEFONO_INVALIDO',
          mensaje: 'El teléfono debe tener 9 dígitos, empezar con 9 y ser un número real',
        });
      }
    } else {
      // Nombre (2+ letras) y celular real (9 dígitos que empiezan con 9) obligatorios en carta, WhatsApp y bot
      if (!dto.cliente?.nombre || dto.cliente.nombre.trim().length < 2) {
        throw new BadRequestException({
          codigo: 'CLIENTE_NOMBRE_REQUERIDO',
          mensaje: 'Escribe el nombre del cliente (mínimo 2 letras)',
        });
      }

      telefonoLimpio = dto.cliente?.telefono?.trim() || null;
      const celularValido = !!telefonoLimpio && /^9\d{8}$/.test(telefonoLimpio) && telefonoLimpio !== TELEFONO_PLACEHOLDER;
      const esCartaSinSesion = (origen?.canal ?? 'CARTA') === 'CARTA' && !origen?.clientePartyId && !origen?.sinCuentaCliente;
      if (!celularValido) {
        throw new BadRequestException({
          codigo: telefonoLimpio ? 'TELEFONO_INVALIDO' : 'CELULAR_REQUERIDO',
          mensaje: 'El celular es obligatorio: 9 dígitos que empiecen con 9 (no vale 999999999)',
        });
      }
      clienteNombre = dto.cliente.nombre.trim();
      // Alta de cliente por celular desde la carta sin sesión: el nombre (2+ letras) es obligatorio.
      // El cumpleaños no se pide aquí (solo al crear cuenta): el pedido sin cuenta no lo guarda.
      if (esCartaSinSesion && celularValido) {
        if (clienteNombre.length < 2) {
          throw new BadRequestException({ codigo: 'NOMBRE_REQUERIDO', mensaje: 'Escribe tu nombre completo para sumar puntos con tu celular.' });
        }
        altaPorCelular = true;
      }
      // Quien pide con su cuenta puede completar su cumpleaños si aún no lo tiene
      if ((origen?.canal ?? 'CARTA') === 'CARTA' && origen?.clientePartyId && dto.cliente?.cumpleanos) {
        cumpleCliente = exigirCumpleanos(dto.cliente.cumpleanos);
      }
      // Sin sesión: la dirección del último pedido de ese celular la toma el servidor (nunca viaja al navegador)
      if (esCartaSinSesion && dto.modalidad === 'DELIVERY' && dto.entrega?.reutilizarUltimaDireccion) {
        const ultimo = celularValido ? await this.ultimoPedidoDeliveryDelCelular(telefonoLimpio!) : null;
        if (!ultimo) {
          throw new BadRequestException({
            codigo: 'SIN_DIRECCION_ANTERIOR',
            mensaje: 'No encontramos una dirección anterior con ese celular. Escribe tu dirección.',
          });
        }
        direccionReutilizada = {
          direccion: ultimo.entrega_direccion ?? undefined,
          referencia: ultimo.entrega_referencia ?? undefined,
          lat: ultimo.entrega_lat != null ? Number(ultimo.entrega_lat) : undefined,
          lng: ultimo.entrega_lng != null ? Number(ultimo.entrega_lng) : undefined,
          origen: (ultimo.entrega_origen as EntregaDto['origen']) ?? undefined,
        } as EntregaDto;
      }
    }

    // 4. Comprobante en todo canal: simple (por defecto, sin SUNAT), boleta o factura
    const tipoElegido = dto.comprobante?.tipo ?? 'SIMPLE';
    if (!esComprobanteElegible(tipoElegido)) {
      throw new BadRequestException({
        codigo: 'COMPROBANTE_INVALIDO',
        mensaje: 'Elige comprobante simple, boleta o factura para tu pedido',
      });
    }
    if (tipoElegido === 'FACTURA') {
      const ruc = dto.comprobante?.ruc?.trim();
      const razonSocial = dto.comprobante?.razonSocial?.trim();
      if (!ruc || !validarRuc(ruc) || !razonSocial || razonSocial.length === 0) {
        throw new BadRequestException({
          codigo: 'FACTURA_DATOS_INCOMPLETOS',
          mensaje: 'La factura exige RUC de 11 dígitos y razón social',
        });
      }
    } else if (tipoElegido === 'BOLETA') {
      const dni = dto.comprobante?.dni?.trim();
      if (dni && !/^\d{8}$/.test(dni)) {
        throw new BadRequestException({
          codigo: 'DNI_INVALIDO',
          mensaje: 'El DNI debe tener 8 dígitos numéricos',
        });
      }
    }

    // 5. Validar líneas del pedido y calcular precios en el servidor
    if (!Array.isArray(dto.lineas) || dto.lineas.length === 0) {
      throw new BadRequestException({
        codigo: 'LINEAS_REQUERIDAS',
        mensaje: 'El pedido debe contener al menos un producto',
      });
    }

    const { lineasCalculadas, subtotalCalculado } = await this.calcularLineasPedido(dto.lineas, clienteNombre, origen, dto.modalidad);


    // 5.0. Cliente con cuenta identificado (suma puntos, historial y direcciones)
    const clienteFinal = await this.clienteIdentificado(dto, origen);
    // Carta con cuenta o celular: completa nombre y cumpleaños solo si el cliente aún no los tiene
    if (clienteFinal && this.puntosParty && (cumpleCliente || altaPorCelular)) {
      await this.puntosParty.completarDatos(clienteFinal, {
        nombre: clienteNombre ?? undefined,
        ...(cumpleCliente ? { cumple: cumpleCliente } : {}),
      });
    }
    // Cliente con cuenta de mozo/caja: si el pedido no trae nombre o teléfono propios, se toman de su cuenta
    let nombreDeCuenta = '';
    if (esMozo && clienteFinal && this.direcciones) {
      const cuenta = await this.direcciones.datosCuentaActiva(clienteFinal);
      if (cuenta) {
        if (!dto.cliente?.nombre?.trim()) clienteNombre = cuenta.nombre;
        nombreDeCuenta = cuenta.nombre ?? '';
        telefonoLimpio = telefonoLimpio || cuenta.telefono;
      }
    }
    // Mozo y caja (mesa, llevar, delivery): nombre y celular reales siempre. Excepciones: pedido del personal
    // (el cliente es el trabajador, su celular sale de su ficha) y pedido extra (hereda los datos del original).
    if (esMozo && !origen?.esPersonal && origen?.pedidoOrigenId == null) {
      telefonoLimpio = telefonoLimpio || dto.clienteTelefono || null;
      if ((dto.cliente?.nombre?.trim() || nombreDeCuenta.trim()).length < 2) {
        throw new BadRequestException({
          codigo: 'CLIENTE_NOMBRE_REQUERIDO',
          mensaje: 'Escribe el nombre del cliente (mínimo 2 letras)',
        });
      }
      if (!telefonoLimpio || !/^9\d{8}$/.test(telefonoLimpio) || telefonoLimpio === TELEFONO_PLACEHOLDER) {
        throw new BadRequestException({
          codigo: telefonoLimpio ? 'TELEFONO_INVALIDO' : 'CELULAR_REQUERIDO',
          mensaje: 'El celular es obligatorio: 9 dígitos que empiecen con 9 (no vale 999999999)',
        });
      }
    }

    // 5.1. Calcular descuento (oferta/cupón según reglas de acumulación) en el servidor
    const canalPedido = origen?.canal || 'CARTA';
    const desgloseDescuento = await this.ofertasService.calcularDescuentosParaPedido({
      subtotal: subtotalCalculado,
      // Las cortesías no entran a promociones ni descuentos (su precio ya es 0)
      lineas: lineasCalculadas.filter((lin) => !lin.cortesia).map((lin) => ({
        productoId: lin.productoId,
        categoriaId: lin.categoriaId,
        cantidad: lin.cantidad,
        subtotal: lin.subtotal,
        precioUnitario: lin.precioUnitario,
        noSumaBeneficios: lin.noSumaBeneficios,
      })),
      canal: canalPedido,
      modalidad: dto.modalidad,
      cuponCodigo: dto.cuponCodigo,
      clientePartyId: clienteFinal,
      // Solo la carta con sesión iniciada (no WhatsApp, mozo ni celular suelto)
      clienteConSesion: canalPedido === 'CARTA' && !!origen?.clientePartyId,
    });

    // Pedido del personal (mozo/caja): lleva el descuento del personal desde que se crea, sobre lo elegible,
    // y su total queda a cargo del trabajador (se acumula en Créditos del personal, no se cobra en caja)
    let colaboradorId: bigint | null = null;
    let descuentoPersonal = 0;
    let pctPersonal = 0;
    if (origen?.esPersonal) {
      if (canalPedido !== 'MOZO' && canalPedido !== 'CAJA') {
        throw new BadRequestException({
          codigo: 'CANAL_NO_PERMITIDO',
          mensaje: 'Por la carta virtual no se consume crédito del personal',
        });
      }
      if (!origen.clientePartyId) {
        throw new BadRequestException({
          codigo: 'COLABORADOR_REQUERIDO',
          mensaje: 'Elige al trabajador al que se le carga el pedido del personal',
        });
      }
      colaboradorId = BigInt(origen.clientePartyId);
      await validarColaborador(this.prisma, colaboradorId);
      pctPersonal = await resolverPctPersonal(this.prisma, colaboradorId);
      descuentoPersonal = calcularDescuentoPersonal(
        lineasCalculadas
          .filter((lin) => !lin.cortesia)
          .map((lin) => ({
            productoId: lin.productoId,
            nombre: lin.nombre,
            subtotal: lin.subtotal,
            noSumaBeneficios: lin.noSumaBeneficios,
            enPromocion: Boolean(lin.ofertaId) || Boolean(lin.contenedora) || (lin.partesCombo?.length ?? 0) > 0,
          })),
        desgloseDescuento.detalles as any,
        pctPersonal,
      );
    }
    const personal = colaboradorId !== null;
    const descuentoAplicado = Number((desgloseDescuento.descuentoTotal + descuentoPersonal).toFixed(2));
    const detallesDescuento: any[] = [
      ...(desgloseDescuento.detalles as any[]),
      ...(descuentoPersonal > 0
        ? [{ tipo: 'PERSONAL', nombre: `Descuento del personal ${pctPersonal}%`, descuentoTipo: 'PORCENTAJE', descuentoValor: pctPersonal, montoDescontado: descuentoPersonal }]
        : []),
    ];

    // Cupón de envío gratis: solo delivery (en pickup o mesa el cliente debe quitarlo)
    if (desgloseDescuento.envioGratisCupon && dto.modalidad !== 'DELIVERY') {
      throw new BadRequestException({
        codigo: 'CUPON_SOLO_DELIVERY',
        mensaje: 'El cupón de envío gratis solo aplica a pedidos de delivery',
      });
    }

    // 6. Pedido mínimo: solo para DELIVERY, sobre el subtotal de productos (sin envío ni descuentos).
    // Sin parámetro `pedido_minimo` configurado (o 0) no hay mínimo.
    if (dto.modalidad === 'DELIVERY') {
      const paramPedidoMinimo = await this.prisma.parametro.findUnique({
        where: { clave: 'pedido_minimo' },
      });
      const pedidoMinimoVal =
        typeof paramPedidoMinimo?.valor === 'number'
          ? paramPedidoMinimo.valor
          : Number(paramPedidoMinimo?.valor) || 0;

      if (pedidoMinimoVal > 0 && subtotalCalculado < pedidoMinimoVal) {
        const faltante = Number((pedidoMinimoVal - subtotalCalculado).toFixed(2));
        throw new BadRequestException({
          codigo: 'PEDIDO_MINIMO',
          mensaje: `El pedido mínimo para delivery es S/ ${pedidoMinimoVal.toFixed(2)}; te faltan S/ ${faltante.toFixed(2)}`,
          minimo: pedidoMinimoVal,
          faltante,
        });
      }
    }

    // 7. Cálculo de envío (solo DELIVERY)
    // Dirección del pedido: la de la carta, o la del último pedido de ese celular si la pidió reutilizar
    const entrega = direccionReutilizada ?? dto.entrega;
    let envio: number | null = 0;
    let envioPromo: PromoEnvioGratis | null = null;
    let zonaId: bigint | null = null;
    let entregaOrigen: string | null = null;

    if (dto.modalidad === 'DELIVERY') {
      const tieneCoordenadas =
        typeof entrega?.lat === 'number' && typeof entrega?.lng === 'number';

      if (tieneCoordenadas) {
        const lat = entrega!.lat!;
        const lng = entrega!.lng!;

        const zonaDetectada = await this.zonasService.detectar(lat, lng);
        if (!zonaDetectada) {
          throw new HttpException(
            {
              codigo: 'FUERA_DE_COBERTURA',
              mensaje: 'La ubicación indicada se encuentra fuera de nuestra zona de cobertura',
            },
            HttpStatus.CONFLICT,
          );
        }

        zonaId = zonaDetectada.zonaId;

        // Misma función que la consulta /carta/envio y ubicar: promo ENVIO_GRATIS o envío gratis por monto
        const calculoEnvio = await calcularEnvioDelivery(this.prisma, {
          subtotal: subtotalCalculado,
          tarifaZona: zonaDetectada.tarifa,
          canal: canalPedido,
          modalidad: 'DELIVERY',
          envioGratisCupon: desgloseDescuento.envioGratisCupon,
        });
        envio = calculoEnvio.envio;
        envioPromo = calculoEnvio.promo;

        entregaOrigen = entrega?.origen || 'GPS';
      } else if (
        entrega?.direccion &&
        entrega.direccion.trim().length >= 5
      ) {
        // La carta ya no pide el punto exacto: dirección escrita y referencia obligatorias; el envío queda «por confirmar»
        // hasta que llegue la ubicación (WhatsApp, Caja o repartidor) y el pedido queda esperando ubicación
        if (canalPedido === 'CARTA' && (entrega.referencia?.trim().length ?? 0) < 3) {
          throw new BadRequestException({
            codigo: 'REFERENCIA_REQUERIDA',
            mensaje: 'Para delivery escribe una referencia (por ejemplo: frente al parque, portón negro)',
          });
        }
        envio = null;
        zonaId = null;
        entregaOrigen = 'ESCRITA';
        // Sin zona aún: si hay cupón de envío gratis, el envío queda en 0 (ubicar no lo vuelve a cobrar)
        if (desgloseDescuento.envioGratisCupon) envio = 0;
      } else {
        throw new BadRequestException({
          codigo: 'UBICACION_REQUERIDA',
          mensaje:
            'Para delivery se requiere ubicación en el mapa o una dirección escrita de al menos 5 caracteres',
        });
      }
    } else {
      // RECOGER, MESA o COMER_LOCAL
      envio = 0;
      zonaId = null;
      entregaOrigen = null;
    }

    // Pedido extra: el envío ya se cobró en el original
    if (origen?.pedidoOrigenId !== undefined) envio = 0;

    // canje de puntos (DT-55): solo con cuenta, sin cupón y hasta el monto de los productos
    const puntosCanje = Number(Number(dto.puntosCanje || 0).toFixed(2));
    if (puntosCanje > 0) {
      if (personal) {
        throw new BadRequestException({ codigo: 'PUNTOS_NO_APLICAN_PERSONAL', mensaje: 'El pedido del personal no canjea puntos' });
      }
      const partyCliente = origen?.clientePartyId;
      const cuentaActiva = partyCliente && this.direcciones ? await this.direcciones.datosCuentaActiva(BigInt(partyCliente)) : null;
      if (!partyCliente || !this.puntosService || !cuentaActiva) {
        throw new BadRequestException({
          codigo: 'PUNTOS_REQUIEREN_CUENTA',
          mensaje: 'Ingresa con tu cuenta para usar tus puntos',
        });
      }
      if (desgloseDescuento.cuponId || desgloseDescuento.cuponEmitidoId) {
        throw new BadRequestException({
          codigo: 'PUNTOS_CON_CUPON',
          mensaje: 'No se pueden usar puntos y un cupón en el mismo pedido',
        });
      }
      const saldo = await this.puntosService.obtenerSaldo(partyCliente as any);
      if (puntosCanje > saldo) {
        throw new BadRequestException({
          codigo: 'PUNTOS_INSUFICIENTES',
          mensaje: `Solo tienes ${saldo.toFixed(2)} puntos`,
        });
      }
      const montoCanjeable = montoElegiblePuntos(lineasCalculadas, desgloseDescuento.detalles);
      if (puntosCanje > montoCanjeable) {
        throw new BadRequestException({
          codigo: 'TOPE_CANJE_EXCEDIDO',
          mensaje: 'Los puntos solo se usan en productos sin descuento ni promoción',
        });
      }
    }

    // El total es lo que realmente se paga: ya sin los puntos canjeados (1 punto = S/ 1). El plan de pago, «paga con»,
    // el voucher y el comprobante se validan contra este neto.
    const totalCalculado = totalPedido({ subtotal: subtotalCalculado, descuento: descuentoAplicado, envio: envio ?? 0, puntosCanjeados: puntosCanje });

    // 7.5. Propina opcional: va APARTE de la venta (no suma al total, comprobante ni puntos). Lo que paga el
    // cliente (plan, voucher, efectivo) es total + propina.
    const propinaPedido = await this.validarPropina(dto.propina, origen?.canal ?? 'CARTA');
    const aCobrar = Number((totalCalculado + propinaPedido).toFixed(2));

    // 8. Validación de pago (con plan: el efectivo se compara contra su parte, no contra el total)
    // el pedido del personal no se cobra en caja: ni plan de pago ni vuelto
    const planPago = personal ? null : this.pagoPlan.validar(dto.pago.plan, aCobrar);
    const montoEfectivo = planPago
      ? this.pagoPlan.montoEfectivo(planPago)
      : dto.pago.metodo === 'EFECTIVO' && !personal
        ? aCobrar
        : 0;
    // «Con cuánto paga» es OBLIGATORIO con efectivo en cualquier canal (carta, Caja, WhatsApp, bot, extra).
    // Exentos: pedido del personal y cortesía total (montoEfectivo = 0), y la MESA abierta por el personal
    // (mozo/caja): no sabe el billete al abrir y lo pide al cobrar en la precuenta. Pagar exacto = escribir el monto exacto.
    const mesaDelPersonal = dto.modalidad === 'MESA' && (origen?.canal === 'MOZO' || origen?.canal === 'CAJA');
    if (montoEfectivo > 0 && !mesaDelPersonal && (dto.pago.pagaCon === undefined || dto.pago.pagaCon === null || !(Number(dto.pago.pagaCon) > 0))) {
      throw new BadRequestException({
        codigo: 'PAGA_CON_REQUERIDO',
        mensaje: 'Escribe con cuánto paga el cliente (en efectivo)',
      });
    }
    if (dto.pago.pagaCon !== undefined && montoEfectivo > 0 && Number(dto.pago.pagaCon) < montoEfectivo) {
      throw new BadRequestException({
        codigo: 'PAGA_CON_MENOR_AL_TOTAL',
        mensaje: `El monto con el que paga (S/ ${dto.pago.pagaCon}) no puede ser menor a ${planPago ? 'la parte en efectivo' : 'el total'} (S/ ${montoEfectivo})`,
      });
    }

    // 8.1. Pedido del personal con «Pagar ahora»: permiso, medio, «con cuánto paga» (efectivo) y caja abierta, antes de crear nada
    const cobroAhora = personal && origen?.pagoPersonal?.modo === 'AHORA' ? await this.validarCobroAhoraPersonal(origen, totalCalculado) : null;

    // 9. Comprobante (ya validado arriba) y creación en transacción
    const comprobanteTipo = tipoElegido;
    const comprobanteDoc =
      comprobanteTipo === 'FACTURA'
        ? dto.comprobante?.ruc?.trim() || null
        : comprobanteTipo === 'BOLETA'
          ? dto.comprobante?.dni?.trim() || null
          : null;

    let comprobanteRazon =
      comprobanteTipo === 'FACTURA'
        ? dto.comprobante?.razonSocial?.trim() || null
        : null;
    let comprobanteDireccion = comprobanteTipo === 'FACTURA' ? dto.comprobante?.direccion?.trim() || null : null;
    // Factura: la razón social sale de SUNAT (caché/API), no de lo que mande el navegador. Solo si la consulta no está disponible vale la manual (sin verificar).
    let comprobanteRazonVerificada: boolean | null = null;
    if (comprobanteTipo === 'FACTURA' && this.rucService && rucValido(comprobanteDoc)) {
      try {
        const sunat = await this.rucService.consultar(comprobanteDoc!);
        comprobanteRazon = sunat.razon_social;
        comprobanteDireccion = sunat.direccion ?? comprobanteDireccion;
        comprobanteRazonVerificada = true;
      } catch (e: any) {
        const codigo = e?.getResponse?.()?.codigo;
        if (codigo === 'RUC_NO_ENCONTRADO') {
          throw new BadRequestException({ codigo: 'RUC_NO_ENCONTRADO', mensaje: 'SUNAT no reconoce este RUC. Revísalo para pedir factura' });
        }
        comprobanteRazonVerificada = false; // RUC_NO_DISPONIBLE u otro fallo: sigue con la razón manual, Caja la revisa
      }
    }

    // Nunca se rechaza una venta por el DNI: una boleta mayor a S/ 700 sin DNI se crea y el cobro la exige.

    let agotadosPorVenta: bigint[] = [];
    let saboresAgotadosPorVenta: bigint[] = [];
    let totalFinal = 0;
    const pedidoCreado = await this.prisma.$transaction(async (tx) => {
      // Generación del código correlativo CP-W###
      let codigo: string;
      try {
        const rawRes: any = await tx.$queryRaw`SELECT nextval('sec_pedido_codigo') as nextval`;
        const val = rawRes?.[0]?.nextval ? Number(rawRes[0].nextval) : 1;
        codigo = `CP-W${String(val).padStart(3, '0')}`;
      } catch {
        const sec = await tx.secuenciaPedido.upsert({
          where: { nombre: 'carta' },
          update: { ultimo: { increment: 1 } },
          create: { nombre: 'carta', ultimo: 1 },
        });
        codigo = `CP-W${String(sec.ultimo).padStart(3, '0')}`;
      }

      const mozoPartyId = origen?.usuarioPartyId ? BigInt(origen.usuarioPartyId) : null;
      const mesaNombreFinal = dto.modalidad === 'COMER_LOCAL' ? null : origen?.mesaNombre || dto.mesa || null;

      const pedido = await tx.pedido.create({
        data: {
          codigo,
          canal: origen?.canal || 'CARTA',
          modalidad: dto.modalidad,
          estado: 'COLA',
          party_id: mozoPartyId ?? (origen?.clientePartyId ? BigInt(origen.clientePartyId) : null),
          cliente_party_id: clienteFinal,
          cliente_nombre: clienteNombre,
          // el relleno 999999999 no es un teléfono: el pedido queda sin teléfono (no recibe WhatsApp)
          cliente_telefono: tieneTelefonoReal(telefonoLimpio) ? telefonoLimpio : null,
          mesa_nombre: mesaNombreFinal,
          entrega_direccion: entrega?.direccion?.trim() || null,
          entrega_referencia: entrega?.referencia?.trim() || null,
          entrega_lat: entrega?.lat != null ? new Prisma.Decimal(entrega.lat) : null,
          entrega_lng: entrega?.lng != null ? new Prisma.Decimal(entrega.lng) : null,
          entrega_origen: entregaOrigen,
          zona_id: zonaId,
          pago_metodo: personal ? 'CREDITO_PERSONAL' : planPago ? this.pagoPlan.pagoPrincipal(planPago) : dto.pago.metodo,
          pago_estado: personal ? 'PAGADO' : 'PENDIENTE',
          pago_preferido: planPago ? this.pagoPlan.pagoPrincipal(planPago) : dto.pago.metodo,
          paga_con:
            dto.pago.pagaCon != null && montoEfectivo > 0 ? new Prisma.Decimal(dto.pago.pagaCon) : null,
          subtotal: new Prisma.Decimal(subtotalCalculado),
          descuento: new Prisma.Decimal(descuentoAplicado),
          envio: envio !== null ? new Prisma.Decimal(envio) : null,
          total: new Prisma.Decimal(totalCalculado),
          propina: new Prisma.Decimal(propinaPedido),
          oferta_id: desgloseDescuento.ofertaId
            ? BigInt(desgloseDescuento.ofertaId)
            : (lineasCalculadas.find((l) => l.ofertaId)?.ofertaId ?? null),
          cupon_id: desgloseDescuento.cuponId ? BigInt(desgloseDescuento.cuponId) : null,
          cupon_emitido_id: desgloseDescuento.cuponEmitidoId ? BigInt(desgloseDescuento.cuponEmitidoId) : null,
          descuento_detalle: detallesDescuento.length > 0 ? (detallesDescuento as any) : undefined,
          comprobante_tipo: comprobanteTipo,
          comprobante_doc: comprobanteDoc,
          comprobante_razon: comprobanteRazon,
          comprobante_direccion: comprobanteDireccion,
          comprobante_razon_verificada: comprobanteRazonVerificada,
          nota: dto.nota?.trim() || null,
          pedido_origen_id: origen?.pedidoOrigenId !== undefined ? BigInt(origen.pedidoOrigenId) : null,
          es_personal: personal,
          clave_idempotencia: claveIdempotencia,
          pasa_cocina_en: new Date(),
        },
      });

      if (planPago) {
        await this.pagoPlan.guardar(tx, pedido.id, planPago);
      }

      // Lo consumido por el personal se acumula en su cuenta en la misma transacción (el total ya lleva su descuento)
      if (colaboradorId !== null) {
        // «Pagar ahora»: el consumo nace COBRADO (quién, cuándo, medio) y, en efectivo, entra a la caja abierta; todo en esta
        // transacción: si algo falla no queda pedido a medias
        let movimientoCajaId: bigint | null = null;
        if (cobroAhora) {
          if (cobroAhora.medio === 'EFECTIVO' && totalCalculado > 0) {
            const caja = await tx.caja.findFirst({ where: { estado: 'ABIERTA' } });
            if (!caja) throw new ConflictException({ codigo: 'CAJA_CERRADA', mensaje: 'Abre la caja para recibir el pago en efectivo' });
            const mov = await tx.movimientoCaja.create({
              data: { caja_id: caja.id, tipo: 'INGRESO', monto: totalCalculado, motivo: `Pago de crédito del personal · ${pedido.codigo}`.slice(0, 250) },
            });
            movimientoCajaId = mov.id;
          }
        }
        await tx.consumoPersonal.create({
          data: {
            party_id: colaboradorId,
            pedido_id: pedido.id,
            fecha: fechaDiaLima(),
            monto: new Prisma.Decimal(totalCalculado),
            ...(cobroAhora
              ? {
                  pagado_en: new Date(),
                  pagado_por: mozoPartyId,
                  pago_modo: 'CAJA',
                  pago_medio: cobroAhora.medio,
                  pago_motivo:
                    cobroAhora.medio === 'EFECTIVO'
                      ? `Cobrado al instante · paga con S/ ${cobroAhora.pagaCon.toFixed(2)} · vuelto S/ ${(cobroAhora.pagaCon - totalCalculado).toFixed(2)}`
                      : 'Cobrado al instante',
                  movimiento_caja_id: movimientoCajaId,
                }
              : {}),
          },
        });
      }

      // Dirección de delivery del cliente con cuenta: se guarda o se suma un uso (misma transacción)
      if (dto.modalidad === 'DELIVERY' && clienteFinal && this.direcciones) {
        const origenDireccion = canalPedido === 'CARTA' ? 'CARTA' : canalPedido === 'WHATSAPP' || canalPedido === 'BOT' ? 'WHATSAPP' : 'MOZO';
        await this.direcciones.registrarUso(
          clienteFinal,
          {
            direccion: entrega?.direccion,
            referencia: entrega?.referencia,
            lat: entrega?.lat,
            lng: entrega?.lng,
            zonaId,
          },
          origenDireccion,
          tx,
        );
      }

      await this.escribirLineasPedido(tx, pedido.id, lineasCalculadas, clienteNombre, origen);

      // Productos que controlan stock: se descuentan ya (todos los canales) y el tope corta el pedido entero
      const ventaProductos = await this.descontarStockLineas(tx, pedido.id, pedido.party_id ?? BigInt(1), lineasCalculadas);
      agotadosPorVenta = ventaProductos.agotados;
      saboresAgotadosPorVenta = ventaProductos.saboresAgotados;

      // Historial de estado inicial
      await tx.pedidoEstadoHistorial.create({
        data: {
          pedido_id: pedido.id,
          estado_anterior: null,
          estado_nuevo: 'COLA',
          motivo:
            origen?.pedidoOrigenId !== undefined
              ? 'Pedido extra enlazado a otro pedido'
              : origen?.canal === 'MOZO'
              ? 'Pedido abierto por el mozo'
              : origen?.canal === 'WHATSAPP' || origen?.canal === 'BOT'
                ? 'Pedido creado desde WhatsApp'
                : 'Pedido creado desde la carta virtual',
          por_party_id: mozoPartyId,
        },
      });

      if (origen?.mesasIds && origen.mesasIds.length > 0 && !origen.enTransaccion) {
        for (const mesaId of origen.mesasIds) {
          await tx.pedidoMesa.create({
            data: {
              pedido_id: pedido.id,
              mesa_id: BigInt(mesaId),
              mesa_nombre: mesaNombreFinal,
              abierta: true,
            },
          });
        }
      }

      if (origen?.enTransaccion) {
        await origen.enTransaccion(tx, pedido);
      }

      // Actualizar canje o uso de cupones u ofertas si aplicó
      if (desgloseDescuento.cuponEmitidoId) {
        // Condicional: dos pedidos a la vez no pueden gastar el mismo cupón emitido
        const gastado = await tx.cuponEmitido.updateMany({
          where: { id: BigInt(desgloseDescuento.cuponEmitidoId), estado: { not: 'CANJEADO' } },
          data: {
            estado: 'CANJEADO',
            canjeado_en: new Date(),
            pedido_canje_id: pedido.id,
          },
        });
        if (gastado.count === 0) {
          throw new ConflictException({ codigo: 'CUPON_YA_CANJEADO', mensaje: 'Este cupón ya fue canjeado' });
        }
      } else if (desgloseDescuento.cuponId) {
        await tx.cupon.update({
          where: { id: BigInt(desgloseDescuento.cuponId) },
          data: { usos_actuales: { increment: 1 } },
        });
        await tx.cuponCanjeCompartido.create({
          data: {
            cupon_id: BigInt(desgloseDescuento.cuponId),
            pedido_id: pedido.id,
            party_id: clienteFinal,
          },
        });
      }

      if (desgloseDescuento.ofertaId) {
        await tx.oferta.update({
          where: { id: BigInt(desgloseDescuento.ofertaId) },
          data: { usos_actuales: { increment: 1 } },
        });
      }
      // Envío gratis por promo: cuenta un uso solo si de verdad dejó el envío en 0
      if (envioPromo) {
        await tx.oferta.update({
          where: { id: BigInt(envioPromo.id) },
          data: { usos_actuales: { increment: 1 } },
        });
      }

      // Aviso al cliente de la carta virtual: se encola en la misma transacción que el pedido
      if ((origen?.canal ?? 'CARTA') === 'CARTA' && this.avisosPedidoService) {
        await this.avisosPedidoService.avisar(pedido.id, 'RECIBIDO', {}, tx);
      }
      // Aviso al equipo (nuevo pedido): también encolado en la transacción del pedido
      if (this.avisosInternosService) {
        await this.avisosInternosService.notificarNuevoPedido(pedido.id, tx);
      }

      // 9.5. Canje de puntos DENTRO de la misma transacción: si falla, se revierte todo (pedido, stock controlado,
      // cupones y puntos) en lugar de dejar un pedido ANULADO con el stock ya descontado.
      totalFinal = Number(pedido.total);
      if (puntosCanje > 0 && this.puntosService && origen?.clientePartyId) {
        await this.puntosService.canjear(origen.clientePartyId as any, puntosCanje, pedido.id, tx);
      }

      return pedido;
    });

    if (cobroAhora) {
      try {
        await this.auditoria?.registrar({
          categoria: 'CAMBIO',
          modulo: 'creditos',
          accion: 'CREDITO_PERSONAL_COBRADO_AHORA',
          resultado: 'OK',
          entidad: 'pedido',
          entidadId: pedidoCreado.id,
          partyId: origen?.usuarioPartyId !== undefined ? BigInt(origen.usuarioPartyId) : undefined,
          despues: {
            cobradoPor: origen?.usuarioPartyId?.toString() ?? null,
            trabajador: origen?.clientePartyId?.toString() ?? null,
            pedido: pedidoCreado.codigo,
            medio: cobroAhora.medio,
            monto: totalFinal,
            ...(cobroAhora.medio === 'EFECTIVO' ? { pagaCon: cobroAhora.pagaCon, vuelto: Number((cobroAhora.pagaCon - totalFinal).toFixed(2)) } : {}),
          },
        });
      } catch {
        // el cobro ya quedó registrado en el consumo (quién y cuándo); la auditoría no deshace el pedido
      }
    }

    // Pedido del personal: nace PAGADO y no pasa por el cobro de Caja (que es quien descuenta los insumos por receta).
    // Lo consumido sale del almacén igual; idempotente, y si falla no deshace el pedido.
    if (personal) {
      try {
        await this.stockService?.descontarPorPedido(pedidoCreado.id);
      } catch {
        // el consumo del personal se puede regularizar con el descuento por receta
      }
    }

    // Productos que esta venta dejó agotados: aviso al equipo y carta al día (fuera de la transacción)
    if (agotadosPorVenta.length > 0 || saboresAgotadosPorVenta.length > 0) {
      for (const pid of agotadosPorVenta) {
        this.avisosInternosService?.notificarElementoAgotado('PRODUCTO', pid).catch(() => {});
      }
      for (const sid of saboresAgotadosPorVenta) {
        this.avisosInternosService?.notificarElementoAgotado('SABOR', sid).catch(() => {});
      }
      const agotadosAhora = await this.prisma.producto.findMany({
        where: { agotado_hasta: { gt: new Date() } },
        select: { id: true },
      });
      const saboresAhora = await this.prisma.sabor.findMany({
        where: { agotado_hasta: { gt: new Date() } },
        select: { id: true },
      });
      this.eventosGateway?.emitirAdmin('stock:cambio', {});
      this.eventosGateway?.emitirAdmin('carta:disponibilidad', {
        productos: agotadosAhora.map((p) => p.id.toString()),
        sabores: saboresAhora.map((sb) => sb.id.toString()),
        opciones: [],
        productoIds: agotadosAhora.map((p) => p.id.toString()),
        saborIds: saboresAhora.map((sb) => sb.id.toString()),
        opcionIds: [],
      });
    }

    // 10. Emitir evento en tiempo real por WebSocket
    try {
      this.eventosGateway.emitirAdmin('pedido:nuevo', {
        id: pedidoCreado.id.toString(),
        codigo: pedidoCreado.codigo,
        estado: pedidoCreado.estado,
      });
    } catch {
      // Ignorar si el servidor de websocket no está listo en pruebas
    }

    // 10.1. Aviso en la campana: cada pedido nuevo (carta, mozo o WhatsApp) es su propia notificación
    try {
      const avisoPedido = await this.prisma.notificacion.create({
        data: {
          tipo: 'PEDIDO_NUEVO',
          rol_destino: null,
          titulo: `Pedido nuevo ${pedidoCreado.codigo}`,
          mensaje: `${pedidoCreado.canal} · ${pedidoCreado.modalidad} · S/ ${Number(pedidoCreado.total).toFixed(2)}`,
          enlace: `/admin/caja?pedido=${pedidoCreado.id}`,
        },
      });
      this.eventosGateway.emitirAdmin('notificaciones:nueva', {
        id: avisoPedido.id.toString(),
        titulo: avisoPedido.titulo,
      });
    } catch {
      // Un fallo del aviso no debe deshacer un pedido ya creado
    }

    // 10.5. Envío de los avisos encolados en la transacción del pedido (tras el commit)
    this.avisosInternosService?.despertarOutbox();

    // 10.6. Envío del aviso RECIBIDO encolado en la transacción del pedido (tras el commit)
    if ((origen?.canal ?? 'CARTA') === 'CARTA' && this.avisosPedidoService) {
      this.avisosPedidoService.despertar();
    }

    // 11. Respuesta 201
    return {
      id: pedidoCreado.id.toString(),
      codigo: pedidoCreado.codigo,
      estado: pedidoCreado.estado,
      seguimientoToken: generarTokenSeguimiento(pedidoCreado.id),
      subtotal: Number(pedidoCreado.subtotal),
      descuento: Number(pedidoCreado.descuento || 0),
      envio: pedidoCreado.envio !== null ? Number(pedidoCreado.envio) : null,
      total: totalFinal,
      propina: propinaPedido,
      puntosCanjeados: puntosCanje,
      mensaje:
        origen?.canal === 'MOZO'
          ? 'Pedido enviado a cocina'
          : origen?.canal === 'WHATSAPP' || origen?.canal === 'BOT'
            ? 'Pedido enviado a cocina'
            : 'Un asesor te escribirá para coordinar el pago',
    };
  }

  /**
   * Cambia el estado de un pedido (expuesto para compatibilidad de contrato con otros módulos).
   */
  async cambiarEstado(
    id: bigint | string | number,
    nuevoEstado: string,
    usuario?: UsuarioAutenticado,
    motivo?: string,
  ) {
    const pedidoId = BigInt(id);
    const pedido = await this.prisma.pedido.findUnique({
      where: { id: pedidoId },
    });

    if (!pedido) {
      throw new NotFoundException({
        codigo: 'PEDIDO_NO_ENCONTRADO',
        mensaje: 'Pedido no encontrado',
      });
    }

    const actualizado = await this.prisma.pedido.update({
      where: { id: pedidoId },
      data: { estado: nuevoEstado },
    });

    await this.prisma.pedidoEstadoHistorial.create({
      data: {
        pedido_id: pedidoId,
        estado_anterior: pedido.estado,
        estado_nuevo: nuevoEstado,
        motivo: motivo || null,
        por_party_id: usuario?.partyId || null,
      },
    });

    try {
      this.eventosGateway.emitirAdmin('pedido:estado', {
        id: pedidoId.toString(),
        codigo: actualizado.codigo,
        estado: nuevoEstado,
      });
    } catch {
      // Silencioso en testing
    }

    return actualizado;
  }
}
