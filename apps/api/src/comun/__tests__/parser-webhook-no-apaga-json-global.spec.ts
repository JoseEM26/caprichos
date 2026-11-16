import 'reflect-metadata';
import { Body, Controller, Module, Post } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AddressInfo } from 'net';
import { parserWebhookEvolution, RUTA_WEBHOOK_EVOLUTION } from '../limite-webhook-evolution';

@Controller()
class EcoController {
  @Post('auth/ingresar')
  ingresar(@Body() cuerpo: any) {
    return { recibido: cuerpo };
  }
}
@Module({ controllers: [EcoController] })
class EcoModule {}

// Regresión 16/11: montar el parser del webhook como en main.ts apagaba el parser JSON global de Nest (nadie podía entrar)
describe('el parser del webhook de Evolution no apaga el JSON global de Nest', () => {
  it('otro endpoint sigue recibiendo el cuerpo JSON', async () => {
    const app = await NestFactory.create(EcoModule, { rawBody: true, logger: false });
    app.use(RUTA_WEBHOOK_EVOLUTION, parserWebhookEvolution(25));
    await app.listen(0);
    try {
      const { port } = app.getHttpServer().address() as AddressInfo;
      const r = await fetch(`http://127.0.0.1:${port}/auth/ingresar`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ dni: '12345678', contrasena: 'x' }),
      });
      expect((await r.json()).recibido).toEqual({ dni: '12345678', contrasena: 'x' });
    } finally {
      await app.close();
    }
  });
});
