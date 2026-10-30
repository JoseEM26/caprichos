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
    } else if (t === 'emitir') {
      setTabActivo('emitir');
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

  const irANotaDeVenta = (pedidoId: string) => {
    setPedidoIdSeleccionado(pedidoId);
    setTabActivo('nota');
    setSearchParams({ tab: 'nota', pedidoId });
  };

  return (
    <div className="comprobantes-contenedor">
      {/* Pestañas de navegación tipo píldora - Sin título duplicado */}
      <div className="comprobantes-tabs no-imprimir" role="tablist" aria-label="Secciones de comprobantes">
        <button
          type="button"
          role="tab"
          aria-selected={tabActivo === 'emitir'}
          className={`comprobantes-tab-btn ${tabActivo === 'emitir' ? 'activo' : ''}`}
          onClick={() => cambiarTab('emitir')}
        >
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
          Por emitir en el facturador
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tabActivo === 'nota'}
          className={`comprobantes-tab-btn ${tabActivo === 'nota' ? 'activo' : ''}`}
          onClick={() => cambiarTab('nota')}
        >
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M6 9V2h12v7" />
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
            <rect x="6" y="14" width="12" height="8" />
          </svg>
          Nota de venta
        </button>
      </div>

      {tabActivo === 'emitir' && <PorEmitirTab alVerNota={irANotaDeVenta} />}

      {tabActivo === 'nota' && (
        <NotaVentaVista
          pedidoIdInicial={pedidoIdSeleccionado}
          alCerrar={() => cambiarTab('emitir')}
        />
      )}
    </div>
  );
}
