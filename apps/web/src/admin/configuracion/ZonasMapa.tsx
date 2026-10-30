import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { ajustarAVecinas, insertarVertice, ladoMasLargo, quitarVerticeDe, resumenAjusteTexto} from '@caprichos/compartido';
import type { ResultadoAjuste } from '@caprichos/compartido';
import { api, ErrorApi } from '../../comun/api';
import { Boton } from '../../comun/Boton';
import { Confirmar } from '../../comun/Confirmar';
import { Insignia } from '../../comun/Insignia';
import { L, ATRIBUCION, CENTRO_DEFECTO, URL_TESELAS, iconoTienda } from '../../comun/mapa/leaflet';
import type { CoordenadaPunto, ZonaRepartoItem } from './ZonasRepartoView';

export interface DiagnosticoZonas {
  solapes: { ganadora: string; perdedora: string }[];
  invalidas: { codigo: string; activa: boolean; motivo: string }[];
  /** Metros de pegado automático (zonas_snap_m). */
  toleranciaM?: number;
  /** Separaciones entre zonas activas: finas (se arreglan pegando) o informativas. */
  huecos?: { zonaA: string; zonaB: string; metros: number; fino: boolean }[];
}

/** Par de zonas que ya se solapan: el dueño decide cuál se queda el área compartida. */
interface ConflictoNormalizar {
  zonaAId: string;
  zonaBId: string;
  nombreA: string;
  nombreB: string;
  areaM2: number;
  tarifaA: number;
  tarifaB: number;
  /** GeoJSON MultiPolygon del solape, en [lng, lat]. */
  poligonoSolape: { type: 'MultiPolygon'; coordinates: number[][][][] };
}

interface ResumenNormalizar {
  aplicado: boolean;
  zonas: {
    codigo: string;
    cambia: boolean;
    resumen: ResultadoAjuste['resumen'];
    puntosAntes: number;
    puntosDespues: number;
    areaAntesM2: number;
    areaDespuesM2: number;
  }[];
  conflictos?: ConflictoNormalizar[];
}

interface DecisionNormalizar {
  zonaAId: string;
  zonaBId: string;
  conserva: string;
}

/** Punto de imán: vértice vecino o su lado más cercano a menos de `tol` metros, o null. */
export function objetivoIman(p: CoordenadaPunto, vecinas: CoordenadaPunto[][], tol: number): CoordenadaPunto | null {
  const kx = 111320 * Math.cos((p[0] * Math.PI) / 180);
  const ky = 110574;
  let dV = Infinity, pV: CoordenadaPunto | null = null, dE = Infinity, pE: CoordenadaPunto | null = null;
  for (const poli of vecinas) {
    for (let k = 0; k < poli.length; k++) {
      const a = poli[k];
      const b = poli[(k + 1) % poli.length];
      const ax = (a[1] - p[1]) * kx, ay = (a[0] - p[0]) * ky;
      const dx = (b[1] - a[1]) * kx, dy = (b[0] - a[0]) * ky;
      const dv = Math.hypot(ax, ay);
      if (dv < dV) { dV = dv; pV = a; }
      const l2 = dx * dx + dy * dy;
      const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l2));
      const de = Math.hypot(ax + t * dx, ay + t * dy);
      if (de < dE) { dE = de; pE = [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]; }
    }
  }
  if (pV && dV <= tol && dV - dE <= tol / 3) return pV;
  if (pE && dE <= tol) return pE;
  return null;
}

interface EntradaHistorial {
  id: string;
  accion: string;
  en: string;
  partyId: string | null;
  antes: Record<string, unknown> | null;
  despues: Record<string, unknown> | null;
}

interface ResultadoPunto {
  cubierto: boolean;
  zona: string | null;
  tarifa: number | null;
  tarifaZona?: number | null;
}

interface Edicion {
  codigo: string;
  original: CoordenadaPunto[];
  puntos: CoordenadaPunto[];
  /** Estados anteriores del borrador, para deshacer. */
  pila: CoordenadaPunto[][];
}

export interface ZonasMapaProps {
  zonas: ZonaRepartoItem[];
  seleccionado: string | null;
  onSeleccionar: (codigo: string | null) => void;
  puedeEditar: boolean;
  diagnostico: DiagnosticoZonas | null;
  versionHistorial: number;
  onEditarTarifa: (zona: ZonaRepartoItem) => void;
  /** Abre el modal de minutos de entrega de la zona (opcional). */
  onEditarTiempo?: (zona: ZonaRepartoItem) => void;
  onCambiarActiva: (zona: ZonaRepartoItem) => void;
  onEditarJson: (zona: ZonaRepartoItem) => void;
  /** Guarda el polígono con PUT /admin/zonas/:codigo/poligono. Si falla, lanza el error del servidor. */
  onGuardarPoligono: (codigo: string, puntos: CoordenadaPunto[], motivo?: string) => Promise<void>;
  /** Se llama tras normalizar para que la pantalla recargue zonas y diagnóstico. */
  onZonasCambiadas?: () => void;
}

// Colores alternados entre oscuros y claros, para distinguir zonas también por luminosidad
const PALETA = ['#1565C0', '#FFB300', '#2E7D32', '#AD1457', '#00838F', '#6D4C41', '#5E35B1', '#C0CA33'];
export const colorDeZona = (indice: number) => PALETA[indice % PALETA.length];

const aCadena = (lista: CoordenadaPunto[]) => JSON.stringify(lista);

