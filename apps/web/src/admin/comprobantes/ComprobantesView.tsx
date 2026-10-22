import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PorEmitirTab } from './PorEmitirTab';
import { NotaVentaVista } from './NotaVentaVista';
import './comprobantes.css';

/**
 * Función exportada para que el integrador de Pedidos y caja (u otros módulos)
 * pueda invocar la apertura de la Nota de Venta sin modificar archivos externos.
 */
export function abrirNotaDeVenta(pedidoId: string): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('caprichos:abrirNotaVenta', {
        detail: { pedidoId: String(pedidoId) },
      }),
    );
  }
}

export function ComprobantesView() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') === 'nota' ? 'nota' : 'emitir';
  const pedidoIdParam = searchParams.get('pedidoId') || '';

  const [tabActivo, setTabActivo] = useState<'emitir' | 'nota'>(tabParam);
  const [pedidoIdSeleccionado, setPedidoIdSeleccionado] = useState(pedidoIdParam);

  // Escuchar eventos globales disparados por abrirNotaDeVenta
  useEffect(() => {
    const handleAbrirNota = (event: Event) => {
      const customEvent = event as CustomEvent<{ pedidoId: string }>;
      if (customEvent.detail?.pedidoId) {
        setPedidoIdSeleccionado(customEvent.detail.pedidoId);
        setTabActivo('nota');
        setSearchParams({ tab: 'nota', pedidoId: customEvent.detail.pedidoId });
      }
    };

    window.addEventListener('caprichos:abrirNotaVenta', handleAbrirNota);
    return () => {
      window.removeEventListener('caprichos:abrirNotaVenta', handleAbrirNota);
    };
  }, [setSearchParams]);

  // Sincronizar cambios en searchParams de la URL
  useEffect(() => {
    const t = searchParams.get('tab');
    const p = searchParams.get('pedidoId');
    if (t === 'nota') {
      setTabActivo('nota');
    }
    if (p) {
      setPedidoIdSeleccionado(p);
    }
  }, [searchParams]);

  const cambiarTab = (tab: 'emitir' | 'nota') => {
    setTabActivo(tab);
    if (tab === 'nota' && pedidoIdSeleccionado) {
      setSearchParams({ tab: 'nota', pedidoId: pedidoIdSeleccionado });
    } else if (tab === 'nota') {
      setSearchParams({ tab: 'nota' });
    } else {
      setSearchParams({});
    }
  };

  return (
    <div className="comprobantes-contenedor">
      <div className="no-imprimir" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <h1 style={{ fontSize: '24px', color: 'var(--cp-navy)' }}>
          Gestión de Comprobantes
        </h1>
        <p style={{ margin: 0, color: 'var(--cp-soft)', fontSize: '14px' }}>
          Emisión correlativa interna (NV01), cola para facturador externo y reimpresión de comprobantes.
        </p>
      </div>

      <div className="comprobantes-tabs no-imprimir">
        <button
          type="button"
          className={`comprobantes-tab-btn ${tabActivo === 'emitir' ? 'activo' : ''}`}
          onClick={() => cambiarTab('emitir')}
        >
          Por emitir (SUNAT / Facturador)
        </button>
        <button
          type="button"
          className={`comprobantes-tab-btn ${tabActivo === 'nota' ? 'activo' : ''}`}
          onClick={() => cambiarTab('nota')}
        >
          Nota de venta (NV01)
        </button>
      </div>

      {tabActivo === 'emitir' && <PorEmitirTab />}

      {tabActivo === 'nota' && (
        <NotaVentaVista
          pedidoIdInicial={pedidoIdSeleccionado}
          alCerrar={() => cambiarTab('emitir')}
        />
      )}
    </div>
  );
}
