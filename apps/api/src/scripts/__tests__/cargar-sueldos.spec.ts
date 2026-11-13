jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
import { ejecutarCarga, pedidosDesdeCsv } from '../cargar-sueldos';
import { sueldoEquivalente } from '../../modulos/asistencia/planilla.calculo';

// Todo inventado: documentos, nombres y montos de prueba
const DOC_A = '11111111';
const DOC_B = '22222222';
const DOC_ADMIN = '33333333';
const DOC_NOEXISTE = '44444444';

function baseFalsa() {
  const cuentas = new Map<string, any>([
    [DOC_A, { party_id: 1n, rol: 'MOZO', party: { persona: { nombres: 'Ana María' } } }],
    [DOC_B, { party_id: 2n, rol: 'COCINA', party: { persona: { nombres: 'Luis' } } }],
    [DOC_ADMIN, { party_id: 3n, rol: 'ADMIN', party: { persona: { nombres: 'Jefe' } } }],
  ]);
  const sueldos = new Map<bigint, any>();
  const auditorias: any[] = [];
  const escrituras = { n: 0 };
  const cliente = {
    partyIdentifier: { findFirst: jest.fn(async ({ where }: any) => (cuentas.has(where.numero) ? { party_id: cuentas.get(where.numero).party_id } : null)) },
    userAccount: { findUnique: jest.fn(async ({ where }: any) => [...cuentas.values()].find((c) => c.party_id === where.party_id) ?? null) },
    sueldoPersonal: {
      findUnique: jest.fn(async ({ where }: any) => sueldos.get(where.party_id) ?? null),
      upsert: jest.fn(async ({ where, create, update }: any) => {
        escrituras.n++;
        sueldos.set(where.party_id, sueldos.has(where.party_id) ? { ...sueldos.get(where.party_id), ...update } : create);
      }),
    },
  };
  const prisma = { ...cliente, $transaction: jest.fn(async (fn: any) => fn(cliente)) };
  const auditoria = { registrar: jest.fn(async (r: any) => void auditorias.push(r)) };
  return { prisma, auditoria, sueldos, auditorias, escrituras };
}

async function correr(csv: string, aplicar: boolean, b = baseFalsa()) {
  const lineas: string[] = [];
  const codigo = await ejecutarCarga(csv, aplicar, { prisma: b.prisma, auditoria: b.auditoria }, (l) => lineas.push(l));
  return { lineas, codigo, b };
}

const CSV = ['documento,sueldo_mensual,acuerdo_laboral', `${DOC_A},1500,Tiempo Completo`, `${DOC_B},"S/ 1,200.50",`].join('\n');

