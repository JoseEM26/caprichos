import type { RolImpresora } from '@caprichos/compartido';
import type { ArchivoConfiguracion, ConfiguracionAgente } from './config';
import type { CandidataLocal } from './candidatas';
import { idGuardado } from './candidatas';
import type { IDispositivoImpresora } from './impresora/dispositivo.interface';
import { lineasDiagnostico } from './autoUsb';
import { generarPruebaEtiqueta, generarPruebaTicket } from './pruebaImpresora';

/** Lo que necesitan los comandos de terminal (todo inyectable para probarlos sin impresoras). */
export interface DepsComandos {
  listar(): Promise<CandidataLocal[]>;
  crear(c: CandidataLocal, rol: RolImpresora): IDispositivoImpresora;
  guardar(rol: RolImpresora, c: CandidataLocal): void;
  archivo: ArchivoConfiguracion;
  /** Opciones del programa (tamaño del rollo y columnas del ticket). */
  config: Pick<ConfiguracionAgente, 'etiqueta' | 'ticketColumnas'>;
  /** Vuelve a leer config.json (tras guardar una elección). */
  relear?: () => ArchivoConfiguracion;
  autoarranque?: () => Promise<boolean>;
  log: (m: string) => void;
}

export const NOMBRE_ROL: Record<RolImpresora, string> = { ETIQUETERA: 'etiquetera', TICKETERA: 'ticketera' };

/** «3» es la impresora número 3 de la lista; si no es número, busca por nombre (exacto o que lo contenga, sin mayúsculas). */
export function resolverImpresora(lista: CandidataLocal[], ref: string): CandidataLocal | { error: string } {
  const r = ref.trim();
  if (!r) return { error: 'Falta el número o el nombre de la impresora. Mira la lista con: impresoras' };
  if (/^\d+$/.test(r)) {
    const c = lista[Number(r) - 1];
    return c ?? { error: `No hay impresora número ${r}. Hay ${lista.length}: mira la lista con: impresoras` };
  }
  const q = r.toLowerCase();
  const exactas = lista.filter((c) => c.nombre.toLowerCase() === q || c.id.toLowerCase() === q);
  const parecidas = exactas.length ? exactas : lista.filter((c) => c.nombre.toLowerCase().includes(q));
  if (parecidas.length === 1) return parecidas[0];
  return {
    error: parecidas.length
      ? `"${r}" coincide con ${parecidas.length} impresoras: usa el número de la lista`
      : `No hay ninguna impresora llamada "${r}". Mira la lista con: impresoras`,
  };
}

const esError = (x: CandidataLocal | { error: string }): x is { error: string } => 'error' in x;

function rolesDe(c: CandidataLocal, forzado?: RolImpresora): RolImpresora[] {
  return forzado ? [forzado] : c.sugerido ? [c.sugerido] : ['ETIQUETERA', 'TICKETERA'];
}

async function imprimirHoja(d: DepsComandos, c: CandidataLocal, n: number, total: number, forzado?: RolImpresora): Promise<boolean> {
  const marca = `Impresora ${n} de ${total}`;
  let ok = true;
  for (const rol of rolesDe(c, forzado)) {
    try {
      const bytes =
        rol === 'ETIQUETERA'
          ? generarPruebaEtiqueta(`${n}: ${c.nombre}`, rol, d.config.etiqueta, undefined, marca)
          : generarPruebaTicket(`${n}: ${c.nombre}`, rol, d.config.ticketColumnas, undefined, marca);
      await d.crear(c, rol).escribir(bytes);
    } catch (err: any) {
      ok = false;
      d.log(`   ✖ ${n}) ${c.nombre}: ${err.message}`);
    }
  }
  return ok;
}

