import {
  EntradaNormalizada,
  FlujoConversacion,
  ContextoConversacion,
  ResultadoTransicion,
  AccionMensaje,
  AccionEnviarLista,
  BotonAccion,
  FilaLista,
} from '../../tipos-conversacion';
import { normalizarPropina } from '../../../../propinas/propinas.util';
import { SubFlujoConversacion, RegistroSubFlujos } from '../registro-flujos';
import {
  EstadoPedidoFlujo,
  EstadoCarritoPedido,
  LineaCarritoBot,
  ItemEnConfiguracionBot,
} from './tipos-pedido';
import { avisoStock } from '@caprichos/compartido';
import { lineaAvisoStock, lineasAvisoResumen, umbralesDe } from './aviso-stock-bot.util';
import { ordenarPorVentas, tarjetaProducto, accionesPaginaCarrusel as accionesPaginaCarruselGenerica } from '../../../servicios/carrusel.util';
import {
  TEXTOS_BOT,
  BOTON_VOLVER_MENU,
  BOTON_HABLAR_PERSONA,
  BOTONES_PEDIDO_MODALIDAD,
  BOTONES_PEDIDO_UBICACION,
  BOTONES_PEDIDO_UBICACION_FALLIDA,
  BOTONES_PEDIDO_ACCION_CARRITO,
  BOTONES_PEDIDO_VER_CARRITO,
  BOTONES_PEDIDO_NOMBRE_CONFIRMAR,
  BOTONES_PEDIDO_COMPROBANTE,
  BOTONES_PEDIDO_CONFIRMAR_FINAL,
  BOTONES_PEDIDO_PROPINA,
  BOTONES_PEDIDO_CANCELAR_CONFIRMAR,
  BOTONES_PEDIDO_NOTAS,
  BOTONES_PEDIDO_CANTIDADES,
  BOTONES_PEDIDO_NOMBRES_ENVASE,
  BOTONES_PEDIDO_TELEFONO,
} from '../../textos-bot';
import {
  NOMBRE_MEDIO,
  botonesEfectivo,
  calcularTotales,
  mediosActivos,
  medioPrincipal,
  opcionesMedios,
  parsearMonto,
  textoPago,
} from './pago-bot.util';
import { MedioPagoBot } from './tipos-pedido';
import { celularPuntosEnmascarado } from '../../../utilidades/enmascarar.util';

const PALABRAS_PEDIDO = [
  'pedir',
  'hacer pedido',
  'hacer un pedido',
  'ordenar',
  'comprar',
  'quiero pedir',
  'quisiera pedir',
  'me das',
  'me regalas',
];

const PALABRAS_CANCELAR = [
  'cancelar',
  'cancela',
  'anular',
  'ya no quiero',
  'cancelar pedido',
  'descartar',
];

/**
 * Estados de dirección que ya no existen (conversaciones abiertas antes de quitar las direcciones anteriores
 * y la referencia aparte): siguen por la ubicación, para que nadie quede atascado.
 */
const ESTADOS_UBICACION_LEGADOS: string[] = ['PEDIDO_DIRECCION_ELEGIR', 'PEDIDO_DIRECCION_TEXTO', 'PEDIDO_REFERENCIA'];

function normalizarEstadoUbicacion(estado: EstadoPedidoFlujo): EstadoPedidoFlujo {
  return ESTADOS_UBICACION_LEGADOS.includes(estado) ? 'PEDIDO_UBICACION' : estado;
}

/** Sabores que se pueden pedir ahora: disponibles y sin agotar (quedan null = producto sin control de stock, no bloquea). */
function saboresPedibles(prod: any): any[] {
  return (prod?.sabores || []).filter((s: any) => s.disponible === true && s.quedan !== 0);
}

/** Unidades que quedan de un producto que controla stock (null: sin límite). Por sabor, la suma de sus sabores. */
function quedanDeProducto(prod: any): number | null {
  return typeof prod?.quedan === 'number' ? prod.quedan : null;
}

/**
 * Tamaños que caben en lo que queda (1/2 docena = 6, docena = 12). Con stock por sabor, una línea lleva un solo sabor:
 * el tamaño cabe si algún sabor pedible tiene esas unidades. Sin límite, todos.
 */
function tamanosQueCaben(prod: any): any[] {
  const tamanos = prod?.tamanos || [];
  const quedan = quedanDeProducto(prod);
  return tamanos.filter((t: any) => {
    const unidades = unidadesDeTamano(prod, String(t.id));
    if (quedan !== null && unidades > quedan) return false;
    return prod?.saboresConStock !== true || saboresQueCaben(prod, unidades).length > 0;
  });
}

/** Sabores pedibles que tienen las unidades de la línea (el saldo de cada sabor es su tope). */
function saboresQueCaben(prod: any, unidades: number): any[] {
  return saboresPedibles(prod).filter((s: any) => typeof s.quedan !== 'number' || s.quedan >= unidades);
}

/** Botones 1/2/3 sin pasar de `maximo` unidades de cantidad. */
function botonesHasta(maximo: number): BotonAccion[] {
  return BOTONES_PEDIDO_CANTIDADES.filter((b) => Number(b.id.replace('ped_cant_', '')) <= Math.max(1, maximo));
}

/** Botones de cantidad para un producto: con stock, no más de lo que cabe en su tamaño. */
function botonesCantidadDe(prod: any, tamanoId?: string): BotonAccion[] {
  const quedan = quedanDeProducto(prod);
  if (quedan === null) return BOTONES_PEDIDO_CANTIDADES;
  return botonesHasta(Math.floor(quedan / unidadesDeTamano(prod, tamanoId)));
}

/** No se puede pedir: agotado, con stock por sabor sin ningún sabor pedible, o sin tamaño que quepa. */
function productoAgotado(p: any): boolean {
  return (
    p.disponible === false ||
    (p.saboresConStock === true && saboresPedibles(p).length === 0) ||
    ((p.tamanos || []).length > 0 && tamanosQueCaben(p).length === 0)
  );
}

/**
 * Grupos de opciones que el bot pregunta. Con stock por sabor se omiten los obligatorios heredados
 * («Sabor» de empanadas): no se preguntan ni se exigen.
 */
function gruposDePregunta(prod: any): any[] {
  const grupos = prod?.grupos || [];
  return prod?.saboresConStock === true ? grupos.filter((g: any) => !(g.obligatorio || g.minimo > 0)) : grupos;
}

/** Unidades de un tamaño (Unidad=1, 1/2 docena=6, Docena=12). Sin tamaño o sin dato: 1. */
function unidadesDeTamano(prod: any, tamanoId?: string): number {
  const tamano = (prod?.tamanos || []).find((t: any) => String(t.id) === String(tamanoId));
  return Math.max(1, Number(tamano?.unidades) || 1);
}

function productoDeCarta(categorias: any[], productoId: string): any | null {
  for (const cat of categorias || []) {
    const p = (cat.productos || []).find((x: any) => String(x.id) === String(productoId));
    if (p) return p;
  }
  return null;
}

/** Lista de sabores que se pueden pedir con esas unidades (máx 10 filas; «Quedan N» cuando quedan 5 o menos). */
function listaSaboresStock(prod: any, texto: string, unidades = 1): AccionEnviarLista {
  return {
    tipo: 'enviarLista',
    texto,
    botonTexto: 'Elegir sabor',
    filas: saboresQueCaben(prod, unidades)
      .slice(0, 10)
      .map((s: any) => ({
        id: `ped_sab_${s.id}`,
        titulo: String(s.nombre).slice(0, 24),
        ...(typeof s.quedan === 'number' && s.quedan <= 5 ? { descripcion: `Quedan ${s.quedan}` } : {}),
      })),
  };
}

/** Detalles de una línea en el resumen: con sabor de stock sale «1/2 docena de Fresa». */
function detallesLinea(i: LineaCarritoBot): string[] {
  const opciones = i.opciones.map((o) => o.nombre);
  const saborStock = i.sabores?.[0];
  if (saborStock) {
    return [`${i.tamanoNombre ? `${i.tamanoNombre} de ` : ''}${saborStock.nombre}`, ...opciones];
  }
  return [i.tamanoNombre, ...opciones, i.sabor].filter((d): d is string => Boolean(d));
}

/**
 * El servidor rechazó la línea por SABOR_AGOTADO: esa línea sale del carrito (el resto se conserva) y el
 * cliente vuelve a la lista de sabores de ese producto. Null si no hay línea que tocar o no queda ningún sabor
 * (el ejecutor entonces vuelve al carrito como con STOCK_INSUFICIENTE).
 */
export function carritoTrasSaborAgotado(
  carrito: EstadoCarritoPedido,
  err: { productoId: string; saborId: string; saborNombre?: string },
  categorias: any[],
): { pedido: EstadoCarritoPedido; lista: AccionEnviarLista } | null {
  const idx = carrito.items.findIndex(
    (i) => i.productoId === String(err.productoId) && i.sabores?.some((s) => s.saborId === String(err.saborId)),
  );
  const prod = productoDeCarta(categorias, err.productoId);
  if (idx < 0 || !prod?.saboresConStock || saboresPedibles(prod).length === 0) return null;

  const linea = carrito.items[idx];
  const unidadesLinea = unidadesDeTamano(prod, linea.tamanoId) * linea.cantidad;
  if (saboresQueCaben(prod, unidadesLinea).length === 0) return null;
  const extras = linea.opciones.reduce((s, o) => s + o.precioExtra, 0);
  const config: ItemEnConfiguracionBot = {
    productoId: linea.productoId,
    productoNombre: linea.productoNombre,
    categoriaId: linea.categoriaId,
    categoriaNombre: linea.categoriaNombre,
    tamanoId: linea.tamanoId,
    tamanoNombre: linea.tamanoNombre,
    precioBase: Number((linea.precioUnitario - extras).toFixed(2)),
    opciones: linea.opciones,
    grupoIndexActual: (prod.grupos || []).length,
    cantidad: linea.cantidad,
    noSumaBeneficios: linea.noSumaBeneficios,
    nota: linea.nota,
  };
  const nombre = err.saborNombre || linea.sabores?.[0]?.nombre || '';
  return {
    pedido: {
      ...carrito,
      estadoInterno: 'PEDIDO_SABOR',
      items: carrito.items.filter((_, k) => k !== idx),
      itemEnConfiguracion: config,
    },
    lista: listaSaboresStock(prod, TEXTOS_BOT.pedidoSaborAgotado(nombre), unidadesLinea),
  };
}

export class FlujoPedidoSubFlujo implements SubFlujoConversacion {
  readonly nombre = 'pedido';

  puedeManejar(
    flujo: FlujoConversacion,
    entrada: EntradaNormalizada,
    _contexto: ContextoConversacion,
  ): boolean {
    const estadoStr = String(flujo.estado || '');
    if (estadoStr === 'PEDIDO' || estadoStr.startsWith('PEDIDO_')) {
      return true;
    }

    // Botones directos del flujo de pedido
    if (entrada.id?.startsWith('ped_')) {
      return true;
    }

    // Si viene de otra opción del menú, FAQ o mi pedido, no interceptar
    if (
      entrada.id === 'mi_pedido' ||
      entrada.id?.startsWith('ord_') ||
      entrada.id?.startsWith('faq_') ||
      entrada.id === 'btn_promociones' ||
      entrada.id === 'btn_carta' ||
      entrada.id === 'btn_preguntas' ||
      entrada.id === 'btn_reserva' ||
      entrada.id === 'btn_persona'
    ) {
      return false;
    }

    // No interceptar si el texto es claramente para consultar "mi pedido" o "cuánto falta"
    if (
      entrada.texto?.includes('mi pedido') ||
      entrada.texto?.includes('cuanto falta') ||
      entrada.texto?.includes('estado de mi pedido') ||
      entrada.texto?.includes('donde esta mi pedido') ||
      entrada.texto?.includes('rastreo') ||
      entrada.texto?.includes('seguimiento')
    ) {
      return false;
    }

    if (
      entrada.id === 'pedir' ||
      entrada.id === 'btn_pedido' ||
      coincideAlgunaPalabra(entrada.texto, PALABRAS_PEDIDO)
    ) {
      return true;
    }

    return false;
  }

