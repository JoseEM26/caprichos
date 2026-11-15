jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
jest.mock('@nestjs/jwt', () => ({ JwtService: jest.fn(), JwtModule: { registerAsync: jest.fn().mockReturnValue({ module: class {} }) } }));

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ComprobantesService } from './comprobantes.service';
import { ComprobantesController } from './comprobantes.controller';
import { ComprobantePublicoController } from './comprobante-publico.controller';
import {
  DETALLE_ENVIADO_A_MANO,
  FILTROS_ELECTRONICOS,
  condicionFiltroElectronicos,
  enlacePublicoPdf,
  esFiltroElectronicos,
  origenPublico,
  tokenPdfComprobante,
  verificarTokenPdfComprobante,
} from './comprobante-enlace';
import { celularParaFactura } from './factura-whatsapp';

describe('Token del PDF público', () => {
  it('solo sirve para ese comprobante y con ese secreto', () => {
    const t = tokenPdfComprobante(7n, 'secreto');
    expect(verificarTokenPdfComprobante('7', t, 'secreto')).toBe(true);
    expect(verificarTokenPdfComprobante('8', t, 'secreto')).toBe(false);
    expect(verificarTokenPdfComprobante('7', t, 'otro')).toBe(false);
    expect(verificarTokenPdfComprobante('7', undefined, 'secreto')).toBe(false);
    expect(verificarTokenPdfComprobante('7', t.slice(1), 'secreto')).toBe(false);
  });
  it('el enlace lleva id y token; sin origen público no hay enlace', () => {
    const url = enlacePublicoPdf('https://caprichos.pe/', 7)!;
    expect(url).toBe(`https://caprichos.pe/carta/comprobante/7/${tokenPdfComprobante(7)}`);
    expect(enlacePublicoPdf('', 7)).toBeNull();
    expect(origenPublico({ DOMINIO_BASE: 'caprichos.pe' })).toBe('https://caprichos.pe');
    expect(origenPublico({ CARTA_URL_PUBLICA: 'https://x.pe', DOMINIO_BASE: 'y.pe' })).toBe('https://x.pe');
  });
  it('el controlador público da 404 igual con token malo o id raro, y el PDF con token bueno', async () => {
    const pdfParaEnvio = jest.fn().mockResolvedValue({ nombre: 'B002-1.pdf', contenido: Buffer.from('%PDF') });
    const c = new ComprobantePublicoController({ pdfParaEnvio } as any);
    const res: any = { setHeader: jest.fn(), end: jest.fn() };
    await expect(c.pdf('7', 'malo', res)).rejects.toBeInstanceOf(NotFoundException);
    await expect(c.pdf('7;drop', tokenPdfComprobante('7'), res)).rejects.toBeInstanceOf(NotFoundException);
    expect(pdfParaEnvio).not.toHaveBeenCalled();
    await c.pdf('7', tokenPdfComprobante('7'), res);
    expect(pdfParaEnvio).toHaveBeenCalledWith('7');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
  });
});

describe('Celular para WhatsApp', () => {
  it('9 dígitos o con 51 salen con 51; lo demás es «Sin celular»', () => {
    expect(celularParaFactura('987 654 321')).toBe('51987654321');
    expect(celularParaFactura('+51 987654321')).toBe('51987654321');
    expect(celularParaFactura('12345')).toBeNull();
    expect(celularParaFactura('999999999')).toBeNull();
    expect(celularParaFactura(null)).toBeNull();
  });
});

