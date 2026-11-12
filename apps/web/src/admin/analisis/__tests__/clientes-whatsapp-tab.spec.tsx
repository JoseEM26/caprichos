import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ClientesTab } from '../clientes/ClientesTab';
import { WhatsappTab } from '../whatsapp/WhatsappTab';
import { PESTANAS_ANALISIS } from '../registro';
import { api } from '../../../comun/api';

vi.mock('../../../comun/socket', () => ({ useTiempoReal: vi.fn(), useEventos: vi.fn() }));

const filtros = { preset: 'hoy' as const, desde: '2026-11-02', hasta: '2026-11-11', modalidad: '', canal: '', turno: '' };

const clientes = {
  generadoEn: '2026-11-11T20:00:00Z',
  rango: { desde: '2026-11-02', hasta: '2026-11-11', dias: 10 },
  truncado: false,
  limite: 20000,
  clientes: { total: 30, nuevos: 10, recurrentes: 20, pctRecurrentes: 66.7, pedidosSinIdentificar: 4 },
  semanas: [
    { semana: '2026-11-02', nuevos: 4, recurrentes: 9 },
    { semana: '2026-11-09', nuevos: 6, recurrentes: 11 },
  ],
  regreso: {
    n: 25,
    medianaDias: 9.5,
    p90Dias: 30,
    tramos: [
      { nombre: 'Hasta 7 días', n: 10 },
      { nombre: '8 a 14 días', n: 8 },
      { nombre: '15 a 30 días', n: 5 },
      { nombre: 'Más de 30 días', n: 2 },
    ],
  },
  embudo: {
    pasos: [
      { id: 'creados', nombre: 'Pedidos creados en la carta', n: 20, pctDelAnterior: null, pctDeCreados: 100 },
      { id: 'pagados', nombre: 'Con pago confirmado', n: 15, pctDelAnterior: 75, pctDeCreados: 75 },
      { id: 'entregados', nombre: 'Entregados', n: 12, pctDelAnterior: 80, pctDeCreados: 60 },
    ],
    anulados: 3,
    noSeGuarda: ['Visitas o aperturas de la carta (la carta no registra eventos de visita).'],
  },
  puntos: { emitidos: 500, canjeados: 120, pctCanjeado: 24, saldoVivo: 800, cuentasConSaldo: 40, costoCanjeadoPen: 120, costoPendientePen: 800, semanas: [{ semana: '2026-11-09', emitidos: 300, canjeados: 80 }] },
  calificaciones: {
    encuestas: {
      enviadas: 20,
      respondidas: 10,
      pctRespuesta: 50,
      promedio: 4.2,
      semanas: [{ semana: '2026-11-09', respuestas: 10, promedio: 4.2 }],
      distribucion: [1, 2, 3, 4, 5].map((p) => ({ puntaje: p, n: 2 })),
    },
    demora: { conDemora: { n: 2, promedio: 3 }, sinDemora: { n: 8, promedio: 4.6 } },
    google: { n: 3, promedio: 4.7 },
  },
};

const horas = (extra: Record<number, any> = {}) =>
  Array.from({ length: 24 }, (_, hora) => ({ hora, n: 0, promedio: null, mediana: null, p90: null, maximo: null, ...(extra[hora] ?? {}) }));

const whatsapp = (extra: Record<string, unknown> = {}) => ({
  generadoEn: '2026-11-11T20:00:00Z',
  rango: { desde: '2026-11-11', hasta: '2026-11-11', dias: 1 },
  respuesta: {
    truncado: false,
    limite: 20000,
    rachas: 12,
    atendidasPorPersona: 8,
    atendidasPorBot: 3,
    sinRespuesta: 1,
    equipo: { n: 8, promedio: 6, mediana: 4, p90: 15, maximo: 20 },
    porHora: horas({ 14: { n: 8, promedio: 6, mediana: 4, p90: 15, maximo: 20 } }),
    personas: [{ id: '7', nombre: 'Ana Ruiz', n: 5, promedio: 5, mediana: 3, p90: 10, maximo: 12 }],
  },
  bot: { chats: 10, soloBot: 6, conPersona: 3, sinRespuesta: 1, pctSoloBot: 60, pctConPersona: 30, pctSinRespuesta: 10 },
  derivaciones: { total: 4, motivos: [{ motivo: 'CONSULTA_IA_FALLIDA', n: 4, chats: 3 }] },
  volumen: Array.from({ length: 24 }, (_, hora) => ({ hora, cliente: hora === 14 ? 9 : 0, bot: hora === 14 ? 5 : 0, persona: hora === 14 ? 4 : 0 })),
  salientes: { total: 30, tipos: [{ tipo: 'TEXTO', n: 20 }, { tipo: 'PLANTILLA', n: 10 }], plantillas: [{ plantilla: 'caprichos_encuesta_posventa', n: 10 }] },
  consumoMes: { mes: '2026-11', total: 120, gratisMes: 1000, porcentaje: 12, proyeccionFinDeMes: 330, costoEstimadoPen: 0 },
  ...extra,
});