/** Área aproximada del polígono en m² (proyección local plana, suficiente para una zona de reparto). */
export function areaAproxM2(puntos: CoordenadaPunto[]): number {
  if (puntos.length < 3) return 0;
  const lat0 = puntos.reduce((s, p) => s + p[0], 0) / puntos.length;
  const kx = 111320 * Math.cos((lat0 * Math.PI) / 180);
  const ky = 110574;
  let suma = 0;
  for (let i = 0; i < puntos.length; i++) {
    const [la1, ln1] = puntos[i];
    const [la2, ln2] = puntos[(i + 1) % puntos.length];
    suma += ln1 * kx * (la2 * ky) - ln2 * kx * (la1 * ky);
  }
  return Math.abs(suma) / 2;
}

function formatearArea(m2: number): string {
  if (m2 >= 1_000_000) return `${(m2 / 1_000_000).toFixed(2)} km²`;
  return `${Math.round(m2).toLocaleString('es-PE')} m²`;
}

/** Etiqueta del mapa: «Z3 · S/ 3.00 · 15–20 min» (los minutos solo si la zona los tiene). */
export const etiquetaZona = (z: ZonaRepartoItem) =>
  `${z.codigo} · S/ ${Number(z.tarifa).toFixed(2)}` +
  (z.minutosMin != null && z.minutosMax != null ? ` · ${z.minutosMin}–${z.minutosMax} min` : '');

const iconoVertice = (activo: boolean) =>
  L.divIcon({
    className: 'cp-vertice-zona',
    html: `<div style="width:44px;height:44px;display:flex;align-items:center;justify-content:center;"><span style="width:${activo ? 18 : 14}px;height:${activo ? 18 : 14}px;border-radius:50%;background:${activo ? '#D32F2F' : '#FFFFFF'};border:2.5px solid #0B2C3E;box-shadow:0 1px 4px rgba(0,0,0,0.4);"></span></div>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });

const iconoPuntoMedio = () =>
  L.divIcon({
    className: 'cp-punto-medio-zona',
    html: `<div style="width:44px;height:44px;display:flex;align-items:center;justify-content:center;"><span style="width:12px;height:12px;border-radius:3px;background:#0B2C3E;opacity:0.5;"></span></div>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });

