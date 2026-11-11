import type { RolImpresora } from '@caprichos/compartido';
import type { ArchivoConfiguracion } from './config';
import { VERSION_NUMERO } from './config';
import type { CandidataLocal } from './candidatas';
import { idGuardado } from './candidatas';
import { mismaRuta, rutaRegistrada } from './autoarranque';
import type { OpcionesAutoarranque } from './autoarranque';
import { leerEstado, pidEnMarcha } from './segundoPlano';
import type { VivoFn } from './segundoPlano';
import type { CopiaPrograma } from './copias';

/** Todo inyectable: los tests no tocan el registro, la red ni las impresoras reales. */
export interface DepsEstado extends OpcionesAutoarranque {
  archivo: ArchivoConfiguracion;
  dir: string;
  vivo?: VivoFn;
  listar(): Promise<CandidataLocal[]>;
  /** Impresoras por red (tcp://ip:9100): abre el puerto, no imprime. */
  verificarRed(destino: string): Promise<{ ok: boolean; detalle?: string }>;
  /** Última versión publicada (GET ligero, sin llave). Lanza si no hay conexión. */
  consultarVersion(apiUrl: string): Promise<string | undefined>;
  /** Otras copias del programa corriendo (ver copias.ts). Opcional: si falta, el informe no habla de copias. */
  copias?(): Promise<CopiaPrograma[]>;
}

