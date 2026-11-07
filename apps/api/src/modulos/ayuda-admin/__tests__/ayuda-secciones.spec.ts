jest.mock('../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

import * as fs from 'fs';
import * as path from 'path';
import { AyudaAdminService } from '../ayuda-admin.service';
import { AyudaGrafoService } from '../ayuda-grafo.service';
import { ManualesCargadorService } from '../manuales-cargador.service';

const CARPETA = path.join(__dirname, '../manuales');
const WEB = path.resolve(__dirname, '../../../../../../apps/web/src/admin');

const cargador = new ManualesCargadorService();
cargador.cargarManuales(CARPETA);
const grafo = new AyudaGrafoService(cargador);
grafo.construirGrafo();

const servicio = new AyudaAdminService(
  {} as any,
  {} as any,
  { registrar: jest.fn() } as any,
  { estaParametroAyudaIaActivo: jest.fn().mockResolvedValue(true) } as any,
  {} as any,
  cargador,
  grafo,
);
const admin: any = { partyId: BigInt(1), rol: 'ADMIN', debeCambiar: false };
const cajero: any = { partyId: BigInt(2), rol: 'CAJERO', debeCambiar: false };

describe('Resolución ruta + sección → manual', () => {
  it('?tab= elige el manual de esa sección y el módulo sigue siendo el general', () => {
    const r = cargador.resolverRuta('/admin/mirest?tab=horario');
    expect(r.manual?.modulo).toBe('mirest');
    expect(r.seccion?.seccion).toBe('horario');
  });

  it('varias pestañas pueden compartir un manual (ubicación → datos del local)', () => {
    expect(cargador.resolverRuta('/admin/mirest?tab=ubicacion').seccion?.seccion).toBe('datos-local');
    expect(cargador.resolverRuta('/admin/mirest?tab=empresa').seccion?.seccion).toBe('datos-local');
  });

  it('el parámetro campo y otros no cambian la sección', () => {
    const r = cargador.resolverRuta('/admin/mirest?tab=pagos&campo=pagos-yape&x=1');
    expect(r.seccion?.seccion).toBe('pagos');
  });

  it('sin tab, con tab desconocido o con otra ruta no hay sección', () => {
    expect(cargador.resolverRuta('/admin/mirest').seccion).toBeUndefined();
    expect(cargador.resolverRuta('/admin/mirest?tab=inexistente').seccion).toBeUndefined();
    expect(cargador.resolverRuta('/admin/caja?tab=horario').seccion).toBeUndefined();
    expect(cargador.resolverRuta('/admin/mirest').manual?.modulo).toBe('mirest');
  });

  it('los manuales de sección no pisan al manual general del módulo', () => {
    expect(cargador.obtenerPorModulo('mirest')?.seccion).toBeUndefined();
    expect(cargador.obtenerPorRuta('/admin/mirest')?.modulo).toBe('mirest');
    expect(cargador.obtenerTodos().some((m) => m.seccion)).toBe(false);
    expect(cargador.obtenerSecciones().length).toBeGreaterThanOrEqual(15);
  });

  it('una consulta con varios pares (a&b) exige todos', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const carpeta = fs.mkdtempSync(path.join(require('os').tmpdir(), 'capri-'));
    const base = (extra: string) =>
      `---\nmodulo: caja\ntitulo: T\nruta: /admin/caja\nroles: [ADMIN]\n${extra}\nsugerencias:\n  - a\n---\n## Para que sirve\nx\n`;
    fs.writeFileSync(path.join(carpeta, 'caja.md'), base(''));
    fs.writeFileSync(path.join(carpeta, 'caja-s.md'), base('seccion: s\nactiva_con: [tab=a&seccion=b]'));
    const c = new ManualesCargadorService();
    c.cargarManuales(carpeta);
    expect(c.resolverRuta('/admin/caja?tab=a&seccion=b').seccion?.seccion).toBe('s');
    expect(c.resolverRuta('/admin/caja?tab=a').seccion).toBeUndefined();
    fs.rmSync(carpeta, { recursive: true, force: true });
  });
});

