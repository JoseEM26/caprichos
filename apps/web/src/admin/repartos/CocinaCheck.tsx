import type { AreaCocinaReparto } from './repartosApi';

/** Lo mínimo del pedido que necesita el check «Cocina» (lo trae el API de repartos). */
export interface PedidoConAreas {
  id?: string;
  codigo?: string;
  estado: string;
  areas?: AreaCocinaReparto[];
  areasListas?: number;
  areasTotal?: number;
  completo?: boolean;
}

const VERDE = '#2F7A45';
const AMBAR = '#D99E39';
const NAVY = '#0B2C3E';
const ARENA = '#E9DFD0';

const chip = { fontSize: 12, fontWeight: 800, padding: '2px 8px', borderRadius: 999, whiteSpace: 'nowrap' } as const;

/**
 * Check informativo de las áreas de cocina de un pedido de delivery: icono + texto siempre (no solo color).
 * No se muestra una vez que el pedido salió (EN_CAMINO/ENTREGADO).
 */
export function CocinaCheck({ pedido }: { pedido: PedidoConAreas }) {
  if (pedido.estado === 'EN_CAMINO' || pedido.estado === 'ENTREGADO' || !pedido.areas) return null;
  const { areas } = pedido;
  const testid = pedido.id ? `cocina-check-${pedido.id}` : 'cocina-check';

  if (areas.length === 0) {
    return (
      <div data-testid={testid} style={{ fontSize: 12, fontWeight: 700, color: 'var(--cp-soft, #5A6E78)' }}>
        Cocina: aún no entra a cocina
      </div>
    );
  }

  const unica = areas.length === 1;
  const nombreDe = (a: AreaCocinaReparto) => (unica && !a.areaNombre ? 'Cocina' : a.areaNombre || 'Área');
  const listas = pedido.areasListas ?? areas.filter((a) => a.listo).length;
  const total = pedido.areasTotal ?? areas.length;
  const faltan = areas.filter((a) => !a.listo).map(nombreDe);
  const completo = pedido.completo ?? faltan.length === 0;
  const estadoDe = (a: AreaCocinaReparto) => (a.despachada ? 'ya salió' : a.listo ? 'lista' : 'falta');
  const aria = `Cocina: ${areas.map((a) => `${nombreDe(a)} ${estadoDe(a)}`).join(', ')}`;
  const resumen = `${listas} de ${total} ${total === 1 ? 'área lista' : 'áreas listas'}`;

  return (
    <div data-testid={testid} role="group" aria-label={aria} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: NAVY }}>Cocina</span>
        {areas.map((a) =>
          a.despachada ? (
            <span key={a.areaId} style={{ ...chip, background: ARENA, color: NAVY }}>
              {nombreDe(a)} · Ya salió
            </span>
          ) : a.listo ? (
            <span key={a.areaId} style={{ ...chip, background: VERDE, color: '#fff' }}>
              ✓ {nombreDe(a)}
            </span>
          ) : (
            <span key={a.areaId} style={{ ...chip, background: AMBAR, color: NAVY }}>
              ⏳ {nombreDe(a)}
            </span>
          ),
        )}
        <span style={{ fontSize: 12, color: 'var(--cp-soft, #5A6E78)', fontWeight: 600 }}>{resumen}</span>
      </div>
      <div
        style={{
          ...chip,
          whiteSpace: 'normal',
          borderRadius: 8,
          padding: '4px 8px',
          background: completo ? VERDE : AMBAR,
          color: completo ? '#fff' : NAVY,
        }}
      >
        {completo ? 'Todo listo: puedes recoger' : `Falta: ${faltan.join(', ')}`}
      </div>
    </div>
  );
}
