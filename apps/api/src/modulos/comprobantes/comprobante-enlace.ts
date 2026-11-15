/**
 * Enlace público al PDF de UN comprobante (para mandarlo por WhatsApp a mano) y filtros de la lista de electrónicos.
 * Funciones puras, sin base ni red.
 */
import { createHmac, timingSafeEqual } from 'crypto';
import { secretoSeguimiento } from '../pedidos/seguimiento.tokens';

/** Marca en `factura_whatsapp_envio.detalle` cuando una persona lo mandó a mano (sin cambiar el estado: evita migrar el CHECK). */
export const DETALLE_ENVIADO_A_MANO = 'ENVIADO_A_MANO';

/** Firma de un comprobante: solo sirve para ese id (HMAC con el secreto de la app, igual que el seguimiento de pedidos; sin vencimiento). */
export function tokenPdfComprobante(id: bigint | string | number, secreto: string = secretoSeguimiento()): string {
  return createHmac('sha256', secreto).update(`cpdf:${id}`).digest('hex');
}

export function verificarTokenPdfComprobante(id: bigint | string | number, token: string | undefined, secreto: string = secretoSeguimiento()): boolean {
  if (typeof token !== 'string' || token.length === 0) return false;
  const esperado = Buffer.from(tokenPdfComprobante(id, secreto));
  const recibido = Buffer.from(token);
  return recibido.length === esperado.length && timingSafeEqual(recibido, esperado);
}

/** Enlace público (ruta /carta, ya enrutada a la API) al PDF. Null sin origen público. */
export function enlacePublicoPdf(origen: string, id: bigint | string | number): string | null {
  const base = origen.trim().replace(/\/$/, '');
  return base ? `${base}/carta/comprobante/${id}/${tokenPdfComprobante(id)}` : null;
}

/** Origen público de la web (CARTA_URL_PUBLICA o https://DOMINIO_BASE); vacío si no está configurado. */
export function origenPublico(env: Record<string, string | undefined> = process.env): string {
  const url = (env.CARTA_URL_PUBLICA ?? '').trim();
  if (url) return url;
  const dominio = (env.DOMINIO_BASE ?? '').trim();
  return dominio ? `https://${dominio}` : '';
}

export const FILTROS_ELECTRONICOS = ['todos', 'faltan', 'aceptados', 'sin_whatsapp'] as const;
export type FiltroElectronicos = (typeof FILTROS_ELECTRONICOS)[number];
export const esFiltroElectronicos = (v: unknown): v is FiltroElectronicos => (FILTROS_ELECTRONICOS as readonly string[]).includes(v as string);

const TIPOS = { in: ['BOLETA', 'FACTURA'] };

/** Condición (Prisma) de cada chip. «Faltan emitir» = todo lo que SUNAT aún no aceptó (cualquier estado distinto de EMITIDO_SUNAT). */
export function condicionFiltroElectronicos(filtro: FiltroElectronicos): Record<string, unknown> {
  switch (filtro) {
    case 'faltan':
      return { tipo: TIPOS, facturacion_estado: { notIn: ['EMITIDO_SUNAT'], not: null } };
    case 'aceptados':
      return { tipo: TIPOS, facturacion_estado: 'EMITIDO_SUNAT' };
    case 'sin_whatsapp':
      // Mismo criterio de «enviable» que el envío automático, y sin envío completado (automático o a mano)
      return {
        tipo: TIPOS,
        simulado: false,
        anulado_en: null,
        baja_estado: null,
        AND: [
          { OR: [{ facturacion_estado: 'EMITIDO_SUNAT' }, { tipo: 'BOLETA', facturacion_estado: 'PENDIENTE_RESUMEN' }] },
          { OR: [{ envioWhatsapp: null }, { envioWhatsapp: { is: { estado: { not: 'ENVIADO' } } } }] },
          { OR: [{ envioWhatsapp: null }, { envioWhatsapp: { is: { OR: [{ detalle: null }, { detalle: { not: DETALLE_ENVIADO_A_MANO } }] } } }] },
        ],
      };
    default:
      return { tipo: TIPOS, facturacion_estado: { not: null } };
  }
}
