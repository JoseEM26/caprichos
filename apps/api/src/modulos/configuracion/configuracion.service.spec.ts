import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfiguracionService, CLAVES_SI_NO, CLAVES_PERMITIDAS } from './configuracion.service';
import { leerTarifaCulqi, comisionEstimada } from '../pagos-online/comision-pasarela';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';

describe('ConfiguracionService', () => {
  let service: ConfiguracionService;
  let prismaMock: any;
  let auditoriaMock: any;

  const adminAuth: UsuarioAutenticado = {
    partyId: 1n,
    rol: 'ADMIN',
    debeCambiar: false,
  };

  beforeEach(async () => {
    prismaMock = {
      parametro: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
    };

    auditoriaMock = {
      registrar: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConfiguracionService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditoriaService, useValue: auditoriaMock },
      ],
    }).compile();

    service = module.get<ConfiguracionService>(ConfiguracionService);
  });

  describe('listar', () => {
    it('lista los parámetros existentes', async () => {
      prismaMock.parametro.findMany.mockResolvedValue([
        { clave: 'tiempo_prometido_min', valor: 35 },
        { clave: 'pedido_minimo', valor: 25 },
      ]);

      const res = await service.listar();

      expect(res).toHaveLength(6);
      expect(res[0]).toEqual({ clave: 'tiempo_prometido_min', valor: 35 });
      expect(res[1]).toEqual({ clave: 'pedido_minimo', valor: 25 });
    });

    it('incluye las 4 tarifas de Culqi con valor null cuando no tienen fila, sin duplicar las que sí existen', async () => {
      prismaMock.parametro.findMany.mockResolvedValue([{ clave: 'culqi_comision_yape_pct', valor: 3.5 }]);

      const res = await service.listar();
      const culqi = res.filter((p) => p.clave.startsWith('culqi_comision_'));

      expect(culqi).toHaveLength(4);
      expect(culqi.find((p) => p.clave === 'culqi_comision_yape_pct')).toEqual({ clave: 'culqi_comision_yape_pct', valor: 3.5 });
      expect(culqi.find((p) => p.clave === 'culqi_comision_tarjeta_pct')).toEqual({ clave: 'culqi_comision_tarjeta_pct', valor: null });
      expect(culqi.find((p) => p.clave === 'culqi_comision_tarjeta_fijo')).toEqual({ clave: 'culqi_comision_tarjeta_fijo', valor: null });
      expect(culqi.find((p) => p.clave === 'culqi_comision_yape_fijo')).toEqual({ clave: 'culqi_comision_yape_fijo', valor: null });
    });

    it('la tarifa de Culqi guardada (3.99) crea la fila y leerTarifaCulqi ya la usa para estimar la comisión', async () => {
      const tabla = new Map<string, number>();
      prismaMock.parametro.findMany.mockImplementation(async () =>
        [...tabla.entries()].map(([clave, valor]) => ({ clave, valor })),
      );
      prismaMock.parametro.findUnique.mockImplementation(async ({ where }: any) =>
        tabla.has(where.clave) ? { clave: where.clave, valor: tabla.get(where.clave) } : null,
      );
      prismaMock.parametro.upsert.mockImplementation(async (a: any) => {
        tabla.set(a.where.clave, a.update.valor);
        return { clave: a.where.clave, valor: a.update.valor };
      });

      expect(await leerTarifaCulqi(prismaMock, 'TARJETA')).toBeNull();
      await service.actualizar('culqi_comision_tarjeta_pct', 3.99, adminAuth);
      await service.actualizar('culqi_comision_tarjeta_fijo', 0.5, adminAuth);
      expect(prismaMock.parametro.upsert).toHaveBeenCalledWith({
        where: { clave: 'culqi_comision_tarjeta_pct' },
        update: { valor: 3.99 },
        create: { clave: 'culqi_comision_tarjeta_pct', valor: 3.99 },
      });
      expect(await leerTarifaCulqi(prismaMock, 'TARJETA')).toEqual({ pct: 3.99, fijo: 0.5 });
      expect(comisionEstimada(100, await leerTarifaCulqi(prismaMock, 'TARJETA'))?.total).toBe(4.49);
      const listado = await service.listar();
      expect(listado.find((p) => p.clave === 'culqi_comision_tarjeta_pct')).toEqual({ clave: 'culqi_comision_tarjeta_pct', valor: 3.99 });
    });

    it('tarifas de Culqi: rechaza vacío (null) y texto como número inválido, y fuera de rango con mensaje claro', async () => {
      prismaMock.parametro.findUnique.mockResolvedValue(null);
      await expect(service.actualizar('culqi_comision_tarjeta_pct', null, adminAuth)).rejects.toMatchObject({
        response: { codigo: 'VALOR_INVALIDO', mensaje: 'El valor debe ser un número mayor o igual a 0' },
      });
      await expect(service.actualizar('culqi_comision_yape_pct', '3.5', adminAuth)).rejects.toMatchObject({ response: { codigo: 'VALOR_INVALIDO' } });
      await expect(service.actualizar('culqi_comision_yape_pct', 21, adminAuth)).rejects.toMatchObject({ response: { codigo: 'RANGO_INVALIDO' } });
      await expect(service.actualizar('culqi_comision_tarjeta_fijo', 10.5, adminAuth)).rejects.toMatchObject({
        response: { codigo: 'RANGO_INVALIDO', mensaje: 'El monto fijo debe estar entre 0 y 10 soles' },
      });
      expect(prismaMock.parametro.upsert).not.toHaveBeenCalled();
    });
  });

  describe('actualizar', () => {
    it('actualiza un parámetro válido con upsert y audita CAMBIO/PARAMETRO con antes y después', async () => {
      prismaMock.parametro.findUnique.mockResolvedValue({
        clave: 'envio_gratis_monto',
        valor: 50,
      });

      prismaMock.parametro.upsert.mockResolvedValue({
        clave: 'envio_gratis_monto',
        valor: 60,
      });

      const res = await service.actualizar(
        'envio_gratis_monto',
        60,
        adminAuth,
        '10.0.0.5',
      );

      expect(res).toEqual({ clave: 'envio_gratis_monto', valor: 60 });
      expect(prismaMock.parametro.upsert).toHaveBeenCalledWith({
        where: { clave: 'envio_gratis_monto' },
        update: { valor: 60 },
        create: { clave: 'envio_gratis_monto', valor: 60 },
      });

      expect(auditoriaMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          categoria: 'CAMBIO',
          modulo: 'configuracion',
          accion: 'PARAMETRO',
          resultado: 'OK',
          entidad: 'parametro',
          antes: { clave: 'envio_gratis_monto', valor: 50 },
          despues: { clave: 'envio_gratis_monto', valor: 60 },
          partyId: 1n,
          ip: '10.0.0.5',
        }),
      );
    });

    it('parámetro desconocido → rechaza con 400 CLAVE_DESCONOCIDA', async () => {
      await expect(
        service.actualizar('clave_inexistente_random', 10, adminAuth),
      ).rejects.toThrow(BadRequestException);

      try {
        await service.actualizar('clave_inexistente_random', 10, adminAuth);
      } catch (err: any) {
        expect(err.getResponse()).toEqual(
          expect.objectContaining({
            codigo: 'CLAVE_DESCONOCIDA',
          }),
        );
      }
    });

    it('valor no numérico o negativo para clave numérica → rechaza con 400 VALOR_INVALIDO', async () => {
      await expect(
        service.actualizar('pedido_minimo', -10, adminAuth),
      ).rejects.toThrow(BadRequestException);

      try {
        await service.actualizar('pedido_minimo', -10, adminAuth);
      } catch (err: any) {
        expect(err.getResponse()).toEqual(
          expect.objectContaining({
            codigo: 'VALOR_INVALIDO',
          }),
        );
      }

      await expect(
        service.actualizar('pedido_minimo', NaN, adminAuth),
      ).rejects.toThrow(BadRequestException);
    });

    it('propina_activa: el interruptor es por canal (carta y bot, booleanos); otra forma se rechaza', async () => {
      prismaMock.parametro.findUnique.mockResolvedValue(null);
      prismaMock.parametro.upsert.mockResolvedValue({ clave: 'propina_activa', valor: { carta: true, bot: false } });

      await service.actualizar('propina_activa', { carta: true, bot: false, extra: 'x' }, adminAuth);
      expect(prismaMock.parametro.upsert.mock.calls[0][0].create.valor).toEqual({ carta: true, bot: false, mozo: true, caja: true });

      await service.actualizar('propina_activa', { carta: false, bot: false, mozo: false, caja: true }, adminAuth);
      expect(prismaMock.parametro.upsert.mock.calls[1][0].create.valor).toEqual({ carta: false, bot: false, mozo: false, caja: true });
      await expect(service.actualizar('propina_activa', { carta: true, bot: false, mozo: 'si' }, adminAuth)).rejects.toMatchObject({
        response: { codigo: 'VALOR_INVALIDO' },
      });

      await expect(service.actualizar('propina_activa', { carta: 'si', bot: false }, adminAuth)).rejects.toMatchObject({
        response: { codigo: 'VALOR_INVALIDO' },
      });
      await expect(service.actualizar('propina_activa', true, adminAuth)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('medios_pago_canal: solo ADMIN, se guarda completo, rechaza formas raras y no deja Caja sin medios; queda auditado', async () => {
      prismaMock.parametro.findUnique.mockResolvedValue(null);
      prismaMock.parametro.upsert.mockResolvedValue({ clave: 'medios_pago_canal', valor: {} });

      await expect(service.actualizar('medios_pago_canal', { CARTA: { PLIN: false } }, { ...adminAuth, rol: 'SUPERVISOR' } as any)).rejects.toMatchObject({ response: { codigo: 'SOLO_ADMIN' } });
      await expect(service.actualizar('medios_pago_canal', { CARTA: { PLIN: 'no' } }, adminAuth)).rejects.toMatchObject({ response: { codigo: 'VALOR_INVALIDO' } });
      await expect(service.actualizar('medios_pago_canal', { CARTA: { BITCOIN: true } }, adminAuth)).rejects.toMatchObject({ response: { codigo: 'VALOR_INVALIDO' } });
      const todoApagado = { EFECTIVO: false, YAPE: false, PLIN: false, TARJETA: false, TRANSFERENCIA: false, PAGO_EN_LINEA: false };
      await expect(service.actualizar('medios_pago_canal', { CAJA: todoApagado }, adminAuth)).rejects.toMatchObject({ response: { codigo: 'CAJA_SIN_MEDIOS' } });
      expect(prismaMock.parametro.upsert).not.toHaveBeenCalled();

      // En los otros canales sí se puede apagar todo
      await service.actualizar('medios_pago_canal', { CARTA: todoApagado, BOT: { PLIN: false } }, adminAuth);
      const guardado = prismaMock.parametro.upsert.mock.calls[0][0].create.valor;
      expect(guardado.CARTA).toEqual(todoApagado);
      expect(guardado.BOT.PLIN).toBe(false);
      expect(guardado.BOT.YAPE).toBe(true);
      expect(guardado.CAJA.EFECTIVO).toBe(true);
      // Pago en línea solo vive en la carta: en Caja/Mozo/WhatsApp se guarda apagado aunque venga true
      await service.actualizar('medios_pago_canal', { CAJA: { PAGO_EN_LINEA: true }, MOZO: { PAGO_EN_LINEA: true }, BOT: { PAGO_EN_LINEA: true }, CARTA: { PAGO_EN_LINEA: true } }, adminAuth);
      const conLinea = prismaMock.parametro.upsert.mock.calls.at(-1)[0].create.valor;
      expect(conLinea.CARTA.PAGO_EN_LINEA).toBe(true);
      expect(conLinea.CAJA.PAGO_EN_LINEA).toBe(false);
      expect(conLinea.MOZO.PAGO_EN_LINEA).toBe(false);
      expect(conLinea.BOT.PAGO_EN_LINEA).toBe(false);
      expect(auditoriaMock.registrar).toHaveBeenCalledWith(expect.objectContaining({ modulo: 'configuracion', accion: 'PARAMETRO', despues: expect.objectContaining({ clave: 'medios_pago_canal' }) }));
    });

    it('medios_pago_presentacion: solo ADMIN, valida medios/orden/tamaño/insignia, se guarda completo y saneado; queda auditado', async () => {
      prismaMock.parametro.findUnique.mockResolvedValue(null);
      prismaMock.parametro.upsert.mockResolvedValue({ clave: 'medios_pago_presentacion', valor: {} });
      const ok = { YAPE: { orden: 1, tamano: 'grande', insignia: 'Nuevo' } };

      await expect(service.actualizar('medios_pago_presentacion', ok, { ...adminAuth, rol: 'SUPERVISOR' } as any)).rejects.toMatchObject({ response: { codigo: 'SOLO_ADMIN' } });
      for (const malo of [
        { BITCOIN: { orden: 1, tamano: 'normal', insignia: null } },
        { YAPE: { orden: 1.5, tamano: 'normal', insignia: null } },
        { YAPE: { orden: 1, tamano: 'enorme', insignia: null } },
        { YAPE: { orden: 1, tamano: 'normal', insignia: 'x'.repeat(15) } },
        { YAPE: { orden: 1, tamano: 'normal', insignia: '<b>Hola</b>' } },
        { YAPE: 'grande' },
      ]) {
        await expect(service.actualizar('medios_pago_presentacion', malo, adminAuth)).rejects.toMatchObject({ response: { codigo: 'VALOR_INVALIDO' } });
      }
      expect(prismaMock.parametro.upsert).not.toHaveBeenCalled();

      await service.actualizar('medios_pago_presentacion', ok, adminAuth);
      const guardado = prismaMock.parametro.upsert.mock.calls[0][0].create.valor;
      expect(guardado.YAPE).toEqual({ orden: 1, tamano: 'grande', insignia: 'Nuevo' });
      expect(guardado.CULQI).toEqual({ orden: 6, tamano: 'normal', insignia: null });
      expect(auditoriaMock.registrar).toHaveBeenCalledWith(expect.objectContaining({ modulo: 'configuracion', accion: 'PARAMETRO', despues: expect.objectContaining({ clave: 'medios_pago_presentacion' }) }));
    });

    it('propina_tope: entre S/ 1 y S/ 1000', async () => {
      prismaMock.parametro.findUnique.mockResolvedValue(null);
      prismaMock.parametro.upsert.mockResolvedValue({ clave: 'propina_tope', valor: 50 });

      await expect(service.actualizar('propina_tope', 0, adminAuth)).rejects.toMatchObject({ response: { codigo: 'VALOR_INVALIDO' } });
      await expect(service.actualizar('propina_tope', 1001, adminAuth)).rejects.toMatchObject({ response: { codigo: 'VALOR_INVALIDO' } });
      await service.actualizar('propina_tope', 50, adminAuth);
      expect(prismaMock.parametro.upsert).toHaveBeenCalled();
    });

    it('caja_monto_inicial: solo ADMIN, de 0 a 5000 con máximo dos decimales', async () => {
      prismaMock.parametro.findUnique.mockResolvedValue(null);
      prismaMock.parametro.upsert.mockResolvedValue({ clave: 'caja_monto_inicial', valor: 150.5 });

      await expect(service.actualizar('caja_monto_inicial', 100, { ...adminAuth, rol: 'SUPERVISOR' } as any)).rejects.toMatchObject({ response: { codigo: 'SOLO_ADMIN' } });
      await expect(service.actualizar('caja_monto_inicial', 100)).rejects.toMatchObject({ response: { codigo: 'SOLO_ADMIN' } });
      await expect(service.actualizar('caja_monto_inicial', -1, adminAuth)).rejects.toMatchObject({ response: { codigo: 'VALOR_INVALIDO' } });
      await expect(service.actualizar('caja_monto_inicial', 5001, adminAuth)).rejects.toMatchObject({ response: { codigo: 'VALOR_INVALIDO' } });
      await expect(service.actualizar('caja_monto_inicial', 10.123, adminAuth)).rejects.toMatchObject({ response: { codigo: 'VALOR_INVALIDO' } });
      await service.actualizar('caja_monto_inicial', 150.5, adminAuth);
      expect(prismaMock.parametro.upsert).toHaveBeenCalled();
    });

    it('avisos por correo programados: solo ADMIN, rangos validados e interruptores si/no', async () => {
      prismaMock.parametro.findUnique.mockResolvedValue(null);
      prismaMock.parametro.upsert.mockImplementation(async ({ create }: any) => create);
      const supervisor = { ...adminAuth, rol: 'SUPERVISOR' } as any;
      await expect(service.actualizar('aviso_chat_sin_responder_min', 15, supervisor)).rejects.toMatchObject({ response: { codigo: 'SOLO_ADMIN' } });
      await expect(service.actualizar('aviso_pc_impresion_activo', 'no', supervisor)).rejects.toMatchObject({ response: { codigo: 'SOLO_ADMIN' } });
      await expect(service.actualizar('aviso_chat_sin_responder_min', 4, adminAuth)).rejects.toMatchObject({ response: { codigo: 'RANGO_INVALIDO' } });
      await expect(service.actualizar('aviso_chat_sin_responder_min', 121, adminAuth)).rejects.toMatchObject({ response: { codigo: 'RANGO_INVALIDO' } });
      await expect(service.actualizar('aviso_chat_sin_responder_min', 7.5, adminAuth)).rejects.toMatchObject({ response: { codigo: 'RANGO_INVALIDO' } });
      await expect(service.actualizar('aviso_pc_impresion_minutos_tras_abrir', 4, adminAuth)).rejects.toMatchObject({ response: { codigo: 'RANGO_INVALIDO' } });
      await expect(service.actualizar('aviso_pc_impresion_recordatorio_min', 14, adminAuth)).rejects.toMatchObject({ response: { codigo: 'RANGO_INVALIDO' } });
      await expect(service.actualizar('aviso_pc_impresion_recordatorio_min', 241, adminAuth)).rejects.toMatchObject({ response: { codigo: 'RANGO_INVALIDO' } });
      await expect(service.actualizar('aviso_pc_impresion_activo', 'quizás', adminAuth)).rejects.toMatchObject({ response: { codigo: 'VALOR_INVALIDO' } });
      await service.actualizar('aviso_chat_sin_responder_min', 15, adminAuth);
      await service.actualizar('aviso_pc_impresion_minutos_tras_abrir', 20, adminAuth);
      await service.actualizar('aviso_pc_impresion_recordatorio_min', 60, adminAuth);
      await service.actualizar('aviso_chat_sin_responder_activo', false, adminAuth);
      expect(prismaMock.parametro.upsert).toHaveBeenCalledTimes(4);
    });

    it('cumpleanos_banner_equipo: solo ADMIN y solo si/no', async () => {
      prismaMock.parametro.findUnique.mockResolvedValue(null);
      prismaMock.parametro.upsert.mockImplementation(async ({ create }: any) => create);
      const supervisor = { ...adminAuth, rol: 'SUPERVISOR' } as any;
      await expect(service.actualizar('cumpleanos_banner_equipo', 'no', supervisor)).rejects.toMatchObject({ response: { codigo: 'SOLO_ADMIN' } });
      await expect(service.actualizar('cumpleanos_banner_equipo', 'tal vez', adminAuth)).rejects.toMatchObject({ response: { codigo: 'VALOR_INVALIDO' } });
      const r: any = await service.actualizar('cumpleanos_banner_equipo', false, adminAuth);
      expect(prismaMock.parametro.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ clave: 'cumpleanos_banner_equipo', valor: 'no' }) }));
      expect(r).toBeDefined();
    });

    it('avisos de stock: 0–20 enteros, 0 desactiva y la franja nunca pasa del aviso', async () => {
      prismaMock.parametro.upsert.mockImplementation(async ({ create }: any) => create);
      prismaMock.parametro.findUnique.mockResolvedValue(null); // el otro vale su defecto (5 y 3)
      await expect(service.actualizar('aviso_stock_quedan_desde', 21, adminAuth)).rejects.toMatchObject({ response: { codigo: 'RANGO_INVALIDO' } });
      await expect(service.actualizar('aviso_stock_quedan_desde', 2.5, adminAuth)).rejects.toMatchObject({ response: { codigo: 'RANGO_INVALIDO' } });
      await expect(service.actualizar('aviso_stock_ultimas_desde', -1, adminAuth)).rejects.toMatchObject({ response: { codigo: 'VALOR_INVALIDO' } });
      // franja 6 > aviso por defecto 5
      await expect(service.actualizar('aviso_stock_ultimas_desde', 6, adminAuth)).rejects.toMatchObject({ response: { codigo: 'RANGO_INVALIDO' } });
      // aviso 2 < franja por defecto 3
      await expect(service.actualizar('aviso_stock_quedan_desde', 2, adminAuth)).rejects.toMatchObject({ response: { codigo: 'RANGO_INVALIDO' } });
      expect(prismaMock.parametro.upsert).not.toHaveBeenCalled();

      expect((await service.actualizar('aviso_stock_quedan_desde', 8, adminAuth)).valor).toBe(8);
      expect((await service.actualizar('aviso_stock_ultimas_desde', 0, adminAuth)).valor).toBe(0);
      prismaMock.parametro.findUnique.mockResolvedValue({ valor: 0 });
      expect((await service.actualizar('aviso_stock_quedan_desde', 0, adminAuth)).valor).toBe(0);
      expect(auditoriaMock.registrar).toHaveBeenCalled();
    });

    it('valor no texto para clave de texto → rechaza con 400 VALOR_INVALIDO', async () => {
      await expect(
        service.actualizar('envio_gratis_modo', 123, adminAuth),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.actualizar('envio_gratis_modo', '   ', adminAuth),
      ).rejects.toThrow(BadRequestException);
    });

    it('valida que chatbot_activo acepte solo "si" o "no"', async () => {
      prismaMock.parametro.findUnique.mockResolvedValueOnce({ clave: 'chatbot_activo', valor: 'no' });
      prismaMock.parametro.upsert.mockResolvedValueOnce({ clave: 'chatbot_activo', valor: 'si' });

      const res = await service.actualizar('chatbot_activo', 'si', adminAuth);
      expect(res.valor).toBe('si');

      await expect(
        service.actualizar('chatbot_activo', 'invalido', adminAuth),
      ).rejects.toThrow(BadRequestException);
    });

    it('permite todas las claves válidas especificadas', async () => {
      const clavesNumericas = [
        'tiempo_prometido_min',
        'tiempo_max_min',
        'envio_gratis_monto',
        'pedido_minimo',
        'tolerancia_reserva_min',
        'puntos_porcentaje',
        'descuento_personal_pct',
        'rep_naranja_min',
        'rep_rojo_min',
        'rep_max_pedidos',
      ];

      for (const clave of clavesNumericas) {
        prismaMock.parametro.findUnique.mockResolvedValue(null);
        prismaMock.parametro.upsert.mockResolvedValue({ clave, valor: 5 });

        const res = await service.actualizar(clave, 5, adminAuth);
        expect(res.clave).toBe(clave);
      }

      prismaMock.parametro.findUnique.mockResolvedValue(null);
      prismaMock.parametro.upsert.mockResolvedValue({
        clave: 'envio_gratis_modo',
        valor: 'MONTO',
      });
      const resModo = await service.actualizar('envio_gratis_modo', 'MONTO', adminAuth);
      expect(resModo.valor).toBe('MONTO');

      prismaMock.parametro.findUnique.mockResolvedValue(null);
      prismaMock.parametro.upsert.mockResolvedValue({
        clave: 'carta_aviso_entrada',
        valor: 'si',
      });
      const resAviso = await service.actualizar('carta_aviso_entrada', true, adminAuth);
      expect(resAviso.valor).toBe('si');

      await expect(
        service.actualizar('carta_aviso_entrada', 'quizas', adminAuth),
      ).rejects.toThrow(BadRequestException);
    });

    it('cocina_confirmar_despejar: guarda si/no (true -> si, false -> no) y rechaza otros valores', async () => {
      prismaMock.parametro.findUnique.mockResolvedValue(null);
      prismaMock.parametro.upsert.mockResolvedValue({ clave: 'cocina_confirmar_despejar', valor: 'no' });
      const res = await service.actualizar('cocina_confirmar_despejar', false, adminAuth);
      expect(res.valor).toBe('no');
      expect(prismaMock.parametro.upsert.mock.calls[0][0].update.valor).toBe('no');

      await expect(
        service.actualizar('cocina_confirmar_despejar', 'quizas', adminAuth),
      ).rejects.toThrow(BadRequestException);
    });

    it('impresion_prioridad: acepta TICKETS_PRIMERO y ORDEN_LLEGADA (normaliza) y rechaza otros valores', async () => {
      prismaMock.parametro.findUnique.mockResolvedValue(null);
      prismaMock.parametro.upsert.mockImplementation(async ({ create }: any) => create);
      const res = await service.actualizar('impresion_prioridad', ' orden_llegada ', adminAuth);
      expect(res.valor).toBe('ORDEN_LLEGADA');
      expect((await service.actualizar('impresion_prioridad', 'TICKETS_PRIMERO', adminAuth)).valor).toBe('TICKETS_PRIMERO');
      await expect(service.actualizar('impresion_prioridad', 'AL_AZAR', adminAuth)).rejects.toThrow(BadRequestException);
    });

    it('protección contra spam: acepta valores en rango y rechaza con 400 los de fuera', async () => {
      prismaMock.parametro.findUnique.mockResolvedValue(null);
      prismaMock.parametro.upsert.mockImplementation(async ({ create }: any) => create);
      const casos: Array<[string, number, number, number]> = [
        ['spam_bloqueo_excesos', 1, 20, 3],
        ['spam_bloqueo_min', 5, 1440, 60],
        ['spam_bloqueo_reincidente_min', 60, 10080, 1440],
        ['whatsapp_max_pedidos_sin_pagar', 1, 10, 3],
        ['chatbot_antispam_max_minuto', 3, 60, 10],
        ['chatbot_antispam_max_hora', 10, 600, 60],
      ];
      for (const [clave, min, max, ok] of casos) {
        await expect(service.actualizar(clave, ok, adminAuth)).resolves.toMatchObject({ clave });
        await expect(service.actualizar(clave, min, adminAuth)).resolves.toMatchObject({ clave });
        await expect(service.actualizar(clave, max, adminAuth)).resolves.toMatchObject({ clave });
        await expect(service.actualizar(clave, min - 1, adminAuth)).rejects.toMatchObject({ response: { codigo: 'RANGO_INVALIDO' } });
        await expect(service.actualizar(clave, max + 1, adminAuth)).rejects.toThrow(BadRequestException);
        await expect(service.actualizar(clave, ok + 0.5, adminAuth)).rejects.toThrow(BadRequestException);
      }
      expect(auditoriaMock.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'PARAMETRO' }));
    });

    it('valida rangos y orden ascendente en parámetros de reparto', async () => {
      prismaMock.parametro.findMany.mockResolvedValue([
        { clave: 'reparto_retrasado_min', valor: 20 },
        { clave: 'reparto_tarde_min', valor: 30 },
        { clave: 'reparto_muy_tarde_min', valor: 45 },
      ]);
      prismaMock.parametro.findUnique.mockResolvedValue(null);
      prismaMock.parametro.upsert.mockResolvedValue({ clave: 'reparto_retrasado_min', valor: 22 });

      const res = await service.actualizar('reparto_retrasado_min', 22, adminAuth);
      expect(res.clave).toBe('reparto_retrasado_min');

      // Violación de orden ascendente (retrasado >= tarde)
      await expect(
        service.actualizar('reparto_retrasado_min', 35, adminAuth),
      ).rejects.toThrow(BadRequestException);

      // Violación de rango
      await expect(
        service.actualizar('reparto_velocidad_kmh', 2, adminAuth),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('lectura de vouchers con IA', () => {
    it('permite guardar voucher_ia_activo (true -> «si») y los datos de las cuentas', async () => {
      prismaMock.parametro.findUnique.mockResolvedValue(null);
      prismaMock.parametro.upsert.mockResolvedValue({ clave: 'voucher_ia_activo', valor: 'si' });
      await service.actualizar('voucher_ia_activo', true, adminAuth);
      expect(prismaMock.parametro.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { clave: 'voucher_ia_activo' }, update: { valor: 'si' } }),
      );
      for (const clave of ['voucher_titular_nombre', 'voucher_yape_numero', 'voucher_plin_numero']) {
        await expect(service.actualizar(clave, '977503006', adminAuth)).resolves.toBeDefined();
      }
    });
  });

  describe('avisos: sonido y «Marcar todas leídas»', () => {
    beforeEach(() => {
      prismaMock.parametro.findUnique.mockResolvedValue(null);
      prismaMock.parametro.upsert.mockImplementation(async ({ create }: any) => create);
    });

    it('el intervalo del sonido acepta 5..600 segundos enteros (15, 30, 60 y otros)', async () => {
      for (const v of [5, 15, 37, 600]) {
        await expect(service.actualizar('notif_sonido_intervalo_seg', v, adminAuth)).resolves.toEqual({
          clave: 'notif_sonido_intervalo_seg',
          valor: v,
        });
      }
    });

    it.each([4, 601, 10.5, 0])('el intervalo %s fuera de 5..600 o no entero → 400', async (v) => {
      await expect(service.actualizar('notif_sonido_intervalo_seg', v, adminAuth)).rejects.toBeInstanceOf(BadRequestException);
      expect(prismaMock.parametro.upsert).not.toHaveBeenCalled();
    });

    it('el alcance solo acepta TODOS_NO_LEIDOS, SOLO_URGENTES o SOLO_HOY', async () => {
      await expect(service.actualizar('notif_sonido_alcance', 'solo_urgentes', adminAuth)).resolves.toMatchObject({
        valor: 'SOLO_URGENTES',
      });
      await expect(service.actualizar('notif_sonido_alcance', 'TODOS', adminAuth)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('los interruptores se guardan como si/no y se auditan', async () => {
      await expect(service.actualizar('notif_marcar_todas_activo', false, adminAuth)).resolves.toMatchObject({ valor: 'no' });
      await expect(service.actualizar('notif_sonido_activo', 'si', adminAuth)).resolves.toMatchObject({ valor: 'si' });
      expect(auditoriaMock.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'PARAMETRO' }));
    });
  });

  describe('verificación del celular por WhatsApp', () => {
    beforeEach(() => {
      prismaMock.parametro.findUnique.mockResolvedValue(null);
      prismaMock.parametro.upsert.mockResolvedValue({ clave: 'x', valor: 'y' });
    });

    it('el modo acepta WHATSAPP_ENTRANTE o CODIGO_PLANTILLA y rechaza cualquier otro valor', async () => {
      await service.actualizar('verificacion_celular_modo', 'whatsapp_entrante', adminAuth);
      expect(prismaMock.parametro.upsert.mock.calls.at(-1)[0].update.valor).toBe('WHATSAPP_ENTRANTE');
      await service.actualizar('verificacion_celular_modo', 'CODIGO_PLANTILLA', adminAuth);
      expect(prismaMock.parametro.upsert.mock.calls.at(-1)[0].update.valor).toBe('CODIGO_PLANTILLA');
      await expect(service.actualizar('verificacion_celular_modo', 'SMS', adminAuth)).rejects.toThrow(BadRequestException);
    });

    it('el número guarda solo dígitos con código de país; vacío significa usar el WhatsApp de contacto', async () => {
      await service.actualizar('verificacion_whatsapp_numero', '914 244 077', adminAuth);
      expect(prismaMock.parametro.upsert.mock.calls.at(-1)[0].update.valor).toBe('51914244077');
      await service.actualizar('verificacion_whatsapp_numero', '', adminAuth);
      expect(prismaMock.parametro.upsert.mock.calls.at(-1)[0].update.valor).toBe('');
      await expect(service.actualizar('verificacion_whatsapp_numero', '12345', adminAuth)).rejects.toThrow(BadRequestException);
    });
  });

  describe('actualizarPausaAltaDemanda', () => {
    it('activa la pausa por alta demanda y audita', async () => {
      prismaMock.parametro.findUnique.mockResolvedValue({
        clave: 'pausa_alta_demanda',
        valor: { activa: false, motivo: null },
      });

      prismaMock.parametro.upsert.mockResolvedValue({
        clave: 'pausa_alta_demanda',
        valor: { activa: true, motivo: 'Demasiados pedidos en cola' },
      });

      const res = await service.actualizarPausaAltaDemanda(
        { activa: true, motivo: 'Demasiados pedidos en cola' },
        adminAuth,
        '127.0.0.1',
      );

      expect(res.clave).toBe('pausa_alta_demanda');
      expect((res.valor as any)?.activa).toBe(true);
      expect(auditoriaMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          categoria: 'CAMBIO',
          modulo: 'configuracion',
          accion: 'PAUSA_ALTA_DEMANDA',
          despues: {
            clave: 'pausa_alta_demanda',
            valor: { activa: true, motivo: 'Demasiados pedidos en cola' },
          },
        }),
      );
    });
  });

  describe('parámetros nuevos con rango', () => {
    beforeEach(() => {
      prismaMock.parametro.findUnique.mockResolvedValue(null);
      prismaMock.parametro.upsert.mockImplementation(async ({ create }: any) => create);
    });

    it.each([
      ['eta_factor_urbano', 1.3],
      ['eta_productos_desde', 3],
      ['eta_extra_por_producto_min', 1],
      ['eta_parada_min', 3],
      ['eta_margen_min', 5],
      ['eta_paso_min', 5],
      ['eta_base_sin_zona_min', 5],
      ['reserva_tolerancia_min', 15],
      ['chatbot_ia_tope_mensual_usd', 20.5],
      ['voucher_ia_corte_min', 10],
    ])('guarda %s=%s y audita', async (clave, valor) => {
      const res = await service.actualizar(clave, valor as number, adminAuth, '1.1.1.1');
      expect(res).toEqual({ clave, valor });
      expect(auditoriaMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ accion: 'PARAMETRO', despues: { clave, valor } }),
      );
    });

    it.each([
      ['eta_factor_urbano', 0.5],
      ['eta_factor_urbano', 4],
      ['eta_productos_desde', 2.5],
      ['eta_paso_min', 0],
      ['eta_margen_min', 61],
      ['reserva_tolerancia_min', 0],
      ['reserva_tolerancia_min', 181],
      ['chatbot_ia_tope_mensual_usd', 0.5],
      ['chatbot_ia_tope_mensual_usd', 501],
      ['voucher_ia_corte_min', 0],
      ['voucher_ia_corte_min', 121],
      ['voucher_ia_corte_min', 10.5],
    ])('%s=%s fuera de rango → 400 RANGO_INVALIDO', async (clave, valor) => {
      await expect(service.actualizar(clave, valor as number, adminAuth)).rejects.toMatchObject({
        response: expect.objectContaining({ codigo: 'RANGO_INVALIDO' }),
      });
      expect(prismaMock.parametro.upsert).not.toHaveBeenCalled();
    });

    it('carta_invitado_activo acepta booleano o si/no y lo guarda como si/no; otro valor se rechaza', async () => {
      expect(await service.actualizar('carta_invitado_activo', true, adminAuth)).toEqual({ clave: 'carta_invitado_activo', valor: 'si' });
      expect(await service.actualizar('carta_invitado_activo', 'no', adminAuth)).toEqual({ clave: 'carta_invitado_activo', valor: 'no' });
      await expect(service.actualizar('carta_invitado_activo', 'quizas', adminAuth)).rejects.toThrow(BadRequestException);
    });

    it('ayuda_ia_activo acepta booleano y lo guarda como si/no', async () => {
      const res = await service.actualizar('ayuda_ia_activo', true, adminAuth);
      expect(res).toEqual({ clave: 'ayuda_ia_activo', valor: 'si' });
      await expect(service.actualizar('ayuda_ia_activo', 'quizas', adminAuth)).rejects.toThrow(BadRequestException);
    });

    it('terminos_texto y privacidad_texto se guardan recortados y no admiten vacío', async () => {
      const res = await service.actualizar('terminos_texto', '  Texto  ', adminAuth);
      expect(res.valor).toBe('Texto');
      await expect(service.actualizar('privacidad_texto', '   ', adminAuth)).rejects.toThrow(BadRequestException);
    });

    it('otras claves siguen sin permitirse', async () => {
      await expect(service.actualizar('eta_inventada_min', 5, adminAuth)).rejects.toMatchObject({
        response: expect.objectContaining({ codigo: 'CLAVE_DESCONOCIDA' }),
      });
    });
  });

  describe('interruptores Sí/No (CLAVES_SI_NO)', () => {
    it('toda clave sí/no acepta true/false/si/no y guarda «si» o «no»; rechaza otro valor', async () => {
      prismaMock.parametro.findUnique.mockResolvedValue(null);
      prismaMock.parametro.upsert.mockImplementation(async (a: any) => ({ clave: a.where.clave, valor: a.update.valor }));
      expect(CLAVES_SI_NO.length).toBeGreaterThan(40);
      for (const clave of CLAVES_SI_NO) {
        expect((await service.actualizar(clave, true, adminAuth)).valor).toBe('si');
        expect((await service.actualizar(clave, false, adminAuth)).valor).toBe('no');
        expect((await service.actualizar(clave, 'true', adminAuth)).valor).toBe('si');
        expect((await service.actualizar(clave, 'false', adminAuth)).valor).toBe('no');
        expect((await service.actualizar(clave, 'SI', adminAuth)).valor).toBe('si');
        expect((await service.actualizar(clave, 'no', adminAuth)).valor).toBe('no');
        for (const malo of ['tal vez', '', 1, null]) {
          await expect(service.actualizar(clave, malo, adminAuth)).rejects.toMatchObject({ response: { codigo: 'VALOR_INVALIDO' } });
        }
      }
    });

    it('evolution_pausado está permitido; una clave desconocida sigue rechazada', async () => {
      expect(CLAVES_PERMITIDAS).toContain('evolution_pausado');
      prismaMock.parametro.findUnique.mockResolvedValue(null);
      prismaMock.parametro.upsert.mockResolvedValue({ clave: 'evolution_pausado', valor: 'si' });
      await expect(service.actualizar('evolution_pausado', 'true', adminAuth)).resolves.toBeTruthy();
      await expect(service.actualizar('clave_inventada_activo', 'si', adminAuth)).rejects.toMatchObject({
        response: { codigo: 'CLAVE_DESCONOCIDA' },
      });
    });

    it('pago online y Evolution: rangos numéricos, enumerado y solo ADMIN para proveedor y pausa', async () => {
      prismaMock.parametro.findUnique.mockResolvedValue(null);
      prismaMock.parametro.upsert.mockImplementation(async (a: any) => ({ clave: a.where.clave, valor: a.update.valor }));
      await expect(service.actualizar('pago_online_espera_min', 15, adminAuth)).resolves.toBeTruthy();
      await expect(service.actualizar('pago_online_espera_min', 4, adminAuth)).rejects.toMatchObject({ response: { codigo: 'RANGO_INVALIDO' } });
      await expect(service.actualizar('pago_online_espera_min', 121, adminAuth)).rejects.toMatchObject({ response: { codigo: 'RANGO_INVALIDO' } });
      expect((await service.actualizar('whatsapp_proveedor', 'evolution', adminAuth)).valor).toBe('EVOLUTION');
      await expect(service.actualizar('whatsapp_proveedor', 'OTRO', adminAuth)).rejects.toMatchObject({ response: { codigo: 'VALOR_INVALIDO' } });
      const caja = { partyId: 2n, rol: 'CAJA', debeCambiar: false } as UsuarioAutenticado;
      await expect(service.actualizar('evolution_pausado', 'si', caja)).rejects.toMatchObject({ response: { codigo: 'SOLO_ADMIN' } });
      await expect(service.actualizar('evolution_horario_hasta', 25, adminAuth)).rejects.toMatchObject({ response: { codigo: 'RANGO_INVALIDO' } });
      expect((await service.actualizar('evolution_origenes_permitidos', 'aviso_pedido, encuesta', adminAuth)).valor).toBe('AVISO_PEDIDO,ENCUESTA');
      await expect(service.actualizar('evolution_origenes_permitidos', 'AVISO PEDIDO!', adminAuth)).rejects.toMatchObject({ response: { codigo: 'VALOR_INVALIDO' } });
    });
  });
});
