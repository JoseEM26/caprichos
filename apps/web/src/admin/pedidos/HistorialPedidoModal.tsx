import { useCallback, useEffect, useState } from 'react';
import { api } from '../../comun/api';
import { Cargando } from '../../comun/Cargando';
import { EstadoError } from '../../comun/EstadoError';
import { Insignia, type VarianteInsignia } from '../../comun/Insignia';
import { ModalConPestanas } from '../../comun/ModalConPestanas';

export interface EventoHistorial {
  id: string;
  fuente: 'auditoria' | 'estado' | 'cobro';
  titulo: string;
  motivo: string | null;
  en: string;
  por: string | null;
  antes: unknown;
  despues: unknown;
}
export interface HistorialPedido { pedidoId: string; eventos: EventoHistorial[]; truncado: boolean }

const fmt = new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
const VARIANTE: Record<EventoHistorial['fuente'], VarianteInsignia> = { estado: 'neutro', cobro: 'exito', auditoria: 'acento' };
const ROTULO: Record<EventoHistorial['fuente'], string> = { estado: 'Estado', cobro: 'Cobro', auditoria: 'Cambio' };

export function HistorialPedidoModal({ pedidoId, codigo, alCerrar }: { pedidoId: string; codigo?: string; alCerrar: () => void }) {
  const [datos, setDatos] = useState<HistorialPedido | null>(null);
  const [error, setError] = useState(false);
  const [cargando, setCargando] = useState(true);
  const cargar = useCallback(() => {
    setCargando(true); setError(false);
    api.get<HistorialPedido>(`/admin/pedidos/${pedidoId}/historial-caja`).then(setDatos, () => setError(true)).finally(() => setCargando(false));
  }, [pedidoId]);
  useEffect(() => { cargar(); }, [cargar]);

  const cuerpo = cargando ? <Cargando />
    : error || !datos ? <EstadoError mensaje="No se pudo cargar el historial del pedido" alReintentar={cargar} />
    : datos.eventos.length === 0 ? <p>Este pedido aún no tiene acciones registradas.</p>
    : (
      <ol data-testid="historial-pedido" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {datos.eventos.map((e) => (
          <li key={e.id} style={{ borderLeft: '3px solid var(--cp-line)', paddingLeft: 12 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <Insignia variante={VARIANTE[e.fuente]}>{ROTULO[e.fuente]}</Insignia>
              <strong>{e.titulo}</strong>
            </div>
            <div style={{ fontSize: 13 }}>{e.por ?? 'Sistema'} · {fmt.format(new Date(e.en))}</div>
            {e.motivo && <div style={{ fontSize: 13 }}>Motivo: {e.motivo}</div>}
            {(e.antes != null || e.despues != null) && (
              <details style={{ fontSize: 12 }}>
                <summary>Ver detalle</summary>
                <div><b>Antes:</b> <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>{e.antes == null ? '—' : JSON.stringify(e.antes, null, 1)}</pre></div>
                <div><b>Después:</b> <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>{e.despues == null ? '—' : JSON.stringify(e.despues, null, 1)}</pre></div>
              </details>
            )}
          </li>
        ))}
        {datos.truncado && <li style={{ fontSize: 12 }}>Se muestran solo las primeras acciones registradas.</li>}
      </ol>
    );

  return (
    <ModalConPestanas
      titulo="Historial del pedido"
      subtitulo={codigo}
      alCerrar={alCerrar}
      ancho={560}
      pestanas={[{ id: 'historial', etiqueta: 'Línea de tiempo', contenido: cuerpo }]}
      pie={<button type="button" className="mcp-cerrar" onClick={alCerrar}>Cerrar</button>}
    />
  );
}