describe('cargar-sueldos', () => {
  it('parsea documento normalizado, montos con formato y detecta cabecera incompleta', () => {
    const { pedidos } = pedidosDesdeCsv(`documento;sueldo_mensual;dias_mes;horas_dia;pago_medio\nab-123 45;S/ 1.500,00;26;8;yape`.replace('1.500,00', '1500,50'));
    expect(pedidos[0]).toEqual(expect.objectContaining({ documento: 'AB12345', sueldo: 1500.5, diasMes: 26, horasDia: 8, pagoMedio: 'YAPE' }));
    expect(pedidosDesdeCsv('documento\n1').error).toMatch(/sueldo_mensual/);
    expect(pedidosDesdeCsv('documento,sueldo_mensual,pago_medio\n1,5,BITCOIN').pedidos[0].error).toMatch(/pago_medio/);
    expect(pedidosDesdeCsv('documento,sueldo_mensual\n1,abc').pedidos[0].error).toMatch(/monto/);
  });

  it('simulacro: informa crearía y no escribe ni audita', async () => {
    const { lineas, b } = await correr(CSV, false);
    expect(lineas[0]).toMatch(/SIMULACRO/);
    expect(lineas).toContain('fila 2: crearía — Ana');
    expect(lineas).toContain('fila 3: crearía — Luis');
    expect(lineas.at(-1)).toContain('crearía 2');
    expect(b.escrituras.n).toBe(0);
    expect(b.auditorias).toHaveLength(0);
    expect(b.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('aplicar crea el sueldo MENSUAL con el semanal de la fórmula de la planilla y audita como sistema', async () => {
    const { lineas, b } = await correr(CSV, true);
    expect(lineas).toContain('fila 2: creado — Ana');
    const s = b.sueldos.get(1n);
    const eq = sueldoEquivalente('MENSUAL', 1500);
    expect(s).toEqual(expect.objectContaining({ modalidad: 'MENSUAL', monto_mensual: eq.mensual, monto_semanal: eq.semanal, metodo_valor_hora: 'DIAS_HORAS', actualizado_por: null }));
    expect(b.sueldos.get(2n).monto_mensual).toBe(1200.5);
    expect(b.auditorias).toHaveLength(2);
    expect(b.auditorias[0]).toEqual(expect.objectContaining({ accion: 'CARGAR_SUELDOS', modulo: 'planilla', entidad: 'party', entidadId: 1, antes: null }));
    expect(b.auditorias[0].partyId).toBeUndefined();
  });

  it('idempotente: la segunda corrida da sin cambio y no escribe', async () => {
    const b = baseFalsa();
    await correr(CSV, true, b);
    const n = b.escrituras.n;
    const { lineas } = await correr(CSV, true, b);
    expect(lineas.at(-1)).toContain('sin cambio 2');
    expect(b.escrituras.n).toBe(n);
    expect(b.auditorias).toHaveLength(2);
  });

  it('un sueldo distinto: simulacro dice cambiaría sin tocar; aplicar sobreescribe y audita antes/despues', async () => {
    const b = baseFalsa();
    await correr(CSV, true, b);
    const csv2 = `documento,sueldo_mensual\n${DOC_A},1800`;
    const sim = await correr(csv2, false, b);
    expect(sim.lineas).toContain('fila 2: cambiaría — Ana');
    expect(b.sueldos.get(1n).monto_mensual).toBe(1500);
    const ap = await correr(csv2, true, b);
    expect(ap.lineas).toContain('fila 2: cambiado — Ana');
    expect(b.sueldos.get(1n).monto_mensual).toBe(1800);
    const ultima = b.auditorias.at(-1);
    expect(ultima.antes).toEqual(expect.objectContaining({ mensual: 1500 }));
    expect(ultima.despues).toEqual(expect.objectContaining({ mensual: 1800 }));
  });

  it('dias_mes y horas_dia ponen DIAS_HORAS; sin ellos un cambio conserva el método existente', async () => {
    const b = baseFalsa();
    b.sueldos.set(2n, { party_id: 2n, modalidad: 'SEMANAL', monto_semanal: 1, monto_mensual: 4, metodo_valor_hora: 'PROGRAMADAS' });
    await correr(`documento,sueldo_mensual\n${DOC_B},1000`, true, b);
    expect(b.sueldos.get(2n).metodo_valor_hora).toBe('PROGRAMADAS');
    await correr(`documento,sueldo_mensual,dias_mes,horas_dia\n${DOC_B},1000,26,8`, true, b);
    expect(b.sueldos.get(2n)).toEqual(expect.objectContaining({ metodo_valor_hora: 'DIAS_HORAS', dias_mes: 26, horas_dia: 8 }));
  });

  it('usuario inexistente, sueldo vacío o cero, admin, repetido y formato: sin escribir ni crear usuarios', async () => {
    const csv = ['documento,sueldo_mensual', `${DOC_NOEXISTE},1000`, `${DOC_A},`, `${DOC_B},0`, `${DOC_ADMIN},900`, `${DOC_A},500`, `${DOC_A},600`, 'xx,500'].join('\n');
    const { lineas, b } = await correr(csv, true);
    expect(lineas).toContain('fila 2: sin usuario');
    expect(lineas).toContain('fila 3: omitida (sin sueldo: se omite)');
    expect(lineas).toContain('fila 4: omitida (sin sueldo: se omite)');
    expect(lineas).toContain('fila 5: error (el administrador no lleva planilla) — Jefe');
    expect(lineas).toContain('fila 6: creado — Ana');
    expect(lineas).toContain('fila 7: error (documento repetido en el archivo)');
    expect(lineas).toContain('fila 8: error (documento con formato no válido)');
    expect(lineas.at(-1)).toBe('Resumen: creado 1 · cambiado 0 · sin cambio 0 · sin usuario 1 · omitidas 2 · error 3');
    expect([...b.sueldos.keys()]).toEqual([1n]);
  });

  it('si la transacción de una fila falla, esa fila es error y las demás siguen', async () => {
    const b = baseFalsa();
    b.prisma.$transaction.mockRejectedValueOnce(new Error('boom con 11111111'));
    const { lineas } = await correr(CSV, true, b);
    expect(lineas[1]).toMatch(/^fila 2: error/);
    expect(lineas).toContain('fila 3: creado — Luis');
    expect(lineas.join('\n')).not.toContain('boom');
  });

  it('la salida nunca lleva documentos, celulares ni montos', async () => {
    const csv = `documento,sueldo_mensual,pago_celular,pago_medio\n${DOC_A},1500,987654321,YAPE\n${DOC_NOEXISTE},777`;
    for (const aplicar of [false, true]) {
      const { lineas } = await correr(csv, aplicar);
      const texto = lineas.join('\n');
      for (const secreto of [DOC_A, DOC_NOEXISTE, '987654321', '1500', '777']) expect(texto).not.toContain(secreto);
    }
  });

  it('un DNI de 7 dígitos sin cero inicial se encuentra con el cero', async () => {
    const b = baseFalsa();
    await correr(`documento,sueldo_mensual\n1111111,1500`, true, b); // 7 dígitos: DOC_A es 11111111, no coincide
    expect(b.sueldos.size).toBe(0);
    const f2 = baseFalsa();
    f2.prisma.partyIdentifier.findFirst.mockImplementation(async ({ where }: any) => (where.numero === '01234567' ? { party_id: 1n } : null));
    const { lineas } = await correr(`documento,sueldo_mensual\n1234567,1500`, true, f2);
    expect(lineas).toContain('fila 2: creado — Ana');
  });

  it('cabecera inválida devuelve 1 y no toca la base', async () => {
    const { codigo, b } = await correr('nombre,x\na,b', true);
    expect(codigo).toBe(1);
    expect(b.prisma.partyIdentifier.findFirst).not.toHaveBeenCalled();
  });
});
