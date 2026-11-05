import type { ClavePieza, Escenario, Modalidad, PiezaFlujo, Salida } from './flujo';

const OPCIONES: Array<{ id: string; titulo: string; ayuda: string; modalidad: Modalidad }> = [
  { id: 'SALON', titulo: 'Salón', ayuda: 'Pedido en mesa', modalidad: 'MESA' },
  { id: 'LLEVAR', titulo: 'Para llevar', ayuda: 'Lo recoge el cliente', modalidad: 'LLEVAR' },
  { id: 'DELIVERY', titulo: 'Delivery', ayuda: 'Lo lleva un repartidor', modalidad: 'DELIVERY' },
];

/** Textos de ejemplo para dibujar cada pieza en la tira: no son pedidos reales. */
const EJEMPLO: Record<ClavePieza, [string, string]> = {
  BEBIDA: ['LIMONADA', 'Vaso 1 de 2'],
  RESUMEN: ['TOTAL S/ 38.50', 'Para llevar'],
  AREA: ['SALADOS', '1 × Sándwich de pollo'],
  COMANDA: ['COMANDA · Mesa 4', '2 × Café latte'],
  COMANDA_AREA: ['COMANDA · SALADOS', '1 × Sándwich de pollo'],
  PAGO: ['TICKET DE PAGO', 'Total S/ 38.50'],
};

/** Miniatura SVG sencilla de la pieza en la tira (texto de ejemplo, no el sticker real). */
function MiniPieza({ clave }: { clave: ClavePieza }) {
  const [l1, l2] = EJEMPLO[clave];
  const ancho = clave === 'COMANDA' || clave === 'PAGO' ? 'ticket' : 'sticker';
  return (
    <svg className={`sim-mini sim-mini--${ancho}`} viewBox="0 0 170 96" role="img" aria-label={`Miniatura de ${clave.toLowerCase()}: ${l1}`}>
      <rect x="3" y="3" width="164" height="90" rx="10" fill="var(--cp-white)" stroke="var(--cp-navy)" strokeWidth="2" />
      <text x="14" y="38" fontSize="15" fontWeight="800" fill="var(--cp-navy)">{l1}</text>
      <text x="14" y="62" fontSize="12" fill="var(--cp-soft)">{l2}</text>
      <text x="14" y="82" fontSize="10" fill="var(--cp-soft)">EJEMPLO</text>
    </svg>
  );
}

function textoSalida(s: Salida): string {
  if (s.cae) return 'Caja (el área no tiene equipo)';
  if (s.sinEquipo) return 'Ningún equipo: no sale';
  if (s.espera) return `${s.nombreDestino} (espera: equipo sin conexión o sin papel)`;
  return s.nombreDestino;
}

/** Arriba del mapa: elige un tipo de pedido y mira qué se imprime. Solo lectura: no guarda nada. */
export function SimuladorPedido({
  escenario,
  onCambiar,
}: {
  escenario: Escenario;
  onCambiar: (e: Escenario) => void;
}) {
  return (
    <section className="mapa-simulador" aria-labelledby="sim-titulo">
      <h3 id="sim-titulo" className="mapa-subtitulo">Elige un tipo de pedido y mira qué se imprime</h3>
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
    </section>
  );
}

/** Debajo del mapa: lo que saldría con ese pedido, con miniaturas. */
export function TiraSaldria({ flujo }: { flujo: PiezaFlujo[] }) {
  const salen = flujo.filter((p) => p.sale);
  const no = flujo.filter((p) => !p.sale);
  return (
    <section className="mapa-saldria" aria-labelledby="saldria-titulo">
      <h3 id="saldria-titulo" className="mapa-subtitulo">Lo que saldría</h3>
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
      <p className="sim-nota">Supone que el pedido tiene productos de cada área y las bebidas que indicas. Bebidas no lleva sticker por área. Los textos de las miniaturas son de ejemplo.</p>
    </section>
  );
}
