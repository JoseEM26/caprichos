import { ReactNode, useEffect, useRef } from 'react';
import type { PasoAsistente } from './pasosCombo';
import './asistente-combo.css';

export interface AsistenteComboProps {
  /** false: se muestra `children` tal cual (armado plano, sin pasos). */
  activo: boolean;
  /** Vista previa del panel: se puede ir a cualquier paso sin elegir nada. */
  navegacionLibre?: boolean;
  /** Decisiones del armado (el resumen se agrega aquí). */
  pasos: PasoAsistente[];
  /** Paso actual; pasos.length = resumen. Controlado por la ventana. */
  indice: number;
  alCambiarIndice: (i: number) => void;
  /** Bebida dentro de un paso con varias (sub-progreso). Controlado por la ventana. */
  subIndice?: number;
  alCambiarSub?: (k: number) => void;
  /** Nombre del producto (cabecera del paso). */
  titulo: string;
  precio: number;
  /** Una línea corta de lo elegido hasta ahora (se trunca con puntos suspensivos). */
  resumen: string;
  /** Tarjeta de resumen en texto (solo en el último paso). */
  resumenTexto?: ReactNode;
  /** Selector de cantidad (solo en el último paso). */
  cantidad?: ReactNode;
  puedeAgregar: boolean;
  /** Texto del botón de agregar cuando no se puede (el motivo). */
  textoAgregar: string;
  alAgregar: () => void;
  /** Avisos del pie (stock, sabores) que ya calcula la ventana. */
  avisosPie?: ReactNode;
  /** Botón de cerrar de la ventana (PC): va en la cabecera, junto a «Paso N de M». */
  cerrar?: ReactNode;
  /** Contenido de la ventana: cada bloque se muestra solo en su paso (la ventana filtra). */
  children: ReactNode;
}

/**
 * Asistente por pasos del armado de un combo (carta y mozo): cabecera con el nombre y «Paso N de M», stepper con
 * círculos, un paso a la vez, «Siguiente» que dice qué falta, avance automático en una selección única, volver sin
 * perder nada y un resumen final en texto con el precio. No guarda las elecciones: las tiene la ventana.
 */
