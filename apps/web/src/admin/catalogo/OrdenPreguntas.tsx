import { KeyboardEvent, PointerEvent, useEffect, useRef, useState } from 'react';

export interface PreguntaOrden { id: string; nombre: string }

const PULSACION_MS = 350;

/**
 * Lista ordenable de las preguntas que se le hacen al cliente en un producto.
 * Asa «⠿» (arrastrar con mouse; en táctil, pulsación larga), botones ▲ ▼ (44 px) y teclado (Alt+↑/↓ en el asa).
 * `alMover(desde, hasta)` recibe índices; `movidoId` marca la última pregunta movida (borde suave).
 */
export function OrdenPreguntas({ preguntas, movidoId, alMover, alRestablecer, puedeRestablecer, deshabilitado }: {
  preguntas: PreguntaOrden[];
  movidoId?: string | null;
  alMover: (desde: number, hasta: number) => void;
  alRestablecer?: () => void;
  puedeRestablecer?: boolean;
  deshabilitado?: boolean;
}) {
  const filas = useRef<Array<HTMLLIElement | null>>([]);
  const asas = useRef<Record<string, HTMLButtonElement | null>>({});
  const enfocar = useRef<string | null>(null);
  const arrastre = useRef<{ desde: number; sobre: number; temporizador?: ReturnType<typeof setTimeout>; activo: boolean } | null>(null);
  const [vista, setVista] = useState<{ desde: number; sobre: number } | null>(null);

  useEffect(() => {
    if (enfocar.current) { asas.current[enfocar.current]?.focus(); enfocar.current = null; }
  });
  useEffect(() => () => clearTimeout(arrastre.current?.temporizador), []);

  const mover = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= preguntas.length) return;
    enfocar.current = preguntas[i].id;
    alMover(i, j);
  };

  const indiceBajo = (y: number): number => {
    let mejor = 0;
    filas.current.forEach((f, k) => {
      if (f && y >= f.getBoundingClientRect().top + f.getBoundingClientRect().height / 2) mejor = k;
    });
    return mejor;
  };

  const empezar = (i: number, e: PointerEvent<HTMLButtonElement>) => {
    if (deshabilitado || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const objetivo = e.currentTarget;
    const pid = e.pointerId;
    const activar = () => {
      if (!arrastre.current) return;
      arrastre.current.activo = true;
      try { objetivo.setPointerCapture?.(pid); } catch { /* sin captura */ }
      setVista({ desde: i, sobre: i });
    };
    arrastre.current = { desde: i, sobre: i, activo: false };
    // mouse y lápiz arrastran al instante; el dedo necesita pulsación larga para no pelear con el scroll
    if (e.pointerType === 'touch') arrastre.current.temporizador = setTimeout(activar, PULSACION_MS);
    else activar();
  };
  const mientras = (e: PointerEvent<HTMLButtonElement>) => {
    const a = arrastre.current;
    if (!a || !a.activo) return;
    a.sobre = indiceBajo(e.clientY);
    setVista({ desde: a.desde, sobre: a.sobre });
  };
  const terminar = (cancelado: boolean) => {
    const a = arrastre.current;
    if (!a) return;
    clearTimeout(a.temporizador);
    arrastre.current = null;
    setVista(null);
    if (a.activo && !cancelado && a.sobre !== a.desde) {
      enfocar.current = preguntas[a.desde]?.id ?? null;
      alMover(a.desde, a.sobre);
    }
  };

  const teclas = (i: number, e: KeyboardEvent<HTMLButtonElement>) => {
    if (deshabilitado || !e.altKey) return;
    if (e.key === 'ArrowUp') { e.preventDefault(); mover(i, -1); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); mover(i, 1); }
  };

  return (
    <section className="eo-orden" aria-label="Orden de las preguntas">
      <div className="eo-orden-cab">
        <b>Orden en que se le pregunta al cliente</b>
        {alRestablecer && (
          <button type="button" className="eo-btn eo-mini" disabled={!puedeRestablecer || deshabilitado} onClick={alRestablecer}>Restablecer orden</button>
        )}
      </div>
      <div className="eo-micro">Arrastra el asa ⠿ (en celular, mantén pulsado), usa ▲ ▼ o Alt+↑/↓. El orden se guarda con «Guardar cambios». El tamaño siempre se pregunta primero.</div>
      <ol className="eo-orden-lista">
        {preguntas.map((p, i) => {
          const sobre = vista && vista.sobre === i && vista.desde !== i;
          return (
            <li key={p.id} ref={(el) => { filas.current[i] = el; }} data-testid="fila-pregunta" data-grupo-id={p.id}
              className={`eo-orden-fila${movidoId === p.id ? ' eo-movido' : ''}${vista?.desde === i ? ' eo-arrastrando' : ''}${sobre ? ' eo-destino' : ''}`}>
              <button type="button" className="eo-asa" aria-label={`Arrastrar ${p.nombre}. Alt más flecha arriba o abajo para mover`}
                disabled={deshabilitado}
                onPointerDown={(e) => empezar(i, e)} onPointerMove={mientras}
                onPointerUp={() => terminar(false)} onPointerCancel={() => terminar(true)}
                onKeyDown={(e) => teclas(i, e)}
                ref={(el) => { asas.current[p.id] = el; }}>⠿</button>
              <span className="eo-orden-num" data-testid="num-fila">{i + 1}ª pregunta</span>
              <span className="eo-orden-nombre">{p.nombre}</span>
              <button type="button" className="eo-btn eo-mini" aria-label={`Subir ${p.nombre}`} disabled={deshabilitado || i === 0} onClick={() => mover(i, -1)}>▲</button>
              <button type="button" className="eo-btn eo-mini" aria-label={`Bajar ${p.nombre}`} disabled={deshabilitado || i === preguntas.length - 1} onClick={() => mover(i, 1)}>▼</button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
