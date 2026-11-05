import { AjustesPersonalesCocinaService, CLAVE_PREF_CONFIRMAR_DESPEJAR } from './ajustes-personales.service';
import { PreferenciasUsuarioService } from '../preferencias/preferencias-usuario.service';
import { ComandasService } from './comandas.service';
import { AuditoriaService } from '../auditoria/auditoria.service';

jest.mock('../salon/salon.service', () => ({ SalonService: class {} }));
jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

/** Prisma falso: parámetro general y tabla preferencia_usuario en memoria. */
function montar(generalValor: unknown = 'si') {
  const filas = new Map<string, unknown>();
  const k = (p: bigint | string, c: string) => `${p}|${c}`;
  const prisma: any = {
    parametro: { findUnique: jest.fn().mockResolvedValue(generalValor === undefined ? null : { clave: 'x', valor: generalValor }) },
    preferenciaUsuario: {
      findUnique: jest.fn(async ({ where }: any) => {
        const { party_id, clave } = where.party_id_clave;
        return filas.has(k(party_id, clave)) ? { valor: filas.get(k(party_id, clave)) } : null;
      }),
      upsert: jest.fn(async ({ where, create, update }: any) => {
        const { party_id, clave } = where.party_id_clave;
        filas.set(k(party_id, clave), (update ?? create).valor);
        return {};
      }),
      deleteMany: jest.fn(async ({ where }: any) => {
        filas.delete(k(where.party_id, where.clave));
        return { count: 1 };
      }),
    },
  };
  const comandas = new ComandasService(prisma, { registrar: jest.fn() } as any);
  const auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
  const service = new AjustesPersonalesCocinaService(
    comandas,
    new PreferenciasUsuarioService(prisma),
    auditoria as unknown as AuditoriaService,
  );
  return { service, prisma, auditoria, filas };
}

const cocinero = (partyId: bigint) => ({ partyId, rol: 'COCINA', debeCambiar: false });

describe('AjustesPersonalesCocinaService', () => {
  it('sin preferencia personal, el efectivo es el general del local', async () => {
    const { service } = montar('no');
    await expect(service.obtener(7n)).resolves.toEqual({
      confirmarDespejar: false,
      confirmarDespejarGeneral: false,
      personalizado: false,
    });
  });

  it('con preferencia personal, el efectivo es la personal aunque el general sea otro', async () => {
    const { service } = montar('si');
    await service.guardar(cocinero(7n), false);
    await expect(service.obtener(7n)).resolves.toEqual({
      confirmarDespejar: false,
      confirmarDespejarGeneral: true,
      personalizado: true,
    });
  });

  it('null quita la preferencia y vuelve al general', async () => {
    const { service, filas } = montar('no');
    await service.guardar(cocinero(7n), true);
    const tras = await service.guardar(cocinero(7n), null);
    expect(tras).toEqual({ confirmarDespejar: false, confirmarDespejarGeneral: false, personalizado: false });
    expect(filas.size).toBe(0);
  });

  it('persiste entre dos lecturas y el cambio de general no pisa la personal', async () => {
    const { service, prisma } = montar('si');
    await service.guardar(cocinero(7n), false);
    prisma.parametro.findUnique.mockResolvedValue({ clave: 'cocina_confirmar_despejar', valor: 'si' });
    await expect(service.obtener(7n)).resolves.toMatchObject({ confirmarDespejar: false, personalizado: true });
    await expect(service.obtener(7n)).resolves.toMatchObject({ confirmarDespejar: false, personalizado: true });
  });

  it('un cocinero no modifica la preferencia de otro: solo usa el party del usuario recibido', async () => {
    const { service } = montar('si');
    await service.guardar(cocinero(7n), false);
    await service.guardar(cocinero(8n), true);
    await expect(service.obtener(7n)).resolves.toMatchObject({ confirmarDespejar: false });
    await expect(service.obtener(8n)).resolves.toMatchObject({ confirmarDespejar: true, personalizado: true });
    await service.guardar(cocinero(8n), null);
    await expect(service.obtener(7n)).resolves.toMatchObject({ confirmarDespejar: false, personalizado: true });
  });

  it('guardar audita CAMBIAR_PREFERENCIA_PROPIA sin datos sensibles', async () => {
    const { service, auditoria } = montar('si');
    await service.guardar(cocinero(7n), false, '10.0.0.5');
    expect(auditoria.registrar).toHaveBeenCalledWith({
      categoria: 'CAMBIO',
      modulo: 'cocina',
      accion: 'CAMBIAR_PREFERENCIA_PROPIA',
      resultado: 'OK',
      entidad: 'preferencia_usuario',
      despues: { clave: CLAVE_PREF_CONFIRMAR_DESPEJAR, valor: false },
      partyId: 7n,
      ip: '10.0.0.5',
    });
  });
});
