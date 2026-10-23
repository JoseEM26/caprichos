import { useState, useEffect, type ChangeEvent, type DragEvent } from 'react';
import { api, clienteFetch } from '../../comun/api';
import { Cargando } from '../../comun/Cargando';
import { EstadoError } from '../../comun/EstadoError';
import { Confirmar } from '../../comun/Confirmar';
import { normalizarUrlArchivo } from './paletas-constantes';

interface FotoDestacada {
  id: string;
  url: string;
  pie?: string;
  orden?: number;
}

interface DestacadaAdmin {
  id: string;
  titulo: string;
  orden: number;
  activo: boolean;
  archivada: boolean;
  portada_url: string | null;
  fotos: FotoDestacada[];
  esNueva?: boolean;
}

interface ConfirmacionActiva {
  titulo: string;
  mensaje: string;
  accion: () => void | Promise<void>;
}

function extraerPieDeUrl(url?: string | null): string {
  if (!url) return '';
  const idx = url.indexOf('#');
  if (idx < 0) return '';
  const params = new URLSearchParams(url.slice(idx + 1));
  return params.get('pie') || '';
}

function extraerOffDeUrl(url?: string | null): boolean {
  if (!url) return false;
  const idx = url.indexOf('#');
  if (idx < 0) return false;
  const params = new URLSearchParams(url.slice(idx + 1));
  return params.get('off') === '1';
}

function extraerAutoPortadaDeUrl(url?: string | null): boolean {
  if (!url) return false;
  const idx = url.indexOf('#');
  if (idx < 0) return false;
  const params = new URLSearchParams(url.slice(idx + 1));
  return params.get('auto') === '1';
}

function limpiarHashDeUrl(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('#')) return null;
  if (extraerAutoPortadaDeUrl(url)) return null;
  const idx = url.indexOf('#');
  const limpia = idx >= 0 ? url.slice(0, idx) : url;
  return limpia || null;
}

function codificarUrlFoto(url: string, pie: string, idx: number): string {
  const base = limpiarHashDeUrl(url) || url;
  const params = new URLSearchParams();
  params.set('idx', String(idx));
  if (pie) params.set('pie', pie);
  return `${base}#${params.toString()}`;
}

function codificarUrlPortada(
  portadaUrl: string | null,
  primeraFotoUrl: string | undefined,
  activo: boolean,
): string | null {
  const base = limpiarHashDeUrl(portadaUrl);
  if (activo !== false) {
    return base;
  }
  if (base) {
    return `${base}#off=1`;
  }
  const fallback = limpiarHashDeUrl(primeraFotoUrl || null);
  if (fallback) {
    return `${fallback}#off=1&auto=1`;
  }
  return null;
}

const EJEMPLOS_FOTOS_SEMILLA: string[][] = [
  [
    '/archivos/publico/seed/dona_chocolate_blanco.webp',
    '/archivos/publico/seed/galleta.webp',
    '/archivos/publico/seed/duo_irresistible.webp',
  ],
  [
    '/archivos/publico/seed/club_sandwich.webp',
    '/archivos/publico/seed/parrillero.webp',
    '/archivos/publico/seed/caprisabroso.webp',
  ],
  [
    '/archivos/publico/seed/iced_latte_coffee.webp',
    '/archivos/publico/seed/capuccino.webp',
    '/archivos/publico/seed/frappe_cafe.webp',
  ],
  [
    '/archivos/publico/seed/frappe_oreo.webp',
    '/archivos/publico/seed/frappe_maracuya.webp',
    '/archivos/publico/seed/iced_berry.webp',
  ],
  [
    '/archivos/publico/seed/waffle_nutella.webp',
    '/archivos/publico/seed/carrot_cake_tajada.webp',
    '/archivos/publico/seed/keke_marmoleado_tajada.webp',
  ],
];

const EJEMPLOS_PIES = [
  'Foto de ejemplo',
  'Foto de ejemplo: cámbiala por la tuya',
  'Foto de ejemplo',
];

async function subirArchivoImagen(file: File): Promise<string> {
  try {
    const fd = new FormData();
    fd.append('archivo', file);
    const res = await clienteFetch<{ id: string; url: string }>('/admin/archivos', {
      method: 'POST',
      body: fd,
    });
    if (res?.url) {
      return normalizarUrlArchivo(res.url) || res.url;
    }
  } catch {
    // Respaldo con DataURL si falla la subida o en entorno de pruebas
  }
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => resolve((ev.target?.result as string) || '');
    reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
    reader.readAsDataURL(file);
  });
}

