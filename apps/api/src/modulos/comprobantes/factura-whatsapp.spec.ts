jest.mock('../chatbot/chatbot.module', () => ({ ChatbotModule: class {} }));
jest.mock('@nestjs/jwt', () => ({ JwtService: jest.fn() }));
jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

// Factura aceptada por SUNAT → WhatsApp del cliente. Meta simulado con fetch falso: primero se SUBE el PDF a la Media API y el
// mensaje va con `id` (nunca con `link`). Datos inventados; nada real.

import { ConfigService } from '@nestjs/config';
import { WhatsAppMetaAdaptador } from '../chatbot/adaptadores/whatsapp-meta.adaptador';
import { FacturaWhatsappService } from './factura-whatsapp.service';
import { ComprobantesService } from './comprobantes.service';
import { crearBaseFalsa, pedidoDePrueba } from './comprobantes.fake-db';
import { FacturaWhatsappController } from './factura-whatsapp.controller';
import { CLAVE_PERMISO } from '../acceso/permiso.decorator';
import { celularParaFactura, esperaReintento, nombreArchivoFactura, textoFactura } from './factura-whatsapp';

const PDF = Buffer.from('%PDF-1.4 factura de prueba');
const ADMIN: any = { partyId: 5n, rol: 'ADMIN' };

function factura(extra: any = {}) {
  return { id: 10n, pedido_id: 100n, tipo: 'FACTURA', serie: 'F002', numero: 123, numero_texto: 'F002-000123', facturacion_estado: 'EMITIDO_SUNAT', simulado: false, anulado_en: null, baja_estado: null, ...extra };
}

function montar(o: { comp?: any; pedido?: any; parametros?: any[]; ventana?: boolean; consentimiento?: boolean; conversacion?: any; fetchFn?: any } = {}) {
  const envios = new Map<string, any>();
  const chat: any[] = [];
  const audit: any[] = [];
  const comp = o.comp === undefined ? factura() : o.comp;
  const pedido = { id: 100n, cliente_telefono: '987654321', es_personal: false, ...(o.pedido ?? {}) };
  const prisma: any = {
    comprobante: { findUnique: jest.fn(async () => (comp ? { ...comp, pedido } : null)) },
    parametro: { findMany: jest.fn(async () => o.parametros ?? []) , upsert: jest.fn(async () => ({}))},
    conversacion: { findUnique: jest.fn(async () => o.conversacion ?? null), findFirst: jest.fn(async () => null), upsert: jest.fn(async () => ({ id: 3n })) },
    mensajeChat: { create: jest.fn(async ({ data }: any) => { chat.push(data); return { id: 1n, ...data }; }) },
    whatsappMensaje: { create: jest.fn(async ({ data }: any) => ({ id: 77n, ...data })) },
    facturaWhatsappEnvio: {
      createMany: jest.fn(async ({ data }: any) => {
        const k = String(data[0].comprobante_id);
        if (envios.has(k)) return { count: 0 };
        envios.set(k, { intentos: 0, via: null, detalle: null, enviado_en: null, ...data[0] });
        return { count: 1 };
      }),
      findUnique: jest.fn(async ({ where }: any) => envios.get(String(where.comprobante_id)) ?? null),
      upsert: jest.fn(async ({ where, update, create }: any) => {
        const k = String(where.comprobante_id);
        const f = envios.get(k);
        envios.set(k, f ? { ...f, ...update } : { intentos: 0, ...create });
        return envios.get(k);
      }),
      findMany: jest.fn(async ({ where }: any) => [...envios.values()].filter((f) => where.estado.in.includes(f.estado) && f.proximo_intento_en && f.proximo_intento_en <= where.proximo_intento_en.lte)),
      updateMany: jest.fn(async ({ where, data }: any) => {
        const f = envios.get(String(where.comprobante_id));
        if (!f || f.proximo_intento_en !== where.proximo_intento_en) return { count: 0 };
        Object.assign(f, data);
        return { count: 1 };
      }),
    },
  };
  const config = {
    get: jest.fn((k: string, d?: any) => (k === 'WHATSAPP_TOKEN' ? 'token_falso' : k === 'WHATSAPP_PHONE_ID' ? '100200300' : k === 'WHATSAPP_API_VERSION' ? 'v20.0' : k === 'WHATSAPP_TIMEOUT_MS' ? 1000 : d)),
  } as unknown as ConfigService;
  const adaptador = new WhatsAppMetaAdaptador(config, prisma);
  const fetchFalso =
    o.fetchFn ??
    jest.fn(async (url: string) => {
      if (String(url).endsWith('/media')) return { ok: true, status: 200, json: async () => ({ id: 'MEDIA-F1' }) };
      return { ok: true, status: 200, text: async () => JSON.stringify({ messages: [{ id: 'wamid.F1' }] }) };
    });
  global.fetch = fetchFalso as any;
  const comprobantes = { alAceptarFactura: null, pdfParaEnvio: jest.fn(async () => ({ nombre: 'F002-000123.pdf', contenido: PDF })) } as unknown as ComprobantesService;
  const ventana: any = { esVentanaAbierta: jest.fn(async () => o.ventana ?? true), tieneConsentimiento: jest.fn(async () => o.consentimiento ?? true) };
  const auditoria: any = { registrar: jest.fn(async (r: any) => { audit.push(r); }) };
  const archivos: any = { subirDocumento: jest.fn(async () => ({ id: '900' })) };
  const servicio = new FacturaWhatsappService(prisma, auditoria, comprobantes, ventana, adaptador as any, archivos);
  return { servicio, prisma, envios, chat, audit, fetchFalso, comprobantes, ventana, archivos };
}

