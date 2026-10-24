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

describe('matriz de permisos de COCINA (coc-api)', () => {
  const cocina = MATRIZ.COCINA;

  it('tiene operaciones completas de cocina, mermas y pedidos al almacén', () => {
    expect(cocina).toEqual(
      expect.arrayContaining([
        'cocina/ver',
        'cocina/despejar',
        'cocina/devolver',
        'cocina/agotar',
        'cocina/demanda',
        'pedidos/ver',
        'pedidos/cambiar_estado',
        'stock/ver',
        'almacen/ver',
        'almacen/movimientos',
        'almacen/pedidos_internos',
        'almacen/traslados',
        'almacen/cierre',
        'produccion/ver',
        'produccion/crear',
        'produccion/anular',
      ]),
    );
  });

  it('no tiene caja, compras, usuarios, configuracion, clientes ni anular pedidos', () => {
    const prohibidos = ['caja/', 'compras/', 'usuarios/', 'configuracion/', 'clientes/', 'pedidos/anular', 'repartos/'];
    for (const prefijo of prohibidos) {
      expect(cocina.filter((p) => p.startsWith(prefijo))).toEqual([]);
    }
  });

  it('roles no autorizados (MOZO, REPARTIDOR) no pueden despejar, devolver ni agotar en cocina', () => {
    const accionesCocina = ['cocina/despejar', 'cocina/devolver', 'cocina/agotar', 'cocina/demanda'];
    for (const accion of accionesCocina) {
      expect(MATRIZ.MOZO).not.toContain(accion);
      expect(MATRIZ.REPARTIDOR).not.toContain(accion);
      expect(MATRIZ.CAJERO).not.toContain(accion);
    }
  });
});
