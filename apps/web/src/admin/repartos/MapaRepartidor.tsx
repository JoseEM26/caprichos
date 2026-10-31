import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { L, ATRIBUCION, URL_TESELAS } from '../../comun/mapa/leaflet';
import { COORDENADAS_TIENDA_DEFECTO } from './calculoRuta';
import type { ColorEspera } from './repartosApi';
import { claveConjuntoMapa } from './ajusteVistaMapa';

/**
 * Mantener presionado un marcador abre sus opciones.
 * ponytail: el dueño pidió «como 3 segundos»; 800 ms es lo que se aguanta con el dedo en la calle.
 * Si lo quiere más largo, subir esta constante (no hay nada más atado a ella).
 */
export const MS_PRESION_LARGA = 800;

/** Color de cada nivel de espera con las variables del proyecto (el rojo no tiene variable propia). */
export const COLOR_ESPERA_VAR: Record<ColorEspera, string> = {
  verde: 'var(--cp-ok)',
  amarillo: 'var(--cp-gold)',
  naranja: 'var(--cp-orange)',
  rojo: 'var(--cp-red, #C4412B)',
};
const COLOR_GRIS = 'var(--cp-line2)';

export interface PuntoRepartidor {
  id: string;
  lat: number;
  lng: number;
  cliente: string;
  codigo: string;
  /** Color por espera; los pedidos que aún no se pueden tomar van siempre en gris. */
  color: ColorEspera;
  /** Posición en la ruta (1, 2, 3...); sin número si todavía no está en ella. */
  numero?: number;
  /** Número que tuvo la parada ya terminada (se conserva para el lector de pantalla). */
  numeroParada?: number;
  /** false = en cocina o por validar: gris y sin poder elegirse. */
  disponible: boolean;
  /** Texto de estado de los grises ("En cocina", "Por validar"). */
  estadoTexto?: string;
  /** El pedido que le toca entregar ahora: borde grueso y etiqueta «Siguiente». */
  siguiente?: boolean;
  /** Pedido ya terminado de la ruta: gris con check (entregado) o X (no entregado, anulado); solo lectura. */
  estadoFinal?: 'ENTREGADO' | 'NO_ENTREGADO' | 'ANULADO';
}

export interface PosicionMarcador {
  x: number;
  y: number;
}

interface MapaRepartidorProps {
  puntos: PuntoRepartidor[];
  /** Línea a dibujar: sede y paradas en el orden de la ruta. */
  linea: Array<[number, number]>;
  /** Tramo ya recorrido de la ruta (sede y paradas terminadas): se dibuja más tenue. */
  lineaTenue?: Array<[number, number]>;
  /** Cambia con la pestaña: fuerza a encuadrar de nuevo. */
  vistaClave: string;
  alTocar: (id: string) => void;
  alAbrirOpciones: (id: string, pos: PosicionMarcador) => void;
  /** Rutas sugeridas: todas se dibujan finas; la elegida, gruesa y opaca. Tocar una línea la elige. */
  sugeridas?: LineaSugerida[];
  alElegirSugerida?: (id: string) => void;
  /** Un toque sobre el mapa vacío (no un arrastre ni un marcador). */
  alTocarMapa?: () => void;
  /** Encuadra una sola vez cada vez que cambia `clave`, dejando libre `margenInferior` px (la hoja). */
  encuadre?: { clave: string; coords: Array<[number, number]>; margenInferior: number };
}

export interface LineaSugerida {
  id: string;
  color: string;
  coords: Array<[number, number]>;
  elegida: boolean;
}

const SEDE: [number, number] = [COORDENADAS_TIENDA_DEFECTO.lat, COORDENADAS_TIENDA_DEFECTO.lng];
const ZOOM_BARRIO = 16;
const ZOOM_MAXIMO_ENCUADRE = 17;
// Margen alrededor del encuadre que se deja recorrer. Con 0.4 el mapa casi no se movía (parecía congelado)
const HOLGURA_PANEO = 2;