const espera = {
  generadoEn: '2026-11-11T20:00:00Z',
  total: 1,
  hayMas: false,
  limite: 50,
  items: [{ id: '1', celular: '+519******21', minutos: 12, motivo: 'Validar pago', enlace: '/admin/mensajes' }],
};

function servidor(principal: unknown, vivo: unknown = espera) {
  return vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
    if (url.startsWith('/admin/analisis/whatsapp/sin-respuesta')) {
      if (vivo instanceof Error) throw vivo;
      return vivo;
    }
    if (principal instanceof Error) throw principal;
    return principal;
  });
}

describe('Registro de pestañas', () => {
  it('Clientes y WhatsApp están registradas', () => {
    const ids = PESTANAS_ANALISIS.map((p) => p.id);
    expect(ids).toContain('clientes');
    expect(ids).toContain('whatsapp');
  });
});

describe('Pestaña Clientes', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('con datos: KPIs, semanas, cada cuánto regresan, embudo, puntos y calificaciones', async () => {
    servidor(clientes);
    render(<ClientesTab filtros={filtros} esAdmin={false} />);
    expect(await screen.findByText('Clientes que pidieron')).toBeInTheDocument();
    expect(screen.getByText('4 pedidos sin cuenta ni celular')).toBeInTheDocument();
    expect(screen.getByText(/66[.,]7 % de los clientes/)).toBeInTheDocument();
    expect(screen.getAllByText(/9[.,]5 días/).length).toBeGreaterThan(0);
    const semanas = screen.getByRole('list', { name: /Clientes por semana/ });
    expect(within(semanas).getByText('4 nuevos · 9 recurrentes')).toBeInTheDocument();
    expect(within(screen.getByRole('list', { name: /Reencuentros por tramo/ })).getByText('Hasta 7 días')).toBeInTheDocument();
    expect(screen.getByText(/^S\/ 120[.,]00$/)).toBeInTheDocument();
    expect(screen.getByText(/Pendiente si todo el saldo se canjea: S\/ 800[.,]00/)).toBeInTheDocument();
    expect(screen.getByText(/4[.,]2 de 5/)).toBeInTheDocument();
    expect(screen.getAllByText('50 %').length).toBeGreaterThan(0);
    expect(screen.getByRole('list', { name: /Puntaje promedio según si hubo demora/ })).toBeInTheDocument();
  });

  it('el embudo abre un detalle inline (no un modal) con lo que todavía no se guarda', async () => {
    servidor(clientes);
    render(<ClientesTab filtros={filtros} esAdmin={false} />);
    const embudo = await screen.findByRole('list', { name: /Pedidos de la carta en cada paso/ });
    expect(within(embudo).getByText('75 % del paso anterior')).toBeInTheDocument();
    fireEvent.click(within(embudo).getByRole('button', { name: /Con pago confirmado/ }));
    const detalle = screen.getByRole('region', { name: /Detalle: Con pago confirmado/ });
    expect(within(detalle).getByText(/no registra eventos de visita/)).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(within(detalle).getByRole('button', { name: /Cerrar detalle/ }));
    expect(screen.queryByRole('region', { name: /Detalle:/ })).toBeNull();
  });

  it('sin datos: estados vacíos y «Sin dato», nunca ceros inventados', async () => {
    servidor({
      ...clientes,
      clientes: { total: 0, nuevos: 0, recurrentes: 0, pctRecurrentes: null, pedidosSinIdentificar: 0 },
      semanas: [],
      regreso: { n: 0, medianaDias: null, p90Dias: null, tramos: [] },
      embudo: { ...clientes.embudo, pasos: clientes.embudo.pasos.map((p) => ({ ...p, n: 0, pctDelAnterior: null, pctDeCreados: null })), anulados: 0 },
      puntos: { ...clientes.puntos, emitidos: 0, canjeados: 0, pctCanjeado: null, semanas: [] },
      calificaciones: {
        encuestas: { enviadas: 0, respondidas: 0, pctRespuesta: null, promedio: null, semanas: [], distribucion: [] },
        demora: { conDemora: { n: 0, promedio: null }, sinDemora: { n: 0, promedio: null } },
        google: { n: 0, promedio: null },
      },
    });
    render(<ClientesTab filtros={filtros} esAdmin={false} />);
    expect(await screen.findByText('No hay pedidos de clientes identificados en este período.')).toBeInTheDocument();
    expect(screen.getByText('Aún nadie repitió pedido')).toBeInTheDocument();
    expect(screen.getByText('No hubo pedidos de la carta en este período.')).toBeInTheDocument();
    expect(screen.getByText('Nadie respondió la encuesta en este período.')).toBeInTheDocument();
    expect(screen.getAllByText('Sin dato').length).toBeGreaterThanOrEqual(3);
  });

  it('avisa si se leyó solo una parte de los clientes', async () => {
    servidor({ ...clientes, truncado: true });
    render(<ClientesTab filtros={filtros} esAdmin={false} />);
    expect(await screen.findByText(/se leyó una parte/)).toBeInTheDocument();
  });

  it('error: mensaje con Reintentar que vuelve a consultar; los filtros viajan en la dirección', async () => {
    const espia = servidor(new Error('Falló'));
    render(<ClientesTab filtros={{ ...filtros, modalidad: 'DELIVERY', turno: 'NOCHE' }} esAdmin={false} />);
    expect(await screen.findByText('No se pudo analizar a los clientes')).toBeInTheDocument();
    const url = espia.mock.calls[0][0] as string;
    expect(url).toContain('/admin/analisis/clientes?');
    expect(url).toContain('desde=2026-11-02');
    expect(url).toContain('modalidad=DELIVERY');
    expect(url).toContain('turno=NOCHE');
    const antes = espia.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: /Reintentar/ }));
    await waitFor(() => expect(espia.mock.calls.length).toBeGreaterThan(antes));
  });

  it('no muestra ningún celular completo', async () => {
    servidor(clientes);
    const { container } = render(<ClientesTab filtros={filtros} esAdmin={false} />);
    await screen.findByText('Clientes que pidieron');
    expect(container.textContent).not.toMatch(/9\d{8}/);
  });
});

