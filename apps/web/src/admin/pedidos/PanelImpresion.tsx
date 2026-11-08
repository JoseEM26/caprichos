import { useState } from 'react';
import { EtiquetasPedido } from './EtiquetasPedido';
import { etiquetaComprobante } from './SelectorComprobante';
import type { Pedido } from './pedidosApi';

type TabImpresion = 'ticket' | 'etiquetas' | 'comprobante';

export interface PanelImpresionProps {
  pedido: Pedido;
  esMesa: boolean;
  esDelivery: boolean;
  /** Sin comprobante que ver: pedido por confirmar, anulado o rechazado. */
  sinComprobante: boolean;
  alCerrar: () => void;
}

/** Ventana de impresión del pedido: ticket de cocina, etiquetas (reimpresión) y comprobante con cupones. */
export function PanelImpresion({ pedido, esMesa, esDelivery, sinComprobante, alCerrar }: PanelImpresionProps) {
  const [tab, setTab] = useState<TabImpresion>('ticket');
  const [msgTicket, setMsgTicket] = useState('');
  const [msgComprobante, setMsgComprobante] = useState('');
  const tipoComp = pedido.comprobante_tipo ? etiquetaComprobante(pedido.comprobante_tipo) : 'Sin elegir';
  const totalNum = Number(pedido.total || 0);
  const tabs: Array<{ id: TabImpresion; label: string }> = [
    { id: 'ticket', label: 'Ticket de cocina' },
    // Siempre visible: un pedido anulado o rechazado puede tener etiquetas VENCIDAS que se ven y reimprimen aqui
    { id: 'etiquetas', label: 'Etiquetas' },
    ...(!sinComprobante ? [{ id: 'comprobante' as const, label: 'Comprobante' }] : []),
  ];

  return (
    <div className="dp-velo" onClick={alCerrar}>
      <div role="dialog" aria-modal="true" aria-label="Impresión del pedido" className="dp-impresion" onClick={(e) => e.stopPropagation()}>
        <div className="dp-impresion-cab">
          <strong style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 18 }}>Impresión de {pedido.codigo}</strong>
          <button type="button" className="dp-ico" aria-label="Cerrar la impresión" onClick={alCerrar}>
            ×
          </button>
        </div>
        <div role="tablist" className="dp-impresion-tabs">
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              type="button"
              className="dp-capa"
              style={{ flex: '0 0 auto', padding: '0 18px', minHeight: 44 }}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div style={{ padding: 16,  overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14, minHeight: 0 }}>
          {tab === 'ticket' && (
            <div className="dp-grid dp-grid-ent">
            <section className="dp-sec" aria-label="Ticket de cocina">
  <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 14 }}>
    Ticket impreso (comanda de cocina, papel de 80 mm)
  </div>
  <div style={{ fontSize: 12, lineHeight: '17px', color: 'var(--cp-soft, #2C4C5D)' }}>
    Impreso en cocina y barra · 1 copia
  </div>
  <div
    style={{
      alignSelf: 'center',
      width: 'min(100%, 300px)',
      boxSizing: 'border-box',
      background: 'var(--cp-white, #FFFFFF)',
      border: '1px solid var(--cp-line, #E3D6C6)',
      boxShadow: '0 4px 12px rgba(11, 44, 62, 0.15)',
      padding: '16px 14px',
      fontFamily: "'Courier New', monospace",
      fontSize: 12,
      lineHeight: '16px',
      color: '#111',
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
    }}
  >
    <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 15, letterSpacing: '0.08em' }}>CAPRICHOS</div>
    <div style={{ textAlign: 'center' }}>Café artesanal · Lima</div>
    <div style={{ textAlign: 'center' }}>------------------------------</div>
    <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 14 }}>COMANDA {pedido.codigo}</div>
    <div style={{ textAlign: 'center', fontWeight: 700 }}>{pedido.modalidad}</div>
    <div>Fecha: {new Date(pedido.creado_en).toLocaleString('es-PE')}</div>
    <div>Canal: {pedido.canal}</div>
    <div>Cliente: {pedido.cliente_nombre || 'Cliente'}</div>
    {esMesa && <div style={{ fontWeight: 700 }}>Mesa: {pedido.mesa_nombre || '1'}</div>}
    {esDelivery && (
      <>
        <div>Dirección: {pedido.entrega_direccion || '—'}</div>
        <div>Ref.: {pedido.entrega_referencia || '—'}</div>
        <div>Tel.: {pedido.cliente_telefono || '—'}</div>
      </>
    )}
    <div style={{ textAlign: 'center' }}>------------------------------</div>
    {(pedido.lineas || []).map((it, idx) => (
      <div key={idx}>
        <span style={{ fontWeight: 700 }}>{it.cantidad} x {it.nombre}</span>
        {(it.opcionesElegidas || it.opciones || []).map((o, oi) => (
          <div key={oi} style={{ paddingLeft: 16 }}>- {o.opcion_nombre || o.nombre}</div>
        ))}
      </div>
    ))}
    {pedido.nota && (
      <>
        <div style={{ textAlign: 'center' }}>------------------------------</div>
        <div style={{ fontWeight: 700 }}>** NOTA: {pedido.nota} **</div>
      </>
    )}
    <div style={{ textAlign: 'center' }}>------------------------------</div>
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span>Pago: {pedido.pago_metodo || 'Pendiente'}</span>
      <span>{pedido.pago_estado}</span>
    </div>
    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 14 }}>
      <span>TOTAL</span>
      <span>S/ {totalNum.toFixed(2)}</span>
    </div>
    <div style={{ textAlign: 'center' }}>------------------------------</div>
    <div style={{ textAlign: 'center' }}>Wi-Fi: Caprichos-Clientes · clave 12345678</div>
    <div style={{ textAlign: 'center' }}>Imprime: Cocina caliente</div>
    <div style={{ textAlign: 'center' }}>Gracias por tu capricho</div>
  </div>
  </section>
  <section className="dp-sec" aria-label="Reimprimir el ticket">
  <div style={{ fontSize: 14, lineHeight: '20px', color: 'var(--cp-soft, #2C4C5D)' }}>
    Las etiquetas adhesivas (general, por área y por bebida) están en la pestaña Etiquetas.
  </div>
  <button
    type="button"
    onClick={() => setMsgTicket('Ticket enviado a la impresora.')}
    style={{
      minHeight: 44,
      border: '1.5px solid var(--cp-navy, #0B2C3E)',
      borderRadius: 12,
      background: 'transparent',
      color: 'var(--cp-navy, #0B2C3E)',
      fontWeight: 800,
      cursor: 'pointer',
    }}
  >
    Reimprimir ticket
  </button>
  {msgTicket && (
    <div role="status" style={{ fontSize: 13, fontWeight: 700, color: 'var(--cp-green, #2F7A45)' }}>
      {msgTicket}
    </div>
  )}
  </section>
            </div>
          )}
          {tab === 'etiquetas' && <EtiquetasPedido pedido={pedido} />}
          {tab === 'comprobante' && (
            <div className="dp-grid dp-grid-ent">
            <section className="dp-sec" aria-label="Vista del comprobante">
            <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 15 }}>
              Comprobante del cliente ({tipoComp})
            </div>
            <div
              style={{
                alignSelf: 'center',
                width: 'min(100%, 300px)',
                boxSizing: 'border-box',
                background: 'var(--cp-white, #FFFFFF)',
                border: '1px solid var(--cp-line, #E3D6C6)',
                boxShadow: '0 4px 12px rgba(11, 44, 62, 0.15)',
                padding: '16px 14px',
                fontFamily: "'Courier New', monospace",
                fontSize: 12,
                lineHeight: '16px',
                color: 'var(--cp-navy, #0B2C3E)',
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}
            >
              <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 15, letterSpacing: '0.08em' }}>CAPRICHOS</div>
              <div style={{ textAlign: 'center' }}>{tipoComp} {pedido.codigo}</div>
              <div style={{ textAlign: 'center' }}>------------------------------</div>
              {(pedido.lineas || []).map((it, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{it.cantidad} x {it.nombre}</span>
                  <span>S/ {Number(it.subtotal || 0).toFixed(2)}</span>
                </div>
              ))}
              <div style={{ textAlign: 'center' }}>------------------------------</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 14 }}>
                <span>TOTAL</span>
                <span>S/ {totalNum.toFixed(2)}</span>
              </div>
              <div style={{ textAlign: 'center' }}>Gracias por tu capricho</div>
              <div style={{ textAlign: 'center', marginTop: 6 }}>- - - - - - cortar aquí - - - - - -</div>
              <div
                style={{
                  border: '2px dashed var(--cp-navy, #0B2C3E)',
                  borderRadius: 8,
                  padding: '8px 10px',
                  marginTop: 6,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 700 }}>✂ 15 % de descuento</span>
                <span style={{ fontSize: 14, fontWeight: 800, lineHeight: '18px' }}>En tu siguiente capricho</span>
                <span style={{ fontSize: 12 }}>Válido 15 días desde la compra</span>
                <span style={{ fontSize: 12, fontWeight: 700 }}>Código: FIDELIDAD-0102</span>
              </div>
            </div>
            </section>
            <section className="dp-sec" aria-label="Imprimir el comprobante">
            <button
              type="button"
              onClick={() => setMsgComprobante('Comprobante enviado a la impresora.')}
              style={{
                minHeight: 44,
                border: '1.5px solid var(--cp-navy, #0B2C3E)',
                borderRadius: 12,
                background: 'transparent',
                color: 'var(--cp-navy, #0B2C3E)',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Imprimir comprobante con cupones
            </button>
            {msgComprobante && (
              <div role="status" style={{ fontSize: 13, fontWeight: 700, color: 'var(--cp-green, #2F7A45)' }}>
                {msgComprobante}
              </div>
            )}
            </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
