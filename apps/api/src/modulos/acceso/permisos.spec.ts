import { MATRIZ } from './permisos';

describe('matriz de permisos del CAJERO (cie-fix, cambio 4)', () => {
  const cajero = MATRIZ.CAJERO;

  it('tiene caja, pedidos sin anular, cocina y carta en lectura', () => {
    expect(cajero).toEqual(
      expect.arrayContaining(['caja/ver', 'caja/abrir', 'caja/cobrar', 'caja/movimientos', 'caja/cerrar', 'pedidos/ver', 'pedidos/cambiar_estado', 'cocina/ver', 'catalogo/ver', 'comprobantes/reimprimir', 'mesas/liberar', 'repartos/liquidar']),
    );
  });

  it('no tiene iniciativas, compras, clientes, configuración, usuarios, stock, informes ni anulación de pedidos', () => {
    const prohibidos = ['iniciativas/', 'compras/', 'clientes/', 'configuracion/', 'usuarios/', 'stock/', 'informes/', 'pedidos/anular'];
    for (const prefijo of prohibidos) {
      expect(cajero.filter((p) => p.startsWith(prefijo))).toEqual([]);
    }
  });
});
