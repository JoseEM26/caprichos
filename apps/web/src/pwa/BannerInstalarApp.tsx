import { useEffect, useReducer, useState, type CSSProperties } from 'react';
import { BotonInstalarApp } from './BotonInstalarApp';
import {
  descartarInstalar,
  esIos,
  estaDescartado,
  instalar,
  puedeInstalar,
  suscribirInstalar,
  tieneAvisoNativo,
} from './instalar';

const GUIA_IOS = 'Toca Compartir y luego «Añadir a pantalla de inicio».';

const botonInstalar: CSSProperties = {
  minHeight: 44,
  padding: '0 16px',
  border: 0,
  borderRadius: 10,
  background: 'var(--cp-orange)',
  color: 'var(--cp-navy)',
  fontWeight: 700,
  fontFamily: 'inherit',
  whiteSpace: 'nowrap',
};

/**
 * Aviso «Instalar app». Por defecto es una barra discreta (carta) con cierre que solo dura la sesión de navegación:
 * en la siguiente visita vuelve. Con `compacto` es solo un botón que no se descarta (panel del local).
 * Nunca aparece si la app ya está instalada.
 */
export function BannerInstalarApp({ compacto = false }: { compacto?: boolean }) {
  const [, actualizar] = useReducer((n: number) => n + 1, 0);
  const [, setGuiaAbierta] = useState(false);

  useEffect(() => suscribirInstalar(actualizar), []);

  // Panel del local: siempre el botón que abre la ventana para elegir app (también sirve para reinstalar o buscar cambios)
  if (compacto) return <BotonInstalarApp siempre />;

  if (!puedeInstalar()) return null;
  if (estaDescartado()) return null;
  const ios = !tieneAvisoNativo() && esIos();
  // Sin aviso del navegador y sin iOS (otro equipo, aviso ya usado o descartado): el botón abre los pasos manuales
  const manual = !tieneAvisoNativo() && !ios;

  const pulsar = async () => {
    if (ios) {
      setGuiaAbierta((v) => !v);
      return;
    }
    await instalar();
  };

  return (
    <section
      aria-label="Instalar Caprichos en tu celular"
      style={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 10,
        padding: '8px 8px 8px 14px',
        background: 'var(--cp-white)',
        border: '1px solid var(--cp-line)',
        borderRadius: 12,
        color: 'var(--cp-navy)',
        fontSize: 14,
        lineHeight: '20px',
      }}
    >
      <div style={{ flex: '1 1 200px', minWidth: 0 }}>
        <strong>Instala Caprichos en tu celular</strong>
        <div style={{ color: 'var(--cp-soft)', fontSize: 13 }}>
          {ios ? `Así pides más rápido, desde tu pantalla de inicio. ${GUIA_IOS}` : 'Así pides más rápido, desde tu pantalla de inicio.'}
        </div>
      </div>
      {manual && <BotonInstalarApp />}
      {!ios && !manual && (
        <button type="button" onClick={pulsar} style={botonInstalar}>
          Instalar
        </button>
      )}
      <button
        type="button"
        onClick={() => {
          descartarInstalar();
          actualizar(); // se oculta ya, sin esperar a la suscripción
        }}
        aria-label="Cerrar aviso de instalación"
        style={{ width: 44, height: 44, padding: 0, border: 0, background: 'transparent', color: 'var(--cp-soft)', fontSize: 24, lineHeight: 1 }}
      >
        ×
      </button>
    </section>
  );
}
