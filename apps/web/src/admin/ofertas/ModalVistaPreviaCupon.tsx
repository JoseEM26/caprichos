import { useMemo } from 'react';
import { lineasTicketPago, ticketPagoEjemploCupon } from '@caprichos/compartido';
import { ModalConPestanas } from '../../comun/ModalConPestanas';
import { Boton } from '../../comun/Boton';
import { LogoCaprichos } from '../pedidos/EtiquetaPrevia';
import { PapelTermico } from '../impresion/facil/PanelVistaPrevia';
import '../impresion/facil/panel-previa.css';
import type { CuponItem } from './ofertasApi';

/** «Ver cómo se imprime»: el voucher de ejemplo con el descuento de ESTE cupón (mismo dibujo que el ticket real). */
export function ModalVistaPreviaCupon({ cupon, onCerrar }: { cupon: CuponItem; onCerrar: () => void }) {
  const unico = cupon.modo === 'UNICO_COMPROBANTE';
  const lineas = useMemo(
    () =>
      lineasTicketPago(
        ticketPagoEjemploCupon({
          modo: cupon.modo,
          codigoBase: cupon.codigoBase,
          descuentoTipo: cupon.descuentoTipo ?? (cupon.tipo === 'PORCENTAJE' ? 'PORCENTAJE' : 'MONTO'),
          descuentoValor: Number(cupon.descuentoValor ?? cupon.valor ?? 0),
          descripcion: cupon.descripcion,
        }),
        48,
      ),
    [cupon],
  );
  return (
    <ModalConPestanas
      titulo={`Así se imprime el cupón ${cupon.codigoBase}`}
      subtitulo="Es un pedido de ejemplo, no es un pedido real"
      ancho={560}
      pestanas={[
        {
          id: 'voucher',
          etiqueta: 'Voucher',
          contenido: (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
              <p data-testid="nota-cupon-voucher" style={{ margin: 0, fontSize: 14, textAlign: 'center' }}>
                {unico
                  ? 'Este cupón sale impreso al pie del ticket, con un código distinto en cada comprobante (aquí uno de ejemplo).'
                  : 'Este cupón no imprime su código: solo aparece el descuento.'}
              </p>
              <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
                <LogoCaprichos />
                <PapelTermico lineas={lineas} columnas={48} zoom={1} etiqueta={`Ejemplo del voucher con el cupón ${cupon.codigoBase}`} />
              </div>
            </div>
          ),
        },
      ]}
      pie={<Boton variante="secundario" onClick={onCerrar}>Cerrar</Boton>}
      alCerrar={onCerrar}
    />
  );
}
