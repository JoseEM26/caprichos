import { describe, it, expect, vi } from 'vitest';
import { comandosDeTrabajo, LIMITE_COMANDOS_BYTES } from '@caprichos/compartido';
import { AgenteLocalServicio } from '../bucle';
import { ImpresoraMemoria } from '../../impresora/impresoraMemoria';
import { ErrorImpresora } from '../../impresora/dispositivo.interface';
import { generarTicketEscPos } from '../../escpos/generadorTicket';
import { obtenerConfiguracion } from '../../config';

// El programa NO diseña cuando el servidor manda `comandos`: los envía tal cual. Sin ellos (o si no sirven), usa su respaldo.
const ticket: any = {
  tipo: 'TICKET_PAGO', local: { nombre: 'Caprichos' }, codigo: 'PED-9', fecha: '30/10/2026', hora: '12:00', who: 'Ana', modalidad: 'MESA',
  lineas: [{ cantidad: 2, nombre: 'Cafe', subtotal: 20 }], total: 20, pagos: [{ medio: 'EFECTIVO', monto: 20 }], comprobante: null,
};

function montar(tk: ImpresoraMemoria) {
  const cliente: any = {
    tomarTrabajos: vi.fn().mockResolvedValue([]),
    reportarResultado: vi.fn().mockResolvedValue(undefined),
    enviarLatido: vi.fn().mockResolvedValue(undefined),
  };
  const logs: string[] = [];
  const agente = new AgenteLocalServicio({
    config: { ...obtenerConfiguracion({}), intervaloLatidoMs: 0 },
    clienteApi: cliente,
    impresoras: { ETIQUETERA: new ImpresoraMemoria(), TICKETERA: tk },
    logger: (_n, m) => logs.push(m),
  });
  return { cliente, agente, logs };
}
const trabajo = (extra: object = {}) => ({ id: '1', tipo: 'TICKET_PAGO', payload: ticket, copia: false, intentos: 0, ...extra });

describe('el programa envía los comandos del servidor sin diseñar', () => {
  it('declara su capacidad y cómo está montada su impresora al pedir trabajos', async () => {
    const { cliente, agente } = montar(new ImpresoraMemoria());
    await agente.ejecutarCiclo();
    const cap = cliente.tomarTrabajos.mock.calls[0][3];
    expect(cap).toMatchObject({ comandosServidor: true, ticketColumnas: 48 });
    expect(cap.etiqueta).toBeTruthy();
  });

  it('con comandos válidos escribe EXACTAMENTE esos bytes (aunque el payload diga otra cosa) y reporta diseño servidor', async () => {
    const tk = new ImpresoraMemoria();
    const { cliente, agente } = montar(tk);
    const c = comandosDeTrabajo('TICKET_PAGO', { ...ticket, codigo: 'DISENO-NUEVO' }, false, { ticketColumnas: 48 });
    cliente.tomarTrabajos.mockResolvedValueOnce([trabajo({ comandos: c })]);
    await agente.ejecutarCiclo();
    expect(tk.obtenerTrabajosEscritos()).toHaveLength(1);
    expect(tk.obtenerTrabajosEscritos()[0].toString('base64')).toBe(c.base64);
    expect(tk.obtenerTrabajosEscritos()[0].toString('latin1')).toContain('DISENO-NUEVO');
    expect(cliente.reportarResultado).toHaveBeenCalledWith('1', true, undefined, 'servidor');
  });

  it('sin comandos usa su diseño de siempre y reporta como antes (sin campo nuevo)', async () => {
    const tk = new ImpresoraMemoria();
    const { cliente, agente } = montar(tk);
    cliente.tomarTrabajos.mockResolvedValueOnce([trabajo()]);
    await agente.ejecutarCiclo();
    expect(tk.obtenerTrabajosEscritos()[0].equals(generarTicketEscPos(ticket, 48))).toBe(true);
    expect(cliente.reportarResultado).toHaveBeenCalledWith('1', true);
  });

  it('comandos inválidos (formato raro, base64 roto, enorme, formato de otra máquina): respaldo y lo reporta', async () => {
    const malos = [
      { formato: 'PDF', base64: 'AAAA' },
      { formato: 'ESCPOS', base64: '%%%%' },
      { formato: 'ESCPOS', base64: Buffer.alloc(LIMITE_COMANDOS_BYTES + 1, 1).toString('base64') },
      comandosDeTrabajo('ETIQUETA_GENERAL', { prueba: { impresoraId: 'x' } }, false), // TSPL a la ticketera
    ];
    for (const comandos of malos) {
      const tk = new ImpresoraMemoria();
      const { cliente, agente } = montar(tk);
      cliente.tomarTrabajos.mockResolvedValueOnce([trabajo({ comandos })]);
      await agente.ejecutarCiclo();
      expect(tk.obtenerTrabajosEscritos()).toHaveLength(1);
      expect(tk.obtenerTrabajosEscritos()[0].equals(generarTicketEscPos(ticket, 48))).toBe(true);
      expect(cliente.reportarResultado).toHaveBeenCalledWith('1', true, expect.any(String), 'respaldo');
    }
  });

  it('si la impresora rechaza los comandos reintenta UNA vez con su diseño y reporta respaldo', async () => {
    const tk = new ImpresoraMemoria();
    tk.simularErrorAlEscribir(new ErrorImpresora('formato raro', 'error'));
    const { cliente, agente } = montar(tk);
    const c = comandosDeTrabajo('TICKET_PAGO', ticket, false, { ticketColumnas: 48 });
    cliente.tomarTrabajos.mockResolvedValueOnce([trabajo({ comandos: c })]);
    await agente.ejecutarCiclo();
    expect(tk.obtenerTrabajosEscritos()).toHaveLength(1);
    expect(tk.obtenerTrabajosEscritos()[0].equals(generarTicketEscPos(ticket, 48))).toBe(true);
    expect(cliente.reportarResultado).toHaveBeenCalledWith('1', true, expect.stringContaining('formato raro'), 'respaldo');
  });

  it('si también falla el respaldo, el trabajo se reporta fallido como cualquier error de impresora', async () => {
    const tk = new ImpresoraMemoria();
    tk.escribir = vi.fn().mockRejectedValue(new ErrorImpresora('sin papel', 'sin_papel'));
    const { cliente, agente } = montar(tk);
    const c = comandosDeTrabajo('TICKET_PAGO', ticket, false, { ticketColumnas: 48 });
    cliente.tomarTrabajos.mockResolvedValueOnce([trabajo({ comandos: c })]);
    await agente.ejecutarCiclo();
    expect(tk.escribir).toHaveBeenCalledTimes(2);
    expect(cliente.reportarResultado).toHaveBeenCalledWith('1', false, 'sin papel');
  });

  it('los registros del programa no llevan el contenido de los comandos ni datos del pedido', async () => {
    const tk = new ImpresoraMemoria();
    tk.simularErrorAlEscribir(new ErrorImpresora('boom', 'error'));
    const { cliente, agente, logs } = montar(tk);
    const c = comandosDeTrabajo('TICKET_PAGO', ticket, false, { ticketColumnas: 48 });
    cliente.tomarTrabajos.mockResolvedValueOnce([trabajo({ comandos: c })]);
    await agente.ejecutarCiclo();
    const todo = logs.join('\n');
    expect(todo).not.toContain(c.base64.slice(0, 20));
    expect(todo).not.toContain('Ana');
  });
});
