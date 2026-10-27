import {
  BOTON_HABLAR_PERSONA,
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
  TEXTOS_BOT,
  TITULO_SECCION_CATEGORIAS,
  TITULO_SECCION_MENU,
  TITULO_SECCION_PREGUNTAS,
} from './textos-bot';
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
import './flujos/pedido/flujo-pedido';
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
];

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

function coincideAlgunaPalabra(texto: string, lista: string[]): boolean {
  return lista.some((palabra) => {
    const regex = new RegExp(`(^|\\s)${palabra}(\\s|$)`, 'i');
    return regex.test(texto) || texto === palabra || texto.includes(palabra);
  });
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

function construirListaProductos(
  categoria: any,
  pagina = 0,
): AccionEnviarLista {
  const tamanoPagina = 9;
  const inicio = Math.max(0, pagina * tamanoPagina);
  const todosProds = categoria.productos || [];
  const prodsPagina = todosProds.slice(inicio, inicio + tamanoPagina);
  const hayMas = todosProds.length > inicio + tamanoPagina;

  const filas: FilaLista[] = prodsPagina.map((prod: any) => {
    let desc = '';
    if (!prod.disponible) {
      desc = 'Por ahora no está disponible';
    } else if (prod.tamanos && prod.tamanos.length > 0) {
      desc = `Desde s/ ${Number(prod.tamanos[0].precio).toFixed(2)}`;
    } else {
      desc = `s/ ${Number(prod.precio || 0).toFixed(2)}`;
    }

    return {
      id: `prod_${prod.id}`,
      titulo: String(prod.nombre || '').slice(0, 24),
      descripcion: desc.slice(0, 72),
    };
  });

  if (hayMas) {
    filas.push({
      id: `prod_mas_${categoria.id}_${pagina + 1}`,
      titulo: 'Ver más productos',
      descripcion: 'Ver los siguientes productos de la categoría',
    });
  }

  return {
    tipo: 'enviarLista',
    texto: TEXTOS_BOT.cuerpoProductosCategoria(categoria.nombre),
    botonTexto: BOTON_LISTA_PRODUCTOS,
    tituloSeccion: String(categoria.nombre || '').slice(0, 24),
    filas,
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
          const accionLista = construirListaProductos(cat, 0);
          return {
            nuevoEstado: 'ATENCION_PERSONA',
            acciones: [accionLista],
            nuevoFlujo: {
              ...flujo,
              estado: 'ATENCION_PERSONA',
              categoriaSeleccionadaId: catId,
              paginaProductos: 0,
              repreguntasFallidas: 0,
            },
          };
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
      textoOriginalEntrada.match(/CP-\d{4}/i) || textoEntrada.match(/CP-\d{4}/i);
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
    textoOriginal.match(/CP-\d{4}/i) || texto.match(/CP-\d{4}/i);
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

  // 6. Intención: "Promociones de hoy"
  const esPromociones =
    idInteractivo === 'btn_promociones' ||
    idInteractivo === 'promos' ||
    idInteractivo === 'faq_promos' ||
    coincideAlgunaPalabra(texto, PALABRAS_PROMOS);

  if (esPromociones) {
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
    return {
      nuevoEstado,
      acciones: [
        {
          tipo: 'enviarBotones',
          texto: TEXTOS_BOT.promocionesHoy(contexto.ofertas || []),
          botones: [BOTON_VER_CARTA, BOTON_VOLVER_MENU],
        },
      ],
      nuevoFlujo: {
        ...flujo,
        estado: nuevoEstado,
        repreguntasFallidas: 0,
      },
    };
  }

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
    const sigPag = parseInt(partes[3], 10) || 0;
    const cat = (contexto.categoriasCarta || []).find((c: any) => String(c.id) === String(catId));
    if (cat) {
      const accionLista = construirListaProductos(cat, sigPag);
      return {
        nuevoEstado: 'CARTA_PRODUCTOS',
        acciones: [accionLista],
        nuevoFlujo: {
          ...flujo,
          estado: 'CARTA_PRODUCTOS',
          categoriaSeleccionadaId: catId,
          paginaProductos: sigPag,
          repreguntasFallidas: 0,
        },
      };
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

      const accionLista = construirListaProductos(cat, 0);
      return {
        nuevoEstado: 'CARTA_PRODUCTOS',
        acciones: [accionLista],
        nuevoFlujo: {
          ...flujo,
          estado: 'CARTA_PRODUCTOS',
          categoriaSeleccionadaId: catId,
          paginaProductos: 0,
          repreguntasFallidas: 0,
        },
      };
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
      return {
        nuevoEstado: 'CARTA_PRODUCTO_DETALLE',
        acciones: [
          {
            tipo: 'enviarBotones',
            texto: TEXTOS_BOT.detalleProducto(productoEncontrado, contexto.cartaUrlPublica),
            botones: [BOTON_VOLVER_CATEGORIAS, BOTON_VOLVER_MENU],
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
    let st = String(pedido?.estado || 'COLA').toLowerCase();
    if (
      pedido?.pago_metodo &&
      ['YAPE', 'PLIN', 'TRANSFERENCIA'].includes(pedido.pago_metodo) &&
      pedido.pago_estado === 'PENDIENTE'
    ) {
      if (
        flujo.estado === 'PAGO_VALIDANDO' ||
        (flujo.pago as any)?.estadoInterno === 'VALIDAR_PAGO'
      ) {
        st = 'validando_pago';
      } else {
        st = 'esperando_pago';
      }
    }
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
  if (idInteractivo === 'faq_pagos' || coincideAlgunaPalabra(texto, ['pago', 'pagos', 'yape', 'plin', 'tarjeta', 'efectivo'])) {
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
  if (idInteractivo === 'faq_delivery' || coincideAlgunaPalabra(texto, ['delivery', 'costo envio', 'envio gratis', 'zonas reparto'])) {
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
          texto: TEXTOS_BOT.saludoBienvenida(
            contexto.nombreCliente,
            contexto.datosLocal,
            contexto.textosPersonalizados?.chatbot_texto_bienvenida,
          ),
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
          texto: TEXTOS_BOT.noEntiendoRepregunta(
            contexto.textosPersonalizados?.chatbot_texto_no_entiendo,
          ),
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
