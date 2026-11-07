// Evita cargar el módulo de impresión (arrastra paquetes de PDF/QR que no hacen falta aquí)
jest.mock('../impresion/impresion.service', () => ({ ImpresionService: class {} }));
jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
jest.mock('../stock/producto-controlado', () => ({ ajustarVentaProductos: jest.fn(async () => ({ agotados: [], saboresAgotados: [] })) }));
jest.mock('../stock/opcion-requiere', () => ({
  requisitosDeOpciones: jest.fn(async () => new Map()),
  lineasDeRequisitosOpcion: jest.fn(async () => []),
}));

import { ConflictException } from '@nestjs/common';
import { ajustarVentaProductos } from '../stock/producto-controlado';
import { PagoPlanService } from '../pedidos/pago-plan.service';
import { ajustarPlanAlTotal, EditarPedidoService } from './editar-pedido.service';

const usuario: any = { partyId: BigInt(9), rol: 'CAJERO' };

function fila(over: any = {}) {
  return {
    id: BigInt(1),
    pedido_id: BigInt(100),
    producto_id: BigInt(5),
    oferta_id: null,
    linea_combo_id: null,
    nombre: 'Café',
    tamano: null,
    cantidad: 2,
    precio_unit: 10,
    subtotal: 20,
    nota: null,
    nombres_persona: [],
    area_id: BigInt(3),
    es_cortesia: false,
    opcionesElegidas: [],
    sabores: [],
    lineasComboHijas: [],
    ...over,
  };
}

function pedidoBase(over: any = {}) {
  return {
    id: BigInt(100),
    codigo: 'CP-W100',
    version: 3,
    estado: 'COLA',
    canal: 'CAJA',
    modalidad: 'RECOGER',
    party_id: null,
    cliente_party_id: null,
    cliente_nombre: 'Ana',
    cliente_telefono: '987654321',
    pago_estado: 'PENDIENTE',
    pago_metodo: 'EFECTIVO',
    paga_con: null,
    cobro_mozo_en: null,
    cupon_id: null,
    cupon_emitido_id: null,
    puntos_canjeados: 0,
    salio_en: null,
    atendido_despacho_en: null,
    subtotal: 20,
    descuento: 0,
    envio: 0,
    total: 20,
    propina: 0,
    creado_en: new Date('2027-01-10T10:00:00Z'),
    entrega_direccion: null,
    entrega_referencia: null,
    entrega_lat: null,
    entrega_lng: null,
    entrega_origen: null,
    zona_id: null,
    lineas: [fila()],
    planPago: [],
    comandas: [],
    cobros: [],
    ...over,
  };
}

function montar(pedido: any, extra: { nuevas?: any[]; subtotalNuevo?: number; ventaNueva?: any[] } = {}) {
  const tx: any = {
    $queryRaw: jest.fn(async () => []),
    pedido: { findUnique: jest.fn(async () => pedido), update: jest.fn(async (a: any) => ({ ...pedido, version: pedido.version + 1, ...a.data, version2: 1 })) },
    pedidoLinea: { deleteMany: jest.fn(), findMany: jest.fn(async () => []) },
    pedidoLineaSabor: { deleteMany: jest.fn() },
    pedidoLineaOpcion: { deleteMany: jest.fn() },
    pedidoPagoPlan: { deleteMany: jest.fn(), createMany: jest.fn() },
    comandaArea: { create: jest.fn(), update: jest.fn(), deleteMany: jest.fn() },
    pedidoEstadoHistorial: { create: jest.fn() },
  };
  // la versión que devuelve el update debe ser la nueva
  tx.pedido.update = jest.fn(async (a: any) => ({ ...pedido, version: pedido.version + 1 }));
  const prisma: any = {
    ...tx,
    $transaction: jest.fn(async (fn: any) => fn(tx)),
    pedido: { findUnique: jest.fn(async () => pedido), update: tx.pedido.update },
    producto: { findMany: jest.fn(async () => [{ id: BigInt(5), categoria_id: BigInt(1), no_suma_beneficios: false, tamanos: [] }]) },
    oferta: { findMany: jest.fn(async () => []) },
    voucherPago: { count: jest.fn(async () => 0) },
    parametro: { findUnique: jest.fn(async () => null) },
    person: { findUnique: jest.fn(async () => ({ nombres: 'Ana María' })) },
  };
  tx.pedido.findUnique = prisma.pedido.findUnique;
  const nuevas = extra.nuevas ?? [];
  const pedidos: any = {
    calcularLineasPedido: jest.fn(async () => ({ lineasCalculadas: nuevas, subtotalCalculado: extra.subtotalNuevo ?? 0 })),
    escribirLineasPedido: jest.fn(),
    ventaDeLineas: jest.fn(async () => extra.ventaNueva ?? []),
  };
  const ofertas: any = { calcularDescuentosParaPedido: jest.fn(async () => ({ descuentoTotal: 0, detalles: [], ofertaId: null })) };
  const zonas: any = { detectar: jest.fn() };
  const auditoria: any = { registrar: jest.fn() };
  const eventos: any = { emitirAdmin: jest.fn() };
  const servicio = new EditarPedidoService(prisma, pedidos, zonas, ofertas, new PagoPlanService(), auditoria, undefined, eventos);
  return { servicio, prisma, tx, pedidos, ofertas, auditoria, eventos };
}

