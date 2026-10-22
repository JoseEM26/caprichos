import { useState, useEffect, useCallback } from 'react';
import { useSesion } from '../../comun/sesion';
import { EstadoError } from '../../comun/EstadoError';
import { ArqueoCiegoForm } from './ArqueoCiegoForm';
import { LiquidacionRepartidores } from './LiquidacionRepartidores';
import { HistorialCierres } from './HistorialCierres';
import { cierreApi, MontosEsperados } from './cierreApi';

type TabCierre = 'arqueo' | 'liquidacion' | 'historial';

export function CierreView() {
  const { tiene, usuario } = useSesion();
  const puedeVer = tiene('caja/ver') || tiene('caja/cerrar');
  const esAdmin = usuario?.rol === 'ADMIN';

  const [tabActiva, setTabActiva] = useState<TabCierre>('arqueo');
  const [esperado, setEsperado] = useState<MontosEsperados | null>(null);
  const [cargandoEsperado, setCargandoEsperado] = useState(false);

  const cargarEsperado = useCallback(async () => {
    if (!esAdmin) return;
    setCargandoEsperado(true);
    try {
      const res = await cierreApi.obtenerEsperado();
      setEsperado(res);
    } catch {
      setEsperado(null);
    } finally {
      setCargandoEsperado(false);
    }
  }, [esAdmin]);

  useEffect(() => {
    if (tabActiva === 'arqueo' && esAdmin) {
      cargarEsperado();
    }
  }, [tabActiva, esAdmin, cargarEsperado]);

  if (!puedeVer) {
    return (
      <div style={{ padding: '24px' }}>
        <EstadoError mensaje="No tienes permiso para ver el módulo de caja y cierres." />
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        maxWidth: '960px',
        margin: '0 auto',
        padding: '12px 16px 40px 16px',
        boxSizing: 'border-box',
        width: '100%',
      }}
    >
      {/* Cabecera */}
      <div>
        <h1
          style={{
            fontFamily: 'Montserrat, sans-serif',
            fontWeight: 800,
            fontSize: '22px',
            color: 'var(--cp-navy)',
            margin: 0,
          }}
        >
          Caja y cierres
        </h1>
        <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--cp-soft)' }}>
          Arqueo ciego por denominación, liquidación de repartos e historial inmutable
        </p>
      </div>

      {/* Selector de pestañas táctiles */}
      <div
        role="tablist"
        style={{
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap',
        }}
      >
        <button
          role="tab"
          aria-selected={tabActiva === 'arqueo'}
          onClick={() => setTabActiva('arqueo')}
          style={{
            minHeight: '44px',
            padding: '0 16px',
            borderRadius: '9999px',
            border: '1.5px solid var(--cp-navy)',
            background: tabActiva === 'arqueo' ? 'var(--cp-navy)' : 'var(--cp-white)',
            color: tabActiva === 'arqueo' ? 'var(--cp-cream)' : 'var(--cp-navy)',
            fontWeight: 800,
            fontSize: '14px',
            cursor: 'pointer',
          }}
        >
          Turno actual y Arqueo
        </button>

        <button
          role="tab"
          aria-selected={tabActiva === 'liquidacion'}
          onClick={() => setTabActiva('liquidacion')}
          style={{
            minHeight: '44px',
            padding: '0 16px',
            borderRadius: '9999px',
            border: '1.5px solid var(--cp-navy)',
            background: tabActiva === 'liquidacion' ? 'var(--cp-navy)' : 'var(--cp-white)',
            color: tabActiva === 'liquidacion' ? 'var(--cp-cream)' : 'var(--cp-navy)',
            fontWeight: 800,
            fontSize: '14px',
            cursor: 'pointer',
          }}
        >
          Liquidación de repartidores
        </button>

        <button
          role="tab"
          aria-selected={tabActiva === 'historial'}
          onClick={() => setTabActiva('historial')}
          style={{
            minHeight: '44px',
            padding: '0 16px',
            borderRadius: '9999px',
            border: '1.5px solid var(--cp-navy)',
            background: tabActiva === 'historial' ? 'var(--cp-navy)' : 'var(--cp-white)',
            color: tabActiva === 'historial' ? 'var(--cp-cream)' : 'var(--cp-navy)',
            fontWeight: 800,
            fontSize: '14px',
            cursor: 'pointer',
          }}
        >
          Historial de cierres
        </button>
      </div>

      {/* Contenido según pestaña */}
      {tabActiva === 'arqueo' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Resumen esperado: SOLO PARA ADMIN */}
          {esAdmin ? (
            <div
              data-testid="seccion-esperado-admin"
              style={{
                background: 'var(--cp-cream)',
                border: '1.5px solid var(--cp-gold)',
                borderRadius: '14px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span
                  style={{
                    fontFamily: 'Montserrat, sans-serif',
                    fontWeight: 800,
                    fontSize: '16px',
                    color: 'var(--cp-navy)',
                  }}
                >
                  Resumen esperado del sistema (visible solo para ADMIN)
                </span>
                <button
                  type="button"
                  onClick={cargarEsperado}
                  disabled={cargandoEsperado}
                  style={{
                    minHeight: '36px',
                    padding: '0 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--cp-navy)',
                    background: 'transparent',
                    color: 'var(--cp-navy)',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Recargar esperado
                </button>
              </div>

              {esperado ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                      gap: '8px',
                    }}
                  >
                    <div style={{ background: 'var(--cp-white)', padding: '10px', borderRadius: '10px' }}>
                      <div style={{ fontSize: '11px', color: 'var(--cp-soft)', fontWeight: 700 }}>APERTURA</div>
                      <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--cp-navy)' }}>
                        S/ {esperado.apertura.toFixed(2)}
                      </div>
                    </div>

                    <div style={{ background: 'var(--cp-white)', padding: '10px', borderRadius: '10px' }}>
                      <div style={{ fontSize: '11px', color: 'var(--cp-soft)', fontWeight: 700 }}>+ VENTAS EFECTIVO</div>
                      <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--cp-navy)' }}>
                        S/ {esperado.desglose.ventasEfectivo.toFixed(2)}
                      </div>
                    </div>

                    <div style={{ background: 'var(--cp-white)', padding: '10px', borderRadius: '10px' }}>
                      <div style={{ fontSize: '11px', color: 'var(--cp-soft)', fontWeight: 700 }}>+ INGRESOS</div>
                      <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--cp-green)' }}>
                        S/ {esperado.desglose.ingresos.toFixed(2)}
                      </div>
                    </div>

                    <div style={{ background: 'var(--cp-white)', padding: '10px', borderRadius: '10px' }}>
                      <div style={{ fontSize: '11px', color: 'var(--cp-soft)', fontWeight: 700 }}>− EGRESOS</div>
                      <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--cp-rust)' }}>
                        S/ {esperado.desglose.egresos.toFixed(2)}
                      </div>
                    </div>

                    <div
                      style={{
                        background: 'var(--cp-navy)',
                        color: 'var(--cp-cream)',
                        padding: '10px',
                        borderRadius: '10px',
                      }}
                    >
                      <div style={{ fontSize: '11px', opacity: 0.8, fontWeight: 700 }}>TOTAL EFECTIVO ESPERADO</div>
                      <div style={{ fontSize: '18px', fontWeight: 800 }}>
                        S/ {esperado.efectivoEsperado.toFixed(2)}
                      </div>
                    </div>
                  </div>

                  {/* Medios digitales esperados */}
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', fontSize: '12px', fontWeight: 700 }}>
                    <span style={{ background: 'var(--cp-white)', padding: '6px 10px', borderRadius: '8px' }}>
                      Yape: S/ {esperado.medios.yape.toFixed(2)}
                    </span>
                    <span style={{ background: 'var(--cp-white)', padding: '6px 10px', borderRadius: '8px' }}>
                      Plin: S/ {esperado.medios.plin.toFixed(2)}
                    </span>
                    <span style={{ background: 'var(--cp-white)', padding: '6px 10px', borderRadius: '8px' }}>
                      Transferencia: S/ {esperado.medios.transferencia.toFixed(2)}
                    </span>
                    <span style={{ background: 'var(--cp-white)', padding: '6px 10px', borderRadius: '8px' }}>
                      Tarjeta: S/ {esperado.medios.tarjeta.toFixed(2)}
                    </span>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '13px', color: 'var(--cp-soft)' }}>
                  No se pudo cargar el monto esperado (posiblemente la caja ya esté cerrada o no haya caja abierta).
                </div>
              )}
            </div>
          ) : (
            <div
              style={{
                background: 'var(--cp-cream)',
                border: '1.5px dashed var(--cp-soft)',
                borderRadius: '12px',
                padding: '12px 14px',
                fontSize: '13px',
                color: 'var(--cp-navy)',
                lineHeight: '18px',
              }}
            >
              <b>Cierre ciego:</b> los totales por medio de pago y el efectivo esperado solo los ve la supervisora/administrador. Al cerrar, cuenta y anota lo que hay; el sistema te indicará si cuadra.
            </div>
          )}

          {/* Formulario de arqueo ciego */}
          <ArqueoCiegoForm alCerrarCajaExitoso={() => {
            if (esAdmin) cargarEsperado();
          }} />
        </div>
      )}

      {tabActiva === 'liquidacion' && <LiquidacionRepartidores />}

      {tabActiva === 'historial' && <HistorialCierres />}
    </div>
  );
}
