import { AvisosEquipoCorreoService } from '../avisos-equipo-correo.service';

// Lunes 2026-11-02 10:30 Lima (15:30 UTC)
const AHORA = new Date('2026-11-02T15:30:00Z');

describe('AvisosEquipoCorreoService (carga de turnos y envío)', () => {
  it('envía solo a quien tiene casilla, correo y está de turno', async () => {
    const prisma: any = {
      userAccount: {
        findMany: jest.fn().mockResolvedValue([
          {
            party_id: 1n,
            avisos_correo: true,
            party: {
              persona: { correo: 'Ana@Caprichos.pe', horario_24_7: false },
              horariosTrabajo: [{ dia_semana: 1, entrada: new Date('1970-01-01T09:00:00Z'), salida: new Date('1970-01-01T13:00:00Z') }],
              reemplazosDia: [],
            },
          },
          {
            party_id: 2n,
            avisos_correo: false,
            party: {
              persona: { correo: 'mozo@caprichos.pe', horario_24_7: false },
              horariosTrabajo: [{ dia_semana: 1, entrada: new Date('1970-01-01T09:00:00Z'), salida: new Date('1970-01-01T13:00:00Z') }],
              reemplazosDia: [],
            },
          },
        ]),
      },
      coberturaTurno: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const correo = { enviar: jest.fn().mockResolvedValue({ enviados: 1, simulados: 0, fallidos: 0, omitidos: 0 }) };
    const servicio = new AvisosEquipoCorreoService(prisma, correo as any);
    await servicio.avisar({ clave: 'c1', origen: 'TEST', asunto: 'Asunto', texto: 'Texto', ahora: AHORA });
    expect(correo.enviar).toHaveBeenCalledWith({
      clave: 'c1',
      origen: 'TEST',
      asunto: 'Asunto',
      texto: 'Texto',
      destinatarios: ['ana@caprichos.pe'],
    });
  });

  it('nunca lanza: si la base falla, devuelve null', async () => {
    const prisma: any = { userAccount: { findMany: jest.fn().mockRejectedValue(new Error('caída')) } };
    const correo = { enviar: jest.fn() };
    const servicio = new AvisosEquipoCorreoService(prisma, correo as any);
    await expect(servicio.avisar({ clave: 'c', origen: 'T', asunto: 'a', texto: 't' })).resolves.toBeNull();
    expect(correo.enviar).not.toHaveBeenCalled();
  });
});
