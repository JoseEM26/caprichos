import { useEffect, useReducer, useState, type CSSProperties, type ReactNode } from 'react';
import {
  appDelAvisoNativo,
  appSolicitada,
  appsInstaladas,
  buscarActualizacion,
  instalar,
  suscribirInstalar,
  urlInstalarApp,
} from './instalar';
import { appDeRuta, type AppPwa } from './manifestPorRuta';

const TARJETAS: { app: AppPwa; titulo: string; frase: string }[] = [
  { app: 'carta', titulo: 'Carta virtual (para clientes)', frase: 'Se abre directo en la carta para pedir.' },
  { app: 'admin', titulo: 'Panel administrativo', frase: 'Se abre directo en el panel: pedidos, caja y cocina.' },
  { app: 'asistencia', titulo: 'Asistencia (marcar entrada y salida)', frase: 'Se abre directo para marcar tu entrada, almuerzo y salida.' },
];

const boton: CSSProperties = {
  minHeight: 44,
  padding: '0 16px',
  border: 0,
  borderRadius: 12,
  background: 'var(--cp-orange)',
  color: 'var(--cp-navy)',
  fontFamily: 'var(--fuente-titulos)',
  fontWeight: 800,
  fontSize: 15,
};
const botonClaro: CSSProperties = { ...boton, background: 'transparent', border: '1.5px solid var(--cp-navy)', fontSize: 14 };

const mensajeActualizar = {
  actualizando: 'Hay cambios nuevos: se están aplicando y la página se recargará sola.',
  'al-dia': 'Ya tienes lo último.',
  'no-disponible': 'Este navegador no puede buscar cambios. Cierra la app y ábrela de nuevo.',
} as const;

/**
 * Las tres apps que se pueden instalar (carta, panel y asistencia), una tarjeta cada una. Un aviso de instalar del navegador
 * solo instala la app de la página donde se cargó, así que las otras dos se abren en una pestaña nueva con ?instalar=...
 * (esa pestaña carga su propio manifest y ofrece instalar). Las tres pueden estar instaladas a la vez.
 */
export function ElegirAppInstalar({ instrucciones }: { instrucciones: ReactNode }) {
  const [, actualizar] = useReducer((n: number) => n + 1, 0);
  const [instaladas, setInstaladas] = useState<AppPwa[]>([]);
  const [verPasos, setVerPasos] = useState<AppPwa | null>(null);
  const [mensaje, setMensaje] = useState('');
  const activa = appDeRuta();
  const pedida = appSolicitada();

  useEffect(() => suscribirInstalar(actualizar), []);
  useEffect(() => {
    let vivo = true;
    void appsInstaladas().then((l) => vivo && setInstaladas(l));
    return () => {
      vivo = false;
    };
  }, []);

  const pulsarInstalar = async (app: AppPwa) => {
    if (app !== activa) {
      window.open(urlInstalarApp(app), '_blank', 'noopener');
      return;
    }
    if (appDelAvisoNativo() === app) {
      const r = await instalar();
      if (r !== 'no-disponible') return;
    }
    setVerPasos(verPasos === app ? null : app);
  };

  const buscar = async () => {
    setMensaje('Buscando cambios…');
    setMensaje(mensajeActualizar[await buscarActualizacion().catch(() => 'no-disponible' as const)]);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {TARJETAS.map(({ app, titulo, frase }) => {
          const ya = instaladas.includes(app);
          return (
            <li
              key={app}
              data-app={app}
              style={{
                padding: 14,
                borderRadius: 14,
                background: 'var(--cp-sand)',
                border: pedida === app ? '2px solid var(--cp-orange)' : '1px solid var(--cp-line)',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <strong style={{ fontFamily: 'var(--fuente-titulos)', fontSize: 16, lineHeight: '22px' }}>{titulo}</strong>
              <span style={{ fontSize: 14, lineHeight: '20px', color: 'var(--cp-soft)' }}>{frase}</span>
              {ya ? (
                <>
                  <span role="status" style={{ fontWeight: 700, fontSize: 14, color: 'var(--cp-ok)' }}>
                    Ya instalada
                  </span>
                  <button type="button" onClick={() => {
                      setVerPasos(verPasos === app ? null : app);
                      void buscar(); // trae ya los últimos cambios
                    }}
                    style={botonClaro}
                  >
                    Reinstalar / actualizar
                  </button>
                </>
              ) : (
                <button type="button" onClick={() => void pulsarInstalar(app)} style={boton}>
                  Instalar
                </button>
              )}
              {verPasos === app && (
                <div style={{ fontSize: 14, lineHeight: '20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {ya ? (
                    <>
                      <span>Para sobrescribirla: abre la app, menú ⋮ › «Actualizar» o «Reinstalar» (en iPhone, quítala y vuelve a añadirla).</span>
                      <span>Si no aparece, desinstálala y vuelve a instalarla desde aquí. Primero toca «Buscar actualización».</span>
                    </>
                  ) : (
                    instrucciones
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <button type="button" onClick={() => void buscar()} style={botonClaro}>
        Buscar actualización
      </button>
      {mensaje && (
        <p role="status" style={{ margin: 0, fontSize: 13, color: 'var(--cp-soft)', textAlign: 'center' }}>
          {mensaje}
        </p>
      )}
    </div>
  );
}
