import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, ErrorApi } from '../../comun/api';
import { Cargando } from '../../comun/Cargando';
import { Insignia } from '../../comun/Insignia';

/** Acumulado de un mes de Lima (GET /admin/propinas/mes). Lo cobrado, menos lo devuelto el día de la devolución. */
interface ResumenMes {
  anio: number;
  mes: number;
  total: number;
  efectivo: number;
  digital: number;
  devuelto: number;
  porDia: Array<{ fecha: string; total: number; efectivo: number; digital: number }>;
  porMedio: Array<{ medio: string; monto: number }>;
  porCanal: Array<{ canal: string; monto: number }>;
}

interface PedidoPendienteCobro {
  id: number;
  codigo: string;
  propina: number;
  total: number;
  canal: string;
  modalidad: string;
  cliente: string | null;
  entregadoEn: string | null;
}

interface ConfigPropina {
  activa: { carta: boolean; bot: boolean };
  tope: number;
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const ETIQUETA_CANAL: Record<string, string> = {
  CARTA: 'Carta virtual',
  WHATSAPP: 'WhatsApp',
  BOT: 'WhatsApp',
  MOZO: 'Mozo',
  CAJA: 'Caja',
};

const ETIQUETA_MEDIO: Record<string, string> = {
  EFECTIVO: 'Efectivo',
  YAPE: 'Yape',
  PLIN: 'Plin',
  TRANSFERENCIA: 'Transferencia',
  TARJETA: 'Tarjeta',
};

/** Mes actual de Lima (año y mes), sin depender de la zona horaria del navegador. */
function mesActualLima(): { anio: number; mes: number } {
  const partes = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit' }).formatToParts(new Date());
  return { anio: Number(partes.find((p) => p.type === 'year')?.value), mes: Number(partes.find((p) => p.type === 'month')?.value) };
}

/** Los últimos 12 meses, del actual hacia atrás. */
function opcionesMeses(actual: { anio: number; mes: number }): Array<{ anio: number; mes: number }> {
  const lista: Array<{ anio: number; mes: number }> = [];
  let { anio, mes } = actual;
  for (let i = 0; i < 12; i++) {
    lista.push({ anio, mes });
    mes -= 1;
    if (mes === 0) {
      mes = 12;
      anio -= 1;
    }
  }
  return lista;
}

const soles = (n: number) => `S/ ${n.toFixed(2)}`;

function Tarjeta({ titulo, valor, detalle }: { titulo: string; valor: number; detalle?: string }) {
  return (
    <div
      style={{
        background: 'var(--cp-white, #FFFFFF)',
        border: '1px solid var(--cp-line, #E3D6C6)',
        borderRadius: 14,
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--cp-soft, #2C4C5D)' }}>{titulo}</div>
      <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 22, color: 'var(--cp-navy, #0B2C3E)' }}>
        {soles(valor)}
      </div>
      {detalle && <div style={{ fontSize: 12, color: 'var(--cp-soft, #2C4C5D)' }}>{detalle}</div>}
    </div>
  );
}

/** Vista admin de propinas: acumulado del mes, por día, medio y canal, y pedidos con propina sin cobro. */
export function PropinasView() {
  const actual = useMemo(() => mesActualLima(), []);
  const meses = useMemo(() => opcionesMeses(actual), [actual]);
  const [seleccion, setSeleccion] = useState<{ anio: number; mes: number }>(actual);
  const [resumen, setResumen] = useState<ResumenMes | null>(null);
  const [pendientes, setPendientes] = useState<PedidoPendienteCobro[]>([]);
  const [config, setConfig] = useState<ConfigPropina | null>(null);
  const [cargando, setCargando] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [r, p, c] = await Promise.all([
        api.get<ResumenMes>(`/admin/propinas/mes?anio=${seleccion.anio}&mes=${seleccion.mes}`),
        api.get<PedidoPendienteCobro[]>('/admin/propinas/pendientes'),
        api.get<ConfigPropina>('/admin/propinas/configuracion'),
      ]);
      setResumen(r);
      setPendientes(p);
      setConfig(c);
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo cargar las propinas');
    } finally {
      setCargando(false);
    }
  }, [seleccion]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const etiquetaMes = `${MESES[seleccion.mes - 1]} ${seleccion.anio}`;
  const esActual = seleccion.anio === actual.anio && seleccion.mes === actual.mes;

  return (
    <div data-testid="propinas-view" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ fontSize: 13, color: 'var(--cp-soft, #2C4C5D)', maxWidth: 640 }}>
          Propinas que dejan los clientes. Van aparte de la venta: no son ingreso ni salen en los comprobantes. Solo cuentan lo
          cobrado; una devolución resta su propina el día en que se devuelve.
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700 }}>
          Mes
          <select
            aria-label="Mes de las propinas"
            value={`${seleccion.anio}-${seleccion.mes}`}
            onChange={(e) => {
              const [anio, mes] = e.target.value.split('-').map(Number);
              setSeleccion({ anio, mes });
            }}
            style={{ minHeight: 36, borderRadius: 8, border: '1px solid var(--cp-line)', padding: '0 8px' }}
          >
            {meses.map((m) => (
              <option key={`${m.anio}-${m.mes}`} value={`${m.anio}-${m.mes}`}>
                {MESES[m.mes - 1]} {m.anio}
              </option>
            ))}
          </select>
        </label>
      </div>

      {config && (
        <div style={{ fontSize: 13, color: 'var(--cp-navy, #0B2C3E)' }}>
          Propina en la carta virtual: <strong>{config.activa.carta ? 'encendida' : 'apagada'}</strong> · en WhatsApp:{' '}
          <strong>{config.activa.bot ? 'encendida' : 'apagada'}</strong> · tope S/ {config.tope.toFixed(2)} por pedido.
        </div>
      )}

      {error && (
        <div role="alert" style={{ fontSize: 13, color: 'var(--cp-red, #b3261e)' }}>
          {error}
        </div>
      )}

      {cargando && !resumen ? (
        <Cargando mensaje="Cargando propinas..." />
      ) : (
        resumen && (
          <>
            <h3 style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 16, color: 'var(--cp-navy)', margin: 0 }}>
              {esActual ? `Acumulado de ${etiquetaMes} (hasta hoy)` : `Acumulado de ${etiquetaMes}`}
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              <Tarjeta titulo="Total del mes" valor={resumen.total} detalle={resumen.devuelto > 0 ? `Devueltas: ${soles(resumen.devuelto)}` : undefined} />
              <Tarjeta titulo="En efectivo" valor={resumen.efectivo} />
              <Tarjeta titulo="Digital (Yape, Plin, transferencia, tarjeta)" valor={resumen.digital} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
              <section aria-label="Propinas por día" style={{ background: 'var(--cp-white)', border: '1px solid var(--cp-line)', borderRadius: 14, padding: 14 }}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>Por día</div>
                {resumen.porDia.length === 0 ? (
                  <div style={{ fontSize: 13, color: 'var(--cp-soft)' }}>Sin propinas en este mes.</div>
                ) : (
                  <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ textAlign: 'right' }}>
                        <th style={{ textAlign: 'left' }}>Día</th>
                        <th>Total</th>
                        <th>Efectivo</th>
                        <th>Digital</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resumen.porDia.map((d) => (
                        <tr key={d.fecha} style={{ textAlign: 'right' }}>
                          <td style={{ textAlign: 'left' }}>{d.fecha}</td>
                          <td>{d.total.toFixed(2)}</td>
                          <td>{d.efectivo.toFixed(2)}</td>
                          <td>{d.digital.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>

              <section aria-label="Propinas por medio y canal" style={{ background: 'var(--cp-white)', border: '1px solid var(--cp-line)', borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>Por medio de pago</div>
                  {resumen.porMedio.map((m) => (
                    <div key={m.medio} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span>{ETIQUETA_MEDIO[m.medio] ?? m.medio}</span>
                      <span>{soles(m.monto)}</span>
                    </div>
                  ))}
                  {resumen.porMedio.length === 0 && <div style={{ fontSize: 13, color: 'var(--cp-soft)' }}>—</div>}
                </div>
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>Por canal</div>
                  {resumen.porCanal.map((c) => (
                    <div key={c.canal} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span>{ETIQUETA_CANAL[c.canal] ?? c.canal}</span>
                      <span>{soles(c.monto)}</span>
                    </div>
                  ))}
                  {resumen.porCanal.length === 0 && <div style={{ fontSize: 13, color: 'var(--cp-soft)' }}>—</div>}
                </div>
              </section>
            </div>
          </>
        )
      )}

      <section
        aria-label="Propinas pendientes de cobro"
        style={{
          background: pendientes.length ? 'var(--cp-cream, #FBF4EC)' : 'var(--cp-white)',
          border: `1px ${pendientes.length ? 'dashed var(--cp-orange, #E07A2E)' : 'solid var(--cp-line)'}`,
          borderRadius: 14,
          padding: 14,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 700 }}>Propinas pendientes de cobro</span>
          <Insignia variante={pendientes.length ? 'aviso' : 'neutro'}>{pendientes.length}</Insignia>
        </div>
        {pendientes.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--cp-soft)' }}>Todos los pedidos entregados con propina ya están cobrados en caja.</div>
        ) : (
          <>
            <div style={{ fontSize: 13, color: 'var(--cp-soft)' }}>
              Son pedidos entregados con propina que aún no tienen cobro en caja. La propina no cuenta hasta que Caja registre el
              cobro del pedido.
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {pendientes.map((p) => (
                <li key={p.id}>
                  <strong>{p.codigo}</strong> · {p.cliente ?? 'Sin nombre'} · propina {soles(p.propina)} sobre {soles(p.total)} ·{' '}
                  {ETIQUETA_CANAL[p.canal] ?? p.canal}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
