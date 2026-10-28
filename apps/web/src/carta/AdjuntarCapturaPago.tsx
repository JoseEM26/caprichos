import { useState } from 'react';
import { clienteFetch, ErrorApi } from '../comun/api';
import { reducirImagenVoucher } from '../admin/vouchers/reducirImagenVoucher';

export interface AdjuntarCapturaPagoProps {
  codigo: string;
  token: string;
  /** Solo pedidos con Yape, Plin o transferencia piden la captura. */
  pagoDigital: boolean;
}

/**
 * Captura del pago desde la pantalla de seguimiento. Opcional: el pedido ya está «por validar»
 * y el equipo revisa la captura. La respuesta no muestra semáforo ni datos extraídos.
 */
export function AdjuntarCapturaPago({ codigo, token, pagoDigital }: AdjuntarCapturaPagoProps) {
  const [estado, setEstado] = useState<'inicial' | 'subiendo' | 'recibida' | 'error'>('inicial');
  const [mensaje, setMensaje] = useState<string>('');

  if (!pagoDigital || !token) return null;

  const enviar = async (archivo: File) => {
    setEstado('subiendo');
    setMensaje('');
    try {
      const reducido = await reducirImagenVoucher(archivo, 1600, 0.85);
      const formData = new FormData();
      formData.append('archivo', reducido, `captura-${codigo}.jpg`);
      await clienteFetch(
        `/carta/seguimiento/${encodeURIComponent(codigo)}/comprobante?t=${encodeURIComponent(token)}`,
        { method: 'POST', body: formData },
      );
      setEstado('recibida');
    } catch (err) {
      setEstado('error');
      setMensaje(
        err instanceof ErrorApi ? err.message : 'No pudimos recibir la captura. Inténtalo de nuevo.',
      );
    }
  };

  return (
    <div
      data-testid="adjuntar-captura-pago"
      style={{
        backgroundColor: 'var(--cp-white)',
        border: '1px solid var(--cp-line)',
        borderRadius: '14px',
        padding: '14px',
        textAlign: 'left',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--cp-navy)' }}>
        Envía la captura de tu pago
      </div>
      <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
        Así lo validamos más rápido. Si no la envías ahora, también puedes mandarla por WhatsApp.
      </div>

      {estado === 'recibida' ? (
        <div role="status" style={{ fontSize: '13px', fontWeight: 700, color: 'var(--cp-green, #2F7A45)' }}>
          Recibimos tu captura. El equipo la revisa.
        </div>
      ) : (
        <label
          style={{
            minHeight: '44px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1.5px solid var(--cp-navy)',
            borderRadius: '10px',
            fontWeight: 700,
            fontSize: '13px',
            color: 'var(--cp-navy)',
            cursor: estado === 'subiendo' ? 'not-allowed' : 'pointer',
          }}
        >
          {estado === 'subiendo' ? 'Enviando captura...' : 'Adjuntar captura'}
          <input
            type="file"
            accept="image/*"
            disabled={estado === 'subiendo'}
            data-testid="input-captura-pago"
            style={{ display: 'none' }}
            onChange={(e) => {
              const archivo = e.target.files?.[0];
              if (archivo) void enviar(archivo);
              e.target.value = '';
            }}
          />
        </label>
      )}

      {estado === 'error' && mensaje && (
        <div role="alert" style={{ fontSize: '12px', color: 'var(--cp-rust, #B2500F)' }}>
          {mensaje}
        </div>
      )}
    </div>
  );
}
