import { useState, useEffect } from 'react';
import { stockApi } from '../stock/stockApi';
import { InsumoItem } from '../stock/tipos';
import { RecetasTab } from '../stock/RecetasTab';
import '../stock/stock.css';

export function RecetasView() {
  const [insumos, setInsumos] = useState<InsumoItem[]>([]);

  useEffect(() => {
    stockApi
      .listarInsumos()
      .then((ins) => setInsumos(ins))
      .catch((err) => console.error('Error al cargar insumos en RecetasView:', err));
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <RecetasTab insumos={insumos} />
    </div>
  );
}