const lineaNueva = (over: any = {}) => ({
  productoId: BigInt(6),
  ofertaId: null,
  categoriaId: BigInt(1),
  noSumaBeneficios: false,
  nombre: 'Torta',
  tamano: null,
  cantidad: 1,
  precioUnitario: 10,
  subtotal: 10,
  nota: null,
  nombresPersona: [],
  opciones: [],
  sabores: [],
  ...over,
});

describe('ajustarPlanAlTotal', () => {
  it('la diferencia la absorbe el efectivo', () => {
    const r = ajustarPlanAlTotal([{ medio: 'YAPE', monto: 10 }, { medio: 'EFECTIVO', monto: 10 }], 25);
    expect(r).toEqual([{ medio: 'YAPE', monto: 10 }, { medio: 'EFECTIVO', monto: 15 }]);
  });
  it('si el total baja, quita primero del efectivo y elimina el renglón en cero', () => {
    const r = ajustarPlanAlTotal([{ medio: 'YAPE', monto: 10 }, { medio: 'EFECTIVO', monto: 10 }], 8);
    expect(r).toEqual([{ medio: 'YAPE', monto: 8 }]);
  });
});

describe('EditarPedidoService.editar', () => {
  it('agrega una línea y recalcula subtotal, total y versión', async () => {
    const { servicio, tx } = montar(pedidoBase(), { nuevas: [lineaNueva()], subtotalNuevo: 10 });
    const r = await servicio.editar('100', {
      version: 3,
      lineas: [{ lineaId: '1', productoId: '5', cantidad: 2 } as any, { productoId: '6', cantidad: 1 } as any],
    }, usuario);
    expect(r.subtotal).toBe(30);
    expect(r.total).toBe(30);
    expect(r.totalAnterior).toBe(20);
    const datos = tx.pedido.update.mock.calls[0][0].data;
    expect(Number(datos.total)).toBe(30);
    expect(datos.version).toEqual({ increment: 1 });
    // la línea que no cambió no se toca
    expect(tx.pedidoLinea.deleteMany).not.toHaveBeenCalled();
  });

  it('quita una línea: devuelve su stock y baja el total', async () => {
    const { servicio, tx } = montar(pedidoBase({ lineas: [fila(), fila({ id: BigInt(2), producto_id: BigInt(7), nombre: 'Pan', cantidad: 1, subtotal: 5, precio_unit: 5 })], subtotal: 25, total: 25 }));
    const r = await servicio.editar('100', { version: 3, lineas: [{ lineaId: '1', productoId: '5', cantidad: 2 } as any] }, usuario);
    expect(r.total).toBe(20);
    const [, , quitar, agregar] = (ajustarVentaProductos as jest.Mock).mock.calls.at(-1);
    expect(quitar).toEqual([expect.objectContaining({ productoId: BigInt(7), cantidad: 1 })]);
    expect(agregar).toEqual([]);
    expect(tx.pedidoLinea.deleteMany).toHaveBeenCalled();
  });

  it('cambiar la cantidad rehace la línea: devuelve lo anterior y descuenta lo nuevo', async () => {
    const nueva = lineaNueva({ productoId: BigInt(5), nombre: 'Café', cantidad: 3, subtotal: 30 });
    const { servicio, pedidos } = montar(pedidoBase(), { nuevas: [nueva], subtotalNuevo: 30, ventaNueva: [{ productoId: BigInt(5), cantidad: 3 }] });
    const r = await servicio.editar('100', { version: 3, lineas: [{ lineaId: '1', productoId: '5', cantidad: 3 } as any] }, usuario);
    expect(r.total).toBe(30);
    expect(pedidos.escribirLineasPedido).toHaveBeenCalledTimes(1);
    const [, , quitar, agregar] = (ajustarVentaProductos as jest.Mock).mock.calls.at(-1);
    expect(quitar).toEqual([expect.objectContaining({ productoId: BigInt(5), cantidad: 2 })]);
    expect(agregar).toEqual([{ productoId: BigInt(5), cantidad: 3 }]);
  });

  it('409 PEDIDO_MODIFICADO si la versión que vio ya cambió', async () => {
    const { servicio, tx } = montar(pedidoBase({ version: 4 }));
    await expect(servicio.editar('100', { version: 3, lineas: [{ lineaId: '1', productoId: '5', cantidad: 2 } as any] }, usuario)).rejects.toMatchObject({
      response: expect.objectContaining({ codigo: 'PEDIDO_MODIFICADO', version: 4 }),
    });
    expect(tx.pedido.update).not.toHaveBeenCalled();
  });

  it.each([
    ['ENTREGADO', { estado: 'ENTREGADO' }],
    ['ANULADO', { estado: 'ANULADO' }],
    ['pagado', { pago_estado: 'PAGADO' }],
    ['con cobro vigente', { cobros: [{ id: BigInt(1) }] }],
    ['cobrado por el mozo', { cobro_mozo_en: new Date() }],
    ['con cupón', { cupon_id: BigInt(1) }],
    ['con cortesía', { lineas: [fila({ es_cortesia: true })] }],
  ])('bloquea la edición de un pedido %s con mensaje claro', async (_n, over) => {
    const { servicio, tx } = montar(pedidoBase(over as any));
    await expect(servicio.editar('100', { version: 3, lineas: [{ lineaId: '1', productoId: '5', cantidad: 2 } as any] }, usuario)).rejects.toBeInstanceOf(ConflictException);
    expect(tx.pedido.update).not.toHaveBeenCalled();
  });

  it('permite editar en PREPARANDO y LISTO', async () => {
    for (const estado of ['PREPARANDO', 'LISTO']) {
      const { servicio } = montar(pedidoBase({ estado }));
      await expect(servicio.editar('100', { version: 3, lineas: [{ lineaId: '1', productoId: '5', cantidad: 2 } as any] }, usuario)).resolves.toMatchObject({ id: '100' });
    }
  });

  it('LISTO con una línea nueva sin preparar vuelve a PREPARANDO', async () => {
    const { servicio, tx } = montar(pedidoBase({ estado: 'LISTO', comandas: [{ area_id: BigInt(3), estado: 'DESPEJADA' }] }), { nuevas: [lineaNueva()], subtotalNuevo: 10 });
    tx.pedidoLinea.findMany.mockResolvedValue([{ id: BigInt(1), cantidad: 2, listas: 2, area_id: BigInt(3), producto: null }, { id: BigInt(9), cantidad: 1, listas: 0, area_id: BigInt(3), producto: null }]);
    const r = await servicio.editar('100', { version: 3, lineas: [{ lineaId: '1', productoId: '5', cantidad: 2 } as any, { productoId: '6', cantidad: 1 } as any] }, usuario);
    expect(r.estado).toBe('PREPARANDO');
    expect(tx.comandaArea.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ estado: 'EN_COCINA' }) }));
  });

  it('ajusta el plan de pago al nuevo total', async () => {
    const { servicio, tx } = montar(
      pedidoBase({ planPago: [{ medio: 'YAPE', monto: 10 }, { medio: 'EFECTIVO', monto: 10 }], paga_con: 10 }),
      { nuevas: [lineaNueva()], subtotalNuevo: 10 },
    );
    await servicio.editar('100', { version: 3, lineas: [{ lineaId: '1', productoId: '5', cantidad: 2 } as any, { productoId: '6', cantidad: 1 } as any] }, usuario);
    expect(tx.pedidoPagoPlan.deleteMany).toHaveBeenCalled();
    expect(tx.pedidoPagoPlan.createMany.mock.calls[0][0].data.map((f: any) => [f.medio, Number(f.monto)])).toEqual([['YAPE', 10], ['EFECTIVO', 20]]);
    // «paga con» 10 ya no alcanza para el efectivo de 20
    expect(tx.pedido.update.mock.calls[0][0].data.paga_con).toBeNull();
  });

  it('audita quién, antes y después por línea y por dato', async () => {
    const { servicio, auditoria, tx } = montar(pedidoBase(), { nuevas: [lineaNueva()], subtotalNuevo: 10 });
    const r = await servicio.editar('100', {
      version: 3,
      cliente: { nombre: 'Ana Pérez', telefono: '987654321' },
      lineas: [{ lineaId: '1', productoId: '5', cantidad: 2 } as any, { productoId: '6', cantidad: 1 } as any],
    }, usuario, '1.2.3.4');
    const [registro, db] = auditoria.registrar.mock.calls[0];
    expect(db).toBe(tx);
    expect(registro).toMatchObject({ modulo: 'pedidos', accion: 'EDITAR_PEDIDO', entidad: 'pedido', entidadId: BigInt(100), partyId: BigInt(9), ip: '1.2.3.4' });
    expect(registro.antes.total).toBe(20);
    expect(registro.despues.total).toBe(30);
    expect(registro.despues.cambios).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ tipo: 'LINEA_AGREGADA' }),
        expect.objectContaining({ tipo: 'DATO', campo: 'Nombre', antes: 'Ana', despues: 'Ana Pérez' }),
      ]),
    );
    expect(r.cambios).toEqual(expect.arrayContaining(['Agregó 1 × Torta']));
    expect(tx.pedidoEstadoHistorial.create.mock.calls[0][0].data.motivo).toContain('Pedido editado');
  });

  it('avisa por socket a Caja, Mozo, Cocina y Despacho (pedido:editado) y libera «editando»', async () => {
    const { servicio, eventos } = montar(pedidoBase());
    await servicio.editar('100', { version: 3, lineas: [{ lineaId: '1', productoId: '5', cantidad: 2 } as any] }, usuario);
    const nombres = eventos.emitirAdmin.mock.calls.map((c: any[]) => c[0]);
    expect(nombres).toContain('pedido:editado');
    expect(eventos.emitirAdmin).toHaveBeenCalledWith('pedido:editando', expect.objectContaining({ id: '100', activo: false }));
  });
});

describe('EditarPedidoService presencia', () => {
  it('«editando» se anuncia y el otro usuario lo ve al abrir el editor', async () => {
    const { servicio, eventos } = montar(pedidoBase());
    await servicio.marcarEditando('100', true, usuario);
    expect(eventos.emitirAdmin).toHaveBeenCalledWith('pedido:editando', expect.objectContaining({ id: '100', activo: true, nombre: 'Ana' }));
    const visto = await servicio.obtenerParaEditar('100', { partyId: BigInt(10), rol: 'MOZO' } as any);
    expect(visto.editandoPor).toEqual({ partyId: '9', nombre: 'Ana' });
    // quien lo abrió no se ve a sí mismo
    const propio = await servicio.obtenerParaEditar('100', usuario);
    expect(propio.editandoPor).toBeNull();
  });
});
