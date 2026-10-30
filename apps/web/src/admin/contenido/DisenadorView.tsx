import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from '../../comun/api';
import { Cargando } from '../../comun/Cargando';
import { EstadoError } from '../../comun/EstadoError';
import { EditorPantalla } from '../../comun/PantallaCompleta';
import { MarcoDispositivo } from '../../comun/MarcoDispositivo';
import { PAL_DEFAULT, normalizarUrlArchivo } from './paletas-constantes';
import { CartaVistaPrevia } from '../../carta/CartaPublica';
import type { VistaPreviaCarta, ContenidoCarta } from '../../carta/CartaPublica';
import { ETIQUETA_ITEM_FRANJA, resolverDisposicion } from '../../carta/disposicion';
import type { DisposicionCarta, IdSeccionCarta, TamanoBanner, TamanoTarjeta } from '../../carta/disposicion';
import type { BannerCarta } from '../../carta/PortadaCarta';
import type { HistoriaCírculo } from '../../carta/contenido/VisorHistoriasModal';
import type { ModoEdicion } from '../../carta/edicion';
import type { CategoriaCarta, DatosLocalCarta, EstadoLocalCarta, ProductoCarta } from '../../carta/tipos';
import type { OfertaItem } from '../ofertas/ofertasApi';
import { BarraSuperior } from './edicion/BarraSuperior';
import { BloqueEditable, BotonBarra } from './edicion/BloqueEditable';
import { Fantasma, LienzoEdicion } from './edicion/LienzoEdicion';
import { moverIndice, reubicar, siguiente } from './edicion/mover';
import { subirFotoEdicion } from './edicion/subirFoto';
import { useBorrador } from './edicion/useBorrador';

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

interface DestacadaAdmin {
  id: string;
  titulo: string;
  activo: boolean;
  archivada?: boolean;
  portada_url: string | null;
  fotos: { id: string; url: string; pie?: string }[];
}

/** Cambios de «Momentos Caprichos» en borrador: se aplican a las destacadas al publicar. */
interface MomentosBorrador {
  orden: string[];
  items: Record<string, { titulo?: string; portada?: string; activo?: boolean }>;
  nuevos: { id: string; titulo: string; foto: string }[];
}

type Banner = BannerCarta & { activo: boolean; tag: string; title: string; sub: string };

interface EstadoDis {
  layout: 'secciones' | 'lista' | 'grande';
  theme: string;
  banner: Banner;
  promos: unknown[];
  productosConfig: Record<string, Partial<ProductoAdmin>>;
  categorias: CategoriaAdmin[];
  productos: ProductoAdmin[];
  disposicion: DisposicionCarta;
  momentos: MomentosBorrador;
}

const TEMAS: Record<string, string> = {
  ninguno: 'Sin decoración',
  halloween: 'Halloween',
  navidad: 'Navidad',
  anonuevo: 'Año Nuevo',
  sanvalentin: 'San Valentín',
  madre: 'Día de la Madre',
  padre: 'Día del Padre',
  patrias: 'Fiestas Patrias',
  ninos: 'Día del Niño',
  aniversario: 'Aniversario',
};

const LAYOUTS = [
  { id: 'secciones', n: 'Secciones en cuadrícula' },
  { id: 'lista', n: 'Lista' },
  { id: 'grande', n: 'Tarjetas grandes' },
];

const NOMBRE_SECCION: Record<IdSeccionCarta, string> = {
  mes: 'Banner del mes',
  franja: 'Franja de datos',
  momentos: 'Momentos Caprichos',
  novedades: 'Novedades en portada',
  categorias: 'Carta',
};

const TAM_BANNER: TamanoBanner[] = ['compacto', 'normal', 'grande'];
const TAM_TARJETA: TamanoTarjeta[] = ['chico', 'normal', 'grande'];
const COLUMNAS: DisposicionCarta['carta']['columnasPc'][] = ['auto', '2', '3', '4'];
const FOCOS = ['arriba', 'centro', 'abajo'] as const;
const NOMBRE_TAMANO: Record<string, string> = { compacto: 'Compacto', chico: 'Chico', normal: 'Normal', grande: 'Grande' };