const estiloMarcador: CSSProperties = {
  position: 'absolute',
  transform: 'translate(-50%, -22px)',
  minWidth: 44,
  minHeight: 44,
  padding: 0,
  border: 'none',
  background: 'transparent',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  pointerEvents: 'auto',
  cursor: 'pointer',
  // none: el dedo sobre un marcador sigue mandando eventos para poder reenviar el arrastre al mapa
  touchAction: 'none',
  userSelect: 'none',
  WebkitUserSelect: 'none',
  WebkitTouchCallout: 'none',
  fontFamily: 'var(--fuente-texto)',
};

function Marcador({
  punto,
  pos,
  enRuta,
  alTocar,
  alAbrirOpciones,
  alPanear,
}: {
  punto: PuntoRepartidor;
  pos: PosicionMarcador;
  enRuta: boolean;
  alTocar: (id: string) => void;
  alAbrirOpciones: (id: string, pos: PosicionMarcador) => void;
  alPanear: (dx: number, dy: number) => void;
}) {
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  const largo = useRef(false);
  const inicio = useRef<{ x: number; y: number } | null>(null);
  const ultimo = useRef<{ x: number; y: number } | null>(null);
  const arrastrando = useRef(false);
  // Punteros apoyados en este marcador: con dos es un pellizco del mapa, no un toque ni un arrastre
  const activos = useRef(new Set<number>());
  const pellizco = useRef(false);
  const posRef = useRef(pos);
  posRef.current = pos;

  const cancelar = () => {
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = null;
  };
  useEffect(() => cancelar, []);

  const abrir = () => {
    largo.current = true;
    alAbrirOpciones(punto.id, posRef.current);
  };

  const alBajar = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (activos.current.size === 0) pellizco.current = false;
    activos.current.add(e.pointerId);
    if (activos.current.size > 1) {
      pellizco.current = true;
      cancelar();
      return;
    }
    largo.current = false;
    arrastrando.current = false;
    inicio.current = { x: e.clientX, y: e.clientY };
    ultimo.current = inicio.current;
    cancelar();
    temporizador.current = setTimeout(abrir, MS_PRESION_LARGA);
  };

  const alMover = (e: PointerEvent<HTMLButtonElement>) => {
    const i = inicio.current;
    if (!i || pellizco.current || !Number.isFinite(e.clientX)) return;
    // Si el dedo se arrastra es un gesto del mapa, no una presión larga: se cancela y se mueve el mapa.
    // Los marcadores viven fuera del panel de Leaflet, así que el arrastre no le llega solo.
    if (!arrastrando.current && Math.hypot(e.clientX - i.x, e.clientY - i.y) > 12) {
      arrastrando.current = true;
      cancelar();
    }
    if (arrastrando.current && ultimo.current) alPanear(ultimo.current.x - e.clientX, ultimo.current.y - e.clientY);
    ultimo.current = { x: e.clientX, y: e.clientY };
  };

  const alTeclado = (e: KeyboardEvent<HTMLButtonElement>) => {
    if ((e.key === 'Enter' && e.shiftKey) || e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey)) {
      e.preventDefault();
      abrir();
    }
  };

  const fondo = punto.disponible ? COLOR_ESPERA_VAR[punto.color] : COLOR_GRIS;
  const textoNumero = punto.estadoFinal
    ? punto.estadoFinal === 'ENTREGADO' ? '✓' : '✕'
    : punto.numero != null ? String(punto.numero) : punto.disponible ? '+' : '';
  const descripcion = punto.estadoFinal
    ? `${punto.numeroParada != null ? `parada ${punto.numeroParada}, ` : ''}terminado, ${punto.estadoTexto ?? ''}`
    : punto.disponible
    ? punto.numero != null
      ? `en tu ruta, parada ${punto.numero}`
      : 'disponible'
    : `no disponible, ${punto.estadoTexto ?? 'aún en preparación'}`;

  return (
    <button
      type="button"
      data-testid={`marcador-${punto.id}`}
      data-color={punto.disponible ? punto.color : 'gris'}
      data-numero={punto.numero ?? ''}
      data-estado-final={punto.estadoFinal}
      data-siguiente={punto.siguiente ? 'true' : undefined}
      aria-label={`Pedido ${punto.codigo} de ${punto.cliente}, ${descripcion}. Mantén presionado para ver opciones`}
      aria-pressed={punto.disponible ? enRuta : undefined}
      onClick={() => {
        if (pellizco.current) return;
        if (largo.current || arrastrando.current) {
          largo.current = false;
          arrastrando.current = false;
          return;
        }
        alTocar(punto.id);
      }}
      onPointerDown={alBajar}
      onPointerMove={alMover}
      onPointerUp={(e) => {
        activos.current.delete(e.pointerId);
        cancelar();
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === 'mouse') activos.current.delete(e.pointerId);
        cancelar();
      }}
      onPointerCancel={(e) => {
        activos.current.delete(e.pointerId);
        cancelar();
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        cancelar();
        if (!largo.current) abrir();
      }}
      onKeyDown={alTeclado}
      style={{ ...estiloMarcador, left: pos.x, top: pos.y, zIndex: enRuta ? 3 : punto.disponible ? 2 : 1 }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 34,
          height: 34,
          borderRadius: '50%',
          background: fondo,
          color: punto.disponible && punto.color === 'amarillo' ? 'var(--cp-navy)' : punto.disponible ? 'var(--cp-white)' : 'var(--cp-soft)',
          border: `${punto.siguiente ? 5 : 3}px ${punto.disponible ? 'solid' : 'dashed'} ${enRuta ? 'var(--cp-navy)' : 'var(--cp-white)'}`,
          boxShadow: enRuta ? '0 0 0 3px var(--cp-orange), 0 2px 6px rgba(11,44,62,.4)' : '0 2px 6px rgba(11,44,62,.35)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--fuente-titulos)',
          fontWeight: 800,
          fontSize: 15,
          lineHeight: 1,
          flexShrink: 0,
          opacity: punto.estadoFinal ? 0.45 : undefined,
        }}
      >
        {textoNumero}
      </span>
      <span
        aria-hidden="true"
        style={{
          marginTop: 2,
          maxWidth: 120,
          padding: '1px 6px',
          borderRadius: 6,
          background: punto.disponible ? 'rgba(255,255,255,.94)' : 'rgba(243,233,219,.94)',
          border: '1px solid var(--cp-line)',
          color: punto.disponible ? 'var(--cp-navy)' : 'var(--cp-soft)',
          fontSize: 11,
          lineHeight: '13px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{punto.cliente}</strong>
        <span style={{ fontSize: 10, fontWeight: 700 }}>{punto.codigo}</span>
        {!punto.disponible && punto.estadoTexto && <span style={{ fontSize: 10 }}>{punto.estadoTexto}</span>}
        {punto.siguiente && <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--cp-orange)' }}>Siguiente</span>}
      </span>
    </button>
  );
}

