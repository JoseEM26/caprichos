import { Logger } from '@nestjs/common';
import { CargoHecho, ErrorPasarela, PasarelaPago } from './pasarela.puerto';
import { CulqiAdaptador } from './culqi.adaptador';
import { SimuladoAdaptador } from './simulado.adaptador';

/** Pasarela que se niega a cobrar: llaves de producción (`sk_live`) puestas en un ambiente de pruebas. */
class PasarelaBloqueada implements PasarelaPago {
  readonly modo = 'REAL' as const;
  readonly publicKey = null;
  async cargar(): Promise<CargoHecho> {
    return { estado: 'RECHAZADO', cargoId: null, marca: null, ultimos4: null, codigo: 'LLAVE_LIVE_EN_DEMO', mensaje: 'Este ambiente de pruebas no cobra con llaves de producción.' };
  }
  async consultarCargo(): Promise<never> {
    throw new ErrorPasarela('Llave de producción bloqueada en pre-producción');
  }
  async devolver(): Promise<never> {
    throw new ErrorPasarela('Llave de producción bloqueada en pre-producción');
  }
}

/**
 * Sin CULQI_SECRET_KEY y CULQI_PUBLIC_KEY el pago corre en modo SIMULADO (sin red).
 * En la demo (AMBIENTE_DESPLIEGUE=demo) una llave `sk_live` nunca cobra: solo llaves de integración `sk_test`/`pk_test`.
 */
export function crearPasarela(env: NodeJS.ProcessEnv = process.env): PasarelaPago {
  const secretKey = env.CULQI_SECRET_KEY;
  const publicKey = env.CULQI_PUBLIC_KEY;
  if (secretKey && publicKey) {
    const esDemo = (env.AMBIENTE_DESPLIEGUE || '').toLowerCase() === 'demo';
    if (esDemo && (secretKey.startsWith('sk_live') || publicKey.startsWith('pk_live'))) {
      new Logger('Culqi').error('Llaves live en la demo: el cobro queda bloqueado. Use sk_test y pk_test.');
      return new PasarelaBloqueada();
    }
    return new CulqiAdaptador({ secretKey, publicKey, apiUrl: env.CULQI_API_URL });
  }
  return new SimuladoAdaptador();
}
