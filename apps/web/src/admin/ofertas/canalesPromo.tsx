/**
 * Canales de las ofertas (Descuento, Lleva y paga, Combo, Envío gratis y Cupón).
 * Un solo selector «¿Dónde aplica?» con tres casillas: Carta web, En el local (caja y mozo) y WhatsApp (bot).
 * Se guarda en `canales` como CARTA, ADMIN (local) y BOT. Valores históricos al leer: TODOS = carta y local,
 * WEB = carta, CAJA/MOZO/LOCAL = local, WHATSAPP = BOT.
 */

export type TipoOfertaCanal = 'DESCUENTO' | 'LLEVA_PAGA' | 'COMBO' | 'ENVIO_GRATIS' | 'CUPON';

/** ¿Para qué tipo de pedido? Todas marcadas = sin restricción (se guarda vacío). */
export interface ModalidadesEstado {
  local: boolean;
  llevar: boolean;
  recoger: boolean;
  delivery: boolean;
}

export interface CanalesEstado {
  carta: boolean;
  local: boolean;
  bot: boolean;
  /** Los cupones no lo usan. Ausente = todas. */
  modalidades?: ModalidadesEstado;
}

const TODAS_MODALIDADES: ModalidadesEstado = { local: true, llevar: true, recoger: true, delivery: true };
const CLAVE_MODALIDAD: Record<keyof ModalidadesEstado, string> = { local: 'COMER_LOCAL', llevar: 'LLEVAR', recoger: 'RECOGER', delivery: 'DELIVERY' };
export const ETIQUETA_MODALIDAD: Record<keyof ModalidadesEstado, string> = { local: 'Comer en el local', llevar: 'Para llevar', recoger: 'Recoger', delivery: 'Delivery' };
const CHIP_MODALIDAD: Record<keyof ModalidadesEstado, string> = { local: 'Comer aquí', llevar: 'Llevar', recoger: 'Recoger', delivery: 'Delivery' };
const ICONO_MODALIDAD: Record<keyof ModalidadesEstado, string> = { local: '🍽️', llevar: '🥡', recoger: '🏪', delivery: '🛵' };
const ORDEN_MODALIDADES = Object.keys(CLAVE_MODALIDAD) as (keyof ModalidadesEstado)[];

/** Casillas a partir de lo guardado: vacío = todas. */
export function estadoDesdeModalidades(guardadas: string[] | null | undefined): ModalidadesEstado {
  const n = (guardadas || []).map((m) => m.toUpperCase());
  if (n.length === 0) return { ...TODAS_MODALIDADES };
  return { local: n.includes('COMER_LOCAL'), llevar: n.includes('LLEVAR'), recoger: n.includes('RECOGER'), delivery: n.includes('DELIVERY') };
}

/** Lo que se guarda: todas marcadas = [] (sin restricción). */
export function modalidadesDesdeEstado(e: ModalidadesEstado | undefined): string[] {
  if (!e || ORDEN_MODALIDADES.every((k) => e[k])) return [];
  return ORDEN_MODALIDADES.filter((k) => e[k]).map((k) => CLAVE_MODALIDAD[k]);
}

/** Chips de la tarjeta y del resumen: vacío si no hay restricción. */
export function chipsModalidades(guardadas: string[] | null | undefined): string[] {
  const e = estadoDesdeModalidades(guardadas);
  return (guardadas || []).length === 0 ? [] : ORDEN_MODALIDADES.filter((k) => e[k]).map((k) => CHIP_MODALIDAD[k]);
}

export const OPCIONES_FILTRO_MODALIDAD = [
  { valor: 'Todos', etiqueta: 'Todos' },
  { valor: 'COMER_LOCAL', etiqueta: 'Comer en el local' },
  { valor: 'LLEVAR', etiqueta: 'Para llevar' },
  { valor: 'RECOGER', etiqueta: 'Recoger' },
  { valor: 'DELIVERY', etiqueta: 'Delivery' },
];

/** Filtro de la lista: la oferta sin restricción (vacío) sale siempre; con restricción, solo si incluye esa modalidad. */
export function incluyeModalidadFiltro(modalidades: string[] | null | undefined, filtro: string): boolean {
  return filtro === 'Todos' || !modalidades || modalidades.length === 0 || modalidades.includes(filtro);
}

/** Canales y modalidades de una oferta que viene del servidor. */
export function estadoDesdeOferta(o: { canales?: string[] | null; modalidades?: string[] | null }): CanalesEstado {
  return { ...estadoDesdeCanales(o.canales), modalidades: estadoDesdeModalidades(o.modalidades) };
}

export const ERROR_SIN_MODALIDADES = 'Marca al menos un tipo de pedido: comer en el local, para llevar, recoger o delivery.';
export const ERROR_ENVIO_SIN_DELIVERY = 'El envío gratis solo vale en delivery: marca Delivery.';

