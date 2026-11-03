import { ConfigService } from '@nestjs/config';
import { CorreoService } from '../correo.service';

const P2002 = Object.assign(new Error('unique'), { code: 'P2002' });

function nuevo(apiKey?: string) {
  const prisma: any = {
    correoEnvio: {
      create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: BigInt(Math.floor(Math.random() * 1e6)), ...data })),
      update: jest.fn().mockResolvedValue({}),
    },
  };
  const config = { get: jest.fn().mockReturnValue(apiKey) } as unknown as ConfigService;
  return { servicio: new CorreoService(prisma, config), prisma };
}

const datos = { clave: 'almacen:Queso:AGOTADO:2026-11-02', origen: 'ALMACEN', asunto: 'Almacén: Queso', texto: 'x', destinatarios: ['Ana@Caprichos.pe', 'no-es-correo', 'Ana@caprichos.pe'] };

describe('CorreoService', () => {
  const fetchOriginal = global.fetch;
  afterEach(() => {
    global.fetch = fetchOriginal;
    jest.restoreAllMocks();
  });

  it('sin RESEND_API_KEY queda en modo simulado: no llama a la red y registra', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as any;
    const { servicio, prisma } = nuevo(undefined);
    const r = await servicio.enviar(datos);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(r).toEqual({ enviados: 0, simulados: 1, fallidos: 0, omitidos: 0 });
    expect(prisma.correoEnvio.update).toHaveBeenCalledWith({
      where: expect.any(Object),
      data: expect.objectContaining({ estado: 'SIMULADO' }),
    });
  });

  it('con clave envía a Resend un correo por destinatario, normalizado y sin duplicados', async () => {
    const fetchMock = jest.fn().mockResolvedValue(new Response(JSON.stringify({ id: 're_1' }), { status: 200 }));
    global.fetch = fetchMock as any;
    const { servicio } = nuevo('clave-de-prueba');
    const r = await servicio.enviar(datos);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(JSON.parse(init.body)).toMatchObject({ from: 'Caprichos <avisos@caprichos.pe>', to: ['ana@caprichos.pe'] });
    expect(r.enviados).toBe(1);
  });

  it('reintenta ante 5xx y no reintenta ante 4xx', async () => {
    const fetch500 = jest
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 're_2' }), { status: 200 }));
    global.fetch = fetch500 as any;
    const { servicio } = nuevo('k');
    const ok = await servicio.enviar({ ...datos, destinatarios: ['ana@caprichos.pe'] });
    expect(fetch500).toHaveBeenCalledTimes(2);
    expect(ok.enviados).toBe(1);

    const fetch422 = jest.fn().mockResolvedValue(new Response('', { status: 422 }));
    global.fetch = fetch422 as any;
    const malo = await servicio.enviar({ ...datos, clave: 'otro', destinatarios: ['ana@caprichos.pe'] });
    expect(fetch422).toHaveBeenCalledTimes(1);
    expect(malo.fallidos).toBe(1);
  });

  it('un caso ya registrado para el destinatario no se vuelve a enviar', async () => {
    const fetchMock = jest.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    global.fetch = fetchMock as any;
    const { servicio, prisma } = nuevo('k');
    prisma.correoEnvio.create.mockRejectedValue(P2002);
    const r = await servicio.enviar({ ...datos, destinatarios: ['ana@caprichos.pe'] });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(r.omitidos).toBe(1);
  });

  it('sin destinatarios registra SIN_DESTINO y no lanza', async () => {
    const { servicio, prisma } = nuevo('k');
    const r = await servicio.enviar({ ...datos, destinatarios: [] });
    expect(r.omitidos).toBe(1);
    expect(prisma.correoEnvio.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ destinatario: '-' }) }),
    );
  });
});