const cuerposMensaje = (f: jest.Mock) => f.mock.calls.filter((c) => String(c[0]).endsWith('/messages')).map((c) => JSON.parse((c[1] as any).body));
const estado = (m: ReturnType<typeof montar>) => m.envios.get('10')?.estado;

const original = global.fetch;
afterEach(() => {
  global.fetch = original;
});

describe('helpers puros', () => {
  it('celular: 9 dígitos con 9 inicial (con o sin 51); lo demás no', () => {
    expect(celularParaFactura('987654321')).toBe('51987654321');
    expect(celularParaFactura('+51 987 654 321')).toBe('51987654321');
    for (const malo of ['', null, undefined, '999999999', '12345678', '887654321', 'wa-user:PE.12345', '5198765432']) expect(celularParaFactura(malo as any)).toBeNull();
  });
  it('texto de una línea, sin montos ni RUC; nombre legible; esperas crecientes que se acaban', () => {
    expect(textoFactura('F002-000123')).toBe('Gracias por tu compra en Caprichos 💛 Aquí está tu factura electrónica F002-000123.');
    expect(nombreArchivoFactura('F002-000123')).toBe('Factura F002-000123.pdf');
    expect([1, 2, 3, 4].map(esperaReintento).every((e, i, a) => e! > 0 && (i === 0 || e! > a[i - 1]!))).toBe(true);
    expect(esperaReintento(5)).toBeNull();
  });
});

