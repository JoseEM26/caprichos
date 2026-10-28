import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { api, ErrorApi } from '../../comun/api';
import { Boton } from '../../comun/Boton';
import { Confirmar } from '../../comun/Confirmar';
import { Insignia } from '../../comun/Insignia';
import { L, ATRIBUCION, CENTRO_DEFECTO, URL_TESELAS, iconoTienda } from '../../comun/mapa/leaflet';
import type { CoordenadaPunto, ZonaRepartoItem } from './ZonasRepartoView';

export interface DiagnosticoZonas {
  solapes: { ganadora: string; perdedora: string }[];
  invalidas: { codigo: string; activa: boolean; motivo: string }[];
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
}

export interface ZonasMapaProps {
  zonas: ZonaRepartoItem[];
  seleccionado: string | null;
  onSeleccionar: (codigo: string | null) => void;
  puedeEditar: boolean;
  diagnostico: DiagnosticoZonas | null;
  versionHistorial: number;
  onEditarTarifa: (zona: ZonaRepartoItem) => void;
  onCambiarActiva: (zona: ZonaRepartoItem) => void;
  onEditarJson: (zona: ZonaRepartoItem) => void;
  /** Guarda el polígono con PUT /admin/zonas/:codigo/poligono. Si falla, lanza el error del servidor. */
  onGuardarPoligono: (codigo: string, puntos: CoordenadaPunto[]) => Promise<void>;
}

// Colores alternados entre oscuros y claros, para distinguir zonas también por luminosidad
const PALETA = ['#1565C0', '#FFB300', '#2E7D32', '#AD1457', '#00838F', '#6D4C41', '#5E35B1', '#C0CA33'];
const colorDeZona = (indice: number) => PALETA[indice % PALETA.length];

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

const etiquetaZona = (z: ZonaRepartoItem) => `${z.codigo} · S/ ${Number(z.tarifa).toFixed(2)}`;

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
  onCambiarActiva,
  onEditarJson,
  onGuardarPoligono,
}: ZonasMapaProps) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);
  const capaZonas = useRef<L.LayerGroup | null>(null);
  const capaEdicion = useRef<L.LayerGroup | null>(null);
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

  const zonaSel = zonas.find((z) => z.codigo === seleccionado) ?? null;
  const zonaEditada = edicion ? zonas.find((z) => z.codigo === edicion.codigo) ?? null : null;
  const sucia = edicion !== null && aCadena(edicion.puntos) !== aCadena(edicion.original);

  // El mapa se crea una sola vez
  useEffect(() => {
    if (!contenedor.current) return;
    const m = L.map(contenedor.current).setView(CENTRO_DEFECTO, 14);
    L.tileLayer(URL_TESELAS, { attribution: ATRIBUCION, maxZoom: 19 }).addTo(m);
    capaZonas.current = L.layerGroup().addTo(m);
    capaEdicion.current = L.layerGroup().addTo(m);
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

    zonas.forEach((z, indice) => {
      const puntos = edicion && edicion.codigo === z.codigo ? edicion.puntos : z.poligono;
      if (!puntos || puntos.length < 3) return;
      const color = colorDeZona(indice);
      const esSel = z.codigo === seleccionado;
      const alerta = enSolape.has(z.codigo) || invalidas.has(z.codigo);
      const poligono = L.polygon(puntos as L.LatLngTuple[], {
        color: alerta ? '#D32F2F' : z.activa ? color : '#6B7280',
        weight: esSel ? 4 : 2,
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

    if (consulta) {
      L.circleMarker([consulta.lat, consulta.lng], {
        radius: 7,
        color: '#0B2C3E',
        weight: 3,
        fillColor: '#FFFFFF',
        fillOpacity: 1,
      }).addTo(g);
    }
  }, [zonas, seleccionado, edicion, diagnostico, consulta]);

  // Vértices arrastrables y puntos intermedios para agregar vértices
  useEffect(() => {
    const g = capaEdicion.current;
    if (!g) return;
    g.clearLayers();
    if (!edicion || !puedeEditar) return;
    const pts = edicion.puntos;

    pts.forEach((p, i) => {
      const marcador = L.marker(p as L.LatLngTuple, {
        draggable: true,
        icon: iconoVertice(vertice === i),
        title: `Vértice ${i + 1}`,
        keyboard: false,
      });
      marcador.on('dragend', () => {
        const ll = marcador.getLatLng();
        setEdicion((prev) =>
          prev ? { ...prev, puntos: prev.puntos.map((q, j) => (j === i ? [ll.lat, ll.lng] : q)) } : prev,
        );
      });
      marcador.on('click', () => setVertice(i));
      marcador.addTo(g);
    });

    pts.forEach((p, i) => {
      const q = pts[(i + 1) % pts.length];
      const medio: CoordenadaPunto = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
      const marcador = L.marker(medio as L.LatLngTuple, { icon: iconoPuntoMedio(), title: 'Agregar vértice aquí', keyboard: false });
      marcador.on('click', () => {
        setEdicion((prev) =>
          prev ? { ...prev, puntos: [...prev.puntos.slice(0, i + 1), medio, ...prev.puntos.slice(i + 1)] } : prev,
        );
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

  const iniciarEdicion = () => {
    if (!zonaSel) return;
    const copia = zonaSel.poligono.map((p) => [p[0], p[1]] as CoordenadaPunto);
    setEdicion({ codigo: zonaSel.codigo, original: copia, puntos: copia.map((p) => [...p] as CoordenadaPunto) });
    setVertice(null);
    setErrorEdicion(null);
    setModoConsulta(false);
  };

  const descartarEdicion = () => {
    setEdicion(null);
    setVertice(null);
    setErrorEdicion(null);
    setConfirmarAbierto(false);
  };

  const quitarVertice = () => {
    if (!edicion || vertice === null || edicion.puntos.length <= 3) return;
    const indice = vertice;
    setEdicion({ ...edicion, puntos: edicion.puntos.filter((_, j) => j !== indice) });
    setVertice(null);
  };

  const guardarEdicion = async () => {
    if (!edicion) return;
    setGuardando(true);
    setErrorEdicion(null);
    try {
      await onGuardarPoligono(edicion.codigo, edicion.puntos);
      setEdicion(null);
      setVertice(null);
    } catch (err) {
      setErrorEdicion(err instanceof ErrorApi ? err.message : 'No se pudo guardar el área de la zona');
    } finally {
      setGuardando(false);
      setConfirmarAbierto(false);
    }
  };

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
              <Boton type="button" variante="secundario" disabled={vertice === null || edicion.puntos.length <= 3} onClick={quitarVertice}>
                Quitar vértice
              </Boton>
              <Boton type="button" variante="texto" onClick={descartarEdicion} disabled={guardando}>
                Descartar
              </Boton>
              <Boton type="button" variante="primario" disabled={!sucia || edicion.puntos.length < 3 || guardando} onClick={() => setConfirmarAbierto(true)}>
                Guardar cambios
              </Boton>
            </div>
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
            <div>Vértices: {zonaEditada.poligono.length} → {edicion.puntos.length}</div>
            <div>
              Área aproximada: {formatearArea(areaAproxM2(zonaEditada.poligono))} → {formatearArea(areaAproxM2(edicion.puntos))}
            </div>
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
    return `Área: ${a.puntos ?? '?'} → ${d.puntos ?? '?'} vértices`;
  }
  return h.accion;
}
