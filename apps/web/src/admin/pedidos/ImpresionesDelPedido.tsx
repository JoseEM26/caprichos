import { useState } from 'react';
import { Cargando } from '../../comun/Cargando';
import { historialImpresionApi, type FilaHistorialImpresion } from '../impresion/historialImpresionApi';
import { FilaImpresion } from '../impresion/FilaImpresion';

/** Bloque plegable «Impresiones de este pedido». Pide los datos solo al abrirlo. */
export function ImpresionesDelPedido({ pedidoId }: { pedidoId: string }) {
  const [filas, setFilas] = useState<FilaHistorialImpresion[] | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = () => {
    setCargando(true);
    setError(null);
    Promise.resolve()
      .then(() => historialImpresionApi.deUnPedido(pedidoId))
      .then((r) => setFilas(r.datos))
      .catch((e) => setError(e instanceof Error && e.message ? e.message : 'No se pudieron cargar las impresiones.'))
      .finally(() => setCargando(false));
  };

  return (
    <details
      className="dp-sec"
      onToggle={(e) => {
        if ((e.currentTarget as HTMLDetailsElement).open && filas === null && !cargando) cargar();
      }}
    >
      <summary style={{ minHeight: 44, display: 'flex', alignItems: 'center', cursor: 'pointer', fontWeight: 800, fontSize: 14 }}>
        Impresiones de este pedido{filas ? ` (${filas.length})` : ''}
      </summary>
      <div style={{ paddingTop: 8 }}>
        {cargando && <Cargando />}
        {error && (
          <div role="alert" style={{ fontSize: 13, fontWeight: 700, color: 'var(--cp-rust)', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {error}
            <button type="button" onClick={cargar} style={{ minHeight: 36, padding: '0 12px', borderRadius: 8, border: '1.5px solid var(--cp-rust)', background: 'transparent', color: 'var(--cp-rust)', fontWeight: 800, cursor: 'pointer' }}>
              Reintentar
            </button>
          </div>
        )}
        {filas && filas.length === 0 && <div style={{ fontSize: 13, color: 'var(--cp-soft)' }}>Este pedido todavía no tiene impresiones.</div>}
        {filas && filas.length > 0 && (
          <ul style={{ margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {filas.map((f) => (
              <FilaImpresion key={f.id} fila={f} mostrarPedido={false} alTerminar={cargar} />
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}
