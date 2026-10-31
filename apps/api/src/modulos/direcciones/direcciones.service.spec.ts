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

  describe('inversa (dirección aproximada de un punto)', () => {
    it('llama a /reverse con las coordenadas y devuelve display_name', async () => {
      fetchMock.mockResolvedValue({ ok: true, json: async () => ({ display_name: 'Av. Brasil 1234, Lima' }) });
      expect(await crear().inversa(-12.07, -77.05)).toBe('Av. Brasil 1234, Lima');
      const [url, opts] = fetchMock.mock.calls[0];
      expect(url).toContain('/reverse?');
      expect(url).toContain('lat=-12.07');
      expect(url).toContain('lon=-77.05');
      expect(opts.headers['User-Agent']).toContain('Caprichos');
    });

    it('devuelve null si el proveedor falla o responde sin dirección', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 503 });
      expect(await crear().inversa(-12.07, -77.05)).toBeNull();
      fetchMock.mockResolvedValue({ ok: true, json: async () => ({ error: 'Unable to geocode' }) });
      expect(await crear().inversa(-12.07, -77.05)).toBeNull();
    });

    it('no consulta con coordenadas inválidas', async () => {
      const s = crear();
      expect(await s.inversa(95, 0)).toBeNull();
      expect(await s.inversa(0, NaN)).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('respeta el tope diario compartido con la búsqueda', async () => {
      const s = crear(1);
      await s.buscar('primera calle');
      expect(await s.inversa(-12.07, -77.05)).toBeNull();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });
});