export async function comandoImpresoras(d: DepsComandos): Promise<CandidataLocal[]> {
  const lista = await d.listar();
  if (!lista.length) {
    d.log('No se encontró ninguna impresora real en este equipo (las virtuales PDF, OneNote, Fax y XPS no se muestran). Revisa el cable y que esté encendida.');
    return lista;
  }
  const usada = (id: string) =>
    (['ETIQUETERA', 'TICKETERA'] as RolImpresora[])
      .filter((r) => idGuardado(r === 'ETIQUETERA' ? d.archivo.etiquetera : d.archivo.ticketera, r === 'ETIQUETERA' ? d.archivo.etiqueteraId : d.archivo.ticketeraId) === id)
      .map((r) => `ES LA ${NOMBRE_ROL[r].toUpperCase()}`);
  d.log('Impresoras de este equipo (usa el número):');
  lista.forEach((c, i) => {
    const marcas = [c.sugerido ? `parece ${NOMBRE_ROL[c.sugerido]}` : '', ...usada(c.id)].filter(Boolean).join(', ');
    d.log(`  ${i + 1}) ${c.nombre}${c.detalle ? ` — ${c.detalle}` : ''}${marcas ? `  [${marcas}]` : ''}`);
  });
  d.log('Para saber cuál es cuál: probar-todas. Para elegir: usar etiquetera <número>  /  usar ticketera <número>.');
  return lista;
}

export async function comandoProbarTodas(d: DepsComandos): Promise<{ total: number; fallidas: number }> {
  const lista = await d.listar();
  if (!lista.length) {
    d.log('No hay impresoras para probar.');
    return { total: 0, fallidas: 0 };
  }
  d.log(`Imprimiendo una hoja en cada una de las ${lista.length} impresoras. Mira cuál imprime "Impresora N de ${lista.length}".`);
  let fallidas = 0;
  for (let i = 0; i < lista.length; i++) {
    d.log(`  ${i + 1}) ${lista[i].nombre}...`);
    if (!(await imprimirHoja(d, lista[i], i + 1, lista.length))) fallidas++;
  }
  d.log(fallidas ? `Terminó: ${fallidas} no imprimieron (mira los avisos de arriba).` : 'Terminó. Elige con: usar etiquetera <número>  /  usar ticketera <número>.');
  return { total: lista.length, fallidas };
}

export async function comandoProbarUna(d: DepsComandos, ref: string, rol?: RolImpresora): Promise<boolean> {
  const lista = await d.listar();
  const c = resolverImpresora(lista, ref);
  if (esError(c)) {
    d.log(`✖ ${c.error}`);
    return false;
  }
  const ok = await imprimirHoja(d, c, lista.indexOf(c) + 1, lista.length, rol);
  d.log(ok ? `✔ Hoja enviada a: ${c.nombre}` : `✖ No se pudo imprimir en: ${c.nombre}`);
  return ok;
}

export async function comandoUsar(d: DepsComandos, rolTexto: string, ref: string): Promise<boolean> {
  const t = rolTexto.trim().toLowerCase();
  const rol: RolImpresora | undefined = t === 'etiquetera' ? 'ETIQUETERA' : t === 'ticketera' ? 'TICKETERA' : undefined;
  if (!rol) {
    d.log('✖ Escribe: usar etiquetera <número|nombre>   o   usar ticketera <número|nombre>');
    return false;
  }
  const c = resolverImpresora(await d.listar(), ref);
  if (esError(c)) {
    d.log(`✖ ${c.error}`);
    return false;
  }
  d.guardar(rol, c);
  d.log(`✔ La ${NOMBRE_ROL[rol]} queda guardada: ${c.nombre}. Al encender la computadora el programa se conecta SOLO a esa. Para cambiarla, vuelve a usar este comando o Configuración > Impresión.`);
  return true;
}

