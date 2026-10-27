import { useEffect, useRef } from 'react';
import { L, ATRIBUCION, URL_TESELAS } from '../../comun/mapa/leaflet';
import { ZonaGeoItem, ZONAS_GEO_DEFECTO } from './zonasGeo';
import { COORDENADAS_TIENDA_DEFECTO, RutaSugeridaSector } from './calculoRuta';
import type { ColorEspera } from './repartosApi';
import { planificarEtiquetas, nombreEtiqueta, anchoTexto, ModoEtiqueta } from './etiquetasMapa';

export interface PuntoRepartoMapa {
  id: string;
  lat: number;
  lng: number;
  etiqueta: string; // Nombre del cliente
  codigo: string;   // Código del pedido (CP-...)
  detalle?: string;
  color: ColorEspera;
  orden?: number;   // 1, 2, 3 si forma parte de la ruta sugerida
  minutosEspera?: number;
  enReparto?: boolean; // ya tiene repartidor (en camino o asignado): pin con anillo
}

interface EntradaEtiqueta {
  id: string;
  pos: L.LatLngTuple;
  marker: L.Marker;
  elementos: Record<Exclude<ModoEtiqueta, 'oculta'>, HTMLElement>;
  anchoCompleta: number;
  anchoCodigo: number;
  prioridad: number;
}

export interface MapaRepartosProps {
  puntos: PuntoRepartoMapa[];
  zonas?: ZonaGeoItem[];
  conteoPorZona?: Record<string, number>;
  zonaFiltroActiva?: string;
  onSeleccionarZona?: (zona: string) => void;
  seleccionadoId?: string | null;
  onSeleccionarPunto?: (id: string) => void;
  rutaPuntos?: Array<[number, number]>;
  altura?: number | string;
  onTocarMapa?: () => void;
  esPantallaCompleta?: boolean;
  onAlternarPantallaCompleta?: () => void;
  // Rutas sugeridas por sector (Decisión firmada)
  rutasSugeridas?: RutaSugeridaSector[];
  rutaActivaId?: string | null;
  onSeleccionarRutaSugerida?: (ruta: RutaSugeridaSector) => void;
  mostrarRutasSugeridas?: boolean;
  onAlternarMostrarRutasSugeridas?: () => void;
  // Pedidos resaltados en naranja (p. ej. los elegidos en la vista del repartidor)
  resaltadosIds?: string[];
}

const CENTRO_LIMA: [number, number] = [
  COORDENADAS_TIENDA_DEFECTO.lat,
  COORDENADAS_TIENDA_DEFECTO.lng,
];

/**
 * Crea un icono de Pin personalizado para Leaflet con los 4 colores de espera y número de parada.
 */
function crearIconoPin(
  color: ColorEspera,
  orden?: number,
  elegido = false,
  enReparto = false,
  resaltado = false,
): L.DivIcon {
  const numStr = orden ? String(orden) : '';
  const clases = `cp-pin ${color} ${elegido ? 'elegido' : ''} ${enReparto ? 'en-reparto' : ''} ${resaltado ? 'resaltado' : ''}`.trim();

  return L.divIcon({
    className: clases,
    html: `<span></span>${numStr ? `<strong class="cp-pin-num">${numStr}</strong>` : ''}`,
    iconSize: [26, 26],
    iconAnchor: [13, 26],
  });
}

