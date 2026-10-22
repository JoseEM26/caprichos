import { useState, useEffect, type ChangeEvent } from 'react';
import { api } from '../../comun/api';
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
  archivada: boolean;
  portada_url: string | null;
  fotos: FotoDestacada[];
}

export function DestacadasView() {
  const [destacadas, setDestacadas] = useState<DestacadaAdmin[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selId, setSelId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  // Visor de historias
  const [visorAbierto, setVisorAbierto] = useState(false);
  const [visorDestacadaIdx, setVisorDestacadaIdx] = useState<number>(0);
  const [visorFotoIdx, setVisorFotoIdx] = useState<number>(0);

  // Diálogos de confirmación
  const [confirmarEliminar, setConfirmarEliminar] = useState<string | null>(null);
  const [confirmarPublicar, setConfirmarPublicar] = useState(false);
  const [confirmarDescartar, setConfirmarDescartar] = useState(false);
  const [guardandoAccion, setGuardandoAccion] = useState(false);

  const cargarDatos = async () => {
    setCargando(true);
    setError(null);
    try {
      const data = await api.get<DestacadaAdmin[]>('/admin/contenido/destacadas');
      setDestacadas(
        data.map((d) => ({
          ...d,
          portada_url: normalizarUrlArchivo(d.portada_url),
          fotos: (d.fotos || []).map((f) => ({
            ...f,
            url: normalizarUrlArchivo(f.url) || f.url,
          })),
        })),
      );
    } catch (err: any) {
      setError(err?.message || 'Error al cargar las historias destacadas');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const marcarModificado = () => setDirty(true);

  const activas = destacadas.filter((d) => !d.archivada);
  const archivadas = destacadas.filter((d) => d.archivada);
  const seleccionada = destacadas.find((d) => d.id === selId) || null;

  const sinFotosCount = activas.filter((d) => d.fotos.length === 0).length;

  // Acciones en la destacada seleccionada
  const cambiarNombre = (val: string) => {
    if (!seleccionada) return;
    setDestacadas(destacadas.map((d) => (d.id === selId ? { ...d, titulo: val } : d)));
    marcarModificado();
  };

  const cambiarPortada = (e: ChangeEvent<HTMLInputElement>) => {
    if (!seleccionada) return;
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target?.result as string;
      setDestacadas(destacadas.map((d) => (d.id === selId ? { ...d, portada_url: url } : d)));
      marcarModificado();
    };
    reader.readAsDataURL(file);
  };

  const quitarPortada = () => {
    if (!seleccionada) return;
    setDestacadas(destacadas.map((d) => (d.id === selId ? { ...d, portada_url: null } : d)));
    marcarModificado();
  };

  const agregarFotos = (e: ChangeEvent<HTMLInputElement>) => {
    if (!seleccionada) return;
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const url = ev.target?.result as string;
        setDestacadas((prev) =>
          prev.map((d) => {
            if (d.id !== selId) return d;
            const nuevaFoto: FotoDestacada = {
              id: `temp-${Date.now()}-${Math.random()}`,
              url,
              pie: '',
              orden: d.fotos.length + 1,
            };
            return {
              ...d,
              fotos: [...d.fotos, nuevaFoto],
            };
          }),
        );
        marcarModificado();
      };
      reader.readAsDataURL(file);
    });
  };

  const moverFoto = (fotoIdx: number, dir: -1 | 1) => {
    if (!seleccionada) return;
    const targetIdx = fotoIdx + dir;
    if (targetIdx < 0 || targetIdx >= seleccionada.fotos.length) return;
    const copia = [...seleccionada.fotos];
    const temp = copia[fotoIdx];
    copia[fotoIdx] = copia[targetIdx];
    copia[targetIdx] = temp;
    setDestacadas(destacadas.map((d) => (d.id === selId ? { ...d, fotos: copia } : d)));
    marcarModificado();
  };

  const cambiarPieFoto = (fotoIdx: number, pie: string) => {
    if (!seleccionada) return;
    const copia = [...seleccionada.fotos];
    copia[fotoIdx] = { ...copia[fotoIdx], pie };
    setDestacadas(destacadas.map((d) => (d.id === selId ? { ...d, fotos: copia } : d)));
    marcarModificado();
  };

  const hacerFotoPortada = (url: string) => {
    if (!seleccionada) return;
    setDestacadas(destacadas.map((d) => (d.id === selId ? { ...d, portada_url: url } : d)));
    marcarModificado();
  };

  const quitarFoto = (fotoIdx: number) => {
    if (!seleccionada) return;
    const copia = seleccionada.fotos.filter((_, i) => i !== fotoIdx);
    setDestacadas(destacadas.map((d) => (d.id === selId ? { ...d, fotos: copia } : d)));
    marcarModificado();
  };

  const moverCirculo = (dir: -1 | 1) => {
    if (!seleccionada) return;
    const idx = activas.findIndex((d) => d.id === selId);
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= activas.length) return;
    const otro = activas[targetIdx];
    const copia = [...destacadas];
    const sIndex = copia.findIndex((d) => d.id === selId);
    const oIndex = copia.findIndex((d) => d.id === otro.id);
    const temp = copia[sIndex];
    copia[sIndex] = copia[oIndex];
    copia[oIndex] = temp;
    setDestacadas(copia);
    marcarModificado();
  };

  const crearNuevaDestacada = async () => {
    try {
      const res = await api.post<{ ok: boolean; id: string }>('/admin/contenido/destacadas', {
        titulo: 'Nueva destacada',
      });
      await cargarDatos();
      setSelId(res.id);
      setMensaje('Destacada creada');
      setTimeout(() => setMensaje(null), 3000);
    } catch (err: any) {
      alert(err?.message || 'Error al crear destacada');
    }
  };

  const duplicarSeleccionada = async () => {
    if (!seleccionada) return;
    try {
      const res = await api.post<{ ok: boolean; id: string }>('/admin/contenido/destacadas', {
        titulo: `${seleccionada.titulo} (copia)`,
        portada_url: seleccionada.portada_url || undefined,
      });
      // Guardar fotos copiadas
      if (seleccionada.fotos.length > 0) {
        await api.put(`/admin/contenido/destacadas/${res.id}`, {
          fotos: seleccionada.fotos.map((f) => ({ url: f.url, pie: f.pie })),
        });
      }
      await cargarDatos();
      setSelId(res.id);
      setMensaje('Destacada duplicada');
      setTimeout(() => setMensaje(null), 3000);
    } catch (err: any) {
      alert(err?.message || 'Error al duplicar');
    }
  };

  const archivarSeleccionada = async () => {
    if (!seleccionada) return;
    try {
      await api.put(`/admin/contenido/destacadas/${selId}/archivar`, { archivada: true });
      await cargarDatos();
      setMensaje('Destacada archivada');
      setTimeout(() => setMensaje(null), 3000);
    } catch (err: any) {
      alert(err?.message || 'Error al archivar');
    }
  };

  const restaurarArchivada = async (id: string) => {
    try {
      await api.put(`/admin/contenido/destacadas/${id}/archivar`, { archivada: false });
      await cargarDatos();
      setSelId(id);
      setMensaje('Destacada restaurada');
      setTimeout(() => setMensaje(null), 3000);
    } catch (err: any) {
      alert(err?.message || 'Error al restaurar');
    }
  };

  const eliminarDefinitivo = async () => {
    if (!confirmarEliminar) return;
    setGuardandoAccion(true);
    try {
      await api.delete(`/admin/contenido/destacadas/${confirmarEliminar}`);
      setConfirmarEliminar(null);
      await cargarDatos();
      setMensaje('Destacada eliminada para siempre');
      setTimeout(() => setMensaje(null), 3000);
    } catch (err: any) {
      alert(err?.message || 'Error al eliminar destacada');
    } finally {
      setGuardandoAccion(false);
    }
  };

  const cargarEjemplos = async () => {
    try {
      await api.post('/admin/contenido/destacadas/ejemplo', {});
      await cargarDatos();
      setMensaje('Fotos de ejemplo cargadas');
      setTimeout(() => setMensaje(null), 3000);
    } catch (err: any) {
      alert(err?.message || 'Error al cargar fotos de ejemplo');
    }
  };

  const ejecutarPublicar = async () => {
    setGuardandoAccion(true);
    try {
      // Guardar cambios pendientes en backend para cada destacada
      for (const d of destacadas) {
        await api.put(`/admin/contenido/destacadas/${d.id}`, {
          titulo: d.titulo,
          orden: d.orden,
          portada_url: d.portada_url,
          fotos: d.fotos.map((f, i) => ({ url: f.url, pie: f.pie, orden: i + 1 })),
        });
      }
      await api.post('/admin/contenido/destacadas/publicar', {});
      setDirty(false);
      setConfirmarPublicar(false);
      setMensaje('¡Historias destacadas publicadas en la carta!');
      setTimeout(() => setMensaje(null), 4000);
    } catch (err: any) {
      alert(err?.message || 'Error al publicar destacadas');
    } finally {
      setGuardandoAccion(false);
    }
  };

  const ejecutarDescartar = async () => {
    setGuardandoAccion(true);
    try {
      await cargarDatos();
      setDirty(false);
      setConfirmarDescartar(false);
      setMensaje('Cambios descartados');
      setTimeout(() => setMensaje(null), 3000);
    } catch (err: any) {
      alert(err?.message || 'Error al descartar');
    } finally {
      setGuardandoAccion(false);
    }
  };

  // Visor tipo Instagram
  const abrirVisor = (destacadaId: string) => {
    const dIdx = activas.findIndex((d) => d.id === destacadaId);
    if (dIdx >= 0 && activas[dIdx].fotos.length > 0) {
      setVisorDestacadaIdx(dIdx);
      setVisorFotoIdx(0);
      setVisorAbierto(true);
    }
  };

  const siguienteFoto = () => {
    const curDest = activas[visorDestacadaIdx];
    if (visorFotoIdx < curDest.fotos.length - 1) {
      setVisorFotoIdx(visorFotoIdx + 1);
    } else if (visorDestacadaIdx < activas.length - 1) {
      setVisorDestacadaIdx(visorDestacadaIdx + 1);
      setVisorFotoIdx(0);
    } else {
      setVisorAbierto(false);
    }
  };

  const anteriorFoto = () => {
    if (visorFotoIdx > 0) {
      setVisorFotoIdx(visorFotoIdx - 1);
    } else if (visorDestacadaIdx > 0) {
      setVisorDestacadaIdx(visorDestacadaIdx - 1);
      setVisorFotoIdx(activas[visorDestacadaIdx - 1].fotos.length - 1);
    }
  };

  if (cargando) return <Cargando mensaje="Cargando destacadas de la carta..." />;
  if (error) return <EstadoError mensaje={error} alReintentar={cargarDatos} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Texto explicativo literal del mockup */}
      <div style={{ fontSize: 13, lineHeight: '19px', color: 'var(--cp-soft)' }}>
        Son los círculos &ldquo;Momentos Caprichos&rdquo; de la carta. Al tocar uno, el cliente ve sus fotos como en las historias de Instagram: clientes, local, equipo, eventos. Solo muestran fotos; no llevan a ninguna parte. Toca un círculo para editarlo. Un círculo sin fotos no se ve en la carta. Los cambios llegan a la carta al pulsar &ldquo;Publicar&rdquo;.
      </div>

      {/* Barra de botones de acción */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <button
          onClick={crearNuevaDestacada}
          style={{ minHeight: 44, padding: '0 14px', borderRadius: 12, border: '1.5px dashed var(--cp-navy)', background: 'transparent', color: 'var(--cp-navy)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
        >
          + Nueva destacada
        </button>
        <button
          onClick={() => activas.length > 0 && abrirVisor(activas[0].id)}
          style={{ minHeight: 44, padding: '0 14px', borderRadius: 12, border: '1.5px solid var(--cp-navy)', background: 'var(--cp-navy)', color: 'var(--cp-cream)', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}
        >
          ▶ Ver como cliente
        </button>
        {sinFotosCount > 0 && (
          <button
            onClick={cargarEjemplos}
            style={{ minHeight: 44, padding: '0 14px', borderRadius: 12, border: '1.5px dashed var(--cp-navy)', background: 'transparent', color: 'var(--cp-navy)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
          >
            Cargar fotos de ejemplo
          </button>
        )}
        <span style={{ flex: 1 }} />
        {dirty && (
          <span style={{ fontSize: 12, fontWeight: 700, borderRadius: 9999, padding: '4px 12px', background: 'var(--cp-gold)', color: 'var(--cp-navy)' }}>
            Cambios sin publicar
          </span>
        )}
        {mensaje && <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--cp-soft)' }}>{mensaje}</span>}
        <button
          onClick={() => setConfirmarPublicar(true)}
          style={{ minHeight: 44, padding: '0 18px', border: 0, borderRadius: 12, background: 'var(--cp-orange)', color: 'var(--cp-navy)', fontWeight: 800, cursor: 'pointer' }}
        >
          Publicar en la carta
        </button>
        <button
          onClick={() => setConfirmarDescartar(true)}
          style={{ minHeight: 44, padding: '0 14px', border: '1.5px solid var(--cp-navy)', borderRadius: 12, background: 'transparent', color: 'var(--cp-navy)', fontWeight: 700, cursor: 'pointer' }}
        >
          Descartar
        </button>
      </div>

      {/* Caja de círculos estilo Instagram */}
      <div style={{ background: 'var(--cp-cream)', border: '1px solid var(--cp-line)', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.06em', color: 'var(--cp-soft)' }}>
            ASÍ SE VEN EN LA CARTA · TOCA UN CÍRCULO PARA EDITARLO O VERLO
          </div>
          <div style={{ fontSize: 12, fontWeight: 700 }}>
            {activas.length} destacadas · {activas.reduce((acc, d) => acc + d.fotos.length, 0)} fotos en total
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', padding: '4px 2px' }}>
          {activas.map((c) => {
            const esSeleccionado = c.id === selId;
            const tieneFoto = !!(c.portada_url || c.fotos[0]?.url);
            const fotoPortada = c.portada_url || c.fotos[0]?.url || null;
            return (
              <div
                key={c.id}
                style={{
                  flex: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  borderBottom: `3px solid ${esSeleccionado ? 'var(--cp-orange)' : 'transparent'}`,
                  paddingBottom: 4,
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
                      background: 'linear-gradient(135deg, var(--cp-orange), var(--cp-rust))',
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
                        <img src={fotoPortada!} alt="" style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M3 8h4l2-3h6l2 3h4v11H3z" />
                          <circle cx="12" cy="13.5" r="3.5" />
                        </svg>
                      )}
                    </span>
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700, lineHeight: '14px', textAlign: 'center' }}>{c.titulo}</span>
                  <span style={{ fontSize: 12, color: 'var(--cp-soft)' }}>{c.fotos.length} fotos</span>
                </button>
                {c.fotos.length === 0 && (
                  <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--cp-rust)', textAlign: 'center' }}>
                    Sin fotos (no se verá)
                  </span>
                )}
                <button
                  onClick={() => abrirVisor(c.id)}
                  style={{ minHeight: 32, padding: '0 10px', borderRadius: 9999, border: '1.5px solid var(--cp-navy)', background: 'transparent', color: 'var(--cp-navy)', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}
                >
                  ▶ Ver
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Editor de la destacada seleccionada */}
      {seleccionada && (
        <div style={{ background: 'var(--cp-white)', border: '2px solid var(--cp-orange)', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 16 }}>
            Editar: {seleccionada.titulo}
          </div>
          <div>
            <label htmlFor="h-n" style={{ fontWeight: 700, fontSize: 13, display: 'block', marginBottom: 4 }}>
              Nombre del círculo
            </label>
            <input
              id="h-n"
              type="text"
              value={seleccionada.titulo}
              onChange={(e) => cambiarNombre(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', minHeight: 44, borderRadius: 10, border: '1.5px solid var(--cp-line)', background: 'var(--cp-white)', color: 'var(--cp-navy)', padding: '0 10px', fontSize: 14 }}
            />
          </div>

          <div>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>Foto del círculo</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <label style={{ position: 'relative', minHeight: 44, padding: '0 16px', boxSizing: 'border-box', borderRadius: 10, background: 'var(--cp-orange)', color: 'var(--cp-navy)', fontWeight: 800, fontSize: 12, display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                {seleccionada.portada_url ? 'Cambiar foto del círculo' : 'Elegir foto del círculo'}
                <input type="file" accept="image/*" onChange={cambiarPortada} style={{ position: 'absolute', left: -9999 }} />
              </label>
              {seleccionada.portada_url && (
                <button
                  onClick={quitarPortada}
                  style={{ minHeight: 44, padding: '0 12px', border: '1.5px solid var(--cp-rust)', borderRadius: 10, background: 'transparent', color: 'var(--cp-rust)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                >
                  Quitar foto
                </button>
              )}
            </div>
          </div>

          {/* Lista de fotos */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
              <span style={{ fontWeight: 700, fontSize: 13 }}>Imágenes que ve el cliente ({seleccionada.fotos.length})</span>
              <label style={{ position: 'relative', minHeight: 44, padding: '0 16px', boxSizing: 'border-box', borderRadius: 10, background: 'var(--cp-orange)', color: 'var(--cp-navy)', fontWeight: 800, fontSize: 12, display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                + Subir varias imágenes
                <input type="file" accept="image/*" multiple onChange={agregarFotos} style={{ position: 'absolute', left: -9999 }} />
              </label>
            </div>
            {seleccionada.fotos.length === 0 && (
              <div style={{ fontSize: 13, color: 'var(--cp-soft)' }}>
                Todavía no hay imágenes. Un círculo sin imágenes no se muestra en la carta.
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {seleccionada.fotos.map((f, fIdx) => (
                <div key={f.id} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', border: '1px solid var(--cp-line)', borderRadius: 12, padding: 8 }}>
                  <img src={f.url} alt="" style={{ width: 64, height: 64, borderRadius: 10, objectFit: 'cover', flex: 'none' }} />
                  <div style={{ flex: '1 1 180px', minWidth: 0 }}>
                    <input
                      type="text"
                      value={f.pie || ''}
                      onChange={(e) => cambiarPieFoto(fIdx, e.target.value)}
                      placeholder="Texto que acompaña la imagen (opcional)"
                      style={{ width: '100%', boxSizing: 'border-box', minHeight: 44, borderRadius: 10, border: '1.5px solid var(--cp-line)', background: 'var(--cp-white)', color: 'var(--cp-navy)', padding: '0 10px', fontSize: 14 }}
                    />
                  </div>
                  <button
                    onClick={() => moverFoto(fIdx, -1)}
                    disabled={fIdx === 0}
                    aria-label="Subir"
                    style={{ width: 44, minHeight: 44, border: '1.5px solid var(--cp-navy)', borderRadius: 10, background: 'transparent', color: 'var(--cp-navy)', fontWeight: 800, opacity: fIdx > 0 ? 1 : 0.35, cursor: fIdx > 0 ? 'pointer' : 'default' }}
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => moverFoto(fIdx, 1)}
                    disabled={fIdx === seleccionada.fotos.length - 1}
                    aria-label="Bajar"
                    style={{ width: 44, minHeight: 44, border: '1.5px solid var(--cp-navy)', borderRadius: 10, background: 'transparent', color: 'var(--cp-navy)', fontWeight: 800, opacity: fIdx < seleccionada.fotos.length - 1 ? 1 : 0.35, cursor: fIdx < seleccionada.fotos.length - 1 ? 'pointer' : 'default' }}
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => hacerFotoPortada(f.url)}
                    style={{ minHeight: 44, padding: '0 12px', border: '1.5px solid var(--cp-navy)', borderRadius: 10, background: 'transparent', color: 'var(--cp-navy)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                  >
                    {seleccionada.portada_url === f.url ? 'Es la portada' : 'Hacer portada'}
                  </button>
                  <button
                    onClick={() => quitarFoto(fIdx)}
                    style={{ minHeight: 44, padding: '0 12px', border: '1.5px solid var(--cp-rust)', borderRadius: 10, background: 'transparent', color: 'var(--cp-rust)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                  >
                    Quitar
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button
              onClick={() => moverCirculo(-1)}
              aria-label="Mover antes"
              style={{ width: 44, minHeight: 44, border: '1.5px solid var(--cp-navy)', borderRadius: 10, background: 'transparent', color: 'var(--cp-navy)', fontWeight: 800, cursor: 'pointer' }}
            >
              ←
            </button>
            <button
              onClick={() => moverCirculo(1)}
              aria-label="Mover después"
              style={{ width: 44, minHeight: 44, border: '1.5px solid var(--cp-navy)', borderRadius: 10, background: 'transparent', color: 'var(--cp-navy)', fontWeight: 800, cursor: 'pointer' }}
            >
              →
            </button>
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', borderTop: '1px solid var(--cp-line)', paddingTop: 10 }}>
            <button
              onClick={duplicarSeleccionada}
              style={{ flex: '1 1 110px', minHeight: 44, border: '1.5px solid var(--cp-navy)', borderRadius: 10, background: 'transparent', color: 'var(--cp-navy)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
            >
              Duplicar
            </button>
            <button
              onClick={() => {
                setDestacadas(destacadas.map((d) => (d.id === selId ? { ...d, fotos: [] } : d)));
                marcarModificado();
              }}
              style={{ flex: '1 1 130px', minHeight: 44, border: '1.5px solid var(--cp-navy)', borderRadius: 10, background: 'transparent', color: 'var(--cp-navy)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
            >
              Quitar todas las imágenes
            </button>
            <button
              onClick={archivarSeleccionada}
              style={{ flex: '1 1 110px', minHeight: 44, border: '1.5px solid var(--cp-navy)', borderRadius: 10, background: 'var(--cp-sand)', color: 'var(--cp-navy)', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}
            >
              Archivar
            </button>
            <button
              onClick={() => setConfirmarEliminar(selId)}
              style={{ flex: '1 1 110px', minHeight: 44, border: '1.5px solid var(--cp-rust)', borderRadius: 10, background: 'transparent', color: 'var(--cp-rust)', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}
            >
              Eliminar
            </button>
          </div>
        </div>
      )}

      {/* Sección Archivadas */}
      {archivadas.length > 0 && (
        <div style={{ background: 'var(--cp-white)', border: '1px solid var(--cp-line)', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontWeight: 800 }}>Archivadas ({archivadas.length})</div>
          <div style={{ fontSize: 12, color: 'var(--cp-soft)' }}>
            No se ven en la carta ni en la lista de arriba. Puedes restaurarlas o eliminarlas para siempre.
          </div>
          {archivadas.map((a) => (
            <div key={a.id} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', border: '1px solid var(--cp-line)', borderRadius: 12, padding: 8 }}>
              <span style={{ width: 44, height: 44, borderRadius: 22, overflow: 'hidden', background: 'var(--cp-sand)', flex: 'none' }}>
                {a.portada_url && <img src={a.portada_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
              </span>
              <div style={{ flex: '1 1 160px', minWidth: 0 }}>
                <div style={{ fontWeight: 700 }}>{a.titulo}</div>
                <div style={{ fontSize: 12, color: 'var(--cp-soft)' }}>{a.fotos.length} fotos</div>
              </div>
              <button
                onClick={() => restaurarArchivada(a.id)}
                style={{ minHeight: 44, padding: '0 14px', border: '1.5px solid var(--cp-navy)', borderRadius: 10, background: 'transparent', color: 'var(--cp-navy)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
              >
                Restaurar
              </button>
              <button
                onClick={() => setConfirmarEliminar(a.id)}
                style={{ minHeight: 44, padding: '0 14px', border: '1.5px solid var(--cp-rust)', borderRadius: 10, background: 'transparent', color: 'var(--cp-rust)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
              >
                Eliminar para siempre
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Visor de imágenes tipo Instagram Stories */}
      {visorAbierto && activas[visorDestacadaIdx] && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={activas[visorDestacadaIdx].titulo}
          style={{ position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, zIndex: 120, background: '#0B0F12', color: '#FFFFFF', display: 'flex', flexDirection: 'column' }}
        >
          {/* Barras de progreso superiores */}
          <div style={{ display: 'flex', gap: 4, padding: '10px 12px 6px' }}>
            {activas[visorDestacadaIdx].fotos.map((_, i) => (
              <span key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.3)', overflow: 'hidden', display: 'block' }}>
                <span style={{ display: 'block', height: 3, background: '#FFFFFF', width: i <= visorFotoIdx ? '100%' : '0%' }} />
              </span>
            ))}
          </div>
          {/* Cabecera del visor */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 12px 8px' }}>
            <span style={{ width: 36, height: 36, borderRadius: 18, border: '2px solid var(--cp-orange)', background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flex: 'none' }}>
              {activas[visorDestacadaIdx].portada_url && <img src={activas[visorDestacadaIdx].portada_url!} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
            </span>
            <span style={{ flex: 1, fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 15 }}>
              {activas[visorDestacadaIdx].titulo}
            </span>
            <button
              onClick={() => setVisorAbierto(false)}
              aria-label="Cerrar"
              style={{ width: 44, height: 44, border: 0, borderRadius: 22, background: 'rgba(255,255,255,0.14)', color: '#FFFFFF', fontSize: 22, fontWeight: 800, cursor: 'pointer' }}
            >
              ×
            </button>
          </div>
          {/* Contenido de la foto con zonas táctiles para avanzar/retroceder */}
          <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {activas[visorDestacadaIdx].fotos[visorFotoIdx] ? (
              <img
                src={activas[visorDestacadaIdx].fotos[visorFotoIdx].url}
                alt={activas[visorDestacadaIdx].fotos[visorFotoIdx].pie || ''}
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
              />
            ) : null}
            <button onClick={anteriorFoto} aria-label="Anterior" style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '38%', border: 0, background: 'transparent', cursor: 'pointer' }} />
            <button onClick={siguienteFoto} aria-label="Siguiente" style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '62%', border: 0, background: 'transparent', cursor: 'pointer' }} />
          </div>
          {/* Pie de foto */}
          {activas[visorDestacadaIdx].fotos[visorFotoIdx]?.pie && (
            <div style={{ padding: '10px 16px 20px', display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center', textAlign: 'center' }}>
              <span style={{ fontSize: 15, lineHeight: '21px', fontWeight: 600 }}>
                {activas[visorDestacadaIdx].fotos[visorFotoIdx].pie}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Confirmar eliminar */}
      <Confirmar
        abierto={!!confirmarEliminar}
        titulo="¿Eliminar esta destacada para siempre?"
        mensaje="Se eliminará la destacada y sus fotos. Esta acción no se puede deshacer."
        textoConfirmar="Sí, eliminar"
        textoNo="No, conservar"
        peligro
        cargando={guardandoAccion}
        alConfirmar={eliminarDefinitivo}
        alCancelar={() => setConfirmarEliminar(null)}
      />

      {/* Confirmar publicar */}
      <Confirmar
        abierto={confirmarPublicar}
        titulo="¿Publicar las destacadas en la carta?"
        mensaje="Los clientes verán este orden y estas fotos en la carta virtual."
        textoConfirmar="Sí, publicar"
        textoNo="No, seguir editando"
        cargando={guardandoAccion}
        alConfirmar={ejecutarPublicar}
        alCancelar={() => setConfirmarPublicar(false)}
      />

      {/* Confirmar descartar */}
      <Confirmar
        abierto={confirmarDescartar}
        titulo="¿Descartar los cambios sin publicar?"
        mensaje="Volverás al último orden publicado y se perderán las fotos o cambios no guardados."
        textoConfirmar="Sí, descartar"
        textoNo="No, mantener cambios"
        peligro
        cargando={guardandoAccion}
        alConfirmar={ejecutarDescartar}
        alCancelar={() => setConfirmarDescartar(false)}
      />
    </div>
  );
}
