jest.mock('../chatbot', () => ({ ChatbotIaService: class {}, ConocimientoBotService: class {} }));
jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

import { AprendizajesService } from './aprendizajes.service';
import { AprendizajesTarea } from './aprendizajes.tarea';
import { crearPrisma } from './prueba-util';
import { PERMISOS, MATRIZ } from '../acceso/permisos';

const ADMIN = 1n;
const armar = () => {
  const prisma = crearPrisma();
  const auditoria = { registrar: jest.fn() };
  const conocimiento = { olvidarCache: jest.fn() };
  const noche = { parametros: async () => ({ minRepeticiones: 3, topeUsd: 3 }) } as any;
  const svc = new AprendizajesService(prisma, auditoria as any, noche, {} as any, conocimiento as any);
  prisma._props.push({ id: 5n, estado: 'PENDIENTE', tipo: 'FAQ', intencion: 'delivery', pregunta: '¿Hacen delivery?', respuesta: 'Sí.', frases: [], repeticiones: 4, evidencia: [] });
  return { prisma, auditoria, conocimiento, svc };
};

describe('AprendizajesService', () => {
  it('aprobar aplica ediciones, crea conocimiento con versión max+1 y audita', async () => {
    const { svc, prisma, auditoria, conocimiento } = armar();
    prisma._conocimientos.push({ id: 9n, version: 7, estado: 'RETIRADO' });
    const r = await svc.aprobar('5', { respuesta: 'Sí, con gusto.', frases: ['hacen envios'] }, ADMIN);
    expect(r).toMatchObject({ estado: 'APROBADO', version: 8 });
    expect(prisma._props[0]).toMatchObject({ estado: 'APROBADO', decidido_por: ADMIN, respuesta: 'Sí, con gusto.' });
    expect(prisma._conocimientos[1]).toMatchObject({ version: 8, estado: 'VIGENTE', respuesta: 'Sí, con gusto.', pregunta: '¿Hacen delivery?', aprobado_por: ADMIN });
    expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'APRENDIZAJE_APROBAR', partyId: ADMIN }));
    expect(conocimiento.olvidarCache).toHaveBeenCalled();
  });

  it('la primera aprobación es la versión 1 y no se aprueba dos veces', async () => {
    const { svc } = armar();
    expect((await svc.aprobar('5', undefined, ADMIN)).version).toBe(1);
    await expect(svc.aprobar('5', undefined, ADMIN)).rejects.toMatchObject({ response: { codigo: 'PROPUESTA_YA_DECIDIDA' } });
  });

  it('rechaza ediciones inválidas', async () => {
    const { svc } = armar();
    await expect(svc.aprobar('5', { respuesta: '  ' }, ADMIN)).rejects.toMatchObject({ response: { codigo: 'TEXTO_INVALIDO' } });
    await expect(svc.aprobar('5', { frases: Array(9).fill('a') }, ADMIN)).rejects.toMatchObject({ response: { codigo: 'FRASES_INVALIDAS' } });
  });

  it('descartar exige un motivo de al menos 5 caracteres', async () => {
    const { svc, prisma, auditoria } = armar();
    await expect(svc.descartar('5', 'no', ADMIN)).rejects.toMatchObject({ response: { codigo: 'MOTIVO_OBLIGATORIO' } });
    await expect(svc.descartar('5', undefined, ADMIN)).rejects.toMatchObject({ response: { codigo: 'MOTIVO_OBLIGATORIO' } });
    await svc.descartar('5', 'No aplica al local', ADMIN);
    expect(prisma._props[0]).toMatchObject({ estado: 'DESCARTADO', motivo: 'No aplica al local' });
    expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'APRENDIZAJE_DESCARTAR' }));
  });

  it('retirar exige motivo, deja RETIRADO y audita', async () => {
    const { svc, prisma, auditoria } = armar();
    await svc.aprobar('5', undefined, ADMIN);
    const id = prisma._conocimientos[0].id.toString();
    await expect(svc.retirar(id, '', ADMIN)).rejects.toMatchObject({ response: { codigo: 'MOTIVO_OBLIGATORIO' } });
    await svc.retirar(id, 'Ya cambió la política', ADMIN);
    expect(prisma._conocimientos[0]).toMatchObject({ estado: 'RETIRADO', retirado_por: ADMIN, motivo_retiro: 'Ya cambió la política' });
    expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'CONOCIMIENTO_RETIRAR' }));
    await expect(svc.retirar(id, 'otra vez', ADMIN)).rejects.toMatchObject({ response: { codigo: 'CONOCIMIENTO_YA_RETIRADO' } });
  });
});

describe('aprendizajes: permisos y tarea', () => {
  it('los permisos existen y solo los tiene ADMIN', () => {
    const claves = ['aprendizajes/ver', 'aprendizajes/aprobar'];
    for (const c of claves) expect(PERMISOS.some((p) => `${p.modulo}/${p.accion}` === c)).toBe(true);
    expect(claves.every((c) => MATRIZ.ADMIN.includes(c))).toBe(true);
    for (const [rol, lista] of Object.entries(MATRIZ)) {
      if (rol !== 'ADMIN') expect(lista.some((p) => p.startsWith('aprendizajes/'))).toBe(false);
    }
  });

  it('la tarea espera la hora configurada, respeta el apagado y no repite la noche', async () => {
    const prisma = crearPrisma({ parametros: { aprendizaje_hora: '3' } });
    const noche: any = {
      parametros: jest.fn(async () => ({ activo: true, hora: 3 })),
      ayer: () => '2027-03-01',
      ejecutarNoche: jest.fn(),
    };
    const tarea = new AprendizajesTarea(prisma, noche);
    expect(await tarea.ciclo(new Date('2027-03-02T05:00:00Z'))).toBe('temprano'); // 00:00 Lima
    expect(await tarea.ciclo(new Date('2027-03-02T08:30:00Z'))).toBe('ejecutado'); // 03:30 Lima
    expect(noche.ejecutarNoche).toHaveBeenCalledWith('2027-03-01');
    prisma._noches.push({ fecha: new Date('2027-03-01T00:00:00Z'), id: 1n });
    expect(await tarea.ciclo(new Date('2027-03-02T09:00:00Z'))).toBe('ya_hecho');
    noche.parametros.mockResolvedValue({ activo: false, hora: 3 });
    expect(await tarea.ciclo(new Date('2027-03-02T09:00:00Z'))).toBe('apagado');
  });
});
