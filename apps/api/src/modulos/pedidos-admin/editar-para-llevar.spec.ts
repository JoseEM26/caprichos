jest.mock('../impresion/impresion.service', () => ({ ImpresionService: class {} }));
jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
jest.mock('../stock/producto-controlado', () => ({ ajustarVentaProductos: jest.fn(async () => ({ agotados: [], saboresAgotados: [] })) }));
jest.mock('../stock/opcion-requiere', () => ({
  requisitosDeOpciones: jest.fn(async () => new Map()),
  lineasDeRequisitosOpcion: jest.fn(async () => []),
}));

import { BadRequestException, ConflictException } from '@nestjs/common';
import { EditarPedidoService } from './editar-pedido.service';

const usuario: any = { partyId: BigInt(9), rol: 'CAJERO' };

/** Línea de mesa: 2 frappes a S/ 7 cada uno (subtotal 14), con una opción y sin nombres de vaso. */
function linea(over: any = {}) {
  return {
    id: BigInt(1),
    pedido_id: BigInt(100),
    producto_id: BigInt(5),
    oferta_id: null,
    linea_combo_id: null,
    cargo_libre: false,
    nombre: 'Frappe Oreo',
    tamano: 'Regular 12 oz',
    opciones: [{ id: 'o1' }],
    sabor: null,
    nota: 'sin hielo',
    cantidad: 2,
    precio_unit: 7,
    subtotal: 14,
    area_id: BigInt(3),
    adicional: false,
    nombres_persona: [],
    para_llevar: false,
    listas: 0,
    despachadas: 0,
    opcionesElegidas: [{ id: BigInt(70), pedido_linea_id: BigInt(1), opcion_id: BigInt(8), opcion_nombre: 'Extra leche', grupo_nombre: 'Leche', precio_unit: 0, precio_extra: 0 }],
    sabores: [],
    lineasComboHijas: [],
    ...over,
  };
}

function pedido(over: any = {}) {
  return {
    id: BigInt(100),
    codigo: 'CP-M100',
    version: 3,
    estado: 'COLA',
    canal: 'CAJA',
    modalidad: 'MESA',
    cliente_nombre: 'Ana',
    subtotal: 14,
    descuento: 0,
    total: 14,
    propina: 0,
    pago_estado: 'PENDIENTE',
    cobro_mozo_en: null,
    cupon_id: null,
    cupon_emitido_id: null,
    puntos_canjeados: 0,
    salio_en: null,
    atendido_despacho_en: null,
    lineas: [linea()],
    planPago: [],
    comandas: [],
    cobros: [],
    ...over,
  };
}

function montar(p: any) {
  const tx: any = {
    $queryRaw: jest.fn(async () => []),
    pedido: { findUnique: jest.fn(async () => p), update: jest.fn(async () => ({ version: p.version + 1 })) },
    pedidoLinea: { update: jest.fn(async () => ({})), create: jest.fn(async () => ({ id: BigInt(2) })), findMany: jest.fn(async () => []) },
    pedidoLineaOpcion: { createMany: jest.fn(async () => ({ count: 1 })) },
    pedidoEstadoHistorial: { create: jest.fn() },
    comandaArea: { create: jest.fn(), update: jest.fn(), deleteMany: jest.fn() },
  };
  const prisma: any = {
    pedido: { findUnique: jest.fn(async () => p) },
    $transaction: jest.fn(async (fn: any) => fn(tx)),
  };
  const auditoria: any = { registrar: jest.fn() };
  const eventos: any = { emitirAdmin: jest.fn() };
  const servicio = new EditarPedidoService(prisma, {} as any, {} as any, {} as any, {} as any, auditoria, undefined, eventos);
  return { servicio, tx, auditoria, eventos };
}

const cambiar = (servicio: EditarPedidoService, llevar: number, version = 3, lineaId = '1') =>
  servicio.cambiarParaLlevar('100', lineaId, { version, llevar } as any, usuario);

