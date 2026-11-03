/** Configuración de SUNAT directo (SEE - Del Contribuyente). Solo variables de entorno; nunca valores en logs. */

export type AmbienteSunat = 'beta' | 'prod';

/** RUC de pruebas de SUNAT (beta). En beta el XML se emite con este RUC, no con el del local. */
export const RUC_PRUEBA_BETA = '20000000001';

const URLS: Record<AmbienteSunat, { factura: string; consulta: string }> = {
  beta: {
    factura: 'https://e-beta.sunat.gob.pe/ol-ti-itcpfegem-beta/billService',
    // Observado: la ruta ol-it-wsconscpegem-beta responde 404; esta responde SOAP (aunque hoy devuelve Internal Error)
    consulta: 'https://e-beta.sunat.gob.pe/ol-ti-itcpfegem-beta/billConsultService',
  },
  prod: {
    factura: 'https://e-factura.sunat.gob.pe/ol-ti-itcpfegem/billService',
    consulta: 'https://e-factura.sunat.gob.pe/ol-it-wsconscpegem/billConsultService',
  },
};

/** SUNAT_AMBIENTE = prod | beta. Cualquier otro valor (o ausente) es beta. */
export function ambienteSunat(env: NodeJS.ProcessEnv = process.env): AmbienteSunat {
  return env.SUNAT_AMBIENTE === 'prod' ? 'prod' : 'beta';
}

export interface ConfigSunat {
  ambiente: AmbienteSunat;
  urlFactura: string;
  urlConsulta: string;
  usuario: string;
  clave: string;
}

export function configSunat(env: NodeJS.ProcessEnv = process.env): ConfigSunat {
  const ambiente = ambienteSunat(env);
  return {
    ambiente,
    urlFactura: URLS[ambiente].factura,
    urlConsulta: URLS[ambiente].consulta,
    usuario: env.SUNAT_SOL_USUARIO ?? '',
    clave: env.SUNAT_SOL_CLAVE ?? '',
  };
}

/** Fecha de vencimiento del certificado de producción que se debe renovar (dato del dueño). */
export const VENCIMIENTO_CERTIFICADO_AVISO = '2027-10-07';
