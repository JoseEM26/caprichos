import { useId, useState, type CSSProperties } from 'react';

/**
 * Para llevar por unidad: en un pedido de comer en el local (mesa o salón) cada línea dice cuántas de sus unidades
 * salen empacadas. El servidor guarda la marca por línea, así que al enviar una línea con N ≥ 2 unidades y k para
 * llevar (1 ≤ k ≤ N−1) se reparte en dos líneas: N−k aquí y k para llevar. Solo MESA y COMER_LOCAL la usan.
 */
export const modalidadPermiteParaLlevar = (modalidad: string | null | undefined): boolean => {
  const m = String(modalidad ?? '').toUpperCase();
  return m === 'MESA' || m === 'COMER_LOCAL';
};

type LineaConMarca = { cantidad: number; paraLlevar?: boolean; llevar?: number };

/** Unidades de la línea que van para llevar: `llevar` si se conoce; si no, toda la línea según la marca `paraLlevar`. */
export function unidadesParaLlevar(l: LineaConMarca): number {
  const n = Math.max(0, Number(l.cantidad) || 0);
  if (l.llevar !== undefined) return Math.min(n, Math.max(0, Math.trunc(l.llevar) || 0));
  return l.paraLlevar ? n : 0;
}

/** Cuántas unidades van para llevar y cuántas se comen aquí; `mezcla` = hay de los dos (solo entonces se resume). */
export function resumenParaLlevar(lineas: ReadonlyArray<LineaConMarca>) {
  let llevar = 0;
  let aqui = 0;
  for (const l of lineas) {
    const k = unidadesParaLlevar(l);
    llevar += k;
    aqui += (Number(l.cantidad) || 0) - k;
  }
  return { llevar, aqui, mezcla: llevar > 0 && aqui > 0 };
}

/**
 * ¿Se puede repartir la línea por unidades? Los combos, las mezclas de sabores y las líneas con oferta van completos
 * (cambian de marca en bloque), porque repartirlos cambiaría su precio o su armado.
 */
export function puedeRepartirLinea(l: {
  cantidad: number;
  bloqueada?: boolean;
  unidadesPorMezcla?: number;
  comboElecciones?: unknown[];
  ofertaId?: string;
}): boolean {
  return !l.bloqueada && l.unidadesPorMezcla === undefined && !(l.comboElecciones?.length ?? 0) && !l.ofertaId && l.cantidad >= 2;
}

/**
 * Parte una línea según sus unidades para llevar. Devuelve una línea (todo igual) o dos: la primera con N−k unidades
 * aquí y la segunda con k para llevar (paraLlevar: true). Los nombres de vaso se reparten en el mismo orden: las
 * primeras N−k aquí y las últimas k para llevar. Función pura: el payload del pedido la usa tal cual.
 */
export function repartirParaLlevar<T extends { cantidad: number; personas?: string[] }>(linea: T, llevar: number): Array<T & { paraLlevar?: true }> {
  const n = Math.max(0, Number(linea.cantidad) || 0);
  const k = Math.min(n, Math.max(0, Math.trunc(llevar) || 0));
  if (k === 0) return [{ ...linea }];
  if (k === n) return [{ ...linea, paraLlevar: true }];
  const nombres = linea.personas ?? [];
  const reparto = nombres.length > 0;
  return [
    { ...linea, cantidad: n - k, ...(reparto ? { personas: nombres.slice(0, n - k) } : {}) },
    { ...linea, cantidad: k, paraLlevar: true, ...(reparto ? { personas: nombres.slice(n - k) } : {}) },
  ];
}

const TOKEN = { navy: '#0B2C3E', crema: '#FBF4EC', naranja: '#E67929', dorado: '#D99E39' };

const BOTON_BASE: CSSProperties = {
  minHeight: 44,
  minWidth: 44,
  padding: '0 12px',
  border: `2px solid ${TOKEN.navy}`,
  borderRadius: 10,
  fontWeight: 800,
  fontSize: 13,
  cursor: 'pointer',
  background: '#fff',
  color: TOKEN.navy,
};

