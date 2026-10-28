import { useState, useEffect, type ChangeEvent, useMemo } from 'react';
import { api } from '../../comun/api';
import { Cargando } from '../../comun/Cargando';
import { EstadoError } from '../../comun/EstadoError';
import { Confirmar } from '../../comun/Confirmar';
import { DecoracionAnimada } from '../../carta/contenido/DecoracionAnimada';
import { PAL_DEFAULT, normalizarUrlArchivo } from './paletas-constantes';
import { CartaVistaPrevia } from '../../carta/CartaPublica';
import type { VistaPreviaCarta, ContenidoCarta } from '../../carta/CartaPublica';
import { DISPOSICION_DEFECTO, resolverDisposicion } from '../../carta/disposicion';
import type { DisposicionCarta } from '../../carta/disposicion';
import { DisposicionControles } from './DisposicionControles';
import type { CategoriaCarta, DatosLocalCarta, EstadoLocalCarta } from '../../carta/tipos';
import type { OfertaItem } from '../ofertas/ofertasApi';

interface CategoriaAdmin {
  id: string;
  nombre: string;
  orden: number;
  oculto: boolean;
}

interface ProductoAdmin {
  id: string;
  categoriaId: string;
  nombre: string;
  descripcion: string | null;
  precio: number;
  orden: number;
  oculto: boolean;
  fotoUrl: string | null;
}

interface PromoData {
  tag: string;
  title: string;
  sub: string;
  price: string;
  old?: string;
  badge?: string;
  theme?: string;
  photo?: string;
  target?: string;
}

const TEMAS_INFO: Record<string, { n: string; bg: string; fg: string; sample: string }> = {
  ninguno: { n: 'Sin decoración', bg: 'var(--cp-line)', fg: 'var(--cp-navy)', sample: 'Estilo clásico' },
  halloween: { n: 'Halloween', bg: '#2B1B3F', fg: '#F6A04D', sample: 'Naranja y morado' },
  navidad: { n: 'Navidad', bg: '#1F6B3A', fg: '#FFFFFF', sample: 'Pino y rojo festivo' },
  anonuevo: { n: 'Año Nuevo', bg: '#1A1A2E', fg: '#F5C84B', sample: 'Dorado y confeti' },
  sanvalentin: { n: 'San Valentín', bg: '#B83A5B', fg: '#FFFFFF', sample: 'Rosas y corazones' },
  madre: { n: 'Día de la Madre', bg: '#D77FA1', fg: '#FFFFFF', sample: 'Flores y tonos pastel' },
  padre: { n: 'Día del Padre', bg: 'var(--cp-soft)', fg: 'var(--cp-cream)', sample: 'Azul y tonos sobrios' },
  patrias: { n: 'Fiestas Patrias', bg: '#C8102E', fg: '#FFFFFF', sample: 'Rojo y blanco' },
  ninos: { n: 'Día del Niño', bg: 'var(--cp-gold)', fg: 'var(--cp-navy)', sample: 'Amarillo festivo' },
  aniversario: { n: 'Aniversario', bg: 'var(--cp-orange)', fg: 'var(--cp-navy)', sample: 'Dorado y fiesta' },
};

const LAYOUTS = [
  { id: 'secciones', n: 'Secciones en cuadrícula', d: 'Como está hoy: cada categoría con su título y varias tarjetas por fila.' },
  { id: 'lista', n: 'Lista', d: 'Una tarjeta por fila, con la foto pequeña a la izquierda. Ideal para leer rápido.' },
  { id: 'grande', n: 'Tarjetas grandes', d: 'Fotos grandes, pocas tarjetas por fila. Ideal para vender con la imagen.' },
];

