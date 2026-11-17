import { ReactNode, useEffect, useRef } from 'react';
import type { PasoAsistente } from './pasosCombo';
import './asistente-combo.css';

export interface AsistenteComboProps {
  /** false: se muestra `children` tal cual (armado plano, sin pasos). */
  activo: boolean;
  /** Decisiones del armado (el resumen se agrega aquí). */
  pasos: PasoAsistente[];
  /** Paso actual; pasos.length = resumen. Controlado por la ventana. */
  indice: number;
  alCambiarIndice: (i: number) => void;
  /** Nombre del producto (cabecera del paso). */
  titulo: string;
  precio: number;
  /** Línea «Regular 12 oz · Frappe Moca · …» de lo elegido hasta ahora. */
  resumen: string;
  puedeAgregar: boolean;
  /** Texto del botón de agregar en el resumen (o el motivo si no se puede). */
  textoAgregar: string;
  alAgregar: () => void;
  /** Avisos del pie (stock, sabores) que ya calcula la ventana. */
  avisosPie?: ReactNode;
  /** Contenido de la ventana: cada bloque se muestra solo en su paso (la ventana filtra). */
  children: ReactNode;
}

/**
 * Asistente por pasos del armado de un combo (carta y mozo): progreso fijo arriba, un paso a la vez,
 * «Siguiente» que dice qué falta, avance automático en una selección única, volver sin perder nada y un
 * resumen final con el precio. No guarda estado de las elecciones: lo tiene la ventana.
 */
export function AsistenteCombo({
  activo, pasos, indice, alCambiarIndice, titulo, precio, resumen, puedeAgregar, textoAgregar, alAgregar, avisosPie, children,
}: AsistenteComboProps) {
  const previos = useRef<Record<string, boolean>>({});
  const total = pasos.length + 1; // + resumen
  const idx = Math.min(indice, pasos.length);
  const enResumen = idx === pasos.length;
  const actual = enResumen ? undefined : pasos[idx];

  // Una selección única completada pasa sola al siguiente paso (solo cuando el paso pasa de pendiente a hecho).
  useEffect(() => {
    if (!activo) return;
    const antes = previos.current;
    if (actual?.avanzaSolo && antes[actual.id] === false && actual.hecho) alCambiarIndice(Math.min(idx + 1, pasos.length));
    previos.current = Object.fromEntries(pasos.map((p) => [p.id, p.hecho]));
  });

  if (!activo) return <>{children}</>;

  const alcanzable = (i: number): boolean => i <= idx || pasos.slice(0, i).every((p) => p.hecho || p.opcional);
  const siguienteOk = !actual || actual.hecho || !!actual.opcional;
  const motivo = actual && !siguienteOk ? actual.falta : null;

  return (
    <>
      <nav className="ac-progreso" aria-label="Pasos del armado" data-testid="progreso-asistente">
        <div className="ac-linea">
          <strong data-testid="paso-texto">{`Paso ${idx + 1} de ${total}`}</strong>
          <span className="ac-titulo-producto">{titulo}</span>
        </div>
        <ol className="ac-chips">
          {[...pasos.map((p) => ({ id: p.id, etiqueta: p.etiqueta, hecho: p.hecho, opcional: !!p.opcional })), { id: 'resumen', etiqueta: 'Resumen', hecho: false, opcional: false }].map((p, i) => {
            const esActual = i === idx;
            const hecho = p.hecho;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  className="ac-chip"
                  data-hecho={hecho ? 'si' : 'no'}
                  aria-current={esActual ? 'step' : undefined}
                  aria-label={`Paso ${i + 1}: ${p.etiqueta}${hecho ? ', listo' : p.opcional ? ', opcional' : ', pendiente'}`}
                  disabled={!alcanzable(i)}
                  onClick={() => alCambiarIndice(i)}
                >
                  {hecho ? '✓ ' : ''}
                  {p.etiqueta}
                </button>
              </li>
            );
          })}
        </ol>
        <div className="ac-barra" aria-hidden="true">
          <span style={{ width: `${(idx / (total - 1 || 1)) * 100}%` }} />
        </div>
      </nav>

      <div className="ac-cuerpo" data-testid="cuerpo-asistente">
        {enResumen ? (
          <section aria-label="Resumen de tu combo" data-testid="resumen-pasos">
            <h3 className="ac-h">Revisa tu combo</h3>
            <ul className="ac-lista-resumen">
              {pasos.map((p, i) => (
                <li key={p.id}>
                  <span className="ac-estado" data-hecho={p.hecho ? 'si' : 'no'}>{p.hecho ? '✓' : p.opcional ? '·' : '!'}</span>
                  <span className="ac-nombre-paso">{p.titulo}</span>
                  <button type="button" className="ac-cambiar" onClick={() => alCambiarIndice(i)}>Cambiar</button>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <>
            <h3 className="ac-h" data-testid="titulo-paso">{actual?.titulo}</h3>
            {children}
          </>
        )}
      </div>

      <div className="ac-pie" data-testid="pie-asistente">
        <div className="ac-resumen-linea" title={resumen} data-testid="resumen-asistente">
          {resumen || 'Aún no has elegido nada'}
        </div>
        {motivo && <div role="status" className="ac-motivo" data-testid="motivo-siguiente">{motivo}</div>}
        {avisosPie}
        <div className="ac-botones">
          <button type="button" className="ac-sec" disabled={idx === 0} onClick={() => alCambiarIndice(idx - 1)}>
            Atrás
          </button>
          {enResumen ? (
            <button type="button" className="ac-pri" data-testid="boton-agregar-asistente" disabled={!puedeAgregar} onClick={alAgregar}>
              {puedeAgregar ? 'Agregar al pedido' : textoAgregar} · S/ {precio.toFixed(2)}
            </button>
          ) : (
            <button type="button" className="ac-pri" disabled={!siguienteOk} onClick={() => alCambiarIndice(Math.min(idx + 1, pasos.length))}>
              Siguiente
            </button>
          )}
        </div>
      </div>
    </>
  );
}
