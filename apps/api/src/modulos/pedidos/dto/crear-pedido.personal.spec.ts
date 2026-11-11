import { ValidationPipe } from '@nestjs/common';
import { CrearPedidoDto } from './crear-pedido.dto';

const pipe = new ValidationPipe({ whitelist: true, transform: true });
const meta = { type: 'body' as const, metatype: CrearPedidoDto };
const base = {
  modalidad: 'RECOGER',
  cliente: { nombre: 'Ana Prueba (personal)' },
  lineas: [{ productoId: '1', cantidad: 1 }],
  pago: { metodo: 'EFECTIVO', plan: [{ medio: 'EFECTIVO', monto: 10.87 }] },
  esPersonal: true,
  colaboradorPartyId: '12',
  canal: 'CAJA',
  comprobante: { tipo: 'SIMPLE' },
};

describe('CrearPedidoDto: pedido del personal', () => {
  it.each([
    ['credito', { pagoPersonal: { modo: 'CREDITO' } }],
    ['ahora efectivo', { pagoPersonal: { modo: 'AHORA', medio: 'EFECTIVO', pagaCon: 20 } }],
    ['ahora yape', { pagoPersonal: { modo: 'AHORA', medio: 'YAPE' } }],
    ['sin pagoPersonal', {}],
  ])('%s se acepta', async (_n, extra) => {
    await expect(pipe.transform({ ...base, ...extra }, meta)).resolves.toBeDefined();
  });
  it('comprobante boleta/factura se acepta', async () => {
    for (const comprobante of [{ tipo: 'BOLETA', dni: '12345678' }, { tipo: 'FACTURA', ruc: '20123456789', razonSocial: 'X' }]) {
      await expect(pipe.transform({ ...base, comprobante, pagoPersonal: { modo: 'CREDITO' } }, meta)).resolves.toBeDefined();
    }
  });
});