/**
 * Mapa del repartidor. Los marcadores son botones de React sobre el mapa (no iconos de Leaflet) para que
 * tengan teclado, aria-label y presión larga; se reposicionan con la proyección del mapa al moverlo.
 */
export function MapaRepartidor({ puntos, linea, lineaTenue, vistaClave, alTocar, alAbrirOpciones, sugeridas, alElegirSugerida, alTocarMapa, encuadre }: MapaRepartidorProps) {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<L.Map | null>(null);
  const lineaRef = useRef<L.Polyline | null>(null);
  const lineaTenueRef = useRef<L.Polyline | null>(null);
  const sugeridasRef = useRef<L.Polyline[]>([]);
  const alTocarMapaRef = useRef(alTocarMapa);
  alTocarMapaRef.current = alTocarMapa;
  const alElegirRef = useRef(alElegirSugerida);
  alElegirRef.current = alElegirSugerida;
  const encuadreRef = useRef(encuadre);
  encuadreRef.current = encuadre;
  const puntosRef = useRef(puntos);
  puntosRef.current = puntos;
  const [capa, setCapa] = useState<HTMLElement | null>(null);
  const [, setTic] = useState(0);

  // 1. Inicialización de Leaflet
  useEffect(() => {
    if (!contenedorRef.current) return;
    const map = L.map(contenedorRef.current, {
      zoomControl: false, // sin botones + / -: el zoom es con los dedos, doble toque y rueda
      attributionControl: false,
      touchZoom: true,
      doubleClickZoom: true,
      scrollWheelZoom: true,
    }).setView(SEDE, ZOOM_BARRIO);
    L.tileLayer(URL_TESELAS, { attribution: ATRIBUCION, maxZoom: 19 }).addTo(map);
    L.control.attribution({ position: 'bottomright', prefix: false }).addTo(map);
    mapaRef.current = map;

    // Capa propia para los marcadores dentro del contenedor del mapa (la rueda y los gestos siguen llegando a Leaflet)
    const el = document.createElement('div');
    el.setAttribute('data-capa-marcadores', '');
    el.style.cssText = 'position:absolute;inset:0;z-index:650;pointer-events:none;overflow:hidden;';
    map.getContainer().appendChild(el);
    setCapa(el);

    let cuadro = 0;
    const redibujar = () => {
      if (cuadro) return;
      cuadro = requestAnimationFrame(() => {
        cuadro = 0;
        setTic((t) => t + 1);
      });
    };
    map.on('move zoom resize', redibujar);
    // Leaflet no dispara click al terminar un arrastre, así que esto es un toque de verdad
    map.on('click', () => alTocarMapaRef.current?.());
    const alRedimensionar = () => map.invalidateSize();
    window.addEventListener('resize', alRedimensionar);
    const retraso = setTimeout(() => map.invalidateSize(), 150);

    return () => {
      clearTimeout(retraso);
      if (cuadro) cancelAnimationFrame(cuadro);
      window.removeEventListener('resize', alRedimensionar);
      el.remove();
      map.remove();
      mapaRef.current = null;
      lineaRef.current = null;
      lineaTenueRef.current = null;
      sugeridasRef.current = [];
    };
  }, []);

  /** Encuadra la sede y los pedidos visibles con margen pequeño; solo la sede = zoom de barrio. */
  const encuadrar = useCallback(() => {
    const map = mapaRef.current;
    if (!map) return;
    const ptos = puntosRef.current;
    const coords: Array<[number, number]> = [SEDE, ...ptos.map((p) => [p.lat, p.lng] as [number, number])];
    const limites = L.latLngBounds(coords);
    map.setMaxBounds(limites.pad(HOLGURA_PANEO));
    if (ptos.length === 0) map.setView(SEDE, ZOOM_BARRIO);
    else map.fitBounds(limites, { padding: [36, 36], maxZoom: ZOOM_MAXIMO_ENCUADRE });
  }, []);

  // 2. Reencuadre: al cargar, al cambiar de pestaña o cuando cambia el conjunto de pedidos (no en cada sondeo)
  const claveConjunto = vistaClave + '|' + claveConjuntoMapa(puntos.map((p) => p.id));
  useEffect(() => {
    encuadrar();
  }, [claveConjunto, encuadrar]);

  // 3. Líneas de ruta
  useEffect(() => {
    const map = mapaRef.current;
    if (!map) return;
    lineaRef.current?.remove();
    lineaRef.current = null;
    if (linea.length >= 2) {
      lineaRef.current = L.polyline(linea, { color: '#E67929', weight: 4.5, opacity: 0.95, lineJoin: 'round', lineCap: 'round' }).addTo(map);
    }
  }, [linea]);

  // Tramo recorrido: la misma ruta pero más tenue
  useEffect(() => {
    const map = mapaRef.current;
    if (!map) return;
    lineaTenueRef.current?.remove();
    lineaTenueRef.current = null;
    if (lineaTenue && lineaTenue.length >= 2) {
      lineaTenueRef.current = L.polyline(lineaTenue, { color: '#E67929', weight: 4, opacity: 0.3, dashArray: '2 8', lineJoin: 'round', lineCap: 'round' }).addTo(map);
    }
  }, [lineaTenue]);

  useEffect(() => {
    const map = mapaRef.current;
    if (!map) return;
    sugeridasRef.current.forEach((l) => l.remove());
    sugeridasRef.current = [];
    // La elegida se dibuja al final para que quede encima
    const orden = [...(sugeridas ?? [])].sort((a, b) => Number(a.elegida) - Number(b.elegida));
    for (const r of orden) {
      if (r.coords.length < 2) continue;
      const elegir = () => alElegirRef.current?.(r.id);
      // Línea ancha e invisible debajo: el dedo no acierta a una línea fina
      const toque = L.polyline(r.coords, { color: r.color, weight: 24, opacity: 0, bubblingMouseEvents: false }).addTo(map);
      const visible = L.polyline(r.coords, {
        color: r.color,
        weight: r.elegida ? 6 : 3,
        opacity: r.elegida ? 1 : 0.5,
        lineJoin: 'round',
        lineCap: 'round',
        bubblingMouseEvents: false,
      }).addTo(map);
      toque.on?.('click', elegir);
      visible.on?.('click', elegir);
      sugeridasRef.current.push(toque, visible);
    }
  }, [sugeridas]);

  // 4. Encuadre de las rutas sugeridas: una sola vez por cambio de clave, con la hoja descontada
  const claveEncuadre = encuadre?.clave;
  useEffect(() => {
    const map = mapaRef.current;
    const e = encuadreRef.current;
    if (!map || !e) return;
    const limites = L.latLngBounds([SEDE, ...e.coords]);
    // Las rutas pueden salir del conjunto de pedidos: se amplía lo que se puede recorrer
    map.setMaxBounds(L.latLngBounds([SEDE, ...puntosRef.current.map((p) => [p.lat, p.lng] as [number, number]), ...e.coords]).pad(HOLGURA_PANEO));
    map.fitBounds(limites, { paddingTopLeft: [36, 72], paddingBottomRight: [36, e.margenInferior + 16], maxZoom: ZOOM_MAXIMO_ENCUADRE });
  }, [claveEncuadre]);

  const proyectar = (lat: number, lng: number): PosicionMarcador => {
    const pt = mapaRef.current?.latLngToContainerPoint([lat, lng]);
    return { x: pt?.x ?? 0, y: pt?.y ?? 0 };
  };
  const posSede = capa ? proyectar(SEDE[0], SEDE[1]) : null;

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div ref={contenedorRef} data-testid="mapa-repartidor" style={{ position: 'absolute', inset: 0 }} />
      {capa &&
        posSede &&
        createPortal(
          <>
            <div
              role="img"
              aria-label="Sede Caprichos"
              data-testid="marcador-sede"
              style={{
                position: 'absolute',
                left: posSede.x,
                top: posSede.y,
                transform: 'translate(-50%, -50%)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                pointerEvents: 'none',
                zIndex: 4,
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: 'var(--cp-navy)',
                  color: 'var(--cp-white)',
                  border: '3px solid var(--cp-white)',
                  boxShadow: '0 3px 10px rgba(11,44,62,.45)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'var(--fuente-titulos)',
                  fontWeight: 900,
                  fontSize: 17,
                }}
              >
                C
              </span>
              <span style={{ marginTop: 2, fontSize: 10, fontWeight: 800, color: 'var(--cp-navy)', background: 'rgba(255,255,255,.9)', borderRadius: 6, padding: '0 5px' }}>
                Sede
              </span>
            </div>
            {puntos.map((p) => (
              <Marcador
                key={p.id}
                punto={p}
                pos={proyectar(p.lat, p.lng)}
                enRuta={p.numero != null}
                alTocar={alTocar}
                alAbrirOpciones={alAbrirOpciones}
                alPanear={(dx, dy) => mapaRef.current?.panBy([dx, dy], { animate: false })}
              />
            ))}
          </>,
          capa,
        )}
      <button
        type="button"
        data-testid="btn-centrar"
        onClick={encuadrar}
        aria-label="Centrar el mapa en la sede y los pedidos"
        style={{
          position: 'absolute',
          right: 10,
          bottom: 10,
          zIndex: 700,
          minWidth: 44,
          minHeight: 44,
          padding: '0 14px',
          borderRadius: 22,
          border: '1.5px solid var(--cp-navy)',
          background: 'var(--cp-white)',
          color: 'var(--cp-navy)',
          fontFamily: 'var(--fuente-titulos)',
          fontWeight: 800,
          fontSize: 13,
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(11,44,62,.25)',
        }}
      >
        Centrar
      </button>
    </div>
  );
}
