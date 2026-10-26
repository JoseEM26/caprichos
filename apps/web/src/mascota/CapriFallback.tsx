import type { EstadoCapri } from './animaciones';

export interface CapriFallbackProps {
  estado?: EstadoCapri;
  tamano?: number;
  className?: string;
  alHacerClic?: () => void;
}

/**
 * Versión 2D de Capri en SVG vectorial y CSS.
 * Proporciona máxima accesibilidad, soporte sin WebGL y respeto estricto a prefers-reduced-motion.
 */
export function CapriFallback({
  estado = 'reposo',
  tamano = 160,
  className = '',
  alHacerClic,
}: CapriFallbackProps) {
  // Clases o modificadores CSS según el estado
  const esDormido = estado === 'dormido';
  const esPensando = estado === 'pensando';
  const esContento = estado === 'contento';
  const esSaludando = estado === 'saludando';
  const esHablando = estado === 'hablando';
  const esConfundido = estado === 'confundido';

  return (
    <div
      role="img"
      aria-label="Capri, la asistente de Caprichos"
      className={`capri-fallback capri-estado-${estado} ${className}`}
      style={{
        width: tamano,
        height: tamano,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        userSelect: 'none',
        cursor: alHacerClic ? 'pointer' : 'default',
      }}
      onClick={alHacerClic}
    >
      <svg
        viewBox="0 0 240 240"
        width="100%"
        height="100%"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ overflow: 'visible' }}
      >
        <defs>
          {/* Sombras suaves vectoriales */}
          <radialGradient id="capri-sombra-suave" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#0B2C3E" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#0B2C3E" stopOpacity="0" />
          </radialGradient>

          {/* Gradiente sutil para el cuerpo naranja */}
          <linearGradient id="capri-grad-cuerpo" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#F08738" />
            <stop offset="100%" stopColor="#E67929" />
          </linearGradient>

          {/* Gradiente sutil para el gorro crema */}
          <linearGradient id="capri-grad-gorro" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#FBF4EC" />
          </linearGradient>
        </defs>

        {/* 1. Sombra de contacto */}
        <ellipse
          cx="120"
          cy="222"
          rx={esContento ? '36' : '52'}
          ry="10"
          fill="url(#capri-sombra-suave)"
          className="capri-sombra-anim"
        />

        {/* Grupo que contiene todo el personaje con animación de balanceo/rebote */}
        <g className={`capri-anim-cuerpo ${esContento ? 'capri-salto' : esDormido ? 'capri-respiro-lento' : 'capri-respiro'}`}>
          {/* 2. Brazos: Tenedor y Cuchillo */}
          {/* Brazo Izquierdo (Tenedor estilizado) */}
          <g
            id="capri-brazo-izq"
            className={esContento ? 'capri-brazo-arriba-izq' : esConfundido ? 'capri-brazo-duda' : ''}
            style={{
              transformOrigin: '76px 145px',
              transition: 'transform 0.3s ease',
            }}
          >
            {/* Manga / brazo naranja */}
            <path
              d="M 78 140 C 58 148, 48 162, 42 178"
              stroke="#E67929"
              strokeWidth="14"
              strokeLinecap="round"
            />
            {/* Puño dorado */}
            <circle cx="42" cy="178" r="8" fill="#D99E39" />
            {/* Palma del tenedor */}
            <path
              d="M 34 182 C 34 176, 50 176, 50 182 C 50 190, 34 190, 34 182 Z"
              fill="#FBF4EC"
              stroke="#0B2C3E"
              strokeWidth="2.5"
            />
            {/* Dientes del tenedor redondeados */}
            <path
              d="M 37 186 L 37 197 M 42 186 L 42 199 M 47 186 L 47 197"
              stroke="#0B2C3E"
              strokeWidth="3.2"
              strokeLinecap="round"
            />
          </g>

          {/* Brazo Derecho (Cuchillo/espátula amigable) */}
          <g
            id="capri-brazo-der"
            className={
              esSaludando
                ? 'capri-saludo-anim'
                : esContento
                ? 'capri-brazo-arriba-der'
                : esPensando
                ? 'capri-brazo-menton'
                : ''
            }
            style={{
              transformOrigin: '164px 145px',
              transition: 'transform 0.3s ease',
            }}
          >
            {/* Manga / brazo naranja */}
            <path
              d="M 162 140 C 182 148, 192 162, 198 178"
              stroke="#E67929"
              strokeWidth="14"
              strokeLinecap="round"
            />
            {/* Puño dorado */}
            <circle cx="198" cy="178" r="8" fill="#D99E39" />
            {/* Hoja del cuchillo redondeada / espátula pastelera */}
            <rect
              x="193"
              y="180"
              width="10"
              height="20"
              rx="5"
              fill="#FBF4EC"
              stroke="#0B2C3E"
              strokeWidth="2.5"
            />
          </g>

          {/* 3. Base / Zapatitos */}
          <ellipse cx="102" cy="214" rx="14" ry="8" fill="#0B2C3E" />
          <ellipse cx="138" cy="214" rx="14" ry="8" fill="#0B2C3E" />

          {/* 4. Cuerpo: Cono / Triángulo Naranja del logo */}
          <path
            d="M 88 126 L 68 200 C 68 214, 172 214, 172 200 L 152 126 Z"
            fill="url(#capri-grad-cuerpo)"
          />

          {/* Delantal azul marino */}
          <path
            d="M 96 128 L 84 196 C 94 204, 146 204, 156 196 L 144 128 Z"
            fill="#0B2C3E"
          />

          {/* Ribete dorado del delantal y cuello */}
          <path
            d="M 86 126 Q 120 134 154 126"
            stroke="#D99E39"
            strokeWidth="5"
            strokeLinecap="round"
          />

          {/* Botones dorados */}
          <circle cx="120" cy="155" r="4.5" fill="#D99E39" />
          <circle cx="120" cy="175" r="4.5" fill="#D99E39" />

          {/* 5. Cabeza: Gorro de Chef y Carita */}
          <g
            id="capri-cabeza-grupo"
            className={
              esPensando
                ? 'capri-cabeza-pensar'
                : esConfundido
                ? 'capri-cabeza-confundida'
                : esDormido
                ? 'capri-cabeza-dormida'
                : ''
            }
            style={{
              transformOrigin: '120px 125px',
              transition: 'transform 0.3s ease',
            }}
          >
            {/* Lóbulos esponjosos del gorro de chef */}
            {/* Lóbulo posterior / central */}
            <circle cx="120" cy="62" r="38" fill="url(#capri-grad-gorro)" />
            {/* Lóbulos laterales de nube */}
            <circle cx="78" cy="74" r="28" fill="url(#capri-grad-gorro)" />
            <circle cx="162" cy="74" r="28" fill="url(#capri-grad-gorro)" />
            <circle cx="94" cy="50" r="26" fill="url(#capri-grad-gorro)" />
            <circle cx="146" cy="50" r="26" fill="url(#capri-grad-gorro)" />

            {/* Base cilíndrica del gorro donde reposa la carita */}
            <path
              d="M 72 88 C 72 78, 168 78, 168 88 L 164 124 C 164 130, 76 130, 76 124 Z"
              fill="url(#capri-grad-gorro)"
            />

            {/* Cinta azul marino de la base del gorro */}
            <path
              d="M 75 120 Q 120 126 165 120"
              stroke="#0B2C3E"
              strokeWidth="4"
              strokeLinecap="round"
            />

            {/* OJOS */}
            {esDormido ? (
              // Ojos cerrados durmiendo: arcos curvos hacia abajo
              <g stroke="#0B2C3E" strokeWidth="3.5" strokeLinecap="round">
                <path d="M 92 104 Q 101 112 110 104" />
                <path d="M 130 104 Q 139 112 148 104" />
              </g>
            ) : esContento ? (
              // Ojos sonrientes de felicidad extrema: arcos curvos hacia arriba (^ ^)
              <g stroke="#0B2C3E" strokeWidth="4" strokeLinecap="round">
                <path d="M 92 106 Q 101 96 110 106" />
                <path d="M 130 106 Q 139 96 148 106" />
              </g>
            ) : (
              // Ojos grandes brillantes normales
              <g>
                {/* Ojo Izquierdo */}
                <ellipse cx="101" cy="103" rx="10" ry="12" fill="#0B2C3E" />
                <circle cx="104" cy="99" r="4" fill="#FFFFFF" />
                <circle cx="98" cy="106" r="2" fill="#FFFFFF" />

                {/* Ojo Derecho */}
                <ellipse cx="139" cy="103" rx="10" ry="12" fill="#0B2C3E" />
                <circle cx="142" cy="99" r="4" fill="#FFFFFF" />
                <circle cx="136" cy="106" r="2" fill="#FFFFFF" />
              </g>
            )}

            {/* MEJILLAS (Rubor suave rosado) */}
            <ellipse cx="88" cy="112" rx="7" ry="4.5" fill="#F78D74" opacity="0.85" />
            <ellipse cx="152" cy="112" rx="7" ry="4.5" fill="#F78D74" opacity="0.85" />

            {/* BOCA */}
            {esHablando ? (
              // Boca abierta hablando
              <ellipse cx="120" cy="114" rx="7" ry="9" fill="#0B2C3E" />
            ) : esContento ? (
              // Sonrisa ancha
              <path
                d="M 111 111 Q 120 122 129 111"
                stroke="#0B2C3E"
                strokeWidth="3.5"
                strokeLinecap="round"
                fill="#B2500F"
              />
            ) : (
              // Sonrisa suave amable
              <path
                d="M 113 112 Q 120 119 127 112"
                stroke="#0B2C3E"
                strokeWidth="3"
                strokeLinecap="round"
              />
            )}

            {/* DETALLES FLOTANTES SEGÚN ESTADO */}
            {/* Pensando: bombilla / signo de duda dorado flotando */}
            {esPensando && (
              <g className="capri-pensar-flotante" transform="translate(168, 22)">
                <circle cx="14" cy="14" r="13" fill="#D99E39" opacity="0.25" />
                <path
                  d="M 8 10 C 8 5, 18 5, 18 10 C 18 14, 13 13, 13 18"
                  stroke="#D99E39"
                  strokeWidth="3"
                  strokeLinecap="round"
                  fill="none"
                />
                <circle cx="13" cy="23" r="2" fill="#D99E39" />
              </g>
            )}

            {/* Contento: destellos dorados */}
            {esContento && (
              <g className="capri-brillo-flotante">
                {/* Estrella 1 */}
                <path
                  d="M 68 34 Q 68 44 58 44 Q 68 44 68 54 Q 68 44 78 44 Q 68 44 68 34 Z"
                  fill="#D99E39"
                />
                {/* Estrella 2 */}
                <path
                  d="M 174 38 Q 174 46 166 46 Q 174 46 174 54 Q 174 46 182 46 Q 174 46 174 38 Z"
                  fill="#D99E39"
                />
              </g>
            )}

            {/* Confundido: signo de interrogación suave */}
            {esConfundido && (
              <g transform="translate(162, 32)">
                <path
                  d="M 6 8 C 6 4, 14 4, 14 8 C 14 11, 10 11, 10 15"
                  stroke="#0B2C3E"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  fill="none"
                />
                <circle cx="10" cy="19" r="1.5" fill="#0B2C3E" />
              </g>
            )}

            {/* Dormido: Zzz flotantes */}
            {esDormido && (
              <g className="capri-zzz-flotante" fill="#0B2C3E" opacity="0.75" fontWeight="bold">
                <text x="156" y="55" fontSize="16" fontFamily="sans-serif">Z</text>
                <text x="172" y="42" fontSize="21" fontFamily="sans-serif">Z</text>
              </g>
            )}
          </g>
        </g>
      </svg>

      {/* Estilos CSS scoped inline para animación fluida y soporte prefers-reduced-motion */}
      <style>{`
        @keyframes capriRespiro {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-3px); }
        }
        @keyframes capriRespiroLento {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-2px); }
        }
        @keyframes capriSalto {
          0%, 100% { transform: translateY(0px) scale(1, 1); }
          30% { transform: translateY(-16px) scale(0.96, 1.04); }
          60% { transform: translateY(-4px) scale(1.03, 0.97); }
        }
        @keyframes capriSaludo {
          0%, 100% { transform: rotate(-55deg) translate(-10px, -20px); }
          50% { transform: rotate(-85deg) translate(-18px, -28px); }
        }
        @keyframes capriPulsoFlotante {
          0%, 100% { transform: translateY(0) scale(1); opacity: 0.9; }
          50% { transform: translateY(-4px) scale(1.1); opacity: 1; }
        }

        .capri-respiro {
          animation: capriRespiro 2.8s ease-in-out infinite;
        }
        .capri-respiro-lento {
          animation: capriRespiroLento 4.5s ease-in-out infinite;
        }
        .capri-salto {
          animation: capriSalto 0.9s cubic-bezier(0.28, 0.84, 0.42, 1) infinite;
        }
        .capri-saludo-anim {
          animation: capriSaludo 0.7s ease-in-out infinite;
        }
        .capri-pensar-flotante, .capri-brillo-flotante, .capri-zzz-flotante {
          animation: capriPulsoFlotante 1.8s ease-in-out infinite;
        }

        .capri-cabeza-pensar {
          transform: rotate(6deg) translateY(-2px);
        }
        .capri-cabeza-confundida {
          transform: rotate(-10deg) translateY(-1px);
        }
        .capri-cabeza-dormida {
          transform: rotate(4deg) translateY(3px);
        }

        .capri-brazo-arriba-izq {
          transform: rotate(120deg) translate(-28px, 10px);
        }
        .capri-brazo-arriba-der {
          transform: rotate(-120deg) translate(28px, 10px);
        }
        .capri-brazo-menton {
          transform: rotate(-60deg) translate(8px, -15px);
        }
        .capri-brazo-duda {
          transform: rotate(25deg);
        }

        @media (prefers-reduced-motion: reduce) {
          .capri-anim-cuerpo,
          .capri-respiro,
          .capri-respiro-lento,
          .capri-salto,
          .capri-saludo-anim,
          .capri-pensar-flotante,
          .capri-brillo-flotante,
          .capri-zzz-flotante {
            animation: none !important;
            transition: none !important;
          }
        }
      `}</style>
    </div>
  );
}
