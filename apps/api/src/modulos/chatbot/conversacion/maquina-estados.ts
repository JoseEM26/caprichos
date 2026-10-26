import {
  BOTONES_MENU_PRINCIPAL,
  TEXTOS_BOT,
} from './textos-bot';
import {
  ContextoConversacion,
  EntradaNormalizada,
  ESQUEMA_FLUJO_VERSION,
  EstadoConversacion,
  FlujoConversacion,
  ResultadoTransicion,
} from './tipos-conversacion';

/** Palabras clave para detectar saludos o solicitud del menú */
const PALABRAS_SALUDO = [
  'hola',
  'buenas',
  'buen dia',
  'buenos dias',
  'buenas tardes',
  'buenas noches',
  'menu',
  'inicio',
  'comenzar',
  'empezar',
  'opciones',
];

/** Palabras clave para intención de pedido */
const PALABRAS_PEDIDO = [
  'pedido',
  'pedir',
  'hacer pedido',
  'carta',
  'ordenar',
  'comprar',
  'menu carta',
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
];

function coincideAlgunaPalabra(texto: string, lista: string[]): boolean {
  return lista.some((palabra) => {
    // Coincidencia exacta o contenida como palabra aislada
    const regex = new RegExp(`(^|\\s)${palabra}(\\s|$)`, 'i');
    return regex.test(texto) || texto === palabra;
  });
}

