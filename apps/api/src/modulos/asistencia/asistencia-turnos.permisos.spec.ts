jest.mock('@nestjs/jwt', () => ({ JwtService: jest.fn(), JwtModule: {} }));
jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

import { CLAVE_PERMISO } from '../acceso/permiso.decorator';
import { MATRIZ, PERMISOS } from '../acceso/permisos';
import { MisTurnosController, TurnosAprobacionController } from './asistencia-turnos.controller';

const permisoDe = (clase: any, metodo: string) => Reflect.getMetadata(CLAVE_PERMISO, clase.prototype[metodo]);

describe('permisos de reemplazos y cambios de turno', () => {
  it('lo mío exige asistencia/marcar en cada ruta (la cuenta sale del token)', () => {
    for (const m of ['candidatos', 'turnosDe', 'mias', 'crear', 'aceptar', 'rechazar', 'cancelar']) {
      expect(permisoDe(MisTurnosController, m)).toEqual({ modulo: 'asistencia', accion: 'marcar' });
    }
  });

  it('aprobar, rechazar y la bandeja exigen asistencia/aprobar_reemplazos', () => {
    for (const m of ['listar', 'aprobar', 'rechazar']) {
      expect(permisoDe(TurnosAprobacionController, m)).toEqual({ modulo: 'asistencia', accion: 'aprobar_reemplazos' });
    }
  });

  it('el permiso existe en el catálogo y solo lo tiene el SUPERVISOR (y el ADMIN, que recibe todos)', () => {
    expect(PERMISOS).toContainEqual({ modulo: 'asistencia', accion: 'aprobar_reemplazos' });
    expect(MATRIZ.SUPERVISOR).toContain('asistencia/aprobar_reemplazos');
    for (const rol of ['CAJERO', 'MOZO', 'COCINA', 'ALMACEN', 'REPARTIDOR', 'MARKETING']) {
      expect(MATRIZ[rol]).not.toContain('asistencia/aprobar_reemplazos');
    }
  });
});
