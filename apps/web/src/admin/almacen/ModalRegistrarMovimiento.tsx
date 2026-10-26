import React, { useState, useEffect } from 'react';
import { almacenApi, InsumoStockItem, RegistrarMovimientoDto } from './almacenApi';
import { Confirmar } from '../../comun/Confirmar';

interface ModalRegistrarMovimientoProps {
  abierto: boolean;
  alCerrar: () => void;
  alGuardar: () => void;
  insumos: InsumoStockItem[];
}

export const ModalRegistrarMovimiento: React.FC<ModalRegistrarMovimientoProps> = ({
  abierto,
  alCerrar,
  alGuardar,
  insumos,
}) => {
  const [tipo, setTipo] = useState<'SALIDA' | 'MERMA' | 'DEVOLUCION'>('SALIDA');
  const [insumoId, setInsumoId] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [origen, setOrigen] = useState('Almacén central');
  const [destino, setDestino] = useState('Cocina');
  const [motivo, setMotivo] = useState('');
  const [cargando, setCargando] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [busquedaInsumo, setBusquedaInsumo] = useState('');
  const [confirmarAbierto, setConfirmarAbierto] = useState(false);

  useEffect(() => {
    if (abierto) {
      setTipo('SALIDA');
      setInsumoId(insumos[0]?.id || '');
      setCantidad('');
      setOrigen('Almacén central');
      setDestino('Cocina');
      setMotivo('');
      setErrorMsg('');
      setBusquedaInsumo('');
      setConfirmarAbierto(false);
    }
  }, [abierto, insumos]);

  // Ajustar sugerencias de origen/destino según tipo de movimiento
  const handleTipoChange = (t: 'SALIDA' | 'MERMA' | 'DEVOLUCION') => {
    setTipo(t);
    if (t === 'SALIDA') {
      setOrigen('Almacén central');
      setDestino('Cocina');
    } else if (t === 'MERMA') {
      setOrigen('Almacén central');
      setDestino('Merma');
    } else if (t === 'DEVOLUCION') {
      setOrigen('Cocina');
      setDestino('Almacén central');
    }
  };

  if (!abierto) return null;

  const insumoSel = insumos.find((i) => i.id === insumoId);
  const insumosFiltrados = insumos.filter(
    (i) => !busquedaInsumo || i.nombre.toLowerCase().includes(busquedaInsumo.toLowerCase()),
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!insumoId) {
      setErrorMsg('Debe seleccionar un insumo.');
      return;
    }
    const cantNum = parseFloat(cantidad);
    if (isNaN(cantNum) || cantNum <= 0) {
      setErrorMsg('Ingrese una cantidad válida mayor a 0.');
      return;
    }
    if (!origen.trim()) {
      setErrorMsg('El origen es obligatorio.');
      return;
    }
    setErrorMsg('');
    setConfirmarAbierto(true);
  };

  const ejecutarGuardar = async () => {
    const cantNum = parseFloat(cantidad);
    const dto: RegistrarMovimientoDto = {
      tipo,
      insumoId,
      cantidad: cantNum,
      origen: origen.trim(),
      destino: destino.trim() || undefined,
      motivo: motivo.trim() || undefined,
    };

    try {
      setCargando(true);
      setErrorMsg('');
      await almacenApi.registrarMovimiento(dto);
      setConfirmarAbierto(false);
      alGuardar();
      alCerrar();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al registrar el movimiento.');
      setConfirmarAbierto(false);
    } finally {
      setCargando(false);
    }
  };

  return (
    <>
      <div
        onClick={alCerrar}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 50,
          background: 'rgba(11,44,62,0.55)',
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Registrar movimiento de almacén"
        style={{
          position: 'fixed',
          zIndex: 60,
          left: '50%',
          top: '50%',
          transform: 'translate(-50%,-50%)',
          width: 'min(520px, calc(100% - 24px))',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'var(--cp-white)',
          borderRadius: 16,
          boxShadow: 'rgba(11, 44, 62, 0.25) 0px 10px 30px',
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          color: 'var(--cp-navy)',
          fontFamily: '"Open Sans", system-ui, sans-serif',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2
            style={{
              margin: 0,
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 800,
              fontSize: 18,
            }}
          >
            Registrar movimiento de almacén
          </h2>
          <button
            onClick={alCerrar}
            style={{
              border: 0,
              background: 'transparent',
              fontSize: 20,
              cursor: 'pointer',
              color: 'var(--cp-soft)',
            }}
          >
            ✕
          </button>
        </div>

        {errorMsg && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              background: 'rgb(253, 236, 232)',
              color: 'var(--cp-rust)',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Tipo de movimiento */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
              Tipo de movimiento
            </label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(['SALIDA', 'MERMA', 'DEVOLUCION'] as const).map((t) => {
                const activo = tipo === t;
                const label =
                  t === 'SALIDA'
                    ? 'Salida (hacia cocina)'
                    : t === 'MERMA'
                    ? 'Merma'
                    : 'Devolución';
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handleTipoChange(t)}
                    style={{
                      minHeight: 36,
                      padding: '0 12px',
                      borderRadius: 9999,
                      border: '1.5px solid var(--cp-navy)',
                      fontWeight: 700,
                      fontSize: 12,
                      background: activo ? 'var(--cp-navy)' : 'transparent',
                      color: activo ? 'var(--cp-cream)' : 'var(--cp-navy)',
                      cursor: 'pointer',
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selección de Insumo */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
              Insumo
            </label>
            <input
              type="search"
              placeholder="Buscar insumo..."
              value={busquedaInsumo}
              onChange={(e) => setBusquedaInsumo(e.target.value)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                minHeight: 36,
                borderRadius: 6,
                border: '1px solid var(--cp-line)',
                padding: '0 10px',
                background: 'var(--cp-white)',
                fontSize: 12,
                marginBottom: 6,
              }}
            />
            <div
              style={{
                display: 'flex',
                gap: 6,
                flexWrap: 'wrap',
                maxHeight: 120,
                overflowY: 'auto',
                border: '1px solid var(--cp-line)',
                padding: 8,
                borderRadius: 8,
                background: 'var(--cp-cream)',
              }}
            >
              {insumosFiltrados.slice(0, 15).map((ins) => {
                const sel = ins.id === insumoId;
                return (
                  <button
                    key={ins.id}
                    type="button"
                    onClick={() => setInsumoId(ins.id)}
                    style={{
                      padding: '4px 8px',
                      borderRadius: 6,
                      border: '1px solid var(--cp-navy)',
                      background: sel ? 'var(--cp-navy)' : 'var(--cp-white)',
                      color: sel ? 'var(--cp-cream)' : 'var(--cp-navy)',
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {ins.nombre} ({ins.stockActual} {ins.unidad})
                  </button>
                );
              })}
            </div>
            {insumoSel && (
              <div style={{ fontSize: 12, color: 'var(--cp-soft)', marginTop: 4 }}>
                Seleccionado: <b>{insumoSel.nombre}</b> · Stock actual: {insumoSel.stockActual} {insumoSel.unidad}
              </div>
            )}
          </div>

          {/* Cantidad y Unidad */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
              Cantidad {insumoSel ? `(${insumoSel.unidad})` : ''}
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                minHeight: 40,
                borderRadius: 8,
                border: '1.5px solid var(--cp-line)',
                padding: '0 10px',
                background: 'var(--cp-cream)',
                fontSize: 14,
              }}
            />
          </div>

          {/* Origen y Destino */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                Origen
              </label>
              <input
                type="text"
                placeholder="Ej. Almacén central, Cocina..."
                value={origen}
                onChange={(e) => setOrigen(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  minHeight: 40,
                  borderRadius: 8,
                  border: '1.5px solid var(--cp-line)',
                  padding: '0 10px',
                  background: 'var(--cp-cream)',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                Destino
              </label>
              <input
                type="text"
                placeholder="Ej. Cocina, Barra, Merma..."
                value={destino}
                onChange={(e) => setDestino(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  minHeight: 40,
                  borderRadius: 8,
                  border: '1.5px solid var(--cp-line)',
                  padding: '0 10px',
                  background: 'var(--cp-cream)',
                }}
              />
            </div>
          </div>

          {/* Motivo o Nota */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
              Motivo o nota (opcional)
            </label>
            <input
              type="text"
              placeholder="Ej. Ajuste de inventario, producto vencido..."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                minHeight: 40,
                borderRadius: 8,
                border: '1.5px solid var(--cp-line)',
                padding: '0 10px',
                background: 'var(--cp-cream)',
              }}
            />
          </div>

          {/* Botones de acción */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 10,
              marginTop: 10,
              borderTop: '1px solid var(--cp-line)',
              paddingTop: 14,
            }}
          >
            <button
              type="button"
              onClick={alCerrar}
              style={{
                minHeight: 44,
                padding: '0 16px',
                borderRadius: 9999,
                border: '1.5px solid var(--cp-navy)',
                background: 'transparent',
                color: 'var(--cp-navy)',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={cargando}
              style={{
                minHeight: 44,
                padding: '0 20px',
                borderRadius: 9999,
                border: 0,
                background: 'var(--cp-orange)',
                color: 'var(--cp-navy)',
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 800,
                fontSize: 14,
                cursor: cargando ? 'not-allowed' : 'pointer',
                opacity: cargando ? 0.7 : 1,
              }}
            >
              {cargando ? 'Registrando...' : 'Registrar movimiento'}
            </button>
          </div>
        </form>
      </div>

      {confirmarAbierto && (
        <Confirmar
          abierto={confirmarAbierto}
          titulo={`¿Confirmar movimiento de ${tipo}?`}
          mensaje={`Se registrará un movimiento de ${tipo} de ${cantidad} ${insumoSel?.unidad || 'unidades'} de ${insumoSel?.nombre || 'insumo'}.`}
          textoConfirmar="Sí, registrar"
          alConfirmar={ejecutarGuardar}
          alCancelar={() => setConfirmarAbierto(false)}
        />
      )}
    </>
  );
};
