import { describe, it, expect, vi } from 'vitest';
import { AgenteLocalServicio } from '../bucle';
import { ImpresoraMemoria } from '../../impresora/impresoraMemoria';
import { generarTicketEscPos } from '../../escpos/generadorTicket';
import { canjearCodigoVinculo } from '../../api/clienteApi';
import { obtenerConfiguracion } from '../../config';

const ticket: any = {
  tipo: 'TICKET_PAGO',
  local: { nombre: 'Caprichos', ruc: '20600000001' },
  codigo: 'PED-9', fecha: '30/10/2026', hora: '12:00', who: 'Ana', modalidad: 'MESA',
  lineas: [{ cantidad: 2, nombre: 'Café', subtotal: 20 }],
  total: 20, pagos: [{ medio: 'EFECTIVO', monto: 20, recibido: 50, vuelto: 30 }],
  comprobante: { tipo: 'NOTA_VENTA', numero: 'N001-1' },
};

function montar(ticketera: ImpresoraMemoria, etiquetera = new ImpresoraMemoria()) {
  const cliente: any = {
    tomarTrabajos: vi.fn().mockResolvedValue([]),
    reportarResultado: vi.fn().mockResolvedValue(undefined),
    enviarLatido: vi.fn().mockResolvedValue(undefined),
  };
  const agente = new AgenteLocalServicio({
    config: { ...obtenerConfiguracion({}), intervaloLatidoMs: 0 },
    clienteApi: cliente,
    impresoras: { ETIQUETERA: etiquetera, TICKETERA: ticketera },
    logger: () => undefined,
  });
  return { cliente, agente };
}

describe('dos máquinas', () => {
  it('el latido reporta cada rol y el ticket se imprime en la ticketera', async () => {
    const tk = new ImpresoraMemoria();
    const et = new ImpresoraMemoria();
    const { cliente, agente } = montar(tk, et);
    cliente.tomarTrabajos.mockResolvedValueOnce([{ id: '1', tipo: 'TICKET_PAGO', payload: ticket, copia: false, intentos: 0 }]);
    await agente.ejecutarCiclo();
    expect(cliente.enviarLatido.mock.calls[0][3]).toEqual([
      { rol: 'ETIQUETERA', estado: 'lista', detalle: undefined },
      { rol: 'TICKETERA', estado: 'lista', detalle: undefined },
    ]);
    expect(cliente.tomarTrabajos).toHaveBeenCalledWith(10, ['ETIQUETERA', 'TICKETERA']);
    expect(tk.obtenerTrabajosEscritos()).toHaveLength(1);
    expect(et.obtenerTrabajosEscritos()).toHaveLength(0);
    expect(cliente.reportarResultado).toHaveBeenCalledWith('1', true);
  });

  it('una ticketera caída no toma trabajos: solo pide los de la etiquetera', async () => {
    const tk = new ImpresoraMemoria();
    tk.establecerEstado({ estado: 'desconectada', detalle: 'apagada' });
    const { cliente, agente } = montar(tk);
    await agente.ejecutarCiclo();
    expect(cliente.tomarTrabajos).toHaveBeenCalledWith(10, ['ETIQUETERA']);
    expect(cliente.enviarLatido.mock.calls[0][3][1]).toMatchObject({ rol: 'TICKETERA', estado: 'desconectada' });
  });

  it('sin ninguna máquina lista no toma trabajos', async () => {
    const tk = new ImpresoraMemoria();
    const et = new ImpresoraMemoria();
    tk.establecerEstado({ estado: 'sin_papel' });
    et.establecerEstado({ estado: 'desconectada' });
    const { cliente, agente } = montar(tk, et);
    await agente.ejecutarCiclo();
    expect(cliente.tomarTrabajos).not.toHaveBeenCalled();
  });
});