export function DisenadorView() {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [tieneBorrador, setTieneBorrador] = useState(false);
  const [dzFull, setDzFull] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);

  // Conmutador PC / Celular y Modo de Vista
  const [dispositivo, setDispositivo] = useState<'pc' | 'celular'>('pc');
  const [modoVista, setModoVista] = useState<'edicion' | 'previa'>('edicion');

  const [layout, setLayout] = useState<'secciones' | 'lista' | 'grande'>('secciones');
  const [theme, setTheme] = useState('ninguno');
  const [banner, setBanner] = useState({
    activo: true,
    tag: 'NOVEDAD DEL MES',
    title: 'Frappe Maracuyá Tropical',
    sub: 'Con pulpa natural de maracuyá y crema batida.',
  });
  const [promos, setPromos] = useState<PromoData[]>([]);
  const [disposicion, setDisposicion] = useState<DisposicionCarta>(DISPOSICION_DEFECTO);
  // Datos publicados (novedades, momentos, ranking, franja) que la vista previa necesita del cliente
  const [datosPublicos, setDatosPublicos] = useState<{
    contenido: Partial<ContenidoCarta> | null;
    ofertas: OfertaItem[];
    estadoLocal: EstadoLocalCarta | null;
    datosLocal: DatosLocalCarta | null;
  } | null>(null);

  const [categorias, setCategorias] = useState<CategoriaAdmin[]>([]);
  const [productos, setProductos] = useState<ProductoAdmin[]>([]);
  const [productosConfig, setProductosConfig] = useState<Record<string, Partial<ProductoAdmin>>>({});

  // Diálogos de confirmación
  const [confirmarPublicar, setConfirmarPublicar] = useState(false);
  const [confirmarDescartar, setConfirmarDescartar] = useState(false);
  const [guardandoAccion, setGuardandoAccion] = useState(false);

  // Modal de edición de producto
  const [prodEditando, setProdEditando] = useState<ProductoAdmin | null>(null);
  const [prodEditNombre, setProdEditNombre] = useState('');
  const [prodEditDesc, setProdEditDesc] = useState('');
  const [prodEditPrecio, setProdEditPrecio] = useState('');

  // Modal de edición de promo
  const [promoEditIdx, setPromoEditIdx] = useState<number | null>(null);
  const [promoEditTag, setPromoEditTag] = useState('');
  const [promoEditTitle, setPromoEditTitle] = useState('');
  const [promoEditSub, setPromoEditSub] = useState('');
  const [promoEditPrice, setPromoEditPrice] = useState('');
  const [promoEditOld, setPromoEditOld] = useState('');
  const [promoEditBadge, setPromoEditBadge] = useState('');

  const [mensajeEstado, setMensajeEstado] = useState<string | null>(null);

  const cargarDatos = async () => {
    setCargando(true);
    setError(null);
    try {
      const data = await api.get<any>('/admin/contenido/disenador');
      setTieneBorrador(data.tieneBorrador);
      const conf = data.contenidoActual || {};

      setLayout(data.organizacionActual === 'LISTA' ? 'lista' : data.organizacionActual === 'TARJETAS' ? 'grande' : 'secciones');
      setTheme((data.decoracionActual || 'ninguno').toLowerCase());

      if (conf.banner) setBanner(conf.banner);
      setDisposicion(resolverDisposicion(data.disposicionActual));
      if (conf.promos && conf.promos.length > 0) setPromos(conf.promos);
      if (conf.productosConfig) setProductosConfig(conf.productosConfig);

      setCategorias(data.categorias || []);
      setProductos(
        (data.productos || []).map((p: ProductoAdmin) => ({
          ...p,
          fotoUrl: normalizarUrlArchivo(p.fotoUrl),
        })),
      );
    } catch (err: any) {
      setError(err?.message || 'Error al cargar el diseñador de la carta');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  useEffect(() => {
    if (modoVista !== 'previa' || datosPublicos) return;
    Promise.all([
      api.get<ContenidoCarta>('/carta/contenido').catch(() => null),
      api.get<OfertaItem[]>('/carta/ofertas').catch(() => []),
      api.get<EstadoLocalCarta>('/carta/estado').catch(() => null),
      api.get<DatosLocalCarta>('/carta/local').catch(() => null),
    ]).then(([contenido, ofertas, estadoLocal, datosLocal]) =>
      setDatosPublicos({ contenido, ofertas: Array.isArray(ofertas) ? ofertas : [], estadoLocal, datosLocal }),
    );
  }, [modoVista]);

  const marcarModificado = (nuevosCampos?: {
    layout?: 'secciones' | 'lista' | 'grande';
    theme?: string;
    banner?: any;
    promos?: any[];
    productosConfig?: any;
    categorias?: CategoriaAdmin[];
    disposicion?: DisposicionCarta;
  }) => {
    setTieneBorrador(true);
    const l = nuevosCampos?.layout || layout;
    const orgBackend = l === 'lista' ? 'LISTA' : l === 'grande' ? 'TARJETAS' : 'SECCIONES';
    const t = nuevosCampos?.theme || theme;
    const b = nuevosCampos?.banner || banner;
    const p = nuevosCampos?.promos || promos;
    const pc = nuevosCampos?.productosConfig || productosConfig;
    const cats = nuevosCampos?.categorias || categorias;
    const dis = nuevosCampos?.disposicion || disposicion;

    api.put('/admin/contenido/disenador/borrador', {
      organizacion: orgBackend,
      decoracion: t.toUpperCase(),
      contenido: {
        banner: b,
        promos: p,
        productosConfig: pc,
        secciones: cats.map((c) => c.nombre),
        disposicion: dis,
      },
    }).catch(() => {});
  };

  // Reordenar categorías
  const moverCategoria = (idx: number, dir: -1 | 1) => {
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= categorias.length) return;
    const copia = [...categorias];
    const temp = copia[idx];
    copia[idx] = copia[targetIdx];
    copia[targetIdx] = temp;
    setCategorias(copia);
    marcarModificado({ categorias: copia });
  };

  // Reordenar productos
  const moverProducto = (catId: string, prodId: string, dir: -1 | 1) => {
    const prodsDeCat = productos.filter((p) => p.categoriaId === catId);
    const idx = prodsDeCat.findIndex((p) => p.id === prodId);
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= prodsDeCat.length) return;

    const otroProd = prodsDeCat[targetIdx];
    const copia = [...productos];
    const pIndex = copia.findIndex((p) => p.id === prodId);
    const oIndex = copia.findIndex((p) => p.id === otroProd.id);

    const temp = copia[pIndex];
    copia[pIndex] = copia[oIndex];
    copia[oIndex] = temp;

    setProductos(copia);
    const nuevaConf = {
      ...productosConfig,
      [prodId]: { ...productosConfig[prodId], orden: targetIdx + 1 },
      [otroProd.id]: { ...productosConfig[otroProd.id], orden: idx + 1 },
    };
    setProductosConfig(nuevaConf);
    marcarModificado({ productosConfig: nuevaConf });
  };

  const moverProductoAlInicio = (catId: string, prodId: string) => {
    const copia = [...productos];
    const pIndex = copia.findIndex((p) => p.id === prodId);
    if (pIndex <= 0) return;
    const [item] = copia.splice(pIndex, 1);
    const firstCatIndex = copia.findIndex((p) => p.categoriaId === catId);
    copia.splice(firstCatIndex, 0, item);
    setProductos(copia);
    const nuevaConf = {
      ...productosConfig,
      [prodId]: { ...productosConfig[prodId], orden: 1 },
    };
    setProductosConfig(nuevaConf);
    marcarModificado({ productosConfig: nuevaConf });
  };

  const toggleVisibilidadProducto = (prodId: string) => {
    const p = productos.find((x) => x.id === prodId);
    if (!p) return;
    const nuevoOculto = !p.oculto;
    setProductos(productos.map((x) => (x.id === prodId ? { ...x, oculto: nuevoOculto } : x)));
    const nuevaConf = {
      ...productosConfig,
      [prodId]: { ...productosConfig[prodId], oculto: nuevoOculto },
    };
    setProductosConfig(nuevaConf);
    marcarModificado({ productosConfig: nuevaConf });
  };

  const cambiarFotoProducto = (prodId: string, e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target?.result as string;
      setProductos(productos.map((p) => (p.id === prodId ? { ...p, fotoUrl: url } : p)));
      const nuevaConf = {
        ...productosConfig,
        [prodId]: { ...productosConfig[prodId], fotoUrl: url },
      };
      setProductosConfig(nuevaConf);
      marcarModificado({ productosConfig: nuevaConf });
    };
    reader.readAsDataURL(file);
  };

  const quitarFotoProducto = (prodId: string) => {
    setProductos(productos.map((p) => (p.id === prodId ? { ...p, fotoUrl: null } : p)));
    const nuevaConf = { ...productosConfig };
    if (nuevaConf[prodId]) {
      delete nuevaConf[prodId].fotoUrl;
    }
    setProductosConfig(nuevaConf);
    marcarModificado({ productosConfig: nuevaConf });
  };

  const guardarEdicionProducto = () => {
    if (!prodEditando) return;
    const precioNum = parseFloat(prodEditPrecio) || prodEditando.precio;
    setProductos(
      productos.map((p) =>
        p.id === prodEditando.id
          ? { ...p, nombre: prodEditNombre, descripcion: prodEditDesc, precio: precioNum }
          : p,
      ),
    );
    const nuevaConf = {
      ...productosConfig,
      [prodEditando.id]: {
        ...productosConfig[prodEditando.id],
        nombre: prodEditNombre,
        descripcion: prodEditDesc,
        precio: precioNum,
      },
    };
    setProductosConfig(nuevaConf);
    marcarModificado({ productosConfig: nuevaConf });
    setProdEditando(null);
  };

  // Promos
  const swapPromos = () => {
    if (promos.length < 2) return;
    const nuevas = [promos[1], promos[0]];
    setPromos(nuevas);
    marcarModificado({ promos: nuevas });
  };

  const cambiarFotoPromo = (idx: number, e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target?.result as string;
      const copia = [...promos];
      copia[idx] = { ...copia[idx], photo: url };
      setPromos(copia);
      marcarModificado({ promos: copia });
    };
    reader.readAsDataURL(file);
  };

  const guardarEdicionPromo = () => {
    if (promoEditIdx == null) return;
    const copia = [...promos];
    copia[promoEditIdx] = {
      ...copia[promoEditIdx],
      tag: promoEditTag,
      title: promoEditTitle,
      sub: promoEditSub,
      price: promoEditPrice,
      old: promoEditOld || undefined,
      badge: promoEditBadge || undefined,
    };
    setPromos(copia);
    marcarModificado({ promos: copia });
    setPromoEditIdx(null);
  };

  // Publicar y descartar
  const ejecutarPublicar = async () => {
    setGuardandoAccion(true);
    try {
      await api.post('/admin/contenido/disenador/publicar', {});
      setTieneBorrador(false);
      setConfirmarPublicar(false);
      setMensajeEstado('¡Cambios publicados en la carta!');
      setTimeout(() => setMensajeEstado(null), 4000);
    } catch (err: any) {
      setMensajeEstado(err?.message || 'Error al publicar los cambios');
    } finally {
      setGuardandoAccion(false);
    }
  };

  const ejecutarDescartar = async () => {
    setGuardandoAccion(true);
    try {
      await api.post('/admin/contenido/disenador/descartar', {});
      setConfirmarDescartar(false);
      await cargarDatos();
      setTieneBorrador(false);
      setMensajeEstado('Borrador descartado. Se restauró la versión publicada.');
      setTimeout(() => setMensajeEstado(null), 4000);
    } catch (err: any) {
      setMensajeEstado(err?.message || 'Error al descartar');
    } finally {
      setGuardandoAccion(false);
    }
  };

  const paletaActiva = PAL_DEFAULT[theme] || PAL_DEFAULT.ninguno;
  const currentTemaInfo = TEMAS_INFO[theme] || TEMAS_INFO.ninguno;
  const esCelular = dispositivo === 'celular';

  // Vista previa: misma carta que /, con el borrador (orden, tamaños, banner, categorías y productos)
  const cambiarDisposicion = (nueva: DisposicionCarta) => {
    setDisposicion(nueva);
    marcarModificado({ disposicion: nueva });
  };

  const vistaPreviaDatos: VistaPreviaCarta | null = useMemo(() => {
    if (!datosPublicos) return null;
    const categoriasPrevia: CategoriaCarta[] = categorias
      .filter((c) => !c.oculto)
      .map((c) => ({
        id: c.id,
        nombre: c.nombre,
        orden: c.orden,
        productos: productos
          .filter((p) => p.categoriaId === c.id && !p.oculto)
          .map((p) => ({
            id: p.id,
            nombre: p.nombre,
            descripcion: p.descripcion,
            precio: p.precio,
            fotoUrl: p.fotoUrl,
            tamanos: [],
            grupos: [],
            sabores: [],
            noSumaBeneficios: false,
            disponible: true,
            agotadoHasta: null,
          })),
      }))
      .filter((c) => c.productos.length > 0);
    return {
      categorias: categoriasPrevia,
      ofertas: datosPublicos.ofertas,
      estadoLocal: datosPublicos.estadoLocal,
      datosLocal: datosPublicos.datosLocal,
      contenido: {
        novedades: [],
        destacadas: [],
        rankingMes: [],
        novedadesEncabezado: undefined,
        ...(datosPublicos.contenido ?? {}),
        decoracion: theme.toUpperCase(),
        organizacion: layout === 'lista' ? 'LISTA' : layout === 'grande' ? 'TARJETAS' : 'SECCIONES',
        paleta: paletaActiva as Record<string, string>,
        banner,
        disposicion,
      } as ContenidoCarta,
    };
  }, [datosPublicos, categorias, productos, theme, layout, banner, disposicion, paletaActiva]);

  if (cargando) return <Cargando mensaje="Cargando diseñador de la carta..." />;
  if (error) return <EstadoError mensaje={error} alReintentar={cargarDatos} />;

  const LAY_CONFIG = {
    secciones: {
      gridCols: esCelular ? '1fr' : 'repeat(auto-fill, minmax(230px, 1fr))',
      cardDir: esCelular ? ('row' as const) : ('column' as const),
      imgW: esCelular ? '100px' : '100%',
      imgRatio: esCelular ? '1/1' : '4/3',
    },
    lista: {
      gridCols: '1fr',
      cardDir: 'row' as const,
      imgW: esCelular ? '100px' : '120px',
      imgRatio: '1/1',
    },
    grande: {
      gridCols: esCelular ? '1fr' : 'repeat(auto-fill, minmax(320px, 1fr))',
      cardDir: esCelular ? ('row' as const) : ('column' as const),
      imgW: esCelular ? '100px' : '100%',
      imgRatio: esCelular ? '1/1' : '4/3',
    },
  }[layout];

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
          Diseñador de la carta
        </div>
        <div style={{ fontSize: 14, lineHeight: '21px', color: 'var(--cp-soft)', maxWidth: 640 }}>
          Se abre en pantalla completa y muestra la carta exactamente como la ve el cliente. Elige la organización (secciones, lista o tarjetas grandes), mueve productos y categorías, edita fotos y precios, y previsualiza en vista PC o celular con conmutador en vivo.
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
          {tieneBorrador ? (
            <span style={{ fontSize: 12, fontWeight: 700, borderRadius: 9999, padding: '4px 12px', background: 'var(--cp-gold)', color: 'var(--cp-navy)' }}>
              Borrador sin publicar
            </span>
          ) : (
            <span style={{ fontSize: 12, fontWeight: 700, borderRadius: 9999, padding: '4px 12px', background: 'var(--cp-navy)', color: 'var(--cp-cream)' }}>
              Todo publicado
            </span>
          )}
          {mensajeEstado && <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--cp-rust)' }}>{mensajeEstado}</span>}
        </div>
        <button
          onClick={() => setDzFull(true)}
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

      {/* Vista de pantalla completa del diseñador */}
      {dzFull && (
        <div
          style={{
            position: 'fixed',
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
            zIndex: 90,
            overflowY: 'auto',
            background: paletaActiva.bg,
            color: paletaActiva.ink,
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
              DISEÑADOR DE LA CARTA
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
                data-testid="btn-disenador-disp-pc"
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
                data-testid="btn-disenador-disp-celular"
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

            {/* Selector de organización */}
            <span style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 700, marginRight: 2 }}>Organización:</span>
              {LAYOUTS.map((l) => {
                const activo = layout === l.id;
                return (
                  <button
                    key={l.id}
                    onClick={() => {
                      setLayout(l.id as any);
                      marcarModificado({ layout: l.id as any });
                    }}
                    title={l.d}
                    style={{
                      minHeight: 34,
                      padding: '0 10px',
                      borderRadius: 9999,
                      border: '1.5px solid var(--cp-cream)',
                      background: activo ? 'var(--cp-orange)' : 'transparent',
                      color: activo ? 'var(--cp-navy)' : 'var(--cp-cream)',
                      fontWeight: 700,
                      fontSize: 11,
                      cursor: 'pointer',
                    }}
                  >
                    {l.n}
                  </button>
                );
              })}
            </span>

            {/* Decoración */}
            <button
              onClick={() => setThemeOpen(!themeOpen)}
              style={{
                minHeight: 34,
                padding: '0 12px',
                borderRadius: 9999,
                border: '1.5px solid var(--cp-cream)',
                background: 'transparent',
                color: 'var(--cp-cream)',
                fontWeight: 700,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              Decoración: {currentTemaInfo.n} ▾
            </button>

            <span style={{ flex: 1 }} />
            {tieneBorrador && (
              <span style={{ fontSize: 12, fontWeight: 700, borderRadius: 9999, padding: '3px 10px', background: 'var(--cp-gold)', color: 'var(--cp-navy)' }}>
                Borrador sin publicar
              </span>
            )}
            <button
              onClick={() => setConfirmarPublicar(true)}
              disabled={!tieneBorrador}
              style={{
                minHeight: 38,
                padding: '0 16px',
                border: 0,
                borderRadius: 10,
                background: tieneBorrador ? 'var(--cp-orange)' : 'var(--cp-line)',
                color: 'var(--cp-navy)',
                fontWeight: 800,
                opacity: tieneBorrador ? 1 : 0.6,
                cursor: tieneBorrador ? 'pointer' : 'not-allowed',
              }}
            >
              Publicar cambios
            </button>
            <button
              onClick={() => setConfirmarDescartar(true)}
              disabled={!tieneBorrador}
              style={{
                minHeight: 38,
                padding: '0 16px',
                border: '1.5px solid var(--cp-cream)',
                borderRadius: 10,
                background: 'transparent',
                color: 'var(--cp-cream)',
                fontWeight: 700,
                opacity: tieneBorrador ? 1 : 0.6,
                cursor: tieneBorrador ? 'pointer' : 'not-allowed',
              }}
            >
              Descartar
            </button>
            <button
              onClick={() => setDzFull(false)}
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

          {/* Menú de selección de decoración */}
          {themeOpen && (
            <div
              style={{
                position: 'sticky',
                top: 54,
                zIndex: 99,
                background: 'var(--cp-white)',
                borderBottom: '1px solid var(--cp-line)',
                boxShadow: '0 10px 24px rgba(11,44,62,0.18)',
                padding: '14px 16px',
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--cp-soft)', marginBottom: 8 }}>
                DECORACIÓN FESTIVA DE LA CARTA
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 8 }}>
                {Object.entries(TEMAS_INFO).map(([key, t]) => {
                  const seleccionado = theme === key;
                  return (
                    <button
                      key={key}
                      onClick={() => {
                        setTheme(key);
                        marcarModificado({ theme: key });
                        setThemeOpen(false);
                      }}
                      style={{
                        textAlign: 'left',
                        border: `2px solid ${seleccionado ? 'var(--cp-orange)' : 'var(--cp-line)'}`,
                        borderRadius: 12,
                        background: 'var(--cp-white)',
                        padding: 0,
                        overflow: 'hidden',
                        color: 'var(--cp-navy)',
                        cursor: 'pointer',
                      }}
                    >
                      <span style={{ display: 'block', background: t.bg, color: t.fg, padding: '8px 10px', fontWeight: 700, fontSize: 12 }}>
                        {t.n}
                      </span>
                      <span style={{ display: 'block', padding: '8px 10px', fontSize: 12, minHeight: 26, color: 'var(--cp-soft)' }}>
                        {t.sample}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <DecoracionAnimada tema={theme} />

          {/* VISTA PREVIA: la misma carta pública (mismos componentes) con el borrador */}
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
                data-testid={`preview-disenador-${dispositivo}`}
                style={{
                  width: esCelular ? '390px' : '100%',
                  maxWidth: esCelular ? '390px' : '1200px',
                  border: esCelular ? '8px solid var(--cp-navy)' : '1px solid var(--cp-line)',
                  borderRadius: esCelular ? '28px' : '16px',
                  background: paletaActiva.bg,
                  boxShadow: esCelular ? '0 14px 40px rgba(11, 44, 62, 0.25)' : '0 6px 20px rgba(11, 44, 62, 0.08)',
                  boxSizing: 'border-box',
                  overflow: 'hidden',
                }}
              >
                {esCelular && (
                  <div style={{ width: '120px', height: '14px', backgroundColor: 'var(--cp-navy)', borderRadius: '0 0 10px 10px', margin: '0 auto 8px' }} />
                )}
                {/* Marco con desplazamiento propio: la carta se comporta como en el sitio (cabecera pegajosa, decoración contenida) */}
                <div
                  style={{
                    height: esCelular ? 720 : 760,
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    position: 'relative',
                    transform: 'translateZ(0)',
                    background: paletaActiva.bg,
                  }}
                >
                  {vistaPreviaDatos ? (
                    <CartaVistaPrevia datos={vistaPreviaDatos} movil={esCelular} />
                  ) : (
                    <Cargando mensaje="Preparando la vista previa..." />
                  )}
                </div>
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
                  gap: 20,
                  border: esCelular ? '2px dashed var(--cp-line)' : 'none',
                  borderRadius: esCelular ? 24 : 0,
                  padding: esCelular ? 12 : 0,
                  boxSizing: 'border-box',
                }}
              >
                {/* Réplica de cabecera de la carta con categorías reordenables */}
                <div style={{ borderBottom: `1px solid ${paletaActiva.line}`, paddingBottom: 12 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px 20px', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <img src="/logo.webp" alt="Caprichos" style={{ width: 44, height: 44, borderRadius: 22, objectFit: 'cover' }} />
                      <div>
                        <div style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 18, lineHeight: '22px' }}>Caprichos</div>
                        <div style={{ fontSize: 12, lineHeight: '16px', color: paletaActiva.soft }}>Cafetería artesanal en San Juan de Lurigancho</div>
                      </div>
                    </div>
                  </div>

                  {/* Categorías con flechas para ordenar */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                    <span style={{ minHeight: 38, padding: '0 14px', borderRadius: 9999, border: `1.5px solid ${paletaActiva.ink}`, background: paletaActiva.ink, color: paletaActiva.bg, fontWeight: 700, fontSize: 12, letterSpacing: '0.05em', display: 'flex', alignItems: 'center' }}>
                      TODA LA CARTA
                    </span>
                    {categorias.map((c, i) => (
                      <div key={c.id} style={{ display: 'flex', alignItems: 'stretch', border: `1.5px solid ${paletaActiva.ink}`, borderRadius: 9999, overflow: 'hidden' }}>
                        <button
                          onClick={() => moverCategoria(i, -1)}
                          disabled={i === 0}
                          aria-label={`Mover ${c.nombre} antes`}
                          style={{ width: 28, border: 0, background: 'transparent', color: paletaActiva.ink, fontWeight: 800, opacity: i > 0 ? 1 : 0.35, cursor: i > 0 ? 'pointer' : 'default' }}
                        >
                          ←
                        </button>
                        <span style={{ display: 'flex', alignItems: 'center', minHeight: 38, padding: '0 8px', fontWeight: 700, fontSize: 12, letterSpacing: '0.04em' }}>
                          {c.nombre}
                        </span>
                        <button
                          onClick={() => moverCategoria(i, 1)}
                          disabled={i === categorias.length - 1}
                          aria-label={`Mover ${c.nombre} después`}
                          style={{ width: 28, border: 0, background: 'transparent', color: paletaActiva.ink, fontWeight: 800, opacity: i < categorias.length - 1 ? 1 : 0.35, cursor: i < categorias.length - 1 ? 'pointer' : 'default' }}
                        >
                          →
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <DisposicionControles disposicion={disposicion} onCambiar={cambiarDisposicion} />

                {/* Banner de portada editable (Fiel a PortadaCarta) */}
                <div style={{ border: `1.5px solid ${paletaActiva.ink}`, borderRadius: 20, background: paletaActiva.card, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 14, letterSpacing: '0.06em' }}>
                      BANNER PRINCIPAL DE LA CARTA
                    </span>
                    <button
                      onClick={() => {
                        const b = { ...banner, activo: !banner.activo };
                        setBanner(b);
                        marcarModificado({ banner: b });
                      }}
                      style={{
                        minHeight: 36,
                        padding: '0 14px',
                        borderRadius: 9999,
                        border: `1.5px solid ${paletaActiva.ink}`,
                        background: banner.activo ? paletaActiva.accent : 'transparent',
                        color: banner.activo ? paletaActiva.on : paletaActiva.ink,
                        fontWeight: 700,
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                    >
                      {banner.activo ? 'Banner Activado' : 'Banner Oculto'}
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    <input
                      type="text"
                      value={banner.tag}
                      onChange={(e) => {
                        const b = { ...banner, tag: e.target.value };
                        setBanner(b);
                        marcarModificado({ banner: b });
                      }}
                      placeholder="Etiqueta (ej. NOVEDAD DEL MES)"
                      style={{ flex: '1 1 180px', minHeight: 40, borderRadius: 10, border: `1.5px solid ${paletaActiva.line}`, background: paletaActiva.card, color: paletaActiva.ink, padding: '0 10px', fontSize: 13 }}
                    />
                    <input
                      type="text"
                      value={banner.title}
                      onChange={(e) => {
                        const b = { ...banner, title: e.target.value };
                        setBanner(b);
                        marcarModificado({ banner: b });
                      }}
                      placeholder="Título principal"
                      style={{ flex: '2 1 240px', minHeight: 40, borderRadius: 10, border: `1.5px solid ${paletaActiva.line}`, background: paletaActiva.card, color: paletaActiva.ink, padding: '0 10px', fontSize: 13 }}
                    />
                    <input
                      type="text"
                      value={banner.sub}
                      onChange={(e) => {
                        const b = { ...banner, sub: e.target.value };
                        setBanner(b);
                        marcarModificado({ banner: b });
                      }}
                      placeholder="Descripción o texto de apoyo"
                      style={{ flex: '3 1 300px', minHeight: 40, borderRadius: 10, border: `1.5px solid ${paletaActiva.line}`, background: paletaActiva.card, color: paletaActiva.ink, padding: '0 10px', fontSize: 13 }}
                    />
                  </div>
                </div>

                {/* Promociones superiores editables */}
                {promos.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                    {promos.map((p, idx) => {
                      const bg = p.theme === 'naranja' ? paletaActiva.accent : paletaActiva.ink;
                      const fg = p.theme === 'naranja' ? paletaActiva.on : paletaActiva.bg;
                      const acc = p.theme === 'naranja' ? paletaActiva.on : paletaActiva.accent;
                      return (
                        <div key={idx} style={{ flex: '1 1 340px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <div style={{ borderRadius: 18, background: bg, color: fg, overflow: 'hidden', display: 'flex', alignItems: 'stretch' }}>
                            <div style={{ flex: 1, padding: 18, display: 'flex', flexDirection: 'column', gap: 6, justifyContent: 'center', minWidth: 0 }}>
                              <span style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 11, letterSpacing: '0.1em', color: acc }}>
                                {p.tag}
                              </span>
                              <span style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 22, lineHeight: '26px', overflowWrap: 'anywhere' }}>
                                {p.title}
                              </span>
                              <span style={{ fontSize: 13, opacity: 0.9 }}>{p.sub}</span>
                              <span style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                                <span style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 26, color: acc }}>
                                  {p.price}
                                </span>
                                {p.old && <span style={{ fontSize: 14, textDecoration: 'line-through', opacity: 0.7 }}>{p.old}</span>}
                              </span>
                            </div>
                            {p.photo && (
                              <img src={normalizarUrlArchivo(p.photo) || undefined} alt={p.title} style={{ width: 140, objectFit: 'cover', flex: 'none' }} />
                            )}
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            <button
                              onClick={() => {
                                setPromoEditIdx(idx);
                                setPromoEditTag(p.tag);
                                setPromoEditTitle(p.title);
                                setPromoEditSub(p.sub);
                                setPromoEditPrice(p.price);
                                setPromoEditOld(p.old || '');
                                setPromoEditBadge(p.badge || '');
                              }}
                              style={{ minHeight: 38, padding: '0 12px', border: `1.5px solid ${paletaActiva.ink}`, borderRadius: 10, background: paletaActiva.card, color: paletaActiva.ink, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                            >
                              Editar promo
                            </button>
                            <label style={{ minHeight: 38, padding: '0 12px', border: `1.5px solid ${paletaActiva.ink}`, borderRadius: 10, background: paletaActiva.card, display: 'flex', alignItems: 'center', color: paletaActiva.ink, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                              Foto
                              <input type="file" accept="image/*" onChange={(e) => cambiarFotoPromo(idx, e)} style={{ position: 'absolute', left: -9999, width: 1, height: 1, opacity: 0 }} />
                            </label>
                            <button
                              onClick={swapPromos}
                              style={{ minHeight: 38, padding: '0 12px', border: `1.5px solid ${paletaActiva.ink}`, borderRadius: 10, background: paletaActiva.card, color: paletaActiva.ink, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                            >
                              Cambiar orden
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Secciones de categorías y productos con lienzo interactivo */}
                {categorias.map((cat, catIdx) => {
                  const prodsCat = productos.filter((p) => p.categoriaId === cat.id);
                  return (
                    <div key={cat.id} style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <span style={{ flex: 1, height: 3, background: paletaActiva.accent, borderRadius: 2 }} />
                        <h2 style={{ margin: 0, fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: esCelular ? 22 : 26, letterSpacing: '0.03em', textAlign: 'center' }}>
                          {cat.nombre}
                        </h2>
                        <span style={{ flex: 1, height: 3, background: paletaActiva.accent, borderRadius: 2 }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, margin: '-6px 0 6px' }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: paletaActiva.soft }}>Categoría:</span>
                        <button
                          onClick={() => moverCategoria(catIdx, -1)}
                          disabled={catIdx === 0}
                          aria-label={`Subir ${cat.nombre}`}
                          style={{ minWidth: 36, minHeight: 34, border: `1.5px solid ${paletaActiva.ink}`, borderRadius: 8, background: paletaActiva.card, color: paletaActiva.ink, fontWeight: 800, opacity: catIdx > 0 ? 1 : 0.35, cursor: catIdx > 0 ? 'pointer' : 'default' }}
                        >
                          ↑
                        </button>
                        <button
                          onClick={() => moverCategoria(catIdx, 1)}
                          disabled={catIdx === categorias.length - 1}
                          aria-label={`Bajar ${cat.nombre}`}
                          style={{ minWidth: 36, minHeight: 34, border: `1.5px solid ${paletaActiva.ink}`, borderRadius: 8, background: paletaActiva.card, color: paletaActiva.ink, fontWeight: 800, opacity: catIdx < categorias.length - 1 ? 1 : 0.35, cursor: catIdx < categorias.length - 1 ? 'pointer' : 'default' }}
                        >
                          ↓
                        </button>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: LAY_CONFIG.gridCols, gap: 16 }}>
                        {prodsCat.map((p, pIdx) => {
                          const pos = `${pIdx + 1} de ${prodsCat.length}`;
                          const initials = p.nombre.split(' ').map((w) => w[0]).join('').slice(0, 2);
                          return (
                            <div
                              key={p.id}
                              style={{
                                background: paletaActiva.card,
                                border: `1px solid ${p.oculto ? 'var(--cp-line)' : paletaActiva.line}`,
                                borderRadius: 12,
                                boxShadow: '0 6px 18px rgba(11,44,62,0.08)',
                                overflow: 'hidden',
                                display: 'flex',
                                flexDirection: 'column',
                              }}
                            >
                              <div style={{ display: 'flex', flexDirection: LAY_CONFIG.cardDir, opacity: p.oculto ? 0.5 : 1, flex: 1 }}>
                                <div style={{ width: LAY_CONFIG.imgW, flex: 'none', position: 'relative' }}>
                                  {p.fotoUrl ? (
                                    <img
                                      src={p.fotoUrl}
                                      alt={p.nombre}
                                      style={{ width: '100%', aspectRatio: LAY_CONFIG.imgRatio, objectFit: 'contain', background: paletaActiva.card, display: 'block' }}
                                    />
                                  ) : (
                                    <span style={{ width: '100%', aspectRatio: LAY_CONFIG.imgRatio, background: paletaActiva.sec, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: esCelular ? 24 : 36, color: paletaActiva.ink }}>
                                      {initials}
                                    </span>
                                  )}
                                  <span style={{ position: 'absolute', left: 8, top: 8, fontSize: 11, fontWeight: 800, borderRadius: 9999, padding: '2px 8px', background: paletaActiva.ink, color: paletaActiva.bg }}>
                                    {pos}
                                  </span>
                                </div>
                                <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 0 }}>
                                  <div style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 700, fontSize: 15, lineHeight: '20px', overflowWrap: 'anywhere' }}>
                                    {p.nombre}
                                  </div>
                                  <div style={{ fontSize: 12, lineHeight: '17px', color: paletaActiva.soft, flex: 1 }}>
                                    {p.descripcion}
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 4 }}>
                                    <span style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 16, color: paletaActiva.price }}>
                                      s/ {p.precio.toFixed(2)}
                                    </span>
                                    <span style={{ minHeight: 34, padding: '0 12px', borderRadius: 10, background: paletaActiva.accent, color: paletaActiva.on, fontWeight: 800, fontSize: 12, display: 'flex', alignItems: 'center' }}>
                                      {p.oculto ? 'Oculto' : 'Visible'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              {/* Barra de acciones del producto */}
                              <div style={{ padding: '8px 10px', borderTop: `1px dashed ${paletaActiva.line}`, background: paletaActiva.bg, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                <button
                                  onClick={() => moverProducto(cat.id, p.id, -1)}
                                  disabled={pIdx === 0}
                                  aria-label="Mover antes"
                                  style={{ minWidth: 38, minHeight: 38, border: `1.5px solid ${paletaActiva.ink}`, borderRadius: 8, background: paletaActiva.card, color: paletaActiva.ink, fontWeight: 800, opacity: pIdx > 0 ? 1 : 0.35, cursor: pIdx > 0 ? 'pointer' : 'default' }}
                                >
                                  ←
                                </button>
                                <button
                                  onClick={() => moverProducto(cat.id, p.id, 1)}
                                  disabled={pIdx === prodsCat.length - 1}
                                  aria-label="Mover después"
                                  style={{ minWidth: 38, minHeight: 38, border: `1.5px solid ${paletaActiva.ink}`, borderRadius: 8, background: paletaActiva.card, color: paletaActiva.ink, fontWeight: 800, opacity: pIdx < prodsCat.length - 1 ? 1 : 0.35, cursor: pIdx < prodsCat.length - 1 ? 'pointer' : 'default' }}
                                >
                                  →
                                </button>
                                <button
                                  onClick={() => {
                                    setProdEditando(p);
                                    setProdEditNombre(p.nombre);
                                    setProdEditDesc(p.descripcion || '');
                                    setProdEditPrecio(p.precio.toString());
                                  }}
                                  style={{ minHeight: 38, padding: '0 10px', border: `1.5px solid ${paletaActiva.ink}`, borderRadius: 8, background: paletaActiva.card, color: paletaActiva.ink, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                                >
                                  Editar
                                </button>
                                <button
                                  onClick={() => moverProductoAlInicio(cat.id, p.id)}
                                  style={{ minHeight: 38, padding: '0 10px', border: `1.5px solid ${paletaActiva.ink}`, borderRadius: 8, background: paletaActiva.card, color: paletaActiva.ink, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                                >
                                  Al inicio
                                </button>
                                <label style={{ minHeight: 38, padding: '0 10px', border: `1.5px solid ${paletaActiva.ink}`, borderRadius: 8, background: paletaActiva.card, display: 'flex', alignItems: 'center', color: paletaActiva.ink, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                                  Foto
                                  <input type="file" accept="image/*" onChange={(e) => cambiarFotoProducto(p.id, e)} style={{ position: 'absolute', left: -9999, width: 1, height: 1, opacity: 0 }} />
                                </label>
                                {productosConfig[p.id]?.fotoUrl && (
                                  <button
                                    onClick={() => quitarFotoProducto(p.id)}
                                    style={{ minHeight: 38, padding: '0 6px', border: 0, background: 'transparent', color: paletaActiva.price, fontWeight: 700, fontSize: 12, textDecoration: 'underline', cursor: 'pointer' }}
                                  >
                                    Quitar foto
                                  </button>
                                )}
                                <button
                                  onClick={() => toggleVisibilidadProducto(p.id)}
                                  style={{ minHeight: 38, padding: '0 10px', border: `1.5px solid ${paletaActiva.ink}`, borderRadius: 8, background: paletaActiva.card, color: paletaActiva.ink, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                                >
                                  {p.oculto ? 'Mostrar' : 'Ocultar'}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal de edición de producto */}
      {prodEditando && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(11,44,62,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'var(--cp-white)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 440, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 18 }}>
              Editar producto
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Nombre</label>
              <input type="text" value={prodEditNombre} onChange={(e) => setProdEditNombre(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', minHeight: 44, borderRadius: 10, border: '1.5px solid var(--cp-line)', padding: '0 12px' }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Descripción</label>
              <textarea rows={3} value={prodEditDesc} onChange={(e) => setProdEditDesc(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', borderRadius: 10, border: '1.5px solid var(--cp-line)', padding: 10, fontFamily: 'inherit' }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Precio (S/)</label>
              <input type="number" step="0.5" value={prodEditPrecio} onChange={(e) => setProdEditPrecio(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', minHeight: 44, borderRadius: 10, border: '1.5px solid var(--cp-line)', padding: '0 12px' }} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10 }}>
              <button onClick={() => setProdEditando(null)} style={{ minHeight: 44, padding: '0 16px', borderRadius: 10, border: '1.5px solid var(--cp-line)', background: 'transparent', fontWeight: 700, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={guardarEdicionProducto} style={{ minHeight: 44, padding: '0 20px', borderRadius: 10, border: 0, background: 'var(--cp-orange)', color: 'var(--cp-navy)', fontWeight: 800, cursor: 'pointer' }}>
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de edición de promo */}
      {promoEditIdx != null && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(11,44,62,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'var(--cp-white)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 460, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: 18 }}>
              Editar promoción superior
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Etiqueta</label>
              <input type="text" value={promoEditTag} onChange={(e) => setPromoEditTag(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', minHeight: 44, borderRadius: 10, border: '1.5px solid var(--cp-line)', padding: '0 12px' }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Título</label>
              <input type="text" value={promoEditTitle} onChange={(e) => setPromoEditTitle(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', minHeight: 44, borderRadius: 10, border: '1.5px solid var(--cp-line)', padding: '0 12px' }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Texto</label>
              <input type="text" value={promoEditSub} onChange={(e) => setPromoEditSub(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', minHeight: 44, borderRadius: 10, border: '1.5px solid var(--cp-line)', padding: '0 12px' }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Precio</label>
                <input type="text" value={promoEditPrice} onChange={(e) => setPromoEditPrice(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', minHeight: 44, borderRadius: 10, border: '1.5px solid var(--cp-line)', padding: '0 12px' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Precio anterior</label>
                <input type="text" value={promoEditOld} onChange={(e) => setPromoEditOld(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', minHeight: 44, borderRadius: 10, border: '1.5px solid var(--cp-line)', padding: '0 12px' }} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Insignia</label>
              <input type="text" value={promoEditBadge} onChange={(e) => setPromoEditBadge(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', minHeight: 44, borderRadius: 10, border: '1.5px solid var(--cp-line)', padding: '0 12px' }} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10 }}>
              <button onClick={() => setPromoEditIdx(null)} style={{ minHeight: 44, padding: '0 16px', borderRadius: 10, border: '1.5px solid var(--cp-line)', background: 'transparent', fontWeight: 700, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={guardarEdicionPromo} style={{ minHeight: 44, padding: '0 20px', borderRadius: 10, border: 0, background: 'var(--cp-orange)', color: 'var(--cp-navy)', fontWeight: 800, cursor: 'pointer' }}>
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Diálogo de Confirmar Publicar */}
      <Confirmar
        abierto={confirmarPublicar}
        titulo="¿Publicar los cambios en la carta?"
        mensaje="La carta virtual usará este orden, estas fotos y lo que ocultaste."
        textoConfirmar="Sí, publicar"
        textoNo="No, seguir editando"
        cargando={guardandoAccion}
        alConfirmar={ejecutarPublicar}
        alCancelar={() => setConfirmarPublicar(false)}
      />

      {/* Diálogo de Confirmar Descartar */}
      <Confirmar
        abierto={confirmarDescartar}
        titulo="¿Descartar los cambios sin publicar?"
        mensaje="Volverás al último orden publicado y se perderán las modificaciones no guardadas."
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
