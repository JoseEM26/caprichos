import type { EquipoMapa, MapaImpresionDatos, ReglasMapa, RolEquipoMapa, TrabajoImpresionAdmin } from '../impresionApi';
import { alternarGrupo, estadoRol, tieneMaquina, type ClavePieza, type Modalidad } from '../mapa/flujo';

/** Las tres columnas de la tabla «Qué se imprime»: cada una agrupa los tipos de pedido que representa. */
export type ColumnaId = 'LOCAL' | 'LLEVAR' | 'DELIVERY';
export const COLUMNAS: Array<{ id: ColumnaId; titulo: string; mods: Modalidad[] }> = [
  { id: 'LOCAL', titulo: 'En el local', mods: ['MESA', 'LOCAL'] },
  { id: 'LLEVAR', titulo: 'Para llevar', mods: ['LLEVAR', 'RECOGER'] },
  { id: 'DELIVERY', titulo: 'Delivery', mods: ['DELIVERY'] },
];

export type ClaveFila = 'PAGO' | 'COMANDA' | 'BEBIDA' | 'AREA' | 'GENERAL' | 'COMANDA_AREA';

export interface Fila {
  clave: ClaveFila;
  titulo: string;
  /** Una frase de qué es. */
  que: string;
  /** Pieza para «Ver ejemplo». */
  pieza: ClavePieza;
}

export const FILAS: Fila[] = [
  { clave: 'PAGO', titulo: 'Ticket o comprobante del pago', que: 'El papel de la venta. Sale siempre al cobrar.', pieza: 'PAGO' },
  { clave: 'COMANDA', titulo: 'Comanda de salón', que: 'Lista para la cocina de lo que pidió la mesa.', pieza: 'COMANDA' },
  { clave: 'BEBIDA', titulo: 'Sticker de bebida (un vaso)', que: 'Un sticker por cada bebida, para pegarlo en el vaso.', pieza: 'BEBIDA' },
  { clave: 'AREA', titulo: 'Sticker por área', que: 'Un sticker por cada área con productos (salados, postres…), sin Bebidas.', pieza: 'AREA' },
  { clave: 'GENERAL', titulo: 'Sticker general', que: 'Un sticker con todo el pedido y su total.', pieza: 'RESUMEN' },
  { clave: 'COMANDA_AREA', titulo: 'Comanda por área', que: 'Una hoja para la cocina de cada área.', pieza: 'COMANDA_AREA' },
];

/** La comanda por área no se pidió: la fila solo aparece si alguien la dejó encendida, para poder apagarla. */
export const filasVisibles = (r: ReglasMapa): Fila[] => FILAS.filter((f) => f.clave !== 'COMANDA_AREA' || r.comandaAreaActivo);

/** ¿Esa fila tiene casilla en esa columna? (la comanda de salón solo existe en el local) */
export function celdaExiste(fila: ClaveFila, col: ColumnaId): boolean {
  return fila !== 'COMANDA' || col === 'LOCAL';
}

const modsDe = (col: ColumnaId) => COLUMNAS.find((c) => c.id === col)!.mods;

export function celdaMarcada(r: ReglasMapa, fila: ClaveFila, col: ColumnaId): boolean {
  const todas = (lista: string[]) => modsDe(col).every((m) => lista.includes(m));
  switch (fila) {
    case 'PAGO':
      return true;
    case 'COMANDA':
      return r.comandaSalonActivo;
    case 'COMANDA_AREA':
      return r.comandaAreaActivo;
    case 'BEBIDA':
      return r.bebidaActivo && todas(r.bebidaModalidades);
    case 'AREA':
      return r.areaActivo && todas(r.areaModalidades);
    case 'GENERAL':
      return todas(r.generalModalidades);
  }
}

/** Qué hay que guardar al tocar una casilla (solo los campos que cambian). */
export function cambioAlTocar(r: ReglasMapa, fila: ClaveFila, col: ColumnaId): Partial<ReglasMapa> {
  const marcada = celdaMarcada(r, fila, col);
  const mods = modsDe(col);
  const lista = (actual: string[]) => (marcada ? actual.filter((m) => !mods.includes(m as Modalidad)) : alternarGrupo(actual, mods));
  switch (fila) {
    case 'PAGO':
      return {};
    case 'COMANDA':
      return { comandaSalonActivo: !marcada };
    case 'COMANDA_AREA':
      return { comandaAreaActivo: !marcada };
    case 'BEBIDA':
      return { bebidaModalidades: lista(r.bebidaModalidades), bebidaActivo: marcada ? r.bebidaActivo : true };
    case 'AREA':
      return { areaModalidades: lista(r.areaModalidades), areaActivo: marcada ? r.areaActivo : true };
    case 'GENERAL':
      return { generalModalidades: lista(r.generalModalidades) };
  }
}

