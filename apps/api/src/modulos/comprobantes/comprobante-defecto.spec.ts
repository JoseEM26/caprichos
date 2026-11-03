jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

import { aplicaBoletaPorDefecto } from './comprobante-defecto';
import { ComprobanteDefectoService } from './comprobante-defecto.service';
import { esComprobanteElegible, validarDocumentoComprobante } from './comprobantes.util';

describe('comprobante por defecto', () => {
  it('solo aplica con SUNAT real y la marca activa (en simulado no cambia nada)', () => {
    expect(aplicaBoletaPorDefecto('SUNAT', true)).toBe(true);
    expect(aplicaBoletaPorDefecto('SIMULADO', true)).toBe(false);
    expect(aplicaBoletaPorDefecto('SUNAT', false)).toBe(false);
  });

  it('solo boleta o factura son comprobantes elegibles: la nota de venta y «sin elegir» no', () => {
    expect(esComprobanteElegible('BOLETA')).toBe(true);
    expect(esComprobanteElegible('FACTURA')).toBe(true);
    expect(esComprobanteElegible('NOTA_VENTA')).toBe(false);
    expect(esComprobanteElegible(undefined)).toBe(false);
    expect(esComprobanteElegible(null)).toBe(false);
  });

  it('boleta mayor a S/ 700 sin DNI no es válida; con DNI o hasta 700 sí', () => {
    expect(validarDocumentoComprobante('BOLETA', null, null, 700.01).valido).toBe(false);
    expect(validarDocumentoComprobante('BOLETA', null, null, 700).valido).toBe(true);
    expect(validarDocumentoComprobante('BOLETA', '12345678', null, 900).valido).toBe(true);
  });

  describe('ComprobanteDefectoService.estado', () => {
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
      expect((await construir('SUNAT', true).servicio.estado()).aplica).toBe(true);
      expect((await construir('SUNAT', false).servicio.estado()).aplica).toBe(false);
      expect((await construir('SIMULADO', true).servicio.estado()).aplica).toBe(false);
    });

    it('sin valor guardado la marca vale sí (defecto)', async () => {
      expect((await construir('SUNAT', undefined).servicio.estado()).activo).toBe(true);
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