export async function comandoEstado(d: DepsComandos, ruta: string): Promise<void> {
  const lista = await d.listar();
  d.log(`Vinculado a Caprichos: ${d.archivo.agenteKey ? 'SÍ' : 'NO (ejecuta: vincular)'}${d.archivo.apiUrl ? ` (${d.archivo.apiUrl})` : ''}`);
  for (const rol of ['ETIQUETERA', 'TICKETERA'] as RolImpresora[]) {
    const destino = rol === 'ETIQUETERA' ? d.archivo.etiquetera : d.archivo.ticketera;
    const id = idGuardado(destino, rol === 'ETIQUETERA' ? d.archivo.etiqueteraId : d.archivo.ticketeraId);
    if (!destino) d.log(`${NOMBRE_ROL[rol]}: NO ELEGIDA. Elige una con: usar ${NOMBRE_ROL[rol]} <número>`);
    else if (/^tcp:/i.test(destino) || lista.some((c) => c.id === id)) d.log(`${NOMBRE_ROL[rol]}: ${lista.find((c) => c.id === id)?.nombre ?? destino} (conectada)`);
    else d.log(`${NOMBRE_ROL[rol]}: Impresora guardada no encontrada: ${id}. Enciéndela o conéctala; el programa la busca solo.`);
  }
  if (d.autoarranque) d.log(`Arranque automático al encender: ${(await d.autoarranque()) ? 'ACTIVADO' : 'desactivado (activar con: autoarranque activar)'}`);
  d.log(`Configuración: ${ruta}`);
}

/** Menú numerado para quien no quiere recordar comandos (se abre al terminar «configurar»). */
export async function ejecutarMenu(
  ask: (texto: string) => Promise<string>,
  d: DepsComandos,
  ruta: string,
  extra: { alternarAutoarranque?: () => Promise<string> } = {},
): Promise<void> {
  for (;;) {
    d.log('');
    d.log('=== ¿Qué quieres hacer? ===');
    d.log('  1) Ver las impresoras de este equipo');
    d.log('  2) Probar TODAS (cada una imprime su número) y ver cuál es cuál');
    d.log('  3) Probar una sola');
    d.log('  4) Elegir la ETIQUETERA (sticker)');
    d.log('  5) Elegir la TICKETERA (voucher / ticket)');
    d.log('  6) Ver el estado');
    if (extra.alternarAutoarranque) d.log('  7) Activar / desactivar que el programa abra solo al encender la PC');
    d.log('  0) Salir');
    const op = (await ask('Número: ')).trim();
    if (op === '0' || op === '') return;
    if (op === '1') await comandoImpresoras(d);
    else if (op === '2') await comandoProbarTodas(d);
    else if (op === '3') await comandoProbarUna(d, await ask('Número o nombre de la impresora: '));
    else if (op === '4' || op === '5') {
      await comandoImpresoras(d);
      const ref = await ask('Número o nombre de la impresora a usar (Enter = cancelar): ');
      if (ref.trim() && (await comandoUsar(d, op === '4' ? 'etiquetera' : 'ticketera', ref)) && d.relear) d.archivo = d.relear();
    } else if (op === '6') await comandoEstado(d, ruta);
    else if (op === '7' && extra.alternarAutoarranque) d.log(await extra.alternarAutoarranque());
    else d.log('Opción no válida.');
  }
}

/** `diagnostico`: lista impresoras, puertos, driver y estado, y dice cuál elegiría el programa solo. */
export async function comandoDiagnostico(d: DepsComandos, ruta?: string): Promise<void> {
  const lista = await d.listar().catch((e: any) => {
    d.log(`No pude leer las impresoras del equipo: ${e?.message ?? e}`);
    return [] as CandidataLocal[];
  });
  const a = d.relear ? d.relear() : d.archivo;
  d.log('=== Diagnóstico de impresoras ===');
  lineasDiagnostico(lista, (rol) => (rol === 'ETIQUETERA' ? idGuardado(a.etiquetera, a.etiqueteraId) : idGuardado(a.ticketera, a.ticketeraId))).forEach((l) => d.log(l));
  if (ruta) d.log(`Configuración: ${ruta}`);
}
