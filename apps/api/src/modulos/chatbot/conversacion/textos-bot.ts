import { BotonAccion, FilaLista } from '../puerto/whatsapp-mensajeria.puerto';
import { DatosHorarioLocal } from './tipos-conversacion';

/**
 * Catálogo centralizado de textos y botones del bot de WhatsApp para Caprichos.
 * Fiel reflejo del guión y textos del mockup Chatbot.dc.html.
 *
 * Límites de WhatsApp Cloud API:
 * - Botón de mensaje de lista: máximo 20 caracteres.
 * - Título de fila de lista: máximo 24 caracteres.
 * - Descripción de fila de lista: máximo 72 caracteres.
 * - Hasta 10 filas por mensaje de lista.
 * - Título de botón de respuesta rápida (quick reply): máximo 20 caracteres.
 * - Hasta 3 botones de respuesta rápida por mensaje.
 * - Cuerpo del mensaje: máximo 1024 caracteres.
 */

// Botones de lista (action.button)
export const BOTON_LISTA_MENU = 'Ver opciones';
export const BOTON_LISTA_CATEGORIAS = 'Ver categorías';
export const BOTON_LISTA_PRODUCTOS = 'Ver productos';
export const BOTON_LISTA_PREGUNTAS = 'Ver preguntas';

// Títulos de sección de lista (action.sections[].title)
export const TITULO_SECCION_MENU = 'Menú';
export const TITULO_SECCION_CATEGORIAS = 'Categorías';
export const TITULO_SECCION_PREGUNTAS = 'Preguntas';

// Filas del Menú Principal (mockup línea 415: start)
export const FILAS_MENU_PRINCIPAL: FilaLista[] = [
  {
    id: 'pedir',
    titulo: '☕ Hacer un pedido',
    descripcion: 'Pide para delivery o para recoger',
  },
  {
    id: 'reservar',
    titulo: '📅 Reservar mesa',
    descripcion: 'Solicita tu reserva de mesa',
  },
  {
    id: 'carta',
    titulo: '🧁 Ver la carta',
    descripcion: 'Navega productos, precios y promociones',
  },
  {
    id: 'mipedido',
    titulo: '📦 Mi pedido',
    descripcion: 'Consulta el estado y tiempo estimado',
  },
  {
    id: 'mispuntos',
    titulo: '⭐ Mis puntos',
    descripcion: 'Consulta tu saldo de puntos',
  },
  {
    id: 'preguntar',
    titulo: '💬 Preguntar algo',
    descripcion: 'Horario, dirección, carta y dudas frecuentes',
  },
  {
    id: 'persona',
    titulo: '🙋 Hablar con persona',
    descripcion: 'Hablar con una persona del equipo',
  },
];

// Botones de respuesta rápida comunes
export const BOTONES_MENU_PRINCIPAL: BotonAccion[] = [
  { id: 'btn_pedido', titulo: 'Hacer un pedido' },
  { id: 'btn_horario_ubicacion', titulo: 'Horario y ubicacion' },
  { id: 'btn_persona', titulo: 'Hablar con persona' },
];

export const BOTON_VOLVER_MENU: BotonAccion = {
  id: 'btn_menu',
  titulo: 'Volver al menú',
};

export const BOTON_VOLVER_CATEGORIAS: BotonAccion = {
  id: 'btn_categorias',
  titulo: 'Volver a categorías',
};

export const BOTON_VER_CARTA: BotonAccion = {
  id: 'btn_carta',
  titulo: 'Ver la carta',
};

export const BOTON_OTRAS_PREGUNTAS: BotonAccion = {
  id: 'btn_preguntas',
  titulo: 'Otras preguntas',
};

export const BOTON_HABLAR_PERSONA: BotonAccion = {
  id: 'btn_persona',
  titulo: 'Hablar con asesor',
};

export const BOTONES_MI_PEDIDO: BotonAccion[] = [
  { id: 'c_eta', titulo: '¿Cuánto falta?' },
  { id: 'c_dir', titulo: 'Cambiar dirección' },
  { id: 'btn_persona', titulo: 'Hablar con asesor' },
];

// Botones específicos del flujo de Pedido (Ola 2, Agente C)
export const BOTONES_PEDIDO_MODALIDAD: BotonAccion[] = [
  { id: 'ped_mod_delivery', titulo: 'Delivery' },
  { id: 'ped_mod_recojer', titulo: 'Para recoger' },
];

export const BOTONES_PEDIDO_UBICACION: BotonAccion[] = [
  { id: 'ped_loc_share', titulo: 'Compartir ubicación' },
  { id: 'ped_loc_escribir', titulo: 'Escribir dirección' },
];

export const BOTONES_PEDIDO_UBICACION_FALLIDA: BotonAccion[] = [
  { id: 'ped_mod_recojer', titulo: 'Para recoger' },
  { id: 'ped_loc_escribir', titulo: 'Escribir dirección' },
  BOTON_VOLVER_MENU,
];

export const BOTONES_PEDIDO_ACCION_CARRITO: BotonAccion[] = [
  { id: 'ped_otro', titulo: 'Agregar producto' },
  { id: 'ped_ver_carrito', titulo: 'Ver mi pedido' },
  { id: 'ped_continuar', titulo: 'Continuar' },
];

export const BOTONES_PEDIDO_TELEFONO: BotonAccion[] = [
  { id: 'ped_tel_mismo', titulo: 'Usar este número' },
  { id: 'ped_tel_otro', titulo: 'Escribir otro' },
];

export const BOTONES_PEDIDO_NOMBRES_ENVASE: BotonAccion[] = [
  { id: 'ped_nom_si', titulo: 'Sí, correcto' },
  { id: 'ped_nom_no', titulo: 'No, cambiar' },
];

export const BOTONES_PEDIDO_VER_CARRITO: BotonAccion[] = [
  { id: 'ped_continuar', titulo: 'Continuar' },
  { id: 'ped_otro', titulo: 'Agregar producto' },
  { id: 'ped_quitar', titulo: 'Quitar producto' },
];

export const BOTONES_PEDIDO_OFERTA_CALIFICA: BotonAccion[] = [
  { id: 'ped_promo_si', titulo: 'Sí, aplicar promo' },
  { id: 'ped_promo_no', titulo: 'No, gracias' },
];

