import { lineaAvisoStock } from './flujos/pedido/aviso-stock-bot.util';
import { pideFoto } from './flujos/pedido/combo-bot';
import { atenderCancelarCliente } from './flujos/cambios/cancelar-cliente-bot';
import { accionesPaginaCarrusel, LIMITES_CARRUSEL, ordenarPorVentas, tarjetaProducto } from '../servicios/carrusel.util';
import {
  BOTON_HABLAR_PERSONA,
  BOTON_HACER_PEDIDO,
  BOTON_LISTA_CATEGORIAS,
  BOTON_LISTA_MENU,
  BOTON_LISTA_PREGUNTAS,
  BOTON_LISTA_PRODUCTOS,
  BOTON_OTRAS_PREGUNTAS,
  BOTON_VER_CARTA,
  BOTON_VOLVER_CATEGORIAS,
  BOTON_VOLVER_MENU,
  BOTONES_MENU_PRINCIPAL,
  BOTONES_MI_PEDIDO,
  BOTONES_MODO_ASISTIDO,
  FILAS_MENU_PRINCIPAL,
  FILAS_PREGUNTAS_FRECUENTES,
  TEXTO_ASISTIDO_FRASE_FIJA,
  TEXTO_PERDONA_ESPERA,
  TEXTOS_BOT,
  TEXTOS_SOLO_MENUS,
  TITULO_SECCION_CATEGORIAS,
  TITULO_SECCION_MENU,
  TITULO_SECCION_PREGUNTAS,
} from './textos-bot';
import { BOTON_PERSONA_CERRADO, BOTON_PROGRAMAR_PEDIDO, BOTON_VER_HORARIO, TEXTOS_PROGRAMAR } from './textos-programar';
import {
  AccionEnviarLista,
  AccionMensaje,
  ContextoConversacion,
  DatosHorarioLocal,
  EntradaNormalizada,
  ESQUEMA_FLUJO_VERSION,
  EstadoConversacion,
  FilaLista,
  FlujoConversacion,
  ResultadoTransicion,
} from './tipos-conversacion';
import { RegistroSubFlujos } from './flujos/registro-flujos';
import { TEXTOS_CAMBIOS } from './flujos/cambios/textos-cambios';
import {
  TEXTOS_FUNCIONES_DESACTIVADAS,
  BOTONES_FUNCION_PAUSADA,
} from '../configuracion/chatbot-configuracion.tipos';
import {
  buscarOfertaParaProducto,
  generarCierreComercial,
  adjuntarCierreComercial,
} from './cierre-comercial.util';
import { esSaludo as esSaludoPuro, normalizarTexto } from './normalizador-entrada.util';
import { interpolar, NOMBRE_LOCAL_BOT, nombreParaSaludo, textoBot } from './bienvenida.util';
import { enlaceSeguimientoCarta } from '../../pedidos/seguimiento.tokens';
import { PREFIJO_NO_ENTENDI } from './flujos/pedido/flujo-pedido';
import './flujos/pago/flujo-pago';
import './flujos/reserva/flujo-reserva';
import './flujos/ia/flujo-ia';
import './flujos/cambios/flujo-cambios';

/** Palabras clave para detectar saludos o solicitud del menú */
const PALABRAS_SALUDO = [
  'hola',
  'holi',
  'buenas',
  'buen dia',
  'buenos dias',
  'buenas tardes',
  'buenas noches',
  'hey',
  'menu',
  'inicio',
  'comenzar',
  'empezar',
  'opciones',
  'volver al menu',
];

/** Palabras clave para intención de pedido */
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

/** Palabras clave para intención de reserva */
const PALABRAS_RESERVA = [
  'reservar',
  'reservar mesa',
  'reserva',
  'reservacion',
  'mesa',
];

/** Palabras clave para intención de carta */
const PALABRAS_CARTA = [
  'ver la carta',
  'catalogo',
  'carta digital',
  'menu carta',
  'platos',
  'precios',
  'la carta',
];

/** Palabras clave para consultar el saldo de puntos del propio número */
const PALABRAS_MIS_PUNTOS = [
  'mis puntos',
  'cuantos puntos',
  'puntos tengo',
  'saldo de puntos',
  'consultar puntos',
  'puntos acumulados',
];

/** Palabras clave para intención de promociones */
const PALABRAS_PROMOS = [
  'promocion',
  'promociones',
  'promo',
  'promos',
  'oferta',
  'ofertas',
  'descuento',
  'descuentos',
  'combos',
  '2x1',
];

/** Palabras clave para intención de mi pedido */
const PALABRAS_MI_PEDIDO = [
  'mi pedido',
  'mis pedidos',
  'donde esta mi pedido',
  'estado de mi pedido',
  'mi orden',
  'seguimiento',
];

/** Palabras clave para intención de ¿cuánto falta? */
const PALABRAS_ETA = [
  'cuanto falta',
  'cuanto demora',
  'cuanto tarda',
  'tiempo de entrega',
  'tiempo estimado',
  'ya sale',
  'a que hora llega',
  'a que hora sale',
  'donde esta',
  'dentro de cuanto',
  'en cuanto llega',
  'cuando llega',
  'ya viene',
  'ya llega',
  'confirma',
  'confirmado',
];

/** Agradecimientos o acuses cortos: se contestan con una línea, sin menú (solo si el mensaje es exactamente eso). */
const ACUSES_CORTOS = ['ok', 'oki', 'okey', 'okay', 'listo', 'vale', 'dale', 'ok gracias', 'perfecto', 'genial', 'entendido', 'de acuerdo', '👍', '👌', '🙏'];

/** Estados de pedido que ya no cuentan como «activo». */
const ESTADOS_PEDIDO_TERMINADOS = ['ENTREGADO', 'ANULADO', 'CANCELADO', 'FINALIZADO', 'RECHAZADO'];
const pedidoVigente = (p: any): boolean => Boolean(p) && !ESTADOS_PEDIDO_TERMINADOS.includes(String(p.estado || '').toUpperCase());

/** Palabras clave para cambio de dirección */
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

/** Palabras clave para cambio o anulación de pedido */
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

/** Palabras clave para intención de horario y ubicación */
const PALABRAS_HORARIO_UBICACION = [
  'horario',
  'ubicacion',
  'donde',
  'direccion',
  'abierto',
  'abren',
  'cierran',
  'mapa',
  'llegar',
  'donde estan',
];

/** Palabras clave para intención de queja o reclamo urgente (HU-CAP-129, HU-CAP-141) */
const PALABRAS_QUEJA = [
  'mala atencion',
  'reclamo',
  'quiero hablar con el encargado',
  'pesimo servicio',
  'queja',
];

/** Palabras clave para intención de hablar con una persona */
const PALABRAS_PERSONA = [
  'persona',
  'humano',
  'asesor',
  'hablar',
  'atencion',
  'operador',
  'charlar',
  'ayuda',
  'hablar con alguien',
  'reclamo',
  'queja',
  'hablar con una persona',
  'hablar con persona',
  'hablar con asesor',
];

/** Palabras clave para preguntas frecuentes */
const PALABRAS_PREGUNTAR = [
  'preguntar',
  'preguntar algo',
  'duda',
  'dudas',
  'consulta',
  'consultas',
  'preguntas',
];

/** Palabras clave para intención de despedida o agradecimiento */
const PALABRAS_DESPEDIDA = [
  'gracias',
  'muchas gracias',
  'chau',
  'adios',
  'hasta luego',
  'bye',
  'hasta pronto',
  'nos vemos',
];

/**
 * Bot con menú (true): menú nuevo, pedido y pago por chat del motor anterior, sin promociones, puntos,
 * reservas por chat ni IA. false = motor anterior completo (IA, modo asistido, cambios, reservas, puntos).
 */
export const MODO_SOLO_MENUS = true;

/** Palabras que sí significan «hablar con una persona» en texto libre (sin «atención», «ayuda», etc.). */
const PALABRAS_PERSONA_SOLO = [
  'persona',
  'humano',
  'asesor',
  'operador',
  'hablar con alguien',
  'hablar con una persona',
  'hablar con persona',
  'hablar con asesor',
];

function coincideAlgunaPalabra(texto: string, lista: string[]): boolean {
  return lista.some((palabra) => {
    const regex = new RegExp(`(^|\\s)${palabra}(\\s|$)`, 'i');
    return regex.test(texto) || texto === palabra || texto.includes(palabra);
  });
}

/**
 * Frase larga y específica (4+ palabras, no un botón) con la IA encendida: la contesta la IA con los datos reales del
 * pedido y las políticas, no la FAQ fija de pagos/delivery (que solo sirve para la palabra suelta: «yape», «pagos»).
 */
function preguntaEspecificaParaIa(entrada: EntradaNormalizada, contexto: ContextoConversacion): boolean {
  return Boolean(contexto.chatbotIaActivo && !entrada.id && (entrada.texto || '').trim().split(/\s+/).length >= 4);
}

function construirListaCategorias(
  categorias: any[],
  pagina = 0,
  datosLocal?: DatosHorarioLocal,
): AccionEnviarLista {
  const tamanoPagina = 9;
  const inicio = Math.max(0, pagina * tamanoPagina);
  const categoriasPagina = categorias.slice(inicio, inicio + tamanoPagina);
  const hayMas = categorias.length > inicio + tamanoPagina;

  const filas: FilaLista[] = categoriasPagina.map((cat) => {
    const todosAgotados =
      cat.productos && cat.productos.length > 0 && cat.productos.every((p: any) => !p.disponible);
    return {
      id: `cat_${cat.id}`,
      titulo: String(cat.nombre || '').slice(0, 24),
      descripcion: todosAgotados
        ? 'Por ahora no está disponible'
        : cat.descripcion
        ? String(cat.descripcion).slice(0, 72)
        : `${cat.productos?.length || 0} productos disponibles`,
    };
  });

  if (hayMas) {
    filas.push({
      id: `cat_mas_${pagina + 1}`,
      titulo: 'Ver más categorías',
      descripcion: 'Ver las siguientes categorías de la carta',
    });
  }

  return {
    tipo: 'enviarLista',
    texto: TEXTOS_BOT.cuerpoCategorias(datosLocal?.abierta ?? true),
    botonTexto: BOTON_LISTA_CATEGORIAS,
    tituloSeccion: TITULO_SECCION_CATEGORIAS,
    filas,
  };
}

/**
 * Único camino para mostrar los productos de una categoría: delega en el flujo de pedido (carrusel con los 10 más
 * vendidos + «Ver más», lista como respaldo). Conserva el estado y el carrito de quien llama.
 */
function productosDeCategoria(
  flujo: FlujoConversacion,
  cat: any,
  entrada: EntradaNormalizada,
  contexto: ContextoConversacion,
  estado: EstadoConversacion,
): ResultadoTransicion {
  const pedidoFlujo = RegistroSubFlujos.obtenerFlujos().find((f) => f.nombre === 'pedido')!;
  const r = pedidoFlujo.transicionar(
    {
      ...flujo,
      estado: 'PEDIDO_CATEGORIAS',
      pedido: { estadoInterno: 'PEDIDO_CATEGORIAS', items: flujo.pedido?.items ?? [] },
    },
    { ...entrada, id: `ped_cat_${cat.id}`, texto: '' },
    contexto,
  )!;
  return {
    nuevoEstado: estado,
    acciones: r.acciones,
    nuevoFlujo: {
      ...flujo,
      estado,
      categoriaSeleccionadaId: String(cat.id),
      paginaProductos: 0,
      repreguntasFallidas: 0,
    },
  };
}

/**
 * Función pura que computa el próximo estado y las acciones a despachar.
 * No realiza llamadas I/O, base de datos ni llamadas a Meta.
 */
