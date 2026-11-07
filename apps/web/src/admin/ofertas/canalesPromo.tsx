/**
 * Canales de las ofertas (Descuento, Lleva y paga, Combo, Envío gratis y Cupón).
 * Un solo selector «¿Dónde aplica?» con tres casillas: Carta web, En el local (caja y mozo) y WhatsApp (bot).
 * Se guarda en `canales` como CARTA, ADMIN (local) y BOT. Valores históricos al leer: TODOS = carta y local,
 * WEB = carta, CAJA/MOZO/LOCAL = local, WHATSAPP = BOT.
 */

export type TipoOfertaCanal = 'DESCUENTO' | 'LLEVA_PAGA' | 'COMBO' | 'ENVIO_GRATIS' | 'CUPON';

export interface CanalesEstado {
  carta: boolean;
  local: boolean;
  bot: boolean;
}

/** WhatsApp encendido por defecto en todo lo que el bot ya aplica o arma (el cupón no: el bot no pide códigos). */
export function canalesPorDefecto(tipo: TipoOfertaCanal): CanalesEstado {
  return { carta: true, local: true, bot: tipo !== 'CUPON' };
}

/** Estado de las casillas a partir de los canales guardados. */
export function estadoDesdeCanales(canales: string[] | null | undefined): CanalesEstado {
  const n = (canales || []).map((c) => c.toUpperCase());
  const todos = n.includes('TODOS');
  return {
    carta: todos || n.includes('CARTA') || n.includes('WEB'),
    local: todos || n.some((c) => ['ADMIN', 'CAJA', 'MOZO', 'LOCAL'].includes(c)),
    bot: n.includes('BOT') || n.includes('WHATSAPP'),
  };
}

/** Canales que se guardan a partir de las casillas. `valorLocal`: el cupón guarda CAJA en vez de ADMIN. */
export function canalesDesdeEstado(e: CanalesEstado, valorLocal = 'ADMIN'): string[] {
  return [...(e.carta ? ['CARTA'] : []), ...(e.local ? [valorLocal] : []), ...(e.bot ? ['BOT'] : [])];
}

export const ERROR_SIN_CANALES = 'Elige al menos un lugar donde aplica: carta web, en el local o WhatsApp.';

/** Texto de ayuda según el tipo y el estado de las casillas (cambia al marcar o desmarcar WhatsApp). */
export function ayudaCanales(tipo: TipoOfertaCanal, e: CanalesEstado): string {
  const donde = [e.carta && 'la carta web', e.local && 'el local (caja y mozo)', e.bot && 'WhatsApp'].filter(Boolean) as string[];
  if (donde.length === 0) return 'No aplica en ningún lugar: marca al menos uno.';
  const lista = donde.length === 1 ? donde[0] : `${donde.slice(0, -1).join(', ')} y ${donde[donde.length - 1]}`;
  const base = `Aplica en ${lista}.`;
  if (tipo === 'CUPON') return `${base} El bot de WhatsApp todavía no pide códigos de cupón, por eso no se puede activar por WhatsApp.`;
  if (!e.bot) return `${base} El bot de WhatsApp no la aplica ni la ofrece.`;
  const bot: Record<Exclude<TipoOfertaCanal, 'CUPON'>, string> = {
    ENVIO_GRATIS: 'El bot de WhatsApp no cobra envío en el delivery dentro del horario, días y fechas elegidos.',
    DESCUENTO: 'El bot de WhatsApp aplica este descuento al total del pedido y lo muestra en el resumen.',
    LLEVA_PAGA: 'El bot de WhatsApp aplica esta promoción al total del pedido y la muestra en el resumen.',
    COMBO: 'El bot de WhatsApp la ofrece en sus promociones y guía al cliente paso a paso para armarla (tamaño y elecciones), con el mismo stock y plan B de la carta.',
  };
  return `${base} ${bot[tipo]}`;
}

interface SelectorCanalesProps {
  /** Prefijo de los ids de las casillas: `${id}-carta`, `${id}-local`, `${id}-bot`. */
  id: string;
  tipo: TipoOfertaCanal;
  valor: CanalesEstado;
  onChange: (valor: CanalesEstado) => void;
  /** Para primera compra: solo carta web, el selector queda fijo. */
  bloqueado?: boolean;
}

export function SelectorCanales({ id, tipo, valor, onChange, bloqueado }: SelectorCanalesProps) {
  const botNoDisponible = tipo === 'CUPON';
  const casilla = { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, minHeight: '32px' } as const;
  const item = (clave: keyof CanalesEstado, etiqueta: string, desactivada = false) => (
    <label htmlFor={`${id}-${clave}`} style={casilla}>
      <input
        id={`${id}-${clave}`}
        type="checkbox"
        checked={valor[clave] && !desactivada}
        disabled={bloqueado || desactivada}
        onChange={(e) => onChange({ ...valor, [clave]: e.target.checked })}
      />
      {etiqueta}
    </label>
  );
  return (
    <fieldset
      data-testid={`${id}-canales`}
      style={{ border: 0, padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}
    >
      <legend style={{ fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>¿Dónde aplica?</legend>
      {item('carta', 'Carta web')}
      {item('local', 'En el local (caja y mozo)')}
      {item('bot', 'WhatsApp (bot)', botNoDisponible)}
      <span data-testid={`${id}-ayuda`} style={{ fontSize: '11px', lineHeight: '15px', color: 'var(--cp-soft)' }}>
        {bloqueado ? 'Solo en la carta web.' : ayudaCanales(tipo, botNoDisponible ? { ...valor, bot: false } : valor)}
      </span>
    </fieldset>
  );
}

interface SelectorVisibleCartaProps {
  id: string;
  /** true = la carta la muestra como «No disponible»; false = se oculta. */
  visibleCarta: boolean;
  onChange: (visibleCarta: boolean) => void;
}

/** Solo aplica mientras la oferta está desactivada. Se guarda en visible_carta. */
export function SelectorVisibleCarta({ id, visibleCarta, onChange }: SelectorVisibleCartaProps) {
  const opcion = { display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13px', fontWeight: 600 } as const;
  return (
    <fieldset style={{ border: 0, padding: 0, margin: '8px 0 0', display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <legend style={{ fontSize: '13px', fontWeight: 700, marginBottom: '4px' }}>Si está desactivada:</legend>
      <label htmlFor={`${id}-ocultar`} style={opcion}>
        <input id={`${id}-ocultar`} type="radio" name={id} checked={!visibleCarta} onChange={() => onChange(false)} />
        Ocultar de la carta
      </label>
      <label htmlFor={`${id}-no-disponible`} style={opcion}>
        <input id={`${id}-no-disponible`} type="radio" name={id} checked={visibleCarta} onChange={() => onChange(true)} />
        Mostrar como No disponible
      </label>
    </fieldset>
  );
}
