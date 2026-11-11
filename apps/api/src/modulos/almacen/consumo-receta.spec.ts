jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
jest.mock('../acceso/acceso.guard', () => ({ AccesoGuard: class {} }));
import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ConsumoRecetaService, recetasDelSabor } from './consumo-receta.service';
import { consumoRealConMerma, lugarCocina } from './stock-cocina';
import { AlmacenController } from './almacen.controller';
import { CLAVE_PERMISO } from '../acceso/permiso.decorator';
import { MATRIZ, PERMISOS } from '../acceso/permisos';
import { CrearInsumoDto } from '../stock/dto/crear-insumo.dto';
import { almacenConsumirAlPreparar, almacenPermitirCocinaNegativa } from '../stock/control-almacen';

/** Prisma de mentira: registra cada método llamado; los parámetros salen de `params`. */
function prismaEspia(params: Record<string, unknown>) {
  const llamadas: string[] = [];
  const handler = (ruta: string): any =>
    new Proxy(() => undefined, {
      get: (_t, k: string) => handler(ruta ? `${ruta}.${k}` : k),
      apply: async (_t, _this, args: any[]) => {
        llamadas.push(ruta);
        if (ruta === 'parametro.findUnique') {
          const clave = args[0].where.clave;
          return clave in params ? { clave, valor: params[clave] } : null;
        }
        return null;
      },
    });
  return { prisma: handler('') as any, llamadas };
}
const auditoria: any = { registrar: jest.fn(async () => undefined) };

describe('Almacén APAGADO = cero efecto', () => {
  it('reconciliar el pedido solo lee el interruptor: ninguna otra consulta ni escritura', async () => {
    const { prisma, llamadas } = prismaEspia({}); // sin parámetro = apagado
    const svc = new ConsumoRecetaService(prisma, auditoria);
    await svc.reconciliarPedido(10n, 1n);
    await svc.decidirAnulacion(10n, 'DEVOLVER', 'x', 1n);
    expect(await svc.tieneConsumo(10n)).toBe(false);
    expect(await svc.modoTanda()).toBeNull();
    expect([...new Set(llamadas)]).toEqual(['parametro.findUnique']);
  });

  it('con el interruptor en «no» tampoco hace nada más', async () => {
    const { prisma, llamadas } = prismaEspia({ stock_control_activo: 'no', almacen_consumir_al_preparar: 'si' });
    await new ConsumoRecetaService(prisma, auditoria).reconciliarPedido(10n);
    expect([...new Set(llamadas)]).toEqual(['parametro.findUnique']);
  });

  it('encendido pero «consumir al preparar» en «no» (valor de fábrica): solo lee los dos parámetros', async () => {
    const { prisma, llamadas } = prismaEspia({ stock_control_activo: 'si' });
    await new ConsumoRecetaService(prisma, auditoria).reconciliarPedido(10n);
    expect([...new Set(llamadas)]).toEqual(['parametro.findUnique']);
    expect(llamadas.length).toBe(2);
  });

  it('valores de fábrica: consumir al preparar = no, cocina negativa = sí', async () => {
    const { prisma } = prismaEspia({});
    expect(await almacenConsumirAlPreparar(prisma)).toBe(false);
    expect(await almacenPermitirCocinaNegativa(prisma)).toBe(true);
  });
});

describe('El fallo del consumo no rompe la cocina', () => {
  it('reconciliarPedido nunca lanza y deja la huella en auditoría', async () => {
    const prisma: any = {
      parametro: { findUnique: async () => ({ valor: 'si' }) },
      pedido: { findUnique: async () => { throw new Error('bd caída'); } },
    };
    const reg = jest.fn(async () => undefined);
    await expect(new ConsumoRecetaService(prisma, { registrar: reg } as any).reconciliarPedido(5n, 1n)).resolves.toBeUndefined();
    expect(reg).toHaveBeenCalledWith(expect.objectContaining({ accion: 'CONSUMO_RECETA_FALLO', resultado: 'RECHAZADO' }));
  });

  it('ni siquiera si falla la auditoría', async () => {
    const prisma: any = { parametro: { findUnique: async () => { throw new Error('x'); } } };
    // la lectura del interruptor falla = se toma como apagado
    await expect(new ConsumoRecetaService(prisma, { registrar: async () => { throw new Error('y'); } } as any).reconciliarPedido(5n)).resolves.toBeUndefined();
  });
});