  transicionar(
    flujoPrevio: FlujoConversacion,
    entrada: EntradaNormalizada,
    contexto: ContextoConversacion,
  ): ResultadoTransicion | null {
    const flujo: FlujoConversacion = {
      ...flujoPrevio,
    };

    // 1. Manejo de cancelación en cualquier punto del flujo
    const esComandoCancelar =
      entrada.id === 'ped_cancelar' ||
      entrada.id === 'btn_cancelar' ||
      coincideAlgunaPalabra(entrada.texto, PALABRAS_CANCELAR);

    if (esComandoCancelar && flujo.estado !== 'PEDIDO_CANCELAR_CONFIRMAR') {
      const estadoActual = (flujo.pedido?.estadoInterno || flujo.estado) as EstadoPedidoFlujo;
      const nuevoPedido: EstadoCarritoPedido = {
        ...(flujo.pedido || { estadoInterno: 'PEDIDO_MODALIDAD', items: [] }),
        estadoInterno: 'PEDIDO_CANCELAR_CONFIRMAR',
        estadoPrevioCancelacion: estadoActual,
      };

      return {
        nuevoEstado: 'PEDIDO_CANCELAR_CONFIRMAR',
        acciones: [
          {
            tipo: 'enviarBotones',
            texto: TEXTOS_BOT.pedidoConfirmarCancelar(),
            botones: BOTONES_PEDIDO_CANCELAR_CONFIRMAR,
          },
        ],
        nuevoFlujo: {
          ...flujo,
          estado: 'PEDIDO_CANCELAR_CONFIRMAR',
          pedido: nuevoPedido,
        },
      };
    }

    if (flujo.estado === 'PEDIDO_CANCELAR_CONFIRMAR') {
      if (entrada.id === 'ped_cancelar_si' || entrada.texto.includes('si')) {
        return {
          nuevoEstado: 'MENU',
          acciones: [
            {
              tipo: 'enviarBotones',
              texto: TEXTOS_BOT.pedidoCancelado(),
              botones: [BOTON_VOLVER_MENU],
            },
          ],
          nuevoFlujo: {
            ...flujo,
            estado: 'MENU',
            pedido: null,
          },
        };
      }

      // No cancelar -> restaurar estado previo
      const estadoRestaurar = flujo.pedido?.estadoPrevioCancelacion || 'PEDIDO_ACCION_CARRITO';
      const pedidoRestaurado: EstadoCarritoPedido = {
        ...(flujo.pedido as EstadoCarritoPedido),
        estadoInterno: estadoRestaurar,
      };

      return this.renderizarEstado(estadoRestaurar, flujo, pedidoRestaurado, contexto);
    }

    // 2. Si el cliente pulsa "Volver al menú"
    if (entrada.id === 'btn_menu' || entrada.texto === 'menu' || entrada.texto === 'volver al menu') {
      return {
        nuevoEstado: 'MENU',
        acciones: [
          {
            tipo: 'enviarTexto',
            texto: 'Regresamos al menú principal. Tu carrito de compras se mantiene guardado.',
          },
        ],
        nuevoFlujo: {
          ...flujo,
          estado: 'MENU',
        },
      };
    }

    // 3. Inicio del flujo ("Hacer un pedido")
    const esInicioPedido =
      !entrada.id?.startsWith('ped_prod_') &&
      (flujo.estado === 'INICIO' ||
        flujo.estado === 'MENU' ||
        flujo.estado === 'PEDIDO' ||
        entrada.id === 'pedir' ||
        entrada.id === 'btn_pedido');

    if (esInicioPedido && !flujo.estado.startsWith('PEDIDO_')) {
      // 3.1. Validar local cerrado o pausado
      if (contexto.datosLocal?.pausaAltaDemanda) {
        const extraMin = contexto.datosLocal.altaDemandaMinutosExtra || 20;
        const motivo = contexto.datosLocal.motivoPausa || 'Muchos pedidos';
        return {
          nuevoEstado: 'MENU',
          acciones: [
            {
              tipo: 'enviarBotones',
              texto: `Por ahora pausamos los pedidos por alta demanda (${motivo}). La entrega tardará unos ${extraMin} min adicionales. Puedes volver al menú o consultar con un asesor.`,
              botones: [BOTON_HABLAR_PERSONA, BOTON_VOLVER_MENU],
            },
          ],
          nuevoFlujo: {
            ...flujo,
            estado: 'MENU',
          },
        };
      }

      if (contexto.datosLocal && !contexto.datosLocal.abierta) {
        const horarioTexto = contexto.datosLocal.textoEstado || 'de 14:00 a 22:00';
        return {
          nuevoEstado: 'MENU',
          acciones: [
            {
              tipo: 'enviarBotones',
              texto: `Ahora estamos cerrados. Nuestro horario: ${horarioTexto}. No tomamos pedidos fuera de horario; escríbenos cuando abramos.`,
              botones: [BOTON_VOLVER_MENU],
            },
          ],
          nuevoFlujo: {
            ...flujo,
            estado: 'MENU',
          },
        };
      }

      // 3.2. Iniciar carrito limpio y pedir modalidad
      const pedidoInicial: EstadoCarritoPedido = {
        estadoInterno: 'PEDIDO_MODALIDAD',
        items: [],
        idempotenciaPaso: `step_${Date.now()}`,
        timestampUltimaAccion: Date.now(),
      };

      return {
        nuevoEstado: 'PEDIDO_MODALIDAD',
        acciones: [
          {
            tipo: 'enviarBotones',
            texto: TEXTOS_BOT.pedidoModalidad(),
            botones: BOTONES_PEDIDO_MODALIDAD,
          },
        ],
        nuevoFlujo: {
          ...flujo,
          estado: 'PEDIDO_MODALIDAD',
          pedido: pedidoInicial,
        },
      };
    }

    // 3.b Pedido directo de un producto concreto (CTA comercial / Pedir este producto)
    if (entrada.id?.startsWith('ped_prod_')) {
      if (contexto.datosLocal?.pausaAltaDemanda) {
        const extraMin = contexto.datosLocal.altaDemandaMinutosExtra || 20;
        const motivo = contexto.datosLocal.motivoPausa || 'Muchos pedidos';
        return {
          nuevoEstado: 'MENU',
          acciones: [
            {
              tipo: 'enviarBotones',
              texto: `Por ahora pausamos los pedidos por alta demanda (${motivo}). La entrega tardará unos ${extraMin} min adicionales. Puedes volver al menú o consultar con un asesor.`,
              botones: [BOTON_HABLAR_PERSONA, BOTON_VOLVER_MENU],
            },
          ],
          nuevoFlujo: {
            ...flujo,
            estado: 'MENU',
          },
        };
      }

      if (contexto.datosLocal && !contexto.datosLocal.abierta) {
        const horarioTexto = contexto.datosLocal.textoEstado || 'de 14:00 a 22:00';
        return {
          nuevoEstado: 'MENU',
          acciones: [
            {
              tipo: 'enviarBotones',
              texto: `Ahora estamos cerrados. Nuestro horario: ${horarioTexto}. No tomamos pedidos fuera de horario; escríbenos cuando abramos.`,
              botones: [BOTON_VOLVER_MENU],
            },
          ],
          nuevoFlujo: {
            ...flujo,
            estado: 'MENU',
          },
        };
      }

      const pedidoBase: EstadoCarritoPedido = flujo.pedido || {
        estadoInterno: 'PEDIDO_PRODUCTOS',
        items: [],
        // «Ver más» / «Ver lista completa» desde la carta: la categoría viene del flujo
        categoriaSeleccionadaId: flujo.categoriaSeleccionadaId,
        idempotenciaPaso: `step_${Date.now()}`,
        timestampUltimaAccion: Date.now(),
      };

      return this.pasoProductos(flujo, pedidoBase, entrada, contexto);
    }

    // 4. Procesamiento según el estado interno del pedido
    const pedidoActual = flujo.pedido || {
      estadoInterno: (flujo.estado as EstadoPedidoFlujo) || 'PEDIDO_MODALIDAD',
      items: [],
    };
    pedidoActual.timestampUltimaAccion = Date.now();

    return this.despacharPaso(pedidoActual.estadoInterno, flujo, pedidoActual, entrada, contexto);
  }

  private despacharPaso(
    estado: EstadoPedidoFlujo,
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    entrada: EntradaNormalizada,
    contexto: ContextoConversacion,
  ): ResultadoTransicion | null {
    estado = normalizarEstadoUbicacion(estado);
    switch (estado) {
      case 'PEDIDO_MODALIDAD':
        return this.pasoModalidad(flujo, pedido, entrada, contexto);

      case 'PEDIDO_UBICACION':
        return this.pasoUbicacion(flujo, pedido, entrada, contexto);

      case 'PEDIDO_CATEGORIAS':
        return this.pasoCategorias(flujo, pedido, entrada, contexto);

      case 'PEDIDO_PRODUCTOS':
        return this.pasoProductos(flujo, pedido, entrada, contexto);

      case 'PEDIDO_TAMANO':
        return this.pasoTamano(flujo, pedido, entrada, contexto);

      case 'PEDIDO_GRUPO_OPCION':
        return this.pasoGrupoOpcion(flujo, pedido, entrada, contexto);

      case 'PEDIDO_SABOR':
        return this.pasoSabor(flujo, pedido, entrada, contexto);

      case 'PEDIDO_NOTA':
        return this.pasoNota(flujo, pedido, entrada, contexto);

      case 'PEDIDO_CANTIDAD':
        return this.pasoCantidad(flujo, pedido, entrada, contexto);

      case 'PEDIDO_NOMBRES_ENVASE':
        return this.pasoNombresEnvase(flujo, pedido, entrada, contexto);

      case 'PEDIDO_NOMBRES_CONFIRMAR':
        return this.pasoNombresConfirmar(flujo, pedido, entrada, contexto);

      case 'PEDIDO_ACCION_CARRITO':
      case 'PEDIDO_VER_CARRITO':
        return this.pasoVerCarrito(flujo, pedido, entrada, contexto);

      case 'PEDIDO_QUITAR_ITEM':
        return this.pasoQuitarItem(flujo, pedido, entrada, contexto);

      case 'PEDIDO_CONFIRMAR_NOMBRE':
        return this.pasoConfirmarNombre(flujo, pedido, entrada, contexto);

      case 'PEDIDO_INGRESAR_NOMBRE':
        return this.pasoIngresarNombre(flujo, pedido, entrada, contexto);

      case 'PEDIDO_INGRESAR_TELEFONO':
        return this.pasoIngresarTelefono(flujo, pedido, entrada, contexto);

      case 'PEDIDO_MEDIO_PAGO':
        return this.pasoMedioPago(flujo, pedido, entrada, contexto);

      case 'PEDIDO_MONTO_EFECTIVO':
        return this.pasoMontoEfectivo(flujo, pedido, entrada, contexto);

      case 'PEDIDO_PAGO_DIV_MEDIO1':
      case 'PEDIDO_PAGO_DIV_MEDIO2':
        return this.pasoDivMedio(estado, flujo, pedido, entrada, contexto);

      case 'PEDIDO_PAGO_DIV_MONTO':
        return this.pasoDivMonto(flujo, pedido, entrada, contexto);

      case 'PEDIDO_COMPROBANTE_TIPO':
        return this.pasoComprobanteTipo(flujo, pedido, entrada, contexto);

      case 'PEDIDO_COMPROBANTE_DNI':
        return this.pasoComprobanteDni(flujo, pedido, entrada, contexto);

      case 'PEDIDO_COMPROBANTE_RUC':
        return this.pasoComprobanteRuc(flujo, pedido, entrada, contexto);

      case 'PEDIDO_COMPROBANTE_RAZON':
        return this.pasoComprobanteRazon(flujo, pedido, entrada, contexto);

      case 'PEDIDO_RESUMEN_CONFIRMAR':
        return this.pasoResumenConfirmar(flujo, pedido, entrada, contexto);

      case 'PEDIDO_PROPINA':
        return this.pasoPropina(flujo, pedido, entrada, contexto, false);

      case 'PEDIDO_PROPINA_MONTO':
        return this.pasoPropina(flujo, pedido, entrada, contexto, true);

      default:
        return this.renderizarEstado('PEDIDO_CATEGORIAS', flujo, pedido, contexto);
    }
  }

  // -------------------------------------------------------------------------
  // PASO 1: Modalidad (Delivery vs Para recoger)
  // -------------------------------------------------------------------------
  private pasoModalidad(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    entrada: EntradaNormalizada,
    contexto: ContextoConversacion,
  ): ResultadoTransicion {
    const esDelivery =
      entrada.id === 'ped_mod_delivery' ||
      entrada.texto.includes('delivery') ||
      entrada.textoOriginal.toLowerCase().includes('delivery');

    const esRecoger =
      entrada.id === 'ped_mod_recojer' ||
      entrada.id === 'ped_mod_llevar' ||
      entrada.texto.includes('recoger') ||
      entrada.texto.includes('llevar') ||
      entrada.texto.includes('retiro');

    if (esDelivery) {
      return this.pedirUbicacion(flujo, { ...pedido, modalidad: 'DELIVERY' });
    }

    if (esRecoger) {
      const nuevoPedido: EstadoCarritoPedido = {
        ...pedido,
        modalidad: 'RECOGER',
        entrega: { modalidad: 'RECOGER', tarifaEnvio: 0 },
        estadoInterno: 'PEDIDO_CATEGORIAS',
      };
      return this.mostrarCategorias(flujo, nuevoPedido, contexto, TEXTOS_BOT.pedidoRecojoConfirmado());
    }

    // Entrada no reconocida en modalidad
    return {
      nuevoEstado: 'PEDIDO_MODALIDAD',
      acciones: [
        {
          tipo: 'enviarBotones',
          texto: 'Por favor elige si deseas tu pedido para Delivery o Para recoger:',
          botones: BOTONES_PEDIDO_MODALIDAD,
        },
      ],
      nuevoFlujo: flujo,
    };
  }

  // -------------------------------------------------------------------------
  // PASO 2: Ubicación (delivery): solo la ubicación actual que manda WhatsApp
  // -------------------------------------------------------------------------
  /** Pide la ubicación en un solo mensaje, con la instrucción del clip (sin otras opciones). */
  private pedirUbicacion(flujo: FlujoConversacion, pedido: EstadoCarritoPedido): ResultadoTransicion {
    return {
      nuevoEstado: 'PEDIDO_UBICACION',
      acciones: [{ tipo: 'enviarBotones', texto: TEXTOS_BOT.pedidoPedirUbicacion(), botones: BOTONES_PEDIDO_UBICACION }],
      nuevoFlujo: {
        ...flujo,
        estado: 'PEDIDO_UBICACION',
        pedido: { ...pedido, estadoInterno: 'PEDIDO_UBICACION' },
      },
    };
  }

  private pasoUbicacion(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    entrada: EntradaNormalizada,
    contexto: ContextoConversacion,
  ): ResultadoTransicion {
    if (entrada.id === 'ped_mod_recojer') {
      const nuevoPedido: EstadoCarritoPedido = {
        ...pedido,
        modalidad: 'RECOGER',
        entrega: { modalidad: 'RECOGER', tarifaEnvio: 0 },
        estadoInterno: 'PEDIDO_CATEGORIAS',
      };
      return this.mostrarCategorias(flujo, nuevoPedido, contexto, TEXTOS_BOT.pedidoRecojoConfirmado());
    }

    const ubicacion = entrada.ubicacion;
    // Cualquier cosa que no sea una ubicación (texto, botón viejo) repite la misma instrucción
    if (!ubicacion || !Number.isFinite(ubicacion.latitud) || !Number.isFinite(ubicacion.longitud)) {
      return this.pedirUbicacion(flujo, pedido);
    }

    // El servidor ya consultó la zona de ese punto (ejecutor): fuera de cobertura se avisa y se ofrece recoger
    if (contexto.resultadoEnvio && !contexto.resultadoEnvio.cubierto) {
      return {
        nuevoEstado: 'PEDIDO_UBICACION',
        acciones: [{ tipo: 'enviarBotones', texto: TEXTOS_BOT.pedidoFueraDeCobertura(), botones: BOTONES_PEDIDO_UBICACION_FALLIDA }],
        nuevoFlujo: { ...flujo, estado: 'PEDIDO_UBICACION', pedido: { ...pedido, estadoInterno: 'PEDIDO_UBICACION' } },
      };
    }

    // Ubicación recibida: zona, tarifa y coordenadas en el pedido; categorías en el mismo mensaje
    const { entrega, envio, esGratis } = this.entregaDesdePunto(pedido, contexto, {
      lat: ubicacion.latitud,
      lng: ubicacion.longitud,
      direccion: ubicacion.direccion || ubicacion.nombre,
    });
    const nuevoPedido: EstadoCarritoPedido = { ...pedido, modalidad: 'DELIVERY', entrega, estadoInterno: 'PEDIDO_CATEGORIAS' };
    return this.mostrarCategorias(flujo, nuevoPedido, contexto, TEXTOS_BOT.pedidoUbicacionExitosa(envio, esGratis));
  }

  /** Entrega DELIVERY con zona, tarifa y envío gratis según la cobertura resuelta para el punto. */
  private entregaDesdePunto(
    pedido: EstadoCarritoPedido,
    contexto: ContextoConversacion,
    punto: { lat: number; lng: number; direccion?: string },
  ): { entrega: NonNullable<EstadoCarritoPedido['entrega']>; envio: number | null; esGratis: boolean } {
    const resEnvio = contexto.resultadoEnvio;
    // Envío con las reglas del servidor (zona + promo de envío gratis por horario con casilla BOT). Sin tarifa, por calcular.
    const tarifaZona = resEnvio?.tarifa ?? null;
    const envio = contexto.vistaPreviaPedido?.envio ?? null;
    const esGratis = envio === 0;

    const entrega: NonNullable<EstadoCarritoPedido['entrega']> = {
      modalidad: 'DELIVERY',
      lat: punto.lat,
      lng: punto.lng,
      origen: 'WHATSAPP',
      zonaId: resEnvio?.zona?.id ? String(resEnvio.zona.id) : undefined,
      zonaNombre: resEnvio?.zona?.nombre,
      tarifaEnvio: envio,
      tarifaZona,
      direccion: punto.direccion,
    };
    return { entrega, envio, esGratis };
  }

