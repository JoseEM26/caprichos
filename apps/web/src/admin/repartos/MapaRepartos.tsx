import { useEffect, useRef } from 'react';
import { L, ATRIBUCION, URL_TESELAS } from '../../comun/mapa/leaflet';
import { ZonaGeoItem, ZONAS_GEO_DEFECTO } from './zonasGeo';
import { COORDENADAS_TIENDA_DEFECTO } from './calculoRuta';
import type { ColorEspera } from './repartosApi';

export interface PuntoRepartoMapa {
  id: string;
  lat: number;
  lng: number;
  etiqueta: string; // Nombre del cliente
  codigo: string;   // Código del pedido (CP-...)
  detalle?: string;
  color: ColorEspera;
  orden?: number;   // 1, 2, 3 si forma parte de la ruta sugerida
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
): L.DivIcon {
  const numStr = orden ? String(orden) : '';
  const clases = `cp-pin ${color} ${elegido ? 'elegido' : ''}`.trim();

  return L.divIcon({
    className: clases,
    html: `<span></span>${numStr ? `<strong class="cp-pin-num">${numStr}</strong>` : ''}`,
    iconSize: [26, 26],
    iconAnchor: [13, 26],
  });
}

export function MapaRepartos({
  puntos,
  zonas = ZONAS_GEO_DEFECTO,
  conteoPorZona = {},
  zonaFiltroActiva,
  onSeleccionarZona,
  seleccionadoId,
  onSeleccionarPunto,
  rutaPuntos = [],
  altura = 'min(65vh, 600px)',
  onTocarMapa,
  esPantallaCompleta = false,
  onAlternarPantallaCompleta,
}: MapaRepartosProps) {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<L.Map | null>(null);
  const capaZonasRef = useRef<L.LayerGroup | null>(null);
  const capaRutaRef = useRef<L.LayerGroup | null>(null);
  const capaMarcadoresRef = useRef<L.LayerGroup | null>(null);

  const alSeleccionarPuntoRef = useRef(onSeleccionarPunto);
  alSeleccionarPuntoRef.current = onSeleccionarPunto;

  const alSeleccionarZonaRef = useRef(onSeleccionarZona);
  alSeleccionarZonaRef.current = onSeleccionarZona;

  const alTocarMapaRef = useRef(onTocarMapa);
  alTocarMapaRef.current = onTocarMapa;

  // 1. Inicialización de Leaflet
  useEffect(() => {
    if (!contenedorRef.current) return;

    const map = L.map(contenedorRef.current, {
      zoomControl: true,
      attributionControl: false,
    }).setView(CENTRO_LIMA, 14);

    L.tileLayer(URL_TESELAS, {
      attribution: ATRIBUCION,
      maxZoom: 19,
    }).addTo(map);

    // Añadir atribución compacta
    L.control.attribution({ position: 'bottomright', prefix: false }).addTo(map);

    // Grupos de capas
    capaZonasRef.current = L.layerGroup().addTo(map);
    capaRutaRef.current = L.layerGroup().addTo(map);
    capaMarcadoresRef.current = L.layerGroup().addTo(map);

    mapaRef.current = map;

    // Escuchar toques o clics directos al mapa para ocultar/mostrar controles (Decisión 6)
    map.on('click', (e: any) => {
      // Solo si el clic no fue interceptado por un marcador o polígono
      if (e.originalEvent?._stopped) return;
      alTocarMapaRef.current?.();
    });

    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 150);

    return () => {
      clearTimeout(timer);
      map.remove();
      mapaRef.current = null;
      capaZonasRef.current = null;
      capaRutaRef.current = null;
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
  }, [esPantallaCompleta, altura]);

  // 2. Dibujar «Franja de colores» (Zonas de reparto sombreadas, Decisión 5 del dueño)
  useEffect(() => {
    const map = mapaRef.current;
    const gZonas = capaZonasRef.current;
    if (!map || !gZonas) return;

    gZonas.clearLayers();

    // Encontrar el máximo de pedidos en cualquier zona para la escala de oscurecimiento
    const valoresConteos = Object.values(conteoPorZona);
    const maxCant = Math.max(1, ...valoresConteos);

    zonas.forEach((z) => {
      const cant = conteoPorZona[z.codigo] || 0;
      const esActiva = zonaFiltroActiva === z.codigo;

      // Más oscura donde hay más pedidos (Decisión 5):
      // Opacidad base 0.10, aumenta hasta 0.50 con más pedidos; si está activa como filtro, 0.45
      const opacidadRelleno = esActiva
        ? 0.45
        : cant > 0
        ? Math.min(0.5, 0.12 + (0.35 * cant) / maxCant)
        : 0.08;

      z.poligonos.forEach((anillo) => {
        const poly = L.polygon(anillo, {
          color: esActiva ? '#0B2C3E' : z.colorBase,
          weight: esActiva ? 3 : cant > 0 ? 2 : 1,
          opacity: esActiva ? 1 : 0.8,
          fillColor: z.colorBase,
          fillOpacity: opacidadRelleno,
          dashArray: esActiva ? undefined : '5, 5',
        });

        // Tooltip con el nombre de la zona y número de pedidos
        const tooltipHtml = `<strong>${z.codigo}</strong>: ${cant} ${cant === 1 ? 'pedido' : 'pedidos'}`;
        poly.bindTooltip(tooltipHtml, {
          sticky: true,
          direction: 'center',
          className: 'cp-etiqueta-zona',
        });

        // Al tocar la zona se filtran los pedidos de esa zona (RQ-DEL-02-13)
        poly.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          alSeleccionarZonaRef.current?.(z.codigo);
        });

        poly.addTo(gZonas);
      });
    });
  }, [zonas, conteoPorZona, zonaFiltroActiva]);

  // 3. Dibujar Línea de Ruta Sugerida
  useEffect(() => {
    const map = mapaRef.current;
    const gRuta = capaRutaRef.current;
    if (!map || !gRuta) return;

    gRuta.clearLayers();

    if (rutaPuntos.length >= 2) {
      const linea = L.polyline(rutaPuntos, {
        color: '#E67929',
        weight: 3.5,
        dashArray: '8, 6',
        lineJoin: 'round',
        lineCap: 'round',
        opacity: 0.9,
      });
      linea.addTo(gRuta);
    }
  }, [rutaPuntos]);

  // 4. Dibujar Marcadores de Pedidos y Marcador de Tienda «Caprichos»
  useEffect(() => {
    const map = mapaRef.current;
    const gMarcadores = capaMarcadoresRef.current;
    if (!map || !gMarcadores) return;

    gMarcadores.clearLayers();

    // Marcador Tienda Física de Caprichos (acta 03, DT-59)
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
      const icono = crearIconoPin(p.color, p.orden, esElegido);

      const marker = L.marker(pos, {
        icon: icono,
        zIndexOffset: esElegido ? 1500 : (p.orden ? 1000 - p.orden : 500),
      });

      // Decisión 3 del dueño: Cada punto muestra nombre completo del cliente y debajo en chico el código
      const numeroPrefijo = p.orden ? `${p.orden}. ` : '';
      const tooltipContenido = document.createElement('div');
      tooltipContenido.className = 'cp-etiqueta-pedido';
      tooltipContenido.style.cssText = 'pointer-events:none;';

      const divNombre = document.createElement('div');
      divNombre.style.fontWeight = '800';
      divNombre.style.fontSize = '12px';
      divNombre.style.color = 'var(--cp-navy, #0B2C3E)';
      divNombre.textContent = `${numeroPrefijo}${p.etiqueta}`;

      const divCodigo = document.createElement('div');
      divCodigo.style.fontSize = '10px';
      divCodigo.style.color = '#5A6E78';
      divCodigo.style.marginTop = '1px';
      divCodigo.textContent = `${p.codigo}${p.detalle ? ` · ${p.detalle}` : ''}`;

      tooltipContenido.appendChild(divNombre);
      tooltipContenido.appendChild(divCodigo);

      marker.bindTooltip(tooltipContenido, {
        permanent: true,
        direction: 'right',
        offset: [12, -14],
        className: `cp-etiqueta ${esElegido ? 'cp-etiqueta-activa' : ''}`,
      });

      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        alSeleccionarPuntoRef.current?.(p.id);
      });

      marker.addTo(gMarcadores);
    });

    // Decisión 2: Zoom automático que abarca todos los pedidos listos y en camino del repartidor
    if (todasCoords.length > 1) {
      map.fitBounds(L.latLngBounds(todasCoords), {
        padding: [45, 45],
        maxZoom: 17,
      });
    } else {
      map.setView(CENTRO_LIMA, 14);
    }
  }, [puntos, seleccionadoId]);

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: esPantallaCompleta ? '100vh' : altura,
        background: '#E8EFE6',
        borderRadius: esPantallaCompleta ? '0' : '16px',
        overflow: 'hidden',
        boxSizing: 'border-box',
        transition: 'height 0.2s ease',
      }}
    >
      {/* Botón flotante para pantalla completa (Decisión 2 del dueño) */}
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
            position: 'absolute',
            top: '12px',
            right: '12px',
            zIndex: 1100,
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

      {/* Estilos CSS específicos para los marcadores con animación palpitante y colores */}
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
        .cp-etiqueta-activa {
          border: 2px solid var(--cp-navy, #0B2C3E) !important;
          box-shadow: 0 3px 10px rgba(11, 44, 62, 0.3) !important;
        }
        .cp-etiqueta-zona {
          background: rgba(255, 255, 255, 0.92);
          border: 1px solid rgba(11, 44, 62, 0.3);
          border-radius: 6px;
          font-size: 11px;
          padding: 2px 6px;
          color: #0B2C3E;
          font-weight: 700;
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
  );
}
