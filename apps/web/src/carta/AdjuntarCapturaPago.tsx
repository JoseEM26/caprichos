import { useEffect, useState } from 'react';
import { clienteFetch, ErrorApi } from '../comun/api';
import { reducirImagenVoucher } from '../admin/vouchers/reducirImagenVoucher';
import type { DatosLocalCarta } from './tipos';

export interface AdjuntarCapturaPagoProps {
  codigo: string;
  token: string;
  /** Solo pedidos con Yape, Plin o transferencia piden la captura. */
  pagoDigital: boolean;
  /** YAPE, PLIN o TRANSFERENCIA: con él se muestra a quién pagar (número, titular y monto). */
  medio?: string;
  /** Lo que debe pagar el cliente (venta más propina). */
  total?: number;
  /** Pago dividido: lo que falta pagar al recibir; `total` es entonces solo la parte digital. */
  restoAlRecibir?: number;
}

const CLAVE_MEDIO: Record<string, string> = { YAPE: 'yape', PLIN: 'plin', TRANSFERENCIA: 'transferencia' };
const NOMBRE_MEDIO: Record<string, string> = { YAPE: 'Yape', PLIN: 'Plin', TRANSFERENCIA: 'transferencia' };

/** Tarjeta «a quién pagar»: número o cuenta, titular y monto, con botón para copiar. */
export function DatosParaPagar({ medio, total, local, restoAlRecibir }: { medio: string; total?: number; local: DatosLocalCarta | null; restoAlRecibir?: number }) {
  const [copiado, setCopiado] = useState(false);
  const [copiadoCci, setCopiadoCci] = useState(false);
  const info = local?.mediosPago?.[CLAVE_MEDIO[medio] ?? ''];
  const destino = medio === 'TRANSFERENCIA' ? info?.cuenta || info?.cci : info?.numero;
  if (!destino) return null;
  const monto = total != null ? `S/ ${Number(total).toFixed(2)}` : null;
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(String(destino));
      setCopiado(true);
    } catch {
      /* sin portapapeles: el número queda visible para copiarlo a mano */
    }
  };
  return (
    <div
      data-testid="datos-para-pagar"
      style={{ backgroundColor: 'var(--cp-cream)', border: '2px solid var(--cp-navy)', borderRadius: '14px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '6px' }}
    >
      <div style={{ fontWeight: 800, fontSize: '15px', color: 'var(--cp-navy)' }}>Paga con {NOMBRE_MEDIO[medio] ?? medio}</div>
      {monto && <div style={{ fontWeight: 800, fontSize: '22px', color: 'var(--cp-rust)' }}>{monto}</div>}
      {restoAlRecibir != null && restoAlRecibir > 0 && (
        <div style={{ fontSize: '13px', color: 'var(--cp-navy)' }}>Los S/ {Number(restoAlRecibir).toFixed(2)} restantes los pagas al recibir tu pedido.</div>
      )}
      <div style={{ fontSize: '14px', color: 'var(--cp-navy)' }}>
        {medio === 'TRANSFERENCIA' ? `Cuenta${info?.banco ? ` ${info.banco}` : ''}: ` : monto ? 'Yapea a: ' : 'Número: '}
        <strong style={{ fontSize: '18px' }}>{destino}</strong>
      </div>
      {medio === 'TRANSFERENCIA' && info?.cci && info?.cuenta && (
        <div style={{ fontSize: '14px', color: 'var(--cp-navy)' }}>
          CCI: <strong style={{ fontSize: '16px' }}>{info.cci}</strong>{' '}
          <button
            type="button"
            onClick={() => void navigator.clipboard?.writeText(String(info.cci)).then(() => setCopiadoCci(true)).catch(() => undefined)}
            style={{ minHeight: '36px', marginLeft: '6px', padding: '0 10px', borderRadius: '8px', border: '1.5px solid var(--cp-navy)', background: 'transparent', fontWeight: 700, fontSize: '12px', color: 'var(--cp-navy)', cursor: 'pointer' }}
          >
            {copiadoCci ? 'Copiado' : 'Copiar CCI'}
          </button>
        </div>
      )}
      {info?.titular && <div style={{ fontSize: '13px' }}>A nombre de <strong>{info.titular}</strong></div>}
      <button
        type="button"
        onClick={() => void copiar()}
        style={{ minHeight: '44px', borderRadius: '10px', border: '1.5px solid var(--cp-navy)', background: 'transparent', fontWeight: 700, fontSize: '13px', color: 'var(--cp-navy)', cursor: 'pointer' }}
      >
        {copiado ? 'Copiado' : medio === 'TRANSFERENCIA' ? 'Copiar cuenta' : 'Copiar número'}
      </button>
      <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>Sube tu captura aquí o por WhatsApp (opcional).</div>
    </div>
  );
}

/**
 * Captura del pago desde la pantalla de seguimiento. Opcional: el pedido ya está en cocina
 * y el equipo revisa la captura. La respuesta no muestra semáforo ni datos extraídos.
 */
export function AdjuntarCapturaPago({ codigo, token, pagoDigital, medio, total, restoAlRecibir }: AdjuntarCapturaPagoProps) {
  const [estado, setEstado] = useState<'inicial' | 'subiendo' | 'recibida' | 'error'>('inicial');
  const [mensaje, setMensaje] = useState<string>('');
  const [local, setLocal] = useState<DatosLocalCarta | null>(null);

  useEffect(() => {
    if (!pagoDigital || !medio) return;
    clienteFetch<DatosLocalCarta>('/carta/local').then(setLocal).catch(() => setLocal(null));
  }, [pagoDigital, medio]);

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

  const waDigitos = String(local?.whatsapp ?? '').replace(/\D/g, '');
  const waNum = waDigitos.length === 9 ? `51${waDigitos}` : waDigitos;

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
      {medio && <DatosParaPagar medio={medio} total={total} local={local} restoAlRecibir={restoAlRecibir} />}
      <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--cp-navy)' }}>
        Envía la captura de tu pago (opcional)
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
          {estado === 'subiendo' ? 'Subiendo imagen…' : 'Adjuntar captura'}
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

      {waNum && (
        <a
          href={`https://wa.me/${waNum}?text=${encodeURIComponent(`Hola, mi pedido ${codigo}, adjunto mi voucher`)}`}
          target="_blank"
          rel="noreferrer"
          style={{ minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '10px', fontWeight: 700, fontSize: '13px', color: 'var(--cp-navy)', textDecoration: 'underline' }}
        >
          Enviar captura por WhatsApp
        </a>
      )}

      {estado === 'error' && mensaje && (
        <div role="alert" style={{ fontSize: '12px', color: 'var(--cp-rust, #B2500F)' }}>
          {mensaje}
        </div>
      )}
    </div>
  );
}
