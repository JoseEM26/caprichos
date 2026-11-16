import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { SaludBot } from '../whatsapp/SaludBot';
import { api } from '../../../comun/api';

vi.mock('../../../comun/socket', () => ({ useTiempoReal: vi.fn(), useEventos: vi.fn() }));

const filtros = { preset: '7d' as const, desde: '2026-11-10', hasta: '2026-11-11', modalidad: '', canal: '', turno: '' };

const salud = (extra: Record<string, unknown> = {}) => ({
  generadoEn: '2026-11-11T20:00:00Z',
  rango: { desde: '2026-11-10', hasta: '2026-11-11', dias: 2 },
  proveedor: 'EVOLUTION',
  topes: { minuto: 3, hora: 60, dia: 100 },
  uso: {
    dia: { max: 92, fecha: '2026-11-10', tope: 100, pct: 92, nivel: 'critico' },
    hora: { max: 45, fecha: null, tope: 60, pct: 75, nivel: 'atencion' },
    minuto: { max: 2, fecha: null, tope: 3, pct: 66.7, nivel: 'ok' },
  },
  porDia: [
    { fecha: '2026-11-10', enviados: 92, pct: 92, nivel: 'critico' },
    { fecha: '2026-11-11', enviados: 20, pct: 20, nivel: 'ok' },
  ],
  porHoraDelDia: Array.from({ length: 24 }, (_, hora) => ({ hora, total: hora === 10 ? 60 : 0, pico: hora === 10 ? 45 : 0, pctPico: hora === 10 ? 75 : 0, nivel: hora === 10 ? 'atencion' : 'ok' })),
  cola: {
    enviados: 112,
    fallidos: 4,
    descartados: 25,
    pendientes: 2,
    pctFallidos: 2.8,
    motivosDescartados: [{ codigo: 'FUERA_DE_VENTANA_24H', n: 20 }, { codigo: 'SIN_CONTACTO_PREVIO', n: 5 }],
    motivosFallidos: [{ codigo: 'NUMERO_INVALIDO', n: 4 }],
  },
  proporcion: {
    totalEnviados: 112,
    respuestas: 60,
    pedidosPorElCliente: 2,
    alEquipo: 3,
    iniciados: 47,
    pctIniciados: 42,
    entrantes: 80,
    salientesPorEntrante: 1.4,
    sinContactoPrevio: { numeros: 3, mensajes: 12, numerosRevisados: 40, truncado: false },
    porOrigen: [],
  },
  bot: {
    total: 100,
    cerrado: 10,
    bienvenida: 5,
    encuesta: 5,
    avisoPedido: 20,
    ia: 30,
    menu: 30,
    turnosPorConversacion: { conversaciones: 10, promedio: 3, maximo: 7 },
    derivadasAPersona: 4,
    iaDerivo: 2,
    iaErrores: 1,
  },
  conexion: { pausasAutomaticas: 1, pausasManuales: 0, desconexiones: 1, reconexiones: 1, reanudaciones: 1, ultimos: [{ accion: 'pausa_automatica', en: '2026-11-11T17:00:00Z', motivo: 'FALLOS' }] },
  encuestas: { enviadas: 20, respondidas: 8, tasaRespuesta: 40, promedio: 4.25 },
  recomendaciones: [
    { nivel: 'alta', texto: 'Se usó el 92 % del tope diario el 2026-11-10 (92 de 100). Baja los avisos promocionales.' },
    { nivel: 'alta', texto: '12 mensajes iniciados por nosotros a 3 números que nunca escribieron.' },
  ],
  ...extra,
});

describe('Salud del bot', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('muestra los topes, la alerta con texto, las recomendaciones y el indicador de baneo', async () => {
    const espia = vi.spyOn(api, 'get').mockResolvedValue(salud() as any);
    render(<SaludBot filtros={filtros} />);
    expect(await screen.findByText('Uso del tope diario (día más alto)')).toBeInTheDocument();
    expect(espia.mock.calls[0][0]).toContain('/admin/analisis/whatsapp/salud');
    expect(screen.getAllByText(/92 %/).length).toBeGreaterThan(0);
    const dias = screen.getByRole('list', { name: 'Mensajes enviados por día' });
    expect(within(dias).getByText(/Crítico \(90 % o más\)/)).toBeInTheDocument();
    expect(within(dias).getAllByText('Tope diario: 100').length).toBe(2);
    expect(screen.getByText(/12 mensajes iniciados por nosotros a 3 números/)).toBeInTheDocument();
    expect(screen.getAllByText('Iniciados a quien nunca escribió').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Debe ser 0').length).toBeGreaterThan(0);
  });

  it('descartes por motivo, bot por tipo, pausas y encuestas en texto', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(salud() as any);
    render(<SaludBot filtros={filtros} />);
    await screen.findByText('Por qué se descartó o falló');
    const motivos = screen.getByRole('list', { name: 'Motivos de descarte y fallo' });
    expect(within(motivos).getByText('Fuera de ventana 24h')).toBeInTheDocument();
    expect(screen.getByText(/promedio 3, máximo 7 \(10 conversaciones\)/)).toBeInTheDocument();
    expect(screen.getAllByText('Pausa automática').length).toBeGreaterThan(0);
    expect(screen.getByText(/Tasa de respuesta 40 %/)).toBeInTheDocument();
    expect(screen.getByText(/Promedio 4[.,]25 de 5/)).toBeInTheDocument();
  });

  it('sin envíos: estados vacíos y recomendación tranquila', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(
      salud({
        uso: { dia: { max: 0, fecha: '2026-11-10', tope: 100, pct: 0, nivel: 'ok' }, hora: { max: 0, fecha: null, tope: 60, pct: 0, nivel: 'ok' }, minuto: { max: 0, fecha: null, tope: 3, pct: 0, nivel: 'ok' } },
        porDia: [{ fecha: '2026-11-10', enviados: 0, pct: 0, nivel: 'ok' }],
        porHoraDelDia: [],
        proporcion: { ...salud().proporcion, totalEnviados: 0, entrantes: 0, iniciados: 0, pctIniciados: null, salientesPorEntrante: null, sinContactoPrevio: { numeros: 0, mensajes: 0, numerosRevisados: 0, truncado: false } },
        bot: { ...salud().bot, total: 0 },
        conexion: { ...salud().conexion, ultimos: [] },
        encuestas: { enviadas: 0, respondidas: 0, tasaRespuesta: null, promedio: null },
        recomendaciones: [{ nivel: 'info', texto: 'Sin señales de riesgo en este período.' }],
      }) as any,
    );
    render(<SaludBot filtros={filtros} />);
    expect(await screen.findByText('Sin señales de riesgo en este período.')).toBeInTheDocument();
    expect(screen.getAllByText('No salió ningún mensaje en este período.').length).toBe(2);
    expect(screen.getByText('Sin pausas ni desconexiones registradas en este período.')).toBeInTheDocument();
  });
});
