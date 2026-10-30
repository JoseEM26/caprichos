import type { AreaProgreso, ProgresoPedido as Progreso } from './tipos';
import './progreso-pedido.css';

/**
 * Estado de cocina y entrega de un pedido. Lo usan «Mis pedidos» del mozo y el seguimiento de la carta,
 * con la misma función de la API (progresoDelPedido): nunca calcula el estado por su cuenta.
 * «compacto» para la tarjeta (etiqueta y barra); «completo» para el detalle (línea de tiempo y áreas).
 */

const PASOS_DELIVERY = ['Recibido', 'Cocina', 'Listo', 'En camino', 'Entregado'];
const PASOS_RECOGER = ['Recibido', 'Cocina', 'Listo', 'Entregado'];

const TEXTO_AREA: Record<AreaProgreso['estado'], string> = {
  LISTA: 'lista',
  PREPARANDO: 'preparando',
  PENDIENTE: 'pendiente',
};

/** Posición de la etapa actual en la línea de tiempo (-1 si no aplica, como en anulado). */
function indiceActual(progreso: Progreso, pasos: string[]): number {
  switch (progreso.etapa) {
    case 'RECIBIDO':
      return 0;
    case 'EN_COCINA':
    case 'PARCIAL':
      return 1;
    case 'LISTO':
    case 'ESPERANDO_CLIENTE':
      return 2;
    case 'EN_CAMINO':
      return pasos.length === PASOS_DELIVERY.length ? 3 : 2;
    case 'ENTREGADO':
      return pasos.length - 1;
    default:
      return -1;
  }
}

interface Props {
  progreso?: Progreso | null;
  modalidad: string;
  variante: 'compacto' | 'completo';
  /** Sin la línea de tiempo: para quien ya muestra sus pasos (la carta). */
  sinLinea?: boolean;
}

export function ProgresoPedido({ progreso, modalidad, variante, sinLinea = false }: Props) {
  if (!progreso) return null;
  const anulado = progreso.etapa === 'ANULADO';
  const pasos = modalidad === 'DELIVERY' ? PASOS_DELIVERY : PASOS_RECOGER;
  const actual = indiceActual(progreso, pasos);
  const completo = variante === 'completo';

  return (
    <div className={`pp pp--${variante}`} data-etapa={progreso.etapa}>
      {completo && !sinLinea && !anulado && actual >= 0 && (
        <ol className="pp-linea" aria-label="Etapas del pedido">
          {pasos.map((nombre, i) => (
            <li
              key={nombre}
              className={`pp-paso${i < actual ? ' pp-paso--hecho' : ''}${i === actual ? ' pp-paso--actual' : ''}`}
              aria-current={i === actual ? 'step' : undefined}
            >
              <span className="pp-punto" aria-hidden="true" />
              <span className="pp-paso-etiq">{nombre}</span>
            </li>
          ))}
        </ol>
      )}

      <p className="pp-etiqueta">{progreso.etiqueta}</p>

      {!anulado && progreso.totalAreas > 0 && (
        <div
          className="pp-barra"
          role="progressbar"
          aria-label="Avance de cocina"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progreso.porcentaje}
          aria-valuetext={`${progreso.listasDe} de ${progreso.totalAreas} áreas listas`}
        >
          <span className="pp-barra-relleno" style={{ width: `${progreso.porcentaje}%` }} />
        </div>
      )}

      {completo && !anulado && progreso.areas.length > 0 && (
        <ul className="pp-areas" aria-label="Estado por área">
          {progreso.areas.map((area) => (
            <li key={area.nombre}>
              <span className={`pp-area pp-area--${area.estado.toLowerCase()}`}>
                {area.nombre}: {TEXTO_AREA[area.estado]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