const BANNER_BASE: Banner = { activo: true, tag: 'NOVEDAD DEL MES', title: 'Frappe Maracuyá Tropical', sub: 'Con pulpa natural de maracuyá y crema batida.' };

/** Momentos en el orden elegido, con los cambios del borrador encima de lo que hay en la base. */
export function momentosVisibles(base: DestacadaAdmin[], m: MomentosBorrador): HistoriaCírculo[] {
  const existentes = base.filter((d) => !d.archivada);
  const conocidos = new Set([...existentes.map((d) => d.id), ...m.nuevos.map((n) => n.id)]);
  const ids = [...m.orden.filter((id) => conocidos.has(id))];
  for (const id of [...existentes.map((d) => d.id), ...m.nuevos.map((n) => n.id)]) if (!ids.includes(id)) ids.push(id);
  return ids.map((id) => {
    const it = m.items[id] ?? {};
    const d = existentes.find((x) => x.id === id);
    if (d) {
      return { id, titulo: it.titulo ?? d.titulo, portada_url: it.portada ?? d.portada_url ?? d.fotos[0]?.url ?? null, activo: it.activo ?? d.activo, fotos: d.fotos };
    }
    const n = m.nuevos.find((x) => x.id === id)!;
    return { id, titulo: it.titulo ?? n.titulo, portada_url: it.portada ?? n.foto, activo: it.activo ?? true, fotos: [{ id, url: n.foto }] };
  });
}

/** Aplica al listado de la base lo que el borrador guardó (orden, ocultos, nombres, precios y fotos de productos). */
function aplicarBorradorAProductos(productos: ProductoAdmin[], config: Record<string, Partial<ProductoAdmin>>): ProductoAdmin[] {
  const con = productos.map((p) => ({ ...p, ...(config[p.id] ?? {}) }));
  return con.sort((a, b) => (a.categoriaId === b.categoriaId ? a.orden - b.orden : 0));
}

function CampoPrecio({ valor, alCambiar }: { valor: number; alCambiar: (n: number) => void }) {
  const [txt, setTxt] = useState(String(valor));
  const confirmar = () => {
    const n = parseFloat(txt.replace(',', '.'));
    if (Number.isFinite(n) && n >= 0 && n !== valor) alCambiar(n);
    else setTxt(String(valor));
  };
  return (
    <label>
      Precio (S/)
      <input
        type="number"
        step="0.5"
        min="0"
        value={txt}
        onChange={(e) => setTxt(e.target.value)}
        onBlur={confirmar}
        onKeyDown={(e) => e.key === 'Enter' && confirmar()}
      />
    </label>
  );
}

