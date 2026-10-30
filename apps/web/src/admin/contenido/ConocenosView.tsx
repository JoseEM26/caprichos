import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../comun/api';
import { Boton } from '../../comun/Boton';
import { Cargando } from '../../comun/Cargando';
import { EstadoError } from '../../comun/EstadoError';
import { MarcoDispositivo } from '../../comun/MarcoDispositivo';
import { CartaVistaPrevia } from '../../carta/CartaPublica';
import type { ContenidoCarta, VistaPreviaCarta } from '../../carta/CartaPublica';
import { CONOCENOS_DEFAULT, normalizarConocenos } from '../../carta/conocenosContenido';
import type { ContenidoConocenos } from '../../carta/conocenosContenido';
import type { ModoEdicion } from '../../carta/edicion';
import { BarraSuperior } from './edicion/BarraSuperior';
import { BloqueEditable, BotonBarra } from './edicion/BloqueEditable';
import { Fantasma, LienzoEdicion } from './edicion/LienzoEdicion';
import { moverIndice, reubicar } from './edicion/mover';
import { useBorrador } from './edicion/useBorrador';
import { usePublicoCarta } from './edicion/usePublicoCarta';

interface RespuestaConocenos {
  contenido: ContenidoConocenos;
  publicado: ContenidoConocenos;
  tieneBorrador: boolean;
}

const NOMBRE_BLOQUE: Record<string, string> = {
  donde: 'Dónde estamos',
  horario: 'Horario',
  contacto: 'Contáctanos',
  redes: 'Síguenos',
  momentos: 'Mosaico de momentos',
};