  // -------------------------------------------------------------------------
  // PASO 3: Categorías
  // -------------------------------------------------------------------------
  private pasoCategorias(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    entrada: EntradaNormalizada,
    contexto: ContextoConversacion,
  ): ResultadoTransicion {
    const categorias = contexto.categoriasCarta || [];

    // Paginación de categorías
    if (entrada.id?.startsWith('ped_cat_pag_')) {
      const nuevaPagina = parseInt(entrada.id.replace('ped_cat_pag_', ''), 10) || 1;
      const nuevoPedido = { ...pedido, paginaCategorias: nuevaPagina };
      return this.mostrarCategorias(flujo, nuevoPedido, contexto);
    }

    // Selección de categoría
    const catIdMatch = entrada.id?.startsWith('ped_cat_')
      ? entrada.id.replace('ped_cat_', '')
      : null;

    let categoria = categorias.find((c) => String(c.id) === catIdMatch);
    if (!categoria) {
      categoria = categorias.find((c) => normalizarTexto(c.nombre) === entrada.texto);
    }

    if (!categoria) {
      return this.mostrarCategorias(flujo, pedido, contexto, 'Por favor elige una categoría de la lista:');
    }

    const nuevoPedido: EstadoCarritoPedido = {
      ...pedido,
      categoriaSeleccionadaId: String(categoria.id),
      paginaProductos: 1,
      estadoInterno: 'PEDIDO_PRODUCTOS',
    };

    return this.mostrarProductosDeCategoria(flujo, nuevoPedido, categoria, contexto);
  }

  // -------------------------------------------------------------------------
  // PASO 4: Productos de la Categoría
  // -------------------------------------------------------------------------
  private pasoProductos(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    entrada: EntradaNormalizada,
    contexto: ContextoConversacion,
  ): ResultadoTransicion {
    const categorias = contexto.categoriasCarta || [];
    const prodIdMatch = entrada.id?.startsWith('ped_prod_')
      ? entrada.id.replace('ped_prod_', '')
      : null;

    const catId = pedido.categoriaSeleccionadaId;
    let categoria = categorias.find((c) => String(c.id) === String(catId));

    if (!categoria && prodIdMatch) {
      categoria = categorias.find((c) =>
        (c.productos || []).some((p: any) => String(p.id) === prodIdMatch),
      );
      if (categoria) {
        pedido.categoriaSeleccionadaId = String(categoria.id);
      }
    }

    if (!categoria) {
      return this.mostrarCategorias(flujo, pedido, contexto);
    }

    // Volver a categorías
    if (entrada.id === 'btn_categorias' || entrada.texto.includes('categoria')) {
      return this.mostrarCategorias(flujo, pedido, contexto);
    }

    // Paginación de productos (lista) y «Ver lista completa» del carrusel
    if (entrada.id?.startsWith('ped_prod_pag_')) {
      const nuevaPagina = parseInt(entrada.id.replace('ped_prod_pag_', ''), 10) || 1;
      const nuevoPedido = { ...pedido, paginaProductos: nuevaPagina };
      return this.mostrarProductosDeCategoria(flujo, nuevoPedido, categoria, contexto, undefined, true);
    }
    if (entrada.id?.startsWith('ped_prod_mas_')) {
      const n = Math.max(2, parseInt(entrada.id.replace('ped_prod_mas_', ''), 10) || 2);
      const productos = ordenarPorVentas(
        (categoria.productos || []).filter((p: any) => !productoAgotado(p)),
        contexto.ventasProductos,
      );
      if ((n - 1) * 10 >= productos.length) {
        return this.mostrarProductosDeCategoria(flujo, { ...pedido, paginaProductos: 1 }, categoria, contexto, undefined, true);
      }
      return {
        nuevoEstado: 'PEDIDO_PRODUCTOS',
        acciones: this.accionesPaginaCarrusel(productos, n, categoria, contexto, {} as AccionMensaje),
        nuevoFlujo: { ...flujo, estado: 'PEDIDO_PRODUCTOS', pedido: { ...pedido, estadoInterno: 'PEDIDO_PRODUCTOS' } },
      };
    }
    if (entrada.id === 'ped_prod_lista') {
      return this.mostrarProductosDeCategoria(flujo, { ...pedido, paginaProductos: 1 }, categoria, contexto, undefined, true);
    }

    // Selección de producto
    let producto = (categoria.productos || []).find((p: any) => String(p.id) === prodIdMatch);
    if (!producto) {
      producto = (categoria.productos || []).find(
        (p: any) => normalizarTexto(p.nombre) === entrada.texto,
      );
    }

    if (!producto) {
      return this.mostrarProductosDeCategoria(
        flujo,
        pedido,
        categoria,
        contexto,
        'Por favor elige un producto de la lista:',
        true,
      );
    }

    // Validar disponibilidad / agotado (Mockup: no sigue el flujo del agotado y ofrece alternativas)
    if (productoAgotado(producto)) {
      const alternativas = (categoria.productos || [])
        .filter((p: any) => p.id !== producto.id && !productoAgotado(p))
        .map((p: any) => p.nombre)
        .slice(0, 2);

      return {
        nuevoEstado: 'PEDIDO_PRODUCTOS',
        acciones: [
          {
            tipo: 'enviarBotones',
            texto: TEXTOS_BOT.pedidoProductoAgotado(producto.nombre, alternativas),
            botones: [
              { id: `ped_cat_${categoria.id}`, titulo: 'Ver productos' },
              { id: 'btn_categorias', titulo: 'Ver categorías' },
              BOTON_VOLVER_MENU,
            ],
          },
        ],
        nuevoFlujo: flujo,
      };
    }

    // Iniciar configuración del producto
    const configInicial: ItemEnConfiguracionBot = {
      productoId: String(producto.id),
      productoNombre: producto.nombre,
      categoriaId: String(categoria.id),
      categoriaNombre: categoria.nombre,
      precioBase: Number(producto.precio),
      opciones: [],
      grupoIndexActual: 0,
      cantidad: 1,
      noSumaBeneficios: Boolean(producto.noSumaBeneficios),
    };

    const nuevoPedido: EstadoCarritoPedido = {
      ...pedido,
      productoSeleccionadoId: String(producto.id),
      itemEnConfiguracion: configInicial,
    };

    // A. ¿Tiene tamaños / variantes? Solo se ofrecen los que caben en lo que queda (docena no cabe en 3)
    const tamanosOfrecidos = tamanosQueCaben(producto);
    if (tamanosOfrecidos.length > 1) {
      return this.preguntarTamano(flujo, nuevoPedido, producto, TEXTOS_BOT.pedidoPreguntarTamano(producto.nombre));
    }

    // Si solo cabe un tamaño, asignar su precio base
    if (tamanosOfrecidos.length === 1) {
      configInicial.tamanoId = String(tamanosOfrecidos[0].id);
      configInicial.tamanoNombre = tamanosOfrecidos[0].nombre;
      configInicial.precioBase = Number(tamanosOfrecidos[0].precio);
    }

    // B. Pasar a grupos de opciones o cantidad
    return this.avanzarConfiguracionProducto(flujo, nuevoPedido, producto, contexto);
  }

  // -------------------------------------------------------------------------
  // PASO 4.1: Tamaño
  // -------------------------------------------------------------------------
  private pasoTamano(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    entrada: EntradaNormalizada,
    contexto: ContextoConversacion,
  ): ResultadoTransicion {
    const config = pedido.itemEnConfiguracion;
    if (!config) return this.mostrarCategorias(flujo, pedido, contexto);

    const categorias = contexto.categoriasCarta || [];
    const cat = categorias.find((c) => String(c.id) === config.categoriaId);
    const prod = (cat?.productos || []).find((p: any) => String(p.id) === config.productoId);

    const tamIdMatch = entrada.id?.startsWith('ped_tam_')
      ? entrada.id.replace('ped_tam_', '')
      : null;

    const caben = tamanosQueCaben(prod);
    let tamano = (prod?.tamanos || []).find((t: any) => String(t.id) === tamIdMatch);
    if (!tamano) {
      tamano = (prod?.tamanos || []).find((t: any) => normalizarTexto(t.nombre) === entrada.texto);
    }

    // Tamaño que ya no cabe (el stock bajó desde que se mostró la lista): se vuelve a preguntar
    if (tamano && !caben.includes(tamano)) {
      return this.preguntarTamano(flujo, pedido, prod, `Solo quedan ${quedanDeProducto(prod)} de ${prod.nombre} 😅 Elige otro tamaño:`);
    }
    if (!tamano && caben.length > 0) {
      // Tomar primer tamaño que cabe defensivamente si el botón no coincidió
      tamano = caben[0];
    }

    if (tamano) {
      config.tamanoId = String(tamano.id);
      config.tamanoNombre = tamano.nombre;
      config.precioBase = Number(tamano.precio);
    }

    return this.avanzarConfiguracionProducto(flujo, pedido, prod, contexto);
  }

  /** Pregunta el tamaño con los que caben en lo que queda (la docena puede no caber aunque la media quepa). */
  private preguntarTamano(flujo: FlujoConversacion, pedido: EstadoCarritoPedido, prod: any, texto: string): ResultadoTransicion {
    pedido.estadoInterno = 'PEDIDO_TAMANO';
    const botones: BotonAccion[] = tamanosQueCaben(prod)
      .slice(0, 3)
      .map((t: any) => ({ id: `ped_tam_${t.id}`, titulo: `${t.nombre} S/${Number(t.precio).toFixed(0)}`.slice(0, 20) }));
    return {
      nuevoEstado: 'PEDIDO_TAMANO',
      acciones: [{ tipo: 'enviarBotones', texto, botones }],
      nuevoFlujo: { ...flujo, estado: 'PEDIDO_TAMANO', pedido },
    };
  }

  // -------------------------------------------------------------------------
  // PASO 4.2: Grupos de Opciones (Leche, Endulzante, Toppings, etc.)
  // -------------------------------------------------------------------------
  private pasoGrupoOpcion(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    entrada: EntradaNormalizada,
    contexto: ContextoConversacion,
  ): ResultadoTransicion {
    const config = pedido.itemEnConfiguracion;
    if (!config) return this.mostrarCategorias(flujo, pedido, contexto);

    const categorias = contexto.categoriasCarta || [];
    const cat = categorias.find((c) => String(c.id) === config.categoriaId);
    const prod = (cat?.productos || []).find((p: any) => String(p.id) === config.productoId);
    const grupos = gruposDePregunta(prod);
    const grupoActual = grupos[config.grupoIndexActual];

    if (!grupoActual) {
      return this.avanzarConfiguracionProducto(flujo, pedido, prod, contexto);
    }

    const esObligatorio = grupoActual.obligatorio || grupoActual.minimo > 0;
    const esNinguno = entrada.id === 'ped_op_ninguno' || entrada.texto === 'ninguno';

    if (esNinguno) {
      if (esObligatorio) {
        return {
          nuevoEstado: 'PEDIDO_GRUPO_OPCION',
          acciones: [
            {
              tipo: 'enviarTexto',
              texto: TEXTOS_BOT.pedidoOpcionObligatoriaFaltante(grupoActual.nombre),
            },
            ...this.construirAccionGrupo(grupoActual),
          ],
          nuevoFlujo: flujo,
        };
      }
      // Opcional y eligió ninguno: avanzar al siguiente grupo
      config.grupoIndexActual++;
      return this.avanzarConfiguracionProducto(flujo, pedido, prod, contexto);
    }

    // Buscar la opción elegida
    const opIdMatch = entrada.id?.startsWith('ped_op_')
      ? entrada.id.replace('ped_op_', '')
      : null;

    // Solo las opciones que se pueden pedir ahora (agotadas o sin stock no se aceptan)
    const pedibles = (grupoActual.opciones || []).filter((o: any) => o.disponible !== false);
    let opcion = pedibles.find((o: any) => String(o.id) === opIdMatch);
    if (!opcion) {
      opcion = pedibles.find(
        (o: any) => normalizarTexto(o.nombre) === entrada.texto,
      );
    }

    if (!opcion && esObligatorio) {
      return {
        nuevoEstado: 'PEDIDO_GRUPO_OPCION',
        acciones: [
          {
            tipo: 'enviarTexto',
            texto: TEXTOS_BOT.pedidoOpcionObligatoriaFaltante(grupoActual.nombre),
          },
          ...this.construirAccionGrupo(grupoActual),
        ],
        nuevoFlujo: flujo,
      };
    }

    if (opcion) {
      config.opciones.push({
        opcionId: String(opcion.id),
        nombre: opcion.nombre,
        precioExtra: Number(opcion.precioExtra || 0),
        grupoId: String(grupoActual.id),
        grupoNombre: grupoActual.nombre,
      });
    }

    config.grupoIndexActual++;
    return this.avanzarConfiguracionProducto(flujo, pedido, prod, contexto);
  }

  // -------------------------------------------------------------------------
  // PASO 4.3: Sabor
  // -------------------------------------------------------------------------
  private pasoSabor(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    entrada: EntradaNormalizada,
    contexto: ContextoConversacion,
  ): ResultadoTransicion {
    const config = pedido.itemEnConfiguracion;
    if (!config) return this.mostrarCategorias(flujo, pedido, contexto);

    const prodStock = productoDeCarta(contexto.categoriasCarta || [], config.productoId);
    if (prodStock?.saboresConStock) return this.pasoSaborStock(flujo, pedido, entrada, contexto, prodStock);

    if (entrada.id?.startsWith('ped_sab_')) {
      config.sabor = entrada.textoOriginal;
    } else if (entrada.textoOriginal.length > 0 && entrada.textoOriginal !== 'omitir') {
      config.sabor = entrada.textoOriginal;
    }

    pedido.estadoInterno = 'PEDIDO_CANTIDAD';
    return {
      nuevoEstado: 'PEDIDO_CANTIDAD',
      acciones: [
        {
          tipo: 'enviarBotones',
          texto: TEXTOS_BOT.pedidoPreguntarCantidad(config.productoNombre, lineaAvisoStock(productoDeCarta(contexto.categoriasCarta || [], config.productoId), contexto)),
          botones: this.botonesCantidad(config.productoId, contexto, config.tamanoId),
        },
      ],
      nuevoFlujo: {
        ...flujo,
        estado: 'PEDIDO_CANTIDAD',
        pedido,
      },
    };
  }

  /** Stock por sabor: un solo sabor por línea; las unidades que consume son tamaño × cantidad. */
  private pasoSaborStock(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    entrada: EntradaNormalizada,
    contexto: ContextoConversacion,
    prod: any,
  ): ResultadoTransicion {
    const config = pedido.itemEnConfiguracion as ItemEnConfiguracionBot;
    const pedibles = saboresPedibles(prod);
    const saborId = entrada.id?.startsWith('ped_sab_') ? entrada.id.replace('ped_sab_', '') : null;
    const elegido =
      pedibles.find((s: any) => String(s.id) === saborId) ||
      pedibles.find((s: any) => normalizarTexto(s.nombre) === entrada.texto);
    if (!elegido) {
      return this.preguntarSaborStock(flujo, pedido, prod, 'Elige un sabor de la lista:');
    }

    const unidades = unidadesDeTamano(prod, config.tamanoId) * config.cantidad;
    if (typeof elegido.quedan === 'number' && unidades > elegido.quedan) {
      return this.preguntarSaborStock(flujo, pedido, prod, TEXTOS_BOT.pedidoSoloQuedanSabor(elegido.quedan, elegido.nombre));
    }

    config.sabores = [{ saborId: String(elegido.id), nombre: elegido.nombre, cantidad: unidades }];
    return this.agregarLineaConfigurada(flujo, pedido, contexto);
  }

