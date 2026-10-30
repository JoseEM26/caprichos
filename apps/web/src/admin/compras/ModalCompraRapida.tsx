import { comoLista } from '../../comun/comoLista';
import React, { useState, useEffect } from 'react';
import { comprasApi, CompraRapidaDto } from './comprasApi';
import { Confirmar } from '../../comun/Confirmar';

interface InsumoSimple {
  id: string;
  nombre: string;
  unidad_almacen?: string;
  unidad_compra?: string;
}

interface ModalCompraRapidaProps {
  abierto: boolean;
  alCerrar: () => void;
  alGuardar: () => void;
}

const MEDIOS_PAGO = [
  'Efectivo',
  'Yape',
  'Plin',
  'Tarjeta',
  'Transferencia',
  'Otro',
];

export const ModalCompraRapida: React.FC<ModalCompraRapidaProps> = ({
  abierto,
  alCerrar,
  alGuardar,
}) => {
  const [insumos, setInsumos] = useState<InsumoSimple[]>([]);
  const [insumoId, setInsumoId] = useState('');
  const [busquedaInsumo, setBusquedaInsumo] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [costoTotal, setCostoTotal] = useState('');
  const [medioPago, setMedioPago] = useState('Efectivo');
  const [nota, setNota] = useState('');
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [confirmarAbierto, setConfirmarAbierto] = useState(false);

  useEffect(() => {
    if (abierto) {
      setCargando(true);
      setErrorMsg('');
      setCantidad('');
      setCostoTotal('');
      setMedioPago('Efectivo');
      setNota('');
      setConfirmarAbierto(false);

      comprasApi
        .listarInsumos()
        .then((res) => {
          const lista = comoLista<any>(res);
          setInsumos(lista);
          if (lista.length > 0) {
            setInsumoId(String(lista[0].id));
          }
        })
        .catch((err) => {
          setErrorMsg(err.message || 'Error al cargar lista de insumos');
        })
        .finally(() => setCargando(false));
    }
  }, [abierto]);

  if (!abierto) return null;

  const insumosFiltrados = insumos.filter(
    (i) => !busquedaInsumo || i.nombre.toLowerCase().includes(busquedaInsumo.toLowerCase()),
  );

  const insumoSel = insumos.find((i) => String(i.id) === String(insumoId));
  const unidadTexto = insumoSel?.unidad_almacen || insumoSel?.unidad_compra || 'unidades';

  const cantNum = parseFloat(cantidad) || 0;
  const costoTotalNum = parseFloat(costoTotal) || 0;
  const costoUnitarioCalc = cantNum > 0 ? costoTotalNum / cantNum : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!insumoId) {
      setErrorMsg('Debe seleccionar un insumo.');
      return;
    }
    if (cantNum <= 0) {
      setErrorMsg('La cantidad debe ser mayor a 0.');
      return;
    }
    if (costoTotalNum < 0 || isNaN(costoTotalNum) || costoTotal === '') {
      setErrorMsg('El costo total no puede ser negativo.');
      return;
    }
    if (!medioPago.trim()) {
      setErrorMsg('Debe elegir un medio de pago.');
      return;
    }
    setErrorMsg('');
    setConfirmarAbierto(true);
  };

  const ejecutarGuardar = async () => {
    const dto: CompraRapidaDto = {
      insumoId,
      cantidad: cantNum,
      costoTotal: costoTotalNum,
      medioPago,
      nota: nota.trim() || undefined,
    };

    try {
      setGuardando(true);
      setErrorMsg('');
      await comprasApi.registrarCompraRapida(dto);
      setConfirmarAbierto(false);
      alGuardar();
      alCerrar();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al registrar la compra rápida');
      setConfirmarAbierto(false);
    } finally {
      setGuardando(false);
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
        aria-label="Compra rápida (sin proveedor)"
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
          <div>
            <div
              style={{
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 800,
                fontSize: 18,
              }}
            >
              Compra rápida
            </div>
            <div style={{ fontSize: 13, color: 'var(--cp-soft)', marginTop: 2 }}>
              Para compras sueltas en bodega o mercado (sin proveedor). Ingresa directamente al almacén central.
            </div>
          </div>
          <button
            type="button"
            onClick={alCerrar}
            style={{
              background: 'transparent',
              border: 0,
              fontSize: 22,
              cursor: 'pointer',
              color: 'var(--cp-soft)',
              padding: '4px 8px',
            }}
            aria-label="Cerrar modal"
          >
            ✕
          </button>
        </div>

        {errorMsg && (
          <div
            role="alert"
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
          {/* Seleccionar Insumo */}
          <div>
            <label
              htmlFor="compra-rapida-insumo"
              style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}
            >
              Insumo a comprar
            </label>
            {insumos.length > 5 && (
              <input
                type="text"
                value={busquedaInsumo}
                onChange={(e) => setBusquedaInsumo(e.target.value)}
                placeholder="Filtrar insumo..."
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  minHeight: 38,
                  padding: '0 12px',
                  borderRadius: 8,
                  border: '1px solid var(--cp-line)',
                  fontSize: 13,
                  marginBottom: 6,
                }}
              />
            )}
            <select
              id="compra-rapida-insumo"
              value={insumoId}
              onChange={(e) => setInsumoId(e.target.value)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                minHeight: 44,
                padding: '0 12px',
                borderRadius: 10,
                border: '1.5px solid var(--cp-navy)',
                fontSize: 14,
                fontWeight: 600,
                background: 'var(--cp-white)',
                color: 'var(--cp-navy)',
              }}
            >
              {insumosFiltrados.map((ins) => (
                <option key={ins.id} value={ins.id}>
                  {ins.nombre} ({ins.unidad_almacen || ins.unidad_compra || 'unid'})
                </option>
              ))}
            </select>
          </div>

          {/* Cantidad y Costo Total */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label
                htmlFor="compra-rapida-cantidad"
                style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}
              >
                Cantidad ({unidadTexto})
              </label>
              <input
                id="compra-rapida-cantidad"
                type="number"
                step="any"
                min="0.001"
                required
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                placeholder="Ej. 5"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  minHeight: 44,
                  padding: '0 12px',
                  borderRadius: 10,
                  border: '1.5px solid var(--cp-navy)',
                  fontSize: 14,
                }}
              />
            </div>

            <div>
              <label
                htmlFor="compra-rapida-costo"
                style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}
              >
                Costo total (S/)
              </label>
              <input
                id="compra-rapida-costo"
                type="number"
                step="0.01"
                min="0"
                required
                value={costoTotal}
                onChange={(e) => setCostoTotal(e.target.value)}
                placeholder="Ej. 25.00"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  minHeight: 44,
                  padding: '0 12px',
                  borderRadius: 10,
                  border: '1.5px solid var(--cp-navy)',
                  fontSize: 14,
                }}
              />
            </div>
          </div>

          {/* Costo unitario resultante calculado en vivo */}
          {cantNum > 0 && costoTotalNum >= 0 && (
            <div
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                background: 'var(--cp-cream)',
                fontSize: 13,
                color: 'var(--cp-navy)',
              }}
            >
              Costo unitario calculado: <b>s/ {costoUnitarioCalc.toFixed(2)}</b> por {unidadTexto}
            </div>
          )}

          {/* Medio de Pago */}
          <div>
            <label
              htmlFor="compra-rapida-mediopago"
              style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}
            >
              Medio de pago
            </label>
            <select
              id="compra-rapida-mediopago"
              value={medioPago}
              onChange={(e) => setMedioPago(e.target.value)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                minHeight: 44,
                padding: '0 12px',
                borderRadius: 10,
                border: '1.5px solid var(--cp-navy)',
                fontSize: 14,
                background: 'var(--cp-white)',
              }}
            >
              {MEDIOS_PAGO.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* Nota */}
          <div>
            <label
              htmlFor="compra-rapida-nota"
              style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}
            >
              Nota (opcional)
            </label>
            <input
              id="compra-rapida-nota"
              type="text"
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Ej. Bodega Don Lucho, boleta suelta"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                minHeight: 44,
                padding: '0 12px',
                borderRadius: 10,
                border: '1.5px solid var(--cp-line)',
                fontSize: 13,
              }}
            />
          </div>

          {/* Botones de acción */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
            <button
              type="button"
              onClick={alCerrar}
              style={{
                minHeight: 44,
                padding: '0 18px',
                border: '1.5px solid var(--cp-navy)',
                borderRadius: 12,
                background: 'transparent',
                color: 'var(--cp-navy)',
                fontWeight: 700,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={cargando || guardando || !insumoId}
              style={{
                minHeight: 44,
                padding: '0 22px',
                border: 0,
                borderRadius: 12,
                background: 'var(--cp-orange)',
                color: 'var(--cp-navy)',
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 800,
                fontSize: 14,
                cursor: cargando || guardando || !insumoId ? 'not-allowed' : 'pointer',
                opacity: cargando || guardando || !insumoId ? 0.6 : 1,
              }}
            >
              {guardando ? 'Guardando...' : 'Registrar compra'}
            </button>
          </div>
        </form>
      </div>

      <Confirmar
        abierto={confirmarAbierto}
        titulo="¿Confirmar compra rápida?"
        mensaje={`Se registrará el ingreso de ${cantidad} ${unidadTexto} de ${insumoSel?.nombre || 'insumo'} por un costo total de s/ ${costoTotalNum.toFixed(2)} pagado con ${medioPago}.`}
        textoConfirmar="Sí, registrar"
        textoNo="No, revisar"
        alConfirmar={ejecutarGuardar}
        alCancelar={() => setConfirmarAbierto(false)}
      />
    </>
  );
};
