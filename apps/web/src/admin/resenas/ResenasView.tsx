import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ErrorApi } from '../../comun/api';
import { useSesion } from '../../comun/sesion';
import { Boton } from '../../comun/Boton';
import { Cargando } from '../../comun/Cargando';
import { Confirmar } from '../../comun/Confirmar';
import { EstadoError } from '../../comun/EstadoError';
import { EstadoVacio } from '../../comun/EstadoVacio';
import { Insignia } from '../../comun/Insignia';
import { Paginacion } from '../../comun/Paginacion';
import { BarraFiltros, FiltroCombo } from '../../comun/FiltroCombo';
import { Estrellas, TarjetaResena } from '../../carta/CarruselResenas';
import type { RespuestaListar, ResenaAdmin } from '../configuracion/TarjetaResenasGoogleConfiguracion';

const TAMANO_PAGINA = 24;

type FiltroEstrellas = 'todas' | '5' | '4';
type FiltroVisibilidad = 'todas' | 'visibles' | 'ocultas';
type Orden = 'recientes' | 'antiguas';

type Accion = { tipo: 'uno'; resena: ResenaAdmin } | { tipo: 'lote'; ids: string[]; visible: boolean };

const plural = (n: number) => (n === 1 ? 'reseña' : 'reseñas');