export function MapaRepartos({
  puntos,
  zonas: _zonas = ZONAS_GEO_DEFECTO,
  conteoPorZona: _conteoPorZona = {},
  zonaFiltroActiva: _zonaFiltroActiva,
  onSeleccionarZona: _onSeleccionarZona,
  seleccionadoId,
  onSeleccionarPunto,
  rutaPuntos = [],
  altura = 'min(65vh, 600px)',
  onTocarMapa,
  esPantallaCompleta = false,
  onAlternarPantallaCompleta,
  rutasSugeridas = [],
  rutaActivaId,
  onSeleccionarRutaSugerida,
  mostrarRutasSugeridas = false,
  onAlternarMostrarRutasSugeridas,
  resaltadosIds,
}: MapaRepartosProps) {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<L.Map | null>(null);
  const capaRutasSugeridasRef = useRef<L.LayerGroup | null>(null);
  const capaMarcadoresRef = useRef<L.LayerGroup | null>(null);
  const puntosAjustadosRef = useRef<PuntoRepartoMapa[] | null>(null);

  const alSeleccionarPuntoRef = useRef(onSeleccionarPunto);
  alSeleccionarPuntoRef.current = onSeleccionarPunto;

  const alSeleccionarRutaSugeridaRef = useRef(onSeleccionarRutaSugerida);
  alSeleccionarRutaSugeridaRef.current = onSeleccionarRutaSugerida;

  const alTocarMapaRef = useRef(onTocarMapa);
  alTocarMapaRef.current = onTocarMapa;

  const entradasEtiquetaRef = useRef<EntradaEtiqueta[]>([]);
  const recalcularEtiquetasRef = useRef<() => void>(() => {});

  // 1. Inicialización de Leaflet
  useEffect(() => {
    if (!contenedorRef.current) return;

    const map = L.map(contenedorRef.current, {
      zoomControl: false,
      attributionControl: false,
    }).setView(CENTRO_LIMA, 14);

    // Zoom abajo a la izquierda: los botones de arriba (rutas, pantalla completa) no lo tapan
    L.control.zoom({ position: 'bottomleft' }).addTo(map);

    L.tileLayer(URL_TESELAS, {
      attribution: ATRIBUCION,
      maxZoom: 19,
    }).addTo(map);

    L.control.attribution({ position: 'bottomright', prefix: false }).addTo(map);

    // Grupos de capas (zonas eliminadas del mapa según requerimiento b)
    capaRutasSugeridasRef.current = L.layerGroup().addTo(map);
    capaMarcadoresRef.current = L.layerGroup().addTo(map);

    mapaRef.current = map;

    map.on('click', (e: any) => {
      if (e.originalEvent?._stopped) return;
      alTocarMapaRef.current?.();
    });

    // Las etiquetas dependen de la posición en pantalla: se recalculan al mover o hacer zoom
    map.on('zoomend moveend', () => recalcularEtiquetasRef.current());

    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 150);

    return () => {
      clearTimeout(timer);
      map.remove();
      mapaRef.current = null;
      capaRutasSugeridasRef.current = null;
      capaMarcadoresRef.current = null;
    };
  }, []);

  // Invalidate size al cambiar pantalla completa o altura
  useEffect(() => {
    if (mapaRef.current) {
      setTimeout(() => {
        mapaRef.current?.invalidateSize();
      }, 100);
    }
  }, [esPantallaCompleta, altura, mostrarRutasSugeridas]);

  // 2. Dibujar Líneas de Rutas Sugeridas (hasta 3 con colores distintos y etiquetas de sector)
  useEffect(() => {
    const map = mapaRef.current;
    const gRutas = capaRutasSugeridasRef.current;
    if (!map || !gRutas) return;

    gRutas.clearLayers();

    if (mostrarRutasSugeridas && rutasSugeridas.length > 0) {
      rutasSugeridas.forEach((r) => {
        if (r.coordenadasRuta.length >= 2) {
          const esActiva = r.id === rutaActivaId;
          const linea = L.polyline(r.coordenadasRuta, {
            color: r.color,
            weight: esActiva ? 5 : 3.5,
            dashArray: esActiva ? undefined : '7, 6',
            lineJoin: 'round',
            lineCap: 'round',
            opacity: esActiva ? 1.0 : 0.85,
          });

          // Nombre de la ruta: permanente solo en la elegida (evita encimar nombres en el mapa);
          // las demás lo muestran al pasar el cursor y está en la lista inferior con pedidos, min y km
          linea.bindTooltip(r.nombre, {
            permanent: esActiva,
            sticky: true,
            direction: 'center',
            className: `cp-etiqueta-linea-ruta ${esActiva ? 'activa' : ''}`,
          });

          linea.on('click', (e) => {
            L.DomEvent.stopPropagation(e);
            alSeleccionarRutaSugeridaRef.current?.(r);
          });

          linea.addTo(gRutas);
        }
      });
    } else if (rutaPuntos.length >= 2) {
      const linea = L.polyline(rutaPuntos, {
        color: '#E67929',
        weight: 3.5,
        dashArray: '8, 6',
        lineJoin: 'round',
        lineCap: 'round',
        opacity: 0.9,
      });
      linea.addTo(gRutas);
    }
  }, [mostrarRutasSugeridas, rutasSugeridas, rutaActivaId, rutaPuntos]);

  // 3. Marcadores de pedidos y tienda. Cada etiqueta usa planificarEtiquetas: nombre + código,
  //    solo código si choca, u oculta si no cabe. Se recalcula al mover o hacer zoom.
  useEffect(() => {
    const map = mapaRef.current;
    const gMarcadores = capaMarcadoresRef.current;
    if (!map || !gMarcadores) return;

    gMarcadores.clearLayers();
    entradasEtiquetaRef.current = [];

    // Marcador Tienda Física de Caprichos
    const marcadorTienda = L.marker(CENTRO_LIMA, {
      icon: L.divIcon({
        className: 'cp-local-marker',
        html: `<div style="display:inline-flex;align-items:center;gap:6px;pointer-events:none;transform:translate(-8px,-12px);">
          <div style="width:18px;height:18px;background:#0B2C3E;border-radius:5px;border:2px solid #FFFFFF;box-shadow:0 2px 6px rgba(11,44,62,0.5)"></div>
          <span style="font-family:Montserrat,sans-serif;font-weight:800;font-size:12px;color:#0B2C3E;background:rgba(255,255,255,0.94);padding:2px 8px;border-radius:6px;box-shadow:0 1px 4px rgba(0,0,0,0.25);white-space:nowrap;">Caprichos</span>
        </div>`,
        iconSize: [110, 24],
        iconAnchor: [8, 12],
      }),
      title: 'Caprichos',
      zIndexOffset: 2000,
    });
    marcadorTienda.addTo(gMarcadores);

    const todasCoords: L.LatLngTuple[] = [CENTRO_LIMA];

    puntos.forEach((p) => {
      const pos: L.LatLngTuple = [p.lat, p.lng];
      todasCoords.push(pos);

      const esElegido = p.id === seleccionadoId;
      const esResaltado = resaltadosIds?.includes(p.id) ?? false;
      const icono = crearIconoPin(p.color, p.orden, esElegido, !!p.enReparto, esResaltado);

      const marker = L.marker(pos, {
        icon: icono,
        zIndexOffset: esElegido ? 1500 : (p.orden ? 1000 - p.orden : 500),
      });

      // Solo nombre del cliente y código del pedido (sin coordenadas ni datos técnicos)
      const nombre = nombreEtiqueta(p.etiqueta);
      const linea2 = `${p.codigo}${p.detalle ? ` · ${p.detalle}` : ''}`;
      const numeroPrefijo = p.orden ? `${p.orden}. ` : '';

      const completa = document.createElement('div');
      completa.className = 'cp-etiqueta-pedido';
      completa.style.cssText = 'pointer-events:none;';
      const divNombre = document.createElement('div');
      divNombre.style.fontWeight = '800';
      divNombre.style.fontSize = '12px';
      divNombre.style.whiteSpace = 'nowrap';
      divNombre.style.color = 'var(--cp-navy, #0B2C3E)';
      divNombre.textContent = `${numeroPrefijo}${nombre}`;
      const divCodigo = document.createElement('div');
      divCodigo.style.fontSize = '10px';
      divCodigo.style.whiteSpace = 'nowrap';
      divCodigo.style.color = '#5A6E78';
      divCodigo.style.marginTop = '1px';
      divCodigo.textContent = linea2;
      completa.appendChild(divNombre);
      completa.appendChild(divCodigo);

      const soloCodigo = document.createElement('div');
      soloCodigo.className = 'cp-etiqueta-pedido';
      soloCodigo.style.cssText = 'pointer-events:none;font-size:11px;font-weight:800;white-space:nowrap;color:var(--cp-navy, #0B2C3E);';
      soloCodigo.textContent = `${numeroPrefijo}${p.codigo}`;

      const prioridad =
        (esElegido ? 2_000_000 : 0) + (p.orden ? 1_000_000 - p.orden * 1000 : 0) + (p.minutosEspera || 0);

      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        alSeleccionarPuntoRef.current?.(p.id);
      });

      marker.addTo(gMarcadores);
      // Atributo técnico (no visible) para localizar el pin del pedido en pruebas
      marker.getElement()?.setAttribute('data-codigo', p.codigo);
      entradasEtiquetaRef.current.push({
        id: p.id,
        pos,
        marker,
        elementos: { completa, codigo: soloCodigo },
        anchoCompleta: anchoTexto(`${numeroPrefijo}${nombre}`, 7.5),
        anchoCodigo: anchoTexto(`${numeroPrefijo}${p.codigo}`, 7),
        prioridad,
      });
    });

    const recalcularEtiquetas = () => {
      const m = mapaRef.current;
      if (!m) return;
      const entradas = entradasEtiquetaRef.current;
      // El marcador de la tienda (icono de 110x24 anclado en 8,12) es un obstáculo fijo
      const tienda = m.latLngToContainerPoint(CENTRO_LIMA);
      const modos = planificarEtiquetas(
        entradas.map((e) => {
          const pt = m.latLngToContainerPoint(e.pos);
          return {
            id: e.id,
            x: pt.x,
            y: pt.y,
            anchoCompleta: e.anchoCompleta,
            anchoCodigo: e.anchoCodigo,
            prioridad: e.prioridad,
          };
        }),
        [{ x0: tienda.x - 8, x1: tienda.x + 102, y0: tienda.y - 12, y1: tienda.y + 12 }],
      );
      entradas.forEach((e) => {
        const modo = modos.get(e.id) ?? 'oculta';
        e.marker.unbindTooltip();
        if (modo === 'oculta') return;
        e.marker.bindTooltip(e.elementos[modo], {
          permanent: true,
          direction: 'right',
          offset: [12, -14],
          className: `cp-etiqueta ${e.id === seleccionadoId ? 'cp-etiqueta-activa' : ''}`,
        });
        e.marker.openTooltip();
      });
    };
    recalcularEtiquetasRef.current = recalcularEtiquetas;
    recalcularEtiquetas();

    // Solo se reajusta la vista cuando cambian los puntos, no al resaltar o seleccionar uno
    if (puntos !== puntosAjustadosRef.current) {
      puntosAjustadosRef.current = puntos;
      if (todasCoords.length > 1) {
        map.fitBounds(L.latLngBounds(todasCoords), {
          padding: [45, 45],
          maxZoom: 17,
        });
      } else {
        map.setView(CENTRO_LIMA, 14);
      }
    }
  }, [puntos, seleccionadoId, resaltadosIds]);

  return (
    <div
      style={{
        position: 'relative',
        // contiene los z-index internos de Leaflet (hasta 1000+): ningún diálogo del panel queda detrás del mapa
        isolation: 'isolate',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        ...(esPantallaCompleta ? { flex: '1 1 auto', minHeight: 0 } : {}),
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          ...(esPantallaCompleta ? { flex: '1 1 auto', minHeight: 0 } : { height: altura }),
          background: '#E8EFE6',
          borderRadius: esPantallaCompleta ? '0' : '16px',
          overflow: 'hidden',
          boxSizing: 'border-box',
          transition: 'height 0.2s ease',
        }}
      >
        {/* Barra superior de controles flotantes sobre el mapa */}
        <div
          style={{
            position: 'absolute',
            top: '12px',
            left: '12px',
            right: '12px',
            zIndex: 1100,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '8px',
            pointerEvents: 'none',
          }}
        >
          {/* Botón «Ver rutas sugeridas» (apagado por defecto) */}
          {onAlternarMostrarRutasSugeridas && (
            <button
              type="button"
              data-testid="btn-ver-rutas-sugeridas"
              onClick={(e) => {
                e.stopPropagation();
                onAlternarMostrarRutasSugeridas();
              }}
              aria-pressed={mostrarRutasSugeridas}
              style={{
                pointerEvents: 'auto',
                minHeight: '44px',
                padding: '0 14px',
                borderRadius: '10px',
                border: mostrarRutasSugeridas
                  ? '2px solid var(--cp-navy, #0B2C3E)'
                  : '1.5px solid var(--cp-navy, #0B2C3E)',
                background: mostrarRutasSugeridas
                  ? 'var(--cp-navy, #0B2C3E)'
                  : 'rgba(255, 255, 255, 0.95)',
                color: mostrarRutasSugeridas
                  ? 'var(--cp-cream, #FFFDF8)'
                  : 'var(--cp-navy, #0B2C3E)',
                fontWeight: 800,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 2px 8px rgba(11, 44, 62, 0.2)',
              }}
            >
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="6" r="3" />
                <path d="M6 15v-3a3 3 0 0 1 3-3h6a3 3 0 0 0 3-3V6" />
              </svg>
              <span>{mostrarRutasSugeridas ? 'Ocultar rutas sugeridas' : 'Ver rutas sugeridas'}</span>
            </button>
          )}

          {/* Botón flotante para pantalla completa */}
          {onAlternarPantallaCompleta && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAlternarPantallaCompleta();
              }}
              aria-label={esPantallaCompleta ? 'Salir de pantalla completa' : 'Ver mapa a pantalla completa'}
              title={esPantallaCompleta ? 'Salir de pantalla completa' : 'Pantalla completa'}
              style={{
                pointerEvents: 'auto',
                minHeight: '44px',
                padding: '0 12px',
                borderRadius: '10px',
                border: '1.5px solid var(--cp-navy, #0B2C3E)',
                background: 'rgba(255, 255, 255, 0.95)',
                color: 'var(--cp-navy, #0B2C3E)',
                fontWeight: 800,
                fontSize: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 8px rgba(11, 44, 62, 0.2)',
                marginLeft: 'auto',
              }}
            >
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                {esPantallaCompleta ? (
                  <>
                    <polyline points="4 14 10 14 10 20" />
                    <polyline points="20 10 14 10 14 4" />
                    <line x1="14" y1="10" x2="21" y2="3" />
                    <line x1="3" y1="21" x2="10" y2="14" />
                  </>
                ) : (
                  <>
                    <polyline points="15 3 21 3 21 9" />
                    <polyline points="9 21 3 21 3 15" />
                    <line x1="21" y1="3" x2="14" y2="10" />
                    <line x1="3" y1="21" x2="10" y2="14" />
                  </>
                )}
              </svg>
              <span>{esPantallaCompleta ? 'Salir' : 'Pantalla completa'}</span>
            </button>
          )}
        </div>

        {/* Estilos CSS específicos */}
        <style>{`
          .cp-pin.amarillo span {
            background: #D99E39 !important;
          }
          .cp-pin.naranja span {
            background: #E67929 !important;
          }
          .cp-pin.verde span {
            background: #2E8B57 !important;
          }
          .cp-pin.rojo span {
            background: #C4412B !important;
            animation: cp-pin-palpita 0.9s ease-in-out infinite alternate !important;
          }
          @keyframes cp-pin-palpita {
            0% {
              transform: rotate(-45deg) scale(1);
              filter: drop-shadow(0 0 2px rgba(196, 65, 43, 0.4));
            }
            100% {
              transform: rotate(-45deg) scale(1.3);
              filter: drop-shadow(0 0 8px rgba(196, 65, 43, 0.8));
            }
          }
          .cp-pin.en-reparto span {
            box-shadow: 0 0 0 3px #FFFFFF, 0 0 0 5px #0B2C3E !important;
          }
          .cp-etiqueta-activa {
            border: 2px solid var(--cp-navy, #0B2C3E) !important;
            box-shadow: 0 3px 10px rgba(11, 44, 62, 0.3) !important;
          }
          .cp-etiqueta-linea-ruta {
            background: rgba(255, 255, 255, 0.96) !important;
            border: 1.5px solid var(--cp-navy, #0B2C3E) !important;
            border-radius: 8px !important;
            font-family: Montserrat, sans-serif !important;
            font-size: 11px !important;
            font-weight: 800 !important;
            color: var(--cp-navy, #0B2C3E) !important;
            padding: 3px 8px !important;
            box-shadow: 0 2px 6px rgba(0,0,0,0.2) !important;
          }
          .cp-etiqueta-linea-ruta.activa {
            background: var(--cp-navy, #0B2C3E) !important;
            color: #FFFFFF !important;
            border: 2px solid #FFFFFF !important;
          }
        `}</style>

        <div
          ref={contenedorRef}
          role="application"
          aria-label="Mapa interactivo de repartos"
          style={{
            width: '100%',
            height: '100%',
          }}
        />
      </div>

      {mostrarRutasSugeridas && rutasSugeridas.length === 0 && (
        <div
          role="status"
          data-testid="sin-pedidos-para-rutas"
          style={{
            padding: '12px 14px',
            borderRadius: '12px',
            background: 'var(--cp-cream, #FFFDF8)',
            border: '1.5px solid var(--cp-line, #E3D6C6)',
            fontSize: '13px',
            fontWeight: 800,
            color: 'var(--cp-navy, #0B2C3E)',
          }}
        >
          No hay pedidos listos para repartir
        </div>
      )}

      {/* Lista de rutas sugeridas debajo del mapa al estar activo (todas, con desplazamiento) */}
      {mostrarRutasSugeridas && rutasSugeridas.length > 0 && (
        <div
          role="region"
          aria-label="Rutas sugeridas disponibles"
          data-testid="contenedor-rutas-sugeridas"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            padding: '10px 14px',
            background: 'var(--cp-white, #FFFFFF)',
            border: '1.5px solid var(--cp-line, #E3D6C6)',
            borderRadius: '14px',
            boxShadow: '0 2px 10px rgba(11, 44, 62, 0.06)',
          }}
        >
          <div
            style={{
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 800,
              fontSize: '13px',
              color: 'var(--cp-navy, #0B2C3E)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>Rutas sugeridas (toca una para elegirla):</span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '10px',
              maxHeight: '320px',
              overflowY: 'auto',
            }}
          >
            {rutasSugeridas.map((r) => {
              const esActiva = r.id === rutaActivaId;
              return (
                <button
                  key={r.id}
                  type="button"
                  data-testid={`btn-ruta-${r.id}`}
                  onClick={() => onSeleccionarRutaSugerida?.(r)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 12px',
                    borderRadius: '12px',
                    border: esActiva
                      ? '2px solid var(--cp-navy, #0B2C3E)'
                      : '1.5px solid var(--cp-line, #E3D6C6)',
                    background: esActiva
                      ? 'var(--cp-sand, #F4ECE1)'
                      : 'var(--cp-cream, #FFFDF8)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    boxShadow: esActiva ? '0 2px 8px rgba(11, 44, 62, 0.15)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span
                    style={{
                      width: '16px',
                      height: '16px',
                      borderRadius: '50%',
                      background: r.color,
                      flex: 'none',
                      border: '2px solid #FFFFFF',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                    }}
                  />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        fontFamily: 'Montserrat, sans-serif',
                        fontWeight: 800,
                        fontSize: '13px',
                        color: 'var(--cp-navy, #0B2C3E)',
                      }}
                    >
                      {r.nombre}
                    </div>
                    <div
                      style={{
                        fontSize: '12px',
                        color: 'var(--cp-soft, #5A6E78)',
                        marginTop: '2px',
                      }}
                    >
                      <strong>{r.totalPedidos} pedidos</strong> · ~{r.tiempoMin} min ({r.distanciaKm} km)
                    </div>
                  </div>
                  {esActiva && (
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 800,
                        padding: '2px 6px',
                        borderRadius: '6px',
                        background: 'var(--cp-navy, #0B2C3E)',
                        color: '#FFFFFF',
                      }}
                    >
                      Elegida
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
