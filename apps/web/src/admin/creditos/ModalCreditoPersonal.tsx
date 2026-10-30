import { comoLista } from '../../comun/comoLista';
import { useEffect, useState } from 'react';
import { Confirmar } from '../../comun/Confirmar';
import {
  listarPersonalActivo,
  registrarConsumoCredito,
  type ColaboradorActivo,
} from './creditosApi';

export interface ModalCreditoPersonalProps {
  abierto: boolean;
  pedido: {
    id: string | number;
    codigo?: string;
    total: number;
    subtotal?: number;
    lineas?: Array<{
      cantidad: number;
      nombre: string;
      subtotal?: number;
      precio_unit?: number;
      oferta_id?: any;
      linea_combo_id?: any;
    }>;
  } | null;
  descuentoPct?: number;
  alCobrado: (resultado: any) => void;
  alCancelar: () => void;
}

const NOMBRES_MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'setiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

export function ModalCreditoPersonal({
  abierto,
  pedido,
  descuentoPct = 25,
  alCobrado,
  alCancelar,
}: ModalCreditoPersonalProps) {
  const [personal, setPersonal] = useState<ColaboradorActivo[]>([]);
  const [colaboradorElegido, setColaboradorElegido] = useState<ColaboradorActivo | null>(null);
  const [cargando, setCargando] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [confirmando, setConfirmando] = useState<boolean>(false);

  useEffect(() => {
    if (abierto) {
      setColaboradorElegido(null);
      setError('');
      listarPersonalActivo()
        .then((lista) => setPersonal(comoLista<ColaboradorActivo>(lista)))
        .catch(() => {
          setError('No se pudo cargar la lista del personal');
        });
    }
  }, [abierto]);

  if (!abierto || !pedido) return null;

  const codigoPedido = pedido.codigo || `P-${pedido.id}`;
  const totalPedido = Number(pedido.total || 0);

  // Calcular descuento del personal excluyendo combos, promociones y docenas
  const pct = colaboradorElegido?.descuentoPct ?? descuentoPct;
  let subtotalElegible = 0;
  const regexExcluidos = /combo|promoci[oó]n|docena/i;

  if (pedido.lineas && pedido.lineas.length > 0) {
    for (const linea of pedido.lineas) {
      const esCombo = linea.oferta_id != null || linea.linea_combo_id != null;
      const esExcluido = regexExcluidos.test(linea.nombre);
      const sub = Number(linea.subtotal ?? (Number(linea.precio_unit || 0) * linea.cantidad));

      if (!esCombo && !esExcluido) {
        subtotalElegible += sub;
      }
    }
  } else {
    subtotalElegible = totalPedido;
  }

  const montoDescuento = Math.round(subtotalElegible * (pct / 100) * 100) / 100;
  const totalPagar = Math.max(0, Math.round((totalPedido - montoDescuento) * 100) / 100);

  const mesActual = NOMBRES_MESES[new Date().getMonth()];

  const intentarCobrar = () => {
    if (!colaboradorElegido) {
      setError('Elige al trabajador.');
      return;
    }
    setError('');
    setConfirmando(true);
  };

  const ejecutarCobro = async () => {
    if (!colaboradorElegido) return;
    setCargando(true);
    try {
      const res = await registrarConsumoCredito(pedido.id, colaboradorElegido.partyId);
      setConfirmando(false);
      alCobrado(res);
    } catch (err: any) {
      setError(err?.message || 'Error al registrar el cobro a crédito');
      setConfirmando(false);
    } finally {
      setCargando(false);
    }
  };

  return (
    <>
      <div
        onClick={alCancelar}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 50,
          background: 'rgba(11, 44, 62, 0.55)',
          backdropFilter: 'blur(1px)',
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Cobrar ${codigoPedido} a crédito`}
        style={{
          position: 'fixed',
          zIndex: 60,
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(620px, calc(100% - 24px))',
          maxHeight: 'calc(100% - 24px)',
          overflowY: 'auto',
          background: 'var(--cp-cream)',
          borderRadius: '20px',
          boxShadow: '0 20px 50px rgba(11, 44, 62, 0.4)',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '18px' }}>
            Cobrar {codigoPedido} a crédito
          </div>
          <button
            onClick={alCancelar}
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

        <div style={{ fontSize: '13px', color: 'var(--cp-soft)' }}>
          Solo para el personal. Elige quién compra; el descuento se calcula solo.
        </div>

        {/* Chips del personal */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {personal.map((t) => {
            const elegido = colaboradorElegido?.partyId === t.partyId;
            return (
              <button
                key={t.partyId}
                type="button"
                onClick={() => {
                  setColaboradorElegido(t);
                  setError('');
                }}
                style={{
                  minHeight: '44px',
                  padding: '0 12px',
                  borderRadius: '9999px',
                  border: '1.5px solid var(--cp-navy)',
                  background: elegido ? 'var(--cp-navy)' : 'transparent',
                  color: elegido ? 'var(--cp-cream)' : 'var(--cp-navy)',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                {t.nombre} · {t.rol}
              </button>
            );
          })}
        </div>

        {/* Cuadro de resumen de montos */}
        <div
          style={{
            background: 'var(--cp-white)',
            border: '1px solid var(--cp-line)',
            borderRadius: '12px',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          <div style={{ fontSize: '14px' }}>
            Total del pedido: s/ {totalPedido.toFixed(2)}
          </div>
          <div style={{ fontSize: '14px' }}>
            Descuento del personal ({pct} %, sin combos ni promociones): − s/ {montoDescuento.toFixed(2)}
          </div>
          <div style={{ fontSize: '14px', fontWeight: 700 }}>
            Se suma al consumo de {mesActual} del trabajador: s/ {totalPagar.toFixed(2)}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--cp-soft)' }}>
            Se le descuenta a fin de mes, fuera del sistema (sin plazo ni abonos).
          </div>
        </div>

        {error && (
          <div role="alert" style={{ fontSize: '13px', fontWeight: 700, color: 'var(--cp-rust)' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={intentarCobrar}
            disabled={cargando}
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
            Cobrar a crédito
          </button>
          <button
            type="button"
            onClick={alCancelar}
            style={{
              flex: 1,
              minHeight: '52px',
              border: '1.5px solid var(--cp-navy)',
              borderRadius: '12px',
              background: 'transparent',
              color: 'var(--cp-navy)',
              fontWeight: 700,
              fontSize: '15px',
              cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
        </div>
      </div>

      {/* Confirmación Sí/No previa al cobro (RN-CAP-015) */}
      <Confirmar
        abierto={confirmando}
        titulo={`¿Cobrar ${codigoPedido} a crédito de ${colaboradorElegido?.nombre}?`}
        mensaje={`Se suma s/ ${totalPagar.toFixed(2)} (descuento s/ ${montoDescuento.toFixed(2)}) al consumo de ${mesActual} de ${colaboradorElegido?.nombre}. Se le descuenta a fin de mes en su pago, fuera del sistema.`}
        textoSi="Sí, cobrar a crédito"
        textoNo="No, cancelar"
        cargando={cargando}
        alConfirmar={ejecutarCobro}
        alCancelar={() => setConfirmando(false)}
      />
    </>
  );
}