export function AsistenteCombo({
  activo, navegacionLibre = false, pasos, indice, alCambiarIndice, subIndice = 0, alCambiarSub, titulo, precio, resumen, resumenTexto, cantidad,
  puedeAgregar, textoAgregar, alAgregar, avisosPie, cerrar, children,
}: AsistenteComboProps) {
  const previos = useRef<Record<string, boolean>>({});
  const total = pasos.length + 1; // + resumen
  const idx = Math.min(indice, pasos.length);
  const enResumen = idx === pasos.length;
  const actual = enResumen ? undefined : pasos[idx];
  const slots = actual?.slots && actual.slots.length > 1 ? actual.slots : undefined;
  const sub = slots ? Math.min(subIndice, slots.length - 1) : 0;
  const slotActual = slots?.[sub];
  const hechoActual = slotActual ? slotActual.hecho : !!actual?.hecho;
  const faltaActual = slotActual ? slotActual.falta : actual?.falta;
  const siguienteOk = navegacionLibre || !actual || hechoActual || !!actual.opcional;
  const motivo = actual && !siguienteOk ? faltaActual : null;
  const pendientes = pasos.map((p, i) => ({ p, i })).filter(({ p }) => !p.hecho && !p.opcional);

  // Una selección única completada pasa sola al siguiente paso (o a la siguiente bebida): solo cuando pasa de pendiente a hecha.
  useEffect(() => {
    if (!activo) return;
    const antes = previos.current;
    const ahora: Record<string, boolean> = {};
    for (const p of pasos) {
      if (p.slots) for (const s of p.slots) ahora[s.id] = s.hecho;
      else ahora[p.id] = p.hecho;
    }
    const clave = slotActual ? slotActual.id : actual?.id;
    if (actual?.avanzaSolo && clave && antes[clave] === false && hechoActual) {
      if (slots && sub < slots.length - 1 && alCambiarSub) alCambiarSub(sub + 1);
      else alCambiarIndice(Math.min(idx + 1, pasos.length));
    }
    previos.current = ahora;
  });

  if (!activo) return <>{children}</>;

  const alcanzable = (i: number): boolean => navegacionLibre || i <= idx || pasos.slice(0, i).every((p) => p.hecho || p.opcional);
  const items = [
    ...pasos.map((p) => ({ id: p.id, etiqueta: p.etiqueta, hecho: p.hecho, opcional: !!p.opcional })),
    { id: 'resumen', etiqueta: 'Resumen', hecho: false, opcional: false },
  ];
  const atras = () => {
    if (slots && sub > 0 && alCambiarSub) alCambiarSub(sub - 1);
    else alCambiarIndice(Math.max(idx - 1, 0));
  };
  const siguiente = () => {
    if (slots && sub < slots.length - 1 && alCambiarSub) alCambiarSub(sub + 1);
    else alCambiarIndice(Math.min(idx + 1, pasos.length));
  };
  const primeraSinHacer = slots ? slots.findIndex((s) => !s.hecho) : -1;

  return (
    <>
      <nav className="ac-progreso" aria-label="Pasos del armado" data-testid="progreso-asistente">
        <div className="ac-cabecera">
          <span className="ac-nombre-combo" title={titulo}>{titulo}</span>
          <strong className="ac-paso-n" data-testid="paso-texto">{`Paso ${idx + 1} de ${total}`}</strong>
          {cerrar}
        </div>
        <ol className="ac-stepper">
          {items.map((p, i) => {
            const esActual = i === idx;
            const estado = p.hecho ? 'hecho' : esActual ? 'actual' : 'pendiente';
            return (
              <li key={p.id} className="ac-step" data-estado={estado}>
                <button
                  type="button"
                  className="ac-circulo"
                  aria-current={esActual ? 'step' : undefined}
                  aria-label={`Paso ${i + 1}: ${p.etiqueta}${p.hecho ? ', listo' : p.opcional ? ', opcional' : ', pendiente'}`}
                  disabled={!alcanzable(i)}
                  onClick={() => alCambiarIndice(i)}
                >
                  {p.hecho ? '✓' : i + 1}
                </button>
                <span className="ac-etiqueta" aria-hidden="true">{p.etiqueta}</span>
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
          <section aria-label="Resumen de tu combo" data-testid="resumen-pasos" className="ac-resumen" aria-live="polite">
            <h3 className="ac-h">Revisa tu combo</h3>
            {pendientes.length > 0 && (
              <div role="status" className="ac-falta" data-testid="falta-resumen">
                <span>{`Falta: ${pendientes.slice(0, 2).map(({ p }) => p.falta ?? p.titulo).join(' · ')}${pendientes.length > 2 ? ` +${pendientes.length - 2} más` : ''}`}</span>
                <button type="button" className="ac-link" onClick={() => alCambiarIndice(pendientes[0].i)}>Completar</button>
              </div>
            )}
            <div className="ac-tarjeta-pedido" data-testid="texto-resumen">{resumenTexto ?? <p>{resumen}</p>}</div>
            {cantidad && (
              <div className="ac-fila-cantidad">
                <span>Cantidad</span>
                {cantidad}
              </div>
            )}
            <div className="ac-cambiar-fila">
              {pasos.map((p, i) => (
                <button key={p.id} type="button" className="ac-cambiar" onClick={() => alCambiarIndice(i)}>
                  {`Cambiar ${p.etiqueta.toLowerCase()}`}
                </button>
              ))}
            </div>
            <div className="ac-total">
              <span>Total</span>
              <strong data-testid="total-resumen">{`S/ ${precio.toFixed(2)}`}</strong>
            </div>
          </section>
        ) : (
          <>
            <h3 className="ac-h" data-testid="titulo-paso">{actual?.titulo}</h3>
            {slots && (
              <div className="ac-sub" data-testid="sub-progreso">
                <span className="ac-sub-texto">{`Bebida ${sub + 1} de ${slots.length}`}</span>
                <div className="ac-puntos">
                  {slots.map((s, k) => (
                    <button
                      key={s.id}
                      type="button"
                      className="ac-punto"
                      data-hecho={s.hecho ? 'si' : 'no'}
                      aria-current={k === sub ? 'step' : undefined}
                      aria-label={`${s.etiqueta}${s.hecho ? ', lista' : ', pendiente'}`}
                      disabled={!alCambiarSub || (primeraSinHacer >= 0 && k > primeraSinHacer)}
                      onClick={() => alCambiarSub?.(k)}
                    >
                      {s.hecho ? '✓' : k + 1}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {children}
          </>
        )}
      </div>

      <div className="ac-pie" data-testid="pie-asistente">
        {!enResumen && (
          <div className="ac-fila-resumen">
            <p className="ac-resumen-linea" title={resumen} data-testid="resumen-asistente">
              {resumen || 'Aún no has elegido nada'}
            </p>
            <strong className="ac-precio">{`S/ ${precio.toFixed(2)}`}</strong>
          </div>
        )}
        {motivo && <div role="status" className="ac-motivo" data-testid="motivo-siguiente">{motivo}</div>}
        {avisosPie}
        <div className="ac-botones">
          <button type="button" className="ac-sec" disabled={idx === 0 && sub === 0} onClick={atras}>
            Atrás
          </button>
          {enResumen ? (
            <button type="button" className="ac-pri" data-testid="boton-agregar-asistente" disabled={!puedeAgregar} onClick={alAgregar}>
              {puedeAgregar ? 'Agregar al pedido' : textoAgregar} · S/ {precio.toFixed(2)}
            </button>
          ) : (
            <button type="button" className="ac-pri" disabled={!siguienteOk} onClick={siguiente}>
              Siguiente
            </button>
          )}
        </div>
      </div>
    </>
  );
}
