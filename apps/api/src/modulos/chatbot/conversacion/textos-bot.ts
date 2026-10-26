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
  ): string => {
    const nombreLimpio = String(nombre || '').trim();
    const saludoBase = nombreLimpio
      ? `CAPRICHOS DEL MES · Frappe Maracuyá Tropical 🍓\n\n¡Hola, ${nombreLimpio}! ☕ Soy Capri, la asistente de Caprichos. ¿En qué te podemos ayudar hoy? 🧁`
      : 'CAPRICHOS DEL MES · Frappe Maracuyá Tropical 🍓\n\n¡Hola! ☕ Soy Capri, la asistente de Caprichos. ¿En qué te podemos ayudar hoy? 🧁';

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
  pasarAPersona: (): string => {
    return 'Te paso con alguien del equipo. Ya les avisé con tu nombre y tu número; en unos minutos te escriben.';
  },

  /**
   * Primera repregunta cuando no se entiende el mensaje (mockup línea 305).
   */
  noEntiendoRepregunta: (): string => {
    return 'No estoy seguro de haber entendido. ¿Qué necesitas? Puedes elegir una opción o escribirme de otra forma.';
  },

  /**
   * Derivación automática tras no entender por segunda vez (mockup línea 304).
   */
  noEntiendoDerivacion: (): string => {
    return 'No logro entender bien tu mensaje, mejor te paso con una persona del equipo para ayudarte.';
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
};
