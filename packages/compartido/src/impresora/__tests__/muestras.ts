// Casos de las pruebas de oro: datos INVENTADOS. Un cambio intencional de diseño regenera oro.json (ver oro.spec.ts).

export interface CasoOro {
  nombre: string;
  tipo: string;
  payload: any;
  copia?: boolean;
  ticketColumnas?: number;
  etiqueta?: Record<string, unknown>;
}

const general = {
  codigo: 'PED-101', modalidad: 'SALON', modalidadPill: 'MESA 4', who: 'Juan Perez', canal: 'Caja', hora: '15:30', fecha: '26/10/2026',
  cantidadProductos: 3,
  productos: [
    { cantidad: 1, nombre: 'Americano Clasico', tamano: '8oz' },
    { cantidad: 1, nombre: 'Croissant de Jamon y Queso' },
    { cantidad: 1, nombre: 'Jugo de Naranja Natural' },
  ],
  nota: 'Entregar caliente', printer: 'Etiquetera de caja',
};
const area = {
  areaNombre: 'COCINA', areaIndex: 1, totalAreas: 2, codigo: 'PED-101', modalidadPill: 'MESA 4', who: 'Juan Perez', canal: 'Caja',
  hora: '15:30', fecha: '26/10/2026',
  lineas: [
    { cantidad: 1, nombre: 'Croissant de Jamon y Queso', opciones: ['Bien tostado'] },
    { cantidad: 2, nombre: 'Empanada de Carne', tamano: 'Grande', opciones: ['Con limon', 'Sin aji'] },
  ],
  esCompacta: true, nota: 'Mesa con ninos', printer: 'Etiquetera de cocina',
};
const bebida = {
  bebidaIndex: 1, totalBebidas: 2, codigo: 'PED-101', persona: 'MARIA ELENA', bebidaNombre: 'CAPPUCCINO VAINILLA', tamano: '12oz',
  opciones: ['Leche de avena', 'Sin azucar', 'Extra canela'], contiene: 'Avena, canela, espresso doble', who: 'Para: Juan Perez',
  hora: '15:30', nota: 'poco hielo', modalidadPill: 'PARA LLEVAR',
};
const pago = {
  local: { nombre: 'Caprichos', razonSocial: 'Caprichos SAC', ruc: '20123456789', direccion: 'Av. Siempre Viva 123' },
  codigo: 'CP-1', fecha: '30/10/2026', hora: '10:15', who: 'Jose', modalidad: 'MESA',
  lineas: [
    { cantidad: 2, nombre: 'Frappe Oreo con nombre muy largo para cortar', tamano: '16oz', subtotal: 36 },
    { cantidad: 1, nombre: 'Club Sandwich', subtotal: 22 },
  ],
  total: 58, pagos: [{ medio: 'EFECTIVO', monto: 58, recibido: 100, vuelto: 42 }], comprobante: { tipo: 'BOLETA', numero: 'B001-1' },
};
const pagoQr = {
  ...pago,
  comprobante: {
    tipo: 'BOLETA', numero: 'B002-1', representacion: 'Representacion impresa de la Boleta de venta electronica',
    hash: 'HASH-DE-PRUEBA-0123456789', cadenaQr: '20600000001|03|B002|1|1.80|11.80|2026-11-02|1|00000000|',
  },
};
const comanda = {
  codigo: 'CP-7', mesa: 'Mesa 2', cliente: 'Luis', canal: 'Mozo', fecha: '05/11/2026', hora: '12:30',
  lineas: [{ cantidad: 2, nombre: 'Croissant', opciones: ['Tostado'], nota: 'Sin mantequilla' }, { cantidad: 1, nombre: 'Cafe Americano', opciones: [] }],
  nota: 'Cliente alergico a la nuez',
};
const cierre = {
  local: { nombre: 'Caprichos' }, codigo: 'CZ-0012', fecha: '21/10/2026', cerradoEn: '21:30', abiertoPor: 'Ana', cerradoPor: 'Luis',
  apertura: 100, resultado: 'CUADRA', diferencia: 0, aprobadoPor: null, nota: null,
  efectivo: { desglose: [{ valor: 200, cantidad: 1, subtotal: 200 }], contado: 200, esperado: 200, diferencia: 0 },
  intentos: [], medios: [{ medio: 'EFECTIVO', sistema: 200, visto: 200, diferencia: 0 }],
  movimientos: [], correcciones: [], liquidaciones: [], anulaciones: [],
};