export function DestacadasView() {
  const [destacadas, setDestacadas] = useState<DestacadaAdmin[]>([]);
  const [eliminadasIds, setEliminadasIds] = useState<string[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selId, setSelId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string>('');
  const [dirty, setDirty] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  // Visor administrativo (isHlv en Admin.dc.html)
  const [visor, setVisor] = useState<{ id: string; i: number; play: boolean } | null>(null);

  // Diálogo único de confirmación Sí / No igual que ask() en Admin.dc.html
  const [confirmacion, setConfirmacion] = useState<ConfirmacionActiva | null>(null);
  const [guardandoAccion, setGuardandoAccion] = useState(false);

  const cargarDatos = async () => {
    setCargando(true);
    setError(null);
    try {
      const data = await api.get<any[]>('/admin/contenido/destacadas');
      const mapeadas: DestacadaAdmin[] = data.map((d) => {
        const rawPortada = normalizarUrlArchivo(d.portada_url);
        const activo =
          d.activo !== undefined ? Boolean(d.activo) : !extraerOffDeUrl(d.portada_url);
        return {
          id: String(d.id),
          titulo: d.titulo || '',
          orden: d.orden ?? 1,
          activo,
          archivada: Boolean(d.archivada),
          portada_url: limpiarHashDeUrl(rawPortada),
          fotos: (d.fotos || []).map((f: any, idx: number) => {
            const rawUrl = normalizarUrlArchivo(f.url) || f.url;
            return {
              id: String(f.id || `${d.id}-${idx + 1}`),
              url: limpiarHashDeUrl(rawUrl) || rawUrl,
              pie: f.pie !== undefined ? String(f.pie) : extraerPieDeUrl(f.url),
              orden: f.orden ?? idx + 1,
            };
          }),
        };
      });
      setDestacadas(mapeadas);
      setEliminadasIds([]);
    } catch (err: any) {
      setError(err?.message || 'Error al cargar las historias destacadas');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const pedirConfirmacion = (
    titulo: string,
    msg: string,
    accion: () => void | Promise<void>,
  ) => {
    setConfirmacion({ titulo, mensaje: msg, accion });
  };

  const actualizarSeleccionada = (parcial: Partial<DestacadaAdmin>) => {
    if (!selId) return;
    setDestacadas((prev) =>
      prev.map((d) => (d.id === selId ? { ...d, ...parcial } : d)),
    );
    setDirty(true);
    setMensaje(null);
  };

  const hlLive = destacadas.filter((d) => !d.archivada);
  const hlArch = destacadas.filter((d) => d.archivada);
  const hlVis = destacadas.filter(
    (d) => !d.archivada && d.activo !== false && d.fotos.length > 0,
  );
  const seleccionada = destacadas.find((d) => d.id === selId && !d.archivada) || null;

  const obtenerPortadaEfectiva = (d: DestacadaAdmin): string => {
    return d.portada_url || d.fotos[0]?.url || '';
  };

  // Resumen exacto de Admin.dc.html línea 5711
  const desactivadosCount = hlLive.filter((h) => h.activo === false).length;
  const sinFotosActivosCount = hlLive.filter(
    (h) => h.activo !== false && h.fotos.length === 0,
  ).length;
  const hlSummary =
    `${hlLive.length}${hlLive.length === 1 ? ' círculo' : ' círculos'} · ${hlVis.length} visibles en la carta` +
    (desactivadosCount ? ` · ${desactivadosCount} desactivados` : '') +
    (sinFotosActivosCount ? ` · ${sinFotosActivosCount} sin fotos (no se ven)` : '') +
    (hlArch.length ? ` · ${hlArch.length} archivados` : '');

  const hlHasNoPhotos = hlLive.length > 0 && hlVis.length === 0;

  // --- Acciones sobre círculos ---
  const crearNuevaDestacada = () => {
    const maxNum = Math.max(
      0,
      ...destacadas.map((h) => parseInt(String(h.id).replace(/\D/g, ''), 10) || 0),
    );
    const nuevoId = `H-${maxNum + 1}`;
    const nueva: DestacadaAdmin = {
      id: nuevoId,
      titulo: 'Nueva destacada',
      orden: 1,
      activo: true,
      archivada: false,
      portada_url: null,
      fotos: [],
      esNueva: true,
    };
    setDestacadas([nueva, ...destacadas]);
    setSelId(nuevoId);
    setDirty(true);
    setMensaje(null);
  };

  const cambiarPortada = async (e: ChangeEvent<HTMLInputElement>) => {
    if (!seleccionada) return;
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const url = await subirArchivoImagen(file);
    if (url) {
      actualizarSeleccionada({ portada_url: url });
    }
  };

  const quitarPortada = () => {
    if (!seleccionada) return;
    pedirConfirmacion(
      '¿Quitar la foto del círculo?',
      'Se usará la primera imagen de la destacada.',
      () => {
        actualizarSeleccionada({ portada_url: null });
      },
    );
  };

  const agregarFotos = async (e: ChangeEvent<HTMLInputElement>) => {
    if (!seleccionada) return;
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    e.target.value = '';
    const subidas: FotoDestacada[] = [];
    for (let i = 0; i < files.length; i++) {
      const url = await subirArchivoImagen(files[i]);
      if (url) {
        subidas.push({
          id: `foto-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
          url,
          pie: '',
          orden: seleccionada.fotos.length + i + 1,
        });
      }
    }
    if (subidas.length > 0) {
      actualizarSeleccionada({ fotos: [...seleccionada.fotos, ...subidas] });
    }
  };

  const reemplazarFoto = async (fotoIdx: number, e: ChangeEvent<HTMLInputElement>) => {
    if (!seleccionada) return;
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const url = await subirArchivoImagen(file);
    if (url) {
      const nuevas = seleccionada.fotos.map((f, j) =>
        j === fotoIdx ? { ...f, url } : f,
      );
      actualizarSeleccionada({ fotos: nuevas });
    }
  };

  const moverFoto = (fotoIdx: number, dir: -1 | 1) => {
    if (!seleccionada) return;
    const targetIdx = fotoIdx + dir;
    if (targetIdx < 0 || targetIdx >= seleccionada.fotos.length) return;
    const copia = [...seleccionada.fotos];
    const temp = copia[fotoIdx];
    copia[fotoIdx] = copia[targetIdx];
    copia[targetIdx] = temp;
    actualizarSeleccionada({ fotos: copia });
  };

  const cambiarPieFoto = (fotoIdx: number, pie: string) => {
    if (!seleccionada) return;
    const copia = seleccionada.fotos.map((f, j) =>
      j === fotoIdx ? { ...f, pie } : f,
    );
    actualizarSeleccionada({ fotos: copia });
  };

  const hacerFotoPortada = (url: string) => {
    if (!seleccionada) return;
    actualizarSeleccionada({ portada_url: url });
  };

  const quitarFoto = (fotoIdx: number) => {
    if (!seleccionada) return;
    pedirConfirmacion(
      `¿Quitar la imagen ${fotoIdx + 1}?`,
      'Deja de verse en esta destacada cuando publiques.',
      () => {
        const copia = seleccionada.fotos.filter((_, i) => i !== fotoIdx);
        actualizarSeleccionada({ fotos: copia });
      },
    );
  };

  const toggleActiva = () => {
    if (!seleccionada) return;
    const estabaOff = seleccionada.activo === false;
    pedirConfirmacion(
      estabaOff ? '¿Activar esta destacada?' : '¿Desactivar esta destacada?',
      estabaOff
        ? 'Vuelve a verse en la carta cuando publiques.'
        : 'Deja de verse en la carta cuando publiques. No se elimina.',
      () => {
        actualizarSeleccionada({ activo: estabaOff });
      },
    );
  };

  const moverCirculo = (dir: -1 | 1) => {
    if (!seleccionada) return;
    const l = destacadas.slice();
    const i = l.findIndex((h) => h.id === seleccionada.id);
    let j = i + dir;
    while (j >= 0 && j < l.length && l[j].archivada) {
      j += dir;
    }
    if (i < 0 || j < 0 || j >= l.length) return;
    const temp = l[i];
    l[i] = l[j];
    l[j] = temp;
    setDestacadas(l);
    setDirty(true);
    setMensaje(null);
  };

  const duplicarSeleccionada = () => {
    if (!seleccionada) return;
    const maxNum = Math.max(
      0,
      ...destacadas.map((h) => parseInt(String(h.id).replace(/\D/g, ''), 10) || 0),
    );
    const nuevoId = `H-${maxNum + 1}`;
    const copia: DestacadaAdmin = {
      ...seleccionada,
      id: nuevoId,
      titulo: `${seleccionada.titulo} (copia)`,
      activo: false,
      fotos: seleccionada.fotos.map((f, idx) => ({
        ...f,
        id: `${nuevoId}-f-${idx + 1}`,
      })),
      esNueva: true,
    };
    const l = destacadas.slice();
    const pos = l.findIndex((h) => h.id === seleccionada.id);
    l.splice(pos + 1, 0, copia);
    setDestacadas(l);
    setSelId(nuevoId);
    setDirty(true);
    setMensaje('Se duplicó: la copia quedó desactivada para que la edites.');
  };

  const quitarTodasLasImagenes = () => {
    if (!seleccionada) return;
    pedirConfirmacion(
      `¿Quitar todas las imágenes de «${seleccionada.titulo}»?`,
      'El círculo queda sin fotos y no se verá en la carta hasta que subas otras.',
      () => {
        actualizarSeleccionada({ fotos: [] });
      },
    );
  };

  const archivarSeleccionada = () => {
    if (!seleccionada) return;
    pedirConfirmacion(
      `¿Archivar «${seleccionada.titulo}»?`,
      'Deja de verse en la carta y sale de esta lista. Queda en «Archivadas» y se puede restaurar cuando quieras.',
      () => {
        setDestacadas((prev) =>
          prev.map((h) =>
            h.id === seleccionada.id ? { ...h, archivada: true, activo: false } : h,
          ),
        );
        setSelId(null);
        setDirty(true);
        setMensaje('Archivada. La encuentras abajo, en «Archivadas».');
      },
    );
  };

  const eliminarDestacada = (d: DestacadaAdmin, desdeArchivadas = false) => {
    pedirConfirmacion(
      `¿Eliminar «${d.titulo}» para siempre?`,
      desdeArchivadas
        ? 'Se borran el círculo y sus imágenes. No se puede deshacer.'
        : `Se borran el círculo y sus ${d.fotos.length} imágenes. No se puede deshacer. Si dudas, mejor archívala.`,
      () => {
        setDestacadas((prev) => prev.filter((x) => x.id !== d.id));
        if (!d.esNueva) {
          setEliminadasIds((prev) => [...prev, d.id]);
        }
        if (selId === d.id) setSelId(null);
        setDirty(true);
        setMensaje('Eliminada.');
      },
    );
  };

  const restaurarArchivada = (a: DestacadaAdmin) => {
    pedirConfirmacion(
      `¿Restaurar «${a.titulo}»?`,
      'Vuelve a la lista, desactivada. Actívala cuando quieras que se vea en la carta.',
      () => {
        setDestacadas((prev) =>
          prev.map((x) =>
            x.id === a.id ? { ...x, archivada: false, activo: false } : x,
          ),
        );
        setDirty(true);
        setMensaje('Restaurada (desactivada).');
      },
    );
  };

  const cargarEjemplos = () => {
    pedirConfirmacion(
      '¿Llenar los círculos con fotos de ejemplo?',
      'Solo para que pruebes el visor: se usan fotos de productos. Cámbialas por las fotos de tus clientes, local y equipo antes de publicar.',
      () => {
        setDestacadas((prev) =>
          prev.map((h, i) => {
            if (h.fotos.length > 0) return h;
            const urls = EJEMPLOS_FOTOS_SEMILLA[i % EJEMPLOS_FOTOS_SEMILLA.length];
            return {
              ...h,
              fotos: urls.map((u, j) => ({
                id: `ej-${h.id}-${j + 1}`,
                url: u,
                pie: EJEMPLOS_PIES[j],
                orden: j + 1,
              })),
            };
          }),
        );
        setDirty(true);
        setMensaje('Se cargaron fotos de ejemplo. Toca «Ver como cliente».');
      },
    );
  };

  const ejecutarPublicar = () => {
    pedirConfirmacion(
      '¿Publicar las destacadas en la carta?',
      'Los círculos de la carta mostrarán estas imágenes.',
      async () => {
        setGuardandoAccion(true);
        try {
          for (const idElim of eliminadasIds) {
            await api.delete(`/admin/contenido/destacadas/${idElim}`);
          }
          for (let idx = 0; idx < destacadas.length; idx++) {
            const d = destacadas[idx];
            const portadaConMeta = codificarUrlPortada(
              d.portada_url,
              d.fotos[0]?.url,
              d.activo,
            );
            const fotosConMeta = d.fotos.map((f, i) => ({
              url: codificarUrlFoto(f.url, f.pie || '', i),
              pie: f.pie || '',
              orden: i + 1,
            }));

            if (d.esNueva) {
              const res = await api.post<{ ok: boolean; id: string }>(
                '/admin/contenido/destacadas',
                {
                  titulo: d.titulo,
                  orden: idx + 1,
                  portada_url: portadaConMeta || undefined,
                  activo: d.activo,
                },
              );
              await api.put(`/admin/contenido/destacadas/${res.id}`, {
                titulo: d.titulo,
                orden: idx + 1,
                archivada: d.archivada,
                activo: d.activo,
                portada_url: portadaConMeta || undefined,
                fotos: fotosConMeta,
              });
            } else {
              await api.put(`/admin/contenido/destacadas/${d.id}`, {
                titulo: d.titulo,
                orden: idx + 1,
                archivada: d.archivada,
                activo: d.activo,
                portada_url: portadaConMeta || undefined,
                fotos: fotosConMeta,
              });
            }
          }
          await api.post('/admin/contenido/destacadas/publicar', {});
          await cargarDatos();
          setDirty(false);
          setConfirmacion(null);
          setMensaje('Publicado en la carta.');
        } catch (err: any) {
          setConfirmacion(null);
          setMensaje(
            err?.message ||
              'No se pudo guardar: el navegador no tiene espacio (usa menos imágenes o más livianas).',
          );
        } finally {
          setGuardandoAccion(false);
        }
      },
    );
  };

  const ejecutarDescartar = () => {
    pedirConfirmacion(
      '¿Descartar los cambios sin publicar?',
      'Vuelve lo último que se publicó.',
      async () => {
        setGuardandoAccion(true);
        try {
          await cargarDatos();
          setDirty(false);
          setSelId(null);
          setMensaje(null);
          setConfirmacion(null);
        } finally {
          setGuardandoAccion(false);
        }
      },
    );
  };

  // --- Drag & drop de círculos ---
  const onDragStartCirculo = (e: DragEvent<HTMLDivElement>, id: string) => {
    try {
      e.dataTransfer.setData('text/plain', id);
    } catch {
      // ignorar
    }
    setDragId(id);
  };

  const onDropCirculo = (e: DragEvent<HTMLDivElement>, targetId: string) => {
    e.preventDefault();
    const from = destacadas.findIndex((x) => x.id === dragId);
    const to = destacadas.findIndex((x) => x.id === targetId);
    setDragId('');
    if (from >= 0 && to >= 0 && from !== to) {
      const l = destacadas.slice();
      const [it] = l.splice(from, 1);
      l.splice(to, 0, it);
      setDestacadas(l);
      setDirty(true);
      setMensaje(null);
    }
  };

  // --- Visor de destacadas (hlvOpen / hlvStep / hlvAuto de Admin.dc.html) ---
  const abrirVisor = (id?: string) => {
    const h = destacadas.find((x) => x.id === id);
    if (!h || h.fotos.length === 0) {
      setMensaje('Ese círculo todavía no tiene imágenes: agrégalas para poder verlo.');
      return;
    }
    setVisor({ id: h.id, i: 0, play: false });
    setMensaje(null);
  };

  const hlvH = visor ? destacadas.find((h) => h.id === visor.id) || null : null;
  const hlvList = hlvH ? hlvH.fotos : [];
  const hlvI = visor ? Math.min(visor.i, Math.max(0, hlvList.length - 1)) : 0;
  const hlvX = hlvList[hlvI] || null;

  const hlvStep = (d: number) => {
    setVisor((z) => {
      if (!z) return null;
      const h = destacadas.find((x) => x.id === z.id);
      const n = h ? h.fotos.length : 0;
      const i = z.i + d;
      const vis = destacadas.filter(
        (x) => !x.archivada && x.activo !== false && x.fotos.length > 0,
      );
      if (i < 0) {
        const k = vis.findIndex((x) => x.id === z.id);
        const pv = vis[k - 1];
        return pv ? { id: pv.id, i: 0, play: z.play } : { ...z, i: 0 };
      }
      if (i >= n) {
        const k = vis.findIndex((x) => x.id === z.id);
        const nx = vis[k + 1];
        return nx ? { id: nx.id, i: 0, play: z.play } : { ...z, play: false };
      }
      return { ...z, i };
    });
  };

  useEffect(() => {
    if (!visor || !visor.play) return;
    const timer = window.setTimeout(() => {
      hlvStep(1);
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [visor, destacadas]);

  if (cargando) return <Cargando mensaje="Cargando destacadas de la carta..." />;
  if (error) return <EstadoError mensaje={error} alReintentar={cargarDatos} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Texto explicativo literal del mockup (línea 2020) */}
      <div style={{ fontSize: 13, lineHeight: '19px', color: 'var(--cp-soft)' }}>
        Son los círculos "Momentos Caprichos" de la carta. Al tocar uno, el cliente ve sus fotos como en las historias de Instagram: clientes, local, equipo, eventos. Solo muestran fotos; no llevan a ninguna parte. Toca un círculo para editarlo. Un círculo sin fotos no se ve en la carta. Los cambios llegan a la carta al pulsar "Publicar".
      </div>

      {/* Barra de botones de acción (líneas 2021-2030) */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <button
          onClick={crearNuevaDestacada}
          style={{
            minHeight: 44,
            padding: '0 14px',
            borderRadius: 12,
            border: '1.5px dashed var(--cp-navy)',
            background: 'transparent',
            color: 'var(--cp-navy)',
            fontWeight: 700,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          + Nueva destacada
        </button>
        <button
          onClick={() => abrirVisor(hlVis[0]?.id)}
          style={{
            minHeight: 44,
            padding: '0 14px',
            borderRadius: 12,
            border: '1.5px solid var(--cp-navy)',
            background: 'var(--cp-navy)',
            color: 'var(--cp-cream)',
            fontWeight: 800,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          ▶ Ver como cliente
        </button>
        {hlHasNoPhotos && (
          <button
            onClick={cargarEjemplos}
            style={{
              minHeight: 44,
              padding: '0 14px',
              borderRadius: 12,
              border: '1.5px dashed var(--cp-navy)',
              background: 'transparent',
              color: 'var(--cp-navy)',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Cargar fotos de ejemplo
          </button>
        )}
        <span style={{ flex: 1 }} />
        {dirty && (
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              borderRadius: 9999,
              padding: '4px 12px',
              background: 'var(--cp-gold)',
              color: 'var(--cp-navy)',
            }}
          >
            Cambios sin publicar
          </span>
        )}
        {mensaje && (
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--cp-soft)' }}>
            {mensaje}
          </span>
        )}
        <button
          onClick={ejecutarPublicar}
          style={{
            minHeight: 44,
            padding: '0 18px',
            border: 0,
            borderRadius: 12,
            background: 'var(--cp-orange)',
            color: 'var(--cp-navy)',
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          Publicar en la carta
        </button>
        <button
          onClick={ejecutarDescartar}
          style={{
            minHeight: 44,
            padding: '0 14px',
            border: '1.5px solid var(--cp-navy)',
            borderRadius: 12,
            background: 'transparent',
            color: 'var(--cp-navy)',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Descartar
        </button>
      </div>

      {/* Caja de círculos estilo Instagram (líneas 2031-2045) */}
      <div
        style={{
          background: 'var(--cp-cream)',
          border: '1px solid var(--cp-line)',
          borderRadius: 12,
          padding: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: '0.06em',
              color: 'var(--cp-soft)',
            }}
          >
            ASÍ SE VEN EN LA CARTA · ARRASTRA UN CÍRCULO PARA CAMBIARLO DE LUGAR
          </div>
          <div style={{ fontSize: 12, fontWeight: 700 }}>{hlSummary}</div>
        </div>
        <div
          className="noscroll"
          style={{
            display: 'flex',
            gap: 12,
            overflowX: 'auto',
            padding: '4px 2px',
          }}
        >
          {hlLive.map((c) => {
            const esSeleccionado = c.id === selId;
            const fotoPortada = obtenerPortadaEfectiva(c);
            const tieneFoto = Boolean(fotoPortada);
            const countText =
              `${c.fotos.length} ${c.fotos.length === 1 ? 'imagen' : 'imágenes'}` +
              (c.activo === false ? ' · desactivada' : '');
            const warnText =
              c.activo === false
                ? 'Oculta'
                : c.fotos.length === 0
                  ? 'Sin fotos: no se ve'
                  : '';

            return (
              <div
                key={c.id}
                draggable
                onDragStart={(e) => onDragStartCirculo(e, c.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => onDropCirculo(e, c.id)}
                onDragEnd={() => setDragId('')}
                style={{
                  flex: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  borderBottom: `3px solid ${dragId === c.id ? 'var(--cp-orange)' : 'transparent'}`,
                  paddingBottom: 2,
                }}
              >
                <button
                  onClick={() => setSelId(c.id)}
                  style={{
                    flex: 'none',
                    width: 76,
                    border: 0,
                    background: 'transparent',
                    padding: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 6,
                    color: 'var(--cp-navy)',
                    opacity: c.activo === false ? 0.45 : 1,
                    cursor: 'pointer',
                  }}
                >
                  <span
                    style={{
                      width: 68,
                      height: 68,
                      borderRadius: '50%',
                      padding: 3,
                      boxSizing: 'border-box',
                      background: esSeleccionado
                        ? 'var(--cp-navy)'
                        : 'linear-gradient(135deg, var(--cp-orange), var(--cp-rust))',
                      display: 'block',
                    }}
                  >
                    <span
                      style={{
                        width: '100%',
                        height: '100%',
                        borderRadius: '50%',
                        border: '2px solid var(--cp-cream)',
                        boxSizing: 'border-box',
                        overflow: 'hidden',
                        background: 'var(--cp-sand)',
                        color: 'var(--cp-soft)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative',
                      }}
                    >
                      {tieneFoto ? (
                        <img
                          src={fotoPortada}
                          alt=""
                          style={{
                            position: 'absolute',
                            left: 0,
                            top: 0,
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                          }}
                        />
                      ) : (
                        <svg
                          viewBox="0 0 24 24"
                          width="22"
                          height="22"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M3 8h4l2-3h6l2 3h4v11H3z" />
                          <circle cx="12" cy="13.5" r="3.5" />
                        </svg>
                      )}
                    </span>
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      lineHeight: '14px',
                      textAlign: 'center',
                    }}
                  >
                    {c.titulo || '(sin nombre)'}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--cp-soft)' }}>
                    {countText}
                  </span>
                </button>
                {warnText && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      color: 'var(--cp-rust)',
                    }}
                  >
                    {warnText}
                  </span>
                )}
                <button
                  onClick={() => abrirVisor(c.id)}
                  style={{
                    minHeight: 32,
                    padding: '0 10px',
                    borderRadius: 9999,
                    border: '1.5px solid var(--cp-navy)',
                    background: 'transparent',
                    color: 'var(--cp-navy)',
                    fontWeight: 700,
                    fontSize: 11,
                    cursor: 'pointer',
                  }}
                >
                  ▶ Ver
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Editor de la destacada seleccionada (líneas 2046-2083) */}
      {seleccionada && (
        <div
          style={{
            background: 'var(--cp-white)',
            border: '2px solid var(--cp-orange)',
            borderRadius: 12,
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div
            style={{
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 800,
              fontSize: 16,
            }}
          >
            Editar: {seleccionada.titulo}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ flex: '1 1 220px' }}>
              <label
                htmlFor="h-n"
                style={{
                  fontWeight: 700,
                  fontSize: 13,
                  display: 'block',
                  marginBottom: 4,
                }}
              >
                Nombre del círculo
              </label>
              <input
                id="h-n"
                type="text"
                value={seleccionada.titulo}
                onChange={(e) =>
                  actualizarSeleccionada({ titulo: e.target.value })
                }
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  minHeight: 44,
                  borderRadius: 10,
                  border: '1.5px solid var(--cp-line)',
                  background: 'var(--cp-white)',
                  color: 'var(--cp-navy)',
                  padding: '0 10px',
                  fontSize: 14,
                }}
              />
            </div>
          </div>

          <div>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
              Foto del círculo
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <label
                style={{
                  position: 'relative',
                  minHeight: 44,
                  padding: '0 16px',
                  boxSizing: 'border-box',
                  borderRadius: 10,
                  background: 'var(--cp-orange)',
                  color: 'var(--cp-navy)',
                  fontWeight: 800,
                  fontSize: 12,
                  display: 'flex',
                  alignItems: 'center',
                  cursor: 'pointer',
                }}
              >
                {seleccionada.portada_url ? 'Cambiar foto' : 'Subir foto'}
                <input
                  type="file"
                  accept="image/*"
                  onChange={cambiarPortada}
                  style={{ position: 'absolute', left: -9999 }}
                />
              </label>
              {seleccionada.portada_url && (
                <button
                  onClick={quitarPortada}
                  style={{
                    minHeight: 44,
                    padding: '0 12px',
                    border: '1.5px solid var(--cp-rust)',
                    borderRadius: 10,
                    background: 'transparent',
                    color: 'var(--cp-rust)',
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  Quitar foto
                </button>
              )}
            </div>
          </div>

          {/* Lista de imágenes (líneas 2053-2070) */}
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 8,
                flexWrap: 'wrap',
                marginBottom: 6,
              }}
            >
              <span style={{ fontWeight: 700, fontSize: 13 }}>
                Imágenes que ve el cliente ({seleccionada.fotos.length})
              </span>
              <label
                style={{
                  position: 'relative',
                  minHeight: 44,
                  padding: '0 16px',
                  boxSizing: 'border-box',
                  borderRadius: 10,
                  background: 'var(--cp-orange)',
                  color: 'var(--cp-navy)',
                  fontWeight: 800,
                  fontSize: 12,
                  display: 'flex',
                  alignItems: 'center',
                  cursor: 'pointer',
                }}
              >
                + Subir varias imágenes
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={agregarFotos}
                  style={{ position: 'absolute', left: -9999 }}
                />
              </label>
            </div>
            {seleccionada.fotos.length === 0 && (
              <div style={{ fontSize: 13, color: 'var(--cp-soft)' }}>
                Todavía no hay imágenes. Un círculo sin imágenes no se muestra en la carta.
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {seleccionada.fotos.map((f, fIdx) => (
                <div
                  key={f.id}
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 8,
                    alignItems: 'center',
                    border: '1px solid var(--cp-line)',
                    borderRadius: 12,
                    padding: 8,
                  }}
                >
                  <img
                    src={f.url}
                    alt=""
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 10,
                      objectFit: 'cover',
                      flex: 'none',
                    }}
                  />
                  <div style={{ flex: '1 1 180px', minWidth: 0 }}>
                    <label
                      htmlFor={`h-cap-${fIdx}`}
                      style={{ position: 'absolute', left: -9999 }}
                    >
                      Texto de la imagen {fIdx + 1}
                    </label>
                    <input
                      id={`h-cap-${fIdx}`}
                      type="text"
                      value={f.pie || ''}
                      onChange={(e) => cambiarPieFoto(fIdx, e.target.value)}
                      placeholder="Texto que acompaña la imagen (opcional)"
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        minHeight: 44,
                        borderRadius: 10,
                        border: '1.5px solid var(--cp-line)',
                        background: 'var(--cp-white)',
                        color: 'var(--cp-navy)',
                        padding: '0 10px',
                        fontSize: 14,
                      }}
                    />
                  </div>
                  <button
                    onClick={() => moverFoto(fIdx, -1)}
                    aria-label="Subir"
                    style={{
                      width: 44,
                      minHeight: 44,
                      border: '1.5px solid var(--cp-navy)',
                      borderRadius: 10,
                      background: 'transparent',
                      color: 'var(--cp-navy)',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => moverFoto(fIdx, 1)}
                    aria-label="Bajar"
                    style={{
                      width: 44,
                      minHeight: 44,
                      border: '1.5px solid var(--cp-navy)',
                      borderRadius: 10,
                      background: 'transparent',
                      color: 'var(--cp-navy)',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => hacerFotoPortada(f.url)}
                    style={{
                      minHeight: 44,
                      padding: '0 12px',
                      border: '1.5px solid var(--cp-navy)',
                      borderRadius: 10,
                      background: 'transparent',
                      color: 'var(--cp-navy)',
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    {seleccionada.portada_url && seleccionada.portada_url === f.url
                      ? '✓ Es la portada'
                      : 'Usar de portada'}
                  </button>
                  <label
                    style={{
                      position: 'relative',
                      minHeight: 44,
                      padding: '0 12px',
                      boxSizing: 'border-box',
                      border: '1.5px solid var(--cp-navy)',
                      borderRadius: 10,
                      color: 'var(--cp-navy)',
                      fontWeight: 700,
                      fontSize: 12,
                      display: 'flex',
                      alignItems: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    Cambiar foto
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => reemplazarFoto(fIdx, e)}
                      style={{ position: 'absolute', left: -9999 }}
                    />
                  </label>
                  <button
                    onClick={() => quitarFoto(fIdx)}
                    style={{
                      minHeight: 44,
                      padding: '0 12px',
                      border: '1.5px solid var(--cp-rust)',
                      borderRadius: 10,
                      background: 'transparent',
                      color: 'var(--cp-rust)',
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    Quitar
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Activar/Desactivar y mover orden (líneas 2071-2075) */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button
              onClick={toggleActiva}
              style={{
                flex: '1 1 150px',
                minHeight: 44,
                border: '1.5px solid var(--cp-navy)',
                borderRadius: 10,
                background: 'transparent',
                color: 'var(--cp-navy)',
                fontWeight: 700,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              {seleccionada.activo === false ? 'Activar' : 'Desactivar'}
            </button>
            <button
              onClick={() => moverCirculo(-1)}
              aria-label="Mover antes"
              style={{
                width: 44,
                minHeight: 44,
                border: '1.5px solid var(--cp-navy)',
                borderRadius: 10,
                background: 'transparent',
                color: 'var(--cp-navy)',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              ←
            </button>
            <button
              onClick={() => moverCirculo(1)}
              aria-label="Mover después"
              style={{
                width: 44,
                minHeight: 44,
                border: '1.5px solid var(--cp-navy)',
                borderRadius: 10,
                background: 'transparent',
                color: 'var(--cp-navy)',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              →
            </button>
          </div>

          {/* Acciones inferiores (líneas 2076-2081) */}
          <div
            style={{
              display: 'flex',
              gap: 6,
              flexWrap: 'wrap',
              borderTop: '1px solid var(--cp-line)',
              paddingTop: 10,
            }}
          >
            <button
              onClick={duplicarSeleccionada}
              style={{
                flex: '1 1 110px',
                minHeight: 44,
                border: '1.5px solid var(--cp-navy)',
                borderRadius: 10,
                background: 'transparent',
                color: 'var(--cp-navy)',
                fontWeight: 700,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              Duplicar
            </button>
            <button
              onClick={quitarTodasLasImagenes}
              style={{
                flex: '1 1 130px',
                minHeight: 44,
                border: '1.5px solid var(--cp-navy)',
                borderRadius: 10,
                background: 'transparent',
                color: 'var(--cp-navy)',
                fontWeight: 700,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              Quitar todas las imágenes
            </button>
            <button
              onClick={archivarSeleccionada}
              style={{
                flex: '1 1 110px',
                minHeight: 44,
                border: '1.5px solid var(--cp-navy)',
                borderRadius: 10,
                background: 'var(--cp-sand)',
                color: 'var(--cp-navy)',
                fontWeight: 800,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              Archivar
            </button>
            <button
              onClick={() => eliminarDestacada(seleccionada, false)}
              style={{
                flex: '1 1 110px',
                minHeight: 44,
                border: '1.5px solid var(--cp-rust)',
                borderRadius: 10,
                background: 'transparent',
                color: 'var(--cp-rust)',
                fontWeight: 800,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              Eliminar
            </button>
          </div>
        </div>
      )}

      {/* Sección Archivadas (líneas 2084-2090) */}
      {hlArch.length > 0 && (
        <div
          style={{
            background: 'var(--cp-white)',
            border: '1px solid var(--cp-line)',
            borderRadius: 12,
            padding: 14,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div style={{ fontWeight: 800 }}>Archivadas ({hlArch.length})</div>
          <div style={{ fontSize: 12, color: 'var(--cp-soft)' }}>
            No se ven en la carta ni en la lista de arriba. Puedes restaurarlas o eliminarlas para siempre.
          </div>
          {hlArch.map((a) => {
            const coverArch = obtenerPortadaEfectiva(a);
            return (
              <div
                key={a.id}
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 8,
                  alignItems: 'center',
                  border: '1px solid var(--cp-line)',
                  borderRadius: 12,
                  padding: 8,
                }}
              >
                <span
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    overflow: 'hidden',
                    background: 'var(--cp-sand)',
                    flex: 'none',
                  }}
                >
                  {coverArch && (
                    <img
                      src={coverArch}
                      alt=""
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  )}
                </span>
                <div style={{ flex: '1 1 160px', minWidth: 0 }}>
                  <div style={{ fontWeight: 700 }}>{a.titulo || '(sin nombre)'}</div>
                  <div style={{ fontSize: 12, color: 'var(--cp-soft)' }}>
                    {a.fotos.length} {a.fotos.length === 1 ? 'imagen' : 'imágenes'}
                  </div>
                </div>
                <button
                  onClick={() => restaurarArchivada(a)}
                  style={{
                    minHeight: 44,
                    padding: '0 14px',
                    border: '1.5px solid var(--cp-navy)',
                    borderRadius: 10,
                    background: 'transparent',
                    color: 'var(--cp-navy)',
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  Restaurar
                </button>
                <button
                  onClick={() => eliminarDestacada(a, true)}
                  style={{
                    minHeight: 44,
                    padding: '0 14px',
                    border: '1.5px solid var(--cp-rust)',
                    borderRadius: 10,
                    background: 'transparent',
                    color: 'var(--cp-rust)',
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  Eliminar para siempre
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Visor de la destacada (isHlv en Admin.dc.html líneas 2960-2975) */}
      {hlvH && hlvX && (
        <>
          <div
            onClick={() => setVisor(null)}
            style={{
              position: 'fixed',
              left: 0,
              right: 0,
              top: 0,
              bottom: 0,
              zIndex: 50,
              background: 'rgba(11,44,62,0.78)',
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Vista de la destacada ${hlvH.titulo}`}
            style={{
              position: 'fixed',
              zIndex: 60,
              left: '50%',
              top: '50%',
              transform: 'translate(-50%,-50%)',
              width: 'min(400px, calc(100% - 24px))',
              maxHeight: 'calc(100% - 24px)',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div
              style={{
                position: 'relative',
                width: '100%',
                aspectRatio: '9/16',
                maxHeight: 'calc(100vh - 190px)',
                background: '#111',
                borderRadius: 22,
                overflow: 'hidden',
                boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
              }}
            >
              <img
                src={hlvX.url}
                alt={hlvX.pie || ''}
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: 0,
                  height: 120,
                  background: 'linear-gradient(rgba(0,0,0,0.55),transparent)',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  left: 10,
                  right: 10,
                  top: 10,
                  display: 'flex',
                  gap: 4,
                }}
              >
                {hlvList.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setVisor((v) => (v ? { ...v, i } : null))}
                    aria-label="Ir a la imagen"
                    style={{
                      flex: 1,
                      height: 16,
                      border: 0,
                      background: 'transparent',
                      padding: '6px 0',
                      display: 'flex',
                      alignItems: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <span
                      style={{
                        display: 'block',
                        width: '100%',
                        height: 4,
                        borderRadius: 2,
                        background: 'rgba(255,255,255,0.35)',
                        overflow: 'hidden',
                      }}
                    >
                      <span
                        style={{
                          display: 'block',
                          height: 4,
                          width: i <= hlvI ? '100%' : '0%',
                          background: '#fff',
                          opacity: i <= hlvI ? 1 : 0.35,
                        }}
                      />
                    </span>
                  </button>
                ))}
              </div>
              <div
                style={{
                  position: 'absolute',
                  left: 12,
                  top: 32,
                  right: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  color: '#fff',
                }}
              >
                <span
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    background: 'var(--cp-sand)',
                    overflow: 'hidden',
                    border: '2px solid #fff',
                    flex: 'none',
                  }}
                >
                  {obtenerPortadaEfectiva(hlvH) && (
                    <img
                      src={obtenerPortadaEfectiva(hlvH)}
                      alt=""
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  )}
                </span>
                <span style={{ fontWeight: 800, fontSize: 14 }}>{hlvH.titulo}</span>
                <span style={{ fontSize: 12, opacity: 0.85 }}>
                  {hlvList.length ? `${hlvI + 1} de ${hlvList.length}` : ''}
                </span>
                <span style={{ flex: 1 }} />
                <button
                  onClick={() => setVisor(null)}
                  aria-label="Cerrar"
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    border: 0,
                    background: 'rgba(0,0,0,0.4)',
                    color: '#fff',
                    fontSize: 20,
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  ×
                </button>
              </div>
              <button
                onClick={() => hlvStep(-1)}
                aria-label="Imagen anterior"
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 90,
                  bottom: 70,
                  width: '38%',
                  border: 0,
                  background: 'transparent',
                  cursor: 'pointer',
                }}
              />
              <button
                onClick={() => hlvStep(1)}
                aria-label="Imagen siguiente"
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 90,
                  bottom: 70,
                  width: '38%',
                  border: 0,
                  background: 'transparent',
                  cursor: 'pointer',
                }}
              />
              {hlvX.pie && (
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: 0,
                    padding: '40px 16px 18px',
                    background: 'linear-gradient(transparent,rgba(0,0,0,0.7))',
                    color: '#fff',
                    fontSize: 15,
                    lineHeight: '21px',
                    fontWeight: 600,
                  }}
                >
                  {hlvX.pie}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                onClick={() => hlvStep(-1)}
                style={{
                  flex: '1 1 90px',
                  minHeight: 48,
                  borderRadius: 12,
                  border: '1.5px solid var(--cp-cream)',
                  background: 'transparent',
                  color: 'var(--cp-cream)',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                ‹ Anterior
              </button>
              <button
                onClick={() =>
                  setVisor((v) => (v ? { ...v, play: !v.play } : null))
                }
                style={{
                  flex: '1 1 130px',
                  minHeight: 48,
                  borderRadius: 12,
                  border: 0,
                  background: 'var(--cp-orange)',
                  color: 'var(--cp-navy)',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                {visor?.play ? '⏸ Pausar' : '▶ Reproducir solo'}
              </button>
              <button
                onClick={() => hlvStep(1)}
                style={{
                  flex: '1 1 90px',
                  minHeight: 48,
                  borderRadius: 12,
                  border: '1.5px solid var(--cp-cream)',
                  background: 'transparent',
                  color: 'var(--cp-cream)',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                Siguiente ›
              </button>
            </div>
            <div
              className="noscroll"
              style={{
                display: 'flex',
                gap: 10,
                overflowX: 'auto',
                padding: 2,
              }}
            >
              {hlVis.map((c) => {
                const coverC = obtenerPortadaEfectiva(c);
                return (
                  <button
                    key={c.id}
                    onClick={() => abrirVisor(c.id)}
                    aria-label={`Ver ${c.titulo}`}
                    style={{
                      flex: 'none',
                      width: 56,
                      border: 0,
                      background: 'transparent',
                      padding: 0,
                      color: 'var(--cp-cream)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 3,
                      cursor: 'pointer',
                    }}
                  >
                    <span
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 24,
                        border: `3px solid ${
                          hlvH.id === c.id
                            ? 'var(--cp-orange)'
                            : 'rgba(255,255,255,0.35)'
                        }`,
                        overflow: 'hidden',
                        background: 'var(--cp-sand)',
                        boxSizing: 'border-box',
                      }}
                    >
                      {coverC && (
                        <img
                          src={coverC}
                          alt=""
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      )}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        lineHeight: '12px',
                        textAlign: 'center',
                      }}
                    >
                      {c.titulo}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Diálogo de confirmación Sí / No */}
      <Confirmar
        abierto={confirmacion !== null}
        titulo={confirmacion?.titulo || ''}
        mensaje={confirmacion?.mensaje || ''}
        alConfirmar={() => {
          if (!confirmacion) return;
          const fn = confirmacion.accion;
          setConfirmacion(null);
          fn();
        }}
        alCancelar={() => setConfirmacion(null)}
        cargando={guardandoAccion}
      />
    </div>
  );
}