describe('Filtrado de enlaces por rol', () => {
  it('ADMIN puede abrir una sección y un campo; CAJERO no', () => {
    expect(cargador.esEnlacePermitido('/admin/mirest?tab=horario', 'ADMIN')).toBe(true);
    expect(cargador.esEnlacePermitido('/admin/mirest?tab=pagos&campo=pagos-yape', 'ADMIN')).toBe(true);
    expect(cargador.esEnlacePermitido('/admin/mirest?tab=horario', 'CAJERO')).toBe(false);
    expect(cargador.esEnlacePermitido('/admin/inexistente?tab=x', 'ADMIN')).toBe(false);
  });

  it('los enlaces del contexto incluyen las secciones solo para quien puede verlas', () => {
    const rutasAdmin = cargador.obtenerEnlacesAccesibles('ADMIN').map((e) => e.ruta);
    expect(rutasAdmin).toContain('/admin/mirest?tab=horario');
    expect(rutasAdmin).toContain('/admin/mirest');
    const rutasCajero = cargador.obtenerEnlacesAccesibles('CAJERO').map((e) => e.ruta);
    expect(rutasCajero.some((r) => r.startsWith('/admin/mirest'))).toBe(false);
  });

  it('la lista blanca de enlaces profundos sale de los manuales visibles para el rol', () => {
    const admin = cargador.obtenerEnlacesProfundosAccesibles('ADMIN').map((e) => e.ruta);
    expect(admin).toContain('/admin/mirest?tab=pagos&campo=pagos-yape');
    expect(cargador.obtenerEnlacesProfundosAccesibles('CAJERO').some((e) => e.ruta.startsWith('/admin/mirest'))).toBe(false);
  });

  it('extrae el texto y la ruta de los enlaces markdown', () => {
    expect(cargador.extraerEnlacesProfundos('ver [Horario](/admin/mirest?tab=horario) y [x](https://a.com)')).toEqual([
      { texto: 'Horario', ruta: '/admin/mirest?tab=horario' },
    ]);
  });

  it('la IA solo logra enlaces que existen en manuales visibles (ENLACE:)', () => {
    const s: any = servicio;
    const { texto, rutas } = s.separarEnlacesPedidos('Abre Horario.\nENLACE: /admin/mirest?tab=horario\nENLACE: /admin/inventada');
    expect(texto).toBe('Abre Horario.');
    expect(rutas).toHaveLength(2);
    const enlaces = s.construirEnlacesRespuesta(texto, grafo.recuperarContexto('horario', '/admin/mirest', 'ADMIN'), 'ADMIN', rutas);
    expect(enlaces.map((e: any) => e.ruta)).toContain('/admin/mirest?tab=horario');
    expect(enlaces.some((e: any) => e.ruta === '/admin/inventada')).toBe(false);
    const sinPermiso = s.construirEnlacesRespuesta(texto, grafo.recuperarContexto('horario', '/admin/caja', 'CAJERO'), 'CAJERO', rutas);
    expect(sinPermiso.some((e: any) => e.ruta.startsWith('/admin/mirest'))).toBe(false);
  });
});

describe('Contexto por sección (GET /admin/ayuda/contexto)', () => {
  it('con ?tab=horario devuelve la sección y sus sugerencias primero', async () => {
    const ctx = await servicio.obtenerContexto(admin, '/admin/mirest?tab=horario');
    expect(ctx.modulo).toBe('mirest');
    expect(ctx.seccion).toBe('horario');
    expect(ctx.tituloSeccion).toMatch(/Horario/);
    const sec = cargador.resolverRuta('/admin/mirest?tab=horario').seccion!;
    expect(ctx.sugerencias[0]).toBe(sec.sugerencias[0]);
    expect(ctx.sugerencias.length).toBeLessThanOrEqual(5);
  });

  it('las sugerencias cambian con la sección', async () => {
    const a = await servicio.obtenerContexto(admin, '/admin/mirest?tab=horario');
    const b = await servicio.obtenerContexto(admin, '/admin/mirest?tab=pagos');
    const c = await servicio.obtenerContexto(admin, '/admin/mirest');
    expect(a.sugerencias[0]).not.toBe(b.sugerencias[0]);
    expect(c.seccion).toBeNull();
    expect(c.sugerencias[0]).not.toBe(a.sugerencias[0]);
  });

  it('un rol sin permiso no recibe ni módulo ni sección', async () => {
    const ctx = await servicio.obtenerContexto(cajero, '/admin/mirest?tab=horario');
    expect(ctx.modulo).toBeNull();
    expect(ctx.seccion).toBeNull();
  });
});