export function DisenadorView() {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hayBorrador, setHayBorrador] = useState(false);
  const [celular, setCelular] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [sel, setSelRaw] = useState<string | null>(null);
  const [pop, setPop] = useState<{ bloque: string; tipo: string } | null>(null);
  const [momentosBase, setMomentosBase] = useState<DestacadaAdmin[]>([]);
  const [datosPublicos, setDatosPublicos] = useState<{
    contenido: Partial<ContenidoCarta> | null;
    ofertas: OfertaItem[];
    estadoLocal: EstadoLocalCarta | null;
    datosLocal: DatosLocalCarta | null;
    /** Producto público por id: trae tamaños, opciones y disponibilidad para que la tarjeta sea idéntica a la de la carta. */
    publicos: Map<string, ProductoCarta>;
  } | null>(null);
  const entradaMomento = useRef<HTMLInputElement>(null);

  const b = useBorrador<EstadoDis>(async (e) => {
    await api.put('/admin/contenido/disenador/borrador', {
      organizacion: e.layout === 'lista' ? 'LISTA' : e.layout === 'grande' ? 'TARJETAS' : 'SECCIONES',
      decoracion: e.theme.toUpperCase(),
      contenido: {
        banner: e.banner,
        promos: e.promos,
        productosConfig: e.productosConfig,
        secciones: e.categorias.map((c) => c.nombre),
        disposicion: e.disposicion,
        momentos: e.momentos,
      },
    });
    setHayBorrador(true);
  });
  const { cargar, cambiar, valor: e } = b;

  const cargarDatos = async () => {
    setCargando(true);
    setError(null);
    try {
      const data = await api.get<any>('/admin/contenido/disenador');
      const conf = data.contenidoActual || {};
      const nombres: string[] = Array.isArray(conf.secciones) ? conf.secciones : [];
      const cats: CategoriaAdmin[] = [...(data.categorias || [])];
      if (nombres.length) cats.sort((x, y) => (nombres.indexOf(x.nombre) + 1 || 999) - (nombres.indexOf(y.nombre) + 1 || 999));
      const prods: ProductoAdmin[] = (data.productos || []).map((p: ProductoAdmin) => ({ ...p, fotoUrl: normalizarUrlArchivo(p.fotoUrl) }));
      const pc = conf.productosConfig && typeof conf.productosConfig === 'object' ? conf.productosConfig : {};
      cargar({
        layout: data.organizacionActual === 'LISTA' ? 'lista' : data.organizacionActual === 'TARJETAS' ? 'grande' : 'secciones',
        theme: (data.decoracionActual || 'ninguno').toLowerCase(),
        banner: { ...BANNER_BASE, ...(conf.banner || {}) },
        promos: Array.isArray(conf.promos) ? conf.promos : [],
        productosConfig: pc,
        categorias: cats,
        productos: aplicarBorradorAProductos(prods, pc),
        disposicion: resolverDisposicion(data.disposicionActual),
        momentos: { orden: [], items: {}, nuevos: [], ...(conf.momentos || {}) },
      });
      setHayBorrador(!!data.tieneBorrador);
    } catch (err: any) {
      setError(err?.message || 'Error al cargar el diseñador de la carta');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDatos();
    Promise.all([
      api.get<ContenidoCarta>('/carta/contenido').catch(() => null),
      api.get<OfertaItem[]>('/carta/ofertas').catch(() => []),
      api.get<EstadoLocalCarta>('/carta/estado').catch(() => null),
      api.get<DatosLocalCarta>('/carta/local').catch(() => null),
      api.get<DestacadaAdmin[]>('/admin/contenido/destacadas').catch(() => []),
      api.get<CategoriaCarta[]>('/carta').catch(() => []),
    ]).then(([contenido, ofertas, estadoLocal, datosLocal, destacadas, publica]) => {
      const publicos = new Map<string, ProductoCarta>();
      (Array.isArray(publica) ? publica : []).forEach((c) => c.productos.forEach((p) => publicos.set(String(p.id), p)));
      setDatosPublicos({ contenido, ofertas: Array.isArray(ofertas) ? ofertas : [], estadoLocal, datosLocal, publicos });
      setMomentosBase(Array.isArray(destacadas) ? destacadas : []);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const seleccionar = (clave: string | null) => {
    setSelRaw(clave);
    setPop((p) => (p && p.bloque === clave ? p : null));
  };
  const alternarPop = (bloque: string, tipo: string) => setPop((p) => (p && p.bloque === bloque && p.tipo === tipo ? null : { bloque, tipo }));

  const momentos = useMemo(() => (e ? momentosVisibles(momentosBase, e.momentos) : []), [e, momentosBase]);

  const vistaPrevia: VistaPreviaCarta | null = useMemo(() => {
    if (!e || !datosPublicos) return null;
    const categorias: CategoriaCarta[] = e.categorias
      .filter((c) => !c.oculto)
      .map((c) => ({
        id: c.id,
        nombre: c.nombre,
        orden: c.orden,
        // en edición también se ven los productos ocultos (atenuados) para poder mostrarlos de nuevo
        productos: e.productos
          .filter((p) => p.categoriaId === c.id)
          .map((p) => {
            const pub = datosPublicos.publicos.get(String(p.id));
            return {
              tamanos: [],
              grupos: [],
              sabores: [],
              noSumaBeneficios: false,
              disponible: true,
              agotadoHasta: null,
              ...pub,
              id: p.id,
              nombre: p.nombre,
              descripcion: p.descripcion,
              precio: p.precio,
              fotoUrl: p.fotoUrl,
            };
          }),
      }))
      .filter((c) => c.productos.length > 0);
    return {
      categorias,
      ofertas: datosPublicos.ofertas,
      estadoLocal: datosPublicos.estadoLocal,
      datosLocal: datosPublicos.datosLocal,
      contenido: {
        novedades: [],
        rankingMes: [],
        novedadesEncabezado: undefined,
        ...(datosPublicos.contenido ?? {}),
        decoracion: e.theme.toUpperCase(),
        organizacion: e.layout === 'lista' ? 'LISTA' : e.layout === 'grande' ? 'TARJETAS' : 'SECCIONES',
        paleta: (PAL_DEFAULT[e.theme] || PAL_DEFAULT.ninguno) as Record<string, string>,
        banner: e.banner,
        disposicion: e.disposicion,
        destacadas: momentos,
      } as ContenidoCarta,
    };
  }, [e, datosPublicos, momentos]);

  if (cargando) return <Cargando mensaje="Cargando diseñador de la carta..." />;
  if (error || !e) return <EstadoError mensaje={error || 'No se pudo cargar el diseñador'} alReintentar={cargarDatos} />;

  // ---- cambios sobre el estado (cada uno es un paso para Deshacer) ----
  const setDisposicion = (f: (d: DisposicionCarta) => DisposicionCarta) => cambiar((s) => ({ ...s, disposicion: f(s.disposicion) }));
  const ordenMomentos = () => momentos.map((m) => m.id);
  const setMomento = (id: string, parche: MomentosBorrador['items'][string]) =>
    cambiar((s) => ({ ...s, momentos: { ...s.momentos, orden: ordenMomentos(), items: { ...s.momentos.items, [id]: { ...s.momentos.items[id], ...parche } } } }));
  const setProducto = (id: string, parche: Partial<ProductoAdmin>) =>
    cambiar((s) => ({
      ...s,
      productos: s.productos.map((p) => (p.id === id ? { ...p, ...parche } : p)),
      productosConfig: { ...s.productosConfig, [id]: { ...s.productosConfig[id], ...parche } },
    }));
  const reordenarProductos = (catId: string, ids: string[]) =>
    cambiar((s) => {
      const delCat = ids.map((id) => s.productos.find((p) => p.id === id)!).map((p, i) => ({ ...p, orden: i + 1 }));
      const productosConfig = { ...s.productosConfig };
      ids.forEach((id, i) => (productosConfig[id] = { ...productosConfig[id], orden: i + 1 }));
      return { ...s, productos: [...s.productos.filter((p) => p.categoriaId !== catId), ...delCat], productosConfig };
    });
  const idsDeCategoria = (catId: string) => e.productos.filter((p) => p.categoriaId === catId).map((p) => p.id);
  const categoriaDe = (prodId: string) => e.productos.find((p) => p.id === prodId)?.categoriaId;
  const tipoDe = (clave: string) => clave.split(':')[0];
  const mismoTipo = (a: string) => (b2: string) => tipoDe(a) === tipoDe(b2);
  const setBanner = (parche: Partial<Banner>) => cambiar((s) => ({ ...s, banner: { ...s.banner, ...parche } }));

  const subirYAplicar = async (archivo: File, aplicar: (url: string) => void) => {
    try {
      aplicar(await subirFotoEdicion(archivo));
    } catch {
      setMensaje('No se pudo cargar la foto');
    }
  };

  // ---- barra por tipo de bloque ----
  const bloque: ModoEdicion['bloque'] = (clave, hijo, o) => {
    const [tipo, id] = clave.split(':');
    const comun = { clave, estilo: o?.estilo, debajo: o?.debajo } as const;

    if (tipo === 'seccion') {
      const idSec = id as IdSeccionCarta;
      const lista = e.disposicion.secciones;
      const i = lista.findIndex((s) => s.id === idSec);
      const visible = lista[i]?.visible !== false;
      const d = e.disposicion;
      let acciones: ReactNode = null;
      let popover: ReactNode = null;
      let onFoto: ((f: File) => void) | undefined;
      if (idSec === 'mes') {
        const campo = celular ? 'tamanoCelular' : 'tamanoPc';
        acciones = (
          <>
            <BotonBarra onClick={() => setDisposicion((x) => ({ ...x, banner: { ...x.banner, [campo]: siguiente(TAM_BANNER, x.banner[campo]) } }))}>
              Tamaño: {NOMBRE_TAMANO[d.banner[campo]]}
            </BotonBarra>
            <BotonBarra onClick={() => setDisposicion((x) => ({ ...x, banner: { ...x.banner, ajusteFoto: x.banner.ajusteFoto === 'cubrir' ? 'contener' : 'cubrir' } }))}>
              Foto: {d.banner.ajusteFoto === 'cubrir' ? 'Llenar' : 'Completa'}
            </BotonBarra>
            <BotonBarra onClick={() => setDisposicion((x) => ({ ...x, banner: { ...x.banner, focoFoto: siguiente(FOCOS, x.banner.focoFoto) } }))}>
              Enfoque: {d.banner.focoFoto[0].toUpperCase() + d.banner.focoFoto.slice(1)}
            </BotonBarra>
            <BotonBarra onClick={() => alternarPop(clave, 'banner')} pulsado={pop?.bloque === clave}>
              Producto del banner
            </BotonBarra>
          </>
        );
        onFoto = (f) => subirYAplicar(f, (url) => setBanner({ foto: url }));
        if (pop?.bloque === clave && pop.tipo === 'banner') {
          const todos = e.productos.map((p) => p.nombre);
          popover = (
            <>
              <strong>Producto que muestra el banner</strong>
              <div className="ed-pop-lista">
                {todos.map((n, k) => (
                  <button key={`${n}-${k}`} type="button" aria-pressed={(e.banner.target || '').toUpperCase() === n.toUpperCase()} onClick={() => { setBanner({ target: n.toUpperCase(), foto: undefined }); setPop(null); }}>
                    {n}
                  </button>
                ))}
              </div>
            </>
          );
        }
      } else if (idSec === 'franja') {
        acciones = d.franja.items.map((it) => (
          <BotonBarra
            key={it.id}
            pulsado={it.visible}
            onClick={() => setDisposicion((x) => ({ ...x, franja: { items: x.franja.items.map((y) => (y.id === it.id ? { ...y, visible: !y.visible } : y)) } }))}
          >
            {ETIQUETA_ITEM_FRANJA[it.id]}: {it.visible ? 'Sí' : 'No'}
          </BotonBarra>
        ));
      } else if (idSec === 'momentos') {
        acciones = (
          <BotonBarra onClick={() => setDisposicion((x) => ({ ...x, momentos: { tamano: siguiente(TAM_TARJETA, x.momentos.tamano) } }))}>
            Tamaño: {NOMBRE_TAMANO[d.momentos.tamano]}
          </BotonBarra>
        );
      } else if (idSec === 'novedades') {
        acciones = (
          <BotonBarra onClick={() => setDisposicion((x) => ({ ...x, novedades: { tamano: siguiente(TAM_TARJETA, x.novedades.tamano) } }))}>
            Tamaño: {NOMBRE_TAMANO[d.novedades.tamano]}
          </BotonBarra>
        );
      } else if (idSec === 'categorias') {
        acciones = (
          <BotonBarra onClick={() => setDisposicion((x) => ({ ...x, carta: { columnasPc: siguiente(COLUMNAS, x.carta.columnasPc) } }))}>
            Columnas: {d.carta.columnasPc === 'auto' ? 'Auto' : d.carta.columnasPc}
          </BotonBarra>
        );
      }
      return (
        <BloqueEditable
          key={clave}
          {...comun}
          etiqueta={NOMBRE_SECCION[idSec]}
          oculto={!visible}
          puedeSubir={i > 0}
          puedeBajar={i < lista.length - 1}
          onSubir={() => setDisposicion((x) => ({ ...x, secciones: moverIndice(x.secciones, i, -1) }))}
          onBajar={() => setDisposicion((x) => ({ ...x, secciones: moverIndice(x.secciones, i, 1) }))}
          puedeSoltar={mismoTipo(clave)}
          onSoltar={(desde) =>
            setDisposicion((x) => ({ ...x, secciones: reubicar(x.secciones, x.secciones.findIndex((s) => `seccion:${s.id}` === desde), x.secciones.findIndex((s) => s.id === idSec)) }))
          }
          onOcultar={() => setDisposicion((x) => ({ ...x, secciones: x.secciones.map((s) => (s.id === idSec ? { ...s, visible: !s.visible } : s)) }))}
          onFoto={onFoto}
          acciones={acciones}
          popover={popover}
        >
          {hijo}
        </BloqueEditable>
      );
    }

    if (tipo === 'categoria') {
      const i = e.categorias.findIndex((c) => c.id === id);
      const nombre = e.categorias[i]?.nombre ?? 'Categoría';
      return (
        <BloqueEditable
          key={clave}
          {...comun}
          etiqueta={`Categoría ${nombre}`}
          puedeSubir={i > 0}
          puedeBajar={i < e.categorias.length - 1}
          onSubir={() => cambiar((s) => ({ ...s, categorias: moverIndice(s.categorias, i, -1) }))}
          onBajar={() => cambiar((s) => ({ ...s, categorias: moverIndice(s.categorias, i, 1) }))}
          puedeSoltar={mismoTipo(clave)}
          onSoltar={(desde) =>
            cambiar((s) => ({ ...s, categorias: reubicar(s.categorias, s.categorias.findIndex((c) => `categoria:${c.id}` === desde), s.categorias.findIndex((c) => c.id === id)) }))
          }
        >
          {hijo}
        </BloqueEditable>
      );
    }

    if (tipo === 'producto') {
      const p = e.productos.find((x) => x.id === id);
      const ids = p ? idsDeCategoria(p.categoriaId) : [];
      const i = ids.indexOf(id);
      return (
        <BloqueEditable
          key={clave}
          {...comun}
          etiqueta={p?.nombre ?? 'Producto'}
          oculto={!!p?.oculto}
          puedeSubir={i > 0}
          puedeBajar={i < ids.length - 1}
          onSubir={() => p && reordenarProductos(p.categoriaId, moverIndice(ids, i, -1))}
          onBajar={() => p && reordenarProductos(p.categoriaId, moverIndice(ids, i, 1))}
          puedeSoltar={(desde) => mismoTipo(clave)(desde) && categoriaDe(desde.split(':')[1]) === p?.categoriaId}
          onSoltar={(desde) => p && reordenarProductos(p.categoriaId, reubicar(ids, ids.indexOf(desde.split(':')[1]), i))}
          onOcultar={() => p && setProducto(id, { oculto: !p.oculto })}
          onFoto={(f) => subirYAplicar(f, (url) => setProducto(id, { fotoUrl: url }))}
          acciones={<BotonBarra onClick={() => alternarPop(clave, 'precio')} pulsado={pop?.bloque === clave}>Precio</BotonBarra>}
          popover={pop?.bloque === clave && pop.tipo === 'precio' && p ? <CampoPrecio valor={p.precio} alCambiar={(n) => setProducto(id, { precio: n })} /> : undefined}
        >
          {hijo}
        </BloqueEditable>
      );
    }

    if (tipo === 'momento') {
      const ids = ordenMomentos();
      const i = ids.indexOf(id);
      const m = momentos.find((x) => x.id === id);
      return (
        <BloqueEditable
          key={clave}
          {...comun}
          etiqueta={m?.titulo ?? 'Momento'}
          oculto={m?.activo === false}
          puedeSubir={i > 0}
          puedeBajar={i < ids.length - 1}
          onSubir={() => cambiar((s) => ({ ...s, momentos: { ...s.momentos, orden: moverIndice(ids, i, -1) } }))}
          onBajar={() => cambiar((s) => ({ ...s, momentos: { ...s.momentos, orden: moverIndice(ids, i, 1) } }))}
          puedeSoltar={mismoTipo(clave)}
          onSoltar={(desde) => cambiar((s) => ({ ...s, momentos: { ...s.momentos, orden: reubicar(ids, ids.indexOf(desde.split(':')[1]), i) } }))}
          onOcultar={() => setMomento(id, { activo: m?.activo === false })}
          onFoto={(f) => subirYAplicar(f, (url) => setMomento(id, { portada: url }))}
        >
          {hijo}
        </BloqueEditable>
      );
    }
    return hijo;
  };

  const ed: ModoEdicion = {
    bloque,
    cambiarTexto(clave, valor) {
      const partes = clave.split(':');
      if (clave === 'banner.tag' || clave === 'banner.title' || clave === 'banner.sub') {
        if (valor) setBanner({ [clave.split('.')[1]]: valor } as Partial<Banner>);
      } else if (partes[0] === 'producto' && partes[2] === 'nombre') {
        if (valor) setProducto(partes[1], { nombre: valor });
      } else if (partes[0] === 'producto' && partes[2] === 'descripcion') {
        setProducto(partes[1], { descripcion: valor });
      } else if (partes[0] === 'momento' && partes[2] === 'titulo') {
        if (valor) setMomento(partes[1], { titulo: valor });
      }
    },
    agregar: (clave, etiqueta, estilo) => (
      <Fantasma key={`agregar-${clave}`} etiqueta={etiqueta} estilo={estilo} onClick={() => entradaMomento.current?.click()} />
    ),
    accion(clave) {
      if (clave === 'banner.producto') {
        setSelRaw('seccion:mes');
        alternarPop('seccion:mes', 'banner');
      }
    },
  };

  const publicar = async () => {
    await b.guardarYa();
    await api.post('/admin/contenido/disenador/publicar', {});
    setMensaje('Cambios publicados en la carta');
    seleccionar(null);
    await cargarDatos();
    setTimeout(() => setMensaje(null), 4000);
  };
  const descartar = async () => {
    await api.post('/admin/contenido/disenador/descartar', {});
    seleccionar(null);
    await cargarDatos();
    setMensaje('Borrador descartado: se restauró lo publicado');
    setTimeout(() => setMensaje(null), 4000);
  };

  const selector = { minHeight: 44, borderRadius: 10, border: '1.5px solid var(--cp-cream)', background: 'var(--cp-navy)', color: 'var(--cp-cream)', padding: '0 8px', fontWeight: 700, fontSize: 12 } as const;

  return (
    <EditorPantalla>
      <BarraSuperior
        titulo="DISEÑADOR DE LA CARTA"
        celular={celular}
        onCelular={setCelular}
        cambios={b.cambios}
        hayBorrador={hayBorrador}
        estado={b.estado}
        puedeDeshacer={b.puedeDeshacer}
        onDeshacer={b.deshacer}
        onPublicar={publicar}
        onDescartar={descartar}
        mensaje={mensaje}
        mensajePublicar="La carta virtual usará este orden, estos textos, estas fotos y lo que ocultaste."
        extra={
          <>
            <select aria-label="Organización de la carta" style={selector} value={e.layout} onChange={(ev) => cambiar((s) => ({ ...s, layout: ev.target.value as EstadoDis['layout'] }))}>
              {LAYOUTS.map((l) => (
                <option key={l.id} value={l.id}>{l.n}</option>
              ))}
            </select>
            <select aria-label="Decoración festiva" style={selector} value={e.theme} onChange={(ev) => cambiar((s) => ({ ...s, theme: ev.target.value }))}>
              {Object.entries(TEMAS).map(([k, n]) => (
                <option key={k} value={k}>{n}</option>
              ))}
            </select>
          </>
        }
      />
      <div className="ep-nota" style={{ fontSize: 13, color: 'var(--cp-soft)' }}>
        Esta es la carta tal como la ve el cliente. Toca un bloque para moverlo, ocultarlo o cambiar su foto; toca un texto para escribir encima. Todo se guarda solo como borrador y la carta cambia al Publicar.
      </div>
      <MarcoDispositivo fiel celular={celular} etiqueta="Carta en edición">
        <LienzoEdicion ed={ed} sel={sel} setSel={seleccionar}>
          {vistaPrevia ? <CartaVistaPrevia datos={vistaPrevia} movil={celular} /> : <Cargando mensaje="Preparando la carta..." />}
        </LienzoEdicion>
      </MarcoDispositivo>
      <input
        ref={entradaMomento}
        type="file"
        accept="image/*"
        aria-label="Elegir foto del nuevo momento"
        style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
        onChange={(ev) => {
          const f = ev.target.files?.[0];
          ev.target.value = '';
          if (!f) return;
          subirYAplicar(f, (url) => {
            const id = `nuevo-${Date.now()}`;
            cambiar((s) => ({ ...s, momentos: { ...s.momentos, orden: [...ordenMomentos(), id], nuevos: [...s.momentos.nuevos, { id, titulo: 'Nuevo momento', foto: url }] } }));
          });
        }}
      />
    </EditorPantalla>
  );
}

