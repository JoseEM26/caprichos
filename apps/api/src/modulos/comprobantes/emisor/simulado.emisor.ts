import { armarComprobante, ComprobanteInvalidoError } from '../facturacion/facturacion.datos';
import { centsATexto } from '../facturacion/facturacion.calculo';
import { ComprobanteEmision, EmisorElectronico, ResultadoBaja, ResultadoEmision } from './emisor.tipos';

/** Emisor de prueba: nunca hace red. Todo queda marcado como SIMULADO. */
export class SimuladoEmisor implements EmisorElectronico {
  readonly proveedor = 'SIMULADO' as const;

  async generar(c: ComprobanteEmision): Promise<ResultadoEmision> {
    let armado;
    try {
      armado = armarComprobante(c.datos);
    } catch (e) {
      if (e instanceof ComprobanteInvalidoError) return { estado: 'RECHAZADO', respuesta: `Datos: ${e.motivo}`, simulado: true };
      throw e;
    }
    const total = centsATexto(armado.totales.totalCents);
    return {
      estado: 'EMITIDO_SUNAT',
      respuesta: 'SIMULADO: comprobante de prueba, no enviado a SUNAT',
      simulado: true,
      enlacePdf: '',
      cadenaQr: `SIMULADO|${c.tipo}|${c.serie}|${c.numero}|${total}|${armado.fecha}`,
      hash: `SIMULADO-${c.serie}-${String(c.numero).padStart(6, '0')}`,
    };
  }

  async consultar(): Promise<null> {
    return null;
  }

  async anular(): Promise<ResultadoBaja> {
    return { estado: 'ACEPTADA', respuesta: 'SIMULADO: baja de prueba, no enviada a SUNAT' };
  }
}
