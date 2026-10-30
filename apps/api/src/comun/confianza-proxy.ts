/**
 * Proxies de confianza para leer la IP real del usuario (req.ip).
 * La cadena es Cloudflare -> Traefik -> API: Express salta de derecha a izquierda las direcciones
 * de confianza de X-Forwarded-For y se queda con la primera que no lo es (el usuario).
 * Una petición que llegue sin pasar por Cloudflare no puede falsificar su IP: la cabecera que traiga
 * queda a la izquierda de su propia dirección real. Rangos oficiales de https://www.cloudflare.com/ips/
 * (iguales a los de forwardedHeaders.trustedIPs de infra/compose/proxy/traefik.yml).
 */
export const RANGOS_CLOUDFLARE: string[] = [
  '173.245.48.0/20', '103.21.244.0/22', '103.22.200.0/22', '103.31.4.0/22', '141.101.64.0/18',
  '108.162.192.0/18', '190.93.240.0/20', '188.114.96.0/20', '197.234.240.0/22', '198.41.128.0/17',
  '162.158.0.0/15', '104.16.0.0/13', '104.24.0.0/14', '172.64.0.0/13', '131.0.72.0/22',
  '2400:cb00::/32', '2606:4700::/32', '2803:f800::/32', '2405:b500::/32', '2405:8100::/32',
  '2a06:98c0::/29', '2c0f:f248::/32',
];

/** Valor de `trust proxy` para Express cuando TRUST_PROXY=cloudflare. */
export const CONFIANZA_PROXY_CLOUDFLARE: string[] = ['loopback', 'linklocal', 'uniquelocal', ...RANGOS_CLOUDFLARE];

/** Traduce la variable TRUST_PROXY al valor de Express. «cloudflare» = Traefik + Cloudflare. */
export function valorTrustProxy(entrada: string | undefined): number | string | string[] | undefined {
  const v = (entrada ?? '').trim();
  if (!v) return undefined;
  if (v === 'cloudflare') return CONFIANZA_PROXY_CLOUDFLARE;
  if (v === 'true' || v === '1') return 1;
  return v;
}
