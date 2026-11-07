import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../../comun/api';
import { L, URL_TESELAS, ATRIBUCION } from '../../comun/mapa/leaflet';
import { colorDeZona } from '../configuracion/ZonasMapa';
import './mapa-entregas.css';

export interface ZonaMapa {
  zona: string;
  nombre: string;
  poligono: [number, number][];
  pedidos: number;
  ventas: string;
  porcentaje: string;
  barraAncho: string;
}
export interface RadioMapa {
  rango: string;
  etiqueta: string;
  metros: number;
  pedidos: number;
}
interface PuntoMapa {
  lat: number;
  lng: number;
  enZona: boolean;
}
export interface DatosMapa {
  sede: { lat: number; lng: number; nombre: string };
  puntos: PuntoMapa[];
  kpis: { n: string; v: string }[];
  zonas: ZonaMapa[];
  radios: RadioMapa[];
  fueraCoberturaTexto: string;
  fueraCoberturaConteo: number;
}

const PERIODOS = [
  ['7', 'Últimos 7 días'],
  ['30', 'Últimos 30 días'],
  ['todo', 'Todo'],
];
const CANALES = [
  ['todos', 'Todos'],
  ['Web', 'Carta web'],
  ['WhatsApp', 'WhatsApp'],
  ['Call center', 'Teléfono'],
];
const ZOOM_INICIAL = 14;