const ROLLOS: Array<[string, Record<string, unknown> | undefined]> = [
  ['defecto', undefined],
  ['horizontal', { orientacion: 'horizontal' }],
  ['vertical', { orientacion: 'vertical' }],
  ['girado270', { orientacion: 'vertical-girado', giro: 270, gapMm: 2, direccion: 0 }],
];

export const CASOS_ORO: CasoOro[] = [
  ...ROLLOS.flatMap(([r, etiqueta]): CasoOro[] => [
    { nombre: `area-${r}`, tipo: 'ETIQUETA_AREA', payload: area, etiqueta },
    { nombre: `area-larga-${r}`, tipo: 'ETIQUETA_AREA', payload: { ...area, esCompacta: false, lineas: [...area.lineas, ...area.lineas] }, etiqueta },
  ]),
  { nombre: 'general-defecto', tipo: 'ETIQUETA_GENERAL', payload: general },
  { nombre: 'general-100x60', tipo: 'ETIQUETA_GENERAL', payload: { ...general, tamanoMm: { anchoMm: 100, altoMm: 60 } } },
  { nombre: 'general-80x50-margen', tipo: 'ETIQUETA_GENERAL', payload: { ...general, tamanoMm: { anchoMm: 80, altoMm: 50, margenMm: 2 } }, etiqueta: { gapMm: 2 } },
  { nombre: 'bebida-defecto', tipo: 'ETIQUETA_BEBIDA', payload: bebida },
  { nombre: 'bebida-50x40', tipo: 'ETIQUETA_BEBIDA', payload: { ...bebida, tamanoMm: { anchoMm: 50, altoMm: 40 } } },
  { nombre: 'bebida-70x40-sin-nota', tipo: 'ETIQUETA_BEBIDA', payload: { ...bebida, nota: undefined, modalidadPill: undefined, tamanoMm: { anchoMm: 70, altoMm: 40 } }, etiqueta: { gapMm: 2 } },
  ...[32, 42, 48].flatMap((c): CasoOro[] => [
    { nombre: `pago-${c}`, tipo: 'TICKET_PAGO', payload: pago, ticketColumnas: c },
    { nombre: `pago-qr-${c}`, tipo: 'TICKET_PAGO', payload: pagoQr, ticketColumnas: c },
    { nombre: `precuenta-${c}`, tipo: 'TICKET_PAGO', payload: { ...pago, marca: 'PRE-CUENTA / PENDIENTE DE PAGO', comprobante: null, pagos: [] }, ticketColumnas: c },
    { nombre: `nota-venta-mozo-${c}`, tipo: 'TICKET_PAGO', payload: { ...pago, cobradoPorMozo: 'Pedro', comprobante: null }, ticketColumnas: c },
    { nombre: `pago-simulacion-${c}`, tipo: 'TICKET_PAGO', payload: { ...pago, simulacion: true }, ticketColumnas: c },
    { nombre: `comanda-salon-${c}`, tipo: 'TICKET_COMANDA_SALON', payload: comanda, ticketColumnas: c },
    { nombre: `comanda-area-${c}`, tipo: 'TICKET_COMANDA_AREA', payload: { ...comanda, area: 'COCINA' }, ticketColumnas: c },
    { nombre: `cierre-${c}`, tipo: 'TICKET_CIERRE', payload: cierre, ticketColumnas: c },
  ]),
  { nombre: 'prueba-ticket-48', tipo: 'TICKET_PAGO', payload: { prueba: { impresoraId: 'usb:1', nombre: 'Ticketera Demo', marca: 'Impresora 3 de 15: Demo' } }, ticketColumnas: 48 },
  { nombre: 'prueba-ticket-32-sin-marca', tipo: 'TICKET_PAGO', payload: { prueba: { impresoraId: 'usb:1', nombre: 'Ticketera Demo' } }, ticketColumnas: 32 },
  { nombre: 'prueba-etiqueta', tipo: 'ETIQUETA_GENERAL', payload: { prueba: { impresoraId: 'usb:2', nombre: 'Etiquetera Demo', marca: 'Impresora 4 de 15: Demo' } }, etiqueta: { gapMm: 2 } },
  { nombre: 'prueba-etiqueta-vertical', tipo: 'ETIQUETA_BEBIDA', payload: { prueba: { impresoraId: 'usb:2', nombre: 'Etiquetera Demo' } }, etiqueta: { orientacion: 'vertical' } },
];