export function transicionarEstado(
  flujoPrevio: FlujoConversacion | null | undefined,
  entrada: EntradaNormalizada,
  contexto: ContextoConversacion = {},
): ResultadoTransicion {
  // Inicialización defensiva respetando versión de esquema y preservando campos existentes
  const flujo: FlujoConversacion = {
    version: ESQUEMA_FLUJO_VERSION,
    estado: flujoPrevio?.estado || 'INICIO',
    repreguntasFallidas: Number(flujoPrevio?.repreguntasFallidas ?? 0),
    ...(flujoPrevio || {}),
  };

  // 1. Manejo de fallo de servicio o base de datos (requisito f)
  if (contexto.errorServicio) {
    const nuevoEstado: EstadoConversacion = 'ATENCION_PERSONA';
    return {
      nuevoEstado,
      acciones: [
        {
          tipo: 'pasarAPersona',
          motivo: 'FALLO_SERVICIO_BD',
          mensajeCliente: entrada.textoOriginal,
        },
        {
          tipo: 'enviarTexto',
          texto: TEXTOS_BOT.errorServicio(),
        },
      ],
      nuevoFlujo: {
        ...flujo,
        estado: nuevoEstado,
        repreguntasFallidas: 0,
      },
    };
  }

  // 1.b Bot con menú (decisión del dueño): menú + pedido y pago por chat; sin IA. Con MODO_SOLO_MENUS en false, motor anterior.
  if (MODO_SOLO_MENUS) {
    // Chat tomado por una persona: el bot calla (misma regla de antes)
    if (flujo.estado === 'ATENCION_PERSONA' && (contexto.chatTomado || contexto.humanoHabloReciente)) {
      return { nuevoEstado: 'ATENCION_PERSONA', acciones: [], nuevoFlujo: flujo };
    }
    return transicionarSoloMenus(flujo, entrada, contexto);
  }

  // 2. Modo asistido: cuando la conversación está en manos de una persona (ATENCION_PERSONA)
  if (flujo.estado === 'ATENCION_PERSONA') {
    // Regla 5: Si la conversación está tomada por un asesor o un humano escribió hace menos de 3 minutos, el bot calla
    if (contexto.chatTomado || contexto.humanoHabloReciente) {
      return {
        nuevoEstado: 'ATENCION_PERSONA',
        acciones: [],
        nuevoFlujo: flujo,
      };
    }

    const textoEntrada = entrada.texto;
    const textoOriginalEntrada = entrada.textoOriginal;
    const idInteractivoEntrada = entrada.id;

    // a) Verificar si algún subflujo activo en curso (pedido nuevo o solicitud de cambio) puede manejar la entrada
    for (const subFlujo of RegistroSubFlujos.obtenerFlujos()) {
      if (
        (subFlujo.nombre === 'pedido' && (flujo.pedido || idInteractivoEntrada === 'pedir' || idInteractivoEntrada?.startsWith('ped_') || coincideAlgunaPalabra(textoEntrada, PALABRAS_PEDIDO))) ||
        (subFlujo.nombre === 'cambios' && (flujo.cambios || idInteractivoEntrada === 'c_dir' || idInteractivoEntrada === 'c_ped' || idInteractivoEntrada?.startsWith('c_dir_') || idInteractivoEntrada?.startsWith('c_ped_')))
      ) {
        if (subFlujo.puedeManejar(flujo, entrada, contexto)) {
          const res = subFlujo.transicionar(flujo, entrada, contexto);
          if (res) return res;
        }
      }
    }

    // b) Cancelar o cambiar pedido (Regla 2: nunca cancela directamente, registra solicitud para Caja)
    const esCancelarTexto =
      coincideAlgunaPalabra(textoEntrada, ['cancelar', 'anular', 'ya no quiero', 'cancelar pedido', 'anular pedido']) ||
      textoEntrada.includes('cancelar') ||
      textoEntrada.includes('anular');

    const esCambiarTexto =
      coincideAlgunaPalabra(textoEntrada, PALABRAS_CAMBIO_DIR) ||
      coincideAlgunaPalabra(textoEntrada, PALABRAS_CAMBIO_PED);

    if (esCancelarTexto && contexto.pedidoActivo) {
      const p = contexto.pedidoActivo;
      const st = String(p.estado || 'COLA').toUpperCase();
      const advertencia = ['PREPARANDO', 'LISTO', 'EN_CAMINO', 'RUTA'].includes(st)
        ? ` (aviso: tu pedido ya está en ${st.toLowerCase()} y puede no ser posible)`
        : '';
      const textoRespuesta = `Registre tu solicitud de cancelacion${advertencia}; una persona de Caja la confirma.`;

      return {
        nuevoEstado: 'ATENCION_PERSONA',
        acciones: [
          {
            tipo: 'crearSolicitudCambio',
            pedidoId: String(p.id),
            pedidoCodigo: p.codigo,
            tipoCambio: 'CANCELAR',
            detalle: textoOriginalEntrada || 'Solicitud de cancelación en modo asistido',
          },
          {
            tipo: 'enviarBotones',
            texto: textoRespuesta,
            botones: [
              { id: 'btn_asi_carta', titulo: 'Ver la carta' },
              { id: 'btn_asi_pedido', titulo: 'Estado de mi pedido' },
            ],
          },
        ],
        nuevoFlujo: flujo,
      };
    }

    if (esCambiarTexto && contexto.pedidoActivo) {
      for (const subFlujo of RegistroSubFlujos.obtenerFlujos()) {
        if (subFlujo.nombre === 'cambios' && subFlujo.puedeManejar(flujo, entrada, contexto)) {
          const res = subFlujo.transicionar(flujo, entrada, contexto);
          if (res) return res;
        }
      }
    }

    // c) Menú principal (Regla 1)
    const esMenu =
      idInteractivoEntrada === 'menu' ||
      idInteractivoEntrada === 'btn_menu' ||
      idInteractivoEntrada === 'volver_menu' ||
      idInteractivoEntrada === 'inicio' ||
      esSaludoPuro(textoEntrada) ||
      textoEntrada === 'menu' ||
      textoEntrada === 'inicio' ||
      textoEntrada === '0';

    if (esMenu) {
      return {
        nuevoEstado: 'ATENCION_PERSONA',
        acciones: [
          {
            tipo: 'enviarBotones',
            texto: 'Claro. Mientras te atiende nuestro equipo, ¿en qué te puedo ayudar?',
            botones: BOTONES_MODO_ASISTIDO,
          },
        ],
        nuevoFlujo: {
          ...flujo,
          repreguntasFallidas: 0,
        },
      };
    }

    // d) Ver la carta (Regla 1)
    const esCarta =
      idInteractivoEntrada === 'carta' ||
      idInteractivoEntrada === 'btn_carta' ||
      idInteractivoEntrada === 'btn_asi_carta' ||
      idInteractivoEntrada?.startsWith('cat_') ||
      textoEntrada === 'carta' ||
      textoEntrada.includes('ver la carta') ||
      textoEntrada.includes('ver carta') ||
      textoEntrada === 'la carta' ||
      coincideAlgunaPalabra(textoEntrada, PALABRAS_CARTA);

    if (esCarta) {
      if (idInteractivoEntrada?.startsWith('cat_mas_')) {
        const sigPag = parseInt(idInteractivoEntrada.replace('cat_mas_', ''), 10) || 0;
        const accionLista = construirListaCategorias(
          contexto.categoriasCarta || [],
          sigPag,
          contexto.datosLocal,
        );
        return {
          nuevoEstado: 'ATENCION_PERSONA',
          acciones: [accionLista],
          nuevoFlujo: {
            ...flujo,
            estado: 'ATENCION_PERSONA',
            paginaCategorias: sigPag,
            repreguntasFallidas: 0,
          },
        };
      }

      if (idInteractivoEntrada?.startsWith('cat_')) {
        const catId = idInteractivoEntrada.replace('cat_', '');
        const cat = (contexto.categoriasCarta || []).find((c: any) => String(c.id) === String(catId));
        if (cat) {
          return productosDeCategoria(flujo, cat, entrada, contexto, 'ATENCION_PERSONA');
        }
      }

      const accionLista = construirListaCategorias(
        contexto.categoriasCarta || [],
        0,
        contexto.datosLocal,
      );
      return {
        nuevoEstado: 'ATENCION_PERSONA',
        acciones: [accionLista],
        nuevoFlujo: {
          ...flujo,
          estado: 'ATENCION_PERSONA',
          paginaCategorias: 0,
          repreguntasFallidas: 0,
        },
      };
    }

    // e) Hacer un nuevo pedido (Regla 1 y 7: pedido aparte, no toca el pedido en curso)
    const esNuevoPedido =
      idInteractivoEntrada === 'pedir' ||
      idInteractivoEntrada === 'btn_pedir' ||
      idInteractivoEntrada === 'delivery' ||
      idInteractivoEntrada === 'recojo' ||
      textoEntrada === 'pedir' ||
      textoEntrada.includes('nuevo pedido') ||
      coincideAlgunaPalabra(textoEntrada, PALABRAS_PEDIDO);

    if (esNuevoPedido) {
      for (const subFlujo of RegistroSubFlujos.obtenerFlujos()) {
        if (subFlujo.nombre === 'pedido' && subFlujo.puedeManejar(flujo, entrada, contexto)) {
          const res = subFlujo.transicionar(flujo, entrada, contexto);
          if (res) return res;
        }
      }
    }

    // f) Estado de mi pedido (Regla 1)
    const matchCod =
      textoOriginalEntrada.match(/CP-W?\d{3,4}/i) || textoEntrada.match(/CP-W?\d{3,4}/i);
    const esEstadoPedido =
      idInteractivoEntrada === 'mipedido' ||
      idInteractivoEntrada === 'btn_mipedido' ||
      idInteractivoEntrada === 'btn_asi_pedido' ||
      idInteractivoEntrada?.startsWith('ord_') ||
      textoEntrada.includes('mi pedido') ||
      textoEntrada.includes('estado') ||
      Boolean(matchCod);

    if (esEstadoPedido) {
      if (contexto.pedidoActivo) {
        const p = contexto.pedidoActivo;
        const textoInfo = `Tu pedido *${p.codigo}* está en estado: *${p.estado}* (Pago: *${p.pago_estado}*).\nSeguimos atendiendo tu solicitud con nuestro equipo.`;
        return {
          nuevoEstado: 'ATENCION_PERSONA',
          acciones: [
            {
              tipo: 'enviarBotones',
              texto: textoInfo,
              botones: [
                { id: 'btn_asi_carta', titulo: 'Ver la carta' },
                { id: 'btn_asi_persona', titulo: 'Hablar con persona' },
              ],
            },
          ],
          nuevoFlujo: flujo,
        };
      } else {
        return {
          nuevoEstado: 'ATENCION_PERSONA',
          acciones: [
            {
              tipo: 'enviarBotones',
              texto: 'No encontramos un pedido activo asociado a tu número. ¿Deseas hacer un pedido nuevo o ver la carta?',
              botones: [
                { id: 'pedir', titulo: 'Hacer un pedido' },
                { id: 'btn_asi_carta', titulo: 'Ver la carta' },
              ],
            },
          ],
          nuevoFlujo: flujo,
        };
      }
    }

    // g) Horario y ubicación / FAQ (Regla 1)
    const esHorarioOUbicacion =
      idInteractivoEntrada === 'horario' ||
      idInteractivoEntrada === 'btn_horario' ||
      idInteractivoEntrada === 'ubicacion' ||
      idInteractivoEntrada === 'btn_ubicacion' ||
      idInteractivoEntrada === 'faq_horario' ||
      idInteractivoEntrada === 'faq_ubicacion' ||
      textoEntrada.includes('horario') ||
      textoEntrada.includes('ubicacion') ||
      textoEntrada.includes('donde estan') ||
      textoEntrada.includes('a que hora');

    if (esHorarioOUbicacion) {
      return {
        nuevoEstado: 'ATENCION_PERSONA',
        acciones: [
          {
            tipo: 'enviarBotones',
            texto: TEXTOS_BOT.horarioYUbicacion(contexto.datosLocal),
            botones: [
              { id: 'btn_asi_carta', titulo: 'Ver la carta' },
              { id: 'btn_asi_persona', titulo: 'Hablar con persona' },
            ],
          },
        ],
        nuevoFlujo: flujo,
      };
    }

    // h) Hablar con una persona (Regla 1)
    const esPersonaIntencion =
      idInteractivoEntrada === 'persona' ||
      idInteractivoEntrada === 'btn_persona' ||
      idInteractivoEntrada === 'btn_asi_persona' ||
      textoEntrada === 'asesor' ||
      textoEntrada.includes('persona') ||
      textoEntrada.includes('hablar con alguien') ||
      textoEntrada.includes('hablar con persona') ||
      textoEntrada.includes('hablar con asesor');

    if (esPersonaIntencion) {
      return {
        nuevoEstado: 'ATENCION_PERSONA',
        acciones: [
          {
            tipo: 'enviarTexto',
            texto: 'Ya avisé a una persona de nuestro equipo; en unos minutos te escriben por aquí.',
          },
        ],
        nuevoFlujo: flujo,
      };
    }

    // i) Preguntas libres (Reglas 3 y 4)
    // Si no han transcurrido los minutos para modo asistido, calla
    if (!contexto.modoAsistido) {
      return {
        nuevoEstado: 'ATENCION_PERSONA',
        acciones: [],
        nuevoFlujo: flujo,
      };
    }

    // Con modoAsistido activo: si IA encendida y disponible, consulta a la IA (Regla 3)
    if (contexto.chatbotIaActivo) {
      return {
        nuevoEstado: 'ATENCION_PERSONA',
        acciones: [
          {
            tipo: 'consultarIa',
            pregunta: textoOriginalEntrada,
          },
        ],
        nuevoFlujo: flujo,
      };
    }

    // Con IA apagada: frase fija con límite de frecuencia (Reglas 3 y 4)
    if (contexto.modoAsistidoFraseReciente) {
      return {
        nuevoEstado: 'ATENCION_PERSONA',
        acciones: [],
        nuevoFlujo: flujo,
      };
    }

    return {
      nuevoEstado: 'ATENCION_PERSONA',
      acciones: [
        {
          tipo: 'enviarBotones',
          texto: TEXTO_ASISTIDO_FRASE_FIJA,
          botones: BOTONES_MODO_ASISTIDO,
        },
      ],
      nuevoFlujo: flujo,
    };
  }

  // 2.b Expiración por inactividad (30 minutos sin respuesta descarta carrito y notifica)
  if (
    contexto.inactividadExpirada &&
    flujo.pedido &&
    (flujo.pedido.items?.length > 0 || String(flujo.estado).startsWith('PEDIDO'))
  ) {
    const nuevoEstado: EstadoConversacion = 'MENU';
    return {
      nuevoEstado,
      acciones: [
        {
          tipo: 'enviarBotones',
          texto: TEXTOS_BOT.pedidoExpiradoInactividad(),
          botones: BOTONES_MENU_PRINCIPAL,
        },
      ],
      nuevoFlujo: {
        ...flujo,
        estado: nuevoEstado,
        pedido: null,
        repreguntasFallidas: 0,
      },
    };
  }

  const texto = entrada.texto;
  const textoOriginal = entrada.textoOriginal;
  const idInteractivo = entrada.id;

  // Detección de código de pedido en el texto (ej: CP-0110)
  const matchCodigo =
    textoOriginal.match(/CP-W?\d{3,4}/i) || texto.match(/CP-W?\d{3,4}/i);
  const codigoDetectado = matchCodigo ? matchCodigo[0].toUpperCase() : null;

  // 3. Detección de queja escrita o intención explícita de hablar con una persona
  const esQueja = !(String(flujo.estado) === 'RESERVA_PREGUNTAR_NOTA') && coincideAlgunaPalabra(texto, PALABRAS_QUEJA);
  // En pasos de texto libre de la reserva (nota, nombre, otra fecha, cambio) el cliente escribe frases
  // como "mesa para 5 personas" o "pido atención por cumpleaños": solo cuenta como pedir persona la frase exacta.
  const enTextoLibreReserva = [
    'RESERVA_PREGUNTAR_NOTA',
    'RESERVA_INGRESAR_NOMBRE',
    'RESERVA_INGRESAR_TELEFONO',
    'RESERVA_FECHA_OTRA',
    'RESERVA_CAMBIAR_DETALLE',
  ].includes(String(flujo.estado));
  const FRASES_PERSONA_EXACTAS = [
    'persona',
    'asesor',
    'hablar con alguien',
    'hablar con una persona',
    'hablar con persona',
    'hablar con asesor',
  ];
  const esPersona =
    idInteractivo === 'persona' ||
    idInteractivo === 'btn_persona' ||
    (enTextoLibreReserva
      ? FRASES_PERSONA_EXACTAS.includes(texto)
      : coincideAlgunaPalabra(texto, PALABRAS_PERSONA));

  if (esQueja) {
    const nuevoEstado: EstadoConversacion = 'ATENCION_PERSONA';
    return {
      nuevoEstado,
      acciones: [
        {
          tipo: 'pasarAPersona',
          motivo: 'QUEJA_ESCRITA_URGENTE',
          mensajeCliente: entrada.textoOriginal,
          esUrgente: true,
          crearQueja: true,
          quejaTexto: entrada.textoOriginal,
        },
        {
          tipo: 'enviarTexto',
          texto: TEXTOS_CAMBIOS.quejaUrgenteRecibida(),
        },
      ],
      nuevoFlujo: {
        ...flujo,
        estado: nuevoEstado,
        repreguntasFallidas: 0,
      },
    };
  }

  if (esPersona) {
    const nuevoEstado: EstadoConversacion = 'ATENCION_PERSONA';
    const estaCerrado = contexto.datosLocal && contexto.datosLocal.abierta === false;
    const horaAbre = contexto.datosLocal?.abre || '15:00';
    const horaCierra = contexto.datosLocal?.cierra || '23:00';

    return {
      nuevoEstado,
      acciones: [
        {
          tipo: 'pasarAPersona',
          motivo: estaCerrado ? 'FUERA_DE_HORARIO' : 'CLIENTE_SOLICITO_PERSONA',
          mensajeCliente: entrada.textoOriginal,
        },
        {
          tipo: 'enviarTexto',
          texto: estaCerrado
            ? TEXTOS_CAMBIOS.fueraDeHorario(horaAbre, horaCierra, horaAbre)
            : TEXTOS_BOT.pasarAPersona(contexto.textosPersonalizados?.chatbot_texto_pase_persona),
        },
      ],
      nuevoFlujo: {
        ...flujo,
        estado: nuevoEstado,
        repreguntasFallidas: 0,
      },
    };
  }

  // 3.b Verificación de interruptores de funciones desactivadas (Ola 4, Agente I)
  if (contexto.funcionesActivas) {
    // a) Función Pedido desactivada
    if (contexto.funcionesActivas.pedido === false) {
      const pidePedido =
        idInteractivo === 'pedir' ||
        idInteractivo === 'btn_pedido' ||
        flujo.estado === 'PEDIDO' ||
        String(flujo.estado).startsWith('PED_') ||
        coincideAlgunaPalabra(texto, PALABRAS_PEDIDO);

      if (pidePedido) {
        return {
          nuevoEstado: 'MENU',
          acciones: [
            {
              tipo: 'enviarBotones',
              texto: TEXTOS_FUNCIONES_DESACTIVADAS.pedido,
              botones: BOTONES_FUNCION_PAUSADA,
            },
          ],
          nuevoFlujo: {
            ...flujo,
            estado: 'MENU',
            repreguntasFallidas: 0,
          },
        };
      }
    }

    // b) Función Reservas desactivada
    if (contexto.funcionesActivas.reservas === false) {
      const pideReserva =
        idInteractivo === 'reservar' ||
        idInteractivo === 'btn_reserva' ||
        flujo.estado === 'RESERVA' ||
        String(flujo.estado).startsWith('RES_') ||
        String(flujo.estado).startsWith('RESERVA_') ||
        coincideAlgunaPalabra(texto, PALABRAS_RESERVA);

      if (pideReserva) {
        return {
          nuevoEstado: 'MENU',
          acciones: [
            {
              tipo: 'enviarBotones',
              texto: TEXTOS_FUNCIONES_DESACTIVADAS.reservas,
              botones: [
                { id: 'btn_persona', titulo: 'Hablar con asesor' },
                BOTON_VOLVER_MENU,
              ],
            },
          ],
          nuevoFlujo: {
            ...flujo,
            estado: 'MENU',
            repreguntasFallidas: 0,
          },
        };
      }
    }

    // c) Función Cambios desactivada
    if (contexto.funcionesActivas.cambios === false) {
      const pideCambios =
        idInteractivo === 'c_dir' ||
        idInteractivo === 'c_ped' ||
        String(flujo.estado).startsWith('CAMBIO_') ||
        coincideAlgunaPalabra(texto, PALABRAS_CAMBIO_DIR) ||
        coincideAlgunaPalabra(texto, PALABRAS_CAMBIO_PED);

      if (pideCambios) {
        return {
          nuevoEstado: 'ATENCION_PERSONA',
          acciones: [
            {
              tipo: 'pasarAPersona',
              motivo: 'CAMBIOS_PAUSADO',
              mensajeCliente: entrada.textoOriginal,
            },
            {
              tipo: 'enviarTexto',
              texto: TEXTOS_FUNCIONES_DESACTIVADAS.cambios,
            },
          ],
          nuevoFlujo: {
            ...flujo,
            estado: 'ATENCION_PERSONA',
            repreguntasFallidas: 0,
          },
        };
      }
    }

    // d) Función Pago desactivada
    if (contexto.funcionesActivas.pago === false) {
      const pidePago =
        idInteractivo === 'pay' ||
        flujo.estado === 'PAGO' ||
        String(flujo.estado).startsWith('PAGO_');

      if (pidePago) {
        return {
          nuevoEstado: 'ATENCION_PERSONA',
          acciones: [
            {
              tipo: 'pasarAPersona',
              motivo: 'PAGO_PAUSADO',
              mensajeCliente: entrada.textoOriginal,
            },
            {
              tipo: 'enviarTexto',
              texto: TEXTOS_FUNCIONES_DESACTIVADAS.pago,
            },
          ],
          nuevoFlujo: {
            ...flujo,
            estado: 'ATENCION_PERSONA',
            repreguntasFallidas: 0,
          },
        };
      }
    }
  }

  // 4. Delegación a subflujos modulares registrados (Ola 2 Pedidos, Ola 2 Pagos, Ola 3 Reservas)
  for (const subFlujo of RegistroSubFlujos.obtenerFlujos()) {
    if (subFlujo.puedeManejar(flujo, entrada, contexto)) {
      const res = subFlujo.transicionar(flujo, entrada, contexto);
      if (res) {
        return res;
      }
    }
  }

  // 5. Intención: "Reservar mesa" (gancho Ola 3)
  const esReserva =
    idInteractivo === 'reservar' ||
    idInteractivo === 'btn_reserva' ||
    coincideAlgunaPalabra(texto, PALABRAS_RESERVA);

  if (esReserva) {
    const nuevoEstado: EstadoConversacion = 'MENU';
    return {
      nuevoEstado,
      acciones: [
        {
          tipo: 'enviarBotones',
          texto: TEXTOS_BOT.reservaProximamente(),
          botones: [BOTON_HABLAR_PERSONA, BOTON_VOLVER_MENU],
        },
      ],
      nuevoFlujo: {
        ...flujo,
        estado: nuevoEstado,
        repreguntasFallidas: 0,
      },
    };
  }

  // 5.b Intención: "¿Cuántos puntos tengo?" (solo el saldo del propio número de WhatsApp; nunca el de otro)
  if (idInteractivo === 'mispuntos' || coincideAlgunaPalabra(texto, PALABRAS_MIS_PUNTOS)) {
    const url = contexto.cartaUrlPublica || 'https://caprichos.pe';
    const cuenta = contexto.puntos?.cuentaTelefono;
    const textoPuntos = !contexto.puntos
      ? TEXTOS_BOT.puntosNoDisponible()
      : cuenta
        ? TEXTOS_BOT.puntosMiSaldo(cuenta.primerNombre, cuenta.saldo, contexto.puntos.porcentaje ?? 5)
        : TEXTOS_BOT.puntosSinCuenta(url);
    return {
      nuevoEstado: 'MENU',
      acciones: [{ tipo: 'enviarBotones', texto: textoPuntos, botones: [{ id: 'btn_pedido', titulo: 'Hacer un pedido' }, BOTON_VOLVER_MENU] }],
      nuevoFlujo: { ...flujo, estado: 'MENU', repreguntasFallidas: 0 },
    };
  }

  // 6. Intención: "Promociones de hoy"
  const paginaPromos = idInteractivo?.startsWith('promo_mas_') ? Math.max(2, parseInt(idInteractivo.slice(10), 10) || 2) : 1;
  const esPromociones =
    paginaPromos > 1 ||
    idInteractivo === 'btn_promociones' ||
    idInteractivo === 'promos' ||
    idInteractivo === 'faq_promos' ||
    coincideAlgunaPalabra(texto, PALABRAS_PROMOS);

  if (esPromociones) return respuestaPromociones(flujo, contexto, paginaPromos);

  // 7. Navegación de la carta: Selección de categoría o productos
  // 7.a Ver más categorías
  if (idInteractivo?.startsWith('cat_mas_')) {
    const sigPag = parseInt(idInteractivo.replace('cat_mas_', ''), 10) || 0;
    const accionLista = construirListaCategorias(
      contexto.categoriasCarta || [],
      sigPag,
      contexto.datosLocal,
    );
    return {
      nuevoEstado: 'CARTA_CATEGORIAS',
      acciones: [accionLista],
      nuevoFlujo: {
        ...flujo,
        estado: 'CARTA_CATEGORIAS',
        paginaCategorias: sigPag,
        repreguntasFallidas: 0,
      },
    };
  }

  // 7.b Ver más productos de una categoría
  if (idInteractivo?.startsWith('prod_mas_')) {
    const partes = idInteractivo.split('_');
    const catId = partes[2];
    const cat = (contexto.categoriasCarta || []).find((c: any) => String(c.id) === String(catId));
    if (cat) {
      return productosDeCategoria(flujo, cat, entrada, contexto, 'CARTA_PRODUCTOS');
    }
  }

  // 7.c Selección de una categoría específica
  if (idInteractivo?.startsWith('cat_')) {
    const catId = idInteractivo.replace('cat_', '');
    const cat = (contexto.categoriasCarta || []).find((c: any) => String(c.id) === String(catId));
    if (cat) {
      const todosAgotados =
        cat.productos && cat.productos.length > 0 && cat.productos.every((p: any) => !p.disponible);

      if (todosAgotados) {
        return {
          nuevoEstado: 'CARTA_PRODUCTOS',
          acciones: [
            {
              tipo: 'enviarBotones',
              texto: TEXTOS_BOT.categoriaAgotada(cat.nombre),
              botones: [BOTON_VOLVER_CATEGORIAS, BOTON_VOLVER_MENU],
            },
          ],
          nuevoFlujo: {
            ...flujo,
            estado: 'CARTA_PRODUCTOS',
            categoriaSeleccionadaId: catId,
            repreguntasFallidas: 0,
          },
        };
      }

      return productosDeCategoria(flujo, cat, entrada, contexto, 'CARTA_PRODUCTOS');
    }
  }

  // 7.d Selección de un producto específico
  if (idInteractivo?.startsWith('prod_')) {
    const prodId = idInteractivo.replace('prod_', '');
    let productoEncontrado: any = null;

    for (const c of contexto.categoriasCarta || []) {
      const p = (c.productos || []).find((prod: any) => String(prod.id) === String(prodId));
      if (p) {
        productoEncontrado = p;
        break;
      }
    }

    if (productoEncontrado) {
      const ofertaEncajada = buscarOfertaParaProducto(
        productoEncontrado,
        contexto.ofertas || [],
        contexto.categoriasCarta || [],
      );

      const yaEnPedido = Boolean(
        flujo.pedido &&
        (flujo.pedido as any).productoSeleccionadoId === String(prodId),
      );

      const cierre = generarCierreComercial({
        producto: productoEncontrado,
        oferta: ofertaEncajada,
        funcionesActivas: contexto.funcionesActivas,
        indiceVariante: Number(prodId || 0),
        yaEnPedido,
      });

      const textoDetalle = TEXTOS_BOT.detalleProducto(productoEncontrado, contexto.cartaUrlPublica);
      const textoFinal = adjuntarCierreComercial(textoDetalle, cierre);

      return {
        nuevoEstado: 'CARTA_PRODUCTO_DETALLE',
        acciones: [
          {
            tipo: 'enviarBotones',
            texto: textoFinal,
            botones: cierre.botones.length > 0 ? cierre.botones : [BOTON_VOLVER_CATEGORIAS, BOTON_VOLVER_MENU],
          },
        ],
        nuevoFlujo: {
          ...flujo,
          estado: 'CARTA_PRODUCTO_DETALLE',
          productoSeleccionadoId: prodId,
          repreguntasFallidas: 0,
        },
      };
    }
  }

  // 7.e Intención: "Ver la carta" (abre menú de categorías)
  const esCarta =
    idInteractivo === 'carta' ||
    idInteractivo === 'btn_carta' ||
    idInteractivo === 'btn_categorias' ||
    coincideAlgunaPalabra(texto, PALABRAS_CARTA);

  if (esCarta) {
    const categorias = contexto.categoriasCarta || [];
    if (categorias.length === 0) {
      return {
        nuevoEstado: 'MENU',
        acciones: [
          {
            tipo: 'enviarBotones',
            texto: 'Por el momento nuestra carta virtual se encuentra en actualización.',
            botones: [BOTON_VOLVER_MENU],
          },
        ],
        nuevoFlujo: {
          ...flujo,
          estado: 'MENU',
          repreguntasFallidas: 0,
        },
      };
    }

    const accionLista = construirListaCategorias(categorias, 0, contexto.datosLocal);
    return {
      nuevoEstado: 'CARTA_CATEGORIAS',
      acciones: [accionLista],
      nuevoFlujo: {
        ...flujo,
        estado: 'CARTA_CATEGORIAS',
        paginaCategorias: 0,
        repreguntasFallidas: 0,
      },
    };
  }

  // 8. Intención: "Mi pedido" / Seguimiento (requisito d, mockup líneas 268-285)
  const esMiPedido =
    idInteractivo === 'mipedido' ||
    idInteractivo?.startsWith('ord_') ||
    codigoDetectado !== null ||
    coincideAlgunaPalabra(texto, PALABRAS_MI_PEDIDO) ||
    coincideAlgunaPalabra(texto, PALABRAS_ETA) ||
    coincideAlgunaPalabra(texto, PALABRAS_CAMBIO_DIR) ||
    coincideAlgunaPalabra(texto, PALABRAS_CAMBIO_PED);

  if (esMiPedido || flujo.estado === 'MI_PEDIDO' || flujo.estado === 'MI_PEDIDO_DETALLE') {
    // Si se excedió el límite de 5 consultas por minuto
    if (contexto.limiteConsultasExcedido) {
      return {
        nuevoEstado: 'MENU',
        acciones: [
          {
            tipo: 'enviarBotones',
            texto: TEXTOS_BOT.miPedidoDemasiadasConsultas(),
            botones: [BOTON_VOLVER_MENU],
          },
        ],
        nuevoFlujo: {
          ...flujo,
          repreguntasFallidas: 0,
        },
      };
    }

    const codigoObjetivo =
      codigoDetectado ||
      (idInteractivo?.startsWith('ord_') ? idInteractivo.replace('ord_', '') : null) ||
      flujo.codigoPedido ||
      contexto.pedidoActivo?.codigo;

    // Si aún no hay código y no encontramos pedido activo
    if (!codigoObjetivo) {
      return {
        nuevoEstado: 'MI_PEDIDO',
        acciones: [
          {
            tipo: 'enviarTexto',
            texto: TEXTOS_BOT.miPedidoPedirCodigo(),
          },
        ],
        nuevoFlujo: {
          ...flujo,
          estado: 'MI_PEDIDO',
          repreguntasFallidas: 0,
        },
      };
    }

    // Si se buscó un código pero el pedido no existe o no pertenece al cliente (contexto.pedidoActivo === null)
    if (contexto.pedidoActivo === null && (codigoDetectado || idInteractivo?.startsWith('ord_'))) {
      return {
        nuevoEstado: 'MENU',
        acciones: [
          {
            tipo: 'enviarBotones',
            texto: TEXTOS_BOT.miPedidoNoEncontrado(),
            botones: [
              { id: 'pedir', titulo: 'Hacer un pedido' },
              BOTON_VOLVER_MENU,
            ],
          },
        ],
        nuevoFlujo: {
          ...flujo,
          estado: 'MENU',
          repreguntasFallidas: 0,
        },
      };
    }

    // Pedido activo encontrado y verificado
    const pedido = contexto.pedidoActivo;
    const st = String(pedido?.estado || 'COLA').toLowerCase();
    // La captura del pago es opcional: se informa siempre el estado real del pedido (cocina, listo, en camino...),
    // nunca «esperando pago» ni «captura en revisión».
    const esEnRuta = st === 'en_camino' || st === 'ruta';

    // Manejo de sub-intenciones sobre el pedido activo:
    // a) ¿Cuánto falta?
    const pideEta = idInteractivo === 'c_eta' || coincideAlgunaPalabra(texto, PALABRAS_ETA);
    if (pideEta) {
      if (st === 'entregado') {
        return {
          nuevoEstado: 'ATENCION_PERSONA',
          acciones: [
            {
              tipo: 'pasarAPersona',
              motivo: 'CONSULTA_TRAS_ENTREGA',
              mensajeCliente: entrada.textoOriginal,
            },
            {
              tipo: 'enviarTexto',
              texto: TEXTOS_BOT.miPedidoEstado({ codigo: codigoObjetivo, estado: 'entregado' }),
            },
          ],
          nuevoFlujo: {
            ...flujo,
            estado: 'ATENCION_PERSONA',
            repreguntasFallidas: 0,
          },
        };
      }

      const creado = pedido?.creado_en ? new Date(pedido.creado_en).getTime() : Date.now();
      const transcurrido = Math.max(0, Math.floor((Date.now() - creado) / 60000));
      const extra = contexto.datosLocal?.altaDemandaMinutosExtra || 0;
      const base = 25 + extra;
      const tope = 35 + extra;
      const demora = transcurrido >= tope;

      if (demora && st !== 'llego' && !esEnRuta) {
        return {
          nuevoEstado: 'ATENCION_PERSONA',
          acciones: [
            {
              tipo: 'pasarAPersona',
              motivo: 'DEMORA_EN_ENTREGA',
              mensajeCliente: entrada.textoOriginal,
            },
            {
              tipo: 'enviarTexto',
              texto: TEXTOS_BOT.miPedidoEstado({
                codigo: codigoObjetivo,
                estado: st,
                tiempoEstimadoMin: base,
                tiempoMaxMin: tope,
                minutosTranscurridos: transcurrido,
              }),
            },
          ],
          nuevoFlujo: {
            ...flujo,
            estado: 'ATENCION_PERSONA',
            repreguntasFallidas: 0,
          },
        };
      }

      return {
        nuevoEstado: 'MI_PEDIDO_DETALLE',
        acciones: [
          {
            tipo: 'enviarBotones',
            texto: TEXTOS_BOT.miPedidoEstado({
              codigo: codigoObjetivo,
              estado: st,
              tiempoEstimadoMin: base,
              tiempoMaxMin: tope,
              minutosTranscurridos: transcurrido,
              altaDemanda: !!contexto.datosLocal?.pausaAltaDemanda || extra > 0,
              minutosExtraDemanda: extra,
            }),
            botones: [BOTON_VOLVER_MENU],
          },
        ],
        nuevoFlujo: {
          ...flujo,
          estado: 'MI_PEDIDO_DETALLE',
          codigoPedido: codigoObjetivo,
          repreguntasFallidas: 0,
        },
      };
    }

    // b) Cambiar dirección
    const pideCambioDir = idInteractivo === 'c_dir' || coincideAlgunaPalabra(texto, PALABRAS_CAMBIO_DIR);
    if (pideCambioDir) {
      return {
        nuevoEstado: 'ATENCION_PERSONA',
        acciones: [
          {
            tipo: 'pasarAPersona',
            motivo: esEnRuta ? 'CAMBIO_DIRECCION_URGENTE' : 'CAMBIO_DIRECCION',
            mensajeCliente: entrada.textoOriginal,
          },
          {
            tipo: 'enviarTexto',
            texto: TEXTOS_BOT.miPedidoCambioDireccion(esEnRuta),
          },
        ],
        nuevoFlujo: {
          ...flujo,
          estado: 'ATENCION_PERSONA',
          repreguntasFallidas: 0,
        },
      };
    }

    // c) Cambiar o cancelar pedido
    const pideCambioPed = idInteractivo === 'c_ped' || coincideAlgunaPalabra(texto, PALABRAS_CAMBIO_PED);
    if (pideCambioPed) {
      return {
        nuevoEstado: 'ATENCION_PERSONA',
        acciones: [
          {
            tipo: 'pasarAPersona',
            motivo: esEnRuta ? 'CAMBIO_PEDIDO_EN_RUTA' : 'CAMBIO_CANCELACION_PEDIDO',
            mensajeCliente: entrada.textoOriginal,
          },
          {
            tipo: 'enviarTexto',
            texto: TEXTOS_BOT.miPedidoCambioOAnulacion(esEnRuta),
          },
        ],
        nuevoFlujo: {
          ...flujo,
          estado: 'ATENCION_PERSONA',
          repreguntasFallidas: 0,
        },
      };
    }

    // Presentar menú de opciones sobre el pedido reconocido
    return {
      nuevoEstado: 'MI_PEDIDO_DETALLE',
      acciones: [
        {
          tipo: 'enviarBotones',
          texto: TEXTOS_BOT.miPedidoOpciones(codigoObjetivo),
          botones: BOTONES_MI_PEDIDO,
        },
      ],
      nuevoFlujo: {
        ...flujo,
        estado: 'MI_PEDIDO_DETALLE',
        codigoPedido: codigoObjetivo,
        repreguntasFallidas: 0,
      },
    };
  }

  // 9. Preguntas frecuentes (mockup líneas 215-221 DUDAS y respuestas desde BD)
  const esPreguntas =
    idInteractivo === 'preguntar' ||
    idInteractivo === 'btn_preguntas' ||
    coincideAlgunaPalabra(texto, PALABRAS_PREGUNTAR);

  if (esPreguntas) {
    const nuevoEstado: EstadoConversacion = 'PREGUNTAS';
    return {
      nuevoEstado,
      acciones: [
        {
          tipo: 'enviarLista',
          texto: TEXTOS_BOT.preguntasCuerpo(),
          botonTexto: BOTON_LISTA_PREGUNTAS,
          tituloSeccion: TITULO_SECCION_PREGUNTAS,
          filas: FILAS_PREGUNTAS_FRECUENTES,
        },
      ],
      nuevoFlujo: {
        ...flujo,
        estado: nuevoEstado,
        repreguntasFallidas: 0,
      },
    };
  }

  // Respuestas dinámicas a cada pregunta frecuente:
  // a) Intolerancia a la lactosa
  if (idInteractivo === 'faq_lactosa' || coincideAlgunaPalabra(texto, ['lactosa', 'intolerante', 'sin lactosa', 'leche vegetal'])) {
    let opcionesLeche: { nombre: string; extra: number; disponible: boolean }[] = [];
    for (const cat of contexto.categoriasCarta || []) {
      for (const prod of cat.productos || []) {
        for (const grp of prod.grupos || []) {
          if (/leche/i.test(grp.nombre || '')) {
            opcionesLeche = (grp.opciones || []).map((o: any) => ({
              nombre: o.nombre,
              extra: Number(o.precioExtra || 0),
              disponible: !!o.disponible,
            }));
            break;
          }
        }
        if (opcionesLeche.length > 0) break;
      }
      if (opcionesLeche.length > 0) break;
    }

    if (opcionesLeche.length === 0) {
      opcionesLeche = [
        { nombre: 'leche sin lactosa', extra: 0, disponible: true },
        { nombre: 'bebida de almendra', extra: 2.5, disponible: true },
      ];
    }

    return {
      nuevoEstado: 'PREGUNTAS',
      acciones: [
        {
          tipo: 'enviarBotones',
          texto: TEXTOS_BOT.faqLactosa(opcionesLeche),
          botones: [BOTON_OTRAS_PREGUNTAS, BOTON_VOLVER_MENU],
        },
      ],
      nuevoFlujo: { ...flujo, estado: 'PREGUNTAS', repreguntasFallidas: 0 },
    };
  }

  // b) Bebidas calientes
  if (idInteractivo === 'faq_calientes' || coincideAlgunaPalabra(texto, ['bebidas calientes', 'calientes', 'cafes', 'cafe'])) {
    const catCalientes = (contexto.categoriasCarta || []).find((c: any) => /caliente/i.test(c.nombre));
    const productos = (catCalientes?.productos || []).map((p: any) => ({
      nombre: p.nombre,
      disponible: !!p.disponible,
    }));

    return {
      nuevoEstado: 'PREGUNTAS',
      acciones: [
        {
          tipo: 'enviarBotones',
          texto: TEXTOS_BOT.faqCalientes(productos),
          botones: [BOTON_OTRAS_PREGUNTAS, BOTON_VOLVER_MENU],
        },
      ],
      nuevoFlujo: { ...flujo, estado: 'PREGUNTAS', repreguntasFallidas: 0 },
    };
  }

  // c) Postres de hoy
  if (idInteractivo === 'faq_postres' || coincideAlgunaPalabra(texto, ['postres', 'waffles', 'dulces', 'donas'])) {
    const catWaffles = (contexto.categoriasCarta || []).find((c: any) => /waffle|postre|dulce/i.test(c.nombre));
    const productos = (catWaffles?.productos || []).map((p: any) => ({
      nombre: p.nombre,
      disponible: !!p.disponible,
    }));

    return {
      nuevoEstado: 'PREGUNTAS',
      acciones: [
        {
          tipo: 'enviarBotones',
          texto: TEXTOS_BOT.faqPostres(productos),
          botones: [BOTON_OTRAS_PREGUNTAS, BOTON_VOLVER_MENU],
        },
      ],
      nuevoFlujo: { ...flujo, estado: 'PREGUNTAS', repreguntasFallidas: 0 },
    };
  }

  // d) Ubicación
  if (idInteractivo === 'faq_ubicacion' || coincideAlgunaPalabra(texto, ['donde estan', 'ubicacion', 'direccion', 'llegar', 'mapa'])) {
    return {
      nuevoEstado: 'UBICACION',
      acciones: [
        {
          tipo: 'enviarBotones',
          texto: TEXTOS_BOT.faqUbicacion(contexto.datosLocal),
          botones: [BOTON_OTRAS_PREGUNTAS, BOTON_VOLVER_MENU],
        },
      ],
      nuevoFlujo: { ...flujo, estado: 'UBICACION', repreguntasFallidas: 0 },
    };
  }

  // e) Horario
  if (idInteractivo === 'faq_horario' || coincideAlgunaPalabra(texto, ['horario', 'hasta que hora', 'abren', 'cierran'])) {
    return {
      nuevoEstado: 'HORARIO',
      acciones: [
        {
          tipo: 'enviarBotones',
          texto: TEXTOS_BOT.faqHorario(contexto.datosLocal),
          botones: [BOTON_OTRAS_PREGUNTAS, BOTON_VOLVER_MENU],
        },
      ],
      nuevoFlujo: { ...flujo, estado: 'HORARIO', repreguntasFallidas: 0 },
    };
  }

  // f) Medios de pago
  if (idInteractivo === 'faq_pagos' || (!preguntaEspecificaParaIa(entrada, contexto) && coincideAlgunaPalabra(texto, ['pago', 'pagos', 'yape', 'plin', 'tarjeta', 'efectivo']))) {
    return {
      nuevoEstado: 'PREGUNTAS',
      acciones: [
        {
          tipo: 'enviarBotones',
          texto: TEXTOS_BOT.faqPagos(contexto.datosLocalPublicos?.mediosPago || {}),
          botones: [BOTON_OTRAS_PREGUNTAS, BOTON_VOLVER_MENU],
        },
      ],
      nuevoFlujo: { ...flujo, estado: 'PREGUNTAS', repreguntasFallidas: 0 },
    };
  }

  // g) Costo de delivery
  if (idInteractivo === 'faq_delivery' || (!preguntaEspecificaParaIa(entrada, contexto) && coincideAlgunaPalabra(texto, ['delivery', 'costo envio', 'envio gratis', 'zonas reparto']))) {
    return {
      nuevoEstado: 'PREGUNTAS',
      acciones: [
        {
          tipo: 'enviarBotones',
          texto: TEXTOS_BOT.faqDelivery(
            contexto.datosLocalPublicos?.pedidoMinimo,
            contexto.datosLocalPublicos?.envioGratisDesde,
          ),
          botones: [BOTON_OTRAS_PREGUNTAS, BOTON_VOLVER_MENU],
        },
      ],
      nuevoFlujo: { ...flujo, estado: 'PREGUNTAS', repreguntasFallidas: 0 },
    };
  }

  // 10. Saludo inicial, inicio o regreso al menú principal
  const esSaludo =
    flujo.estado === 'INICIO' ||
    idInteractivo === 'btn_menu' ||
    idInteractivo === 'menu' ||
    coincideAlgunaPalabra(texto, PALABRAS_SALUDO);

  if (esSaludo) {
    const nuevoEstado: EstadoConversacion = 'MENU';
    const filasMenu = [...FILAS_MENU_PRINCIPAL];

    const codActivo = flujo.codigoPedido || contexto.pedidoActivo?.codigo;
    if (codActivo) {
      const idx = filasMenu.findIndex((f) => f.id === 'mipedido');
      if (idx >= 0) {
        filasMenu[idx] = {
          ...filasMenu[idx],
          titulo: `📦 Mi pedido ${codActivo}`.slice(0, 24),
        };
      }
    }

    const nuevoFlujo: FlujoConversacion = {
      ...flujo,
      version: ESQUEMA_FLUJO_VERSION,
      estado: nuevoEstado,
      repreguntasFallidas: 0,
      paginaCategorias: 0,
      paginaProductos: 0,
    };

    return {
      nuevoEstado,
      acciones: [
        {
          tipo: 'enviarLista',
          texto: TEXTOS_BOT.saludoBienvenida(contexto.nombreCliente, contexto.datosLocal, null, {
            textos: contexto.textosPersonalizados,
            promos: contexto.promosBienvenida,
            linkCarta: contexto.cartaUrlPublica || 'https://caprichos.pe',
          }),
          botonTexto: BOTON_LISTA_MENU,
          tituloSeccion: TITULO_SECCION_MENU,
          filas: filasMenu,
        },
      ],
      nuevoFlujo,
    };
  }

  // 11. Manejo de horario y ubicación por palabras clave generales
  if (coincideAlgunaPalabra(texto, PALABRAS_HORARIO_UBICACION)) {
    return {
      nuevoEstado: 'HORARIO',
      acciones: [
        {
          tipo: 'enviarBotones',
          texto: TEXTOS_BOT.horarioYUbicacion(contexto.datosLocal),
          botones: [BOTON_VOLVER_MENU],
        },
      ],
      nuevoFlujo: {
        ...flujo,
        estado: 'HORARIO',
        repreguntasFallidas: 0,
      },
    };
  }

  // 11.b Despedida o agradecimiento del cliente
  if (coincideAlgunaPalabra(texto, PALABRAS_DESPEDIDA)) {
    return {
      nuevoEstado: 'MENU',
      acciones: [
        {
          tipo: 'enviarBotones',
          texto: TEXTOS_BOT.despedida(contexto.textosPersonalizados?.chatbot_texto_despedida),
          botones: [BOTON_VOLVER_MENU],
        },
      ],
      nuevoFlujo: {
        ...flujo,
        estado: 'MENU',
        repreguntasFallidas: 0,
      },
    };
  }

  // 12. Mensaje no entendido:
  // Si la IA para dudas está activa (chatbot_ia_activo === 'si'), se invoca a la IA en lugar de la repregunta:
  if (contexto.chatbotIaActivo) {
    return {
      nuevoEstado: 'DUDA_IA',
      acciones: [
        {
          tipo: 'consultarIa',
          pregunta: entrada.textoOriginal || entrada.texto,
        },
      ],
      nuevoFlujo: {
        ...flujo,
        estado: 'DUDA_IA',
        repreguntasFallidas: 0,
      },
    };
  }

  // - Primera vez (repreguntasFallidas === 0): repregunta una vez mostrando opciones (mockup línea 305).
  // - Segunda vez consecutiva (repreguntasFallidas >= 1): pasa a una persona del equipo (mockup línea 304).
  if (flujo.repreguntasFallidas === 0) {
    const nuevoEstado: EstadoConversacion = flujo.estado === 'INICIO' ? 'MENU' : flujo.estado;
    return {
      nuevoEstado,
      acciones: [
        {
          tipo: 'enviarLista',
          texto:
            TEXTOS_BOT.noEntiendoRepregunta(contexto.textosPersonalizados?.chatbot_texto_no_entiendo) +
            TEXTOS_SOLO_MENUS.lineaCartaNoEntiendo(contexto.cartaUrlPublica || 'https://caprichos.pe'),
          botonTexto: BOTON_LISTA_MENU,
          tituloSeccion: TITULO_SECCION_MENU,
          filas: FILAS_MENU_PRINCIPAL,
        },
      ],
      nuevoFlujo: {
        ...flujo,
        estado: nuevoEstado,
        repreguntasFallidas: 1,
      },
    };
  }

  // Derivación humana automática ante el segundo mensaje consecutivo no entendido
  const nuevoEstado: EstadoConversacion = 'ATENCION_PERSONA';
  return {
    nuevoEstado,
    acciones: [
      {
        tipo: 'pasarAPersona',
        motivo: 'MENSAJE_NO_ENTENDIDO',
        mensajeCliente: entrada.textoOriginal,
      },
      {
        tipo: 'enviarTexto',
        texto: TEXTOS_BOT.noEntiendoDerivacion(
          contexto.textosPersonalizados?.chatbot_texto_no_entiendo_derivacion,
        ),
      },
    ],
    nuevoFlujo: {
      ...flujo,
      estado: nuevoEstado,
      repreguntasFallidas: flujo.repreguntasFallidas + 1,
    },
  };
}

