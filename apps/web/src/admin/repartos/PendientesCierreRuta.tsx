import type { CSSProperties } from 'react';

export interface PendienteCierre {
  id: string;
  codigo: string;
}

const boton: CSSProperties = {
  minHeight: 44,
  padding: '0 12px',
  borderRadius: 10,
  border: '1px solid var(--cp-navy, #0B2C3E)',
  background: 'var(--cp-white, #fff)',
  color: 'var(--cp-navy, #0B2C3E)',
  fontWeight: 800,
  fontSize: 13,
  cursor: 'pointer',
};

/**
 * «Cerrar ruta» sin orden: solo estorban los pedidos EN_CAMINO sin resolver. Los lista y, según quien mire,
 * ofrece resolver cada uno (Entregado, No se pudo entregar, Devolver al local) o solo verlo (Caja/Admin).
 * Sin pendientes ofrece cerrar con un toque.
 */
export function PendientesCierreRuta({
  pendientes,
  alEntregado,
  alNoSePudo,
  alDevolver,
  alVer,
  alCerrar,
  alDescartar,
}: {
  pendientes: PendienteCierre[];
  alEntregado?: (id: string) => void;
  alNoSePudo?: (id: string) => void;
  alDevolver?: (id: string) => void;
  alVer?: (id: string) => void;
  alCerrar: () => void;
  alDescartar: () => void;
}) {
  return (
    <div
      role="alert"
      data-testid="pendientes-cierre"
      style={{ pointerEvents: 'auto', alignSelf: 'center', maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 8, padding: 12, borderRadius: 12, background: '#FEF3C7', border: '1px solid #7C2D12', color: '#7C2D12', fontWeight: 700, fontSize: 14 }}
    >
      {pendientes.length === 0 ? (
        <>
          <span>Ya no te falta resolver nada: puedes cerrar la ruta.</span>
          <button type="button" data-testid="btn-confirmar-cerrar-ruta" onClick={alCerrar} style={{ ...boton, background: 'var(--cp-orange, #E67929)', color: '#fff', border: 'none' }}>
            Cerrar ruta
          </button>
        </>
      ) : (
        <>
          <span>Te falta resolver: {pendientes.map((p) => `${p.codigo} (en camino)`).join(', ')}</span>
          {pendientes.map((p) => (
            <div key={p.id} data-testid={`pendiente-${p.id}`} style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
              <strong>{p.codigo}</strong>
              {alEntregado && <button type="button" style={boton} onClick={() => alEntregado(p.id)}>Entregado</button>}
              {alNoSePudo && <button type="button" style={boton} onClick={() => alNoSePudo(p.id)}>No se pudo entregar</button>}
              {alDevolver && <button type="button" style={boton} onClick={() => alDevolver(p.id)}>Devolver al local</button>}
              {alVer && <button type="button" style={boton} onClick={() => alVer(p.id)}>Ver pedido</button>}
            </div>
          ))}
        </>
      )}
      <button type="button" style={{ ...boton, alignSelf: 'flex-start', border: 'none', background: 'transparent', textDecoration: 'underline' }} onClick={alDescartar}>
        Seguir sin cerrar
      </button>
    </div>
  );
}
