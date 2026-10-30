import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../comun/api';
import { Cargando } from '../../comun/Cargando';
import { Confirmar } from '../../comun/Confirmar';
import { EstadoError } from '../../comun/EstadoError';
import { EditorPantalla } from '../../comun/PantallaCompleta';
import { MarcoDispositivo } from '../../comun/MarcoDispositivo';
import { CartaVistaPrevia } from '../../carta/CartaPublica';
import type { ContenidoCarta, VistaPreviaCarta } from '../../carta/CartaPublica';
import { agruparNovedades } from '../../carta/PaginaNovedades';
import type { NovedadCarta } from '../../carta/PaginaNovedades';
import type { ModoEdicion } from '../../carta/edicion';
import { normalizarUrlArchivo } from './paletas-constantes';
import { BarraSuperior } from './edicion/BarraSuperior';
import { BloqueEditable, BotonBarra } from './edicion/BloqueEditable';
import { Fantasma, LienzoEdicion } from './edicion/LienzoEdicion';
import { reubicar, siguiente } from './edicion/mover';
import { subirFotoEdicion } from './edicion/subirFoto';
import { useBorrador } from './edicion/useBorrador';
import { usePublicoCarta } from './edicion/usePublicoCarta';

/** Tarjeta de novedad tal como se guarda en el borrador (las fotos son solo sus direcciones). */
interface NovedadEd {
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
  activo: boolean;
  tamano: string;
  fotos: string[];
}

interface Encabezado {
  etiqueta: string;
  titulo: string;
  subtitulo: string;
}

interface EstadoNov {
  encabezado: Encabezado;
  items: NovedadEd[];
}

const ENCABEZADO_DEFAULT: Encabezado = {
  etiqueta: 'NOVEDADES',
  titulo: 'Lo nuevo en Caprichos',
  subtitulo: 'Promociones, lanzamientos, datos útiles y lo que pasa en nuestras redes.',
};

const TIPOS = [
  { id: 'PROMOCION', n: 'Promoción' },
  { id: 'BANNER', n: 'Banner (en portada)' },
  { id: 'VIDEO', n: 'Video' },
  { id: 'FOTOS', n: 'Fotos' },
  { id: 'EVENTO', n: 'Evento' },
  { id: 'AVISO', n: 'Aviso' },
];

const TAMANOS = ['CHICO', 'MEDIANO', 'GRANDE', 'ANCHO'] as const;
const NOMBRE_TAMANO: Record<string, string> = { CHICO: 'Chico', MEDIANO: 'Mediano', GRANDE: 'Grande', ANCHO: 'Ancho' };

const aCarta = (items: NovedadEd[]): NovedadCarta[] =>
  items.map((n, i) => ({
    id: n.id,
    tipo: n.tipo,
    titulo: n.titulo,
    texto: n.texto ?? undefined,
    tema: n.tema ?? undefined,
    video_url: n.video_url ?? undefined,
    evento_fecha: n.evento_fecha ?? undefined,
    evento_lugar: n.evento_lugar ?? undefined,
    tamano: n.tamano,
    orden: i + 1,
    activo: n.activo,
    fotos: n.fotos.map((url, k) => ({ id: `${n.id}-${k}`, url })),
  }));

function CampoPop({ etiqueta, valor, tipo = 'text', alCambiar }: { etiqueta: string; valor: string; tipo?: string; alCambiar: (v: string) => void }) {
  const [txt, setTxt] = useState(valor);
  const confirmar = () => txt !== valor && alCambiar(txt);
  return (
    <label>
      {etiqueta}
      <input type={tipo} value={txt} onChange={(e) => setTxt(e.target.value)} onBlur={confirmar} onKeyDown={(e) => e.key === 'Enter' && confirmar()} />
    </label>
  );
}

