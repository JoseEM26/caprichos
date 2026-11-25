jest.mock('../../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
import { IaHerramientasService } from '../ia-herramientas.service';
import * as fs from 'fs';
import * as path from 'path';

const producto = (extra: any = {}) => ({
  id: '1', nombre: 'Dona', descripcion: 'x'.repeat(120), precio: 5, disponible: true, tamanos: [], grupos: [],
  alergenos: ['gluten'], alergenosConfirmados: true, sabores: [], quedan: null, agotadoHasta: null, ...extra,
});
const carta = (...p: any[]) => [{ id: 'c', nombre: 'Postres', productos: p }];
const conCarta = (c: any[]) => new IaHerramientasService({} as any, { obtenerCarta: async () => c } as any);

describe('IA: stock al día', () => {
  it('la caché ya no incluye carta, horario ni promos', () => {
    const src = fs.readFileSync(path.join(__dirname, '../chatbot-ia.service.ts'), 'utf8');
    const linea = src.split('\n').find((l) => l.includes('const HERRAMIENTAS_CACHEABLES'))!;
    expect(linea).toContain("'costoYZonaDeEnvio', 'mediosDePago', 'politicasDePago'");
    for (const h of ['buscarEnCarta', 'cartaCompleta', 'recomendarProductos', 'horarioYUbicacion', 'promocionesDeHoy']) expect(linea).not.toContain(h);
  });

  it('buscarEnCarta trae quedan, agotadoHasta y sabores', async () => {
    const svc = conCarta(carta(producto({
      quedan: 3, agotadoHasta: '2026-11-26',
      sabores: [{ nombre: 'Fresa', disponible: true, quedan: 2 }, { nombre: 'Limon', disponible: true, quedan: null }, { nombre: 'Coco', disponible: false, quedan: 0 }],
    })));
    const [p] = (await svc.buscarEnCarta('dona')).productos ?? [];
    expect(p).toMatchObject({ quedan: 3, agotadoHasta: '2026-11-26', saboresDisponibles: [{ nombre: 'Fresa', quedan: 2 }, { nombre: 'Limon' }], saboresAgotados: ['Coco'] });
    const [q] = (await conCarta(carta(producto())).buscarEnCarta('dona')).productos ?? [];
    expect(q).not.toHaveProperty('quedan');
    expect(q).not.toHaveProperty('saboresAgotados');
  });

  it('recomendarProductos excluye quedan 0', async () => {
    const svc = conCarta(carta(producto({ nombre: 'Agotada', quedan: 0 }), producto({ nombre: 'Buena', quedan: 2 })));
    const { resultado } = (await svc.recomendarProductos()) as any;
    expect(resultado.recomendaciones.map((r: any) => r.nombre)).toEqual(['Buena']);
  });

  it('cartaCompleta: alérgenos solo si confirmados, descripción completa, sabores agotados', async () => {
    const svc = conCarta(carta(
      producto({ sabores: [{ nombre: 'Coco', disponible: false }] }),
      producto({ nombre: 'Otra', alergenosConfirmados: false }),
    ));
    const r: any = await svc.cartaCompleta();
    const [a, b] = r.categorias[0].productos;
    expect(a.alergenos).toEqual(['gluten']);
    expect(a.descripcion).toHaveLength(120);
    expect(a.saboresAgotados).toEqual(['Coco']);
    expect(b.alergenosConfirmados).toBe(false);
    expect(b).not.toHaveProperty('alergenos');
  });
});

describe('IA: horarioYUbicacion sin datos inventados', () => {
  const semana = [1, 2, 3, 4, 5, 6, 7].map((d) => ({
    dia_semana: d, dia: ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'][d],
    abre: '10:00', cierra: '20:00', cerrado: d === 7,
  }));
  const montar = (estado: any, datos: any, fuera = true) => {
    const prisma: any = { parametro: { findMany: async () => (fuera ? [{ clave: 'pedidos_programados_fuera_horario', valor: 'si' }] : []) } };
    const local: any = { obtenerEstadoCarta: async () => estado, obtenerDatosPublicosLocal: async () => datos, obtenerHorarioAdmin: async () => semana };
    return new IaHerramientasService(prisma, undefined, undefined, local);
  };

  it('sin localService no inventa abierto ni dirección', async () => {
    const r: any = await new IaHerramientasService({} as any).horarioYUbicacion();
    expect(r.error).toBeDefined();
    expect(r).not.toHaveProperty('abierto');
    expect(r).not.toHaveProperty('direccion');
  });

  it('datos ausentes van null; trae semana, proximaApertura y sePuedeProgramar', async () => {
    const r: any = await montar({ abierta: false, abre: null, cierra: null, texto: 'Cerrado' }, {}).horarioYUbicacion();
    expect(r.horarioHoy).toMatchObject({ abre: null, cierra: null });
    expect(r.referencia).toBeNull();
    expect(r.telefonoContacto).toBeNull();
    expect(JSON.stringify(r)).not.toMatch(/9XX|parque principal|14:00|22:00/);
    expect(r.semana).toHaveLength(7);
    expect(r.semana[6]).toEqual({ dia: 'Domingo', cerrado: true });
    expect(r.semana[0]).toEqual({ dia: 'Lunes', abre: '10:00', cierra: '20:00' });
    expect(r.proximaApertura).toMatchObject({ abre: '10:00' });
    expect(r.sePuedeProgramar).toBe(true);
    expect(((await montar({ abierta: true }, {}, false).horarioYUbicacion()) as any).sePuedeProgramar).toBe(false);
  });

  it('costoYZonaDeEnvio con la base caída devuelve error, no Campoy inventado', async () => {
    const prisma: any = { zonaReparto: { findMany: async () => { throw new Error('x'); } } };
    const r: any = await new IaHerramientasService(prisma).costoYZonaDeEnvio();
    expect(r.error).toBeDefined();
    expect(r).not.toHaveProperty('zonas');
  });
});
