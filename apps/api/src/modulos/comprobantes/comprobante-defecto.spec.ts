jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

import { aplicaBoletaPorDefecto, tipoComprobanteEfectivo } from './comprobante-defecto';
import { ComprobanteDefectoService } from './comprobante-defecto.service';
import { validarDocumentoComprobante } from './comprobantes.util';

describe('comprobante por defecto', () => {
  it('solo aplica con SUNAT real y la marca activa (en simulado no cambia nada)', () => {
    expect(aplicaBoletaPorDefecto('SUNAT', true)).toBe(true);
    expect(aplicaBoletaPorDefecto('SIMULADO', true)).toBe(false);
    expect(aplicaBoletaPorDefecto('SUNAT', false)).toBe(false);
  });

  it('el tipo elegido gana; sin elegir, boleta si aplica y nota de venta si no', () => {
    expect(tipoComprobanteEfectivo('FACTURA', true)).toBe('FACTURA');
    expect(tipoComprobanteEfectivo('NOTA_VENTA', true)).toBe('NOTA_VENTA');
    expect(tipoComprobanteEfectivo(undefined, true)).toBe('BOLETA');
    expect(tipoComprobanteEfectivo(null, false)).toBe('NOTA_VENTA');
  });

  it('boleta mayor a S/ 700 sin DNI no es válida; con DNI o hasta 700 sí', () => {
    expect(validarDocumentoComprobante('BOLETA', null, null, 700.01).valido).toBe(false);
    expect(validarDocumentoComprobante('BOLETA', null, null, 700).valido).toBe(true);
    expect(validarDocumentoComprobante('BOLETA', '12345678', null, 900).valido).toBe(true);
  });

  describe('ComprobanteDefectoService.aplica', () => {
    const construir = (proveedor: string, activo: unknown) => {
      const prisma = {
        parametro: {
          findUnique: jest.fn(async ({ where }: any) => (where.clave === 'facturacion_boleta_por_defecto' ? { valor: activo } : null)),
          upsert: jest.fn(),
        },
      };
      const comprobantes = {
        leerConfigFacturacion: jest.fn().mockResolvedValue({ proveedor }),
        proveedorEfectivo: jest.fn((p: string) => p),
      };
      const auditoria = { registrar: jest.fn() };
      return { servicio: new ComprobanteDefectoService(prisma as any, auditoria as any, comprobantes as any), prisma, auditoria };
    };

    it('SUNAT con marca sí: aplica; marca no o simulado: no', async () => {
      expect(await construir('SUNAT', true).servicio.aplica()).toBe(true);
      expect(await construir('SUNAT', false).servicio.aplica()).toBe(false);
      expect(await construir('SIMULADO', true).servicio.aplica()).toBe(false);
    });

    it('sin valor guardado la marca vale sí (defecto)', async () => {
      expect(await construir('SUNAT', undefined).servicio.aplica()).toBe(true);
    });

    it('guardar audita el valor anterior y el nuevo', async () => {
      const { servicio, auditoria } = construir('SUNAT', true);
      await servicio.guardar(false, { partyId: '7' } as any, '10.0.0.1');
      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'CONFIG_BOLETA_DEFECTO',
          antes: { boleta_por_defecto: true },
          despues: { boleta_por_defecto: false },
        }),
      );
    });
  });
});
