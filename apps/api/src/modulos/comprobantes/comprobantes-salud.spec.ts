// Mock de EventosGateway (como en el resto de specs de comprobantes)
jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

import { ComprobantesSaludService } from './comprobantes-salud.service';
import {
  ESPERAS_FACTURACION_MS,
  esRechazoPermanente,
  esperaFacturacionMs,
  huecosDeNumeracion,
  umbralCertificado,
} from './comprobantes-politica';
import { crearBaseFalsa } from './comprobantes.fake-db';

const DIA = 86_400_000;

function salud(datos: Record<string, any[]> = {}, venceEn: number | null = null) {
  const base = crearBaseFalsa(datos);
  const sunat = {
    certificadoVence: () => (venceEn === null ? null : new Date(Date.now() + venceEn * DIA)),
  } as any;
  return { ...base, s: new ComprobantesSaludService(base.prisma, undefined, sunat) };
}

describe('Salud de la facturación', () => {
  afterEach(() => jest.restoreAllMocks());

  it('circuito: abre tras el umbral, avisa una sola vez por episodio y se cierra con un éxito', async () => {
    const { s, db } = salud({ parametro: [{ clave: 'facturacion_circuito_fallos', valor: 2 }] });
    await s.registrarFallo();
    expect(await s.circuitoAbierto()).toBe(false);
    await s.registrarFallo();
    expect(await s.circuitoAbierto()).toBe(true);
    // Pasa la pausa: un fallo de prueba vuelve a pausar, sin repetir el aviso
    const despues = new Date(Date.now() + 6 * 60_000);
    expect(await s.circuitoAbierto(despues)).toBe(false);
    await s.registrarFallo(despues);
    expect(await s.circuitoAbierto(despues)).toBe(true);
    expect(db.notificacion.filter((n: any) => String(n.tipo).startsWith('FACTURACION:circuito:'))).toHaveLength(1);
    await s.registrarExito();
    expect(await s.circuitoAbierto(despues)).toBe(false);
  });

  it('certificado: avisa al cruzar 60, 30 o 7 días, una sola vez por umbral', async () => {
    const a = salud({}, 25);
    await a.s.revisarAlertas();
    expect(a.db.notificacion.map((n: any) => n.titulo).join('|')).toContain('vence en 25 días');
    await a.s.revisarAlertas();
    expect(a.db.notificacion.filter((n: any) => String(n.tipo).includes('certificado'))).toHaveLength(1);
    expect(a.db.notificacion[0].titulo.startsWith('URGENTE')).toBe(false);

    const b = salud({}, 5);
    await b.s.revisarAlertas();
    expect(b.db.notificacion[0].titulo.startsWith('URGENTE')).toBe(true);

    const c = salud({}, 90);
    await c.s.revisarAlertas();
    expect(c.db.notificacion).toHaveLength(0);
  });

  it('hueco de numeración en B002: alerta una vez con el rango faltante', async () => {
    const filas = [1, 2, 3, 6].map((n) => ({ id: BigInt(n), serie: 'B002', numero: n, tipo: 'BOLETA', facturacion_estado: 'EMITIDO_SUNAT', creado_en: new Date() }));
    const { s, db } = salud({ comprobante: filas, parametro: [{ clave: 'facturacion_serie_boleta', valor: 'B002' }] });
    await s.revisarAlertas();
    const huecos = db.notificacion.filter((n: any) => String(n.tipo).startsWith('FACTURACION:hueco:'));
    expect(huecos).toHaveLength(1);
    expect(huecos[0].titulo).toContain('del 4 al 5');
    await s.revisarAlertas();
    expect(db.notificacion.filter((n: any) => String(n.tipo).startsWith('FACTURACION:hueco:'))).toHaveLength(1);
  });

  it('boleta sin reportar más de 3 días alerta; una reciente no', async () => {
    const vieja = { id: 1n, tipo: 'BOLETA', serie: 'B002', numero: 1, numero_texto: 'B002-000001', facturacion_estado: 'PENDIENTE_RESUMEN', baja_estado: null, creado_en: new Date(Date.now() - 4 * DIA) };
    const nueva = { ...vieja, id: 2n, numero: 2, numero_texto: 'B002-000002', creado_en: new Date(Date.now() - 1 * DIA) };
    const { s, db } = salud({ comprobante: [vieja, nueva] });
    await s.revisarAlertas();
    const avisos = db.notificacion.filter((n: any) => String(n.tipo).startsWith('FACTURACION:boleta:'));
    expect(avisos).toHaveLength(1);
    expect(avisos[0].titulo).toContain('B002-000001');
  });

  it('resumen sin respuesta más de 1 día alerta', async () => {
    const resumen = { id: 9n, nombre: '20000000001-RC-20261101-1', estado: 'ENVIADO', creado_en: new Date(Date.now() - 2 * DIA) };
    const { s, db } = salud({ sunatResumen: [resumen] });
    await s.revisarAlertas();
    expect(db.notificacion.some((n: any) => String(n.tipo).startsWith('FACTURACION:resumen:'))).toBe(true);
  });

  it('salud(): conteos sin datos personales, con problemas y circuito', async () => {
    const hace20 = new Date(Date.now() - 20 * 60_000);
    const comprobantes = [
      { id: 1n, tipo: 'FACTURA', facturacion_estado: 'PENDIENTE_ENVIO', creado_en: hace20 },
      { id: 2n, tipo: 'FACTURA', facturacion_estado: 'REVISION_MANUAL', creado_en: new Date() },
      { id: 3n, tipo: 'BOLETA', facturacion_estado: 'PENDIENTE_RESUMEN', baja_estado: null, creado_en: new Date() },
    ];
    const { s } = salud({ comprobante: comprobantes }, 40);
    const r = await s.salud();
    expect(r).toMatchObject({
      pendientes: 1,
      pendientes_mas_15_min: 1,
      revision_manual: 1,
      con_problemas: 2,
      boletas_por_reportar: 1,
      certificado_vence_en_dias: 40,
      circuito_abierto: false,
      credenciales_invalidas: false,
    });
    expect(r.edad_pendiente_min).toBeGreaterThanOrEqual(19);
    expect(JSON.stringify(r)).not.toMatch(/documento|razon|numero_texto/);
  });
});

