import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSesion } from '../../comun/sesion';
import { api } from '../../comun/api';
import { useNotificaciones } from '../useNotificaciones';

/** Lo que ve el supervisor: solo conteos, horarios y estados. El servidor no manda montos. */
export interface EscritorioOperativo {
  generadoEn: string;
  pedidos: {
    porConfirmar: number;
    enPreparacion: number;
    enCola: number;
    listos: number;
    enReparto: number;
    noEntregados: number;
  };
  reservas: { cantidadHoy: number; proximas: { nombre: string; personas: number; hora: string }[] };
  mesas: { cantidad: number; ocupadas: number; libres: number };
  caja: { estado: 'ABIERTA' | 'CERRADA' | 'SIN_ABRIR' };
}

const TEXTO_CAJA: Record<EscritorioOperativo['caja']['estado'], string> = {
  ABIERTA: 'Abierta',
  CERRADA: 'Cerrada',
  SIN_ABRIR: 'Sin abrir hoy',
};

const CADA_MS = 30000;

const tarjeta: CSSProperties = {
  background: 'var(--cp-white)',
  border: '1px solid var(--cp-line)',
  borderRadius: 16,
  padding: '16px 18px',
};

const tituloSeccion: CSSProperties = {
  fontFamily: 'Montserrat, sans-serif',
  fontWeight: 800,
  fontSize: 15,
  color: 'var(--cp-navy)',
  marginBottom: 10,
};

/** Cifra grande dentro de un botón que lleva a la lista correspondiente */
function Cifra({ etiqueta, valor, ruta, alIr }: { etiqueta: string; valor: number | string; ruta?: string; alIr?: (r: string) => void }) {
  const contenido = (
    <>
      <span style={{ fontSize: 26, fontWeight: 800, color: 'var(--cp-navy)', fontVariantNumeric: 'tabular-nums' }}>{valor}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--cp-soft)', textAlign: 'left' }}>{etiqueta}</span>
    </>
  );
  if (!ruta) {
    return <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minHeight: 44, padding: '8px 10px' }}>{contenido}</div>;
  }
  return (
    <button
      type="button"
      onClick={() => alIr?.(ruta)}
      aria-label={`${etiqueta}: ${valor}. Ver la lista`}
      style={{
        minHeight: 44,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 2,
        padding: '8px 10px',
        border: '1px solid var(--cp-line)',
        borderRadius: 12,
        background: 'var(--cp-cream, #FBF6EE)',
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      {contenido}
    </button>
  );
}

/**
 * Escritorio propio del SUPERVISOR: qué está pasando en el local, sin dinero.
 * Cada cifra lleva a su lista. El escritorio del cajero y del mozo no cambia.
 */
export function EscritorioSupervisorView() {
  const { usuario } = useSesion();
  const navigate = useNavigate();
  const resumen = useNotificaciones();
  const [datos, setDatos] = useState<EscritorioOperativo | null>(null);
  const [error, setError] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const r = await api.get<EscritorioOperativo>('/admin/escritorio/operativo');
      setDatos(r);
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    void cargar();
    const cada = setInterval(() => void cargar(), CADA_MS);
    return () => clearInterval(cada);
  }, [cargar]);

  const avisosSinLeer = resumen.notificaciones.filter((n) => !n.leida).length;
  const nombre = usuario?.nombres || 'Supervisor';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 13, color: 'var(--cp-soft)' }}>
        Hola, {nombre}. Este es tu escritorio de Supervisor: lo que pasa en el local ahora.
      </div>

      {error && (
        <div role="alert" style={{ fontSize: 13, color: 'var(--cp-red, #b3261e)' }}>
          No se pudo cargar el escritorio. Se vuelve a intentar en unos segundos.
        </div>
      )}

      {!datos && !error && <div style={{ fontSize: 14, color: 'var(--cp-soft)' }}>Cargando el escritorio...</div>}

      {datos && (
        <>
          <section style={tarjeta} aria-labelledby="sup-h-pedidos">
            <h2 id="sup-h-pedidos" style={tituloSeccion}>Pedidos</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
              <Cifra etiqueta="Por confirmar" valor={datos.pedidos.porConfirmar} ruta="/admin/caja" alIr={navigate} />
              <Cifra etiqueta="En cola" valor={datos.pedidos.enCola} ruta="/admin/cocina" alIr={navigate} />
              <Cifra etiqueta="En preparación" valor={datos.pedidos.enPreparacion} ruta="/admin/cocina" alIr={navigate} />
              <Cifra etiqueta="Listos" valor={datos.pedidos.listos} ruta="/admin/caja" alIr={navigate} />
              <Cifra etiqueta="En reparto" valor={datos.pedidos.enReparto} ruta="/admin/repartos" alIr={navigate} />
              <Cifra etiqueta="No entregados" valor={datos.pedidos.noEntregados} ruta="/admin/caja" alIr={navigate} />
            </div>
          </section>

          <section style={tarjeta} aria-labelledby="sup-h-reservas">
            <h2 id="sup-h-reservas" style={tituloSeccion}>Reservas de hoy</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
              <Cifra etiqueta="Reservas para hoy" valor={datos.reservas.cantidadHoy} ruta="/admin/reservas" alIr={navigate} />
              <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                {datos.reservas.proximas.length === 0 ? (
                  <div style={{ fontSize: 14, color: 'var(--cp-soft)' }}>No quedan reservas para hoy.</div>
                ) : (
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {datos.reservas.proximas.map((r, i) => (
                      <li key={`${r.hora}-${i}`} style={{ fontSize: 14, color: 'var(--cp-navy)', fontVariantNumeric: 'tabular-nums' }}>
                        <b>{r.hora}</b> · {r.nombre} · {r.personas} {r.personas === 1 ? 'persona' : 'personas'}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>

          <section style={tarjeta} aria-labelledby="sup-h-mesas">
            <h2 id="sup-h-mesas" style={tituloSeccion}>Salón y caja</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
              <Cifra etiqueta={`Mesas ocupadas de ${datos.mesas.cantidad}`} valor={datos.mesas.ocupadas} ruta="/admin/plano" alIr={navigate} />
              <Cifra etiqueta="Mesas libres" valor={datos.mesas.libres} ruta="/admin/plano" alIr={navigate} />
              <Cifra etiqueta="Caja de hoy" valor={TEXTO_CAJA[datos.caja.estado]} />
            </div>
          </section>

          <section style={tarjeta} aria-labelledby="sup-h-avisos">
            <h2 id="sup-h-avisos" style={tituloSeccion}>Avisos</h2>
            <Cifra
              etiqueta={avisosSinLeer === 1 ? 'Aviso sin leer' : 'Avisos sin leer'}
              valor={avisosSinLeer}
              ruta="/admin/notificaciones"
              alIr={navigate}
            />
          </section>
        </>
      )}
    </div>
  );
}
