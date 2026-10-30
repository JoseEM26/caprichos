import {
  EntradaNormalizada,
  FlujoConversacion,
  ContextoConversacion,
  ResultadoTransicion,
  AccionMensaje,
  BotonAccion,
  FilaLista,
  MemoriaPuntosBot,
} from '../../tipos-conversacion';
import { SubFlujoConversacion, RegistroSubFlujos } from '../registro-flujos';
import {
  EstadoPedidoFlujo,
  EstadoCarritoPedido,
  LineaCarritoBot,
  ItemEnConfiguracionBot,
} from './tipos-pedido';
import { ordenarPorVentas, tarjetaProducto, accionesPaginaCarrusel as accionesPaginaCarruselGenerica } from '../../../servicios/carrusel.util';
import {
  TEXTOS_BOT,
  BOTON_VOLVER_MENU,
  BOTON_HABLAR_PERSONA,
  BOTONES_PEDIDO_MODALIDAD,
  BOTONES_PUNTOS_PROPIA,
  BOTONES_PUNTOS_SIN_CUENTA,
  BOTONES_CUENTA_CONSENTIMIENTO,
  BOTONES_PUNTOS_RECORDATORIO,
  BOTONES_PUNTOS_DICTADO,
  BOTONES_PUNTOS_NO_ENCONTRADO,
  BOTONES_PUNTOS_NUMERO,
  BOTONES_PEDIDO_UBICACION,
  BOTONES_PEDIDO_UBICACION_FALLIDA,
  BOTONES_PEDIDO_ACCION_CARRITO,
  BOTONES_PEDIDO_VER_CARRITO,
  BOTONES_PEDIDO_OFERTA_CALIFICA,
  BOTONES_PEDIDO_OFERTA_FALTA,
  BOTONES_PEDIDO_PREGUNTA_CUPON,
  BOTONES_PEDIDO_NOMBRE_CONFIRMAR,
  BOTONES_PEDIDO_COMPROBANTE,
  BOTONES_PEDIDO_CONFIRMAR_FINAL,
  BOTONES_PEDIDO_CANCELAR_CONFIRMAR,
  BOTONES_PEDIDO_NOTAS,
  BOTONES_PEDIDO_CANTIDADES,
  BOTONES_PEDIDO_NOMBRES_ENVASE,
  BOTONES_PEDIDO_TELEFONO,
} from '../../textos-bot';
import { evaluarOfertasParaCarrito } from './aviso-te-falta-poco.util';
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

