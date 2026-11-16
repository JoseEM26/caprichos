import { detalleDatosPago } from '../conversacion/flujos/pago/textos-pago';

/**
 * Mensaje cariñoso con los datos para pagar, listo para que una persona lo envíe desde Mensajes.
 * Usa el mismo bloque de datos que el bot (transferencia: banco, titular, cuenta y CCI, cada uno en su línea).
 */
export function textoDatosPagoPersona(p: { nombre?: string | null; codigo: string; medio: string; monto: number; pagos: unknown }): string {
  const medio = p.medio.toUpperCase();
  const primer = String(p.nombre ?? '').trim().split(/\s+/)[0];
  const monto = p.monto.toFixed(2);
  const que = medio === 'TRANSFERENCIA' ? 'transferencia' : medio === 'PLIN' ? 'Plin' : 'Yape';
  return (
    `Hola${primer ? ` ${primer}` : ''} 💛 Gracias por tu pedido ${p.codigo}.\n` +
    `Para terminar, el monto a pagar por ${que} es *S/ ${monto}*:\n\n` +
    `${detalleDatosPago(medio, p.pagos, monto)}\n\n` +
    `Cuando lo hagas, envíanos la captura de tu pago por aquí 📎. ¡Gracias!`
  );
}
