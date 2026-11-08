jest.mock('@nestjs/jwt', () => ({ JwtService: class {} }));
jest.mock('../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

import * as path from 'path';
import { ManualesCargadorService } from '../manuales-cargador.service';
import { AyudaGrafoService } from '../ayuda-grafo.service';
import { AyudaAdminController } from '../ayuda-admin.controller';
import { ForbiddenException } from '@nestjs/common';

describe('AyudaGrafoService (Grafo de Conocimiento de Documentación - Ola J)', () => {
  let cargador: ManualesCargadorService;
  let grafoService: AyudaGrafoService;

  beforeAll(() => {
    cargador = new ManualesCargadorService();
    const rutaManuales = path.join(__dirname, '../manuales');
    cargador.cargarManuales(rutaManuales);
    grafoService = new AyudaGrafoService(cargador);
    grafoService.construirGrafo();
  });

  describe('1. Estructura y tipos de nodos y aristas', () => {
    it('construye nodos de tipos modulo, tarea, rol y permiso', () => {
      const resumen = grafoService.obtenerResumenGrafo();
      expect(resumen.nodos.length).toBeGreaterThan(50);
      expect(resumen.aristas.length).toBeGreaterThan(100);

      const tiposNodos = new Set(resumen.nodos.map((n) => n.tipo));
      expect(tiposNodos.has('modulo')).toBe(true);
      expect(tiposNodos.has('tarea')).toBe(true);
      expect(tiposNodos.has('rol')).toBe(true);
      expect(tiposNodos.has('permiso')).toBe(true);

      const tiposAristas = new Set(resumen.aristas.map((a) => a.tipo));
      expect(tiposAristas.has('pertenece_a')).toBe(true);
      expect(tiposAristas.has('puede_usar')).toBe(true);
      expect(tiposAristas.has('requiere_permiso')).toBe(true);
      expect(tiposAristas.has('relacionado_con')).toBe(true);
      expect(tiposAristas.has('requiere')).toBe(true);
    });

    it('los nodos del resumen no incluyen texto largo (pasos detallados ni contenido markdown)', () => {
      const resumen = grafoService.obtenerResumenGrafo();
      for (const nodo of resumen.nodos) {
        expect((nodo as any).contenido).toBeUndefined();
        expect((nodo as any).pasos).toBeUndefined();
        expect((nodo as any).texto).toBeUndefined();
      }
    });

    it('genera diagrama Mermaid con sintaxis válida', () => {
      const mermaid = grafoService.generarMermaidGrafo();
      expect(mermaid).toContain('flowchart TD');
      expect(mermaid).toContain('caja["');
      expect(mermaid).toContain('-->|');
    });
  });

  describe('2. Recuperación de contexto con 1 salto en el grafo', () => {
    it('consulta "como anulo un pedido ya cobrado" trae la tarea de anular de caja y el historial por 1 salto', () => {
      const resultado = grafoService.recuperarContexto(
        'como anulo un pedido ya cobrado',
        undefined,
        'ADMIN',
      );

      // 1. Tarea candidata identifica la anulación en caja
      expect(resultado.mejorTarea).toBeDefined();
      expect(resultado.mejorTarea?.modulo).toBe('caja');
      expect(resultado.mejorTarea?.titulo.toLowerCase()).toContain('anular');

      // 2. Módulo principal es caja
      expect(resultado.moduloPrincipal?.clave).toBe('caja');

      // 3. 1 salto por el grafo incorpora el historial por relación ver también
      const vecinosClaves = resultado.vecinos.map((v) => v.clave);
      expect(vecinosClaves).toContain('historial');

      // 4. Ya no existe el módulo del código del supervisor ni se menciona en el contexto
      expect(vecinosClaves).not.toContain('supervisor-codigo');
      expect(resultado.contextoTexto).not.toContain('supervisor-codigo');

      // 5. Los enlaces sugeridos incluyen caja y no la ruta del código del supervisor
      const rutasEnlaces = resultado.enlacesSugeridos.map((e) => e.ruta);
      expect(rutasEnlaces).toContain('/admin/caja');
      expect(rutasEnlaces).not.toContain('/admin/supervisor-codigo');
    });

    it('un rol sin permiso NO recibe nodos ni relaciones de módulos que no puede ver (aislamiento de roles)', () => {
      // CAJERO no tiene permiso para ver 'usuarios', 'seguridad' ni 'indicadores'
      const resultadoCajero = grafoService.recuperarContexto(
        'como creo usuarios y cambio claves de administracion',
        undefined,
        'CAJERO',
      );

      // El módulo principal y los vecinos nunca deben ser usuarios o indicadores
      expect(resultadoCajero.moduloPrincipal?.clave).not.toBe('usuarios');
      expect(resultadoCajero.moduloPrincipal?.clave).not.toBe('indicadores');

      const vecinosCajero = resultadoCajero.vecinos.map((v) => v.clave);
      expect(vecinosCajero).not.toContain('usuarios');
      expect(vecinosCajero).not.toContain('indicadores');

      // Tampoco en el texto de contexto expandido
      expect(resultadoCajero.contextoTexto).not.toContain('/admin/usuarios');
    });

    it('respeta el presupuesto de caracteres (<= 6000 chars)', () => {
      const resultado = grafoService.recuperarContexto(
        'como registrar pedidos, cobros, anular productos y facturas',
        '/admin/caja',
        'ADMIN',
        6000,
      );

      expect(resultado.contextoTexto.length).toBeLessThanOrEqual(6000);
      expect(resultado.contextoTexto.length).toBeGreaterThan(200);
    });
  });

  describe('3. Endpoint GET /admin/ayuda/grafo en el controlador', () => {
    let controller: AyudaAdminController;
    let ayudaAdminServiceMock: any;

    beforeEach(() => {
      ayudaAdminServiceMock = {
        obtenerContexto: jest.fn(),
        preguntar: jest.fn(),
      };
      controller = new AyudaAdminController(ayudaAdminServiceMock, grafoService);
    });

    it('permite a un usuario con rol ADMIN obtener el resumen del grafo {nodos, aristas}', async () => {
      const reqAdmin = {
        usuario: {
          partyId: BigInt(1),
          rol: 'ADMIN',
          debeCambiar: false,
        },
      };

      const respuesta = await controller.obtenerGrafo(reqAdmin);
      expect(respuesta).toBeDefined();
      expect(Array.isArray(respuesta.nodos)).toBe(true);
      expect(Array.isArray(respuesta.aristas)).toBe(true);
      expect(respuesta.nodos.length).toBeGreaterThan(0);
      expect(respuesta.aristas.length).toBeGreaterThan(0);
    });

    it('rechaza con ForbiddenException (403) si el rol no es ADMIN', async () => {
      const reqCajero = {
        usuario: {
          partyId: BigInt(2),
          rol: 'CAJERO',
          debeCambiar: false,
        },
      };

      await expect(controller.obtenerGrafo(reqCajero)).rejects.toThrow(ForbiddenException);
    });
  });
});
