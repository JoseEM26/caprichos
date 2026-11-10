import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ModalConPestanas } from '../../comun/ModalConPestanas';
import { Cargando } from '../../comun/Cargando';
import { EstadoError } from '../../comun/EstadoError';
import { formatearSoles } from '../comprobantes/utilidades';
import { pedidosApi, type LineaPedido, type Pedido } from './pedidosApi';
import { duracionSegLegible, lineaTiempoApi, type EtapaLineaTiempo, type LineaTiempoPedido } from './lineaTiempoApi';
import './detalle-venta.css';

const hora = (iso: string | null | undefined) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Lima' }).format(d);
};

const msj = (e: unknown) => (e instanceof Error && e.message ? e.message : 'No se pudo cargar');

/** Campos que el servidor puede traer además de los tipados (todos opcionales). */
type PedidoExtra = Pedido & {
  comprobante_numero?: string | null;
  comprobante_estado?: string | null;
  cupon_codigo?: string | null;
};

function Dato({ t, children }: { t: string; children: ReactNode }) {
  return <div><dt>{t}</dt><dd>{children}</dd></div>;
}

const opcionesDe = (l: LineaPedido) =>
  [...(l.opcionesElegidas ?? l.opciones ?? []).map((o) => o.opcion_nombre ?? o.nombre),
    ...(l.sabores ?? []).map((s) => `${s.nombre ?? s.sabor_nombre} x${s.cantidad}`)].filter(Boolean).join(', ');

function PestanaVenta({ p }: { p: PedidoExtra }) {
  const descuentos = Array.isArray(p.descuento_detalle)
    ? (p.descuento_detalle as Array<{ nombre?: string; montoDescontado?: number }>) : [];
  const propina = Number(p.propina ?? 0);
  return (
    <>
      <dl className="dv-grid">
        <Dato t="Código">{p.codigo}</Dato>
        <Dato t="Cliente">{p.cliente_nombre || 'Sin nombre'}{p.cliente_telefono ? ` · ${p.cliente_telefono}` : ''}</Dato>
        <Dato t="Modalidad">{p.modalidad}</Dato>
        <Dato t="Canal">{p.canal}</Dato>
        {p.mesa_nombre && <Dato t="Mesa">{p.mesa_nombre}</Dato>}
        {p.modalidad === 'DELIVERY' && p.entrega_direccion && <Dato t="Entrega">{p.entrega_direccion}</Dato>}
        <Dato t="Estado de pago">{p.pago_estado || 'sin dato'}</Dato>
        <Dato t="Comprobante">
          {p.comprobante_tipo || 'Nota de venta'}{p.comprobante_numero ? ` ${p.comprobante_numero}` : ''}{p.comprobante_estado ? ` · ${p.comprobante_estado}` : ''}
        </Dato>
      </dl>
      <h3 className="dv-sec">Productos</h3>
      <ul className="dv-lista">
        {(p.lineas ?? []).length === 0 && <li className="dv-nota">Sin productos</li>}
        {(p.lineas ?? []).map((l) => (
          <li key={l.id} className="dv-fila">
            <span>{l.cantidad} x {l.nombre}{l.tamano ? ` (${l.tamano})` : ''}
              {opcionesDe(l) && <small>{opcionesDe(l)}</small>}
              {l.nota && <small>Nota: {l.nota}</small>}
            </span>
            <span>{formatearSoles(l.subtotal)}</span>
          </li>
        ))}
      </ul>
      <h3 className="dv-sec">Importes</h3>
      <ul className="dv-lista">
        <li className="dv-fila"><span>Subtotal</span><span>{formatearSoles(p.subtotal)}</span></li>
        {descuentos.map((d, i) => (
          <li key={i} className="dv-fila"><span>Descuento: {d.nombre ?? 'promoción'}</span><span>- {formatearSoles(d.montoDescontado)}</span></li>
        ))}
        {descuentos.length === 0 && Number(p.descuento) > 0 && (
          <li className="dv-fila"><span>Descuento{p.cupon_codigo ? ` (cupón ${p.cupon_codigo})` : ''}</span><span>- {formatearSoles(p.descuento)}</span></li>
        )}
        {Number(p.envio) > 0 && <li className="dv-fila"><span>Envío</span><span>{formatearSoles(p.envio)}</span></li>}
        <li className="dv-fila dv-total"><span>Total</span><span>{formatearSoles(p.total)}</span></li>
        <li className="dv-fila"><span>Propina (referencial)</span><span>{formatearSoles(propina)}</span></li>
      </ul>
    </>
  );
}

