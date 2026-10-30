import { useState, useEffect } from 'react';
import { AvisoControlAlmacen } from './AvisoControlAlmacen';
import { useSearchParams } from 'react-router-dom';
import { InsumosTab } from './InsumosTab';
import { ProduccionAlmacenTab } from './ProduccionAlmacenTab';
import { RecetasTab } from './RecetasTab';
import { stockApi } from './stockApi';
import { LugarStockItem, InsumoItem } from './tipos';
import './stock.css';

export function StockView() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') || 'insumos';

  const normalizarTab = (param: string | null): 'insumos' | 'produccion' | 'recetas' => {
    if (param === 'produccion' || param === 'existencias' || param === 'movimientos' || param === 'ops') {
      return 'produccion';
    }
    if (param === 'recetas' || param === 'rec') {
      return 'recetas';
    }
    return 'insumos';
  };

  const [tabActivo, setTabActivo] = useState<'insumos' | 'produccion' | 'recetas'>(
    normalizarTab(tabParam),
  );

  const [lugares, setLugares] = useState<LugarStockItem[]>([]);
  const [insumos, setInsumos] = useState<InsumoItem[]>([]);

  const cargarDatos = () => {
    stockApi
      .listarLugares()
      .then((lugs) => setLugares(lugs))
      .catch((err) => console.error('Error al cargar lugares de stock:', err));

    stockApi
      .listarInsumos()
      .then((ins) => setInsumos(ins))
      .catch((err) => console.error('Error al cargar insumos:', err));
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  useEffect(() => {
    const t = searchParams.get('tab');
    setTabActivo(normalizarTab(t));
  }, [searchParams]);

  const cambiarTab = (tab: 'insumos' | 'produccion' | 'recetas') => {
    setTabActivo(tab);
    setSearchParams({ tab });
  };

  // Cantidad de insumos agotados o por acabarse para la insignia naranja (idéntico al mockup)
  const insumosBajos = insumos.filter(
    (i) => i.semaforo === 'rojo' || i.stock_total <= i.minimo || (i.intermedio != null && i.stock_total <= i.intermedio),
  ).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <AvisoControlAlmacen />
      {/* Exactamente 3 pestañas de Stock y recetas idénticas al mockup */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }} role="tablist" aria-label="Stock y recetas">
        {/* Pestaña 1: Insumos */}
        <button
          type="button"
          role="tab"
          aria-selected={tabActivo === 'insumos'}
          onClick={() => cambiarTab('insumos')}
          style={{
            minHeight: '48px',
            padding: '0 18px',
            borderRadius: '12px',
            border: '1.5px solid var(--cp-navy)',
            background: tabActivo === 'insumos' ? 'var(--cp-navy)' : 'transparent',
            color: tabActivo === 'insumos' ? 'var(--cp-cream)' : 'var(--cp-navy)',
            fontFamily: 'Montserrat, sans-serif',
            fontWeight: 800,
            fontSize: '14px',
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
            cursor: 'pointer',
          }}
        >
          <span>Insumos</span>
          {insumosBajos > 0 && (
            <span
              style={{
                minWidth: '22px',
                height: '22px',
                boxSizing: 'border-box',
                padding: '0 6px',
                borderRadius: '11px',
                background: 'var(--cp-orange)',
                color: 'var(--cp-navy)',
                fontSize: '12px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {insumosBajos}
            </span>
          )}
        </button>

        {/* Pestaña 2: Producción y almacén */}
        <button
          type="button"
          role="tab"
          aria-selected={tabActivo === 'produccion'}
          onClick={() => cambiarTab('produccion')}
          style={{
            minHeight: '48px',
            padding: '0 18px',
            borderRadius: '12px',
            border: '1.5px solid var(--cp-navy)',
            background: tabActivo === 'produccion' ? 'var(--cp-navy)' : 'transparent',
            color: tabActivo === 'produccion' ? 'var(--cp-cream)' : 'var(--cp-navy)',
            fontFamily: 'Montserrat, sans-serif',
            fontWeight: 800,
            fontSize: '14px',
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
            cursor: 'pointer',
          }}
        >
          <span>Producción y almacén</span>
        </button>

        {/* Pestaña 3: Recetas */}
        <button
          type="button"
          role="tab"
          aria-selected={tabActivo === 'recetas'}
          onClick={() => cambiarTab('recetas')}
          style={{
            minHeight: '48px',
            padding: '0 18px',
            borderRadius: '12px',
            border: '1.5px solid var(--cp-navy)',
            background: tabActivo === 'recetas' ? 'var(--cp-navy)' : 'transparent',
            color: tabActivo === 'recetas' ? 'var(--cp-cream)' : 'var(--cp-navy)',
            fontFamily: 'Montserrat, sans-serif',
            fontWeight: 800,
            fontSize: '14px',
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
            cursor: 'pointer',
          }}
        >
          <span>Recetas</span>
        </button>
      </div>

      {/* Contenido de la pestaña activa */}
      {tabActivo === 'insumos' && <InsumosTab lugares={lugares} />}
      {tabActivo === 'produccion' && (
        <ProduccionAlmacenTab insumos={insumos} lugares={lugares} onActualizar={cargarDatos} />
      )}
      {tabActivo === 'recetas' && <RecetasTab insumos={insumos} />}
    </div>
  );
}
