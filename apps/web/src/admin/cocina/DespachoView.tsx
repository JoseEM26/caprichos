import { useState } from 'react';
import type { PedidoDespacho } from './cocinaTipos';
import { Confirmar } from '../../comun/Confirmar';
import { EstadoError } from '../../comun/EstadoError';

export interface DespachoViewProps {
  pedidos: PedidoDespacho[];
  error?: string | null;
  alReintentar?: () => void;
  alMarcarDespachado?: (pedidoId: string) => Promise<void> | void;
}

export function DespachoView({
  pedidos,
  error,
  alReintentar,
  alMarcarDespachado,
}: DespachoViewProps) {
  const [mensajeDespacho, setMensajeDespacho] = useState<string | null>(null);
  const [pedidoParaDespachar, setPedidoParaDespachar] =
    useState<PedidoDespacho | null>(null);

  const formatoModalidad = (p: PedidoDespacho) => {
    const mod = (p.modalidad || '').toUpperCase();
    if (mod === 'MESA' || mod === 'LOCAL') {
      return p.mesa ? `Mesa ${p.mesa}` : 'En mesa';
    }
    if (mod === 'DELIVERY') return 'Delivery';
    if (mod === 'RECOGER' || mod === 'LLEVAR') return 'Para llevar';
    return p.modalidad || 'Para llevar';
  };

  const getTextoEntrega = (p: PedidoDespacho) => {
    const mod = (p.modalidad || '').toUpperCase();
    if (mod === 'DELIVERY') return 'Entregado a reparto';
    if (mod === 'MESA' || mod === 'LOCAL') return 'Entregado al mozo';
    return 'Entregado al cliente';
  };

  const handleImprimir = (p: PedidoDespacho) => {
    const cod = p.ticket || p.codigo;
    setMensajeDespacho(
      `Copia de despacho de ${cod} enviada a la ticketera de caja (simulado).`,
    );
    setTimeout(() => setMensajeDespacho(null), 5000);
  };

  const ejecutarDespacho = async () => {
    if (!pedidoParaDespachar) return;
    if (alMarcarDespachado) {
      await alMarcarDespachado(pedidoParaDespachar.id);
    }
    setMensajeDespacho(
      `Pedido ${
        pedidoParaDespachar.ticket || pedidoParaDespachar.codigo
      } marcado como despachado.`,
    );
    setPedidoParaDespachar(null);
    setTimeout(() => setMensajeDespacho(null), 5000);
  };

  return (
    <section
      aria-label="Vista de despacho"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        fontFamily: 'Montserrat, system-ui, sans-serif',
      }}
    >
      <div style={{ fontSize: '13px', color: 'var(--cp-soft)' }}>
        Despacho: cada pedido completo, de todas las áreas, con el nombre del
        cliente. Así no hay que ir a caja a pedir el voucher.
      </div>

      {mensajeDespacho && (
        <div
          role="status"
          style={{
            fontSize: '13px',
            fontWeight: 700,
            color: '#2F7A45',
            background: 'var(--cp-white)',
            border: '1px solid #2F7A45',
            borderRadius: '10px',
            padding: '8px 12px',
          }}
        >
          {mensajeDespacho}
        </div>
      )}

      {error && <EstadoError mensaje={error} alReintentar={alReintentar} />}

      {pedidos.length === 0 ? (
        <div style={{ color: 'var(--cp-soft)', fontSize: '13px', padding: '8px 0' }}>
          No hay pedidos para despachar.
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: '12px',
            alignItems: 'start',
          }}
        >
          {pedidos.map((p) => {
            const esCompleto =
              p.completo ||
              p.estado === 'LISTO' ||
              (p.areas && p.areas.length > 0 && p.areas.every((a) => a.despejado));

            const colorBorde = esCompleto ? '#2F9E57' : 'var(--cp-line)';
            const estadoTexto = esCompleto
              ? 'Completo: listo para entregar'
              : p.estadoDespacho || 'Pendiente';

            const giveText = getTextoEntrega(p);

            return (
              <div
                key={p.id}
                data-testid={`despacho-${p.codigo}`}
                style={{
                  background: 'var(--cp-white)',
                  border: `2px solid ${colorBorde}`,
                  borderRadius: '12px',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  boxSizing: 'border-box',
                }}
              >
                <div
                  style={{
                    fontFamily: 'Montserrat, sans-serif',
                    fontWeight: 800,
                    fontSize: '17px',
                    color: 'var(--cp-navy)',
                  }}
                >
                  {p.cliente || p.cliente_nombre || 'Cliente'}
                </div>

                <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
                  {p.ticket || p.codigo} · {formatoModalidad(p)}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {(p.areas || []).map((a) => (
                    <div
                      key={a.areaId}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: '8px',
                        fontSize: '13px',
                      }}
                    >
                      <span>
                        <b>{a.areaNombre}</b>
                      </span>
                      <span
                        style={{
                          fontWeight: 800,
                          color: a.despejado ? '#2F7A45' : 'var(--cp-rust)',
                        }}
                      >
                        {a.despejado ? 'Despejado' : 'Falta despejar'}
                      </span>
                    </div>
                  ))}
                </div>

                <div
                  style={{
                    fontWeight: 800,
                    color: esCompleto ? '#2F9E57' : 'var(--cp-rust)',
                    marginTop: '4px',
                  }}
                >
                  {estadoTexto}
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: '6px',
                    flexWrap: 'wrap',
                    marginTop: '4px',
                  }}
                >
                  {esCompleto && (
                    <button
                      type="button"
                      onClick={() => setPedidoParaDespachar(p)}
                      style={{
                        minHeight: '44px',
                        padding: '0 12px',
                        border: 0,
                        borderRadius: '10px',
                        background: 'var(--cp-navy)',
                        color: 'var(--cp-cream)',
                        fontWeight: 800,
                        fontSize: '13px',
                        cursor: 'pointer',
                      }}
                    >
                      {giveText}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleImprimir(p)}
                    style={{
                      minHeight: '44px',
                      padding: '0 12px',
                      border: '1.5px solid var(--cp-navy)',
                      borderRadius: '10px',
                      background: 'transparent',
                      color: 'var(--cp-navy)',
                      fontWeight: 700,
                      fontSize: '13px',
                      cursor: 'pointer',
                    }}
                  >
                    Imprimir copia de despacho
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Confirmar
        abierto={!!pedidoParaDespachar}
        titulo={`¿Marcar ${
          pedidoParaDespachar?.ticket || pedidoParaDespachar?.codigo
        } como despachado?`}
        mensaje="Sale de la vista de despacho."
        textoConfirmar="Sí, despachar"
        textoNo="No, cancelar"
        alConfirmar={ejecutarDespacho}
        alCancelar={() => setPedidoParaDespachar(null)}
      />
    </section>
  );
}
