import { VoucherResumenChat } from '../vouchers/tipos';
import { BurbujaMensaje } from './BurbujaMensaje';
import { MensajeItem } from './mensajesTipos';

export interface FlujoMensajesProps {
  mensajes: MensajeItem[];
  voucher?: VoucherResumenChat | null;
  puedeVer: boolean;
  onReintentar: (mensajeId: string) => void;
}

/** Flujo de la conversación: la lista llega del más antiguo al más nuevo; el contenedor muestra el más nuevo abajo. */
export function FlujoMensajes({ mensajes, voucher, puedeVer, onReintentar }: FlujoMensajesProps) {
  return (
    <div className="cv-msgs">
      {mensajes
        .slice()
        .reverse()
        .map((m) => (
          <BurbujaMensaje key={m.id} mensaje={m} voucher={voucher} puedeVer={puedeVer} onReintentar={onReintentar} />
        ))}
      <div className="cv-day">
        <span>HOY</span>
      </div>
    </div>
  );
}
