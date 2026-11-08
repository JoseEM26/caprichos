import { describe, it, expect } from 'vitest';
import { MODULOS } from '../modulos';
import { ETIQUETAS_ROLES } from '../usuarios/CrearUsuarioModal';
import { ROLES_SISTEMA } from '@caprichos/compartido';

// Permisos del SUPERVISOR tal como los devuelve la API (MATRIZ.SUPERVISOR en permisos.ts):
// la unión de CAJERO y MOZO.
const PERMISOS_SUPERVISOR = [
  'pedidos/ver', 'pedidos/crear', 'pedidos/cambiar_estado',
  'caja/abrir', 'caja/cobrar', 'caja/movimientos', 'caja/cerrar', 'caja/ver',
  'cocina/ver', 'catalogo/ver', 'comprobantes/ver', 'comprobantes/reimprimir',
  'mesas/ver', 'mesas/liberar', 'mesas/abrir', 'repartos/ver', 'repartos/liquidar',
  'vouchers/subir', 'vouchers/ver', 'plano/ver', 'reservas/ver', 'reservas/crear', 'reservas/editar',
  'iniciativas/ver', 'iniciativas/crear', 'iniciativas/comentar',
  'notificaciones/ver', 'notificaciones/marcar',
  'mensajes/ver', 'mensajes/tomar', 'mensajes/enviar', 'mensajes/cerrar',
  'whatsapp_salientes/ver', 'whatsapp_salientes/reenviar', 'whatsapp_salientes/descartar',
];

// Misma regla que useSesion().tiene para un rol que no es ADMIN
const tiene = (permiso: string) =>
  PERMISOS_SUPERVISOR.some((p) => p === permiso || p.startsWith(`${permiso}/`));

const visibles = () => MODULOS.filter((m) => !m.permisoMinimo || tiene(m.permisoMinimo)).map((m) => m.clave);

describe('menú del SUPERVISOR', () => {
  it('no ve los módulos reservados al administrador', () => {
    const reservados = [
      'disenador', 'novedades', 'conocenos', 'destacadas', 'paleta', 'mirest', 'zonas',
      'usuarios', 'historial', 'informes', 'indicadores', 'mapa', 'pantallas', 'mascota',
      'compras', 'almacen', 'stock', 'recetas', 'clientes', 'ofertas', 'creditos', 'reclamos',
    ];
    const ve = visibles();
    for (const clave of reservados) {
      expect(ve, `no debe ver ${clave}`).not.toContain(clave);
    }
  });

  it('ve caja, salón, cocina y cobros; ya no existe la pantalla Código del supervisor', () => {
    const ve = visibles();
    for (const clave of ['caja', 'cierre', 'cocina', 'repartos', 'reservas', 'plano', 'comprobantes', 'iniciativas', 'mensajes']) {
      expect(ve, `debe ver ${clave}`).toContain(clave);
    }
    expect(MODULOS.find((m) => m.clave === 'supervisor-codigo')).toBeUndefined();
    expect(visibles()).not.toContain('supervisor-codigo');
  });

  it('Novedades, Conócenos y Destacadas se miran con el permiso que exige su API', () => {
    const porClave = (c: string) => MODULOS.find((m) => m.clave === c)?.permisoMinimo;
    expect(porClave('novedades')).toBe('novedades/ver');
    expect(porClave('conocenos')).toBe('novedades/ver');
    expect(porClave('destacadas')).toBe('destacadas/ver');
  });
});

describe('rol SUPERVISOR en el alta y edición de usuarios', () => {
  it('aparece en los roles del sistema con su descripción corta', () => {
    expect(Object.values(ROLES_SISTEMA)).toContain('SUPERVISOR');
    expect(ETIQUETAS_ROLES.SUPERVISOR).toBe('Supervisor (Caja y salón, sin administración)');
  });
});
