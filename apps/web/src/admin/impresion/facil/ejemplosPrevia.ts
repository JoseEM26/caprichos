import {
  calcularPagoPedido,
  type DescuentoTicket,
  type EtiquetaAreaDatos,
  type EtiquetaBebidaDatos,
  type EtiquetaGeneralDatos,
  type LineaComandaDatos,
  type LineaDetalleEntrada,
  type TicketComandaSalonDatos,
  type TicketPagoDatos,
} from '@caprichos/compartido';

/** Rótulo de la precuenta: el mismo texto que pone la API (reimpresion-pedido.ts, MARCA_PRECUENTA). */
export const MARCA_PRECUENTA = 'PRE-CUENTA - SIN PAGAR';
const FECHA = '09/11/2026';
const HORA = '12:40';
const NOMBRE_LARGO = 'María Elena Guadalupe del Carmen de los Santos Pérez';

type LineaEj = LineaDetalleEntrada & { bebida?: boolean };

interface Receta {
  descripcion: string;
  /** Nombre fijo (el caso del nombre larguísimo); sin él se usa el del azar. */
  nombre?: string;
  modalidad: 'MESA' | 'LLEVAR' | 'DELIVERY';
  entrega: string;
  lineas: LineaEj[];
  envio?: number;
  descuentos?: DescuentoTicket[];
  medio: 'YAPE' | 'EFECTIVO' | 'TARJETA' | 'DIVIDIDO';
  pagaCon?: number;
  propina?: number;
  documento: 'SIMPLE' | 'BOLETA' | 'FACTURA';
  nota?: string;
}

const RECETAS: Receta[] = [
  {
    descripcion: 'en mesa, con extras y opciones, pagado con Yape',
    modalidad: 'MESA',
    entrega: 'Mesa 4',
    medio: 'YAPE',
    documento: 'BOLETA',
    lineas: [
      { cantidad: 2, nombre: 'Café latte', tamano: 'Grande', precioUnit: 11, subtotal: 22, bebida: true, opciones: [{ grupo: 'Leche', nombre: 'Avena', extra: 2 }, { grupo: 'Endulzante', nombre: 'Sin azúcar' }], nombresPersona: ['Ana', 'Luis'] },
      { cantidad: 1, nombre: 'Torta de chocolate', subtotal: 14.5, nota: 'Con vela' },
    ],
  },
  {
    descripcion: 'delivery con nombre muy largo, cupón y envío, efectivo con vuelto',
    nombre: NOMBRE_LARGO,
    modalidad: 'DELIVERY',
    entrega: 'Av. Larga 123, Comas',
    medio: 'EFECTIVO',
    pagaCon: 100,
    documento: 'SIMPLE',
    envio: 5,
    descuentos: [{ nombre: 'Cupón VERANO10', monto: 4 }],
    nota: 'Tocar el timbre dos veces',
    lineas: [
      { cantidad: 2, nombre: 'Limonada frozen', tamano: 'Grande', precioUnit: 9, subtotal: 18, bebida: true, nombresPersona: ['Lucía', 'Marco'], opciones: [{ grupo: 'Sabor', nombre: 'Fresa', extra: 1 }] },
      { cantidad: 1, nombre: 'Sándwich de pollo', subtotal: 18.5, nota: 'Sin cebolla', opciones: [{ grupo: 'Salsa', nombre: 'Ají de la casa' }] },
    ],
  },
  {
    descripcion: 'para llevar, combo Dúo, tarjeta y propina',
    modalidad: 'LLEVAR',
    entrega: 'Para llevar',
    medio: 'TARJETA',
    propina: 2,
    documento: 'BOLETA',
    lineas: [
      {
        cantidad: 1, nombre: 'Dúo dulce', subtotal: 29.9,
        partes: [
          { cantidad: 1, nombre: 'Frappuccino', tamano: 'Mediano', subtotal: 0, opciones: [{ grupo: 'Leche', nombre: 'Almendra', extra: 2.5 }] },
          { cantidad: 2, nombre: 'Dona glaseada', subtotal: 0, sabores: [{ sabor: 'Oreo', cantidad: 1 }, { sabor: 'Maracuyá', cantidad: 1 }] },
        ],
      },
      { cantidad: 3, nombre: 'Galleta de avena', precioUnit: 4, subtotal: 12 },
    ],
  },
  {
    descripcion: 'en mesa, pago dividido (efectivo y Yape) con factura',
    modalidad: 'MESA',
    entrega: 'Mesa 12',
    medio: 'DIVIDIDO',
    pagaCon: 30,
    documento: 'FACTURA',
    lineas: [
      { cantidad: 2, nombre: 'Té chai', tamano: 'Grande', precioUnit: 10, subtotal: 20, bebida: true },
      { cantidad: 2, nombre: 'Croissant de jamón y queso', precioUnit: 9.5, subtotal: 19 },
      { cantidad: 1, nombre: 'Carrot cake', subtotal: 13, cortesia: { valorLista: 13 } },
    ],
  },
];

