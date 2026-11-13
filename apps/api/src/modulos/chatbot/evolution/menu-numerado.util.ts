import type { BotonAccion, FilaLista } from '../puerto/whatsapp-mensajeria.puerto';

/** Una opción del menú en texto: el número que escribe el cliente y el id que habría devuelto el botón o la fila. */
export interface OpcionMenu {
  n: number;
  id: string;
  titulo: string;
}

export interface MenuNumerado {
  /** 'lista' si venía de una lista (el flujo distingue list_reply de button_reply). */
  tipo: 'boton' | 'lista';
  opciones: OpcionMenu[];
}

const TOPE_OPCIONES = 30;

/** Convierte botones o filas en texto numerado y devuelve el menú para mapear la respuesta del cliente. */
export function aTextoNumerado(
  texto: string,
  items: Array<BotonAccion | FilaLista>,
  tipo: 'boton' | 'lista',
): { texto: string; menu: MenuNumerado } {
  const opciones = items.slice(0, TOPE_OPCIONES).map((it, i) => ({ n: i + 1, id: it.id, titulo: it.titulo }));
  const lineas = opciones.map((o) => {
    const desc = (items[o.n - 1] as FilaLista).descripcion;
    return `${o.n}. ${o.titulo}${desc ? ` (${desc})` : ''}`;
  });
  const rango = opciones.length <= 1 ? '1' : opciones.length === 2 ? '1 o 2' : `${opciones.slice(0, -1).map((o) => o.n).join(', ')} o ${opciones.length}`;
  return { texto: `${texto.trim()}\n\n${lineas.join('\n')}\n\nResponde ${rango}.`, menu: { tipo, opciones } };
}

/** Número que el cliente escribió como respuesta («2», «2.», «opción 2»); null si el texto es otra cosa. */
export function numeroEscrito(texto: string): number | null {
  const m = /^\s*(?:opci[oó]n\s*)?(\d{1,2})\s*[.)]?\s*$/i.exec(texto ?? '');
  return m ? Number(m[1]) : null;
}

/** La opción elegida, o null si no hay menú, el texto no es un número o el número no existe en el menú. */
export function resolverRespuesta(texto: string, menu: MenuNumerado | null | undefined): OpcionMenu | null {
  if (!menu) return null;
  const n = numeroEscrito(texto);
  return n === null ? null : (menu.opciones.find((o) => o.n === n) ?? null);
}
