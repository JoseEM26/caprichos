import { EstadoMaquinaImpresion, RolImpresora } from '@caprichos/compartido';
import { equipoAcepta, areasParaRuteo, ContextoRuteo } from './ruteo-impresion';
import { agenteConectado, estadoPorRol } from './estado-impresion';

/** Nombre del papel en palabras del dueño (para motivos y avisos). */
export const NOMBRE_TIPO_PAPEL: Record<string, string> = {
  ETIQUETA_GENERAL: 'Sticker general',
  ETIQUETA_AREA: 'Sticker de área',
  ETIQUETA_BEBIDA: 'Sticker de bebida',
  TICKET_PAGO: 'Ticket de pago',
  TICKET_CIERRE: 'Ticket de cierre de caja',
  TICKET_COMANDA_SALON: 'Comanda de salón',
  TICKET_COMANDA_AREA: 'Comanda de área',
};

export const rolDeTipo = (tipo: string): RolImpresora => (tipo.startsWith('ETIQUETA') ? 'ETIQUETERA' : 'TICKETERA');

/** Por qué ninguna computadora imprime este papel (para «Sin impresora asignada»). */
export function motivoTipoSinAsignar(tipo: string, ctx: ContextoRuteo): string {
  const papel = NOMBRE_TIPO_PAPEL[tipo] ?? 'Este papel';
  if (!ctx.equipos.length) return `No hay ninguna computadora vinculada para imprimir «${papel}».`;
  if (ctx.equipos.every((e) => !e.config.configurado)) return `Las computadoras están sin configurar: en Impresión fácil elige qué imprime cada una («${papel}»).`;
  if (ctx.equipos.every((e) => e.config.pausado || !e.config.configurado)) return `Las computadoras están en pausa: «${papel}» no sale.`;
  return `Ninguna computadora tiene activado «${papel}» en Impresión fácil.`;
}

export interface DestinoTrabajo {
  equipoId: string | null;
  equipoNombre: string | null;
  conectado: boolean;
  ultimoLatido: string | null;
  impresoraRol: RolImpresora;
  impresoraNombre: string | null;
  impresoraEstado: EstadoMaquinaImpresion['estado'] | null;
  /** Trabajo pendiente que ninguna computadora imprime según la configuración vigente. */
  sinImpresora: boolean;
  motivoSinImpresora: string | null;
  /** Frase lista para la cola: en cuál computadora espera y si está encendida. */
  textoEspera: string;
}

export interface DkLite {
  id: bigint;
  nombre: string;
  ultimo_latido?: Date | null;
  latido_impresora?: string | null;
  latido_detalle?: string | null;
}

const hhmm = (d: Date) => d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima' });

/** Frase corta de conexión: «conectada hace 12 s» / «sin conexión desde las 04:40 p. m.». */
export function textoConexion(ultimo: Date | null | undefined, ahora = Date.now()): string {
  if (!ultimo) return 'nunca se ha conectado';
  const seg = Math.max(0, Math.round((ahora - new Date(ultimo).getTime()) / 1000));
  if (agenteConectado(ultimo, ahora)) return `conectada hace ${seg} s`;
  return `sin conexión desde las ${hhmm(new Date(ultimo))}`;
}

/** Destino que ve el admin de un trabajo de la cola, con la configuración vigente y el último latido. */
export function destinoDeTrabajoParaCola(
  t: { tipo: string; estado: string; pedido_id: bigint | null; area_id: bigint | null; payload: any; destino_equipo_id: bigint | null; device_key_id: bigint | null },
  ctx: ContextoRuteo,
  claves: Map<string, DkLite>,
  ahora = Date.now(),
): DestinoTrabajo {
  const rol = rolDeTipo(t.tipo);
  const id = t.destino_equipo_id ?? t.device_key_id;
  const dk = id !== null && id !== undefined ? claves.get(String(id)) : undefined;
  const eq = t.destino_equipo_id !== null ? ctx.equipos.find((e) => e.id === t.destino_equipo_id) : undefined;
  const pendiente = t.estado === 'PENDIENTE' && t.pedido_id !== null;
  const acepta = eq
    ? equipoAcepta(eq.config, t.tipo, areasParaRuteo(t.tipo, t.area_id, ctx.areaBebidasId, t.payload?.areaId), t.payload?.categoriaId ?? null, t.payload?.modalidadFiltro ?? null)
    : false;
  const sinImpresora = pendiente && !acepta;
  const papel = NOMBRE_TIPO_PAPEL[t.tipo] ?? 'Este papel';
  const motivoSinImpresora = !sinImpresora
    ? null
    : eq && dk
      ? `La computadora «${dk.nombre}» ya no tiene activado «${papel}» y ninguna otra lo imprime.`
      : motivoTipoSinAsignar(t.tipo, ctx);
  const maq = dk ? estadoPorRol(dk, ahora)[rol] : null;
  const conectado = dk ? agenteConectado(dk.ultimo_latido, ahora) : false;
  const impresora = maq && maq.estado !== 'sin_programa' && maq.estado !== 'no_configurada' ? (maq.impresoraNombre ?? null) : null;
  const queMaquina = rol === 'ETIQUETERA' ? 'etiquetera' : 'ticketera';
  let textoEspera: string;
  if (sinImpresora) textoEspera = `Sin impresora asignada: ${motivoSinImpresora}`;
  else if (!dk) textoEspera = 'Computadora no identificada.';
  else if (!conectado) textoEspera = `Esperando en la computadora «${dk.nombre}», que está apagada o sin el programa (${textoConexion(dk.ultimo_latido, ahora)}). Saldrá al abrirlo.`;
  else if (maq && !maq.conectada) textoEspera = `Esperando en la computadora «${dk.nombre}» (conectada), pero su ${queMaquina} no está lista: ${maq.motivo ?? 'revísala'}.`;
  else textoEspera = `Esperando su turno en la computadora «${dk.nombre}» (${textoConexion(dk.ultimo_latido, ahora)}).`;
  return {
    equipoId: id !== null && id !== undefined ? String(id) : null,
    equipoNombre: dk?.nombre ?? null,
    conectado,
    ultimoLatido: dk?.ultimo_latido ? new Date(dk.ultimo_latido).toISOString() : null,
    impresoraRol: rol,
    impresoraNombre: impresora,
    impresoraEstado: maq?.estado ?? null,
    sinImpresora,
    motivoSinImpresora,
    textoEspera,
  };
}
