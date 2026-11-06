import { clasificarEspera, ConfigReparto } from './calculoRuta';
import { nombreClienteVisible } from './textoVisible';
import type { PanelRepartidores as Panel, PedidoReparto, EtapaReparto } from './repartosApi';

const ETAPA: Record<EtapaReparto, { texto: string; hora: (p: PedidoReparto) => string | null }> = {
  TOMADO: { texto: 'Tomado', hora: (p) => p.tomado_en },
  EN_CAMINO: { texto: 'En camino', hora: (p) => p.salio_en },
  LLEGADO: { texto: 'Llegado', hora: (p) => p.llego_en },
};

const hh = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false }) : '—';

function FilaPedido({
  p,
  etapa,
  config,
  alAbrir,
}: {
  p: PedidoReparto;
  etapa: EtapaReparto | null;
  config: ConfigReparto;
  alAbrir: (id: string) => void;
}) {
  const e = clasificarEspera(p.minutosEspera, config);
  const info = etapa ? ETAPA[etapa] : null;
  return (
    <button
      type="button"
      onClick={() => alAbrir(p.id)}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        minHeight: 48,
        padding: '8px 10px',
        textAlign: 'left',
        cursor: 'pointer',
        borderRadius: 10,
        border: '1px solid rgba(11,44,62,.15)',
        background: 'var(--cp-cream, #FBF4EC)',
        color: 'var(--cp-navy, #0B2C3E)',
      }}
    >
      <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <strong style={{ fontSize: 13 }}>
          {p.codigo} · {nombreClienteVisible(p.cliente_nombre)}
        </strong>
        <span style={{ fontSize: 12, color: 'var(--cp-soft, #5A6E78)' }}>
          {p.zona ?? 'Sin zona'}
          {info ? ` · ${info.texto} ${hh(info.hora(p))}` : ' · Listo sin tomar'}
        </span>
      </span>
      <span
        style={{
          flexShrink: 0,
          fontSize: 12,
          fontWeight: 800,
          padding: '3px 8px',
          borderRadius: 999,
          color: '#fff',
          background: e.colorHex,
        }}
      >
        {p.minutosEspera} min
      </span>
    </button>
  );
}

const tarjeta = {
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 8,
  padding: 14,
  borderRadius: 14,
  background: 'var(--cp-white, #FFFFFF)',
  border: '1.5px solid rgba(11,44,62,.2)',
};

/** Vista «Repartidores» de Caja/Admin: una tarjeta por repartidor (libre u ocupado) y los pedidos sin tomar. */
export function PanelRepartidores({
  panel,
  config,
  alAbrir,
}: {
  panel: Panel;
  config: ConfigReparto;
  alAbrir: (id: string) => void;
}) {
  const { resumen } = panel;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <p style={{ margin: 0, fontWeight: 800, color: 'var(--cp-navy, #0B2C3E)' }} aria-live="polite">
        {resumen.repartidores_libres} repartidores libres · {resumen.repartidores_ocupados} ocupados ·{' '}
        {resumen.pedidos_sin_tomar} pedidos sin tomar
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 14, alignItems: 'start' }}>
        <section style={{ ...tarjeta, borderColor: 'var(--cp-orange, #E67929)' }} aria-label="Sin tomar">
          <h3 style={{ margin: 0, fontSize: 16, color: 'var(--cp-rust, #B2500F)' }}>
            Sin tomar ({panel.sin_tomar.length})
          </h3>
          {panel.sin_tomar.length === 0 ? (
            <span style={{ fontSize: 13, color: 'var(--cp-soft, #5A6E78)' }}>No hay pedidos esperando repartidor.</span>
          ) : (
            [...panel.sin_tomar]
              .sort((a, b) => b.minutosEspera - a.minutosEspera)
              .map((p) => <FilaPedido key={p.id} p={p} etapa={null} config={config} alAbrir={alAbrir} />)
          )}
        </section>
        {panel.repartidores.map((r) => (
          <section key={r.party_id} style={tarjeta} aria-label={`Repartidor ${r.nombre}`}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <h3 style={{ margin: 0, fontSize: 16, color: 'var(--cp-navy, #0B2C3E)' }}>{r.nombre}</h3>
              <span style={{ fontSize: 12, fontWeight: 700 }} title="Pedidos en curso / máximo">
                {r.pedidos.length}/{panel.max_pedidos}
              </span>
            </div>
            <strong
              style={{
                fontSize: 20,
                letterSpacing: 0.5,
                color: r.libre ? '#2E8B57' : 'var(--cp-orange, #E67929)',
              }}
            >
              {r.libre ? 'LIBRE' : `OCUPADO (${r.pedidos.length})`}
            </strong>
            {r.pedidos.map((p) => (
              <FilaPedido key={p.id} p={p} etapa={p.etapa} config={config} alAbrir={alAbrir} />
            ))}
            {r.efectivo_por_rendir > 0 && (
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--cp-rust, #B2500F)' }}>
                Efectivo por rendir: S/ {r.efectivo_por_rendir.toFixed(2)}
              </span>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