describe('Pestaña WhatsApp', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('con datos: KPIs, espera por hora con detalle inline, bot vs persona, motivos, volumen y mensajes', async () => {
    servidor(whatsapp());
    render(<WhatsappTab filtros={filtros} esAdmin={false} />);
    expect(await screen.findByText('Respuesta del equipo (mediana)')).toBeInTheDocument();
    expect(screen.getAllByText('4 min').length).toBeGreaterThan(0);
    expect(screen.getAllByText('60 %')[0]).toBeInTheDocument();
    const horas = screen.getByRole('list', { name: /Mediana de espera por hora/ });
    fireEvent.click(within(horas).getByRole('button', { name: /14:00/ }));
    const detalle = screen.getByRole('region', { name: /Detalle: Hora 14:00/ });
    expect(within(detalle).getByText(/8 consultas\. Mediana 4 min/)).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(within(screen.getByRole('list', { name: /Chats según quién respondió/ })).getByText('Solo el bot')).toBeInTheDocument();
    expect(screen.getAllByText('Consulta ia fallida').length).toBeGreaterThan(0);
    expect(screen.getByRole('region', { name: /Mensajes por hora del día/ })).toBeInTheDocument();
    expect(screen.getByText(/Este mes \(2026-11\) van 120/)).toBeInTheDocument();
    expect(screen.getByText('caprichos_encuesta_posventa')).toBeInTheDocument();
  });

  it('chats sin respuesta ahora: celular enmascarado, minutos de espera y enlace a Mensajes', async () => {
    servidor(whatsapp());
    render(<WhatsappTab filtros={filtros} esAdmin={false} />);
    expect(await screen.findByText('+519******21')).toBeInTheDocument();
    expect(screen.getByText(/Espera hace 12 min · Validar pago/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Abrir Mensajes para atender \+519\*+21/ })).toHaveAttribute('href', '/admin/mensajes');
  });

  it('sin chats esperando: estado vacío positivo', async () => {
    servidor(whatsapp(), { ...espera, total: 0, items: [] });
    render(<WhatsappTab filtros={filtros} esAdmin={false} />);
    expect(await screen.findByText('Ningún chat espera respuesta. Todo al día.')).toBeInTheDocument();
  });

  it('el desglose por persona solo lo ve el ADMIN', async () => {
    servidor(whatsapp());
    const { unmount } = render(<WhatsappTab filtros={filtros} esAdmin={true} />);
    const lista = await screen.findByRole('list', { name: /Mediana de espera de cada persona/ });
    expect(within(lista).getByText('Ana Ruiz')).toBeInTheDocument();
    unmount();
    servidor(whatsapp({ respuesta: { ...whatsapp().respuesta, personas: null } }));
    render(<WhatsappTab filtros={filtros} esAdmin={false} />);
    expect(await screen.findByText('El detalle por persona lo ve solo el administrador.')).toBeInTheDocument();
    expect(screen.queryByText('Ana Ruiz')).toBeNull();
  });

  it('sin mensajes: estados vacíos y Sin dato', async () => {
    servidor(
      whatsapp({
        respuesta: { ...whatsapp().respuesta, rachas: 0, atendidasPorPersona: 0, atendidasPorBot: 0, sinRespuesta: 0, equipo: { n: 0, promedio: null, mediana: null, p90: null, maximo: null }, porHora: horas(), personas: [] },
        bot: { chats: 0, soloBot: 0, conPersona: 0, sinRespuesta: 0, pctSoloBot: null, pctConPersona: null, pctSinRespuesta: null },
        derivaciones: { total: 0, motivos: [] },
        volumen: Array.from({ length: 24 }, (_, hora) => ({ hora, cliente: 0, bot: 0, persona: 0 })),
        salientes: { total: 0, tipos: [], plantillas: [] },
      }),
      { ...espera, total: 0, items: [] },
    );
    render(<WhatsappTab filtros={filtros} esAdmin={true} />);
    expect(await screen.findByText('Nadie respondió a mano en este período')).toBeInTheDocument();
    expect(screen.getAllByText('Ninguna persona respondió chats en este período.').length).toBe(2);
    expect(screen.getByText('El bot no derivó chats en este período.')).toBeInTheDocument();
    expect(screen.getByText('No hubo mensajes en este período.')).toBeInTheDocument();
    expect(screen.getByText('No se envió ningún mensaje en este período.')).toBeInTheDocument();
  });

  it('error del resumen: Reintentar; la lista de espera sigue visible', async () => {
    const espia = servidor(new Error('Falló'));
    render(<WhatsappTab filtros={filtros} esAdmin={false} />);
    expect(await screen.findByText('No se pudo analizar WhatsApp')).toBeInTheDocument();
    expect(screen.getByText('+519******21')).toBeInTheDocument();
    const antes = espia.mock.calls.length;
    fireEvent.click(screen.getAllByRole('button', { name: /Reintentar/ })[0]);
    await waitFor(() => expect(espia.mock.calls.length).toBeGreaterThan(antes));
    expect((espia.mock.calls[0][0] as string)).toMatch(/\/admin\/analisis\/whatsapp\?desde=2026-11-02&hasta=2026-11-11$|sin-respuesta/);
  });

  it('error de la lista de espera: mensaje propio sin romper el resto', async () => {
    servidor(whatsapp(), new Error('Sin conexión'));
    render(<WhatsappTab filtros={filtros} esAdmin={false} />);
    expect(await screen.findByText('Respuesta del equipo (mediana)')).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByRole('button', { name: /Reintentar/ }).length).toBeGreaterThan(0));
  });

  it('avisa si se midieron solo las consultas más antiguas', async () => {
    servidor(whatsapp({ respuesta: { ...whatsapp().respuesta, truncado: true } }));
    render(<WhatsappTab filtros={filtros} esAdmin={false} />);
    expect(await screen.findByText(/se midieron las más antiguas/)).toBeInTheDocument();
  });
});
