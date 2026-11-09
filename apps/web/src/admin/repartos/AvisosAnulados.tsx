import { useCallback, useEffect, useRef, useState } from 'react';
import { Icono } from '../../comun/Icono';

export interface AvisoAnulado {
  id: string;
  codigo: string;
}

const ESTADOS_QUE_SALEN = ['ANULADO', 'RECHAZADO'];
/** Tiempo (ms) que se queda un aviso si el repartidor no lo toca. */
export const DURACION_AVISO_ANULADO_MS = 8000;

/**
 * Avisa al repartidor cuando un pedido de su ruta se anula. `alEstado` se engancha al evento 'pedido:estado' que ya
 * emite el servidor (solo id, código y estado, sin datos del cliente) y filtra por los pedidos activos del repartidor.
 * Un pedido avisa una sola vez; los avisos se apilan y cada uno se cierra al tocarlo o a los ~8 s.
 */
export function useAvisosAnulados(idsActivos: string[]) {
  const [avisos, setAvisos] = useState<AvisoAnulado[]>([]);
  const ids = useRef(idsActivos);
  ids.current = idsActivos;
  const vistos = useRef(new Set<string>());
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());

  const cerrar = useCallback((id: string) => setAvisos((a) => a.filter((x) => x.id !== id)), []);

  const alEstado = useCallback(
    (d: { id?: number | string; codigo?: string; estado?: string }) => {
      if (!d || !ESTADOS_QUE_SALEN.includes(String(d.estado))) return;
      const id = String(d.id);
      if (!ids.current.includes(id) || vistos.current.has(id)) return;
      vistos.current.add(id);
      setAvisos((a) => [...a, { id, codigo: d.codigo ?? `#${id}` }]);
      timers.current.add(setTimeout(() => cerrar(id), DURACION_AVISO_ANULADO_MS));
    },
    [cerrar],
  );

  useEffect(() => {
    const t = timers.current;
    return () => t.forEach(clearTimeout);
  }, []);

  return { avisos, cerrar, alEstado };
}

/** Pila de avisos discretos, uno por pedido anulado; ocupan solo su alto, no cubren los botones de abajo. */
export function PilaAvisosAnulados({ avisos, alCerrar }: { avisos: AvisoAnulado[]; alCerrar: (id: string) => void }) {
  if (avisos.length === 0) return null;
  return (
    <div role="status" aria-live="polite" data-testid="avisos-anulados" style={{ display: 'flex', flexDirection: 'column', gap: 6, alignSelf: 'center', maxWidth: 520 }}>
      {avisos.map((a) => (
        <button
          key={a.id}
          type="button"
          data-testid={`aviso-anulado-${a.id}`}
          onClick={() => alCerrar(a.id)}
          aria-label={`Cerrar aviso: el pedido ${a.codigo} fue anulado`}
          style={{
            pointerEvents: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            minHeight: 44,
            padding: '6px 10px 6px 14px',
            borderRadius: 12,
            border: '1px solid #7C2D12',
            background: '#FEF3C7',
            color: '#7C2D12',
            fontSize: 13,
            fontWeight: 700,
            textAlign: 'left',
            cursor: 'pointer',
          }}
        >
          <span style={{ flex: 1 }}>El pedido {a.codigo} fue anulado: salió de tu ruta</span>
          <Icono nombre="cerrar" tamano={16} />
        </button>
      ))}
    </div>
  );
}
