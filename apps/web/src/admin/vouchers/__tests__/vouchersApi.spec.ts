import { describe, it, expect, vi, beforeEach } from 'vitest';
import { vouchersApi } from '../vouchersApi';
import * as apiModulo from '../../../comun/api';

describe('vouchersApi (cliente tipado para lectura de vouchers con IA)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('subirVoucher', () => {
    it('envía multipart/form-data con archivo, pedidoId y medio a POST /admin/vouchers', async () => {
      const mockRespuesta = {
        id: '123',
        legible: true,
      };

      const spyFetch = vi
        .spyOn(apiModulo, 'clienteFetch')
        .mockResolvedValue(mockRespuesta);

      const fakeFile = new File(['fake image bytes'], 'voucher.jpg', {
        type: 'image/jpeg',
      });

      const res = await vouchersApi.subirVoucher(fakeFile, 'pedido-42', 'YAPE');

      expect(spyFetch).toHaveBeenCalledTimes(1);
      const [ruta, opciones] = spyFetch.mock.calls[0];
      expect(ruta).toBe('/admin/vouchers');
      expect(opciones?.method).toBe('POST');
      expect(opciones?.body).toBeInstanceOf(FormData);

      const formData = opciones?.body as FormData;
      expect(formData.get('pedidoId')).toBe('pedido-42');
      expect(formData.get('medio')).toBe('YAPE');
      expect(formData.get('archivo')).toBeTruthy();

      expect(res).toEqual(mockRespuesta);
    });

    it('devuelve respuesta completa de semáforo para rol admin/cajero', async () => {
      const mockRespuestaAdmin = {
        id: '456',
        legible: true,
        semaforo: 'CONFIABLE' as const,
        motivos: ['Monto coincide', 'Titular verificado'],
        extraido: {
          legible: true,
          monto: 35.5,
          moneda: 'PEN',
          operacion: '12345678',
          fecha: '2026-10-27',
          hora: '14:30',
          titular: 'Kevin',
          destinoNumero: '946388934',
          medioDetectado: 'YAPE' as const,
          confianza: 0.95,
        },
      };

      vi.spyOn(apiModulo, 'clienteFetch').mockResolvedValue(mockRespuestaAdmin);

      const fakeBlob = new Blob(['bytes'], { type: 'image/jpeg' });
      const res = await vouchersApi.subirVoucher(fakeBlob, 99, 'PLIN');

      expect(res).toEqual(mockRespuestaAdmin);
    });
  });

  describe('listarVouchers', () => {
    it('construye la query string con filtros y llama a GET /admin/vouchers', async () => {
      const vouchersMock = [
        {
          id: '1',
          archivoId: '10',
          origen: 'MOZO' as const,
          medio: 'YAPE' as const,
          semaforo: 'CONFIABLE' as const,
          motivos: [],
          creadoEn: '2026-10-27T10:00:00Z',
        },
      ];

      const spyGet = vi
        .spyOn(apiModulo.api, 'get')
        .mockResolvedValue(vouchersMock);

      const res = await vouchersApi.listarVouchers({
        fecha: '2026-10-27',
        estado: 'pendientes',
      });

      expect(spyGet).toHaveBeenCalledWith(
        '/admin/vouchers?fecha=2026-10-27&estado=pendientes',
      );
      expect(res).toEqual(vouchersMock);
    });
  });

  describe('marcarRevisado', () => {
    it('llama a POST /admin/vouchers/:id/revisado', async () => {
      const spyPost = vi
        .spyOn(apiModulo.api, 'post')
        .mockResolvedValue({ ok: true, id: '1', revisadoEn: '2026-10-27T12:00:00Z' });

      const res = await vouchersApi.marcarRevisado('1');
      expect(spyPost).toHaveBeenCalledWith('/admin/vouchers/1/revisado');
      expect(res.ok).toBe(true);
    });
  });

  describe('obtenerConfiguracion y guardarParametro', () => {
    it('obtiene parámetros y aplica defaults', async () => {
      vi.spyOn(apiModulo.api, 'get').mockResolvedValue([
        { clave: 'voucher_ia_activo', valor: true },
        { clave: 'voucher_titular_nombre', valor: 'Kevin R.' },
      ]);

      const cfg = await vouchersApi.obtenerConfiguracion();
      expect(cfg.voucher_ia_activo).toBe(true);
      expect(cfg.voucher_titular_nombre).toBe('Kevin R.');
      expect(cfg.voucher_yape_numero).toBe('946388934');
      expect(cfg.voucher_plin_numero).toBe('946388934');
      expect(cfg.voucher_mozo_obligatorio).toBe(true);
    });

    it('guarda parámetro llamando a PUT /admin/configuracion/:clave', async () => {
      const spyPut = vi
        .spyOn(apiModulo.api, 'put')
        .mockResolvedValue({ ok: true });

      await vouchersApi.guardarParametro('voucher_ia_activo', false);
      expect(spyPut).toHaveBeenCalledWith('/admin/configuracion/voucher_ia_activo', {
        valor: false,
      });
    });
  });
});