/** Mapa de zonas de reparto: polígonos, selección, editor de área en borrador, consulta de punto y diagnóstico. */
export function ZonasMapa({
  zonas,
  seleccionado,
  onSeleccionar,
  puedeEditar,
  diagnostico,
  versionHistorial,
  onEditarTarifa,
  onEditarTiempo,
  onCambiarActiva,
  onEditarJson,
  onGuardarPoligono,
  onZonasCambiadas,
}: ZonasMapaProps) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);
  const capaZonas = useRef<L.LayerGroup | null>(null);
  const capaEdicion = useRef<L.LayerGroup | null>(null);
  const capaIman = useRef<L.LayerGroup | null>(null);
  const alSeleccionar = useRef(onSeleccionar);
  alSeleccionar.current = onSeleccionar;
  const alClicMapa = useRef<(p: L.LatLng) => void>(() => {});

  const [edicion, setEdicion] = useState<Edicion | null>(null);
  const [vertice, setVertice] = useState<number | null>(null);
  const [modoConsulta, setModoConsulta] = useState(false);
  const [consulta, setConsulta] = useState<{ lat: number; lng: number; resultado: ResultadoPunto | null; error: boolean } | null>(null);
  const [confirmarAbierto, setConfirmarAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorEdicion, setErrorEdicion] = useState<string | null>(null);
  const [historial, setHistorial] = useState<EntradaHistorial[] | null>(null);
  const [errorHistorial, setErrorHistorial] = useState(false);
  const [resaltadas, setResaltadas] = useState<string[]>([]);
  const [normalizar, setNormalizar] = useState<ResumenNormalizar | null>(null);
  /** Paso del flujo «Normalizar»: decidir conflictos (si los hay) y luego confirmar Sí/No. */
  const [pasoNormalizar, setPasoNormalizar] = useState<'conflictos' | 'confirmar' | null>(null);
  /** Decisión por par de conflicto (clave «zonaAId|zonaBId» -> id de la zona que se queda). */
  const [decisiones, setDecisiones] = useState<Record<string, string>>({});
  const [arreglo, setArreglo] = useState<{ codigo: string; previa: ResultadoAjuste } | null>(null);
  const [trabajando, setTrabajando] = useState(false);
  const tol = diagnostico?.toleranciaM;

  const zonaSel = zonas.find((z) => z.codigo === seleccionado) ?? null;
  const zonaEditada = edicion ? zonas.find((z) => z.codigo === edicion.codigo) ?? null : null;
  const sucia = edicion !== null && aCadena(edicion.puntos) !== aCadena(edicion.original);

  /** Polígonos de las demás zonas activas (a los que se pega la zona en edición). */
  const vecinasDe = (codigo: string): CoordenadaPunto[][] =>
    zonas.filter((z) => z.activa && z.codigo !== codigo && z.poligono.length >= 3).map((z) => z.poligono);
  const vecinasRef = useRef<(c: string) => CoordenadaPunto[][]>(vecinasDe);
  vecinasRef.current = vecinasDe;
  const tolRef = useRef(tol);
  tolRef.current = tol;

  // Vista previa del pegado automático del borrador (solo si el servidor informó la tolerancia)
  const previa = useMemo<ResultadoAjuste | null>(() => {
    if (!edicion || !tol || !zonaEditada?.activa || edicion.puntos.length < 3) return null;
    const r = ajustarAVecinas(edicion.puntos, vecinasDe(edicion.codigo), tol);
    return r.cambio ? r : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edicion, tol, zonas]);

  // El mapa se crea una sola vez
  useEffect(() => {
    if (!contenedor.current) return;
    const m = L.map(contenedor.current).setView(CENTRO_DEFECTO, 14);
    L.tileLayer(URL_TESELAS, { attribution: ATRIBUCION, maxZoom: 19 }).addTo(m);
    capaZonas.current = L.layerGroup().addTo(m);
    capaEdicion.current = L.layerGroup().addTo(m);
    capaIman.current = L.layerGroup().addTo(m);
    L.marker(CENTRO_DEFECTO, { icon: iconoTienda('Caprichos', 'Campoy'), interactive: false, keyboard: false }).addTo(m);
    m.on('click', (e: L.LeafletMouseEvent) => alClicMapa.current(e.latlng));
    mapa.current = m;
    const timer = setTimeout(() => m.invalidateSize(), 80);
    return () => {
      clearTimeout(timer);
      m.remove();
      mapa.current = null;
      capaZonas.current = null;
      capaEdicion.current = null;
      capaIman.current = null;
    };
  }, []);

  // Clic en el mapa: solo consulta un punto; durante la edición no hace nada
  alClicMapa.current = (p) => {
    if (edicion || !modoConsulta) return;
    setConsulta({ lat: p.lat, lng: p.lng, resultado: null, error: false });
    api
      .get<ResultadoPunto>(`/carta/envio?lat=${p.lat}&lng=${p.lng}`)
      .then((r) => setConsulta({ lat: p.lat, lng: p.lng, resultado: r, error: false }))
      .catch(() => setConsulta({ lat: p.lat, lng: p.lng, resultado: null, error: true }));
  };

  // Polígonos, etiquetas y diagnóstico
  useEffect(() => {
    const g = capaZonas.current;
    if (!g) return;
    g.clearLayers();
    const enSolape = new Set<string>(diagnostico?.solapes.flatMap((s) => [s.ganadora, s.perdedora]) ?? []);
    const invalidas = new Set<string>(diagnostico?.invalidas.map((i) => i.codigo) ?? []);
    const marcadas = new Set<string>(resaltadas);

    zonas.forEach((z, indice) => {
      const puntos = edicion && edicion.codigo === z.codigo ? edicion.puntos : z.poligono;
      if (!puntos || puntos.length < 3) return;
      const color = colorDeZona(indice);
      const esSel = z.codigo === seleccionado;
      const alerta = enSolape.has(z.codigo) || invalidas.has(z.codigo) || marcadas.has(z.codigo);
      const poligono = L.polygon(puntos as L.LatLngTuple[], {
        color: alerta ? '#D32F2F' : z.activa ? color : '#6B7280',
        weight: esSel || marcadas.has(z.codigo) ? 4 : 2,
        dashArray: !z.activa ? '6 6' : invalidas.has(z.codigo) ? '2 5' : undefined,
        fillColor: z.activa ? color : '#9CA3AF',
        fillOpacity: z.activa ? (esSel ? 0.45 : 0.28) : 0.06,
      });
      const etiqueta = document.createElement('span');
      etiqueta.textContent = etiquetaZona(z) + (z.activa ? '' : ' (inactiva)');
      etiqueta.style.cssText =
        'background:#FFFFFF;color:#0B2C3E;padding:2px 6px;border-radius:6px;font-weight:700;font-size:12px;box-shadow:0 1px 4px rgba(0,0,0,0.25);white-space:nowrap;';
      poligono.bindTooltip(etiqueta, { permanent: true, direction: 'center', className: 'cp-zona-etiqueta' });
      poligono.on('click', () => {
        if (!edicion) alSeleccionar.current(z.codigo);
      });
      poligono.addTo(g);
    });

    if (edicion && previa) {
      L.polygon(previa.poligono as L.LatLngTuple[], {
        color: '#0B2C3E', weight: 3, dashArray: '8 6', fill: false, interactive: false,
      }).addTo(g);
    }

    if (consulta) {
      L.circleMarker([consulta.lat, consulta.lng], {
        radius: 7,
        color: '#0B2C3E',
        weight: 3,
        fillColor: '#FFFFFF',
        fillOpacity: 1,
      }).addTo(g);
    }
  }, [zonas, seleccionado, edicion, diagnostico, consulta, resaltadas, previa]);

  // Vértices arrastrables y puntos intermedios para agregar vértices
  useEffect(() => {
    const g = capaEdicion.current;
    if (!g) return;
    g.clearLayers();
    if (!edicion || !puedeEditar) return;
    const pts = edicion.puntos;

    const codigoEd = edicion.codigo;
    const mostrarIman = (marcador: L.Marker) => {
      const gi = capaIman.current;
      gi?.clearLayers();
      const t = tolRef.current;
      if (!t) return;
      const ll = marcador.getLatLng();
      const obj = objetivoIman([ll.lat, ll.lng], vecinasRef.current(codigoEd), t);
      if (!obj) return;
      marcador.setLatLng(obj as L.LatLngTuple);
      gi?.addLayer(L.circleMarker(obj as L.LatLngTuple, { radius: 13, color: '#D32F2F', weight: 3, fill: false, interactive: false }));
    };
    const limpiarIman = () => capaIman.current?.clearLayers();

    pts.forEach((p, i) => {
      const marcador = L.marker(p as L.LatLngTuple, {
        draggable: true,
        icon: iconoVertice(vertice === i),
        title: `Vértice ${i + 1}`,
        keyboard: false,
      });
      marcador.on('drag', () => mostrarIman(marcador));
      marcador.on('dragend', () => {
        const ll = marcador.getLatLng();
        limpiarIman();
        cambiarPuntos((q) => q.map((v, j) => (j === i ? [ll.lat, ll.lng] : v)));
      });
      marcador.on('click', () => setVertice(i));
      marcador.addTo(g);
    });

    pts.forEach((p, i) => {
      const q = pts[(i + 1) % pts.length];
      const medio: CoordenadaPunto = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
      const marcador = L.marker(medio as L.LatLngTuple, { icon: iconoPuntoMedio(), title: 'Agregar vértice aquí', keyboard: false, draggable: true });
      marcador.on('drag', () => mostrarIman(marcador));
      marcador.on('dragend', () => {
        const ll = marcador.getLatLng();
        limpiarIman();
        cambiarPuntos((v) => insertarVertice(v, i, [ll.lat, ll.lng]));
        setVertice(i + 1);
      });
      marcador.on('click', () => {
        cambiarPuntos((v) => insertarVertice(v, i, medio));
        setVertice(i + 1);
      });
      marcador.addTo(g);
    });
  }, [edicion, vertice, puedeEditar]);

  // Al elegir una zona, el mapa se centra en ella
  useEffect(() => {
    const m = mapa.current;
    if (!m || !zonaSel || zonaSel.poligono.length < 3) return;
    m.fitBounds(L.latLngBounds(zonaSel.poligono as L.LatLngTuple[]), { padding: [40, 40], maxZoom: 17 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seleccionado]);

  // Historial de cambios de la zona seleccionada
  useEffect(() => {
    setHistorial(null);
    setErrorHistorial(false);
    if (!seleccionado) return;
    let vigente = true;
    api
      .get<EntradaHistorial[]>(`/admin/zonas/${encodeURIComponent(seleccionado)}/historial`)
      .then((r) => {
        if (vigente) setHistorial(Array.isArray(r) ? r : []);
      })
      .catch(() => {
        if (vigente) setErrorHistorial(true);
      });
    return () => {
      vigente = false;
    };
  }, [seleccionado, versionHistorial]);

  /** Aplica un cambio al borrador guardando el estado anterior para deshacer. */
  function cambiarPuntos(fn: (p: CoordenadaPunto[]) => CoordenadaPunto[]) {
    setEdicion((prev) => (prev ? { ...prev, pila: [...prev.pila, prev.puntos], puntos: fn(prev.puntos) } : prev));
  }

  const deshacer = () => {
    setEdicion((prev) => (prev && prev.pila.length ? { ...prev, puntos: prev.pila[prev.pila.length - 1], pila: prev.pila.slice(0, -1) } : prev));
    setVertice(null);
  };

  const agregarPunto = () => {
    if (!edicion) return;
    const lado = vertice !== null ? vertice : ladoMasLargo(edicion.puntos);
    cambiarPuntos((p) => insertarVertice(p, lado));
    setVertice(lado + 1);
  };

  const pegarAVecinas = () => {
    if (previa) {
      cambiarPuntos(() => previa.poligono as CoordenadaPunto[]);
      setVertice(null);
    }
  };

  const iniciarEdicion = () => {
    if (!zonaSel) return;
    const copia = zonaSel.poligono.map((p) => [p[0], p[1]] as CoordenadaPunto);
    setEdicion({ codigo: zonaSel.codigo, original: copia, puntos: copia.map((p) => [...p] as CoordenadaPunto), pila: [] });
    setResaltadas([]);
    setVertice(null);
    setErrorEdicion(null);
    setModoConsulta(false);
  };

  const descartarEdicion = () => {
    setEdicion(null);
    setVertice(null);
    setErrorEdicion(null);
    setConfirmarAbierto(false);
    setResaltadas([]);
    capaIman.current?.clearLayers();
  };

  const quitarVertice = () => {
    if (!edicion || vertice === null || edicion.puntos.length <= 3) return;
    const indice = vertice;
    cambiarPuntos((p) => quitarVerticeDe(p, indice) as CoordenadaPunto[]);
    setVertice(null);
  };

  const guardarEdicion = async () => {
    if (!edicion) return;
    setGuardando(true);
    setErrorEdicion(null);
    try {
      await onGuardarPoligono(edicion.codigo, previa ? (previa.poligono as CoordenadaPunto[]) : edicion.puntos);
      setEdicion(null);
      setVertice(null);
      setResaltadas([]);
    } catch (err) {
      setErrorEdicion(err instanceof ErrorApi ? err.message : 'No se pudo guardar el área de la zona');
      if (err instanceof ErrorApi && err.codigo === 'ZONA_SOLAPADA') {
        const det = (err.detalles as { detalle?: { nombre: string; areaM2: number }[] } | undefined)?.detalle ?? [];
        setResaltadas(det.map((d) => d.nombre));
        setErrorEdicion(`${err.message} ${det.map((d) => `Zona ${d.nombre}: ${Math.round(d.areaM2)} m² solapados.`).join(' ')}`.trim());
      }
    } finally {
      setGuardando(false);
      setConfirmarAbierto(false);
    }
  };

  const pegarPar = (codigo: string) => {
    const z = zonas.find((x) => x.codigo === codigo);
    if (!z || !tol) return;
    setArreglo({ codigo, previa: ajustarAVecinas(z.poligono, vecinasDe(codigo), tol) });
  };

  const confirmarArreglo = async () => {
    if (!arreglo) return;
    setTrabajando(true);
    try {
      await onGuardarPoligono(arreglo.codigo, arreglo.previa.poligono as CoordenadaPunto[], 'Pegado automático');
      setArreglo(null);
    } catch (err) {
      setErrorEdicion(err instanceof ErrorApi ? err.message : 'No se pudo arreglar la zona');
      setArreglo(null);
    } finally {
      setTrabajando(false);
    }
  };

  const cerrarNormalizar = () => {
    setPasoNormalizar(null);
    setNormalizar(null);
  };

  const verNormalizar = async () => {
    setTrabajando(true);
    try {
      const r = await api.post<ResumenNormalizar>('/admin/zonas/normalizar', { confirmar: false });
      setNormalizar(r);
      setDecisiones({});
      setPasoNormalizar((r.conflictos ?? []).length > 0 ? 'conflictos' : 'confirmar');
    } catch (err) {
      setErrorEdicion(err instanceof ErrorApi ? err.message : 'No se pudo calcular el pegado de las zonas');
    } finally {
      setTrabajando(false);
    }
  };

  /** Con todas las decisiones tomadas, pide otra vez la vista previa para mostrar el cambio final por zona. */
  const aplicarDecisiones = async () => {
    setTrabajando(true);
    try {
      const r = await api.post<ResumenNormalizar>('/admin/zonas/normalizar', {
        confirmar: false,
        decisiones: decisionesDe(normalizar, decisiones),
      });
      setNormalizar(r);
      setPasoNormalizar('confirmar');
    } catch (err) {
      setErrorEdicion(err instanceof ErrorApi ? err.message : 'No se pudo calcular el pegado de las zonas');
      cerrarNormalizar();
    } finally {
      setTrabajando(false);
    }
  };

  const confirmarNormalizar = async () => {
    setTrabajando(true);
    try {
      const conflictos = normalizar?.conflictos ?? [];
      await api.post(
        '/admin/zonas/normalizar',
        conflictos.length > 0 ? { confirmar: true, decisiones: decisionesDe(normalizar, decisiones) } : { confirmar: true },
      );
      cerrarNormalizar();
      onZonasCambiadas?.();
    } catch (err) {
      setErrorEdicion(err instanceof ErrorApi ? err.message : 'No se pudo normalizar las zonas');
      cerrarNormalizar();
    } finally {
      setTrabajando(false);
    }
  };

  const huecos = diagnostico?.huecos ?? [];

  const avisosDiagnostico: string[] = [
    ...(diagnostico?.solapes ?? []).map(
      (s) => `Zona ${s.perdedora} se solapa con ${s.ganadora}: en la parte compartida gana ${s.ganadora} (menor código).`,
    ),
    ...(diagnostico?.invalidas ?? []).map((i) => `Zona ${i.codigo}: polígono no válido. ${i.motivo}.`),
  ];

  const botonCarta = (activo: boolean): CSSProperties => ({
    width: '100%',
    minHeight: '56px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 12px',
    borderRadius: '12px',
    border: activo ? '2px solid var(--cp-navy)' : '1px solid var(--cp-line)',
    background: activo ? 'var(--cp-sand)' : 'var(--cp-white)',
    cursor: 'pointer',
    textAlign: 'left',
  });

  return (
    <div className="zonas-mapa-layout">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minWidth: 0 }}>
        <div
          ref={contenedor}
          className="cp-mapa"
          role="application"
          aria-label="Mapa de zonas de reparto"
          style={{ height: 'clamp(300px, 60vh, 520px)', borderRadius: '16px', border: '1px solid var(--cp-line)' }}
        />

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
          <Boton
            type="button"
            variante={modoConsulta ? 'oscuro' : 'secundario'}
            aria-pressed={modoConsulta}
            disabled={edicion !== null}
            onClick={() => {
              setModoConsulta((v) => !v);
              setConsulta(null);
            }}
          >
            {modoConsulta ? 'Dejar de probar puntos' : 'Probar un punto'}
          </Boton>
          {modoConsulta && (
            <span style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>Toca el mapa para ver a qué zona cae.</span>
          )}
        </div>

        {consulta && (
          <div role="status" style={{ background: 'var(--cp-white)', border: '1px solid var(--cp-line)', borderRadius: '12px', padding: '10px 14px', fontSize: '13px', color: 'var(--cp-navy)' }}>
            {consulta.error && 'No se pudo consultar ese punto. Intenta de nuevo.'}
            {!consulta.error && consulta.resultado === null && 'Consultando...'}
            {consulta.resultado && !consulta.resultado.cubierto && (
              <b>Fuera de cobertura: ese punto no cae en ninguna zona activa.</b>
            )}
            {consulta.resultado?.cubierto && (
              <>
                <b>Zona {consulta.resultado.zona}</b> · tarifa de zona S/{' '}
                {Number(consulta.resultado.tarifaZona ?? consulta.resultado.tarifa ?? 0).toFixed(2)}
                <div style={{ fontSize: '12px', color: 'var(--cp-soft)', marginTop: '4px' }}>
                  Tarifa pura de la zona, sin el envío gratis por monto.
                </div>
              </>
            )}
          </div>
        )}

        {edicion && zonaEditada && (
          <div
            role="region"
            aria-label="Edición del área de la zona"
            style={{ background: 'var(--cp-sand)', border: '1.5px solid var(--cp-orange)', borderRadius: '12px', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}
          >
            <div style={{ fontSize: '13px', color: 'var(--cp-navy)' }}>
              <b>Editando el área de la zona {edicion.codigo}</b> · {edicion.puntos.length} vértices. Arrastra un punto
              para moverlo y toca un cuadrito entre dos puntos para agregar uno. Los cambios no se guardan hasta confirmar.
              {vertice !== null && <> Vértice seleccionado: {vertice + 1}.</>}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              <Boton type="button" variante="secundario" onClick={agregarPunto}>
                Agregar punto
              </Boton>
              <Boton type="button" variante="secundario" disabled={vertice === null || edicion.puntos.length <= 3} onClick={quitarVertice}>
                Quitar vértice
              </Boton>
              <Boton type="button" variante="secundario" disabled={edicion.pila.length === 0} onClick={deshacer}>
                Deshacer
              </Boton>
              {tol && zonaEditada.activa && (
                <Boton type="button" variante="secundario" disabled={!previa} onClick={pegarAVecinas}>
                  Pegar a zonas vecinas
                </Boton>
              )}
              <Boton type="button" variante="texto" onClick={descartarEdicion} disabled={guardando}>
                Descartar
              </Boton>
              <Boton type="button" variante="primario" disabled={!sucia || edicion.puntos.length < 3 || guardando} onClick={() => setConfirmarAbierto(true)}>
                Guardar cambios
              </Boton>
            </div>
            {previa && (
              <div role="status" style={{ fontSize: '13px', color: 'var(--cp-navy)' }}>
                <b>Vista previa del pegado (trazo discontinuo):</b> {resumenAjusteTexto(previa.resumen)}
              </div>
            )}
            {errorEdicion && (
              <div role="alert" style={{ fontSize: '13px', color: 'var(--cp-rust)', fontWeight: 600 }}>
                {errorEdicion}
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', minWidth: 0 }}>
        {avisosDiagnostico.length > 0 && (
          <div role="status" style={{ background: '#FBEDE9', border: '1px solid var(--cp-rust)', borderRadius: '12px', padding: '10px 12px', fontSize: '13px', color: 'var(--cp-rust)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <b>Revisa la cobertura</b>
            {avisosDiagnostico.map((a) => (
              <span key={a}>{a}</span>
            ))}
          </div>
        )}

        {huecos.length > 0 && (
          <div role="status" aria-label="Huecos entre zonas" style={{ background: 'var(--cp-white)', border: '1px solid var(--cp-line)', borderRadius: '12px', padding: '10px 12px', fontSize: '13px', color: 'var(--cp-navy)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <b>Huecos entre zonas</b>
            {huecos.map((h) => (
              <div key={`${h.zonaA}-${h.zonaB}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  {h.zonaA} y {h.zonaB}: hueco de {h.metros} metros{h.fino ? ' (se puede cerrar)' : ' (informativo)'}
                </span>
                {h.fino && puedeEditar && (
                  <Boton type="button" variante="secundario" disabled={edicion !== null || trabajando} onClick={() => pegarPar(h.zonaB)}>
                    Arreglar
                  </Boton>
                )}
              </div>
            ))}
          </div>
        )}

        {puedeEditar && tol ? (
          <Boton type="button" variante="secundario" disabled={edicion !== null || trabajando} onClick={verNormalizar}>
            Normalizar todas las zonas
          </Boton>
        ) : null}

        <div style={{ fontSize: '12px', color: 'var(--cp-soft)', lineHeight: '17px' }}>
          Los espacios sin zona son normales: ahí el delivery está fuera de cobertura. Los cambios de tarifa, estado o área rigen para pedidos nuevos; los pedidos ya creados conservan su envío y su zona.
        </div>

        <div role="group" aria-label="Zonas de reparto" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {zonas.map((z, indice) => {
            const activo = z.codigo === seleccionado;
            return (
              <button
                key={z.codigo}
                type="button"
                aria-pressed={activo}
                disabled={edicion !== null && edicion.codigo !== z.codigo}
                onClick={() => alSeleccionar.current(z.codigo)}
                style={botonCarta(activo)}
              >
                <span
                  aria-hidden="true"
                  style={{ width: '18px', height: '18px', borderRadius: '5px', flex: 'none', background: z.activa ? colorDeZona(indice) : '#9CA3AF', border: '2px solid #0B2C3E' }}
                />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ color: 'var(--cp-navy)' }}>Zona {z.codigo}</b>{' '}
                  <span style={{ fontSize: '13px', color: 'var(--cp-navy)' }}>· S/ {Number(z.tarifa).toFixed(2)}</span>
                  <span style={{ display: 'block', fontSize: '12px', color: 'var(--cp-soft)' }}>{z.puntos} puntos</span>
                </span>
                {z.activa ? <Insignia variante="exito">Activa</Insignia> : <Insignia variante="peligro">Inactiva</Insignia>}
              </button>
            );
          })}
        </div>

        {zonaSel && (
          <div style={{ background: 'var(--cp-white)', border: '1px solid var(--cp-line)', borderRadius: '14px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: '18px', color: 'var(--cp-navy)' }}>
              Zona {zonaSel.codigo}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--cp-soft)' }}>
              Área aproximada: {formatearArea(areaAproxM2(zonaSel.poligono))}
            </div>
            {puedeEditar && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                <Boton type="button" variante="secundario" disabled={edicion !== null} onClick={() => onEditarTarifa(zonaSel)}>
                  Editar tarifa
                </Boton>
                {onEditarTiempo && (
                  <Boton type="button" variante="secundario" disabled={edicion !== null} onClick={() => onEditarTiempo(zonaSel)}>
                    Editar minutos
                  </Boton>
                )}
                <Boton type="button" variante="secundario" disabled={edicion !== null} onClick={() => onCambiarActiva(zonaSel)}>
                  {zonaSel.activa ? 'Desactivar zona' : 'Activar zona'}
                </Boton>
                <Boton type="button" variante="secundario" disabled={edicion !== null} onClick={iniciarEdicion}>
                  Editar área en el mapa
                </Boton>
                <Boton type="button" variante="texto" disabled={edicion !== null} onClick={() => onEditarJson(zonaSel)}>
                  Editar JSON (avanzado)
                </Boton>
              </div>
            )}

            <div style={{ borderTop: '1px solid var(--cp-line)', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <b style={{ fontSize: '13px', color: 'var(--cp-navy)' }}>Historial de cambios</b>
              {errorHistorial && <span style={{ fontSize: '12px', color: 'var(--cp-rust)' }}>No se pudo cargar el historial.</span>}
              {!errorHistorial && historial === null && <span style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>Cargando historial...</span>}
              {historial?.length === 0 && <span style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>Sin cambios registrados.</span>}
              {historial?.map((h) => (
                <div key={h.id} style={{ fontSize: '12px', color: 'var(--cp-navy)', lineHeight: '17px' }}>
                  <b>{descripcionCambio(h)}</b>
                  <div style={{ color: 'var(--cp-soft)' }}>
                    {new Date(h.en).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })}
                    {h.partyId ? ` · usuario #${h.partyId}` : ''}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <Confirmar
        abierto={arreglo !== null}
        titulo={`¿Pegar la zona ${arreglo?.codigo ?? ''} a sus vecinas?`}
        textoSi="Sí, pegar"
        textoNo="No"
        cargando={trabajando}
        alConfirmar={confirmarArreglo}
        alCancelar={() => setArreglo(null)}
      >
        <div style={{ fontSize: '13px', color: 'var(--cp-navy)' }}>
          {arreglo ? resumenAjusteTexto(arreglo.previa.resumen) : ''} Queda en el historial como «Pegado automático».
        </div>
      </Confirmar>

      {pasoNormalizar === 'conflictos' && normalizar && (
        <DialogoConflictos
          conflictos={normalizar.conflictos ?? []}
          zonas={zonas}
          decisiones={decisiones}
          cargando={trabajando}
          onDecidir={(clave, conserva) => setDecisiones((d) => ({ ...d, [clave]: conserva }))}
          onAplicar={aplicarDecisiones}
          onCancelar={cerrarNormalizar}
        />
      )}

      <Confirmar
        abierto={pasoNormalizar === 'confirmar' && normalizar !== null}
        titulo="¿Normalizar todas las zonas activas?"
        textoSi="Sí, normalizar"
        textoNo="No"
        cargando={trabajando}
        alConfirmar={confirmarNormalizar}
        alCancelar={cerrarNormalizar}
      >
        <div style={{ fontSize: '13px', color: 'var(--cp-navy)', lineHeight: '20px' }}>
          {(normalizar?.conflictos ?? []).map((c) => {
            const se = decisiones[claveConflicto(c)];
            const gana = se === c.zonaAId ? c.nombreA : c.nombreB;
            const pierde = se === c.zonaAId ? c.nombreB : c.nombreA;
            return (
              <div key={claveConflicto(c)} style={{ marginBottom: '4px' }}>
                {gana} se queda con el área compartida con {pierde}; {pierde} la pierde.
              </div>
            );
          })}
          {normalizar?.zonas.filter((z) => z.cambia).length === 0 && <div>Ninguna zona necesita ajuste.</div>}
          {normalizar?.zonas.filter((z) => z.cambia).map((z) => (
            <div key={z.codigo}>
              <b>{z.codigo}</b>: {descripcionArea(z)}. {resumenAjusteTexto(z.resumen)}
            </div>
          ))}
          <div style={{ marginTop: '6px', color: 'var(--cp-soft)' }}>
            Solo cambia la geometría, nada se elimina. Cada cambio queda en el historial como «Pegado automático».
          </div>
        </div>
      </Confirmar>

      <Confirmar
        abierto={confirmarAbierto}
        titulo={`¿Guardar el nuevo área de la zona ${edicion?.codigo ?? ''}?`}
        textoSi="Sí, guardar"
        textoNo="No"
        cargando={guardando}
        alConfirmar={guardarEdicion}
        alCancelar={() => setConfirmarAbierto(false)}
      >
        {edicion && zonaEditada && (
          <div style={{ fontSize: '13px', color: 'var(--cp-navy)', lineHeight: '20px' }}>
            <div>Vértices: {zonaEditada.poligono.length} → {(previa ? previa.poligono : edicion.puntos).length}</div>
            <div>
              Área aproximada: {formatearArea(areaAproxM2(zonaEditada.poligono))} → {formatearArea(areaAproxM2(previa ? (previa.poligono as CoordenadaPunto[]) : edicion.puntos))}
            </div>
            {previa && <div style={{ marginTop: '6px' }}>Se guardará pegada a las zonas vecinas: {resumenAjusteTexto(previa.resumen)}</div>}
            <div style={{ marginTop: '6px', color: 'var(--cp-soft)' }}>
              Los pedidos nuevos usarán la nueva área. Los pedidos ya creados no cambian.
            </div>
          </div>
        )}
      </Confirmar>
    </div>
  );
}

function descripcionCambio(h: EntradaHistorial): string {
  const a = h.antes ?? {};
  const d = h.despues ?? {};
  if (h.accion === 'EDITAR_TARIFA') {
    return `Tarifa: S/ ${Number(a.tarifa ?? 0).toFixed(2)} → S/ ${Number(d.tarifa ?? 0).toFixed(2)}`;
  }
  if (h.accion === 'EDITAR_ESTADO') {
    return `Estado: ${a.activa ? 'activa' : 'inactiva'} → ${d.activa ? 'activa' : 'inactiva'}`;
  }
  if (h.accion === 'EDITAR_POLIGONO') {
    return `Área: ${a.puntos ?? '?'} → ${d.puntos ?? '?'} vértices${d.motivo ? ` (${String(d.motivo)})` : ''}`;
  }
  return h.accion;
}

const claveConflicto = (c: { zonaAId: string; zonaBId: string }) => `${c.zonaAId}|${c.zonaBId}`;

/** Decisiones ya tomadas, en el formato que espera el servidor. */
function decisionesDe(r: ResumenNormalizar | null, decisiones: Record<string, string>): DecisionNormalizar[] {
  return (r?.conflictos ?? [])
    .filter((c) => decisiones[claveConflicto(c)])
    .map((c) => ({ zonaAId: c.zonaAId, zonaBId: c.zonaBId, conserva: decisiones[claveConflicto(c)] }));
}

/** Metros cuadrados con espacio como separador de miles: «1 240». */
const m2 = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

/** Área que la zona pierde o gana con el pegado (para el resumen final). */
function descripcionArea(z: ResumenNormalizar['zonas'][number]): string {
  const delta = Math.round(((z.areaDespuesM2 ?? 0) - (z.areaAntesM2 ?? 0)) * 10) / 10;
  if (delta <= -0.5) return `pierde ${m2(-delta)} m² (de ${m2(z.areaAntesM2)} a ${m2(z.areaDespuesM2)} m²)`;
  if (delta >= 0.5) return `gana ${m2(delta)} m²`;
  return 'ajusta sus bordes, sin cambiar el área';
}

const COLOR_A = '#1565C0';
const COLOR_B = '#FFB300';
const COLOR_SOLAPE = '#D32F2F';

/** Mini mapa de un conflicto: las dos zonas en colores distintos y la parte compartida resaltada. */
function MiniMapaConflicto({
  a,
  b,
  solape,
}: {
  a: CoordenadaPunto[] | undefined;
  b: CoordenadaPunto[] | undefined;
  solape: ConflictoNormalizar['poligonoSolape'];
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const m = L.map(ref.current, {
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      touchZoom: false,
      boxZoom: false,
      keyboard: false,
    });
    const grupo = L.featureGroup().addTo(m);
    const dibujar = (puntos: CoordenadaPunto[] | undefined, color: string) => {
      if (puntos && puntos.length >= 3)
        L.polygon(puntos as L.LatLngTuple[], { color, weight: 2, fillColor: color, fillOpacity: 0.25, interactive: false }).addTo(grupo);
    };
    dibujar(a, COLOR_A);
    dibujar(b, COLOR_B);
    for (const poligono of solape.coordinates) {
      const anillo = poligono[0];
      if (anillo?.length >= 3)
        L.polygon(
          anillo.map(([lng, lat]) => [lat, lng] as L.LatLngTuple),
          { color: COLOR_SOLAPE, weight: 2, fillColor: COLOR_SOLAPE, fillOpacity: 0.6, interactive: false },
        ).addTo(grupo);
    }
    const limites = grupo.getBounds();
    if (limites.isValid()) m.fitBounds(limites, { padding: [10, 10] });
    const timer = setTimeout(() => m.invalidateSize(), 80);
    return () => {
      clearTimeout(timer);
      m.remove();
    };
  }, [a, b, solape]);
  return (
    <div
      ref={ref}
      role="img"
      aria-label="Mapa del solape entre las dos zonas"
      style={{ height: '160px', borderRadius: '10px', border: '1px solid var(--cp-line)', overflow: 'hidden', background: '#F3F6F8' }}
    />
  );
}

/** Paso 1 de «Normalizar»: una tarjeta por par solapado con dos botones de decisión. Aplicar espera a que decidas todo. */
function DialogoConflictos({
  conflictos,
  zonas,
  decisiones,
  cargando,
  onDecidir,
  onAplicar,
  onCancelar,
}: {
  conflictos: ConflictoNormalizar[];
  zonas: ZonaRepartoItem[];
  decisiones: Record<string, string>;
  cargando: boolean;
  onDecidir: (clave: string, conserva: string) => void;
  onAplicar: () => void;
  onCancelar: () => void;
}) {
  const pendientes = conflictos.filter((c) => !decisiones[claveConflicto(c)]).length;
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 5000,
        background: 'rgba(11, 44, 62, 0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={cargando ? undefined : onCancelar}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Zonas que ya se solapan"
        style={{
          width: '100%',
          maxWidth: '520px',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'var(--cp-white)',
          border: '1px solid var(--cp-line)',
          borderRadius: '20px',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: '18px', color: 'var(--cp-navy)', margin: 0 }}>
          Zonas que ya se solapan
        </h2>
        <p style={{ margin: 0, fontSize: '14px', lineHeight: '20px', color: 'var(--cp-soft)' }}>
          Elige qué zona se queda con el área compartida. La otra pierde esa parte.
        </p>

        {conflictos.map((c) => {
          const clave = claveConflicto(c);
          const eleccion = decisiones[clave];
          const zonaA = zonas.find((z) => z.codigo === c.nombreA);
          const zonaB = zonas.find((z) => z.codigo === c.nombreB);
          return (
            <div
              key={clave}
              role="group"
              aria-label={`Conflicto entre ${c.nombreA} y ${c.nombreB}`}
              style={{ border: '1px solid var(--cp-line)', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}
            >
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--cp-navy)' }}>
                {c.nombreA} (S/ {Number(c.tarifaA).toFixed(2)}) y {c.nombreB} (S/ {Number(c.tarifaB).toFixed(2)}) se solapan {m2(c.areaM2)} m²
              </div>
              <MiniMapaConflicto a={zonaA?.poligono} b={zonaB?.poligono} solape={c.poligonoSolape} />
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <Boton
                  type="button"
                  variante={eleccion === c.zonaAId ? 'primario' : 'secundario'}
                  aria-pressed={eleccion === c.zonaAId}
                  disabled={cargando}
                  onClick={() => onDecidir(clave, c.zonaAId)}
                >
                  Se queda {c.nombreA}
                </Boton>
                <Boton
                  type="button"
                  variante={eleccion === c.zonaBId ? 'primario' : 'secundario'}
                  aria-pressed={eleccion === c.zonaBId}
                  disabled={cargando}
                  onClick={() => onDecidir(clave, c.zonaBId)}
                >
                  Se queda {c.nombreB}
                </Boton>
              </div>
            </div>
          );
        })}

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <Boton type="button" variante="secundario" disabled={cargando} onClick={onCancelar}>
            No, cancelar
          </Boton>
          <Boton type="button" variante="primario" disabled={pendientes > 0 || cargando} cargando={cargando} onClick={onAplicar}>
            {pendientes > 0 ? `Faltan ${pendientes} ${pendientes === 1 ? 'decisión' : 'decisiones'}` : 'Aplicar'}
          </Boton>
        </div>
      </div>
    </div>
  );
}