describe('para llevar por unidad: dividir una línea', () => {
  it('N=2, k=1: queda una línea aquí y otra para llevar; el total y el subtotal no cambian', async () => {
    const { servicio, tx, auditoria } = montar(pedido());
    const r = await cambiar(servicio, 1);

    expect(tx.pedidoLinea.update).toHaveBeenCalledWith({
      where: { id: BigInt(1) },
      data: expect.objectContaining({ cantidad: 1, para_llevar: false }),
    });
    const creada = tx.pedidoLinea.create.mock.calls[0][0].data;
    expect(creada).toMatchObject({ cantidad: 1, para_llevar: true, nombre: 'Frappe Oreo', tamano: 'Regular 12 oz', nota: 'sin hielo', precio_unit: 7 });
    // subtotal repartido: 7 + 7 = 14 (el total del pedido no se toca)
    expect(Number(tx.pedidoLinea.update.mock.calls[0][0].data.subtotal)).toBe(7);
    expect(Number(creada.subtotal)).toBe(7);
    // las opciones se copian a la línea nueva
    expect(tx.pedidoLineaOpcion.createMany.mock.calls[0][0].data[0]).toMatchObject({ opcion_nombre: 'Extra leche', pedido_linea_id: BigInt(2) });
    // el pedido solo sube de versión: ni total, ni subtotal, ni descuento
    const datosPedido = tx.pedido.update.mock.calls[0][0].data;
    expect(Object.keys(datosPedido)).toEqual(['version']);
    expect(r.version).toBe(4);

    const audit = auditoria.registrar.mock.calls[0][0];
    expect(audit.accion).toBe('EDITAR_PEDIDO');
    expect(audit.partyId).toBe(usuario.partyId);
    expect(audit.despues.cambios.map((c: any) => c.tipo)).toEqual(['LINEA_CAMBIADA', 'LINEA_AGREGADA']);
    expect(audit.despues.cambios[1].despues).toMatchObject({ cantidad: 1, paraLlevar: true });
  });

  it('con nombres de vaso, cada unidad conserva su nombre: la primera aquí y la última para llevar', async () => {
    const { servicio, tx } = montar(pedido({ lineas: [linea({ nombres_persona: ['Ana', 'Beto'] })] }));
    await cambiar(servicio, 1);
    expect(tx.pedidoLinea.update.mock.calls[0][0].data.nombres_persona).toEqual(['Ana']);
    expect(tx.pedidoLinea.create.mock.calls[0][0].data.nombres_persona).toEqual(['Beto']);
  });

  it('k=0 o k=N no divide: solo cambia la marca de la línea', async () => {
    const { servicio, tx } = montar(pedido());
    await cambiar(servicio, 2);
    expect(tx.pedidoLinea.update).toHaveBeenCalledWith({ where: { id: BigInt(1) }, data: { para_llevar: true } });
    expect(tx.pedidoLinea.create).not.toHaveBeenCalled();
  });

  it('una línea ya para llevar que pasa a comer aquí solo apaga la marca', async () => {
    const { servicio, tx } = montar(pedido({ lineas: [linea({ para_llevar: true })] }));
    await cambiar(servicio, 0);
    expect(tx.pedidoLinea.update).toHaveBeenCalledWith({ where: { id: BigInt(1) }, data: { para_llevar: false } });
    expect(tx.pedidoLinea.create).not.toHaveBeenCalled();
  });

  it('si la marca ya es la pedida, no toca nada', async () => {
    const { servicio, tx } = montar(pedido());
    const r = await cambiar(servicio, 0);
    expect(r.mensaje).toBe('Sin cambios');
    expect(tx.pedidoLinea.update).not.toHaveBeenCalled();
  });
});

describe('para llevar por unidad: rechazos', () => {
  it('con unidades ya listas no divide (409) y no escribe nada', async () => {
    const { servicio, tx } = montar(pedido({ lineas: [linea({ listas: 1 })] }));
    await expect(cambiar(servicio, 1)).rejects.toMatchObject({ response: { codigo: 'UNIDADES_YA_PREPARADAS' } });
    expect(tx.pedidoLinea.update).not.toHaveBeenCalled();
  });

  it('con unidades ya despachadas tampoco divide', async () => {
    const { servicio } = montar(pedido({ lineas: [linea({ despachadas: 1 })] }));
    await expect(cambiar(servicio, 1)).rejects.toBeInstanceOf(ConflictException);
  });

  it('una marca completa sí se permite aunque ya esté lista', async () => {
    const { servicio, tx } = montar(pedido({ lineas: [linea({ listas: 2 })] }));
    await cambiar(servicio, 2);
    expect(tx.pedidoLinea.update).toHaveBeenCalledWith({ where: { id: BigInt(1) }, data: { para_llevar: true } });
  });

  it.each([
    ['DELIVERY', 'PARA_LLEVAR_NO_APLICA'],
    ['RECOGER', 'PARA_LLEVAR_NO_APLICA'],
  ])('modalidad %s se rechaza', async (modalidad, codigo) => {
    const { servicio } = montar(pedido({ modalidad }));
    await expect(cambiar(servicio, 1)).rejects.toMatchObject({ response: { codigo } });
  });

  it('pedido entregado o anulado no se edita', async () => {
    for (const estado of ['ENTREGADO', 'ANULADO']) {
      const { servicio } = montar(pedido({ estado }));
      await expect(cambiar(servicio, 1)).rejects.toBeInstanceOf(ConflictException);
    }
  });

  it('combo guardado no cambia de para llevar', async () => {
    const combo = linea({ id: BigInt(1), oferta_id: BigInt(9), producto_id: null, lineasComboHijas: [{ id: BigInt(2) }] });
    const { servicio } = montar(pedido({ lineas: [combo] }));
    await expect(cambiar(servicio, 2)).rejects.toMatchObject({ response: { codigo: 'COMBO_NO_EDITABLE' } });
  });

  it('mezcla de sabores no se reparte por unidades', async () => {
    const mezcla = linea({ sabores: [{ sabor_id: BigInt(1), cantidad: 2 }] });
    const { servicio } = montar(pedido({ lineas: [mezcla] }));
    await expect(cambiar(servicio, 1)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('más unidades que las de la línea se rechaza', async () => {
    const { servicio } = montar(pedido());
    await expect(cambiar(servicio, 3)).rejects.toMatchObject({ response: { codigo: 'UNIDADES_INVALIDAS' } });
  });

  it('versión vieja responde 409 PEDIDO_MODIFICADO', async () => {
    const { servicio } = montar(pedido());
    await expect(cambiar(servicio, 1, 2)).rejects.toMatchObject({ response: { codigo: 'PEDIDO_MODIFICADO' } });
  });
});
