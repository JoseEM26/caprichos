import { FotoAmpliable } from '../vouchers/FotoAmpliable';
import { TarjetaLecturaVoucher } from '../vouchers/TarjetaLecturaVoucher';
import { VoucherResumenChat } from '../vouchers/tipos';
import { MensajeItem } from './mensajesTipos';
import { TarjetaUbicacion } from './TarjetaUbicacion';

/** Foto del chat (voucher): privada, con miniatura y pantalla completa */
function FotoMensaje({
  archivoId,
  voucher,
  puedeVer = true,
}: {
  archivoId?: string | null;
  voucher?: VoucherResumenChat | null;
  puedeVer?: boolean;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <FotoAmpliable archivoId={archivoId} alt="Foto enviada por el cliente" />
      {voucher && puedeVer && <TarjetaLecturaVoucher voucher={voucher} puedeVer={puedeVer} />}
    </div>
  );
}

export interface BurbujaMensajeProps {
  mensaje: MensajeItem;
  voucher?: VoucherResumenChat | null;
  puedeVer: boolean;
  onReintentar: (mensajeId: string) => void;
}

/** Un mensaje del flujo: cliente, bot o equipo, con su estado de envío. */
export function BurbujaMensaje({ mensaje: m, voucher, puedeVer, onReintentar }: BurbujaMensajeProps) {
  const esCliente = m.autor === 'CLIENTE';
  const esBot = m.autor === 'BOT';
  const bg = esCliente ? '#FFFFFF' : esBot ? '#E1F3FB' : '#D9FDD3';
  const alineacion = esCliente ? 'flex-start' : 'flex-end';
  return (
    <div className="cv-bub" style={{ alignSelf: alineacion, background: bg }}>
      {!esCliente && (
        <div className="cv-who" style={{ color: esBot ? '#1F7A8C' : '#008069' }}>
          {esBot ? 'Capri (bot)' : 'Equipo'}
        </div>
      )}
      {m.imagen && (
        <FotoMensaje
          archivoId={m.imagenId}
          voucher={
            m.imagenId && voucher?.archivoId && String(m.imagenId) === String(voucher.archivoId) ? voucher : undefined
          }
          puedeVer={puedeVer}
        />
      )}
      {m.ubicacion ? <TarjetaUbicacion ubicacion={m.ubicacion} /> : <div className="cv-txt">{m.texto}</div>}
      <div className="cv-meta" style={{ flexWrap: 'wrap', gap: '6px' }}>
        <span>{m.hora}</span>
        {!esCliente && (
          <>
            {m.estado === 'FALLIDO' ? (
              <span
                style={{
                  color: '#C0392B',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>{m.motivoFallo ? `No se pudo enviar: ${m.motivoFallo}` : 'No se pudo enviar'}</span>
                <button
                  type="button"
                  onClick={() => onReintentar(m.id)}
                  style={{
                    border: '1px solid #C0392B',
                    background: '#FFFFFF',
                    color: '#C0392B',
                    borderRadius: '4px',
                    padding: '1px 6px',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Reintentar
                </button>
              </span>
            ) : m.estado === 'SIMULADO' ? (
              <span style={{ color: '#667781' }}>Modo simulado: no se envia a WhatsApp</span>
            ) : m.estado === 'LEIDO' ? (
              <span style={{ color: '#0284C7', fontWeight: 600 }}>Leido</span>
            ) : m.estado === 'ENTREGADO' ? (
              <span style={{ color: '#667781' }}>Entregado</span>
            ) : (
              <span style={{ color: '#667781' }}>Enviado</span>
            )}
          </>
        )}
      </div>
    </div>
  );
}
