import { describe, it, expect, vi, afterEach } from 'vitest';
import * as http from 'http';
import type { AddressInfo } from 'net';
import { AgenteLocalServicio } from '../bucle';
import { ClienteApiImpresion } from '../../api/clienteApi';
import { ImpresoraMemoria } from '../../impresora/impresoraMemoria';
import { ErrorImpresora } from '../../impresora/dispositivo.interface';
import type { TrabajoImpresion } from '@caprichos/compartido';

const config = {
  apiUrl: 'http://localhost:3000',
  agenteKey: 'llave-prueba',
  impresoraRuta: 'memoria://',
  intervaloConsultaMs: 10,
  intervaloLatidoMs: 0,
  maxTrabajosPorLote: 10,
  version: '0.1.0',
  ticketColumnas: 32,
  etiqueta: {} as any,
} as any;

const trabajo = (id: string): TrabajoImpresion => ({
  id,
  tipo: 'ETIQUETA_BEBIDA',
  payload: { bebidaIndex: 1, totalBebidas: 1, codigo: 'PED-1', persona: 'ANA', bebidaNombre: 'ESPRESSO', opciones: [], who: 'Para: Ana', hora: '10:00' },
  copia: false,
  intentos: 0,
});

const silencio = () => undefined;

describe('Bucle con cliente simulado: red caída y confirmación pendiente', () => {
  afterEach(() => vi.restoreAllMocks());

  function clienteSimulado() {
    return {
      tomarTrabajos: vi.fn().mockResolvedValue([]),
      reportarResultado: vi.fn().mockResolvedValue(undefined),
      enviarLatido: vi.fn().mockResolvedValue(undefined),
    };
  }

  it('si la confirmación falla tras imprimir, no reimprime y no toma trabajos nuevos hasta confirmarla', async () => {
    const cliente = clienteSimulado();
    const impresora = new ImpresoraMemoria();
    cliente.tomarTrabajos.mockResolvedValueOnce([trabajo('J1')]);
    cliente.reportarResultado
      .mockRejectedValueOnce(new Error('fetch failed'))
      .mockRejectedValueOnce(new Error('fetch failed'))
      .mockResolvedValue(undefined);
    const agente = new AgenteLocalServicio({ config, clienteApi: cliente, impresora, logger: silencio });

    await agente.ejecutarCiclo(); // imprime J1, la confirmación falla
    expect(impresora.obtenerTrabajosEscritos()).toHaveLength(1);

    const r2 = await agente.ejecutarCiclo(); // sigue sin red: no toma nada nuevo
    expect(r2.errorRed).toBe(true);
    expect(cliente.tomarTrabajos).toHaveBeenCalledTimes(1);

    await agente.ejecutarCiclo(); // vuelve la red: confirma J1 y entonces sí toma
    expect(cliente.reportarResultado.mock.calls.every(([id, ok]) => id === 'J1' && ok === true)).toBe(true);
    expect(cliente.tomarTrabajos).toHaveBeenCalledTimes(2);
    expect(impresora.obtenerTrabajosEscritos()).toHaveLength(1); // nunca dos veces
  });

  it('un fallo de impresión sí se reporta como ok=false una sola vez', async () => {
    const cliente = clienteSimulado();
    const impresora = new ImpresoraMemoria();
    cliente.tomarTrabajos.mockResolvedValueOnce([trabajo('J2')]);
    impresora.simularErrorAlEscribir(new ErrorImpresora('sin conexión', 'desconectada'));
    const agente = new AgenteLocalServicio({ config, clienteApi: cliente, impresora, logger: silencio });

    await agente.ejecutarCiclo();
    expect(cliente.reportarResultado).toHaveBeenCalledTimes(1);
    expect(cliente.reportarResultado).toHaveBeenCalledWith('J2', false, 'sin conexión');
  });

  it('el servidor rechaza la confirmación con 404 (trabajo borrado): se descarta y el bucle sigue', async () => {
    const cliente = clienteSimulado();
    const impresora = new ImpresoraMemoria();
    cliente.tomarTrabajos.mockResolvedValueOnce([trabajo('J3')]);
    const { ErrorRespuestaApi } = await import('../../api/clienteApi');
    cliente.reportarResultado.mockRejectedValueOnce(new ErrorRespuestaApi(404, 'no encontrado'));
    const agente = new AgenteLocalServicio({ config, clienteApi: cliente, impresora, logger: silencio });

    await agente.ejecutarCiclo();
    await agente.ejecutarCiclo();
    expect(cliente.tomarTrabajos).toHaveBeenCalledTimes(2);
  });

  it('iniciar() no se cae con la red caída y sigue con latidos cuando vuelve', async () => {
    const cliente = clienteSimulado();
    const impresora = new ImpresoraMemoria();
    let llamadasTomar = 0;
    cliente.tomarTrabajos.mockImplementation(async () => {
      llamadasTomar++;
      if (llamadasTomar <= 2) throw new Error('fetch failed'); // sin red dos ciclos
      return llamadasTomar === 3 ? [trabajo('J4')] : []; // vuelve la red y entrega un trabajo una vez
    });
    cliente.enviarLatido.mockRejectedValueOnce(new Error('fetch failed')).mockResolvedValue(undefined);
    let vueltas = 0;
    const agente = new AgenteLocalServicio({
      config,
      clienteApi: cliente,
      impresora,
      logger: silencio,
      temporizador: async () => {
        vueltas++;
        if (vueltas === 6) agente.detener();
      },
    });

    await expect(agente.iniciar()).resolves.toBeUndefined();
    expect(cliente.enviarLatido.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(impresora.obtenerTrabajosEscritos()).toHaveLength(1);
    expect(cliente.reportarResultado).toHaveBeenCalledWith('J4', true);
  });
});

describe('Bucle contra una API HTTP real que se cae y vuelve', () => {
  let srv: http.Server | null = null;
  afterEach(async () => {
    if (srv) await new Promise((r) => srv!.close(r));
    srv = null;
  });

  /** API mínima: un trabajo pendiente; `caida` hace que el servidor corte cada petición (como sin internet). */
  function apiSimulada() {
    const estado = { caida: false, cortarTrasTomar: true, trabajos: new Map<string, 'PENDIENTE' | 'IMPRIMIENDO' | 'IMPRESO'>([['J9', 'PENDIENTE']]), tomas: 0, resultadosOk: 0, resultadosFallo: 0, latidos: 0 };
    srv = http.createServer((req, res) => {
      if (estado.caida) {
        req.socket.destroy();
        return;
      }
      let cuerpo = '';
      req.on('data', (c) => (cuerpo += c));
      req.on('end', () => {
        const datos = cuerpo ? JSON.parse(cuerpo) : {};
        if (req.url?.endsWith('/tomar')) {
          const ids = [...estado.trabajos].filter(([, e]) => e === 'PENDIENTE').map(([id]) => id);
          ids.forEach((id) => estado.trabajos.set(id, 'IMPRIMIENDO'));
          estado.tomas++;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ trabajos: ids.map((id) => ({ ...trabajo(id), id })) }));
          if (estado.cortarTrasTomar) estado.caida = true; // la red se corta justo después de entregar el trabajo
          return;
        }
        if (req.url?.endsWith('/resultado')) {
          if (datos.ok) { estado.trabajos.set(datos.id, 'IMPRESO'); estado.resultadosOk++; } else { estado.resultadosFallo++; }
          res.statusCode = 204;
          res.end();
          return;
        }
        estado.latidos++;
        res.statusCode = 204;
        res.end();
      });
    });
    return new Promise<{ url: string; estado: typeof estado }>((resolve) => {
      srv!.listen(0, '127.0.0.1', () => resolve({ url: `http://127.0.0.1:${(srv!.address() as AddressInfo).port}`, estado }));
    });
  }

  it('la caída entre tomar y confirmar: sin duplicar, sin cerrarse y confirma al volver', async () => {
    const { url, estado } = await apiSimulada();
    const cliente = new ClienteApiImpresion(url, 'llave', 1000);
    const impresora = new ImpresoraMemoria();
    const agente = new AgenteLocalServicio({ config: { ...config, apiUrl: url }, clienteApi: cliente, impresora, logger: silencio });

    // Caída: la confirmación no llega y el programa sigue vivo
    await expect(agente.ejecutarCiclo()).resolves.toBeDefined();
    expect(impresora.obtenerTrabajosEscritos()).toHaveLength(1);
    expect(estado.trabajos.get('J9')).toBe('IMPRIMIENDO');

    for (let i = 0; i < 3; i++) await agente.ejecutarCiclo();
    expect(estado.tomas).toBe(1); // no pidió trabajos nuevos mientras no confirmaba

    // Vuelve la red: confirma J9 antes de cualquier otra cosa
    estado.caida = false;
    await agente.ejecutarCiclo();
    expect(estado.trabajos.get('J9')).toBe('IMPRESO');
    expect(estado.resultadosFallo).toBe(0);
    expect(impresora.obtenerTrabajosEscritos()).toHaveLength(1); // impreso una sola vez
    expect(estado.latidos).toBeGreaterThanOrEqual(1);
  });

  it('sin red desde el arranque: ciclos con espera creciente, no lanza y retoma al volver', async () => {
    const { url, estado } = await apiSimulada();
    estado.caida = true;
    estado.cortarTrasTomar = false;
    const cliente = new ClienteApiImpresion(url, 'llave', 1000);
    const impresora = new ImpresoraMemoria();
    const agente = new AgenteLocalServicio({ config: { ...config, apiUrl: url }, clienteApi: cliente, impresora, logger: silencio });

    const esperas: number[] = [];
    for (let i = 0; i < 3; i++) {
      await agente.ejecutarCiclo();
      esperas.push(agente.obtenerEsperaActualMs());
    }
    expect(esperas[2]).toBeGreaterThan(esperas[0]);
    expect(impresora.obtenerTrabajosEscritos()).toHaveLength(0);

    estado.caida = false;
    await agente.ejecutarCiclo();
    expect(agente.obtenerEsperaActualMs()).toBe(config.intervaloConsultaMs);
    expect(estado.trabajos.get('J9')).toBe('IMPRESO');
    expect(impresora.obtenerTrabajosEscritos()).toHaveLength(1);
  });
});