export const BOTONES_PEDIDO_OFERTA_FALTA: BotonAccion[] = [
  { id: 'ped_otro', titulo: 'Agregar producto' },
  { id: 'ped_promo_seguir', titulo: 'Seguir sin promo' },
];

export const BOTONES_PEDIDO_PREGUNTA_CUPON: BotonAccion[] = [
  { id: 'ped_cupon_si', titulo: 'Tengo un cupón' },
  { id: 'ped_cupon_no', titulo: 'No tengo cupón' },
];

export const BOTONES_PEDIDO_NOMBRE_CONFIRMAR: BotonAccion[] = [
  { id: 'ped_nombre_ok', titulo: 'Sí, es correcto' },
  { id: 'ped_nombre_otro', titulo: 'Escribir mi nombre' },
];

export const BOTONES_PEDIDO_COMPROBANTE: BotonAccion[] = [
  { id: 'ped_comp_boleta', titulo: 'Boleta' },
  { id: 'ped_comp_factura', titulo: 'Factura' },
];

export const BOTONES_PUNTOS_PROPIA: BotonAccion[] = [
  { id: 'puntos_si', titulo: 'Sumar puntos' },
  { id: 'puntos_no', titulo: 'Seguir como invitado' },
  { id: 'puntos_otro', titulo: 'Usar otro número' },
];
// Meta limita el título de un botón a 20 caracteres: «Tengo cuenta con otro número» no cabe
export const BOTONES_PUNTOS_SIN_CUENTA: BotonAccion[] = [
  { id: 'puntos_crear', titulo: 'Crear mi cuenta' },
  { id: 'puntos_no', titulo: 'Seguir como invitado' },
  { id: 'puntos_otro', titulo: 'Tengo otro número' },
];
export const BOTONES_CUENTA_CONSENTIMIENTO: BotonAccion[] = [
  { id: 'cuenta_acepto', titulo: 'Acepto' },
  { id: 'cuenta_no', titulo: 'No, gracias' },
];
export const BOTONES_PUNTOS_RECORDATORIO: BotonAccion[] = [
  { id: 'puntos_si', titulo: 'Sí' },
  { id: 'puntos_otro', titulo: 'Cambiar' },
  { id: 'puntos_sin', titulo: 'Sin puntos' },
];
export const BOTONES_PUNTOS_DICTADO: BotonAccion[] = [
  { id: 'puntos_si', titulo: 'Sí, sumar' },
  { id: 'puntos_otro', titulo: 'No, otro número' },
  { id: 'puntos_sin', titulo: 'Sin puntos' },
];
export const BOTONES_PUNTOS_NO_ENCONTRADO: BotonAccion[] = [
  { id: 'puntos_otro', titulo: 'Probar otro número' },
  { id: 'puntos_sin', titulo: 'Seguir sin puntos' },
];
export const BOTONES_PUNTOS_NUMERO: BotonAccion[] = [{ id: 'puntos_sin', titulo: 'Sin puntos' }];

export const BOTONES_PEDIDO_CONFIRMAR_FINAL: BotonAccion[] = [
  { id: 'ped_confirmar', titulo: 'Confirmar pedido' },
  { id: 'ped_cambiar', titulo: 'Cambiar algo' },
];

export const BOTONES_PEDIDO_CANCELAR_CONFIRMAR: BotonAccion[] = [
  { id: 'ped_cancelar_si', titulo: 'Sí, cancelar' },
  { id: 'ped_cancelar_no', titulo: 'No, continuar' },
];

export const BOTONES_PEDIDO_NOTAS: BotonAccion[] = [
  { id: 'ped_nota_sin', titulo: 'Sin notas' },
  { id: 'ped_continuar', titulo: 'Continuar' },
];

export const BOTONES_PEDIDO_CANTIDADES: BotonAccion[] = [
  { id: 'ped_cant_1', titulo: '1 unidad' },
  { id: 'ped_cant_2', titulo: '2 unidades' },
  { id: 'ped_cant_3', titulo: '3 unidades' },
];

// Filas de Preguntas Frecuentes (mockup líneas 215-221: DUDAS)
export const FILAS_PREGUNTAS_FRECUENTES: FilaLista[] = [
  {
    id: 'faq_lactosa',
    titulo: 'Intolerancia lactosa',
    descripcion: 'Leche sin lactosa y bebida vegetal disponible',
  },
  {
    id: 'faq_calientes',
    titulo: 'Bebidas calientes',
    descripcion: 'Cafés y bebidas calientes disponibles',
  },
  {
    id: 'faq_postres',
    titulo: 'Postres de hoy',
    descripcion: 'Waffles y postres disponibles hoy',
  },
  {
    id: 'faq_ubicacion',
    titulo: '¿Dónde están ubicados?',
    descripcion: 'Dirección, referencia y cómo llegar',
  },
  {
    id: 'faq_horario',
    titulo: 'Horario de atención', // ¿Hasta qué hora atienden? excede 24 caracteres (25). Se coloca en descripción.
    descripcion: '¿Hasta qué hora atienden y días abiertos?',
  },
  {
    id: 'faq_pagos',
    titulo: 'Medios de pago',
    descripcion: 'Yape, Plin, efectivo, tarjeta y transferencia',
  },
  {
    id: 'faq_delivery',
    titulo: 'Costo de delivery',
    descripcion: 'Tarifas de envío y envío gratis',
  },
  {
    id: 'faq_promos',
    titulo: 'Promociones de hoy',
    descripcion: 'Ofertas vigentes y combos de hoy',
  },
  {
    id: 'btn_persona',
    titulo: 'Hablar con una persona',
    descripcion: 'Atención personalizada con un asesor',
  },
];

export const TEXTO_ASISTIDO_FRASE_FIJA =
  'Ya avise a una persona; mientras tanto puedo ayudarte con esto:';

export const BOTONES_MODO_ASISTIDO: BotonAccion[] = [
  { id: 'btn_asi_carta', titulo: 'Ver la carta' },
  { id: 'btn_asi_pedido', titulo: 'Estado de mi pedido' },
  { id: 'btn_asi_persona', titulo: 'Hablar con persona' },
];

export interface InfoEstadoPedido {
  codigo: string;
  estado: string;
  modalidad?: string;
  tiempoEstimadoMin?: number;
  tiempoMaxMin?: number;
  minutosTranscurridos?: number;
  altaDemanda?: boolean;
  minutosExtraDemanda?: number;
}