describe('FacturaWhatsappService.iniciar', () => {
  it('ventana abierta: sube el PDF a /media y manda type=document con id y filename, sin link; una sola vez', async () => {
    const m = montar();
    const r = await m.servicio.iniciar(10n);
    expect(r).toMatchObject({ estado: 'ENVIADO', via: 'DOCUMENTO' });
    const [urlMedia, optsMedia] = m.fetchFalso.mock.calls[0];
    expect(String(urlMedia)).toBe('https://graph.facebook.com/v20.0/100200300/media');
    expect(((optsMedia as any).body as FormData).get('type')).toBe('application/pdf');
    expect((((optsMedia as any).body as FormData).get('file') as File).name).toBe('Factura F002-000123.pdf');
    const cuerpos = cuerposMensaje(m.fetchFalso);
    expect(cuerpos).toHaveLength(1);
    expect(cuerpos[0].type).toBe('document');
    expect(cuerpos[0].document).toEqual({ id: 'MEDIA-F1', filename: 'Factura F002-000123.pdf', caption: textoFactura('F002-000123') });
    expect(JSON.stringify(cuerpos[0])).not.toContain('"link"');
    expect(m.comprobantes.pdfParaEnvio).toHaveBeenCalledTimes(1);
    expect(m.envios.get('10')).toMatchObject({ estado: 'ENVIADO', via: 'DOCUMENTO', intentos: 1 });
    expect(m.envios.get('10').enviado_en).toBeInstanceOf(Date);
    // aparece en el hilo como cualquier documento enviado
    expect(m.chat[0]).toMatchObject({ direccion: 'SALE', autor: 'BOT', tipo: 'DOCUMENTO', meta_id: 'wamid.F1' });
    expect(m.chat[0].contenido.documento).toMatchObject({ archivoId: '900', nombre: 'Factura F002-000123.pdf', mime: 'application/pdf' });
  });

  it('idempotente: una segunda transición no duplica el envío', async () => {
    const m = montar();
    await m.servicio.iniciar(10n);
    expect(await m.servicio.iniciar(10n)).toBeNull();
    expect(cuerposMensaje(m.fetchFalso)).toHaveLength(1);
  });

  it('boleta, nota de venta, simulada y no aceptada: no envían nada ni crean fila', async () => {
    for (const extra of [{ tipo: 'BOLETA' }, { tipo: 'NOTA_VENTA' }, { simulado: true }, { facturacion_estado: 'PENDIENTE_ENVIO' }]) {
      const m = montar({ comp: factura(extra) });
      expect(await m.servicio.iniciar(10n)).toBeNull();
      expect(m.envios.size).toBe(0);
      expect(m.fetchFalso).not.toHaveBeenCalled();
    }
  });

  it('sin celular válido (vacío, relleno, no 9 dígitos): no envía y queda «sin celular»', async () => {
    for (const tel of [null, '', '999999999', '12345']) {
      const m = montar({ pedido: { cliente_telefono: tel } });
      expect(await m.servicio.iniciar(10n)).toMatchObject({ estado: 'SIN_CELULAR' });
      expect(m.fetchFalso).not.toHaveBeenCalled();
      expect(m.comprobantes.pdfParaEnvio).not.toHaveBeenCalled();
      expect(m.envios.get('10').proximo_intento_en).toBeNull();
    }
  });

  it('cliente de personal, consentimiento revocado, anulada: no envía', async () => {
    const personal = montar({ pedido: { es_personal: true } });
    expect(await personal.servicio.iniciar(10n)).toMatchObject({ estado: 'OMITIDO', detalle: 'PERSONAL' });
    const baja = montar({ consentimiento: false });
    expect(await baja.servicio.iniciar(10n)).toMatchObject({ estado: 'OMITIDO', detalle: 'CLIENTE_BAJA' });
    const anulada = montar({ comp: factura({ anulado_en: new Date() }) });
    expect(await anulada.servicio.iniciar(10n)).toMatchObject({ estado: 'OMITIDO', detalle: 'ANULADA' });
    for (const m of [personal, baja, anulada]) expect(m.fetchFalso).not.toHaveBeenCalled();
  });

  it('interruptor apagado: no envía nada', async () => {
    const m = montar({ parametros: [{ clave: 'facturacion_enviar_whatsapp', valor: false }] });
    expect(await m.servicio.iniciar(10n)).toMatchObject({ estado: 'APAGADO' });
    expect(m.fetchFalso).not.toHaveBeenCalled();
    expect(m.comprobantes.pdfParaEnvio).not.toHaveBeenCalled();
  });

  it('ventana cerrada con plantilla configurada: plantilla con el PDF en el encabezado (id) y el número en el cuerpo', async () => {
    const m = montar({ ventana: false, parametros: [{ clave: 'facturacion_whatsapp_plantilla', valor: 'caprichos_factura_electronica' }] });
    expect(await m.servicio.iniciar(10n)).toMatchObject({ estado: 'ENVIADO', via: 'PLANTILLA' });
    const [cuerpo] = cuerposMensaje(m.fetchFalso);
    expect(cuerpo.type).toBe('template');
    expect(cuerpo.template.name).toBe('caprichos_factura_electronica');
    expect(cuerpo.template.language.code).toBe('es');
    expect(cuerpo.template.components).toEqual([
      { type: 'header', parameters: [{ type: 'document', document: { id: 'MEDIA-F1', filename: 'Factura F002-000123.pdf' } }] },
      { type: 'body', parameters: [{ type: 'text', text: 'F002-000123' }] },
    ]);
    expect(JSON.stringify(cuerpo)).not.toContain('"link"');
    expect(cuerposMensaje(m.fetchFalso)).toHaveLength(1);
  });

  it('ventana cerrada y sin plantilla: «sin ventana», no sale nada y se programa un reintento', async () => {
    const m = montar({ ventana: false });
    expect(await m.servicio.iniciar(10n)).toMatchObject({ estado: 'SIN_VENTANA' });
    expect(m.fetchFalso).not.toHaveBeenCalled();
    expect(m.envios.get('10').proximo_intento_en).toBeInstanceOf(Date);
  });

  it('sin ventana: reintenta con espera creciente y, agotadas, se cierra sin reintentar eternamente', async () => {
    const m = montar({ ventana: false });
    await m.servicio.iniciar(10n);
    let t = Date.now();
    const esperas: number[] = [];
    for (let i = 0; i < 6; i++) {
      const f = m.envios.get('10');
      if (!f.proximo_intento_en) break;
      esperas.push(f.proximo_intento_en.getTime() - Date.now());
      t = f.proximo_intento_en.getTime() + 1;
      await m.servicio.barrer(new Date(t));
    }
    expect(m.envios.get('10')).toMatchObject({ estado: 'SIN_VENTANA', intentos: 5, proximo_intento_en: null });
    expect(esperas.length).toBe(4);
    expect(esperas[1]).toBeGreaterThan(esperas[0]);
    expect(esperas[3]).toBeGreaterThan(esperas[2]);
  });

  it('sin ventana y el cliente escribe después: el reintento envía el documento', async () => {
    const m = montar({ ventana: false });
    await m.servicio.iniciar(10n);
    (m.ventana.esVentanaAbierta as jest.Mock).mockResolvedValue(true);
    await m.servicio.barrer(new Date(Date.now() + 20 * 60_000));
    expect(estado(m)).toBe('ENVIADO');
    expect(cuerposMensaje(m.fetchFalso)).toHaveLength(1);
  });

  it('el barrido no toma una fila ya arrendada por otro proceso', async () => {
    const m = montar({ ventana: false });
    await m.servicio.iniciar(10n);
    const futuro = new Date(Date.now() + 20 * 60_000);
    jest.spyOn(m.prisma.facturaWhatsappEnvio, 'updateMany').mockResolvedValueOnce({ count: 0 });
    expect(await m.servicio.barrer(futuro)).toBe(0);
  });

  it('fallo de Meta: queda ERROR (reintentable) y NO lanza ni toca el comprobante', async () => {
    const fetchFn = jest.fn(async (url: string) =>
      String(url).endsWith('/media')
        ? { ok: true, status: 200, json: async () => ({ id: 'M1' }) }
        : { ok: false, status: 500, text: async () => JSON.stringify({ error: { code: 1, message: 'boom' } }) },
    );
    const m = montar({ fetchFn });
    const r = await m.servicio.iniciar(10n);
    expect(r?.estado).toBe('ERROR');
    expect(m.envios.get('10').proximo_intento_en).toBeInstanceOf(Date);
    expect(m.chat).toHaveLength(0);
    expect((m.prisma.comprobante as any).update).toBeUndefined(); // el servicio ni siquiera puede modificar el comprobante
  });

  it('error de ventana de Meta (131047) con plantilla: reintenta UNA vez con la plantilla', async () => {
    let n = 0;
    const fetchFn = jest.fn(async (url: string) => {
      if (String(url).endsWith('/media')) return { ok: true, status: 200, json: async () => ({ id: 'M1' }) };
      n++;
      return n === 1
        ? { ok: false, status: 400, text: async () => JSON.stringify({ error: { code: 131047, message: 'Re-engagement message' } }) }
        : { ok: true, status: 200, text: async () => JSON.stringify({ messages: [{ id: 'wamid.P' }] }) };
    });
    const m = montar({ fetchFn, parametros: [{ clave: 'facturacion_whatsapp_plantilla', valor: 'caprichos_factura_electronica' }] });
    expect(await m.servicio.iniciar(10n)).toMatchObject({ estado: 'ENVIADO', via: 'PLANTILLA' });
    expect(cuerposMensaje(fetchFn).map((c) => c.type)).toEqual(['document', 'template']);
  });

  it('subida de media rechazada: ERROR sin mandar el mensaje', async () => {
    const fetchFn = jest.fn(async () => ({ ok: false, status: 400, json: async () => ({ error: { message: 'x' } }) }));
    const m = await (async () => montar({ fetchFn }))();
    expect(await m.servicio.iniciar(10n)).toMatchObject({ estado: 'ERROR', detalle: 'SUBIDA_MEDIA' });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('auditoría y log: sin PDF ni celular', async () => {
    const m = montar();
    const log = jest.spyOn((m.servicio as any).logger, 'log');
    await m.servicio.iniciar(10n);
    expect(m.audit).toHaveLength(1);
    expect(m.audit[0]).toMatchObject({ modulo: 'comprobantes', accion: 'FACTURA_WHATSAPP_ENVIADO', entidad: 'comprobante', entidadId: 10n, resultado: 'OK' });
    const aCadena = (x: unknown) => JSON.stringify(x, (_k, v) => (typeof v === 'bigint' ? String(v) : v));
    const rastro = aCadena(m.audit) + aCadena(log.mock.calls) + aCadena(m.envios.get('10'));
    expect(rastro).not.toMatch(/987654321|51987654321|%PDF/);
  });
});

describe('FacturaWhatsappService.reenviar (botón)', () => {
  it('reenvía por el mismo camino aunque ya se haya enviado (un envío más, a pedido) y audita a la persona', async () => {
    const m = montar();
    await m.servicio.iniciar(10n);
    const r = await m.servicio.reenviar('10', ADMIN, '1.2.3.4');
    expect(r).toMatchObject({ estado: 'ENVIADO', via: 'DOCUMENTO' });
    expect(cuerposMensaje(m.fetchFalso)).toHaveLength(2);
    expect(m.audit[1]).toMatchObject({ accion: 'FACTURA_WHATSAPP_ENVIADO', partyId: 5n, ip: '1.2.3.4', despues: expect.objectContaining({ manual: true }) });
  });

  it('respeta la ventana: cerrada y sin plantilla queda «sin ventana»', async () => {
    const m = montar({ ventana: false });
    expect(await m.servicio.reenviar('10', ADMIN)).toMatchObject({ estado: 'SIN_VENTANA' });
    expect(m.fetchFalso).not.toHaveBeenCalled();
  });

  it('respeta el interruptor, boletas y anuladas con un 409', async () => {
    await expect(montar({ parametros: [{ clave: 'facturacion_enviar_whatsapp', valor: false }] }).servicio.reenviar('10', ADMIN)).rejects.toMatchObject({ response: { codigo: 'ENVIO_APAGADO' } });
    await expect(montar({ comp: factura({ tipo: 'BOLETA' }) }).servicio.reenviar('10', ADMIN)).rejects.toMatchObject({ response: { codigo: 'FACTURA_NO_ENVIABLE' } });
    await expect(montar({ comp: factura({ anulado_en: new Date() }) }).servicio.reenviar('10', ADMIN)).rejects.toMatchObject({ response: { codigo: 'FACTURA_NO_ENVIABLE' } });
    await expect(montar({ comp: null }).servicio.reenviar('10', ADMIN)).rejects.toMatchObject({ response: { codigo: 'COMPROBANTE_NO_ENCONTRADO' } });
  });
});

describe('configuración', () => {
  it('encendido por defecto; guardar audita y limpia una plantilla inválida', async () => {
    const m = montar();
    expect(await m.servicio.leerConfig()).toEqual({ activo: true, plantilla: '' });
    const r = await m.servicio.guardarConfig(false, 'Nombre Con Espacios', ADMIN, '1.1.1.1');
    expect(r).toEqual({ activo: false, plantilla: '' });
    expect(m.audit[0]).toMatchObject({ accion: 'CONFIG_FACTURA_WHATSAPP', antes: { activo: true, plantilla: '' }, despues: { activo: false, plantilla: '' } });
    expect((await m.servicio.guardarConfig(true, 'caprichos_factura_electronica', ADMIN)).plantilla).toBe('caprichos_factura_electronica');
  });
});

describe('ComprobantesService: disparo en la transición a EMITIDO_SUNAT', () => {
  function montarEmision(tipo: string, ped: any = pedidoDePrueba()) {
    const base = crearBaseFalsa({ pedido: [ped], comprobante: [{ id: 1n, pedido_id: ped.id ?? 100n, tipo, serie: tipo === 'FACTURA' ? 'F002' : 'B002', numero: 1, numero_texto: 'X-1', facturacion_estado: 'PENDIENTE_ENVIO', simulado: false }] });
    const auditoria = { registrar: jest.fn(async () => undefined) } as any;
    const servicio = new ComprobantesService(base.prisma, auditoria);
    const aviso = jest.fn();
    servicio.alAceptarFactura = aviso;
    const guardar = (res: any) => (servicio as any).guardarResultado(base.db.comprobante[0], res, {});
    return { aviso, guardar, servicio, base };
  }
  const ok = { estado: 'EMITIDO_SUNAT', respuesta: 'La Factura ha sido aceptada', simulado: false };

  it('factura aceptada de verdad: avisa una vez con su id', async () => {
    const { aviso, guardar } = montarEmision('FACTURA');
    await guardar(ok);
    expect(aviso).toHaveBeenCalledTimes(1);
    expect(aviso).toHaveBeenCalledWith(1n);
  });
  it('boleta, simulada, rechazada o ya registrada sin CDR: no avisa', async () => {
    for (const [tipo, res] of [['BOLETA', ok], ['FACTURA', { ...ok, simulado: true }], ['FACTURA', { ...ok, estado: 'RECHAZADO' }], ['FACTURA', { ...ok, yaRegistrado: true }], ['FACTURA', { ...ok, estado: 'PENDIENTE_ENVIO' }]] as const) {
      const { aviso, guardar } = montarEmision(tipo);
      await guardar(res);
      expect(aviso).not.toHaveBeenCalled();
    }
  });
  it('si el aviso lanza, la emisión igual queda guardada (nunca afecta el estado SUNAT)', async () => {
    const { aviso, guardar, base } = montarEmision('FACTURA');
    aviso.mockImplementation(() => {
      throw new Error('boom');
    });
    await expect(guardar(ok)).resolves.toBeDefined();
    expect(base.db.comprobante[0].facturacion_estado).toBe('EMITIDO_SUNAT');
  });
  it('sin aviso registrado (módulo ausente) no pasa nada', async () => {
    const { servicio, guardar } = montarEmision('FACTURA');
    servicio.alAceptarFactura = null;
    await expect(guardar(ok)).resolves.toBeDefined();
  });
});

describe('FacturaWhatsappController: permisos', () => {
  const exige = (metodo: string) => Reflect.getMetadata(CLAVE_PERMISO, (FacturaWhatsappController.prototype as any)[metodo]);
  it('reenviar exige comprobantes/emitir; guardar la configuración, configuracion/editar; leerla, comprobantes/ver', () => {
    expect(exige('reenviar')).toEqual({ modulo: 'comprobantes', accion: 'emitir' });
    expect(exige('guardar')).toEqual({ modulo: 'configuracion', accion: 'editar' });
    expect(exige('obtener')).toEqual({ modulo: 'comprobantes', accion: 'ver' });
  });
});