describe('Filtros de la lista de electrónicos', () => {
  it('lista blanca', () => {
    expect(FILTROS_ELECTRONICOS).toEqual(['todos', 'faltan', 'aceptados', 'sin_whatsapp']);
    expect(esFiltroElectronicos('faltan')).toBe(true);
    expect(esFiltroElectronicos('x; drop')).toBe(false);
  });
  it('faltan = todo lo no aceptado; aceptados = EMITIDO_SUNAT', () => {
    expect(condicionFiltroElectronicos('faltan')).toMatchObject({ facturacion_estado: { notIn: ['EMITIDO_SUNAT'], not: null } });
    expect(condicionFiltroElectronicos('aceptados')).toMatchObject({ facturacion_estado: 'EMITIDO_SUNAT' });
    expect(JSON.stringify(condicionFiltroElectronicos('sin_whatsapp'))).toContain(DETALLE_ENVIADO_A_MANO);
  });

  const montar = () => {
    const prisma: any = {
      comprobante: { count: jest.fn().mockResolvedValue(45), findMany: jest.fn().mockResolvedValue([]) },
      facturaWhatsappEnvio: { findMany: jest.fn().mockResolvedValue([]) },
    };
    return { prisma, servicio: new ComprobantesService(prisma, { registrar: jest.fn() } as any) };
  };

  it('el servidor filtra y pagina con el mismo where, y devuelve los contadores', async () => {
    const { prisma, servicio } = montar();
    const r = await servicio.listarElectronicos(2, 20, false, 'faltan');
    const llamada = prisma.comprobante.findMany.mock.calls[0][0];
    expect(llamada.where).toEqual(condicionFiltroElectronicos('faltan'));
    expect(llamada).toMatchObject({ skip: 20, take: 20 });
    expect(r).toMatchObject({ total: 45, totalPaginas: 3, pagina: 2 });
    expect(r.contadores).toMatchObject({ todos: 45, faltan: 45, aceptados: 45, sin_whatsapp: 45, pendientes_resumen: 45 });
  });

  it('el controlador rechaza un filtro fuera de la lista y pasa el válido', async () => {
    const listarElectronicos = jest.fn().mockResolvedValue({});
    const c = new ComprobantesController({ listarElectronicos } as any, {} as any, {} as any, {} as any, {} as any);
    await expect(c.listarEmitidos('1', '20', undefined, 'otro')).rejects.toBeInstanceOf(BadRequestException);
    await c.listarEmitidos('1', '20', undefined, 'sin_whatsapp');
    expect(listarElectronicos).toHaveBeenCalledWith(1, 20, false, 'sin_whatsapp');
    await c.listarEmitidos();
    expect(listarElectronicos).toHaveBeenLastCalledWith(1, 20, false, 'todos');
  });

  it('cada fila trae el celular normalizado y el enlace público; el personal no', async () => {
    const { prisma, servicio } = montar();
    const base = { pedido_id: 1n, tipo: 'BOLETA', numero_texto: 'B002-1', facturacion_estado: 'EMITIDO_SUNAT', creado_en: new Date() };
    prisma.comprobante.findMany.mockResolvedValue([
      { ...base, id: 1n, pedido: { codigo: 'A', total: 10, cliente_telefono: '987654321', es_personal: false } },
      { ...base, id: 2n, pedido: { codigo: 'B', total: 10, cliente_telefono: '987654321', es_personal: true } },
      { ...base, id: 3n, pedido: { codigo: 'C', total: 10, cliente_telefono: null, es_personal: false } },
    ]);
    process.env.CARTA_URL_PUBLICA = 'https://caprichos.pe';
    const r = await servicio.listarElectronicos(1, 20);
    delete process.env.CARTA_URL_PUBLICA;
    expect(r.elementos.map((e: any) => e.celular_wa)).toEqual(['51987654321', null, null]);
    expect(r.elementos[0].enlace_pdf_publico).toBe(`https://caprichos.pe/carta/comprobante/1/${tokenPdfComprobante(1n)}`);
  });

  it('«Enviado a mano» se registra sin tocar el estado y se audita', async () => {
    const { prisma, servicio } = montar();
    prisma.comprobante.findUnique = jest.fn().mockResolvedValue({ id: 5n, tipo: 'BOLETA', numero_texto: 'B002-5' });
    prisma.facturaWhatsappEnvio.upsert = jest.fn().mockResolvedValue({});
    const r = await servicio.registrarEnvioManualWhatsapp('5', { partyId: 1n, rol: 'CAJERO' } as any);
    expect(r).toEqual({ ok: true });
    const u = prisma.facturaWhatsappEnvio.upsert.mock.calls[0][0];
    expect(u.update).toMatchObject({ detalle: DETALLE_ENVIADO_A_MANO, proximo_intento_en: null });
    expect(u.update.estado).toBeUndefined();
  });
});
