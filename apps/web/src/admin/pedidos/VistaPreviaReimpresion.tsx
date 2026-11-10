import { lineasTicketComandaSalon } from '@caprichos/compartido';
import type { PapelReimpresion } from '../impresion/impresionApi';
import { EtiquetaArea, EtiquetaBebida, EtiquetaGeneral, TicketPagoPrevia } from './EtiquetaPrevia';

/** Un papel tal como saldrá, con las mismas previas que ya usa Caja (sticker, ticket de pago, comanda). */
function Papel({ p }: { p: PapelReimpresion }) {
  const d = p.payload;
  if (!d) return <p className="rp-prev-vacio">Sin vista previa de este papel.</p>;
  if (p.tipo === 'ETIQUETA_GENERAL') return <EtiquetaGeneral datos={d} />;
  if (p.tipo === 'ETIQUETA_AREA') return <EtiquetaArea datos={d} />;
  if (p.tipo === 'ETIQUETA_BEBIDA') return <EtiquetaBebida datos={d} />;
  if (p.tipo === 'TICKET_PAGO') return <TicketPagoPrevia datos={d} sinCabecera />;
  if (p.tipo.startsWith('TICKET_COMANDA')) {
    const lineas = lineasTicketComandaSalon(d, 32);
    return (
      <pre className="rp-prev-ticket" aria-label={`Vista previa de ${p.etiqueta}`}>
        {lineas.map((l, i) => (
          <span key={i} style={{ display: 'block', textAlign: l.centrado ? 'center' : 'left', fontWeight: l.negrita ? 800 : 400 }}>
            {l.texto || ' '}
          </span>
        ))}
      </pre>
    );
  }
  return <p className="rp-prev-vacio">Sin vista previa de este papel.</p>;
}

/** Lo que se va a imprimir, papel por papel, con la computadora/impresora de cada uno. Se ve antes de confirmar. */
export function VistaPreviaReimpresion({ papeles }: { papeles: PapelReimpresion[] }) {
  return (
    <div className="rp-prev" data-testid="rp-vista-previa" role="region" aria-label="Vista previa de lo que se imprimirá">
      {papeles.map((p, i) => (
        <figure key={`${p.tipo}-${i}`} className="rp-prev-papel">
          <figcaption>
            <b>{p.etiqueta}</b> · {p.equipo}
            {p.impresora ? ` / ${p.impresora}` : ''}
          </figcaption>
          <Papel p={p} />
        </figure>
      ))}
    </div>
  );
}
