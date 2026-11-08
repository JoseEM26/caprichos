jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { CorregirClienteService } from './corregir-cliente.service';
import { CorregirClienteDto } from './dto/corregir-cliente.dto';

const usuario: any = { partyId: BigInt(9), rol: 'CAJERO' };

function armar(pedidoOver: any = {}) {
  const pedido = {
    id: BigInt(1), codigo: 'CP-W001', version: 2, estado: 'ENTREGADO', modalidad: 'DELIVERY',
    cliente_nombre: 'Ana', cliente_telefono: '987654320', entrega_direccion: 'Av. Uno', entrega_referencia: null,
    ...pedidoOver,
  };
  const tx = { pedido: { update: jest.fn() }, pedidoEstadoHistorial: { create: jest.fn() } };
  const prisma: any = {
    pedido: { findUnique: jest.fn().mockResolvedValue(pedido) },
    person: { findUnique: jest.fn().mockResolvedValue({ nombres: 'Yefri', apellidos: 'Pérez' }) },
    salienteWhatsapp: { count: jest.fn().mockResolvedValue(2) },
    $transaction: jest.fn(async (fn: any) => fn(tx)),
  };
  const auditoria: any = { registrar: jest.fn() };
  const direcciones: any = { cuentaPorTelefono: jest.fn().mockResolvedValue({ primerNombre: 'Lucía' }) };
  const eventos: any = { emitirAdmin: jest.fn() };
  return { svc: new CorregirClienteService(prisma, auditoria, direcciones, eventos), prisma, tx, auditoria, eventos };
}
const dto = (o: any = {}) => ({ nombre: 'Ana Ruiz', telefono: '987654321', ...o }) as CorregirClienteDto;

describe('CorregirClienteService', () => {
  it('corrige un pedido ya entregado: actualiza, audita antes/después, deja historial y emite pedido:editado', async () => {
    const { svc, tx, auditoria, eventos } = armar();
    const r = await svc.corregir('1', dto({ direccion: 'Av. Dos', referencia: 'Portón negro', motivo: 'Error al escribir' }), usuario, '1.1.1.1');
    expect(tx.pedido.update.mock.calls[0][0].data).toEqual({
      cliente_nombre: 'Ana Ruiz', cliente_telefono: '987654321', entrega_direccion: 'Av. Dos', entrega_referencia: 'Portón negro',
    });
    const a = auditoria.registrar.mock.calls[0][0];
    expect(a.accion).toBe('CORREGIR_CLIENTE');
    expect(a.antes.telefono).toBe('987654320');
    expect(a.despues).toMatchObject({ telefono: '987654321', motivo: 'Error al escribir' });
    const h = tx.pedidoEstadoHistorial.create.mock.calls[0][0].data;
    expect(h.motivo).toBe('Datos del cliente corregidos por Yefri Pérez: Error al escribir');
    expect(h.estado_anterior).toBe('ENTREGADO');
    expect(eventos.emitirAdmin).toHaveBeenCalledWith('pedido:editado', expect.objectContaining({ id: '1' }));
    expect(r.avisosPendientes).toBe(2);
    expect(r.numeroDeCuenta).toBe('Lucía');
  });

  it('no toca la cuenta del cliente ni el punto del mapa', async () => {
    const { svc, tx } = armar();
    await svc.corregir('1', dto(), usuario);
    const data = tx.pedido.update.mock.calls[0][0].data;
    expect(data).not.toHaveProperty('cliente_party_id');
    expect(data).not.toHaveProperty('entrega_lat');
  });

  it('en pedidos que no son delivery ignora dirección y referencia', async () => {
    const { svc, tx } = armar({ modalidad: 'RECOGER' });
    await svc.corregir('1', dto({ direccion: 'X' }), usuario);
    expect(tx.pedido.update.mock.calls[0][0].data).not.toHaveProperty('entrega_direccion');
  });

  it.each(['ANULADO', 'RECHAZADO'])('rechaza un pedido %s', async (estado) => {
    const { svc, tx } = armar({ estado });
    await expect(svc.corregir('1', dto(), usuario)).rejects.toBeInstanceOf(ConflictException);
    expect(tx.pedido.update).not.toHaveBeenCalled();
  });

  it.each(['COLA', 'ENTREGADO', 'LISTO'])('permite el estado %s', async (estado) => {
    const { svc } = armar({ estado });
    await expect(svc.corregir('1', dto(), usuario)).resolves.toBeDefined();
  });

  it('404 si no existe', async () => {
    const { svc, prisma } = armar();
    prisma.pedido.findUnique.mockResolvedValue(null);
    await expect(svc.corregir('1', dto(), usuario)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('CorregirClienteDto', () => {
  const errores = async (o: any) => (await validate(plainToInstance(CorregirClienteDto, o))).map((e) => e.property);
  it('acepta datos válidos (con espacios en el celular)', async () => {
    expect(await errores({ nombre: 'Ana', telefono: '987 654 321' })).toEqual([]);
  });
  it.each(['887654321', '98765432', '9876543210', 'abc'])('rechaza el celular %s', async (telefono) => {
    expect(await errores({ nombre: 'Ana', telefono })).toContain('telefono');
  });
  it('rechaza nombre corto y textos demasiado largos', async () => {
    expect(await errores({ nombre: 'A', telefono: '987654321' })).toContain('nombre');
    expect(await errores({ nombre: 'Ana', telefono: '987654321', direccion: 'x'.repeat(201) })).toContain('direccion');
  });
});
