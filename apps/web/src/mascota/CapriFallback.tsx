import { useId } from 'react';
import type { EstadoCapri } from './animaciones';
import type { AspectoCapri } from './tiposAspecto';
import { sanitizarAspecto } from './aspectoUtils';

export interface CapriFallbackProps {
  estado?: EstadoCapri;
  tamano?: number;
  className?: string;
  alHacerClic?: () => void;
  aspecto?: AspectoCapri;
}

/**
 * Versión 2D de Capri en SVG vectorial y CSS.
 * Proporciona máxima accesibilidad, soporte sin WebGL y respeto estricto a prefers-reduced-motion.
 * Acepta opcionalmente un objeto 'aspecto' con colores, estilos de cabello, gorro y accesorios.
 */
export function CapriFallback({
  estado = 'reposo',
  tamano = 160,
  className = '',
  alHacerClic,
  aspecto: aspectoProp,
}: CapriFallbackProps) {
  const reactId = useId().replace(/:/g, '');
  const asp = sanitizarAspecto(aspectoProp);

  // Clases o modificadores CSS según el estado
  const esDormido = estado === 'dormido';
  const esPensando = estado === 'pensando';
  const esContento = estado === 'contento';
  const esSaludando = estado === 'saludando';
  const esHablando = estado === 'hablando';
  const esConfundido = estado === 'confundido';

  // Paleta resuelta desde el aspecto
  const colorPiel = asp.piel;
  const colorPelo = asp.cabello.color;
  const estiloPelo = asp.cabello.estilo;
  const colorOjos = asp.ojos;
  const colorPrincipal = asp.uniforme.principal;
  const colorDelantal = asp.uniforme.delantal;
  const colorRibete = asp.uniforme.ribete;
  const tipoGorro = asp.gorro.tipo;
  const colorGorro = asp.gorro.color;
  const accesorios = asp.accesorios;

  // Ids únicos para gradientes SVG
  const gradCuerpoId = `capri-grad-cuerpo-${reactId}`;
  const gradPielId = `capri-grad-piel-${reactId}`;
  const sombraSuaveId = `capri-sombra-suave-${reactId}`;

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
          <radialGradient id={sombraSuaveId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#0B2C3E" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#0B2C3E" stopOpacity="0" />
          </radialGradient>

          {/* Gradiente para el cuerpo con el color principal del uniforme */}
          <linearGradient id={gradCuerpoId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={colorPrincipal} stopOpacity="0.9" />
            <stop offset="100%" stopColor={colorPrincipal} />
          </linearGradient>

          {/* Gradiente sutil para la piel */}
          <linearGradient id={gradPielId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={colorPiel} />
            <stop offset="100%" stopColor={colorPiel} stopOpacity="0.88" />
          </linearGradient>
        </defs>

        {/* 1. Sombra de contacto */}
        <ellipse
          cx="120"
          cy="222"
          rx={esContento ? '36' : '52'}
          ry="10"
          fill={`url(#${sombraSuaveId})`}
          className="capri-sombra-anim"
        />

        {/* Grupo que contiene todo el personaje con animación de balanceo/rebote */}
        <g
          className={`capri-anim-cuerpo ${
            esContento
              ? 'capri-salto'
              : esDormido
              ? 'capri-respiro-lento'
              : 'capri-respiro'
          }`}
        >
          {/* 2. Brazos: Tenedor y Cuchillo / Espátula */}
          {/* Brazo Izquierdo (Tenedor estilizado) */}
          <g
            id="capri-brazo-izq"
            className={
              esContento
                ? 'capri-brazo-arriba-izq'
                : esConfundido
                ? 'capri-brazo-duda'
                : ''
            }
            style={{
              transformOrigin: '76px 145px',
              transition: 'transform 0.3s ease',
            }}
          >
            {/* Manga / brazo color principal */}
            <path
              d="M 78 140 C 58 148, 48 162, 42 178"
              stroke={colorPrincipal}
              strokeWidth="14"
              strokeLinecap="round"
            />
            {/* Puño ribete dorado */}
            <circle cx="42" cy="178" r="8" fill={colorRibete} />
            {/* Palma del tenedor */}
            <path
              d="M 34 182 C 34 176, 50 176, 50 182 C 50 190, 34 190, 34 182 Z"
              fill="#FBF4EC"
              stroke="#1C1C22"
              strokeWidth="2.5"
            />
            {/* Dientes del tenedor redondeados */}
            <path
              d="M 37 186 L 37 197 M 42 186 L 42 199 M 47 186 L 47 197"
              stroke="#1C1C22"
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
            {/* Manga / brazo color principal */}
            <path
              d="M 162 140 C 182 148, 192 162, 198 178"
              stroke={colorPrincipal}
              strokeWidth="14"
              strokeLinecap="round"
            />
            {/* Puño ribete */}
            <circle cx="198" cy="178" r="8" fill={colorRibete} />
            {/* Hoja del cuchillo redondeada / espátula pastelera */}
            <rect
              x="193"
              y="180"
              width="10"
              height="20"
              rx="5"
              fill="#FBF4EC"
              stroke="#1C1C22"
              strokeWidth="2.5"
            />
          </g>

          {/* 3. Base / Zapatitos */}
          <ellipse cx="102" cy="214" rx="14" ry="8" fill="#1C1C22" />
          <ellipse cx="138" cy="214" rx="14" ry="8" fill="#1C1C22" />

          {/* 4. Cuerpo: Cono / Campana del uniforme */}
          <path
            d="M 88 126 L 68 200 C 68 214, 172 214, 172 200 L 152 126 Z"
            fill={`url(#${gradCuerpoId})`}
          />

          {/* Delantal del uniforme */}
          <path
            d="M 96 128 L 84 196 C 94 204, 146 204, 156 196 L 144 128 Z"
            fill={colorDelantal}
          />

          {/* Ribete del delantal y cuello */}
          <path
            d="M 86 126 Q 120 134 154 126"
            stroke={colorRibete}
            strokeWidth="5"
            strokeLinecap="round"
          />

          {/* Botones del delantal */}
          <circle cx="120" cy="155" r="4.5" fill={colorRibete} />
          <circle cx="120" cy="175" r="4.5" fill={colorRibete} />

          {/* Accesorios en el cuerpo/cuello */}
          {accesorios.includes('bufanda') && (
            <g id="capri-acc-bufanda">
              <path
                d="M 82 122 Q 120 136 158 122 Q 164 128 156 136 Q 120 146 84 136 Z"
                fill="#C5221F"
                stroke="#901515"
                strokeWidth="1.2"
              />
              <path
                d="M 132 132 L 136 174 L 148 172 L 144 130 Z"
                fill="#C5221F"
                stroke="#901515"
                strokeWidth="1.2"
              />
              <path
                d="M 136 174 L 136 180 M 140 173 L 140 180 M 144 173 L 144 179 M 148 172 L 148 178"
                stroke="#FFFFFF"
                strokeWidth="1.8"
              />
            </g>
          )}

          {accesorios.includes('guirnalda') && (
            <g id="capri-acc-guirnalda">
              <circle cx="94" cy="128" r="4.5" fill="#E84A7F" />
              <circle cx="107" cy="133" r="4.5" fill="#2F7A45" />
              <circle cx="120" cy="135" r="4.5" fill={colorRibete} />
              <circle cx="133" cy="133" r="4.5" fill="#2F7A45" />
              <circle cx="146" cy="128" r="4.5" fill="#E84A7F" />
            </g>
          )}

          {accesorios.includes('lazo') && (
            <g id="capri-acc-lazo" transform="translate(120, 134)" fill="#E84A7F">
              <polygon points="0,0 -12,-6 -10,6" />
              <polygon points="0,0 12,-6 10,6" />
              <circle cx="0" cy="0" r="3.5" fill={colorRibete} />
            </g>
          )}

          {accesorios.includes('calabaza') && (
            <g id="capri-acc-calabaza" transform="translate(138, 162)">
              <ellipse cx="0" cy="0" rx="11" ry="9" fill="#E67929" stroke="#B2500F" strokeWidth="1" />
              <path d="M 0 -9 L 2 -13" stroke="#2F7A45" strokeWidth="2.5" strokeLinecap="round" />
              <polygon points="-4,-2 -2,-2 -3,-4" fill="#2B1B3F" />
              <polygon points="4,-2 2,-2 3,-4" fill="#2B1B3F" />
              <path d="M -5 2 Q 0 6 5 2 Z" fill="#2B1B3F" />
            </g>
          )}

          {accesorios.includes('corazon') && (
            <g id="capri-acc-corazon" transform="translate(98, 150) scale(0.85)">
              <path
                d="M 12 4 C 12 0, 4 0, 4 6 C 4 12, 12 18, 12 18 C 12 18, 20 12, 20 6 C 20 0, 12 0, 12 4 Z"
                fill="#E84A7F"
                stroke="#FFFFFF"
                strokeWidth="1.5"
              />
            </g>
          )}

          {accesorios.includes('bandera') && (
            <g id="capri-acc-bandera" transform="translate(96, 146)">
              <rect x="0" y="0" width="4" height="14" fill="#C5221F" />
              <rect x="4" y="0" width="4" height="14" fill="#FFFFFF" />
              <rect x="8" y="0" width="4" height="14" fill="#C5221F" />
              <circle cx="6" cy="0" r="4.5" fill={colorRibete} />
            </g>
          )}

          {/* 5. Cabeza: Cabello, Carita, Gorro y Accesorios faciales */}
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
            {/* Cabello: Base casquete atrás */}
            <circle cx="120" cy="104" r="48" fill={colorPelo} />

            {/* Estilo de Cabello: Colitas */}
            {estiloPelo === 'colitas' && (
              <g id="capri-pelo-colitas">
                <ellipse cx="70" cy="122" rx="12" ry="20" fill={colorPelo} transform="rotate(25 70 122)" />
                <ellipse cx="170" cy="122" rx="12" ry="20" fill={colorPelo} transform="rotate(-25 170 122)" />
                <g fill={colorPrincipal}>
                  <ellipse cx="76" cy="104" rx="9" ry="6" transform="rotate(-25 76 104)" />
                  <ellipse cx="164" cy="104" rx="9" ry="6" transform="rotate(25 164 104)" />
                </g>
                <circle cx="76" cy="104" r="3.5" fill={colorRibete} />
                <circle cx="164" cy="104" r="3.5" fill={colorRibete} />
              </g>
            )}

            {/* Estilo de Cabello: Suelto */}
            {estiloPelo === 'suelto' && (
              <g id="capri-pelo-suelto" fill={colorPelo}>
                <path d="M 68 100 C 58 120, 54 160, 66 186 C 72 189, 78 184, 76 174 C 72 148, 76 120, 82 104 Z" />
                <path d="M 172 100 C 182 120, 186 160, 174 186 C 168 189, 162 184, 164 174 C 168 148, 164 120, 158 104 Z" />
              </g>
            )}

            {/* Estilo de Cabello: Trenza */}
            {estiloPelo === 'trenza' && (
              <g id="capri-pelo-trenza">
                <g fill={colorPelo}>
                  <circle cx="68" cy="115" r="9" />
                  <circle cx="64" cy="129" r="8" />
                  <circle cx="62" cy="142" r="7" />
                  <circle cx="60" cy="154" r="6" />

                  <circle cx="172" cy="115" r="9" />
                  <circle cx="176" cy="129" r="8" />
                  <circle cx="178" cy="142" r="7" />
                  <circle cx="180" cy="154" r="6" />
                </g>
                <circle cx="60" cy="158" r="3" fill={colorRibete} />
                <circle cx="180" cy="158" r="3" fill={colorRibete} />
              </g>
            )}

            {/* Estilo de Cabello: Moño */}
            {estiloPelo === 'mono' && (
              <g id="capri-pelo-mono">
                <circle cx="120" cy="56" r="22" fill={colorPelo} />
                <ellipse cx="120" cy="74" rx="14" ry="4" fill={colorRibete} />
              </g>
            )}

            {/* Carita redonda color piel */}
            <circle cx="120" cy="106" r="44" fill={`url(#${gradPielId})`} />
            <ellipse cx="82" cy="108" rx="5" ry="8" fill={colorPiel} />
            <ellipse cx="158" cy="108" rx="5" ry="8" fill={colorPiel} />

            {/* Flequillo */}
            <path
              d="M 77 92 Q 76 72 98 70 L 142 70 Q 164 72 163 92 Q 158 80 146 77 Q 128 84 112 78 Q 92 76 84 90 Q 80 94 77 92 Z"
              fill={colorPelo}
            />

            {/* GORRO según tipoGorro */}
            {tipoGorro === 'chef' && (
              <g id="capri-gorro-chef">
                <g stroke="#E3D6C6" strokeWidth="1.5">
                  <circle cx="120" cy="30" r="24" fill={colorGorro} />
                  <circle cx="94" cy="42" r="20" fill={colorGorro} />
                  <circle cx="146" cy="42" r="20" fill={colorGorro} />
                  <rect x="84" y="46" width="72" height="26" rx="9" fill={colorGorro} />
                </g>
                <rect x="84" y="62" width="72" height="6" fill={colorDelantal} />
                <rect x="84" y="68" width="72" height="3" rx="1.5" fill={colorRibete} />
                <g fill={colorPrincipal} stroke="#B2500F" strokeWidth="1">
                  <ellipse cx="146" cy="56" rx="11" ry="7" transform="rotate(-30 146 56)" />
                  <ellipse cx="160" cy="62" rx="11" ry="7" transform="rotate(30 160 62)" />
                </g>
                <circle cx="153" cy="59" r="4" fill={colorRibete} />
              </g>
            )}

            {tipoGorro === 'bruja' && (
              <g id="capri-gorro-bruja">
                <ellipse cx="120" cy="68" rx="56" ry="12" fill={colorGorro} stroke="#1C1C22" strokeWidth="1.5" />
                <path
                  d="M 82 66 Q 105 18 135 12 Q 138 12 142 16 Q 136 28 154 66 Z"
                  fill={colorGorro}
                  stroke="#1C1C22"
                  strokeWidth="1.5"
                />
                <path d="M 88 64 Q 118 68 148 64 L 149 60 Q 118 63 87 60 Z" fill={colorRibete} />
                <rect x="114" y="58" width="12" height="10" rx="2" fill="#D99E39" stroke="#1C1C22" strokeWidth="1" />
              </g>
            )}

            {tipoGorro === 'navideno' && (
              <g id="capri-gorro-navideno">
                <path d="M 86 58 Q 110 22 166 26 Q 175 42 154 58 Z" fill={colorGorro} />
                <rect x="80" y="56" width="80" height="16" rx="8" fill="#FFFFFF" stroke="#E3D6C6" strokeWidth="1" />
                <circle cx="170" cy="32" r="13" fill="#FFFFFF" stroke="#E3D6C6" strokeWidth="1" />
              </g>
            )}

            {tipoGorro === 'corona' && (
              <g id="capri-gorro-corona">
                <path
                  d="M 90 70 L 84 46 L 102 56 L 120 40 L 138 56 L 156 46 L 150 70 Z"
                  fill={colorGorro || '#D99E39'}
                  stroke="#B2500F"
                  strokeWidth="1.5"
                />
                <rect x="88" y="66" width="64" height="6" rx="2" fill="#D99E39" stroke="#B2500F" strokeWidth="1" />
                <circle cx="84" cy="46" r="3.5" fill="#E84A7F" />
                <circle cx="120" cy="40" r="4.5" fill="#3BB4E7" />
                <circle cx="156" cy="46" r="3.5" fill="#E84A7F" />
              </g>
            )}

            {tipoGorro === 'sombrero' && (
              <g id="capri-gorro-sombrero">
                <ellipse cx="120" cy="68" rx="52" ry="11" fill={colorGorro} stroke="#B2500F" strokeWidth="1.2" />
                <path
                  d="M 92 66 C 92 46, 102 38, 120 38 C 138 38, 148 46, 148 66 Z"
                  fill={colorGorro}
                  stroke="#B2500F"
                  strokeWidth="1.2"
                />
                <path d="M 94 62 Q 120 67 146 62 L 147 57 Q 120 62 93 57 Z" fill={colorRibete} />
              </g>
            )}

            {/* OJOS */}
            {esDormido ? (
              <g stroke="#1C1C22" strokeWidth="3.5" strokeLinecap="round">
                <path d="M 92 104 Q 101 112 110 104" />
                <path d="M 130 104 Q 139 112 148 104" />
              </g>
            ) : esContento ? (
              <g stroke="#1C1C22" strokeWidth="4" strokeLinecap="round">
                <path d="M 92 106 Q 101 96 110 106" />
                <path d="M 130 106 Q 139 96 148 106" />
              </g>
            ) : (
              <g>
                {/* Ojo Izquierdo con color de iris/pupila configurable */}
                <ellipse cx="101" cy="103" rx="12" ry="14" fill={colorOjos} />
                <circle cx="105" cy="97" r="5" fill="#FFFFFF" />
                <circle cx="98" cy="106" r="2" fill="#FFFFFF" />
                <path
                  d="M 89 90 Q 101 80 113 90 M 87 98 L 82 94 M 90 94 L 86 89"
                  stroke="#1C1C22"
                  strokeWidth="2"
                  strokeLinecap="round"
                  fill="none"
                />

                {/* Ojo Derecho con color de iris/pupila configurable */}
                <ellipse cx="139" cy="103" rx="12" ry="14" fill={colorOjos} />
                <circle cx="143" cy="97" r="5" fill="#FFFFFF" />
                <circle cx="136" cy="106" r="2" fill="#FFFFFF" />
                <path
                  d="M 127 90 Q 139 80 151 90 M 153 98 L 158 94 M 150 94 L 154 89"
                  stroke="#1C1C22"
                  strokeWidth="2"
                  strokeLinecap="round"
                  fill="none"
                />
              </g>
            )}

            {/* Antifaz sobre los ojos si está activo */}
            {accesorios.includes('antifaz') && (
              <g id="capri-acc-antifaz">
                <path
                  d="M 86 100 Q 102 90 118 100 Q 120 102 122 100 Q 138 90 154 100 Q 158 116 142 115 Q 128 114 122 105 Q 116 114 98 115 Q 82 116 86 100 Z"
                  fill="#1C1C22"
                  opacity="0.92"
                />
              </g>
            )}

            {/* MEJILLAS (Rubor suave rosado) */}
            <ellipse cx="88" cy="112" rx="9" ry="5.5" fill="#F78D74" opacity="0.9" />
            <ellipse cx="152" cy="112" rx="9" ry="5.5" fill="#F78D74" opacity="0.9" />

            {/* Bigote si está activo */}
            {accesorios.includes('bigote') && (
              <path
                id="capri-acc-bigote"
                d="M 120 115 C 114 111, 108 112, 106 117 C 110 118, 116 117, 120 118 C 124 117, 130 118, 134 117 C 132 112, 126 111, 120 115 Z"
                fill={colorPelo}
              />
            )}

            {/* BOCA */}
            {esHablando ? (
              <ellipse cx="120" cy="114" rx="7" ry="9" fill="#1C1C22" />
            ) : esContento ? (
              <path
                d="M 111 111 Q 120 122 129 111"
                stroke="#1C1C22"
                strokeWidth="3.5"
                strokeLinecap="round"
                fill="#B2500F"
              />
            ) : (
              <path
                d="M 113 112 Q 120 119 127 112"
                stroke="#1C1C22"
                strokeWidth="3"
                strokeLinecap="round"
              />
            )}

            {/* DETALLES FLOTANTES SEGÚN ESTADO O ACCESORIOS */}
            {/* Accesorio estrellas */}
            {accesorios.includes('estrellas') && (
              <g id="capri-acc-estrellas" fill={colorRibete} className="capri-brillo-flotante">
                <path d="M 64 68 Q 64 74 58 74 Q 64 74 64 80 Q 64 74 70 74 Q 64 74 64 68 Z" />
                <path d="M 176 68 Q 176 74 170 74 Q 176 74 176 80 Q 176 74 182 74 Q 176 74 176 68 Z" />
              </g>
            )}

            {/* Pensando */}
            {esPensando && (
              <g className="capri-pensar-flotante" transform="translate(168, 22)">
                <circle cx="14" cy="14" r="13" fill={colorRibete} opacity="0.25" />
                <path
                  d="M 8 10 C 8 5, 18 5, 18 10 C 18 14, 13 13, 13 18"
                  stroke={colorRibete}
                  strokeWidth="3"
                  strokeLinecap="round"
                  fill="none"
                />
                <circle cx="13" cy="23" r="2" fill={colorRibete} />
              </g>
            )}

            {/* Contento: destellos dorados */}
            {esContento && (
              <g className="capri-brillo-flotante">
                <path
                  d="M 68 34 Q 68 44 58 44 Q 68 44 68 54 Q 68 44 78 44 Q 68 44 68 34 Z"
                  fill={colorRibete}
                />
                <path
                  d="M 174 38 Q 174 46 166 46 Q 174 46 174 54 Q 174 46 182 46 Q 174 46 174 38 Z"
                  fill={colorRibete}
                />
              </g>
            )}

            {/* Confundido */}
            {esConfundido && (
              <g transform="translate(162, 32)">
                <path
                  d="M 6 8 C 6 4, 14 4, 14 8 C 14 11, 10 11, 10 15"
                  stroke="#1C1C22"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  fill="none"
                />
                <circle cx="10" cy="19" r="1.5" fill="#1C1C22" />
              </g>
            )}

            {/* Dormido: Zzz */}
            {esDormido && (
              <g className="capri-zzz-flotante" fill="#1C1C22" opacity="0.75" fontWeight="bold">
                <text x="156" y="55" fontSize="16" fontFamily="sans-serif">
                  Z
                </text>
                <text x="172" y="42" fontSize="21" fontFamily="sans-serif">
                  Z
                </text>
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
