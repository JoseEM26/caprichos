import React, { useState } from 'react';

const BOTON: React.CSSProperties = {
  minHeight: 44, padding: '0 14px', border: '1.5px solid var(--cp-navy, #0B2C3E)', borderRadius: 10,
  background: 'transparent', color: 'var(--cp-navy, #0B2C3E)', fontWeight: 800, fontSize: 12, cursor: 'pointer',
};

export interface ItemElegible {
  clave: string;
  texto: string;
  enCola?: boolean;
  /** Encabezado del grupo («Bebidas», «Ticket de pago»…); sin él, la lista va sin grupos. */
  grupo?: string;
  /** Vista previa de la pieza: se muestra al pulsar «Ver». */
  vista?: React.ReactNode;
}

/**
 * Casillas para elegir cuáles piezas reimprimir (stickers, comandas, ticket): una fila por pieza, agrupadas, con
 * vista previa y el contador de hojas. Compartido por el diálogo rápido de Caja, la pestaña Etiquetas y la cola.
 */
export function SelectorEtiquetas({ items, elegidas, alCambiar }: { items: ItemElegible[]; elegidas: string[]; alCambiar: (c: string[]) => void }) {
  const [abierta, setAbierta] = useState<string | null>(null);
  const grupos: Array<{ nombre?: string; items: ItemElegible[] }> = [];
  for (const it of items) {
    const g = grupos.find((x) => x.nombre === it.grupo);
    if (g) g.items.push(it);
    else grupos.push({ nombre: it.grupo, items: [it] });
  }
  const marcar = (claves: string[], si: boolean) =>
    alCambiar(si ? [...elegidas, ...claves.filter((c) => !elegidas.includes(c))] : elegidas.filter((c) => !claves.includes(c)));
  const n = elegidas.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '55vh', overflowY: 'auto' }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" style={BOTON} onClick={() => alCambiar(items.map((e) => e.clave))}>Marcar todos</button>
        <button type="button" style={BOTON} onClick={() => alCambiar([])}>Marcar ninguno</button>
      </div>
      <p role="status" style={{ margin: 0, fontSize: 13, fontWeight: 800 }}>
        {n === 0 ? 'No se imprimirá nada: marca lo que quieres' : `Se imprimirán ${n} ${n === 1 ? 'hoja' : 'hojas'}`}
      </p>
      {grupos.map((g) => {
        const claves = g.items.map((i) => i.clave);
        const todos = claves.every((c) => elegidas.includes(c));
        return (
          <fieldset key={g.nombre ?? 'sin-grupo'} style={{ border: 0, padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
            {g.nombre && (
              <legend style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', fontSize: 13, fontWeight: 800, padding: 0 }}>
                <span style={{ flex: 1 }}>{g.nombre} ({claves.length})</span>
                <button type="button" style={BOTON} aria-label={`${todos ? 'Quitar' : 'Marcar'} todo: ${g.nombre}`} onClick={() => marcar(claves, !todos)}>
                  {todos ? 'Quitar grupo' : 'Marcar grupo'}
                </button>
              </legend>
            )}
            {g.items.map((e) => (
              <div key={e.clave} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', minHeight: 44 }}>
                  <label style={{ display: 'flex', gap: 10, alignItems: 'center', cursor: 'pointer', fontSize: 13, fontWeight: 700, flex: 1, minWidth: 0, minHeight: 44 }}>
                    <input
                      type="checkbox"
                      style={{ width: 22, height: 22 }}
                      checked={elegidas.includes(e.clave)}
                      onChange={(ev) => alCambiar(ev.target.checked ? [...elegidas, e.clave] : elegidas.filter((c) => c !== e.clave))}
                    />
                    <span style={{ flex: 1, minWidth: 0 }}>{e.texto}</span>
                    {e.enCola && <span style={{ fontSize: 11, fontWeight: 600 }}>ya en cola</span>}
                  </label>
                  {e.vista && (
                    <button type="button" style={BOTON} aria-expanded={abierta === e.clave} aria-label={`Vista previa de ${e.texto}`} onClick={() => setAbierta(abierta === e.clave ? null : e.clave)}>
                      {abierta === e.clave ? 'Ocultar' : 'Ver'}
                    </button>
                  )}
                </div>
                {e.vista && abierta === e.clave && <div style={{ overflowX: 'auto', maxWidth: '100%' }}>{e.vista}</div>}
              </div>
            ))}
          </fieldset>
        );
      })}
    </div>
  );
}
