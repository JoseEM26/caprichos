import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PorEmitirTab } from './PorEmitirTab';
import { NotaVentaVista } from './NotaVentaVista';
import { ElectronicosTab } from './ElectronicosTab';
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

type TabComprobantes = 'electronicos' | 'emitir' | 'nota';
const TABS: TabComprobantes[] = ['electronicos', 'emitir', 'nota'];

const DESCRIPCION_TAB: Record<TabComprobantes, string> = {
  electronicos:
    'Boletas y facturas enviadas a SUNAT: aquí eliges el proveedor, ves si cada comprobante fue aceptado, reintentas los rechazados, anulas, descargas el XML y envías el resumen diario de boletas.',
  emitir:
    'Pedidos cobrados cuya boleta o factura se emite a mano en otro facturador: copia los datos del cliente y márcala como emitida. Con SUNAT directo esta lista queda vacía.',
  nota:
    'Busca un pedido cobrado por su ID para ver, imprimir o reimprimir su nota de venta en ticket de 80 mm (la reimpresión sale marcada como COPIA).',
};

export function ComprobantesView() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam: TabComprobantes = TABS.includes(searchParams.get('tab') as TabComprobantes)
    ? (searchParams.get('tab') as TabComprobantes)
    : 'emitir';
  const pedidoIdParam = searchParams.get('pedidoId') || '';

  const [tabActivo, setTabActivo] = useState<TabComprobantes>(tabParam);
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
    if (t && TABS.includes(t as TabComprobantes)) {
      setTabActivo(t as TabComprobantes);
    }
    if (p) {
      setPedidoIdSeleccionado(p);
    }
  }, [searchParams]);

  const cambiarTab = (tab: TabComprobantes) => {
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
          aria-selected={tabActivo === 'electronicos'}
          className={`comprobantes-tab-btn ${tabActivo === 'electronicos' ? 'activo' : ''}`}
          onClick={() => cambiarTab('electronicos')}
        >
          Electrónicos SUNAT
        </button>
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

      <p className="no-imprimir" data-testid="descripcion-comprobantes" style={{ margin: '0 0 12px', color: 'var(--cp-soft)', fontSize: 13 }}>
        {DESCRIPCION_TAB[tabActivo]}
      </p>

      {tabActivo === 'electronicos' && <ElectronicosTab />}

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
