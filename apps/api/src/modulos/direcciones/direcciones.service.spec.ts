import { DireccionesService } from './direcciones.service';

describe('DireccionesService', () => {
  const crear = (tope = 1000) =>
    new DireccionesService({ get: (k: string, d: unknown) => (k === 'DIRECCIONES_TOPE_DIARIO' ? tope : k === 'DIRECCIONES_INTERVALO_MS' ? 0 : d) } as any);
  const respuesta = [{ display_name: 'Av. Brasil 1234, Lima', lat: '-12.07', lon: '-77.05' }];
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => respuesta });
    (global as any).fetch = fetchMock;
  });

  it('devuelve los resultados y guarda en caché la misma búsqueda', async () => {
    const s = crear();
    const a = await s.buscar('Av. Brasil 1234');
    const b = await s.buscar('  av. brasil   1234 ');
    expect(a).toEqual({ resultados: [{ texto: 'Av. Brasil 1234, Lima', lat: -12.07, lng: -77.05 }], apagado: false });
    expect(b).toEqual(a);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toContain('countrycodes=pe');
    expect(opts.headers['User-Agent']).toContain('Caprichos');
  });

  it('se apaga al llegar al tope diario', async () => {
    const s = crear(1);
    await s.buscar('primera calle');
    expect(await s.buscar('segunda calle')).toEqual({ resultados: [], apagado: true });
  });

  it('limita 20 consultas por minuto por IP', async () => {
    const s = crear();
    for (let i = 0; i < 20; i++) await s.buscar(`calle ${i}`, '1.1.1.1');
    expect((await s.buscar('calle 99', '1.1.1.1')).apagado).toBe(true);
    expect((await s.buscar('calle 99', '2.2.2.2')).apagado).toBe(false);
  });

  it('si el proveedor falla se apaga sin romper', async () => {
    fetchMock.mockRejectedValue(new Error('caído'));
    expect(await crear().buscar('cualquier calle')).toEqual({ resultados: [], apagado: true });
  });
});
