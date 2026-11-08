import { NotFoundException } from '@nestjs/common';
import { SeguimientoService } from './seguimiento.service';
import { generarTokenSeguimiento, verificarTokenSeguimiento } from './seguimiento.tokens';

const SECRETO = 'secreto-de-prueba-de-al-menos-32-caracteres';
const CREADO = new Date('2026-10-23T17:00:00Z'); // 12:00 en Lima

function pedidoBase(extra: Record<string, unknown> = {}) {
  return {
    id: 7n,
    codigo: 'CAP-0007',
    estado: 'COLA',
    modalidad: 'DELIVERY',
    total: { toString: () => '42.50' },
    creado_en: CREADO,
    pasa_cocina_en: null,
    listo_en: null,
    despachado_en: null,
    entregado_en: null,
    historial: [],
    cliente_nombre: 'Nombre Privado',
    cliente_telefono: '999000111',
    entrega_direccion: 'Calle Secreta 123',
    entrega_referencia: 'Portón azul',
    entrega_lat: 1,
    entrega_lng: 2,
    ...extra,
  };
}

describe('SeguimientoService', () => {
  let service: SeguimientoService;
  let prismaMock: any;

  beforeEach(() => {
    prismaMock = { pedido: { findUnique: jest.fn() } };
    service = new SeguimientoService(prismaMock);
  });

  function conPedido(pedido: Record<string, unknown>) {
    prismaMock.pedido.findUnique.mockResolvedValue(pedido);
  }

  // El servicio verifica con el secreto por defecto (process.env.JWT_SECRET o el de desarrollo).
  function tokenValido(): string {
    return generarTokenSeguimiento(7n);
  }

  describe('tokens', () => {
    it('es determinista y depende del pedido y del secreto', () => {
      expect(generarTokenSeguimiento(7n, SECRETO)).toBe(generarTokenSeguimiento('7', SECRETO));
      expect(generarTokenSeguimiento(7n, SECRETO)).not.toBe(generarTokenSeguimiento(8n, SECRETO));
      expect(generarTokenSeguimiento(7n, SECRETO)).not.toBe(generarTokenSeguimiento(7n, 'otro'));
    });

    it('verifica solo el token del mismo pedido', () => {
      const token = generarTokenSeguimiento(7n, SECRETO);
      expect(verificarTokenSeguimiento(7n, token, SECRETO)).toBe(true);
      expect(verificarTokenSeguimiento(8n, token, SECRETO)).toBe(false);
      expect(verificarTokenSeguimiento(7n, undefined, SECRETO)).toBe(false);
      expect(verificarTokenSeguimiento(7n, '', SECRETO)).toBe(false);
      expect(verificarTokenSeguimiento(7n, 'corto', SECRETO)).toBe(false);
    });
  });

  describe('obtener', () => {
    it('DELIVERY en COLA: primer paso actual, sin horas de los demás', async () => {
      conPedido(pedidoBase());
      const res = await service.obtener('CAP-0007', tokenValido());

      expect(res.modalidad).toBe('DELIVERY');
      expect(res.estado).toBe('COLA');
      expect(res.estadoEtiqueta).toBe('En cola');
      expect(res.total).toBe(42.5);
      expect(res.terminado).toBe(false);
      expect(res.anulado).toBe(false);
      expect(res.pasos.map((p) => p.clave)).toEqual(['recibido', 'cocina', 'camino', 'llego', 'entregado']);
      expect(res.pasos[0]).toMatchObject({ hecho: true, actual: true, hora: '12:00' });
      expect(res.pasos[1]).toMatchObject({ hecho: false, actual: false, hora: null });
    });

    it('DELIVERY en EN_CAMINO: cocina hecha y "En camino" actual', async () => {
      conPedido(
        pedidoBase({
          estado: 'EN_CAMINO',
          pasa_cocina_en: new Date('2026-10-23T17:05:00Z'),
          despachado_en: new Date('2026-10-23T17:20:00Z'),
        }),
      );
      const res = await service.obtener('CAP-0007', tokenValido());

      expect(res.pasos.map((p) => [p.hecho, p.actual, p.hora])).toEqual([
        [true, false, '12:00'],
        [true, false, '12:05'],
        [true, true, '12:20'],
        [false, false, null],
        [false, false, null],
      ]);
      expect(res.terminado).toBe(false);
    });

    it('DELIVERY EN_CAMINO con llego_en: «Llegó» es el paso actual con su hora', async () => {
      conPedido(
        pedidoBase({
          estado: 'EN_CAMINO',
          pasa_cocina_en: new Date('2026-10-23T17:05:00Z'),
          despachado_en: new Date('2026-10-23T17:20:00Z'),
          llego_en: new Date('2026-10-23T17:35:00Z'),
        }),
      );
      const res = await service.obtener('CAP-0007', tokenValido());
      expect(res.pasos.map((p) => [p.clave, p.hecho, p.actual])).toEqual([
        ['recibido', true, false],
        ['cocina', true, false],
        ['camino', true, false],
        ['llego', true, true],
        ['entregado', false, false],
      ]);
      expect(res.pasos[3].hora).toBe('12:35');
      expect(res.progreso.etapa).toBe('LLEGO');
    });

    it('DELIVERY ENTREGADO: todo hecho, el último es el actual y terminado', async () => {
      conPedido(
        pedidoBase({
          estado: 'ENTREGADO',
          entregado_en: new Date('2026-10-23T17:40:00Z'),
        }),
      );
      const res = await service.obtener('CAP-0007', tokenValido());

      expect(res.terminado).toBe(true);
      expect(res.anulado).toBe(false);
      expect(res.estadoEtiqueta).toBe('Entregado');
      expect(res.pasos.every((p) => p.hecho)).toBe(true);
      expect(res.pasos.map((p) => p.actual)).toEqual([false, false, false, false, true]);
      expect(res.pasos[4].hora).toBe('12:40');
    });

    it('RECOGER en LISTO: usa "Listo para recoger" y no hay paso de camino', async () => {
      conPedido(
        pedidoBase({
          modalidad: 'RECOGER',
          estado: 'LISTO',
          pasa_cocina_en: new Date('2026-10-23T17:05:00Z'),
          listo_en: new Date('2026-10-23T17:15:00Z'),
        }),
      );
      const res = await service.obtener('CAP-0007', tokenValido());

      expect(res.modalidad).toBe('RECOGER');
      expect(res.pasos.map((p) => p.clave)).toEqual(['recibido', 'cocina', 'listo', 'entregado']);
      expect(res.pasos.map((p) => [p.hecho, p.actual])).toEqual([
        [true, false],
        [true, false],
        [true, true],
        [false, false],
      ]);
      expect(res.pasos[2].hora).toBe('12:15');
    });

    it('RECOGER ENTREGADO: termina en el paso de entrega', async () => {
      conPedido(pedidoBase({ modalidad: 'RECOGER', estado: 'ENTREGADO' }));
      const res = await service.obtener('CAP-0007', tokenValido());

      expect(res.terminado).toBe(true);
      expect(res.pasos.every((p) => p.hecho)).toBe(true);
      expect(res.pasos.filter((p) => p.actual).map((p) => p.clave)).toEqual(['entregado']);
    });

    it('usa el historial como respaldo cuando falta el campo de hora', async () => {
      conPedido(
        pedidoBase({
          estado: 'PREPARANDO',
          historial: [{ estado_nuevo: 'PREPARANDO', en: new Date('2026-10-23T17:03:00Z') }],
        }),
      );
      const res = await service.obtener('CAP-0007', tokenValido());

      expect(res.pasos[1]).toMatchObject({ hecho: true, actual: true, hora: '12:03' });
    });

    it('pedido ANULADO: terminado y anulado, ningún paso actual', async () => {
      conPedido(
        pedidoBase({
          estado: 'ANULADO',
          pasa_cocina_en: new Date('2026-10-23T17:05:00Z'),
        }),
      );
      const res = await service.obtener('CAP-0007', tokenValido());

      expect(res.terminado).toBe(true);
      expect(res.anulado).toBe(true);
      expect(res.estado).toBe('ANULADO');
      expect(res.estadoEtiqueta).toBe('Anulado');
      expect(res.pasos.some((p) => p.actual)).toBe(false);
      expect(res.pasos[0].hecho).toBe(true);
      expect(res.pasos[1].hecho).toBe(false);
    });

    it('la respuesta no contiene nombre, teléfono, dirección, referencia ni coordenadas', async () => {
      conPedido(pedidoBase());
      const res = await service.obtener('CAP-0007', tokenValido());
      const texto = JSON.stringify(res);

      expect(texto).not.toContain('Nombre Privado');
      expect(texto).not.toContain('999000111');
      expect(texto).not.toContain('Calle Secreta');
      expect(texto).not.toContain('Portón azul');
      expect(Object.keys(res)).not.toContain('entrega_lat');
    });

    it('no pide al motor los datos personales del pedido', async () => {
      conPedido(pedidoBase());
      await service.obtener('CAP-0007', tokenValido());

      const select = prismaMock.pedido.findUnique.mock.calls[0][0].select;
      expect(select.cliente_nombre).toBeUndefined();
      expect(select.cliente_telefono).toBeUndefined();
      expect(select.entrega_direccion).toBeUndefined();
      expect(select.entrega_referencia).toBeUndefined();
    });

    it('token ausente, inválido o de otro pedido responde 404 con el mismo mensaje', async () => {
      conPedido(pedidoBase());
      const otroToken = generarTokenSeguimiento(8n);

      for (const token of [undefined, '', 'invalido', otroToken]) {
        const error = await service.obtener('CAP-0007', token).catch((e) => e);
        expect(error).toBeInstanceOf(NotFoundException);
        expect(error.getResponse()).toEqual({
          codigo: 'PEDIDO_NO_ENCONTRADO',
          mensaje: 'Pedido no encontrado',
        });
      }
    });

    it('pedido inexistente responde igual que un token inválido', async () => {
      prismaMock.pedido.findUnique.mockResolvedValue(null);
      const error = await service.obtener('CAP-9999', tokenValido()).catch((e) => e);

      expect(error).toBeInstanceOf(NotFoundException);
      expect(error.getResponse()).toEqual({
        codigo: 'PEDIDO_NO_ENCONTRADO',
        mensaje: 'Pedido no encontrado',
      });
    });
  });

  describe('progreso en cocina', () => {
    it('obtener devuelve el progreso por área sin datos personales ni de cocina internos', async () => {
      conPedido(
        pedidoBase({
          estado: 'PREPARANDO',
          modalidad: 'RECOGER',
          lineas: [{ cantidad: 1, area_id: 1n, producto: null }],
          comandas: [
            { area_id: 1n, estado: 'DESPEJADA', llego_en: CREADO, area: { nombre: 'Bebidas' } },
            { area_id: 2n, estado: 'EN_COCINA', llego_en: CREADO, area: { nombre: 'Salados' } },
          ],
        }),
      );

      const res = await service.obtener('CAP-0007', tokenValido());

      expect(res.progreso).toMatchObject({
        etapa: 'PARCIAL',
        etiqueta: 'Cocina: listas Bebidas, faltan Salados',
        listasDe: 1,
        totalAreas: 2,
        porcentaje: 50,
      });
      const json = JSON.stringify(res);
      expect(json).not.toContain('Nombre Privado');
      expect(json).not.toContain('Calle Secreta');
      expect(json).not.toContain('llego_en');
    });
  });

  describe('Comer en el local: ubicación para el cliente', () => {
    const obtener = async (extra: Record<string, unknown>) => {
      conPedido(pedidoBase({ modalidad: 'COMER_LOCAL', canal: 'CARTA', ...extra }));
      return service.obtener('CAP-0007', tokenValido());
    };
    it('sin mesa ni lista: SIN_MESA', async () => {
      const r: any = await obtener({});
      expect(r).toMatchObject({ modalidad: 'COMER_LOCAL', ubicacion: 'SIN_MESA' });
      expect(r.mesa).toBeUndefined();
    });
    it('en lista de espera (ya MESA, canal CARTA): EN_ESPERA y sigue siendo comer en el local', async () => {
      const r: any = await obtener({ modalidad: 'MESA', mesa_nombre: 'En espera de mesa', espera_mesa_desde: new Date() });
      expect(r).toMatchObject({ modalidad: 'COMER_LOCAL', ubicacion: 'EN_ESPERA' });
      expect(r.pasos.map((p: any) => p.clave)).toEqual(['recibido', 'cocina', 'listo', 'entregado']);
    });
    it('con mesa: ASIGNADA con la mesa y sin datos personales', async () => {
      const r: any = await obtener({ modalidad: 'MESA', mesa_nombre: 'Mesa 4' });
      expect(r).toMatchObject({ ubicacion: 'ASIGNADA', mesa: 'Mesa 4' });
      expect(JSON.stringify(r)).not.toMatch(/Nombre Privado|999000111/);
    });
    it('un pedido de mozo (MESA, canal MOZO) no cambia', async () => {
      const r: any = await obtener({ modalidad: 'MESA', canal: 'MOZO', mesa_nombre: 'Mesa 2' });
      expect(r.modalidad).toBe('MESA');
      expect(r.ubicacion).toBeUndefined();
    });
  });
});
