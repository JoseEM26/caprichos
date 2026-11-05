/**
 * Canales de las promociones (Descuento, Lleva y paga, Combo, Envío gratis).
 * El selector elige carta y/o local; la casilla «Vale también por WhatsApp (bot)» agrega BOT.
 * «WHATSAPP» (datos anteriores de «Solo WhatsApp») cuenta como BOT al leer.
 */

export const CANALES_SELECTOR = [
  { clave: 'todos', nombre: 'Carta web y en el local' },
  { clave: 'carta', nombre: 'Solo carta web' },
  { clave: 'local', nombre: 'Solo en el local' },
];

/** Dato viejo que solo valía por WhatsApp: se muestra solo cuando la promo ya está así. */
const SOLO_BOT_LEGADO = { clave: 'solo-bot', nombre: 'Solo WhatsApp (dato anterior)' };

export function opcionesCanal(canalActual: string) {
  return canalActual === 'solo-bot' ? [...CANALES_SELECTOR, SOLO_BOT_LEGADO] : CANALES_SELECTOR;
}

/** Canales que se guardan a partir del selector y la casilla. */
export function canalesDesdeSelector(canal: string, valeBot: boolean): string[] {
  if (canal === 'solo-bot') return ['BOT'];
  const base = canal === 'carta' ? ['CARTA'] : canal === 'local' ? ['ADMIN'] : ['CARTA', 'ADMIN'];
  return valeBot ? [...base, 'BOT'] : base;
}

/** Estado del selector y la casilla a partir de los canales guardados. */
export function selectorDesdeCanales(canales: string[] | null | undefined): { canal: string; valeBot: boolean } {
  const normas = (canales || []).map((c) => c.toUpperCase());
  const valeBot = normas.includes('BOT') || normas.includes('WHATSAPP');
  const sinBot = normas.filter((c) => c !== 'BOT' && c !== 'WHATSAPP');
  if (sinBot.length === 0 && valeBot) return { canal: 'solo-bot', valeBot: true };
  if (sinBot.includes('TODOS') || (sinBot.includes('CARTA') && sinBot.includes('ADMIN'))) return { canal: 'todos', valeBot };
  if (sinBot.includes('ADMIN')) return { canal: 'local', valeBot };
  return { canal: 'carta', valeBot };
}

interface CasillaBotProps {
  id: string;
  checked: boolean;
  onChange: (valor: boolean) => void;
  /** Solo WhatsApp (dato anterior): la casilla queda marcada y fija. */
  bloqueada?: boolean;
}

export function CasillaBot({ id, checked, onChange, bloqueada }: CasillaBotProps) {
  return (
    <label htmlFor={id} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', fontSize: '13px', fontWeight: 700 }}>
      <input
        id={id}
        type="checkbox"
        checked={checked || bloqueada === true}
        disabled={bloqueada === true}
        onChange={(e) => onChange(e.target.checked)}
      />
      Vale también por WhatsApp (bot)
    </label>
  );
}