/** Carrusel de «Ver la carta»: productos destacados (más vendidos primero), con «Pedir este» en cada tarjeta. */
function accionesCartaSoloMenus(contexto: ContextoConversacion, url: string): any[] {
  const unicos = new Map<string, any>();
  for (const c of contexto.categoriasCarta || []) {
    for (const p of c.productos || []) {
      if (p.disponible !== false && !unicos.has(String(p.id))) unicos.set(String(p.id), p);
    }
  }
  if (unicos.size === 0) {
    return [{ tipo: 'enviarBotones', texto: TEXTOS_SOLO_MENUS.cartaSinProductos(url), botones: [BOTON_VOLVER_MENU] }];
  }
  const destacados = ordenarPorVentas([...unicos.values()], contexto.ventasProductos).slice(0, LIMITES_CARRUSEL.max);
  const tarjetas = destacados.map((p) => tarjetaProducto(p, contexto.cartaUrlPublica, lineaAvisoStock(p, contexto)));
  const cuerpo = TEXTOS_SOLO_MENUS.cartaDestacados(url);
  if (tarjetas.length < LIMITES_CARRUSEL.min) {
    return [{ tipo: 'enviarBotones', texto: cuerpo, botones: [BOTON_VOLVER_MENU] }];
  }
  return [
    {
      tipo: 'enviarCarrusel',
      carga: {
        cuerpo,
        tarjetas,
        botonComun: BOTON_VOLVER_MENU,
        respaldo: { texto: cuerpo, botones: [BOTON_VOLVER_MENU] },
      },
    },
  ];
}

