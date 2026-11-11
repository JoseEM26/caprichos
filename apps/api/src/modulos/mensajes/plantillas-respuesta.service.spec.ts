jest.mock('@nestjs/jwt', () => ({ JwtService: jest.fn(), JwtModule: {} }));
jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

import { Reflector } from '@nestjs/core';
import { CLAVE_PERMISO } from '../acceso/permiso.decorator';
import { MensajesController } from './mensajes.controller';
import { limpiarTextoPlantilla, MAX_TEXTO_PLANTILLA, PlantillasRespuestaService } from './plantillas-respuesta.service';

describe('PlantillasRespuestaService', () => {
  let filas: any[];
  let prisma: any;
  let auditoria: any;
  let service: PlantillasRespuestaService;
  const usuario = { partyId: 7n, rol: 'CAJERO', debeCambiar: false };

  beforeEach(() => {
    filas = [{ id: 1n, titulo: 'Saludo', texto: 'Hola', activo: true, categoria: 'SALUDO', orden: 10 }];
    auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
    prisma = {
      respuestaRapida: {
        findMany: jest.fn().mockImplementation(({ where }: any = {}) => {
          const t = where?.titulo?.equals?.toLowerCase();
          return Promise.resolve(t ? filas.filter((f) => f.titulo.toLowerCase() === t && f.id !== where?.NOT?.id) : filas);
        }),
        findUnique: jest.fn().mockImplementation(({ where }: any) => Promise.resolve(filas.find((f) => f.id === where.id) ?? null)),
        aggregate: jest.fn().mockResolvedValue({ _max: { orden: 10 } }),
        create: jest.fn().mockImplementation(({ data }: any) => {
          const f = { id: BigInt(filas.length + 1), ...data };
          filas.push(f);
          return Promise.resolve(f);
        }),
        update: jest.fn().mockImplementation(({ where, data }: any) => {
          const f = filas.find((x) => x.id === where.id);
          Object.assign(f, data);
          return Promise.resolve(f);
        }),
        delete: jest.fn().mockImplementation(({ where }: any) => {
          filas = filas.filter((x) => x.id !== where.id);
          return Promise.resolve({});
        }),
      },
      parametro: {
        findMany: jest.fn().mockResolvedValue([
          { clave: 'local_datos', valor: { nombre: 'Café Prueba', direccion: 'Calle Falsa 123' } },
          { clave: 'local_pagos', valor: { yape: { activo: true, numero: '900000001', titular: 'Titular Prueba' }, plin: { activo: false }, efectivo: { activo: true } } },
        ]),
      },
      horarioDia: {
        findMany: jest.fn().mockResolvedValue([
          { dia_semana: 1, abre: '14:00', cierra: '22:00', cerrado: false },
          { dia_semana: 2, abre: '14:00', cierra: '22:00', cerrado: false },
          { dia_semana: 3, abre: null, cierra: null, cerrado: true },
        ]),
      },
      party: { findUnique: jest.fn().mockResolvedValue({ persona: { nombres: 'Lucía María', apellidos: 'X' } }) },
      $transaction: jest.fn().mockImplementation((ops: any[]) => Promise.all(ops)),
    };
    service = new PlantillasRespuestaService(prisma, auditoria);
  });

  it('crea con categoría, limpia el texto, guarda quién y audita', async () => {
    const r = await service.crear({ titulo: '  Gracias   mil ', texto: 'Hola\r\n\r\n\r\n\r\nChau\u0007  ', categoria: 'cierre' }, usuario, '1.1.1.1');
    expect(r).toMatchObject({ titulo: 'Gracias mil', texto: 'Hola\n\nChau', categoria: 'CIERRE', activo: true, orden: 20 });
    expect(prisma.respuestaRapida.create.mock.calls[0][0].data).toMatchObject({ creado_por: 7n, actualizado_por: 7n });
    expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ modulo: 'mensajes', accion: 'PLANTILLA_CREAR', partyId: 7n }));
  });

  it('rechaza título repetido (sin mayúsculas), texto vacío, texto largo y categoría inválida', async () => {
    await expect(service.crear({ titulo: 'SALUDO', texto: 'x' }, usuario)).rejects.toMatchObject({ response: { codigo: 'TITULO_DUPLICADO' } });
    await expect(service.crear({ titulo: 'Nuevo', texto: '   ' }, usuario)).rejects.toMatchObject({ response: { codigo: 'TEXTO_VACIO' } });
    await expect(service.crear({ titulo: 'Nuevo', texto: 'a'.repeat(MAX_TEXTO_PLANTILLA + 1) }, usuario)).rejects.toMatchObject({ response: { codigo: 'TEXTO_LARGO' } });
    await expect(service.crear({ titulo: 'Nuevo', texto: 'ok', categoria: 'RARA' }, usuario)).rejects.toMatchObject({ response: { codigo: 'CATEGORIA_INVALIDA' } });
    await expect(service.crear({ titulo: 'a', texto: 'ok' }, usuario)).rejects.toMatchObject({ response: { codigo: 'TITULO_INVALIDO' } });
    expect(prisma.respuestaRapida.create).not.toHaveBeenCalled();
  });

  it('edita, pausa y borra con auditoría; editar el propio título no choca', async () => {
    await service.editar('1', { titulo: 'saludo', texto: 'Hola de nuevo' }, usuario);
    expect(filas[0].texto).toBe('Hola de nuevo');
    await service.editar('1', { activo: false }, usuario);
    expect(filas[0].activo).toBe(false);
    expect(auditoria.registrar).toHaveBeenLastCalledWith(expect.objectContaining({ accion: 'PLANTILLA_PAUSAR' }));
    await service.borrar('1', usuario);
    expect(filas).toHaveLength(0);
    expect(auditoria.registrar).toHaveBeenLastCalledWith(expect.objectContaining({ accion: 'PLANTILLA_BORRAR' }));
    await expect(service.borrar('1', usuario)).rejects.toMatchObject({ response: { codigo: 'PLANTILLA_NO_ENCONTRADA' } });
  });

  it('duplica pausada con título «(copia)»', async () => {
    const c = await service.duplicar('1', usuario);
    expect(c).toMatchObject({ titulo: 'Saludo (copia)', activo: false, texto: 'Hola' });
    const c2 = await service.duplicar('1', usuario);
    expect(c2.titulo).toBe('Saludo (copia) 2');
  });

  it('ordena y rechaza ids que no existen', async () => {
    filas.push({ id: 2n, titulo: 'B', texto: 'b', activo: true, categoria: null, orden: 20 });
    await service.ordenar(['2'], usuario);
    expect(prisma.respuestaRapida.update).toHaveBeenCalledWith({ where: { id: 2n }, data: { orden: 10 } });
    expect(prisma.respuestaRapida.update).toHaveBeenCalledWith({ where: { id: 1n }, data: { orden: 20 } });
    await expect(service.ordenar(['99'], usuario)).rejects.toMatchObject({ response: { codigo: 'ORDEN_INVALIDO' } });
  });

  it('listarTodas incluye pausadas y categoría por defecto OTROS', async () => {
    filas.push({ id: 2n, titulo: 'B', texto: 'b', activo: false, categoria: null, orden: 20 });
    const l = await service.listarTodas();
    expect(l.map((x) => [x.titulo, x.categoria, x.activo])).toEqual([['Saludo', 'SALUDO', true], ['B', 'OTROS', false]]);
  });

  it('contexto sale de la configuración: medios activos, horario agrupado y primer nombre', async () => {
    const c = await service.contexto(usuario);
    expect(c.local).toBe('Café Prueba');
    expect(c.direccion).toBe('Calle Falsa 123');
    expect(c.mi_nombre).toBe('Lucía');
    expect(c.yape).toBe('• Número: 900000001\n• Titular: Titular Prueba');
    expect(c.plin).toBe('');
    expect(c.medios_pago).toContain('Yape');
    expect(c.medios_pago).toContain('Efectivo');
    expect(c.medios_pago).not.toContain('Plin');
    expect(c.horario).toBe('• Lunes a Martes: 14:00 - 22:00\n• Miércoles: Cerrado');
  });

  it('limpiarTextoPlantilla quita controles y compacta líneas en blanco', () => {
    expect(limpiarTextoPlantilla('a \n\n\n\nb\u0000')).toBe('a\n\nb');
  });

  it('permisos: ver/usar con mensajes/ver; gestionar con mensajes/enviar', () => {
    const r = new Reflector();
    const p = (m: keyof MensajesController) => r.get(CLAVE_PERMISO, MensajesController.prototype[m] as any);
    expect(p('plantillasContexto')).toEqual({ modulo: 'mensajes', accion: 'ver' });
    for (const m of ['plantillasGestion', 'plantillaCrear', 'plantillaEditar', 'plantillaBorrar', 'plantillaDuplicar', 'plantillasOrden'] as const) {
      expect(p(m)).toEqual({ modulo: 'mensajes', accion: 'enviar' });
    }
  });
});
