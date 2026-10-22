import { useState, useEffect, useRef } from 'react';
import { api } from '../../comun/api';
import { L, URL_TESELAS, ATRIBUCION } from '../../comun/mapa/leaflet';

interface ZonaRow {
  n: string;
  c: string;
  count: number;
  ventas: string;
  pct: string;
  barW: string;
}

interface DistanciaRow {
  n: string;
  count: number;
}

const LOCAL_POS: [number, number] = [-12.0147, -76.966];

// Polígonos de zonas de reparto reales de Caprichos (Campoy, Mangomarca, Zárate, Huachipa, SJL)
const ZONAS_POLIGONOS: { id: string; nombre: string; color: string; puntos: [number, number][] }[] = [
  {
    id: 'Z2',
    nombre: 'Zona 2 (Campoy)',
    color: '#2B824E',
    puntos: [
      [-12.010, -76.972],
      [-12.010, -76.958],
      [-12.020, -76.958],
      [-12.020, -76.972],
    ],
  },
  {
    id: 'Z3',
    nombre: 'Zona 3 (Mangomarca)',
    color: '#0B2C3E',
    puntos: [
      [-12.015, -76.980],
      [-12.015, -76.970],
      [-12.025, -76.970],
      [-12.025, -76.980],
    ],
  },
  {
    id: 'Z4',
    nombre: 'Zona 4 (Zárate)',
    color: '#E67929',
    puntos: [
      [-12.020, -76.990],
      [-12.020, -76.978],
      [-12.030, -76.978],
      [-12.030, -76.990],
    ],
  },
  {
    id: 'Z5',
    nombre: 'Zona 5 (Huachipa)',
    color: '#D97706',
    puntos: [
      [-12.005, -76.960],
      [-12.005, -76.945],
      [-12.018, -76.945],
      [-12.018, -76.960],
    ],
  },
  {
    id: 'Z7',
    nombre: 'Zona 7 (SJL Centro)',
    color: '#8B5CF6',
    puntos: [
      [-12.025, -77.000],
      [-12.025, -76.985],
      [-12.035, -76.985],
      [-12.035, -77.000],
    ],
  },
];

