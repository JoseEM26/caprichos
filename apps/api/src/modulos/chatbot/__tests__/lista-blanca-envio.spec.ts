import { conGuardiaSalida } from '../proveedor/guardia-salida';
import { NumerosWhatsappService } from '../servicios/numeros-whatsapp.service';

function montar() {
  const prisma: any = {
    parametro: { findUnique: jest.fn(async () => null) },
    numeroBloqueado: { findMany: jest.fn(async () => []) },
  };
  const numeros = new NumerosWhatsappService(prisma, { registrar: jest.fn() } as any);
  const base: any = {
    enviarTexto: jest.fn(async () => ({ exito: true, estado: 'ENVIADO' })),
    estaConectado: jest.fn(() => ({ conectado: true, modo: 'evolution' })),
  };
  return { base, puerto: conGuardiaSalida(base, numeros) };
}

describe('WHATSAPP_SOLO_NUMEROS (lista blanca de pre-producción)', () => {
  const previo = process.env.WHATSAPP_SOLO_NUMEROS;
  afterEach(() => {
    if (previo === undefined) delete process.env.WHATSAPP_SOLO_NUMEROS;
    else process.env.WHATSAPP_SOLO_NUMEROS = previo;
  });

  it('sin la variable no restringe (producción)', async () => {
    delete process.env.WHATSAPP_SOLO_NUMEROS;
    const { base, puerto } = montar();
    expect((await puerto.enviarTexto('51911222333', 'hola')).estado).toBe('ENVIADO');
    expect(base.enviarTexto).toHaveBeenCalled();
  });

  it('con la variable, solo salen los números de la lista y el resto queda OMITIDO', async () => {
    process.env.WHATSAPP_SOLO_NUMEROS = '51987654321, 51955000111';
    const { base, puerto } = montar();
    expect((await puerto.enviarTexto('51987654321', 'hola')).estado).toBe('ENVIADO');
    const fuera = await puerto.enviarTexto('51911222333', 'hola');
    expect(fuera).toMatchObject({ exito: false, estado: 'OMITIDO', errorCodigo: 'DESTINO_FUERA_DE_LISTA_BLANCA' });
    expect(base.enviarTexto).toHaveBeenCalledTimes(1);
  });

  it('un valor sin celulares («ninguno») bloquea todo', async () => {
    process.env.WHATSAPP_SOLO_NUMEROS = 'ninguno';
    const { base, puerto } = montar();
    expect((await puerto.enviarTexto('51987654321', 'hola')).estado).toBe('OMITIDO');
    expect(base.enviarTexto).not.toHaveBeenCalled();
  });
});
