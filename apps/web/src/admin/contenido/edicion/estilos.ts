/** Estilos del modo edición: contorno, barra flotante, texto editable y tarjeta fantasma. */
export const ESTILOS_EDICION = `
.ed-bloque { position: relative; display: flex; flex-direction: column; min-width: 0; }
.ed-bloque > .ed-contenido { display: flex; flex-direction: column; flex: 1 1 auto; min-width: 0; }
.ed-bloque > .ed-contenido > * { flex: 1 1 auto; }
.ed-bloque:hover { outline: 2px dashed color-mix(in srgb, var(--cp-orange) 70%, transparent); outline-offset: 2px; }
.ed-bloque[data-sel="1"] { outline: 3px solid var(--cp-orange); outline-offset: 2px; z-index: 5; }
.ed-bloque[data-sobre="1"] { outline: 3px solid var(--cp-navy); outline-offset: 2px; }
.ed-bloque[data-oculto="1"] > .ed-contenido { opacity: 0.4; }
.ed-oculta { position: absolute; right: 8px; top: 8px; z-index: 6; background: var(--cp-gold); color: var(--cp-navy); font-weight: 800; font-size: 11px; border-radius: 9999px; padding: 4px 10px; pointer-events: none; }
.ed-capa { position: absolute; z-index: 30; display: flex; flex-direction: column; gap: 6px; align-items: flex-start; }
.ed-capa--dentro { left: 6px; top: 6px; max-width: calc(100% - 12px); }
.ed-capa--debajo { left: 50%; top: 100%; transform: translateX(-50%); margin-top: 4px; width: max-content; max-width: 340px; align-items: center; }
.ed-barra { display: flex; flex-wrap: wrap; gap: 4px; background: var(--cp-navy); border-radius: 12px; padding: 4px; box-shadow: 0 8px 20px rgba(11,44,62,.35); }
.ed-etiqueta { color: var(--cp-cream); font-weight: 800; font-size: 11px; padding: 0 8px; min-height: 44px; display: inline-flex; align-items: center; }
.ed-btn { min-height: 44px; min-width: 44px; padding: 0 10px; border-radius: 9px; border: 1.5px solid var(--cp-cream); background: transparent; color: var(--cp-cream); font-weight: 700; font-size: 12px; cursor: pointer; font-family: inherit; }
.ed-btn:disabled { opacity: .35; cursor: default; }
.ed-btn:focus-visible { outline: 2px solid var(--cp-orange); }
.ed-btn--mover { cursor: grab; }
.ed-btn--peligro { border-color: #ffb4a8; color: #ffb4a8; }
.ed-pop { background: var(--cp-white); color: var(--cp-navy); border: 1px solid var(--cp-line); border-radius: 12px; padding: 12px; box-shadow: 0 10px 28px rgba(11,44,62,.3); display: flex; flex-direction: column; gap: 8px; min-width: 240px; max-width: 340px; font-size: 13px; }
.ed-pop label { display: flex; flex-direction: column; gap: 4px; font-weight: 700; font-size: 12px; }
.ed-pop input, .ed-pop select { min-height: 44px; box-sizing: border-box; border-radius: 10px; border: 1.5px solid var(--cp-line); padding: 0 10px; font-size: 14px; font-family: inherit; background: var(--cp-white); color: var(--cp-navy); }
.ed-pop-lista { max-height: 220px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; }
.ed-pop-lista button { min-height: 44px; text-align: left; border: 1.5px solid var(--cp-line); border-radius: 10px; background: var(--cp-white); color: var(--cp-navy); padding: 0 10px; font-weight: 600; cursor: pointer; font-family: inherit; }
.ed-pop-lista button[aria-pressed="true"] { border-color: var(--cp-orange); background: color-mix(in srgb, var(--cp-orange) 18%, var(--cp-white)); }
[data-edicion="texto"] { cursor: text; outline: none; border-radius: 4px; }
[data-edicion="texto"]:hover { box-shadow: 0 0 0 2px color-mix(in srgb, var(--cp-orange) 70%, transparent); }
[data-edicion="texto"]:focus { box-shadow: 0 0 0 3px var(--cp-orange); background: color-mix(in srgb, var(--cp-white) 14%, transparent); }
[data-edicion="texto"]:empty::before { content: attr(data-ph); opacity: .55; }
.ed-fantasma { min-height: 44px; box-sizing: border-box; border: 2px dashed var(--cp-soft); border-radius: 14px; background: color-mix(in srgb, var(--cp-white) 55%, transparent); color: var(--cp-navy); font-weight: 800; font-size: 14px; cursor: pointer; font-family: inherit; display: flex; align-items: center; justify-content: center; text-align: center; padding: 8px; }
.ed-fantasma:hover, .ed-fantasma:focus-visible { border-color: var(--cp-orange); background: color-mix(in srgb, var(--cp-orange) 14%, var(--cp-white)); }
`;
