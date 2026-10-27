import { useState, useEffect, type ChangeEvent, useMemo } from 'react';
import { api } from '../../comun/api';
import { Cargando } from '../../comun/Cargando';
import { EstadoError } from '../../comun/EstadoError';
import { Confirmar } from '../../comun/Confirmar';
import { normalizarUrlArchivo } from './paletas-constantes';
import { PaginaNovedades, type NovedadCarta } from '../../carta/PaginaNovedades';

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
  tamano: string;
  fotos: FotoNovedad[];
}

interface EncabezadoNovedades {
  etiqueta: string;
  titulo: string;
  subtitulo: string;
}

const ENCABEZADO_DEFAULT: EncabezadoNovedades = {
  etiqueta: 'NOVEDADES',
  titulo: 'Lo nuevo en Caprichos',
  subtitulo: 'Promociones, lanzamientos, datos útiles y lo que pasa en nuestras redes.',
};

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

/** Tamaño del cuadro en la cuadrícula de 4 columnas de la carta (PC). En celular: ver contrato nov. */
const TAMANOS_CUADRO = [
  { id: 'CHICO', n: 'Chico', cols: 1, rows: 1 },
  { id: 'MEDIANO', n: 'Mediano', cols: 2, rows: 1 },
  { id: 'GRANDE', n: 'Grande', cols: 2, rows: 2 },
  { id: 'ANCHO', n: 'Ancho', cols: 4, rows: 1 },
];

function medidaTamano(id: string) {
  return TAMANOS_CUADRO.find((t) => t.id === id) ?? TAMANOS_CUADRO[1];
}

/** Dibujo pequeño de la proporción: cuadrícula de 4 x 2 con el cuadro marcado. */
function DibujoTamano({ cols, rows, activo }: { cols: number; rows: number; activo: boolean }) {
  return (
    <svg viewBox="0 0 28 14" width="28" height="14" aria-hidden="true" focusable="false">
      <rect x="0.5" y="0.5" width="27" height="13" rx="2" fill="none" stroke="currentColor" strokeOpacity="0.35" />
      <rect
        x="0.5"
        y="0.5"
        width={cols * 6.75 - 0.5}
        height={rows * 6.5 - 0.5}
        rx="1.5"
        fill={activo ? 'var(--cp-orange)' : 'currentColor'}
        fillOpacity={activo ? 1 : 0.55}
      />
    </svg>
  );
}

