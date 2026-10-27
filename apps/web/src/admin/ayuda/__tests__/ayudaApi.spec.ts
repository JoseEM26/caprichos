import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from '../../../comun/api';
import {
  obtenerContextoAyuda,
  enviarPreguntaAyuda,
  type ContextoAyudaRespuesta,
  type PreguntarAyudaRespuesta,
} from '../ayudaApi';

vi.mock('../../../comun/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe('ayudaApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('obtenerContextoAyuda', () => {
    it('solicita el contexto enviando la ruta codificada', async () => {
      const mockRespuesta: ContextoAyudaRespuesta = {
        activo: true,
        modulo: 'caja',
        titulo: 'Pedidos y caja',
        rolUsuario: 'ADMIN',
        sugerencias: ['¿Cómo anulo un pedido?', '¿Cómo registro un cobro?'],
        enlaces: [{ texto: 'Caja', ruta: '/admin/caja' }],
      };

      vi.mocked(api.get).mockResolvedValueOnce(mockRespuesta);

      const res = await obtenerContextoAyuda('/admin/caja?filtro=activos');

      expect(api.get).toHaveBeenCalledWith(
        '/admin/ayuda/contexto?ruta=%2Fadmin%2Fcaja%3Ffiltro%3Dactivos'
      );
      expect(res).toEqual(mockRespuesta);
    });

    it('devuelve contexto inactivo de respaldo si la llamada a la API falla', async () => {
      vi.mocked(api.get).mockRejectedValueOnce(new Error('Fallo de red'));

      const res = await obtenerContextoAyuda('/admin/caja');

      expect(res.activo).toBe(false);
      expect(res.sugerencias.length).toBeGreaterThan(0);
      expect(Array.isArray(res.enlaces)).toBe(true);
    });
  });

  describe('enviarPreguntaAyuda', () => {
    it('envía pregunta, ruta e historial al endpoint POST', async () => {
      const mockRespuesta: PreguntarAyudaRespuesta = {
        respuesta: 'Para anular un pedido entra a Pedidos...',
        enlaces: [{ texto: 'Pedidos', ruta: '/admin/caja' }],
        estado: 'ok',
      };

      vi.mocked(api.post).mockResolvedValueOnce(mockRespuesta);

      const dto = {
        pregunta: '¿Cómo anulo un pedido?',
        ruta: '/admin/caja',
        historial: [
          { rol: 'usuario' as const, texto: 'Hola' },
          { rol: 'capri' as const, texto: 'Hola, soy Capri' },
        ],
      };

      const res = await enviarPreguntaAyuda(dto);

      expect(api.post).toHaveBeenCalledWith('/admin/ayuda/preguntar', dto);
      expect(res).toEqual(mockRespuesta);
    });

    it('devuelve respuesta con estado sin_ia si la petición falla en el servidor', async () => {
      vi.mocked(api.post).mockRejectedValueOnce(new Error('Servicio no disponible'));

      const res = await enviarPreguntaAyuda({
        pregunta: '¿Cómo anulo un pedido?',
      });

      expect(res.estado).toBe('sin_ia');
      expect(res.respuesta).toContain('asistente');
      expect(Array.isArray(res.enlaces)).toBe(true);
    });
  });
});
