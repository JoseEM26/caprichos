import {
  AccionEnviarBotones,
  AccionEnviarTexto,
  AccionMensaje,
  ContextoConversacion,
  EntradaNormalizada,
  FlujoConversacion,
  ResultadoTransicion,
} from '../../tipos-conversacion';
import { RegistroSubFlujos, SubFlujoConversacion } from '../registro-flujos';
import {
  BOTONES_CAMBIO_CONFIRMAR_DIR,
  BOTONES_CAMBIO_CONFIRMAR_PED,
  BOTONES_CAMBIO_NO_PERMITIDO,
  BOTONES_CAMBIO_UBICACION_FALLIDA,
  TEXTOS_CAMBIOS,
} from './textos-cambios';
import { DatosCambioBot, EstadoFlujoCambios } from './tipos-cambios';

const BOTON_VOLVER_MENU = { id: 'menu', titulo: 'Volver al menú' };

const PALABRAS_CAMBIO_DIR = [
  'cambiar direccion',
  'cambio de direccion',
  'otra direccion',
  'nueva direccion',
  'mal la direccion',
  'me mude',
  'llevalo a',
  'en otro lado',
  'cambiar ubicacion',
];

const PALABRAS_CAMBIO_PED = [
  'cambiar pedido',
  'cambio de pedido',
  'cancelar pedido',
  'anular pedido',
  'ya no quiero',
  'quitar producto',
  'cambiar producto',
  'modificar pedido',
];

function coincideAlguna(texto: string, lista: string[]): boolean {
  return lista.some((palabra) => {
    const regex = new RegExp(`(^|\\s)${palabra}(\\s|$)`, 'i');
    return regex.test(texto) || texto === palabra || texto.includes(palabra);
  });
}

export class FlujoCambiosSubFlujo implements SubFlujoConversacion {
  readonly nombre = 'cambios';

  puedeManejar(
    flujo: FlujoConversacion,
    entrada: EntradaNormalizada,
    contexto: ContextoConversacion,
  ): boolean {
    const estadoInterno = flujo.cambios?.estadoInterno;
    if (estadoInterno && estadoInterno.startsWith('CAMBIO_')) {
      return true;
    }

    // Si la conversación está en MI_PEDIDO_DETALLE y pulsa c_dir, la máquina principal maneja la derivación
    // directa con los textos del catálogo oficial (mockup líneas 272-275).
    if (flujo.estado === 'MI_PEDIDO_DETALLE' && entrada.id === 'c_dir') {
      return false;
    }

    const id = entrada.id;
    if (id === 'c_dir' || id === 'c_ped') {
      return true;
    }

    if (id && (id.startsWith('c_dir_') || id.startsWith('c_ped_'))) {
      return true;
    }

    // Detección por texto libre si hay pedido activo y no está en otros subflujos
    if (contexto.pedidoActivo && !flujo.pedido && !flujo.reserva && !flujo.pago) {
      const texto = entrada.texto.toLowerCase();
      if (coincideAlguna(texto, PALABRAS_CAMBIO_DIR) || coincideAlguna(texto, PALABRAS_CAMBIO_PED)) {
        return true;
      }
    }

    return false;
  }

