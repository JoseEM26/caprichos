import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { MATRIZ } from '../../acceso/permisos';
import { conGuardiaSalida } from '../proveedor/guardia-salida';
import { celular9, listaCelulares, NumerosWhatsappService } from '../servicios/numeros-whatsapp.service';

const PROPIO = '977123456';
const BLOQ = '955111222';

function montar(propiosParam = PROPIO, bloqueados: string[] = [BLOQ]) {
  const params: Record<string, any> = {
    whatsapp_numeros_propios: { valor: propiosParam },
    local_datos: { valor: { whatsapp: '999999999' } },
  };
  const filas = bloqueados.map((c) => ({ celular: c, activo: true }));
  const prisma: any = {
    parametro: { findUnique: jest.fn(async ({ where }: any) => params[where.clave] ?? null) },
    numeroBloqueado: {
      findMany: jest.fn(async () => filas.filter((f) => f.activo)),
      findUnique: jest.fn(async ({ where }: any) => filas.find((f) => f.celular === where.celular) ?? null),
      create: jest.fn(async ({ data }: any) => {
        const f = { id: 7n, activo: true, ...data };
        filas.push(f);
        return f;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const f = filas.find((x) => x.celular === where.celular)!;
        Object.assign(f, data);
        return { id: 7n, ...f };
      }),
    },
  };
  const auditoria: any = { registrar: jest.fn(async () => undefined) };
  const numeros = new NumerosWhatsappService(prisma, auditoria);
  const meta: any = {
    enviarTexto: jest.fn(async () => ({ exito: true, estado: 'ENVIADO' })),
    enviarPlantilla: jest.fn(async () => ({ exito: true, estado: 'ENVIADO' })),
    enviarBotones: jest.fn(async () => ({ exito: true, estado: 'ENVIADO' })),
    enviarLista: jest.fn(async () => ({ exito: true, estado: 'ENVIADO' })),
    enviarCarrusel: jest.fn(async () => ({ exito: true, estado: 'ENVIADO' })),
    enviarImagen: jest.fn(async () => ({ exito: true, estado: 'ENVIADO' })),
    estaConectado: jest.fn(() => ({ conectado: true, modo: 'meta' })),
  };
  return { numeros, meta, puerto: conGuardiaSalida(meta, numeros), auditoria, prisma };
}

describe('normalización de celulares', () => {
  it('quita +51, espacios, guiones y ceros; compara por los últimos 9', () => {
    expect(celular9('+51 977-123-456')).toBe(PROPIO);
    expect(celular9('51977123456')).toBe(PROPIO);
    expect(celular9('0977123456')).toBe(PROPIO);
    expect(celular9('wa-user:PE.123')).toBe('');
    expect(listaCelulares('977 123 456, +51955111222; 123')).toEqual([PROPIO, BLOQ]);
  });
});