/** Ventana pequeña con lo que la tarjeta no muestra: tipo, fechas en que se ve, enlace del video y datos del evento. */
function OpcionesNovedad({ n, alCambiar }: { n: NovedadEd; alCambiar: (p: Partial<NovedadEd>) => void }) {
  const dia = (v: string | null) => (v ? v.slice(0, 10) : '');
  return (
    <>
      <label>
        Tipo
        <select value={n.tipo} onChange={(e) => alCambiar({ tipo: e.target.value })}>
          {TIPOS.map((t) => (
            <option key={t.id} value={t.id}>{t.n}</option>
          ))}
        </select>
      </label>
      <CampoPop etiqueta="Se muestra desde" tipo="date" valor={dia(n.desde)} alCambiar={(v) => alCambiar({ desde: v || null })} />
      <CampoPop etiqueta="Se muestra hasta" tipo="date" valor={dia(n.hasta)} alCambiar={(v) => alCambiar({ hasta: v || null })} />
      <CampoPop etiqueta="Enlace del video (TikTok o Instagram)" valor={n.video_url ?? ''} alCambiar={(v) => alCambiar({ video_url: v.trim() || null })} />
      {n.tipo === 'EVENTO' && (
        <>
          <CampoPop etiqueta="Fecha del evento" tipo="date" valor={dia(n.evento_fecha)} alCambiar={(v) => alCambiar({ evento_fecha: v || null })} />
          <CampoPop etiqueta="Lugar del evento" valor={n.evento_lugar ?? ''} alCambiar={(v) => alCambiar({ evento_lugar: v.trim() || null })} />
        </>
      )}
    </>
  );
}

