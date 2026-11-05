import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSesion } from '../../../comun/sesion';
import { useEventos } from '../../../comun/socket';
import { Cargando } from '../../../comun/Cargando';
import { EstadoError } from '../../../comun/EstadoError';
import { EstadoVacio } from '../../../comun/EstadoVacio';
import { Confirmar } from '../../../comun/Confirmar';
import { ErrorApi } from '../../../comun/api';
import { impresionApi, type MapaImpresionDatos, type ReglasMapa } from '../impresionApi';
import { derivarFlujo, type Escenario } from './flujo';
import { LeyendaMapa, LienzoMapa } from './LienzoMapa';
import { SimuladorPedido, TiraSaldria } from './SimuladorPedido';
import './mapa-impresion.css';

interface Pendiente {
  equipoId: string;
  areaId: string | null;
  nombre: string;
  pendientes: number;
}

/** Diálogo de confirmación de un cambio que desplaza a otro equipo (reemplazo o dejar solo uno). */
interface Confirmacion {
  titulo: string;
  mensaje: string;
  textoSi: string;
  alConfirmar: () => void;
}

const hora = () => new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });

/** Sección «Mapa» del módulo Impresión de Configuración: ver, simular y cambiar qué sale dónde. */
export function ModuloMapaImpresion() {
  const { tiene, usuario } = useSesion();
  const esAdmin = (usuario?.rol || '').toUpperCase() === 'ADMIN';
  const puedeEditar = esAdmin || tiene('configuracion/editar');

  const [mapa, setMapa] = useState<MapaImpresionDatos | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const [pendiente, setPendiente] = useState<Pendiente | null>(null);
  const [confirmacion, setConfirmacion] = useState<Confirmacion | null>(null);
  const [escenario, setEscenario] = useState<Escenario>({ modalidad: 'LLEVAR', conBebidas: true });
  const [actualizado, setActualizado] = useState('');
  const [enfocar, setEnfocar] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const datos = await impresionApi.obtenerMapa();
      setMapa(datos);
      setError(null);
      setActualizado(hora());
    } catch (e: any) {
      setError(e?.message || 'No se pudo consultar el estado de los equipos.');
    } finally {
      setCargando(false);
    }
  }, []);

  // Estado en vivo: cada 10 s, al volver a la pestaña y con los eventos de cola y estado.
  useEffect(() => {
    void cargar();
    const cada = setInterval(() => void cargar(), 10000);
    const alVolver = () => {
      if (document.visibilityState === 'visible') void cargar();
    };
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      clearInterval(cada);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, [cargar]);
  useEventos('impresion:cola', cargar);
  useEventos('impresion:estado', cargar);

  const flujo = useMemo(() => (mapa ? derivarFlujo(mapa, escenario) : []), [mapa, escenario]);

  /** Pregunta antes de reemplazar: «Bebidas ya la atiende «Barra». ¿Reemplazarla por «Barra 2»? «Barra» dejará de imprimir.» */
  const confirmarReemplazo = (nombreArea: string, viejo: string, nuevo: string, alSi: () => void) => {
    setConfirmacion({
      titulo: 'Reemplazar el equipo de esta área',
      mensaje: `${nombreArea} ya la atiende «${viejo}». ¿Reemplazarla por «${nuevo}»? «${viejo}» dejará de imprimir.`,
      textoSi: 'Sí, reemplazar',
      alConfirmar: alSi,
    });
  };

  const ejecutarMover = async (equipoId: string, areaId: string | null, reemplazar = false) => {
    if (!mapa) return;
    const anterior = mapa;
    const eq = mapa.equipos.find((e) => e.deviceKeyId === equipoId);
    const nombreArea = areaId === null ? 'Caja' : mapa.areas.find((a) => a.id === areaId)?.nombre ?? 'el área';
    setMapa({ ...mapa, equipos: mapa.equipos.map((e) => (e.deviceKeyId === equipoId ? { ...e, areaId } : e)) });
    setOcupado(equipoId);
    setEnfocar(equipoId);
    try {
      const r = reemplazar
        ? await impresionApi.asignarAreaEquipo(equipoId, areaId, true)
        : await impresionApi.asignarAreaEquipo(equipoId, areaId);
      setAviso({ tipo: 'ok', texto: [`${eq?.nombre ?? 'El equipo'} ahora imprime lo de ${nombreArea}.`, ...r.avisos].join(' ') });
      await cargar(); // el ruteo lo calcula el servidor: se vuelve a leer
    } catch (e: any) {
      setMapa(anterior);
      const ocupado409 = e instanceof ErrorApi && e.codigo === 'AREA_OCUPADA' ? (e.detalles as any)?.ocupadoPor : null;
      if (ocupado409 && eq) {
        // Un solo equipo por área: se pide confirmación para reemplazar al que está
        confirmarReemplazo(nombreArea, ocupado409.nombre, eq.nombre, () => void ejecutarMover(equipoId, areaId, true));
        return;
      }
      setAviso({ tipo: 'error', texto: `No se guardó el cambio. ${e?.message ?? ''}`.trim() });
    } finally {
      setOcupado(null);
    }
  };

  /** «Reemplazar este equipo» de una sub-ranura: el nuevo ocupa el área del viejo y el viejo se desactiva. */
  const pedirReemplazo = (viejoId: string, nuevoId: string) => {
    if (!mapa || !puedeEditar) return;
    const viejo = mapa.equipos.find((e) => e.deviceKeyId === viejoId);
    const nuevo = mapa.equipos.find((e) => e.deviceKeyId === nuevoId);
    if (!viejo || !nuevo) return;
    const nombreArea = viejo.areaId === null ? 'Caja' : mapa.areas.find((a) => a.id === viejo.areaId)?.nombre ?? 'el área';
    confirmarReemplazo(nombreArea, viejo.nombre, nuevo.nombre, () => void ejecutarReemplazo(viejoId, nuevoId));
  };

  const ejecutarReemplazo = async (viejoId: string, nuevoId: string) => {
    setOcupado(nuevoId);
    try {
      await impresionApi.reemplazarEquipo(viejoId, nuevoId);
      setAviso({ tipo: 'ok', texto: 'Equipo reemplazado. El anterior quedó desactivado y puede volver a vincularse.' });
      await cargar();
    } catch (e: any) {
      setAviso({ tipo: 'error', texto: `No se reemplazó el equipo. ${e?.message ?? ''}`.trim() });
    } finally {
      setOcupado(null);
    }
  };

  /** Dejar solo uno en un grupo de duplicados: el otro se desactiva (con confirmación). */
  const pedirQuedarse = (grupoNombre: string, quedaId: string, otros: string[]) => {
    const quedaNombre = mapa?.duplicados.flatMap((g) => g.equipos).find((e) => e.deviceKeyId === quedaId)?.nombre ?? 'este equipo';
    setConfirmacion({
      titulo: `Dejar solo un equipo en ${grupoNombre}`,
      mensaje: `«${quedaNombre}» se queda en ${grupoNombre}. ${otros.length === 1 ? 'El otro equipo' : 'Los otros equipos'} se desactivan y dejan de imprimir. Pueden volver a vincularse.`,
      textoSi: 'Sí, dejar solo este',
      alConfirmar: () => void ejecutarQuedarse(quedaId),
    });
  };

  const ejecutarQuedarse = async (quedaId: string) => {
    setOcupado(quedaId);
    try {
      await impresionApi.quedarseCon(quedaId);
      setAviso({ tipo: 'ok', texto: 'Quedó un solo equipo en esa área.' });
      await cargar();
    } catch (e: any) {
      setAviso({ tipo: 'error', texto: `No se pudo dejar un solo equipo. ${e?.message ?? ''}`.trim() });
    } finally {
      setOcupado(null);
    }
  };

  const pedirMover = (equipoId: string, areaId: string | null) => {
    if (!mapa || !puedeEditar) return;
    const eq = mapa.equipos.find((e) => e.deviceKeyId === equipoId);
    if (!eq || (eq.areaId ?? null) === areaId) return;
    const pendientes = mapa.colaPendientePorEquipo.find((c) => c.deviceKeyId === equipoId)?.pendientes ?? 0;
    const tocaCaja = eq.areaId === null || areaId === null;
    if (tocaCaja && pendientes > 0) {
      setPendiente({ equipoId, areaId, nombre: eq.nombre, pendientes });
      return;
    }
    void ejecutarMover(equipoId, areaId);
  };

  const cambiarRegla = async (cambio: Partial<ReglasMapa>, clave: string) => {
    if (!mapa || !puedeEditar) return;
    const anterior = mapa;
    setMapa({ ...mapa, reglas: { ...mapa.reglas, ...cambio } });
    setOcupado(clave);
    try {
      const r = await impresionApi.guardarReglasImpresion(cambio);
      setMapa((m) => (m ? { ...m, reglas: r.reglas } : m));
      setAviso({ tipo: 'ok', texto: 'Regla guardada.' });
    } catch (e: any) {
      setMapa(anterior);
      setAviso({ tipo: 'error', texto: `No se guardó la regla. ${e?.message ?? ''}`.trim() });
    } finally {
      setOcupado(null);
    }
  };

  if (!mapa) {
    if (cargando) return <Cargando mensaje="Cargando el mapa de impresión" />;
    return (
      <EstadoError
        titulo="No se pudo cargar el mapa de impresión"
        mensaje={error ?? 'Revisa la conexión e inténtalo de nuevo.'}
        alReintentar={() => {
          setCargando(true);
          void cargar();
        }}
      />
    );
  }

  return (
    <section className="mapa-impresion" aria-labelledby="mapa-impresion-titulo">
      <header className="mapa-cabecera">
        <div>
          <h3 id="mapa-impresion-titulo" className="mapa-titulo">Mapa de impresión</h3>
          <p className="mapa-intro">Qué sale de cada pedido, cuándo sale y en qué impresora.</p>
        </div>
        <div className="mapa-vivo">
          En vivo · actualizado {actualizado}
          {error && <span className="mapa-vivo-error"> (sin conexión al actualizar)</span>}
        </div>
        <LeyendaMapa />
      </header>

      <p className="mapa-enlaces">
        <Link to="?tab=impresion&seccion=cola">Cola de impresión y pruebas</Link>
        {' · '}
        <Link to="?tab=impresion&seccion=equipos">Equipos y estado</Link>
      </p>

      {!puedeEditar && (
        <div className="mapa-solo-lectura" role="note">
          Solo puedes ver este mapa. Para cambiar reglas o equipos necesitas el permiso de configuración.
        </div>
      )}
      {aviso && (
        <div role={aviso.tipo === 'error' ? 'alert' : 'status'} className={`mapa-aviso mapa-aviso--${aviso.tipo}`}>
          {aviso.texto}
        </div>
      )}
      <p className="mapa-regla-unica">Un solo equipo por área y tipo de máquina, y uno en Caja.</p>
      {mapa.duplicados.map((g) => (
        <section key={g.areaId ?? 'caja'} className="mapa-duplicados" aria-label={`Equipos duplicados en ${g.nombre}`}>
          <p>
            <strong>Hay {g.equipos.length} equipos para {g.areaId === null ? 'Caja' : 'esta área'}: deja solo uno.</strong>
          </p>
          {g.equipos.map((e) => (
            <div key={e.deviceKeyId} className="mapa-duplicados-fila">
              <span>{e.nombre}</span>
              {puedeEditar && (
                <button
                  type="button"
                  className="mapa-asignar mapa-asignar--secundario"
                  aria-label={`Quedarme con este equipo: ${e.nombre}`}
                  disabled={ocupado !== null}
                  onClick={() =>
                    pedirQuedarse(
                      g.areaId === null ? 'Caja' : g.nombre,
                      e.deviceKeyId,
                      g.equipos.filter((o) => o.deviceKeyId !== e.deviceKeyId).map((o) => o.nombre),
                    )
                  }
                >
                  Quedarme con este
                </button>
              )}
            </div>
          ))}
        </section>
      ))}
      {mapa.equipos.length === 0 && (
        <EstadoVacio
          titulo="Aún no hay equipos de impresión"
          descripcion="Instala el programa en la PC de Caja y vincúlalo. Después aparecerá aquí."
          accion={<Link to="?tab=impresion&seccion=equipos">Ir a instalar el programa</Link>}
        />
      )}

      <SimuladorPedido escenario={escenario} onCambiar={setEscenario} />

      <LienzoMapa
        mapa={mapa}
        flujo={flujo}
        puedeEditar={puedeEditar}
        ocupado={ocupado}
        enfocar={enfocar}
        onCambiarRegla={cambiarRegla}
        onMover={pedirMover}
        onReemplazar={pedirReemplazo}
      />

      <TiraSaldria flujo={flujo} />

      <Confirmar
        abierto={confirmacion !== null}
        titulo={confirmacion?.titulo ?? ''}
        mensaje={confirmacion?.mensaje}
        textoSi={confirmacion?.textoSi ?? 'Sí'}
        alCancelar={() => setConfirmacion(null)}
        alConfirmar={() => {
          const c = confirmacion;
          setConfirmacion(null);
          c?.alConfirmar();
        }}
      />

      <Confirmar
        abierto={pendiente !== null}
        titulo="¿Mover este equipo?"
        mensaje={
          pendiente
            ? `${pendiente.nombre} tiene ${pendiente.pendientes} trabajo${pendiente.pendientes === 1 ? '' : 's'} en cola. Si lo mueves desde o hacia Caja, esos trabajos cambian de equipo.`
            : undefined
        }
        textoSi="Sí, mover"
        alCancelar={() => setPendiente(null)}
        alConfirmar={() => {
          const p = pendiente;
          setPendiente(null);
          if (p) void ejecutarMover(p.equipoId, p.areaId);
        }}
      />
    </section>
  );
}
