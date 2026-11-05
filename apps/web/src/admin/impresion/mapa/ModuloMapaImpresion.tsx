import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSesion } from '../../../comun/sesion';
import { useEventos } from '../../../comun/socket';
import { Cargando } from '../../../comun/Cargando';
import { EstadoError } from '../../../comun/EstadoError';
import { EstadoVacio } from '../../../comun/EstadoVacio';
import { Confirmar } from '../../../comun/Confirmar';
import { impresionApi, type MapaImpresionDatos, type ReglasMapa } from '../impresionApi';
import { derivarFlujo, type Escenario } from './flujo';
import { LienzoMapa } from './LienzoMapa';
import { SimuladorPedido } from './SimuladorPedido';
import './mapa-impresion.css';

interface Pendiente {
  equipoId: string;
  areaId: string | null;
  nombre: string;
  pendientes: number;
}

const hora = () => new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });

/** Pantalla «Mapa de impresión» dentro de Configuración: ver, simular y cambiar qué sale dónde. */
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

  const ejecutarMover = async (equipoId: string, areaId: string | null) => {
    if (!mapa) return;
    const anterior = mapa;
    const eq = mapa.equipos.find((e) => e.deviceKeyId === equipoId);
    const nombreArea = areaId === null ? 'Caja' : mapa.areas.find((a) => a.id === areaId)?.nombre ?? 'el área';
    setMapa({ ...mapa, equipos: mapa.equipos.map((e) => (e.deviceKeyId === equipoId ? { ...e, areaId } : e)) });
    setOcupado(equipoId);
    setEnfocar(equipoId);
    try {
      const r = await impresionApi.asignarAreaEquipo(equipoId, areaId);
      setAviso({ tipo: 'ok', texto: [`${eq?.nombre ?? 'El equipo'} ahora imprime lo de ${nombreArea}.`, ...r.avisos].join(' ') });
      await cargar(); // el ruteo lo calcula el servidor: se vuelve a leer
    } catch (e: any) {
      setMapa(anterior);
      setAviso({ tipo: 'error', texto: `No se guardó el cambio. ${e?.message ?? ''}`.trim() });
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
          <h2 id="mapa-impresion-titulo" className="mapa-titulo">Mapa de impresión</h2>
          <p className="mapa-intro">
            Mira qué se imprime, con qué regla y en qué equipo. Cambia las reglas y lleva cada equipo al área que atiende.
          </p>
        </div>
        <div className="mapa-vivo">
          En vivo · actualizado {actualizado}
          {error && <span className="mapa-vivo-error"> (sin conexión al actualizar)</span>}
        </div>
      </header>

      <p className="mapa-enlaces">
        <Link to="?tab=impresion">Cola de impresión, prueba e instalar programa</Link>
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
      {mapa.equipos.length === 0 && (
        <EstadoVacio
          titulo="Aún no hay equipos de impresión"
          descripcion="Instala el programa en la PC de Caja y vincúlalo. Después aparecerá aquí."
          accion={<Link to="?tab=impresion">Ir a instalar el programa</Link>}
        />
      )}

      <SimuladorPedido escenario={escenario} flujo={flujo} onCambiar={setEscenario} />

      <h3 className="mapa-subtitulo">Mapa</h3>
      <LienzoMapa
        mapa={mapa}
        flujo={flujo}
        puedeEditar={puedeEditar}
        ocupado={ocupado}
        enfocar={enfocar}
        onCambiarRegla={cambiarRegla}
        onMover={pedirMover}
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