/** Respuesta de una pregunta frecuente (lactosa, bebidas calientes, postres, pagos, delivery). */
function respuestaFaqSoloMenus(clave: string, contexto: ContextoConversacion, textoCliente = '', conBotones = true): any {
  const botones = [BOTON_OTRAS_PREGUNTAS, BOTON_VOLVER_MENU];
  // Pregunta escrita: se responde en un solo mensaje corto, sin repetir el menú; con botón de la lista, como siempre
  const enviar = (texto: string) => (conBotones ? { tipo: 'enviarBotones', texto, botones } : { tipo: 'enviarTexto', texto });

  if (clave === 'horario') {
    return enviar(TEXTOS_BOT.horarioYUbicacion(contexto.datosLocal));
  }

  if (clave === 'lactosa') {
    let opcionesLeche: { nombre: string; extra: number; disponible: boolean }[] = [];
    for (const cat of contexto.categoriasCarta || []) {
      for (const prod of cat.productos || []) {
        for (const grp of prod.grupos || []) {
          if (/leche/i.test(grp.nombre || '')) {
            opcionesLeche = (grp.opciones || []).map((o: any) => ({
              nombre: o.nombre,
              extra: Number(o.precioExtra || 0),
              disponible: !!o.disponible,
            }));
            break;
          }
        }
        if (opcionesLeche.length > 0) break;
      }
      if (opcionesLeche.length > 0) break;
    }
    if (opcionesLeche.length === 0) {
      opcionesLeche = [
        { nombre: 'leche sin lactosa', extra: 0, disponible: true },
        { nombre: 'bebida de almendra', extra: 2.5, disponible: true },
      ];
    }
    return enviar(TEXTOS_BOT.faqLactosa(opcionesLeche));
  }

  if (clave === 'calientes') {
    const catCalientes = (contexto.categoriasCarta || []).find((c: any) => /caliente/i.test(c.nombre));
    const productos = (catCalientes?.productos || []).map((p: any) => ({ nombre: p.nombre, disponible: !!p.disponible }));
    return enviar(TEXTOS_BOT.faqCalientes(productos));
  }

  if (clave === 'postres') {
    const catPostres = (contexto.categoriasCarta || []).find((c: any) => /waffle|postre|dulce/i.test(c.nombre));
    const productos = (catPostres?.productos || []).map((p: any) => ({ nombre: p.nombre, disponible: !!p.disponible }));
    return enviar(TEXTOS_BOT.faqPostres(productos));
  }

  if (clave === 'pagos') {
    return enviar(textoPagoMedio(contexto, textoCliente));
  }

  return enviar(
    conBotones
      ? TEXTOS_BOT.faqDelivery(contexto.datosLocalPublicos?.pedidoMinimo, contexto.datosLocalPublicos?.envioGratisDesde)
      : TEXTOS_SOLO_MENUS.deliveryRespuesta(contexto.datosLocalPublicos?.pedidoMinimo, contexto.datosLocalPublicos?.envioGratisDesde, contexto.datosLocal, /costo|cuesta|cuanto|tarifa|precio/.test(textoCliente)),
  );
}


