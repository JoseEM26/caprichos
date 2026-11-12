import { QuejasWhatsappService } from '../servicios/quejas-whatsapp.service';

describe('QuejasWhatsappService.listarEnvios (encuestas enviadas y omitidas)', () => {
  it('muestra la plantilla, el motivo de omision y el error de envio (plantilla inexistente), con el celular enmascarado', async () => {
    const prisma: any = {
      encuestaPosventa: {
        findMany: jest.fn().mockResolvedValue([
          { id: BigInt(1), pedido_id: BigInt(10), estado: 'ENVIADA', motivo: null, enviada_en: new Date('2026-11-12T15:00:00Z'), pedido: { codigo: 'CP-1', cliente_nombre: 'Ana', cliente_telefono: '987654321' } },
          { id: BigInt(2), pedido_id: BigInt(11), estado: 'OMITIDA', motivo: 'TOPE_POR_CELULAR', enviada_en: new Date('2026-11-12T16:00:00Z'), pedido: { codigo: 'CP-2', cliente_nombre: 'Ana', cliente_telefono: '987654321' } },
        ]),
      },
      salienteWhatsapp: {
        findMany: jest.fn().mockResolvedValue([
          { pedido_id: BigInt(10), estado: 'FALLIDO', ultimo_error: '132001 template not found', motivo_descarte: null },
        ]),
      },
    };
    const r = await new QuejasWhatsappService(prisma, {} as any).listarEnvios();

    expect(r.plantilla.nombre).toBe('caprichos_encuesta_posventa');
    expect(r.envios[0]).toMatchObject({ pedidoCodigo: 'CP-1', envio: 'FALLIDO', errorEnvio: '132001 template not found' });
    expect(r.envios[0].telefonoEnmascarado).not.toContain('987654321');
    expect(r.envios[1]).toMatchObject({ estado: 'OMITIDA', motivo: 'TOPE_POR_CELULAR', envio: null });
  });
});
