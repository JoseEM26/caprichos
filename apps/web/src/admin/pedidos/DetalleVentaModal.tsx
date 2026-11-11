import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ModalConPestanas } from '../../comun/ModalConPestanas';
import { Cargando } from '../../comun/Cargando';
import { EstadoError } from '../../comun/EstadoError';
import { Insignia, type VarianteInsignia } from '../../comun/Insignia';
import { formatearSoles } from '../comprobantes/utilidades';
import { pedidosApi, type LineaPedido, type Pedido } from './pedidosApi';
import { duracionSegLegible, lineaTiempoApi, type EtapaLineaTiempo, type LineaTiempoPedido } from './lineaTiempoApi';
import { SeccionComprobantesPedido } from './SeccionComprobantesPedido';
import { SeccionClientePedido } from './SeccionClientePedido';
import { SeccionVouchersPedido } from './SeccionVouchersPedido';
import './detalle-venta.css';

const hora = (iso: string | null | undefined) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Lima' }).format(d);
};

const msj = (e: unknown) => (e instanceof Error && e.message ? e.message : 'No se pudo cargar');
const legible = (s: string | null | undefined) => {
  const t = String(s ?? '').replace(/_/g, ' ').toLowerCase();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : 'Sin dato';
};

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

function varianteEstado(p: PedidoExtra): VarianteInsignia {
  const e = String(p.estado).toUpperCase();
  return e === 'ANULADO' || e === 'RECHAZADO' ? 'peligro' : e === 'ENTREGADO' ? 'exito' : 'acento';
}

function Cabecera({ p }: { p: PedidoExtra }) {
  const pago = String(p.pago_estado ?? '').toUpperCase();
  return (
    <div className="dv-cab">
      <span className="dv-codigo">{p.codigo}</span>
      <Insignia variante={varianteEstado(p)}>{legible(p.estado)}</Insignia>
      <Insignia variante={pago === 'PAGADO' ? 'exito' : pago === 'ANULADO' ? 'peligro' : 'aviso'}>{pago === 'PAGADO' ? 'Pagado' : pago === 'ANULADO' ? 'Pago anulado' : 'Por cobrar'}</Insignia>
      <span className="dv-total-cab">{formatearSoles(p.total)}</span>
    </div>
  );
}

