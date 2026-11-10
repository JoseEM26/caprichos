import { MATRIZ, PERMISOS, ROLES, ROLES_ELIMINADOS } from './permisos';
import { puedeAnularPedido } from './roles-usuario';

describe('iniciativas: todo el personal ve, crea y comenta; cambiar estado solo ADMIN y SUPERVISOR', () => {
  const roles = ['ADMIN', 'SUPERVISOR', 'CAJERO', 'MOZO', 'COCINA', 'ALMACEN', 'REPARTIDOR'];
  it('cada rol del catálogo puede ver, crear y comentar', () => {
    for (const r of roles) {
      expect(MATRIZ[r]).toEqual(expect.arrayContaining(['iniciativas/ver', 'iniciativas/crear', 'iniciativas/comentar']));
    }
  });
  it('solo ADMIN y SUPERVISOR cambian el estado', () => {
    for (const r of roles) {
      expect(MATRIZ[r].includes('iniciativas/cambiar_estado')).toBe(['ADMIN', 'SUPERVISOR'].includes(r));
    }
  });
});

describe('pedidos/extra (Agregar extra a un pedido)', () => {
  it('lo tienen ADMIN, SUPERVISOR, CAJERO y MOZO; nadie más', () => {
    for (const r of ['ADMIN', 'SUPERVISOR', 'CAJERO', 'MOZO']) expect(MATRIZ[r]).toContain('pedidos/extra');
    for (const r of ['COCINA', 'ALMACEN', 'REPARTIDOR']) expect(MATRIZ[r]).not.toContain('pedidos/extra');
  });
});

describe('pedidos/editar (Editar pedido en Caja)', () => {
  it('lo tienen ADMIN, SUPERVISOR, CAJERO y MOZO; cocina, almacén y reparto no', () => {
    for (const r of ['ADMIN', 'SUPERVISOR', 'CAJERO', 'MOZO']) expect(MATRIZ[r]).toContain('pedidos/editar');
    for (const r of ['COCINA', 'ALMACEN', 'REPARTIDOR']) expect(MATRIZ[r]).not.toContain('pedidos/editar');
  });
});

describe('matriz de permisos del CAJERO (cie-fix, cambio 4)', () => {
  const cajero = MATRIZ.CAJERO;

  it('tiene caja, pedidos sin anular, cocina y carta en lectura', () => {
    expect(cajero).toEqual(
      expect.arrayContaining(['caja/ver', 'caja/abrir', 'caja/cobrar', 'caja/movimientos', 'caja/cerrar', 'pedidos/ver', 'pedidos/cambiar_estado', 'cocina/ver', 'catalogo/ver', 'comprobantes/reimprimir', 'mesas/liberar', 'repartos/liquidar']),
    );
  });

  it('no tiene compras, clientes, configuración, usuarios, stock, informes ', () => {
    const prohibidos = ['compras/', 'clientes/', 'configuracion/', 'usuarios/', 'stock/', 'informes/'];
    for (const prefijo of prohibidos) {
      expect(cajero.filter((p) => p.startsWith(prefijo))).toEqual([]);
    }
  });
});