/** Módulo «Reseñas de Google»: ver todas las guardadas y ocultar o mostrar. Con el permiso resenas/ver (ADMIN y Marketing). Nada se borra. */
export function ResenasView() {
  const { tiene } = useSesion();
  const esAdmin = tiene('resenas/ver');
  const puedeIrAConfiguracion = tiene('configuracion/ver');

  const [datos, setDatos] = useState<RespuestaListar | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [estrellas, setEstrellas] = useState<FiltroEstrellas>('todas');
  const [visibilidad, setVisibilidad] = useState<FiltroVisibilidad>('todas');
  const [orden, setOrden] = useState<Orden>('recientes');
  const [pagina, setPagina] = useState(1);
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [accion, setAccion] = useState<Accion | null>(null);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      setDatos(await api.get<RespuestaListar>('/admin/resenas'));
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo leer las reseñas de Google');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (esAdmin) void cargar();
  }, [cargar, esAdmin]);

  // Cambiar un filtro vuelve a la primera página
  useEffect(() => {
    setPagina(1);
  }, [busqueda, estrellas, visibilidad, orden]);

  const todas = useMemo(() => datos?.resenas ?? [], [datos]);

  // El servidor trae como máximo 200 (las más recientes): el filtro se hace aquí, sobre esas.
  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const lista = todas.filter(
      (r) =>
        (estrellas === 'todas' || r.estrellas === Number(estrellas)) &&
        (visibilidad === 'todas' || (visibilidad === 'visibles' ? r.visible : !r.visible)) &&
        (!q || r.autor.toLowerCase().includes(q) || r.texto.toLowerCase().includes(q)),
    );
    const tiempo = (r: ResenaAdmin) => (r.fecha ? new Date(r.fecha).getTime() : null);
    return [...lista].sort((a, b) => {
      const ta = tiempo(a);
      const tb = tiempo(b);
      if (ta === tb) return 0;
      if (ta === null) return 1; // sin fecha, al final
      if (tb === null) return -1;
      return orden === 'recientes' ? tb - ta : ta - tb;
    });
  }, [todas, busqueda, estrellas, visibilidad, orden]);

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / TAMANO_PAGINA));
  const paginaSegura = Math.min(pagina, totalPaginas);
  const enPagina = filtradas.slice((paginaSegura - 1) * TAMANO_PAGINA, paginaSegura * TAMANO_PAGINA);

  const estado = datos?.estado;
  const guardadas = estado?.guardadas ?? 0;
  const visibles = estado?.visibles ?? 0;
  const ocultas = estado?.ocultas ?? 0;
  const resumen = estado?.resumen ?? null;
  const cincoEstrellas = todas.filter((r) => r.estrellas === 5).length;
  const cuatroEstrellas = todas.filter((r) => r.estrellas === 4).length;

  const alternarSeleccion = (id: string) =>
    setSeleccion((prev) => {
      const siguiente = new Set(prev);
      if (siguiente.has(id)) siguiente.delete(id);
      else siguiente.add(id);
      return siguiente;
    });

  const elegirPagina = () => setSeleccion(new Set(enPagina.map((r) => r.id)));

  /** Ejecuta la acción confirmada. Ocultar no borra; cualquier error se muestra y nada se cambia a medias. */
  const ejecutar = async () => {
    if (!accion) return;
    setGuardando(true);
    setError(null);
    setExito(null);
    try {
      if (accion.tipo === 'uno') {
        const r = await api.patch<any>(`/admin/resenas/${accion.resena.id}`, { visible: !accion.resena.visible });
        setExito(r.visible ? 'Reseña visible en la carta.' : 'Reseña oculta de la carta.');
      } else {
        const r = await api.patch<any>('/admin/resenas/visibilidad', { ids: accion.ids, visible: accion.visible });
        const n = r.cambiadas ?? accion.ids.length;
        setExito(
          accion.visible ? `${n} ${plural(n)} vuelven a verse en la carta.` : `${n} ${plural(n)} dejan de verse en la carta.`,
        );
        setSeleccion(new Set());
      }
      setAccion(null);
      await cargar();
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo completar la acción');
      setAccion(null);
      await cargar();
    } finally {
      setGuardando(false);
    }
  };

  if (!esAdmin) {
    return (
      <div data-testid="resenas-no-admin" style={{ padding: 16, fontSize: 13, color: 'var(--cp-soft)' }}>
        Reseñas de Google: tu rol no tiene acceso.
      </div>
    );
  }
  if (cargando && !datos) {
    return (
      <div data-testid="resenas-cargando" style={{ padding: 20 }}>
        <Cargando mensaje="Cargando reseñas de Google..." />
      </div>
    );
  }
  if (!datos && error) {
    return <EstadoError titulo="No se pudieron cargar las reseñas" mensaje={error} alReintentar={cargar} />;
  }

  const n = seleccion.size;
  const textoConfirmar = !accion
    ? ''
    : accion.tipo === 'uno'
      ? accion.resena.visible
        ? 'Ocultar esta reseña'
        : 'Mostrar esta reseña'
      : accion.visible
        ? `Mostrar ${accion.ids.length} ${plural(accion.ids.length)}`
        : `Ocultar ${accion.ids.length} ${plural(accion.ids.length)}`;
  const mensajeConfirmar = !accion
    ? ''
    : accion.tipo === 'uno'
      ? accion.resena.visible
        ? 'La reseña deja de verse en la carta. No se borra: puedes mostrarla de nuevo.'
        : 'La reseña vuelve a verse en la carta.'
      : accion.visible
        ? `Se mostrarán ${accion.ids.length} ${plural(accion.ids.length)} en la carta.`
        : `Se ocultarán ${accion.ids.length} ${plural(accion.ids.length)} de la carta. No se borran: puedes mostrarlas de nuevo.`;
  const peligro = accion !== null && (accion.tipo === 'uno' ? accion.resena.visible : !accion.visible);

  return (
    <div data-testid="resenas-modulo" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Resumen como en la carta: calificación grande, estrellas y contadores */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 16,
          padding: '14px 18px',
          background: 'var(--cp-cream)',
          border: '1px solid var(--cp-line)',
          borderRadius: 16,
        }}
      >
        {resumen && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontFamily: 'var(--fuente-titulos)', fontSize: 34, fontWeight: 800, lineHeight: 1, color: 'var(--cp-navy)' }}>
              {resumen.rating.toFixed(1)}
            </span>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <Estrellas valor={Math.round(resumen.rating)} tamano={15} etiqueta={`Calificación ${resumen.rating} de 5`} />
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--cp-soft)' }}>
                {`${resumen.rating} en Google · ${resumen.total} ${resumen.total === 1 ? 'reseña' : 'reseñas'}`}
              </span>
            </span>
          </div>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginLeft: 'auto' }}>
          <Insignia variante="neutro">Guardadas: {guardadas}</Insignia>
          <Insignia variante="exito">Visibles: {visibles}</Insignia>
          <Insignia variante="aviso">Ocultas: {ocultas}</Insignia>
        </div>
      </div>

      {error && (
        <div role="alert" style={{ fontSize: 13, color: 'var(--cp-red, #b3261e)' }}>
          {error}
        </div>
      )}
      {exito && (
        <div role="status" style={{ fontSize: 13, color: 'var(--cp-navy)' }}>
          {exito}
        </div>
      )}

      {guardadas === 0 ? (
        <EstadoVacio
          titulo="Todavía no hay reseñas de Google guardadas"
          descripcion={puedeIrAConfiguracion ? 'Las reseñas se cargan desde Configuración › Operación, con el botón «Carga inicial».' : 'Las reseñas las carga el administrador desde Configuración › Operación.'}
          accion={
            !puedeIrAConfiguracion ? undefined : (
            <Link
              to="/admin/mirest?tab=operacion"
              style={{ color: 'var(--cp-rust)', fontWeight: 700, fontSize: 14, minHeight: 44, display: 'inline-flex', alignItems: 'center' }}
            >
              Ir a Configuración › Operación
            </Link>
            )
          }
        />
      ) : (
        <>
          {guardadas > todas.length && (
            <div role="note" style={{ fontSize: 13, color: 'var(--cp-soft)' }}>
              Se muestran las {todas.length} reseñas más recientes de las {guardadas} guardadas.
            </div>
          )}

          <BarraFiltros aria-label="Filtros de reseñas">
            <label htmlFor="resenas-q" style={{ position: 'absolute', left: '-9999px' }}>
              Buscar por autor o texto
            </label>
            <input
              id="resenas-q"
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por autor o texto"
              style={{
                minHeight: 44,
                flex: '2 1 220px',
                minWidth: 200,
                padding: '0 12px',
                borderRadius: 12,
                border: '1.5px solid var(--cp-line, #E3D6C6)',
                background: 'var(--cp-white, #FFFFFF)',
                color: 'var(--cp-navy, #0B2C3E)',
                fontSize: 14,
                boxSizing: 'border-box',
              }}
            />
            <FiltroCombo
              etiqueta="Estrellas"
              valor={estrellas}
              alCambiar={(v) => setEstrellas(v as FiltroEstrellas)}
              opciones={[
                { valor: 'todas', etiqueta: 'Todas', cantidad: todas.length },
                { valor: '5', etiqueta: '5 estrellas', cantidad: cincoEstrellas },
                { valor: '4', etiqueta: '4 estrellas', cantidad: cuatroEstrellas },
              ]}
            />
            <FiltroCombo
              etiqueta="Estado"
              valor={visibilidad}
              alCambiar={(v) => setVisibilidad(v as FiltroVisibilidad)}
              opciones={[
                { valor: 'todas', etiqueta: 'Todas', cantidad: guardadas },
                { valor: 'visibles', etiqueta: 'Visibles', cantidad: visibles },
                { valor: 'ocultas', etiqueta: 'Ocultas', cantidad: ocultas },
              ]}
            />
            <FiltroCombo
              etiqueta="Orden"
              valor={orden}
              alCambiar={(v) => setOrden(v as Orden)}
              opciones={[
                { valor: 'recientes', etiqueta: 'Más recientes' },
                { valor: 'antiguas', etiqueta: 'Más antiguas' },
              ]}
            />
          </BarraFiltros>

          {/* Selección múltiple: casillas en cada tarjeta y acciones para todas las marcadas */}
          <div
            role="region"
            aria-label="Acciones para la selección"
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 10,
              padding: '8px 12px',
              borderRadius: 14,
              background: n > 0 ? 'var(--cp-sand, #F1E6D6)' : 'transparent',
            }}
          >
            <span style={{ fontWeight: 800, fontSize: 13, color: 'var(--cp-navy)', marginRight: 4 }}>{n} seleccionadas</span>
            <Boton variante="secundario" tamano="pequeno" onClick={() => setAccion({ tipo: 'lote', ids: [...seleccion], visible: false })} deshabilitado={n === 0 || guardando}>
              Ocultar seleccionadas
            </Boton>
            <Boton variante="secundario" tamano="pequeno" onClick={() => setAccion({ tipo: 'lote', ids: [...seleccion], visible: true })} deshabilitado={n === 0 || guardando}>
              Mostrar seleccionadas
            </Boton>
            <Boton variante="texto" tamano="pequeno" onClick={elegirPagina} deshabilitado={enPagina.length === 0}>
              Elegir esta página
            </Boton>
            {n > 0 && (
              <Boton variante="texto" tamano="pequeno" onClick={() => setSeleccion(new Set())}>
                Quitar selección
              </Boton>
            )}
          </div>

          {filtradas.length === 0 ? (
            <EstadoVacio titulo="Ninguna reseña coincide con los filtros" descripcion="Cambia o quita algún filtro para ver más reseñas." />
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(300px, 100%), 1fr))', gap: 16, alignItems: 'stretch' }}>
                {enPagina.map((r) => (
                  <div key={r.id} style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <TarjetaResena
                      r={r}
                      oculta={false}
                      atenuada={!r.visible}
                      acciones={
                        <>
                          <label style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 44, minHeight: 44, cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={seleccion.has(r.id)}
                              onChange={() => alternarSeleccion(r.id)}
                              aria-label={`Seleccionar reseña de ${r.autor}`}
                              style={{ width: 20, height: 20, margin: 0, accentColor: 'var(--cp-orange)' }}
                            />
                          </label>
                          {!r.visible && <Insignia variante="neutro">Oculta</Insignia>}
                          <span style={{ marginLeft: 'auto' }}>
                            <Boton
                              variante="secundario"
                              tamano="pequeno"
                              onClick={() => setAccion({ tipo: 'uno', resena: r })}
                              deshabilitado={guardando}
                              aria-label={`${r.visible ? 'Ocultar' : 'Mostrar'} reseña de ${r.autor}`}
                            >
                              {r.visible ? 'Ocultar' : 'Mostrar'}
                            </Boton>
                          </span>
                        </>
                      }
                    />
                  </div>
                ))}
              </div>
              <Paginacion
                pagina={paginaSegura}
                alCambiarPagina={setPagina}
                totalPaginas={totalPaginas}
                totalRegistros={filtradas.length}
                tamanoPagina={TAMANO_PAGINA}
              />
            </>
          )}
        </>
      )}

      <Confirmar
        abierto={accion !== null}
        titulo={textoConfirmar}
        mensaje={mensajeConfirmar}
        textoSi="Sí, confirmar"
        textoNo="No, cancelar"
        peligro={peligro}
        cargando={guardando}
        alConfirmar={ejecutar}
        alCancelar={() => setAccion(null)}
      />
    </div>
  );
}
