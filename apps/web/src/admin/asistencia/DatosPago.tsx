import { Boton } from '../../comun/Boton';
import { Insignia } from '../../comun/Insignia';
import { copiarAlPortapapeles } from '../comprobantes/utilidades';
import type { PagoPersona } from './planillaApi';

/** Celular y medio de pago (Yape, Plin…) de la persona (dato personal, solo ADMIN) con botón de copiar. */
export function DatosPago({ pago, onOk }: { pago: PagoPersona; onOk: (m: string | null) => void }) {
  if (!pago.celular && !pago.medio) return <small className="as-nota">Sin datos de pago</small>;
  return (
    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      {pago.medio && <Insignia variante="neutro">{pago.medio}</Insignia>}
      {pago.celular && (
        <>
          <span className="as-num">{pago.celular}</span>
          <Boton type="button" variante="secundario" tamano="pequeno" aria-label="Copiar el número de pago" onClick={() => void copiarAlPortapapeles(pago.celular!).then((ok) => onOk(ok ? 'Número copiado.' : 'No se pudo copiar el número.'))}>Copiar</Boton>
        </>
      )}
    </span>
  );
}