describe('anular pedidos: todos los roles de pedidos (orden del dueño 08/11)', () => {
  it('todos los roles de personal con acceso a pedidos tienen pedidos/anular; ALMACEN no', () => {
    for (const [rol, claves] of Object.entries(MATRIZ)) {
      expect(claves.includes('pedidos/anular')).toBe(rol !== 'ALMACEN');
    }
  });

  it('el MOZO no tiene pedidos/cambiar_estado', () => {
    expect(MATRIZ.MOZO).not.toContain('pedidos/cambiar_estado');
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

  it('anula pedidos (orden del dueño 08/11); no tiene caja, compras, usuarios, configuracion, clientes ni repartos', () => {
    expect(cocina).toContain('pedidos/anular');
    const prohibidos = ['caja/', 'compras/', 'usuarios/', 'configuracion/', 'clientes/', 'repartos/'];
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

describe('código del supervisor eliminado', () => {
  it('ningún rol conserva supervisor/ver_codigo ni supervisor/gestionar_codigo, y ya no existen como permisos', () => {
    for (const r of Object.keys(MATRIZ)) {
      expect(MATRIZ[r]).not.toContain('supervisor/ver_codigo');
      expect(MATRIZ[r]).not.toContain('supervisor/gestionar_codigo');
    }
    expect(PERMISOS.some((p) => p.modulo === 'supervisor')).toBe(false);
  });
});

describe('permisos mascota (mas-api)', () => {
  it('solo ADMIN tiene mascota/ver y mascota/editar; ningún otro rol los tiene', () => {
    expect(MATRIZ.ADMIN).toContain('mascota/ver');
    expect(MATRIZ.ADMIN).toContain('mascota/editar');
    const otrosRoles = ['CAJERO', 'COCINA', 'MOZO', 'ALMACEN', 'REPARTIDOR'];
    for (const r of otrosRoles) {
      expect(MATRIZ[r]).not.toContain('mascota/ver');
      expect(MATRIZ[r]).not.toContain('mascota/editar');
    }
  });
});



describe('matriz de permisos del REPARTIDOR (pantalla Para elegir y Mi ruta)', () => {
  // Cada permiso que la pantalla del repartidor pide al servidor (ver/tomar/entregar/reportar)
  it('tiene todo lo que su pantalla llama: listar, iniciar ruta, salir/llegar/entregar y reportar', () => {
    expect(MATRIZ.REPARTIDOR).toEqual(
      expect.arrayContaining(['repartos/ver', 'repartos/tomar', 'repartos/entregar', 'repartos/reportar']),
    );
  });

  it('no tiene liquidar ni configurar reparto (eso es del administrador y de caja)', () => {
    expect(MATRIZ.REPARTIDOR).not.toContain('repartos/liquidar');
    expect(MATRIZ.REPARTIDOR).not.toContain('configuracion/editar');
  });
});

describe('rol CALLCENTER eliminado: el chat de WhatsApp es de MOZO y CAJERO', () => {
  const chat = ['mensajes/ver', 'mensajes/tomar', 'mensajes/enviar', 'mensajes/cerrar', 'whatsapp_salientes/ver', 'whatsapp_salientes/reenviar', 'whatsapp_salientes/descartar'];
  it('MOZO, CAJERO y SUPERVISOR tienen mensajes/* y whatsapp_salientes/*', () => {
    for (const r of ['MOZO', 'CAJERO', 'SUPERVISOR']) expect(MATRIZ[r]).toEqual(expect.arrayContaining(chat));
  });
  it('CAJERO canjea cupones en caja (POST /admin/cupones/canjear)', () => {
    expect(MATRIZ.CAJERO).toContain('cupones/canjear');
  });
  it('cocina, almacén y repartidor no atienden el chat', () => {
    for (const r of ['COCINA', 'ALMACEN', 'REPARTIDOR']) expect(MATRIZ[r].filter((p) => p.startsWith('mensajes/'))).toEqual([]);
  });
  it('ya no hay rol CALLCENTER en la lista ni en la matriz, y está marcado como eliminado', () => {
    expect(ROLES.map((r) => r.codigo)).not.toContain('CALLCENTER');
    expect(MATRIZ.CALLCENTER).toBeUndefined();
    expect(ROLES_ELIMINADOS).toContain('CALLCENTER');
  });
});

describe('permiso de la pantalla Despacho (cocina/despacho)', () => {
  it.each(['ADMIN', 'SUPERVISOR', 'COCINA', 'CAJERO'])('%s lo tiene', (rol) => {
    expect(MATRIZ[rol]).toContain('cocina/despacho');
  });
  it.each(['MOZO', 'REPARTIDOR', 'ALMACEN'])('%s no lo tiene', (rol) => {
    expect(MATRIZ[rol] ?? []).not.toContain('cocina/despacho');
  });
});

describe('pedidos/corregir_cliente (Corregir datos del cliente)', () => {
  it('lo tienen ADMIN, SUPERVISOR, CAJERO y MOZO; cocina, almacén y reparto no', () => {
    for (const r of ['ADMIN', 'SUPERVISOR', 'CAJERO', 'MOZO']) expect(MATRIZ[r]).toContain('pedidos/corregir_cliente');
    for (const r of ['COCINA', 'ALMACEN', 'REPARTIDOR']) expect(MATRIZ[r]).not.toContain('pedidos/corregir_cliente');
  });
});

describe('creditos/cobrar_ahora: cobrar al trabajador en el momento', () => {
  it('lo tienen ADMIN, CAJERO y MOZO; creditos/saldar y creditos/ver siguen solo del ADMIN', () => {
    for (const [rol, claves] of Object.entries(MATRIZ)) {
      expect(claves.includes('creditos/cobrar_ahora')).toBe(['ADMIN', 'CAJERO', 'MOZO'].includes(rol));
      if (rol !== 'ADMIN') {
        expect(claves).not.toContain('creditos/saldar');
        expect(claves).not.toContain('creditos/ver');
      }
    }
  });
});

describe('puedeAnularPedido (alcance por rol)', () => {
  const pedido = { party_id: 7n };
  it.each(['ADMIN', 'CAJERO', 'SUPERVISOR', 'COCINA', 'APOYO_DELIVERY', 'REPARTIDOR'])('%s anula', (rol) => {
    expect(puedeAnularPedido({ rol, partyId: 1n }, pedido)).toBe(true);
  });
  it('mozo anula cualquier pedido, propio o ajeno (decisión del dueño 09/11); con rol amplio también', () => {
    expect(puedeAnularPedido({ rol: 'MOZO', partyId: 7n }, pedido)).toBe(true);
    expect(puedeAnularPedido({ rol: 'MOZO', partyId: 8n }, pedido)).toBe(true);
    expect(puedeAnularPedido({ rol: 'MOZO', roles: ['MOZO', 'CAJERO'], partyId: 8n }, pedido)).toBe(true);
  });
  it('ALMACEN no anula', () => {
    expect(puedeAnularPedido({ rol: 'ALMACEN', partyId: 7n }, pedido)).toBe(false);
  });
});

describe('Planilla y asistencia obligatoria', () => {
  it('la planilla es solo del ADMIN', () => {
    for (const r of Object.keys(MATRIZ)) {
      for (const p of ['planilla/ver', 'planilla/administrar']) expect(MATRIZ[r].includes(p)).toBe(r === 'ADMIN');
    }
  });
  it('todo el personal (supervisor incluido) puede marcar asistencia', () => {
    for (const r of ['CAJERO', 'COCINA', 'MOZO', 'ALMACEN', 'REPARTIDOR', 'SUPERVISOR']) expect(MATRIZ[r]).toContain('asistencia/marcar');
  });
});