describe('Reglas de resiliencia (funciones puras)', () => {
  it('backoff: 1, 2, 5, 10, 30, 60 min y luego cada 2 h, con jitter de ±10 %', () => {
    const sinJitter = () => 0.5; // factor 1.0
    expect(ESPERAS_FACTURACION_MS.map((ms) => ms / 60_000)).toEqual([1, 2, 5, 10, 30, 60]);
    expect([1, 2, 3, 6, 7, 9].map((i) => esperaFacturacionMs(i, sinJitter) / 60_000)).toEqual([1, 2, 5, 60, 120, 120]);
    const minimo = esperaFacturacionMs(1, () => 0);
    const maximo = esperaFacturacionMs(1, () => 0.999999);
    expect(minimo).toBe(54_000);
    expect(maximo).toBeLessThanOrEqual(66_000);
  });

  it('solo los rechazos de validación 2xxx y 3xxx son permanentes', () => {
    expect(esRechazoPermanente('2335')).toBe(true);
    expect(esRechazoPermanente('3001')).toBe(true);
    expect(esRechazoPermanente('0102')).toBe(false);
    expect(esRechazoPermanente('4001')).toBe(false);
    expect(esRechazoPermanente(null)).toBe(false);
  });

  it('huecos de numeración y umbrales de certificado', () => {
    expect(huecosDeNumeracion([3, 1, 2, 5, 5, 9])).toEqual([
      { desde: 4, hasta: 4 },
      { desde: 6, hasta: 8 },
    ]);
    expect(huecosDeNumeracion([])).toEqual([]);
    expect(umbralCertificado(90)).toBeNull();
    expect(umbralCertificado(55)).toBe(60);
    expect(umbralCertificado(25)).toBe(30);
    expect(umbralCertificado(7)).toBe(7);
    expect(umbralCertificado(-1)).toBe(7);
  });
});
