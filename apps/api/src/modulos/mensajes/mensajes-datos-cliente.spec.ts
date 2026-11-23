jest.mock('@nestjs/jwt', () => ({ JwtService: jest.fn(), JwtModule: {} }));
import 'reflect-metadata';
import { CLAVE_PERMISO } from '../acceso/permiso.decorator';
import { MensajesController } from './mensajes.controller';
import { MensajesService } from './mensajes.service';

const fila = (codigo: string, estado: string, lineas: any[]) => ({ codigo, total: 10, estado, creado_en: new Date('2026-11-01T10:00:00Z'), lineas });

describe('MensajesService · datosCliente', () => {
  const crear = (conv: any, pedidos: any[], saldo = 7) => {
    const prisma: any = {
      conversacion: { findUnique: jest.fn().mockResolvedValue(conv) },
      pedido: { findMany: jest.fn().mockResolvedValue(pedidos) },
    };
    const puntos: any = { obtenerSaldo: jest.fn().mockResolvedValue(saldo) };
    const s = new MensajesService(prisma, {} as any, {} as any, undefined, undefined, undefined, undefined, undefined, puntos);
    return { s, prisma, puntos };
  };

  it('busca solo por el celular/persona del chat y resume pedidos, puntos y lo más pedido', async () => {
    const { s, prisma } = crear(
      { id: 1n, telefono: '51987654321', party_id: 5n, celular_vinculado: null },
      [
        fila('P-1', 'ENTREGADO', [{ nombre: 'Dona', cantidad: 2, es_cortesia: false }, { nombre: 'Café', cantidad: 1, es_cortesia: false }]),
        fila('P-2', 'ANULADO', [{ nombre: 'Torta', cantidad: 9, es_cortesia: false }]),
        fila('P-3', 'ENTREGADO', [{ nombre: 'Dona', cantidad: 1, es_cortesia: false }, { nombre: 'Gratis', cantidad: 5, es_cortesia: true }]),
      ],
    );
    const r = await s.datosCliente('1');
    const where = prisma.pedido.findMany.mock.calls[0][0].where;
    expect(where.OR).toEqual([{ cliente_telefono: { endsWith: '987654321' } }, { party_id: 5n }]);
    expect(r.pedidos.map((p) => p.codigo)).toEqual(['P-1', 'P-2', 'P-3']);
    expect(r.puntos).toBe(7);
    expect(r.frecuentes).toEqual([{ nombre: 'Dona', cantidad: 3 }, { nombre: 'Café', cantidad: 1 }]);
  });

  it('sin celular ni persona no consulta pedidos', async () => {
    const { s, prisma } = crear({ id: 2n, telefono: '', party_id: null, celular_vinculado: null }, []);
    expect(await s.datosCliente('2')).toEqual({ pedidos: [], puntos: null, frecuentes: [] });
    expect(prisma.pedido.findMany).not.toHaveBeenCalled();
  });

  it('el endpoint exige mensajes/ver', () => {
    const meta = Reflect.getMetadata(CLAVE_PERMISO, MensajesController.prototype.datosCliente);
    expect(meta).toEqual({ modulo: 'mensajes', accion: 'ver' });
  });
});