  transicionar(
    flujo: FlujoConversacion,
    entrada: EntradaNormalizada,
    contexto: ContextoConversacion,
  ): ResultadoTransicion | null {
    const id = entrada.id;
    const texto = entrada.texto;

    // 1. Comando global de escape: Volver al menú
    if (id === 'menu' || id === 'btn_menu' || texto === 'menu' || texto === 'volver al menu') {
      return {
        nuevoEstado: 'MENU',
        acciones: [],
        nuevoFlujo: {
          ...flujo,
          cambios: null,
          repreguntasFallidas: 0,
        },
      };
    }

    // 2. Si no hay estado interno activo de cambios, iniciar según intención
    if (!flujo.cambios?.estadoInterno) {
      const esCambioDir = id === 'c_dir' || coincideAlguna(texto, PALABRAS_CAMBIO_DIR);
      const esCambioPed = id === 'c_ped' || coincideAlguna(texto, PALABRAS_CAMBIO_PED);

      if (!esCambioDir && !esCambioPed) {
        return null;
      }

      // Validación de pedido activo existente
      const pedido = contexto.pedidoActivo;
      if (!pedido) {
        return {
          nuevoEstado: 'MENU',
          acciones: [
            {
              tipo: 'enviarBotones',
              texto: 'No encuentro un pedido activo asociado a tu número. ¿Deseas hacer uno ahora?',
              botones: [
                { id: 'pedir', titulo: 'Hacer un pedido' },
                BOTON_VOLVER_MENU,
              ],
            },
          ],
          nuevoFlujo: {
            ...flujo,
            cambios: null,
            repreguntasFallidas: 0,
          },
        };
      }

      // Seguridad: Validar que el pedido pertenece al cliente por teléfono
      if (pedido.cliente_telefono && contexto.telefonoCliente) {
        const normTelPedido = pedido.cliente_telefono.replace(/\D/g, '');
        const normTelCtx = contexto.telefonoCliente.replace(/\D/g, '');
        if (normTelPedido && normTelCtx && !normTelPedido.endsWith(normTelCtx) && !normTelCtx.endsWith(normTelPedido)) {
          return {
            nuevoEstado: 'MENU',
            acciones: [
              {
                tipo: 'enviarBotones',
                texto: 'No encontramos un pedido activo asociado a tu número.',
                botones: [
                  { id: 'pedir', titulo: 'Hacer un pedido' },
                  BOTON_VOLVER_MENU,
                ],
              },
            ],
            nuevoFlujo: {
              ...flujo,
              cambios: null,
              repreguntasFallidas: 0,
            },
          };
        }
      }

      const st = String(pedido.estado || 'COLA').toUpperCase();
      const esEnRuta = st === 'EN_CAMINO' || st === 'RUTA';

      // En modo asistido: un pedido ya en PREPARANDO/LISTO/EN_CAMINO se registra igual la solicitud (Regla 2).
      // Solo pedidos ya ENTREGADOS o CANCELADOS se rechazan directamente.
      if (contexto.modoAsistido && (st === 'ENTREGADO' || st === 'CANCELADO')) {
        return {
          nuevoEstado: 'ATENCION_PERSONA',
          acciones: [
            {
              tipo: 'enviarBotones',
              texto: TEXTOS_CAMBIOS.cambioNoPermitidoEstado(pedido.codigo, st, false),
              botones: BOTONES_CAMBIO_NO_PERMITIDO,
            },
          ],
          nuevoFlujo: {
            ...flujo,
            estado: 'ATENCION_PERSONA',
            cambios: null,
            repreguntasFallidas: 0,
          },
        };
      }

      // Regla de estado regular: Solo se puede pedir cambio si está en COLA o PREPARANDO
      if (!contexto.modoAsistido && st !== 'COLA' && st !== 'PREPARANDO') {
        const motivo = esEnRuta
          ? (esCambioDir ? 'CAMBIO_DIRECCION_URGENTE' : 'CAMBIO_PEDIDO_EN_RUTA')
          : 'CAMBIO_ESTADO_NO_PERMITIDO';
        return {
          nuevoEstado: 'ATENCION_PERSONA',
          acciones: [
            {
              tipo: 'pasarAPersona',
              motivo,
              mensajeCliente: entrada.textoOriginal,
              esUrgente: esEnRuta,
            },
            {
              tipo: 'enviarBotones',
              texto: TEXTOS_CAMBIOS.cambioNoPermitidoEstado(pedido.codigo, st, esEnRuta),
              botones: BOTONES_CAMBIO_NO_PERMITIDO,
            },
          ],
          nuevoFlujo: {
            ...flujo,
            estado: 'ATENCION_PERSONA',
            cambios: null,
            repreguntasFallidas: 0,
          },
        };
      }

      // Regla de modalidad: Cambio de dirección solo para DELIVERY
      const modalidad = String(pedido.modalidad || pedido.tipo_entrega || '').toUpperCase();
      if (esCambioDir && modalidad !== 'DELIVERY') {
        return {
          nuevoEstado: 'MENU',
          acciones: [
            {
              tipo: 'enviarBotones',
              texto: TEXTOS_CAMBIOS.cambioNoEsDelivery(pedido.codigo),
              botones: BOTONES_CAMBIO_NO_PERMITIDO,
            },
          ],
          nuevoFlujo: {
            ...flujo,
            cambios: null,
            repreguntasFallidas: 0,
          },
        };
      }

      // Regla de límite: Máximo 2 solicitudes de cambio por pedido
      const solicitudesPrevias = Array.isArray(pedido.solicitudesCambio)
        ? pedido.solicitudesCambio.length
        : ((pedido as any).solicitudes_cambio_count ?? 0);
      if (solicitudesPrevias >= 2) {
        return {
          nuevoEstado: 'ATENCION_PERSONA',
          acciones: [
            {
              tipo: 'pasarAPersona',
              motivo: 'LIMITE_CAMBIOS_PEDIDO_ALCANZADO',
              mensajeCliente: entrada.textoOriginal,
            },
            {
              tipo: 'enviarBotones',
              texto: TEXTOS_CAMBIOS.limiteCambiosPorPedido(pedido.codigo),
              botones: BOTONES_CAMBIO_NO_PERMITIDO,
            },
          ],
          nuevoFlujo: {
            ...flujo,
            estado: 'ATENCION_PERSONA',
            cambios: null,
            repreguntasFallidas: 0,
          },
        };
      }

      // Regla de seguridad: Máximo 3 solicitudes abiertas por teléfono
      const abiertasTelefono = contexto.solicitudesCambioPendientesTelefono ?? 0;
      if (abiertasTelefono >= 3) {
        return {
          nuevoEstado: 'MENU',
          acciones: [
            {
              tipo: 'enviarBotones',
              texto: TEXTOS_CAMBIOS.limiteSolicitudesAbiertasTelefono(),
              botones: [BOTON_VOLVER_MENU],
            },
          ],
          nuevoFlujo: {
            ...flujo,
            cambios: null,
            repreguntasFallidas: 0,
          },
        };
      }

      // Inicialización de flujo de cambio de dirección
      if (esCambioDir) {
        const datos: DatosCambioBot = {
          pedidoId: String(pedido.id),
          pedidoCodigo: pedido.codigo,
          tipo: 'DIRECCION',
          modalidad: pedido.modalidad,
          estadoPedido: st,
          tarifaActual: Number(pedido.envio || 0),
        };

        return {
          nuevoEstado: 'CAMBIO_DIR_UBICACION',
          acciones: [
            {
              tipo: 'enviarTexto',
              texto: TEXTOS_CAMBIOS.pedirNuevaUbicacion(pedido.codigo),
            },
          ],
          nuevoFlujo: {
            ...flujo,
            estado: 'CAMBIO_DIR_UBICACION',
            cambios: {
              estadoInterno: 'CAMBIO_DIR_UBICACION',
              datos,
            },
            repreguntasFallidas: 0,
          },
        };
      }

      // Inicialización de flujo de cambio / cancelación de pedido
      const datos: DatosCambioBot = {
        pedidoId: String(pedido.id),
        pedidoCodigo: pedido.codigo,
        tipo: 'PEDIDO',
        modalidad: pedido.modalidad,
        estadoPedido: st,
      };

      return {
        nuevoEstado: 'CAMBIO_PED_DETALLE',
        acciones: [
          {
            tipo: 'enviarTexto',
            texto: TEXTOS_CAMBIOS.pedirDetalleCambioPedido(pedido.codigo),
          },
        ],
        nuevoFlujo: {
          ...flujo,
          estado: 'CAMBIO_PED_DETALLE',
          cambios: {
            estadoInterno: 'CAMBIO_PED_DETALLE',
            datos,
          },
          repreguntasFallidas: 0,
        },
      };
    }

    const estadoInterno = flujo.cambios.estadoInterno;
    const datos = { ...flujo.cambios.datos };

    // -------------------------------------------------------------
    // Paso A: CAMBIO_DIR_UBICACION
    // -------------------------------------------------------------
    if (estadoInterno === 'CAMBIO_DIR_UBICACION') {
      if (id === 'c_dir_escribir') {
        return {
          nuevoEstado: 'CAMBIO_DIR_UBICACION',
          acciones: [
            {
              tipo: 'enviarTexto',
              texto: 'Por favor escribe tu calle, número y distrito:',
            },
          ],
          nuevoFlujo: flujo,
        };
      }

      const tieneUbicacionGps =
        entrada.tipo === 'ubicacion' ||
        (entrada.ubicacion && Number.isFinite(entrada.ubicacion.latitud));

      if (tieneUbicacionGps) {
        const lat = entrada.ubicacion!.latitud;
        const lng = entrada.ubicacion!.longitud;
        const dir = entrada.ubicacion?.direccion || entrada.ubicacion?.nombre || `${lat}, ${lng}`;

        // Verificación de cobertura con ZonasService
        const resEnvio = contexto.resultadoEnvio;
        if (resEnvio && !resEnvio.cubierto) {
          return {
            nuevoEstado: 'CAMBIO_DIR_UBICACION',
            acciones: [
              {
                tipo: 'enviarBotones',
                texto: TEXTOS_CAMBIOS.ubicacionFueraDeCobertura(),
                botones: BOTONES_CAMBIO_UBICACION_FALLIDA,
              },
            ],
            nuevoFlujo: flujo,
          };
        }

        const tarifaNueva = resEnvio ? Number(resEnvio.tarifa ?? 5) : Number(datos.tarifaActual ?? 5);
        const tarifaActual = Number(datos.tarifaActual ?? 5);
        const recargo = tarifaNueva - tarifaActual;

        datos.lat = lat;
        datos.lng = lng;
        datos.direccionNueva = dir;
        datos.zonaNombre = typeof resEnvio?.zona === 'string' ? resEnvio.zona : resEnvio?.zona?.nombre || undefined;
        datos.zonaId = resEnvio?.zona?.id ? String(resEnvio.zona.id) : undefined;
        datos.tarifaNueva = tarifaNueva;
        datos.recargo = recargo;

        return {
          nuevoEstado: 'CAMBIO_DIR_REFERENCIA',
          acciones: [
            {
              tipo: 'enviarTexto',
              texto: TEXTOS_CAMBIOS.pedirReferencia(),
            },
          ],
          nuevoFlujo: {
            ...flujo,
            estado: 'CAMBIO_DIR_REFERENCIA',
            cambios: {
              estadoInterno: 'CAMBIO_DIR_REFERENCIA',
              datos,
            },
            repreguntasFallidas: 0,
          },
        };
      }

      // Dirección escrita por texto
      const dirTexto = entrada.textoOriginal.trim();
      if (dirTexto.length < 5) {
        return {
          nuevoEstado: 'CAMBIO_DIR_UBICACION',
          acciones: [
            {
              tipo: 'enviarTexto',
              texto: 'Por favor ingresa una dirección más completa con calle y número (ejemplo: Av. Las Palmeras 123):',
            },
          ],
          nuevoFlujo: flujo,
        };
      }

      datos.direccionNueva = dirTexto;
      return {
        nuevoEstado: 'CAMBIO_DIR_REFERENCIA',
        acciones: [
          {
            tipo: 'enviarTexto',
            texto: TEXTOS_CAMBIOS.pedirReferencia(),
          },
        ],
        nuevoFlujo: {
          ...flujo,
          estado: 'CAMBIO_DIR_REFERENCIA',
          cambios: {
            estadoInterno: 'CAMBIO_DIR_REFERENCIA',
            datos,
          },
          repreguntasFallidas: 0,
        },
      };
    }

    // -------------------------------------------------------------
    // Paso B: CAMBIO_DIR_REFERENCIA
    // -------------------------------------------------------------
    if (estadoInterno === 'CAMBIO_DIR_REFERENCIA') {
      const ref = entrada.textoOriginal.trim();
      const sinRef = /sin ref/i.test(ref) || ref === '-' || ref === '.';
      datos.referenciaNueva = sinRef ? 'Sin referencia' : ref;

      const resumen = TEXTOS_CAMBIOS.resumenCambioDireccion({
        codigo: datos.pedidoCodigo,
        direccion: datos.direccionNueva || 'Dirección indicada',
        referencia: datos.referenciaNueva,
        zonaNombre: datos.zonaNombre,
        tarifaActual: datos.tarifaActual,
        tarifaNueva: datos.tarifaNueva,
        recargo: datos.recargo,
      });

      return {
        nuevoEstado: 'CAMBIO_DIR_CONFIRMAR',
        acciones: [
          {
            tipo: 'enviarBotones',
            texto: resumen,
            botones: BOTONES_CAMBIO_CONFIRMAR_DIR,
          },
        ],
        nuevoFlujo: {
          ...flujo,
          estado: 'CAMBIO_DIR_CONFIRMAR',
          cambios: {
            estadoInterno: 'CAMBIO_DIR_CONFIRMAR',
            datos,
          },
          repreguntasFallidas: 0,
        },
      };
    }

    // -------------------------------------------------------------
    // Paso C: CAMBIO_DIR_CONFIRMAR
    // -------------------------------------------------------------
    if (estadoInterno === 'CAMBIO_DIR_CONFIRMAR') {
      // Seguridad: solo responder a botones válidos de confirmación
      if (id === 'c_dir_cambiar') {
        return {
          nuevoEstado: 'CAMBIO_DIR_UBICACION',
          acciones: [
            {
              tipo: 'enviarTexto',
              texto: TEXTOS_CAMBIOS.pedirNuevaUbicacion(datos.pedidoCodigo),
            },
          ],
          nuevoFlujo: {
            ...flujo,
            estado: 'CAMBIO_DIR_UBICACION',
            cambios: {
              estadoInterno: 'CAMBIO_DIR_UBICACION',
              datos,
            },
            repreguntasFallidas: 0,
          },
        };
      }

      if (id === 'c_dir_si' || texto === 'si' || texto === 'confirmar' || texto === 'confirmar cambio') {
        const detalle = `Nueva dirección: ${datos.direccionNueva}. Referencia: ${datos.referenciaNueva}${datos.zonaNombre ? ' · Zona: ' + datos.zonaNombre : ''}${datos.recargo ? ' · Recargo envío: S/ ' + datos.recargo.toFixed(2) : ''}`;

        return {
          nuevoEstado: 'MENU',
          acciones: [
            {
              tipo: 'crearSolicitudCambio',
              pedidoId: datos.pedidoId,
              pedidoCodigo: datos.pedidoCodigo,
              tipoCambio: 'DIRECCION',
              detalle,
              nuevaDireccion: datos.direccionNueva,
              nuevaReferencia: datos.referenciaNueva,
              nuevaZonaId: datos.zonaId,
              nuevaZonaNombre: datos.zonaNombre,
              nuevoEnvio: datos.tarifaNueva,
              recargoEnvio: datos.recargo,
              lat: datos.lat,
              lng: datos.lng,
            },
            {
              tipo: 'enviarBotones',
              texto: TEXTOS_CAMBIOS.solicitudDireccionEnviada(datos.pedidoCodigo, (datos.recargo ?? 0) > 0),
              botones: [BOTON_VOLVER_MENU],
            },
          ],
          nuevoFlujo: {
            ...flujo,
            estado: 'MENU',
            cambios: null,
            repreguntasFallidas: 0,
          },
        };
      }

      // Si el cliente envía un texto no reconocido o ID manipulado
      return {
        nuevoEstado: 'CAMBIO_DIR_CONFIRMAR',
        acciones: [
          {
            tipo: 'enviarBotones',
            texto: 'Por favor confirma si deseas enviar la solicitud de cambio de dirección o modificarla:',
            botones: BOTONES_CAMBIO_CONFIRMAR_DIR,
          },
        ],
        nuevoFlujo: flujo,
      };
    }

    // -------------------------------------------------------------
    // Paso D: CAMBIO_PED_DETALLE
    // -------------------------------------------------------------
    if (estadoInterno === 'CAMBIO_PED_DETALLE') {
      const detalle = entrada.textoOriginal.trim();
      if (detalle.length < 3) {
        return {
          nuevoEstado: 'CAMBIO_PED_DETALLE',
          acciones: [
            {
              tipo: 'enviarTexto',
              texto: 'Por favor describe con más detalle qué cambio deseas en tu pedido o si deseas anularlo:',
            },
          ],
          nuevoFlujo: flujo,
        };
      }

      const esCancelacion = /cancel|anul|ya no quiero/i.test(detalle);
      datos.tipo = esCancelacion ? 'CANCELAR' : 'PEDIDO';
      datos.detalleTexto = detalle;

      const resumen = TEXTOS_CAMBIOS.resumenCambioPedido(datos.pedidoCodigo, detalle);

      return {
        nuevoEstado: 'CAMBIO_PED_CONFIRMAR',
        acciones: [
          {
            tipo: 'enviarBotones',
            texto: resumen,
            botones: BOTONES_CAMBIO_CONFIRMAR_PED,
          },
        ],
        nuevoFlujo: {
          ...flujo,
          estado: 'CAMBIO_PED_CONFIRMAR',
          cambios: {
            estadoInterno: 'CAMBIO_PED_CONFIRMAR',
            datos,
          },
          repreguntasFallidas: 0,
        },
      };
    }

    // -------------------------------------------------------------
    // Paso E: CAMBIO_PED_CONFIRMAR
    // -------------------------------------------------------------
    if (estadoInterno === 'CAMBIO_PED_CONFIRMAR') {
      if (id === 'c_ped_cambiar') {
        return {
          nuevoEstado: 'CAMBIO_PED_DETALLE',
          acciones: [
            {
              tipo: 'enviarTexto',
              texto: TEXTOS_CAMBIOS.pedirDetalleCambioPedido(datos.pedidoCodigo),
            },
          ],
          nuevoFlujo: {
            ...flujo,
            estado: 'CAMBIO_PED_DETALLE',
            cambios: {
              estadoInterno: 'CAMBIO_PED_DETALLE',
              datos,
            },
            repreguntasFallidas: 0,
          },
        };
      }

      if (id === 'c_ped_si' || texto === 'si' || texto === 'confirmar' || texto === 'confirmar solicitud') {
        const textoRespuesta =
          datos.tipo === 'CANCELAR'
            ? TEXTOS_CAMBIOS.solicitudCancelacionEnviada(datos.pedidoCodigo, datos.estadoPedido)
            : TEXTOS_CAMBIOS.solicitudPedidoEnviada(datos.pedidoCodigo);

        return {
          nuevoEstado: 'MENU',
          acciones: [
            {
              tipo: 'crearSolicitudCambio',
              pedidoId: datos.pedidoId,
              pedidoCodigo: datos.pedidoCodigo,
              tipoCambio: datos.tipo,
              detalle: datos.detalleTexto || 'Solicitud de cambio en pedido',
            },
            {
              tipo: 'enviarBotones',
              texto: textoRespuesta,
              botones: [BOTON_VOLVER_MENU],
            },
          ],
          nuevoFlujo: {
            ...flujo,
            estado: 'MENU',
            cambios: null,
            repreguntasFallidas: 0,
          },
        };
      }

      // Si el cliente envía otro texto o ID manipulado
      return {
        nuevoEstado: 'CAMBIO_PED_CONFIRMAR',
        acciones: [
          {
            tipo: 'enviarBotones',
            texto: 'Por favor confirma si deseas enviar la solicitud al asesor o modificarla:',
            botones: BOTONES_CAMBIO_CONFIRMAR_PED,
          },
        ],
        nuevoFlujo: flujo,
      };
    }

    return null;
  }
}

export const flujoCambiosSubFlujo = new FlujoCambiosSubFlujo();
RegistroSubFlujos.registrar(flujoCambiosSubFlujo);