export function NovedadesView() {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [celular, setCelular] = useState(false);
  const [hayBorrador, setHayBorrador] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [sel, setSelRaw] = useState<string | null>(null);
  const [pop, setPop] = useState<string | null>(null);
  const [aEliminar, setAEliminar] = useState<string | null>(null);
  const publico = usePublicoCarta();
  const secuencia = useRef(0);

  const b = useBorrador<EstadoNov>(async (e) => {
    await api.put('/admin/contenido/novedades/encabezado', e.encabezado);
    await api.put('/admin/contenido/novedades/borrador', { items: e.items });
    setHayBorrador(true);
  });
  const { valor: e, cambiar, cargar } = b;

  const cargarDatos = async () => {
    setCargando(true);
    setError(null);
    try {
      const [lista, borrador, enc] = await Promise.all([
        api.get<any[]>('/admin/contenido/novedades'),
        api.get<{ items: NovedadEd[] | null; tieneBorrador: boolean }>('/admin/contenido/novedades/borrador').catch(() => ({ items: null, tieneBorrador: false })),
        api.get<{ encabezado: Encabezado; tieneBorrador: boolean }>('/admin/contenido/novedades/encabezado').catch(() => null),
      ]);
      const publicadas: NovedadEd[] = (lista || []).map((n) => ({
        id: String(n.id),
        tipo: n.tipo,
        titulo: n.titulo,
        texto: n.texto ?? null,
        tema: n.tema ?? null,
        video_url: n.video_url ?? null,
        evento_fecha: n.evento_fecha ?? null,
        evento_lugar: n.evento_lugar ?? null,
        desde: n.desde ?? null,
        hasta: n.hasta ?? null,
        activo: n.activo !== false,
        tamano: n.tamano || 'MEDIANO',
        fotos: (n.fotos || []).map((f: { url: string }) => normalizarUrlArchivo(f.url) || f.url),
      }));
      cargar({ encabezado: enc?.encabezado ?? ENCABEZADO_DEFAULT, items: borrador?.items ?? publicadas });
      setHayBorrador(!!borrador?.tieneBorrador || !!enc?.tieneBorrador);
    } catch (err: any) {
      setError(err?.message || 'Error al cargar las novedades');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const vistaPrevia: VistaPreviaCarta | null = useMemo(() => {
    if (!e || !publico) return null;
    return {
      ...publico,
      contenido: {
        destacadas: [],
        rankingMes: [],
        decoracion: 'NINGUNO',
        organizacion: 'SECCIONES',
        paleta: {},
        banner: { activo: false },
        ...(publico.contenido ?? {}),
        novedades: aCarta(e.items),
        novedadesEncabezado: e.encabezado,
      } as ContenidoCarta,
    };
  }, [e, publico]);

  if (cargando) return <Cargando mensaje="Cargando novedades..." />;
  if (error || !e) return <EstadoError mensaje={error || 'No se pudieron cargar las novedades'} alReintentar={cargarDatos} />;

  const seleccionar = (clave: string | null) => {
    setSelRaw(clave);
    setPop(null);
  };
  const cambiarItem = (id: string, parche: Partial<NovedadEd>) =>
    cambiar((s) => ({ ...s, items: s.items.map((n) => (n.id === id ? { ...n, ...parche } : n)) }));

  const nuevaNovedad = (foto?: string): NovedadEd => ({
    id: `nueva-${Date.now()}-${secuencia.current++}`,
    tipo: 'PROMOCION',
    titulo: 'Nueva novedad',
    texto: null,
    tema: null,
    video_url: null,
    evento_fecha: null,
    evento_lugar: null,
    desde: null,
    hasta: null,
    activo: true,
    tamano: 'MEDIANO',
    fotos: foto ? [foto] : [],
  });

  /** Reparte las tarjetas como la página: las destacadas arriba y el resto en el mosaico; se mueve dentro de su grupo. */
  const grupoDe = (id: string) => {
    const { hero, resto } = agruparNovedades(aCarta(e.items));
    return hero.some((n) => n.id === id) ? hero : resto;
  };
  const moverNovedad = (id: string, dir: -1 | 1) => {
    const grupo = grupoDe(id);
    const vecino = grupo[grupo.findIndex((n) => n.id === id) + dir];
    if (!vecino) return;
    cambiar((s) => {
      const a = s.items.findIndex((n) => n.id === id);
      const c = s.items.findIndex((n) => n.id === vecino.id);
      const copia = [...s.items];
      [copia[a], copia[c]] = [copia[c], copia[a]];
      return { ...s, items: copia };
    });
  };

  const bloque: ModoEdicion['bloque'] = (clave, hijo, o) => {
    const id = clave.split(':')[1];
    const n = e.items.find((x) => x.id === id);
    if (!n) return hijo;
    const grupo = grupoDe(id);
    const i = grupo.findIndex((x) => x.id === id);
    return (
      <BloqueEditable
        key={clave}
        clave={clave}
        etiqueta={n.titulo || 'Novedad'}
        estilo={o?.estilo}
        oculto={!n.activo}
        puedeSubir={i > 0}
        puedeBajar={i < grupo.length - 1}
        onSubir={() => moverNovedad(id, -1)}
        onBajar={() => moverNovedad(id, 1)}
        puedeSoltar={(desde) => grupo.some((x) => `novedad:${x.id}` === desde)}
        onSoltar={(desde) =>
          cambiar((s) => ({ ...s, items: reubicar(s.items, s.items.findIndex((x) => `novedad:${x.id}` === desde), s.items.findIndex((x) => x.id === id)) }))
        }
        onOcultar={() => cambiarItem(id, { activo: !n.activo })}
        onFoto={async (f) => {
          const url = await subirFotoEdicion(f);
          cambiarItem(id, { fotos: [url, ...n.fotos.slice(1)] });
        }}
        acciones={
          <>
            <BotonBarra onClick={() => cambiarItem(id, { tamano: siguiente(TAMANOS, (n.tamano as (typeof TAMANOS)[number]) || 'MEDIANO') })}>
              Tamaño: {NOMBRE_TAMANO[n.tamano] ?? 'Mediano'}
            </BotonBarra>
            <BotonBarra pulsado={pop === clave} onClick={() => setPop(pop === clave ? null : clave)}>Más opciones</BotonBarra>
            <BotonBarra
              onClick={() =>
                cambiar((s) => {
                  const k = s.items.findIndex((x) => x.id === id);
                  const copia: NovedadEd = { ...n, id: `nueva-${Date.now()}-${secuencia.current++}`, titulo: `${n.titulo} (copia)`, activo: false };
                  return { ...s, items: [...s.items.slice(0, k + 1), copia, ...s.items.slice(k + 1)] };
                })
              }
            >
              Duplicar
            </BotonBarra>
            <BotonBarra peligro onClick={() => setAEliminar(id)}>Eliminar</BotonBarra>
          </>
        }
        popover={pop === clave ? <OpcionesNovedad n={n} alCambiar={(p) => cambiarItem(id, p)} /> : undefined}
      >
        {hijo}
      </BloqueEditable>
    );
  };

  const ed: ModoEdicion = {
    bloque,
    cambiarTexto(clave, valor) {
      const [tipo, id, campo] = clave.split(':');
      if (clave.startsWith('enc.')) {
        const k = clave.slice(4) as keyof Encabezado;
        if (valor) cambiar((s) => ({ ...s, encabezado: { ...s.encabezado, [k]: valor } }));
      } else if (tipo === 'novedad' && campo === 'titulo') {
        if (valor) cambiarItem(id, { titulo: valor });
      } else if (tipo === 'novedad' && campo === 'texto') {
        cambiarItem(id, { texto: valor || null });
      } else if (tipo === 'novedad' && campo === 'tema') {
        cambiarItem(id, { tema: valor || null });
      }
    },
    agregar: (_clave, etiqueta, estilo) => (
      <Fantasma
        key="agregar-novedad"
        etiqueta={etiqueta}
        estilo={estilo}
        onClick={() => {
          const nueva = nuevaNovedad();
          cambiar((s) => ({ ...s, items: [...s.items, nueva] }));
          setSelRaw(`novedad:${nueva.id}`);
        }}
      />
    ),
    accion: () => {},
  };

  const publicar = async () => {
    await b.guardarYa();
    await api.post('/admin/contenido/novedades/publicar', {});
    setMensaje('Novedades publicadas en la carta');
    seleccionar(null);
    await cargarDatos();
    setTimeout(() => setMensaje(null), 4000);
  };
  const descartar = async () => {
    await api.post('/admin/contenido/novedades/descartar', {}).catch(() => null);
    seleccionar(null);
    await cargarDatos();
    setMensaje('Borrador descartado: se restauró lo publicado');
    setTimeout(() => setMensaje(null), 4000);
  };

  return (
    <EditorPantalla>
      <BarraSuperior
        titulo="NOVEDADES"
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
        mensajePublicar="La página Novedades de la carta usará este encabezado, estas tarjetas, su orden y lo que ocultaste. Lo que quitaste se elimina."
      />
      <div className="ep-nota" style={{ fontSize: 13, color: 'var(--cp-soft)' }}>
        Esta es la página Novedades tal como la ve el cliente. Toca un texto para escribir encima o una tarjeta para moverla, cambiarle la foto o el tamaño. Todo se guarda solo como borrador.
      </div>
      <MarcoDispositivo fiel celular={celular} etiqueta="Novedades en edición">
        <LienzoEdicion ed={ed} sel={sel} setSel={seleccionar}>
          {vistaPrevia ? <CartaVistaPrevia datos={vistaPrevia} movil={celular} pagina="novedades" /> : <Cargando mensaje="Preparando la página..." />}
        </LienzoEdicion>
      </MarcoDispositivo>
      <Confirmar
        abierto={aEliminar !== null}
        titulo="¿Eliminar esta novedad?"
        mensaje="Desaparece del borrador y, al publicar, de la carta."
        textoConfirmar="Sí, eliminar"
        textoNo="No, conservarla"
        peligro
        alConfirmar={() => {
          const id = aEliminar;
          setAEliminar(null);
          if (id) {
            setSelRaw(null);
            cambiar((s) => ({ ...s, items: s.items.filter((n) => n.id !== id) }));
          }
        }}
        alCancelar={() => setAEliminar(null)}
      />
    </EditorPantalla>
  );
}