describe('Recuperación de contexto con sección abierta', () => {
  it('incluye el manual de la sección abierta y su enlace directo primero', () => {
    const r = grafo.recuperarContexto('¿cómo cambio el horario del martes?', '/admin/mirest?tab=horario', 'ADMIN');
    expect(r.seccionActual?.seccion).toBe('horario');
    expect(r.contextoTexto).toContain('SECCIÓN ABIERTA EN PANTALLA');
    expect(r.contextoTexto).toContain('/admin/mirest?tab=horario&campo=horario-dia-martes');
    expect(r.enlacesSugeridos[0].ruta).toContain('/admin/mirest?tab=horario');
  });

  it('sin sección en la URL no hay bloque de sección', () => {
    const r = grafo.recuperarContexto('hola', '/admin/mirest', 'ADMIN');
    expect(r.seccionActual).toBeUndefined();
    expect(r.contextoTexto).not.toContain('SECCIÓN ABIERTA EN PANTALLA');
  });

  it('desde otra pantalla responde «¿dónde cambio…?» con el enlace profundo del ajuste', () => {
    const r = grafo.recuperarContexto('¿dónde cambio el número de Yape?', '/admin/caja', 'ADMIN');
    expect(r.enlacesSugeridos.some((e) => e.ruta.startsWith('/admin/mirest?tab=pagos'))).toBe(true);
  });

  it('una pregunta ajena a Configuración no arrastra ajustes por palabras comunes', () => {
    const r = grafo.recuperarContexto('¿cómo anulo un pedido?', '/admin/mirest?tab=pagos', 'ADMIN');
    expect(r.ajustesCoincidentes).toEqual([]);
    expect(r.enlacesSugeridos.some((e) => e.ruta.includes('campo='))).toBe(false);
  });

  it('para un rol sin permiso no ofrece enlaces de configuración', () => {
    const r = grafo.recuperarContexto('¿dónde cambio el número de Yape?', '/admin/caja', 'CAJERO');
    expect(r.enlacesSugeridos.some((e) => e.ruta.startsWith('/admin/mirest'))).toBe(false);
    expect(r.contextoTexto).not.toContain('/admin/mirest');
  });

  it('las tareas de las secciones entran al grafo y se encuentran por su tema', () => {
    const r = grafo.recuperarContexto('cómo cerrar un día completo domingo', '/admin/mirest', 'ADMIN');
    expect(r.mejorTarea?.seccion).toBe('horario');
  });

  it('el respaldo sin IA para «¿dónde…?» entrega el ajuste con su enlace', async () => {
    const r = await (servicio as any).generarRespuestaRespaldoDesdeGrafo(
      grafo.recuperarContexto('¿dónde cambio la tolerancia de reservas?', '/admin/caja', 'ADMIN'),
      '¿dónde cambio la tolerancia de reservas?',
      '/admin/caja',
      'ADMIN',
    );
    expect(r.respuesta).toMatch(/[Tt]olerancia de reservas/);
    expect(r.enlaces[0].ruta).toContain('/admin/mirest?tab=parametros&campo=parametros-reserva-tolerancia-min');
  });
});

// ---------- Integridad: cada enlace profundo de los manuales apunta a algo que existe ----------

