import {
  ContextoConversacion,
  EntradaNormalizada,
  FlujoConversacion,
  ResultadoTransicion,
} from '../../tipos-conversacion';
import { RegistroSubFlujos, SubFlujoConversacion } from '../registro-flujos';
import {
  BOTONES_PAGO_MEDIOS_CAMBIO,
  BOTONES_PAGO_RECHAZADO,
  BOTON_PAGO_VOLVER_MENU,
  TEXTOS_PAGO,
} from './textos-pago';
import {
  EstadoPagoConversacion,
  EstadoPagoFlujo,
  MAX_CAPTURAS_VOUCHER,
} from './tipos-pago';
import { BOTON_HABLAR_PERSONA, TEXTOS_BOT } from '../../textos-bot';

const PALABRAS_PERSONA = ['persona', 'humano', 'asesor', 'atencion', 'ayuda', 'operador'];
const PALABRAS_MENU = ['menu', 'volver', 'inicio', 'cancelar'];

function coincidePalabra(texto: string, lista: string[]): boolean {
  if (!texto) return false;
  return lista.some((p) => texto.includes(p));
}

export class FlujoPagoSubFlujo implements SubFlujoConversacion {
  readonly nombre = 'pago';

  puedeManejar(
    flujo: FlujoConversacion,
    entrada: EntradaNormalizada,
    contexto: ContextoConversacion,
  ): boolean {
    const estadoStr = String(flujo.estado || '');
    if (estadoStr === 'PAGO' || estadoStr.startsWith('PAGO_') || estadoStr === 'VALIDAR_PAGO') {
      return true;
    }

    if (entrada.id?.startsWith('pago_')) {
      return true;
    }

    // Si la conversación en BD está en VALIDAR_PAGO o flujo.pago está pendiente
    if (flujo.pago && flujo.pago.pedidoCodigo) {
      if (entrada.tipo === 'image' || entrada.textoOriginal) {
        return true;
      }
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

    const estadoPago = (flujo.estado as EstadoPagoFlujo) || 'PAGO_ESPERANDO_VOUCHER';
    const pagoActual: EstadoPagoConversacion = {
      capturasEnviadas: 0,
      intentosRechazo: 0,
      ...(flujo.pago || {}),
    };

    // 1. Manejo de vuelta al menú
    if (
      entrada.id === 'btn_menu' ||
      entrada.id === 'menu' ||
      coincidePalabra(entrada.texto, ['volver al menu', 'menu principal', 'inicio'])
    ) {
      return {
        nuevoEstado: 'MENU',
        acciones: [
          {
            tipo: 'enviarBotones',
            texto: 'Claro. ¿En qué te ayudo? 🧁',
            botones: [
              { id: 'pedir', titulo: 'Hacer un pedido' },
              { id: 'mipedido', titulo: 'Mi pedido' },
              BOTON_HABLAR_PERSONA,
            ],
          },
        ],
        nuevoFlujo: {
          ...flujo,
          estado: 'MENU',
          pago: pagoActual.capturasEnviadas > 0 ? pagoActual : null,
        },
      };
    }

    // 2. Hablar con una persona
    if (
      entrada.id === 'persona' ||
      entrada.id === 'btn_persona' ||
      coincidePalabra(entrada.texto, PALABRAS_PERSONA)
    ) {
      return {
        nuevoEstado: 'ATENCION_PERSONA',
        acciones: [
          {
            tipo: 'pasarAPersona',
            motivo: 'CLIENTE_SOLICITO_PERSONA_EN_PAGO',
            mensajeCliente: entrada.textoOriginal,
          },
          {
            tipo: 'enviarTexto',
            texto: TEXTOS_BOT.pasarAPersona(),
          },
        ],
        nuevoFlujo: {
          ...flujo,
          estado: 'ATENCION_PERSONA',
        },
      };
    }

    // 3. Reenviar captura tras rechazo
    if (entrada.id === 'pago_reenviar_voucher') {
      return {
        nuevoEstado: 'PAGO_ESPERANDO_VOUCHER',
        acciones: [
          {
            tipo: 'enviarTexto',
            texto: TEXTOS_PAGO.recordarEnviarImagen(),
          },
        ],
        nuevoFlujo: {
          ...flujo,
          estado: 'PAGO_ESPERANDO_VOUCHER',
          pago: pagoActual,
        },
      };
    }

    // 4. Cambiar medio de pago
    if (entrada.id === 'pago_cambiar_medio') {
      return {
        nuevoEstado: 'PAGO_CAMBIAR_MEDIO',
        acciones: [
          {
            tipo: 'enviarBotones',
            texto: TEXTOS_PAGO.elegirNuevoMedio(),
            botones: BOTONES_PAGO_MEDIOS_CAMBIO,
          },
        ],
        nuevoFlujo: {
          ...flujo,
          estado: 'PAGO_CAMBIAR_MEDIO',
          pago: pagoActual,
        },
      };
    }

    // 5. Selección de nuevo medio de pago tras cambio
    const esCambioMedio =
      estadoPago === 'PAGO_CAMBIAR_MEDIO' || entrada.id?.startsWith('pago_medio_');

    if (esCambioMedio) {
      if (entrada.id === 'pago_medio_efectivo' || entrada.texto === 'efectivo') {
        const total = pagoActual.monto || Number(contexto.pedidoActivo?.total || 0);
        const modalidad = contexto.pedidoActivo?.modalidad || 'DELIVERY';
        const textoConfirmacion = TEXTOS_PAGO.confirmarEfectivo(total, undefined, modalidad);

        return {
          nuevoEstado: 'MENU',
          acciones: [
            {
              tipo: 'enviarBotones',
              texto: textoConfirmacion,
              botones: [BOTON_PAGO_VOLVER_MENU],
            },
          ],
          nuevoFlujo: {
            ...flujo,
            estado: 'MENU',
            pago: {
              ...pagoActual,
              medio: 'EFECTIVO',
            },
          },
        };
      }

      if (
        entrada.id === 'pago_medio_tarjeta' ||
        entrada.texto === 'tarjeta' ||
        /\bpos\b/.test(entrada.texto)
      ) {
        const total = pagoActual.monto || Number(contexto.pedidoActivo?.total || 0);
        const modalidad = contexto.pedidoActivo?.modalidad || 'DELIVERY';
        const textoConfirmacion = TEXTOS_PAGO.confirmarTarjeta(total, modalidad);

        return {
          nuevoEstado: 'MENU',
          acciones: [
            {
              tipo: 'enviarBotones',
              texto: textoConfirmacion,
              botones: [BOTON_PAGO_VOLVER_MENU],
            },
          ],
          nuevoFlujo: {
            ...flujo,
            estado: 'MENU',
            pago: {
              ...pagoActual,
              medio: 'TARJETA',
            },
          },
        };
      }

      if (
        entrada.id === 'pago_medio_yape_plin' ||
        entrada.texto === 'yape' ||
        entrada.texto === 'plin'
      ) {
        const codigo = pagoActual.pedidoCodigo || contexto.pedidoActivo?.codigo || 'CP-0000';
        const total = pagoActual.monto || Number(contexto.pedidoActivo?.total || 0);
        const datosPagos = contexto.datosLocalPublicos?.mediosPagoVisibles;

        const textoDatos = TEXTOS_PAGO.datosPagoMensaje({
          codigo,
          total,
          metodo: 'YAPE',
          datosLocalPagos: datosPagos,
        });

        return {
          nuevoEstado: 'PAGO_ESPERANDO_VOUCHER',
          acciones: [
            {
              tipo: 'enviarTexto',
              texto: textoDatos,
            },
          ],
          nuevoFlujo: {
            ...flujo,
            estado: 'PAGO_ESPERANDO_VOUCHER',
            pago: {
              ...pagoActual,
              medio: 'YAPE',
            },
          },
        };
      }
    }

    // 6. Recepción de captura / comprobante (imagen)
    if (entrada.tipo === 'image' || entrada.tipo === 'imagen') {
      const capturasTotal = (pagoActual.capturasEnviadas || 0) + 1;

      // Protección: máximo 5 capturas por pedido
      if (capturasTotal > MAX_CAPTURAS_VOUCHER) {
        return {
          nuevoEstado: 'ATENCION_PERSONA',
          acciones: [
            {
              tipo: 'pasarAPersona',
              motivo: 'LIMITE_CAPTURAS_VOUCHER_SUPERADO',
              mensajeCliente: 'Superó el límite de 5 capturas para este pedido.',
            },
            {
              tipo: 'enviarTexto',
              texto: TEXTOS_PAGO.voucherLimiteSuperado(),
            },
          ],
          nuevoFlujo: {
            ...flujo,
            estado: 'ATENCION_PERSONA',
            pago: {
              ...pagoActual,
              capturasEnviadas: capturasTotal,
            },
          },
        };
      }

      // Recepción normal de voucher
      return {
        nuevoEstado: 'VALIDAR_PAGO',
        acciones: [
          {
            tipo: 'enviarTexto',
            texto: TEXTOS_PAGO.voucherRecibido(),
          },
        ],
        nuevoFlujo: {
          ...flujo,
          estado: 'VALIDAR_PAGO',
          pago: {
            ...pagoActual,
            capturasEnviadas: capturasTotal,
            timestampUltimoVoucher: Date.now(),
          },
        },
      };
    }

    // 7. Si el cliente escribe texto en lugar de enviar imagen cuando estamos esperando voucher
    if (
      estadoPago === 'PAGO_ESPERANDO_VOUCHER' ||
      estadoPago === 'PAGO_DATOS' ||
      estadoPago === 'PAGO_RECHAZADO'
    ) {
      // Si pulsa un botón desconocido o escribe texto común
      return {
        nuevoEstado: estadoPago,
        acciones: [
          {
            tipo: 'enviarTexto',
            texto: TEXTOS_PAGO.recordarEnviarImagen(),
          },
        ],
        nuevoFlujo: flujo,
      };
    }

    // 8. Protección contra botón desconocido / manipulado
    if (entrada.id?.startsWith('pago_')) {
      return {
        nuevoEstado: estadoPago,
        acciones: [
          {
            tipo: 'enviarBotones',
            texto: 'Por favor elige una opción válida para continuar con tu pago:',
            botones: BOTONES_PAGO_RECHAZADO,
          },
        ],
        nuevoFlujo: flujo,
      };
    }

    return null;
  }
}

// Auto-registro en el registro central de subflujos
export const flujoPagoSubFlujo = new FlujoPagoSubFlujo();
RegistroSubFlujos.registrar(flujoPagoSubFlujo);