function PestanaVenta({ p }: { p: PedidoExtra }) {
  const descuentos = Array.isArray(p.descuento_detalle)
    ? (p.descuento_detalle as Array<{ nombre?: string; montoDescontado?: number }>) : [];
  const propina = Number(p.propina ?? 0);
  const extras = p.extras ?? [];
  return (
    <div className="dv-pila">
      <dl className="dv-grid">
        <Dato t="Modalidad">{legible(p.modalidad)}</Dato>
        <Dato t="Canal">{legible(p.canal)}</Dato>
        {p.mesa_nombre && <Dato t="Mesa">{p.mesa_nombre}</Dato>}
        {p.modalidad === 'DELIVERY' && p.entrega_direccion && <Dato t="Entrega">{p.entrega_direccion}</Dato>}
        {p.modalidad === 'DELIVERY' && p.entrega_referencia && <Dato t="Referencia">{p.entrega_referencia}</Dato>}
        {p.modalidad === 'DELIVERY' && p.zona?.nombre && <Dato t="Zona">{p.zona.nombre}</Dato>}
        {p.pedido_origen && <Dato t="Extra de">{p.pedido_origen.codigo}</Dato>}
        {p.atendidoPorNombre && <Dato t="Atendió">{p.atendidoPorNombre}{hora(p.atendidoEn) ? ` · ${hora(p.atendidoEn)}` : ''}</Dato>}
      </dl>
      {p.nota && (
        <section className="dv-bloque"><h3 className="dv-sec">Observaciones</h3><p className="dv-texto">{p.nota}</p></section>
      )}
      <section className="dv-bloque">
        <h3 className="dv-sec">Productos</h3>
        {(p.lineas ?? []).length === 0 ? <p className="dv-nota">Sin productos</p> : (
          <table className="dv-tabla">
            <thead><tr><th scope="col">Producto</th><th scope="col" className="dv-num">Cant.</th><th scope="col" className="dv-num">Subtotal</th></tr></thead>
            <tbody>
              {(p.lineas ?? []).map((l) => (
                <tr key={l.id}>
                  <td>{l.nombre}{l.tamano ? ` (${l.tamano})` : ''}
                    {opcionesDe(l) && <small>{opcionesDe(l)}</small>}
                    {l.nota && <small>Nota: {l.nota}</small>}
                  </td>
                  <td className="dv-num">{l.cantidad}</td>
                  <td className="dv-num">{formatearSoles(l.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <section className="dv-bloque">
        <h3 className="dv-sec">Importes</h3>
        <ul className="dv-lista">
          <li className="dv-fila"><span>Subtotal</span><span className="dv-num">{formatearSoles(p.subtotal)}</span></li>
          {descuentos.map((d, i) => (
            <li key={i} className="dv-fila"><span>Descuento: {d.nombre ?? 'promoción'}</span><span className="dv-num">- {formatearSoles(d.montoDescontado)}</span></li>
          ))}
          {descuentos.length === 0 && Number(p.descuento) > 0 && (
            <li className="dv-fila"><span>Descuento{p.cupon_codigo ? ` (cupón ${p.cupon_codigo})` : ''}</span><span className="dv-num">- {formatearSoles(p.descuento)}</span></li>
          )}
          {Number(p.puntos_canjeados) > 0 && (
            <li className="dv-fila">
              <span>Puntos canjeados: {Number(p.puntos_canjeados)}{p.canjePuntos?.aplicadoPor ? ` · aplicado por ${p.canjePuntos.aplicadoPor}` : ''}</span>
              <span className="dv-num">- {formatearSoles(p.puntos_canjeados)}</span>
            </li>
          )}
          {Number(p.envio) > 0 && <li className="dv-fila"><span>Envío</span><span className="dv-num">{formatearSoles(p.envio)}</span></li>}
          <li className="dv-fila dv-total"><span>Total</span><span className="dv-num">{formatearSoles(p.total)}</span></li>
          <li className="dv-fila"><span>Propina (referencial)</span><span className="dv-num">{formatearSoles(propina)}</span></li>
        </ul>
      </section>
      {extras.length > 0 && (
        <section className="dv-bloque">
          <h3 className="dv-sec">Pedidos extra de esta cuenta</h3>
          <ul className="dv-lista">
            {extras.map((x) => (
              <li key={x.id} className="dv-fila">
                <span>{x.codigo}<small>{legible(x.estado)} · {x.pago_estado === 'PAGADO' ? 'Pagado' : 'Por cobrar'}</small></span>
                <span className="dv-num">{formatearSoles(x.total)}</span>
              </li>
            ))}
            {p.total_con_extras != null && <li className="dv-fila dv-total"><span>Total con extras</span><span className="dv-num">{formatearSoles(p.total_con_extras)}</span></li>}
          </ul>
        </section>
      )}
    </div>
  );
}

function PestanaCliente({ p }: { p: PedidoExtra }) {
  return (
    <div className="dv-pila">
      <section className="dv-bloque">
        <h3 className="dv-sec">Datos del cliente</h3>
        <SeccionClientePedido pedido={p} />
      </section>
      <section className="dv-bloque">
        <h3 className="dv-sec">Comprobantes</h3>
        <SeccionComprobantesPedido pedido={p} />
      </section>
    </div>
  );
}

function PestanaPagos({ p }: { p: PedidoExtra }) {
  const filas = p.planPago?.length ? p.planPago : (p.pago_metodo ? [{ medio: p.pago_metodo, monto: p.total }] : []);
  const cm = p.cobroMozo;
  const cobros = (p.eventos ?? []).filter((e) => e.tipo === 'cobro' || e.tipo === 'anulacion');
  const estado = (p.pago_estado ?? '').toUpperCase();
  const chip: [string, VarianteInsignia] = cm ? ['Pagado por mozo · por verificar', 'aviso']
    : estado === 'ANULADO' ? ['Anulado', 'peligro']
    : estado === 'PAGADO' ? ['Verificado', 'exito'] : [p.pago_estado || 'Sin pago', 'neutro'];
  const efectivo = cm?.recibido ?? (p.paga_con != null ? Number(p.paga_con) : null);
  return (
    <div className="dv-pila">
      <div><Insignia variante={chip[1]}>{chip[0]}</Insignia></div>
      <section className="dv-bloque">
        <h3 className="dv-sec">Medios</h3>
        <ul className="dv-lista">
          {filas.length === 0 && <li className="dv-nota">Sin pagos registrados</li>}
          {filas.map((f, i) => <li key={i} className="dv-fila"><span>{f.medio}</span><span className="dv-num">{formatearSoles(f.monto)}</span></li>)}
        </ul>
        {efectivo != null && (
          <dl className="dv-grid">
            <Dato t="Efectivo recibido">{formatearSoles(efectivo)}</Dato>
            <Dato t="Vuelto">{formatearSoles(cm?.vuelto ?? Math.max(0, efectivo - Number(p.total)))}</Dato>
          </dl>
        )}
        {Number(p.propina ?? 0) > 0 && (
          <dl className="dv-grid"><Dato t="Propina">{formatearSoles(p.propina)}</Dato></dl>
        )}
      </section>
      {(cm || p.cobradoPorNombre) && (
        <section className="dv-bloque">
          <h3 className="dv-sec">Quién cobró</h3>
          <dl className="dv-grid">
            {cm && <Dato t="Cobró el mozo">{cm.mozo || 'Mozo'}{hora(cm.en) ? ` a las ${hora(cm.en)}` : ''}</Dato>}
            {cm && <Dato t="Voucher del mozo">{cm.sinCaptura ? 'Sin captura (confirmado por mozo)' : cm.faltaVoucher ? 'Falta voucher' : 'Adjunto'}</Dato>}
            {p.cobradoPorNombre && <Dato t="Caja">{p.cobradoPorNombre}{hora(p.cobradoEn) ? ` a las ${hora(p.cobradoEn)}` : ''}</Dato>}
          </dl>
        </section>
      )}
      <section className="dv-bloque">
        <h3 className="dv-sec">Vouchers</h3>
        <SeccionVouchersPedido pedidoId={String(p.id)} total={Number(p.total)} medio={p.pago_metodo ?? p.cobroMozo?.medio} compacto />
      </section>
      {cobros.length > 0 && (
        <section className="dv-bloque">
          <h3 className="dv-sec">Movimientos</h3>
          <ul className="dv-lista">
            {cobros.map((e) => (
              <li key={e.id} className="dv-fila">
                <span>{e.titulo}{e.detalle && <small>{e.detalle}</small>}{e.por && <small>Por {e.por}</small>}</span>
                <span>{hora(e.en) ?? ''}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
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
    <div className="dv-pila">
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
    </div>
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
      titulo="Detalle de venta"
      subtitulo={pedido ? <Cabecera p={pedido} /> : undefined}
      alCerrar={alCerrar}
      ancho={680}
      pestanas={[
        { id: 'venta', etiqueta: 'Venta', contenido: cuerpo((p) => <PestanaVenta p={p} />) },
        { id: 'cliente', etiqueta: 'Cliente', contenido: cuerpo((p) => <PestanaCliente p={p} />) },
        { id: 'pagos', etiqueta: 'Pagos', contenido: cuerpo((p) => <PestanaPagos p={p} />) },
        { id: 'tiempos', etiqueta: 'Tiempos', contenido: <PestanaTiempos lt={lt} error={errorLt} cargando={cargandoLt} reintentar={cargarLt} /> },
      ]}
      pie={<button type="button" className="mcp-cerrar dv-cerrar" onClick={alCerrar}>Cerrar</button>}
    />
  );
}