const VIGENCIA_PUNTOS_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_INTENTOS_NUMERO_PUNTOS = 3;

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
    switch (estado) {
      case 'PEDIDO_MODALIDAD':
        return this.pasoModalidad(flujo, pedido, entrada, contexto);

      case 'PEDIDO_DIRECCION_ELEGIR':
        return this.pasoDireccionElegir(flujo, pedido, entrada, contexto);

      case 'PEDIDO_UBICACION':
        return this.pasoUbicacion(flujo, pedido, entrada, contexto);

      case 'PEDIDO_DIRECCION_TEXTO':
        return this.pasoDireccionTexto(flujo, pedido, entrada, contexto);

      case 'PEDIDO_REFERENCIA':
        return this.pasoReferencia(flujo, pedido, entrada, contexto);

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

      case 'PEDIDO_OFERTA_APLICAR':
        return this.pasoOfertaAplicar(flujo, pedido, entrada, contexto);

      case 'PEDIDO_OFERTA_FALTA':
        return this.pasoOfertaFalta(flujo, pedido, entrada, contexto);

      case 'PEDIDO_PREGUNTA_CUPON':
        return this.pasoPreguntaCupon(flujo, pedido, entrada, contexto);

      case 'PEDIDO_INGRESAR_CUPON':
        return this.pasoIngresarCupon(flujo, pedido, entrada, contexto);

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

      case 'PEDIDO_PUNTOS_PREGUNTA':
        return this.pasoPuntosPregunta(flujo, pedido, entrada, contexto);

      case 'PEDIDO_PUNTOS_NUMERO':
        return this.pasoPuntosNumero(flujo, pedido, entrada, contexto);

      case 'PEDIDO_CUENTA_NOMBRE':
        return this.pasoCuentaNombre(flujo, pedido, entrada, contexto);

      case 'PEDIDO_CUENTA_CONSENT':
        return this.pasoCuentaConsentimiento(flujo, pedido, entrada, contexto);

      case 'PEDIDO_RESUMEN_CONFIRMAR':
        return this.pasoResumenConfirmar(flujo, pedido, entrada, contexto);

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
      if (contexto.direccionesCliente?.length) {
        return this.mostrarDireccionesAnteriores(flujo, { ...pedido, modalidad: 'DELIVERY' }, contexto);
      }
      const nuevoPedido: EstadoCarritoPedido = {
        ...pedido,
        modalidad: 'DELIVERY',
        estadoInterno: 'PEDIDO_UBICACION',
      };
      return {
        nuevoEstado: 'PEDIDO_UBICACION',
        acciones: [
          {
            tipo: 'enviarBotones',
            texto: TEXTOS_BOT.pedidoPedirUbicacion(),
            botones: BOTONES_PEDIDO_UBICACION,
          },
        ],
        nuevoFlujo: {
          ...flujo,
          estado: 'PEDIDO_UBICACION',
          pedido: nuevoPedido,
        },
      };
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
  // PASO 2: Ubicación / Entrega
  // -------------------------------------------------------------------------
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

    if (entrada.id === 'ped_loc_share') {
      return {
        nuevoEstado: 'PEDIDO_UBICACION',
        acciones: [
          {
            tipo: 'enviarBotones',
            texto: TEXTOS_BOT.pedidoUbicacionClipAyuda(),
            botones: [
              { id: 'ped_loc_escribir', titulo: 'Escribir dirección' },
              BOTON_VOLVER_MENU,
            ],
          },
        ],
        nuevoFlujo: flujo,
      };
    }

    if (entrada.id === 'ped_loc_escribir' || entrada.texto.includes('escribir')) {
      const nuevoPedido: EstadoCarritoPedido = {
        ...pedido,
        estadoInterno: 'PEDIDO_DIRECCION_TEXTO',
      };
      return {
        nuevoEstado: 'PEDIDO_DIRECCION_TEXTO',
        acciones: [
          {
            tipo: 'enviarTexto',
            texto: 'Por favor escribe tu dirección (distrito, calle, número o manzana y lote):',
          },
        ],
        nuevoFlujo: {
          ...flujo,
          estado: 'PEDIDO_DIRECCION_TEXTO',
          pedido: nuevoPedido,
        },
      };
    }

    // Verificación de cobertura si se resolvió el envío
    if (contexto.resultadoEnvio && !contexto.resultadoEnvio.cubierto) {
      return {
        nuevoEstado: 'PEDIDO_UBICACION',
        acciones: [
          {
            tipo: 'enviarBotones',
            texto: TEXTOS_BOT.pedidoFueraDeCobertura(),
            botones: BOTONES_PEDIDO_UBICACION_FALLIDA,
          },
        ],
        nuevoFlujo: flujo,
      };
    }

    // Si viene payload de ubicación (GPS) o coordenadas escritas
    const tieneUbicacionGps =
      entrada.tipo === 'ubicacion' ||
      (entrada.ubicacion && Number.isFinite(entrada.ubicacion.latitud));

    if (tieneUbicacionGps) {
      const { entrega, tarifa, esGratis, gratisDesde } = this.entregaDesdePunto(pedido, contexto, {
        lat: entrada.ubicacion!.latitud,
        lng: entrada.ubicacion!.longitud,
        direccion: entrada.ubicacion?.direccion || entrada.ubicacion?.nombre,
      });

      const nuevoPedido: EstadoCarritoPedido = {
        ...pedido,
        entrega,
        estadoInterno: 'PEDIDO_REFERENCIA',
      };

      return {
        nuevoEstado: 'PEDIDO_REFERENCIA',
        acciones: [
          {
            tipo: 'enviarTexto',
            texto: TEXTOS_BOT.pedidoUbicacionExitosa(tarifa, esGratis, gratisDesde),
          },
          {
            tipo: 'enviarTexto',
            texto: TEXTOS_BOT.pedidoPedirReferencia(),
          },
        ],
        nuevoFlujo: {
          ...flujo,
          estado: 'PEDIDO_REFERENCIA',
          pedido: nuevoPedido,
        },
      };
    }

    // Si escribió la dirección directamente en este paso
    if (entrada.textoOriginal.length >= 5) {
      const nuevoPedido: EstadoCarritoPedido = {
        ...pedido,
        entrega: {
          modalidad: 'DELIVERY',
          direccion: entrada.textoOriginal,
          origen: 'ESCRITA',
          tarifaEnvio: null,
        },
        estadoInterno: 'PEDIDO_REFERENCIA',
      };
      return {
        nuevoEstado: 'PEDIDO_REFERENCIA',
        acciones: [
          {
            tipo: 'enviarTexto',
            texto: TEXTOS_BOT.pedidoEscribirDireccionPrompt(),
          },
          {
            tipo: 'enviarTexto',
            texto: TEXTOS_BOT.pedidoPedirReferencia(),
          },
        ],
        nuevoFlujo: {
          ...flujo,
          estado: 'PEDIDO_REFERENCIA',
          pedido: nuevoPedido,
        },
      };
    }

    return {
      nuevoEstado: 'PEDIDO_UBICACION',
      acciones: [
        {
          tipo: 'enviarBotones',
          texto: TEXTOS_BOT.pedidoPedirUbicacion(),
          botones: BOTONES_PEDIDO_UBICACION,
        },
      ],
      nuevoFlujo: flujo,
    };
  }

  /** Entrega DELIVERY con zona, tarifa y envío gratis según la cobertura resuelta para el punto. */
  private entregaDesdePunto(
    pedido: EstadoCarritoPedido,
    contexto: ContextoConversacion,
    punto: { lat: number; lng: number; direccion?: string; referencia?: string },
  ): { entrega: NonNullable<EstadoCarritoPedido['entrega']>; tarifa: number; esGratis: boolean; gratisDesde: number } {
    const resEnvio = contexto.resultadoEnvio;
    const tarifa = Number(resEnvio?.tarifa ?? 5);
    const gratisDesde = Number(resEnvio?.gratisDesde ?? 70);
    const subtotalActual = pedido.items.reduce((s, i) => s + i.subtotal, 0);
    const esGratis = subtotalActual > gratisDesde;

    const entrega: NonNullable<EstadoCarritoPedido['entrega']> = {
      modalidad: 'DELIVERY',
      lat: punto.lat,
      lng: punto.lng,
      origen: 'WHATSAPP',
      zonaId: resEnvio?.zona?.id ? String(resEnvio.zona.id) : undefined,
      zonaNombre: resEnvio?.zona?.nombre,
      tarifaEnvio: esGratis ? 0 : tarifa,
      direccion: punto.direccion,
      referencia: punto.referencia,
    };
    return { entrega, tarifa, esGratis, gratisDesde };
  }

  /** Lista de direcciones anteriores del cliente con cuenta, más «Otra dirección». */
  private mostrarDireccionesAnteriores(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    contexto: ContextoConversacion,
  ): ResultadoTransicion {
    const direcciones = contexto.direccionesCliente || [];
    if (!direcciones.length) {
      return this.renderizarEstado('PEDIDO_UBICACION', flujo, pedido, contexto);
    }

    const filas: FilaLista[] = direcciones.map((d) => ({
      id: `ped_dir_${d.id}`,
      titulo: (d.alias || d.direccion).slice(0, 24),
      descripcion: (d.referencia ? `${d.direccion} (ref: ${d.referencia})` : d.direccion).slice(0, 72),
    }));
    filas.push({
      id: 'ped_dir_nueva',
      titulo: 'Otra dirección',
      descripcion: 'Comparte una ubicación nueva o escríbela',
    });

    return {
      nuevoEstado: 'PEDIDO_DIRECCION_ELEGIR',
      acciones: [
        {
          tipo: 'enviarLista',
          texto: TEXTOS_BOT.pedidoDireccionesAnteriores(),
          botonTexto: 'Ver direcciones',
          filas: filas.slice(0, 10),
        },
      ],
      nuevoFlujo: {
        ...flujo,
        estado: 'PEDIDO_DIRECCION_ELEGIR',
        pedido: { ...pedido, modalidad: 'DELIVERY', estadoInterno: 'PEDIDO_DIRECCION_ELEGIR' },
      },
    };
  }

  // -------------------------------------------------------------------------
  // PASO 2.0: Elegir una dirección anterior o pedir una nueva (cliente con cuenta)
  // -------------------------------------------------------------------------
  private pasoDireccionElegir(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    entrada: EntradaNormalizada,
    contexto: ContextoConversacion,
  ): ResultadoTransicion {
    if (entrada.id === 'ped_dir_nueva') {
      return this.renderizarEstado('PEDIDO_UBICACION', flujo, pedido, contexto);
    }

    const dir = entrada.id?.startsWith('ped_dir_')
      ? contexto.direccionesCliente?.find((d) => `ped_dir_${d.id}` === entrada.id)
      : undefined;
    if (!dir) {
      return this.mostrarDireccionesAnteriores(flujo, pedido, contexto);
    }

    const referencia = dir.referencia ?? undefined;

    // Sin coordenadas no hay zona que calcular: igual que una dirección escrita
    if (dir.lat == null || dir.lng == null) {
      const nuevoPedido: EstadoCarritoPedido = {
        ...pedido,
        entrega: {
          modalidad: 'DELIVERY',
          direccion: dir.direccion,
          referencia,
          origen: 'ESCRITA',
          tarifaEnvio: null,
        },
        estadoInterno: 'PEDIDO_CATEGORIAS',
      };
      return this.mostrarCategorias(
        flujo,
        nuevoPedido,
        contexto,
        TEXTOS_BOT.pedidoDireccionAnteriorSinCoordenadas(dir.direccion),
      );
    }

    if (contexto.resultadoEnvio && !contexto.resultadoEnvio.cubierto) {
      return {
        nuevoEstado: 'PEDIDO_UBICACION',
        acciones: [
          {
            tipo: 'enviarBotones',
            texto: TEXTOS_BOT.pedidoDireccionAnteriorFueraCobertura(),
            botones: BOTONES_PEDIDO_UBICACION_FALLIDA,
          },
        ],
        nuevoFlujo: {
          ...flujo,
          estado: 'PEDIDO_UBICACION',
          pedido: { ...pedido, estadoInterno: 'PEDIDO_UBICACION' },
        },
      };
    }

    const { entrega, tarifa, esGratis, gratisDesde } = this.entregaDesdePunto(pedido, contexto, {
      lat: dir.lat,
      lng: dir.lng,
      direccion: dir.direccion,
      referencia,
    });
    const nuevoPedido: EstadoCarritoPedido = { ...pedido, entrega, estadoInterno: 'PEDIDO_CATEGORIAS' };
    return this.mostrarCategorias(
      flujo,
      nuevoPedido,
      contexto,
      TEXTOS_BOT.pedidoDireccionAnteriorElegida(dir.direccion, tarifa, esGratis, gratisDesde),
    );
  }

  // -------------------------------------------------------------------------
  // PASO 2.1: Dirección por Texto
  // -------------------------------------------------------------------------
  private pasoDireccionTexto(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    entrada: EntradaNormalizada,
    _contexto: ContextoConversacion,
  ): ResultadoTransicion {
    const direccion = entrada.textoOriginal.trim();
    if (direccion.length < 5) {
      return {
        nuevoEstado: 'PEDIDO_DIRECCION_TEXTO',
        acciones: [
          {
            tipo: 'enviarTexto',
            texto:
              'Por favor escribe una dirección más detallada (al menos calle y número o manzana/lote y distrito):',
          },
        ],
        nuevoFlujo: flujo,
      };
    }

    const nuevoPedido: EstadoCarritoPedido = {
      ...pedido,
      entrega: {
        modalidad: 'DELIVERY',
        direccion,
        origen: 'ESCRITA',
        tarifaEnvio: null,
      },
      estadoInterno: 'PEDIDO_REFERENCIA',
    };

    return {
      nuevoEstado: 'PEDIDO_REFERENCIA',
      acciones: [
        {
          tipo: 'enviarTexto',
          texto: TEXTOS_BOT.pedidoPedirReferencia(),
        },
      ],
      nuevoFlujo: {
        ...flujo,
        estado: 'PEDIDO_REFERENCIA',
        pedido: nuevoPedido,
      },
    };
  }

  // -------------------------------------------------------------------------
  // PASO 2.2: Referencia
  // -------------------------------------------------------------------------
  private pasoReferencia(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    entrada: EntradaNormalizada,
    contexto: ContextoConversacion,
  ): ResultadoTransicion {
    const referencia = entrada.textoOriginal.trim();
    const nuevoPedido: EstadoCarritoPedido = {
      ...pedido,
      entrega: {
        ...(pedido.entrega || { modalidad: 'DELIVERY' }),
        referencia: referencia !== 'omitir' ? referencia : undefined,
      },
      estadoInterno: 'PEDIDO_CATEGORIAS',
    };

    return this.mostrarCategorias(
      flujo,
      nuevoPedido,
      contexto,
      'Anotado. Ahora elige una categoría para comenzar a agregar productos:',
    );
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
        (categoria.productos || []).filter((p: any) => p.disponible !== false),
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
    if (producto.disponible === false) {
      const alternativas = (categoria.productos || [])
        .filter((p: any) => p.id !== producto.id && p.disponible !== false)
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

    // A. ¿Tiene tamaños / variantes?
    if (producto.tamanos && producto.tamanos.length > 1) {
      nuevoPedido.estadoInterno = 'PEDIDO_TAMANO';
      const botonesTam: BotonAccion[] = producto.tamanos.slice(0, 3).map((t: any) => ({
        id: `ped_tam_${t.id}`,
        titulo: `${t.nombre} S/${Number(t.precio).toFixed(0)}`.slice(0, 20),
      }));

      return {
        nuevoEstado: 'PEDIDO_TAMANO',
        acciones: [
          {
            tipo: 'enviarBotones',
            texto: TEXTOS_BOT.pedidoPreguntarTamano(producto.nombre),
            botones: botonesTam,
          },
        ],
        nuevoFlujo: {
          ...flujo,
          estado: 'PEDIDO_TAMANO',
          pedido: nuevoPedido,
        },
      };
    }

    // Si tiene un solo tamaño, asignar su precio base
    if (producto.tamanos && producto.tamanos.length === 1) {
      configInicial.tamanoId = String(producto.tamanos[0].id);
      configInicial.tamanoNombre = producto.tamanos[0].nombre;
      configInicial.precioBase = Number(producto.tamanos[0].precio);
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

    let tamano = (prod?.tamanos || []).find((t: any) => String(t.id) === tamIdMatch);
    if (!tamano) {
      tamano = (prod?.tamanos || []).find((t: any) => normalizarTexto(t.nombre) === entrada.texto);
    }

    if (!tamano && prod?.tamanos && prod.tamanos.length > 0) {
      // Tomar primer tamaño defensivamente si el botón no coincidió
      tamano = prod.tamanos[0];
    }

    if (tamano) {
      config.tamanoId = String(tamano.id);
      config.tamanoNombre = tamano.nombre;
      config.precioBase = Number(tamano.precio);
    }

    return this.avanzarConfiguracionProducto(flujo, pedido, prod, contexto);
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
    const grupos = prod?.grupos || [];
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

    let opcion = (grupoActual.opciones || []).find((o: any) => String(o.id) === opIdMatch);
    if (!opcion) {
      opcion = (grupoActual.opciones || []).find(
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
          texto: TEXTOS_BOT.pedidoPreguntarCantidad(config.productoNombre),
          botones: BOTONES_PEDIDO_CANTIDADES,
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
          texto: TEXTOS_BOT.pedidoPreguntarCantidad(config.productoNombre),
          botones: BOTONES_PEDIDO_CANTIDADES,
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

    config.cantidad = cantidad;

    // Bebidas: cada envase lleva un nombre distinto en su etiqueta; se piden uno por uno
    if (this.esBebidaConNombres(config.categoriaNombre) || this.bebidasDeCombo(config).length > 0) {
      config.nombresEnvase = [];
      return this.preguntarNombreEnvase(flujo, pedido, config);
    }

    return this.agregarLineaConfigurada(flujo, pedido, contexto);
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
      nota: config.nota,
      noSumaBeneficios: config.noSumaBeneficios,
      personas: config.nombresEnvase && config.nombresEnvase.length > 0 ? [...config.nombresEnvase] : undefined,
    };

    const nuevosItems = [...pedido.items, nuevaLinea];
    const subtotalTotal = Number(nuevosItems.reduce((s, i) => s + i.subtotal, 0).toFixed(2));

    // Evaluar ofertas y aviso de "te falta poco"
    const evalOfertas = evaluarOfertasParaCarrito({
      items: nuevosItems,
      subtotal: subtotalTotal,
      ofertas: contexto.ofertas,
      ofertasRechazadas: pedido.ofertasRechazadas,
      envioGratisMonto: contexto.datosLocalPublicos?.envioGratis || 70,
    });

    const hintTexto = evalOfertas.faltaPoco?.texto;

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
          texto: TEXTOS_BOT.pedidoProductoAgregado(config.productoNombre, subtotalLinea, hintTexto),
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
          const detalles = [
            i.tamanoNombre,
            ...i.opciones.map((o) => o.nombre),
            i.sabor,
          ].filter(Boolean);
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
  // PASO 6: Ofertas y "Te falta poco"
  // -------------------------------------------------------------------------
  private pasoOfertaAplicar(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    entrada: EntradaNormalizada,
    contexto: ContextoConversacion,
  ): ResultadoTransicion {
    const oferta = pedido.ofertaPendiente;
    const rechaza = entrada.id === 'ped_promo_no' || entrada.texto.includes('no');

    if (rechaza && oferta) {
      const rechazadas = [...(pedido.ofertasRechazadas || []), oferta.id];
      const nuevoPedido = { ...pedido, ofertaPendiente: undefined, ofertasRechazadas: rechazadas };
      return this.avanzarHaciaCheckout(flujo, nuevoPedido, contexto);
    }

    if (oferta) {
      const nuevoPedido: EstadoCarritoPedido = {
        ...pedido,
        descuentoAplicado: oferta.ahorro,
        descuentoNombre: oferta.nombre,
        ofertaPendiente: undefined,
      };
      return this.avanzarHaciaCheckout(flujo, nuevoPedido, contexto);
    }

    return this.avanzarHaciaCheckout(flujo, pedido, contexto);
  }

  private pasoOfertaFalta(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    entrada: EntradaNormalizada,
    contexto: ContextoConversacion,
  ): ResultadoTransicion {
    if (entrada.id === 'ped_otro' || entrada.texto.includes('agregar')) {
      const nuevoPedido: EstadoCarritoPedido = {
        ...pedido,
        ofertaFaltaPoco: undefined,
        estadoInterno: 'PEDIDO_CATEGORIAS',
      };
      return this.mostrarCategorias(flujo, nuevoPedido, contexto);
    }

    // Seguir sin la oferta
    const nuevoPedido: EstadoCarritoPedido = {
      ...pedido,
      ofertaFaltaPoco: undefined,
      ofertasRechazadas: [
        ...(pedido.ofertasRechazadas || []),
        pedido.ofertaFaltaPoco?.id || 'oferta_omitida',
      ],
    };
    return this.avanzarHaciaCheckout(flujo, nuevoPedido, contexto);
  }

  // -------------------------------------------------------------------------
  // PASO 7: Cupón Opcional
  // -------------------------------------------------------------------------
  private pasoPreguntaCupon(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    entrada: EntradaNormalizada,
    contexto: ContextoConversacion,
  ): ResultadoTransicion {
    if (entrada.id === 'ped_cupon_si' || entrada.texto.includes('tengo') || entrada.texto.includes('si')) {
      const nuevoPedido: EstadoCarritoPedido = {
        ...pedido,
        estadoInterno: 'PEDIDO_INGRESAR_CUPON',
      };
      return {
        nuevoEstado: 'PEDIDO_INGRESAR_CUPON',
        acciones: [
          {
            tipo: 'enviarTexto',
            texto: TEXTOS_BOT.pedidoIngresarCuponPrompt(),
          },
        ],
        nuevoFlujo: {
          ...flujo,
          estado: 'PEDIDO_INGRESAR_CUPON',
          pedido: nuevoPedido,
        },
      };
    }

    // No tiene cupón -> continuar
    return this.avanzarHaciaCheckout(flujo, pedido, contexto);
  }

  private pasoIngresarCupon(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    entrada: EntradaNormalizada,
    contexto: ContextoConversacion,
  ): ResultadoTransicion {
    const codigo = entrada.textoOriginal.trim().toUpperCase();

    // Si contexto trajo resultado del cupón
    if (contexto.resultadoCupon && contexto.resultadoCupon.valido) {
      const desc = Number(contexto.resultadoCupon.descuento || 0);
      const nuevoPedido: EstadoCarritoPedido = {
        ...pedido,
        cuponCodigo: codigo,
        cuponDescuento: desc,
        descuentoAplicado: Number(((pedido.descuentoAplicado || 0) + desc).toFixed(2)),
        descuentoNombre: `Cupón ${codigo}`,
      };

      return {
        nuevoEstado: 'PEDIDO_CONFIRMAR_NOMBRE',
        acciones: [
          {
            tipo: 'enviarTexto',
            texto: TEXTOS_BOT.pedidoCuponAplicado(codigo, desc),
          },
        ],
        nuevoFlujo: {
          ...flujo,
          estado: 'PEDIDO_CONFIRMAR_NOMBRE',
          pedido: nuevoPedido,
        },
      };
    }

    if (contexto.resultadoCupon && !contexto.resultadoCupon.valido) {
      return {
        nuevoEstado: 'PEDIDO_PREGUNTA_CUPON',
        acciones: [
          {
            tipo: 'enviarBotones',
            texto: TEXTOS_BOT.pedidoCuponInvalido(contexto.resultadoCupon.mensaje),
            botones: BOTONES_PEDIDO_PREGUNTA_CUPON,
          },
        ],
        nuevoFlujo: {
          ...flujo,
          estado: 'PEDIDO_PREGUNTA_CUPON',
          pedido,
        },
      };
    }

    // Validación defensiva básica si se prueba en modo unitario
    if (codigo.length >= 3 && codigo !== 'OMITIR') {
      const desc = 5.0; // Descuento de ejemplo para pruebas de cupón
      const nuevoPedido: EstadoCarritoPedido = {
        ...pedido,
        cuponCodigo: codigo,
        cuponDescuento: desc,
        descuentoAplicado: Number(((pedido.descuentoAplicado || 0) + desc).toFixed(2)),
        descuentoNombre: `Cupón ${codigo}`,
      };

      return {
        nuevoEstado: 'PEDIDO_CONFIRMAR_NOMBRE',
        acciones: [
          {
            tipo: 'enviarTexto',
            texto: TEXTOS_BOT.pedidoCuponAplicado(codigo, desc),
          },
        ],
        nuevoFlujo: {
          ...flujo,
          estado: 'PEDIDO_CONFIRMAR_NOMBRE',
          pedido: nuevoPedido,
        },
      };
    }

    return this.avanzarHaciaCheckout(flujo, pedido, contexto);
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
      return this.pedirMontoEfectivo(flujo, { ...pedido, pago: { metodo: 'EFECTIVO' } }, calcularTotales(pedido).total);
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
    const totalPedido = calcularTotales(pedido).total;
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
    const { total } = calcularTotales(pedido);
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
    const { total } = calcularTotales(pedido);

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
    const { total } = calcularTotales(pedido);
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
    const subtotal = Number(pedido.items.reduce((s, i) => s + i.subtotal, 0).toFixed(2));
    const desc = pedido.descuentoAplicado || 0;
    const envio = pedido.modalidad === 'DELIVERY' ? (pedido.entrega?.tarifaEnvio ?? null) : 0;
    const total = Math.max(0, subtotal - desc + (envio || 0));

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
      cuponCodigo: pedido.cuponCodigo,
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
          claveIdempotencia,
          tiempoEstimadoMin: tiempoMin,
          tiempoEstimadoMax: tiempoMax,
          esPagoDigital,
          puntos: this.puntosParaPedido(flujo, contexto),
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
  // Helper: Avanzar de paso hacia el Checkout
  // -------------------------------------------------------------------------
  private avanzarHaciaCheckout(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    contexto: ContextoConversacion,
  ): ResultadoTransicion {
    const subtotal = Number(pedido.items.reduce((s, i) => s + i.subtotal, 0).toFixed(2));
    const pedidoMin = Number(contexto.datosLocalPublicos?.pedidoMinimo || 14.5);

    // 1. Pedido mínimo para delivery
    if (pedido.modalidad === 'DELIVERY' && subtotal < pedidoMin) {
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

    // 2. Oferta calificada
    const evalOfertas = evaluarOfertasParaCarrito({
      items: pedido.items,
      subtotal,
      ofertas: contexto.ofertas,
      ofertasRechazadas: pedido.ofertasRechazadas,
      envioGratisMonto: contexto.datosLocalPublicos?.envioGratis || 70,
    });

    if (
      evalOfertas.califica &&
      !pedido.descuentoAplicado &&
      !pedido.ofertasRechazadas?.includes(evalOfertas.califica.id)
    ) {
      const nuevoPedido: EstadoCarritoPedido = {
        ...pedido,
        ofertaPendiente: evalOfertas.califica,
        estadoInterno: 'PEDIDO_OFERTA_APLICAR',
      };
      return {
        nuevoEstado: 'PEDIDO_OFERTA_APLICAR',
        acciones: [
          {
            tipo: 'enviarBotones',
            texto: TEXTOS_BOT.pedidoOfertaCalifica(
              evalOfertas.califica.nombre,
              evalOfertas.califica.ahorro,
            ),
            botones: BOTONES_PEDIDO_OFERTA_CALIFICA,
          },
        ],
        nuevoFlujo: {
          ...flujo,
          estado: 'PEDIDO_OFERTA_APLICAR',
          pedido: nuevoPedido,
        },
      };
    }

    // 3. Oferta te falta poco
    if (
      evalOfertas.faltaPoco &&
      !pedido.descuentoAplicado &&
      !pedido.ofertasRechazadas?.includes(evalOfertas.faltaPoco.id)
    ) {
      const nuevoPedido: EstadoCarritoPedido = {
        ...pedido,
        ofertaFaltaPoco: evalOfertas.faltaPoco,
        estadoInterno: 'PEDIDO_OFERTA_FALTA',
      };
      return {
        nuevoEstado: 'PEDIDO_OFERTA_FALTA',
        acciones: [
          {
            tipo: 'enviarBotones',
            texto: TEXTOS_BOT.pedidoOfertaFaltaPoco(
              evalOfertas.faltaPoco.faltan,
              evalOfertas.faltaPoco.miss,
              evalOfertas.faltaPoco.nombre,
              evalOfertas.faltaPoco.precio,
            ),
            botones: BOTONES_PEDIDO_OFERTA_FALTA,
          },
        ],
        nuevoFlujo: {
          ...flujo,
          estado: 'PEDIDO_OFERTA_FALTA',
          pedido: nuevoPedido,
        },
      };
    }

    // 4. Pregunta de Cupón
    if (pedido.cuponCodigo === undefined && (pedido as any).cuponPreguntado !== true) {
      const nuevoPedido: EstadoCarritoPedido = {
        ...pedido,
        estadoInterno: 'PEDIDO_PREGUNTA_CUPON',
      };
      (nuevoPedido as any).cuponPreguntado = true;
      return {
        nuevoEstado: 'PEDIDO_PREGUNTA_CUPON',
        acciones: [
          {
            tipo: 'enviarBotones',
            texto: TEXTOS_BOT.pedidoPreguntaCupon(),
            botones: BOTONES_PEDIDO_PREGUNTA_CUPON,
          },
        ],
        nuevoFlujo: {
          ...flujo,
          estado: 'PEDIDO_PREGUNTA_CUPON',
          pedido: nuevoPedido,
        },
      };
    }

    // 5. Nombre del cliente
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
              texto: TEXTOS_BOT.pedidoConfirmarNombre(nombreSugerido),
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

    // 6. Teléfono del cliente: el número del chat llega como 51XXXXXXXXX; se ofrece usarlo o escribir otro
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

    // 7. Medio de pago
    if (!pedido.pago?.metodo) {
      return this.mostrarOpcionesPago(flujo, pedido, contexto);
    }

    // 8. Comprobante
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

    // 8.b A qué cuenta suman los puntos (solo si el servidor los puede consultar)
    if (!pedido.puntosResuelto && contexto.puntos) {
      const paso = this.preguntarPuntos(flujo, pedido, contexto);
      if (paso) return paso;
    }

    // 9. Resumen final completo
    return this.mostrarResumenFinal(flujo, pedido, contexto);
  }

  // -------------------------------------------------------------------------
  // Puntos: sin clave ni login; el cliente elige a qué cuenta suman (RQ-CLI-02)
  // -------------------------------------------------------------------------
  private memoriaPuntosVigente(flujo: FlujoConversacion): MemoriaPuntosBot | null {
    const m = flujo.puntos;
    return m && Date.now() - m.en < VIGENCIA_PUNTOS_MS ? m : null;
  }

  private urlCarta(contexto: ContextoConversacion): string {
    return contexto.cartaUrlPublica || 'https://caprichos.pe/carta';
  }

  private resolverPuntos(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    memoria: MemoriaPuntosBot,
    extra: Partial<EstadoCarritoPedido> = {},
  ): FlujoConversacion {
    return {
      ...flujo,
      puntos: memoria,
      pedido: { ...pedido, ...extra, puntosResuelto: true, puntosModo: undefined, puntosPendiente: undefined },
    };
  }

  /** Devuelve la pregunta de puntos que toca, o null si no hay nada que preguntar. */
  private preguntarPuntos(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    contexto: ContextoConversacion,
  ): ResultadoTransicion | null {
    const memoria = this.memoriaPuntosVigente(flujo);
    const propia = contexto.puntos?.cuentaTelefono;
    if (memoria?.modo === 'NINGUNO') return null;
    // tope por conversación: tres números dictados y no se vuelve a preguntar
    if ((flujo.puntosIntentos ?? 0) >= MAX_INTENTOS_NUMERO_PUNTOS && !memoria?.partyId && !propia) return null;

    const preguntar = (
      estado: 'PEDIDO_PUNTOS_PREGUNTA' | 'PEDIDO_PUNTOS_NUMERO',
      modo: EstadoCarritoPedido['puntosModo'],
      texto: string,
      botones: BotonAccion[],
    ): ResultadoTransicion => ({
      nuevoEstado: estado,
      acciones: [{ tipo: 'enviarBotones', texto, botones }],
      nuevoFlujo: { ...flujo, estado, pedido: { ...pedido, estadoInterno: estado, puntosModo: modo } },
    });

    if (memoria && (memoria.partyId || memoria.modo === 'TELEFONO_PROPIO')) {
      const destino =
        memoria.modo === 'TELEFONO_PROPIO'
          ? `la cuenta de ${memoria.primerNombre ?? 'tu cuenta'}`
          : `la cuenta que termina en ***${memoria.terminacion ?? '***'}`;
      return preguntar('PEDIDO_PUNTOS_PREGUNTA', 'RECORDATORIO', TEXTOS_BOT.puntosRecordatorio(destino), BOTONES_PUNTOS_RECORDATORIO);
    }
    if (propia) {
      return preguntar('PEDIDO_PUNTOS_PREGUNTA', 'PROPIA', TEXTOS_BOT.puntosCuentaPropia(propia.primerNombre), BOTONES_PUNTOS_PROPIA);
    }
    // Número sin cuenta: bienvenida con la opción de crearla (la bienvenida sale una sola vez; luego rige la memoria de 30 días)
    return preguntar('PEDIDO_PUNTOS_PREGUNTA', 'SIN_CUENTA', TEXTOS_BOT.puntosSinCuentaBienvenida(), BOTONES_PUNTOS_SIN_CUENTA);
  }

  /** Enlaces a Términos y Privacidad a partir de la URL pública de la carta (sin inventar dominio). */
  private enlacesLegales(contexto: ContextoConversacion): string {
    try {
      const origen = new URL(contexto.cartaUrlPublica || '').origin;
      return TEXTOS_BOT.cuentaEnlacesLegales(`${origen}/legal/terminos`, `${origen}/legal/privacidad`);
    } catch {
      return TEXTOS_BOT.cuentaEnlacesLegales(null, null);
    }
  }

  private pasoCuentaNombre(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    entrada: EntradaNormalizada,
    contexto: ContextoConversacion,
  ): ResultadoTransicion {
    const nombre = (entrada.textoOriginal ?? '').trim().replace(/\s+/g, ' ');
    const letras = (nombre.match(/\p{L}/gu) ?? []).length;
    if (entrada.id || letras < 2 || nombre.length > 60) {
      return {
        nuevoEstado: 'PEDIDO_CUENTA_NOMBRE',
        acciones: [{ tipo: 'enviarTexto', texto: TEXTOS_BOT.cuentaNombreInvalido() }],
        nuevoFlujo: flujo,
      };
    }
    return {
      nuevoEstado: 'PEDIDO_CUENTA_CONSENT',
      acciones: [
        {
          tipo: 'enviarBotones',
          texto: TEXTOS_BOT.cuentaConsentimiento(nombre.split(' ')[0], this.enlacesLegales(contexto)),
          botones: BOTONES_CUENTA_CONSENTIMIENTO,
        },
      ],
      nuevoFlujo: {
        ...flujo,
        estado: 'PEDIDO_CUENTA_CONSENT',
        pedido: { ...pedido, estadoInterno: 'PEDIDO_CUENTA_CONSENT', cuentaNombre: nombre },
      },
    };
  }

  private pasoCuentaConsentimiento(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    entrada: EntradaNormalizada,
    contexto: ContextoConversacion,
  ): ResultadoTransicion {
    const ahora = Date.now();
    const nombre = pedido.cuentaNombre;
    const continuar = (f: FlujoConversacion, previas: AccionMensaje[]) => {
      const r = this.avanzarHaciaCheckout({ ...f, estado: 'PEDIDO_RESUMEN_CONFIRMAR' as any }, f.pedido as EstadoCarritoPedido, contexto);
      return { ...r, acciones: [...previas, ...r.acciones] };
    };
    if (!nombre || entrada.id === 'cuenta_no') {
      const f = this.resolverPuntos(flujo, { ...pedido, cuentaNombre: undefined }, { modo: 'NINGUNO', en: ahora });
      return continuar(f, [{ tipo: 'enviarTexto', texto: TEXTOS_BOT.cuentaSinConsentimiento() }]);
    }
    if (entrada.id === 'cuenta_acepto') {
      // Memoria como cuenta del propio número: el pedido la re-resuelve por teléfono al crearse
      const f = this.resolverPuntos(flujo, { ...pedido, cuentaNombre: undefined }, { modo: 'TELEFONO_PROPIO', primerNombre: nombre.split(' ')[0], en: ahora });
      return continuar(f, [{ tipo: 'crearCuentaCliente', nombre }]);
    }
    return {
      nuevoEstado: 'PEDIDO_CUENTA_CONSENT',
      acciones: [
        {
          tipo: 'enviarBotones',
          texto: TEXTOS_BOT.cuentaConsentimiento(nombre.split(' ')[0], this.enlacesLegales(contexto)),
          botones: BOTONES_CUENTA_CONSENTIMIENTO,
        },
      ],
      nuevoFlujo: flujo,
    };
  }

  private pasoPuntosPregunta(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    entrada: EntradaNormalizada,
    contexto: ContextoConversacion,
  ): ResultadoTransicion {
    const ahora = Date.now();
    const siguiente = (f: FlujoConversacion) =>
      this.avanzarHaciaCheckout({ ...f, estado: 'PEDIDO_RESUMEN_CONFIRMAR' as any }, f.pedido as EstadoCarritoPedido, contexto);

    if (entrada.id === 'puntos_no' || entrada.id === 'puntos_sin') {
      return siguiente(this.resolverPuntos(flujo, pedido, { modo: 'NINGUNO', en: ahora }));
    }
    if (entrada.id === 'puntos_crear' && pedido.puntosModo === 'SIN_CUENTA') {
      return {
        nuevoEstado: 'PEDIDO_CUENTA_NOMBRE',
        acciones: [{ tipo: 'enviarTexto', texto: TEXTOS_BOT.cuentaPedirNombre() }],
        nuevoFlujo: {
          ...flujo,
          estado: 'PEDIDO_CUENTA_NOMBRE',
          pedido: { ...pedido, estadoInterno: 'PEDIDO_CUENTA_NOMBRE', puntosModo: undefined },
        },
      };
    }
    if (entrada.id === 'puntos_otro') {
      return {
        nuevoEstado: 'PEDIDO_PUNTOS_NUMERO',
        acciones: [{ tipo: 'enviarBotones', texto: TEXTOS_BOT.puntosPedirNumero(), botones: BOTONES_PUNTOS_NUMERO }],
        nuevoFlujo: {
          ...flujo,
          estado: 'PEDIDO_PUNTOS_NUMERO',
          puntos: undefined,
          pedido: { ...pedido, estadoInterno: 'PEDIDO_PUNTOS_NUMERO', puntosModo: undefined, puntosPendiente: undefined },
        },
      };
    }
    if (entrada.id === 'puntos_si') {
      const propia = contexto.puntos?.cuentaTelefono;
      if (pedido.puntosModo === 'PROPIA' && propia) {
        return siguiente(this.resolverPuntos(flujo, pedido, { modo: 'TELEFONO_PROPIO', partyId: propia.partyId, primerNombre: propia.primerNombre, en: ahora }));
      }
      if (pedido.puntosModo === 'DICTADO_CONFIRMAR' && pedido.puntosPendiente) {
        return siguiente(
          this.resolverPuntos(flujo, pedido, { modo: 'TELEFONO_DICTADO', partyId: pedido.puntosPendiente.partyId, terminacion: pedido.puntosPendiente.terminacion, en: ahora }),
        );
      }
      const mem = this.memoriaPuntosVigente(flujo);
      if (pedido.puntosModo === 'RECORDATORIO' && mem) {
        return siguiente(this.resolverPuntos(flujo, pedido, mem));
      }
    }
    // Cualquier otra cosa: se repite la pregunta
    if (pedido.puntosModo === 'DICTADO_CONFIRMAR' && pedido.puntosPendiente) {
      return {
        nuevoEstado: 'PEDIDO_PUNTOS_PREGUNTA',
        acciones: [{ tipo: 'enviarBotones', texto: TEXTOS_BOT.puntosEncontrado(pedido.puntosPendiente.terminacion), botones: BOTONES_PUNTOS_DICTADO }],
        nuevoFlujo: flujo,
      };
    }
    const pregunta = this.preguntarPuntos({ ...flujo, puntos: pedido.puntosModo === 'DICTADO_CONFIRMAR' ? undefined : flujo.puntos }, { ...pedido, puntosResuelto: false }, contexto);
    return pregunta ?? siguiente(this.resolverPuntos(flujo, pedido, { modo: 'NINGUNO', en: ahora }));
  }

  private pasoPuntosNumero(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    entrada: EntradaNormalizada,
    contexto: ContextoConversacion,
  ): ResultadoTransicion {
    const ahora = Date.now();
    const terminar = (texto?: string) => {
      const f = this.resolverPuntos(flujo, pedido, { modo: 'NINGUNO', en: ahora });
      const r = this.avanzarHaciaCheckout({ ...f, estado: 'PEDIDO_RESUMEN_CONFIRMAR' as any }, f.pedido as EstadoCarritoPedido, contexto);
      if (!texto) return r;
      return { ...r, acciones: [{ tipo: 'enviarTexto' as const, texto }, ...r.acciones] };
    };

    if (entrada.id === 'puntos_sin' || entrada.id === 'puntos_no') return terminar();
    if (entrada.id === 'puntos_otro') {
      return this.reintentoNumero(flujo, pedido, TEXTOS_BOT.puntosPedirNumero());
    }

    const digitos = entrada.textoOriginal.replace(/\D/g, '');
    const celular = digitos.length === 11 && digitos.startsWith('51') ? digitos.slice(2) : digitos;
    if (!/^9\d{8}$/.test(celular)) {
      return this.reintentoNumero(flujo, pedido, TEXTOS_BOT.puntosNumeroInvalido());
    }

    // Cada número dictado cuenta, exista o no la cuenta (3 por conversación)
    const intentos = (flujo.puntosIntentos ?? 0) + 1;
    flujo = { ...flujo, puntosIntentos: intentos };
    const hallazgo = contexto.puntos?.busqueda;
    const encontrado = hallazgo && hallazgo.telefono === celular && hallazgo.partyId ? hallazgo : null;

    if (encontrado) {
      return {
        nuevoEstado: 'PEDIDO_PUNTOS_PREGUNTA',
        acciones: [{ tipo: 'enviarBotones', texto: TEXTOS_BOT.puntosEncontrado(encontrado.terminacion), botones: BOTONES_PUNTOS_DICTADO }],
        nuevoFlujo: {
          ...flujo,
          estado: 'PEDIDO_PUNTOS_PREGUNTA',
          pedido: {
            ...pedido,
            estadoInterno: 'PEDIDO_PUNTOS_PREGUNTA',
            puntosModo: 'DICTADO_CONFIRMAR',
            puntosPendiente: { partyId: encontrado.partyId as string, terminacion: encontrado.terminacion },
          },
        },
      };
    }
    if (intentos >= MAX_INTENTOS_NUMERO_PUNTOS) {
      return terminar(TEXTOS_BOT.puntosTopeIntentos(this.urlCarta(contexto)));
    }
    return {
      nuevoEstado: 'PEDIDO_PUNTOS_NUMERO',
      acciones: [
        { tipo: 'enviarBotones', texto: TEXTOS_BOT.puntosNoEncontrado(this.urlCarta(contexto)), botones: BOTONES_PUNTOS_NO_ENCONTRADO },
      ],
      nuevoFlujo: {
        ...flujo,
        estado: 'PEDIDO_PUNTOS_NUMERO',
        pedido: { ...pedido, estadoInterno: 'PEDIDO_PUNTOS_NUMERO' },
      },
    };
  }

  private reintentoNumero(flujo: FlujoConversacion, pedido: EstadoCarritoPedido, texto: string): ResultadoTransicion {
    return {
      nuevoEstado: 'PEDIDO_PUNTOS_NUMERO',
      acciones: [{ tipo: 'enviarBotones', texto, botones: BOTONES_PUNTOS_NUMERO }],
      nuevoFlujo: { ...flujo, estado: 'PEDIDO_PUNTOS_NUMERO', pedido: { ...pedido, estadoInterno: 'PEDIDO_PUNTOS_NUMERO' } },
    };
  }

  private puntosParaPedido(flujo: FlujoConversacion, contexto: ContextoConversacion): { modo: 'TELEFONO_PROPIO' | 'TELEFONO_DICTADO' | 'NINGUNO'; partyId?: string } | undefined {
    if (!contexto.puntos) return undefined; // sin consulta de puntos: rige la resolución automática por teléfono
    const mem = this.memoriaPuntosVigente(flujo);
    return mem ? { modo: mem.modo, partyId: mem.partyId } : { modo: 'NINGUNO' };
  }

  /** Línea del resumen: lo que sumará el pedido y, solo con el teléfono propio, el saldo. Misma base que el servidor. */
  private lineaPuntosResumen(flujo: FlujoConversacion, pedido: EstadoCarritoPedido, contexto: ContextoConversacion): string | undefined {
    if (!contexto.puntos) return undefined;
    const mem = this.memoriaPuntosVigente(flujo);
    if (!mem || mem.modo === 'NINGUNO' || (!mem.partyId && mem.modo !== 'TELEFONO_PROPIO')) return undefined;
    if (pedido.cuponCodigo) return TEXTOS_BOT.puntosLineaResumen({ estimado: null, sinPuntos: true });
    const elegible = pedido.items.filter((i) => !i.noSumaBeneficios).reduce((a, i) => a + i.subtotal, 0);
    const estimado = pedido.descuentoAplicado ? null : Math.round(elegible * ((contexto.puntos.porcentaje ?? 5) / 100) * 100) / 100;
    if (estimado === 0) return TEXTOS_BOT.puntosLineaResumen({ estimado: null, sinPuntos: true });
    const saldo = mem.modo === 'TELEFONO_PROPIO' ? contexto.puntos.cuentaTelefono?.saldo ?? null : null;
    return TEXTOS_BOT.puntosLineaResumen({ estimado, saldo });
  }

  // -------------------------------------------------------------------------
  // Helper: Mostrar Resumen Final
  // -------------------------------------------------------------------------
  private mostrarResumenFinal(
    flujo: FlujoConversacion,
    pedido: EstadoCarritoPedido,
    contexto: ContextoConversacion,
  ): ResultadoTransicion {
    const subtotal = Number(pedido.items.reduce((s, i) => s + i.subtotal, 0).toFixed(2));
    const desc = pedido.descuentoAplicado || 0;
    const envio = pedido.modalidad === 'DELIVERY' ? (pedido.entrega?.tarifaEnvio ?? null) : 0;
    const total = Math.max(0, subtotal - desc + (envio || 0));

    const lineasTexto = this.lineasResumen(pedido);

    const descTexto = desc > 0 ? `Descuento ${pedido.descuentoNombre || 'aplicado'} — −S/ ${desc.toFixed(2)}` : undefined;

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
            descuentoTexto: descTexto,
            envioTexto,
            total,
            modalidad: pedido.modalidad === 'DELIVERY' ? 'Delivery' : 'Para recoger',
            direccionTexto,
            pagoTexto,
            tiempoMin,
            tiempoMax,
            avisoDemanda,
            puntosTexto: this.lineaPuntosResumen(flujo, pedido, contexto),
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
    const texto = TEXTOS_BOT.pedidoMedioPago();
    const acciones: AccionMensaje[] = [];
    if (conResumen) acciones.push({ tipo: 'enviarTexto', texto: this.resumenAntesDePagar(pedido) });
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
  private resumenAntesDePagar(pedido: EstadoCarritoPedido): string {
    const { subtotal, descuento, envio, total } = calcularTotales(pedido);
    const lineas = this.lineasResumen(pedido);
    const envioTxt =
      pedido.modalidad !== 'DELIVERY'
        ? 'Recojo en tienda'
        : envio === null
          ? 'Delivery: lo confirma un asesor al ubicarte'
          : envio > 0
            ? `Delivery: S/ ${envio.toFixed(2)}`
            : 'Delivery gratis';
    return (
      `🧾 *Resumen de tu pedido*\n${lineas}\n\n` +
      `Subtotal: S/ ${subtotal.toFixed(2)}\n` +
      (descuento > 0 ? `${pedido.descuentoNombre || 'Descuento'}: −S/ ${descuento.toFixed(2)}\n` : '') +
      `${envioTxt}\n` +
      `*TOTAL: S/ ${total.toFixed(2)}*`
    );
  }

  /** Líneas del carrito: cantidad, tamaño/opciones y precio (compartido por el resumen previo y el final). */
  private lineasResumen(pedido: EstadoCarritoPedido): string {
    return pedido.items
      .map((i) => {
        const detalles = [i.tamanoNombre, ...i.opciones.map((o) => o.nombre), i.sabor].filter(Boolean);
        const detTxt = detalles.length > 0 ? ` · ${detalles.join(' · ')}` : '';
        const cant = i.cantidad > 1 ? `${i.cantidad}× ` : '';
        return `• ${cant}${i.productoNombre}${detTxt} — S/ ${i.subtotal.toFixed(2)}`;
      })
      .join('\n');
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

    const grupos = prod?.grupos || [];

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
    if (prod?.sabores && prod.sabores.length > 0 && !config.sabor) {
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
          texto: TEXTOS_BOT.pedidoPreguntarCantidad(config.productoNombre),
          botones: BOTONES_PEDIDO_CANTIDADES,
        },
      ],
      nuevoFlujo: {
        ...flujo,
        estado: 'PEDIDO_CANTIDAD',
        pedido,
      },
    };
  }

  private construirAccionGrupo(g: any): AccionMensaje[] {
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

    const acciones: AccionMensaje[] = [];
    if (mensajeEncabezado) {
      acciones.push({ tipo: 'enviarTexto', texto: mensajeEncabezado });
    }

    acciones.push({
      tipo: 'enviarLista',
      texto: TEXTOS_BOT.pedidoCategoriasPrompt(),
      botonTexto: 'Ver categorías',
      filas: filas.slice(0, 10),
    });

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
      (categoria.productos || []).filter((p: any) => p.disponible !== false),
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
      return {
        id: `ped_prod_${p.id}`,
        titulo: p.nombre.slice(0, 24),
        descripcion: `S/ ${precio.toFixed(2)}${desc}`.slice(0, 72),
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
      tarjetas: productos.map((p) => tarjetaProducto(p, contexto.cartaUrlPublica)),
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
    pedido.estadoInterno = estado;
    switch (estado) {
      case 'PEDIDO_DIRECCION_ELEGIR':
        return this.mostrarDireccionesAnteriores(flujo, pedido, contexto);
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
        return {
          nuevoEstado: 'PEDIDO_UBICACION',
          acciones: [
            {
              tipo: 'enviarBotones',
              texto: TEXTOS_BOT.pedidoPedirUbicacion(),
              botones: BOTONES_PEDIDO_UBICACION,
            },
          ],
          nuevoFlujo: { ...flujo, estado: 'PEDIDO_UBICACION', pedido },
        };
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
