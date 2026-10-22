import { useState, useEffect, type ChangeEvent } from 'react';
import { api } from '../../comun/api';
import { Cargando } from '../../comun/Cargando';
import { EstadoError } from '../../comun/EstadoError';
import { Confirmar } from '../../comun/Confirmar';
import { normalizarUrlArchivo } from './paletas-constantes';

interface FotoNovedad {
  id: string;
  url: string;
}

interface NovedadAdmin {
  id: string;
  tipo: string;
  titulo: string;
  texto: string | null;
  tema: string | null;
  video_url: string | null;
  evento_fecha: string | null;
  evento_lugar: string | null;
  desde: string | null;
  hasta: string | null;
  orden: number;
  activo: boolean;
  fotos: FotoNovedad[];
}

const TIPOS_NOVEDAD = [
  { id: 'PROMOCION', n: 'Promoción' },
  { id: 'BANNER', n: 'Banner' },
  { id: 'VIDEO', n: 'Video' },
  { id: 'FOTOS', n: 'Fotos' },
  { id: 'EVENTO', n: 'Evento' },
  { id: 'AVISO', n: 'Aviso' },
];

const CHIPS_AGREGAR = [
  { id: 'PROMOCION', n: 'Promoción' },
  { id: 'BANNER', n: 'Banner' },
  { id: 'FOTOS', n: 'Novedad con imagen' },
  { id: 'FOTOS', n: 'Fotos de clientes o evento' },
  { id: 'EVENTO', n: 'Evento' },
  { id: 'VIDEO', n: 'Video (TikTok o Instagram)' },
  { id: 'AVISO', n: 'Aviso' },
];

function badgeDeNovedad(n: NovedadAdmin): string {
  if (n.tema) return n.tema.toUpperCase();
  if (n.tipo === 'BANNER') return 'EN PORTADA';
  if (n.tipo === 'PROMOCION') return 'PROMO';
  if (n.tipo === 'VIDEO') return 'VIDEO';
  if (n.tipo === 'AVISO') return 'AVISO';
  if (n.tipo === 'EVENTO') return 'EVENTO';
  return 'NOVEDAD';
}

