import { ofertaIncluyeCanal } from '../../ofertas/ofertas.util';

interface OfertaConCanales {
  tipo?: string;
  activo?: boolean;
  vigenteAhora?: boolean;
  disponible?: boolean;
  canales?: string[] | null;
}

/**
 * Promociones vigentes hoy que NO valen por WhatsApp (casilla «WhatsApp (bot)» apagada), para que el bot las
 * nombre y mande a la carta en vez de ofrecerlas por el chat:
 *  - soloWeb: valen en la carta web (y a veces también en el local); `tambienLocal` lo indica.
 *  - soloLocal: valen solo en el local (caja, mozo).
 * Una oferta con WhatsApp nunca sale aquí. Un combo agotado o fuera de horario tampoco.
 */
export function ofertasFueraDeWhatsapp<T extends OfertaConCanales>(todas: T[] | null | undefined): {
  soloWeb: (T & { tambienLocal: boolean })[];
  soloLocal: T[];
} {
  const lista = (todas ?? []).filter(
    (o) => o.activo !== false && o.vigenteAhora !== false && !(o.tipo === 'COMBO' && o.disponible === false) && !ofertaIncluyeCanal(o.canales, 'BOT'),
  );
  const web = (o: T) => ofertaIncluyeCanal(o.canales, 'CARTA');
  const local = (o: T) => ofertaIncluyeCanal(o.canales, 'ADMIN');
  return {
    soloWeb: lista.filter(web).map((o) => ({ ...o, tambienLocal: local(o) })),
    soloLocal: lista.filter((o) => local(o) && !web(o)),
  };
}
