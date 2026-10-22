import type { PedidoDespacho } from './cocinaTipos';
import { EstadoVacio } from '../../comun/EstadoVacio';
import { EstadoError } from '../../comun/EstadoError';

export interface DespachoViewProps {
  pedidos: PedidoDespacho[];
  error?: string | null;
  alReintentar?: () => void;
}

export function DespachoView({
  pedidos,
  error,
  alReintentar,
}: DespachoViewProps) {
  const formatoModalidad = (p: PedidoDespacho) => {
    const mod = (p.modalidad || '').toUpperCase();
    if (mod === 'MESA') {
      return p.mesa ? `Mesa ${p.mesa}` : 'En mesa';
    }
    if (mod === 'DELIVERY') return 'Delivery';
    if (mod === 'RECOGER') return 'Para recoger';
    return mod;
  };

  return (
    <section
      aria-label="Vista de despacho"
      style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
    >
      <div style={{ fontSize: '13px', color: 'var(--cp-soft)' }}>
        Despacho: cada pedido completo, de todas las áreas, con el nombre del
        cliente. Así no hay que ir a caja a pedir el voucher.
      </div>

      {error && <EstadoError mensaje={error} alReintentar={alReintentar} />}

      {pedidos.length === 0 ? (
        <EstadoVacio
          titulo="Sin pedidos por despachar"
          mensaje="No hay pedidos pendientes en cocina ni despacho en este momento."
        />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '12px',
            alignItems: 'start',
            width: '100%',
          }}
        >
          {pedidos.map((p) => {
            const esCompleto = p.completo || p.estado === 'LISTO';
            const colorBorde = esCompleto ? 'var(--cp-green)' : 'var(--cp-line)';
            const colorEstado = esCompleto ? 'var(--cp-green)' : 'var(--cp-rust)';

            return (
              <div
                key={p.id}
                data-testid={`despacho-${p.codigo}`}
                style={{
                  background: 'var(--cp-white)',
                  border: `2px solid ${colorBorde}`,
                  borderRadius: '14px',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  boxShadow: '0 2px 8px rgba(11, 44, 62, 0.05)',
                }}
              >
                {/* Nombre del cliente (solo el nombre, DT-81) */}
                <div
                  style={{
                    fontFamily: 'var(--fuente-titulos)',
                    fontWeight: 800,
                    fontSize: '17px',
                    color: 'var(--cp-navy)',
                  }}
                >
                  {p.cliente || p.cliente_nombre || 'Cliente sin nombre'}
                </div>

                {/* Código y modalidad */}
                <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
                  <b>{p.ticket || p.codigo}</b> · {formatoModalidad(p)}
                  {p.canal ? ` · Canal ${p.canal}` : ''}
                </div>

                {/* Desglose por áreas */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    margin: '4px 0',
                    borderTop: '1px solid var(--cp-line)',
                    borderBottom: '1px solid var(--cp-line)',
                    padding: '8px 0',
                  }}
                >
                  {p.areas.map((a) => (
                    <div
                      key={a.areaId}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '13px',
                      }}
                    >
                      <span style={{ fontWeight: 700, color: 'var(--cp-navy)' }}>
                        {a.areaNombre}
                      </span>
                      <span
                        style={{
                          fontWeight: 800,
                          fontSize: '12px',
                          color: a.despejado ? 'var(--cp-green)' : 'var(--cp-rust)',
                          background: a.despejado ? '#E6F4EA' : '#FFF0E6',
                          borderRadius: '9999px',
                          padding: '2px 8px',
                        }}
                      >
                        {a.despejado ? 'Despejado' : 'Falta despejar'}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Estado global de despacho */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontWeight: 800,
                    fontSize: '14px',
                    color: colorEstado,
                  }}
                >
                  <span>Estado:</span>
                  <span>{esCompleto ? 'Completo' : 'Pendiente'}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
