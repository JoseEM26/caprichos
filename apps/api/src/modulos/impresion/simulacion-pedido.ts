import { esAreaBebidas } from '@caprichos/compartido';

export type ModalidadSimulacion = 'LLEVAR' | 'MESA' | 'DELIVERY' | 'COMER_LOCAL';
export const MODALIDADES_SIMULACION: ModalidadSimulacion[] = ['LLEVAR', 'MESA', 'DELIVERY', 'COMER_LOCAL'];

/** Nombre del cliente de la simulación: lleva «PRUEBA» para que nadie la confunda con una venta (también en programas viejos). */
export const CLIENTE_SIMULACION = 'PRUEBA · Miguel';
export const CODIGO_SIMULACION = 'PRUEBA';

/**
 * Pedido FICTICIO con la misma forma que una fila de `pedido` con sus líneas: solo en memoria (nunca se guarda),
 * para pasarlo por los mismos constructores y reglas que una venta real. Las áreas son las reales del local.
 */
export function construirPedidoSimulado(
  modalidad: ModalidadSimulacion,
  areas: Array<{ id: bigint; nombre: string }>,
  ahora = new Date(),
): any {
  const bebidas = areas.find((a) => esAreaBebidas(a.nombre)) ?? null;
  const otras = areas.filter((a) => a !== bebidas);
  const dulce = otras[0] ?? null;
  const salado = otras[1] ?? otras[0] ?? null;
  const area = (a: { id: bigint; nombre: string } | null) => (a ? { area_id: a.id, area: { nombre: a.nombre } } : { area_id: null, area: null });
  const lineas = [
    {
      id: 9001n,
      producto_id: 1n,
      nombre: 'Cappuccino',
      tamano: '12 oz',
      cantidad: 1,
      precio_unit: 12,
      subtotal: 12,
      categoria_nombre: 'Cafés',
      ...area(bebidas),
      opcionesElegidas: [
        { grupo_nombre: 'Leche', opcion_nombre: 'Leche de almendras' },
        { grupo_nombre: 'Extras', opcion_nombre: 'Canela' },
      ],
      sabores: [],
      nombres_persona: ['Miguel'],
      nota: 'Poco azúcar',
    },
    {
      id: 9002n,
      producto_id: 2n,
      nombre: 'Frappé de caramelo',
      tamano: '16 oz',
      cantidad: 1,
      precio_unit: 15,
      subtotal: 15,
      categoria_nombre: 'Frappés',
      ...area(bebidas),
      opcionesElegidas: [{ grupo_nombre: 'Extras', opcion_nombre: 'Crema batida' }],
      sabores: [],
      nombres_persona: ['Ana'],
      nota: null,
    },
    {
      id: 9003n,
      producto_id: 3n,
      nombre: 'Donas',
      tamano: null,
      cantidad: 6,
      precio_unit: 5,
      subtotal: 30,
      categoria_nombre: 'Postres',
      ...area(dulce),
      opcionesElegidas: [],
      sabores: [
        { cantidad: 2, sabor_nombre: 'Fresa' },
        { cantidad: 3, sabor_nombre: 'Oreo' },
        { cantidad: 1, sabor_nombre: 'Manjar' },
      ],
      nombres_persona: [],
      nota: null,
    },
    {
      id: 9004n,
      producto_id: 4n,
      nombre: 'Sándwich de pollo',
      tamano: null,
      cantidad: 1,
      precio_unit: 18,
      subtotal: 18,
      categoria_nombre: 'Salados',
      ...area(salado),
      opcionesElegidas: [{ grupo_nombre: 'Pan', opcion_nombre: 'Pan ciabatta' }],
      sabores: [],
      nombres_persona: [],
      nota: 'Sin cebolla',
    },
  ];
  const subtotal = lineas.reduce((s, l) => s + l.subtotal, 0);
  const envio = modalidad === 'DELIVERY' ? 6 : 0;
  const total = subtotal + envio;
  return {
    id: 0n,
    codigo: CODIGO_SIMULACION,
    modalidad,
    canal: 'CAJA',
    creado_en: ahora,
    cliente_nombre: CLIENTE_SIMULACION,
    cliente_telefono: modalidad === 'DELIVERY' ? '999 888 777' : null,
    mesa_nombre: modalidad === 'MESA' ? 'Mesa 4' : null,
    entrega_direccion: modalidad === 'DELIVERY' ? 'Av. Ficticia 123, zona de prueba' : null,
    nota: 'Pedido de prueba: no es una venta',
    lineas,
    subtotal,
    envio,
    total,
    propina: 0,
    paga_con: 100,
    // Coherente con el cobro de abajo: delivery sale por cobrar en efectivo (contra entrega); lo demas ya pagado
    pago_metodo: 'EFECTIVO',
    pago_estado: modalidad === 'DELIVERY' ? 'PENDIENTE' : 'PAGADO',
    comprobante_tipo: 'BOLETA',
    cobros: [{ en: ahora, anulado_en: null, pagos: [{ medio: 'EFECTIVO', monto: total, recibido: 100, vuelto: 100 - total }] }],
    planPago: [],
  };
}