export const CANTIDAD_EJEMPLOS = RECETAS.length;

export interface EjemploPrevia {
  indice: number;
  nombre: string;
  /** Frase para el aria-label y el texto del selector: qué pedido es. */
  descripcion: string;
  bebida: EtiquetaBebidaDatos;
  area: EtiquetaAreaDatos;
  general: EtiquetaGeneralDatos;
  pago: TicketPagoDatos;
  comanda: TicketComandaSalonDatos;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Arma TODAS las piezas del mismo pedido de ejemplo (así el sticker, el voucher y la comanda cuadran entre sí). */
export function ejemploPrevia(indice: number, nombreAzar: string): EjemploPrevia {
  const rc = RECETAS[((indice % RECETAS.length) + RECETAS.length) % RECETAS.length];
  const nombre = rc.nombre ?? nombreAzar;
  const subtotal = r2(rc.lineas.reduce((a, l) => a + l.subtotal, 0));
  const descuento = r2((rc.descuentos ?? []).reduce((a, d) => a + d.monto, 0));
  const total = r2(subtotal - descuento + (rc.envio ?? 0));
  const lineas: LineaDetalleEntrada[] = rc.lineas.map(({ bebida: _b, ...l }) => l);
  const codigo = `A-${1020 + indice}`;
  const delivery = rc.modalidad === 'DELIVERY';
  const modalidadTxt = rc.modalidad === 'MESA' ? 'Mesa' : rc.modalidad === 'LLEVAR' ? 'Para llevar' : 'Delivery';
  const dividido = rc.medio === 'DIVIDIDO';
  const planPago = dividido ? [{ medio: 'EFECTIVO', monto: 20, orden: 1 }, { medio: 'YAPE', monto: r2(total - 20), orden: 2 }] : undefined;
  const efectivo = dividido ? 20 : rc.medio === 'EFECTIVO' ? total : 0;
  const pagoEt = calcularPagoPedido({
    total, descuento, propina: rc.propina, modalidad: rc.modalidad, planPago, paga_con: rc.pagaCon,
    pago_metodo: dividido ? null : rc.medio, pago_estado: delivery && rc.medio === 'EFECTIVO' ? 'PENDIENTE' : 'PAGADO',
  });
  const pagos = (planPago ?? [{ medio: rc.medio, monto: total }]).map((p) => ({
    medio: p.medio,
    monto: p.monto,
    ...(p.medio === 'EFECTIVO' && rc.pagaCon ? { recibido: rc.pagaCon, vuelto: r2(Math.max(0, rc.pagaCon - efectivo)) } : {}),
  }));
  const hayComp = rc.documento !== 'SIMPLE';
  const ticket: TicketPagoDatos = {
    local: { nombre: 'CAPRICHOS', razonSocial: 'Caprichos Cafetería S.A.C.', ruc: '20601234567', direccion: 'Av. Los Olivos 456, Los Olivos' },
    codigo, fecha: FECHA, hora: HORA, who: nombre, modalidad: modalidadTxt, entrega: rc.entrega,
    clienteTelefono: delivery ? '987 *** 321' : null, lineas, subtotal, descuentos: rc.descuentos, envio: rc.envio,
    notaPedido: rc.nota ?? null, pagaCon: delivery ? null : undefined, total, propina: rc.propina, pagos,
    documento: { tipo: rc.documento, clienteNombre: rc.documento === 'FACTURA' ? 'Inversiones Pacífico S.A.C.' : nombre, docTipo: rc.documento === 'FACTURA' ? 'RUC' : 'DNI', docNumero: rc.documento === 'FACTURA' ? '20512345678' : '45678912', direccion: rc.documento === 'FACTURA' ? 'Jr. Unión 100, Lima' : null, igvPct: 18 },
    comprobante: hayComp
      ? { tipo: rc.documento === 'FACTURA' ? 'FACTURA' : 'BOLETA', numero: rc.documento === 'FACTURA' ? 'F001-00000123' : 'B001-00004567', representacion: 'Representación impresa del comprobante electrónico. Consulta en caprichos.pe/comprobantes', hash: 'k3Pq9ZxT1mVb7LwR4dYc8NfH2sA=', cadenaQr: 'PLACEHOLDER', situacion: 'FIRMADO' }
      : null,
  };
  const prods = (l: LineaEj) => ({ cantidad: l.cantidad, nombre: l.nombre, tamano: l.tamano ?? null });
  const bebidas = rc.lineas.filter((l) => l.bebida);
  const b0 = bebidas[0];
  const opts = (l: LineaEj) => (l.opciones ?? []).map((o) => (o.grupo ? `${o.grupo}: ${o.nombre}` : o.nombre));
  const comandaLinea = (l: LineaEj | LineaDetalleEntrada): LineaComandaDatos => ({
    cantidad: l.cantidad, nombre: l.nombre, tamano: l.tamano ?? null, opciones: opts(l as LineaEj), nota: l.nota ?? null,
    ...(l.partes?.length ? { partes: l.partes.map(comandaLinea) } : {}),
  });
  return {
    indice, nombre, descripcion: `${rc.descripcion}, cliente ${nombre}`,
    bebida: { bebidaIndex: 1, totalBebidas: Math.max(1, bebidas.reduce((a, l) => a + l.cantidad, 0)), codigo, persona: b0?.nombresPersona?.[0] ?? nombre, bebidaNombre: b0?.nombre ?? 'Limonada', tamano: b0?.tamano ?? 'Grande', opciones: b0 ? opts(b0) : [], contiene: null, who: nombre, hora: HORA },
    area: { areaNombre: 'SALADOS', areaIndex: 1, totalAreas: 2, codigo, modalidadPill: modalidadTxt.toUpperCase(), who: nombre, canal: delivery ? 'WEB' : 'MESA', hora: HORA, fecha: FECHA, lineas: rc.lineas.filter((l) => !l.bebida).map((l) => ({ ...prods(l), opciones: opts(l), nota: l.nota ?? null })), esCompacta: false, nota: rc.nota ?? null, printer: 'Etiquetera cocina' },
    general: { codigo, modalidad: rc.modalidad === 'MESA' ? 'LLEVAR' : rc.modalidad, modalidadPill: modalidadTxt.toUpperCase(), who: nombre, canal: delivery ? 'WEB' : 'CAJA', hora: HORA, fecha: FECHA, cantidadProductos: rc.lineas.reduce((a, l) => a + l.cantidad, 0), productos: rc.lineas.map(prods), nota: rc.nota ?? null, total, pago: pagoEt, printer: 'PC Caja', ...(delivery ? { direccion: rc.entrega, telefono: '987 654 321' } : {}) },
    pago: ticket,
    comanda: { codigo, mesa: rc.modalidad === 'MESA' ? rc.entrega : null, cliente: nombre, canal: rc.modalidad === 'MESA' ? 'MESA' : rc.modalidad, hora: HORA, fecha: FECHA, lineas: lineas.map(comandaLinea), nota: rc.nota ?? null },
  };
}

/** La precuenta es el MISMO ticket de pago, sin cobrar: sin pagos, sin comprobante y con el rótulo de la API. */
export function comoPrecuenta(p: TicketPagoDatos): TicketPagoDatos {
  return { ...p, marca: MARCA_PRECUENTA, pagos: [], plan: undefined, comprobante: null, documento: null, pagaCon: null, propina: undefined };
}