export function MapaEntregasView() {
  const [periodo, setPeriodo] = useState('30'); // '7', '30', 'todo'
  const [canal, setCanal] = useState('todos'); // 'todos', 'Web', 'WhatsApp', 'Call center'

  // Capas
  const [capaCalor, setCapaCalor] = useState(true);
  const [capaZonas, setCapaZonas] = useState(true);
  const [capaRadios, setCapaRadios] = useState(true);

  // Zoom
  const [zoomNivel, setZoomNivel] = useState(14);

  // Referencias de Leaflet
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layersGroupRef = useRef<L.LayerGroup | null>(null);

  // Datos dinámicos desde API
  const [kpis, setKpis] = useState([
    { n: 'Pedidos con entrega', v: '0' },
    { n: 'Ventas', v: 's/ 0.00' },
    { n: 'Ticket promedio', v: 's/ 0.00' },
    { n: 'Intentos fuera de cobertura', v: '0' },
  ]);

  const [zonasFilas, setZonasFilas] = useState<ZonaRow[]>([]);
  const [distanciaFilas, setDistanciaFilas] = useState<DistanciaRow[]>([]);
  const [puntosPedidos, setPuntosPedidos] = useState<{ lat: number; lng: number; enZona: boolean }[]>([]);
  const [fueraCoberturaTexto, setFueraCoberturaTexto] = useState('');

  useEffect(() => {
    let montado = true;
    api
      .get<any>(`/admin/informes/mapa?periodo=${periodo}&canal=${canal}`)
      .then((res: any) => {
        if (montado && res) {
          if (res.kpis) setKpis(res.kpis);
          if (res.zonas) setZonasFilas(res.zonas);
          if (res.radios) setDistanciaFilas(res.radios);
          if (res.puntos) setPuntosPedidos(res.puntos);
          if (res.fueraCoberturaTexto) setFueraCoberturaTexto(res.fueraCoberturaTexto);
        }
      })
      .catch(() => {});
    return () => {
      montado = false;
    };
  }, [periodo, canal]);

  // Inicializar Leaflet map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      zoomControl: false, // Usamos los botones propios del mockup
    }).setView(LOCAL_POS, 14);

    L.tileLayer(URL_TESELAS, {
      attribution: ATRIBUCION,
      maxZoom: 19,
    }).addTo(map);

    const group = L.layerGroup().addTo(map);
    layersGroupRef.current = group;
    mapInstanceRef.current = map;

    map.on('zoomend', () => {
      setZoomNivel(map.getZoom());
    });

    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 150);

    return () => {
      clearTimeout(timer);
      map.remove();
      mapInstanceRef.current = null;
      layersGroupRef.current = null;
    };
  }, []);

  // Dibujar capas según estado
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = layersGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    // 1. Zonas de reparto (Polígonos con fill 12%)
    if (capaZonas) {
      ZONAS_POLIGONOS.forEach((z) => {
        L.polygon(z.puntos, {
          color: z.color,
          fillColor: z.color,
          fillOpacity: 0.12,
          weight: 2,
        })
          .bindTooltip(`<b>${z.nombre}</b>`, { direction: 'center', permanent: false })
          .addTo(group);
      });
    }

    // 2. Radios desde la tienda (0.5 km, 1 km, 2 km)
    if (capaRadios) {
      const radiosMetros = [500, 1000, 2000];
      radiosMetros.forEach((r) => {
        L.circle(LOCAL_POS, {
          radius: r,
          color: 'var(--cp-navy)',
          dashArray: '6, 6',
          weight: 2,
          fill: false,
        }).addTo(group);
      });
    }

    // 3. Puntos y mapa de calor
    puntosPedidos.forEach((p) => {
      if (capaCalor) {
        // Círculo gradiente simula el blob de calor
        L.circleMarker([p.lat, p.lng], {
          radius: 20,
          fillColor: p.enZona ? 'rgba(214,40,40,0.40)' : 'rgba(80,60,200,0.32)',
          fillOpacity: 0.4,
          stroke: false,
        }).addTo(group);
      }

      // Punto central
      L.circleMarker([p.lat, p.lng], {
        radius: 3,
        fillColor: p.enZona ? '#7A1212' : '#3B2C9E',
        fillOpacity: 1,
        color: p.enZona ? '#7A1212' : '#3B2C9E',
        weight: 1,
      }).addTo(group);
    });

    // 4. Marcador de la Tienda (Cuadro oscuro de 12px con borde claro)
    const iconoTienda = L.divIcon({
      className: 'cp-marcador-tienda',
      html: '<div style="width:12px;height:12px;border-radius:3px;background:var(--cp-navy);border:2px solid var(--cp-cream);box-sizing:border-box;"></div>',
      iconSize: [12, 12],
      iconAnchor: [6, 6],
    });
    L.marker(LOCAL_POS, { icon: iconoTienda, title: 'La tienda' }).addTo(group);
  }, [capaCalor, capaZonas, capaRadios, puntosPedidos]);

  // Controles de paneo y zoom
  const moverMapa = (dx: number, dy: number) => {
    const map = mapInstanceRef.current;
    if (map) map.panBy([dx * 120, dy * 120]);
  };

  const centrarTienda = () => {
    const map = mapInstanceRef.current;
    if (map) {
      map.setView(LOCAL_POS, 14);
      setZoomNivel(14);
    }
  };

  const cambiarZoom = (delta: number) => {
    const map = mapInstanceRef.current;
    if (map) {
      const nuevoZoom = Math.max(11, Math.min(18, map.getZoom() + delta));
      map.setZoom(nuevoZoom);
      setZoomNivel(nuevoZoom);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Texto explicativo superior */}
      <div style={{ fontSize: '13px', color: 'var(--cp-soft)' }}>
        Dónde se concentran los pedidos con delivery. Sirve para ajustar las zonas de reparto y para decidir dónde repartir volantes. Los pedidos nuevos con ubicación se suman solos.
      </div>

      {/* Chips de Período */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {[
          ['7', 'Últimos 7 días'],
          ['30', 'Últimos 30 días'],
          ['todo', 'Todo'],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setPeriodo(id)}
            style={{
              minHeight: '44px',
              padding: '0px 14px',
              borderRadius: '9999px',
              border: '1.5px solid var(--cp-navy)',
              fontWeight: 700,
              fontSize: '12px',
              background: periodo === id ? 'var(--cp-navy)' : 'transparent',
              color: periodo === id ? 'var(--cp-cream)' : 'var(--cp-navy)',
              cursor: 'pointer',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Chips de Canal */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {[
          ['todos', 'Todos los canales'],
          ['Web', 'Carta web'],
          ['WhatsApp', 'WhatsApp'],
          ['Call center', 'Call center'],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setCanal(id)}
            style={{
              minHeight: '44px',
              padding: '0px 14px',
              borderRadius: '9999px',
              border: '1.5px solid var(--cp-navy)',
              fontWeight: 700,
              fontSize: '12px',
              background: canal === id ? 'var(--cp-navy)' : 'transparent',
              color: canal === id ? 'var(--cp-cream)' : 'var(--cp-navy)',
              cursor: 'pointer',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tarjetas KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
        {kpis.map((k, i) => (
          <div key={i} style={{ background: 'var(--cp-white)', border: '1px solid var(--cp-line)', borderRadius: '12px', padding: '12px' }}>
            <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>{k.n}</div>
            <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '20px' }}>{k.v}</div>
          </div>
        ))}
      </div>

      {/* Capas */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: '12px', fontWeight: 700 }}>Capas</span>
        <button
          type="button"
          onClick={() => setCapaCalor(!capaCalor)}
          style={{
            minHeight: '44px',
            padding: '0px 14px',
            borderRadius: '9999px',
            border: '1.5px solid var(--cp-navy)',
            fontWeight: 700,
            fontSize: '12px',
            background: capaCalor ? 'var(--cp-navy)' : 'transparent',
            color: capaCalor ? 'var(--cp-cream)' : 'var(--cp-navy)',
            cursor: 'pointer',
          }}
        >
          Calor
        </button>
        <button
          type="button"
          onClick={() => setCapaZonas(!capaZonas)}
          style={{
            minHeight: '44px',
            padding: '0px 14px',
            borderRadius: '9999px',
            border: '1.5px solid var(--cp-navy)',
            fontWeight: 700,
            fontSize: '12px',
            background: capaZonas ? 'var(--cp-navy)' : 'transparent',
            color: capaZonas ? 'var(--cp-cream)' : 'var(--cp-navy)',
            cursor: 'pointer',
          }}
        >
          Zonas de reparto
        </button>
        <button
          type="button"
          onClick={() => setCapaRadios(!capaRadios)}
          style={{
            minHeight: '44px',
            padding: '0px 14px',
            borderRadius: '9999px',
            border: '1.5px solid var(--cp-navy)',
            fontWeight: 700,
            fontSize: '12px',
            background: capaRadios ? 'var(--cp-navy)' : 'transparent',
            color: capaRadios ? 'var(--cp-cream)' : 'var(--cp-navy)',
            cursor: 'pointer',
          }}
        >
          Radios desde la tienda
        </button>
      </div>

      {/* Mapa Leaflet interactivo */}
      <div
        role="img"
        aria-label="Mapa de calor de los pedidos con delivery"
        style={{
          position: 'relative',
          overflow: 'hidden',
          height: '420px',
          borderRadius: '12px',
          background: '#E5E3DF',
          border: '1px solid var(--cp-line)',
        }}
      >
        <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
      </div>

      {/* Controles del mapa */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          type="button"
          onClick={() => moverMapa(-1, 0)}
          aria-label="Mover a la izquierda"
          style={{ minWidth: '44px', minHeight: '44px', border: '1.5px solid var(--cp-navy)', borderRadius: '10px', background: 'var(--cp-white)', color: 'var(--cp-navy)', fontWeight: 800, fontSize: '16px', cursor: 'pointer' }}
        >
          ←
        </button>
        <button
          type="button"
          onClick={() => moverMapa(0, -1)}
          aria-label="Mover arriba"
          style={{ minWidth: '44px', minHeight: '44px', border: '1.5px solid var(--cp-navy)', borderRadius: '10px', background: 'var(--cp-white)', color: 'var(--cp-navy)', fontWeight: 800, fontSize: '16px', cursor: 'pointer' }}
        >
          ↑
        </button>
        <button
          type="button"
          onClick={() => moverMapa(0, 1)}
          aria-label="Mover abajo"
          style={{ minWidth: '44px', minHeight: '44px', border: '1.5px solid var(--cp-navy)', borderRadius: '10px', background: 'var(--cp-white)', color: 'var(--cp-navy)', fontWeight: 800, fontSize: '16px', cursor: 'pointer' }}
        >
          ↓
        </button>
        <button
          type="button"
          onClick={() => moverMapa(1, 0)}
          aria-label="Mover a la derecha"
          style={{ minWidth: '44px', minHeight: '44px', border: '1.5px solid var(--cp-navy)', borderRadius: '10px', background: 'var(--cp-white)', color: 'var(--cp-navy)', fontWeight: 800, fontSize: '16px', cursor: 'pointer' }}
        >
          →
        </button>
        <button
          type="button"
          onClick={centrarTienda}
          style={{ minWidth: '44px', minHeight: '44px', border: '1.5px solid var(--cp-navy)', borderRadius: '10px', background: 'var(--cp-white)', color: 'var(--cp-navy)', fontWeight: 800, padding: '0 12px', fontSize: '12px', cursor: 'pointer' }}
        >
          Centrar en la tienda
        </button>

        <span style={{ flex: 1 }} />

        <button
          type="button"
          onClick={() => cambiarZoom(-1)}
          aria-label="Alejar"
          style={{ minWidth: '44px', minHeight: '44px', border: '1.5px solid var(--cp-navy)', borderRadius: '10px', background: 'var(--cp-white)', color: 'var(--cp-navy)', fontWeight: 800, fontSize: '16px', cursor: 'pointer' }}
        >
          −
        </button>
        <span style={{ fontSize: '12px', fontWeight: 700, minWidth: '56px', textAlign: 'center' }}>
          Zoom {zoomNivel}
        </span>
        <button
          type="button"
          onClick={() => cambiarZoom(1)}
          aria-label="Acercar"
          style={{ minWidth: '44px', minHeight: '44px', border: '1.5px solid var(--cp-navy)', borderRadius: '10px', background: 'var(--cp-white)', color: 'var(--cp-navy)', fontWeight: 800, fontSize: '16px', cursor: 'pointer' }}
        >
          +
        </button>
      </div>

      {/* Leyenda y notas */}
      <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
        Rojo: más pedidos. Puntos rojos: entregas dentro de una zona. Puntos azules: intentos fuera de cobertura. Cuadro oscuro: la tienda.
      </div>

      {fueraCoberturaTexto ? (
        <div style={{ fontSize: '13px', fontWeight: 700, color: '#3B2C9E' }}>
          {fueraCoberturaTexto}
        </div>
      ) : (
        <div style={{ fontSize: '13px', color: 'var(--cp-soft)' }}>
          No se registraron intentos fuera de la zona de reparto en este período.
        </div>
      )}

      {/* Tablas inferiores */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '14px' }}>
        {/* Ventas por zona de reparto */}
        <div style={{ background: 'var(--cp-white)', border: '1px solid var(--cp-line)', borderRadius: '14px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontWeight: 800 }}>Ventas por zona de reparto</div>
          {zonasFilas.length === 0 ? (
            <div style={{ color: 'var(--cp-soft)', fontSize: '13px', padding: '12px 0' }}>
              Sin ventas por zona registradas en el período.
            </div>
          ) : (
            zonasFilas.map((z, idx) => (
              <div key={idx}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ fontWeight: 700 }}>
                    {z.n} · {z.count} pedidos
                  </span>
                  <span>
                    {z.ventas} · {z.pct}
                  </span>
                </div>
                <div style={{ height: '8px', borderRadius: '4px', background: 'var(--cp-sand)' }}>
                  <div style={{ height: '8px', borderRadius: '4px', background: z.c, width: z.barW }} />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pedidos por distancia a la tienda */}
        <div style={{ background: 'var(--cp-white)', border: '1px solid var(--cp-line)', borderRadius: '14px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontWeight: 800 }}>Pedidos por distancia a la tienda</div>
          <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
            Activa la capa "Radios desde la tienda" para verlos en el mapa. Útil para repartir volantes y pegar afiches.
          </div>
          {distanciaFilas.length === 0 ? (
            <div style={{ color: 'var(--cp-soft)', fontSize: '13px', padding: '12px 0' }}>
              Sin pedidos por distancia registrados en el período.
            </div>
          ) : (
            distanciaFilas.map((r, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ fontWeight: 700 }}>{r.n}</span>
                <span>{r.count} pedidos</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