export interface InfoOfertaBot {
  nombre: string;
  tipo?: string;
  descripcion?: string | null;
  descuentoTipo?: string | null;
  descuentoValor?: number | null;
  compraMinima?: number | null;
  vigenteAhora: boolean;
  diasTexto?: string;
  horasTexto?: string;
}

export interface InfoOpcionBot {
  nombre: string;
  precioExtra?: number;
  disponible: boolean;
  agotadoHasta?: string | null;
}

export interface InfoGrupoBot {
  nombre: string;
  obligatorio: boolean;
  opciones: InfoOpcionBot[];
}

export interface InfoProductoBot {
  id: string;
  nombre: string;
  descripcion?: string | null;
  precio: number;
  disponible: boolean;
  agotadoHasta?: string | null;
  tamanos?: { nombre: string; precio: number }[];
  grupos?: InfoGrupoBot[];
  sabores?: { nombre: string; disponible: boolean }[];
}

export const TEXTOS_BOT = {
  /**
   * Saludo de bienvenida (mockup línea 139 + aviso de alta demanda / pausa / horario cerrado).
   */
  saludoBienvenida: (
    nombre?: string | null,
    datosLocal?: DatosHorarioLocal | null,
    textoPersonalizado?: string | null,
  ): string => {
    const nombreLimpio = String(nombre || '').trim();
    let saludoBase = textoPersonalizado ? textoPersonalizado.trim() : '';

    if (!saludoBase) {
      saludoBase = nombreLimpio
        ? `CAPRICHOS DEL MES · Frappe Maracuyá Tropical 🍓\n\n¡Hola, ${nombreLimpio}! ☕ Soy Capri, la asistente de Caprichos. ¿En qué te podemos ayudar hoy? 🧁`
        : 'CAPRICHOS DEL MES · Frappe Maracuyá Tropical 🍓\n\n¡Hola! ☕ Soy Capri, la asistente de Caprichos. ¿En qué te podemos ayudar hoy? 🧁';
    } else if (saludoBase.includes('{nombre}')) {
      saludoBase = saludoBase.replace('{nombre}', nombreLimpio || 'cliente');
    }

    if (datosLocal?.pausaAltaDemanda) {
      const motivo = datosLocal.motivoPausa || 'alta demanda de pedidos';
      return `${saludoBase}\n\nPor el momento no estamos recibiendo pedidos (${motivo}). Un asesor te atiende por este chat.`;
    }

    if (datosLocal && !datosLocal.abierta) {
      const abreTexto = datosLocal.abre
        ? ` Abrimos hoy a las ${datosLocal.abre}.`
        : ' Abrimos en nuestro próximo horario regular.';
      return `${saludoBase}\n\nAhora estamos cerrados.${abreTexto} No tomamos pedidos fuera de horario; escríbenos cuando abramos.`;
    }

    if (datosLocal?.altaDemandaMinutosExtra && datosLocal.altaDemandaMinutosExtra > 0) {
      const tiempoBase = 25 + datosLocal.altaDemandaMinutosExtra;
      return `${saludoBase}\n\nHoy tenemos muchos pedidos: la entrega está tardando unos ${tiempoBase} minutos.`;
    }

    return saludoBase;
  },

  /**
   * Mensaje de despedida cuando el cliente agradece o se despide.
   */
  despedida: (textoPersonalizado?: string | null): string => {
    return (
      textoPersonalizado?.trim() ||
      'Gracias por comunicarte con Caprichos ☕. ¡Esperamos verte pronto! 🧁'
    );
  },

  /**
   * Respuesta informativa cuando el cliente solicita hacer un pedido (Ola 1 / ganchos Ola 2).
   * Mockup línea 336.
   */
  pedidoProximamente: (cartaUrl?: string | null): string => {
    const urlLimpia = String(cartaUrl || '').trim();
    const enlace = urlLimpia ? ` Puedes hacer tu pedido en nuestra carta digital: ${urlLimpia}` : '';
    return `Perfecto. ¿Cómo lo quieres?\n\nEsta opción estará disponible muy pronto para pedir directamente por WhatsApp.${enlace}`;
  },

  /**
   * Respuesta informativa para Reservar mesa (Ola 1 / gancho Ola 3).
   * Mockup línea 344.
   */
  reservaProximamente: (): string => {
    return '¿Para cuántas personas es la reserva?\n\nEsta opción estará disponible muy pronto para reservar por WhatsApp. Si deseas una mesa ahora, un asesor te puede ayudar.';
  },

  /**
   * Horario y ubicación integrando LocalService (mockup líneas 219-220).
   */
  horarioYUbicacion: (datos?: DatosHorarioLocal | null): string => {
    const direccion = datos?.direccion?.trim() || 'Av. Principal 123';
    const enlaceMapa =
      datos?.enlaceMapa?.trim() || 'https://www.google.com/maps?q=-12.0196436,-76.963255';
    const ref = datos?.referencia?.trim() ? ` ${datos.referencia.trim()}.` : '';
    const tel = datos?.telefono?.trim() ? ` Si prefieres llamar: ${datos.telefono.trim()}.` : '';

    if (datos?.pausaAltaDemanda) {
      const motivo = datos.motivoPausa || 'alta demanda de pedidos';
      return [
        `Por el momento no estamos recibiendo pedidos (${motivo}).`,
        `Estamos en ${direccion}.${ref}${tel}`,
        `Cómo llegar: ${enlaceMapa}`,
      ].join('\n');
    }

    let textoHorario = 'Cerrado por el momento.';
    if (datos?.abierta && datos.cierra) {
      textoHorario = `Abierto hoy hasta las ${datos.cierra}.`;
    } else if (!datos?.abierta && datos?.abre) {
      const hasta = datos.cierra ? ` (hasta las ${datos.cierra})` : '';
      textoHorario = `Cerrado · abre hoy a las ${datos.abre}${hasta}.`;
    }

    return [
      `Nuestro horario: ${datos?.textoEstado || 'Lunes a Domingo'}. Hoy: ${textoHorario}`,
      `Estamos en ${direccion}.${ref}${tel}`,
      `Cómo llegar: ${enlaceMapa}`,
    ].join('\n');
  },

  /**
   * Pase a persona (mockup línea 141).
   */
  pasarAPersona: (textoPersonalizado?: string | null): string => {
    return (
      textoPersonalizado?.trim() ||
      'Te paso con alguien del equipo. Ya les avisé con tu nombre y tu número; en unos minutos te escriben.'
    );
  },

  /**
   * Primera repregunta cuando no se entiende el mensaje (mockup línea 305).
   */
  noEntiendoRepregunta: (textoPersonalizado?: string | null): string => {
    return (
      textoPersonalizado?.trim() ||
      'No estoy seguro de haber entendido. ¿Qué necesitas? Puedes elegir una opción o escribirme de otra forma.'
    );
  },

  /**
   * Derivación automática tras no entender por segunda vez (mockup línea 304).
   */
  noEntiendoDerivacion: (textoPersonalizado?: string | null): string => {
    return (
      textoPersonalizado?.trim() ||
      'No logro entender bien tu mensaje, mejor te paso con una persona del equipo para ayudarte.'
    );
  },

  /**
   * Error al consultar base de datos o servicio (requisito f).
   */
  errorServicio: (): string => {
    return 'Estoy teniendo un problema para ver eso, te paso con una persona.';
  },

  // ---------------------------------------------------------------------------
  // NAVEGACIÓN DE CARTA DENTRO DEL CHAT (requisitos a, b, c)
  // ---------------------------------------------------------------------------

  cuerpoCategorias: (abierto = true): string => {
    if (!abierto) {
      return 'Ahora estamos cerrados, pero puedes revisar nuestra carta de productos y precios:';
    }
    return 'Elige una categoría para ver sus productos y precios:';
  },

  categoriaAgotada: (categoria: string): string => {
    return `Todos los productos de la categoría ${categoria} están agotados por el momento. Te invitamos a revisar otra categoría.`;
  },

  cuerpoProductosCategoria: (categoria: string): string => {
    return `Estos son nuestros ${categoria.toLowerCase()}. ¿Cuál te provoca?`;
  },

  detalleProducto: (prod: InfoProductoBot, cartaUrl?: string | null): string => {
    const lineas: string[] = [];
    lineas.push(`*${prod.nombre.toUpperCase()}*`);

    if (prod.descripcion?.trim()) {
      lineas.push(prod.descripcion.trim());
    }

    if (!prod.disponible) {
      const retorno = prod.agotadoHasta ? ` (regresa aprox. ${prod.agotadoHasta})` : '';
      lineas.push(`\n⚠️ *Por ahora no está disponible*${retorno}.`);
    } else {
      if (prod.tamanos && prod.tamanos.length > 0) {
        lineas.push('\n*Presentaciones:*');
        prod.tamanos.forEach((t) => {
          lineas.push(`• ${t.nombre}: s/ ${t.precio.toFixed(2)}`);
        });
      } else {
        lineas.push(`\n*Precio:* s/ ${prod.precio.toFixed(2)}`);
      }

      if (prod.grupos && prod.grupos.length > 0) {
        prod.grupos.forEach((g) => {
          lineas.push(`\n*${g.nombre}:*`);
          g.opciones.forEach((o) => {
            const extra = o.precioExtra && o.precioExtra > 0 ? ` (+ s/ ${o.precioExtra.toFixed(2)})` : '';
            const disp = o.disponible ? '' : ' [Por ahora no disponible]';
            lineas.push(`• ${o.nombre}${extra}${disp}`);
          });
        });
      }

      if (prod.sabores && prod.sabores.length > 0) {
        lineas.push('\n*Sabores:*');
        prod.sabores.forEach((s) => {
          const disp = s.disponible ? '' : ' [Agotado]';
          lineas.push(`• ${s.nombre}${disp}`);
        });
      }
    }

    const enlace = cartaUrl ? `\n\nPídelo en nuestra carta virtual:\n${cartaUrl.trim()}` : '';
    lineas.push(enlace);

    return lineas.filter(Boolean).join('\n').slice(0, 1024);
  },

  promocionesHoy: (ofertas: InfoOfertaBot[]): string => {
    if (!ofertas || ofertas.length === 0) {
      return 'Por el momento no tenemos promociones activas para hoy. ¡Revisa nuestra carta para ver todos los productos!';
    }

    const lineas: string[] = ['*Promociones y ofertas:*'];
    const vigentes = ofertas.filter((o) => o.vigenteAhora);
    const noVigentes = ofertas.filter((o) => !o.vigenteAhora);

    if (vigentes.length > 0) {
      lineas.push('\n🏷 *Vigentes hoy:*');
      vigentes.forEach((o) => {
        const desc = o.descripcion ? ` — ${o.descripcion}` : '';
        const min = o.compraMinima ? ` (Compra mín. s/ ${o.compraMinima.toFixed(2)})` : '';
        lineas.push(`• *${o.nombre}*${desc}${min}`);
      });
    }

    if (noVigentes.length > 0) {
      lineas.push('\n📅 *Otras promociones (Hoy no aplica):*');
      noVigentes.forEach((o) => {
        const cuando = o.diasTexto ? ` (Aplica: ${o.diasTexto})` : ' (Hoy no aplica)';
        lineas.push(`• *${o.nombre}*: Hoy no aplica${cuando}`);
      });
    }

    return lineas.join('\n').slice(0, 1024);
  },

  // ---------------------------------------------------------------------------
  // MI PEDIDO Y SEGUIMIENTO (requisito d, mockup líneas 268-285)
  // ---------------------------------------------------------------------------

  miPedidoPedirCodigo: (): string => {
    return 'Por favor escribe el código de tu pedido (ejemplo: CP-0110) para consultar su estado:';
  },

  miPedidoNoEncontrado: (): string => {
    return 'No encuentro un pedido activo con tu número. ¿Quieres hacer uno ahora?';
  },

  miPedidoDemasiadasConsultas: (): string => {
    return 'Has consultado tu pedido varias veces en poco tiempo. Por favor espera un momento antes de volver a consultar.';
  },

  miPedidoOpciones: (codigo: string): string => {
    return `Claro. ¿Qué necesitas de tu pedido ${codigo}? También puedes escribírmelo.`;
  },

  miPedidoEstado: (info: InfoEstadoPedido): string => {
    const code = info.codigo;
    const st = info.estado.toLowerCase();

    if (st === 'esperando_pago') {
      return `Tu pedido ${code} está registrado y esperando la captura de tu pago 📲.`;
    }

    if (st === 'validando_pago') {
      return `Tu pedido ${code} tiene su captura en revisión por Caja 👩‍💻. En unos momentos te confirmamos.`;
    }

    if (st === 'entregado') {
      return `Tu pedido ${code} figura como entregado. Si hubo algún problema, ya avisé a una persona del equipo para que te escriba.`;
    }

    if (st === 'llego') {
      return `El repartidor ya está en tu puerta con el pedido ${code}. Por favor sal a recibirlo: espera como máximo 10 minutos.`;
    }

    if (st === 'en_camino' || st === 'ruta') {
      return `Tu pedido ${code} ya está en camino con el repartidor 🛵. Atenta a tu celular: te llamará al llegar.`;
    }

    const base = (info.tiempoEstimadoMin || 25) + (info.minutosExtraDemanda || 0);
    const tope = (info.tiempoMaxMin || 35) + (info.minutosExtraDemanda || 0);
    const transcurrido = info.minutosTranscurridos || 0;
    const demora = transcurrido >= tope;

    const estadoTexto = st === 'listo' ? 'listo y esperando al repartidor' : 'en cocina 👩‍🍳';

    if (demora) {
      return `Tu pedido está ${estadoTexto} y ya pasamos el tiempo que te dijimos (${base} a ${tope} minutos). Disculpa la demora: ya avisé al equipo para apurarlo y una persona te escribe.`;
    }

    const r1 = Math.max(0, base - transcurrido);
    const r2 = Math.max(5, tope - transcurrido);
    const tiempoTexto = r1 > 0 ? `${r1} a ${r2}` : `pocos (máximo ${r2})`;
    const extraDemanda = info.altaDemanda ? ' Hoy hay mucha demanda y tarda un poco más.' : '';

    return `Tu pedido ${code} está ${estadoTexto}. Te llega en unos ${tiempoTexto} minutos.${extraDemanda}`;
  },

  miPedidoCambioDireccion: (enRuta: boolean): string => {
    if (enRuta) {
      return 'Tu pedido ya salió con el repartidor y por seguridad no lo puedo cambiar desde aquí. Ya avisé a un asesor para que hable contigo y con el repartidor ahora mismo.';
    }
    return 'Tu pedido ya está en preparación. Ya avisé a un asesor para ver si se puede cambiar la dirección; si la nueva zona cuesta distinto, te confirma el nuevo envío.';
  },

  miPedidoCambioOAnulacion: (enRuta: boolean): string => {
    if (enRuta) {
      return 'Tu pedido ya va en camino y no se puede modificar. Ya avisé a un asesor por si necesitas algo más.';
    }
    return 'Tu pedido ya está en cocina y quitar productos no siempre se puede. Ya avisé a un asesor para revisarlo contigo ahora.';
  },

  // ---------------------------------------------------------------------------
  // PREGUNTAS FRECUENTES (requisito e, mockup líneas 215-221)
  // ---------------------------------------------------------------------------

  preguntasCuerpo: (): string => {
    return 'Hola, soy Capri. Dime tu consulta y te ayudo.';
  },

  faqLactosa: (opcionesLeche: { nombre: string; extra: number; disponible: boolean }[]): string => {
    const disponibles = opcionesLeche.filter((o) => o.disponible);
    const textoLeches = disponibles.length > 0
      ? disponibles
          .map((o) => (o.extra > 0 ? `${o.nombre} (+ s/ ${o.extra.toFixed(2)})` : o.nombre))
          .join(' y ')
      : 'leche sin lactosa';
    return `Revisé lo que hay ahora: tenemos ${textoLeches}. Te recomiendo el Capuccino o el Mocaccino con leche sin lactosa. El pedido lo hacemos por botones.`;
  },

  faqCalientes: (calientes: { nombre: string; disponible: boolean }[]): string => {
    const disponibles = calientes.filter((p) => p.disponible).map((p) => p.nombre);
    const nombres = disponibles.length > 0 ? disponibles.join(', ') : 'Mocaccino, Capuccino y Café americano';
    return `Disponibles ahora: ${nombres}. ¿Te gustan más dulces o más fuertes? Con eso te recomiendo una. El pedido lo hacemos por botones.`;
  },

  faqPostres: (
    postres: { nombre: string; disponible: boolean }[],
    sugerencia?: string,
  ): string => {
    const disp = postres.filter((p) => p.disponible).map((p) => p.nombre);
    const agot = postres.filter((p) => !p.disponible).map((p) => p.nombre);
    const textoDisp = disp.length > 0 ? `Hoy hay ${disp.join(', ')}.` : 'Hoy tenemos waffles y dulces recién horneados.';
    const textoAgot = agot.length > 0
      ? ` ${agot.join(', ')} se acabaron; te sugiero ${sugerencia || 'nuestro Nutewaffle'}.`
      : '';
    return `${textoDisp}${textoAgot} El pedido lo hacemos por botones.`;
  },

  faqUbicacion: (datos?: DatosHorarioLocal | null): string => {
    const direccion = datos?.direccion?.trim() || 'Campoy, San Juan de Lurigancho, Lima';
    const ref = datos?.referencia?.trim() ? ` ${datos.referencia.trim()}.` : '';
    const mapa = datos?.enlaceMapa?.trim() ? ` Cómo llegar: ${datos.enlaceMapa.trim()}` : '';
    const tel = datos?.telefono?.trim() ? ` Si prefieres llamar: ${datos.telefono.trim()}.` : '';
    return `Estamos en ${direccion}.${ref}${mapa}${tel}`;
  },

  faqHorario: (datos?: DatosHorarioLocal | null): string => {
    const estado = datos?.abierta && datos.cierra
      ? `abierto hasta las ${datos.cierra}`
      : datos?.abre
        ? `cerrado · abre hoy a las ${datos.abre}`
        : 'cerrado por hoy';
    return `Nuestro horario: ${datos?.textoEstado || 'Lunes a Domingo'}. Hoy: ${estado}. El pedido lo hacemos por botones.`;
  },

  faqPagos: (mediosPago: Record<string, any>): string => {
    const nombres = Object.keys(mediosPago).map((k) => {
      const c = mediosPago[k];
      return c?.nombre || k.toUpperCase();
    });
    const lista = nombres.length > 0 ? nombres.join(', ') : 'Yape, Plin, efectivo, tarjeta y transferencia bancaria';
    return `Aceptamos los siguientes medios de pago: ${lista}. En pedidos por WhatsApp, coordinamos el pago por aquí y una persona del equipo lo valida.`;
  },

  faqDelivery: (minimo?: number | null, envioGratis?: number | null): string => {
    const minTexto = minimo ? `s/ ${minimo.toFixed(2)}` : 's/ 14.50';
    const gratisTexto = envioGratis ? ` Además, ¡el envío es gratis en compras a partir de s/ ${envioGratis.toFixed(2)}!` : '';
    return `El pedido mínimo para delivery es ${minTexto} en productos.${gratisTexto} La tarifa exacta depende de tu ubicación en nuestras zonas de reparto.`;
  },

  // =========================================================================
  // FLUJO DE PEDIDO POR BOTONES (Ola 2, Agente C - Mockup Chatbot.dc.html)
  // =========================================================================

  pedidoModalidad: (): string => {
    return 'Perfecto. ¿Cómo lo quieres?';
  },

  pedidoPedirUbicacion: (): string => {
    return 'Anotado: Delivery. ¿Dónde te lo llevamos? Comparte tu ubicación actual para que el repartidor te encuentre.';
  },

  pedidoUbicacionClipAyuda: (): string => {
    return 'Toca el clip 📎 y selecciona "Ubicación" para compartir tu ubicación actual, o escribe tu dirección.';
  },

  pedidoFueraDeCobertura: (): string => {
    return 'Tu ubicación está fuera de nuestra zona de reparto. Puedes pedir para recoger en el local.';
  },

  pedidoUbicacionExitosa: (tarifa: number, esGratis: boolean, gratisDesde?: number): string => {
    if (esGratis) {
      const gTexto = gratisDesde ? ` por compras mayores a S/ ${gratisDesde.toFixed(2)}` : '';
      return `Tu ubicación fue localizada correctamente. El envío a tu ubicación es gratis${gTexto}. Elige una categoría:`;
    }
    return `Tu ubicación fue localizada correctamente. El envío a tu ubicación cuesta S/ ${tarifa.toFixed(2)}. Elige una categoría:`;
  },

  pedidoEscribirDireccionPrompt: (): string => {
    return 'Sin problema, escríbeme tu dirección cuando termines tu pedido (distrito, calle, manzana y lote). Un asesor te escribe, te ubica en el mapa y te confirma el costo del envío. Elige una categoría.';
  },

  pedidoPedirReferencia: (): string => {
    return 'Por favor indícanos una referencia para el repartidor (por ejemplo: frente al parque, portón blanco, timbre 2):';
  },

  /** Cliente con cuenta y direcciones guardadas: elegir una anterior o pedir ubicación nueva. */
  pedidoDireccionesAnteriores: (): string => {
    return '¡Qué gusto verte de nuevo! 😊 ¿Lo enviamos a una dirección anterior o a una nueva?';
  },

  pedidoDireccionAnteriorElegida: (
    direccion: string,
    tarifa: number,
    esGratis: boolean,
    gratisDesde?: number,
  ): string => {
    const envio = esGratis
      ? `El envío es gratis${gratisDesde ? ` por compras mayores a S/ ${gratisDesde.toFixed(2)}` : ''}.`
      : `El envío cuesta S/ ${tarifa.toFixed(2)}.`;
    return `Perfecto, lo enviamos a ${direccion}. ${envio} Elige una categoría:`;
  },

  pedidoDireccionAnteriorSinCoordenadas: (direccion: string): string => {
    return `Anotado: lo enviamos a ${direccion}. Un asesor te confirmará el costo del envío. Elige una categoría:`;
  },

  pedidoDireccionAnteriorFueraCobertura: (): string => {
    return 'Esa dirección quedó fuera de nuestra zona de reparto. Comparte una nueva ubicación o escribe otra dirección.';
  },

  pedidoRecojoConfirmado: (): string => {
    return 'Anotado: Para recoger. Elige una categoría.';
  },

  pedidoCategoriasPrompt: (): string => {
    return 'Elige una categoría:';
  },

  pedidoCategoriaSeleccionada: (catNombre: string): string => {
    return `Estos son nuestros ${catNombre.toLowerCase()}. ¿Cuál te provoca?`;
  },

  carruselFavoritos: (catNombre: string): string => {
    return `Los favoritos de nuestros clientes ⭐\nDesliza para ver ${catNombre.toLowerCase()} y toca «Pedir este» en el que te provoque.`;
  },

  carruselMasOpciones: (): string => 'Más opciones para ti 💛\nDesliza y toca «Pedir este» en el que quieras.',

  carruselVerListaCompleta: (): string => '¿Quieres ver todo lo que tenemos en esta categoría?',

  pedidoProductoAgotado: (nombre: string, alternativas: string[] = []): string => {
    const altTexto = alternativas.length > 0 ? ` Te sugiero ${alternativas.join(' o ')}.` : '';
    return `Por ahora no hay stock de ${nombre}.${altTexto}`;
  },

  pedidoCategoriaVacia: (): string => {
    return 'Por ahora no tenemos productos disponibles en esta categoría. Te invitamos a revisar nuestras otras categorías.';
  },

  pedidoPreguntarTamano: (nombreProd: string): string => {
    return `${nombreProd}. ¿Qué presentación prefieres?`;
  },

  pedidoPreguntarGrupo: (nombreGrupo: string, obligatorio: boolean): string => {
    return obligatorio
      ? `¿${nombreGrupo}? Es obligatorio.`
      : `¿Quieres ${nombreGrupo.toLowerCase()}? Es opcional.`;
  },

  pedidoOpcionObligatoriaFaltante: (nombreGrupo: string): string => {
    return `Por favor elige una opción de ${nombreGrupo} para continuar (es obligatorio).`;
  },

  pedidoPreguntarSabor: (): string => {
    return '¿Qué sabor prefieres?';
  },

  pedidoPreguntarNotas: (nombreProd: string): string => {
    return `¿Tienes alguna indicación especial para ${nombreProd}? Si no tienes notas, presiona Continuar.`;
  },

  pedidoPreguntarCantidad: (nombreProd: string): string => {
    return `¿Cuántas unidades deseas de ${nombreProd}? Elige una opción o escribe el número:`;
  },

  pedidoProductoAgregado: (nombreProd: string, subtotalLinea: number, hintOferta?: string): string => {
    const hint = hintOferta ? `\n\n${hintOferta}` : '';
    return `Agregué ${nombreProd} (S/ ${subtotalLinea.toFixed(2)}) a tu pedido. ¿Quieres algo más?${hint}`;
  },

  pedidoVerCarrito: (itemsTexto: string, subtotal: number): string => {
    return `🛒 *Tu pedido actual:*\n${itemsTexto}\n\n*Subtotal:* S/ ${subtotal.toFixed(2)}`;
  },

  pedidoProductoEliminado: (nombreProd: string): string => {
    return `Eliminé ${nombreProd} de tu pedido.`;
  },

  pedidoCarritoVacio: (): string => {
    return 'Tu carrito está vacío. Elige una categoría para empezar a agregar productos:';
  },

  pedidoOfertaCalifica: (nombreOferta: string, ahorro: number): string => {
    return `🏷 Tu pedido califica para «${nombreOferta}»: te ahorras S/ ${ahorro.toFixed(2)} (los adicionales se cobran aparte). ¿La aplico?`;
  },

  pedidoOfertaFaltaPoco: (faltan: number, miss: string[], nombreOferta: string, precio: number): string => {
    return `🏷 Con ${faltan} más (${miss.join(' + ')}) se aplica «${nombreOferta}»: pagas S/ ${precio.toFixed(2)} por los productos. ¿Quieres agregarlo?`;
  },

  pedidoPreguntaCupon: (): string => {
    return '¿Cuentas con un cupón de descuento?';
  },

  pedidoIngresarCuponPrompt: (): string => {
    return 'Por favor escribe el código de tu cupón:';
  },

  pedidoCuponAplicado: (codigo: string, descuento: number): string => {
    return `Listo, apliqué el cupón «${codigo}»: ahorras S/ ${descuento.toFixed(2)}.`;
  },

  pedidoCuponInvalido: (mensaje?: string): string => {
    return mensaje || 'El código de cupón ingresado no es válido o ya expiró.';
  },

  pedidoMinimoNoAlcanzado: (minimo: number, faltante: number): string => {
    return `El pedido mínimo para delivery es S/ ${minimo.toFixed(2)} en productos. Te faltan S/ ${faltante.toFixed(2)}; agrega algo más.`;
  },

  pedidoConfirmarNombre: (nombrePerfil: string): string => {
    return `¿Confirmas que tu nombre es ${nombrePerfil}? 👤`;
  },

  pedidoIngresarNombre: (): string => {
    return 'Por favor escribe tu nombre completo para el pedido:';
  },

  pedidoIngresarTelefono: (): string => {
    return 'Por favor escribe tu número de celular de 9 dígitos para coordinar tu pedido y la entrega:';
  },

  pedidoConfirmarTelefono: (tel: string): string => {
    return `¿Usamos este número para coordinar tu pedido y la entrega: ${tel}?`;
  },

  pedidoPedirNombreEnvase: (producto: string, indice: number, total: number): string => {
    return `Tu ${producto}: escribe el nombre para el envase ${indice} de ${total}. Irá en la etiqueta pegada al envase (máx. 14 letras se ven completas).`;
  },

  pedidoConfirmarNombresEnvases: (producto: string, nombres: string[]): string => {
    const lista = nombres.map((n, i) => `${i + 1}. ${n}`).join('\n');
    return `Estos son los nombres de tus ${nombres.length} envases de ${producto}:\n${lista}\n\n¿Está correcto?`;
  },

  pedidoTelefonoInvalido: (): string => {
    return 'El número ingresado no es válido. Debe tener 9 dígitos y empezar con 9 (ejemplo: 987654321). Por favor escríbelo nuevamente:';
  },

  pedidoMedioPago: (): string => {
    return '¿Cómo pagarás?';
  },

  pedidoMontoEfectivo: (): string => {
    return '¿Con cuánto pagas? Escribe el monto o selecciona una opción.\nTe preparamos el vuelto 💵';
  },

  pedidoPagaConMenorQueTotal: (total: number): string => {
    return `El monto debe ser al menos de S/ ${total.toFixed(2)}. ¿Con cuánto pagarás?`;
  },

  pedidoComprobanteTipo: (): string => {
    return '¿Qué comprobante de pago deseas? Elige boleta o factura.';
  },

  pedidoComprobanteDni: (): string => {
    return 'Para tu boleta con documento, escribe tu número de DNI (8 dígitos), solo para tu comprobante, o escribe "omitir":';
  },

  pedidoComprobanteRuc: (): string => {
    return 'Por favor escribe el RUC de tu empresa (11 dígitos):';
  },

  pedidoComprobanteRazon: (): string => {
    return 'Por favor escribe la Razón Social de tu empresa:';
  },

  // --- Puntos (cliente con cuenta, sin clave: se reconoce por el número de WhatsApp) ---
  puntosCuentaPropia: (primerNombre: string): string =>
    `¡Hola, ${primerNombre}! 💛 Qué bueno verte de nuevo. ¿Sumamos los puntos de hoy a tu cuenta o prefieres seguir como invitado?`,
  puntosSinCuentaBienvenida: (): string =>
    `¡Hola! 👋 Este número todavía no tiene cuenta en Caprichos. ¿Quieres crearla con este mismo número para sumar puntos, o prefieres seguir como invitado?`,
  puntosPedirNumero: (): string =>
    `Escríbeme el número de celular (9 dígitos) de la cuenta donde quieres sumar, o toca "Sin puntos".`,
  puntosEncontrado: (terminacion: string): string =>
    `Encontré una cuenta que termina en ***${terminacion}, ¿sumo ahí?`,
  cuentaPedirNombre: (): string => `¡Genial! 😊 ¿Cómo te llamas? Escribe tu nombre.`,
  cuentaNombreInvalido: (): string => `Necesito tu nombre con al menos 2 letras. ¿Cómo te llamas?`,
  cuentaConsentimiento: (nombre: string, enlaces: string): string =>
    `Gracias, ${nombre}. Para crear tu cuenta con este número guardaremos tu celular y tu nombre para gestionar tus pedidos, sumar puntos y avisarte por WhatsApp.\n${enlaces}\n¿Aceptas?`,
  cuentaEnlacesLegales: (terminos: string | null, privacidad: string | null): string =>
    terminos && privacidad
      ? `Términos: ${terminos}\nPrivacidad: ${privacidad}`
      : `Puedes leer los Términos y la Privacidad en nuestra carta.`,
  cuentaCreada: (nombre: string): string =>
    `¡Listo, ${nombre}! Tu cuenta quedó creada con este número. Para entrar en caprichos.pe define tu contraseña con “¿Olvidaste tu contraseña?”; te llegará un código por aquí.`,
  cuentaNoCreada: (): string =>
    `No pude crear tu cuenta ahora, pero tu pedido sigue en marcha. Puedes crearla después en la carta con este mismo número. 😊`,
  cuentaSinConsentimiento: (): string => `Sin problema, seguimos como invitado. 😊`,
  puntosNoEncontrado: (urlCarta: string): string =>
    `No encontré una cuenta con ese número.\nPuedes crear la tuya con tu celular en ${urlCarta} y sumar en tu próximo pedido.`,
  puntosNumeroInvalido: (): string =>
    `Necesito un celular de 9 dígitos que empiece con 9 (por ejemplo 987654321), o toca "Sin puntos".`,
  puntosTopeIntentos: (urlCarta: string): string =>
    `Ya probamos tres números, así que sigo con tu pedido sin puntos.\nPuedes crear tu cuenta con tu celular en ${urlCarta} y sumar desde el próximo.`,
  puntosRecordatorio: (destino: string): string => `Sumo tus puntos a ${destino} como antes, ¿ok?`,
  puntosLineaResumen: (p: { estimado: number | null; saldo?: number | null; sinPuntos?: boolean }): string => {
    if (p.sinPuntos) return `⭐ Este pedido no suma puntos.`;
    const saldo = p.saldo != null ? ` (tienes ${p.saldo.toFixed(2)})` : '';
    return p.estimado != null
      ? `⭐ Este pedido sumará ~${p.estimado.toFixed(2)} puntos cuando Caja lo cobre${saldo}.`
      : `⭐ Sumarás puntos por los productos sin promoción cuando Caja cobre el pedido${saldo}.`;
  },
  puntosMiSaldo: (primerNombre: string, saldo: number, porcentaje: number): string =>
    `⭐ ${primerNombre}, tienes ${saldo.toFixed(2)} puntos.\nGanas ${porcentaje} % de lo que pagas en productos sin promoción.`,
  puntosSinCuenta: (urlCarta: string): string =>
    `No encontré una cuenta con este número de WhatsApp.\nCrea la tuya con tu celular en ${urlCarta}, usando este mismo número, y empieza a sumar puntos.`,
  puntosNoDisponible: (): string => `Ahora no puedo consultar tus puntos. Inténtalo en unos minutos.`,

  pedidoResumenFinal: (params: {
    lineasTexto: string;
    descuentoTexto?: string;
    envioTexto: string;
    total: number;
    modalidad: string;
    direccionTexto?: string;
    pagoTexto: string;
    tiempoMin: number;
    tiempoMax: number;
    avisoDemanda?: string;
    puntosTexto?: string;
  }): string => {
    const {
      lineasTexto,
      descuentoTexto,
      envioTexto,
      total,
      modalidad,
      direccionTexto,
      pagoTexto,
      tiempoMin,
      tiempoMax,
      avisoDemanda,
      puntosTexto,
    } = params;

    const descBloque = descuentoTexto ? `\n${descuentoTexto}` : '';
    const dirBloque = direccionTexto ? `\n${direccionTexto}` : '';
    const demandaBloque = avisoDemanda ? `\n\n${avisoDemanda}` : '';

    return (
      `Este es tu resumen:\n` +
      `${lineasTexto}${descBloque}\n` +
      `Envío: ${envioTexto}\n` +
      `*Total: S/ ${total.toFixed(2)}*\n\n` +
      `Modalidad: ${modalidad}${dirBloque}\n` +
      `Pago: ${pagoTexto}\n` +
      `Tiempo estimado: ${tiempoMin} a ${tiempoMax} minutos${demandaBloque}\n\n` +
      (puntosTexto ? `${puntosTexto}\n\n` : '') +
      `¿Confirmo tu pedido?`
    );
  },

  pedidoConfirmadoExito: (params: {
    codigo: string;
    tiempoMin: number;
    tiempoMax: number;
    esPagoDigital: boolean;
    datosPago?: string;
    /** Pago dividido: una captura por medio digital, con su monto */
    capturas?: Array<{ medio: string; monto: number }>;
  }): string => {
    const { codigo, tiempoMin, tiempoMax, esPagoDigital, datosPago, capturas } = params;
    const datosBloque = datosPago ? `\n\n${datosPago}` : '';

    if (esPagoDigital && capturas && capturas.length >= 1) {
      const nombre = (m: string) => ({ YAPE: 'Yape', PLIN: 'Plin', TRANSFERENCIA: 'Transferencia' } as Record<string, string>)[m] ?? m;
      const lista = capturas.map((c) => `• ${nombre(c.medio)}: S/ ${c.monto.toFixed(2)}`).join('\n');
      return (
        `Listo. Recibimos tu pedido ${codigo}. Pasa a cocina apenas validemos tu pago.\n` +
        `Envíanos una captura por cada medio digital, indicando de cuál es:\n${lista}\n` +
        `Una persona del equipo las revisa y te avisa por este chat.` +
        datosBloque
      );
    }

    if (esPagoDigital) {
      return (
        `Listo. Recibimos tu pedido ${codigo}. Pasa a cocina apenas validemos tu pago.\n` +
        `Envíanos aquí la captura de tu comprobante (Yape, Plin o transferencia). Una persona del equipo la revisa y te avisa por este chat.` +
        datosBloque
      );
    }

    return (
      `Listo. Tu pedido ${codigo} ya está en cocina 👩‍🍳. Te llega de ${tiempoMin} a ${tiempoMax} minutos. ` +
      `Una persona del equipo te escribe por este chat para coordinar el pago.${datosBloque}`
    );
  },

  pedidoConfirmarCancelar: (): string => {
    return '¿Estás seguro de que deseas cancelar tu pedido actual? Se descartarán los productos de tu carrito.';
  },

  pedidoCancelado: (): string => {
    return 'Tu pedido fue cancelado y el carrito fue descartado. ¿En qué te puedo ayudar hoy?';
  },

  pedidoExpiradoInactividad: (): string => {
    return 'Tu pedido anterior expiró por inactividad (más de 30 minutos sin respuesta). Tu carrito fue descartado. ¿En qué te puedo ayudar hoy?';
  },

  pedidoLimiteDiarioAlcanzado: (): string => {
    return 'Has alcanzado el límite de 10 pedidos diarios por WhatsApp. Un asesor te atenderá personalmente.';
  },
};

export * from './textos-reserva';
export * from './flujos/pago/textos-pago';
export * from './textos-ia';
export * from './flujos/cambios/textos-cambios';


