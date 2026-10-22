import { useState } from 'react';
import { Confirmar } from '../../../comun/Confirmar';

export interface LineaPrecuenta {
  cantidad: number;
  nombre: string;
  detalle: string;
}

export interface ModalPrecuentaProps {
  abierto: boolean;
  alCerrar: () => void;
  mesa: string;
  lineas: LineaPrecuenta[];
  total: number;
  copias?: number;
  alImprimir?: () => Promise<void> | void;
}

export function ModalPrecuenta({
  abierto,
  alCerrar,
  mesa,
  lineas,
  total,
  copias = 0,
  alImprimir,
}: ModalPrecuentaProps) {
  const [confirmarImprimir, setConfirmarImprimir] = useState(false);
  const [imprimiendo, setImprimiendo] = useState(false);
  const [copiasLocales, setCopiasLocales] = useState(copias);

  if (!abierto) return null;

  const handleConfirmarImpresion = async () => {
    try {
      setImprimiendo(true);
      if (alImprimir) {
        await alImprimir();
      }
      setCopiasLocales((c) => c + 1);
    } finally {
      setImprimiendo(false);
      setConfirmarImprimir(false);
    }
  };

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Precuenta"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 80,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          onClick={alCerrar}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            zIndex: 50,
            background: 'rgba(11, 44, 62, 0.55)',
          }}
        />
        <div
          style={{
            position: 'relative',
            zIndex: 60,
            width: 'min(380px, calc(100% - 24px))',
            maxHeight: 'calc(100% - 24px)',
            overflowY: 'auto',
            background: 'var(--cp-white)',
            borderRadius: '6px',
            boxShadow: '0 20px 50px rgba(11, 44, 62, 0.4)',
            padding: '18px',
            fontFamily: "'Courier New', monospace",
            fontSize: '13px',
            lineHeight: '18px',
            color: '#111',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          <div style={{ textAlign: 'center', fontWeight: 700, fontSize: '16px' }}>
            PRECUENTA
          </div>
          <div style={{ textAlign: 'center' }}>{mesa || 'Mesa'}</div>
          <div style={{ textAlign: 'center' }}>------------------------------</div>
          {lineas.map((l, i) => (
            <div key={i}>
              <b>
                {l.cantidad} x {l.nombre}
              </b>
              <br />
              <span style={{ paddingLeft: '14px' }}>{l.detalle}</span>
            </div>
          ))}
          <div style={{ textAlign: 'center' }}>------------------------------</div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontWeight: 700,
              fontSize: '15px',
            }}
          >
            <span>TOTAL</span>
            <span>S/ {Number(total || 0).toFixed(2)}</span>
          </div>
          <div
            style={{
              margin: '8px auto',
              width: '96px',
              height: '96px',
              border: '2px solid #111',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
            }}
          >
            QR
          </div>
          <div style={{ textAlign: 'center' }}>
            Paga con Yape o Plin al 9XX XXX XXX (ejemplo) o entrega el efectivo al mozo;
            el cajero cobra y emite el comprobante.
          </div>
          <div style={{ textAlign: 'center', fontSize: '12px' }}>
            La precuenta no es un comprobante de pago.
          </div>
          {copiasLocales > 0 && (
            <div style={{ textAlign: 'center', fontSize: '12px' }}>
              Copias impresas: {copiasLocales}
            </div>
          )}
          <button
            type="button"
            onClick={() => setConfirmarImprimir(true)}
            style={{
              marginTop: '8px',
              minHeight: '44px',
              border: 0,
              borderRadius: '10px',
              background: 'var(--cp-orange)',
              color: 'var(--cp-navy)',
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            Imprimir precuenta
          </button>
          <button
            type="button"
            onClick={alCerrar}
            style={{
              marginTop: '8px',
              minHeight: '44px',
              border: '1.5px solid var(--cp-navy)',
              borderRadius: '10px',
              background: 'transparent',
              color: 'var(--cp-navy)',
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            Cerrar
          </button>
        </div>
      </div>

      <Confirmar
        abierto={confirmarImprimir}
        titulo="¿Imprimir precuenta?"
        mensaje={`¿Imprimir la precuenta de ${mesa}? Sale en la ticketera de salón. No es un comprobante.`}
        textoConfirmar="Sí, imprimir"
        textoNo="No, cancelar"
        cargando={imprimiendo}
        alConfirmar={handleConfirmarImpresion}
        alCancelar={() => setConfirmarImprimir(false)}
      />
    </>
  );
}
