import { FacturacionClienteService, enmascararRuc } from './facturacion-cliente.service';

// RUC de prueba con dígito verificador válido (calculado, no real)
const rucPrueba = (() => {
  const base = '2000000001';
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const suma = pesos.reduce((a, p, i) => a + p * Number(base[i]), 0);
  return base + ((11 - (suma % 11)) % 10);
})();

describe('FacturacionClienteService', () => {
  let prisma: any;
  let auditoria: any;
  let svc: FacturacionClienteService;

  beforeEach(() => {
    prisma = { clienteFacturacion: { createMany: jest.fn().mockResolvedValue({ count: 1 }), findUnique: jest.fn() } };
    auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
    svc = new FacturacionClienteService(prisma, auditoria);
  });

  it('cuenta sin RUC: lo guarda la primera vez con razón social y dirección', async () => {
    const r = await svc.asignarSiFalta(5n, { ruc: rucPrueba, razonSocial: ' Empresa de Prueba SAC ', direccion: 'Av. Falsa 123' }, { canal: 'CAJA', actorPartyId: 9n, pedido: 'CP-W1' });
    expect(r).toBe(true);
    expect(prisma.clienteFacturacion.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ party_id: 5n, ruc: rucPrueba, razon_social: 'Empresa de Prueba SAC', origen: 'CAJA' })],
      skipDuplicates: true,
    });
  });

  it('no sobrescribe: si la cuenta ya tiene RUC (createMany count 0) no audita ni cambia nada', async () => {
    prisma.clienteFacturacion.createMany.mockResolvedValue({ count: 0 });
    expect(await svc.asignarSiFalta(5n, { ruc: rucPrueba }, { canal: 'MOZO' })).toBe(false);
    expect(auditoria.registrar).not.toHaveBeenCalled();
  });

  it('RUC inválido, DNI (8 dígitos) o sin cuenta: no se guarda', async () => {
    expect(await svc.asignarSiFalta(5n, { ruc: '20123456789' }, { canal: 'CAJA' })).toBe(false);
    expect(await svc.asignarSiFalta(5n, { ruc: '12345678' }, { canal: 'CAJA' })).toBe(false);
    expect(await svc.asignarSiFalta(null, { ruc: rucPrueba }, { canal: 'CAJA' })).toBe(false);
    expect(prisma.clienteFacturacion.createMany).not.toHaveBeenCalled();
  });

  it('fallo al guardar no lanza (el pedido sigue)', async () => {
    prisma.clienteFacturacion.createMany.mockRejectedValue(new Error('db caída'));
    await expect(svc.asignarSiFalta(5n, { ruc: rucPrueba }, { canal: 'BOT' })).resolves.toBe(false);
  });

  it('auditoría con el RUC enmascarado, nunca completo', async () => {
    await svc.asignarSiFalta(5n, { ruc: rucPrueba }, { canal: 'BOT', pedido: 'CP-W2' });
    const reg = auditoria.registrar.mock.calls[0][0];
    expect(reg.accion).toBe('RUC_ASIGNADO_A_CUENTA');
    expect(JSON.stringify(reg, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))).not.toContain(rucPrueba);
    expect(reg.despues.ruc).toBe(enmascararRuc(rucPrueba));
  });

  it('obtener devuelve null sin RUC y el dato con RUC', async () => {
    prisma.clienteFacturacion.findUnique.mockResolvedValueOnce(null);
    expect(await svc.obtener(5n)).toBeNull();
    prisma.clienteFacturacion.findUnique.mockResolvedValueOnce({ ruc: rucPrueba, razon_social: 'X SAC', direccion: null });
    expect(await svc.obtener(5n)).toEqual({ ruc: rucPrueba, razonSocial: 'X SAC', direccion: null });
  });
});
