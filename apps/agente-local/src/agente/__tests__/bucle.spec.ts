import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgenteLocalServicio } from '../bucle';
import { ImpresoraMemoria } from '../../impresora/impresoraMemoria';
import { ErrorImpresora } from '../../impresora/dispositivo.interface';
import type { IClienteApiImpresion } from '../../api/clienteApi';
import type { TrabajoImpresion } from '@caprichos/compartido';

describe('AgenteLocalServicio (Bucle de impresion)', () => {
  let impresora: ImpresoraMemoria;
  let mockCliente: IClienteApiImpresion;
  let logs: string[];

  const trabajoMock: TrabajoImpresion = {
    id: 'job-123',
    tipo: 'ETIQUETA_BEBIDA',
    payload: {
      bebidaIndex: 1,
      totalBebidas: 1,
      codigo: 'PED-555',
      persona: 'CARLOS',
      bebidaNombre: 'ESPRESSO',
      opciones: [],
      who: 'Para: Carlos',
      hora: '10:00',
    },
    copia: false,
    intentos: 0,
  };

  beforeEach(() => {
    impresora = new ImpresoraMemoria();
    logs = [];

    mockCliente = {
      tomarTrabajos: vi.fn().mockResolvedValue([]),
      reportarResultado: vi.fn().mockResolvedValue(undefined),
      enviarLatido: vi.fn().mockResolvedValue(undefined),
    };
  });

  it('procesa trabajos con exito, escribe en impresora y reporta resultado ok=true', async () => {
    (mockCliente.tomarTrabajos as any).mockResolvedValueOnce([trabajoMock]);

    const agente = new AgenteLocalServicio({
      config: {
        apiUrl: 'http://localhost:3000',
        agenteKey: 'test-key',
        impresoraRuta: 'memoria://',
        intervaloConsultaMs: 1000,
        intervaloLatidoMs: 20000,
        maxTrabajosPorLote: 10,
        version: '0.1.0',
      },
      clienteApi: mockCliente,
      impresora,
      logger: (_nivel, msg) => logs.push(msg),
    });

    const resultado = await agente.ejecutarCiclo();
    expect(resultado.trabajosProcesados).toBe(1);

    // Debe haber escrito bytes a la impresora
    expect(impresora.obtenerTrabajosEscritos()).toHaveLength(1);
    expect(impresora.obtenerTrabajosEscritos()[0].toString()).toContain('ESPRESSO');

    // Debe haber reportado ok=true
    expect(mockCliente.reportarResultado).toHaveBeenCalledWith('job-123', true);
  });

  it('cuando falla la impresora, reporta ok=false sin botar el trabajo ni caerse el agente', async () => {
    (mockCliente.tomarTrabajos as any).mockResolvedValueOnce([trabajoMock]);
    impresora.simularErrorAlEscribir(
      new ErrorImpresora('Impresora desconectada: /dev/usb/lp0 no existe', 'desconectada', 'ENOENT')
    );

    const agente = new AgenteLocalServicio({
      config: {
        apiUrl: 'http://localhost:3000',
        agenteKey: 'test-key',
        impresoraRuta: 'memoria://',
        intervaloConsultaMs: 1000,
        intervaloLatidoMs: 20000,
        maxTrabajosPorLote: 10,
        version: '0.1.0',
      },
      clienteApi: mockCliente,
      impresora,
      logger: (_nivel, msg) => logs.push(msg),
    });

    const resultado = await agente.ejecutarCiclo();
    expect(resultado.trabajosProcesados).toBe(1);

    // Debe haber reportado ok=false con el detalle del error
    expect(mockCliente.reportarResultado).toHaveBeenCalledWith(
      'job-123',
      false,
      expect.stringContaining('Impresora desconectada')
    );
    // El agente permanece vivo y actualiza su estado
    expect(agente.obtenerEstadoImpresora()).toBe('desconectada');
  });

  it('cuando no hay red, reintenta con espera creciente y nunca se cae', async () => {
    (mockCliente.tomarTrabajos as any).mockRejectedValue(new Error('fetch failed ECONNREFUSED'));

    const agente = new AgenteLocalServicio({
      config: {
        apiUrl: 'http://localhost:3000',
        agenteKey: 'test-key',
        impresoraRuta: 'memoria://',
        intervaloConsultaMs: 3000,
        intervaloLatidoMs: 20000,
        maxTrabajosPorLote: 10,
        version: '0.1.0',
      },
      clienteApi: mockCliente,
      impresora,
      logger: (_nivel, msg) => logs.push(msg),
    });

    // Primer intento sin red
    const r1 = await agente.ejecutarCiclo();
    expect(r1.errorRed).toBe(true);
    expect(agente.obtenerEsperaActualMs()).toBeGreaterThanOrEqual(3000);

    // Segundo intento sin red: la espera crece
    const espera1 = agente.obtenerEsperaActualMs();
    const r2 = await agente.ejecutarCiclo();
    expect(r2.errorRed).toBe(true);
    expect(agente.obtenerEsperaActualMs()).toBeGreaterThan(espera1);

    // Cuando la red vuelve: se restablece la espera
    (mockCliente.tomarTrabajos as any).mockResolvedValueOnce([]);
    const r3 = await agente.ejecutarCiclo();
    expect(r3.errorRed).toBe(false);
    expect(agente.obtenerEsperaActualMs()).toBe(3000);
  });

  it('envia latido con el estado de la impresora segun el intervalo', async () => {
    const agente = new AgenteLocalServicio({
      config: {
        apiUrl: 'http://localhost:3000',
        agenteKey: 'test-key',
        impresoraRuta: 'memoria://',
        intervaloConsultaMs: 3000,
        intervaloLatidoMs: 20000,
        maxTrabajosPorLote: 10,
        version: '0.1.0',
      },
      clienteApi: mockCliente,
      impresora,
      logger: (_nivel, msg) => logs.push(msg),
    });

    // Primer ciclo: debe enviar latido inicial
    await agente.ejecutarCiclo();
    expect(mockCliente.enviarLatido).toHaveBeenCalledWith('0.1.0', 'lista', undefined);

    // Ciclo inmediato siguiente: no debe reenviar porque aún no pasaron 20s
    (mockCliente.enviarLatido as any).mockClear();
    await agente.ejecutarCiclo();
    expect(mockCliente.enviarLatido).not.toHaveBeenCalled();

    // Simulamos paso del tiempo (más de 20 segundos)
    agente.forzarTiempoUltimoLatido(Date.now() - 25000);
    await agente.ejecutarCiclo();
    expect(mockCliente.enviarLatido).toHaveBeenCalledWith('0.1.0', 'lista', undefined);
  });
});
