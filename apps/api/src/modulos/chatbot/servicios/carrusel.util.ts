import { Logger } from '@nestjs/common';
import { inicialesProducto } from '../../catalogo/imagen-inicial';
import { BotonAccion, FilaLista, OpcionesEnvio, ResultadoEnvioWhatsApp, WhatsAppMensajeriaPuerto } from '../puerto/whatsapp-mensajeria.puerto';

/**
 * Carrusel interactivo de WhatsApp (type "carousel"): 2 a 10 tarjetas con imagen y un botón de respuesta rápida.
 * Límites según la doc de Meta (interactive-media-carousel-messages): cuerpo 1024, cuerpo de tarjeta 160 con
 * hasta 2 saltos de línea, título de botón 20, id de botón 256, mismo tipo y cantidad de botones en todas.
 * Es un mensaje NO plantilla: solo sale con la ventana de 24 h abierta (el bot siempre responde a un cliente que escribió).
 */
export interface TarjetaCarrusel {
  /** Nombre corto: solo para el resumen del chat y el texto de respaldo. */
  nombre: string;
  /** URL HTTPS pública de la imagen; null si no hay URL pública (en real cae al respaldo). */
  imagenUrl: string | null;
  cuerpo: string;
  boton: BotonAccion;
  /** Cómo salió la imagen en Meta (lo fija el adaptador real): por media id subido o por link. */
  via?: 'id' | 'link';
}

/** Lo que se envía si el carrusel no puede salir (sin URL pública o Meta lo rechaza): la lista o botones de hoy. */
export interface RespaldoCarrusel {
  texto: string;
  botonTexto?: string;
  tituloSeccion?: string;
  filas?: FilaLista[];
  botones?: BotonAccion[];
}

export interface CargaCarrusel {
  cuerpo: string;
  tarjetas: TarjetaCarrusel[];
  respaldo?: RespaldoCarrusel;
  /** Segundo botón igual en todas las tarjetas (Meta exige mismos tipos y cantidad), p. ej. «Otra categoría». */
  botonComun?: BotonAccion;
}

export const LIMITES_CARRUSEL = { cuerpo: 1024, tarjeta: 160, saltos: 2, boton: 20, id: 256, min: 2, max: 10 };

const cortar = (t: unknown, n: number) => String(t ?? '').trim().slice(0, n);

function cuerpoTarjeta(t: string): string {
  const lineas = String(t ?? '').trim().split(/\r?\n/).filter(Boolean);
  const unido = [...lineas.slice(0, LIMITES_CARRUSEL.saltos), lineas.slice(LIMITES_CARRUSEL.saltos).join(' ')]
    .filter(Boolean)
    .join('\n');
  return unido.slice(0, LIMITES_CARRUSEL.tarjeta);
}

/** Recorta a los límites de Meta (máx. 10 tarjetas). Lanza si quedan menos de 2: no hay carrusel. */
export function normalizarCarrusel(c: CargaCarrusel): CargaCarrusel {
  const L = LIMITES_CARRUSEL;
  const tarjetas = (c.tarjetas ?? []).slice(0, L.max).map((t) => ({
    nombre: cortar(t.nombre, 60),
    imagenUrl: t.imagenUrl ?? null,
    cuerpo: cuerpoTarjeta(t.cuerpo),
    boton: { id: cortar(t.boton.id, L.id), titulo: cortar(t.boton.titulo, L.boton) },
  }));
  if (tarjetas.length < L.min) throw new Error('Un carrusel necesita entre 2 y 10 tarjetas');
  const botonComun = c.botonComun ? { id: cortar(c.botonComun.id, L.id), titulo: cortar(c.botonComun.titulo, L.boton) } : undefined;
  return { cuerpo: cortar(c.cuerpo, L.cuerpo), tarjetas, respaldo: c.respaldo, botonComun };
}

/** Todas las tarjetas traen imagen HTTPS pública (Meta no baja imágenes de http ni de localhost). */
export const carruselEnviable = (c: CargaCarrusel): boolean =>
  c.tarjetas.every((t) => /^https:\/\/[^/\s]+\.[^/\s]+/i.test(t.imagenUrl ?? ''));

/** Bloque `interactive` del payload de Meta, tal como lo pide la doc. */
export function payloadInteractivoCarrusel(c: CargaCarrusel, ids: Array<string | null> = []) {
  const n = normalizarCarrusel(c);
  return {
    type: 'carousel',
    body: { text: n.cuerpo },
    action: {
      cards: n.tarjetas.map((t, i) => ({
        card_index: i,
        type: 'cta_url',
        header: { type: 'image', image: ids[i] ? { id: ids[i] } : { link: t.imagenUrl } },
        body: { text: t.cuerpo },
        action: {
          buttons: [t.boton, ...(n.botonComun ? [n.botonComun] : [])].map((b) => ({
            type: 'quick_reply',
            quick_reply: { id: b.id, title: b.titulo },
          })),
        },
      })),
    },
  };
}

