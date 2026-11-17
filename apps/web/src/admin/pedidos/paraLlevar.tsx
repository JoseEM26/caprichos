import type { CSSProperties } from 'react';

/**
 * Para llevar por línea: en un pedido de comer en el local (mesa o salón) algunos productos salen empacados
 * y el resto se come aquí. Solo aplica a MESA y COMER_LOCAL; delivery y recoger no la usan.
 */
export const modalidadPermiteParaLlevar = (modalidad: string | null | undefined): boolean => {
  const m = String(modalidad ?? '').toUpperCase();
  return m === 'MESA' || m === 'COMER_LOCAL';
};

/** Cuántas unidades van para llevar y cuántas se comen aquí; `mezcla` = hay de los dos (solo entonces se resume). */
export function resumenParaLlevar(lineas: ReadonlyArray<{ cantidad: number; paraLlevar?: boolean }>) {
  const llevar = lineas.filter((l) => l.paraLlevar).reduce((a, l) => a + (Number(l.cantidad) || 0), 0);
  const aqui = lineas.filter((l) => !l.paraLlevar).reduce((a, l) => a + (Number(l.cantidad) || 0), 0);
  return { llevar, aqui, mezcla: llevar > 0 && aqui > 0 };
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

/** Interruptor «Comer aquí | Para llevar» de una línea (segmentado, 44 px, accesible por teclado). */
export function SelectorParaLlevar({
  paraLlevar,
  onCambiar,
  disabled = false,
  etiqueta = 'Dónde se come',
}: {
  paraLlevar: boolean;
  onCambiar: (paraLlevar: boolean) => void;
  disabled?: boolean;
  etiqueta?: string;
}) {
  const opcion = (valor: boolean, texto: string) => {
    const activa = paraLlevar === valor;
    return (
      <button
        type="button"
        role="radio"
        aria-checked={activa}
        disabled={disabled}
        data-testid={valor ? 'para-llevar-si' : 'para-llevar-no'}
        onClick={() => {
          if (!activa) onCambiar(valor);
        }}
        style={{
          ...BOTON_BASE,
          flex: 1,
          border: 'none',
          borderRadius: 0,
          background: activa ? (valor ? TOKEN.naranja : TOKEN.navy) : TOKEN.crema,
          color: activa ? '#fff' : TOKEN.navy,
          opacity: disabled ? 0.55 : 1,
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        {texto}
      </button>
    );
  };
  return (
    <div
      role="radiogroup"
      aria-label={etiqueta}
      data-testid="selector-para-llevar"
      style={{
        display: 'flex',
        border: `2px solid ${TOKEN.navy}`,
        borderRadius: 10,
        overflow: 'hidden',
        width: '100%',
        maxWidth: 260,
      }}
    >
      {opcion(false, 'Comer aquí')}
      <span aria-hidden="true" style={{ width: 2, background: TOKEN.navy }} />
      {opcion(true, '🥡 Para llevar')}
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

/** Chip «🥡 Para llevar» de una línea en Caja o cocina. */
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
export function ResumenParaLlevar({ lineas }: { lineas: ReadonlyArray<{ cantidad: number; paraLlevar?: boolean }> }) {
  const r = resumenParaLlevar(lineas);
  if (!r.mezcla) return null;
  return (
    <span data-testid="resumen-para-llevar" style={{ fontSize: 12, fontWeight: 800, color: '#8A3A07' }}>
      {r.llevar} para llevar · {r.aqui} aquí
    </span>
  );
}
