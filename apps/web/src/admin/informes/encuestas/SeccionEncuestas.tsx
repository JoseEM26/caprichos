import { useEffect, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { api, ErrorApi } from '../../../comun/api';
import { Cargando } from '../../../comun/Cargando';
import { EstadoError } from '../../../comun/EstadoError';
import { EstadoVacio } from '../../../comun/EstadoVacio';
import { Paginacion } from '../../../comun/Paginacion';
import {
  BarrasModalidad,
  COLOR_PUNTAJE,
  ETIQUETA_MODALIDAD,
  DistribucionPuntaje,
  FilaModalidadStat,
  GraficoDistribucion,
  GraficoTendencia,
  PuntoTendencia,
} from './GraficosEncuestas';

export interface ItemEncuesta {
  id: string;
  fecha: string;
  puntaje: number;
  comentario?: string;
  motivo?: string | null;
  pedidoCodigo: string;
  clienteNombre: string;
  modalidad: string;
  canal: string;
  quejaId: string | null;
}

export interface RespuestaEncuestas {
  rango: { desde: string; hasta: string };
  resumen: {
    enviadas: number;
    respondidas: number;
    tasaRespuesta: number | null;
    promedio: number | null;
    satisfechos: number | null;
    insatisfechos: number | null;
  };
  distribucion: DistribucionPuntaje[];
  tendencia: PuntoTendencia[];
  porModalidad: FilaModalidadStat[];
  porMotivo?: { codigo: string; motivo: string; cantidad: number }[];
  items: ItemEncuesta[];
  total: number;
  pagina: number;
  limite: number;
  totalPaginas: number;
}

export const TAMANO_PAGINA = 8;
const LIMITE_CSV = 50;
const MAX_PAGINAS_CSV = 40;

const hoyLima = (): string => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });

