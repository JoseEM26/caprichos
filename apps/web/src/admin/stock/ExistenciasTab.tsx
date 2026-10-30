import { useState, useEffect, useCallback } from 'react';
import { ExistenciasMatriz } from './tipos';
import { stockApi } from './stockApi';
import { Cargando } from '../../comun/Cargando';
import { EstadoError } from '../../comun/EstadoError';
import { formatearUnidad, qty1 } from './formato';

export function ExistenciasTab() {
  const [matriz, setMatriz] = useState<ExistenciasMatriz | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargarExistencias = useCallback(async () => {
    try {
      setError(null);
      const datos = await stockApi.obtenerExistencias();
      setMatriz(datos);
    } catch (err: any) {
      setError(err.message || 'Error al cargar existencias');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarExistencias();
  }, [cargarExistencias]);

  if (cargando) {
    return <Cargando mensaje="Cargando existencias por lugar..." />;
  }

  if (error || !matriz) {
    return <EstadoError mensaje={error || 'No se pudieron cargar las existencias'} alReintentar={cargarExistencias} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ fontSize: '13px', color: 'var(--cp-soft)' }}>
        Existencias reales por lugar físico. El almacén central abastece a las áreas de preparación (Cocina, Barra) mediante traslados.
      </div>

      {/* Alertas si hay insumos en negativo o bajo el mínimo */}
      {matriz.alertas.length > 0 && (
        <div
          role="alert"
          style={{
            background: '#fbe9df',
            border: '1.5px solid var(--cp-rust)',
            borderRadius: '12px',
            padding: '12px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          <div style={{ fontWeight: 800, color: 'var(--cp-rust)', fontSize: '14px' }}>
            Alertas de stock ({matriz.alertas.length})
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {matriz.alertas.slice(0, 8).map((al, idx) => (
              <span
                key={idx}
                style={{
                  background: 'var(--cp-white)',
                  border: '1px solid var(--cp-rust)',
                  color: 'var(--cp-rust)',
                  borderRadius: '9999px',
                  padding: '2px 10px',
                  fontSize: '12px',
                  fontWeight: 700,
                }}
              >
                {al.nombre} ({al.lugarNombre}): {al.saldo} ({al.tipo})
              </span>
            ))}
            {matriz.alertas.length > 8 && (
              <span style={{ fontSize: '12px', color: 'var(--cp-rust)', alignSelf: 'center' }}>
                +{matriz.alertas.length - 8} más...
              </span>
            )}
          </div>
        </div>
      )}

      {/* Tabla de existencias */}
      <div className="tabla-tactil-envoltura">
        <table className="tabla-tactil">
          <thead>
            <tr>
              <th style={{ minWidth: '180px' }}>Insumo</th>
              <th style={{ width: '80px' }}>Unidad</th>
              {matriz.lugares.map((lug) => (
                <th key={lug.id} style={{ textAlign: 'right', minWidth: '100px' }}>
                  {lug.nombre}
                </th>
              ))}
              <th style={{ textAlign: 'right', minWidth: '100px', background: 'var(--cp-line)' }}>
                Total
              </th>
              <th style={{ textAlign: 'center', width: '100px' }}>Mínimo</th>
            </tr>
          </thead>
          <tbody>
            {matriz.insumos.map((ins) => {
              const estaBajoMinimo = ins.total <= ins.minimo;
              const tieneNegativo = Object.values(ins.existencias).some((v) => v < 0);

              return (
                <tr key={ins.id} style={{ borderBottom: '1px solid var(--cp-line)' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--cp-navy)' }}>
                    {ins.nombre}
                    {ins.lugarConsumoNombre && (
                      <span style={{ display: 'block', fontSize: '11px', color: 'var(--cp-soft)', fontWeight: 500 }}>
                        Área de consumo: {ins.lugarConsumoNombre}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: '13px', color: 'var(--cp-soft)' }}>
                    {formatearUnidad(ins.unidadAlmacen)}
                  </td>
                  {matriz.lugares.map((lug) => {
                    const cant = ins.existencias[lug.id] || 0;
                    const esNegativo = cant < 0;
                    return (
                      <td
                        key={lug.id}
                        style={{
                          padding: '10px 14px',
                          textAlign: 'right',
                          fontWeight: esNegativo ? 800 : 600,
                          color: esNegativo ? 'var(--cp-rust)' : cant === 0 ? 'var(--cp-soft)' : 'inherit',
                          background: esNegativo ? '#fbe9df' : 'transparent',
                        }}
                      >
                        {qty1(cant)}
                      </td>
                    );
                  })}
                  <td
                    style={{
                      padding: '10px 14px',
                      textAlign: 'right',
                      fontWeight: 800,
                      background: estaBajoMinimo ? '#fbe9df' : tieneNegativo ? '#fef3e2' : 'var(--cp-line)',
                      color: estaBajoMinimo ? 'var(--cp-rust)' : 'var(--cp-navy)',
                    }}
                  >
                    {qty1(ins.total)}
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'center', fontSize: '12px', color: 'var(--cp-soft)' }}>
                    {ins.minimo}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
