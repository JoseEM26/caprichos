import { ContextoConversacion, FlujoConversacion } from '../tipos-conversacion';
import { normalizarEntrada } from '../normalizador-entrada.util';
import { transicionarEstado } from '../maquina-estados';

// El bot muestra el total con la vista previa del servidor (promo con casilla BOT y envío). Estos casos fijan
// que el resumen y la ubicación salen de esa vista, sin promo ni default de tarifa.
const clasica = {
  lineaId: 'lin_1',
  productoId: '1',
  productoNombre: 'Clásica',
  categoriaId: 'cat_hamb',
  categoriaNombre: 'Hamburguesas',
  cantidad: 2,
  precioUnitario: 20,
  subtotal: 40,
  opciones: [],
  noSumaBeneficios: false,
};

const contextoBase: ContextoConversacion = {
  nombreCliente: 'Ana',
  telefonoCliente: '51987654321',
  cartaUrlPublica: 'https://carta.test',
  datosLocal: { abierta: true, abre: '12:00', cierra: '23:00' } as any,
  datosLocalPublicos: {},
  categoriasCarta: [],
  ofertas: [],
};

/** Pedido listo para el resumen: delivery con zona, cliente, pago y comprobante ya elegidos. */
const flujoAntesDelResumen = (): FlujoConversacion => ({
  version: 1,
  estado: 'PEDIDO_ACCION_CARRITO',
  repreguntasFallidas: 0,
  pedido: {
    estadoInterno: 'PEDIDO_ACCION_CARRITO',
    modalidad: 'DELIVERY',
    items: [clasica],
    entrega: { modalidad: 'DELIVERY', lat: -12.04, lng: -77.04, direccion: 'Av. Principal 123', tarifaZona: 5, tarifaEnvio: 5 },
    cliente: { nombre: 'Ana', telefono: '987654321' },
    pago: { metodo: 'EFECTIVO' },
    comprobante: { tipo: 'NINGUNO' },
  },
} as any);

const resumenCon = (vista: ContextoConversacion['vistaPreviaPedido']) => {
  const r = transicionarEstado(
    flujoAntesDelResumen(),
    normalizarEntrada({ buttonPayload: 'ped_cart_continuar' }),
    { ...contextoBase, vistaPreviaPedido: vista },
  );
  expect(r.nuevoEstado).toBe('PEDIDO_RESUMEN_CONFIRMAR');
  return (r.acciones[0] as any).texto as string;
};

describe('Pedido del bot: total con la vista previa del servidor', () => {
  it('con promo BOT de descuento y envío gratis: una línea de descuento y envío gratis, en el mismo mensaje', () => {
    const texto = resumenCon({ subtotal: 40, descuento: 4, descuentoNombre: 'Martes 2x1', envio: 0, envioGratis: true });
    expect(texto).toContain('Descuento Martes 2x1 −S/ 4.00');
    expect(texto).toContain('Envío: gratis');
    expect(texto).toContain('*Total: S/ 36.00*');
  });

  it('sin promo: no aparece línea de descuento y el envío es el de la zona', () => {
    const texto = resumenCon({ subtotal: 40, descuento: 0, descuentoNombre: null, envio: 5, envioGratis: false });
    expect(texto).not.toContain('Descuento');
    expect(texto).toContain('Envío: S/ 5.00');
    expect(texto).toContain('*Total: S/ 45.00*');
  });

  it('nunca menciona cupones ni puntos en el resumen', () => {
    const texto = resumenCon({ subtotal: 40, descuento: 4, descuentoNombre: 'Martes 2x1', envio: 0, envioGratis: true });
    expect(texto).not.toMatch(/cup[oó]n|puntos/i);
  });

  it('sin vista previa cae al precio de lista con el envío del pedido', () => {
    const texto = resumenCon(null);
    expect(texto).not.toContain('Descuento');
    expect(texto).toContain('*Total: S/ 45.00*');
  });
});

describe('Ubicación del bot: el envío sale del servidor, sin tarifa inventada', () => {
  const flujoEnUbicacion = (): FlujoConversacion => ({
    version: 1,
    estado: 'PEDIDO_UBICACION',
    repreguntasFallidas: 0,
    pedido: {
      estadoInterno: 'PEDIDO_UBICACION',
      modalidad: 'DELIVERY',
      items: [clasica],
      cliente: { nombre: 'Ana', telefono: '987654321' },
    },
  } as any);
  const ubicacion = normalizarEntrada({
    tipo: 'location',
    ubicacion: { latitud: -12.0196, longitud: -76.9632, nombre: 'Mi Casa', direccion: 'Av. Gran Chimú 500' },
  });

  it('con promo de envío gratis por horario: envío 0 y el texto dice gratis', () => {
    const r = transicionarEstado(flujoEnUbicacion(), ubicacion, {
      ...contextoBase,
      resultadoEnvio: { cubierto: true, tarifa: 5, gratisDesde: 70 },
      vistaPreviaPedido: { subtotal: 40, descuento: 0, descuentoNombre: null, envio: 0, envioGratis: true },
    });
    expect((r.nuevoFlujo.pedido as any).entrega.tarifaEnvio).toBe(0);
    expect((r.acciones[0] as any).texto).toContain('es gratis');
  });

  it('zona sin tarifa conocida: el envío queda por calcular (no 5.00 ni 70 por defecto)', () => {
    const r = transicionarEstado(flujoEnUbicacion(), ubicacion, {
      ...contextoBase,
      resultadoEnvio: { cubierto: true, tarifa: null },
      vistaPreviaPedido: { subtotal: 40, descuento: 0, descuentoNombre: null, envio: null, envioGratis: false },
    });
    expect((r.nuevoFlujo.pedido as any).entrega.tarifaEnvio).toBeNull();
    expect((r.acciones[0] as any).texto).toContain('lo confirma un asesor');
    expect((r.acciones[0] as any).texto).not.toContain('5.00');
  });
});
