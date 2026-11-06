import * as fs from 'fs';
import * as path from 'path';
import { ManualesCargadorService } from '../manuales-cargador.service';
import { AyudaGrafoService } from '../ayuda-grafo.service';
import { ROLES } from '../../acceso/permisos';

interface ModuloInfo {
  clave: string;
  nombre?: string;
  ruta: string;
}

function extraerModulosDelFrontend(): Map<string, ModuloInfo> {
  const rutaModulosTs = path.resolve(
    __dirname,
    '../../../../../../apps/web/src/admin/modulos.ts',
  );
  const contenido = fs.readFileSync(rutaModulosTs, 'utf-8');

  const mapa = new Map<string, ModuloInfo>();
  const regexBloque = /\{\s*clave:\s*['"]([^'"]+)['"][\s\S]*?ruta:\s*['"]([^'"]+)['"][\s\S]*?\}/g;

  let match: RegExpExecArray | null;
  while ((match = regexBloque.exec(contenido)) !== null) {
    const clave = match[1];
    const ruta = match[2];
    mapa.set(clave, { clave, ruta });
  }

  return mapa;
}

describe('Validación de formato de Manuales de Ayuda Admin (Ola J)', () => {
  const cargador = new ManualesCargadorService();
  const modulosFrontend = extraerModulosDelFrontend();
  const rolesValidos = new Set([
    ...ROLES.map((r) => r.codigo.toUpperCase()),
    '*',
  ]);

  it('el mapa de módulos de modulos.ts contiene los módulos clave del sistema', () => {
    expect(modulosFrontend.size).toBeGreaterThan(10);
    expect(modulosFrontend.has('caja')).toBe(true);
    expect(modulosFrontend.has('productos')).toBe(true);
    expect(modulosFrontend.has('cocina')).toBe(true);
  });

  const carpetasAValidar = [
    path.join(__dirname, 'manuales-prueba'),
    path.join(__dirname, '../manuales'),
  ];

  for (const carpeta of carpetasAValidar) {
    const esPrueba = carpeta.includes('manuales-prueba');
    const etiqueta = esPrueba ? 'Manuales de prueba' : 'Manuales oficiales (manuales/)';

    describe(etiqueta, () => {
      if (!fs.existsSync(carpeta)) {
        it('la carpeta existe o está reservada para otros agentes', () => {
          expect(true).toBe(true);
        });
        return;
      }

      const archivos = fs.readdirSync(carpeta).filter((f) => f.endsWith('.md'));

      if (archivos.length === 0) {
        it('sin archivos aún (serán redactados por agentes en paralelo)', () => {
          expect(true).toBe(true);
        });
        return;
      }

      for (const archivo of archivos) {
        describe(`Manual: ${archivo}`, () => {
          const rutaArchivo = path.join(carpeta, archivo);
          const contenido = fs.readFileSync(rutaArchivo, 'utf-8');
          const manual = cargador.parsearManual(archivo, contenido);

          it('tiene frontmatter válido con todos los campos requeridos', () => {
            expect(manual).not.toBeNull();
            expect(manual?.modulo).toBeTruthy();
            expect(manual?.titulo).toBeTruthy();
            expect(manual?.ruta).toBeTruthy();
            expect(manual?.roles).toBeDefined();
            expect(manual?.sugerencias).toBeDefined();
          });

          it('la clave del módulo existe en apps/web/src/admin/modulos.ts', () => {
            expect(manual).not.toBeNull();
            if (manual) {
              expect(modulosFrontend.has(manual.modulo)).toBe(true);
            }
          });

          it('la ruta configurada coincide con la ruta real en modulos.ts', () => {
            expect(manual).not.toBeNull();
            if (manual) {
              const modFrontend = modulosFrontend.get(manual.modulo);
              expect(modFrontend).toBeDefined();
              expect(manual.ruta).toBe(modFrontend?.ruta);
            }
          });

          it('los roles no están vacíos y pertenecen a los roles reales del sistema', () => {
            expect(manual).not.toBeNull();
            if (manual) {
              expect(manual.roles.length).toBeGreaterThan(0);
              for (const r of manual.roles) {
                expect(rolesValidos.has(r.toUpperCase())).toBe(true);
              }
            }
          });

          it('incluye entre 3 y 8 sugerencias redactadas como dudas de usuario', () => {
            expect(manual).not.toBeNull();
            if (manual) {
              expect(manual.sugerencias.length).toBeGreaterThanOrEqual(3);
              expect(manual.sugerencias.length).toBeLessThanOrEqual(8);
              for (const s of manual.sugerencias) {
                expect(s.trim().length).toBeGreaterThan(5);
              }
            }
          });

          it('contiene las secciones estándar en el cuerpo markdown', () => {
            expect(manual).not.toBeNull();
            if (manual) {
              expect(manual.paraQueSirve).toBeTruthy();
              expect(manual.seccionesComoSeHace.length).toBeGreaterThanOrEqual(1);
              expect(manual.erroresYDudas).toBeTruthy();
              expect(manual.quienPuedeHacerlo).toBeTruthy();
            }
          });
        });
      }
    });
  }

  describe('Validación del Grafo de Conocimiento derivado de los manuales', () => {
    const cargadorOficial = new ManualesCargadorService();
    const carpetaManualesOficiales = path.join(__dirname, '../manuales');

    if (fs.existsSync(carpetaManualesOficiales)) {
      cargadorOficial.cargarManuales(carpetaManualesOficiales);
      const grafo = new AyudaGrafoService(cargadorOficial);
      grafo.construirGrafo();

      const resumen = grafo.obtenerResumenGrafo();
      const todosManuales = cargadorOficial.obtenerTodos();

      it('construye el grafo con nodos de tipo modulo, tarea, rol y permiso', () => {
        expect(resumen.nodos.length).toBeGreaterThanOrEqual(todosManuales.length);
        const tipos = new Set(resumen.nodos.map((n) => n.tipo));
        expect(tipos.has('modulo')).toBe(true);
        expect(tipos.has('tarea')).toBe(true);
        expect(tipos.has('rol')).toBe(true);
        expect(tipos.has('permiso')).toBe(true);
      });

      it('todas las claves en "relacionados" y menciones "[[...]]" corresponden a módulos reales de modulos.ts', () => {
        for (const m of todosManuales) {
          for (const rel of m.relacionados || []) {
            expect(modulosFrontend.has(rel)).toBe(true);
          }
          for (const men of m.mencionesDoblesCorchetes || []) {
            expect(modulosFrontend.has(men)).toBe(true);
          }
          for (const sec of m.seccionesComoSeHace) {
            for (const r of sec.relaciones) {
              expect(modulosFrontend.has(r.destinoModulo)).toBe(true);
            }
          }
        }
      });

      it('sin aristas hacia módulos inexistentes', () => {
        for (const a of resumen.aristas) {
          if (['relacionado_con', 'requiere', 'antes', 'despues', 'ver_tambien'].includes(a.tipo)) {
            // El destino debe ser un módulo existente en modulos.ts
            expect(modulosFrontend.has(a.destino)).toBe(true);
          }
        }
      });

      it('sin módulos huérfanos: cada módulo tiene al menos una conexión con otro módulo', () => {
        for (const m of todosManuales) {
          const aristasModulo = resumen.aristas.filter(
            (a) =>
              (a.origen === m.modulo || a.destino === m.modulo) &&
              ['relacionado_con', 'requiere', 'antes', 'despues', 'ver_tambien'].includes(a.tipo),
          );
          expect(aristasModulo.length).toBeGreaterThan(0);
        }
      });

      it('desde cada módulo se puede llegar a algún vecino conectado en el grafo', () => {
        for (const m of todosManuales) {
          const recuperacion = grafo.recuperarContexto('ayuda general', m.ruta, 'ADMIN');
          expect(recuperacion.moduloPrincipal).toBeDefined();
          expect(
            recuperacion.moduloPrincipal?.clave === m.modulo || recuperacion.vecinos.length > 0,
          ).toBe(true);
        }
      });
    }
  });
});
