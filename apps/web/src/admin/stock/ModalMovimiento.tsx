import React, { useState } from 'react';
import { InsumoItem, LugarStockItem } from './tipos';
import { Confirmar } from '../../comun/Confirmar';

interface ModalMovimientoProps {
  insumoInicial?: InsumoItem | null;
  tipoInicial?: 'SALIDA' | 'MERMA' | 'DEVOLUCION' | 'TRASLADO' | 'AJUSTE';
  insumos: InsumoItem[];
  lugares: LugarStockItem[];
  alCerrar: () => void;
  alGuardar: (datos: any) => Promise<void>;
}

export function ModalMovimiento({
  insumoInicial,
  tipoInicial = 'SALIDA',
  insumos,
  lugares,
  alCerrar,
  alGuardar,
}: ModalMovimientoProps) {
  const [tipo, setTipo] = useState<'SALIDA' | 'MERMA' | 'DEVOLUCION' | 'TRASLADO' | 'AJUSTE'>(tipoInicial);
  const [insumoId, setInsumoId] = useState(insumoInicial ? insumoInicial.id : insumos[0]?.id || '');
  const [cantidad, setCantidad] = useState('1');

  const [origenId, setOrigenId] = useState(
    insumoInicial?.lugar_consumo_id || lugares[0]?.id || '',
  );
  const [destinoId, setDestinoId] = useState(
    lugares.find((l) => l.id !== origenId)?.id || lugares[1]?.id || '',
  );

  const [motivo, setMotivo] = useState('');
  const [errorValidacion, setErrorValidacion] = useState('');
  const [confirmarEnvio, setConfirmarEnvio] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const insumoSeleccionado = insumos.find((i) => i.id === insumoId);

  const tiposMovimiento = [
    { id: 'SALIDA', label: 'Salida' },
    { id: 'MERMA', label: 'Merma' },
    { id: 'DEVOLUCION', label: 'Devolución' },
    { id: 'TRASLADO', label: 'Traslado' },
    { id: 'AJUSTE', label: 'Ajuste' },
  ];

  const motivosMerma = [
    'Donación',
    'Personal',
    'Desecho',
    'Caída',
    'Error de comanda',
    'Calibración',
  ];

  const validarFormulario = () => {
    if (!insumoId) {
      setErrorValidacion('Debe seleccionar un insumo');
      return false;
    }
    const cant = parseFloat(cantidad);
    if (isNaN(cant) || cant <= 0) {
      setErrorValidacion('La cantidad debe ser mayor a cero');
      return false;
    }

    if (tipo === 'TRASLADO') {
      if (!destinoId) {
        setErrorValidacion('Debe seleccionar un lugar de destino');
        return false;
      }
      if (origenId === destinoId) {
        setErrorValidacion('El lugar de origen y destino no pueden ser el mismo');
        return false;
      }
    }

    if (tipo === 'AJUSTE' || tipo === 'MERMA') {
      if (!motivo.trim()) {
        setErrorValidacion(`El motivo es obligatorio para ${tipo === 'AJUSTE' ? 'ajustes' : 'mermas'}`);
        return false;
      }
    }

    setErrorValidacion('');
    return true;
  };

  const solicitarEnvio = (e: React.FormEvent) => {
    e.preventDefault();
    if (validarFormulario()) {
      setConfirmarEnvio(true);
    }
  };

  const ejecutarMovimiento = async () => {
    setGuardando(true);
    try {
      const payload: any = {
        insumoId,
        lugarId: origenId,
        tipo,
        cantidad: parseFloat(cantidad),
        unidad: 'almacen',
        motivo: motivo.trim() || undefined,
      };
      if (tipo === 'TRASLADO') {
        payload.lugarDestinoId = destinoId;
      }
      await alGuardar(payload);
      alCerrar();
    } catch (err: any) {
      setErrorValidacion(err.message || 'Error al registrar el movimiento');
    } finally {
      setGuardando(false);
      setConfirmarEnvio(false);
    }
  };

  return (
    <>
      <div
        onClick={alCerrar}
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          zIndex: 50,
          background: 'rgba(11,44,62,0.55)',
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Registrar movimiento"
        style={{
          position: 'fixed',
          zIndex: 60,
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(840px, calc(100% - 24px))',
          maxHeight: 'calc(100% - 24px)',
          overflowY: 'auto',
          background: 'var(--cp-cream)',
          borderRadius: '20px',
          boxShadow: '0 20px 50px rgba(11,44,62,0.4)',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '20px' }}>
            Registrar movimiento
          </div>
          <button
            type="button"
            onClick={alCerrar}
            aria-label="Cerrar"
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '22px',
              border: '1.5px solid var(--cp-navy)',
              background: 'transparent',
              color: 'var(--cp-navy)',
              fontSize: '20px',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            ×
          </button>
        </div>

        <form onSubmit={solicitarEnvio} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Tipo de movimiento en chips idénticos al mockup */}
          <div>
            <div style={{ fontWeight: 700, marginBottom: '4px' }}>Tipo</div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {tiposMovimiento.map((t) => {
                const activo = tipo === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTipo(t.id as any)}
                    style={{
                      minHeight: '44px',
                      padding: '0 14px',
                      borderRadius: '9999px',
                      border: '1.5px solid var(--cp-navy)',
                      background: activo ? 'var(--cp-navy)' : 'transparent',
                      color: activo ? 'var(--cp-cream)' : 'var(--cp-navy)',
                      fontWeight: 700,
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Insumo */}
          <div>
            <label htmlFor="mov-insumo" style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>
              Insumo <span style={{ fontWeight: 500, fontSize: '12px', color: 'var(--cp-soft)' }}>· con su stock actual</span>
            </label>
            <select
              id="mov-insumo"
              value={insumoId}
              onChange={(e) => setInsumoId(e.target.value)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                minHeight: '44px',
                borderRadius: '10px',
                border: '1.5px solid var(--cp-line)',
                background: 'var(--cp-white)',
                padding: '0 10px',
                fontSize: '14px',
                color: 'var(--cp-navy)',
              }}
            >
              {insumos.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.nombre} (Stock actual: {i.stock_total} {i.unidad_almacen})
                </option>
              ))}
            </select>
          </div>

          {/* Cantidad */}
          <div>
            <label htmlFor="mov-cantidad" style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>
              Cantidad ({insumoSeleccionado?.unidad_almacen || 'unidad'})
            </label>
            <input
              id="mov-cantidad"
              type="number"
              step="any"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              placeholder="Solo números"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                minHeight: '48px',
                borderRadius: '12px',
                border: '1.5px solid var(--cp-line)',
                background: 'var(--cp-white)',
                padding: '0 12px',
                fontSize: '14px',
                color: 'var(--cp-navy)',
              }}
            />
          </div>

          {/* Origen */}
          <div>
            <div style={{ fontWeight: 700, marginBottom: '4px' }}>Origen</div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {lugares.map((lug) => {
                const activo = origenId === lug.id;
                return (
                  <button
                    key={lug.id}
                    type="button"
                    onClick={() => setOrigenId(lug.id)}
                    style={{
                      minHeight: '44px',
                      padding: '0 14px',
                      borderRadius: '9999px',
                      border: '1.5px solid var(--cp-navy)',
                      background: activo ? 'var(--cp-navy)' : 'transparent',
                      color: activo ? 'var(--cp-cream)' : 'var(--cp-navy)',
                      fontWeight: 700,
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    {lug.nombre}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Destino (si no es Merma) */}
          {tipo !== 'MERMA' && (
            <div>
              <div style={{ fontWeight: 700, marginBottom: '4px' }}>Destino</div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {lugares.map((lug) => {
                  const activo = destinoId === lug.id;
                  return (
                    <button
                      key={lug.id}
                      type="button"
                      onClick={() => setDestinoId(lug.id)}
                      style={{
                        minHeight: '44px',
                        padding: '0 14px',
                        borderRadius: '9999px',
                        border: '1.5px solid var(--cp-navy)',
                        background: activo ? 'var(--cp-navy)' : 'transparent',
                        color: activo ? 'var(--cp-cream)' : 'var(--cp-navy)',
                        fontWeight: 700,
                        fontSize: '12px',
                        cursor: 'pointer',
                      }}
                    >
                      {lug.nombre}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Motivo de Merma o Ajuste */}
          {(tipo === 'MERMA' || tipo === 'AJUSTE') && (
            <div>
              <div style={{ fontWeight: 700, marginBottom: '4px' }}>¿Qué se hace con la merma? / Motivo obligatorio</div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
                {motivosMerma.map((m) => {
                  const activo = motivo === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMotivo(m)}
                      style={{
                        minHeight: '44px',
                        padding: '0 14px',
                        borderRadius: '9999px',
                        border: '1.5px solid var(--cp-navy)',
                        background: activo ? 'var(--cp-navy)' : 'transparent',
                        color: activo ? 'var(--cp-cream)' : 'var(--cp-navy)',
                        fontWeight: 700,
                        fontSize: '12px',
                        cursor: 'pointer',
                      }}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
              <input
                id="mov-motivo"
                type="text"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ej.: Vencimiento, derrame, mal estado"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  minHeight: '44px',
                  borderRadius: '10px',
                  border: '1.5px solid var(--cp-line)',
                  background: 'var(--cp-white)',
                  padding: '0 10px',
                  fontSize: '13px',
                  color: 'var(--cp-navy)',
                }}
              />
            </div>
          )}

          {errorValidacion && (
            <div role="alert" style={{ fontSize: '13px', fontWeight: 700, color: 'var(--cp-rust)' }}>
              {errorValidacion}
            </div>
          )}

          {/* Botones de acción idénticos al mockup */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
            <button
              type="submit"
              disabled={guardando}
              style={{
                flex: 1,
                minHeight: '52px',
                border: 0,
                borderRadius: '12px',
                background: 'var(--cp-orange)',
                color: 'var(--cp-navy)',
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 800,
                fontSize: '15px',
                cursor: 'pointer',
              }}
            >
              {guardando ? 'Registrando...' : 'Registrar'}
            </button>
            <button
              type="button"
              onClick={alCerrar}
              style={{
                flex: 1,
                minHeight: '52px',
                border: '1.5px solid var(--cp-navy)',
                borderRadius: '12px',
                background: 'transparent',
                color: 'var(--cp-navy)',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>

      {/* Confirmación Sí/No obligatoria */}
      {confirmarEnvio && (
        <Confirmar
          abierto={confirmarEnvio}
          titulo={`¿Confirmar movimiento de ${tipo}?`}
          mensaje={`Se registrará ${tipo} de ${cantidad} ${insumoSeleccionado?.unidad_almacen || ''} de ${insumoSeleccionado?.nombre || 'insumo'}.`}
          textoSi={guardando ? 'Registrando...' : 'Sí, confirmar'}
          textoNo="No, cancelar"
          alConfirmar={ejecutarMovimiento}
          alCancelar={() => setConfirmarEnvio(false)}
        />
      )}
    </>
  );
}
