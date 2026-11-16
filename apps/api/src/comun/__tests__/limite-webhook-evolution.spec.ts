import express from 'express';
import { AddressInfo } from 'net';
import { limiteWebhookEvolutionMb, parserWebhookEvolution, RUTA_WEBHOOK_EVOLUTION } from '../limite-webhook-evolution';

describe('límite del body del webhook de Evolution', () => {
  const servidor = () => {
    const app = express();
    app.use(RUTA_WEBHOOK_EVOLUTION, parserWebhookEvolution(25));
    app.use(express.json()); // límite global por defecto (100 kb), como Nest
    app.post('*', (req, res) => res.json({ ok: true, raw: !!(req as any).rawBody }));
    app.use((err: any, _req: any, res: any, _next: any) => res.status(err.status ?? 500).end());
    return new Promise<{ url: string; cerrar: () => void }>((ok) => {
      const s = app.listen(0, () => ok({ url: `http://127.0.0.1:${(s.address() as AddressInfo).port}`, cerrar: () => s.close() }));
    });
  };
  const enviar = (url: string, ruta: string, mb: number) =>
    fetch(url + ruta, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ event: 'messages.upsert', data: { base64: 'a'.repeat(mb * 1024 * 1024) } }),
    });

  it('un cuerpo de ~5 MB en el webhook de Evolution no da 413; en otra ruta sí', async () => {
    const { url, cerrar } = await servidor();
    try {
      const evo = await enviar(url, RUTA_WEBHOOK_EVOLUTION, 5);
      expect(evo.status).toBe(200);
      expect((await evo.json()).raw).toBe(true);
      expect((await enviar(url, '/otra/ruta', 5)).status).toBe(413);
    } finally {
      cerrar();
    }
  });
  it('el límite es configurable y por defecto 25 MB', () => {
    expect(limiteWebhookEvolutionMb(undefined)).toBe(25);
    expect(limiteWebhookEvolutionMb('40')).toBe(40);
    expect(limiteWebhookEvolutionMb('x')).toBe(25);
  });
});
