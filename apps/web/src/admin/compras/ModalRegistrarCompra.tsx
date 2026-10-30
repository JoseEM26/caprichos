import React, { useState, useEffect } from 'react';
import { comprasApi, ProveedorItem, InsumoParaPedir, CrearCompraDto } from './comprasApi';
import { Confirmar } from '../../comun/Confirmar';

interface ModalRegistrarCompraProps {
  abierto: boolean;
  alCerrar: () => void;
  alGuardar: () => void;
  proveedores: ProveedorItem[];
  insumos: InsumoParaPedir[];
}

interface LineaForm {
  insumoId: string;
  insumoNombre: string;
  unidad: 'compra' | 'almacen';
  unidadNombre: string;
  cantidad: string;
  costoUnit: string;
}

export const ModalRegistrarCompra: React.FC<ModalRegistrarCompraProps> = ({
  abierto,
  alCerrar,
  alGuardar,
  proveedores,
  insumos,
}) => {
  const [proveedorId, setProveedorId] = useState('');
  const [fecha, setFecha] = useState(() => new Date().toISOString().split('T')[0]);
  const [compTipo, setCompTipo] = useState('Factura');
  const [compNum, setCompNum] = useState('');
  const [pago, setPago] = useState<'Contado' | 'Crédito'>('Contado');
  const [diasCredito, setDiasCredito] = useState('0');
  const [nota, setNota] = useState('');
  const [lineas, setLineas] = useState<LineaForm[]>([
    { insumoId: '', insumoNombre: '', unidad: 'compra', unidadNombre: '', cantidad: '', costoUnit: '' },
  ]);
  const [cargando, setCargando] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Selector buscador de insumos por línea
  const [busquedaInsumo, setBusquedaInsumo] = useState<Record<number, string>>({});
  const [confirmarAbierto, setConfirmarAbierto] = useState(false);

  useEffect(() => {
    if (abierto) {
      setProveedorId(proveedores[0]?.id || '');
      setFecha(new Date().toISOString().split('T')[0]);
      setCompTipo('Factura');
      setCompNum('');
      setPago('Contado');
      setDiasCredito('0');
      setNota('');
      setLineas([
        { insumoId: '', insumoNombre: '', unidad: 'compra', unidadNombre: '', cantidad: '', costoUnit: '' },
      ]);
      setErrorMsg('');
      setBusquedaInsumo({});
      setConfirmarAbierto(false);
    }
  }, [abierto, proveedores]);

  if (!abierto) return null;

  const proveedorSel = proveedores.find((p) => p.id === proveedorId);

  const handleProveedorChange = (id: string) => {
    setProveedorId(id);
    const p = proveedores.find((prov) => prov.id === id);
    if (p && p.diasCredito > 0) {
      setPago('Crédito');
      setDiasCredito(String(p.diasCredito));
    } else {
      setPago('Contado');
      setDiasCredito('0');
    }
  };

  const handleAddLinea = () => {
    setLineas([
      ...lineas,
      { insumoId: '', insumoNombre: '', unidad: 'compra', unidadNombre: '', cantidad: '', costoUnit: '' },
    ]);
  };

  const handleRemoveLinea = (idx: number) => {
    if (lineas.length <= 1) return;
    setLineas(lineas.filter((_, i) => i !== idx));
  };

  const handleSelectInsumo = (idx: number, ins: InsumoParaPedir) => {
    const updated = [...lineas];
    updated[idx] = {
      insumoId: ins.id,
      insumoNombre: ins.nombre,
      unidad: 'compra',
      unidadNombre: ins.unidadCompra || ins.unidadAlmacen,
      cantidad: '1',
      costoUnit: String(ins.costoUnitario || 0),
    };
    setLineas(updated);
    setBusquedaInsumo({ ...busquedaInsumo, [idx]: '' });
  };

  const calcularTotal = () => {
    return lineas.reduce((acc, l) => {
      const q = parseFloat(l.cantidad) || 0;
      const c = parseFloat(l.costoUnit) || 0;
      return acc + q * c;
    }, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proveedorId) {
      setErrorMsg('Seleccione un proveedor.');
      return;
    }
    if (!compNum.trim()) {
      setErrorMsg('Ingrese el número de comprobante.');
      return;
    }
    for (let i = 0; i < lineas.length; i++) {
      const l = lineas[i];
      if (!l.insumoId) {
        setErrorMsg(`Línea ${i + 1}: Seleccione un insumo.`);
        return;
      }
      if (!(parseFloat(l.cantidad) > 0)) {
        setErrorMsg(`Línea ${i + 1}: Ingrese una cantidad válida.`);
        return;
      }
      if (parseFloat(l.costoUnit) < 0 || isNaN(parseFloat(l.costoUnit))) {
        setErrorMsg(`Línea ${i + 1}: Ingrese un costo unitario válido.`);
        return;
      }
    }
    if (pago === 'Crédito' && !(parseInt(diasCredito, 10) > 0)) {
      setErrorMsg('Especifique los días de crédito para compras a crédito.');
      return;
    }

    setErrorMsg('');
    setConfirmarAbierto(true);
  };

  const ejecutarGuardar = async () => {
    const tipoMapeado =
      compTipo === 'Factura'
        ? 'FACTURA'
        : compTipo === 'Boleta'
        ? 'BOLETA'
        : compTipo === 'Nota de venta'
        ? 'NOTA_VENTA'
        : 'OTRO';

    const total = calcularTotal();
    const subtotal = total / 1.18;
    const igv = total - subtotal;

    const dto: CrearCompraDto = {
      proveedorPartyId: proveedorId,
      comprobanteTipo: tipoMapeado,
      comprobanteNumero: compNum.trim(),
      condicion: pago === 'Crédito' ? 'CREDITO' : 'CONTADO',
      diasCredito: pago === 'Crédito' ? parseInt(diasCredito, 10) : 0,
      fechaEmision: fecha,
      montoTotal: Math.round(total * 100) / 100,
      igv: Math.round(igv * 100) / 100,
      nota: nota.trim() || undefined,
      lineas: lineas.map((l) => ({
        insumoId: l.insumoId,
        cantidadCompra: parseFloat(l.cantidad),
        costoUnit: parseFloat(l.costoUnit),
        unidad: l.unidad,
      })),
    };

    try {
      setCargando(true);
      setErrorMsg('');
      await comprasApi.registrarCompra(dto);
      setConfirmarAbierto(false);
      alGuardar();
      alCerrar();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al registrar la compra.');
      setConfirmarAbierto(false);
    } finally {
      setCargando(false);
    }
  };

  const totalCalculado = calcularTotal();

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
        aria-label="Registrar compra"
        style={{
          position: 'fixed',
          zIndex: 60,
          left: '50%',
          top: '50%',
          transform: 'translate(-50%,-50%)',
          width: 'min(720px, calc(100% - 24px))',
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
              fontSize: 20,
            }}
          >
            Registrar compra
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
          {/* Proveedor */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
              Proveedor
            </label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {proveedores.map((p) => {
                const activo = p.id === proveedorId;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleProveedorChange(p.id)}
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
                    {p.nombreComercial || p.razonSocial}
                  </button>
                );
              })}
            </div>
            {proveedorSel && (
              <div style={{ fontSize: 12, color: 'var(--cp-soft)', marginTop: 4 }}>
                {proveedorSel.diasCredito > 0
                  ? `Suele dar crédito de ${proveedorSel.diasCredito} días.`
                  : 'Suele cobrar al contado.'}
              </div>
            )}
          </div>

          {/* Fecha, Comprobante y Número */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                Fecha de compra
              </label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
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
                Comprobante
              </label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {['Factura', 'Boleta', 'Nota de venta', 'Sin comprobante'].map((tipo) => {
                  const sel = compTipo === tipo;
                  return (
                    <button
                      key={tipo}
                      type="button"
                      onClick={() => setCompTipo(tipo)}
                      style={{
                        minHeight: 36,
                        padding: '0 10px',
                        borderRadius: 9999,
                        border: '1.5px solid var(--cp-navy)',
                        fontWeight: 700,
                        fontSize: 12,
                        background: sel ? 'var(--cp-navy)' : 'transparent',
                        color: sel ? 'var(--cp-cream)' : 'var(--cp-navy)',
                        cursor: 'pointer',
                      }}
                    >
                      {tipo}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                Número comprobante
              </label>
              <input
                type="text"
                placeholder="Ej. F001-000123"
                value={compNum}
                onChange={(e) => setCompNum(e.target.value)}
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

          {/* Condición de pago */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                Condición de pago
              </label>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['Contado', 'Crédito'] as const).map((m) => {
                  const sel = pago === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPago(m)}
                      style={{
                        minHeight: 36,
                        padding: '0 12px',
                        borderRadius: 9999,
                        border: '1.5px solid var(--cp-navy)',
                        fontWeight: 700,
                        fontSize: 12,
                        background: sel ? 'var(--cp-navy)' : 'transparent',
                        color: sel ? 'var(--cp-cream)' : 'var(--cp-navy)',
                        cursor: 'pointer',
                      }}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
            </div>

            {pago === 'Crédito' && (
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                  Días para pagar
                </label>
                <input
                  type="number"
                  min="1"
                  value={diasCredito}
                  onChange={(e) => setDiasCredito(e.target.value)}
                  style={{
                    width: 100,
                    boxSizing: 'border-box',
                    minHeight: 40,
                    borderRadius: 8,
                    border: '1.5px solid var(--cp-line)',
                    padding: '0 10px',
                    background: 'var(--cp-cream)',
                  }}
                />
              </div>
            )}
          </div>

          {/* Líneas de insumos */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 700 }}>Insumos comprados</label>
              <button
                type="button"
                onClick={handleAddLinea}
                style={{
                  border: 0,
                  background: 'transparent',
                  color: 'var(--cp-navy)',
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                + Agregar otro insumo
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {lineas.map((linea, idx) => {
                const query = (busquedaInsumo[idx] || '').toLowerCase();
                const insumosFiltrados = insumos
                  .filter((ins) => !query || ins.nombre.toLowerCase().includes(query))
                  .slice(0, 8);

                return (
                  <div
                    key={idx}
                    style={{
                      background: 'var(--cp-cream)',
                      borderRadius: 10,
                      padding: 12,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, fontWeight: 700 }}>Insumo {idx + 1}</span>
                      {lineas.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveLinea(idx)}
                          style={{
                            border: 0,
                            background: 'transparent',
                            color: 'var(--cp-rust)',
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Quitar
                        </button>
                      )}
                    </div>

                    {linea.insumoId ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: 14 }}>{linea.insumoNombre}</span>
                        <button
                          type="button"
                          onClick={() => {
                            const u = [...lineas];
                            u[idx].insumoId = '';
                            u[idx].insumoNombre = '';
                            setLineas(u);
                          }}
                          style={{
                            border: 0,
                            background: 'transparent',
                            color: 'var(--cp-soft)',
                            fontSize: 12,
                            cursor: 'pointer',
                            textDecoration: 'underline',
                          }}
                        >
                          Cambiar
                        </button>
                      </div>
                    ) : (
                      <div>
                        <input
                          type="search"
                          placeholder="Buscar insumo..."
                          value={busquedaInsumo[idx] || ''}
                          onChange={(e) => setBusquedaInsumo({ ...busquedaInsumo, [idx]: e.target.value })}
                          style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            minHeight: 36,
                            borderRadius: 6,
                            border: '1px solid var(--cp-line)',
                            padding: '0 8px',
                            background: 'var(--cp-white)',
                            fontSize: 12,
                            marginBottom: 6,
                          }}
                        />
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', maxHeight: 110, overflowY: 'auto' }}>
                          {insumosFiltrados.map((ins) => (
                            <button
                              key={ins.id}
                              type="button"
                              onClick={() => handleSelectInsumo(idx, ins)}
                              style={{
                                padding: '4px 8px',
                                borderRadius: 6,
                                border: '1px solid var(--cp-navy)',
                                background: 'var(--cp-white)',
                                color: 'var(--cp-navy)',
                                fontSize: 11,
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              {ins.nombre}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
                      <div>
                        <label style={{ fontSize: 11, color: 'var(--cp-soft)', display: 'block' }}>Cantidad</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          placeholder="0"
                          value={linea.cantidad}
                          onChange={(e) => {
                            const u = [...lineas];
                            u[idx].cantidad = e.target.value;
                            setLineas(u);
                          }}
                          style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            minHeight: 36,
                            borderRadius: 6,
                            border: '1px solid var(--cp-line)',
                            padding: '0 8px',
                            background: 'var(--cp-white)',
                            fontSize: 13,
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: 11, color: 'var(--cp-soft)', display: 'block' }}>Costo unitario (s/)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={linea.costoUnit}
                          onChange={(e) => {
                            const u = [...lineas];
                            u[idx].costoUnit = e.target.value;
                            setLineas(u);
                          }}
                          style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            minHeight: 36,
                            borderRadius: 6,
                            border: '1px solid var(--cp-line)',
                            padding: '0 8px',
                            background: 'var(--cp-white)',
                            fontSize: 13,
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: 11, color: 'var(--cp-soft)', display: 'block' }}>Subtotal</label>
                        <div style={{ minHeight: 36, display: 'flex', alignItems: 'center', fontWeight: 700, fontSize: 14 }}>
                          s/ {((parseFloat(linea.cantidad) || 0) * (parseFloat(linea.costoUnit) || 0)).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Nota */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
              Nota (opcional)
            </label>
            <input
              type="text"
              placeholder="Ej. Entrega parcial, pagar fin de mes"
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                minHeight: 38,
                borderRadius: 8,
                border: '1.5px solid var(--cp-line)',
                padding: '0 10px',
                background: 'var(--cp-cream)',
              }}
            />
          </div>

          {/* Total y Botones */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderTop: '1px solid var(--cp-line)',
              paddingTop: 14,
              marginTop: 6,
            }}
          >
            <div>
              <div style={{ fontSize: 12, color: 'var(--cp-soft)' }}>Total a pagar</div>
              <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 20 }}>
                s/ {totalCalculado.toFixed(2)}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
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
                {cargando ? 'Guardando...' : 'Registrar compra'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {confirmarAbierto && (
        <Confirmar
          abierto={confirmarAbierto}
          titulo="¿Confirmar registro de compra?"
          mensaje={`Se registrará la compra con ${proveedorSel?.nombreComercial || 'proveedor'} por un total de s/ ${totalCalculado.toFixed(2)} y se ingresará el stock a Almacén central.`}
          textoConfirmar="Sí, registrar"
          textoNo="No, revisar"
          alConfirmar={ejecutarGuardar}
          alCancelar={() => setConfirmarAbierto(false)}
        />
      )}
    </>
  );
};
