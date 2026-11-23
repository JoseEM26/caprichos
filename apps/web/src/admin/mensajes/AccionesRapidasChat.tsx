import { DetallePedidoChat } from './mensajesTipos';

/** Textos de los botones del chat. Misma redacción que el bot (bienvenida con carta y «envíanos la captura»). */
export const TEXTO_CARTA = 'Mira nuestra carta aquí: {{link_carta}} 🍰 Cuando quieras pedir, escríbenos y te ayudamos.';
export const TEXTO_VOUCHER = 'Para verificar tu pago, por favor envíanos la captura o foto de tu comprobante (puedes adjuntarla tocando el clip 📎 o la cámara).';

export function textoResumenPedido(p: DetallePedidoChat): string {
  const lineas = p.lineas.map((l) => `• ${l}`).join('\n');
  const medio = p.medio ? `\nMétodo de pago: ${p.medio}` : '';
  return `Resumen de tu pedido ${p.codigo} 🧾\n${lineas}\nTotal: S/ ${p.total}${medio}`;
}

export interface AccionesRapidasChatProps {
  pedido: DetallePedidoChat | null;
  /** Hay enlace público de la carta configurado. */
  hayLinkCarta: boolean;
  deshabilitado?: boolean;
  /** Pega el texto en el cuadro (nunca envía). `resolver` = reemplazar {{variables}}. */
  onPegar: (texto: string, resolver: boolean) => void;
}

const icono = (d: string) => (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
    <path d={d} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Fila de botones pequeños sobre el cuadro de escribir: cada uno pega un texto para revisarlo antes de enviar. */
export function AccionesRapidasChat({ pedido, hayLinkCarta, deshabilitado, onPegar }: AccionesRapidasChatProps) {
  return (
    <div className="msg-acciones-rapidas" role="group" aria-label="Acciones rápidas del chat">
      <button
        type="button"
        className="msg-icono-btn msg-ar"
        aria-label="Enviar carta"
        title={hayLinkCarta ? 'Pegar el enlace de la carta en el cuadro (lo revisas y lo envías tú)' : 'No hay enlace público de la carta configurado'}
        disabled={deshabilitado || !hayLinkCarta}
        onClick={() => onPegar(TEXTO_CARTA, true)}
      >
        {icono('M4 5h7a2 2 0 0 1 2 2v12a2 2 0 0 0-2-2H4zM20 5h-7')}
        <span className="msg-icono-txt">Carta</span>
      </button>
      <button
        type="button"
        className="msg-icono-btn msg-ar"
        aria-label="Enviar resumen del pedido"
        title={pedido ? `Pegar el resumen del pedido ${pedido.codigo}` : 'Este chat no tiene un pedido'}
        disabled={deshabilitado || !pedido}
        onClick={() => pedido && onPegar(textoResumenPedido(pedido), false)}
      >
        {icono('M7 3h10v18l-2.5-1.5L12 21l-2.5-1.5L7 21zM10 8h4M10 12h4')}
        <span className="msg-icono-txt">Resumen</span>
      </button>
      <button
        type="button"
        className="msg-icono-btn msg-ar"
        aria-label="Pedir voucher"
        title="Pegar el pedido de la captura del pago"
        disabled={deshabilitado}
        onClick={() => onPegar(pedido ? `${TEXTO_VOUCHER}\nPedido ${pedido.codigo} · Total S/ ${pedido.total}` : TEXTO_VOUCHER, false)}
      >
        {icono('M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM4 10h16M8 15h3')}
        <span className="msg-icono-txt">Voucher</span>
      </button>
    </div>
  );
}
