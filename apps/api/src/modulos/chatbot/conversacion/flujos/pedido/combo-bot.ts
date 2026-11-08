import { AccionMensaje, EntradaNormalizada } from '../../tipos-conversacion';
import { ofertaIncluyeCanal } from '../../../../ofertas/ofertas.util';
import { TEXTOS_COMBO } from '../../textos-combo';
import { ComboEnConfiguracionBot, EleccionComboBot, OpcionComboBot, PasoComboBot } from './tipos-pedido';

/** Por WhatsApp se arman hasta este número de combos con elecciones a la vez (cada uno pide sus elecciones una por una). */
export const MAX_COMBOS_CON_ELECCION = 5;

const norm = (t?: string | null): string =>
  (t ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Combo que el bot puede vender de un producto anfitrión (el «Combo Dúo» de la carta): activo, con la casilla
 * «WhatsApp (bot)», vigente hoy (días, hora, límite de usos) y armable con el stock de ahora. Sin paquetes de complemento.
 */
export function comboVendibleBot(ofertas: any[] | undefined, productoId: string): any | null {
  return (
    (ofertas ?? []).find(
      (o) =>
        o.tipo === 'COMBO' &&
        o.activo !== false &&
        o.vigenteAhora !== false &&
        o.disponible !== false &&
        String(o.alcanceProductoId ?? '') === String(productoId) &&
        ofertaIncluyeCanal(o.canales, 'BOT') &&
        // Combo con complemento a elegir (paquetes): se pide por la carta, el bot no lo arma
        !(o.combosParte ?? []).some((p: any) => !!p.paqueteGrupo),
    ) ?? null
  );
}

/** Anfitriones de combos activos que el bot NO vende hoy (sin canal WhatsApp, agotados o fuera de horario): no salen en sus listas. */
export function productosComboNoBot(combosActivos: any[], ofertasBot: any[]): string[] {
  const anfitriones = combosActivos
    .filter((o) => o.tipo === 'COMBO' && o.activo !== false && o.alcanceProductoId)
    .map((o) => String(o.alcanceProductoId));
  return [...new Set(anfitriones)].filter((id) => !comboVendibleBot(ofertasBot, id));
}

const nombreConTamano = (p: any): string =>
  p.tamanoNombre ? `${p.principalNombre} · ${p.tamanoNombre}` : String(p.principalNombre);

/** Partes con su producto fijo y sin plan B activo: viajan solas («Incluye: Club Sándwich»). */
function fijasDe(oferta: any): ComboEnConfiguracionBot['fijas'] {
  return (oferta.combosParte ?? [])
    .filter((p: any) => (p.tipo ?? p.tipoParte) === 'FIJO' && p.alternativasActivas !== true && p.productos?.[0] !== undefined)
    .map((p: any) => ({ parteId: String(p.id), productoId: String(p.productos[0]), nombre: nombreConTamano({ ...p, principalNombre: p.principalNombre || '' }) }))
    .filter((f: any) => f.nombre.trim() !== '');
}

export function iniciarCombo(oferta: any): ComboEnConfiguracionBot {
  return {
    ofertaId: String(oferta.id),
    nombre: oferta.nombre,
    pasos: [],
    idx: 0,
    pagina: 1,
    elecciones: [],
    fijas: fijasDe(oferta),
    unidades: 1,
  };
}

/** Opción elegible ahora (sin agotados; por sabor, solo con sabores que aún tienen saldo). Null si no se puede elegir. */
function aOpcion(o: any): OpcionComboBot | null {
  if (!o?.nombre || o.disponible === false) return null;
  const todos = o.sabores ?? [];
  const sabores = todos.filter((s: any) => s.disponible !== false && Number(s.saldo) > 0);
  if (todos.length > 0 && sabores.length === 0) return null;
  return {
    id: String(o.id),
    nombre: String(o.nombre),
    ...(o.cantidad ? { cantidad: Number(o.cantidad) } : {}),
    ...(todos.length > 0 ? { sabores: sabores.map((s: any) => ({ id: String(s.id), nombre: String(s.nombre), saldo: Number(s.saldo) })) } : {}),
  };
}

function categoriaDe(categorias: any[], productoId?: string): string {
  if (!productoId) return '';
  const cat = (categorias ?? []).find((c) => (c.productos ?? []).some((p: any) => String(p.id) === productoId));
  return cat?.nombre ?? '';
}

/**
 * Pasos de elección según lo que el servidor dice hoy (mismos datos que la ventana de la carta):
 * parte con plan B activo (alternativas con stock) y partes con lista de productos (juguetes, donas).
 * Las partes por categoría (bebidas del Dúo) son los grupos del producto anfitrión y no son un paso aquí.
 * False si alguna parte quedó sin opciones que se puedan elegir.
 */
export function armarPasosCombo(combo: ComboEnConfiguracionBot, oferta: any, unidades: number, categorias: any[]): boolean {
  const pasos: PasoComboBot[] = [];
  for (const p of oferta.combosParte ?? []) {
    const tipo = p.tipo ?? p.tipoParte;
    const parteId = String(p.id);
    const alternativas = p.alternativas ?? [];
    if (p.alternativasActivas === true && alternativas.length > 0) {
      const faltante =
        tipo === 'FIJO'
          ? p.principalNombre || 'ese producto'
          : (p.opcionesDetalle ?? []).map((o: any) => o.nombre).filter(Boolean).join(' / ') || 'esa elección';
      pasos.push({ parteId, tipo: 'ALTERNATIVA', etiqueta: faltante, total: 1, hechos: 0, opciones: alternativas.map(aOpcion).filter(Boolean) as OpcionComboBot[] });
    } else if (tipo === 'A_ELECCION' && (p.opcionesDetalle ?? []).length > 0) {
      const opciones = (p.opcionesDetalle as any[]).map(aOpcion).filter(Boolean) as OpcionComboBot[];
      pasos.push({
        parteId,
        tipo: 'ELECCION',
        etiqueta: categoriaDe(categorias, (p.opcionesDetalle as any[])[0]?.id && String((p.opcionesDetalle as any[])[0].id)),
        total: Number(p.cantidad) * unidades,
        hechos: 0,
        opciones,
      });
    }
  }
  if (pasos.some((x) => x.opciones.length === 0)) return false;
  combo.pasos = pasos;
  combo.unidades = unidades;
  combo.idx = 0;
  combo.pagina = 1;
  combo.elecciones = [];
  combo.saborDe = undefined;
  return true;
}

// ---------------------------------------------------------------------------
// Pantallas (botones hasta 3, lista hasta 10 filas con «Ver más»)
// ---------------------------------------------------------------------------

interface ItemElegible {
  id: string;
  titulo: string;
  descripcion?: string;
}

function accionOpciones(texto: string, items: ItemElegible[], pagina: number): AccionMensaje[] {
  if (items.length <= 3) {
    return [{ tipo: 'enviarBotones', texto, botones: items.map((i) => ({ id: i.id, titulo: i.titulo.slice(0, 20) })) }];
  }
  const porPagina = items.length <= 10 ? 10 : 9;
  const paginas = Math.ceil(items.length / porPagina);
  const p = Math.min(Math.max(1, pagina), paginas);
  const filas = items.slice((p - 1) * porPagina, p * porPagina).map((i) => ({
    id: i.id,
    titulo: i.titulo.slice(0, 24),
    ...(i.descripcion ? { descripcion: i.descripcion.slice(0, 72) } : {}),
  }));
  if (p < paginas) filas.push({ id: `ped_cb_pag_${p + 1}`, titulo: '➡️ Ver más', descripcion: `Página ${p + 1} de ${paginas}` });
  return [{ tipo: 'enviarLista', texto, botonTexto: 'Ver opciones', filas }];
}

/** Unidades de ese sabor ya elegidas en todo el combo (un sabor no se elige más veces que su saldo). */
const usadosDeSabor = (combo: ComboEnConfiguracionBot, saborId: string): number =>
  combo.elecciones.filter((e) => e.saborId === saborId).length;

/** Opciones del paso en curso que todavía se pueden elegir (por sabor: queda saldo del sabor). */
function opcionesVisibles(combo: ComboEnConfiguracionBot, paso: PasoComboBot): OpcionComboBot[] {
  return paso.opciones.filter((o) => !o.sabores || o.sabores.some((s) => s.saldo - usadosDeSabor(combo, s.id) > 0));
}

function saboresVisibles(combo: ComboEnConfiguracionBot, op: OpcionComboBot) {
  return (op.sabores ?? []).filter((s) => s.saldo - usadosDeSabor(combo, s.id) > 0);
}

const itemOpcion = (o: OpcionComboBot, esAlternativa: boolean): ItemElegible => ({
  id: `ped_cb_${o.id}`,
  titulo: esAlternativa && (o.cantidad ?? 1) > 1 ? `${o.nombre} x${o.cantidad}` : o.nombre,
});

export interface PlantillasCombo {
  intro?: string;
  planB?: string;
}

/** Lo que se le muestra al cliente para el paso en curso (sin repetir lo ya elegido). */
export function accionesPasoCombo(combo: ComboEnConfiguracionBot, plantillas: PlantillasCombo = {}, filtro?: OpcionComboBot[]): AccionMensaje[] {
  const paso = combo.pasos[combo.idx];
  if (!paso) return [];
  if (combo.saborDe) {
    const op = combo.saborDe.opcion;
    const nombre = paso.total > 1 && paso.tipo === 'ALTERNATIVA' ? `${op.nombre} (${paso.hechos + 1} de ${paso.total})` : op.nombre;
    const items = saboresVisibles(combo, op).map((s) => ({
      id: `ped_cbs_${s.id}`,
      titulo: s.nombre,
      ...(s.saldo - usadosDeSabor(combo, s.id) <= 5 ? { descripcion: `Quedan ${s.saldo - usadosDeSabor(combo, s.id)}` } : {}),
    }));
    return accionOpciones(TEXTOS_COMBO.eligeSabor(nombre), items, combo.pagina);
  }
  const esPlanB = paso.tipo === 'ALTERNATIVA';
  const opciones = filtro ?? opcionesVisibles(combo, paso);
  const texto = esPlanB
    ? TEXTOS_COMBO.planB(paso.etiqueta, opciones.map((o) => itemOpcion(o, true).titulo.replace(/ x(\d+)$/, ' ($1)')), plantillas.planB)
    : TEXTOS_COMBO.eligeOpcion(paso.etiqueta, paso.hechos + 1, paso.total);
  return accionOpciones(texto, opciones.map((o) => itemOpcion(o, esPlanB)), filtro ? 1 : combo.pagina);
}

// ---------------------------------------------------------------------------
// Entrada del cliente
// ---------------------------------------------------------------------------

export interface ResultadoPasoCombo {
  /** seguir: hay otra pregunta; listo: ya eligió todo; reiniciar: volvió al principio del combo. */
  estado: 'seguir' | 'listo' | 'reiniciar';
  acciones: AccionMensaje[];
}

const quitarDeParte = (combo: ComboEnConfiguracionBot, parteId: string) => {
  combo.elecciones = combo.elecciones.filter((e) => e.parteId !== parteId);
};

function reiniciarPaso(combo: ComboEnConfiguracionBot, paso: PasoComboBot) {
  quitarDeParte(combo, paso.parteId);
  paso.hechos = 0;
  if (paso.tipo === 'ALTERNATIVA') {
    paso.alternativa = undefined;
    paso.total = 1;
  }
  combo.saborDe = undefined;
}

/** «Atrás»: deshace la última elección; sin elecciones, vuelve a la parte anterior; en la primera, reinicia el combo. */
function atras(combo: ComboEnConfiguracionBot, plantillas: PlantillasCombo): ResultadoPasoCombo {
  const paso = combo.pasos[combo.idx];
  if (paso && combo.saborDe) {
    if (paso.tipo === 'ALTERNATIVA') reiniciarPaso(combo, paso);
    else combo.saborDe = undefined;
  } else if (paso && paso.tipo === 'ELECCION' && paso.hechos > 0) {
    const ultima = [...combo.elecciones].reverse().find((e) => e.parteId === paso.parteId);
    if (ultima) combo.elecciones.splice(combo.elecciones.lastIndexOf(ultima), 1);
    paso.hechos -= 1;
  } else if (paso && paso.tipo === 'ALTERNATIVA' && paso.alternativa) {
    reiniciarPaso(combo, paso);
  } else if (combo.idx > 0) {
    combo.idx -= 1;
    reiniciarPaso(combo, combo.pasos[combo.idx]);
  } else {
    return { estado: 'reiniciar', acciones: [] };
  }
  combo.pagina = 1;
  return { estado: 'seguir', acciones: accionesPasoCombo(combo, plantillas) };
}

/** Cuenta una elección hecha y pasa a la parte siguiente cuando ya se eligió todo lo de esta. */
function avanzarSiCompleto(combo: ComboEnConfiguracionBot, plantillas: PlantillasCombo): ResultadoPasoCombo {
  const paso = combo.pasos[combo.idx];
  if (paso.hechos < paso.total) {
    // Plan B con sabor: cada unidad de la alternativa pide su sabor
    if (paso.tipo === 'ALTERNATIVA' && paso.alternativa?.sabores?.length) {
      combo.saborDe = { parteId: paso.parteId, opcion: paso.alternativa };
    }
    return { estado: 'seguir', acciones: accionesPasoCombo(combo, plantillas) };
  }
  combo.idx += 1;
  combo.pagina = 1;
  return combo.idx >= combo.pasos.length ? { estado: 'listo', acciones: [] } : { estado: 'seguir', acciones: accionesPasoCombo(combo, plantillas) };
}

/** Procesa lo que el cliente tocó o escribió en el paso en curso del combo. */
export function procesarEntradaCombo(combo: ComboEnConfiguracionBot, entrada: EntradaNormalizada, plantillas: PlantillasCombo = {}): ResultadoPasoCombo {
  const paso = combo.pasos[combo.idx];
  if (!paso) return { estado: 'listo', acciones: [] };
  const texto = norm(entrada.texto || entrada.textoOriginal);

  if (['atras', 'volver', 'regresar', 'corregir'].includes(texto)) return atras(combo, plantillas);

  if (entrada.id?.startsWith('ped_cb_pag_')) {
    combo.pagina = Math.max(1, parseInt(entrada.id.replace('ped_cb_pag_', ''), 10) || 1);
    return { estado: 'seguir', acciones: accionesPasoCombo(combo, plantillas) };
  }

  // Candidatos: los sabores (si se está eligiendo sabor) o las opciones del paso
  const esSabor = !!combo.saborDe;
  const candidatos: { id: string; nombre: string }[] = esSabor ? saboresVisibles(combo, combo.saborDe!.opcion) : opcionesVisibles(combo, paso);
  const prefijo = esSabor ? 'ped_cbs_' : 'ped_cb_';
  let elegido = entrada.id?.startsWith(prefijo) && !entrada.id.startsWith('ped_cb_pag_') ? candidatos.find((c) => `${prefijo}${c.id}` === entrada.id) : undefined;
  if (!elegido && texto) {
    elegido = candidatos.find((c) => norm(c.nombre) === texto);
    if (!elegido && texto.length >= 2) {
      const parecidos = candidatos.filter((c) => norm(c.nombre).includes(texto));
      if (parecidos.length === 1) elegido = parecidos[0];
      // Varias coinciden: se muestran solo esas para que toque una
      if (parecidos.length > 1 && !esSabor) {
        return { estado: 'seguir', acciones: accionesPasoCombo(combo, plantillas, parecidos as OpcionComboBot[]) };
      }
    }
  }
  if (!elegido) {
    return {
      estado: 'seguir',
      acciones: [{ tipo: 'enviarTexto', texto: TEXTOS_COMBO.noEncontre() }, ...accionesPasoCombo(combo, plantillas)],
    };
  }

  const registrar = (e: EleccionComboBot) => combo.elecciones.push(e);

  if (esSabor) {
    const op = combo.saborDe!.opcion;
    registrar({ parteId: paso.parteId, productoId: op.id, saborId: elegido.id, nombre: `${op.nombre} (${elegido.nombre})` });
    combo.saborDe = undefined;
    paso.hechos += 1;
    return avanzarSiCompleto(combo, plantillas);
  }

  const opcion = elegido as OpcionComboBot;
  if (paso.tipo === 'ALTERNATIVA') {
    // Plan B: la alternativa trae su cantidad (× combos); sin sabor se reparte sola, con sabor cada unidad lo pide
    paso.alternativa = opcion;
    paso.total = (opcion.cantidad ?? 1) * combo.unidades;
    paso.hechos = 0;
    if (opcion.sabores?.length) {
      combo.saborDe = { parteId: paso.parteId, opcion };
      return { estado: 'seguir', acciones: accionesPasoCombo(combo, plantillas) };
    }
    for (let i = 0; i < paso.total; i++) registrar({ parteId: paso.parteId, productoId: opcion.id, nombre: opcion.nombre });
    paso.hechos = paso.total;
    return avanzarSiCompleto(combo, plantillas);
  }

  if (opcion.sabores?.length) {
    combo.saborDe = { parteId: paso.parteId, opcion };
    combo.pagina = 1;
    return { estado: 'seguir', acciones: accionesPasoCombo(combo, plantillas) };
  }
  registrar({ parteId: paso.parteId, productoId: opcion.id, nombre: opcion.nombre });
  paso.hechos += 1;
  return avanzarSiCompleto(combo, plantillas);
}

// ---------------------------------------------------------------------------
// Lo que viaja al servidor y al resumen
// ---------------------------------------------------------------------------

/** Mismo contrato que la carta: una entrada por unidad elegida (más las partes fijas). */
export function eleccionesParaServidor(combo: ComboEnConfiguracionBot): { parteId: string; productoId: string; saborId?: string }[] {
  return [
    ...combo.fijas.map((f) => ({ parteId: f.parteId, productoId: f.productoId })),
    ...combo.elecciones.map((e) => ({ parteId: e.parteId, productoId: e.productoId, ...(e.saborId ? { saborId: e.saborId } : {}) })),
  ];
}

/** «Club Sándwich», «Sirena x2», «Fresa (Dona)» para el resumen. */
export function detalleCombo(combo: ComboEnConfiguracionBot): string[] {
  const cuenta = new Map<string, number>();
  for (const e of combo.elecciones) cuenta.set(e.nombre, (cuenta.get(e.nombre) ?? 0) + 1);
  return [...combo.fijas.map((f) => f.nombre), ...[...cuenta].map(([nombre, n]) => (n > 1 ? `${nombre} x${n}` : nombre))];
}
