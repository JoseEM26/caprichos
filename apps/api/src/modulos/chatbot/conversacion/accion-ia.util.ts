import { transicionarEstado } from './maquina-estados';
import { AccionIa } from '../ia/tipos-ia';
import { BotonAccion } from '../puerto/whatsapp-mensajeria.puerto';
import { ContextoConversacion, EntradaNormalizada, FlujoConversacion } from './tipos-conversacion';

/** Respuesta única de la IA con su acción: UN solo mensaje (anti-bloqueo), texto de la IA + el paso que sigue, con sus botones. */
export interface RespuestaConAccionIa {
  texto: string;
  botones: BotonAccion[];
  /** Flujo nuevo si la acción avanzó el pedido guiado; null = el flujo no cambia (el botón lo hará al tocarlo). */
  nuevoFlujo: FlujoConversacion | null;
}

const LIMITE_CUERPO = 1000;

/**
 * Convierte la acción estructurada de la IA en lo que ejecuta el motor, sin enviar varios mensajes:
 * - EMPEZAR_PEDIDO y AGREGAR_PRODUCTO: corre el motor de pedido de siempre y une el texto de la IA con su primer paso
 *   (si ese paso son botones); si no se puede unir, deja el botón «Hacer un pedido» / «Pedir X».
 * - VER_CATEGORIA: botón «Ver X» (al tocarlo, el motor muestra la categoría de siempre).
 * La IA nunca escribe nada: el motor valida y ejecuta con las mismas reglas del pedido guiado (cantidad 1, carrito, stock).
 */
export function respuestaConAccionIa(
  accion: AccionIa,
  textoIa: string,
  flujo: FlujoConversacion,
  contexto: ContextoConversacion,
): RespuestaConAccionIa {
  const volver: BotonAccion = { id: 'btn_menu', titulo: 'Volver al menú' };
  if (accion.tipo === 'VER_CATEGORIA') {
    return { texto: textoIa, botones: [{ id: `ped_cat_${accion.categoriaId}`, titulo: `Ver ${accion.nombre}`.slice(0, 20) }, volver], nuevoFlujo: null };
  }
  const entrada: EntradaNormalizada =
    accion.tipo === 'EMPEZAR_PEDIDO'
      ? { tipo: 'boton', texto: 'pedir', textoOriginal: 'Hacer un pedido', id: 'pedir' }
      : { tipo: 'boton', texto: '', textoOriginal: '', id: `ped_prod_${accion.productoId}` };
  const respaldo: BotonAccion =
    accion.tipo === 'EMPEZAR_PEDIDO'
      ? { id: 'pedir', titulo: 'Hacer un pedido' }
      : { id: `ped_prod_${accion.productoId}`, titulo: `Pedir ${accion.nombre}`.slice(0, 20) };
  try {
    const r = transicionarEstado(flujo, entrada, { ...contexto, chatbotIaActivo: false });
    const primera: any = r.acciones[0];
    if (r.acciones.length === 1 && primera?.tipo === 'enviarBotones' && Array.isArray(primera.botones) && primera.botones.length) {
      const sitio = Math.max(0, LIMITE_CUERPO - String(primera.texto).length - 2);
      const ia = textoIa.length > sitio ? `${textoIa.slice(0, Math.max(0, sitio - 1)).trimEnd()}…` : textoIa;
      return { texto: ia ? `${ia}\n\n${primera.texto}` : primera.texto, botones: primera.botones, nuevoFlujo: r.nuevoFlujo };
    }
  } catch {
    // Sin paso unible: queda el botón de respaldo
  }
  return { texto: textoIa, botones: [respaldo, volver], nuevoFlujo: null };
}