/** Error del bloque «¿Para qué tipo de pedido?» (o null). */
export function errorModalidades(tipo: TipoOfertaCanal, e: CanalesEstado): string | null {
  const m = e.modalidades ?? TODAS_MODALIDADES;
  if (!ORDEN_MODALIDADES.some((k) => m[k])) return ERROR_SIN_MODALIDADES;
  if (tipo === 'ENVIO_GRATIS' && !m.delivery) return ERROR_ENVIO_SIN_DELIVERY;
  return null;
}

/** «Aplica en: Carta web y WhatsApp, solo para llevar y recoger» */
export function resumenAplica(e: CanalesEstado): string {
  const donde = [e.carta && 'Carta web', e.local && 'Caja/Mozo', e.bot && 'WhatsApp'].filter(Boolean) as string[];
  const lista = donde.length <= 1 ? donde[0] ?? 'ningún lugar' : `${donde.slice(0, -1).join(', ')} y ${donde[donde.length - 1]}`;
  const m = e.modalidades ?? TODAS_MODALIDADES;
  const cuales = ORDEN_MODALIDADES.filter((k) => m[k]);
  if (cuales.length === ORDEN_MODALIDADES.length) return `Aplica en: ${lista}, para todos los tipos de pedido`;
  if (cuales.length === 0) return `Aplica en: ${lista}, sin ningún tipo de pedido`;
  const nombres = cuales.map((k) => ({ local: 'comer en el local', llevar: 'para llevar', recoger: 'recoger', delivery: 'delivery' })[k]);
  const txt = nombres.length === 1 ? nombres[0] : `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;
  return `Aplica en: ${lista}, solo ${txt}`;
}

const ATAJOS: { id: string; etiqueta: string; valor: ModalidadesEstado }[] = [
  { id: 'salon', etiqueta: 'Solo salón', valor: { local: true, llevar: false, recoger: false, delivery: false } },
  { id: 'llevar', etiqueta: 'Solo para llevar', valor: { local: false, llevar: true, recoger: true, delivery: false } },
  { id: 'delivery', etiqueta: 'Solo delivery', valor: { local: false, llevar: false, recoger: false, delivery: true } },
  { id: 'todas', etiqueta: 'Todas', valor: TODAS_MODALIDADES },
];

/** Bloque «¿Para qué tipo de pedido?» con casillas grandes, atajos y resumen vivo. */
export function SelectorModalidades({ id, tipo, valor, onChange, bloqueado }: SelectorCanalesProps) {
  const m = valor.modalidades ?? TODAS_MODALIDADES;
  const error = errorModalidades(tipo, valor);
  const boton = (activa: boolean) => ({
    display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', minHeight: '44px', borderRadius: '12px', cursor: 'pointer', fontSize: '14px', fontWeight: 700,
    border: activa ? '2px solid var(--cp-orange)' : '1.5px solid var(--cp-line)', backgroundColor: activa ? 'var(--cp-sand)' : 'var(--cp-white)',
  }) as const;
  return (
    <fieldset data-testid={`${id}-modalidades`} style={{ border: 0, padding: 0, margin: '12px 0 0', display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <legend style={{ fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>¿Para qué tipo de pedido?</legend>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px' }}>
        {ORDEN_MODALIDADES.map((k) => (
          <label key={k} htmlFor={`${id}-mod-${k}`} style={boton(m[k])}>
            <input id={`${id}-mod-${k}`} type="checkbox" checked={m[k]} disabled={bloqueado} onChange={(e) => onChange({ ...valor, modalidades: { ...m, [k]: e.target.checked } })} />
            <span aria-hidden="true">{ICONO_MODALIDAD[k]}</span> {ETIQUETA_MODALIDAD[k]}
          </label>
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {ATAJOS.map((a) => (
          <button key={a.id} type="button" disabled={bloqueado} data-testid={`${id}-atajo-${a.id}`} onClick={() => onChange({ ...valor, modalidades: { ...a.valor } })}
            style={{ fontSize: '12px', fontWeight: 700, padding: '4px 10px', borderRadius: '999px', border: '1px solid var(--cp-line)', background: 'var(--cp-white)', cursor: 'pointer' }}>
            {a.etiqueta}
          </button>
        ))}
      </div>
      <span data-testid={`${id}-resumen-aplica`} style={{ fontSize: '12px', fontWeight: 700 }}>{resumenAplica(valor)}</span>
      {error && <span role="alert" data-testid={`${id}-error-modalidades`} style={{ fontSize: '12px', fontWeight: 700, color: '#B91C1C' }}>{error}</span>}
    </fieldset>
  );
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
      {tipo !== 'CUPON' && !bloqueado && <SelectorModalidades id={id} tipo={tipo} valor={valor} onChange={onChange} />}
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
