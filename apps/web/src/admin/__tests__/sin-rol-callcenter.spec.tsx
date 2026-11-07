import { describe, it, expect } from 'vitest';
import { MODULOS } from '../modulos';
import { ETIQUETAS_ROLES, ROLES_ASIGNABLES } from '../usuarios/roles';
import { ROLES_SISTEMA } from '@caprichos/compartido';

// Permisos que la API da a MOZO y CAJERO para el chat de WhatsApp (permisos.ts)
const CHAT = ['mensajes/ver', 'mensajes/tomar', 'mensajes/enviar', 'mensajes/cerrar'];
const tienePara = (permisos: string[]) => (p: string) => permisos.some((x) => x === p || x.startsWith(`${p}/`));
const visibles = (permisos: string[]) => MODULOS.filter((m) => !m.permisoMinimo || tienePara(permisos)(m.permisoMinimo)).map((m) => m.clave);

describe('rol Call Center eliminado', () => {
  it('no se puede asignar ni existe entre los roles del sistema', () => {
    expect(ROLES_ASIGNABLES).not.toContain('CALLCENTER');
    expect(Object.values(ROLES_SISTEMA)).not.toContain('CALLCENTER');
  });

  it('el historial antiguo lo muestra como rol eliminado', () => {
    expect(ETIQUETAS_ROLES.CALLCENTER).toBe('Call Center (rol eliminado)');
  });

  it('Mensajes aparece en el menú de MOZO y de CAJERO (PC y celular comparten el menú)', () => {
    expect(visibles(['plano/ver', ...CHAT])).toContain('mensajes');
    expect(visibles(['caja/ver', ...CHAT])).toContain('mensajes');
    expect(visibles(['plano/ver'])).not.toContain('mensajes');
  });
});