/**
 * Función pura que computa el próximo estado y las acciones a despachar.
 * No realiza llamadas I/O, base de datos ni llamadas a Meta.
 *
 * @param flujoPrevio Estado actual guardado en conversacion.flujo.
 * @param entrada Mensaje o interacción normalizada recibida.
 * @param contexto Datos de negocio complementarios (nombre del cliente, horarios, etc.).
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

  // 1. Si la conversación está en manos de una persona, el bot permanece en silencio
  if (flujo.estado === 'ATENCION_PERSONA') {
    return {
      nuevoEstado: 'ATENCION_PERSONA',
      acciones: [],
      nuevoFlujo: flujo,
    };
  }

  const texto = entrada.texto;
  const idInteractivo = entrada.id;

  // 2. Detección de saludo global, inicio o solicitud de menú principal
  const esSaludo =
    flujo.estado === 'INICIO' ||
    idInteractivo === 'btn_menu' ||
    coincideAlgunaPalabra(texto, PALABRAS_SALUDO);

  if (esSaludo) {
    const nuevoEstado: EstadoConversacion = 'MENU';
    const nuevoFlujo: FlujoConversacion = {
      ...flujo,
      version: ESQUEMA_FLUJO_VERSION,
      estado: nuevoEstado,
      repreguntasFallidas: 0,
    };

    return {
      nuevoEstado,
      acciones: [
        {
          tipo: 'enviarBotones',
          texto: TEXTOS_BOT.saludoBienvenida(contexto.nombreCliente),
          botones: BOTONES_MENU_PRINCIPAL,
        },
      ],
      nuevoFlujo,
    };
  }

  // 3. Intención: "Hacer un pedido" (Ola 1 informativa; Ola 2 conectará el catálogo interactivo)
  const esPedido =
    idInteractivo === 'btn_pedido' || coincideAlgunaPalabra(texto, PALABRAS_PEDIDO);

  if (esPedido) {
    // =========================================================================
    // GANCHO OLA 2: Aquí se iniciará el flujo de catálogo interactivo por categorías
    // y selección de productos con botones y listas (FT-BOT-01).
    // Por el momento (Ola 1), se responde con mensaje informativo y enlace a la carta.
    // =========================================================================
    const nuevoEstado: EstadoConversacion = 'MENU';
    const nuevoFlujo: FlujoConversacion = {
      ...flujo,
      version: ESQUEMA_FLUJO_VERSION,
      estado: nuevoEstado,
      repreguntasFallidas: 0,
      pedido: flujo.pedido ?? null,
    };

    return {
      nuevoEstado,
      acciones: [
        {
          tipo: 'enviarTexto',
          texto: TEXTOS_BOT.pedidoProximamente(contexto.cartaUrlPublica),
        },
      ],
      nuevoFlujo,
    };
  }

  // 4. Intención: "Horario y ubicación"
  const esHorarioOUbicacion =
    idInteractivo === 'btn_horario_ubicacion' ||
    coincideAlgunaPalabra(texto, PALABRAS_HORARIO_UBICACION);

  if (esHorarioOUbicacion) {
    const nuevoEstado: EstadoConversacion = 'HORARIO';
    const nuevoFlujo: FlujoConversacion = {
      ...flujo,
      version: ESQUEMA_FLUJO_VERSION,
      estado: nuevoEstado,
      repreguntasFallidas: 0,
    };

    return {
      nuevoEstado,
      acciones: [
        {
          tipo: 'enviarTexto',
          texto: TEXTOS_BOT.horarioYUbicacion(contexto.datosLocal),
        },
      ],
      nuevoFlujo,
    };
  }

  // 5. Intención: "Hablar con una persona"
  const esHablarConPersona =
    idInteractivo === 'btn_persona' || coincideAlgunaPalabra(texto, PALABRAS_PERSONA);

  if (esHablarConPersona) {
    const nuevoEstado: EstadoConversacion = 'ATENCION_PERSONA';
    const nuevoFlujo: FlujoConversacion = {
      ...flujo,
      version: ESQUEMA_FLUJO_VERSION,
      estado: nuevoEstado,
      repreguntasFallidas: 0,
    };

    return {
      nuevoEstado,
      acciones: [
        {
          tipo: 'pasarAPersona',
          motivo: 'SOLICITUD_CLIENTE',
          mensajeCliente: entrada.textoOriginal,
        },
        {
          tipo: 'enviarTexto',
          texto: TEXTOS_BOT.pasarAPersona(),
        },
      ],
      nuevoFlujo,
    };
  }

  // =========================================================================
  // GANCHOS DOCUMENTADOS PARA FUTURAS OLAS (OLAS 2 Y 3)
  // =========================================================================
  // - Gancho PEDIDO (Ola 2, FT-BOT-01):
  //   if (flujo.estado === 'PEDIDO') { ... }
  // - Gancho PAGO (Ola 2, FT-BOT-02):
  //   if (flujo.estado === 'PAGO') { ... }
  // - Gancho RESERVA (Ola 3):
  //   if (flujo.estado === 'RESERVA') { ... }
  // - Gancho DUDA_IA (Ola 3, FT-BOT-03):
  //   if (flujo.estado === 'DUDA_IA') { ... }
  // =========================================================================

  // 6. Mensaje no entendido:
  // - Si es la primera vez (repreguntasFallidas == 0): repregunta una vez con las opciones.
  // - Si es la segunda vez consecutiva (repreguntasFallidas >= 1): pasa a una persona (RQ-BOT-01-08 / RQ-ATN-02-06).
  if (flujo.repreguntasFallidas === 0) {
    const nuevoEstado: EstadoConversacion = flujo.estado === 'INICIO' ? 'MENU' : flujo.estado;
    const nuevoFlujo: FlujoConversacion = {
      ...flujo,
      version: ESQUEMA_FLUJO_VERSION,
      estado: nuevoEstado,
      repreguntasFallidas: 1,
    };

    return {
      nuevoEstado,
      acciones: [
        {
          tipo: 'enviarBotones',
          texto: TEXTOS_BOT.noEntiendoRepregunta(),
          botones: BOTONES_MENU_PRINCIPAL,
        },
      ],
      nuevoFlujo,
    };
  }

  // Segunda vez no entendida -> derivación humana
  const nuevoEstado: EstadoConversacion = 'ATENCION_PERSONA';
  const nuevoFlujo: FlujoConversacion = {
    ...flujo,
    version: ESQUEMA_FLUJO_VERSION,
    estado: nuevoEstado,
    repreguntasFallidas: flujo.repreguntasFallidas + 1,
  };

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
        texto: TEXTOS_BOT.noEntiendoDerivacion(),
      },
    ],
    nuevoFlujo,
  };
}