/** Stepper «− k +» de unidades para llevar, con «de N» al lado. Los botones son de 44 px (táctiles). */
export function StepperLlevar({
  valor,
  total,
  onCambiar,
  disabled = false,
  etiqueta = 'Unidades para llevar',
}: {
  valor: number;
  total: number;
  onCambiar: (valor: number) => void;
  disabled?: boolean;
  etiqueta?: string;
}) {
  const k = Math.min(total, Math.max(0, valor));
  const boton: CSSProperties = { ...BOTON_BASE, width: 44, padding: 0, borderRadius: 22, fontSize: 18 };
  return (
    <div role="group" aria-label={etiqueta} data-testid="llevar-stepper" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <button type="button" aria-label="Quitar una para llevar" data-testid="llevar-menos" disabled={disabled || k <= 0} onClick={() => onCambiar(k - 1)} style={boton}>
        −
      </button>
      <span data-testid="llevar-cuenta" style={{ minWidth: 60, textAlign: 'center', fontWeight: 800, fontSize: 14, color: TOKEN.navy }}>
        {k} de {total}
      </span>
      <button type="button" aria-label="Añadir una para llevar" data-testid="llevar-mas" disabled={disabled || k >= total} onClick={() => onCambiar(k + 1)} style={boton}>
        +
      </button>
    </div>
  );
}

/**
 * Selector de dónde se come una línea: «Comer aquí | 🥡 Para llevar» (todo) y, si la línea tiene 2 o más unidades y
 * se puede repartir, el stepper «Para llevar − k + de N». `llevar` es cuántas unidades van para llevar.
 */
export function SelectorParaLlevar({
  cantidad,
  llevar,
  onCambiar,
  disabled = false,
  dividible = true,
  etiqueta = 'Dónde se come',
}: {
  cantidad: number;
  llevar: number;
  onCambiar: (llevar: number) => void;
  disabled?: boolean;
  /** false = la línea va completa (combo, mezcla, oferta): sin stepper */
  dividible?: boolean;
  etiqueta?: string;
}) {
  const n = Math.max(0, Math.trunc(cantidad) || 0);
  const k = Math.min(n, Math.max(0, Math.trunc(llevar) || 0));
  const todas = n > 0 && k === n;
  const ninguna = k === 0;
  const opcion = (valor: boolean, texto: string) => {
    const activa = valor ? todas : ninguna;
    return (
      <button
        type="button"
        role="radio"
        aria-checked={activa}
        disabled={disabled}
        data-testid={valor ? 'para-llevar-si' : 'para-llevar-no'}
        onClick={() => {
          if (!activa) onCambiar(valor ? n : 0);
        }}
        style={{
          ...BOTON_BASE,
          flex: 1,
          border: 'none',
          borderRadius: 0,
          minHeight: 44,
          background: activa ? (valor ? TOKEN.naranja : TOKEN.navy) : TOKEN.crema,
          color: activa ? '#fff' : TOKEN.navy,
          opacity: disabled ? 0.55 : 1,
          cursor: disabled ? 'not-allowed' : 'pointer',
          padding: '0 10px',
          fontSize: 13,
        }}
      >
        {texto}
      </button>
    );
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <div
        role="radiogroup"
        aria-label={etiqueta}
        data-testid="selector-para-llevar"
        style={{ display: 'flex', border: `2px solid ${TOKEN.navy}`, borderRadius: 10, overflow: 'hidden', flex: '0 1 auto', minWidth: 0 }}
      >
        {opcion(false, 'Comer aquí')}
        <span aria-hidden="true" style={{ width: 2, background: TOKEN.navy }} />
        {opcion(true, '🥡 Para llevar')}
      </div>
      {dividible && n >= 2 && (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: TOKEN.navy }}>
          <span>Para llevar</span>
          <StepperLlevar valor={k} total={n} onCambiar={onCambiar} disabled={disabled} etiqueta={`Unidades para llevar: ${etiqueta}`} />
        </div>
      )}
    </div>
  );
}

