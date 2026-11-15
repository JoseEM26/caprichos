import { PasarelaPago } from './pasarela.puerto';
import { CulqiAdaptador } from './culqi.adaptador';
import { SimuladoAdaptador } from './simulado.adaptador';

/** Sin CULQI_SECRET_KEY y CULQI_PUBLIC_KEY el pago corre en modo SIMULADO (sin red). */
export function crearPasarela(env: NodeJS.ProcessEnv = process.env): PasarelaPago {
  const secretKey = env.CULQI_SECRET_KEY;
  const publicKey = env.CULQI_PUBLIC_KEY;
  if (secretKey && publicKey) return new CulqiAdaptador({ secretKey, publicKey, apiUrl: env.CULQI_API_URL });
  return new SimuladoAdaptador();
}