export function NovedadesView() {
  const [novedades, setNovedades] = useState<NovedadAdmin[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [nsFull, setNsFull] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState<string>('todas');
  const [filtroTipo, setFiltroTipo] = useState<string>('TODAS');
  const [dirty, setDirty] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  // Modal de edición
  const [editando, setEditando] = useState<NovedadAdmin | null>(null);
  const [tipoEdit, setTipoEdit] = useState('PROMOCION');
  const [tituloEdit, setTituloEdit] = useState('');
  const [temaEdit, setTemaEdit] = useState('');
  const [textoEdit, setTextoEdit] = useState('');
  const [videoUrlEdit, setVideoUrlEdit] = useState('');
  const [fechaEventoEdit, setFechaEventoEdit] = useState('');
  const [lugarEventoEdit, setLugarEventoEdit] = useState('');
  const [desdeEdit, setDesdeEdit] = useState('');
  const [hastaEdit, setHastaEdit] = useState('');
  const [activoEdit, setActivoEdit] = useState(true);
  const [fotosEdit, setFotosEdit] = useState<string[]>([]);

  // Confirmaciones
  const [confirmarPublicar, setConfirmarPublicar] = useState(false);
  const [confirmarDescartar, setConfirmarDescartar] = useState(false);
  const [guardandoAccion, setGuardandoAccion] = useState(false);

  const cargarDatos = async () => {
    setCargando(true);
    setError(null);
    try {
      const data = await api.get<NovedadAdmin[]>('/admin/contenido/novedades');
      setNovedades(
        data.map((n) => ({
          ...n,
          fotos: (n.fotos || []).map((f) => ({
            ...f,
            url: normalizarUrlArchivo(f.url) || f.url,
          })),
        })),
      );
    } catch (err: any) {
      setError(err?.message || 'Error al cargar las novedades y publicidad');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const marcarModificado = () => setDirty(true);

  // Mover de orden
  const moverNovedad = (idx: number, dir: -1 | 1) => {
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= novedades.length) return;
    const copia = [...novedades];
    const temp = copia[idx];
    copia[idx] = copia[targetIdx];
    copia[targetIdx] = temp;
    setNovedades(copia);
    marcarModificado();
  };

  const toggleActivo = (id: string) => {
    setNovedades(
      novedades.map((n) => (n.id === id ? { ...n, activo: !n.activo } : n)),
    );
    marcarModificado();
  };

  const toggleEnPortada = (id: string) => {
    setNovedades(
      novedades.map((n) => {
        if (n.id !== id) return n;
        const esBanner = n.tipo === 'BANNER';
        return {
          ...n,
          tipo: esBanner ? 'PROMOCION' : 'BANNER',
        };
      }),
    );
    marcarModificado();
  };

  const duplicar = async (n: NovedadAdmin) => {
    try {
      await api.post('/admin/contenido/novedades', {
        tipo: n.tipo,
        titulo: `${n.titulo} (copia)`,
        texto: n.texto || undefined,
        tema: n.tema || undefined,
        video_url: n.video_url || undefined,
        evento_fecha: n.evento_fecha || undefined,
        evento_lugar: n.evento_lugar || undefined,
        desde: n.desde || undefined,
        hasta: n.hasta || undefined,
        activo: false, // duplicada inactiva por defecto
        fotos: n.fotos.map((f) => f.url),
      });
      await cargarDatos();
      setMensaje('Novedad duplicada (creada como inactiva)');
      setTimeout(() => setMensaje(null), 3000);
    } catch (err: any) {
      alert(err?.message || 'Error al duplicar novedad');
    }
  };

  const abrirCrear = (tipoInicial: string) => {
    const nuevaTemp: NovedadAdmin = {
      id: 'nueva',
      tipo: tipoInicial,
      titulo: '',
      texto: '',
      tema: '',
      video_url: '',
      evento_fecha: null,
      evento_lugar: '',
      desde: null,
      hasta: null,
      orden: novedades.length + 1,
      activo: true,
      fotos: [],
    };
    setEditando(nuevaTemp);
    setTipoEdit(tipoInicial);
    setTituloEdit('');
    setTemaEdit('');
    setTextoEdit('');
    setVideoUrlEdit('');
    setFechaEventoEdit('');
    setLugarEventoEdit('');
    setDesdeEdit('');
    setHastaEdit('');
    setActivoEdit(true);
    setFotosEdit([]);
  };

  const abrirEditar = (n: NovedadAdmin) => {
    setEditando(n);
    setTipoEdit(n.tipo);
    setTituloEdit(n.titulo);
    setTemaEdit(n.tema || '');
    setTextoEdit(n.texto || '');
    setVideoUrlEdit(n.video_url || '');
    setFechaEventoEdit(n.evento_fecha ? n.evento_fecha.slice(0, 10) : '');
    setLugarEventoEdit(n.evento_lugar || '');
    setDesdeEdit(n.desde ? n.desde.slice(0, 10) : '');
    setHastaEdit(n.hasta ? n.hasta.slice(0, 10) : '');
    setActivoEdit(n.activo);
    setFotosEdit(n.fotos.map((f) => f.url));
  };

  const subirFoto = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target?.result as string;
      setFotosEdit([...fotosEdit, url]);
    };
    reader.readAsDataURL(file);
  };

  const quitarFotoEdit = (idx: number) => {
    setFotosEdit(fotosEdit.filter((_, i) => i !== idx));
  };

  const guardarModalEdicion = async () => {
    if (!tituloEdit.trim()) {
      alert('El título es obligatorio');
      return;
    }
    const payload = {
      tipo: tipoEdit,
      titulo: tituloEdit.trim(),
      tema: temaEdit.trim() || undefined,
      texto: textoEdit.trim() || undefined,
      video_url: videoUrlEdit.trim() || undefined,
      evento_fecha: fechaEventoEdit || undefined,
      evento_lugar: lugarEventoEdit.trim() || undefined,
      desde: desdeEdit || undefined,
      hasta: hastaEdit || undefined,
      activo: activoEdit,
      fotos: fotosEdit,
    };

    try {
      if (editando?.id === 'nueva') {
        await api.post('/admin/contenido/novedades', payload);
      } else if (editando) {
        await api.put(`/admin/contenido/novedades/${editando.id}`, payload);
      }
      setEditando(null);
      await cargarDatos();
      marcarModificado();
    } catch (err: any) {
      alert(err?.message || 'Error al guardar la novedad');
    }
  };

  // Atajos de fecha
  const aplicarAtajoFecha = (tipo: 'finde' | 'semana' | 'mes' | 'anio') => {
    const hoy = new Date();
    const formato = (d: Date) => d.toISOString().slice(0, 10);
    setDesdeEdit(formato(hoy));

    if (tipo === 'finde') {
      const domingo = new Date(hoy);
      domingo.setDate(hoy.getDate() + (7 - hoy.getDay()));
      setHastaEdit(formato(domingo));
    } else if (tipo === 'semana') {
      const finSem = new Date(hoy);
      finSem.setDate(hoy.getDate() + 7);
      setHastaEdit(formato(finSem));
    } else if (tipo === 'mes') {
      const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
      setHastaEdit(formato(finMes));
    } else if (tipo === 'anio') {
      const finAnio = new Date(hoy.getFullYear(), 11, 31);
      setHastaEdit(formato(finAnio));
    }
  };

  const ejecutarPublicar = async () => {
    setGuardandoAccion(true);
    try {
      // Guardar orden y estados actuales
      for (const n of novedades) {
        await api.put(`/admin/contenido/novedades/${n.id}`, {
          tipo: n.tipo,
          orden: n.orden,
          activo: n.activo,
        });
      }
      await api.post('/admin/contenido/novedades/publicar', {});
      setDirty(false);
      setConfirmarPublicar(false);
      setMensaje('¡Novedades publicadas en la carta!');
      setTimeout(() => setMensaje(null), 4000);
    } catch (err: any) {
      alert(err?.message || 'Error al publicar novedades');
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

  if (cargando) return <Cargando mensaje="Cargando novedades y publicidad..." />;
  if (error) return <EstadoError mensaje={error} alReintentar={cargarDatos} />;

  const hoyIso = new Date().toISOString().slice(0, 10);
  const estadoClave = (n: NovedadAdmin): 'act' | 'prog' | 'venc' | 'off' => {
    if (!n.activo) return 'off';
    const d = n.desde ? n.desde.slice(0, 10) : '';
    const h = n.hasta ? n.hasta.slice(0, 10) : '';
    if (d && hoyIso < d) return 'prog';
    if (h && hoyIso > h) return 'venc';
    return 'act';
  };

  const countByEstado = { todas: novedades.length, act: 0, prog: 0, venc: 0, off: 0 };
  novedades.forEach((n) => {
    countByEstado[estadoClave(n)] += 1;
  });

  const visiblesPorEstado = novedades.filter((n) => filtroEstado === 'todas' || estadoClave(n) === filtroEstado);
  const enPortada = visiblesPorEstado.filter((n) => n.tipo === 'BANNER');
  const listaRegularBase = visiblesPorEstado.filter((n) => n.tipo !== 'BANNER');
  const listaRegular = listaRegularBase.filter((n) => filtroTipo === 'TODAS' || n.tipo === filtroTipo);

  const chipsTipoResto = [
    { id: 'TODAS', n: 'Todo' },
    { id: 'PROMOCION', n: 'Promociones' },
    { id: 'VIDEO', n: 'Videos' },
    { id: 'FOTOS', n: 'Novedades' },
    { id: 'EVENTO', n: 'Eventos' },
    { id: 'AVISO', n: 'Avisos' },
  ].filter((c) => c.id === 'TODAS' || listaRegularBase.some((n) => n.tipo === c.id));

  const textoResumen =
    `${novedades.length} ${novedades.length === 1 ? 'novedad' : 'novedades'} · ${countByEstado.act} activas` +
    (countByEstado.prog ? ` · ${countByEstado.prog} programadas` : '') +
    (countByEstado.venc ? ` · ${countByEstado.venc} vencidas` : '') +
    (countByEstado.off ? ` · ${countByEstado.off} desactivadas` : '');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Caja resumen en el administrativo */}
      <div
        style={{
          background: 'var(--cp-white)',
          border: '1px solid var(--cp-line)',
          borderRadius: 16,
          boxShadow: '0 6px 18px rgba(11,44,62,0.12)',
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          alignItems: 'flex-start',
        }}
      >
        <div style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 20, lineHeight: '26px' }}>
          Diseñador de Novedades y publicidad
        </div>
        <div style={{ fontSize: 14, lineHeight: '21px', color: 'var(--cp-soft)', maxWidth: 640 }}>
          Se abre en pantalla completa y muestra la página <b>Novedades</b> exactamente como la ve el cliente. Allí mismo agregas promociones, banners, fotos, eventos, videos de TikTok o Instagram y avisos; los ordenas arrastrando o con las flechas; los activas, destacas, duplicas, programas y editas. Nada se elimina: se desactiva. Los cambios llegan a la carta al publicar.
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
          {dirty ? (
            <span style={{ fontSize: 12, fontWeight: 700, borderRadius: 9999, padding: '4px 12px', background: 'var(--cp-gold)', color: 'var(--cp-navy)' }}>
              Borrador sin publicar
            </span>
          ) : (
            <span style={{ fontSize: 12, fontWeight: 700, borderRadius: 9999, padding: '4px 12px', background: 'var(--cp-navy)', color: 'var(--cp-cream)' }}>
              Todo publicado
            </span>
          )}
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--cp-soft)' }}>
            {textoResumen}
          </span>
          {mensaje && <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--cp-soft)' }}>{mensaje}</span>}
        </div>
        <button
          onClick={() => setNsFull(true)}
          style={{
            minHeight: 56,
            padding: '0 28px',
            border: 0,
            borderRadius: 12,
            background: 'var(--cp-orange)',
            color: 'var(--cp-navy)',
            fontFamily: 'var(--fuente-titulos)',
            fontWeight: 800,
            fontSize: 16,
            cursor: 'pointer',
          }}
        >
          Abrir el diseñador en pantalla completa
        </button>
      </div>

      {/* Pantalla completa del diseñador de novedades */}
      {nsFull && (
        <div
          style={{
            position: 'fixed',
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
            zIndex: 90,
            overflowY: 'auto',
            background: 'var(--cp-cream)',
            color: 'var(--cp-navy)',
            fontSize: 15,
            lineHeight: '22px',
          }}
        >
          {/* Barra superior de controles */}
          <div
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 100,
              background: 'var(--cp-navy)',
              color: 'var(--cp-cream)',
              padding: '10px 16px',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '8px 16px',
            }}
          >
            <span style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 13, letterSpacing: '0.06em' }}>
              DISEÑADOR DE NOVEDADES
            </span>
            <span style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 700 }}>Agregar</span>
              {CHIPS_AGREGAR.map((t) => (
                <button
                  key={t.n}
                  onClick={() => abrirCrear(t.id)}
                  style={{
                    minHeight: 38,
                    padding: '0 12px',
                    borderRadius: 9999,
                    border: '1.5px dashed var(--cp-cream)',
                    background: 'transparent',
                    color: 'var(--cp-cream)',
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  + {t.n}
                </button>
              ))}
            </span>
            <span style={{ flex: 1 }} />
            {dirty && (
              <span style={{ fontSize: 12, fontWeight: 700, borderRadius: 9999, padding: '3px 10px', background: 'var(--cp-gold)', color: 'var(--cp-navy)' }}>
                Borrador sin publicar
              </span>
            )}
            <button
              onClick={() => setConfirmarPublicar(true)}
              disabled={!dirty}
              style={{
                minHeight: 44,
                padding: '0 16px',
                border: 0,
                borderRadius: 10,
                background: dirty ? 'var(--cp-orange)' : 'var(--cp-line)',
                color: 'var(--cp-navy)',
                fontWeight: 800,
                opacity: dirty ? 1 : 0.5,
                cursor: dirty ? 'pointer' : 'default',
              }}
            >
              Publicar cambios
            </button>
            <button
              onClick={() => setConfirmarDescartar(true)}
              disabled={!dirty}
              style={{
                minHeight: 44,
                padding: '0 16px',
                border: '1.5px solid var(--cp-cream)',
                borderRadius: 10,
                background: 'transparent',
                color: 'var(--cp-cream)',
                fontWeight: 700,
                opacity: dirty ? 1 : 0.5,
                cursor: dirty ? 'pointer' : 'default',
              }}
            >
              Descartar
            </button>
            <button
              onClick={() => setNsFull(false)}
              style={{
                minHeight: 44,
                padding: '0 16px',
                border: '1.5px solid var(--cp-cream)',
                borderRadius: 10,
                background: 'transparent',
                color: 'var(--cp-cream)',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Salir
            </button>
          </div>

          {/* Filtros de visualización por estado */}
          <div style={{ maxWidth: 1200, margin: '0 auto', padding: '16px 24px 0', display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.06em', color: 'var(--cp-soft)' }}>
              MOSTRAR EN EL DISEÑADOR
            </span>
            {[
              { id: 'todas', n: `Todas (${countByEstado.todas})` },
              { id: 'act', n: `Activas (${countByEstado.act})` },
              { id: 'prog', n: `Programadas (${countByEstado.prog})` },
              { id: 'venc', n: `Vencidas (${countByEstado.venc})` },
              { id: 'off', n: `Desactivadas (${countByEstado.off})` },
            ].map((f) => {
              const activo = filtroEstado === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => setFiltroEstado(f.id)}
                  style={{
                    minHeight: 40,
                    padding: '0 12px',
                    borderRadius: 9999,
                    border: '1.5px solid var(--cp-navy)',
                    background: activo ? 'var(--cp-navy)' : 'transparent',
                    color: activo ? 'var(--cp-cream)' : 'var(--cp-navy)',
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  {f.n}
                </button>
              );
            })}
          </div>

          <div style={{ maxWidth: 1200, margin: '0 auto', padding: '12px 24px 40px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Cabecera hero réplica del cliente */}
            <div
              style={{
                position: 'relative',
                overflow: 'hidden',
                background: 'linear-gradient(155deg, var(--cp-navy) 55%, #3b5a3f)',
                color: 'var(--cp-cream)',
                borderRadius: 20,
                padding: 24,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <span aria-hidden="true" style={{ position: 'absolute', right: -50, top: -50, width: 180, height: 180, borderRadius: '50%', background: 'var(--cp-orange)', opacity: 0.16 }} />
              <span style={{ position: 'relative', fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 12, letterSpacing: '0.12em', color: 'var(--cp-orange)' }}>
                NOVEDADES
              </span>
              <span style={{ position: 'relative', fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 28, lineHeight: '34px' }}>
                Lo nuevo en Caprichos
              </span>
              <span style={{ position: 'relative', fontSize: 15, lineHeight: '22px', maxWidth: 720 }}>
                Promociones, lanzamientos, datos útiles y lo que pasa en nuestras redes.
              </span>
            </div>

            {/* SECCIÓN EN PORTADA (Banners) */}
            {enPortada.length > 0 && (
              <>
                <div style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 13, letterSpacing: '0.08em' }}>
                  EN PORTADA <span style={{ fontWeight: 600, letterSpacing: 0, color: 'var(--cp-soft)' }}>· destacadas y banners; la carta muestra hasta 5 activas</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
                  {enPortada.map((n, idx) => (
                    <div
                      key={n.id}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                        minWidth: 0,
                        opacity: n.activo ? 1 : 0.6,
                        outline: '3px solid transparent',
                        borderRadius: 22,
                      }}
                    >
                      <div style={{ position: 'relative', aspectRatio: '16/9', borderRadius: 20, overflow: 'hidden', background: 'var(--cp-navy)', color: '#FFFFFF' }}>
                        {n.fotos[0]?.url && (
                          <img src={n.fotos[0].url} alt={n.titulo} style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                        )}
                        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, top: '35%', background: 'linear-gradient(to top, rgba(11,44,62,0.92), rgba(11,44,62,0))' }} />
                        <span style={{ position: 'absolute', right: 10, top: 10, fontSize: 11, fontWeight: 800, background: 'rgba(255,255,255,0.92)', color: '#0B2C3E', borderRadius: 9999, padding: '3px 10px' }}>
                          {n.activo ? 'Activa' : 'Desactivada'}
                        </span>
                        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, display: 'flex', flexDirection: 'column', gap: 5 }}>
                          <span style={{ alignSelf: 'flex-start', fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 11, letterSpacing: '0.08em', background: 'var(--cp-orange)', color: 'var(--cp-navy)', borderRadius: 9999, padding: '4px 10px' }}>
                            {badgeDeNovedad(n)}
                          </span>
                          <span style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 20, lineHeight: 1.15 }}>{n.titulo}</span>
                          <span style={{ fontSize: 14, lineHeight: '19px', opacity: 0.95 }}>{n.texto}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        <button onClick={() => moverNovedad(idx, -1)} aria-label="Mover antes" style={{ width: 44, minHeight: 44, border: '1.5px solid var(--cp-navy)', borderRadius: 10, background: 'var(--cp-white)', color: 'var(--cp-navy)', fontWeight: 800, cursor: 'pointer' }}>←</button>
                        <button onClick={() => moverNovedad(idx, 1)} aria-label="Mover después" style={{ width: 44, minHeight: 44, border: '1.5px solid var(--cp-navy)', borderRadius: 10, background: 'var(--cp-white)', color: 'var(--cp-navy)', fontWeight: 800, cursor: 'pointer' }}>→</button>
                        <button onClick={() => abrirEditar(n)} style={{ flex: '1 1 90px', minHeight: 44, border: 0, borderRadius: 10, background: 'var(--cp-orange)', color: 'var(--cp-navy)', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>Editar</button>
                        <button onClick={() => toggleActivo(n.id)} style={{ flex: '1 1 90px', minHeight: 44, border: '1.5px solid var(--cp-navy)', borderRadius: 10, background: 'var(--cp-white)', color: 'var(--cp-navy)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                          {n.activo ? 'Desactivar' : 'Activar'}
                        </button>
                        <button onClick={() => toggleEnPortada(n.id)} style={{ flex: '1 1 90px', minHeight: 44, border: '1.5px solid var(--cp-navy)', borderRadius: 10, background: 'var(--cp-white)', color: 'var(--cp-navy)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                          ★ Destacada
                        </button>
                        <button onClick={() => duplicar(n)} style={{ flex: '1 1 80px', minHeight: 44, border: '1.5px solid var(--cp-navy)', borderRadius: 10, background: 'var(--cp-white)', color: 'var(--cp-navy)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Duplicar</button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* SECCIÓN NOVEDADES */}
            <div style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 13, letterSpacing: '0.08em' }}>
              NOVEDADES
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {chipsTipoResto.map((c) => {
                const activo = filtroTipo === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setFiltroTipo(c.id)}
                    style={{
                      minHeight: 40,
                      padding: '0 14px',
                      borderRadius: 9999,
                      border: '1.5px solid var(--cp-navy)',
                      background: activo ? 'var(--cp-navy)' : 'transparent',
                      color: activo ? 'var(--cp-cream)' : 'var(--cp-navy)',
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: 'pointer',
                    }}
                  >
                    {c.n}
                  </button>
                );
              })}
            </div>
            {listaRegular.length === 0 && (
              <div style={{ color: 'var(--cp-soft)', fontSize: 14 }}>
                No hay nada en esta sección con los filtros elegidos.
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16, alignItems: 'start' }}>
              {listaRegular.map((n, idx) => {
                const esAviso = n.tipo === 'AVISO';
                return (
                  <div
                    key={n.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                      minWidth: 0,
                      opacity: n.activo ? 1 : 0.6,
                      borderRadius: 22,
                    }}
                  >
                    <div
                      style={{
                        background: esAviso ? 'var(--cp-navy)' : 'var(--cp-white)',
                        color: esAviso ? 'var(--cp-cream)' : 'var(--cp-navy)',
                        border: '1px solid var(--cp-line)',
                        borderRadius: 20,
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                      }}
                    >
                      {n.fotos[0]?.url ? (
                        <div style={{ position: 'relative', aspectRatio: '16/10', background: 'var(--cp-gold)' }}>
                          <img src={n.fotos[0].url} alt={n.titulo} style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                          <span style={{ position: 'absolute', left: 10, top: 10, fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 11, letterSpacing: '0.08em', background: 'var(--cp-orange)', color: 'var(--cp-navy)', borderRadius: 9999, padding: '4px 10px' }}>
                            {badgeDeNovedad(n)}
                          </span>
                          <span style={{ position: 'absolute', right: 10, top: 10, fontSize: 11, fontWeight: 800, background: 'rgba(255,255,255,0.92)', color: '#0B2C3E', borderRadius: 9999, padding: '3px 10px' }}>
                            {n.activo ? 'Activa' : 'Desactivada'}
                          </span>
                          {n.video_url && (
                            <span aria-hidden="true" style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: 56, height: 56, borderRadius: 28, background: 'rgba(11,44,62,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <svg viewBox="0 0 24 24" width="26" height="26" fill="#FFFFFF" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
                            </span>
                          )}
                        </div>
                      ) : (
                        <div
                          style={{
                            position: 'relative',
                            aspectRatio: '16/10',
                            background: esAviso ? 'color-mix(in srgb, var(--cp-line) 55%, var(--cp-white))' : 'var(--cp-gold)',
                            color: 'var(--cp-navy)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 13,
                            fontWeight: 700,
                          }}
                        >
                          <span style={{ position: 'absolute', left: 10, top: 10, fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 11, letterSpacing: '0.08em', background: 'var(--cp-orange)', color: 'var(--cp-navy)', borderRadius: 9999, padding: '4px 10px' }}>
                            {badgeDeNovedad(n)}
                          </span>
                          <span style={{ position: 'absolute', right: 10, top: 10, fontSize: 11, fontWeight: 800, background: 'rgba(255,255,255,0.92)', color: '#0B2C3E', borderRadius: 9999, padding: '3px 10px' }}>
                            {n.activo ? 'Activa' : 'Desactivada'}
                          </span>
                          {n.video_url && (
                            <span aria-hidden="true" style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: 56, height: 56, borderRadius: 28, background: 'rgba(11,44,62,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <svg viewBox="0 0 24 24" width="26" height="26" fill="#FFFFFF" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
                            </span>
                          )}
                        </div>
                      )}
                      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 18, lineHeight: 1.2 }}>{n.titulo}</div>
                        <div style={{ fontSize: 14, lineHeight: '20px', opacity: 0.92, whiteSpace: 'pre-line' }}>{n.texto}</div>
                        {n.evento_fecha && (
                          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--cp-rust)' }}>
                            📅 {new Date(n.evento_fecha).toLocaleDateString()} {n.evento_lugar ? `· 📍 ${n.evento_lugar}` : ''}
                          </div>
                        )}
                        {n.video_url && (
                          <a href={n.video_url} target="_blank" rel="noopener noreferrer" style={{ marginTop: 4, minHeight: 48, borderRadius: 12, background: 'var(--cp-orange)', color: 'var(--cp-navy)', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
                            Ver en TikTok
                          </a>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      <button onClick={() => moverNovedad(idx, -1)} aria-label="Mover antes" style={{ width: 44, minHeight: 44, border: '1.5px solid var(--cp-navy)', borderRadius: 10, background: 'var(--cp-white)', color: 'var(--cp-navy)', fontWeight: 800, cursor: 'pointer' }}>←</button>
                      <button onClick={() => moverNovedad(idx, 1)} aria-label="Mover después" style={{ width: 44, minHeight: 44, border: '1.5px solid var(--cp-navy)', borderRadius: 10, background: 'var(--cp-white)', color: 'var(--cp-navy)', fontWeight: 800, cursor: 'pointer' }}>→</button>
                      <button onClick={() => abrirEditar(n)} style={{ flex: '1 1 90px', minHeight: 44, border: 0, borderRadius: 10, background: 'var(--cp-orange)', color: 'var(--cp-navy)', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>Editar</button>
                      <button onClick={() => toggleActivo(n.id)} style={{ flex: '1 1 90px', minHeight: 44, border: '1.5px solid var(--cp-navy)', borderRadius: 10, background: 'var(--cp-white)', color: 'var(--cp-navy)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                        {n.activo ? 'Desactivar' : 'Activar'}
                      </button>
                      <button onClick={() => toggleEnPortada(n.id)} style={{ flex: '1 1 90px', minHeight: 44, border: '1.5px solid var(--cp-navy)', borderRadius: 10, background: 'var(--cp-white)', color: 'var(--cp-navy)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                        ☆ Destacar
                      </button>
                      <button onClick={() => duplicar(n)} style={{ flex: '1 1 80px', minHeight: 44, border: '1.5px solid var(--cp-navy)', borderRadius: 10, background: 'var(--cp-white)', color: 'var(--cp-navy)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Duplicar</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar Novedad */}
      {editando && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(11,44,62,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div role="dialog" aria-modal="true" aria-label="Editar novedad" style={{ width: 'min(760px, calc(100% - 24px))', maxHeight: 'calc(100vh - 48px)', overflowY: 'auto', background: 'var(--cp-cream)', color: 'var(--cp-navy)', borderRadius: 20, boxShadow: '0 20px 50px rgba(11,44,62,0.4)', padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <div style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 22, lineHeight: '27px' }}>
                {editando.id === 'nueva' ? 'Nueva novedad' : `Editar: ${editando.titulo}`}
              </div>
              <button onClick={() => setEditando(null)} aria-label="Cerrar" style={{ flex: 'none', width: 44, height: 44, borderRadius: 22, border: '1.5px solid var(--cp-navy)', background: 'transparent', color: 'var(--cp-navy)', fontSize: 20, fontWeight: 800, cursor: 'pointer' }}>
                ×
              </button>
            </div>

            {/* Tipo */}
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>Tipo</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {TIPOS_NOVEDAD.map((t) => {
                  const activo = tipoEdit === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setTipoEdit(t.id)}
                      style={{
                        minHeight: 44,
                        padding: '0 12px',
                        borderRadius: 9999,
                        border: '1.5px solid var(--cp-navy)',
                        background: activo ? 'var(--cp-navy)' : 'transparent',
                        color: activo ? 'var(--cp-cream)' : 'var(--cp-navy)',
                        fontWeight: 700,
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                    >
                      {t.n}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Título */}
            <div>
              <label htmlFor="n-t" style={{ fontWeight: 700, fontSize: 13, display: 'block', marginBottom: 4 }}>Título</label>
              <input id="n-t" type="text" value={tituloEdit} onChange={(e) => setTituloEdit(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', minHeight: 44, borderRadius: 10, border: '1.5px solid var(--cp-line)', background: 'var(--cp-white)', color: 'var(--cp-navy)', padding: '0 10px', fontSize: 14 }} />
            </div>

            {/* Etiqueta o tema */}
            <div>
              <label htmlFor="n-e" style={{ fontWeight: 700, fontSize: 13, display: 'block', marginBottom: 4 }}>Etiqueta o tema (opcional)</label>
              <input id="n-e" type="text" value={temaEdit} onChange={(e) => setTemaEdit(e.target.value)} placeholder="Ejemplo: Navidad, Clientes, Aniversario" style={{ width: '100%', boxSizing: 'border-box', minHeight: 44, borderRadius: 10, border: '1.5px solid var(--cp-line)', background: 'var(--cp-white)', color: 'var(--cp-navy)', padding: '0 10px', fontSize: 14 }} />
            </div>

            {/* Si es evento */}
            {tipoEdit === 'EVENTO' && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 140px' }}>
                  <label htmlFor="n-f" style={{ fontWeight: 700, fontSize: 13, display: 'block', marginBottom: 4 }}>Fecha del evento</label>
                  <input id="n-f" type="date" value={fechaEventoEdit} onChange={(e) => setFechaEventoEdit(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', minHeight: 44, borderRadius: 10, border: '1.5px solid var(--cp-line)', background: 'var(--cp-white)', color: 'var(--cp-navy)', padding: '0 10px', fontSize: 14 }} />
                </div>
                <div style={{ flex: '2 1 180px' }}>
                  <label htmlFor="n-lu" style={{ fontWeight: 700, fontSize: 13, display: 'block', marginBottom: 4 }}>Lugar</label>
                  <input id="n-lu" type="text" value={lugarEventoEdit} onChange={(e) => setLugarEventoEdit(e.target.value)} placeholder="Ejemplo: En el local" style={{ width: '100%', boxSizing: 'border-box', minHeight: 44, borderRadius: 10, border: '1.5px solid var(--cp-line)', background: 'var(--cp-white)', color: 'var(--cp-navy)', padding: '0 10px', fontSize: 14 }} />
                </div>
              </div>
            )}

            {/* Texto */}
            <div>
              <label htmlFor="n-x" style={{ fontWeight: 700, fontSize: 13, display: 'block', marginBottom: 4 }}>Texto</label>
              <textarea id="n-x" rows={3} value={textoEdit} onChange={(e) => setTextoEdit(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', borderRadius: 10, border: '1.5px solid var(--cp-line)', background: 'var(--cp-white)', color: 'var(--cp-navy)', padding: 10, fontSize: 14, fontFamily: 'inherit' }} />
            </div>

            {/* Video URL */}
            {tipoEdit === 'VIDEO' && (
              <div>
                <label htmlFor="n-l" style={{ fontWeight: 700, fontSize: 13, display: 'block', marginBottom: 4 }}>Enlace del video (TikTok, Instagram o YouTube)</label>
                <input id="n-l" type="text" value={videoUrlEdit} onChange={(e) => setVideoUrlEdit(e.target.value)} placeholder="https://www.tiktok.com/@caprichos" style={{ width: '100%', boxSizing: 'border-box', minHeight: 44, borderRadius: 10, border: '1.5px solid var(--cp-line)', background: 'var(--cp-white)', color: 'var(--cp-navy)', padding: '0 10px', fontSize: 14 }} />
              </div>
            )}

            {/* Fotos */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ fontWeight: 700, fontSize: 13 }}>Fotos ({fotosEdit.length})</span>
                <label style={{ position: 'relative', minHeight: 44, padding: '0 12px', boxSizing: 'border-box', borderRadius: 10, background: 'var(--cp-orange)', color: 'var(--cp-navy)', fontWeight: 800, fontSize: 12, display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  + Subir foto
                  <input type="file" accept="image/*" onChange={subirFoto} style={{ position: 'absolute', left: -9999 }} />
                </label>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {fotosEdit.map((src, i) => (
                  <span key={i} style={{ position: 'relative', width: 64, height: 64, display: 'block' }}>
                    <img src={src} alt="" style={{ width: 64, height: 64, borderRadius: 10, objectFit: 'cover' }} />
                    <button onClick={() => quitarFotoEdit(i)} aria-label="Quitar foto" style={{ position: 'absolute', right: -6, top: -6, width: 28, height: 28, borderRadius: 14, border: 0, background: 'var(--cp-rust)', color: '#FFFFFF', fontWeight: 800, cursor: 'pointer' }}>×</button>
                  </span>
                ))}
              </div>
            </div>

            {/* Atajos de fecha */}
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>Atajos de fecha</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                <button onClick={() => aplicarAtajoFecha('finde')} style={{ minHeight: 40, padding: '0 12px', borderRadius: 9999, border: '1.5px solid var(--cp-navy)', background: 'transparent', color: 'var(--cp-navy)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Solo este fin de semana</button>
                <button onClick={() => aplicarAtajoFecha('semana')} style={{ minHeight: 40, padding: '0 12px', borderRadius: 9999, border: '1.5px solid var(--cp-navy)', background: 'transparent', color: 'var(--cp-navy)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Toda la semana</button>
                <button onClick={() => aplicarAtajoFecha('mes')} style={{ minHeight: 40, padding: '0 12px', borderRadius: 9999, border: '1.5px solid var(--cp-navy)', background: 'transparent', color: 'var(--cp-navy)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Todo el mes</button>
                <button onClick={() => aplicarAtajoFecha('anio')} style={{ minHeight: 40, padding: '0 12px', borderRadius: 9999, border: '1.5px solid var(--cp-navy)', background: 'transparent', color: 'var(--cp-navy)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Hasta fin de año</button>
              </div>
            </div>

            {/* Rango de fechas */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 140px' }}>
                <label htmlFor="n-d" style={{ fontWeight: 700, fontSize: 13, display: 'block', marginBottom: 4 }}>Se muestra desde</label>
                <input id="n-d" type="date" value={desdeEdit} onChange={(e) => setDesdeEdit(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', minHeight: 44, borderRadius: 10, border: '1.5px solid var(--cp-line)', background: 'var(--cp-white)', color: 'var(--cp-navy)', padding: '0 10px', fontSize: 14 }} />
              </div>
              <div style={{ flex: '1 1 140px' }}>
                <label htmlFor="n-h" style={{ fontWeight: 700, fontSize: 13, display: 'block', marginBottom: 4 }}>Hasta</label>
                <input id="n-h" type="date" value={hastaEdit} onChange={(e) => setHastaEdit(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', minHeight: 44, borderRadius: 10, border: '1.5px solid var(--cp-line)', background: 'var(--cp-white)', color: 'var(--cp-navy)', padding: '0 10px', fontSize: 14 }} />
              </div>
            </div>

            {/* Toggle de activo */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setActivoEdit(!activoEdit)}
                style={{
                  minHeight: 44,
                  padding: '0 16px',
                  borderRadius: 10,
                  border: '1.5px solid var(--cp-navy)',
                  background: activoEdit ? 'var(--cp-navy)' : 'transparent',
                  color: activoEdit ? 'var(--cp-cream)' : 'var(--cp-navy)',
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                {activoEdit ? 'Activa en la carta' : 'Inactiva (oculta)'}
              </button>
            </div>

            <button
              onClick={guardarModalEdicion}
              style={{
                minHeight: 52,
                borderRadius: 12,
                fontFamily: 'var(--fuente-titulos)',
                fontWeight: 800,
                fontSize: 15,
                border: 0,
                background: 'var(--cp-orange)',
                color: 'var(--cp-navy)',
                cursor: 'pointer',
                marginTop: 8,
              }}
            >
              Listo
            </button>
          </div>
        </div>
      )}

      {/* Confirmar publicar */}
      <Confirmar
        abierto={confirmarPublicar}
        titulo="¿Publicar los cambios de novedades?"
        mensaje="Los clientes verán las novedades activas y vigentes en la carta virtual."
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
        mensaje="Volverán los últimos cambios publicados."
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