  /** Lista de sabores disponibles (un mensaje). Sin ninguno, el producto queda agotado. */
  private preguntarSaborStock(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    prod: any,
    texto: string,
  ): ResultadoTransicion {
    const config = pedido.itemEnConfiguracion;
    const unidadesTam = unidadesDeTamano(prod, config?.tamanoId);
    const unidades = unidadesTam * (config?.cantidad ?? 1);
    const pedibles = saboresPedibles(prod);
    // Lo que cabe de un solo sabor: el saldo de cada sabor es su tope (no se mezcla en la línea)
    const maxPorSabor = Math.floor(Math.max(0, ...pedibles.map((s: any) => (typeof s.quedan === 'number' ? s.quedan : Infinity))) / unidadesTam);
    if (pedibles.length === 0 || maxPorSabor < 1) {
      return {
        nuevoEstado: 'PEDIDO_CATEGORIAS',
        acciones: [
          {
            tipo: 'enviarBotones',
            texto: TEXTOS_BOT.pedidoProductoAgotado(prod.nombre),
            botones: [{ id: 'btn_categorias', titulo: 'Ver categorías' }, BOTON_VOLVER_MENU],
          },
        ],
        nuevoFlujo: {
          ...flujo,
          estado: 'PEDIDO_CATEGORIAS',
          pedido: { ...pedido, estadoInterno: 'PEDIDO_CATEGORIAS', itemEnConfiguracion: undefined },
        },
      };
    }
    // Ningún sabor tiene las unidades de esta cantidad: se pide menos, sin ofrecer sabores que no alcanzan
    if (saboresQueCaben(prod, unidades).length === 0) {
      pedido.estadoInterno = 'PEDIDO_CANTIDAD';
      return {
        nuevoEstado: 'PEDIDO_CANTIDAD',
        acciones: [
          {
            tipo: 'enviarBotones',
            texto: `Ningún sabor de ${prod.nombre} tiene ${unidades} unidades. ¿Cuántas quieres?`,
            botones: botonesHasta(maxPorSabor),
          },
        ],
        nuevoFlujo: { ...flujo, estado: 'PEDIDO_CANTIDAD', pedido },
      };
    }
    pedido.estadoInterno = 'PEDIDO_SABOR';
    return {
      nuevoEstado: 'PEDIDO_SABOR',
      acciones: [listaSaboresStock(prod, texto, unidades)],
      nuevoFlujo: { ...flujo, estado: 'PEDIDO_SABOR', pedido },
    };
  }

  // -------------------------------------------------------------------------
  // PASO 4.4: Notas
  // -------------------------------------------------------------------------
  private pasoNota(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    entrada: EntradaNormalizada,
    contexto: ContextoConversacion,
  ): ResultadoTransicion {
    const config = pedido.itemEnConfiguracion;
    if (!config) return this.mostrarCategorias(flujo, pedido, contexto);

    if (
      entrada.id !== 'ped_nota_sin' &&
      entrada.id !== 'ped_continuar' &&
      entrada.texto !== 'sin notas' &&
      entrada.textoOriginal.length > 0
    ) {
      config.nota = entrada.textoOriginal.slice(0, 150);
    }

    pedido.estadoInterno = 'PEDIDO_CANTIDAD';
    return {
      nuevoEstado: 'PEDIDO_CANTIDAD',
      acciones: [
        {
          tipo: 'enviarBotones',
          texto: TEXTOS_BOT.pedidoPreguntarCantidad(config.productoNombre, lineaAvisoStock(productoDeCarta(contexto.categoriasCarta || [], config.productoId), contexto)),
          botones: this.botonesCantidad(config.productoId, contexto, config.tamanoId),
        },
      ],
      nuevoFlujo: {
        ...flujo,
        estado: 'PEDIDO_CANTIDAD',
        pedido,
      },
    };
  }

  // -------------------------------------------------------------------------
  // PASO 4.5: Cantidad y Agregar al Carrito
  // -------------------------------------------------------------------------
  private pasoCantidad(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    entrada: EntradaNormalizada,
    contexto: ContextoConversacion,
  ): ResultadoTransicion {
    const config = pedido.itemEnConfiguracion;
    if (!config) return this.mostrarCategorias(flujo, pedido, contexto);

    let cantidad = 1;
    if (entrada.id === 'ped_cant_1') cantidad = 1;
    else if (entrada.id === 'ped_cant_2') cantidad = 2;
    else if (entrada.id === 'ped_cant_3') cantidad = 3;
    else {
      const num = parseInt(entrada.textoOriginal.replace(/\D/g, ''), 10);
      if (!isNaN(num) && num > 0) {
        cantidad = Math.min(9999, num); // Sin tope de negocio; 9999 solo evita desbordes por un error de tecleo
      }
    }

    // Productos que controlan stock: no se acepta más que lo que queda (cantidad × unidades del tamaño)
    const quedan = this.quedanProducto(config.productoId, contexto);
    const prodCarta = productoDeCarta(contexto.categoriasCarta || [], config.productoId);
    if (quedan !== null && cantidad * unidadesDeTamano(prodCarta, config.tamanoId) > quedan) {
      return {
        nuevoEstado: 'PEDIDO_CANTIDAD',
        acciones: [
          {
            tipo: 'enviarBotones',
            texto: `Solo quedan ${quedan} de ${config.productoNombre} 😅 ¿Cuántas quieres?`,
            botones: this.botonesCantidad(config.productoId, contexto, config.tamanoId),
          },
        ],
        nuevoFlujo: { ...flujo, estado: 'PEDIDO_CANTIDAD', pedido },
      };
    }

    config.cantidad = cantidad;

    // Stock por sabor: después de la cantidad se elige el sabor (una lista, un solo sabor por línea)
    const prodStock = productoDeCarta(contexto.categoriasCarta || [], config.productoId);
    if (prodStock?.saboresConStock) {
      return this.preguntarSaborStock(flujo, pedido, prodStock, TEXTOS_BOT.pedidoPreguntarSabor());
    }

    // Bebidas: cada envase lleva un nombre distinto en su etiqueta; se piden uno por uno
    if (this.esBebidaConNombres(config.categoriaNombre) || this.bebidasDeCombo(config).length > 0) {
      config.nombresEnvase = [];
      return this.preguntarNombreEnvase(flujo, pedido, config);
    }

    return this.agregarLineaConfigurada(flujo, pedido, contexto);
  }

  /** Unidades que quedan de un producto que controla stock (null si no lo controla). */
  private quedanProducto(productoId: string, contexto: ContextoConversacion): number | null {
    for (const cat of contexto.categoriasCarta || []) {
      const p = (cat.productos || []).find((x: any) => String(x.id) === String(productoId));
      if (p) return typeof p.quedan === 'number' ? p.quedan : null;
    }
    return null;
  }

  /** Botones 1/2/3 cantidades, sin ofrecer más de lo que cabe (unidades del tamaño × cantidad <= lo que queda). */
  private botonesCantidad(productoId: string, contexto: ContextoConversacion, tamanoId?: string): BotonAccion[] {
    return botonesCantidadDe(productoDeCarta(contexto.categoriasCarta || [], productoId), tamanoId);
  }

  private esBebidaConNombres(categoriaNombre: string): boolean {
    const n = normalizarTexto(categoriaNombre || '').toUpperCase();
    return ['FRAPPES', 'ICED', 'FROZEN', 'CALIENTES'].includes(n);
  }

  /** Bebidas elegidas de un combo (grupos «Bebida 1 · Bebida»): cada una lleva su propio envase. */
  private bebidasDeCombo(config: ItemEnConfiguracionBot) {
    return config.opciones.filter((o) => {
      const g = o.grupoNombre || '';
      return g.includes(' · ') && /^bebida/i.test(g.split(' · ')[1].trim());
    });
  }

  private nombreEnvase(config: ItemEnConfiguracionBot, indice: number): string {
    const bebidas = this.bebidasDeCombo(config);
    return bebidas.length > 0 ? bebidas[indice % bebidas.length].nombre : config.productoNombre;
  }

  private totalEnvases(config: ItemEnConfiguracionBot): number {
    return config.cantidad * (this.bebidasDeCombo(config).length || 1);
  }

  private preguntarNombreEnvase(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    config: ItemEnConfiguracionBot,
  ): ResultadoTransicion {
    const hechos = config.nombresEnvase?.length || 0;
    pedido.estadoInterno = 'PEDIDO_NOMBRES_ENVASE';
    return {
      nuevoEstado: 'PEDIDO_NOMBRES_ENVASE',
      acciones: [
        {
          tipo: 'enviarTexto',
          texto: TEXTOS_BOT.pedidoPedirNombreEnvase(
            this.nombreEnvase(config, hechos),
            hechos + 1,
            this.totalEnvases(config),
          ),
        },
      ],
      nuevoFlujo: { ...flujo, estado: 'PEDIDO_NOMBRES_ENVASE', pedido },
    };
  }

  private confirmarNombresEnvase(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    config: ItemEnConfiguracionBot,
  ): ResultadoTransicion {
    pedido.estadoInterno = 'PEDIDO_NOMBRES_CONFIRMAR';
    return {
      nuevoEstado: 'PEDIDO_NOMBRES_CONFIRMAR',
      acciones: [
        {
          tipo: 'enviarBotones',
          texto: TEXTOS_BOT.pedidoConfirmarNombresEnvases(config.productoNombre, config.nombresEnvase || []),
          botones: BOTONES_PEDIDO_NOMBRES_ENVASE,
        },
      ],
      nuevoFlujo: { ...flujo, estado: 'PEDIDO_NOMBRES_CONFIRMAR', pedido },
    };
  }

  private pasoNombresEnvase(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    entrada: EntradaNormalizada,
    contexto: ContextoConversacion,
  ): ResultadoTransicion {
    const config = pedido.itemEnConfiguracion;
    if (!config) return this.mostrarCategorias(flujo, pedido, contexto);

    const texto = entrada.textoOriginal.trim();
    if (!texto || entrada.id) {
      return this.preguntarNombreEnvase(flujo, pedido, config);
    }

    const nombres = config.nombresEnvase || [];
    // Si escribe todos los nombres juntos separados por coma ("Ana, Luis, Rosa") y coinciden con los envases
    const separados = texto.split(',').map((n) => n.trim()).filter(Boolean);
    const total = this.totalEnvases(config);
    if (nombres.length === 0 && total > 1 && separados.length === total) {
      config.nombresEnvase = separados.map((n) => n.slice(0, 30));
    } else {
      config.nombresEnvase = [...nombres, texto.slice(0, 30)];
    }

    if ((config.nombresEnvase?.length || 0) < total) {
      return this.preguntarNombreEnvase(flujo, pedido, config);
    }
    return this.confirmarNombresEnvase(flujo, pedido, config);
  }

  private pasoNombresConfirmar(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    entrada: EntradaNormalizada,
    contexto: ContextoConversacion,
  ): ResultadoTransicion {
    const config = pedido.itemEnConfiguracion;
    if (!config) return this.mostrarCategorias(flujo, pedido, contexto);

    if (entrada.id === 'ped_nom_si' || entrada.texto === 'si') {
      return this.agregarLineaConfigurada(flujo, pedido, contexto);
    }
    if (entrada.id === 'ped_nom_no' || entrada.texto === 'no') {
      config.nombresEnvase = [];
      return this.preguntarNombreEnvase(flujo, pedido, config);
    }
    return this.confirmarNombresEnvase(flujo, pedido, config);
  }

