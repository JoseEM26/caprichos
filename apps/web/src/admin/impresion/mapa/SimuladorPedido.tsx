import type { ClavePieza, Escenario, Modalidad, PiezaFlujo, Salida } from './flujo';

const OPCIONES: Array<{ id: string; titulo: string; ayuda: string; modalidad: Modalidad }> = [
  { id: 'SALON', titulo: 'Salón', ayuda: 'Pedido en mesa', modalidad: 'MESA' },
  { id: 'LLEVAR', titulo: 'Para llevar', ayuda: 'Lo recoge el cliente', modalidad: 'LLEVAR' },
  { id: 'DELIVERY', titulo: 'Delivery', ayuda: 'Lo lleva un repartidor', modalidad: 'DELIVERY' },
];

/** Textos de ejemplo para dibujar cada pieza: no son pedidos reales. */
const EJEMPLO: Record<ClavePieza, [string, string, string]> = {
  BEBIDA: ['LIMONADA', 'Vaso 1 de 2', 'Pedido A-1024'],
  RESUMEN: ['TOTAL S/ 38.50', 'Para llevar', 'Pedido A-1024'],
  AREA: ['SALADOS', '1 × Sándwich de pollo', 'Pedido A-1024'],
  COMANDA: ['COMANDA · Mesa 4', '2 × Café latte grande', 'Sin azúcar'],
  PAGO: ['TICKET DE PAGO', 'Total S/ 38.50', 'Pedido A-1024'],
};

/** Miniatura SVG sencilla de la pieza (texto de ejemplo, no el sticker real). */
function MiniPieza({ clave }: { clave: ClavePieza }) {
  const [l1, l2, l3] = EJEMPLO[clave];
  const ancho = clave === 'COMANDA' || clave === 'PAGO' ? 'ticket' : 'sticker';
  return (
    <svg className={`sim-mini sim-mini--${ancho}`} viewBox="0 0 170 96" role="img" aria-label={`Ejemplo de ${clave.toLowerCase()}: ${l1}, ${l2}`}>
      <rect x="3" y="3" width="164" height="90" rx="10" fill="var(--cp-white)" stroke="var(--cp-navy)" strokeWidth="2" />
      <text x="14" y="34" fontSize="15" fontWeight="800" fill="var(--cp-navy)">{l1}</text>
      <text x="14" y="58" fontSize="12" fill="var(--cp-soft)">{l2}</text>
      <text x="14" y="78" fontSize="10" fill="var(--cp-soft)">{l3}</text>
    </svg>
  );
}

function textoSalida(s: Salida): string {
  if (s.cae) return 'Caja (el área no tiene equipo)';
  if (s.sinEquipo) return 'Ningún equipo: no sale';
  if (s.espera) return `${s.nombreDestino} (espera: equipo sin conexión o sin papel)`;
  return s.nombreDestino;
}

/** Selector visual del pedido y la tira de lo que saldría. Solo lectura: no guarda nada. */
export function SimuladorPedido({
  escenario,
  flujo,
  onCambiar,
}: {
  escenario: Escenario;
  flujo: PiezaFlujo[];
  onCambiar: (e: Escenario) => void;
}) {
  const salen = flujo.filter((p) => p.sale);
  const no = flujo.filter((p) => !p.sale);

  return (
    <section className="mapa-simulador" aria-labelledby="sim-titulo">
      <h3 id="sim-titulo" className="mapa-subtitulo">Simulador: ¿qué sale con un pedido?</h3>
      <div className="sim-controles">
        <div role="radiogroup" aria-label="Tipo de pedido" className="sim-opciones">
          {OPCIONES.map((o) => {
            const sel = escenario.modalidad === o.modalidad;
            return (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={sel}
                className={`sim-opcion ${sel ? 'sim-opcion--sel' : ''}`}
                onClick={() => onCambiar({ ...escenario, modalidad: o.modalidad })}
              >
                <span className="sim-opcion-titulo">{o.titulo}</span>
                <span className="sim-opcion-ayuda">{o.ayuda}</span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={escenario.conBebidas}
          className={`sim-bebidas ${escenario.conBebidas ? 'sim-bebidas--on' : ''}`}
          onClick={() => onCambiar({ ...escenario, conBebidas: !escenario.conBebidas })}
        >
          Lleva bebidas: {escenario.conBebidas ? 'sí' : 'no'}
        </button>
      </div>

      <ul className="sim-tira" aria-label="Piezas que salen con este pedido">
        {salen.map((p) => (
          <li key={p.clave} className="sim-pieza">
            <MiniPieza clave={p.clave} />
            <strong>{p.titulo}</strong>
            <span>Sale en: {p.salidas.length ? p.salidas.map(textoSalida).join(', ') : 'sin equipo asignado'}</span>
          </li>
        ))}
      </ul>
      {no.length > 0 && (
        <p className="sim-no">
          No sale: {no.map((p) => `${p.titulo.toLowerCase()} (${p.motivo.toLowerCase()})`).join('; ')}.
        </p>
      )}
      <p className="sim-nota">
        El simulador supone que el pedido tiene productos de cada área y las bebidas que indicas. Los textos de la tira son de ejemplo.
      </p>
    </section>
  );
}