/** Resumen legible para el admin: «Carrusel: Frappe Oreo, Frappe Maracuyá…» */
export function resumenCarrusel(c: CargaCarrusel): string {
  const porId = c.tarjetas.filter((t) => t.via === 'id').length;
  const via = c.tarjetas.some((t) => t.via) ? ` [imagen: ${porId} por id, ${c.tarjetas.filter((t) => t.via === 'link').length} por link]` : '';
  return `Carrusel: ${c.tarjetas.map((t) => t.nombre).join(', ')}${via}`.slice(0, 400);
}

/**
 * Envía el carrusel; si no se puede (sin URL pública, Meta lo rechaza, no soportado) reenvía el respaldo
 * (lista o botones) para que el cliente nunca se quede sin respuesta.
 */
export async function enviarCarruselConRespaldo(
  mensajeria: WhatsAppMensajeriaPuerto,
  telefono: string,
  carga: CargaCarrusel,
  opciones?: OpcionesEnvio,
): Promise<ResultadoEnvioWhatsApp & { respaldo?: boolean; motivoRespaldo?: string }> {
  const r = await mensajeria.enviarCarrusel(telefono, carga, opciones);
  const rp = carga.respaldo;
  if (r.exito || !rp) return r;
  const motivoRespaldo = `${r.errorCodigo ?? 'SIN_CODIGO'}${r.errorDetalle ? `: ${r.errorDetalle}` : ''}`.slice(0, 300);
  new Logger('Carrusel').warn(`El carrusel no salió (${motivoRespaldo}); se envió el respaldo`);
  if (rp.filas?.length) {
    const l = await mensajeria.enviarLista(telefono, rp.texto, rp.botonTexto ?? 'Ver productos', rp.filas.slice(0, 10), {
      ...opciones,
      tituloSeccion: rp.tituloSeccion,
    });
    return { ...l, respaldo: true, motivoRespaldo };
  }
  if (rp.botones?.length) return { ...(await mensajeria.enviarBotones(telefono, rp.texto, rp.botones.slice(0, 3), opciones)), respaldo: true, motivoRespaldo };
  return r;
}

// ---------------------------------------------------------------------------
// Fotos
// ---------------------------------------------------------------------------

/** Origen público de la carta: CARTA_URL_PUBLICA o, si está vacía, https://DOMINIO_BASE. */
export function urlPublicaCarta(get: (clave: string) => string | undefined): string {
  const url = (get('CARTA_URL_PUBLICA') ?? '').trim();
  if (url) return url;
  const dominio = (get('DOMINIO_BASE') ?? '').trim();
  return dominio ? `https://${dominio}` : '';
}

