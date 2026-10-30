import { useEffect, useState } from 'react';
import { stockApi } from './stockApi';

/** Franja que se muestra arriba de Almacén, Stock y Compras cuando el control de almacén está apagado. */
export function AvisoControlAlmacen() {
  const [apagado, setApagado] = useState(false);

  useEffect(() => {
    let vivo = true;
    stockApi
      .estadoControl()
      .then((e) => {
        if (vivo) setApagado(!e.activo);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  if (!apagado) return null;
  return (
    <div
      role="status"
      data-testid="aviso-control-almacen"
      style={{
        background: 'var(--cp-cream)',
        border: '1.5px dashed var(--cp-orange)',
        borderRadius: 12,
        padding: '10px 14px',
        fontSize: 13,
        lineHeight: '19px',
        color: 'var(--cp-navy)',
      }}
    >
      <b>Control de almacén apagado.</b> Aquí puedes cargar insumos, stock, compras y proveedores, pero al cobrar un
      pedido no se descuenta stock, no se agotan productos solos y no hay avisos de insumos. El administrador lo
      enciende en Configuración › Operación.
    </div>
  );
}
