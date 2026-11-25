import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, ErrorApi } from '../../comun/api';
import { Cargando } from '../../comun/Cargando';
import { Insignia } from '../../comun/Insignia';
import { PropinasPorDia } from './PropinasPorDia';

/**
 * Reparto de propinas (solo ADMIN). El pago ya NO se hace aquí: las propinas se pagan por día en la planilla de cada persona.
 * Cifras del servidor; aquí solo se muestran. Los repartos mensuales antiguos quedan como historial de solo lectura.
 */
type Estado = 'BORRADOR' | 'APROBADO' | 'PAGADO' | 'ANULADO';

interface FilaGuardada {
  partyId: number;
  nombre: string;
  horas: number;
  porcentaje: number;
  monto: number;
  pagadoEn: string | null;
  pagadoMedio: string | null;
}

interface FilaPrevia {
  partyId: number;
  nombre: string;
  horas: number;
  porcentaje: number;
  monto: number;
}

interface Vista {
  anio: number;
  mes: number;
  mesTerminado: boolean;
  reparto: {
    id: number;
    estado: Estado;
    totalPropinas: number;
    totalHoras: number;
    calculadoEn: string;
    aprobadoEn: string | null;
    pagadoEn: string | null;
    filas: FilaGuardada[];
  } | null;
  previa: {
    totalPropinas: number;
    totalHoras: number;
    filas: FilaPrevia[];
    excluidos: Array<{ partyId: number; nombre: string; motivo: string; participa: boolean | null }>;
    avisos: string[];
    error: { codigo: string; mensaje: string } | null;
  };
}

interface FilaHistorial {
  id: number;
  anio: number;
  mes: number;
  estado: Estado;
  totalPropinas: number;
  totalHoras: number;
  pagadoEn: string | null;
  motivoAnulacion: string | null;
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const ETIQUETA_ESTADO: Record<Estado, string> = {
  BORRADOR: 'Borrador',
  APROBADO: 'Aprobado',
  PAGADO: 'Pagado',
  ANULADO: 'Anulado',
};

const soles = (n: number) => `S/ ${n.toFixed(2)}`;

/** Mes actual de Lima, sin depender de la zona horaria del navegador. */
function mesActualLima(): { anio: number; mes: number } {
  const partes = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit' }).formatToParts(new Date());
  return { anio: Number(partes.find((p) => p.type === 'year')?.value), mes: Number(partes.find((p) => p.type === 'month')?.value) };
}

/** Últimos 12 meses terminados (el mes anterior hacia atrás): el reparto se calcula cuando el mes termina. */
function mesesTerminados(actual: { anio: number; mes: number }): Array<{ anio: number; mes: number }> {
  const lista: Array<{ anio: number; mes: number }> = [];
  let { anio, mes } = actual;
  for (let i = 0; i < 13; i++) {
    mes -= 1;
    if (mes === 0) {
      mes = 12;
      anio -= 1;
    }
    lista.push({ anio, mes });
  }
  return lista;
}

export function RepartoPropinas() {
  const actual = useMemo(() => mesActualLima(), []);
  const opciones = useMemo(() => mesesTerminados(actual), [actual]);
  const [seleccion, setSeleccion] = useState<{ anio: number; mes: number }>(opciones[0]);
  const [vista, setVista] = useState<Vista | null>(null);
  const [historial, setHistorial] = useState<FilaHistorial[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const ruta = `/admin/propinas/reparto/${seleccion.anio}/${seleccion.mes}`;

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [v, h] = await Promise.all([api.get<Vista>(ruta), api.get<FilaHistorial[]>('/admin/propinas/reparto/historial')]);
      setVista(v);
      setHistorial(h);
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo cargar el reparto');
    } finally {
      setCargando(false);
    }
  }, [ruta]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const cambiarParticipacion = async (partyId: number, valor: string) => {
    setError(null);
    try {
      await api.put(`/admin/propinas/participacion/${partyId}`, { participa: valor === 'auto' ? null : valor === 'si' });
      setMensaje('Cambio guardado.');
      await cargar();
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo guardar el cambio');
    }
  };

  const reparto = vista?.reparto ?? null;
  const previa = vista?.previa;
  const estado: Estado | null = reparto?.estado ?? null;
  const filas: Array<FilaGuardada | FilaPrevia> = reparto ? reparto.filas : previa?.filas ?? [];
  const esGuardado = reparto !== null;
  const totalPropinas = reparto ? reparto.totalPropinas : previa?.totalPropinas ?? 0;
  const totalHoras = reparto ? reparto.totalHoras : previa?.totalHoras ?? 0;