/** URL pública HTTPS de una foto de la carta (rutas «/archivos/...» van sobre el origen de CARTA_URL_PUBLICA). */
export function urlPublicaFoto(cartaUrlPublica: string | undefined | null, ruta: string | null | undefined): string | null {
  if (!ruta) return null;
  if (/^https:\/\//i.test(ruta)) return ruta;
  try {
    const u = new URL(String(cartaUrlPublica ?? ''));
    return u.protocol === 'https:' && ruta.startsWith('/') ? `${u.origin}${ruta}` : null;
  } catch {
    return null;
  }
}

/**
 * Imagen del producto para la tarjeta: SIEMPRE el endpoint JPEG cuadrado de la API (foto convertida, o iniciales si no
 * tiene), porque Meta solo acepta JPEG/PNG y las fotos son WEBP; así todas las tarjetas tienen la misma proporción.
 * El parámetro `v` (foto actual) rompe cachés de Meta al cambiar la foto. Null si no hay URL pública HTTPS.
 */
export function imagenProductoCarrusel(
  cartaUrlPublica: string | undefined | null,
  p: { id: string; nombre: string; fotoUrl?: string | null },
): string | null {
  const v = encodeURIComponent(p.fotoUrl ?? inicialesProducto(p.nombre));
  return urlPublicaFoto(cartaUrlPublica, `/carta/productos/${encodeURIComponent(p.id)}/imagen-wa.jpg?v=${v}`);
}

/** Más vendidos primero; sin ventas (o empatados) conservan el orden de la carta. */
export function ordenarPorVentas<T extends { id: string | number }>(productos: T[], ventas: Record<string, number> = {}): T[] {
  return productos
    .map((p, i) => ({ p, i }))
    .sort((a, b) => (ventas[String(b.p.id)] ?? 0) - (ventas[String(a.p.id)] ?? 0) || a.i - b.i)
    .map((x) => x.p);
}

/** Tarjeta de un producto de la carta: foto (o iniciales), nombre, precio («Desde S/ X» si tiene tamaños) y «Pedir este». */
export function tarjetaProducto(p: any, cartaUrlPublica?: string | null, avisoStock?: string | null): TarjetaCarrusel {
  const precios: number[] = (p.tamanos ?? []).map((t: any) => Number(t.precio)).filter((n: number) => n > 0);
  const precio = precios.length ? `Desde S/ ${Math.min(...precios).toFixed(2)}` : `S/ ${Number(p.precio || 0).toFixed(2)}`;
  return {
    nombre: String(p.nombre),
    imagenUrl: imagenProductoCarrusel(cartaUrlPublica, { id: String(p.id), nombre: String(p.nombre), fotoUrl: p.fotoUrl }),
    cuerpo: `${String(p.nombre).slice(0, avisoStock ? 70 : 100)}\n${precio}${avisoStock ? `\n${avisoStock}` : ''}`,
    boton: { id: `ped_prod_${p.id}`, titulo: 'Pedir este' },
  };
}

// ---------------------------------------------------------------------------
// Paginación de carruseles (todo carrusel con más de 10 tarjetas lleva «Ver más»)
// ---------------------------------------------------------------------------

export interface OpcionesPaginaCarrusel {
  tarjetas: TarjetaCarrusel[];
  /** 1 = primera página. */
  pagina: number;
  cuerpoPrimera: string;
  cuerpoSiguientes: string;
  /** Respaldo del carrusel de la página 1 (las demás páginas arman su lista solas). */
  respaldoPrimera?: RespaldoCarrusel;
  /** Id del botón «Ver más» que lleva a la página n. */
  idVerMas: (n: number) => string;
  textoVerMas: (quedan: number) => string;
  /** Segundo botón en cada tarjeta, para salir sin escribir (p. ej. «Otra categoría»). */
  botonTarjeta?: BotonAccion;
  /** Botones tras «Ver más» (máx. 2: Meta admite 3 botones). */
  botonesExtra: BotonAccion[];
  textoLista: string;
}

const filaDeTarjeta = (t: TarjetaCarrusel): FilaLista => ({
  id: t.boton.id,
  titulo: t.nombre.slice(0, 24),
  descripcion: t.cuerpo.split('\n')[1] ?? '',
});

/**
 * Una página de hasta 10 tarjetas como acciones del bot: carrusel (2 o más), lista si queda 1, y si hay más,
 * un mensaje de botones aparte con «Ver más» (Meta no admite un botón extra dentro del carrusel).
 */
export function accionesPaginaCarrusel(o: OpcionesPaginaCarrusel): any[] {
  const POR = LIMITES_CARRUSEL.max;
  const trozo = o.tarjetas.slice((o.pagina - 1) * POR, o.pagina * POR);
  const quedan = o.tarjetas.length - o.pagina * POR;
  const acciones: any[] = [];
  let carrusel = false;
  if (trozo.length >= 2) {
    carrusel = true;
    acciones.push({
      tipo: 'enviarCarrusel',
      carga: {
        cuerpo: o.pagina === 1 ? o.cuerpoPrimera : o.cuerpoSiguientes,
        tarjetas: trozo,
        ...(o.botonTarjeta ? { botonComun: o.botonTarjeta } : {}),
        respaldo:
          o.pagina === 1 && o.respaldoPrimera
            ? o.respaldoPrimera
            : { texto: o.textoLista, botonTexto: 'Ver productos', filas: trozo.map(filaDeTarjeta) },
      },
    });
  } else if (trozo.length === 1) {
    acciones.push({ tipo: 'enviarLista', texto: o.textoLista, botonTexto: 'Ver productos', filas: [filaDeTarjeta(trozo[0])] });
  }
  if (quedan > 0) {
    acciones.push({
      tipo: 'enviarBotones',
      texto: o.textoVerMas(quedan),
      botones: [{ id: o.idVerMas(o.pagina + 1), titulo: 'Ver más' }, ...o.botonesExtra.slice(0, 2)],
      ...(carrusel && o.pagina === 1 ? { soloSiCarruselSalio: true } : {}),
    });
  }
  return acciones;
}