export const RECOMENDADO_CAPRICHOS: ReglasMapa = {
  generalModalidades: [],
  areaModalidades: ['LLEVAR', 'RECOGER', 'DELIVERY'],
  bebidaModalidades: ['LLEVAR', 'RECOGER', 'DELIVERY'],
  bebidaActivo: true,
  areaActivo: true,
  comandaSalonActivo: true,
  comandaAreaActivo: false,
};

const TODO_APAGADO: ReglasMapa = {
  generalModalidades: [],
  areaModalidades: [],
  bebidaModalidades: [],
  bebidaActivo: false,
  areaActivo: false,
  comandaSalonActivo: false,
  comandaAreaActivo: false,
};

/** Los tres atajos de arriba de la tabla. El ticket del pago sale siempre, en los tres. */
export const ATAJOS: Array<{ id: string; titulo: string; ayuda: string; reglas: ReglasMapa }> = [
  {
    id: 'recomendado',
    titulo: 'Recomendado para Caprichos',
    ayuda: 'Ticket siempre. Comanda solo en el local. Stickers de bebida y por área solo para llevar y delivery.',
    reglas: RECOMENDADO_CAPRICHOS,
  },
  {
    id: 'ticket-comanda',
    titulo: 'Solo ticket en todos los pedidos',
    ayuda: 'Ticket siempre y comanda en el local. Ningún sticker.',
    reglas: { ...TODO_APAGADO, comandaSalonActivo: true },
  },
  {
    id: 'solo-ticket',
    titulo: 'Todo apagado excepto ticket',
    ayuda: 'Solo sale el ticket del pago. Ni comanda ni stickers.',
    reglas: TODO_APAGADO,
  },
];

const esBebidas = (nombre: string) => /^bebidas?$/i.test(nombre.trim());

/** «Sale en: …»: en qué máquina sale cada pieza hoy, según los equipos y el ruteo que calcula el servidor. */
export function fraseSaleEn(fila: ClaveFila, mapa: MapaImpresionDatos): string {
  const ruteo = (tipo: string) => mapa.ruteo.filter((x) => x.tipo === tipo);
  switch (fila) {
    case 'PAGO':
    case 'COMANDA':
      return 'Sale en: Caja (ticketera)';
    case 'GENERAL':
      return 'Sale en: Caja (etiquetera)';
    case 'BEBIDA': {
      const r = ruteo('ETIQUETA_BEBIDA')[0];
      return r && r.destinoAreaId !== null
        ? `Sale en: la PC de Bebidas (${r.destinoNombre})`
        : 'Sale en: Caja (etiquetera). Bebidas no tiene computadora';
    }
    case 'AREA': {
      const r = ruteo('ETIQUETA_AREA');
      const propias = r.filter((x) => x.destinoAreaId !== null).length;
      if (r.length === 0 || propias === 0) return 'Sale en: Caja (etiquetera). Ninguna área tiene computadora';
      return 'Sale en: la PC de cada área; el área sin computadora sale en Caja';
    }
    case 'COMANDA_AREA':
      return 'Sale en: la ticketera de cada área, o en Caja si no tiene';
  }
}

/** Avisos en rojo claro: lo que está mal armado y qué pasa por eso. */
export function avisosDeArmado(mapa: MapaImpresionDatos): string[] {
  const out: string[] = [];
  if (mapa.equipos.length === 0) {
    return ['Todavía no hay ninguna computadora vinculada: no sale nada. Usa «Agregar otra computadora».'];
  }
  const r = mapa.reglas;
  const bebidaEnUso = r.bebidaActivo && r.bebidaModalidades.length > 0;
  const bebida = mapa.ruteo.find((x) => x.tipo === 'ETIQUETA_BEBIDA');
  if (bebidaEnUso && bebida && bebida.destinoAreaId === null) {
    out.push('Bebidas no tiene computadora: los vasos están saliendo en Caja.');
  }
  const pago = mapa.ruteo.find((x) => x.tipo === 'TICKET_PAGO');
  if (pago && pago.destinoEquipoId === null) {
    out.push('Caja no tiene computadora con ticketera: no sale ningún ticket.');
  }
  const nombresAreas = mapa.areas.map((a) => a.nombre);
  if (bebidaEnUso && !nombresAreas.some(esBebidas)) {
    out.push('No existe el área «Bebidas»: los vasos salen en Caja.');
  }
  return out;
}

const NOMBRE_ROL_PC: Record<RolEquipoMapa, string> = { TICKETERA: 'tickets', ETIQUETERA: 'stickers' };

export interface LineaPC {
  rol: RolEquipoMapa;
  /** ok = lista; aviso = atención; error = no imprime; apagado = esta PC no la usa. */
  nivel: 'ok' | 'aviso' | 'error' | 'apagado';
  texto: string;
}