/** Vista previa en vivo: el cuadro elegido dentro de una cuadrícula en miniatura de 4 columnas. */
function VistaTamano({ tamano, titulo }: { tamano: string; titulo: string }) {
  const medida = medidaTamano(tamano);
  return (
    <div style={{ flex: '1 1 220px', maxWidth: 360, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--cp-soft)' }}>Vista previa en la carta (PC, 4 columnas)</span>
      <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gridTemplateRows: 'repeat(2, 56px)' }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <span key={i} style={{ border: '1px dashed var(--cp-line)' }} />
        ))}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: `${medida.cols * 25}%`,
            height: `${medida.rows * 50}%`,
            boxSizing: 'border-box',
            border: '2px solid var(--cp-navy)',
            borderRadius: 8,
            background: 'var(--cp-orange)',
            color: 'var(--cp-navy)',
            padding: 6,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            fontSize: 11,
            fontWeight: 800,
            lineHeight: '14px',
          }}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{titulo || 'Título de la novedad'}</span>
          <span style={{ fontSize: 10, opacity: 0.8 }}>{medida.n}</span>
        </div>
      </div>
    </div>
  );
}

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

  // Conmutador PC / Celular y Modo de Vista
  const [dispositivo, setDispositivo] = useState<'pc' | 'celular'>('pc');
  const [modoVista, setModoVista] = useState<'edicion' | 'previa'>('edicion');

  // Encabezado editable
  const [encabezado, setEncabezado] = useState<EncabezadoNovedades>(ENCABEZADO_DEFAULT);
  const [editandoEncabezado, setEditandoEncabezado] = useState(false);
  const [etiquetaEdit, setEtiquetaEdit] = useState(ENCABEZADO_DEFAULT.etiqueta);
  const [tituloEncEdit, setTituloEncEdit] = useState(ENCABEZADO_DEFAULT.titulo);
  const [subtituloEncEdit, setSubtituloEncEdit] = useState(ENCABEZADO_DEFAULT.subtitulo);
  const [confirmarGuardarEncabezado, setConfirmarGuardarEncabezado] = useState(false);
  const [confirmarRestablecerEncabezado, setConfirmarRestablecerEncabezado] = useState(false);

  // Modal de edición de novedad
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
  const [tamanoEdit, setTamanoEdit] = useState('MEDIANO');
  const [errorEdicionNovedad, setErrorEdicionNovedad] = useState<string | null>(null);

  // Confirmaciones
  const [confirmarPublicar, setConfirmarPublicar] = useState(false);
  const [confirmarDescartar, setConfirmarDescartar] = useState(false);
  const [guardandoAccion, setGuardandoAccion] = useState(false);
  const [novedadAEliminar, setNovedadAEliminar] = useState<NovedadAdmin | null>(null);

  const cargarDatos = async () => {
    setCargando(true);
    setError(null);
    try {
      const [data, dataEnc] = await Promise.all([
        api.get<NovedadAdmin[]>('/admin/contenido/novedades'),
        api.get<{
          encabezado: EncabezadoNovedades;
          publicado: EncabezadoNovedades;
          tieneBorrador: boolean;
        }>('/admin/contenido/novedades/encabezado').catch(() => null),
      ]);
      setNovedades(
        data.map((n) => ({
          ...n,
          fotos: (n.fotos || []).map((f) => ({
            ...f,
            url: normalizarUrlArchivo(f.url) || f.url,
          })),
        })),
      );
      if (dataEnc?.encabezado) {
        setEncabezado(dataEnc.encabezado);
        setEtiquetaEdit(dataEnc.encabezado.etiqueta || ENCABEZADO_DEFAULT.etiqueta);
        setTituloEncEdit(dataEnc.encabezado.titulo || ENCABEZADO_DEFAULT.titulo);
        setSubtituloEncEdit(dataEnc.encabezado.subtitulo || ENCABEZADO_DEFAULT.subtitulo);
        if (dataEnc.tieneBorrador) {
          setDirty(true);
        }
      }
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
  const moverNovedad = (id: string, dir: -1 | 1) => {
    const idx = novedades.findIndex((n) => n.id === id);
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
        tamano: n.tamano,
        fotos: n.fotos.map((f) => f.url),
      });
      await cargarDatos();
      setMensaje('Novedad duplicada (creada como inactiva)');
      setTimeout(() => setMensaje(null), 3000);
    } catch (err: any) {
      setMensaje(err?.message || 'Error al duplicar novedad');
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
      tamano: 'MEDIANO',
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
    setTamanoEdit('MEDIANO');
    setFotosEdit([]);
    setErrorEdicionNovedad(null);
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
    setTamanoEdit(n.tamano || 'MEDIANO');
    setFotosEdit(n.fotos.map((f) => f.url));
    setErrorEdicionNovedad(null);
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
      setErrorEdicionNovedad('El título es obligatorio');
      return;
    }
    setErrorEdicionNovedad(null);
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
      tamano: tamanoEdit,
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
      setErrorEdicionNovedad(err?.message || 'Error al guardar la novedad');
    }
  };

  const pedirEliminar = (n: NovedadAdmin) => {
    setEditando(null);
    setNovedadAEliminar(n);
  };

  const ejecutarEliminar = async () => {
    if (!novedadAEliminar) return;
    setGuardandoAccion(true);
    try {
      await api.delete(`/admin/contenido/novedades/${novedadAEliminar.id}`);
      setNovedadAEliminar(null);
      await cargarDatos();
      setMensaje('Novedad eliminada');
      setTimeout(() => setMensaje(null), 3000);
    } catch (err: any) {
      setMensaje(err?.message || 'Error al eliminar la novedad');
    } finally {
      setGuardandoAccion(false);
    }
  };

  // Manejo del encabezado de novedades
  const abrirEditorEncabezado = () => {
    setEtiquetaEdit(encabezado.etiqueta);
    setTituloEncEdit(encabezado.titulo);
    setSubtituloEncEdit(encabezado.subtitulo);
    setEditandoEncabezado(true);
  };

  const ejecutarGuardarEncabezado = async () => {
    setGuardandoAccion(true);
    try {
      const payload: EncabezadoNovedades = {
        etiqueta: etiquetaEdit.trim() || ENCABEZADO_DEFAULT.etiqueta,
        titulo: tituloEncEdit.trim() || ENCABEZADO_DEFAULT.titulo,
        subtitulo: subtituloEncEdit.trim() || ENCABEZADO_DEFAULT.subtitulo,
      };
      await api.put('/admin/contenido/novedades/encabezado', payload);
      setEncabezado(payload);
      setEditandoEncabezado(false);
      setConfirmarGuardarEncabezado(false);
      marcarModificado();
      setMensaje('Borrador del encabezado guardado');
      setTimeout(() => setMensaje(null), 3000);
    } catch (err: any) {
      setMensaje(err?.message || 'Error al guardar el encabezado');
    } finally {
      setGuardandoAccion(false);
    }
  };

  const ejecutarRestablecerEncabezado = async () => {
    setGuardandoAccion(true);
    try {
      await api.put('/admin/contenido/novedades/encabezado', ENCABEZADO_DEFAULT);
      setEncabezado(ENCABEZADO_DEFAULT);
      setEtiquetaEdit(ENCABEZADO_DEFAULT.etiqueta);
      setTituloEncEdit(ENCABEZADO_DEFAULT.titulo);
      setSubtituloEncEdit(ENCABEZADO_DEFAULT.subtitulo);
      setEditandoEncabezado(false);
      setConfirmarRestablecerEncabezado(false);
      marcarModificado();
      setMensaje('Encabezado restablecido a valores por defecto');
      setTimeout(() => setMensaje(null), 3000);
    } catch (err: any) {
      setMensaje(err?.message || 'Error al restablecer encabezado');
    } finally {
      setGuardandoAccion(false);
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
      setMensaje('¡Novedades y encabezado publicados en la carta!');
      setTimeout(() => setMensaje(null), 4000);
    } catch (err: any) {
      setMensaje(err?.message || 'Error al publicar novedades');
    } finally {
      setGuardandoAccion(false);
    }
  };

  const ejecutarDescartar = async () => {
    setGuardandoAccion(true);
    try {
      await api.post('/admin/contenido/novedades/descartar', {}).catch(() => null);
      await cargarDatos();
      setDirty(false);
      setConfirmarDescartar(false);
      setMensaje('Cambios descartados');
      setTimeout(() => setMensaje(null), 3000);
    } catch (err: any) {
      setMensaje(err?.message || 'Error al descartar');
    } finally {
      setGuardandoAccion(false);
    }
  };

  // Novedades para previsualización fiel (formato NovedadCarta)
  const novedadesParaPrevia: NovedadCarta[] = useMemo(() => {
    return novedades.map((n) => ({
      id: n.id,
      tipo: n.tipo,
      titulo: n.titulo,
      texto: n.texto || undefined,
      tema: n.tema || undefined,
      video_url: n.video_url || undefined,
      evento_fecha: n.evento_fecha || undefined,
      evento_lugar: n.evento_lugar || undefined,
      tamano: n.tamano,
      orden: n.orden,
      activo: n.activo,
      fotos: n.fotos.map((f) => ({ id: f.id, url: f.url })),
    }));
  }, [novedades]);

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

  const esCelular = dispositivo === 'celular';

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
          Se abre en pantalla completa y muestra la página <b>Novedades</b> exactamente como la ve el cliente. Permite personalizar el encabezado de la sección, agregar promociones, banners, fotos, eventos, videos y avisos con conmutador PC y celular fiel a la carta pública.
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
          {mensaje && <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--cp-rust)' }}>{mensaje}</span>}
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
              gap: '8px 12px',
            }}
          >
            <span style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 13, letterSpacing: '0.06em' }}>
              DISEÑADOR DE NOVEDADES
            </span>

            {/* Conmutador Modo Vista */}
            <div style={{ display: 'flex', gap: 4, alignItems: 'center', border: '1.5px solid var(--cp-cream)', borderRadius: 9999, padding: 2 }}>
              <button
                type="button"
                onClick={() => setModoVista('edicion')}
                style={{
                  minHeight: 34,
                  padding: '0 12px',
                  borderRadius: 9999,
                  border: 0,
                  background: modoVista === 'edicion' ? 'var(--cp-orange)' : 'transparent',
                  color: modoVista === 'edicion' ? 'var(--cp-navy)' : 'var(--cp-cream)',
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                Edición
              </button>
              <button
                type="button"
                onClick={() => setModoVista('previa')}
                style={{
                  minHeight: 34,
                  padding: '0 12px',
                  borderRadius: 9999,
                  border: 0,
                  background: modoVista === 'previa' ? 'var(--cp-orange)' : 'transparent',
                  color: modoVista === 'previa' ? 'var(--cp-navy)' : 'var(--cp-cream)',
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                Vista previa carta
              </button>
            </div>

            {/* Conmutador Dispositivo PC / Celular */}
            <div style={{ display: 'flex', gap: 4, alignItems: 'center', border: '1.5px solid var(--cp-cream)', borderRadius: 9999, padding: 2 }}>
              <button
                type="button"
                data-testid="btn-novedades-disp-pc"
                onClick={() => setDispositivo('pc')}
                style={{
                  minHeight: 34,
                  padding: '0 12px',
                  borderRadius: 9999,
                  border: 0,
                  background: !esCelular ? 'var(--cp-orange)' : 'transparent',
                  color: !esCelular ? 'var(--cp-navy)' : 'var(--cp-cream)',
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                PC
              </button>
              <button
                type="button"
                data-testid="btn-novedades-disp-celular"
                onClick={() => setDispositivo('celular')}
                style={{
                  minHeight: 34,
                  padding: '0 12px',
                  borderRadius: 9999,
                  border: 0,
                  background: esCelular ? 'var(--cp-orange)' : 'transparent',
                  color: esCelular ? 'var(--cp-navy)' : 'var(--cp-cream)',
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                Celular
              </button>
            </div>

            {modoVista === 'edicion' && (
              <>
                <button
                  onClick={() => abrirCrear('PROMOCION')}
                  style={{
                    minHeight: 38,
                    padding: '0 14px',
                    border: 0,
                    borderRadius: 10,
                    background: 'var(--cp-orange)',
                    color: 'var(--cp-navy)',
                    fontWeight: 800,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  + Nueva novedad
                </button>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                  {CHIPS_AGREGAR.map((t, idx) => (
                    <button
                      key={`${t.id}-${idx}`}
                      type="button"
                      onClick={() => abrirCrear(t.id)}
                      style={{
                        minHeight: 32,
                        padding: '0 10px',
                        borderRadius: 9999,
                        border: '1.5px dashed var(--cp-cream)',
                        background: 'transparent',
                        color: 'var(--cp-cream)',
                        fontWeight: 700,
                        fontSize: 11,
                        cursor: 'pointer',
                      }}
                    >
                      + {t.n}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  data-testid="btn-editar-encabezado"
                  onClick={abrirEditorEncabezado}
                  style={{
                    minHeight: 38,
                    padding: '0 14px',
                    borderRadius: 10,
                    border: '1.5px solid var(--cp-cream)',
                    background: 'transparent',
                    color: 'var(--cp-cream)',
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  Editar encabezado
                </button>
              </>
            )}

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
                minHeight: 38,
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
                minHeight: 38,
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
                minHeight: 38,
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

          {/* VISTA PREVIA FIEL DE LA CARTA (Reutiliza PaginaNovedades exactamente) */}
          {modoVista === 'previa' ? (
            <div
              style={{
                padding: esCelular ? '24px 12px 64px' : '24px 24px 64px',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'flex-start',
              }}
            >
              <div
                data-testid={`preview-novedades-${dispositivo}`}
                style={{
                  width: esCelular ? '390px' : '100%',
                  maxWidth: esCelular ? '390px' : '1200px',
                  minHeight: esCelular ? '640px' : '400px',
                  border: esCelular ? '8px solid var(--cp-navy)' : '1px solid var(--cp-line)',
                  borderRadius: esCelular ? '28px' : '16px',
                  background: 'var(--cp-cream)',
                  boxShadow: esCelular
                    ? '0 14px 40px rgba(11, 44, 62, 0.25)'
                    : '0 6px 20px rgba(11, 44, 62, 0.08)',
                  boxSizing: 'border-box',
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                {/* Notch en celular */}
                {esCelular && (
                  <div
                    style={{
                      width: '120px',
                      height: '14px',
                      backgroundColor: 'var(--cp-navy)',
                      borderRadius: '0 0 10px 10px',
                      margin: '0 auto 8px',
                    }}
                  />
                )}
                <PaginaNovedades
                  novedades={novedadesParaPrevia}
                  encabezado={encabezado}
                  onVerCarta={() => {}}
                />
              </div>
            </div>
          ) : (
            /* MODO EDICIÓN CON LIENZO INTERACTIVO */
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                padding: esCelular ? '16px 8px 60px' : '16px 24px 60px',
              }}
            >
              <div
                style={{
                  width: esCelular ? '430px' : '100%',
                  maxWidth: esCelular ? '430px' : '1200px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                  border: esCelular ? '2px dashed var(--cp-line)' : 'none',
                  borderRadius: esCelular ? 24 : 0,
                  padding: esCelular ? 12 : 0,
                  boxSizing: 'border-box',
                }}
              >
                {/* Filtros de visualización por estado */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.06em', color: 'var(--cp-soft)' }}>
                    MOSTRAR:
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
                          minHeight: 36,
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

                {/* Cabecera hero réplica del cliente (con textos editables) */}
                <div
                  data-testid="hero-encabezado-novedades"
                  style={{
                    position: 'relative',
                    overflow: 'hidden',
                    background: 'linear-gradient(155deg, var(--cp-navy) 55%, color-mix(in srgb, var(--cp-navy) 65%, var(--cp-orange)))',
                    color: 'var(--cp-cream)',
                    borderRadius: 20,
                    padding: esCelular ? '18px 16px' : '24px 28px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  <span aria-hidden="true" style={{ position: 'absolute', right: -50, top: -50, width: 180, height: 180, borderRadius: '50%', background: 'var(--cp-orange)', opacity: 0.16 }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <span
                      data-testid="encabezado-etiqueta"
                      style={{
                        position: 'relative',
                        fontFamily: 'var(--fuente-titulos)',
                        fontWeight: 800,
                        fontSize: 12,
                        letterSpacing: '0.12em',
                        color: 'var(--cp-orange)',
                      }}
                    >
                      {encabezado.etiqueta}
                    </span>
                    <button
                      type="button"
                      onClick={abrirEditorEncabezado}
                      style={{
                        border: '1px solid var(--cp-orange)',
                        borderRadius: 8,
                        background: 'transparent',
                        color: 'var(--cp-orange)',
                        padding: '4px 10px',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Editar textos
                    </button>
                  </div>
                  <span
                    data-testid="encabezado-titulo"
                    style={{
                      position: 'relative',
                      fontFamily: 'var(--fuente-titulos)',
                      fontWeight: 800,
                      fontSize: esCelular ? 22 : 28,
                      lineHeight: esCelular ? '28px' : '34px',
                    }}
                  >
                    {encabezado.titulo}
                  </span>
                  <span
                    data-testid="encabezado-subtitulo"
                    style={{
                      position: 'relative',
                      fontSize: esCelular ? 13 : 15,
                      lineHeight: '21px',
                      maxWidth: 720,
                      opacity: 0.95,
                    }}
                  >
                    {encabezado.subtitulo}
                  </span>
                </div>

                {/* SECCIÓN EN PORTADA (Banners) */}
                {enPortada.length > 0 && (
                  <>
                    <div style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 13, letterSpacing: '0.08em' }}>
                      EN PORTADA <span style={{ fontWeight: 600, letterSpacing: 0, color: 'var(--cp-soft)' }}>· hasta 5 activas en la carta</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: esCelular ? '1fr' : 'repeat(auto-fill, minmax(min(340px, 100%), 1fr))', gap: 16 }}>
                      {enPortada.map((n) => (
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
                              <span style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 18, lineHeight: 1.15 }}>{n.titulo}</span>
                              <span style={{ fontSize: 13, lineHeight: '18px', opacity: 0.95 }}>{n.texto}</span>
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            <button onClick={() => moverNovedad(n.id, -1)} aria-label="Subir" style={{ width: 44, minHeight: 44, border: '1.5px solid var(--cp-navy)', borderRadius: 10, background: 'var(--cp-white)', color: 'var(--cp-navy)', fontWeight: 800, cursor: 'pointer' }}>↑</button>
                            <button onClick={() => moverNovedad(n.id, 1)} aria-label="Bajar" style={{ width: 44, minHeight: 44, border: '1.5px solid var(--cp-navy)', borderRadius: 10, background: 'var(--cp-white)', color: 'var(--cp-navy)', fontWeight: 800, cursor: 'pointer' }}>↓</button>
                            <button onClick={() => abrirEditar(n)} style={{ flex: '1 1 90px', minHeight: 44, border: 0, borderRadius: 10, background: 'var(--cp-orange)', color: 'var(--cp-navy)', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>Editar</button>
                            <button onClick={() => toggleActivo(n.id)} style={{ flex: '1 1 90px', minHeight: 44, border: '1.5px solid var(--cp-navy)', borderRadius: 10, background: 'var(--cp-white)', color: 'var(--cp-navy)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                              {n.activo ? 'Desactivar' : 'Activar'}
                            </button>
                            <button onClick={() => toggleEnPortada(n.id)} style={{ flex: '1 1 90px', minHeight: 44, border: '1.5px solid var(--cp-navy)', borderRadius: 10, background: 'var(--cp-white)', color: 'var(--cp-navy)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                              Destacada
                            </button>
                            <button onClick={() => duplicar(n)} style={{ flex: '1 1 80px', minHeight: 44, border: '1.5px solid var(--cp-navy)', borderRadius: 10, background: 'var(--cp-white)', color: 'var(--cp-navy)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Duplicar</button>
                            <button onClick={() => pedirEliminar(n)} style={{ flex: '1 1 80px', minHeight: 44, border: '1.5px solid var(--cp-rust)', borderRadius: 10, background: 'var(--cp-white)', color: 'var(--cp-rust)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Eliminar</button>
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
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: esCelular ? '1fr' : 'repeat(auto-fill, minmax(min(340px, 100%), 1fr))',
                    gap: 16,
                    alignItems: 'start',
                  }}
                >
                  {listaRegular.map((n) => {
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
                            </div>
                          )}
                          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <div style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 18, lineHeight: 1.2 }}>{n.titulo}</div>
                            <div style={{ fontSize: 14, lineHeight: '20px', opacity: 0.92, whiteSpace: 'pre-line' }}>{n.texto}</div>
                            {n.evento_fecha && (
                              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--cp-rust)' }}>
                                Fecha: {new Date(n.evento_fecha).toLocaleDateString()} {n.evento_lugar ? `· ${n.evento_lugar}` : ''}
                              </div>
                            )}
                            {n.video_url && (
                              <a href={n.video_url} target="_blank" rel="noopener noreferrer" style={{ marginTop: 4, minHeight: 44, borderRadius: 12, background: 'var(--cp-orange)', color: 'var(--cp-navy)', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
                                Ver video
                              </a>
                            )}
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          <button onClick={() => moverNovedad(n.id, -1)} aria-label="Subir" style={{ width: 44, minHeight: 44, border: '1.5px solid var(--cp-navy)', borderRadius: 10, background: 'var(--cp-white)', color: 'var(--cp-navy)', fontWeight: 800, cursor: 'pointer' }}>↑</button>
                          <button onClick={() => moverNovedad(n.id, 1)} aria-label="Bajar" style={{ width: 44, minHeight: 44, border: '1.5px solid var(--cp-navy)', borderRadius: 10, background: 'var(--cp-white)', color: 'var(--cp-navy)', fontWeight: 800, cursor: 'pointer' }}>↓</button>
                          <button onClick={() => abrirEditar(n)} style={{ flex: '1 1 90px', minHeight: 44, border: 0, borderRadius: 10, background: 'var(--cp-orange)', color: 'var(--cp-navy)', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>Editar</button>
                          <button onClick={() => toggleActivo(n.id)} style={{ flex: '1 1 90px', minHeight: 44, border: '1.5px solid var(--cp-navy)', borderRadius: 10, background: 'var(--cp-white)', color: 'var(--cp-navy)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                            {n.activo ? 'Desactivar' : 'Activar'}
                          </button>
                          <button onClick={() => toggleEnPortada(n.id)} style={{ flex: '1 1 90px', minHeight: 44, border: '1.5px solid var(--cp-navy)', borderRadius: 10, background: 'var(--cp-white)', color: 'var(--cp-navy)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                            Destacar
                          </button>
                          <button onClick={() => duplicar(n)} style={{ flex: '1 1 80px', minHeight: 44, border: '1.5px solid var(--cp-navy)', borderRadius: 10, background: 'var(--cp-white)', color: 'var(--cp-navy)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Duplicar</button>
                          <button onClick={() => pedirEliminar(n)} style={{ flex: '1 1 80px', minHeight: 44, border: '1.5px solid var(--cp-rust)', borderRadius: 10, background: 'var(--cp-white)', color: 'var(--cp-rust)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Eliminar</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
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

            {errorEdicionNovedad && (
              <div style={{ background: '#FDE8E8', color: 'var(--cp-rust)', padding: '10px 14px', borderRadius: 8, fontSize: 13, fontWeight: 700 }}>
                {errorEdicionNovedad}
              </div>
            )}

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
              <input id="n-e" type="text" value={temaEdit} onChange={(e) => setTemaEdit(e.target.value)} placeholder="Ejemplo: Promoción, Menú, Aniversario" style={{ width: '100%', boxSizing: 'border-box', minHeight: 44, borderRadius: 10, border: '1.5px solid var(--cp-line)', background: 'var(--cp-white)', color: 'var(--cp-navy)', padding: '0 10px', fontSize: 14 }} />
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
                <label htmlFor="n-l" style={{ fontWeight: 700, fontSize: 13, display: 'block', marginBottom: 4 }}>Enlace del video</label>
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

            {/* Tamaño del cuadro */}
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Tamaño del cuadro</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-start' }}>
                <div role="radiogroup" aria-label="Tamaño del cuadro" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, flex: '1 1 260px', minWidth: 0 }}>
                  {TAMANOS_CUADRO.map((t) => {
                    const activo = tamanoEdit === t.id;
                    return (
                      <button
                        key={t.id}
                        role="radio"
                        aria-checked={activo}
                        onClick={() => setTamanoEdit(t.id)}
                        style={{
                          minHeight: 44,
                          padding: '0 14px 0 10px',
                          borderRadius: 9999,
                          border: '1.5px solid var(--cp-navy)',
                          background: activo ? 'var(--cp-navy)' : 'transparent',
                          color: activo ? 'var(--cp-cream)' : 'var(--cp-navy)',
                          fontWeight: 700,
                          fontSize: 13,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                        }}
                      >
                        <DibujoTamano cols={t.cols} rows={t.rows} activo={activo} />
                        {t.n}
                      </button>
                    );
                  })}
                </div>
                <VistaTamano tamano={tamanoEdit} titulo={tituloEdit} />
              </div>
            </div>

            {/* Atajos de fecha */}
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>Atajos de fecha</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                <button onClick={() => aplicarAtajoFecha('finde')} style={{ minHeight: 44, padding: '0 12px', borderRadius: 9999, border: '1.5px solid var(--cp-navy)', background: 'transparent', color: 'var(--cp-navy)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Solo este fin de semana</button>
                <button onClick={() => aplicarAtajoFecha('semana')} style={{ minHeight: 44, padding: '0 12px', borderRadius: 9999, border: '1.5px solid var(--cp-navy)', background: 'transparent', color: 'var(--cp-navy)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Toda la semana</button>
                <button onClick={() => aplicarAtajoFecha('mes')} style={{ minHeight: 44, padding: '0 12px', borderRadius: 9999, border: '1.5px solid var(--cp-navy)', background: 'transparent', color: 'var(--cp-navy)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Todo el mes</button>
                <button onClick={() => aplicarAtajoFecha('anio')} style={{ minHeight: 44, padding: '0 12px', borderRadius: 9999, border: '1.5px solid var(--cp-navy)', background: 'transparent', color: 'var(--cp-navy)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Hasta fin de año</button>
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

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
              {editando.id !== 'nueva' && (
                <button
                  onClick={() => pedirEliminar(editando)}
                  style={{
                    minHeight: 52,
                    padding: '0 18px',
                    borderRadius: 12,
                    border: '1.5px solid var(--cp-rust)',
                    background: 'transparent',
                    color: 'var(--cp-rust)',
                    fontWeight: 800,
                    fontSize: 15,
                    cursor: 'pointer',
                  }}
                >
                  Eliminar
                </button>
              )}
              <button
                onClick={guardarModalEdicion}
                style={{
                  flex: '1 1 160px',
                  minHeight: 52,
                  borderRadius: 12,
                  fontFamily: 'var(--fuente-titulos)',
                  fontWeight: 800,
                  fontSize: 15,
                  border: 0,
                  background: 'var(--cp-orange)',
                  color: 'var(--cp-navy)',
                  cursor: 'pointer',
                }}
              >
                Listo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar Encabezado de Novedades */}
      {editandoEncabezado && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 125, background: 'rgba(11,44,62,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div role="dialog" aria-modal="true" aria-label="Editar encabezado de Novedades" style={{ width: 'min(580px, calc(100% - 24px))', background: 'var(--cp-white)', color: 'var(--cp-navy)', borderRadius: 20, boxShadow: '0 20px 50px rgba(11,44,62,0.4)', padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 20 }}>
                Editar encabezado de Novedades
              </div>
              <button
                type="button"
                onClick={() => setEditandoEncabezado(false)}
                aria-label="Cerrar"
                style={{ width: 36, height: 36, borderRadius: 18, border: '1.5px solid var(--cp-line)', background: 'transparent', fontWeight: 800, cursor: 'pointer' }}
              >
                ×
              </button>
            </div>

            <div style={{ fontSize: 13, color: 'var(--cp-soft)' }}>
              Personaliza los tres textos que encabezan la sección Novedades de la carta virtual. Si dejas un campo vacío, se utilizará su valor por defecto.
            </div>

            {/* Campo Etiqueta */}
            <div>
              <label htmlFor="enc-etiqueta" style={{ fontWeight: 700, fontSize: 13, display: 'block', marginBottom: 4 }}>
                Etiqueta pequeña (máx. 40 letras)
              </label>
              <input
                id="enc-etiqueta"
                data-testid="input-encabezado-etiqueta"
                type="text"
                maxLength={40}
                value={etiquetaEdit}
                onChange={(e) => setEtiquetaEdit(e.target.value)}
                placeholder={ENCABEZADO_DEFAULT.etiqueta}
                style={{ width: '100%', boxSizing: 'border-box', minHeight: 44, borderRadius: 10, border: '1.5px solid var(--cp-line)', padding: '0 12px', fontSize: 14 }}
              />
            </div>

            {/* Campo Título */}
            <div>
              <label htmlFor="enc-titulo" style={{ fontWeight: 700, fontSize: 13, display: 'block', marginBottom: 4 }}>
                Título principal (máx. 100 letras)
              </label>
              <input
                id="enc-titulo"
                data-testid="input-encabezado-titulo"
                type="text"
                maxLength={100}
                value={tituloEncEdit}
                onChange={(e) => setTituloEncEdit(e.target.value)}
                placeholder={ENCABEZADO_DEFAULT.titulo}
                style={{ width: '100%', boxSizing: 'border-box', minHeight: 44, borderRadius: 10, border: '1.5px solid var(--cp-line)', padding: '0 12px', fontSize: 14 }}
              />
            </div>

            {/* Campo Subtítulo */}
            <div>
              <label htmlFor="enc-subtitulo" style={{ fontWeight: 700, fontSize: 13, display: 'block', marginBottom: 4 }}>
                Subtítulo explicativo (máx. 250 letras)
              </label>
              <textarea
                id="enc-subtitulo"
                data-testid="input-encabezado-subtitulo"
                rows={3}
                maxLength={250}
                value={subtituloEncEdit}
                onChange={(e) => setSubtituloEncEdit(e.target.value)}
                placeholder={ENCABEZADO_DEFAULT.subtitulo}
                style={{ width: '100%', boxSizing: 'border-box', borderRadius: 10, border: '1.5px solid var(--cp-line)', padding: 10, fontSize: 14, fontFamily: 'inherit' }}
              />
            </div>

            {/* Botones de acción */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between', marginTop: 8 }}>
              <button
                type="button"
                data-testid="btn-restablecer-encabezado"
                onClick={() => setConfirmarRestablecerEncabezado(true)}
                style={{
                  minHeight: 44,
                  padding: '0 14px',
                  borderRadius: 10,
                  border: '1.5px solid var(--cp-line)',
                  background: 'transparent',
                  color: 'var(--cp-rust)',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Restablecer por defecto
              </button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setEditandoEncabezado(false)}
                  style={{
                    minHeight: 44,
                    padding: '0 16px',
                    borderRadius: 10,
                    border: '1.5px solid var(--cp-line)',
                    background: 'transparent',
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  data-testid="btn-guardar-encabezado"
                  onClick={() => setConfirmarGuardarEncabezado(true)}
                  style={{
                    minHeight: 44,
                    padding: '0 20px',
                    borderRadius: 10,
                    border: 0,
                    background: 'var(--cp-orange)',
                    color: 'var(--cp-navy)',
                    fontFamily: 'var(--fuente-titulos)',
                    fontWeight: 800,
                    fontSize: 14,
                    cursor: 'pointer',
                  }}
                >
                  Guardar borrador
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmar Guardar Encabezado */}
      <Confirmar
        abierto={confirmarGuardarEncabezado}
        titulo="¿Guardar cambios en el encabezado?"
        mensaje="Se actualizará el borrador con los nuevos textos. Los clientes los verán al pulsar Publicar cambios."
        textoConfirmar="Sí, guardar"
        textoNo="No, seguir editando"
        cargando={guardandoAccion}
        alConfirmar={ejecutarGuardarEncabezado}
        alCancelar={() => setConfirmarGuardarEncabezado(false)}
      />

      {/* Confirmar Restablecer Encabezado */}
      <Confirmar
        abierto={confirmarRestablecerEncabezado}
        titulo="¿Restablecer encabezado por defecto?"
        mensaje="Los tres textos volverán a sus valores de fábrica originales."
        textoConfirmar="Sí, restablecer"
        textoNo="No, mantener actuales"
        peligro
        cargando={guardandoAccion}
        alConfirmar={ejecutarRestablecerEncabezado}
        alCancelar={() => setConfirmarRestablecerEncabezado(false)}
      />

      {/* Confirmar publicar */}
      <Confirmar
        abierto={confirmarPublicar}
        titulo="¿Publicar los cambios de novedades?"
        mensaje="Los clientes verán las novedades activas y el encabezado actualizado en la carta virtual."
        textoConfirmar="Sí, publicar"
        textoNo="No, seguir editando"
        cargando={guardandoAccion}
        alConfirmar={ejecutarPublicar}
        alCancelar={() => setConfirmarPublicar(false)}
      />

      {/* Confirmar eliminar */}
      <Confirmar
        abierto={novedadAEliminar !== null}
        titulo="¿Eliminar esta novedad?"
        mensaje="Se quita de la carta y no se puede deshacer."
        textoConfirmar="Sí, eliminar"
        textoNo="No, conservarla"
        peligro
        cargando={guardandoAccion}
        alConfirmar={ejecutarEliminar}
        alCancelar={() => setNovedadAEliminar(null)}
      />

      {/* Confirmar descartar */}
      <Confirmar
        abierto={confirmarDescartar}
        titulo="¿Descartar los cambios sin publicar?"
        mensaje="Volverán los últimos cambios publicados de novedades y del encabezado."
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