describe('Merma del insumo y unidades', () => {
  it('neta ÷ (1 − merma): 0 %, 10 %; 100 % o inválida se ignora', () => {
    expect(consumoRealConMerma(9, 0)).toBe(9);
    expect(consumoRealConMerma(9, 10)).toBe(10);
    expect(consumoRealConMerma(2, 10)).toBe(2.222);
    expect(consumoRealConMerma(2, '10.00')).toBe(2.222);
    expect(consumoRealConMerma(5, 100)).toBe(5);
    expect(consumoRealConMerma(5, -3)).toBe(5);
    expect(consumoRealConMerma(5, undefined)).toBe(5);
  });

  it('el DTO del insumo acepta 0 y 10 % y rechaza 100 % y negativos', async () => {
    const base = { nombre: 'Harina', unidad_compra: 'saco', unidad_almacen: 'kg', unidad_receta: 'g', factor_compra: 50, factor_receta: 1000, minimo: 1, maximo: 10 };
    const errores = async (m: unknown) => (await validate(plainToInstance(CrearInsumoDto, { ...base, ...(m === undefined ? {} : { merma_pct: m }) }))).map((e) => e.property);
    expect(await errores(undefined)).toEqual([]);
    expect(await errores(0)).toEqual([]);
    expect(await errores(10)).toEqual([]);
    expect(await errores(100)).toContain('merma_pct');
    expect(await errores(-1)).toContain('merma_pct');
  });

  it('tanda: kg vs g con rendimiento (10 donas de 24 → 1 kg de 2,4 kg)', () => {
    const svc = new ConsumoRecetaService({} as any, auditoria);
    const insumo = { id: 1n, nombre: 'Harina', unidad_almacen: 'kg', factor_receta: 1000, merma_pct: 0 };
    const r = svc.insumosDeTanda({ rinde: 24, lineas: [{ cantidad: 2400, insumo }] }, 10);
    expect(r[0].cantidad).toBe(1);
    const conMerma = svc.insumosDeTanda({ rinde: 24, lineas: [{ cantidad: 2400, insumo: { ...insumo, merma_pct: 20 } }] }, 12);
    expect(conMerma[0].cantidad).toBe(1.5); // 1,2 kg netos ÷ 0,8
  });
});

describe('«La Cocina» es un único lugar', () => {
  const db = (existentes: string[]) => ({
    lugarStock: {
      findUnique: async ({ where }: any) => (existentes.includes(where.nombre) ? { id: 1n, nombre: where.nombre } : null),
      create: async ({ data }: any) => ({ id: 9n, ...data }),
    },
  });
  it('«Cocina» si existe; si no «Salados»; si no se crea «Cocina»', async () => {
    expect((await lugarCocina(db(['Cocina', 'Salados']))).nombre).toBe('Cocina');
    expect((await lugarCocina(db(['Salados']))).nombre).toBe('Salados');
    expect((await lugarCocina(db([]))).nombre).toBe('Cocina');
  });
});

describe('Receta por sabor', () => {
  const g = { sabor_id: null, tamano_valor_id: 1n, lineas: [{}], id: 'g1' };
  const gNulo = { sabor_id: null, tamano_valor_id: null, lineas: [{}], id: 'g0' };
  const sab = { sabor_id: 7n, tamano_valor_id: 1n, lineas: [{}], id: 's1' };
  it('la del sabor reemplaza a la general del mismo tamaño; sin la suya vale la general', () => {
    expect(recetasDelSabor([g, gNulo, sab], 7n).map((r) => r.id).sort()).toEqual(['g0', 's1']);
    expect(recetasDelSabor([g, gNulo, sab], 8n).map((r) => r.id).sort()).toEqual(['g0', 'g1']);
    expect(recetasDelSabor([g, gNulo, sab], null).map((r) => r.id).sort()).toEqual(['g0', 'g1']);
  });
});

describe('Permisos: Cocina consume, Almacén y Administrador mueven el stock', () => {
  const clave = (metodo: string) => Reflect.getMetadata(CLAVE_PERMISO, (AlmacenController.prototype as any)[metodo]);
  it('los endpoints piden permisos propios', () => {
    expect(clave('emitirPendientes')).toEqual({ modulo: 'almacen', accion: 'emitir' });
    expect(clave('aplicarRecuentoInsumos')).toEqual({ modulo: 'almacen', accion: 'ajustar' });
    expect(clave('reintentarConsumo')).toEqual({ modulo: 'almacen', accion: 'emitir' });
    expect(clave('listarPendientes')).toEqual({ modulo: 'almacen', accion: 'ver' });
  });
  it('solo ADMIN y ALMACEN los tienen; COCINA, CAJERO y MOZO no', () => {
    expect(PERMISOS.some((p) => p.modulo === 'almacen' && p.accion === 'emitir')).toBe(true);
    for (const rol of ['ADMIN', 'ALMACEN']) {
      expect(MATRIZ[rol]).toEqual(expect.arrayContaining(['almacen/emitir', 'almacen/ajustar']));
    }
    for (const rol of Object.keys(MATRIZ).filter((r) => !['ADMIN', 'ALMACEN'].includes(r))) {
      expect(MATRIZ[rol]).not.toContain('almacen/emitir');
      expect(MATRIZ[rol]).not.toContain('almacen/ajustar');
    }
  });
});
