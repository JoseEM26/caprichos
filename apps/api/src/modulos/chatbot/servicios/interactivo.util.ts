import { CargaCarrusel, normalizarCarrusel } from './carrusel.util';
import { BotonAccion, FilaLista } from '../puerto/whatsapp-mensajeria.puerto';

export interface SeccionLista {
  titulo: string;
  filas: FilaLista[];
}

/** Carga de un mensaje interactivo del outbox: botones (máx. 3) o lista (máx. 10 filas). */
export interface CargaInteractivo {
  cuerpo: string;
  botones?: BotonAccion[];
  lista?: { boton: string; secciones: SeccionLista[] };
  /** Carrusel de 2 a 10 tarjetas con imagen; `cuerpo` va en el cuerpo del carrusel. */
  carrusel?: CargaCarrusel;
}

export const LIMITES_INTERACTIVO = { cuerpo: 1024, boton: 20, fila: 24, descripcion: 72, botones: 3, filas: 10 };

const cortar = (t: unknown, n: number) => String(t ?? '').trim().slice(0, n);

/** Recorta a los límites de WhatsApp sin lanzar: botones a 3, filas a 10, títulos y cuerpo a su tope. */
export function normalizarInteractivo(i: CargaInteractivo): CargaInteractivo {
  const L = LIMITES_INTERACTIVO;
  const cuerpo = cortar(i.cuerpo, L.cuerpo);
  if (i.carrusel) return { cuerpo, carrusel: normalizarCarrusel({ ...i.carrusel, cuerpo }) };
  if (i.botones?.length) {
    return {
      cuerpo,
      botones: i.botones.slice(0, L.botones).map((b) => ({ id: cortar(b.id, 256), titulo: cortar(b.titulo, L.boton) })),
    };
  }
  let restantes = L.filas;
  const secciones: SeccionLista[] = [];
  for (const s of i.lista?.secciones ?? []) {
    const filas = (s.filas ?? []).slice(0, restantes).map((f) => ({
      id: cortar(f.id, 200),
      titulo: cortar(f.titulo, L.fila),
      ...(f.descripcion ? { descripcion: cortar(f.descripcion, L.descripcion) } : {}),
    }));
    restantes -= filas.length;
    if (filas.length) secciones.push({ titulo: cortar(s.titulo, L.fila), filas });
  }
  return { cuerpo, lista: { boton: cortar(i.lista?.boton || 'Ver opciones', L.boton), secciones } };
}

/** Opciones en líneas con viñeta: es lo que sale cuando el interactivo cae a texto fuera de la ventana. */
export function textoConVinetas(i: CargaInteractivo): string {
  const titulos = i.carrusel
    ? i.carrusel.tarjetas.map((t) => t.nombre)
    : i.botones?.length
    ? i.botones.map((b) => b.titulo)
    : (i.lista?.secciones ?? []).flatMap((s) => s.filas.map((f) => f.titulo));
  return titulos.length ? `${i.cuerpo}\n\n${titulos.map((t) => `• ${t}`).join('\n')}`.slice(0, 3500) : i.cuerpo;
}

/**
 * Interactivo con las opciones reales del contenido de un mensaje_chat del bot (botones o filas),
 * o null si ese mensaje no las tenía. El prefijo (aviso) va delante del texto original.
 */
export function interactivoDesdeContenido(contenido: any, prefijo = ''): CargaInteractivo | null {
  const texto = typeof contenido?.texto === 'string' ? contenido.texto.trim() : '';
  if (!texto) return null;
  const cuerpo = `${prefijo ? `${prefijo}\n\n` : ''}${texto}`;
  if (Array.isArray(contenido.botones) && contenido.botones.length) {
    return normalizarInteractivo({ cuerpo, botones: contenido.botones });
  }
  if (Array.isArray(contenido.filas) && contenido.filas.length) {
    return normalizarInteractivo({
      cuerpo,
      lista: { boton: contenido.botonTexto, secciones: [{ titulo: contenido.tituloSeccion || 'Opciones', filas: contenido.filas }] },
    });
  }
  return null;
}
