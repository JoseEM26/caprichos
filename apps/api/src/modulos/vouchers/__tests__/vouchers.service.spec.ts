jest.mock('../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { VouchersService } from '../vouchers.service';
import { VouchersIaService } from '../vouchers-ia.service';
import { PrismaService } from '../../../comun/prisma/prisma.service';
import { ArchivosService } from '../../archivos/archivos.service';
import { AuditoriaService } from '../../auditoria/auditoria.service';
import { EventosGateway } from '../../../comun/socket/eventos.gateway';
import { UsuarioAutenticado } from '../../acceso/acceso.tipos';
import { obtenerFechaHoraLima } from '../../local/local.util';
import { PagoPlanService } from '../../pedidos/pago-plan.service';

describe('VouchersService', () => {
  let service: VouchersService;
  let prismaMock: any;
  let archivosMock: any;
  let auditoriaMock: any;
  let vouchersIaMock: any;
  let eventosMock: any;

  const mozoUsuario: UsuarioAutenticado = {
    partyId: 101n,
    rol: 'MOZO',
    debeCambiar: false,
  };

  const cajeroUsuario: UsuarioAutenticado = {
    partyId: 102n,
    rol: 'CAJERO',
    debeCambiar: false,
  };

  const adminUsuario: UsuarioAutenticado = {
    partyId: 100n,
    rol: 'ADMIN',
    debeCambiar: false,
  };

  beforeEach(async () => {
    prismaMock = {
      parametro: {
        findMany: jest.fn().mockResolvedValue([
          { clave: 'voucher_titular_nombre', valor: 'Maria Jose Morillo Ruiz' },
          { clave: 'voucher_yape_numero', valor: '977503006' },
          { clave: 'voucher_plin_numero', valor: '977503006' },
        ]),
      },
      pedido: {
        findUnique: jest.fn().mockResolvedValue({
          id: 50n,
          codigo: 'PED-50',
          total: 35.0,
          pago_preferido: 'YAPE',
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      pedidoPagoPlan: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      $transaction: jest.fn(async (fn: any) => fn(prismaMock)),
      voucherPago: {
        create: jest.fn().mockImplementation(({ data }) => ({
          id: 1n,
          ...data,
          creado_en: new Date(),
        })),
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
      notificacion: {
        create: jest.fn().mockResolvedValue({ id: 99n, titulo: 'Voucher no legible' }),
      },
    };

    archivosMock = {
      subirArchivo: jest.fn().mockResolvedValue({ id: '900', url: '/admin/archivos/900' }),
    };

    auditoriaMock = {
      registrar: jest.fn().mockResolvedValue(undefined),
    };

    vouchersIaMock = {
      analizarVoucher: jest.fn().mockResolvedValue({
        sinLectura: false,
        extraido: {
          legible: true,
          monto: 35.0,
          moneda: 'PEN',
          operacion: '11223344',
          fecha: obtenerFechaHoraLima().fechaIso,
          hora: '12:00',
          titular: 'Maria Jose M.',
          destinoNumero: '977503006',
          medioDetectado: 'YAPE',
          confianza: 0.95,
        },
      }),
      estaParametroVoucherIaActivo: jest.fn().mockResolvedValue(true),
    };

    eventosMock = {
      emitirAdmin: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VouchersService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: ArchivosService, useValue: archivosMock },
        { provide: AuditoriaService, useValue: auditoriaMock },
        { provide: VouchersIaService, useValue: vouchersIaMock },
        { provide: PagoPlanService, useValue: new PagoPlanService() },
        { provide: EventosGateway, useValue: eventosMock },
      ],
    }).compile();

    service = module.get<VouchersService>(VouchersService);
  });

  describe('Subida de vouchers y respuesta diferenciada por rol', () => {
    const fakeFile: Express.Multer.File = {
      buffer: Buffer.from('test-voucher-image'),
      size: 100,
      mimetype: 'image/jpeg',
      originalname: 'voucher.jpg',
      fieldname: 'archivo',
      encoding: '7bit',
      stream: null as any,
      destination: '',
      filename: '',
      path: '',
    };

    it('al MOZO solo le retorna { id, legible: boolean } y NUNCA el semáforo ni los datos extraídos', async () => {
      const res = await service.subirYProcesar(
        fakeFile,
        { pedidoId: '50', medio: 'YAPE' },
        mozoUsuario,
      );

      expect(res).toHaveProperty('id', '1');
      expect(res).toHaveProperty('legible', true);
      expect((res as any).semaforo).toBeUndefined();
      expect((res as any).extraido).toBeUndefined();
      expect((res as any).motivos).toBeUndefined();
    });

    it('al MOZO marca revisionManual=true si la lectura automática no estuvo disponible (SIN_LECTURA), sin semáforo', async () => {
      vouchersIaMock.analizarVoucher.mockResolvedValueOnce({ sinLectura: true, extraido: null, motivo: 'IA apagada' });

      const res: any = await service.subirYProcesar(fakeFile, { pedidoId: '50', medio: 'YAPE' }, mozoUsuario);

      expect(res.legible).toBe(true);
      expect(res.revisionManual).toBe(true);
      expect(res.semaforo).toBeUndefined();
      expect(res.extraido).toBeUndefined();
    });

    it('al MOZO revisionManual=false cuando la IA sí leyó el voucher', async () => {
      const res: any = await service.subirYProcesar(fakeFile, { pedidoId: '50', medio: 'YAPE' }, mozoUsuario);

      expect(res.revisionManual).toBe(false);
    });

    it('al MOZO con IA apagada: sin avisos y revisionManual=true', async () => {
      vouchersIaMock.analizarVoucher.mockResolvedValueOnce({ sinLectura: true, extraido: null, motivo: 'IA apagada' });

      const res: any = await service.subirYProcesar(fakeFile, { pedidoId: '50', medio: 'YAPE' }, mozoUsuario);

      expect(res.avisos).toEqual([]);
      expect(res.revisionManual).toBe(true);
    });

    it('al MOZO avisa si el monto leído no coincide con lo que debe pagar, sin revelar el semáforo', async () => {
      vouchersIaMock.analizarVoucher.mockResolvedValueOnce({
        sinLectura: false,
        extraido: { legible: true, monto: 999.0, operacion: '55555555', medioDetectado: 'YAPE', confianza: 0.95 },
      });

      const res: any = await service.subirYProcesar(fakeFile, { pedidoId: '50', medio: 'YAPE' }, mozoUsuario);

      expect(res.avisos).toContainEqual(expect.stringMatching(/^El monto del voucher \(S\/ 999\.00\) no coincide con lo que debe pagar por Yape/));
      expect(res.legible).toBe(true);
    });

    it('al MOZO avisa si el medio del voucher no es el elegido', async () => {
      vouchersIaMock.analizarVoucher.mockResolvedValueOnce({
        sinLectura: false,
        extraido: { legible: true, monto: 35.0, operacion: '66666666', medioDetectado: 'PLIN', confianza: 0.95 },
      });

      const res: any = await service.subirYProcesar(fakeFile, { pedidoId: '50', medio: 'YAPE' }, mozoUsuario);

      expect(res.avisos).toContain('El medio del voucher (Plin) no coincide con el elegido (Yape)');
    });

    it('la respuesta del MOZO jamás trae semáforo, extraído, operación ni motivos', async () => {
      vouchersIaMock.analizarVoucher.mockResolvedValueOnce({
        sinLectura: false,
        extraido: { legible: true, monto: 999.0, operacion: '77777777', medioDetectado: 'PLIN', titular: 'Otra Persona', confianza: 0.6 },
      });

      const res: any = await service.subirYProcesar(fakeFile, { pedidoId: '50', medio: 'YAPE' }, mozoUsuario);

      expect(Object.keys(res).sort()).toEqual(expect.arrayContaining(['avisos', 'id', 'legible', 'revisionManual']));
      expect(res.semaforo).toBeUndefined();
      expect(res.extraido).toBeUndefined();
      expect(res.operacion).toBeUndefined();
      expect(res.motivos).toBeUndefined();
      expect(JSON.stringify(res)).not.toContain('77777777');
      expect(JSON.stringify(res)).not.toContain('Otra Persona');
    });

    it('al MOZO le retorna legible=false con mensaje explicativo si el voucher resulta ILEGIBLE', async () => {
      vouchersIaMock.analizarVoucher.mockResolvedValueOnce({
        sinLectura: false,
        extraido: {
          legible: false,
          monto: null,
          confianza: 0.2,
        },
      });

      const res = await service.subirYProcesar(
        fakeFile,
        { pedidoId: '50', medio: 'YAPE' },
        mozoUsuario,
      );

      expect(res.id).toBe('1');
      expect(res.legible).toBe(false);
      expect((res as any).mensaje).toBe('Este voucher no se lee bien. Vuelve a tomar la foto, por favor.');
      expect((res as any).semaforo).toBeUndefined();
    });

    it('un voucher que la IA lee pero sin monto queda ILEGIBLE: el MOZO recibe legible=false (no cuenta como comprobante)', async () => {
      vouchersIaMock.analizarVoucher.mockResolvedValueOnce({
        sinLectura: false,
        extraido: { legible: true, monto: null, confianza: 0.9 },
      });

      const res = await service.subirYProcesar(
        fakeFile,
        { pedidoId: '50', medio: 'YAPE' },
        mozoUsuario,
      );

      expect(res.legible).toBe(false);
    });

    it('al CAJERO y ADMIN les entrega la respuesta completa (id, legible, semaforo, motivos, extraido)', async () => {
      const resCajero = await service.subirYProcesar(
        fakeFile,
        { pedidoId: '50', medio: 'YAPE' },
        cajeroUsuario,
      );

      expect(resCajero.id).toBe('1');
      expect(resCajero.legible).toBe(true);
      expect(resCajero.semaforo).toBe('CONFIABLE');
      expect(resCajero.motivos).toBeDefined();
      expect(resCajero.extraido).toBeDefined();

      const resAdmin = await service.subirYProcesar(
        fakeFile,
        { pedidoId: '50', medio: 'YAPE' },
        adminUsuario,
      );
      expect(resAdmin.semaforo).toBe('CONFIABLE');
    });

    it('registra auditoría de categoría CAMBIO y módulo vouchers', async () => {
      await service.subirYProcesar(
        fakeFile,
        { pedidoId: '50', medio: 'YAPE' },
        cajeroUsuario,
        '192.168.1.50',
      );

      expect(auditoriaMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          categoria: 'CAMBIO',
          modulo: 'vouchers',
          accion: 'SUBIR',
          resultado: 'OK',
          entidad: 'voucher_pago',
          partyId: 102n,
          ip: '192.168.1.50',
        }),
      );
    });
  });

  describe('Detección de duplicados', () => {
    const fakeFile: Express.Multer.File = {
      buffer: Buffer.from('test-voucher-image'),
      size: 100,
      mimetype: 'image/jpeg',
      originalname: 'voucher.jpg',
      fieldname: 'archivo',
      encoding: '7bit',
      stream: null as any,
      destination: '',
      filename: '',
      path: '',
    };

    it('asigna semáforo RARO si la misma imagen (hash sha256) ya fue registrada en otro pedido', async () => {
      // Simular que findFirst encuentra duplicado por hash_imagen
      prismaMock.voucherPago.findFirst.mockResolvedValueOnce({ id: 999n, pedido_id: 40n });

      const res = await service.subirYProcesar(
        fakeFile,
        { pedidoId: '50', medio: 'YAPE' },
        cajeroUsuario,
      );

      expect(res.semaforo).toBe('RARO');
      expect((res as any).motivos.some((m: string) => m.includes('misma imagen'))).toBe(true);
    });

    it('asigna semáforo RARO si el número de operación ya fue usado en otro pedido', async () => {
      // Primero no hay duplicado de hash, pero sí de operación
      prismaMock.voucherPago.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 888n, pedido_id: 30n, operacion: '11223344' });

      const res = await service.subirYProcesar(
        fakeFile,
        { pedidoId: '50', medio: 'YAPE' },
        cajeroUsuario,
      );

      expect(res.semaforo).toBe('RARO');
      expect((res as any).motivos.some((m: string) => m.includes('Número de operación'))).toBe(true);
    });
  });

  describe('Webhook de WhatsApp en segundo plano', () => {
    it('procesa el voucher y emite mensajes:actualizado', async () => {
      const buffer = Buffer.from('comprobante-wa-bytes');

      await service.registrarDesdeWhatsapp(
        buffer,
        'image/jpeg',
        10n,
        { id: 50n, codigo: 'CP-W001', total: 35.0, pago_preferido: 'YAPE' },
        { id: 200n, telefono: '51987654321' },
      );

      expect(prismaMock.voucherPago.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            origen: 'WHATSAPP',
            conversacion_id: 200n,
            archivo_id: 10n,
            semaforo: 'CONFIABLE',
          }),
        }),
      );

      expect(eventosMock.emitirAdmin).toHaveBeenCalledWith('mensajes:actualizado', {
        id: '200',
      });
    });

    it('crea notificación de campana VOUCHER_ILEGIBLE para Caja si el semáforo es ILEGIBLE', async () => {
      vouchersIaMock.analizarVoucher.mockResolvedValueOnce({
        sinLectura: false,
        extraido: {
          legible: false,
          monto: null,
          confianza: 0.1,
        },
      });

      const buffer = Buffer.from('comprobante-ilegible');

      await service.registrarDesdeWhatsapp(
        buffer,
        'image/jpeg',
        11n,
        { id: 50n, codigo: 'CP-W002', total: 35.0, pago_preferido: 'YAPE' },
        { id: 201n, telefono: '51987654321' },
      );

      expect(prismaMock.notificacion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tipo: 'VOUCHER_ILEGIBLE',
            rol_destino: 'CAJERO',
            enlace: '/admin/mensajes',
          }),
        }),
      );

      expect(eventosMock.emitirAdmin).toHaveBeenCalledWith('notificaciones:nueva', expect.any(Object));
      expect(eventosMock.emitirAdmin).toHaveBeenCalledWith('mensajes:actualizado', { id: '201' });
    });
  });

  describe('Marcar revisado y listado', () => {
    it('marca un voucher como revisado y registra auditoría', async () => {
      prismaMock.voucherPago.findUnique.mockResolvedValue({ id: 5n, revisado_en: null });
      prismaMock.voucherPago.update.mockResolvedValue({
        id: 5n,
        revisado_en: new Date(),
        revisado_por: 102n,
      });

      const res = await service.marcarRevisado('5', cajeroUsuario, '10.0.0.1');

      expect(res.ok).toBe(true);
      expect(res.id).toBe('5');
      expect(prismaMock.voucherPago.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 5n },
          data: expect.objectContaining({
            revisado_por: 102n,
          }),
        }),
      );
      expect(auditoriaMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          modulo: 'vouchers',
          accion: 'REVISAR',
          partyId: 102n,
        }),
      );
    });

    it('lista vouchers filtrados por fecha y estado de revisión', async () => {
      prismaMock.voucherPago.findMany.mockResolvedValue([
        {
          id: 1n,
          pedido_id: 50n,
          conversacion_id: null,
          archivo_id: 10n,
          origen: 'MOZO',
          medio: 'YAPE',
          semaforo: 'CONFIABLE',
          motivos: ['Datos conformes'],
          revisado_en: null,
          creado_en: new Date('2026-10-27T10:00:00Z'),
          pedido: { codigo: 'PED-50', total: 35.0 },
        },
      ]);
      prismaMock.voucherPago.count.mockResolvedValue(1);

      const res = await service.listar({ fecha: '2026-10-27', estado: 'pendientes' });

      expect(res.vouchers.length).toBe(1);
      expect(res.vouchers[0].id).toBe('1');
      expect(res.faltanRevisar).toBe(1);
    });
  });

  describe('Todo voucher queda guardado (origen, sin pedido, IA sin lectura)', () => {
    const fakeFile: Express.Multer.File = {
      buffer: Buffer.from('foto-del-pago'),
      size: 100,
      mimetype: 'image/jpeg',
      originalname: 'pago.jpg',
      fieldname: 'archivo',
      encoding: '7bit',
      stream: null as any,
      destination: '',
      filename: '',
      path: '',
    };

    it('WhatsApp sin pedido asociado (p. ej. BSUID sin teléfono): guarda la fila con pedido_id null y la analiza', async () => {
      await service.registrarDesdeWhatsapp(
        Buffer.from('bytes'),
        'image/jpeg',
        11n,
        null,
        { id: 300n, telefono: 'wa-user:abc' },
      );

      expect(vouchersIaMock.analizarVoucher).toHaveBeenCalled();
      expect(prismaMock.voucherPago.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            pedido_id: null,
            conversacion_id: 300n,
            archivo_id: 11n,
            origen: 'WHATSAPP',
            semaforo: expect.any(String),
          }),
        }),
      );
    });

    it('la IA no pudo leer (SIN_LECTURA) igual deja la fila guardada', async () => {
      vouchersIaMock.analizarVoucher.mockResolvedValueOnce({ sinLectura: true, extraido: null, motivo: 'timeout' });

      await service.registrarDesdeWhatsapp(Buffer.from('bytes'), 'image/jpeg', 12n, null, { id: 301n });

      expect(prismaMock.voucherPago.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ semaforo: 'SIN_LECTURA', archivo_id: 12n, extraido: null }),
        }),
      );
    });

    it('chat que atiende una persona: el análisis corre igual', async () => {
      await service.registrarDesdeWhatsapp(
        Buffer.from('bytes'),
        'image/jpeg',
        13n,
        { id: 50n, codigo: 'PED-50', total: 35.0, pago_preferido: 'YAPE' },
        { id: 302n, telefono: '51987654321', duenio: 'PERSONA', tomado_por: 7n },
      );

      expect(vouchersIaMock.analizarVoucher).toHaveBeenCalled();
      expect(prismaMock.voucherPago.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ pedido_id: 50n, conversacion_id: 302n }) }),
      );
    });

    it('subida con pedidoId inexistente -> 404 PEDIDO_NO_ENCONTRADO y no guarda voucher huérfano', async () => {
      prismaMock.pedido.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.subirYProcesar(fakeFile, { pedidoId: '999' }, cajeroUsuario, '10.0.0.1'),
      ).rejects.toMatchObject({ response: { codigo: 'PEDIDO_NO_ENCONTRADO' } });
      expect(prismaMock.voucherPago.create).not.toHaveBeenCalled();
    });

    it('carta (sin sesión): guarda con origen CARTA, sin subido_por, y responde solo { id, legible }', async () => {
      const res: any = await service.subirYProcesar(fakeFile, { pedidoId: '50', origen: 'CARTA' }, null, '8.8.8.8');

      expect(archivosMock.subirArchivo).toHaveBeenCalledWith(fakeFile, true, undefined, '8.8.8.8');
      expect(prismaMock.voucherPago.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ origen: 'CARTA', pedido_id: 50n, subido_por: null }),
        }),
      );
      expect(res).toEqual({ id: '1', legible: true });
      expect(res.semaforo).toBeUndefined();
    });

    it('sobre el límite de lecturas la IA responde SIN_LECTURA y el voucher se guarda igual', async () => {
      vouchersIaMock.analizarVoucher.mockResolvedValueOnce({
        sinLectura: true,
        extraido: null,
        motivo: 'Límite de lecturas de vouchers por minuto excedido',
      });

      const res: any = await service.subirYProcesar(fakeFile, { pedidoId: '50' }, cajeroUsuario, '10.0.0.1');

      expect(prismaMock.voucherPago.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ semaforo: 'SIN_LECTURA' }) }),
      );
      expect(res.semaforo).toBe('SIN_LECTURA');
    });

  describe('Mozo envía el cobro de mesa a Caja (no cobra)', () => {
    it('efectivo: avisa a Caja con PAGO_EFECTIVO_MOZO, enlace al pedido, sin marcarlo pagado', async () => {
      const res = await service.enviarACaja('50', 'efectivo', mozoUsuario, '10.0.0.3');

      expect(res).toEqual({ ok: true });
      expect(prismaMock.notificacion.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tipo: 'PAGO_EFECTIVO_MOZO',
          rol_destino: 'CAJERO',
          enlace: '/admin/caja?pedido=50',
        }),
      });
      expect(prismaMock.voucherPago.findFirst).not.toHaveBeenCalled();
      expect(prismaMock.pedido.update).not.toHaveBeenCalled();
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
      expect(auditoriaMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ accion: 'ENVIADO_CAJA', entidadId: 50n }),
      );
    });

    it('digital con foto legible: aviso VOUCHER_PENDIENTE_MOZO y la respuesta no trae semáforo', async () => {
      prismaMock.voucherPago.findFirst.mockResolvedValue({ semaforo: 'CONFIABLE' });

      const res: any = await service.enviarACaja('50', 'YAPE', mozoUsuario);

      expect(prismaMock.notificacion.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tipo: 'VOUCHER_PENDIENTE_MOZO',
          titulo: 'Voucher listo para revisar',
        }),
      });
      expect(res).toEqual({ ok: true });
      expect(res.semaforo).toBeUndefined();
    });

    it('digital sin foto legible: aviso igual, con el texto de sin foto legible', async () => {
      prismaMock.voucherPago.findFirst.mockResolvedValue({ semaforo: 'ILEGIBLE' });

      await service.enviarACaja('50', 'PLIN', mozoUsuario);

      expect(prismaMock.notificacion.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tipo: 'VOUCHER_PENDIENTE_MOZO',
          titulo: 'Pago digital sin foto legible',
        }),
      });
    });

    it('pedido ya cobrado: no avisa a Caja', async () => {
      prismaMock.pedido.findUnique.mockResolvedValue({ id: 50n, codigo: 'PED-50', pago_estado: 'PAGADO' });

      await expect(service.enviarACaja('50', 'EFECTIVO', mozoUsuario)).rejects.toThrow(ConflictException);
      expect(prismaMock.notificacion.create).not.toHaveBeenCalled();
    });

    it('medio no válido: 400 y no avisa', async () => {
      await expect(service.enviarACaja('50', 'BITCOIN', mozoUsuario)).rejects.toThrow(BadRequestException);
      expect(prismaMock.notificacion.create).not.toHaveBeenCalled();
    });

    it('TARJETA sin plan: no pide voucher, avisa a Caja como pago en mesa', async () => {
      await expect(service.enviarACaja('50', 'TARJETA', mozoUsuario)).resolves.toEqual({ ok: true });
      expect(prismaMock.notificacion.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ tipo: 'PAGO_EFECTIVO_MOZO' }),
      });
    });

    describe('pago dividido (plan)', () => {
      const planValido = [
        { medio: 'EFECTIVO', monto: 20 },
        { medio: 'YAPE', monto: 15 },
      ];

      it('plan que suma el total: reemplaza el plan guardado, fija el medio principal y avisa con el desglose', async () => {
        const res = await service.enviarACaja('50', '', mozoUsuario, '10.0.0.3', planValido);

        expect(res).toEqual({ ok: true });
        expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
        expect(prismaMock.pedidoPagoPlan.deleteMany).toHaveBeenCalledWith({ where: { pedido_id: 50n } });
        expect(prismaMock.pedidoPagoPlan.createMany).toHaveBeenCalledWith({
          data: [
            expect.objectContaining({ pedido_id: 50n, medio: 'EFECTIVO', orden: 0 }),
            expect.objectContaining({ pedido_id: 50n, medio: 'YAPE', orden: 1 }),
          ],
        });
        expect(prismaMock.pedido.update).toHaveBeenCalledWith({
          where: { id: 50n },
          data: { pago_preferido: 'YAPE', pago_metodo: 'YAPE' },
        });
        expect(prismaMock.notificacion.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            tipo: 'VOUCHER_PENDIENTE_MOZO',
            mensaje: expect.stringContaining('(Efectivo S/ 20.00 · Yape S/ 15.00)'),
          }),
        });
        expect(prismaMock.voucherPago.create).not.toHaveBeenCalled();
        expect(auditoriaMock.registrar).toHaveBeenCalledWith(
          expect.objectContaining({ accion: 'ENVIADO_CAJA', entidadId: 50n }),
        );
      });

      it('no cobra ni aprueba: solo toca el plan y el medio preferido, nunca el estado de pago', async () => {
        await service.enviarACaja('50', '', mozoUsuario, undefined, planValido);

        for (const [args] of prismaMock.pedido.update.mock.calls) {
          expect(Object.keys(args.data).sort()).toEqual(['pago_metodo', 'pago_preferido']);
        }
      });

      it('plan solo en efectivo: aviso de efectivo con el desglose, sin voucher', async () => {
        await service.enviarACaja('50', '', mozoUsuario, undefined, [{ medio: 'EFECTIVO', monto: 35 }]);

        expect(prismaMock.notificacion.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            tipo: 'PAGO_EFECTIVO_MOZO',
            mensaje: expect.stringContaining('Desglose: Efectivo S/ 35.00.'),
          }),
        });
        expect(prismaMock.voucherPago.findFirst).not.toHaveBeenCalled();
        expect(prismaMock.pedido.update).toHaveBeenCalledWith({
          where: { id: 50n },
          data: { pago_preferido: 'EFECTIVO', pago_metodo: 'EFECTIVO' },
        });
      });

      it('plan que no suma el total: 400 PLAN_PAGO_NO_CUADRA, no toca el plan ni avisa', async () => {
        const error = await service
          .enviarACaja('50', '', mozoUsuario, undefined, [
            { medio: 'EFECTIVO', monto: 20 },
            { medio: 'YAPE', monto: 10 },
          ])
          .catch((e) => e);

        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.getResponse()).toMatchObject({ codigo: 'PLAN_PAGO_NO_CUADRA' });
        expect(prismaMock.$transaction).not.toHaveBeenCalled();
        expect(prismaMock.pedidoPagoPlan.deleteMany).not.toHaveBeenCalled();
        expect(prismaMock.notificacion.create).not.toHaveBeenCalled();
      });

      it('plan con un medio repetido o monto cero: 400 y no avisa', async () => {
        await expect(
          service.enviarACaja('50', '', mozoUsuario, undefined, [
            { medio: 'YAPE', monto: 20 },
            { medio: 'YAPE', monto: 15 },
          ]),
        ).rejects.toThrow(BadRequestException);
        await expect(
          service.enviarACaja('50', '', mozoUsuario, undefined, [
            { medio: 'YAPE', monto: 35 },
            { medio: 'EFECTIVO', monto: 0 },
          ]),
        ).rejects.toThrow(BadRequestException);
        expect(prismaMock.notificacion.create).not.toHaveBeenCalled();
      });

      it('plan que no es una lista: 400 PLAN_PAGO_INVALIDO', async () => {
        await expect(service.enviarACaja('50', 'YAPE', mozoUsuario, undefined, 'YAPE')).rejects.toThrow(
          BadRequestException,
        );
        expect(prismaMock.notificacion.create).not.toHaveBeenCalled();
      });
    });
  });

    it('el mozo avisa a Caja que falta la foto: notificación para CAJA y auditoría', async () => {
      await service.avisarFaltaVoucher('50', mozoUsuario, '10.0.0.2');

      expect(prismaMock.notificacion.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ tipo: 'VOUCHER_PENDIENTE_MOZO', rol_destino: 'CAJERO' }),
      });
      expect(auditoriaMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ accion: 'AVISO_SIN_FOTO', entidadId: 50n }),
      );
    });
  });
});
