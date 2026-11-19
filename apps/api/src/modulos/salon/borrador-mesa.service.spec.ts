import { BorradorMesaService, inicioDiaLima } from './borrador-mesa.service';

describe('BorradorMesaService', () => {
  const mesa = { id: 5n, numero: 1, nombre: null, activo: true };
  let prisma: any;
  let auditoria: any;
  let svc: BorradorMesaService;

  beforeEach(() => {
    prisma = {
      elementoPlano: { findUnique: jest.fn().mockResolvedValue(mesa) },
      pedidoBorradorMesa: {
        upsert: jest.fn().mockResolvedValue({ mesa_id: 5n, party_id: 9n, productos: 2, contenido: {}, creado_en: new Date(), actualizado_en: new Date(), mesa }),
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        delete: jest.fn(),
      },
      person: { findUnique: jest.fn().mockResolvedValue({ nombres: 'Ana', apellidos: 'Ruiz' }) },
      pedido: { create: jest.fn() },
      pedidoMesa: { create: jest.fn() },
    };
    auditoria = { registrar: jest.fn() };
    svc = new BorradorMesaService(prisma, auditoria);
  });

  it('guarda con upsert por mesa y persona (uno por persona), audita y NO ocupa la mesa', async () => {
    const r = await svc.guardar('5', { lineas: [] }, 2, { partyId: '9' });
    expect(prisma.pedidoBorradorMesa.upsert.mock.calls[0][0].where).toEqual({ mesa_id_party_id: { mesa_id: 5n, party_id: 9n } });
    expect(r.mozo).toBe('Ana Ruiz');
    expect(r.mesaNombre).toBe('Mesa 1');
    expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'GUARDAR_BORRADOR_PEDIDO' }));
    expect(prisma.pedido.create).not.toHaveBeenCalled();
    expect(prisma.pedidoMesa.create).not.toHaveBeenCalled();
  });

  it('al consultar borra los de días anteriores', async () => {
    await svc.listar({ partyId: '9' });
    const corte = prisma.pedidoBorradorMesa.deleteMany.mock.calls[0][0].where.actualizado_en.lt as Date;
    expect(corte.getTime()).toBe(inicioDiaLima().getTime());
  });

  it('el día de Lima empieza a las 05:00 UTC', () => {
    expect(inicioDiaLima(new Date('2027-03-21T03:00:00Z')).toISOString()).toBe('2027-03-20T05:00:00.000Z');
    expect(inicioDiaLima(new Date('2027-03-21T06:00:00Z')).toISOString()).toBe('2027-03-21T05:00:00.000Z');
  });

  it('cada persona ve solo el suyo: listar y obtener filtran por su party', async () => {
    await svc.listar({ partyId: '9' });
    expect(prisma.pedidoBorradorMesa.findMany.mock.calls[0][0].where).toEqual({ party_id: 9n });
    prisma.pedidoBorradorMesa.findUnique.mockResolvedValueOnce(null);
    expect(await svc.obtenerPorMesa('5', { partyId: '9' })).toBeNull();
    expect(prisma.pedidoBorradorMesa.findUnique.mock.calls[0][0].where).toEqual({ mesa_id_party_id: { mesa_id: 5n, party_id: 9n } });
  });

  it('eliminar audita; si no existe no falla', async () => {
    prisma.pedidoBorradorMesa.findUnique.mockResolvedValueOnce(null);
    expect(await svc.eliminar('5', { partyId: '9' })).toEqual({ ok: true });
    prisma.pedidoBorradorMesa.findUnique.mockResolvedValueOnce({ mesa_id: 5n, party_id: 9n, productos: 2 });
    await svc.eliminar('5', { partyId: '1' });
    expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'ELIMINAR_BORRADOR_PEDIDO' }));
  });
});