function leer(rel: string): string {
  return fs.readFileSync(path.join(WEB, rel), 'utf-8');
}
function idsDeCatalogo(): Set<string> {
  const dir = path.join(WEB, 'configuracion/catalogo');
  const ids = new Set<string>();
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.ts'))) {
    for (const m of fs.readFileSync(path.join(dir, f), 'utf-8').matchAll(/\{\s*id:\s*'([a-z0-9-]+)'/g)) ids.add(m[1]);
  }
  // Los parámetros se generan desde AYUDA_PARAMETROS: una clave = un id `parametros-<clave-con-guiones>`
  for (const d of ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']) ids.add(`horario-dia-${d}`);
  const parametros = fs.readFileSync(path.join(dir, 'parametros.ts'), 'utf-8');
  for (const m of parametros.matchAll(/^ {2}([a-z0-9_]+): \{\s*$/gm)) ids.add(`parametros-${m[1].replace(/_/g, '-')}`);
  return ids;
}
function pestanasDeConfiguracion(): string[] {
  const src = leer('configuracion/ConfiguracionLocalView.tsx');
  const bloque = src.slice(src.indexOf('export const CATEGORIAS_CONFIG'), src.indexOf('/** Valores de ejemplo'));
  return Array.from(bloque.matchAll(/^ {4}id: '([a-z]+)',/gm)).map((m) => m[1]);
}
function pestanasDeAsistencia(): string[] {
  const m = leer('asistencia/AsistenciaAdminView.tsx').match(/const PESTANAS: Pestana\[\] = \[([^\]]*)\]/);
  return (m?.[1] ?? '').split(',').map((s) => s.trim().replace(/'/g, '')).filter(Boolean);
}
function rutasDeModulos(): Map<string, string> {
  const mapa = new Map<string, string>();
  for (const m of leer('modulos.ts').matchAll(/clave:\s*'([^']+)'[\s\S]*?ruta:\s*'([^']+)'/g)) mapa.set(m[2], m[1]);
  return mapa;
}

describe('Integridad de enlaces profundos de los manuales', () => {
  const tabs = new Set(pestanasDeConfiguracion());
  const campos = idsDeCatalogo();
  const rutas = rutasDeModulos();
  const secciones = new Set(['facil', 'mapa', 'equipos', 'cola']);
  const todos = [...cargador.obtenerTodos(), ...cargador.obtenerSecciones()];
  const enlaces = todos.flatMap((m) => cargador.extraerEnlacesProfundos(m.contenido).map((e) => ({ archivo: m.archivo, ...e })));

  it('la web expone las 21 pestañas de Configuración y el catálogo no está vacío', () => {
    expect(tabs.size).toBeGreaterThanOrEqual(21);
    expect(campos.size).toBeGreaterThan(200);
  });

  it('hay enlaces profundos en los manuales de configuración', () => {
    expect(enlaces.filter((e) => e.ruta.startsWith('/admin/mirest')).length).toBeGreaterThan(100);
  });

  it('cada enlace apunta a un módulo real, a una pestaña real y a un campo real del catálogo', () => {
    const malos: string[] = [];
    for (const e of enlaces) {
      const [base, consulta = ''] = e.ruta.split('?');
      if (!rutas.has(base)) {
        malos.push(`${e.archivo}: ruta ${base} no existe en modulos.ts`);
        continue;
      }
      const q = new URLSearchParams(consulta);
      if (base === '/admin/mirest') {
        const tab = q.get('tab');
        if (tab && !tabs.has(tab)) malos.push(`${e.archivo}: tab=${tab} no existe`);
        const campo = q.get('campo');
        if (campo && !campos.has(campo)) malos.push(`${e.archivo}: campo=${campo} no está en el catálogo`);
        const sec = q.get('seccion');
        if (sec && !secciones.has(sec)) malos.push(`${e.archivo}: seccion=${sec} no existe en Impresión`);
        if (q.get('seccion') && tab !== 'impresion') malos.push(`${e.archivo}: seccion solo existe en tab=impresion`);
      }
      if (base === '/admin/asistencia') {
        const p = q.get('pestana');
        if (p && !pestanasDeAsistencia().includes(p)) malos.push(`${e.archivo}: pestana=${p} no existe`);
      }
    }
    expect(malos).toEqual([]);
  });

  it('el campo apunta a la misma pestaña en la que vive en el catálogo', () => {
    const catalogo = new Map<string, string>();
    const dir = path.join(WEB, 'configuracion/catalogo');
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.ts'))) {
      for (const m of fs.readFileSync(path.join(dir, f), 'utf-8').matchAll(/\{\s*id:\s*'([a-z0-9-]+)',\s*tab:\s*'([a-z]+)'/g)) catalogo.set(m[1], m[2]);
    }
    const malos: string[] = [];
    for (const e of enlaces) {
      const q = new URLSearchParams(e.ruta.split('?')[1] ?? '');
      const campo = q.get('campo');
      if (e.ruta.startsWith('/admin/mirest') && campo && catalogo.has(campo) && catalogo.get(campo) !== q.get('tab')) {
        malos.push(`${e.archivo}: ${campo} vive en tab=${catalogo.get(campo)}, no en ${q.get('tab')}`);
      }
    }
    expect(malos).toEqual([]);
  });

  it('cada pestaña de Configuración tiene su manual de sección', () => {
    const cubiertas = new Set(
      cargador
        .obtenerSecciones()
        .filter((s) => s.modulo === 'mirest')
        .flatMap((s) => (s.activaCon ?? []).map((a) => a.split('=')[1])),
    );
    const sinManual = [...tabs].filter((t) => !cubiertas.has(t));
    expect(sinManual).toEqual([]);
  });

  it('cada activa_con de un manual de sección apunta a una pestaña real', () => {
    const malos: string[] = [];
    for (const s of cargador.obtenerSecciones()) {
      for (const a of s.activaCon ?? []) {
        const [k, v] = a.split('=');
        if (s.modulo === 'mirest' && !(k === 'tab' && tabs.has(v))) malos.push(`${s.archivo}: ${a}`);
        if (s.modulo === 'asistencia' && !(k === 'pestana' && pestanasDeAsistencia().includes(v))) malos.push(`${s.archivo}: ${a}`);
      }
    }
    expect(malos).toEqual([]);
  });

  it('todo [[x]] de los manuales de sección existe en modulos.ts', () => {
    const claves = new Set(rutas.values());
    for (const s of cargador.obtenerSecciones()) {
      for (const men of s.mencionesDoblesCorchetes) expect(claves.has(men)).toBe(true);
      for (const rel of s.relacionados ?? []) expect(claves.has(rel)).toBe(true);
    }
  });

  it('la matriz «Donde se configura» del manual general existe y todas sus líneas llevan enlace', () => {
    const general = cargador.obtenerPorModulo('mirest')!;
    expect(general.ajustes.length).toBeGreaterThan(30);
    for (const l of general.ajustes) expect(cargador.extraerEnlacesProfundos(l).length).toBeGreaterThan(0);
  });
});
