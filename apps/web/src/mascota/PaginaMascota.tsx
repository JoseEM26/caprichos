import { useState } from 'react';
import { MascotaCapri } from './MascotaCapri';
import { ESTADOS_CAPRI, type EstadoCapri } from './animaciones';
import { tieneSoporteWebGL } from './soporteWebGL';

const DESCRIPCIONES_ESTADO: Record<EstadoCapri, string> = {
  reposo: 'Respiración suave, balanceo rítmico, parpadeo aleatorio y seguimiento de mirada al cursor.',
  saludando: 'Agite entusiasta del brazo derecho (espátula amigable) con inclinación cordial de cabeza.',
  pensando: 'Cabeza ladeada hacia arriba, mano en el mentón y signo de interrogación luminoso pulsando.',
  hablando: 'Movimiento sincronizado de boca, gesticulación con ambas manos y rebote alegre al expresarse.',
  contento: 'Salto enérgico, brazos levantados en celebración y destellos brillantes alrededor de la cabeza.',
  confundido: 'Inclinación marcada de cabeza, encogimiento de hombros y gesto de duda.',
  dormido: 'Párpados completamente cerrados, respiración profunda y lenta con leve cabeceo hacia abajo.',
};

export function PaginaMascota() {
  const [estado, setEstado] = useState<EstadoCapri>('reposo');
  const [forzar2D, setForzar2D] = useState<boolean>(false);
  const soportaWebGL = tieneSoporteWebGL();

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--cp-cream)',
        color: 'var(--cp-navy)',
        padding: '32px 16px',
        fontFamily: 'var(--fuente-texto)',
      }}
    >
      <div
        style={{
          maxWidth: '920px',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
        }}
      >
        {/* Cabecera */}
        <header
          style={{
            borderBottom: '2px solid var(--cp-line)',
            paddingBottom: '16px',
          }}
        >
          <div
            style={{
              display: 'inline-block',
              backgroundColor: 'var(--cp-sand)',
              color: 'var(--cp-orange)',
              fontWeight: 700,
              fontSize: '12px',
              padding: '4px 10px',
              borderRadius: '999px',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              marginBottom: '8px',
            }}
          >
            Vista previa interna
          </div>
          <h1
            style={{
              fontFamily: 'var(--fuente-titulos)',
              fontSize: '28px',
              fontWeight: 800,
              color: 'var(--cp-navy)',
              margin: '4px 0',
            }}
          >
            Capri - Mascota Oficial de Caprichos
          </h1>
          <p style={{ margin: 0, color: 'var(--cp-soft)', fontSize: '15px' }}>
            Personaje 3D procedural y versión 2D para asistencia de administración y clientes.
          </p>
        </header>

        {/* Visor Principal y Controles */}
        <main
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '24px',
            alignItems: 'start',
          }}
        >
          {/* Tarjeta del Visor */}
          <div
            style={{
              backgroundColor: 'var(--cp-white)',
              borderRadius: '16px',
              border: '1px solid var(--cp-line)',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              boxShadow: '0 4px 16px rgba(11, 44, 62, 0.06)',
            }}
          >
            <div
              style={{
                width: '100%',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px',
              }}
            >
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: 'var(--cp-soft)',
                  letterSpacing: '0.5px',
                }}
              >
                Modo:{' '}
                <strong style={{ color: forzar2D ? 'var(--cp-soft)' : 'var(--cp-green)' }}>
                  {forzar2D ? '2D Vectorial (SVG)' : soportaWebGL ? '3D Procedural (Three.js)' : '2D (Sin WebGL)'}
                </strong>
              </span>

              <button
                type="button"
                onClick={() => setForzar2D((prev) => !prev)}
                style={{
                  minHeight: '36px',
                  padding: '6px 14px',
                  backgroundColor: forzar2D ? 'var(--cp-navy)' : 'var(--cp-sand)',
                  color: forzar2D ? 'var(--cp-white)' : 'var(--cp-navy)',
                  border: '1px solid var(--cp-line2)',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {forzar2D ? 'Conmutar a 3D' : 'Forzar Fallback 2D'}
              </button>
            </div>

            {/* Canvas / Renderizador */}
            <div
              style={{
                width: '320px',
                height: '320px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'var(--cp-sand)',
                borderRadius: '12px',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <MascotaCapri
                estado={estado}
                tamano={300}
                forzarFallback2D={forzar2D}
              />
            </div>

            {/* Estado actual y descripción */}
            <div
              style={{
                marginTop: '18px',
                width: '100%',
                backgroundColor: 'var(--cp-cream)',
                borderRadius: '8px',
                padding: '12px 14px',
                borderLeft: '4px solid var(--cp-orange)',
              }}
            >
              <div
                style={{
                  fontWeight: 700,
                  fontSize: '13px',
                  textTransform: 'uppercase',
                  color: 'var(--cp-orange)',
                  marginBottom: '4px',
                }}
              >
                Estado actual: {estado}
              </div>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--cp-navy)', lineHeight: '18px' }}>
                {DESCRIPCIONES_ESTADO[estado]}
              </p>
            </div>
          </div>

          {/* Panel de Control de Estados */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div
              style={{
                backgroundColor: 'var(--cp-white)',
                borderRadius: '16px',
                border: '1px solid var(--cp-line)',
                padding: '20px',
                boxShadow: '0 4px 16px rgba(11, 44, 62, 0.06)',
              }}
            >
              <h2
                style={{
                  fontSize: '16px',
                  fontWeight: 700,
                  marginBottom: '14px',
                  color: 'var(--cp-navy)',
                }}
              >
                Seleccionar estado de animación
              </h2>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                  gap: '10px',
                }}
              >
                {ESTADOS_CAPRI.map((nombreEstado) => {
                  const activo = estado === nombreEstado;
                  return (
                    <button
                      key={nombreEstado}
                      type="button"
                      onClick={() => setEstado(nombreEstado)}
                      style={{
                        minHeight: '44px',
                        padding: '8px 12px',
                        backgroundColor: activo ? 'var(--cp-orange)' : 'var(--cp-cream)',
                        color: activo ? 'var(--cp-white)' : 'var(--cp-navy)',
                        border: activo
                          ? '2px solid var(--cp-orange)'
                          : '1px solid var(--cp-line2)',
                        borderRadius: '8px',
                        fontWeight: activo ? 700 : 600,
                        fontSize: '13px',
                        textTransform: 'capitalize',
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {nombreEstado}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Ficha técnica y paleta de diseño */}
            <div
              style={{
                backgroundColor: 'var(--cp-white)',
                borderRadius: '16px',
                border: '1px solid var(--cp-line)',
                padding: '20px',
                boxShadow: '0 4px 16px rgba(11, 44, 62, 0.06)',
              }}
            >
              <h3
                style={{
                  fontSize: '15px',
                  fontWeight: 700,
                  color: 'var(--cp-navy)',
                  marginBottom: '10px',
                }}
              >
                Ficha de identidad de marca
              </h3>
              <ul
                style={{
                  margin: '0 0 16px 0',
                  paddingLeft: '20px',
                  fontSize: '13px',
                  color: 'var(--cp-soft)',
                  lineHeight: '20px',
                }}
              >
                <li>
                  <strong>Cabeza:</strong> Gorro de chef esponjoso crema (#FBF4EC) con ojos expresivos y mejillas suaves.
                </li>
                <li>
                  <strong>Cuerpo:</strong> Cono truncado naranja (#E67929) derivado directamente del isotipo.
                </li>
                <li>
                  <strong>Brazos:</strong> Tenedor y espátula redondeados amables en ángulo de V del logo corporativo.
                </li>
                <li>
                  <strong>Detalle:</strong> Delantal azul marino (#0B2C3E) con ribete y botones dorados (#D99E39).
                </li>
              </ul>

              <h4
                style={{
                  fontSize: '13px',
                  fontWeight: 700,
                  color: 'var(--cp-navy)',
                  marginBottom: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                Paleta corporativa
              </h4>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {[
                  { etiqueta: 'Azul marino', hex: '#0B2C3E', variable: '--cp-navy', textoBlanco: true },
                  { etiqueta: 'Naranja', hex: '#E67929', variable: '--cp-orange', textoBlanco: true },
                  { etiqueta: 'Dorado', hex: '#D99E39', variable: '--cp-gold', textoBlanco: true },
                  { etiqueta: 'Crema', hex: '#FBF4EC', variable: '--cp-cream', textoBlanco: false },
                ].map((item) => (
                  <div
                    key={item.hex}
                    style={{
                      flex: '1 1 80px',
                      backgroundColor: item.hex,
                      color: item.textoBlanco ? '#FFFFFF' : '#0B2C3E',
                      borderRadius: '8px',
                      padding: '8px',
                      fontSize: '11px',
                      border: '1px solid var(--cp-line)',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontWeight: 700 }}>{item.hex}</div>
                    <div style={{ opacity: 0.9 }}>{item.etiqueta}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default PaginaMascota;
