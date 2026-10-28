import { comoLista } from '../../comun/comoLista';
import { useState, useEffect, useCallback } from 'react';
import { Boton } from '../../comun/Boton';
import { Confirmar } from '../../comun/Confirmar';
import { Cargando } from '../../comun/Cargando';
import { EstadoVacio } from '../../comun/EstadoVacio';
import { EstadoError } from '../../comun/EstadoError';
import {
  cierreApi,
  RepartidorPorLiquidar,
} from './cierreApi';
import { ErrorApi } from '../../comun/api';

export function LiquidacionRepartidores() {
  const [repartidores, setRepartidores] = useState<RepartidorPorLiquidar[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal para liquidar un repartidor
  const [seleccionado, setSeleccionado] = useState<RepartidorPorLiquidar | null>(null);
  const [montoEntregado, setMontoEntregado] = useState<string>('');
  const [enviando, setEnviando] = useState(false);
  const [errorModal, setErrorModal] = useState<string | null>(null);
  const [mostrarConfirmar, setMostrarConfirmar] = useState(false);

  const cargarDatos = useCallback(async () => {
    setError(null);
    try {
      const res = await cierreApi.listarRepartidoresPorLiquidar();
      setRepartidores(comoLista<RepartidorPorLiquidar>(res));
    } catch (err: any) {
      setError(err?.message || 'Error al cargar la lista de repartidores');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  const abrirModalLiquidar = (rep: RepartidorPorLiquidar) => {
    setSeleccionado(rep);
    setMontoEntregado(String(rep.pendiente));
    setErrorModal(null);
  };

  const cerrarModal = () => {
    setSeleccionado(null);
    setMontoEntregado('');
    setErrorModal(null);
  };

  const handleIntentarLiquidar = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorModal(null);

    const val = parseFloat(montoEntregado);
    if (isNaN(val) || val < 0) {
      setErrorModal('El monto entregado debe ser un número válido mayor o igual a 0');
      return;
    }

    setMostrarConfirmar(true);
  };

  const handleConfirmarLiquidacion = async () => {
    if (!seleccionado) return;
    setEnviando(true);
    setErrorModal(null);

    try {
      const val = parseFloat(montoEntregado);
      await cierreApi.liquidarRepartidor({
        repartidorPartyId: seleccionado.repartidorPartyId,
        entregado: val,
      });

      setMostrarConfirmar(false);
      cerrarModal();
      cargarDatos();
    } catch (err: any) {
      setMostrarConfirmar(false);
      if (err instanceof ErrorApi) {
        setErrorModal(err.message || 'Error al registrar la liquidación');
      } else {
        setErrorModal('Error al registrar la liquidación');
      }
    } finally {
      setEnviando(false);
    }
  };

  if (cargando) {
    return (
      <div style={{ padding: '30px 0' }}>
        <Cargando mensaje="Cargando estado de repartidores por liquidar..." />
      </div>
    );
  }

  if (error) {
    return <EstadoError mensaje={error} alReintentar={cargarDatos} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <h2
            style={{
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 800,
              fontSize: '18px',
              color: 'var(--cp-navy)',
              margin: 0,
            }}
          >
            Liquidación de efectivo de repartidores
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--cp-soft)' }}>
            Efectivo cobrado en la puerta del cliente en pedidos delivery. No entra a la caja hasta ser liquidado.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setCargando(true);
            cargarDatos();
          }}
          style={{
            minHeight: '44px',
            padding: '0 16px',
            borderRadius: '10px',
            border: '1.5px solid var(--cp-navy)',
            background: 'transparent',
            color: 'var(--cp-navy)',
            fontWeight: 700,
            fontSize: '13px',
            cursor: 'pointer',
          }}
        >
          Actualizar
        </button>
      </div>

      {repartidores.length === 0 ? (
        <EstadoVacio
          titulo="Sin pedidos por liquidar"
          mensaje="No hay pedidos delivery entregados cobrados en efectivo pendientes de liquidar."
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
          {repartidores.map((rep) => {
            const tienePendiente = rep.pendiente > 0;
            return (
              <div
                key={rep.repartidorPartyId}
                style={{
                  background: 'var(--cp-white)',
                  border: `1.5px solid ${tienePendiente ? 'var(--cp-rust)' : 'var(--cp-line)'}`,
                  borderRadius: '14px',
                  padding: '16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '12px',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ minWidth: 0, flex: '1 1 240px' }}>
                  <div
                    style={{
                      fontFamily: 'Montserrat, sans-serif',
                      fontWeight: 800,
                      fontSize: '16px',
                      color: 'var(--cp-navy)',
                    }}
                  >
                    {rep.nombre}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--cp-soft)', marginTop: '2px' }}>
                    {rep.pedidos.length} pedido(s) entregado(s) en efectivo · Total cobrado: S/ {rep.totalCobrado.toFixed(2)}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--cp-soft)', marginTop: '2px' }}>
                    Liquidado: S/ {rep.totalLiquidado.toFixed(2)} ·{' '}
                    <span
                      style={{
                        fontWeight: 800,
                        color: tienePendiente ? 'var(--cp-rust)' : 'var(--cp-green)',
                      }}
                    >
                      Pendiente: S/ {rep.pendiente.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div>
                  <Boton
                    variante={tienePendiente ? 'primario' : 'secundario'}
                    onClick={() => abrirModalLiquidar(rep)}
                    style={{ minHeight: '44px', fontWeight: 800 }}
                  >
                    {tienePendiente ? 'Recibir efectivo' : 'Registrar entrega'}
                  </Boton>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal para liquidar */}
      {seleccionado && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-liquidar-rep"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 80,
            background: 'rgba(11, 44, 62, 0.65)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !enviando) cerrarModal();
          }}
        >
          <div
            style={{
              background: 'var(--cp-white)',
              border: '1px solid var(--cp-line)',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '440px',
              padding: '20px',
              boxShadow: '0 20px 40px rgba(11, 44, 62, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3
                  id="titulo-liquidar-rep"
                  style={{
                    fontFamily: 'Montserrat, sans-serif',
                    fontWeight: 800,
                    fontSize: '18px',
                    color: 'var(--cp-navy)',
                    margin: 0,
                  }}
                >
                  Liquidar efectivo
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--cp-soft)' }}>
                  {seleccionado.nombre}
                </p>
              </div>
              <button
                type="button"
                onClick={cerrarModal}
                disabled={enviando}
                aria-label="Cerrar"
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '22px',
                  border: '1px solid var(--cp-line)',
                  background: 'transparent',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                x
              </button>
            </div>

            <div
              style={{
                background: 'var(--cp-cream)',
                borderRadius: '10px',
                padding: '10px 12px',
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '14px',
                fontWeight: 700,
              }}
            >
              <span>Efectivo esperado pendiente:</span>
              <span style={{ color: 'var(--cp-rust)' }}>S/ {seleccionado.pendiente.toFixed(2)}</span>
            </div>

            <form onSubmit={handleIntentarLiquidar} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label
                  htmlFor="monto-entregado-rep"
                  style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: 'var(--cp-navy)', marginBottom: '4px' }}
                >
                  Monto entregado por el repartidor (S/)
                </label>
                <input
                  id="monto-entregado-rep"
                  type="number"
                  step="0.10"
                  min="0"
                  value={montoEntregado}
                  onChange={(e) => setMontoEntregado(e.target.value)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    minHeight: '44px',
                    borderRadius: '10px',
                    border: '1.5px solid var(--cp-line)',
                    padding: '0 12px',
                    fontSize: '16px',
                    fontWeight: 700,
                  }}
                />
              </div>

              {/* Cálculo en vivo de la diferencia */}
              {montoEntregado !== '' && !isNaN(parseFloat(montoEntregado)) && (
                <div style={{ fontSize: '13px', fontWeight: 700 }}>
                  Diferencia:{' '}
                  {parseFloat(montoEntregado) - seleccionado.pendiente === 0 ? (
                    <span style={{ color: 'var(--cp-green)' }}>Cuadra exacto (S/ 0.00)</span>
                  ) : parseFloat(montoEntregado) - seleccionado.pendiente > 0 ? (
                    <span style={{ color: 'var(--cp-green)' }}>
                      Sobrante S/ {(parseFloat(montoEntregado) - seleccionado.pendiente).toFixed(2)}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--cp-rust)' }}>
                      Faltante S/ {Math.abs(parseFloat(montoEntregado) - seleccionado.pendiente).toFixed(2)}
                    </span>
                  )}
                </div>
              )}

              {errorModal && (
                <div
                  role="alert"
                  style={{
                    background: '#FDE8E8',
                    border: '1.5px solid var(--cp-rust)',
                    color: 'var(--cp-rust)',
                    borderRadius: '10px',
                    padding: '8px 12px',
                    fontSize: '13px',
                    fontWeight: 700,
                  }}
                >
                  {errorModal}
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <Boton
                  type="submit"
                  variante="primario"
                  cargando={enviando}
                  style={{ flex: 1, minHeight: '48px', fontWeight: 800 }}
                >
                  Registrar liquidación
                </Boton>
                <Boton
                  type="button"
                  variante="secundario"
                  onClick={cerrarModal}
                  deshabilitado={enviando}
                  style={{ minHeight: '48px' }}
                >
                  Cancelar
                </Boton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmar liquidación */}
      <Confirmar
        abierto={mostrarConfirmar}
        titulo="¿Confirmar recepción de efectivo?"
        mensaje={`Se registrará la entrega de S/ ${parseFloat(montoEntregado || '0').toFixed(2)} por parte de ${seleccionado?.nombre}.`}
        textoSi="Sí, recibir"
        textoNo="No, revisar"
        cargando={enviando}
        alConfirmar={handleConfirmarLiquidacion}
        alCancelar={() => setMostrarConfirmar(false)}
      />
    </div>
  );
}