describe('guardia de salida (único punto antes de Meta)', () => {
  const casos: Array<[string, (p: any, tel: string) => Promise<any>, string]> = [
    ['enviarTexto', (p, t) => p.enviarTexto(t, 'hola'), 'enviarTexto'],
    ['enviarPlantilla', (p, t) => p.enviarPlantilla(t, 'plantilla', 'es', ['a']), 'enviarPlantilla'],
    ['enviarBotones', (p, t) => p.enviarBotones(t, 'hola', [{ id: '1', titulo: 'Si' }]), 'enviarBotones'],
    ['enviarLista', (p, t) => p.enviarLista(t, 'hola', 'Ver', [{ id: '1', titulo: 'a' }]), 'enviarLista'],
    ['enviarCarrusel', (p, t) => p.enviarCarrusel(t, { cuerpo: 'x', tarjetas: [] }), 'enviarCarrusel'],
    ['enviarImagen', (p, t) => p.enviarImagen(t, 'https://x/y.jpg', 'pie'), 'enviarImagen'],
  ];

  it.each(casos)('%s: omite al número propio (cualquier formato) sin llamar a Meta', async (_n, llamar, metodo) => {
    const { puerto, meta } = montar();
    for (const tel of [PROPIO, '51977123456', '+51 977 123 456']) {
      const r = await llamar(puerto, tel);
      expect(r).toMatchObject({ exito: false, estado: 'OMITIDO', errorCodigo: 'DESTINO_NUMERO_PROPIO' });
    }
    expect(meta[metodo]).not.toHaveBeenCalled();
  });

  it.each(casos)('%s: omite al número bloqueado sin llamar a Meta', async (_n, llamar, metodo) => {
    const { puerto, meta } = montar();
    const r = await llamar(puerto, '51955111222');
    expect(r).toMatchObject({ estado: 'OMITIDO', errorCodigo: 'DESTINO_BLOQUEADO' });
    expect(meta[metodo]).not.toHaveBeenCalled();
  });

  it('otros números salen igual que siempre y lo demás del puerto pasa', async () => {
    const { puerto, meta } = montar();
    const r = await puerto.enviarTexto('51987654321', 'hola', { pedidoId: 1n });
    expect(r.exito).toBe(true);
    expect(meta.enviarTexto).toHaveBeenCalledWith('51987654321', 'hola', { pedidoId: 1n });
    expect(puerto.estaConectado().modo).toBe('meta');
  });

  it('un BSUID (sin número) no se bloquea', async () => {
    const { puerto, meta } = montar();
    await puerto.enviarTexto('wa-user:PE.123', 'hola');
    expect(meta.enviarTexto).toHaveBeenCalled();
  });

  it('si falla la lectura de la lista, el envío NO se frena', async () => {
    const { puerto, meta, prisma } = montar();
    prisma.parametro.findUnique.mockRejectedValue(new Error('bd caída'));
    const r = await puerto.enviarTexto('51987654321', 'hola');
    expect(r.exito).toBe(true);
    expect(meta.enviarTexto).toHaveBeenCalled();
  });

  it('aprende el número visible del negocio desde Meta (display_phone_number)', async () => {
    const { puerto, meta, numeros } = montar('');
    numeros.aprenderNumeroVisible('+51 977 000 111');
    const r = await puerto.enviarTexto('51977000111', 'hola');
    expect(r.estado).toBe('OMITIDO');
    expect(meta.enviarTexto).not.toHaveBeenCalled();
  });
});

describe('API de bloqueo (servicio)', () => {
  const usuario = { partyId: 5n, nombre: 'Ana' };

  it('bloquea, audita y deja de enviar', async () => {
    const { numeros, auditoria, puerto, meta } = montar('977123456', []);
    const r = await numeros.bloquear('+51 933 444 555', 'spam', usuario, '1.1.1.1');
    expect(r.celular).toBe('933444555');
    expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'NUMERO_BLOQUEADO', despues: { celular: '933444555', motivo: 'spam' } }));
    expect((await puerto.enviarTexto('933444555', 'x')).estado).toBe('OMITIDO');
    expect(meta.enviarTexto).not.toHaveBeenCalled();
  });

  it('rechaza inválido, propio y duplicado', async () => {
    const { numeros } = montar();
    await expect(numeros.bloquear('12345', '', usuario)).rejects.toBeInstanceOf(BadRequestException);
    await expect(numeros.bloquear('812345678', '', usuario)).rejects.toBeInstanceOf(BadRequestException);
    await expect(numeros.bloquear('+51977123456', '', usuario)).rejects.toMatchObject({ response: { codigo: 'NUMERO_PROPIO' } });
    await expect(numeros.bloquear(BLOQ, '', usuario)).rejects.toBeInstanceOf(ConflictException);
    await expect(numeros.bloquear('933444555', 'x'.repeat(121), usuario)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('desbloquea, audita y vuelve a enviar; desbloquear uno que no está da 404', async () => {
    const { numeros, auditoria, puerto, meta } = montar();
    await numeros.desbloquear(BLOQ, usuario);
    expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'NUMERO_DESBLOQUEADO' }));
    expect((await puerto.enviarTexto(BLOQ, 'x')).exito).toBe(true);
    expect(meta.enviarTexto).toHaveBeenCalled();
    await expect(numeros.desbloquear('944000111', usuario)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('permiso mensajes/bloquear_numeros', () => {
  it('solo ADMIN y SUPERVISOR; no CAJERO ni MOZO', () => {
    const con = Object.keys(MATRIZ).filter((r) => MATRIZ[r].includes('mensajes/bloquear_numeros')).sort();
    expect(con).toEqual(['ADMIN', 'SUPERVISOR']);
  });
});
