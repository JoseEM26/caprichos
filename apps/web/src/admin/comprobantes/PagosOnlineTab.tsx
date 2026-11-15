import { useCallback, useEffect, useState } from 'react';
import { Link, useInRouterContext } from 'react-router-dom';
import { IconoMedioPago } from '../../comun/IconoMedioPago';
import { medioDelPagoCulqi } from '../pedidos/RecuadroPagoCulqi';
import { useSesion } from '../../comun/sesion';
import { Cargando } from '../../comun/Cargando';
import { EstadoVacio } from '../../comun/EstadoVacio';
import { EstadoError } from '../../comun/EstadoError';
import { Confirmar } from '../../comun/Confirmar';
import { Paginacion } from '../../comun/Paginacion';
import { Boton } from '../../comun/Boton';
import { Insignia } from '../../comun/Insignia';
import { ErrorApi } from '../../comun/api';
import { culqiApi, type MedioDevolucion, type PagoOnline } from '../../carta/pagos/culqiApi';

const POR_PAGINA = 20;
const NOMBRE_MEDIO: Record<string, string> = { YAPE: 'Yape', PLIN: 'Plin', TRANSFERENCIA: 'Transferencia', EFECTIVO: 'efectivo' };
/** Medios (no Culqi) con los que se devolvió el pago: ese dinero sigue en la cuenta de Culqi. */
const porFuera = (p: PagoOnline) => [...new Set((p.devoluciones ?? []).map((d) => String(d.medio).toUpperCase()).filter((m) => m !== 'CULQI'))];
const saldo = (p: PagoOnline) => Math.max(0, Number(p.monto) - Number(p.montoDevuelto ?? 0));
const fecha = (iso: string) =>
  new Date(iso).toLocaleString('es-PE', { timeZone: 'America/Lima', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const copiar = (t: string) => void navigator.clipboard?.writeText(t).catch(() => undefined);

/** «Ver pedido»: abre el pedido en Caja (enlace del router; fuera de él, un enlace normal). */
function VerPedido({ pedidoId, codigo }: { pedidoId?: string; codigo: string }) {
  const enRouter = useInRouterContext();
  if (!pedidoId) return null;
  const href = `/admin/caja?pedido=${pedidoId}`;
  const props = { 'aria-label': `Ver pedido ${codigo}`, style: { minHeight: 44, display: 'inline-flex', alignItems: 'center', fontWeight: 700 } as const };
  return enRouter ? <Link to={href} {...props}>Ver pedido</Link> : <a href={href} {...props}>Ver pedido</a>;
}

/** Pagos en línea (Culqi). La devolución es solo del ADMIN. */
export function PagosOnlineTab() {
  const { usuario } = useSesion();
  const esAdmin = usuario?.rol?.toUpperCase() === 'ADMIN';
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [estado, setEstado] = useState('');
  const [pagina, setPagina] = useState(1);
  const [datos, setDatos] = useState<{ items: PagoOnline[]; total: number; totalAprobado?: number; totalDevuelto?: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aDevolver, setADevolver] = useState<PagoOnline | null>(null);
  const [motivo, setMotivo] = useState('');
  const [errDevolver, setErrDevolver] = useState<string | null>(null);
  const [devolviendo, setDevolviendo] = useState(false);
  const [montoTxt, setMontoTxt] = useState('');
  const [medioDev, setMedioDev] = useState<MedioDevolucion>('CULQI');

  const cargar = useCallback(() => {
    setError(null);
    setDatos(null);
    culqiApi
      .listar({ desde, hasta, estado, pagina })
      .then(setDatos)
      .catch((e) => setError(e instanceof Error ? e.message : 'No se pudo cargar la lista.'));
  }, [desde, hasta, estado, pagina]);
  useEffect(cargar, [cargar]);

  const cambiar = (fn: () => void) => {
    fn();
    setPagina(1);
  };

  const devolver = async () => {
    if (!aDevolver || devolviendo) return;
    setDevolviendo(true);
    setErrDevolver(null);
    try {
      const monto = montoTxt.trim() ? Number(montoTxt) : undefined;
      await culqiApi.devolver(aDevolver.id, {
        motivo: motivo.trim(),
        medio: medioDev,
        ...(monto !== undefined ? { monto } : {}),
        confirmar: true, // tras el Sí del ADMIN
      });
      setADevolver(null);
      setMotivo('');
      setMontoTxt('');
      setMedioDev('CULQI');
      cargar();
    } catch (e) {
      setErrDevolver(e instanceof ErrorApi ? e.message : 'No se pudo devolver. Intenta de nuevo.');
    } finally {
      setDevolviendo(false);
    }
  };

  return (
    <section aria-label="Pagos en línea">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <label>Desde <input type="date" value={desde} onChange={(e) => cambiar(() => setDesde(e.target.value))} style={{ minHeight: 44 }} /></label>
        <label>Hasta <input type="date" value={hasta} onChange={(e) => cambiar(() => setHasta(e.target.value))} style={{ minHeight: 44 }} /></label>
        <label>
          Estado{' '}
          <select value={estado} onChange={(e) => cambiar(() => setEstado(e.target.value))} style={{ minHeight: 44 }}>
            <option value="">Todos</option>
            <option value="APROBADO">Aprobado</option>
            <option value="RECHAZADO">Rechazado</option>
            <option value="PENDIENTE">Pendiente</option>
            <option value="DEVUELTO">Devuelto</option>
          </select>
        </label>
      </div>

      {datos && datos.items.length > 0 && datos.totalAprobado !== undefined && (
        <p data-testid="total-pagos-online" style={{ margin: '0 0 12px', fontWeight: 700 }}>
          Total cobrado por Culqi: S/ {datos.totalAprobado.toFixed(2)}
          {(datos.totalDevuelto ?? 0) > 0 ? ` · devuelto S/ ${(datos.totalDevuelto ?? 0).toFixed(2)}` : ''}
        </p>
      )}
      {error ? (
        <EstadoError mensaje={error} alReintentar={cargar} />
      ) : !datos ? (
        <Cargando />
      ) : datos.items.length === 0 ? (
        <EstadoVacio titulo="Sin pagos en línea" descripcion="No hay pagos con esos filtros." />
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Hora', 'Pedido', 'Medio', 'Monto', 'N.º de operación', 'Estado', ''].map((h) => (
                  <th key={h} scope="col" style={{ textAlign: 'left', padding: 8 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {datos.items.map((p) => (
                <tr key={p.id} style={{ borderTop: '1px solid var(--cp-line)' }}>
                  <td style={{ padding: 8 }}>{fecha(p.aprobadoEn ?? p.creadoEn)}</td>
                  <td style={{ padding: 8 }}>#{p.pedidoCodigo}</td>
                  <td style={{ padding: 8 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <IconoMedioPago medio={p.medio ?? 'PAGO_EN_LINEA'} tamano={18} ariaHidden />
                      {medioDelPagoCulqi({ medio: p.medio ?? null, marca: p.marca ?? null, ultimos4: p.ultimos4 ?? null })}
                    </span>
                  </td>
                  <td style={{ padding: 8 }}>S/ {Number(p.monto).toFixed(2)}</td>
                  <td style={{ padding: 8 }}>
                    {p.culqiId ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <code style={{ fontSize: 12, wordBreak: 'break-all' }}>{p.culqiId}</code>
                        <Boton variante="secundario" tamano="pequeno" onClick={() => copiar(p.culqiId!)} aria-label={`Copiar operación ${p.culqiId}`}>Copiar</Boton>
                      </span>
                    ) : '—'}
                  </td>
                  <td style={{ padding: 8 }}>
                    {p.cobroPendiente && (
                      <div data-testid="cobro-pendiente" style={{ color: 'var(--cp-rust)', fontSize: 12, fontWeight: 700 }}>
                        Cobrado en Culqi, falta registrar en Caja
                      </div>
                    )}
                    {(p.montoDevuelto ?? 0) > 0 && (
                      <div style={{ fontSize: 12 }}>Devuelto S/ {Number(p.montoDevuelto).toFixed(2)} de S/ {Number(p.monto).toFixed(2)}</div>
                    )}
                    {porFuera(p).length > 0 && (
                      <div data-testid="devuelto-por-fuera" style={{ fontSize: 12 }}>
                        Devuelto por fuera ({porFuera(p).map((m) => NOMBRE_MEDIO[m] ?? m).join(', ')} del local): el dinero sigue en Culqi
                      </div>
                    )}
                    <Insignia variante={p.devuelto ? 'neutro' : p.estado === 'APROBADO' ? 'exito' : p.estado === 'RECHAZADO' ? 'peligro' : 'aviso'}>
                      {p.devuelto ? (porFuera(p).length > 0 ? 'Devuelto por fuera' : 'Devuelto') : p.estado}
                    </Insignia>
                  </td>
                  <td style={{ padding: 8 }}>
                    <VerPedido pedidoId={p.pedidoId} codigo={p.pedidoCodigo} />
                    {esAdmin && p.estado === 'APROBADO' && saldo(p) > 0 && (
                      <Boton variante="peligro" tamano="pequeno" onClick={() => { setADevolver(p); setMotivo(''); setMontoTxt(''); setMedioDev('CULQI'); setErrDevolver(null); }}>
                        Devolver
                      </Boton>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {datos && <Paginacion pagina={pagina} totalPaginas={Math.max(1, Math.ceil(datos.total / POR_PAGINA))} alCambiarPagina={setPagina} totalRegistros={datos.total} tamanoPagina={POR_PAGINA} />}

      <Confirmar
        abierto={!!aDevolver}
        titulo="Devolver el pago"
        mensaje={aDevolver ? `¿Devolver dinero del pedido #${aDevolver.pedidoCodigo}? Falta devolver S/ ${saldo(aDevolver).toFixed(2)}.` : ''}
        textoSi="Sí, devolver"
        textoNo="No"
        peligro
        focoInicialNo
        cargando={devolviendo}
        deshabilitarConfirmar={motivo.trim().length < 3 || (montoTxt.trim() !== '' && !(Number(montoTxt) > 0 && aDevolver != null && Number(montoTxt) <= saldo(aDevolver)))}
        error={errDevolver}
        alConfirmar={devolver}
        alCancelar={() => setADevolver(null)}
      >
        <label style={{ display: 'block', marginTop: 8 }}>
          Monto a devolver (S/, opcional)
          <input type="number" inputMode="decimal" min="0" step="0.01" value={montoTxt} onChange={(e) => setMontoTxt(e.target.value)} placeholder={aDevolver ? `Todo lo pendiente: ${saldo(aDevolver).toFixed(2)}` : ''} style={{ width: '100%', minHeight: 44 }} />
        </label>
        <label style={{ display: 'block', marginTop: 8 }}>
          Medio de devolución
          <select value={medioDev} onChange={(e) => setMedioDev(e.target.value as MedioDevolucion)} style={{ width: '100%', minHeight: 44 }}>
            <option value="CULQI">Por Culqi</option>
            <option value="EFECTIVO">Efectivo</option>
            <option value="YAPE">Yape</option>
            <option value="PLIN">Plin</option>
            <option value="TRANSFERENCIA">Transferencia</option>
          </select>
        </label>
        {medioDev !== 'CULQI' && (
          <p style={{ fontSize: 12, margin: '4px 0 0' }}>Con este medio solo se registra lo que ya devolviste a mano; el sistema no mueve dinero.</p>
        )}
        <label style={{ display: 'block', marginTop: 8 }}>
          Motivo (obligatorio)
          <input value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={200} style={{ width: '100%', minHeight: 44 }} />
        </label>
      </Confirmar>
    </section>
  );
}
