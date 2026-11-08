import { descuentosDePedido } from '@caprichos/compartido';
import { InsigniaCortesia } from './HistorialAuditoria';
import type { LineaPedido, Pedido } from './pedidosApi';

const soles = (n: unknown) => `S/ ${Number(n || 0).toFixed(2)}`;

/** Solo se puede dar cortesía sobre una línea de producto, sin combo ni oferta, en un pedido sin cobrar ni descuento. */
export function puedeCortesiaLinea(pedido: Pedido, it: LineaPedido): boolean {
  return (
    !it.es_cortesia &&
    !!it.producto_id &&
    !it.linea_combo_id &&
    !it.oferta_id &&
    pedido.pago_estado !== 'PAGADO' &&
    pedido.estado !== 'ANULADO' &&
    pedido.estado !== 'RECHAZADO' &&
    Number(pedido.descuento || 0) === 0
  );
}

/** «2× Chocolate, 1× Fresa»; con un solo sabor, solo su nombre. */
function textoSabores(it: LineaPedido): string {
  const lista = (it.sabores ?? []).map((s) => ({ nombre: s.nombre || s.sabor_nombre || '', cantidad: s.cantidad })).filter((s) => s.nombre);
  if (lista.length === 0) return it.sabor ? String(it.sabor) : '';
  if (lista.length === 1) return lista[0].nombre;
  return lista.map((s) => `${s.cantidad}× ${s.nombre}`).join(', ');
}

export interface CapaProductosProps {
  pedido: Pedido;
  puedeDarCortesia: boolean;
  alCortesia: (linea: LineaPedido) => void;
  alAbrirPedido?: (id: string) => void;
}

/** Capa 1: cada línea como tarjeta grande y, al lado (PC) o debajo (celular), el resumen con el total. */
export function CapaProductos({ pedido, puedeDarCortesia, alCortesia, alAbrirPedido }: CapaProductosProps) {
  const estaPagado = String(pedido.pago_estado || '').toUpperCase() === 'PAGADO';
  const lineas = pedido.lineas ?? [];
  const descuentos = descuentosDePedido(pedido);
  const extras = pedido.extras ?? [];
  return (
    <div className="dp-grid dp-grid-2">
      <section className="dp-col" aria-label="Productos del pedido">
        <h3 className="dp-sec-titulo">Productos ({lineas.length})</h3>
        {lineas.length === 0 && <div style={{ fontSize: 14, color: 'var(--cp-soft, #2C4C5D)' }}>Sin líneas detalladas.</div>}
        {lineas.map((it, idx) => {
          const opciones = it.opcionesElegidas || it.opciones || [];
          const sabores = textoSabores(it);
          return (
            <div key={it.id ?? idx} className="dp-linea" data-testid="linea-pedido">
              <div className="dp-linea-cant">{it.cantidad}×</div>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div className="dp-linea-nombre">{it.nombre}</div>
                {(it.tamano || opciones.length > 0 || it.es_cortesia) && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {it.tamano && <span className="dp-opc dp-opc-tam">{it.tamano}</span>}
                    {opciones.map((o, oi) => (
                      <span key={oi} className="dp-opc">
                        + {o.opcion_nombre || o.nombre}
                      </span>
                    ))}
                  </div>
                )}
                {sabores && <div className="dp-linea-sabores">Sabores: {sabores}</div>}
                {it.nombres_persona && it.nombres_persona.length > 0 && (
                  <div style={{ fontSize: 14, color: 'var(--cp-soft, #2C4C5D)' }}>Para: {it.nombres_persona.join(', ')}</div>
                )}
                {it.nota && <div className="dp-nota">Nota: {it.nota}</div>}
              </div>
              <div className="dp-linea-precio">
                <span>{soles(it.subtotal)}</span>
                {it.cantidad > 1 && !it.es_cortesia && <span className="dp-linea-unit">{soles(it.precio_unit)} c/u</span>}
                {it.es_cortesia && <InsigniaCortesia cortesia={it.cortesia} />}
                {puedeCortesiaLinea(pedido, it) && puedeDarCortesia && (
                  <button type="button" className="dp-btn" onClick={() => alCortesia(it)} style={{ minHeight: 44, fontSize: 13 }}>
                    Dar como cortesía
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </section>

      <div className="dp-col">
        <section className="dp-sec" aria-label="Resumen del pedido">
          <h3 className="dp-sec-titulo">Resumen y cobro</h3>
          <div className="dp-fila">
            <span>Estado del pago</span>
            <strong>{estaPagado ? 'Pagado' : 'Pendiente'}</strong>
          </div>
          <div className="dp-fila">
            <span>Medio de pago</span>
            <strong>{pedido.pago_metodo || pedido.pago_preferido || 'Efectivo'}</strong>
          </div>
          {pedido.puntos?.texto && (
            <div className="dp-fila">
              <span>Puntos</span>
              <strong>
                {pedido.puntos.estado === 'SUMADO'
                  ? `+${(pedido.puntos.puntos ?? 0).toFixed(2)}`
                  : pedido.puntos.estado === 'PENDIENTE_DE_COBRO'
                    ? `Se sumarán ${(pedido.puntos.estimado ?? 0).toFixed(2)}`
                    : `No suma: ${pedido.puntos.texto}`}
              </strong>
            </div>
          )}
          <div className="dp-fila">
            <span>Subtotal</span>
            <strong>{soles(pedido.subtotal)}</strong>
          </div>
          {descuentos.map((d, i) => (
            <div className="dp-fila" key={i}>
              <span>{d.nombre === 'Descuento' || d.tipo === 'PUNTOS' ? d.nombre : `Descuento · ${d.nombre}`}</span>
              <strong style={{ color: 'var(--cp-green, #2F7A45)' }}>- {soles(d.monto)}</strong>
            </div>
          ))}
          {Number(pedido.envio || 0) > 0 && (
            <div className="dp-fila">
              <span>Envío</span>
              <strong>{soles(pedido.envio)}</strong>
            </div>
          )}
          {Number(pedido.propina || 0) > 0 && (
            <div className="dp-fila">
              <span>Propina</span>
              <strong>{soles(pedido.propina)}</strong>
            </div>
          )}
          <div className="dp-fila dp-fila-total">
            <span>Total</span>
            <span className="dp-total-grande">{soles(pedido.total)}</span>
          </div>
        </section>

        {extras.length > 0 && (
          <section data-testid="lista-extras" className="dp-sec" aria-label="Extras del pedido" style={{ background: '#FFF9EC' }}>
            <h3 className="dp-sec-titulo">Extras</h3>
            {extras.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => alAbrirPedido?.(e.id)}
                style={{ display: 'flex', justifyContent: 'space-between', gap: 8, border: 0, background: 'transparent', padding: 0, minHeight: 44, alignItems: 'center', fontSize: 15, cursor: 'pointer', textAlign: 'left' }}
              >
                <span style={{ fontWeight: 700 }}>{e.codigo} · {e.estado}{e.pago_estado ? ` · ${e.pago_estado}` : ''}</span>
                <span style={{ fontWeight: 800 }}>{soles(e.total)}</span>
              </button>
            ))}
            {pedido.total_con_extras != null && (
              <div data-testid="total-con-extras" className="dp-fila dp-fila-total" style={{ fontWeight: 800 }}>
                <span>Total con extras</span>
                <span>{soles(pedido.total_con_extras)}</span>
              </div>
            )}
          </section>
        )}

        {pedido.nota && <div className="dp-nota-pedido">Nota para cocina: {pedido.nota}</div>}
      </div>
    </div>
  );
}
