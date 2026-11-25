import { AccionMensaje } from '../../tipos-conversacion';
import { MAX_FOTOS_BOT } from './combo-bot';

const norm = (t?: string | null): string =>
  String(t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

/** Pasos del pedido guiado donde «foto» se contesta con imagen de la carta (en vez de pasar a una persona). */
export const ESTADOS_CON_FOTO = ['PEDIDO_CATEGORIAS', 'PEDIDO_PRODUCTOS', 'PEDIDO_TAMANO', 'PEDIDO_SABOR'];

export const TEXTO_SIN_FOTO_PASO = 'No tengo foto de eso por aquí 😅';

type Item = { nombre: string; ruta?: string | null };

/**
 * Fotos que el cliente pidió en un paso del pedido: tamaño, sabor o producto, siempre validados contra la carta real.
 * La foto propia (tamaño o sabor) solo vale con su interruptor encendido; si no, se usa la del producto.
 * Devuelve las acciones `enviarImagen` (vacío si no hay foto posible). Nunca inventa ni manda por defecto.
 */
export function fotosDelPedido(
  estado: string,
  texto: string,
  categorias: any[],
  productoId: string | undefined,
  urlFoto: (ruta: string) => string | null,
): AccionMensaje[] {
  const t = norm(texto);
  const productos = (categorias || []).flatMap((c: any) => c.productos || []);
  const prod = productos.find((p: any) => String(p.id) === String(productoId));
  const nombrados = (lista: Item[]) => {
    const n = lista.filter((i) => norm(i.nombre) && t.includes(norm(i.nombre)));
    return n.length > 0 ? n : lista;
  };
  let items: Item[] = [];
  if (estado === 'PEDIDO_TAMANO' && prod) {
    items = nombrados((prod.tamanos || []).map((x: any) => ({ nombre: x.nombre, ruta: (prod.mostrarImagenesTamanos && x.fotoUrl) || prod.fotoUrl })));
  } else if (estado === 'PEDIDO_SABOR' && prod) {
    items = nombrados((prod.sabores || []).map((x: any) => ({ nombre: x.nombre, ruta: (prod.mostrarImagenesSabores && x.fotoUrl) || prod.fotoUrl })));
    if (items.length === 0) items = [{ nombre: prod.nombre, ruta: prod.fotoUrl }];
  } else if (estado === 'PEDIDO_CATEGORIAS' || estado === 'PEDIDO_PRODUCTOS') {
    // Solo el producto que nombra (el de nombre más largo si varios coinciden); sin nombre no hay foto
    const p = productos.filter((x: any) => norm(x.nombre) && t.includes(norm(x.nombre))).sort((a: any, b: any) => b.nombre.length - a.nombre.length)[0];
    if (p) items = [{ nombre: p.nombre, ruta: p.fotoUrl }];
  }
  const vistas = new Set<string>();
  const acciones: AccionMensaje[] = [];
  for (const i of items) {
    const url = i.ruta ? urlFoto(i.ruta) : null;
    if (!url || vistas.has(url)) continue;
    vistas.add(url);
    acciones.push({ tipo: 'enviarImagen', url, caption: i.nombre });
    if (acciones.length >= MAX_FOTOS_BOT) break;
  }
  return acciones;
}
