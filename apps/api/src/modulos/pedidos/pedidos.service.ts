import { montoElegiblePuntos } from '../ofertas/puntos-elegibles.util';
import { PuntosService } from '../clientes/puntos.service';
import { DireccionesClienteService } from '../clientes/direcciones-cliente.service';
import {
  BadRequestException,
  ConflictException,
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
import { calcularEnvioFinal } from '@caprichos/compartido';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { LocalService } from '../local/local.service';
import { ZonasService } from '../zonas/zonas.service';
import { leerReglaEnvioGratis } from '../zonas/envio-gratis';
import { OfertasService } from '../ofertas/ofertas.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { CrearPedidoDto } from './dto/crear-pedido.dto';
import { generarTokenSeguimiento } from './seguimiento.tokens';
import { AvisosInternosService } from '../chatbot/avisos-internos/avisos-internos.service';
import { AvisosPedidoService } from '../chatbot/servicios/avisos-pedido.service';
import { TELEFONO_PLACEHOLDER, tieneTelefonoReal } from '../chatbot/utilidades/enmascarar.util';
import { PagoPlanService } from './pago-plan.service';
import { PartyPuntosService } from '../clientes/party-puntos.service';
import { ComprobanteDefectoService } from '../comprobantes/comprobante-defecto.service';
import { tipoComprobanteEfectivo } from '../comprobantes/comprobante-defecto';
import { invitadoCartaPermitido } from '../clientes/invitado-carta';
import { Cumpleanos, exigirCumpleanos } from '../clientes/cumpleanos.util';

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
  mesasIds?: (bigint | string | number)[];
  mesaNombre?: string;
  omitirChequeoCarta?: boolean;
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
    @Optional() private readonly defectoComprobante?: ComprobanteDefectoService,
  ) {}

  /**
   * Cliente con cuenta del pedido: celular (solo MOZO/CAJA), cuenta de la carta o teléfono de WhatsApp.
   * Null = invitado. Un clienteTelefono de carta o WhatsApp se ignora.
   */
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

    // 2. Comprobar que la carta esté abierta y sin pausa (omitido si es MOZO o se indica explícitamente)
    const omitirCarta =
      origen?.canal === 'MOZO' ||
      origen?.canal === 'CAJA' ||
      origen?.omitirChequeoCarta === true;
    if (!omitirCarta) {
      const estadoCarta = await this.localService.obtenerEstadoCarta();
      if (!estadoCarta.abierta) {
        throw new HttpException(
          { codigo: 'CARTA_CERRADA', mensaje: estadoCarta.texto },
          HttpStatus.CONFLICT,
        );
      }
    }

    // 3. Validar datos de cliente (opcional para pedidos de mozo/caja en panel admin)
    const esMozo =
      origen?.canal === 'MOZO' ||
      origen?.canal === 'CAJA' ||
      origen?.omitirChequeoCarta === true;
    let clienteNombre: string | null = null;
    let telefonoLimpio: string | null = null;
    let cumpleCliente: Cumpleanos | null = null;

    if (esMozo) {
      clienteNombre =
        dto.cliente?.nombre?.trim() ||
        origen?.mesaNombre ||
        (dto.mesa ? `Mesa ${dto.mesa}` : 'Mesa');
      telefonoLimpio = dto.cliente?.telefono?.trim() || null;
      if (telefonoLimpio && !/^9\d{8}$/.test(telefonoLimpio)) {
        throw new BadRequestException({
          codigo: 'TELEFONO_INVALIDO',
          mensaje: 'El teléfono debe tener 9 dígitos y empezar con 9',
        });
      }
    } else {
      if (!dto.cliente?.nombre || dto.cliente.nombre.trim().length === 0) {
        throw new BadRequestException({
          codigo: 'CLIENTE_INVALIDO',
          mensaje: 'El nombre del cliente es obligatorio',
        });
      }

      telefonoLimpio = dto.cliente?.telefono?.trim() || null;
      const celularValido = !!telefonoLimpio && /^9\d{8}$/.test(telefonoLimpio) && telefonoLimpio !== TELEFONO_PLACEHOLDER;
      const esCartaSinSesion = (origen?.canal ?? 'CARTA') === 'CARTA' && !origen?.clientePartyId && !origen?.sinCuentaCliente;
      if (esCartaSinSesion && !celularValido && !(await invitadoCartaPermitido(this.prisma))) {
        throw new BadRequestException({
          codigo: 'CELULAR_REQUERIDO',
          mensaje: 'Escribe tu celular para hacer tu pedido y sumar puntos',
        });
      }
      if (telefonoLimpio && !/^9\d{8}$/.test(telefonoLimpio)) {
        throw new BadRequestException({
          codigo: 'TELEFONO_INVALIDO',
          mensaje: 'El teléfono debe tener 9 dígitos y empezar con 9',
        });
      }
      if (!telefonoLimpio && !esCartaSinSesion) {
        throw new BadRequestException({
          codigo: 'TELEFONO_INVALIDO',
          mensaje: 'El teléfono debe tener 9 dígitos y empezar con 9',
        });
      }
      clienteNombre = dto.cliente.nombre.trim();
      // Alta de cliente por celular desde la carta sin sesión: nombre (2+ letras) y cumpleaños obligatorios
      if (esCartaSinSesion && celularValido) {
        if (clienteNombre.length < 2) {
          throw new BadRequestException({ codigo: 'NOMBRE_REQUERIDO', mensaje: 'Escribe tu nombre completo para sumar puntos con tu celular.' });
        }
        cumpleCliente = exigirCumpleanos(dto.cliente.cumpleanos);
      } else if ((origen?.canal ?? 'CARTA') === 'CARTA' && dto.cliente?.cumpleanos) {
        cumpleCliente = exigirCumpleanos(dto.cliente.cumpleanos);
      }
    }

    // 4. Validar comprobante (sin tipo elegido, el efectivo se decide con el total, más abajo)
    const tipoElegido = dto.comprobante?.tipo;
    if (tipoElegido === 'FACTURA') {
      const ruc = dto.comprobante?.ruc?.trim();
      const razonSocial = dto.comprobante?.razonSocial?.trim();
      if (!ruc || !/^\d{11}$/.test(ruc) || !razonSocial || razonSocial.length === 0) {
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

    const productoIds = dto.lineas.map((l) => BigInt(l.productoId));
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
      },
    });

    const ahora = new Date();
    const lineasCalculadas: any[] = [];
    let subtotalCalculado = 0;

    for (let i = 0; i < dto.lineas.length; i++) {
      const l = dto.lineas[i];
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
          },
          HttpStatus.CONFLICT,
        );
      }

      const cantidad = Math.max(1, Math.floor(Number(l.cantidad) || 1));

      // Determinar precio base y tamaño
      let precioBase = 0;
      let tamanoNombre: string | null = null;

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
      } else {
        precioBase = Number(prodDb.precio);
      }

      // Validar grupos y opciones del producto
      const gruposActivos = prodDb.grupos
        .map((pg) => pg.grupo)
        .filter((g) => g.activo);

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

      // Validar reglas por cada grupo (obligatorio, mínimo, máximo)
      for (const grupo of gruposActivos) {
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
      );
      const precioUnitario = Number((precioBase + sumaExtras).toFixed(2));
      const lineaSubtotal = Number((precioUnitario * cantidad).toFixed(2));
      subtotalCalculado += lineaSubtotal;

      // Bebidas llevan personas[] con tantos nombres como unidades
      const catNombre = (prodDb.categoria?.nombre || '').toUpperCase();
      const areaNombre = (prodDb.categoria?.area?.nombre || '').toUpperCase();
      const esBebida =
        catNombre.includes('FRAPPE') ||
        catNombre.includes('ICED') ||
        catNombre.includes('FROZEN') ||
        catNombre.includes('CALIENTE') ||
        catNombre.includes('BEBIDA') ||
        areaNombre.includes('BARRA') ||
        areaNombre.includes('BEBIDA');

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

      // Combo con parte fija: la elección debe ser el principal o un reemplazo disponible (409 si no)
      const notaCombo =
        l.ofertaId && l.comboElecciones?.length
          ? await this.ofertasService.validarEleccionesCombo(l.ofertaId, l.comboElecciones)
          : '';

      lineasCalculadas.push({
        productoId: prodDb.id,
        ofertaId: l.ofertaId ? BigInt(l.ofertaId) : null,
        categoriaId: prodDb.categoria_id,
        noSumaBeneficios: prodDb.no_suma_beneficios,
        nombre: prodDb.nombre,
        tamano: tamanoNombre,
        cantidad,
        precioUnitario,
        subtotal: lineaSubtotal,
        areaId: prodDb.categoria?.area_id ?? null,
        nota: [notaCombo, l.nota?.trim()].filter(Boolean).join(' · ') || null,
        nombresPersona: personasAsignadas,
        opciones: opcionesElegidasInfo,
      });
    }

    subtotalCalculado = Number(subtotalCalculado.toFixed(2));

    // 5.0. Cliente con cuenta identificado (suma puntos, historial y direcciones)
    const clienteFinal = await this.clienteIdentificado(dto, origen);
    // Carta con cuenta o celular: completa nombre y cumpleaños solo si el cliente aún no los tiene
    if (cumpleCliente && clienteFinal && this.puntosParty) {
      await this.puntosParty.completarDatos(clienteFinal, { nombre: clienteNombre ?? undefined, cumple: cumpleCliente });
    }
    // Cliente con cuenta de mozo/caja: si el pedido no trae nombre o teléfono propios, se toman de su cuenta
    if (esMozo && clienteFinal && this.direcciones) {
      const cuenta = await this.direcciones.datosCuentaActiva(clienteFinal);
      if (cuenta) {
        if (!dto.cliente?.nombre?.trim()) clienteNombre = cuenta.nombre;
        telefonoLimpio = telefonoLimpio || cuenta.telefono;
      }
    }

    // 5.1. Calcular descuento (oferta/cupón según reglas de acumulación) en el servidor
    const canalPedido = origen?.canal || 'CARTA';
    const desgloseDescuento = await this.ofertasService.calcularDescuentosParaPedido({
      subtotal: subtotalCalculado,
      lineas: lineasCalculadas.map((lin) => ({
        productoId: lin.productoId,
        categoriaId: lin.categoriaId,
        cantidad: lin.cantidad,
        subtotal: lin.subtotal,
        precioUnitario: lin.precioUnitario,
        noSumaBeneficios: lin.noSumaBeneficios,
      })),
      canal: canalPedido,
      cuponCodigo: dto.cuponCodigo,
      clientePartyId: clienteFinal,
      // Solo la carta con sesión iniciada (no WhatsApp, mozo ni celular suelto)
      clienteConSesion: canalPedido === 'CARTA' && !!origen?.clientePartyId,
    });

    const descuentoAplicado = desgloseDescuento.descuentoTotal;

    // 6. Validar pedido mínimo si está configurado
    const paramPedidoMinimo = await this.prisma.parametro.findUnique({
      where: { clave: 'pedido_minimo' },
    });
    const pedidoMinimoVal =
      typeof paramPedidoMinimo?.valor === 'number'
        ? paramPedidoMinimo.valor
        : Number(paramPedidoMinimo?.valor) || 0;

    if (pedidoMinimoVal > 0 && subtotalCalculado < pedidoMinimoVal) {
      throw new BadRequestException({
        codigo: 'PEDIDO_MINIMO',
        mensaje: `El pedido no alcanza el monto mínimo de S/ ${pedidoMinimoVal.toFixed(2)}`,
      });
    }

    // 7. Cálculo de envío (solo DELIVERY)
    let envio: number | null = 0;
    let zonaId: bigint | null = null;
    let entregaOrigen: string | null = null;

    if (dto.modalidad === 'DELIVERY') {
      const tieneCoordenadas =
        typeof dto.entrega?.lat === 'number' && typeof dto.entrega?.lng === 'number';

      if (tieneCoordenadas) {
        const lat = dto.entrega!.lat!;
        const lng = dto.entrega!.lng!;

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

        const reglaEnvio = await leerReglaEnvioGratis(this.prisma);
        envio = calcularEnvioFinal(subtotalCalculado, zonaDetectada.tarifa, reglaEnvio);

        entregaOrigen = dto.entrega?.origen || 'GPS';
      } else if (
        dto.entrega?.direccion &&
        dto.entrega.direccion.trim().length >= 5
      ) {
        // Sin punto, solo dirección escrita de al menos 5 caracteres -> envío null («por calcular»)
        envio = null;
        zonaId = null;
        entregaOrigen = 'ESCRITA';
      } else {
        throw new BadRequestException({
          codigo: 'UBICACION_REQUERIDA',
          mensaje:
            'Para delivery se requiere ubicación en el mapa o una dirección escrita de al menos 5 caracteres',
        });
      }
    } else {
      // RECOGER o MESA
      envio = 0;
      zonaId = null;
      entregaOrigen = null;
    }

    // canje de puntos (DT-55): solo con cuenta, sin cupón y hasta el monto de los productos
    const puntosCanje = Number(Number(dto.puntosCanje || 0).toFixed(2));
    if (puntosCanje > 0) {
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

    const totalCalculado = Number(Math.max(0, subtotalCalculado - descuentoAplicado + (envio ?? 0)).toFixed(2));

    // 8. Validación de pago (con plan: el efectivo se compara contra su parte, no contra el total)
    const planPago = this.pagoPlan.validar(dto.pago.plan, totalCalculado);
    const montoEfectivo = planPago
      ? this.pagoPlan.montoEfectivo(planPago)
      : dto.pago.metodo === 'EFECTIVO'
        ? totalCalculado
        : 0;
    if (dto.pago.pagaCon !== undefined && montoEfectivo > 0 && Number(dto.pago.pagaCon) < montoEfectivo) {
      throw new BadRequestException({
        codigo: 'PAGO_INSUFICIENTE',
        mensaje: `El monto con el que paga (S/ ${dto.pago.pagaCon}) no puede ser menor a ${planPago ? 'la parte en efectivo' : 'el total'} (S/ ${montoEfectivo})`,
      });
    }

    // 9. Comprobante efectivo (único punto del tipo por defecto) y creación en transacción
    const aplicaDefecto = tipoElegido ? false : !!(await this.defectoComprobante?.aplica());
    const comprobanteTipo = tipoComprobanteEfectivo(tipoElegido, aplicaDefecto);
    const comprobanteDoc =
      comprobanteTipo === 'FACTURA'
        ? dto.comprobante?.ruc?.trim() || null
        : comprobanteTipo === 'BOLETA'
          ? dto.comprobante?.dni?.trim() || null
          : null;

    const comprobanteRazon =
      comprobanteTipo === 'FACTURA'
        ? dto.comprobante?.razonSocial?.trim() || null
        : null;

    // Nunca se rechaza una venta por el DNI: una boleta mayor a S/ 700 sin DNI se crea y el cobro la exige.

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
      const mesaNombreFinal = origen?.mesaNombre || dto.mesa || null;

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
          entrega_direccion: dto.entrega?.direccion?.trim() || null,
          entrega_referencia: dto.entrega?.referencia?.trim() || null,
          entrega_lat: dto.entrega?.lat != null ? new Prisma.Decimal(dto.entrega.lat) : null,
          entrega_lng: dto.entrega?.lng != null ? new Prisma.Decimal(dto.entrega.lng) : null,
          entrega_origen: entregaOrigen,
          zona_id: zonaId,
          pago_metodo: planPago ? this.pagoPlan.pagoPrincipal(planPago) : dto.pago.metodo,
          pago_estado: 'PENDIENTE',
          pago_preferido: planPago ? this.pagoPlan.pagoPrincipal(planPago) : dto.pago.metodo,
          paga_con:
            dto.pago.pagaCon != null && montoEfectivo > 0 ? new Prisma.Decimal(dto.pago.pagaCon) : null,
          subtotal: new Prisma.Decimal(subtotalCalculado),
          descuento: new Prisma.Decimal(descuentoAplicado),
          envio: envio !== null ? new Prisma.Decimal(envio) : null,
          total: new Prisma.Decimal(totalCalculado),
          oferta_id: desgloseDescuento.ofertaId
            ? BigInt(desgloseDescuento.ofertaId)
            : (lineasCalculadas.find((l) => l.ofertaId)?.ofertaId ?? null),
          cupon_id: desgloseDescuento.cuponId ? BigInt(desgloseDescuento.cuponId) : null,
          cupon_emitido_id: desgloseDescuento.cuponEmitidoId ? BigInt(desgloseDescuento.cuponEmitidoId) : null,
          descuento_detalle: desgloseDescuento.detalles.length > 0 ? (desgloseDescuento.detalles as any) : undefined,
          comprobante_tipo: comprobanteTipo,
          comprobante_doc: comprobanteDoc,
          comprobante_razon: comprobanteRazon,
          comprobante_direccion: comprobanteTipo === 'FACTURA' ? dto.comprobante?.direccion?.trim() || null : null,
          nota: dto.nota?.trim() || null,
          es_personal: Boolean(origen?.esPersonal),
          clave_idempotencia: claveIdempotencia,
          pasa_cocina_en: new Date(),
        },
      });

      if (planPago) {
        await this.pagoPlan.guardar(tx, pedido.id, planPago);
      }

      // Dirección de delivery del cliente con cuenta: se guarda o se suma un uso (misma transacción)
      if (dto.modalidad === 'DELIVERY' && clienteFinal && this.direcciones) {
        const origenDireccion = canalPedido === 'CARTA' ? 'CARTA' : canalPedido === 'WHATSAPP' || canalPedido === 'BOT' ? 'WHATSAPP' : 'MOZO';
        await this.direcciones.registrarUso(
          clienteFinal,
          {
            direccion: dto.entrega?.direccion,
            referencia: dto.entrega?.referencia,
            lat: dto.entrega?.lat,
            lng: dto.entrega?.lng,
            zonaId,
          },
          origenDireccion,
          tx,
        );
      }

      // Crear líneas y opciones
      for (const lin of lineasCalculadas) {
        const lineaDb = await tx.pedidoLinea.create({
          data: {
            pedido_id: pedido.id,
            producto_id: lin.productoId,
            oferta_id: lin.ofertaId ?? null,
            nombre: lin.nombre,
            tamano: lin.tamano,
            cantidad: lin.cantidad,
            precio_unit: new Prisma.Decimal(lin.precioUnitario),
            subtotal: new Prisma.Decimal(lin.subtotal),
            area_id: lin.areaId,
            nombres_persona: lin.nombresPersona,
            nota: lin.nota,
            opciones: lin.opciones.map((o: any) => ({
              id: o.id.toString(),
              nombre: o.nombre,
              precio_extra: o.precio_extra,
              grupo: o.grupo_nombre,
            })),
          },
        });

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
      }

      // Historial de estado inicial
      await tx.pedidoEstadoHistorial.create({
        data: {
          pedido_id: pedido.id,
          estado_anterior: null,
          estado_nuevo: 'COLA',
          motivo:
            origen?.canal === 'MOZO'
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
        await tx.cuponEmitido.update({
          where: { id: BigInt(desgloseDescuento.cuponEmitidoId) },
          data: {
            estado: 'CANJEADO',
            canjeado_en: new Date(),
            pedido_canje_id: pedido.id,
          },
        });
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

      // Aviso al cliente de la carta virtual: se encola en la misma transacción que el pedido
      if ((origen?.canal ?? 'CARTA') === 'CARTA' && this.avisosPedidoService) {
        await this.avisosPedidoService.avisar(pedido.id, 'RECIBIDO', {}, tx);
      }
      // Aviso al equipo (nuevo pedido): también encolado en la transacción del pedido
      if (this.avisosInternosService) {
        await this.avisosInternosService.notificarNuevoPedido(pedido.id, tx);
      }

      return pedido;
    });

    // 9.5. Canje de puntos: se descuenta del saldo y del total del pedido
    let totalFinal = Number(pedidoCreado.total);
    if (puntosCanje > 0 && this.puntosService && origen?.clientePartyId) {
      try {
        await this.puntosService.canjear(origen.clientePartyId as any, puntosCanje, pedidoCreado.id);
        totalFinal = Number(Math.max(0, totalFinal - puntosCanje).toFixed(2));
        await this.prisma.pedido.update({
          where: { id: pedidoCreado.id },
          data: { total: new Prisma.Decimal(totalFinal) },
        });
      } catch (err) {
        await this.prisma.pedido.update({
          where: { id: pedidoCreado.id },
          data: { estado: 'ANULADO', motivo_anulacion: 'Canje de puntos rechazado' },
        });
        throw err;
      }
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
          enlace: '/admin/pedidos',
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