  private agregarLineaConfigurada(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    contexto: ContextoConversacion,
  ): ResultadoTransicion {
    const config = pedido.itemEnConfiguracion;
    if (!config) return this.mostrarCategorias(flujo, pedido, contexto);
    const cantidad = config.cantidad;

    // Calcular precio unitario y subtotal de la línea
    const extrasTotal = config.opciones.reduce((s, o) => s + o.precioExtra, 0);
    const precioUnitario = Number((config.precioBase + extrasTotal).toFixed(2));
    const subtotalLinea = Number((precioUnitario * cantidad).toFixed(2));

    // Límite de seguridad: máximo 30 líneas por pedido
    if (pedido.items.length >= 30) {
      return {
        nuevoEstado: 'PEDIDO_VER_CARRITO',
        acciones: [
          {
            tipo: 'enviarBotones',
            texto: 'Has alcanzado el límite máximo de 30 productos en tu pedido.',
            botones: BOTONES_PEDIDO_VER_CARRITO,
          },
        ],
        nuevoFlujo: flujo,
      };
    }

    const nuevaLinea: LineaCarritoBot = {
      lineaId: `lin_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      productoId: config.productoId,
      productoNombre: config.productoNombre,
      categoriaId: config.categoriaId,
      categoriaNombre: config.categoriaNombre,
      tamanoId: config.tamanoId,
      tamanoNombre: config.tamanoNombre,
      cantidad,
      precioUnitario,
      subtotal: subtotalLinea,
      opciones: config.opciones,
      sabor: config.sabor,
      ...(config.sabores ? { sabores: [...config.sabores] } : {}),
      nota: config.nota,
      noSumaBeneficios: config.noSumaBeneficios,
      personas: config.nombresEnvase && config.nombresEnvase.length > 0 ? [...config.nombresEnvase] : undefined,
    };

    const nuevosItems = [...pedido.items, nuevaLinea];

    const nuevoPedido: EstadoCarritoPedido = {
      ...pedido,
      items: nuevosItems,
      itemEnConfiguracion: undefined,
      estadoInterno: 'PEDIDO_ACCION_CARRITO',
    };

    return {
      nuevoEstado: 'PEDIDO_ACCION_CARRITO',
      acciones: [
        {
          tipo: 'enviarBotones',
          texto: TEXTOS_BOT.pedidoProductoAgregado(config.productoNombre, subtotalLinea),
          botones: BOTONES_PEDIDO_ACCION_CARRITO,
        },
      ],
      nuevoFlujo: {
        ...flujo,
        estado: 'PEDIDO_ACCION_CARRITO',
        pedido: nuevoPedido,
      },
    };
  }

  // -------------------------------------------------------------------------
  // PASO 5: Ver Carrito y Acciones (Continuar, Agregar otro, Quitar)
  // -------------------------------------------------------------------------
  private pasoVerCarrito(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    entrada: EntradaNormalizada,
    contexto: ContextoConversacion,
  ): ResultadoTransicion {
    if (entrada.id === 'ped_otro' || entrada.texto.includes('agregar')) {
      const nuevoPedido: EstadoCarritoPedido = {
        ...pedido,
        estadoInterno: 'PEDIDO_CATEGORIAS',
      };
      return this.mostrarCategorias(flujo, nuevoPedido, contexto);
    }

    if (entrada.id === 'ped_quitar' || entrada.texto.includes('quitar')) {
      const nuevoPedido: EstadoCarritoPedido = {
        ...pedido,
        estadoInterno: 'PEDIDO_QUITAR_ITEM',
      };
      const filasQuitar: FilaLista[] = pedido.items.slice(0, 10).map((item, idx) => ({
        id: `ped_del_${item.lineaId}`,
        titulo: `${idx + 1}. ${item.productoNombre}`.slice(0, 24),
        descripcion: `${item.cantidad}x · S/ ${item.subtotal.toFixed(2)}`.slice(0, 72),
      }));

      return {
        nuevoEstado: 'PEDIDO_QUITAR_ITEM',
        acciones: [
          {
            tipo: 'enviarLista',
            texto: 'Elige el producto que deseas quitar de tu pedido:',
            botonTexto: 'Quitar producto',
            filas: filasQuitar,
          },
        ],
        nuevoFlujo: {
          ...flujo,
          estado: 'PEDIDO_QUITAR_ITEM',
          pedido: nuevoPedido,
        },
      };
    }

    if (entrada.id === 'ped_ver_carrito' || entrada.texto.includes('resumen') || entrada.texto.includes('carrito')) {
      const subtotal = Number(pedido.items.reduce((s, i) => s + i.subtotal, 0).toFixed(2));
      const lineasTexto = pedido.items
        .map((i) => {
          const detalles = detallesLinea(i);
          const detTxt = detalles.length > 0 ? ` (${detalles.join(' · ')})` : '';
          return `• ${i.cantidad}x ${i.productoNombre}${detTxt} — S/ ${i.subtotal.toFixed(2)}`;
        })
        .join('\n');

      return {
        nuevoEstado: 'PEDIDO_VER_CARRITO',
        acciones: [
          {
            tipo: 'enviarBotones',
            texto: TEXTOS_BOT.pedidoVerCarrito(lineasTexto, subtotal),
            botones: BOTONES_PEDIDO_VER_CARRITO,
          },
        ],
        nuevoFlujo: {
          ...flujo,
          estado: 'PEDIDO_VER_CARRITO',
          pedido,
        },
      };
    }

    // Continuar hacia el checkout
    return this.avanzarHaciaCheckout(flujo, pedido, contexto);
  }

  // -------------------------------------------------------------------------
  // PASO 5.1: Quitar Producto del Carrito
  // -------------------------------------------------------------------------
  private pasoQuitarItem(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    entrada: EntradaNormalizada,
    contexto: ContextoConversacion,
  ): ResultadoTransicion {
    const lineaId = entrada.id?.startsWith('ped_del_')
      ? entrada.id.replace('ped_del_', '')
      : null;

    const itemEliminar = pedido.items.find((i) => i.lineaId === lineaId);
    const nuevosItems = pedido.items.filter((i) => i.lineaId !== lineaId);

    if (nuevosItems.length === 0) {
      const nuevoPedido: EstadoCarritoPedido = {
        ...pedido,
        items: [],
        estadoInterno: 'PEDIDO_CATEGORIAS',
      };
      return this.mostrarCategorias(flujo, nuevoPedido, contexto, TEXTOS_BOT.pedidoCarritoVacio());
    }

    const nuevoPedido: EstadoCarritoPedido = {
      ...pedido,
      items: nuevosItems,
      estadoInterno: 'PEDIDO_VER_CARRITO',
    };

    const nombreEliminado = itemEliminar?.productoNombre || 'el producto';
    const subtotal = Number(nuevosItems.reduce((s, i) => s + i.subtotal, 0).toFixed(2));
    const lineasTexto = nuevosItems
      .map((i) => `• ${i.cantidad}x ${i.productoNombre} — S/ ${i.subtotal.toFixed(2)}`)
      .join('\n');

    return {
      nuevoEstado: 'PEDIDO_VER_CARRITO',
      acciones: [
        {
          tipo: 'enviarTexto',
          texto: TEXTOS_BOT.pedidoProductoEliminado(nombreEliminado),
        },
        {
          tipo: 'enviarBotones',
          texto: TEXTOS_BOT.pedidoVerCarrito(lineasTexto, subtotal),
          botones: BOTONES_PEDIDO_VER_CARRITO,
        },
      ],
      nuevoFlujo: {
        ...flujo,
        estado: 'PEDIDO_VER_CARRITO',
        pedido: nuevoPedido,
      },
    };
  }

  // -------------------------------------------------------------------------
  // PASO 8: Datos del Cliente (Nombre y Teléfono)
  // -------------------------------------------------------------------------
  private pasoConfirmarNombre(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    entrada: EntradaNormalizada,
    contexto: ContextoConversacion,
  ): ResultadoTransicion {
    if (entrada.id === 'ped_nombre_ok' || entrada.texto.includes('si')) {
      const nombreFinal =
        flujo.nombre_perfil_wa || contexto.nombreCliente || 'Cliente WhatsApp';
      const nuevoPedido: EstadoCarritoPedido = {
        ...pedido,
        cliente: {
          ...(pedido.cliente || {}),
          nombre: nombreFinal,
        },
      };
      return this.avanzarHaciaCheckout(flujo, nuevoPedido, contexto);
    }

    if (entrada.id === 'ped_nombre_otro' || entrada.texto.includes('otro')) {
      const nuevoPedido: EstadoCarritoPedido = {
        ...pedido,
        estadoInterno: 'PEDIDO_INGRESAR_NOMBRE',
      };
      return {
        nuevoEstado: 'PEDIDO_INGRESAR_NOMBRE',
        acciones: [
          {
            tipo: 'enviarTexto',
            texto: TEXTOS_BOT.pedidoIngresarNombre(),
          },
        ],
        nuevoFlujo: {
          ...flujo,
          estado: 'PEDIDO_INGRESAR_NOMBRE',
          pedido: nuevoPedido,
        },
      };
    }

    // Si escribió su nombre directamente
    if (entrada.textoOriginal.length >= 2) {
      const nuevoPedido: EstadoCarritoPedido = {
        ...pedido,
        cliente: {
          ...(pedido.cliente || {}),
          nombre: entrada.textoOriginal.slice(0, 80),
        },
      };
      return this.avanzarHaciaCheckout(flujo, nuevoPedido, contexto);
    }

    return this.avanzarHaciaCheckout(flujo, pedido, contexto);
  }

  private pasoIngresarNombre(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    entrada: EntradaNormalizada,
    contexto: ContextoConversacion,
  ): ResultadoTransicion {
    const nombre = entrada.textoOriginal.trim();
    if (nombre.length < 2) {
      return {
        nuevoEstado: 'PEDIDO_INGRESAR_NOMBRE',
        acciones: [
          {
            tipo: 'enviarTexto',
            texto: 'Por favor escribe tu nombre y apellido (al menos 2 caracteres):',
          },
        ],
        nuevoFlujo: flujo,
      };
    }

    const nuevoPedido: EstadoCarritoPedido = {
      ...pedido,
      cliente: {
        ...(pedido.cliente || {}),
        nombre: nombre.slice(0, 80),
      },
    };

    return this.avanzarHaciaCheckout(flujo, nuevoPedido, contexto);
  }

  private pasoIngresarTelefono(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    entrada: EntradaNormalizada,
    contexto: ContextoConversacion,
  ): ResultadoTransicion {
    if (entrada.id === 'ped_tel_mismo' && pedido.telefonoSugerido) {
      return this.avanzarHaciaCheckout(
        flujo,
        { ...pedido, cliente: { ...(pedido.cliente || {}), telefono: pedido.telefonoSugerido } },
        contexto,
      );
    }
    if (entrada.id === 'ped_tel_otro') {
      return {
        nuevoEstado: 'PEDIDO_INGRESAR_TELEFONO',
        acciones: [{ tipo: 'enviarTexto', texto: TEXTOS_BOT.pedidoIngresarTelefono() }],
        nuevoFlujo: { ...flujo, estado: 'PEDIDO_INGRESAR_TELEFONO', pedido: { ...pedido, telefonoSugerido: undefined } },
      };
    }

    const rawTel = entrada.textoOriginal.replace(/\D/g, '').replace(/^51(?=9\d{8}$)/, '');
    const esValido = /^9\d{8}$/.test(rawTel);

    if (!esValido) {
      return {
        nuevoEstado: 'PEDIDO_INGRESAR_TELEFONO',
        acciones: [
          {
            tipo: 'enviarTexto',
            texto: TEXTOS_BOT.pedidoTelefonoInvalido(),
          },
        ],
        nuevoFlujo: flujo,
      };
    }

    const nuevoPedido: EstadoCarritoPedido = {
      ...pedido,
      cliente: {
        ...(pedido.cliente || {}),
        telefono: rawTel,
      },
    };

    return this.avanzarHaciaCheckout(flujo, nuevoPedido, contexto);
  }

  // -------------------------------------------------------------------------
  // PASO 9: Medio de Pago
  // -------------------------------------------------------------------------
  /** Medio elegido por id o por texto; null si no reconoce nada. */
  private medioDesdeEntrada(entrada: EntradaNormalizada): MedioPagoBot | null {
    const id = entrada.id || '';
    const txt = entrada.texto;
    if (id === 'ped_pago_efectivo' || txt.includes('efectivo')) return 'EFECTIVO';
    if (id === 'ped_pago_yape' || txt.includes('yape')) return 'YAPE';
    if (id === 'ped_pago_plin' || txt.includes('plin')) return 'PLIN';
    if (id === 'ped_pago_tarjeta' || txt.includes('tarjeta') || txt.includes('pos')) return 'TARJETA';
    if (id === 'ped_pago_transf' || txt.includes('transferencia')) return 'TRANSFERENCIA';
    return null;
  }

  private pasoMedioPago(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    entrada: EntradaNormalizada,
    contexto: ContextoConversacion,
  ): ResultadoTransicion {
    if (entrada.id === 'ped_pago_dividir' || entrada.texto.includes('2 medios')) {
      return this.mostrarMediosDivididos('PEDIDO_PAGO_DIV_MEDIO1', flujo, { ...pedido, pago: undefined }, contexto);
    }
    const metodo = this.medioDesdeEntrada(entrada);
    if (!metodo) {
      return this.mostrarOpcionesPago(flujo, pedido, contexto, false);
    }
    return this.aplicarMedioUnico(flujo, pedido, metodo, contexto);
  }

  /** Un solo medio para todo el total. */
  private aplicarMedioUnico(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    metodo: MedioPagoBot,
    contexto: ContextoConversacion,
  ): ResultadoTransicion {
    if (metodo === 'EFECTIVO') {
      return this.pedirMontoEfectivo(flujo, { ...pedido, pago: { metodo: 'EFECTIVO' } }, calcularTotales(pedido, contexto.vistaPreviaPedido).aCobrar);
    }
    const nuevoPedido: EstadoCarritoPedido = { ...pedido, pago: { metodo } };
    const res = this.avanzarHaciaCheckout(flujo, nuevoPedido, contexto);
    if (metodo === 'TARJETA') {
      const aviso =
        pedido.modalidad === 'DELIVERY'
          ? 'Pagas con tarjeta al recibir; el repartidor lleva el POS. No necesitas enviar voucher ni vuelto.'
          : 'Pagas con tarjeta en caja al recoger. No necesitas enviar voucher ni vuelto.';
      res.acciones = [{ tipo: 'enviarTexto', texto: aviso }, ...res.acciones];
    }
    return res;
  }

  /** «¿Con cuánto pagas?» para `parte` soles en efectivo (el total, o la parte en efectivo del pago dividido). */
  private pedirMontoEfectivo(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    parte: number,
    textoAntes?: string,
  ): ResultadoTransicion {
    const nuevoPedido: EstadoCarritoPedido = { ...pedido, estadoInterno: 'PEDIDO_MONTO_EFECTIVO' };
    return {
      nuevoEstado: 'PEDIDO_MONTO_EFECTIVO',
      acciones: [
        {
          tipo: 'enviarBotones',
          texto: `${textoAntes ? textoAntes + '\n\n' : ''}${TEXTOS_BOT.pedidoMontoEfectivo()}`,
          botones: botonesEfectivo(parte),
        },
      ],
      nuevoFlujo: { ...flujo, estado: 'PEDIDO_MONTO_EFECTIVO', pedido: nuevoPedido },
    };
  }

  private pasoMontoEfectivo(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    entrada: EntradaNormalizada,
    contexto: ContextoConversacion,
  ): ResultadoTransicion {
    const totalPedido = calcularTotales(pedido, contexto.vistaPreviaPedido).aCobrar;
    const plan = pedido.pago?.plan;
    // Con pago dividido el efectivo cubre solo su parte
    const parte = plan?.find((f) => f.medio === 'EFECTIVO')?.monto ?? totalPedido;

    let monto: number | null;
    const m = /^ped_paga_(\d+)$/.exec(entrada.id || '');
    if (entrada.id === 'ped_paga_exacto') monto = parte;
    else if (m) monto = Number(m[1]);
    else monto = parsearMonto(entrada.textoOriginal);

    if (monto === null || monto < parte) {
      return {
        nuevoEstado: 'PEDIDO_MONTO_EFECTIVO',
        acciones: [
          {
            tipo: 'enviarBotones',
            texto: TEXTOS_BOT.pedidoPagaConMenorQueTotal(parte),
            botones: botonesEfectivo(parte),
          },
        ],
        nuevoFlujo: flujo,
      };
    }

    const nuevoPedido: EstadoCarritoPedido = {
      ...pedido,
      pago: {
        ...(plan ? { metodo: pedido.pago!.metodo, plan } : { metodo: 'EFECTIVO' as const }),
        pagaCon: Number(monto.toFixed(2)),
      },
    };

    return this.avanzarHaciaCheckout(flujo, nuevoPedido, contexto);
  }

  // -------------------------------------------------------------------------
  // Pago dividido (2 medios): mismo plan que carta y mozo (pago.plan)
  // -------------------------------------------------------------------------
  private mostrarMediosDivididos(
    estado: 'PEDIDO_PAGO_DIV_MEDIO1' | 'PEDIDO_PAGO_DIV_MEDIO2',
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    contexto: ContextoConversacion,
  ): ResultadoTransicion {
    const primero = pedido.pagoDiv?.medio1;
    const { aCobrar: total } = calcularTotales(pedido, contexto.vistaPreviaPedido);
    const resto = Number((total - (pedido.pagoDiv?.monto1 ?? 0)).toFixed(2));
    const medios = mediosActivos(contexto.datosLocalPublicos)
      .filter((m) => m !== primero)
      .map((m) => ({ id: m === 'TRANSFERENCIA' ? 'ped_pago_transf' : `ped_pago_${m.toLowerCase()}`, titulo: NOMBRE_MEDIO[m] }));
    const texto =
      estado === 'PEDIDO_PAGO_DIV_MEDIO1'
        ? `Vas a pagar con 2 medios. El total es S/ ${total.toFixed(2)}. ¿Con qué medio pagas la primera parte?`
        : `Te quedan S/ ${resto.toFixed(2)} por pagar. ¿Con qué medio pagas el resto?`;
    const op = opcionesMedios(medios);
    const nuevoPedido: EstadoCarritoPedido = { ...pedido, estadoInterno: estado };
    return {
      nuevoEstado: estado,
      acciones: [
        op.filas
          ? { tipo: 'enviarLista', texto, botonTexto: 'Elegir medio de pago', filas: op.filas }
          : { tipo: 'enviarBotones', texto, botones: op.botones! },
      ],
      nuevoFlujo: { ...flujo, estado, pedido: nuevoPedido },
    };
  }

  private pasoDivMedio(
    estado: 'PEDIDO_PAGO_DIV_MEDIO1' | 'PEDIDO_PAGO_DIV_MEDIO2',
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    entrada: EntradaNormalizada,
    contexto: ContextoConversacion,
  ): ResultadoTransicion {
    const medio = this.medioDesdeEntrada(entrada);
    const activos = mediosActivos(contexto.datosLocalPublicos);
    if (!medio || !activos.includes(medio) || (estado === 'PEDIDO_PAGO_DIV_MEDIO2' && medio === pedido.pagoDiv?.medio1)) {
      return this.mostrarMediosDivididos(estado, flujo, pedido, contexto);
    }
    const { aCobrar: total } = calcularTotales(pedido, contexto.vistaPreviaPedido);

    if (estado === 'PEDIDO_PAGO_DIV_MEDIO1') {
      const nuevoPedido: EstadoCarritoPedido = {
        ...pedido,
        estadoInterno: 'PEDIDO_PAGO_DIV_MONTO',
        pagoDiv: { medio1: medio },
      };
      return {
        nuevoEstado: 'PEDIDO_PAGO_DIV_MONTO',
        acciones: [
          {
            tipo: 'enviarBotones',
            texto: `¿Cuánto pagas con ${NOMBRE_MEDIO[medio]}? Escribe un monto menor a S/ ${total.toFixed(2)}.`,
            botones: [{ id: 'ped_div_mitad', titulo: `Mitad (S/ ${(Math.floor((total / 2) * 100) / 100).toFixed(2)})` }],
          },
        ],
        nuevoFlujo: { ...flujo, estado: 'PEDIDO_PAGO_DIV_MONTO', pedido: nuevoPedido },
      };
    }

    // Segundo medio: el resto se calcula solo
    const monto1 = pedido.pagoDiv!.monto1!;
    const plan = [
      { medio: pedido.pagoDiv!.medio1!, monto: monto1 },
      { medio, monto: Number((total - monto1).toFixed(2)) },
    ];
    const nuevoPedido: EstadoCarritoPedido = {
      ...pedido,
      pagoDiv: undefined,
      pago: { metodo: medioPrincipal(plan), plan },
    };
    const ef = plan.find((f) => f.medio === 'EFECTIVO');
    if (ef) {
      return this.pedirMontoEfectivo(flujo, nuevoPedido, ef.monto, `Parte en efectivo: S/ ${ef.monto.toFixed(2)}.`);
    }
    const res = this.avanzarHaciaCheckout(flujo, nuevoPedido, contexto);
    if (plan.some((f) => f.medio === 'TARJETA')) {
      const aviso =
        pedido.modalidad === 'DELIVERY'
          ? 'La parte con tarjeta la pagas al recibir; el repartidor lleva el POS.'
          : 'La parte con tarjeta la pagas en caja al recoger.';
      res.acciones = [{ tipo: 'enviarTexto', texto: aviso }, ...res.acciones];
    }
    return res;
  }

  private pasoDivMonto(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    entrada: EntradaNormalizada,
    contexto: ContextoConversacion,
  ): ResultadoTransicion {
    const { aCobrar: total } = calcularTotales(pedido, contexto.vistaPreviaPedido);
    const medio1 = pedido.pagoDiv?.medio1;
    if (!medio1) return this.mostrarMediosDivididos('PEDIDO_PAGO_DIV_MEDIO1', flujo, pedido, contexto);
    const monto =
      entrada.id === 'ped_div_mitad' ? Math.floor((total / 2) * 100) / 100 : parsearMonto(entrada.textoOriginal);
    if (monto === null || monto <= 0 || monto >= total) {
      return {
        nuevoEstado: 'PEDIDO_PAGO_DIV_MONTO',
        acciones: [
          {
            tipo: 'enviarTexto',
            texto: `El monto con ${NOMBRE_MEDIO[medio1]} debe ser mayor a 0 y menor a S/ ${total.toFixed(2)}. ¿Cuánto pagas con ${NOMBRE_MEDIO[medio1]}?`,
          },
        ],
        nuevoFlujo: flujo,
      };
    }
    return this.mostrarMediosDivididos(
      'PEDIDO_PAGO_DIV_MEDIO2',
      flujo,
      { ...pedido, pagoDiv: { medio1, monto1: Number(monto.toFixed(2)) } },
      contexto,
    );
  }

  // -------------------------------------------------------------------------
  // PASO 10: Comprobante
  // -------------------------------------------------------------------------
  private pasoComprobanteTipo(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    entrada: EntradaNormalizada,
    contexto: ContextoConversacion,
  ): ResultadoTransicion {
    if (entrada.id === 'ped_comp_boleta' || entrada.texto.includes('boleta')) {
      const nuevoPedido: EstadoCarritoPedido = {
        ...pedido,
        comprobante: { tipo: 'BOLETA' },
        estadoInterno: 'PEDIDO_COMPROBANTE_DNI',
      };
      return {
        nuevoEstado: 'PEDIDO_COMPROBANTE_DNI',
        acciones: [
          {
            tipo: 'enviarTexto',
            texto: TEXTOS_BOT.pedidoComprobanteDni(),
          },
        ],
        nuevoFlujo: {
          ...flujo,
          estado: 'PEDIDO_COMPROBANTE_DNI',
          pedido: nuevoPedido,
        },
      };
    }

    if (entrada.id === 'ped_comp_factura' || entrada.texto.includes('factura')) {
      const nuevoPedido: EstadoCarritoPedido = {
        ...pedido,
        comprobante: { tipo: 'FACTURA' },
        estadoInterno: 'PEDIDO_COMPROBANTE_RUC',
      };
      return {
        nuevoEstado: 'PEDIDO_COMPROBANTE_RUC',
        acciones: [
          {
            tipo: 'enviarTexto',
            texto: TEXTOS_BOT.pedidoComprobanteRuc(),
          },
        ],
        nuevoFlujo: {
          ...flujo,
          estado: 'PEDIDO_COMPROBANTE_RUC',
          pedido: nuevoPedido,
        },
      };
    }

    return this.avanzarHaciaCheckout(flujo, pedido, contexto);
  }

  private pasoComprobanteDni(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    entrada: EntradaNormalizada,
    contexto: ContextoConversacion,
  ): ResultadoTransicion {
    const raw = entrada.textoOriginal.replace(/\D/g, '');
    const dni = raw.length === 8 ? raw : undefined;

    const nuevoPedido: EstadoCarritoPedido = {
      ...pedido,
      comprobante: {
        tipo: 'BOLETA',
        dni,
      },
    };

    return this.avanzarHaciaCheckout(flujo, nuevoPedido, contexto);
  }

  private pasoComprobanteRuc(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    entrada: EntradaNormalizada,
    _contexto: ContextoConversacion,
  ): ResultadoTransicion {
    const ruc = entrada.textoOriginal.replace(/\D/g, '');
    if (ruc.length !== 11) {
      return {
        nuevoEstado: 'PEDIDO_COMPROBANTE_RUC',
        acciones: [
          {
            tipo: 'enviarTexto',
            texto: 'El RUC debe tener exactamente 11 dígitos. Por favor escríbelo nuevamente:',
          },
        ],
        nuevoFlujo: flujo,
      };
    }

    const nuevoPedido: EstadoCarritoPedido = {
      ...pedido,
      comprobante: {
        tipo: 'FACTURA',
        ruc,
      },
      estadoInterno: 'PEDIDO_COMPROBANTE_RAZON',
    };

    return {
      nuevoEstado: 'PEDIDO_COMPROBANTE_RAZON',
      acciones: [
        {
          tipo: 'enviarTexto',
          texto: TEXTOS_BOT.pedidoComprobanteRazon(),
        },
      ],
      nuevoFlujo: {
        ...flujo,
        estado: 'PEDIDO_COMPROBANTE_RAZON',
        pedido: nuevoPedido,
      },
    };
  }

  private pasoComprobanteRazon(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    entrada: EntradaNormalizada,
    contexto: ContextoConversacion,
  ): ResultadoTransicion {
    const razonSocial = entrada.textoOriginal.trim();
    const nuevoPedido: EstadoCarritoPedido = {
      ...pedido,
      comprobante: {
        ...(pedido.comprobante || { tipo: 'FACTURA' }),
        tipo: 'FACTURA',
        razonSocial: razonSocial.slice(0, 100),
      },
    };

    return this.avanzarHaciaCheckout(flujo, nuevoPedido, contexto);
  }

  // -------------------------------------------------------------------------
  // PASO 11: Resumen Final y Confirmación
  // -------------------------------------------------------------------------
  private pasoResumenConfirmar(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    entrada: EntradaNormalizada,
    contexto: ContextoConversacion,
  ): ResultadoTransicion {
    if (entrada.id === 'ped_cambiar' || entrada.texto.includes('cambiar')) {
      const nuevoPedido: EstadoCarritoPedido = {
        ...pedido,
        estadoInterno: 'PEDIDO_VER_CARRITO',
      };
      return this.renderizarEstado('PEDIDO_VER_CARRITO', flujo, nuevoPedido, contexto);
    }

    // Seguridad: validación estricta de botón de confirmación
    if (entrada.id !== 'ped_confirmar' && !entrada.texto.includes('confirmar')) {
      return this.mostrarResumenFinal(flujo, pedido, contexto);
    }

    // 11.1. Seguridad: Límite diario de 10 pedidos por teléfono
    const pedidosHoy = contexto.pedidosHoyTelefono ?? 0;
    if (pedidosHoy >= 10) {
      return {
        nuevoEstado: 'ATENCION_PERSONA',
        acciones: [
          {
            tipo: 'pasarAPersona',
            motivo: 'LIMITE_PEDIDOS_DIARIOS_EXCEDIDO',
            mensajeCliente: entrada.textoOriginal,
          },
          {
            tipo: 'enviarBotones',
            texto: TEXTOS_BOT.pedidoLimiteDiarioAlcanzado(),
            botones: [BOTON_VOLVER_MENU],
          },
        ],
        nuevoFlujo: {
          ...flujo,
          estado: 'ATENCION_PERSONA',
        },
      };
    }

    // 11.2. Construir DTO de PedidosService.crear
    const { aCobrar: total } = calcularTotales(pedido, contexto.vistaPreviaPedido);

    const clienteNombre =
      pedido.cliente?.nombre ||
      flujo.nombre_perfil_wa ||
      contexto.nombreCliente ||
      'Cliente WhatsApp';

    const clienteTelefono =
      pedido.cliente?.telefono ||
      contexto.telefonoCliente ||
      '999999999';

    const dto: any = {
      cliente: {
        nombre: clienteNombre,
        telefono: clienteTelefono,
      },
      modalidad: pedido.modalidad || 'RECOGER',
      ...(pedido.propina ? { propina: pedido.propina } : {}),
      entrega:
        pedido.modalidad === 'DELIVERY'
          ? {
              direccion: pedido.entrega?.direccion,
              referencia: pedido.entrega?.referencia,
              lat: pedido.entrega?.lat,
              lng: pedido.entrega?.lng,
              origen: pedido.entrega?.origen || 'WHATSAPP',
            }
          : undefined,
      lineas: pedido.items.map((i) => ({
        productoId: i.productoId,
        tamanoId: i.tamanoId,
        cantidad: i.cantidad,
        opciones: i.opciones.map((o) => o.opcionId),
        nota: i.nota,
        personas: i.personas,
        // Stock por sabor: unidades por sabor (tamaño × cantidad); el servidor valida suma y stock
        ...(i.sabores ? { sabores: i.sabores.map((s) => ({ saborId: s.saborId, cantidad: s.cantidad })) } : {}),
      })),
      pago: {
        metodo: pedido.pago?.metodo || 'EFECTIVO',
        pagaCon: pedido.pago?.pagaCon,
        // Pago dividido: mismo formato que la carta y el mozo (pago.plan = [{ medio, monto }])
        ...(pedido.pago?.plan?.length ? { plan: pedido.pago.plan.map((f) => ({ medio: f.medio, monto: f.monto })) } : {}),
      },
      comprobante:
        pedido.comprobante?.tipo && pedido.comprobante.tipo !== 'NINGUNO'
          ? {
              tipo: pedido.comprobante.tipo,
              dni: pedido.comprobante.dni,
              ruc: pedido.comprobante.ruc,
              razonSocial: pedido.comprobante.razonSocial,
            }
          : undefined,
    };

    // Clave estable de idempotencia para evitar duplicados ante reenvíos de Meta
    const claveIdempotencia = `wa_pedido_${flujo.id || 'conv'}_${pedido.idempotenciaPaso || 'step'}`;

    const tBase = Number(contexto.datosLocalPublicos?.tiempo_base || 25);
    const tMax = Number(contexto.datosLocalPublicos?.tiempo_maximo || 35);
    const minExtra = Number(contexto.datosLocal?.altaDemandaMinutosExtra || 0);

    const tiempoMin = tBase + minExtra;
    const tiempoMax = tMax + minExtra;

    const planPago = pedido.pago?.plan;
    const esPagoDigital = planPago?.length
      ? planPago.some((f) => ['YAPE', 'PLIN', 'TRANSFERENCIA'].includes(f.medio))
      : ['YAPE', 'PLIN', 'TRANSFERENCIA'].includes(pedido.pago?.metodo || '');

    // Despachar acción transaccional para PedidosService
    return {
      nuevoEstado: 'MENU',
      acciones: [
        {
          tipo: 'crearPedido',
          dto,
          carrito: pedido,
          claveIdempotencia,
          tiempoEstimadoMin: tiempoMin,
          tiempoEstimadoMax: tiempoMax,
          esPagoDigital,
          datosPagoTexto: this.formatearDatosPago(contexto.datosLocalPublicos?.mediosPagoVisibles, total),
        },
      ],
      nuevoFlujo: {
        ...flujo,
        estado: 'MENU',
        pedido: null, // Carrito terminado y limpiado
      },
    };
  }

  // -------------------------------------------------------------------------
  // PASO 3.5: Propina opcional. Va aparte de la venta; «Sin propina» o 0 = no dejar.
  // -------------------------------------------------------------------------
  private pedirPropina(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    contexto: ContextoConversacion,
  ): ResultadoTransicion {
    const tope = Number(contexto.datosLocalPublicos?.propina?.tope || 200);
    const nuevoPedido: EstadoCarritoPedido = { ...pedido, estadoInterno: 'PEDIDO_PROPINA' };
    return {
      nuevoEstado: 'PEDIDO_PROPINA',
      acciones: [
        {
          tipo: 'enviarBotones',
          texto: TEXTOS_BOT.pedidoPropinaPregunta(tope),
          botones: BOTONES_PEDIDO_PROPINA,
        },
      ],
      nuevoFlujo: { ...flujo, estado: 'PEDIDO_PROPINA', pedido: nuevoPedido },
    };
  }

  private pasoPropina(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    entrada: EntradaNormalizada,
    contexto: ContextoConversacion,
    esperandoMonto: boolean,
  ): ResultadoTransicion {
    const tope = Number(contexto.datosLocalPublicos?.propina?.tope || 200);
    const fijar = (monto: number): ResultadoTransicion => {
      const nuevo: EstadoCarritoPedido = { ...pedido, propina: monto };
      return this.avanzarHaciaCheckout({ ...flujo, pedido: nuevo }, nuevo, contexto);
    };

    if (!esperandoMonto && entrada.id === 'ped_propina_si') {
      const nuevoPedido: EstadoCarritoPedido = { ...pedido, estadoInterno: 'PEDIDO_PROPINA_MONTO' };
      return {
        nuevoEstado: 'PEDIDO_PROPINA_MONTO',
        acciones: [{ tipo: 'enviarTexto', texto: TEXTOS_BOT.pedidoPropinaMonto(tope) }],
        nuevoFlujo: { ...flujo, estado: 'PEDIDO_PROPINA_MONTO', pedido: nuevoPedido },
      };
    }
    if (entrada.id === 'ped_propina_no' || /sin propina|^no$/i.test(entrada.texto.trim())) {
      return fijar(0);
    }
    const r = normalizarPropina(entrada.textoOriginal, tope);
    if (r.valido) return fijar(r.monto);

    // Monto no válido: se vuelve a pedir en el mismo paso
    const texto = TEXTOS_BOT.pedidoPropinaInvalida(tope);
    const acciones: ResultadoTransicion['acciones'] = esperandoMonto
      ? [{ tipo: 'enviarTexto', texto }]
      : [{ tipo: 'enviarBotones', texto, botones: BOTONES_PEDIDO_PROPINA }];
    const estado = esperandoMonto ? 'PEDIDO_PROPINA_MONTO' : 'PEDIDO_PROPINA';
    return {
      nuevoEstado: estado,
      acciones,
      nuevoFlujo: { ...flujo, estado, pedido },
    };
  }

  // -------------------------------------------------------------------------
  // Helper: Avanzar de paso hacia el Checkout
  // -------------------------------------------------------------------------
  private avanzarHaciaCheckout(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    contexto: ContextoConversacion,
  ): ResultadoTransicion {
    const subtotal = Number(pedido.items.reduce((s, i) => s + i.subtotal, 0).toFixed(2));
    // Sin `pedido_minimo` configurado (0 o null) no hay mínimo
    const pedidoMin = Number(contexto.datosLocalPublicos?.pedidoMinimo || 0);

    // 1. Pedido mínimo solo para delivery
    if (pedido.modalidad === 'DELIVERY' && pedidoMin > 0 && subtotal < pedidoMin) {
      const faltante = Number((pedidoMin - subtotal).toFixed(2));
      return {
        nuevoEstado: 'PEDIDO_ACCION_CARRITO',
        acciones: [
          {
            tipo: 'enviarBotones',
            texto: TEXTOS_BOT.pedidoMinimoNoAlcanzado(pedidoMin, faltante),
            botones: [
              { id: 'ped_otro', titulo: 'Agregar producto' },
              { id: 'ped_mod_recojer', titulo: 'Para recoger' },
              BOTON_VOLVER_MENU,
            ],
          },
        ],
        nuevoFlujo: {
          ...flujo,
          estado: 'PEDIDO_ACCION_CARRITO',
          pedido,
        },
      };
    }

    // 2. Nombre del cliente
    if (!pedido.cliente?.nombre) {
      const nombreSugerido = flujo.nombre_perfil_wa || contexto.nombreCliente;
      if (nombreSugerido) {
        const nuevoPedido: EstadoCarritoPedido = {
          ...pedido,
          estadoInterno: 'PEDIDO_CONFIRMAR_NOMBRE',
        };
        return {
          nuevoEstado: 'PEDIDO_CONFIRMAR_NOMBRE',
          acciones: [
            {
              tipo: 'enviarBotones',
              // Puntos: siempre al celular de quien escribe (contexto.telefonoCliente); el saldo solo si ya vino en el contexto
              texto: TEXTOS_BOT.pedidoConfirmarNombre(nombreSugerido, {
                celular: celularPuntosEnmascarado(contexto.telefonoCliente),
                saldo: contexto.puntos?.cuentaTelefono?.saldo ?? null,
              }),
              botones: BOTONES_PEDIDO_NOMBRE_CONFIRMAR,
            },
          ],
          nuevoFlujo: {
            ...flujo,
            estado: 'PEDIDO_CONFIRMAR_NOMBRE',
            pedido: nuevoPedido,
          },
        };
      }

      const nuevoPedido: EstadoCarritoPedido = {
        ...pedido,
        estadoInterno: 'PEDIDO_INGRESAR_NOMBRE',
      };
      return {
        nuevoEstado: 'PEDIDO_INGRESAR_NOMBRE',
        acciones: [
          {
            tipo: 'enviarTexto',
            texto: TEXTOS_BOT.pedidoIngresarNombre(),
          },
        ],
        nuevoFlujo: {
          ...flujo,
          estado: 'PEDIDO_INGRESAR_NOMBRE',
          pedido: nuevoPedido,
        },
      };
    }

    // 3. Teléfono del cliente: el número del chat llega como 51XXXXXXXXX; se ofrece usarlo o escribir otro
    const telDigitos = String(contexto.telefonoCliente || '').replace(/\D/g, '');
    const telExistente = /^51(9\d{8})$/.test(telDigitos)
      ? telDigitos.slice(2)
      : /^9\d{8}$/.test(telDigitos)
        ? telDigitos
        : '';

    if (!pedido.cliente?.telefono) {
      const nuevoPedido: EstadoCarritoPedido = {
        ...pedido,
        telefonoSugerido: telExistente || undefined,
        estadoInterno: 'PEDIDO_INGRESAR_TELEFONO',
      };
      return {
        nuevoEstado: 'PEDIDO_INGRESAR_TELEFONO',
        acciones: [
          telExistente
            ? {
                tipo: 'enviarBotones',
                texto: TEXTOS_BOT.pedidoConfirmarTelefono(telExistente),
                botones: BOTONES_PEDIDO_TELEFONO,
              }
            : {
                tipo: 'enviarTexto',
                texto: TEXTOS_BOT.pedidoIngresarTelefono(),
              },
        ],
        nuevoFlujo: {
          ...flujo,
          estado: 'PEDIDO_INGRESAR_TELEFONO',
          pedido: nuevoPedido,
        },
      };
    }

    // 3.5. Propina opcional (interruptor del bot): antes del pago, para que los montos ya la incluyan
    if (pedido.propina === undefined && contexto.datosLocalPublicos?.propina?.bot === true) {
      return this.pedirPropina(flujo, pedido, contexto);
    }

    // 4. Medio de pago
    if (!pedido.pago?.metodo) {
      return this.mostrarOpcionesPago(flujo, pedido, contexto);
    }

    // 5. Comprobante
    if (!pedido.comprobante) {
      const nuevoPedido: EstadoCarritoPedido = {
        ...pedido,
        estadoInterno: 'PEDIDO_COMPROBANTE_TIPO',
      };
      return {
        nuevoEstado: 'PEDIDO_COMPROBANTE_TIPO',
        acciones: [
          {
            tipo: 'enviarBotones',
            texto: TEXTOS_BOT.pedidoComprobanteTipo(),
            botones: BOTONES_PEDIDO_COMPROBANTE,
          },
        ],
        nuevoFlujo: {
          ...flujo,
          estado: 'PEDIDO_COMPROBANTE_TIPO',
          pedido: nuevoPedido,
        },
      };
    }

    // 6. Resumen final completo
    return this.mostrarResumenFinal(flujo, pedido, contexto);
  }

  // -------------------------------------------------------------------------
  // Helper: Mostrar Resumen Final
  // -------------------------------------------------------------------------
  private mostrarResumenFinal(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    contexto: ContextoConversacion,
  ): ResultadoTransicion {
    const { envio, descuento, descuentoNombre, propina, aCobrar, envioPromoNombre, envioGratisFalta } = calcularTotales(pedido, contexto.vistaPreviaPedido);

    const lineasTexto = this.lineasResumen(pedido, contexto);


    const descuentoTexto = descuento > 0 ? TEXTOS_BOT.lineaDescuentoBot(descuentoNombre, descuento) : undefined;

    let envioTexto = 'gratis';
    if (pedido.modalidad === 'DELIVERY') {
      if (envio === null) {
        envioTexto = 'lo confirma un asesor al ubicarte';
      } else if (envio > 0) {
        envioTexto = `S/ ${envio.toFixed(2)}`;
      } else {
        envioTexto = 'gratis';
      }
    } else {
      envioTexto = 'no aplica (recojo en local)';
    }

    let direccionTexto: string | undefined;
    if (pedido.modalidad === 'DELIVERY') {
      const dir = pedido.entrega?.direccion || 'Ubicación compartida';
      const ref = pedido.entrega?.referencia ? ` (Ref: ${pedido.entrega.referencia})` : '';
      direccionTexto = `Dirección: ${dir}${ref}`;
    }

    const pagoTexto = textoPago(pedido.pago);

    const tBase = Number(contexto.datosLocalPublicos?.tiempo_base || 25);
    const tMax = Number(contexto.datosLocalPublicos?.tiempo_maximo || 35);
    const extraDemanda = Number(contexto.datosLocal?.altaDemandaMinutosExtra || 0);

    const tiempoMin = tBase + extraDemanda;
    const tiempoMax = tMax + extraDemanda;

    const avisoDemanda = extraDemanda > 0
      ? `Hoy tenemos alta demanda: la entrega puede tardar unos ${tiempoMin} a ${tiempoMax} minutos.`
      : undefined;

    const nuevoPedido: EstadoCarritoPedido = {
      ...pedido,
      estadoInterno: 'PEDIDO_RESUMEN_CONFIRMAR',
    };

    return {
      nuevoEstado: 'PEDIDO_RESUMEN_CONFIRMAR',
      acciones: [
        {
          tipo: 'enviarBotones',
          texto: TEXTOS_BOT.pedidoResumenFinal({
            lineasTexto,
            descuentoTexto,
            envioTexto,
            envioLinea:
              pedido.modalidad === 'DELIVERY' && envioPromoNombre
                ? TEXTOS_BOT.lineaEnvioGratisBot(envioPromoNombre, contexto.textosPersonalizados?.chatbot_texto_envio_gratis)
                : undefined,
            faltaEnvioTexto:
              pedido.modalidad === 'DELIVERY' && envioGratisFalta && envioGratisFalta > 0
                ? TEXTOS_BOT.lineaFaltaEnvioGratisBot(envioGratisFalta)
                : undefined,
            total: aCobrar,
            propina,
            modalidad: pedido.modalidad === 'DELIVERY' ? 'Delivery' : 'Para recoger',
            direccionTexto,
            pagoTexto,
            tiempoMin,
            tiempoMax,
            avisoDemanda,
          }),
          botones: BOTONES_PEDIDO_CONFIRMAR_FINAL,
        },
      ],
      nuevoFlujo: {
        ...flujo,
        estado: 'PEDIDO_RESUMEN_CONFIRMAR',
        pedido: nuevoPedido,
      },
    };
  }

  // -------------------------------------------------------------------------
  // Helper: Mostrar Opciones de Pago Activas
  // -------------------------------------------------------------------------
  private mostrarOpcionesPago(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    contexto: ContextoConversacion,
    conResumen = true,
  ): ResultadoTransicion {
    const activos = mediosActivos(contexto.datosLocalPublicos);
    const opciones = activos.map((m) => ({
      id: m === 'TRANSFERENCIA' ? 'ped_pago_transf' : `ped_pago_${m.toLowerCase()}`,
      titulo: m === 'TARJETA' ? 'Tarjeta (POS)' : NOMBRE_MEDIO[m],
    }));
    if (opciones.length === 0) opciones.push({ id: 'ped_pago_efectivo', titulo: 'Efectivo' });
    if (opciones.length >= 2) opciones.push({ id: 'ped_pago_dividir', titulo: 'Pagar con 2 medios' });

    const op = opcionesMedios(opciones);
    const nuevoPedido: EstadoCarritoPedido = {
      ...pedido,
      estadoInterno: 'PEDIDO_MEDIO_PAGO',
    };
    const pregunta = TEXTOS_BOT.pedidoMedioPago();
    // Un solo mensaje (resumen + pregunta) mientras cabe en el cuerpo de WhatsApp (1024 caracteres)
    const resumen = conResumen ? this.resumenAntesDePagar(pedido, contexto) : '';
    const unido = resumen ? `${resumen}\n\n${pregunta}` : pregunta;
    const cabe = unido.length <= 1000;
    const texto = cabe ? unido : pregunta;
    const acciones: AccionMensaje[] = [];
    if (resumen && !cabe) acciones.push({ tipo: 'enviarTexto', texto: resumen });
    acciones.push(
      op.filas
        ? { tipo: 'enviarLista', texto, botonTexto: 'Elegir medio de pago', filas: op.filas }
        : { tipo: 'enviarBotones', texto, botones: op.botones! },
    );

    return {
      nuevoEstado: 'PEDIDO_MEDIO_PAGO',
      acciones,
      nuevoFlujo: {
        ...flujo,
        estado: 'PEDIDO_MEDIO_PAGO',
        pedido: nuevoPedido,
      },
    };
  }

  /** Resumen con total justo antes de «¿Cómo pagarás?». Usa las mismas líneas y totales que el resumen final. */
  private resumenAntesDePagar(pedido: EstadoCarritoPedido, contexto: ContextoConversacion): string {
    const { subtotal, envio, aCobrar: total, propina, descuento, descuentoNombre, envioPromoNombre, envioGratisFalta } = calcularTotales(pedido, contexto.vistaPreviaPedido);
    const lineas = this.lineasResumen(pedido, contexto);
    const descuentoTxt = descuento > 0 ? `${TEXTOS_BOT.lineaDescuentoBot(descuentoNombre, descuento)}\n` : '';
    const envioTxt =
      pedido.modalidad !== 'DELIVERY'
        ? 'Recojo en tienda'
        : envioPromoNombre
          ? TEXTOS_BOT.lineaEnvioGratisBot(envioPromoNombre, contexto.textosPersonalizados?.chatbot_texto_envio_gratis)
          : envio === null
          ? 'Delivery: lo confirma un asesor al ubicarte'
          : envio > 0
            ? `Delivery: S/ ${envio.toFixed(2)}`
            : 'Delivery gratis';
    return (
      `🧾 *Resumen de tu pedido*\n${lineas}\n\n` +
      `Subtotal: S/ ${subtotal.toFixed(2)}\n` +
      descuentoTxt +
      `${envioTxt}\n` +
      (pedido.modalidad === 'DELIVERY' && envioGratisFalta && envioGratisFalta > 0 ? `${TEXTOS_BOT.lineaFaltaEnvioGratisBot(envioGratisFalta)}\n` : '') +
      (propina > 0 ? `Propina: S/ ${propina.toFixed(2)}\n` : '') +
      `*TOTAL: S/ ${total.toFixed(2)}*`
    );
  }

  /** Líneas del carrito: cantidad, tamaño/opciones y precio (compartido por el resumen previo y el final). */
  private lineasResumen(pedido: EstadoCarritoPedido, contexto: ContextoConversacion): string {
    const avisos = lineasAvisoResumen(pedido.items, (id) => productoDeCarta(contexto.categoriasCarta || [], id), unidadesDeTamano, contexto);
    const lineas = pedido.items
      .map((i) => {
        const detalles = detallesLinea(i);
        const detTxt = detalles.length > 0 ? ` · ${detalles.join(' · ')}` : '';
        const cant = i.cantidad > 1 ? `${i.cantidad}× ` : '';
        return `• ${cant}${i.productoNombre}${detTxt} — S/ ${i.subtotal.toFixed(2)}`;
      })
      .join('\n');
    return avisos.length ? `${lineas}\n${avisos.join('\n')}` : lineas;
  }

  // -------------------------------------------------------------------------
  // Helper: Avanzar Configuración de un Producto
  // -------------------------------------------------------------------------
  private avanzarConfiguracionProducto(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    prod: any,
    contexto: ContextoConversacion,
  ): ResultadoTransicion {
    const config = pedido.itemEnConfiguracion;
    if (!config) return this.mostrarCategorias(flujo, pedido, contexto);

    const grupos = gruposDePregunta(prod);

    // Si aún quedan grupos de opciones por responder
    if (config.grupoIndexActual < grupos.length) {
      const g = grupos[config.grupoIndexActual];
      pedido.estadoInterno = 'PEDIDO_GRUPO_OPCION';

      const esObligatorio = g.obligatorio || g.minimo > 0;
      const accionesGrupo = this.construirAccionGrupo(g);

      return {
        nuevoEstado: 'PEDIDO_GRUPO_OPCION',
        acciones: [
          {
            tipo: 'enviarTexto',
            texto: TEXTOS_BOT.pedidoPreguntarGrupo(g.nombre, esObligatorio),
          },
          ...accionesGrupo,
        ],
        nuevoFlujo: {
          ...flujo,
          estado: 'PEDIDO_GRUPO_OPCION',
          pedido,
        },
      };
    }

    // Sabores (si tiene sabores disponibles)
    if (prod?.sabores && prod.sabores.length > 0 && !prod.saboresConStock && !config.sabor) {
      pedido.estadoInterno = 'PEDIDO_SABOR';
      const botonesSabor: BotonAccion[] = prod.sabores
        .filter((s: any) => s.disponible !== false)
        .slice(0, 3)
        .map((s: any) => ({
          id: `ped_sab_${s.id}`,
          titulo: s.nombre.slice(0, 20),
        }));

      return {
        nuevoEstado: 'PEDIDO_SABOR',
        acciones: [
          {
            tipo: 'enviarBotones',
            texto: TEXTOS_BOT.pedidoPreguntarSabor(),
            botones: botonesSabor.length > 0 ? botonesSabor : [{ id: 'ped_sab_normal', titulo: 'Original' }],
          },
        ],
        nuevoFlujo: {
          ...flujo,
          estado: 'PEDIDO_SABOR',
          pedido,
        },
      };
    }

    // Cantidad
    pedido.estadoInterno = 'PEDIDO_CANTIDAD';
    return {
      nuevoEstado: 'PEDIDO_CANTIDAD',
      acciones: [
        {
          tipo: 'enviarBotones',
          texto: TEXTOS_BOT.pedidoPreguntarCantidad(config.productoNombre, lineaAvisoStock(productoDeCarta(contexto.categoriasCarta || [], config.productoId), contexto)),
          botones: this.botonesCantidad(config.productoId, contexto, config.tamanoId),
        },
      ],
      nuevoFlujo: {
        ...flujo,
        estado: 'PEDIDO_CANTIDAD',
        pedido,
      },
    };
  }

  /** Paso de combo con opciones agotadas por stock: primero una línea de aviso (plan B), luego lo que se puede elegir. */
  private construirAccionGrupo(g: any): AccionMensaje[] {
    const avisoStock: AccionMensaje[] = g.aviso ? [{ tipo: 'enviarTexto', texto: g.aviso } as AccionMensaje] : [];
    return [...avisoStock, ...this.construirAccionGrupoBase(g)];
  }

  private construirAccionGrupoBase(g: any): AccionMensaje[] {
    const esObligatorio = g.obligatorio || g.minimo > 0;
    const opciones = (g.opciones || []).filter((o: any) => o.disponible !== false);

    if (opciones.length <= 3 && esObligatorio) {
      const botones: BotonAccion[] = opciones.slice(0, 3).map((o: any) => {
        const extraTxt = o.precioExtra ? ` +S/${Number(o.precioExtra).toFixed(0)}` : '';
        return {
          id: `ped_op_${o.id}`,
          titulo: `${o.nombre}${extraTxt}`.slice(0, 20),
        };
      });
      return [{ tipo: 'enviarBotones', texto: 'Elige una opción:', botones }];
    }

    // Más de 3 opciones o es opcional -> lista interactiva
    const filas: FilaLista[] = opciones.slice(0, 9).map((o: any) => {
      const extraTxt = o.precioExtra ? ` (+S/ ${Number(o.precioExtra).toFixed(2)})` : ' (Sin costo extra)';
      return {
        id: `ped_op_${o.id}`,
        titulo: o.nombre.slice(0, 24),
        descripcion: `Opción para ${g.nombre}${extraTxt}`.slice(0, 72),
      };
    });

    if (!esObligatorio) {
      filas.push({
        id: 'ped_op_ninguno',
        titulo: 'Ninguno',
        descripcion: 'Continuar sin adicionales en este grupo',
      });
    }

    return [
      {
        tipo: 'enviarLista',
        texto: `Selecciona una opción para ${g.nombre}:`,
        botonTexto: 'Ver opciones',
        filas: filas.slice(0, 10),
      },
    ];
  }

  // -------------------------------------------------------------------------
  // Helper: Mostrar Lista de Categorías
  // -------------------------------------------------------------------------
  private mostrarCategorias(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    contexto: ContextoConversacion,
    mensajeEncabezado?: string,
  ): ResultadoTransicion {
    const categorias = contexto.categoriasCarta || [];
    const pagina = pedido.paginaCategorias || 1;
    const POR_PAGINA = 9;

    const totalPaginas = Math.ceil(categorias.length / POR_PAGINA) || 1;
    const inicio = (pagina - 1) * POR_PAGINA;
    const visibles = categorias.slice(inicio, inicio + POR_PAGINA);

    const filas: FilaLista[] = visibles.map((cat: any) => ({
      id: `ped_cat_${cat.id}`,
      titulo: cat.nombre.slice(0, 24),
      descripcion: `Ver productos de ${cat.nombre}`.slice(0, 72),
    }));

    if (pagina < totalPaginas) {
      filas.push({
        id: `ped_cat_pag_${pagina + 1}`,
        titulo: '➡️ Ver más categorías',
        descripcion: `Página ${pagina + 1} de ${totalPaginas}`,
      });
    }

    // El encabezado va como cuerpo de la lista: un solo mensaje en vez de texto + lista
    const acciones: AccionMensaje[] = [
      {
        tipo: 'enviarLista',
        texto: mensajeEncabezado ?? TEXTOS_BOT.pedidoCategoriasPrompt(),
        botonTexto: 'Ver categorías',
        filas: filas.slice(0, 10),
      },
    ];

    return {
      nuevoEstado: 'PEDIDO_CATEGORIAS',
      acciones,
      nuevoFlujo: {
        ...flujo,
        estado: 'PEDIDO_CATEGORIAS',
        pedido: {
          ...pedido,
          estadoInterno: 'PEDIDO_CATEGORIAS',
        },
      },
    };
  }

  // -------------------------------------------------------------------------
  // Helper: Mostrar Lista de Productos de una Categoría
  // -------------------------------------------------------------------------
  private mostrarProductosDeCategoria(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    categoria: any,
    contexto: ContextoConversacion,
    mensajeEncabezado?: string,
    forzarLista = false,
  ): ResultadoTransicion {
    // Más vendidos primero (los sin ventas siguen el orden de la carta)
    const productos = ordenarPorVentas(
      (categoria.productos || []).filter((p: any) => !productoAgotado(p)),
      contexto.ventasProductos,
    );

    if (productos.length === 0) {
      return {
        nuevoEstado: 'PEDIDO_CATEGORIAS',
        acciones: [
          {
            tipo: 'enviarBotones',
            texto: TEXTOS_BOT.pedidoCategoriaVacia(),
            botones: [
              { id: 'btn_categorias', titulo: 'Ver categorías' },
              BOTON_VOLVER_MENU,
            ],
          },
        ],
        nuevoFlujo: {
          ...flujo,
          estado: 'PEDIDO_CATEGORIAS',
          pedido: { ...pedido, estadoInterno: 'PEDIDO_CATEGORIAS' },
        },
      };
    }

    const pagina = pedido.paginaProductos || 1;
    const POR_PAGINA = 9;
    const totalPaginas = Math.ceil(productos.length / POR_PAGINA) || 1;
    const inicio = (pagina - 1) * POR_PAGINA;
    const visibles = productos.slice(inicio, inicio + POR_PAGINA);

    const filas: FilaLista[] = visibles.map((p: any) => {
      const precio = Number(p.precio || 0);
      const desc = p.descripcion ? ` · ${p.descripcion}` : '';
      const aviso = avisoStock({ controlaStock: true, quedan: p.quedan, nombre: p.nombre }, umbralesDe(contexto));
      return {
        id: `ped_prod_${p.id}`,
        titulo: p.nombre.slice(0, 24),
        descripcion: `S/ ${precio.toFixed(2)}${aviso ? ` · ${aviso.texto}` : desc}`.slice(0, 72),
      };
    });

    if (pagina < totalPaginas) {
      filas.push({
        id: `ped_prod_pag_${pagina + 1}`,
        titulo: '➡️ Ver más productos',
        descripcion: `Página ${pagina + 1} de ${totalPaginas}`,
      });
    }

    const acciones: AccionMensaje[] = [];
    if (mensajeEncabezado) {
      acciones.push({ tipo: 'enviarTexto', texto: mensajeEncabezado });
    }

    const lista: AccionMensaje = {
      tipo: 'enviarLista',
      texto: TEXTOS_BOT.pedidoCategoriaSeleccionada(categoria.nombre),
      botonTexto: 'Ver productos',
      filas: filas.slice(0, 10),
    };

    // Carrusel con foto: solo una página de 10 por envío (más vendidos primero); «Ver más» trae la siguiente
    if (!forzarLista && productos.length >= 2) {
      acciones.push(...this.accionesPaginaCarrusel(productos, 1, categoria, contexto, lista));
    } else {
      acciones.push(lista);
    }

    return {
      nuevoEstado: 'PEDIDO_PRODUCTOS',
      acciones,
      nuevoFlujo: {
        ...flujo,
        estado: 'PEDIDO_PRODUCTOS',
        pedido: {
          ...pedido,
          estadoInterno: 'PEDIDO_PRODUCTOS',
        },
      },
    };
  }

  /**
   * Una página (1 = favoritos) de hasta 10 productos como carrusel; si queda 1 solo va como lista.
   * Si hay más, un mensaje de botones aparte (Meta no admite botón extra dentro del carrusel) con «Ver más».
   */
  private accionesPaginaCarrusel(
    productos: any[],
    pagina: number,
    categoria: any,
    contexto: ContextoConversacion,
    listaBase: AccionMensaje,
  ): AccionMensaje[] {
    const lista: any = listaBase;
    return accionesPaginaCarruselGenerica({
      tarjetas: productos.map((p) => tarjetaProducto(p, contexto.cartaUrlPublica, lineaAvisoStock(p, contexto))),
      pagina,
      cuerpoPrimera: TEXTOS_BOT.carruselFavoritos(categoria.nombre, productos.length),
      cuerpoSiguientes: TEXTOS_BOT.carruselMasOpciones(),
      respaldoPrimera: lista?.filas ? { texto: lista.texto, botonTexto: lista.botonTexto, filas: lista.filas } : undefined,
      idVerMas: (n) => `ped_prod_mas_${n}`,
      botonTarjeta: { id: 'btn_categorias', titulo: 'Otra categoría' },
      textoVerMas: TEXTOS_BOT.carruselVerMas,
      botonesExtra: [{ id: 'ped_prod_lista', titulo: 'Ver lista completa' }, { id: 'btn_categorias', titulo: 'Ver categorías' }],
      textoLista: TEXTOS_BOT.carruselMasOpciones(),
    }) as AccionMensaje[];
  }

  // -------------------------------------------------------------------------
  // Helper: Formatear Datos de Pago Digital (Yape / Plin / Cuentas)
  // -------------------------------------------------------------------------
  private formatearDatosPago(pagosCfg: any = {}, total: number): string {
    const yapeNum = pagosCfg.yape?.numero || '999 888 777';
    const yapeTit = pagosCfg.yape?.titular || 'Caprichos';
    const plinNum = pagosCfg.plin?.numero || '999 888 777';
    const plinTit = pagosCfg.plin?.titular || 'Caprichos';
    const bcpCuenta = pagosCfg.transferencia?.cuenta || '191-xxxxxx-0-xx';
    const bcpCci = pagosCfg.transferencia?.cci || '002-191-xxxxxxxxxx';
    const transfTit = pagosCfg.transferencia?.titular || 'Caprichos';

    return (
      `📱 *Datos para realizar tu pago:*\n` +
      `• Yape: ${yapeNum} (${yapeTit})\n` +
      `• Plin: ${plinNum} (${plinTit})\n` +
      `• BCP Soles: ${bcpCuenta}\n` +
      `• CCI: ${bcpCci}\n` +
      `• Titular: ${transfTit}\n` +
      `Monto a pagar: *S/ ${total.toFixed(2)}*`
    );
  }

  // -------------------------------------------------------------------------
  // Helper: Renderizar un Estado Específico
  // -------------------------------------------------------------------------
  private renderizarEstado(
    estado: EstadoPedidoFlujo,
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    contexto: ContextoConversacion,
  ): ResultadoTransicion {
    estado = normalizarEstadoUbicacion(estado);
    pedido.estadoInterno = estado;
    switch (estado) {
      case 'PEDIDO_MODALIDAD':
        return {
          nuevoEstado: 'PEDIDO_MODALIDAD',
          acciones: [
            {
              tipo: 'enviarBotones',
              texto: TEXTOS_BOT.pedidoModalidad(),
              botones: BOTONES_PEDIDO_MODALIDAD,
            },
          ],
          nuevoFlujo: { ...flujo, estado: 'PEDIDO_MODALIDAD', pedido },
        };
      case 'PEDIDO_UBICACION':
        return this.pedirUbicacion(flujo, pedido);
      case 'PEDIDO_CATEGORIAS':
        return this.mostrarCategorias(flujo, pedido, contexto);
      case 'PEDIDO_VER_CARRITO':
      case 'PEDIDO_ACCION_CARRITO': {
        const subtotal = Number(pedido.items.reduce((s, i) => s + i.subtotal, 0).toFixed(2));
        const lineasTexto = pedido.items
          .map((i) => `• ${i.cantidad}x ${i.productoNombre} — S/ ${i.subtotal.toFixed(2)}`)
          .join('\n');
        return {
          nuevoEstado: 'PEDIDO_VER_CARRITO',
          acciones: [
            {
              tipo: 'enviarBotones',
              texto: TEXTOS_BOT.pedidoVerCarrito(lineasTexto, subtotal),
              botones: BOTONES_PEDIDO_VER_CARRITO,
            },
          ],
          nuevoFlujo: { ...flujo, estado: 'PEDIDO_VER_CARRITO', pedido },
        };
      }
      default:
        return this.mostrarCategorias(flujo, pedido, contexto);
    }
  }
}

// Función auxiliar para coincidencia de palabras
function coincideAlgunaPalabra(textoNormalizado: string, listaPalabras: string[]): boolean {
  if (!textoNormalizado) return false;
  return listaPalabras.some((palabra) => {
    const norm = normalizarTexto(palabra);
    return textoNormalizado === norm || textoNormalizado.includes(norm);
  });
}

function normalizarTexto(texto?: string | null): string {
  if (!texto) return '';
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Instancia única y registro automático
export const flujoPedido = new FlujoPedidoSubFlujo();
RegistroSubFlujos.registrar(flujoPedido);
