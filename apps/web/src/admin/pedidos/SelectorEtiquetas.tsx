import React from 'react';

const BOTON: React.CSSProperties = {
  minHeight: 44, padding: '0 14px', border: '1.5px solid var(--cp-navy, #0B2C3E)', borderRadius: 10,
  background: 'transparent', color: 'var(--cp-navy, #0B2C3E)', fontWeight: 800, fontSize: 12, cursor: 'pointer',
};

export interface ItemElegible {
  clave: string;
  texto: string;
  enCola?: boolean;
}

/** Casillas para elegir cuáles stickers reimprimir (compartido por la pestaña Etiquetas y el diálogo rápido de Caja). */
export function SelectorEtiquetas({ items, elegidas, alCambiar }: { items: ItemElegible[]; elegidas: string[]; alCambiar: (c: string[]) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '50vh', overflowY: 'auto' }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" style={BOTON} onClick={() => alCambiar(items.map((e) => e.clave))}>Marcar todos</button>
        <button type="button" style={BOTON} onClick={() => alCambiar([])}>Marcar ninguno</button>
      </div>
      {items.map((e) => (
        <label key={e.clave} style={{ display: 'flex', gap: 10, alignItems: 'center', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
          <input
            type="checkbox"
            checked={elegidas.includes(e.clave)}
            onChange={(ev) => alCambiar(ev.target.checked ? [...elegidas, e.clave] : elegidas.filter((c) => c !== e.clave))}
          />
          <span style={{ flex: 1, minWidth: 0 }}>{e.texto}</span>
          {e.enCola && <span style={{ fontSize: 11, fontWeight: 600 }}>ya en cola</span>}
        </label>
      ))}
    </div>
  );
}