  return (
    <section aria-label="Reparto del mes" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ fontSize: 13, color: 'var(--cp-soft, #2C4C5D)', maxWidth: 680 }}>
          Cada día, la propina cobrada se reparte entre quienes trabajaron ese día, en proporción a sus horas, y se paga en la planilla de cada persona.
          Aquí solo se ve. El reparto en planilla cuenta desde el período abierto al 25/11/2026. El ADMIN no participa salvo excepción.
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700 }}>
          Mes
          <select
            aria-label="Mes del reparto"
            value={`${seleccion.anio}-${seleccion.mes}`}
            onChange={(e) => {
              const [anio, mes] = e.target.value.split('-').map(Number);
              setSeleccion({ anio, mes });
            }}
            style={{ minHeight: 36, borderRadius: 8, border: '1px solid var(--cp-line)', padding: '0 8px' }}
          >
            {[...opciones, { anio: actual.anio, mes: actual.mes }].map((m) => (
              <option key={`${m.anio}-${m.mes}`} value={`${m.anio}-${m.mes}`}>
                {MESES[m.mes - 1]} {m.anio}
                {m.anio === actual.anio && m.mes === actual.mes ? ' (en curso)' : ''}
              </option>
            ))}
          </select>
        </label>
      </div>

      <PropinasPorDia anio={seleccion.anio} mes={seleccion.mes} />

      {error && <div role="alert" style={{ fontSize: 13, color: 'var(--cp-red, #b3261e)' }}>{error}</div>}
      {mensaje && <div role="status" style={{ fontSize: 13, color: 'var(--cp-navy, #0B2C3E)' }}>{mensaje}</div>}

      {cargando && !vista ? (
        <Cargando mensaje="Cargando reparto..." />
      ) : (
        vista && previa && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <strong>{MESES[vista.mes - 1]} {vista.anio}</strong>
              {estado ? (
                <Insignia variante={estado === 'PAGADO' ? 'exito' : estado === 'APROBADO' ? 'aviso' : 'neutro'}>{ETIQUETA_ESTADO[estado]}</Insignia>
              ) : (
                <Insignia variante="neutro">Sin reparto mensual antiguo</Insignia>
              )}
              {!esGuardado && <span style={{ fontSize: 12, color: 'var(--cp-soft)' }}>Vista previa (solo lectura)</span>}
            </div>

            {previa.error && (
              <div role="alert" style={{ fontSize: 13, color: 'var(--cp-red, #b3261e)' }}>{previa.error.mensaje}</div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
              <div style={{ background: 'var(--cp-white)', border: '1px solid var(--cp-line)', borderRadius: 14, padding: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700 }}>Total de propinas</div>
                <div style={{ fontWeight: 800, fontSize: 20 }}>{soles(totalPropinas)}</div>
              </div>
              <div style={{ background: 'var(--cp-white)', border: '1px solid var(--cp-line)', borderRadius: 14, padding: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700 }}>Horas totales</div>
                <div style={{ fontWeight: 800, fontSize: 20 }}>{totalHoras.toFixed(2)} h</div>
              </div>
              <div style={{ background: 'var(--cp-white)', border: '1px solid var(--cp-line)', borderRadius: 14, padding: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700 }}>Personas</div>
                <div style={{ fontWeight: 800, fontSize: 20 }}>{filas.length}</div>
              </div>
            </div>

            <table aria-label="Reparto por persona" style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'right' }}>
                  <th style={{ textAlign: 'left' }}>Persona</th>
                  <th>Horas</th>
                  <th>%</th>
                  <th>Monto</th>
                  {esGuardado && <th style={{ textAlign: 'left' }}>Pagado</th>}
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => {
                  const pagado = 'pagadoEn' in f ? f.pagadoEn : null;
                  return (
                    <tr key={f.partyId} style={{ textAlign: 'right' }}>
                      <td style={{ textAlign: 'left' }}>{f.nombre}</td>
                      <td>{f.horas.toFixed(2)}</td>
                      <td>{f.porcentaje.toFixed(2)}</td>
                      <td>{f.monto.toFixed(2)}</td>
                      {esGuardado && (
                        <td style={{ textAlign: 'left' }}>
                          {pagado ? `Pagado ${new Date(pagado).toLocaleDateString('es-PE')}${'pagadoMedio' in f && f.pagadoMedio ? ` (${f.pagadoMedio})` : ''}` : 'Pendiente'}
                        </td>
                      )}
                    </tr>
                  );
                })}
                {filas.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'left', color: 'var(--cp-soft)' }}>Nadie con horas trabajadas en el mes.</td>
                  </tr>
                )}
              </tbody>
            </table>

            {previa.avisos.length > 0 && (
              <section aria-label="Avisos del reparto" style={{ background: 'var(--cp-cream, #FBF4EC)', borderRadius: 12, padding: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Avisos</div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                  {previa.avisos.map((a) => <li key={a}>{a}</li>)}
                </ul>
              </section>
            )}

            {previa.excluidos.length > 0 && (
              <section aria-label="Personas fuera del reparto" style={{ fontSize: 13 }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Fuera del reparto</div>
                {previa.excluidos.map((e) => (
                  <div key={e.partyId} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span>{e.nombre} ({e.motivo === 'ADMIN' ? 'ADMIN' : 'excluido por el ADMIN'})</span>
                    <select
                      aria-label={`Participación de ${e.nombre}`}
                      value={e.participa === null ? 'auto' : e.participa ? 'si' : 'no'}
                      onChange={(ev) => void cambiarParticipacion(e.partyId, ev.target.value)}
                    >
                      <option value="auto">Según su rol</option>
                      <option value="si">Sí participa</option>
                      <option value="no">No participa</option>
                    </select>
                  </div>
                ))}
              </section>
            )}

          </>
        )
      )}

      <section aria-label="Historial de repartos" style={{ display: 'grid', gap: 6, fontSize: 13 }}>
        <div style={{ fontWeight: 700 }}>Historial de repartos</div>
        {historial.length === 0 && <div style={{ color: 'var(--cp-soft)' }}>Todavía no hay repartos.</div>}
        {historial.map((h) => (
          <button
            key={h.id}
            type="button"
            onClick={() => setSeleccion({ anio: h.anio, mes: h.mes })}
            style={{ display: 'flex', justifyContent: 'space-between', textAlign: 'left', gap: 8 }}
          >
            <span>{MESES[h.mes - 1]} {h.anio}</span>
            <span>{ETIQUETA_ESTADO[h.estado]} · {soles(h.totalPropinas)}{h.motivoAnulacion ? ` · ${h.motivoAnulacion}` : ''}</span>
          </button>
        ))}
      </section>
    </section>
  );
}