/** Última versión publicada: GET ligero a la API, con tiempo máximo corto. Lanza si no hay red. */
export async function consultarUltimaVersion(apiUrl: string, ms = 4000, f: typeof fetch = fetch): Promise<string | undefined> {
  const res = await f(`${apiUrl.replace(/\/+$/, '')}/api/agente-impresion/version`, { signal: AbortSignal.timeout(ms) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return ((await res.json()) as any)?.publicada?.version ?? undefined;
}

export interface InformeEstado {
  version: string;
  versionPublicada?: string;
  hayVersionNueva: boolean;
  autoinicio: { aplica: boolean; ok: boolean; desactivado: boolean; registrado: boolean; rutaRegistrada?: string; rutaActual?: string };
  vinculado: { ok: boolean; apiUrl?: string };
  conexion: { ok: boolean; error?: string; ultimoLatido?: string };
  impresoras: { rol: RolImpresora; configurada: boolean; destino?: string; nombre?: string; ok: boolean; detalle?: string }[];
  instancia: { corriendo: boolean; pid?: number };
  /** Otras copias corriendo (undefined = no se pudo comprobar). Más de una = hay duplicados. */
  copias?: { cantidad: number; pids: number[] };
  ok: boolean;
}

const numero = (v?: string) => Number(/^\d+\.\d+\.(\d+)/.exec(v ?? '')?.[1] ?? NaN);
const MAL_SPOOLER = /offline|sin conexi/i;

export async function reunirEstado(d: DepsEstado): Promise<InformeEstado> {
  const plataforma = d.plataforma ?? process.platform;
  const local = leerEstado(d.dir);

  const rutaActual = d.ejecutable;
  const registrada = await rutaRegistrada(d);
  const aplica = plataforma === 'win32' && Boolean(rutaActual);
  const desactivado = Boolean(d.archivo.autoinicioDesactivado);
  const coincide = Boolean(registrada && rutaActual && mismaRuta(registrada, rutaActual, plataforma));
  const autoinicio = { aplica, ok: !aplica || desactivado || coincide, desactivado, registrado: Boolean(registrada), rutaRegistrada: registrada, rutaActual };

  const vinculado = { ok: Boolean(d.archivo.agenteKey && d.archivo.apiUrl), apiUrl: d.archivo.apiUrl };

  const conexion: InformeEstado['conexion'] = { ok: false, ultimoLatido: local?.ultimaConexionOk };
  let versionPublicada: string | undefined;
  if (!vinculado.ok) conexion.error = 'sin vincular';
  else {
    try {
      versionPublicada = await d.consultarVersion(d.archivo.apiUrl!);
      conexion.ok = !local?.necesitaVincular;
      if (local?.necesitaVincular) conexion.error = 'la llave ya no vale: hay que vincular de nuevo';
    } catch (e: any) {
      conexion.error = `no se pudo contactar con el sistema (${e?.message ?? e})`;
    }
  }

  const lista = await d.listar().catch(() => [] as CandidataLocal[]);
  const impresoras: InformeEstado['impresoras'] = [];
  for (const rol of ['ETIQUETERA', 'TICKETERA'] as RolImpresora[]) {
    const destino = rol === 'ETIQUETERA' ? d.archivo.etiquetera : d.archivo.ticketera;
    if (!destino) {
      impresoras.push({ rol, configurada: false, ok: true, detalle: 'sin elegir' });
      continue;
    }
    if (/^tcp:/i.test(destino)) {
      const r = await d.verificarRed(destino).catch((e: any) => ({ ok: false, detalle: String(e?.message ?? e) }));
      impresoras.push({ rol, configurada: true, destino, nombre: destino, ok: r.ok, detalle: r.ok ? 'responde por red' : (r.detalle ?? 'no responde por red') });
      continue;
    }
    const id = idGuardado(destino, rol === 'ETIQUETERA' ? d.archivo.etiqueteraId : d.archivo.ticketeraId);
    const c = lista.find((x) => x.id === id);
    if (!c) impresoras.push({ rol, configurada: true, destino, nombre: destino, ok: false, detalle: 'el equipo no la ve instalada; enciéndela o revisa el cable/controlador' });
    else if (MAL_SPOOLER.test(c.estadoSpooler ?? '')) impresoras.push({ rol, configurada: true, destino, nombre: c.nombre, ok: false, detalle: `el equipo la ve ${c.estadoSpooler}` });
    else impresoras.push({ rol, configurada: true, destino, nombre: c.nombre, ok: true, detalle: 'instalada y en línea' });
  }

  const pid = pidEnMarcha(d.dir, d.vivo);
  const instancia = { corriendo: Boolean(pid), pid };
  const otras = await d.copias?.().catch(() => undefined);
  const copias = otras ? { cantidad: otras.length, pids: otras.map((c) => c.pid) } : undefined;
  const hayVersionNueva = numero(versionPublicada) > (numero(VERSION_NUMERO) || 0);
  const ok = autoinicio.ok && vinculado.ok && conexion.ok && impresoras.every((i) => i.ok) && impresoras.some((i) => i.configurada) && instancia.corriendo && (copias?.cantidad ?? 0) <= 1;
  return { version: VERSION_NUMERO, versionPublicada, hayVersionNueva, autoinicio, vinculado, conexion, impresoras, instancia, copias, ok };
}

const m = (ok: boolean) => (ok ? '✔' : '✘');

export function formatearEstado(e: InformeEstado): string[] {
  const a = e.autoinicio;
  const l = [
    `${m(a.ok)} Iniciar con Windows: ${
      !a.aplica ? 'no aplica en este sistema (en Linux se usa systemd o el autoarranque del escritorio)'
      : a.desactivado ? 'desactivado por ti (activar con: autoinicio activar)'
      : a.ok ? 'registrado' : a.registrado ? `registrado con otra ruta (${a.rutaRegistrada}); se corrige al abrir el programa o con: autoinicio activar` : 'NO registrado (se registra al abrir el programa, o con: autoinicio activar)'
    }`,
    `${m(e.vinculado.ok)} Vinculado con Caprichos: ${e.vinculado.ok ? `sí (${e.vinculado.apiUrl})` : 'no (ejecuta: vincular)'}`,
    `${m(e.conexion.ok)} Conexión con el sistema: ${e.conexion.ok ? 'conectado' : e.conexion.error}${e.conexion.ultimoLatido ? ` · último latido ${e.conexion.ultimoLatido}` : ''}`,
    `${m(!e.hayVersionNueva)} Versión ${e.version}${e.hayVersionNueva ? ` (hay una nueva: ${e.versionPublicada}; descárgala en Configuración › Impresión)` : e.versionPublicada ? ' (al día)' : ''}`,
  ];
  for (const i of e.impresoras) {
    const n = i.rol === 'TICKETERA' ? 'Ticketera' : 'Etiquetera';
    l.push(i.configurada ? `${m(i.ok)} ${n}: ${i.nombre} · ${i.detalle}` : `- ${n}: sin elegir (usa: usar ${n.toLowerCase()} <número>)`);
  }
  l.push(`${m(e.instancia.corriendo)} Programa en marcha: ${e.instancia.corriendo ? `sí (pid ${e.instancia.pid}, una sola instancia)` : 'no está corriendo; ábrelo o reinicia la PC'}`);
  if (e.copias) {
    l.push(e.copias.cantidad > 1
      ? `✘ Copias corriendo: ${e.copias.cantidad} (pid ${e.copias.pids.join(', ')}). Hay ${e.copias.cantidad} copias: usa --detener-todo y vuelve a abrir el programa`
      : `✔ Copias corriendo: ${e.copias.cantidad}`);
  }
  l.push(e.ok ? 'Todo en orden.' : 'Hay algo por revisar (ver ✘).');
  return l;
}
