import type { CSSProperties } from 'react';
import { presentacionDeMedio } from '@caprichos/compartido';

/** Etiquetita de la insignia configurada para el medio (Configuración › Pagos); nada si no tiene. */
export function InsigniaMedio({ presentacion, medio }: { presentacion: unknown; medio: string }) {
  const { insignia } = presentacionDeMedio(presentacion, medio);
  if (!insignia) return null;
  return (
    <span data-testid="insignia-medio" style={{ padding: '1px 6px', borderRadius: 999, background: 'var(--cp-orange)', color: '#fff', fontSize: 10, fontWeight: 800, lineHeight: '14px' }}>
      {insignia}
    </span>
  );
}

/** «Grande» en caja y mozo solo resalta (borde y fondo suave): no cambia el tamaño del botón. */
export function resaltoMedio(presentacion: unknown, medio: string, activo: boolean): CSSProperties {
  if (activo || presentacionDeMedio(presentacion, medio).tamano !== 'grande') return {};
  return { border: '2px solid var(--cp-orange)', background: 'var(--cp-sand)' };
}