/** Medios de pago que el cliente nombra y los activos del local: «¿aceptan tarjeta?» se contesta con sí o no, no con la lista. */
const ALIAS_MEDIOS: Record<string, string[]> = {
  yape: ['yape'],
  plin: ['plin'],
  efectivo: ['efectivo', 'cash', 'billete'],
  tarjeta: ['tarjeta', 'visa', 'mastercard', 'credito', 'debito', 'culqi'],
  transferencia: ['transferencia', 'deposito', 'bcp', 'interbank'],
};
function textoPagoMedio(contexto: ContextoConversacion, textoCliente: string): string {
  const medios = Object.entries(contexto.datosLocalPublicos?.mediosPago || {}).filter(([, c]: [string, any]) => c?.activo !== false) as [string, any][];
  const activos = medios.map(([k, c]) => c?.nombre || k.toUpperCase());
  const pedido = Object.entries(ALIAS_MEDIOS).find(([, alias]) => alias.some((a) => new RegExp(`(^|\\s)${a}(\\s|$)`).test(textoCliente)));
  if (!pedido) return TEXTOS_SOLO_MENUS.pagoMedio(null, false, null, activos);
  const hit = medios.find(([k, c]) => pedido[1].some((a) => normalizarTexto(`${k} ${c?.nombre ?? ''}`).includes(a) || a === normalizarTexto(k)));
  return TEXTOS_SOLO_MENUS.pagoMedio(pedido[0], Boolean(hit), hit ? hit[1]?.nombre || hit[0] : null, activos);
}

const RE_SOBRE_SU_PEDIDO = /(^|\s)(ya|mi|mis|pedido|saldo|pague|pagado|cancele|yape|yapee|plin|transferi\w*|voucher|deposit\w*|no me)(\s|$)/;
const RE_PIDE_COMPROBANTE = /(^|\s)(boleta|boletas|factura|facturas|facturan|comprobante|comprobantes)(\s|$)/;
const RE_COMPROBANTE_CAMBIO = /(cambi|correg|modific|error|equivoc|reclam|anul|ya pague|ya hice|ya sali|no me llego|no llego)/;
const RE_PIDE_VUELTO = /(^|\s)(vuelto|sencillo)(\s|$)|(tienen|tendran|llevan|hay|tienes) cambio|cambio (para|de) (un )?(billete|\d)/;
const RE_EFECTIVO_ENTREGA = /(^|\s)(efectivo|cash)(\s|$)/;
const RE_ENTREGA = /(delivery|domicilio|repartidor|reparto|entrega|entregan|al recibir|contra ?entrega|a mi casa|llega)/;

/** Boleta/factura, vuelto y efectivo al repartidor: texto fijo corto. null = no aplica (sigue su camino, p. ej. la IA). */
function respuestaFijaCorta(texto: string, contexto: ContextoConversacion): string | null {
  // Solo la pregunta simple y corta; una frase larga o sobre SU pedido o pago («ya pagué por yape…») la contesta la IA con sus datos
  if (texto.split(' ').length > 9 || RE_SOBRE_SU_PEDIDO.test(texto)) return null;
  if (RE_PIDE_COMPROBANTE.test(texto) && !RE_COMPROBANTE_CAMBIO.test(texto)) return TEXTOS_SOLO_MENUS.comprobante();
  if (RE_PIDE_VUELTO.test(texto)) return TEXTOS_SOLO_MENUS.vuelto();
  if (RE_EFECTIVO_ENTREGA.test(texto) && RE_ENTREGA.test(texto)) {
    // Solo si el efectivo está encendido en el local (si no, lo contesta la pregunta de pagos con la lista real)
    const ef: any = (contexto.datosLocalPublicos?.mediosPago as any)?.efectivo;
    if (ef?.activo !== false) return TEXTOS_SOLO_MENUS.efectivoDelivery();
  }
  return null;
}