/** Frase clara por impresora de una PC («Lista», «No elegiste impresora de tickets»…). */
export function lineasDePC(e: EquipoMapa, nombres: Partial<Record<RolEquipoMapa, string>> = {}): LineaPC[] {
  return (['TICKETERA', 'ETIQUETERA'] as RolEquipoMapa[]).map((rol) => {
    const que = NOMBRE_ROL_PC[rol];
    if (!tieneMaquina(e, rol)) return { rol, nivel: 'apagado', texto: `No imprime ${que}` };
    if (!e.conectado) return { rol, nivel: 'error', texto: `Impresora de ${que}: esperando que se abra el programa` };
    const nombre = nombres[rol] ? ` (${nombres[rol]})` : '';
    switch (estadoRol(e, rol)) {
      case 'lista':
        return { rol, nivel: 'ok', texto: `Impresora de ${que}: lista${nombre}` };
      case 'sin_papel':
        return { rol, nivel: 'aviso', texto: `Impresora de ${que}: se acabó el papel${nombre}` };
      case 'no_configurada':
        return { rol, nivel: 'aviso', texto: `No elegiste impresora de ${que}` };
      case 'desconectada':
        return { rol, nivel: 'error', texto: `Impresora de ${que}: no aparece. ¿Está encendida y con el cable?${nombre}` };
      case 'sin_permiso':
        return { rol, nivel: 'error', texto: `Impresora de ${que}: la computadora no la deja usar` };
      case 'sin_programa':
        return { rol, nivel: 'error', texto: `Impresora de ${que}: el programa no está abierto` };
      default:
        return { rol, nivel: 'error', texto: `Impresora de ${que}: tiene un problema` };
    }
  });
}

/** Frase de estado de toda la PC, con su luz. */
export function estadoDePC(e: EquipoMapa, pendientes: number): { luz: 'verde' | 'ambar' | 'rojo'; texto: string } {
  if (!e.conectado) {
    return {
      luz: 'rojo',
      texto:
        pendientes > 0
          ? `El programa no está abierto en esta PC. Sus ${pendientes} papeles esperan y saldrán al abrirlo.`
          : 'El programa no está abierto en esta PC. Lo que le toque esperará y saldrá al abrirlo.',
    };
  }
  const lineas = lineasDePC(e).filter((l) => l.nivel !== 'apagado');
  if (lineas.length === 0) return { luz: 'ambar', texto: 'No elegiste ninguna impresora para esta PC.' };
  const mala = lineas.find((l) => l.nivel === 'error') ?? lineas.find((l) => l.nivel === 'aviso');
  const luz = mala?.nivel === 'error' ? 'rojo' : mala ? 'ambar' : 'verde';
  return { luz, texto: mala ? mala.texto : 'Lista para imprimir' };
}

export const NOMBRE_PIEZA_TRABAJO: Record<string, string> = {
  TICKET_PAGO: 'Ticket del pago',
  TICKET_COMANDA_SALON: 'Comanda de salón',
  TICKET_COMANDA_AREA: 'Comanda por área',
  ETIQUETA_BEBIDA: 'Sticker de bebida',
  ETIQUETA_AREA: 'Sticker por área',
  ETIQUETA_GENERAL: 'Sticker general',
};

/** Pieza del trabajo en palabras del dueño; sin pedido es una hoja de prueba. */
export function piezaDeTrabajo(t: Pick<TrabajoImpresionAdmin, 'tipo' | 'pedidoId'>): string {
  if (!t.pedidoId) return 'Hoja de prueba';
  return NOMBRE_PIEZA_TRABAJO[t.tipo] ?? 'Papel';
}

export type EstadoSimple = 'ok' | 'fallo' | 'cola';

export function estadoDeTrabajo(estado: string): { id: EstadoSimple; texto: string } {
  switch (estado) {
    case 'IMPRESO':
      return { id: 'ok', texto: 'Salió bien' };
    case 'FALLIDO':
      return { id: 'fallo', texto: 'Falló' };
    case 'VENCIDO':
      return { id: 'fallo', texto: 'Se venció' };
    case 'DESCARTADO':
      return { id: 'fallo', texto: 'Se descartó' };
    case 'IMPRIMIENDO':
      return { id: 'cola', texto: 'Imprimiendo' };
    default:
      return { id: 'cola', texto: 'En cola' };
  }
}

/** Motivo en español simple de un trabajo que no salió o espera. null si salió bien. */
export function motivoDeTrabajo(t: Pick<TrabajoImpresionAdmin, 'estado' | 'error'>, pcConectada: boolean | null): string | null {
  switch (t.estado) {
    case 'IMPRESO':
      return null;
    case 'FALLIDO':
      return t.error ? `No se pudo imprimir: ${t.error}` : 'No se pudo imprimir. Revisa papel y cable, y pulsa Reintentar.';
    case 'VENCIDO':
      return 'Esperó demasiado tiempo y ya no se imprime. Pulsa Reintentar si lo necesitas.';
    case 'DESCARTADO':
      return 'Alguien lo descartó, no se imprimió.';
    case 'IMPRIMIENDO':
      return 'Se está imprimiendo ahora.';
    default:
      return pcConectada === false ? 'Esperando: la PC no tiene el programa abierto. Saldrá al abrirlo.' : 'Esperando su turno en la computadora.';
  }
}