function sumarDias(fecha: string, n: number): string {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

type Preset = 'hoy' | '7' | '30' | 'mes';
const PRESETS: { id: Preset; etiqueta: string }[] = [
  { id: 'hoy', etiqueta: 'Hoy' },
  { id: '7', etiqueta: '7 días' },
  { id: '30', etiqueta: '30 días' },
  { id: 'mes', etiqueta: 'Mes' },
];

function rangoDePreset(preset: Preset): { desde: string; hasta: string } {
  const hasta = hoyLima();
  if (preset === 'hoy') return { desde: hasta, hasta };
  if (preset === '7') return { desde: sumarDias(hasta, -6), hasta };
  if (preset === 'mes') return { desde: `${hasta.slice(0, 8)}01`, hasta };
  return { desde: sumarDias(hasta, -29), hasta };
}

const MODALIDADES = [
  { id: '', etiqueta: 'Todas' },
  { id: 'MESA', etiqueta: 'En mesa' },
  { id: 'RECOGER', etiqueta: 'Para recoger' },
  { id: 'DELIVERY', etiqueta: 'Delivery' },
];

const ETIQUETA_CANAL: Record<string, string> = {
  CARTA: 'Carta web',
  WHATSAPP: 'WhatsApp',
  MOZO: 'Mozo',
  LOCAL: 'Local',
};

const formatearFechaHora = (iso: string): string => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('es-PE', {
    timeZone: 'America/Lima',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
};

const formatearPorcentaje = (n: number | null) => (n == null ? '-' : `${n.toLocaleString('es-PE', { maximumFractionDigits: 1 })} %`);

/** Estrellas en SVG (sin emojis). Admite fracción para el promedio. */
export function Estrellas({ valor, tamano = 16 }: { valor: number; tamano?: number }) {
  const punta = 'M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.6l1.3-6.6-4.9-4.6 6.6-.8z';
  const pct = Math.max(0, Math.min(5, valor)) / 5;
  const ids = `est-${Math.round(valor * 100)}-${tamano}`;
  return (
    <svg
      role="img"
      aria-label={`${valor.toLocaleString('es-PE', { maximumFractionDigits: 1 })} de 5 estrellas`}
      width={tamano * 5}
      height={tamano}
      viewBox="0 0 120 24"
      style={{ display: 'inline-block', verticalAlign: 'middle', flex: '0 0 auto' }}
    >
      <defs>
        <clipPath id={ids}>
          <rect x="0" y="0" width={120 * pct} height="24" />
        </clipPath>
      </defs>
      {[0, 1, 2, 3, 4].map((i) => (
        <path key={`v${i}`} d={punta} transform={`translate(${i * 24} 0) scale(0.92)`} fill="var(--cp-sand)" stroke="var(--cp-line)" strokeWidth={0.6} />
      ))}
      <g clipPath={`url(#${ids})`}>
        {[0, 1, 2, 3, 4].map((i) => (
          <path key={`f${i}`} d={punta} transform={`translate(${i * 24} 0) scale(0.92)`} fill="var(--cp-gold)" />
        ))}
      </g>
    </svg>
  );
}

function construirQuery(params: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}

function mensajeDeError(err: unknown): string {
  return err instanceof ErrorApi ? err.message : 'No pudimos cargar las encuestas. Revisa tu conexión e inténtalo de nuevo.';
}

export function SeccionEncuestas() {
  const [preset, setPreset] = useState<Preset>('30');
  const [puntaje, setPuntaje] = useState<string>('');
  const [modalidad, setModalidad] = useState<string>('');
  const [pagina, setPagina] = useState(1);
  const [reintento, setReintento] = useState(0);
  const [datos, setDatos] = useState<RespuestaEncuestas | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [csvEnCurso, setCsvEnCurso] = useState(false);
  const [mensajeCsv, setMensajeCsv] = useState('');

  const rango = rangoDePreset(preset);

  // Cambiar un filtro vuelve a la primera página
  useEffect(() => {
    setPagina(1);
  }, [preset, puntaje, modalidad]);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError(null);
    const query = construirQuery({
      desde: rango.desde,
      hasta: rango.hasta,
      puntaje: puntaje || undefined,
      modalidad: modalidad || undefined,
      pagina,
      limite: TAMANO_PAGINA,
    });
    api
      .get<RespuestaEncuestas>(`/admin/estadisticas/encuestas${query}`)
      .then((res) => {
        if (vigente) setDatos(res);
      })
      .catch((err) => {
        if (vigente) setError(mensajeDeError(err));
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });
    return () => {
      vigente = false;
    };
    // rango se deriva de preset; reintento fuerza nueva consulta
  }, [preset, puntaje, modalidad, pagina, reintento]);

  const descargarCsv = async () => {
    setCsvEnCurso(true);
    setMensajeCsv('');
    try {
      const filas: ItemEncuesta[] = [];
      let pag = 1;
      let totalPaginas = 1;
      do {
        const res = await api.get<RespuestaEncuestas>(
          `/admin/estadisticas/encuestas${construirQuery({
            desde: rango.desde,
            hasta: rango.hasta,
            puntaje: puntaje || undefined,
            modalidad: modalidad || undefined,
            pagina: pag,
            limite: LIMITE_CSV,
          })}`,
        );
        filas.push(...res.items);
        totalPaginas = res.totalPaginas;
        pag += 1;
      } while (pag <= totalPaginas && pag <= MAX_PAGINAS_CSV);

      const cols = ['Fecha', 'Puntaje', 'Cliente', 'Pedido', 'Modalidad', 'Canal', 'Motivo', 'Comentario', 'Queja'];
      const lineas = [
        cols,
        ...filas.map((i) => [
          formatearFechaHora(i.fecha),
          i.puntaje,
          i.clienteNombre,
          i.pedidoCodigo,
          ETIQUETA_MODALIDAD[i.modalidad] ?? i.modalidad,
          ETIQUETA_CANAL[i.canal] ?? i.canal,
          i.motivo ?? '',
          i.comentario ?? '',
          i.quejaId ? 'Sí' : 'No',
        ]),
      ];
      const esc = (v: unknown) => `"${String(v).replace(/"/g, '""')}"`;
      const texto = lineas.map((r) => r.map(esc).join(';')).join('\r\n');
      const blob = new Blob(['﻿' + texto], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `encuestas-${rango.desde}-${rango.hasta}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setMensajeCsv(`Se descargaron ${filas.length} encuestas.`);
    } catch (err) {
      setMensajeCsv(mensajeDeError(err));
    } finally {
      setCsvEnCurso(false);
    }
  };

  const chip = (activo: boolean): CSSProperties => ({
    minHeight: 44,
    padding: '0 14px',
    borderRadius: 9999,
    border: '1.5px solid var(--cp-navy)',
    background: activo ? 'var(--cp-navy)' : 'transparent',
    color: activo ? 'var(--cp-cream)' : 'var(--cp-navy)',
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
  });

  const tarjeta: CSSProperties = {
    background: 'var(--cp-white)',
    border: '1px solid var(--cp-line)',
    borderRadius: 12,
    padding: 16,
  };

  return (
    <section aria-labelledby="titulo-encuestas" style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
      <div>
        <h2 id="titulo-encuestas" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 18, margin: 0 }}>
          Encuestas de satisfacción (WhatsApp)
        </h2>
        <p style={{ fontSize: 13, color: 'var(--cp-soft)', margin: '4px 0 0' }}>
          Lo que calificaron los clientes después de su pedido. Las fechas corresponden al envío de la encuesta.
        </p>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div role="group" aria-label="Rango de fechas" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {PRESETS.map((p) => (
            <button key={p.id} type="button" aria-pressed={preset === p.id} onClick={() => setPreset(p.id)} style={chip(preset === p.id)}>
              {p.etiqueta}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Puntaje" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button type="button" aria-pressed={puntaje === ''} onClick={() => setPuntaje('')} style={chip(puntaje === '')}>
            Todos los puntajes
          </button>
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" aria-pressed={puntaje === String(n)} onClick={() => setPuntaje(String(n))} style={chip(puntaje === String(n))}>
              {n} {n === 1 ? 'estrella' : 'estrellas'}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Modalidad" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {MODALIDADES.map((m) => (
            <button key={m.id || 'todas'} type="button" aria-pressed={modalidad === m.id} onClick={() => setModalidad(m.id)} style={chip(modalidad === m.id)}>
              {m.etiqueta}
            </button>
          ))}
        </div>
      </div>

      {error && <EstadoError mensaje={error} alReintentar={() => setReintento((r) => r + 1)} />}

      {!error && cargando && !datos && <Cargando mensaje="Cargando encuestas" />}

      {!error && datos && (
        <>
          {/* Tarjetas de resumen */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, opacity: cargando ? 0.6 : 1 }}>
            <div style={tarjeta}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--cp-soft)' }}>Promedio</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 24 }}>
                  {datos.resumen.promedio != null ? datos.resumen.promedio.toFixed(1) : '-'}
                </span>
                {datos.resumen.promedio != null && <Estrellas valor={datos.resumen.promedio} />}
              </div>
            </div>
            <div style={tarjeta}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--cp-soft)' }}>Tasa de respuesta</div>
              <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 24 }}>{formatearPorcentaje(datos.resumen.tasaRespuesta)}</div>
              <div style={{ fontSize: 12, color: 'var(--cp-soft)' }}>
                {datos.resumen.respondidas} de {datos.resumen.enviadas} enviadas
              </div>
            </div>
            <div style={tarjeta}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--cp-soft)' }}>Satisfechos (4 o 5)</div>
              <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 24, color: 'var(--cp-green)' }}>
                {formatearPorcentaje(datos.resumen.satisfechos)}
              </div>
            </div>
            <div style={tarjeta}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--cp-soft)' }}>Insatisfechos (1 o 2)</div>
              <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 24, color: 'var(--cp-rust)' }}>
                {formatearPorcentaje(datos.resumen.insatisfechos)}
              </div>
            </div>
          </div>

          {/* Gráficos */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
            <div style={tarjeta}>
              <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 8 }}>Cuántas respuestas por puntaje</div>
              <GraficoDistribucion datos={datos.distribucion} />
            </div>
            <div style={tarjeta}>
              <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 8 }}>Promedio por día</div>
              <GraficoTendencia puntos={datos.tendencia} />
            </div>
            <div style={tarjeta}>
              <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 8 }}>Promedio por modalidad</div>
              <BarrasModalidad filas={datos.porModalidad} />
            </div>
            <div style={tarjeta}>
              <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 8 }}>Motivos de notas 1 a 3</div>
              <ul aria-label="Motivos de calificación baja" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6, fontSize: 13 }}>
                {(datos.porMotivo ?? []).map((m) => (
                  <li key={m.codigo} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span>{m.motivo}</span>
                    <strong>{m.cantidad}</strong>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Lista */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ fontWeight: 800, fontSize: 15 }}>
              Respuestas recientes <span style={{ color: 'var(--cp-soft)', fontWeight: 700 }}>({datos.total})</span>
            </div>
            <button
              type="button"
              onClick={descargarCsv}
              disabled={csvEnCurso || datos.total === 0}
              style={{ ...chip(false), opacity: csvEnCurso || datos.total === 0 ? 0.5 : 1 }}
            >
              {csvEnCurso ? 'Preparando CSV…' : 'Descargar CSV'}
            </button>
          </div>
          {mensajeCsv && (
            <div role="status" style={{ fontSize: 12, color: 'var(--cp-soft)' }}>
              {mensajeCsv}
            </div>
          )}

          {datos.items.length === 0 ? (
            <EstadoVacio
              titulo="Sin encuestas en este filtro"
              descripcion="No hay respuestas con estos filtros. Prueba con otro rango, otro puntaje o toda la modalidad."
            />
          ) : (
            <ul
              aria-label="Lista de encuestas respondidas"
              style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10, opacity: cargando ? 0.6 : 1 }}
            >
              {datos.items.map((it) => (
                <li key={it.id} style={{ ...tarjeta, borderLeft: `5px solid ${COLOR_PUNTAJE[it.puntaje] ?? 'var(--cp-line)'}`, padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <Estrellas valor={it.puntaje} />
                      <span style={{ fontWeight: 800 }}>{it.puntaje}/5</span>
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--cp-soft)' }}>{formatearFechaHora(it.fecha)}</span>
                  </div>
                  <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: '4px 12px', fontSize: 13 }}>
                    <span>
                      <strong>{it.clienteNombre}</strong>
                    </span>
                    <span>Pedido {it.pedidoCodigo}</span>
                    <span>{ETIQUETA_MODALIDAD[it.modalidad] ?? it.modalidad}</span>
                    <span style={{ color: 'var(--cp-soft)' }}>{ETIQUETA_CANAL[it.canal] ?? it.canal}</span>
                  </div>
                  {it.motivo && (
                    <div style={{ marginTop: 8, fontSize: 13 }}>
                      <strong>Motivo:</strong> {it.motivo}
                    </div>
                  )}
                  {it.comentario && (
                    <p style={{ margin: '8px 0 0', fontSize: 13, lineHeight: '19px', overflowWrap: 'anywhere', fontStyle: 'italic' }}>
                      «{it.comentario}»
                    </p>
                  )}
                  {it.quejaId && (
                    <div style={{ marginTop: 8 }}>
                      <Link
                        to="/admin/reclamos"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          minHeight: 44,
                          padding: '0 12px',
                          borderRadius: 9999,
                          background: '#FBEDE9',
                          border: '1.5px solid var(--cp-rust)',
                          color: 'var(--cp-rust)',
                          fontWeight: 800,
                          fontSize: 12,
                          textDecoration: 'none',
                        }}
                      >
                        Derivó en queja: ver en Reclamos
                      </Link>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          {datos.total > 0 && (
            <Paginacion
              paginaActual={datos.pagina}
              totalPaginas={datos.totalPaginas}
              totalRegistros={datos.total}
              tamanoPagina={TAMANO_PAGINA}
              alCambiarPagina={setPagina}
            />
          )}
        </>
      )}
    </section>
  );
}