export function MapaEntregasView() {
  const [periodo, setPeriodo] = useState('30');
  const [canal, setCanal] = useState('todos');
  const [capaCalor, setCapaCalor] = useState(true);
  const [capaPuntos, setCapaPuntos] = useState(true);
  const [capaZonas, setCapaZonas] = useState(true);
  const [capaRadios, setCapaRadios] = useState(true);
  const [panelAbierto, setPanelAbierto] = useState(
    () => typeof window === 'undefined' || !window.matchMedia || !window.matchMedia('(max-width: 760px)').matches,
  );
  const [datos, setDatos] = useState<DatosMapa | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [intento, setIntento] = useState(0);

  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);
  const grupo = useRef<L.LayerGroup | null>(null);
  const poligonos = useRef<Record<string, L.Polygon>>({});

  useEffect(() => {
    let montado = true;
    setCargando(true);
    setError(false);
    api
      .get<DatosMapa>(`/admin/informes/mapa?periodo=${periodo}&canal=${encodeURIComponent(canal)}`)
      .then((res) => {
        if (!montado) return;
        setDatos(res);
        setCargando(false);
      })
      .catch(() => {
        if (!montado) return;
        setError(true);
        setCargando(false);
      });
    return () => {
      montado = false;
    };
  }, [periodo, canal, intento]);

  // Crear el mapa una sola vez
  useEffect(() => {
    if (!contenedor.current || mapa.current) return;
    const m = L.map(contenedor.current, { zoomControl: false, maxZoom: 19 }).setView([-12.0196, -76.9633], ZOOM_INICIAL);
    L.tileLayer(URL_TESELAS, { attribution: ATRIBUCION, maxZoom: 19 }).addTo(m);
    grupo.current = L.layerGroup().addTo(m);
    mapa.current = m;
    const t = setTimeout(() => m.invalidateSize(), 150);
    return () => {
      clearTimeout(t);
      m.remove();
      mapa.current = null;
      grupo.current = null;
    };
  }, []);

  // Centrar en la sede cuando llegan los datos
  const sedeLat = datos?.sede.lat;
  const sedeLng = datos?.sede.lng;
  useEffect(() => {
    if (sedeLat != null && sedeLng != null) mapa.current?.setView([sedeLat, sedeLng], ZOOM_INICIAL);
  }, [sedeLat, sedeLng]);

  // Dibujar capas
  useEffect(() => {
    const g = grupo.current;
    if (!g) return;
    g.clearLayers();
    poligonos.current = {};
    if (!datos) return;
    const sede: [number, number] = [datos.sede.lat, datos.sede.lng];

    if (capaZonas) {
      datos.zonas.forEach((z, i) => {
        if (z.poligono.length < 3) return;
        const color = colorDeZona(i);
        const p = L.polygon(z.poligono, { color, fillColor: color, fillOpacity: 0.14, weight: 3 })
          .bindTooltip(z.nombre, { permanent: true, direction: 'center', className: 'me-etiqueta-zona' })
          .bindPopup(`<b>${z.nombre}</b><br>${z.pedidos} pedidos<br>${z.ventas} en ventas`)
          .addTo(g);
        poligonos.current[z.zona] = p;
      });
    }

    if (capaRadios) {
      datos.radios.forEach((r) => {
        L.circle(sede, { radius: r.metros, color: '#0B2C3E', dashArray: '4 6', weight: 1.5, fill: false, interactive: false }).addTo(g);
        // Etiqueta en el borde norte del anillo (1 grado de latitud ~ 111 km)
        L.marker([sede[0] + r.metros / 111000, sede[1]], {
          interactive: false,
          icon: L.divIcon({ className: 'me-etiqueta-anillo-ancla', html: '', iconSize: [0, 0] }),
        })
          .bindTooltip(r.etiqueta, { permanent: true, direction: 'center', className: 'me-etiqueta-anillo' })
          .addTo(g);
      });
    }

    datos.puntos.forEach((p) => {
      if (capaCalor) {
        L.circleMarker([p.lat, p.lng], {
          radius: 20,
          stroke: false,
          fillColor: p.enZona ? '#D62828' : '#503CC8',
          fillOpacity: 0.3,
          interactive: false,
        }).addTo(g);
      }
      if (capaPuntos) {
        const c = p.enZona ? '#7A1212' : '#3B2C9E';
        L.circleMarker([p.lat, p.lng], { radius: 4, fillColor: c, fillOpacity: 1, color: '#FFFFFF', weight: 1, interactive: false }).addTo(g);
      }
    });

    L.marker(sede, {
      title: datos.sede.nombre,
      icon: L.divIcon({
        className: 'me-tienda-ancla',
        html: `<div class="me-tienda"><b>${datos.sede.nombre.replace(/</g, '&lt;')}</b><i></i></div>`,
        iconSize: [0, 0],
      }),
    }).addTo(g);
  }, [datos, capaCalor, capaPuntos, capaZonas, capaRadios]);

  const centrarTienda = useCallback(() => {
    if (datos) mapa.current?.setView([datos.sede.lat, datos.sede.lng], ZOOM_INICIAL);
  }, [datos]);

  const irAZona = (codigo: string) => {
    const p = poligonos.current[codigo];
    if (!p) return;
    mapa.current?.fitBounds(p.getBounds(), { padding: [30, 30] });
    p.openPopup();
  };

  const sinPedidos = !!datos && !cargando && datos.puntos.length === 0;
  const maxRadio = Math.max(1, ...(datos?.radios.map((r) => r.pedidos) ?? [1]));

  const capas = [
    { id: 'calor', t: 'Concentración de pedidos (calor)', d: 'Manchas rojas más intensas donde hay más pedidos.', on: capaCalor, set: setCapaCalor, m: 'calor' },
    { id: 'puntos', t: 'Entregas y fuera de cobertura (puntos)', d: 'Cada pedido con ubicación, dentro o fuera de zona.', on: capaPuntos, set: setCapaPuntos, m: 'punto-in' },
    { id: 'zonas', t: 'Zonas de reparto', d: 'Áreas que dibujaste en Configuración, con su nombre.', on: capaZonas, set: setCapaZonas, m: 'zona' },
    { id: 'radios', t: 'Distancias desde la tienda', d: 'Anillos de 500 m, 1 km, 2 km y 3 km.', on: capaRadios, set: setCapaRadios, m: 'anillo' },
  ];

  return (
    <div className="me">
      <p className="me-intro">
        Dónde se concentran los pedidos con delivery. Sirve para ajustar las zonas de reparto y decidir dónde repartir volantes. Los pedidos nuevos con ubicación se suman solos.
      </p>

      <div className="me-filtros">
        <div className="me-grupo" role="group" aria-label="Período">
          <span className="me-grupo-t">Período</span>
          {PERIODOS.map(([id, label]) => (
            <button key={id} type="button" className="me-chip" aria-pressed={periodo === id} onClick={() => setPeriodo(id)}>
              {label}
            </button>
          ))}
        </div>
        <div className="me-grupo" role="group" aria-label="Canal">
          <span className="me-grupo-t">Canal</span>
          {CANALES.map(([id, label]) => (
            <button key={id} type="button" className="me-chip" aria-pressed={canal === id} onClick={() => setCanal(id)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="me-kpis">
        {(datos?.kpis ?? []).map((k) => (
          <div key={k.n} className="me-kpi">
            <div className="me-kpi-n">{k.n}</div>
            <div className="me-kpi-v">{k.v}</div>
          </div>
        ))}
      </div>

      {error && (
        <div className="me-aviso error" role="alert">
          No se pudo cargar el mapa de entregas.
          <button type="button" className="me-btn" onClick={() => setIntento((n) => n + 1)}>
            Reintentar
          </button>
        </div>
      )}
      {sinPedidos && (
        <div className="me-aviso" role="status">
          No hay pedidos con ubicación en este período. Se muestran las zonas y la tienda.
        </div>
      )}

      <div className="me-mapa-caja">
        <div ref={contenedor} className="me-mapa" role="img" aria-label="Mapa de entregas con delivery" />
        {cargando && <div className="me-cargando">Cargando mapa...</div>}

        <div className="me-zoom">
          <button type="button" className="me-btn" aria-label="Acercar" onClick={() => mapa.current?.zoomIn()}>+</button>
          <button type="button" className="me-btn" aria-label="Alejar" onClick={() => mapa.current?.zoomOut()}>−</button>
          <button type="button" className="me-btn centrar" onClick={centrarTienda}>Centrar en la tienda</button>
        </div>

        <div className="me-capas">
          <button type="button" className="me-capas-cab" aria-expanded={panelAbierto} onClick={() => setPanelAbierto(!panelAbierto)}>
            Capas del mapa
            <span aria-hidden="true">{panelAbierto ? '−' : '+'}</span>
          </button>
          {panelAbierto && (
            <div className="me-capas-lista">
              {capas.map((c) => (
                <label key={c.id} className="me-capa">
                  <input type="checkbox" checked={c.on} onChange={() => c.set(!c.on)} />
                  <span>
                    <span className="me-capa-t">
                      <span className={`me-muestra ${c.m}`} aria-hidden="true" />
                      {c.t}
                    </span>
                    <span className="me-capa-d">{c.d}</span>
                  </span>
                </label>
              ))}
              <div className="me-leyenda" aria-label="Leyenda">
                <div className="me-leyenda-fila"><span className="me-muestra punto-in" aria-hidden="true" /> Rojo: entrega dentro de zona</div>
                <div className="me-leyenda-fila"><span className="me-muestra punto-out" aria-hidden="true" /> Azul/violeta: intento fuera de cobertura</div>
                <div className="me-leyenda-fila"><span className="me-muestra calor" aria-hidden="true" /> Más intenso: más pedidos</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {datos && (
        <div className={datos.fueraCoberturaConteo > 0 ? 'me-aviso' : 'me-intro'}>{datos.fueraCoberturaTexto}</div>
      )}

      <div className="me-abajo">
        <div className="me-card">
          <h3>Ventas por zona de reparto</h3>
          <div className="me-card-sub">Toca una zona para verla en el mapa.</div>
          {!datos || datos.zonas.length === 0 ? (
            <div className="me-vacio">Sin zonas de reparto activas.</div>
          ) : (
            datos.zonas.map((z, i) => (
              <button key={z.zona} type="button" className="me-fila" onClick={() => irAZona(z.zona)}>
                <div className="me-fila-cab">
                  <span className="me-fila-n">
                    <span className="me-muestra" style={{ background: colorDeZona(i), borderColor: colorDeZona(i) }} aria-hidden="true" />
                    {z.nombre} · {z.pedidos} pedidos
                  </span>
                  <span>{z.ventas} · {z.porcentaje}</span>
                </div>
                <div className="me-barra"><div style={{ width: z.barraAncho, background: colorDeZona(i) }} /></div>
              </button>
            ))
          )}
        </div>

        <div className="me-card">
          <h3>Pedidos por distancia a la tienda</h3>
          <div className="me-card-sub">Mismos anillos del mapa. Útil para repartir volantes y pegar afiches.</div>
          {!datos || datos.radios.length === 0 ? (
            <div className="me-vacio">Sin pedidos por distancia en el período.</div>
          ) : (
            datos.radios.map((r) => (
              <div key={r.metros} className="me-fila estatica">
                <div className="me-fila-cab">
                  <span className="me-fila-n">{r.rango}</span>
                  <span>{r.pedidos} pedidos</span>
                </div>
                <div className="me-barra"><div style={{ width: `${Math.round((r.pedidos / maxRadio) * 100)}%`, background: 'var(--cp-navy)' }} /></div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
