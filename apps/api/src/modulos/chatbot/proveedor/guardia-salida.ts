import type { ResultadoEnvioWhatsApp, WhatsAppMensajeriaPuerto } from '../puerto/whatsapp-mensajeria.puerto';
import type { NumerosWhatsappService } from '../servicios/numeros-whatsapp.service';
import { TEXTO_OMISION } from '../servicios/numeros-whatsapp.service';

const METODOS_DE_ENVIO = new Set(['enviarTexto', 'enviarPlantilla', 'enviarBotones', 'enviarLista', 'enviarCarrusel', 'enviarImagen', 'enviarDocumento']);

/**
 * ÚNICO guardia de salida: envuelve al puerto (Meta o Simulado). Todo envío a un número propio del negocio o bloqueado
 * se omite aquí, antes de llamar a Meta: sin reintento, sin error y sin romper el flujo que lo pidió.
 * Evita que los bots se contesten entre sí.
 */
export function conGuardiaSalida(puerto: WhatsAppMensajeriaPuerto, numeros: NumerosWhatsappService): WhatsAppMensajeriaPuerto {
  return new Proxy(puerto, {
    get(objetivo, prop) {
      const valor = Reflect.get(objetivo, prop, objetivo);
      if (typeof valor !== 'function') return valor;
      if (typeof prop !== 'string' || !METODOS_DE_ENVIO.has(prop)) return valor.bind(objetivo);
      return async (telefono: string, ...resto: unknown[]): Promise<ResultadoEnvioWhatsApp> => {
        const motivo = await numeros.motivoOmision(telefono);
        if (motivo) {
          numeros.logOmitido(motivo, telefono, prop);
          return { exito: false, estado: 'OMITIDO', errorCodigo: motivo, errorDetalle: TEXTO_OMISION[motivo] };
        }
        return valor.call(objetivo, telefono, ...resto);
      };
    },
  });
}
