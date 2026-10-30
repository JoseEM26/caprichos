import express from 'express';
import { RANGOS_CLOUDFLARE, valorTrustProxy } from '../confianza-proxy';

/** Devuelve req.ip tal como lo vería la API con ese ajuste, para una conexión desde `socket` con esa cabecera. */
function ipVista(trust: ReturnType<typeof valorTrustProxy>, socket: string, xff?: string): string {
  const app = express();
  if (trust !== undefined) app.set('trust proxy', trust);
  const req: any = Object.assign(Object.create(app.request), {
    app,
    headers: xff ? { 'x-forwarded-for': xff } : {},
    socket: { remoteAddress: socket },
    connection: { remoteAddress: socket },
  });
  return req.ip;
}

describe('confianza de proxies (IP real detrás de Cloudflare y Traefik)', () => {
  const cloudflare = valorTrustProxy('cloudflare');
  const TRAEFIK = '172.18.0.5';

  it('con Cloudflare delante devuelve la IP real del usuario', () => {
    expect(ipVista(cloudflare, TRAEFIK, '181.65.10.20, 172.64.80.1')).toBe('181.65.10.20');
  });

  it('una cabecera falsificada por el usuario no engaña: se toma la última IP que Cloudflare agregó', () => {
    expect(ipVista(cloudflare, TRAEFIK, '1.1.1.1, 181.65.10.20, 172.64.80.1')).toBe('181.65.10.20');
  });

  it('una petición que llega sin pasar por Cloudflare conserva su dirección real, no la cabecera que traiga', () => {
    expect(ipVista(cloudflare, TRAEFIK, '1.1.1.1, 200.10.10.10')).toBe('200.10.10.10');
  });

  it('con «1» (comportamiento anterior) se veía la IP de Cloudflare', () => {
    expect(ipVista(valorTrustProxy('1'), TRAEFIK, '181.65.10.20, 172.64.80.1')).toBe('172.64.80.1');
  });

  it('interpreta los valores de TRUST_PROXY', () => {
    expect(valorTrustProxy(undefined)).toBeUndefined();
    expect(valorTrustProxy('')).toBeUndefined();
    expect(valorTrustProxy('true')).toBe(1);
    expect(valorTrustProxy('2')).toBe('2');
    expect(RANGOS_CLOUDFLARE).toContain('104.16.0.0/13');
  });
});