/** Editor en sitio de la página Conócenos: la misma página de la carta, con el texto y los bloques editables. */
export function ConocenosView() {
  const navigate = useNavigate();
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [celular, setCelular] = useState(false);
  const [hayBorrador, setHayBorrador] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [sel, setSelRaw] = useState<string | null>(null);
  const [avisoLocal, setAvisoLocal] = useState(false);
  const publico = usePublicoCarta();

  const b = useBorrador<ContenidoConocenos>(async (c) => {
    await api.put('/admin/contenido/conocenos', c);
    setHayBorrador(true);
  });
  const { valor: c, cambiar, cargar } = b;

  const cargarDatos = async () => {
    setCargando(true);
    setError(null);
    try {
      const r = await api.get<RespuestaConocenos>('/admin/contenido/conocenos');
      cargar(normalizarConocenos(r.contenido));
      setHayBorrador(!!r.tieneBorrador);
    } catch (err: any) {
      setError(err?.message || 'No se pudo cargar Conócenos');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDatos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const vistaPrevia: VistaPreviaCarta | null = useMemo(() => {
    if (!c || !publico) return null;
    return {
      ...publico,
      contenido: {
        novedades: [],
        destacadas: [],
        rankingMes: [],
        decoracion: 'NINGUNO',
        organizacion: 'SECCIONES',
        paleta: {},
        banner: { activo: false },
        ...(publico.contenido ?? {}),
        conocenos: c,
      } as ContenidoCarta,
    };
  }, [c, publico]);

  if (cargando) return <Cargando mensaje="Cargando Conócenos..." />;
  if (error || !c) return <EstadoError mensaje={error || 'No se pudo cargar Conócenos'} alReintentar={cargarDatos} />;

  const seleccionar = (clave: string | null) => {
    setSelRaw(clave);
    setAvisoLocal(false);
  };
  const cambiarBloque = (id: string, parche: Partial<ContenidoConocenos['bloques'][number]>) =>
    cambiar((s) => ({ ...s, bloques: s.bloques.map((x) => (x.id === id ? { ...x, ...parche } : x)) }));
  const cantidadFotos = (n: number) => cambiar((s) => ({ ...s, momentosCantidad: Math.min(24, Math.max(1, s.momentosCantidad + n)) }));

  const bloque: ModoEdicion['bloque'] = (clave, hijo) => {
    const id = clave.split(':')[1];
    const i = c.bloques.findIndex((x) => x.id === id);
    const bl = c.bloques[i];
    if (!bl) return hijo;
    return (
      <BloqueEditable
        key={clave}
        clave={clave}
        etiqueta={NOMBRE_BLOQUE[id] ?? id}
        oculto={!bl.visible}
        puedeSubir={i > 0}
        puedeBajar={i < c.bloques.length - 1}
        onSubir={() => cambiar((s) => ({ ...s, bloques: moverIndice(s.bloques, i, -1) }))}
        onBajar={() => cambiar((s) => ({ ...s, bloques: moverIndice(s.bloques, i, 1) }))}
        puedeSoltar={(desde) => desde.startsWith('bloque:')}
        onSoltar={(desde) =>
          cambiar((s) => ({ ...s, bloques: reubicar(s.bloques, s.bloques.findIndex((x) => `bloque:${x.id}` === desde), s.bloques.findIndex((x) => x.id === id)) }))
        }
        onOcultar={() => cambiarBloque(id, { visible: !bl.visible })}
        acciones={
          id === 'momentos' ? (
            <>
              <span className="ed-etiqueta">Fotos: {c.momentosCantidad}</span>
              <BotonBarra aria-label="Menos fotos" disabled={c.momentosCantidad <= 1} onClick={() => cantidadFotos(-1)}>
                −
              </BotonBarra>
              <BotonBarra aria-label="Más fotos" disabled={c.momentosCantidad >= 24} onClick={() => cantidadFotos(1)}>
                +
              </BotonBarra>
            </>
          ) : undefined
        }
        popover={
          avisoLocal && sel === clave ? (
            <>
              <strong>Se edita en Configuración del local</strong>
              <span>La dirección, el horario, el contacto y las redes se cambian allí.</span>
              <Boton onClick={() => navigate('/admin/mirest')}>Ir a Configuración del local</Boton>
            </>
          ) : undefined
        }
      >
        {hijo}
      </BloqueEditable>
    );
  };

  const ed: ModoEdicion = {
    bloque,
    cambiarTexto(clave, valor) {
      if (clave === 'etiqueta' || clave === 'titulo') {
        if (valor) cambiar((s) => ({ ...s, [clave]: valor }));
      } else if (clave.startsWith('parrafo.')) {
        const k = Number(clave.slice(8));
        cambiar((s) => ({ ...s, parrafos: valor ? s.parrafos.map((p, j) => (j === k ? valor : p)) : s.parrafos.filter((_, j) => j !== k) }));
      } else if (clave.startsWith('bloque.')) {
        const [, id] = clave.split('.');
        if (valor) cambiarBloque(id, { titulo: valor });
      }
    },
    agregar: (_clave, etiqueta, estilo) => (
      <Fantasma key="agregar-parrafo" etiqueta={etiqueta} estilo={estilo} onClick={() => cambiar((s) => ({ ...s, parrafos: [...s.parrafos, 'Nuevo párrafo'] }))} />
    ),
    accion(clave) {
      if (clave === 'local') setAvisoLocal(true);
    },
  };

  const publicar = async () => {
    await b.guardarYa();
    const r = await api.post<RespuestaConocenos>('/admin/contenido/conocenos/publicar', {});
    cargar(normalizarConocenos(r?.contenido ?? c));
    setHayBorrador(false);
    setMensaje('Conócenos publicado: ya lo ven los clientes');
    setTimeout(() => setMensaje(null), 4000);
  };
  const descartar = async () => {
    const r = await api.post<RespuestaConocenos>('/admin/contenido/conocenos/descartar', {});
    cargar(normalizarConocenos(r?.contenido ?? CONOCENOS_DEFAULT));
    setHayBorrador(false);
    seleccionar(null);
    setMensaje('Borrador descartado: se restauró lo publicado');
    setTimeout(() => setMensaje(null), 4000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 12 }}>
      <BarraSuperior
        titulo="CONÓCENOS"
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
        mensajePublicar="Los clientes verán estos textos y este orden en la página Conócenos de la carta virtual."
      />
      <div style={{ fontSize: 13, color: 'var(--cp-soft)' }}>
        Esta es la página Conócenos tal como la ve el cliente. Toca un texto para escribir encima o un bloque para moverlo u ocultarlo. Los datos del local se editan en Configuración del local.
      </div>
      <MarcoDispositivo celular={celular} etiqueta="Conócenos en edición">
        <LienzoEdicion ed={ed} sel={sel} setSel={seleccionar}>
          {vistaPrevia ? <CartaVistaPrevia datos={vistaPrevia} movil={celular} pagina="conocenos" /> : <Cargando mensaje="Preparando la página..." />}
        </LienzoEdicion>
      </MarcoDispositivo>
    </div>
  );
}
