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
  /** Piezas casi iguales (misma bebida, tamaño y opciones) comparten identidad: salen en una fila con «cuántas». */
  identidad?: string;
  /** Texto de la fila agrupada (sin número de vaso ni persona). */
  rotulo?: string;
  /** Vista previa de la pieza: se muestra al pulsar «Ver». */
  vista?: React.ReactNode;
}

/**
 * Casillas para elegir cuáles piezas reimprimir (stickers, comandas, ticket): una fila por pieza, agrupadas, con
 * vista previa y el contador de hojas. Compartido por el diálogo rápido de Caja, la pestaña Etiquetas y la cola.
 */
/** Claves de las piezas repetidas (2 o más casi iguales): por defecto salen todas, como pide la regla de reimpresión. */
export function clavesRepetidas(items: ItemElegible[]): string[] {
  const por = new Map<string, string[]>();
  for (const it of items) if (it.identidad) por.set(`${it.grupo}|${it.identidad}`, [...(por.get(`${it.grupo}|${it.identidad}`) ?? []), it.clave]);
  return [...por.values()].filter((c) => c.length > 1).flat();
}

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
  // Filas: cada pieza sola, salvo las casi iguales (misma identidad), que van juntas en una fila con «cuántas»
  const filasDe = (its: ItemElegible[]): ItemElegible[][] => {
    const filas: ItemElegible[][] = [];
    for (const it of its) {
      const f = it.identidad ? filas.find((x) => x[0].identidad === it.identidad) : undefined;
      if (f) f.push(it);
      else filas.push([it]);
    }
    return filas;
  };

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
            {filasDe(g.items).map((fila) => fila.length > 1 ? (
              <div key={fila[0].clave} style={{ display: 'flex', gap: 10, alignItems: 'center', minHeight: 44 }}>
                <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13, fontWeight: 700, flex: 1, minWidth: 0 }}>
                  <span style={{ flex: 1, minWidth: 0 }}>Hay {fila.length} stickers de {fila[0].rotulo ?? fila[0].texto}. ¿Cuántos?</span>
                  <select
                    aria-label={`Cuántos de ${fila[0].rotulo ?? fila[0].texto}`}
                    style={{ minHeight: 44, fontSize: 14, fontWeight: 800 }}
                    value={fila.filter((f) => elegidas.includes(f.clave)).length}
                    onChange={(ev) => alCambiar([...elegidas.filter((c) => !fila.some((f) => f.clave === c)), ...fila.slice(0, Number(ev.target.value)).map((f) => f.clave)])}
                  >
                    {Array.from({ length: fila.length + 1 }, (_, k) => <option key={k} value={k}>{k}</option>)}
                  </select>
                </label>
              </div>
            ) : fila.map((e) => (
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
            )))}
          </fieldset>
        );
      })}
    </div>
  );
}