describe('ticket ESC/POS', () => {
  it('trae datos, total, pago y corte; 32 columnas no se pasa del ancho', () => {
    const t = generarTicketEscPos(ticket, 32).toString('latin1');
    expect(t).toContain('PED-9');
    expect(t).toContain('TOTAL');
    expect(t).toContain('S/ 20.00');
    expect(t).toContain('Vuelto');
    expect(t).toContain('N001-1');
    expect(t.endsWith('\x1dV\x42\x00')).toBe(true);
    for (const l of t.split('\n').filter((x) => x.startsWith('2 x'))) expect(l.length).toBeLessThanOrEqual(32);
  });
});

describe('vinculación', () => {
  it('CODIGO@host canjea contra ese host y devuelve la llave', async () => {
    const f: any = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ llave: 'agk_x' }) });
    const r = await canjearCodigoVinculo('http://localhost:3000', 'ABCD2345@demo.caprichos.pe', f);
    expect(f.mock.calls[0][0]).toBe('https://demo.caprichos.pe/api/agente-impresion/vincular');
    expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({ codigo: 'ABCD2345' });
    expect(r).toEqual({ apiUrl: 'https://demo.caprichos.pe', llave: 'agk_x' });
  });

  it('código vencido muestra el mensaje del servidor', async () => {
    const f: any = vi.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({ mensaje: 'ya venció' }) });
    await expect(canjearCodigoVinculo('http://x', 'A', f)).rejects.toThrow('ya venció');
  });
});

describe('el mismo programa para todas las computadoras', () => {
  const comandaArea = {
    id: 'job-area', tipo: 'TICKET_COMANDA_AREA', copia: false, intentos: 0,
    payload: { codigo: 'CP-7', mesa: 'Mesa 1', area: 'SALADOS', cliente: 'Ana', canal: 'Mozo', fecha: '05/11/2026', hora: '13:00', lineas: [{ cantidad: 1, nombre: 'Empanada', opciones: [], nota: null }] },
  } as any;

  it('la comanda de área sale por la ticketera, con el mismo generador que la comanda de salón', async () => {
    const tk = new ImpresoraMemoria();
    const et = new ImpresoraMemoria();
    const { cliente, agente } = montar(tk, et);
    cliente.tomarTrabajos.mockResolvedValueOnce([comandaArea]);
    await agente.ejecutarCiclo();
    expect(et.obtenerTrabajosEscritos()).toHaveLength(0);
    const salida = tk.obtenerTrabajosEscritos().map((b) => b.toString('latin1')).join('');
    expect(salida).toContain('COMANDA · SALADOS');
    expect(salida).toContain('Empanada');
    expect(cliente.reportarResultado).toHaveBeenCalledWith('job-area', true);
  });

  function soloCon(rol: 'ETIQUETERA' | 'TICKETERA') {
    const cliente: any = {
      tomarTrabajos: vi.fn().mockResolvedValue([]),
      reportarResultado: vi.fn().mockResolvedValue(undefined),
      enviarLatido: vi.fn().mockResolvedValue(undefined),
    };
    const agente = new AgenteLocalServicio({
      config: { ...obtenerConfiguracion({}), intervaloLatidoMs: 0 },
      clienteApi: cliente,
      impresoras: { [rol]: new ImpresoraMemoria() },
      logger: () => undefined,
    });
    return { cliente, agente };
  }

  it('un equipo solo con ticketera toma solo trabajos de ticketera; no pide stickers', async () => {
    const { cliente, agente } = soloCon('TICKETERA');
    await agente.ejecutarCiclo();
    expect(cliente.tomarTrabajos).toHaveBeenCalledWith(10, ['TICKETERA']);
  });

  it('un equipo solo con etiquetera toma solo stickers; no pide comandas ni tickets', async () => {
    const { cliente, agente } = soloCon('ETIQUETERA');
    await agente.ejecutarCiclo();
    expect(cliente.tomarTrabajos).toHaveBeenCalledWith(10, ['ETIQUETERA']);
  });
});

