import { useEffect, useState } from 'react';
import { stockApi } from './stockApi';

/**
 * Franja que se muestra arriba de Almacén, Stock y Compras cuando el control de insumos está apagado.
 * El interruptor gobierna solo insumos y recetas; el stock de productos con casilla sigue aparte.
 */
export function AvisoControlAlmacen() {
  const [apagado, setApagado] = useState(false);
  const [controlados, setControlados] = useState(0);

  useEffect(() => {
    let vivo = true;
    stockApi
      .estadoControl()
      .then((e) => {
        if (!vivo) return;
        setApagado(!e.activo);
        setControlados(e.productosControlados ?? 0);
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
      <b>Control de insumos apagado.</b> Aquí puedes cargar insumos, compras y proveedores, pero al cobrar un pedido
      no se descuentan insumos por receta y no hay avisos de insumos. El administrador lo enciende en Configuración ›
      Operación.
      {controlados > 0 ? (
        <>
          {' '}
          {controlados === 1
            ? <>El producto con stock propio (donas, galletas) sigue controlándose</>
            : <><b>{controlados}</b> productos con stock propio (donas, galletas) siguen controlándose</>}
          : se descuenta al vender y se agota en 0.
        </>
      ) : null}
    </div>
  );
}