/** Distancia de edición mínima (faltas de ortografía: «frape», «capucino»). */
function distancia(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
const mismaPalabra = (a: string, b: string): boolean => a === b || (a.length >= 5 && b.length >= 5 && distancia(a, b) <= 1) || (a.length >= 6 && b.length >= 6 && distancia(a, b) <= 2);

const RE_PREGUNTA_PRODUCTO = /(^|\s)(cuanto|cuesta|cuestan|precio|precios|vale|valen|sale|salen|a como|tienen|tienes|tiene|hay|venden|manejan|disponible|disponibles|algun|alguna)(\s|$)/;
const PALABRAS_RELLENO = new Set(['cuanto', 'cuesta', 'cuestan', 'precio', 'precios', 'vale', 'valen', 'sale', 'salen', 'como', 'tienen', 'tienes', 'tiene', 'hay', 'venden', 'manejan', 'disponible', 'disponibles', 'algun', 'alguna', 'para', 'por', 'favor', 'porfa', 'del', 'los', 'las', 'una', 'unos', 'unas', 'que', 'con', 'sera', 'seria', 'esta', 'estan', 'hola', 'buenas', 'buenos', 'dias', 'tardes', 'noches', 'quiero', 'saber']);

/**
 * Productos de la carta que encajan con lo preguntado («cuanto cuesta el frape oreo»), tolerando faltas.
 * Gana el que más palabras comparte; si solo coincide una palabra común («frappe») salen todos los que la llevan.
 * Con una palabra de categoría («hay bebidas calientes») salen los productos de esa categoría.
 */
function productosPreguntados(texto: string, contexto: ContextoConversacion, seguimiento = false): { productos: any[]; categoria?: string } | null {
  // «y el capucino?»: sin palabra de precio, pero sigue una pregunta (empieza con «y» o termina en «?»)
  if (!RE_PREGUNTA_PRODUCTO.test(texto) && !seguimiento) return null;
  const q = texto.split(' ').filter((w) => w.length >= 3 && !PALABRAS_RELLENO.has(w));
  if (!q.length) return null;
  const todos: any[] = [];
  for (const c of contexto.categoriasCarta || []) for (const p of c.productos || []) if (!todos.some((x) => String(x.id) === String(p.id))) todos.push(p);
  const puntuados = todos
    .map((p) => ({ p, n: normalizarTexto(p.nombre).split(' ').filter((w) => w.length >= 3 && q.some((x) => mismaPalabra(x, w))).length }))
    .filter((x) => x.n > 0);
  if (puntuados.length) {
    const max = Math.max(...puntuados.map((x) => x.n));
    return { productos: puntuados.filter((x) => x.n === max).map((x) => x.p).slice(0, 6) };
  }
  const cat = (contexto.categoriasCarta || []).find((c: any) => normalizarTexto(c.nombre).split(' ').some((w: string) => w.length >= 4 && q.some((x) => mismaPalabra(x, w) || mismaPalabra(x, w.replace(/s$/, '')))));
  const prods = (cat?.productos || []).filter((p: any) => p.disponible !== false).slice(0, 8);
  return cat && prods.length ? { productos: prods, categoria: cat.nombre } : null;
}

function hay_(res: RegExp[], texto: string): boolean {
  return res.some((r) => r.test(texto));
}
const RE_INSULTO = /(^|\s)(mierda|porqueria|basura|idiota|estupido|estupida|imbecil|inutil|huevon|conchatumadre|puta|puto|carajo|maldito|maldita|asco|cojudo|pendejo)(\s|$)/;
const RE_ESTAN_ATENDIENDO = /(estan|siguen|aun|todavia|pueden|puedes|ya)\s+(atendiendo|atienden|atender|abiertos|abierto|reciben)|se puede pedir|estan abiertos|hay atencion|atienden hoy|atienden ahora/;
const RE_HORARIO = /(^|\s)(horario|horarios|abren|cierran|abierto|abiertos|atienden|atencion|a que hora|hasta que hora|desde que hora)(\s|$)/;
const RE_LUGAR = /(^|\s)(ubicacion|ubicados|ubicado|mapa|direccion)(\s|$)|donde (estan|quedan|queda|se ubican|los encuentro|es el local|atienden)|como llego|como llegar/;
const RE_SMALLTALK = /^(hola |buenas |buenos dias |buenas tardes |buenas noches )?(como estas|que tal|como te va|como andas|todo bien|como amaneciste)( hoy)?$/;
const RE_RESERVA_DETALLES = /(\d{1,2}|dos|tres|cuatro|cinco|seis|siete|ocho|diez)\s*(personas|pax|amigos|amigas|chicas|chicos)|para\s+(\d|dos|tres|cuatro|cinco|seis|siete|ocho|diez)\b|(^|\s)(lunes|martes|miercoles|jueves|viernes|sabado|domingo|hoy|manana|pasado manana)(\s|$)|\d{1,2}\s*(pm|am|hrs|h)(\s|$)|a las \d/;
const RE_RESERVA_CAMBIO = /(cancel|anul|cambi|mover|modific|reprogram|postergar|adelantar)/;

/** Clave de la pregunta frecuente pedida (por botón o por palabra clave), o null. */
function claveFaqSoloMenus(id: string, texto: string): string | null {
  const porBoton: Record<string, string> = {
    faq_horario: 'horario',
    faq_lactosa: 'lactosa',
    faq_calientes: 'calientes',
    faq_postres: 'postres',
    faq_pagos: 'pagos',
    faq_delivery: 'delivery',
  };
  if (porBoton[id]) return porBoton[id];
  const reglas: [string, string[]][] = [
    ['lactosa', ['lactosa', 'intolerante', 'leche vegetal']],
    ['calientes', ['bebidas calientes', 'calientes', 'cafes', 'cafe']],
    ['postres', ['postres', 'waffles', 'dulces', 'donas']],
    ['pagos', ['pago', 'pagos', 'pagar', 'yape', 'plin', 'tarjeta', 'efectivo', 'transferencia', 'visa']],
    ['delivery', ['delivery', 'costo envio', 'costo del envio', 'cuesta el envio', 'cuanto cuesta enviar', 'envio gratis', 'zonas reparto', 'a domicilio', 'domicilio', 'reparto', 'repartidor']],
  ];
  const hit = reglas.find(([, palabras]) => coincideAlgunaPalabra(texto, palabras));
  return hit ? hit[0] : null;
}

/** Flujo de un subflujo modular (pedido o pago) si puede atender la entrada; null si no. */
function atenderConSubflujo(
  nombre: 'pedido' | 'pago',
  flujo: FlujoConversacion,
  entrada: EntradaNormalizada,
  contexto: ContextoConversacion,
): ResultadoTransicion | null {
  const sub = RegistroSubFlujos.obtenerFlujos().find((f) => f.nombre === nombre);
  if (!sub || !sub.puedeManejar(flujo, entrada, contexto)) return null;
  return sub.transicionar(flujo, entrada, contexto);
}

/**
 * Motor del bot con menú: pedido por chat (flujo de pedido del motor anterior), pago de pedidos y menú.
 * Sin promociones, descuentos, cupones, puntos ni IA. Un solo mensaje por turno cuando se puede.
 * El silencio de ATENCION_PERSONA (chat tomado por una persona) se decide antes, en transicionarEstado.
 */
function transicionarSoloMenus(
  flujoIn: FlujoConversacion,
  entrada: EntradaNormalizada,
  contexto: ContextoConversacion,
): ResultadoTransicion {
  const oferta = (flujoIn as any).ofertaAsesor as { tipo: 'pedido' | 'menu' } | undefined;
  if (!oferta) return transicionarSoloMenusNucleo(flujoIn, entrada, contexto);
  // Oferta de asesor pendiente (1 = sí, 2 = no): se resuelve aquí; cualquier otro texto sigue su camino normal
  const flujoSin: any = { ...flujoIn };
  delete flujoSin.ofertaAsesor;
  const t = entrada.texto.trim();
  if (entrada.id === 'asesor_si' || RE_RESPUESTA_SI.test(t)) {
    return pasarAsesor(flujoSin, entrada, contexto, 'ASESOR_ACEPTADO', TEXTOS_SOLO_MENUS.asesorAvisado(contexto.datosLocal?.abierta !== false, contexto.datosLocal?.abre));
  }
  if (entrada.id === 'asesor_no' || RE_RESPUESTA_NO.test(t)) {
    const vuelta: EntradaNormalizada = oferta.tipo === 'pedido' ? { tipo: 'texto', texto: '', textoOriginal: '' } : { tipo: 'boton', texto: 'menu', textoOriginal: 'menu', id: 'menu' };
    return transicionarSoloMenusNucleo(flujoSin, vuelta, contexto);
  }
  return transicionarSoloMenusNucleo(flujoSin, entrada, contexto);
}

const RE_RESPUESTA_SI = /^(1|(si|sip|claro|dale|ya|ok|quiero)( (por favor|porfa|xfa|pf|pfv))?|por favor|porfa|xfa|asesor)$/;
const RE_RESPUESTA_NO = /^(2|no|nop|no gracias|no por ahora)$/;

/** Pedido especial o personalizado (tortas por encargo, cumpleaños, eventos, catering, fotos de…): lo atiende una persona. */
const RE_PEDIDO_ESPECIAL =
  /cumpleanos|por encargo|encargo|personaliz|catering|\bevento|\bboda\b|matrimonio|bautizo|\bfotos? de\b|(tienes|tienen|ver|enviar?|envias|pasas|mandas|manda|mandame|pasame) (las |unas |alguna )?fotos?\b|pedido grande|al por mayor|por mayor|\b(haces|hacen|hace|quiero|quisiera|necesito) (una |un |unas |)(torta|tortas|pastel|pasteles)\b|\b(torta|tortas|pastel|pasteles)\b.*\b(pequena|pequenas|grande|grandes|medida|dedicatoria)\b/;

const esPedidoEspecial = (texto: string): boolean => RE_PEDIDO_ESPECIAL.test(texto) && !/reserv|mesa/.test(texto);

/** Pasa el chat a una persona (urgente, «Por responder») con el aviso de horario ya armado. */
function pasarAsesor(flujo: FlujoConversacion, entrada: EntradaNormalizada, contexto: ContextoConversacion, motivo: string, textoCliente: string): ResultadoTransicion {
  return {
    nuevoEstado: 'ATENCION_PERSONA',
    acciones: [
      { tipo: 'pasarAPersona', motivo, mensajeCliente: entrada.textoOriginal, esUrgente: true },
      { tipo: 'enviarTexto', texto: textoCliente },
    ],
    nuevoFlujo: { ...flujo, estado: 'ATENCION_PERSONA', pedido: null, repreguntasFallidas: 0 },
  };
}

/** Cambia el «Uy, no te entendí» de la repregunta por otro inicio (cuando el cliente no se equivocó). */
function cambiarPrefijoNoEntendi(acciones: AccionMensaje[], inicio: string): AccionMensaje[] {
  return acciones.map((a: any) =>
    typeof a.texto === 'string' && a.texto.startsWith(PREFIJO_NO_ENTENDI) ? { ...a, texto: `${inicio}${a.texto.slice(PREFIJO_NO_ENTENDI.length)}` } : a,
  );
}

/** Oferta de asesor con botones (en Evolution salen numerados: 1 = Sí, 2 = No). */
function ofertaAsesor(flujo: FlujoConversacion, tipo: 'pedido' | 'menu', texto: string, tituloNo: string): ResultadoTransicion {
  return {
    nuevoEstado: flujo.estado,
    acciones: [{ tipo: 'enviarBotones', texto, botones: [{ id: 'asesor_si', titulo: 'Sí' }, { id: 'asesor_no', titulo: tituloNo }] }],
    nuevoFlujo: { ...flujo, ofertaAsesor: { tipo } } as any,
  };
}

function transicionarSoloMenusNucleo(
  flujo: FlujoConversacion,
  entrada: EntradaNormalizada,
  contexto: ContextoConversacion,
): ResultadoTransicion {
  const texto = entrada.texto;
  const id = entrada.id ?? '';
  const url = contexto.cartaUrlPublica || 'https://caprichos.pe/carta';
  const enPersona = flujo.estado === 'ATENCION_PERSONA';
  const enPedido = String(flujo.estado).startsWith('PEDIDO') || Boolean(flujo.pedido);
  const enPago = String(flujo.estado).startsWith('PAGO') || flujo.estado === 'VALIDAR_PAGO' || Boolean(flujo.pago?.pedidoCodigo);
  const esId = (...ids: string[]) => ids.includes(id);
  const hay = (palabras: string[]) => coincideAlgunaPalabra(texto, palabras);

  // Un carrito con productos sobrevive a una respuesta informativa (menú, horario, carta…): solo se descarta al pasar a una persona
  const carritoGuardado = !enPersona && flujo.pedido?.items?.length ? flujo.pedido : null;
  const respuesta = (acciones: any[], estado: EstadoConversacion = enPersona ? 'ATENCION_PERSONA' : 'MENU') => ({
    nuevoEstado: estado,
    acciones,
    nuevoFlujo: { ...flujo, estado, pedido: estado === 'MENU' ? carritoGuardado : null, repreguntasFallidas: 0, saludoCorto: undefined, insultos: undefined } as FlujoConversacion,
  });

  const saludo = () => {
    // Ya conversamos hace poco: el menú sin volver a presentarse
    if (contexto.sinBienvenida) {
      return respuesta([
        { tipo: 'enviarLista', texto: `¡Claro! 😊 Esto es lo que puedo hacer por ti:\n\n${interpolar(textoBot(contexto.textosPersonalizados, 'chatbot_texto_mas_descuento'), { link_carta: url, local: NOMBRE_LOCAL_BOT, puntos: '5', puntos_aclaracion: ' (en productos sin promo)' })}`, botonTexto: BOTON_LISTA_MENU, tituloSeccion: TITULO_SECCION_MENU, filas: FILAS_MENU_PRINCIPAL },
      ]);
    }
    // Misma bienvenida que el menú principal (fuente única): saludo + promociones vigentes + carta virtual
    const cuerpo = TEXTOS_BOT.saludoBienvenida(contexto.nombreCliente, contexto.datosLocal, null, {
      textos: contexto.textosPersonalizados,
      promos: contexto.promosBienvenida,
      linkCarta: url,
    });
    return respuesta([
      { tipo: 'enviarLista', texto: cuerpo, botonTexto: BOTON_LISTA_MENU, tituloSeccion: TITULO_SECCION_MENU, filas: FILAS_MENU_PRINCIPAL },
    ]);
  };

  const saludoCorto = () => {
    const ped = contexto.pedidoActivo;
    const nombreReal = nombreParaSaludo(contexto.nombreCliente);
    const nombre = nombreReal ? ` ${nombreReal.split(/\s+/)[0]}` : '';
    const lineaPedido = ped?.codigo ? ` Tu pedido ${ped.codigo} sigue su curso.` : '';
    const r = respuesta([
      { tipo: 'enviarBotones', texto: TEXTOS_SOLO_MENUS.holaDeNuevo(nombre, lineaPedido), botones: [BOTON_VOLVER_MENU] },
    ]);
    // Si vuelve a saludar sin nada en medio, la próxima vez va el menú (no el mismo mensaje otra vez)
    return { ...r, nuevoFlujo: { ...r.nuevoFlujo, saludoCorto: true } as FlujoConversacion };
  };

  // El cliente pidió una persona y nadie del equipo respondió en el tiempo de espera (local abierto): el bot retoma una sola vez.
  // El chat sigue marcado para el equipo (aquí no se suelta ni se quita lo urgente).
  if (enPersona && !id && contexto.modoAsistido && !(flujo as any).perdona_espera_ts && contexto.datosLocal?.abierta !== false) {
    return respuesta([{ tipo: 'enviarBotones', texto: TEXTO_PERDONA_ESPERA, botones: BOTONES_MODO_ASISTIDO }]);
  }

  // 0. Pedido en curso que lleva más de 30 minutos sin respuesta: se descarta el carrito y se vuelve al menú
  if (contexto.inactividadExpirada && enPedido && flujo.pedido?.items?.length && (contexto.minutosInactividad ?? 0) <= 360) {
    // Con productos ya elegidos, el carrito se guarda unas horas: se ofrece retomarlo en vez de perderlo
    const r = atenderConSubflujo('pedido', { ...flujo, estado: 'MENU' }, { tipo: 'boton', texto: 'pedir', textoOriginal: 'pedir', id: 'pedir' }, contexto);
    if (r) return r;
  }
  if (contexto.inactividadExpirada && enPedido) {
    return {
      nuevoEstado: 'MENU',
      acciones: [{ tipo: 'enviarBotones', texto: TEXTOS_BOT.pedidoExpiradoInactividad(), botones: BOTONES_MENU_PRINCIPAL }],
      nuevoFlujo: { ...flujo, estado: 'MENU', pedido: null, repreguntasFallidas: 0 },
    };
  }

  // Local cerrado con «Pedidos programados fuera de horario»: el bot solo ofrece programar un pedido para llevar o delivery.
  // Un pedido en curso, un pago, una persona atendiendo, «mi pedido», una queja o pedir una persona siguen su camino de siempre.
  if (contexto.soloProgramar && !enPedido && !enPago && !enPersona) {
    const otroTema =
      esId('persona', 'btn_persona', 'btn_asi_persona', 'btn_esp_persona', 'mipedido', 'btn_mipedido', 'btn_asi_pedido', 'c_eta') ||
      id.startsWith('ord_') ||
      /CP-W?\d{3,4}/i.test(entrada.textoOriginal || '') ||
      entrada.tipo === 'ubicacion' ||
      hay([...PALABRAS_PERSONA_SOLO, ...PALABRAS_QUEJA, ...PALABRAS_MI_PEDIDO, ...PALABRAS_ETA]);
    const quierePedir = esId('pedir', 'btn_pedido', 'btn_pedir') || id.startsWith('ped_') || hay([...PALABRAS_PEDIDO, 'nuevo pedido', 'programar']);
    if (!otroTema && !quierePedir) {
      const nombreReal = nombreParaSaludo(contexto.nombreCliente);
      const primer = nombreReal ? nombreReal.split(/\s+/)[0] : null;
      const prim = contexto.programacion?.dias?.[0];
      const apertura = prim && prim.abre ? TEXTOS_PROGRAMAR.apertura(prim.fecha, contexto.programacion?.hoy ?? prim.fecha, prim.abre) : contexto.datosLocal?.abre ? `hoy a las ${contexto.datosLocal.abre}` : null;
      const avisadoHace = Date.now() - Number((flujo as any).avisoCerradoEn ?? 0);
      const yaAvisado = avisadoHace >= 0 && avisadoHace < 6 * 3_600_000;
      // «Horario»: se contesta con el horario real y se vuelve a ofrecer programar
      if (esId('btn_horario', 'horario', 'faq_horario') || RE_HORARIO.test(texto)) {
        return respuesta([{ tipo: 'enviarBotones', texto: TEXTOS_BOT.horarioYUbicacion(contexto.datosLocal), botones: [BOTON_PROGRAMAR_PEDIDO, BOTON_PERSONA_CERRADO] }]);
      }
      // Pregunta libre y la IA está encendida: ella contesta (nunca toma el pedido para ahora: «pedir» lleva a programar)
      if (yaAvisado && contexto.chatbotIaActivo && !id && !esSaludoPuro(texto) && /[a-z]{3}/.test(texto) && texto.trim().split(/\s+/).length >= 4) {
        return respuesta([{ tipo: 'consultarIa', pregunta: entrada.textoOriginal || texto }]);
      }
      // Primer mensaje: aviso completo con botones; si vuelve a escribir, una línea corta (no el mismo texto)
      const r = respuesta([
        yaAvisado
          ? { tipo: 'enviarBotones', texto: TEXTOS_PROGRAMAR.recordatorio(apertura), botones: [BOTON_PROGRAMAR_PEDIDO, BOTON_VER_HORARIO] }
          : { tipo: 'enviarBotones', texto: TEXTOS_PROGRAMAR.bienvenida(primer, apertura), botones: [BOTON_PROGRAMAR_PEDIDO, BOTON_VER_HORARIO, BOTON_PERSONA_CERRADO] },
      ]);
      return { ...r, nuevoFlujo: { ...r.nuevoFlujo, avisoCerradoEn: yaAvisado ? (flujo as any).avisoCerradoEn : Date.now() } as FlujoConversacion };
    }
  }

  // Con conversación reciente, pedido de hoy o chat atendido, un «hola»/«gracias» no vuelve a abrir la bienvenida con menú
  // «¿y las opciones?», «menú», «ver opciones»: siempre el menú completo, nunca el «Hola de nuevo»
  const pideMenu = ['comenzar', '0'].includes(texto) || /(^|\s)(menu|opciones)(\s|$)/.test(texto);
  if (contexto.sinBienvenida && !enPedido && !enPago && !esId('menu', 'btn_menu', 'volver_menu', 'inicio') && !pideMenu && esSaludoPuro(texto)) {
    return (flujo as any).saludoCorto ? saludo() : saludoCorto();
  }

  // Saludo y regreso al menú (fuera de un pedido o pago en curso: ahí lo atiende el flujo de pedido)
  if (!enPedido && !enPago && (esId('menu', 'btn_menu', 'volver_menu', 'inicio') || esSaludoPuro(texto) || pideMenu)) {
    return saludo();
  }

  // Con una persona atendiendo, el texto libre no se contesta (regla de siempre)
  if (enPersona && !id && !contexto.modoAsistido) {
    return { nuevoEstado: 'ATENCION_PERSONA', acciones: [], nuevoFlujo: flujo };
  }

  // 0.c Cancelar un pedido sin pagar (de cualquier canal): botón con confirmación; sin pedidos recientes sigue el camino de siempre
  if (!enPedido && !enPago) {
    const cancelar = atenderCancelarCliente(flujo, entrada, contexto);
    if (cancelar) return cancelar;
  }

  // Insulto al bot: se responde con calma y se ofrece una persona; el segundo seguido pasa directo a una persona
  if (!id && hay_([RE_INSULTO], texto) && !hay(PALABRAS_QUEJA)) {
    if ((flujo as any).insultos >= 1) return pasarAsesor(flujo, entrada, contexto, 'INSULTOS', TEXTOS_SOLO_MENUS.insultoDerivado());
    const r = ofertaAsesor(flujo, enPedido ? 'pedido' : 'menu', TEXTOS_SOLO_MENUS.insultoCalma(), enPedido ? 'Seguir pidiendo' : 'No, gracias');
    return { ...r, nuevoFlujo: { ...r.nuevoFlujo, insultos: 1 } as FlujoConversacion };
  }

  // «¿Cómo estás?»: una línea (con el primer contacto, la bienvenida)
  if (!id && !enPedido && !enPago && RE_SMALLTALK.test(texto)) {
    return contexto.sinBienvenida ? respuesta([{ tipo: 'enviarTexto', texto: TEXTOS_SOLO_MENUS.smalltalk() }]) : saludo();
  }

  // 1. Queja escrita: urgente, a una persona (también en mitad de un pedido)
  if (hay(PALABRAS_QUEJA)) {
    return {
      nuevoEstado: 'ATENCION_PERSONA',
      acciones: [
        {
          tipo: 'pasarAPersona',
          motivo: 'QUEJA_ESCRITA_URGENTE',
          mensajeCliente: entrada.textoOriginal,
          esUrgente: true,
          crearQueja: true,
          quejaTexto: entrada.textoOriginal,
        },
        { tipo: 'enviarTexto', texto: TEXTOS_CAMBIOS.quejaUrgenteRecibida() },
      ],
      nuevoFlujo: { ...flujo, estado: 'ATENCION_PERSONA', pedido: null, repreguntasFallidas: 0 },
    };
  }

  // 2. Hablar con una persona (también en mitad de un pedido)
  if (esId('persona', 'btn_persona', 'btn_asi_persona', 'btn_esp_persona') || hay(PALABRAS_PERSONA_SOLO)) {
    const estaCerrado = contexto.datosLocal && contexto.datosLocal.abierta === false && !contexto.datosLocal.pausaAltaDemanda;
    const horaAbre = contexto.datosLocal?.abre || '15:00';
    const prim = contexto.programacion?.dias?.[0];
    const apertura = prim?.abre ? TEXTOS_PROGRAMAR.apertura(prim.fecha, contexto.programacion?.hoy ?? prim.fecha, prim.abre) : `hoy a las ${horaAbre}`;
    return {
      nuevoEstado: 'ATENCION_PERSONA',
      acciones: [
        {
          tipo: 'pasarAPersona',
          motivo: estaCerrado ? 'FUERA_DE_HORARIO' : 'CLIENTE_SOLICITO_PERSONA',
          mensajeCliente: entrada.textoOriginal,
          // Fuera de horario: sin campanita de noche; el chat queda urgente para salir PRIMERO en Mensajes al abrir
          ...(estaCerrado ? { esUrgente: true, sinCampanita: true } : {}),
        },
        {
          tipo: 'enviarTexto',
          texto: estaCerrado ? TEXTOS_PROGRAMAR.personaCuandoAbramos(apertura) : TEXTOS_BOT.pasarAPersona(contexto.textosPersonalizados?.chatbot_texto_pase_persona),
        },
      ],
      nuevoFlujo: { ...flujo, estado: 'ATENCION_PERSONA', pedido: null, repreguntasFallidas: 0 },
    };
  }

  // 2.b Pedido especial (torta por encargo, cumpleaños, evento, fotos de…): no es de la lista; pasa directo a una persona
  if (!id && !enPago && esPedidoEspecial(texto) && !(flujo.estado === 'PEDIDO_COMBO_PARTE' && pideFoto(texto))) {
    return pasarAsesor(flujo, entrada, contexto, 'PEDIDO_ESPECIAL', TEXTOS_SOLO_MENUS.pedidoEspecial(contexto.datosLocal?.abierta !== false, contexto.datosLocal?.abre));
  }

  // 2.c «Menú» a medio pedido: el menú de siempre, con el carrito guardado (volver a «Hacer pedido» lo retoma)
  if (enPedido && !enPago && (esId('menu', 'btn_menu', 'volver_menu', 'inicio') || texto === 'menu' || texto === 'volver al menu')) {
    const n = flujo.pedido?.items?.length ?? 0;
    return {
      nuevoEstado: 'MENU',
      acciones: [
        { tipo: 'enviarLista', texto: n ? `Tu pedido sigue guardado (${n} ${n === 1 ? 'producto' : 'productos'}). ¿Qué necesitas?` : '¿Qué necesitas?', botonTexto: BOTON_LISTA_MENU, tituloSeccion: TITULO_SECCION_MENU, filas: FILAS_MENU_PRINCIPAL },
      ],
      nuevoFlujo: { ...flujo, estado: 'MENU', pedido: n ? flujo.pedido : null, repreguntasFallidas: 0 },
    };
  }

  // 3. Pedido o pago en curso: el flujo del motor anterior atiende la respuesta (carrito, dirección, medio de pago, voucher)
  if (enPedido) {
    const r = atenderConSubflujo('pedido', flujo, entrada, contexto);
    if (r) {
      if (id) return r;
      // Solo emojis o signos («?», «👍»): se repite el paso sin «no te entendí»
      if (!texto.trim()) return { ...r, acciones: cambiarPrefijoNoEntendi(r.acciones, '😊') };
      const clave = (p: any) => JSON.stringify({ e: r.nuevoEstado, i: p?.estadoInterno, n: p?.items?.length, c: p?.categoriaSeleccionadaId, cf: p?.configuracionActual?.grupoIndexActual, pr: p?.productoSeleccionadoId });
      const sinAvance = r.nuevoFlujo.estado === flujo.estado && clave(r.nuevoFlujo.pedido) === clave(flujo.pedido);
      const flujoLimpio: any = { ...r.nuevoFlujo };
      delete flujoLimpio.pasoNoEntendido;
      if (!sinAvance) return { ...r, nuevoFlujo: flujoLimpio };
      // El cliente no eligió una opción válida: nunca se le atrapa repitiendo la misma pregunta
      // «ok», «jaja», «¿y las opciones?»: no es un error; se vuelve a mostrar el paso (con sus números) sin «no te entendí»
      const sinCulpa = ACUSES_CORTOS.includes(texto.trim()) || /^(muchas )?gracias\b|^(ok|okey|listo|vale) gracias/.test(texto.trim())
        ? '¡Con gusto! 💛'
        : /^(x+d+|ja(ja)+j?|je(je)+|ji(ji)+|lol|jsjs\w*)$/.test(texto.trim())
          ? '😄'
          : /(^|\s)(opciones|cuales|menu)(\s|$)/.test(texto)
            ? '¡Claro! 😊'
            : null;
      if (sinCulpa) return { ...r, acciones: cambiarPrefijoNoEntendi(r.acciones, sinCulpa), nuevoFlujo: flujo };
      // Pregunta suelta (horario, pagos, delivery…) a medio pedido: se contesta y se ofrece seguir donde iba, sin perder nada
      const faqSuelta = claveFaqSoloMenus('', texto) ?? (hay(['horario', 'ubicacion', 'abren', 'cierran', 'hasta que hora', 'direccion']) ? 'horario' : null);
      // (en los pasos de pago, «yape»/«pago» ya los contesta el propio paso)
      if (faqSuelta && texto.length > 3 && !(faqSuelta === 'pagos' && /PAGO|MONTO|COMPROBANTE/.test(String(flujo.estado)))) {
        const a = respuestaFaqSoloMenus(faqSuelta, contexto);
        return { nuevoEstado: flujo.estado, acciones: [{ ...a, botones: [{ id: 'ped_seguir', titulo: 'Seguir con mi pedido' }, BOTON_VOLVER_MENU] }], nuevoFlujo: flujo };
      }
      const prev = Number((flujo as any).pasoNoEntendido?.n ?? 0);
      if (contexto.chatbotIaActivo && /[a-z]{3}/.test(texto)) {
        return { nuevoEstado: flujo.estado, acciones: [{ tipo: 'consultarIa', pregunta: entrada.textoOriginal || texto }], nuevoFlujo: flujo };
      }
      if (prev >= 1) return ofertaAsesor(flujoLimpio, 'pedido', TEXTOS_SOLO_MENUS.ofertaPersona(), 'Seguir pidiendo');
      return { ...r, nuevoFlujo: { ...flujoLimpio, pasoNoEntendido: { n: prev + 1 } } };
    }
  }
  if (enPago) {
    const r = atenderConSubflujo('pago', flujo, entrada, contexto);
    if (r) return r;
  }

  // 3.b Ubicación enviada por chat con un pedido de delivery vigente: se avisa al equipo (no se ignora)
  if (entrada.tipo === 'ubicacion' && entrada.ubicacion && !enPedido && !enPago) {
    const p = contexto.pedidoActivo;
    if (pedidoVigente(p) && String(p.modalidad || '').toUpperCase() === 'DELIVERY' && p.id != null) {
      return respuesta([
        {
          tipo: 'crearSolicitudCambio',
          pedidoId: String(p.id),
          pedidoCodigo: String(p.codigo),
          tipoCambio: 'DIRECCION',
          detalle: 'El cliente envió su ubicación por el chat',
          lat: entrada.ubicacion.latitud,
          lng: entrada.ubicacion.longitud,
        },
        { tipo: 'enviarTexto', texto: TEXTOS_SOLO_MENUS.ubicacionRecibida(String(p.codigo)) },
      ]);
    }
  }

  // 3.c «¿están atendiendo?», «¿se puede pedir aún?»: se contesta el estado del local (antes de tomarlo como «quiero pedir»)
  if (!id && !enPedido && !enPago && RE_ESTAN_ATENDIENDO.test(texto)) {
    return respuesta([{ tipo: 'enviarTexto', texto: TEXTOS_SOLO_MENUS.estamosAtendiendo(contexto.datosLocal) }]);
  }

  // 3.d Respuestas fijas cortas, sin IA: boleta o factura, vuelto, efectivo al repartidor (fuera de un pedido o pago en curso)
  if (!id && !enPedido && !enPago && !/CP-W?\d{3,4}/i.test(entrada.textoOriginal || '')) {
    const fija = respuestaFijaCorta(texto, contexto);
    if (fija) return respuesta([{ tipo: 'enviarTexto', texto: fija }]);
  }

  // 4. Hacer pedido: botón «Hacer pedido», «Pedir este» de la carta o texto como «quiero pedir»
  // (también un pedido dicho en una frase: «2 frappé moka grande para llevar»)
  if (esId('pedir', 'btn_pedido', 'btn_pedir') || id.startsWith('ped_') || hay([...PALABRAS_PEDIDO, 'nuevo pedido']) || (!id && !enPersona && texto.length > 2)) {
    // Desde el menú, el flujo de pedido arranca como si viniera del menú
    const r = atenderConSubflujo('pedido', { ...flujo, estado: 'MENU', pedido: null }, entrada, contexto);
    if (r) return r;
  }

  // 5.b Cambiar o cancelar una reserva (no es un pedido): una persona lo hace
  if (!id && /reserv/.test(texto) && RE_RESERVA_CAMBIO.test(texto)) {
    return pasarAsesor(flujo, entrada, contexto, 'RESERVA_CAMBIO', TEXTOS_SOLO_MENUS.reservaCambio(contexto.datosLocal?.abierta !== false, contexto.datosLocal?.abre));
  }
  // 5.c Reserva con datos (personas, día u hora): se anota y pasa directo a una persona, sin segundo paso
  if (!id && !enPago && /reserv|mesa/.test(texto) && RE_RESERVA_DETALLES.test(texto)) {
    return pasarAsesor(flujo, entrada, contexto, 'RESERVA_NUEVA', TEXTOS_SOLO_MENUS.reservaAvisada(contexto.datosLocal?.abierta !== false, contexto.datosLocal?.abre));
  }

  // 6. Cambiar dirección o anular pedido: pasa a una persona
  const pideCambioDir = esId('c_dir') || hay(PALABRAS_CAMBIO_DIR);
  const pideCambioPed = esId('c_ped') || hay([...PALABRAS_CAMBIO_PED, 'cancelar', 'anular']);
  if (pideCambioDir || pideCambioPed) {
    const enRuta = ['en_camino', 'ruta'].includes(String(contexto.pedidoActivo?.estado || '').toLowerCase());
    const motivo = pideCambioDir ? 'CAMBIO_DIRECCION' : 'CAMBIO_CANCELACION_PEDIDO';
    const textoRespuesta = pideCambioDir
      ? TEXTOS_BOT.miPedidoCambioDireccion(enRuta)
      : TEXTOS_BOT.miPedidoCambioOAnulacion(enRuta);
    return {
      nuevoEstado: 'ATENCION_PERSONA',
      acciones: [
        { tipo: 'pasarAPersona', motivo, mensajeCliente: entrada.textoOriginal },
        { tipo: 'enviarTexto', texto: textoRespuesta },
      ],
      nuevoFlujo: { ...flujo, estado: 'ATENCION_PERSONA', pedido: null, repreguntasFallidas: 0 },
    };
  }

  // 7. Estado de mi pedido (el activo de este número)
  if (
    esId('mipedido', 'btn_mipedido', 'btn_asi_pedido', 'c_eta') ||
    id.startsWith('ord_') ||
    /CP-W?\d{3,4}/i.test(entrada.textoOriginal || '') ||
    hay([...PALABRAS_MI_PEDIDO, ...PALABRAS_ETA])
  ) {
    if (contexto.limiteConsultasExcedido) {
      return respuesta([{ tipo: 'enviarBotones', texto: TEXTOS_BOT.miPedidoDemasiadasConsultas(), botones: [BOTON_VOLVER_MENU] }]);
    }
    const conCodigo = /CP-W?\d{3,4}/i.test(entrada.textoOriginal || '') || id.startsWith('ord_');
    // Pregunta abierta sobre SU pedido («¿mi pedido ya sale?»): la IA responde con los datos reales de sus pedidos de cualquier canal
    if (!id && !conCodigo && preguntaEspecificaParaIa(entrada, contexto)) {
      return respuesta([{ tipo: 'consultarIa', pregunta: entrada.textoOriginal || texto }]);
    }
    // Varios en curso: lista corta para elegir (la elección llega como ord_CODIGO)
    const enCurso = contexto.pedidosEnCurso ?? [];
    if (!conCodigo && enCurso.length > 1) {
      return respuesta([
        {
          tipo: 'enviarLista',
          texto: TEXTOS_SOLO_MENUS.variosPedidosEnCurso(),
          botonTexto: 'Elegir pedido',
          tituloSeccion: 'Tus pedidos',
          filas: enCurso.slice(0, 5).map((o: any) => ({ id: `ord_${o.codigo}`, titulo: String(o.codigo), descripcion: `${String(o.estado)} · S/ ${Number(o.total ?? 0).toFixed(2)}` })),
        },
      ]);
    }
    const p = conCodigo || pedidoVigente(contexto.pedidoActivo) ? contexto.pedidoActivo : null;
    if (!p && contexto.chatSinLlave) {
      return respuesta([{ tipo: 'enviarBotones', texto: TEXTOS_SOLO_MENUS.pedirCodigoSinLlave(), botones: [BOTON_VOLVER_MENU, BOTON_HABLAR_PERSONA] }]);
    }
    if (!p) {
      return respuesta([{ tipo: 'enviarBotones', texto: TEXTOS_SOLO_MENUS.sinPedidoActivo(url), botones: [BOTON_HACER_PEDIDO, BOTON_VOLVER_MENU] }]);
    }
    const enlaceSeguimiento =
      contexto.cartaUrlPublica && p.id != null ? enlaceSeguimientoCarta(contexto.cartaUrlPublica, String(p.codigo), p.id) : url;
    return respuesta([
      {
        tipo: 'enviarBotones',
        texto: `${TEXTOS_SOLO_MENUS.estadoPedido(String(p.codigo), String(p.estado), p.pago_estado)}${TEXTOS_SOLO_MENUS.tiempoEstimado(p.eta_min, p.eta_max, p.estado)}\nSíguelo aquí: ${enlaceSeguimiento}`,
        botones: [BOTON_VOLVER_MENU, BOTON_HABLAR_PERSONA],
      },
    ]);
  }

  // 8. Horario y ubicación (también por texto): contesta solo lo preguntado, en un mensaje
  const preguntaHorario = RE_HORARIO.test(texto) || hay(['horario', 'abren', 'cierran', 'hasta que hora']);
  const preguntaLugar = RE_LUGAR.test(texto) || hay(['ubicacion', 'ubicado', 'donde estan', 'mapa', 'como llego', 'direccion']);
  if (preguntaHorario || preguntaLugar) {
    if (id) {
      return respuesta([{ tipo: 'enviarBotones', texto: TEXTOS_BOT.horarioYUbicacion(contexto.datosLocal), botones: [BOTON_OTRAS_PREGUNTAS, BOTON_VOLVER_MENU] }]);
    }
    const textoHL = RE_ESTAN_ATENDIENDO.test(texto)
      ? TEXTOS_SOLO_MENUS.estamosAtendiendo(contexto.datosLocal)
      : preguntaHorario && preguntaLugar
        ? TEXTOS_BOT.horarioYUbicacion(contexto.datosLocal)
        : preguntaHorario
          ? TEXTOS_SOLO_MENUS.soloHorario(contexto.datosLocal)
          : TEXTOS_SOLO_MENUS.soloUbicacion(contexto.datosLocal);
    return respuesta([{ tipo: 'enviarTexto', texto: textoHL }]);
  }
  if (!id && RE_ESTAN_ATENDIENDO.test(texto)) {
    return respuesta([{ tipo: 'enviarTexto', texto: TEXTOS_SOLO_MENUS.estamosAtendiendo(contexto.datosLocal) }]);
  }

  // 9. Reservar mesa: por teléfono o con una persona
  if (esId('reservar', 'btn_reserva') || hay(PALABRAS_RESERVA)) {
    return respuesta([
      {
        tipo: 'enviarBotones',
        texto: TEXTOS_SOLO_MENUS.reservaPorPersona(contexto.datosLocal?.telefono),
        botones: [BOTON_HABLAR_PERSONA, BOTON_VOLVER_MENU],
      },
    ]);
  }

  // 9.b Promociones: antes el bot con menú no las entendía y respondía «Elige una opción del menú»
  const paginaPromos = id.startsWith('promo_mas_') ? Math.max(2, parseInt(id.slice(10), 10) || 2) : 1;
  if (paginaPromos > 1 || esId('btn_promociones', 'promos', 'faq_promos') || hay(PALABRAS_PROMOS)) {
    const r = respuestaPromociones(flujo, contexto, paginaPromos);
    return { ...r, nuevoEstado: 'MENU', nuevoFlujo: { ...r.nuevoFlujo, estado: 'MENU', pedido: null } };
  }

  // 9.c Precio o disponibilidad de un producto («cuanto cuesta el frape oreo», «hay bebidas calientes»)
  if (!id) {
    const q = productosPreguntados(texto, contexto, /^y /.test(texto) || /\?\s*$/.test(entrada.textoOriginal || ''));
    if (q) {
      if (q.productos.length === 1 && !q.categoria) {
        const p = q.productos[0];
        const unico = TEXTOS_SOLO_MENUS.precioProducto(p);
        return respuesta(
          p.disponible === false
            ? [{ tipo: 'enviarTexto', texto: unico }]
            : [{ tipo: 'enviarBotones', texto: unico, botones: [BOTON_HACER_PEDIDO] }],
        );
      }
      const lineas = q.productos.map((p: any) => (p.disponible === false ? `• ${p.nombre} (agotado)` : `• ${p.nombre} S/ ${Number(p.precio).toFixed(2)}`));
      return respuesta([{ tipo: 'enviarBotones', texto: TEXTOS_SOLO_MENUS.listaProductos(q.categoria ? `Tenemos en ${q.categoria}:` : 'Esto es lo que tenemos:', lineas), botones: [BOTON_HACER_PEDIDO] }]);
    }
  }

  // 10. Preguntas frecuentes concretas
  let faq = claveFaqSoloMenus(id, texto);
  // Una pregunta larga y específica de pago o delivery la contesta la IA con los datos reales, no la FAQ fija
  if (faq && faq !== 'horario' && preguntaEspecificaParaIa(entrada, contexto)) faq = null;
  if (faq) {
    return respuesta([respuestaFaqSoloMenus(faq, contexto, texto, Boolean(id))]);
  }

  // 10.b Pregunta por una categoría de la carta («bebidas frías»): se responde con los datos reales; el saludo la acompaña
  if (!id) {
    const cat = (contexto.categoriasCarta || []).find((c: any) => {
      const n = normalizarTexto(c.nombre);
      return n.length >= 4 && (texto.includes(n) || texto.includes(n.replace(/s$/, '')));
    });
    const prods = (cat?.productos || []).filter((p: any) => p.disponible !== false);
    if (cat && prods.length) {
      const lineas = prods.slice(0, 8).map((p: any) => `• ${p.nombre} S/ ${Number(p.precio).toFixed(2)}`);
      return respuesta([
        { tipo: 'enviarBotones', texto: TEXTOS_SOLO_MENUS.categoriaPedida(cat.nombre, lineas, url, flujo.estado === 'INICIO'), botones: [BOTON_HACER_PEDIDO, BOTON_VOLVER_MENU] },
      ]);
    }
  }

  // 11. Ver la carta
  if (esId('carta', 'btn_carta', 'btn_asi_carta', 'btn_categorias', 'btn_esp_carta') || id.startsWith('cat_') || texto === 'carta' || hay(PALABRAS_CARTA)) {
    return respuesta(accionesCartaSoloMenus(contexto, url));
  }

  // 12. Preguntas frecuentes (lista)
  if (esId('preguntar', 'btn_preguntas') || hay(PALABRAS_PREGUNTAR)) {
    return respuesta(
      [
        {
          tipo: 'enviarLista',
          texto: TEXTOS_BOT.preguntasCuerpo(),
          botonTexto: BOTON_LISTA_PREGUNTAS,
          tituloSeccion: TITULO_SECCION_PREGUNTAS,
          filas: FILAS_PREGUNTAS_FRECUENTES,
        },
      ],
      'PREGUNTAS',
    );
  }

  // 13. Despedida o agradecimiento («ok», «gracias», 👍): una línea, sin menú
  if (ACUSES_CORTOS.includes(texto.trim()) || ACUSES_CORTOS.includes((entrada.textoOriginal || '').trim().toLowerCase())) {
    return respuesta([{ tipo: 'enviarTexto', texto: TEXTOS_SOLO_MENUS.acuse() }]);
  }
  if (hay(PALABRAS_DESPEDIDA)) {
    return respuesta([{ tipo: 'enviarTexto', texto: TEXTOS_BOT.despedida(contexto.textosPersonalizados?.chatbot_texto_despedida) }]);
  }

  // 14. Primer contacto sin intención clara: saludo con el menú
  // (con la IA encendida, una pregunta abierta en el primer mensaje la contesta la IA; el saludo puro ya salió arriba)
  if (flujo.estado === 'INICIO' && !(contexto.chatbotIaActivo && !id && /[a-z]{3}/.test(texto))) return saludo();

  // 14.b Un número suelto sin menú vigente («1» de un «Volver al menú» viejo): vuelve al menú, nunca a la IA ni al «no entendí»
  if (!id && !enPersona && /^(?:(?:por favor|porfa|xfa)\s+)?\d{1,2}$/.test(texto.trim())) return saludo();
  // Solo emojis (sin letras ni números): no es una pregunta, la IA no gasta ni el bot contesta (anti-bucle)
  const crudo = (entrada.textoOriginal || texto || '').trim();
  if (!id && !enPersona && crudo && /^[\p{Extended_Pictographic}\p{Emoji_Modifier}\u200d\ufe0f\s]+$/u.test(crudo)) {
    return { nuevoEstado: flujo.estado, acciones: [], nuevoFlujo: flujo };
  }

  // 15. Texto libre que ninguna regla entendió: primero la IA (si está encendida); al segundo «no entendí» seguido, a una persona
  if (contexto.chatbotIaActivo && texto.trim() && !id) {
    return respuesta([{ tipo: 'consultarIa', pregunta: entrada.textoOriginal || texto }]);
  }
  if ((flujo.repreguntasFallidas || 0) >= 1) {
    return {
      nuevoEstado: 'ATENCION_PERSONA',
      acciones: [
        { tipo: 'pasarAPersona', motivo: 'BOT_NO_ENTIENDE', mensajeCliente: entrada.textoOriginal },
        { tipo: 'enviarTexto', texto: TEXTOS_SOLO_MENUS.derivadoPorNoEntender() },
      ],
      nuevoFlujo: { ...flujo, estado: 'ATENCION_PERSONA', pedido: null, repreguntasFallidas: 0 },
    };
  }
  const noEntendi = respuesta([
    {
      tipo: 'enviarLista',
      texto: TEXTOS_SOLO_MENUS.menuNoEntiendo(contexto.textosPersonalizados?.chatbot_texto_no_entiendo),
      botonTexto: BOTON_LISTA_MENU,
      tituloSeccion: TITULO_SECCION_MENU,
      filas: FILAS_MENU_PRINCIPAL,
    },
  ]);
  return { ...noEntendi, nuevoFlujo: { ...noEntendi.nuevoFlujo, repreguntasFallidas: 1 } };
}

/**
 * Respuesta de «Promociones»: las que valen por este chat, las SOLO de la carta web (se nombran con el enlace, nunca se
 * ofrecen por el chat) y las solo del local. Sirve al motor completo y al bot con menú (MODO_SOLO_MENUS).
 */
function respuestaPromociones(flujo: FlujoConversacion, contexto: ContextoConversacion, paginaPromos: number): ResultadoTransicion {
    if (contexto.funcionesActivas?.promociones === false) {
      return {
        nuevoEstado: 'CARTA_PROMOS',
        acciones: [
          {
            tipo: 'enviarBotones',
            texto: TEXTOS_FUNCIONES_DESACTIVADAS.promociones,
            botones: [BOTON_VER_CARTA, BOTON_VOLVER_MENU],
          },
        ],
        nuevoFlujo: {
          ...flujo,
          estado: 'CARTA_PROMOS',
          repreguntasFallidas: 0,
        },
      };
    }

    const nuevoEstado: EstadoConversacion = 'CARTA_PROMOS';
    const textoPromos = TEXTOS_BOT.promocionesHoy(contexto.ofertas || [], {
      soloWeb: contexto.ofertasSoloWeb || [],
      soloLocal: contexto.ofertasSoloLocal || [],
      cartaUrl: contexto.cartaUrlPublica,
    });
    const botonesPromos = [BOTON_VER_CARTA, BOTON_VOLVER_MENU];
    // Carrusel si hay 2 o más promociones vigentes de un producto concreto (más vendidos primero)
    const tarjetasPromos = tarjetasDePromociones(contexto);
    return {
      nuevoEstado,
      acciones: tarjetasPromos.length >= 2
        ? accionesPaginaCarrusel({
            tarjetas: tarjetasPromos,
            pagina: paginaPromos,
            cuerpoPrimera: textoPromos,
            cuerpoSiguientes: 'Más promociones para ti 💛\nDesliza y toca «Pedir este» en la que quieras.',
            respaldoPrimera: { texto: textoPromos, botones: botonesPromos },
            idVerMas: (n) => `promo_mas_${n}`,
            botonTarjeta: botonesPromos.find((b: any) => /menu/i.test(b.id)) ?? botonesPromos[0],
            textoVerMas: (q) => `Hay ${q} ${q === 1 ? 'promoción más' : 'promociones más'}. ¿Las vemos?`,
            botonesExtra: botonesPromos,
            textoLista: 'Más promociones para ti 💛',
          }).concat(
            tarjetasPromos.length <= paginaPromos * 10
              ? [{ tipo: 'enviarBotones', texto: '¿Qué más te provoca? 💛', botones: botonesPromos, ...(paginaPromos === 1 ? { soloSiCarruselSalio: true } : {}) }]
              : [],
          )
        : [{ tipo: 'enviarBotones', texto: textoPromos, botones: botonesPromos }],
      nuevoFlujo: {
        ...flujo,
        estado: nuevoEstado,
        repreguntasFallidas: 0,
      },
    };
}

/** Tarjetas de las promociones vigentes que apuntan a un producto de la carta, ordenadas por ventas. */
function tarjetasDePromociones(contexto: ContextoConversacion) {
  const productos = new Map<string, any>();
  for (const c of contexto.categoriasCarta || []) for (const p of c.productos || []) productos.set(String(p.id), p);
  const candidatas = (contexto.ofertas || [])
    .filter((o: any) => o.vigenteAhora && o.alcanceProductoId && productos.get(String(o.alcanceProductoId))?.disponible !== false && productos.has(String(o.alcanceProductoId)))
    .map((o: any) => ({ o, id: String(o.alcanceProductoId) }));
  return ordenarPorVentas(candidatas, contexto.ventasProductos).map(({ o, id }) => {
    const prod = productos.get(id);
    const t = tarjetaProducto(prod, contexto.cartaUrlPublica);
    return { ...t, nombre: o.nombre, imagenUrl: t.imagenUrl, cuerpo: `${o.nombre}\n${o.descripcion ?? t.cuerpo.split('\n')[1]}` };
  });
}