/** Atajo «Todo para llevar» / «Todo aquí» del pedido completo. */
export function AtajoParaLlevar({ onTodo, disabled = false }: { onTodo: (paraLlevar: boolean) => void; disabled?: boolean }) {
  return (
    <div role="group" aria-label="Marcar todo el pedido" data-testid="atajo-para-llevar" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <button type="button" disabled={disabled} onClick={() => onTodo(true)} style={{ ...BOTON_BASE, background: TOKEN.naranja, color: '#fff', borderColor: TOKEN.naranja, flex: '1 1 140px' }}>
        Todo para llevar
      </button>
      <button type="button" disabled={disabled} onClick={() => onTodo(false)} style={{ ...BOTON_BASE, background: TOKEN.crema, flex: '1 1 140px' }}>
        Todo aquí
      </button>
    </div>
  );
}

/** Chip «🥡 Para llevar» de una línea en Caja o cocina (solo lectura). */
export function ChipParaLlevar({ compacto = false }: { compacto?: boolean }) {
  return (
    <span
      data-testid="chip-para-llevar"
      style={{
        display: 'inline-block',
        padding: compacto ? '0 6px' : '2px 8px',
        borderRadius: 6,
        border: `1px solid ${TOKEN.naranja}`,
        background: '#FDE9D9',
        color: '#8A3A07',
        fontWeight: 800,
        fontSize: compacto ? 11 : 12,
        lineHeight: 1.5,
        whiteSpace: 'nowrap',
      }}
    >
      🥡 Para llevar
    </span>
  );
}

/** «2 para llevar · 4 aquí» en la cabecera del pedido; nada si todo va en la misma modalidad. */
export function ResumenParaLlevar({ lineas }: { lineas: ReadonlyArray<LineaConMarca> }) {
  const r = resumenParaLlevar(lineas);
  if (!r.mezcla) return null;
  return (
    <span data-testid="resumen-para-llevar" style={{ fontSize: 12, fontWeight: 800, color: '#8A3A07' }}>
      {r.llevar} para llevar · {r.aqui} aquí
    </span>
  );
}

/**
 * Diálogo «¿Cuántos para llevar?» de una línea ya guardada (Caja). Devuelve cuántas unidades van para llevar.
 */
export function DialogoCuantosLlevar({
  nombre,
  cantidad,
  llevar,
  enviando = false,
  onConfirmar,
  onCerrar,
}: {
  nombre: string;
  cantidad: number;
  llevar: number;
  enviando?: boolean;
  onConfirmar: (llevar: number) => void;
  onCerrar: () => void;
}) {
  const id = useId();
  const [valor, setValor] = useState(llevar);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${id}-titulo`}
      data-testid="dialogo-cuantos-llevar"
      style={{ position: 'fixed', inset: 0, background: 'rgba(11,44,62,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 80 }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onCerrar();
      }}
    >
      <div style={{ background: '#fff', borderRadius: 14, padding: 18, width: 'min(360px, 100%)', display: 'flex', flexDirection: 'column', gap: 12, boxShadow: '0 16px 40px rgba(11,44,62,0.35)' }}>
        <h3 id={`${id}-titulo`} style={{ margin: 0, fontSize: 17, fontWeight: 800, color: TOKEN.navy }}>
          ¿Cuántos para llevar?
        </h3>
        <div style={{ fontSize: 13, color: TOKEN.navy }}>
          De {cantidad} unidad{cantidad === 1 ? '' : 'es'} de «{nombre}». Las que no van para llevar se quedan aquí.
        </div>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <StepperLlevar valor={valor} total={cantidad} onCambiar={setValor} disabled={enviando} etiqueta="Unidades para llevar" />
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button type="button" onClick={onCerrar} disabled={enviando} style={{ ...BOTON_BASE, background: TOKEN.crema, minHeight: 44 }}>
            Cancelar
          </button>
          <button
            type="button"
            disabled={enviando || valor === llevar}
            onClick={() => onConfirmar(valor)}
            style={{ ...BOTON_BASE, background: TOKEN.naranja, borderColor: TOKEN.naranja, color: '#fff', minHeight: 44 }}
          >
            {enviando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