function PestanaPagos({ p }: { p: PedidoExtra }) {
  const filas = p.planPago?.length ? p.planPago : (p.pago_metodo ? [{ medio: p.pago_metodo, monto: p.total }] : []);
  const cm = p.cobroMozo;
  const cobros = (p.eventos ?? []).filter((e) => e.tipo === 'cobro' || e.tipo === 'anulacion');
  const estado = (p.pago_estado ?? '').toUpperCase();
  const chip = cm ? ['Pagado por mozo · por verificar', 'dv-chip-alerta']
    : estado === 'ANULADO' ? ['Anulado', 'dv-chip-mal']
    : estado === 'PAGADO' ? ['Verificado', 'dv-chip-ok'] : [p.pago_estado || 'Sin pago', ''];
  const efectivo = cm?.recibido ?? (p.paga_con != null ? Number(p.paga_con) : null);
  return (
    <>
      <div><span className={`dv-chip ${chip[1]}`}>{chip[0]}</span></div>
      <h3 className="dv-sec">Medios</h3>
      <ul className="dv-lista">
        {filas.length === 0 && <li className="dv-nota">Sin pagos registrados</li>}
        {filas.map((f, i) => <li key={i} className="dv-fila"><span>{f.medio}</span><span>{formatearSoles(f.monto)}</span></li>)}
      </ul>
      {efectivo != null && (
        <dl className="dv-grid">
          <Dato t="Efectivo recibido">{formatearSoles(efectivo)}</Dato>
          <Dato t="Vuelto">{formatearSoles(cm?.vuelto ?? Math.max(0, efectivo - Number(p.total)))}</Dato>
        </dl>
      )}
      {cm && (
        <dl className="dv-grid">
          <Dato t="Cobró">{cm.mozo || 'Mozo'}{hora(cm.en) ? ` a las ${hora(cm.en)}` : ''}</Dato>
          <Dato t="Voucher">{cm.sinCaptura ? 'Sin captura (confirmado por mozo)' : cm.faltaVoucher ? 'Falta voucher' : 'Adjunto'}</Dato>
        </dl>
      )}
      {cobros.length > 0 && (
        <>
          <h3 className="dv-sec">Movimientos</h3>
          <ul className="dv-lista">
            {cobros.map((e) => (
              <li key={e.id} className="dv-fila">
                <span>{e.titulo}{e.detalle && <small>{e.detalle}</small>}{e.por && <small>Por {e.por}</small>}</span>
                <span>{hora(e.en) ?? ''}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

function Tramos({ etapas }: { etapas: EtapaLineaTiempo[] }) {
  const con = etapas.filter((e) => (e.duracionSeg ?? 0) > 0);
  const suma = con.reduce((a, e) => a + (e.duracionSeg ?? 0), 0);
  if (suma === 0) return null;
  return (
    <div className="dv-barra" role="img" aria-label="Proporción de tiempo por etapa">
      {con.map((e, i) => (
        <div key={i} className={`dv-tramo${e.estimada ? ' dv-tramo-aprox' : ''}`} style={{ width: `${((e.duracionSeg ?? 0) / suma) * 100}%` }}
          title={`${e.etiqueta}${e.area ? ` · ${e.area}` : ''}: ${duracionSegLegible(e.duracionSeg)}`} />
      ))}
    </div>
  );
}

function PestanaTiempos({ lt, error, cargando, reintentar }: {
  lt: LineaTiempoPedido | null; error: boolean; cargando: boolean; reintentar: () => void;
}) {
  if (cargando) return <Cargando />;
  if (error || !lt) {
    return (
      <div role="status">
        <p>Aún no hay línea de tiempo para esta venta</p>
        <button type="button" className="mcp-cerrar" style={{ width: 'auto', padding: '0 14px', fontSize: 14 }} onClick={reintentar}>Reintentar</button>
      </div>
    );
  }
  return (
    <>
      <dl className="dv-grid">
        <Dato t="Tiempo total">{duracionSegLegible(lt.totalSeg)}{!lt.completo && lt.totalSeg != null ? ' (en curso)' : ''}</Dato>
        {lt.atendidoPor && (
          <Dato t={lt.mesa ? 'Atendido por' : `Atendió (${lt.atendidoPor.rol})`}>
            {lt.atendidoPor.nombre}{hora(lt.atendidoPor.en) ? ` a las ${hora(lt.atendidoPor.en)}` : ''}
          </Dato>
        )}
        {lt.mesa && <Dato t="Mesa">{lt.mesa}</Dato>}
      </dl>
      {lt.etapas.length === 0 ? <p className="dv-nota">Sin etapas registradas</p> : (
        <>
          <Tramos etapas={lt.etapas} />
          <ul className="dv-lista">
            {lt.etapas.map((e, i) => (
              <li key={i} className="dv-fila">
                <span>{e.etiqueta}{e.area ? ` · ${e.area}` : ''}
                  <small>{hora(e.desde) ?? 'sin dato'}{e.hasta ? ` → ${hora(e.hasta)}` : ''}</small>
                </span>
                <span>
                  {e.duracionSeg == null ? 'sin dato' : duracionSegLegible(e.duracionSeg)}
                  {e.estimada && <small>≈ aproximado</small>}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

export function DetalleVentaModal({ pedidoId, alCerrar }: { pedidoId: string; alCerrar: () => void }) {
  const [pedido, setPedido] = useState<PedidoExtra | null>(null);
  const [errorPedido, setErrorPedido] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [lt, setLt] = useState<LineaTiempoPedido | null>(null);
  const [errorLt, setErrorLt] = useState(false);
  const [cargandoLt, setCargandoLt] = useState(true);

  const cargarPedido = useCallback(() => {
    setCargando(true); setErrorPedido(null);
    pedidosApi.obtenerPorId(pedidoId).then(setPedido, (e) => setErrorPedido(msj(e))).finally(() => setCargando(false));
  }, [pedidoId]);
  const cargarLt = useCallback(() => {
    setCargandoLt(true); setErrorLt(false);
    lineaTiempoApi.obtener(pedidoId).then(setLt, () => setErrorLt(true)).finally(() => setCargandoLt(false));
  }, [pedidoId]);
  useEffect(() => { cargarPedido(); cargarLt(); }, [cargarPedido, cargarLt]);

  const fallo = !cargando && (errorPedido || !pedido);
  const cuerpo = (nodo: (p: PedidoExtra) => ReactNode): ReactNode =>
    cargando ? <Cargando />
    : fallo ? <EstadoError mensaje={errorPedido ?? 'No se encontró la venta'} alReintentar={cargarPedido} />
    : nodo(pedido as PedidoExtra);

  return (
    <ModalConPestanas
      titulo={`Detalle de venta${pedido ? ` ${pedido.codigo}` : ''}`}
      alCerrar={alCerrar}
      ancho={640}
      pestanas={[
        { id: 'venta', etiqueta: 'Venta', contenido: cuerpo((p) => <PestanaVenta p={p} />) },
        { id: 'pagos', etiqueta: 'Pagos', contenido: cuerpo((p) => <PestanaPagos p={p} />) },
        { id: 'tiempos', etiqueta: 'Tiempos', contenido: <PestanaTiempos lt={lt} error={errorLt} cargando={cargandoLt} reintentar={cargarLt} /> },
      ]}
    />
  );
}
