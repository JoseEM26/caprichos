import { useState } from 'react';
import { Boton } from '../../comun/Boton';
import type { DestinoDineroAnulacion } from '../pedidos/pedidosApi';

const MEDIOS = [
  ['EFECTIVO', 'Efectivo'],
  ['YAPE', 'Yape'],
  ['PLIN', 'Plin'],
  ['TRANSFERENCIA', 'Transferencia'],
  ['TARJETA', 'Tarjeta'],
] as const;

/** Cancelar desde Mensajes un pedido ya pagado: pide qué pasa con el dinero (devolver o reprogramar) antes de aplicar. */
export function ModalDestinoDinero({
  codigoPedido,
  enviando,
  error,
  alElegir,
  alCerrar,
}: {
  codigoPedido: string;
  enviando: boolean;
  error: string | null;
  alElegir: (d: DestinoDineroAnulacion) => void;
  alCerrar: () => void;
}) {
  const [destino, setDestino] = useState<'' | 'DEVOLVER' | 'REPROGRAMAR'>('');
  const [medio, setMedio] = useState('');
  const [monto, setMonto] = useState('');
  const [codigo, setCodigo] = useState('');
  const montoNum = Number(monto.replace(',', '.'));
  const completo = destino === 'REPROGRAMAR' || (destino === 'DEVOLVER' && medio !== '' && montoNum > 0 && (medio === 'EFECTIVO' || codigo.trim() !== ''));

  const confirmar = () => {
    if (destino === 'REPROGRAMAR') return alElegir({ destinoDinero: 'REPROGRAMAR' });
    alElegir({
      destinoDinero: 'DEVOLVER',
      devolucionMedio: medio,
      devolucionMonto: Math.round(montoNum * 100) / 100,
      ...(medio !== 'EFECTIVO' ? { devolucionCodigo: codigo.trim() } : {}),
    });
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Qué pasa con el dinero" style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(11,44,62,.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'var(--cp-white, #FFFFFF)', borderRadius: 16, padding: 20, maxWidth: 420, width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 17 }}>El pedido {codigoPedido} ya está pagado</h2>
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend style={{ fontWeight: 700, fontSize: 13 }}>¿Qué pasa con el dinero?</legend>
          <label style={{ display: 'flex', gap: 8, minHeight: 44, alignItems: 'center', fontSize: 13 }}>
            <input type="radio" name="destino-dinero-msg" checked={destino === 'DEVOLVER'} onChange={() => setDestino('DEVOLVER')} />
            Se devuelve al cliente
          </label>
          {destino === 'DEVOLVER' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: 13, fontWeight: 700 }}>
                Medio de la devolución
                <select value={medio} onChange={(e) => setMedio(e.target.value)} style={{ display: 'block', width: '100%', minHeight: 44 }}>
                  <option value="">Elige el medio…</option>
                  {MEDIOS.map(([v, t]) => (
                    <option key={v} value={v}>{t}</option>
                  ))}
                </select>
              </label>
              <label style={{ fontSize: 13, fontWeight: 700 }}>
                Monto devuelto (S/)
                <input type="text" inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} style={{ display: 'block', width: '100%', boxSizing: 'border-box', minHeight: 44 }} />
              </label>
              {medio !== '' && medio !== 'EFECTIVO' && (
                <label style={{ fontSize: 13, fontWeight: 700 }}>
                  Código de operación
                  <input type="text" value={codigo} onChange={(e) => setCodigo(e.target.value)} style={{ display: 'block', width: '100%', boxSizing: 'border-box', minHeight: 44 }} />
                </label>
              )}
            </div>
          )}
          <label style={{ display: 'flex', gap: 8, minHeight: 44, alignItems: 'center', fontSize: 13 }}>
            <input type="radio" name="destino-dinero-msg" checked={destino === 'REPROGRAMAR'} onChange={() => setDestino('REPROGRAMAR')} />
            Se reprograma el pedido (no se anula)
          </label>
        </fieldset>
        {error && <p role="alert" style={{ margin: 0, fontWeight: 700, color: 'var(--cp-rust, #B2500F)' }}>{error}</p>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Boton variante="secundario" onClick={alCerrar} disabled={enviando}>Cancelar</Boton>
          <Boton cargando={enviando} disabled={enviando || !completo} onClick={confirmar}>Aplicar cancelación</Boton>
        </div>
      </div>
    </div>
  );
}
