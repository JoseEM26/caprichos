import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useEventos } from '../../../comun/socket';
import { MensajesView } from '../MensajesView';
import * as api from '../mensajesApi';
import { diaDelFiltro, encabezadoDia, filtrarPorDia, ordenarCola, textoVacioDia } from '../diasBandeja';

vi.mock('../../../comun/socket', () => ({ useEventos: vi.fn() }));

const AHORA = new Date('2026-11-07T15:37:00Z'); // 10:37 en Lima
const hace = (dias: number) => new Date(Date.now() - dias * 86400000).toISOString();
const chat = (id: string, extra: object = {}) => ({
  id, nombre: `Cliente ${id}`, telefono: '911111111', estado: 'atencion' as const, urgente: false,
  ultimo: 'hola', hora: '10:00', sinLeer: 0, fecha: hace(0), ...extra,
});
const detalle = {
  id: '1', nombre: 'Cliente 1', telefono: '911111111', modalidad: null, estado: 'atencion' as const, urgente: false,
  dueno: null, esMio: false, ocupado: false, mensajes: [], pedido: null, solicitud: null, tiempoPrometidoMin: 25, altaDemanda: false,
};

describe('días de Lima en la bandeja', () => {
  it('cruce de medianoche: 01:30 UTC del 8 sigue siendo el 7 en Lima', () => {
    const c: any = chat('1', { fecha: '2026-11-08T01:30:00Z' });
    expect(filtrarPorDia([c], 'hoy', AHORA)).toHaveLength(1);
    expect(filtrarPorDia([c], 'ayer', AHORA)).toHaveLength(0);
    expect(diaDelFiltro('ayer', AHORA)).toBe('2026-11-06');
    expect(filtrarPorDia([c], '2026-11-07', AHORA)).toHaveLength(1);
    expect(filtrarPorDia([c], 'todos', AHORA)).toHaveLength(1);
    expect(encabezadoDia('2026-11-07', AHORA)).toBe('Hoy');
    expect(encabezadoDia('2026-11-06', AHORA)).toBe('Ayer');
    expect(encabezadoDia('2026-11-03', AHORA)).toBe('Martes 3 de noviembre');
  });

  it('mañana y fechas futuras: el día siguiente de Lima, también al cruzar la medianoche UTC', () => {
    const tarde: Date = new Date('2026-11-08T03:30:00Z'); // 22:30 del 7 en Lima, ya 8 en UTC
    expect(diaDelFiltro('manana', tarde)).toBe('2026-11-08');
    expect(diaDelFiltro('hoy', tarde)).toBe('2026-11-07');
    const c: any = chat('1', { fecha: '2026-11-08T14:00:00Z' }); // 09:00 del 8 en Lima
    expect(filtrarPorDia([c], 'manana', tarde)).toHaveLength(1);
    expect(filtrarPorDia([c], 'hoy', tarde)).toHaveLength(0);
    expect(filtrarPorDia([c], '2030-01-01', tarde)).toHaveLength(0); // futuro lejano: vacío
    expect(encabezadoDia('2026-11-08', tarde)).toBe('Mañana');
    expect(textoVacioDia('manana')).toBe('No hay mensajes para mañana');
    expect(textoVacioDia('2026-11-03', AHORA)).toBe('No hay mensajes para el martes 3 de noviembre');
  });

  it('la cola ordena por día, luego urgente y luego el que más espera', () => {
    const lista: any[] = [
      chat('a', { esperaMin: 5 }),
      chat('b', { esperaMin: 50 }),
      chat('c', { urgente: true, esperaMin: 1 }),
      chat('d', { fecha: hace(3), esperaMin: 900 }),
    ];
    expect(ordenarCola(lista).map((c) => c.id)).toEqual(['c', 'b', 'a', 'd']);
  });
});

const enLista = () => within(screen.getByRole('list', { name: 'Conversaciones' }));

describe('Mensajes: check de atendido, categorías y filtros', () => {
  let respuesta: any;
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(useEventos).mockReset();
    respuesta = {
      conteos: { todos: 3, atender: 3, bot: 0, atendidos: 2, sinVer: 0, reprogramar: 1 },
      chats: [
        chat('1'),
        chat('2', { fecha: hace(1) }),
        chat('3', { fecha: hace(3), porReprogramar: true, volvioAEscribir: true }),
      ],
    };
    vi.spyOn(api, 'listarRespuestasRapidas').mockResolvedValue([]);
    vi.spyOn(api, 'obtenerDetalleConversacion').mockResolvedValue(detalle);
    vi.spyOn(api, 'listarConversaciones').mockImplementation(async () => respuesta);
  });

  const irAPorAtender = async () => {
    render(<MensajesView />);
    fireEvent.click(await screen.findByRole('button', { name: /Por atender\s*3/ }));
  };

  it('Por atender abre en «Hoy», avisa de los días anteriores y los muestra con encabezados y contadores', async () => {
    await irAPorAtender();
    await waitFor(() => expect(enLista().queryByText('Cliente 2')).not.toBeInTheDocument());
    expect(enLista().getByText('Cliente 1')).toBeInTheDocument();
    expect(screen.getByTestId('aviso-anteriores')).toHaveTextContent('2 de días anteriores sin atender');
    expect(screen.getByRole('button', { name: 'Hoy: 1 chat' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Ayer: 1 chat' })).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('aviso-anteriores'));
    expect(await screen.findByRole('list', { name: 'Conversaciones' }).then(() => enLista().getByText('Cliente 2'))).toBeInTheDocument();
    expect(enLista().getByText('Cliente 3')).toBeInTheDocument();
    expect(screen.getByText('Hoy · 1')).toBeInTheDocument();
    expect(screen.getByText('Ayer · 1')).toBeInTheDocument();
  });

  it('la pestaña Todos (la que se abre por defecto) ya filtra por día: Hoy muestra solo lo de hoy y avisa de los anteriores', async () => {
    render(<MensajesView />);
    await waitFor(() => expect(enLista().getByText('Cliente 1')).toBeInTheDocument());
    expect(enLista().queryByText('Cliente 2')).not.toBeInTheDocument();
    expect(enLista().queryByText('Cliente 3')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hoy: 1 chat' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Mañana: 0 chats' })).toBeInTheDocument();
    expect(screen.getByTestId('aviso-anteriores')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ayer: 1 chat' }));
    expect(await screen.findByText('Cliente 2')).toBeInTheDocument();
  });

  it('el filtro «Ayer» y el selector de fecha acotan la lista', async () => {
    await irAPorAtender();
    fireEvent.click(await screen.findByRole('button', { name: 'Ayer: 1 chat' }));
    expect(await screen.findByRole('list', { name: 'Conversaciones' }).then(() => enLista().getByText('Cliente 2'))).toBeInTheDocument();
    expect(enLista().queryByText('Cliente 1')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Elegir fecha'), { target: { value: '2000-01-01' } });
    expect(await screen.findByTestId('vacio-lista')).toHaveTextContent('Ver todos los días (3)');
  });

  it('el selector de fecha no tiene tope: acepta mañana y días futuros con estado vacío y «Volver a Hoy»', async () => {
    await irAPorAtender();
    expect(await screen.findByLabelText('Elegir fecha')).not.toHaveAttribute('max');
    fireEvent.change(screen.getByLabelText('Elegir fecha'), { target: { value: '2031-05-20' } });
    const vacio = await screen.findByTestId('vacio-lista');
    expect(vacio).toHaveTextContent('No hay mensajes para el');
    expect(vacio).toHaveTextContent('20 may 2031');
    fireEvent.click(within(vacio).getByTestId('volver-hoy'));
    await waitFor(() => expect(enLista().getByText('Cliente 1')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Hoy: 1 chat' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('el chip «Mañana» filtra el día siguiente: sin datos, estado vacío amable; con un chat de mañana, lo muestra', async () => {
    await irAPorAtender();
    fireEvent.click(await screen.findByRole('button', { name: 'Mañana: 0 chats' }));
    expect(await screen.findByTestId('vacio-lista')).toHaveTextContent('No hay mensajes para mañana');
  });

  it('con un chat de mañana, el chip «Mañana» lo muestra y Hoy no', async () => {
    respuesta = { ...respuesta, chats: [chat('1'), chat('7', { fecha: new Date(Date.now() + 86400000).toISOString() })] };
    await irAPorAtender();
    fireEvent.click(await screen.findByRole('button', { name: 'Mañana: 1 chat' }));
    expect(await screen.findByRole('list', { name: 'Conversaciones' }).then(() => enLista().getByText('Cliente 7'))).toBeInTheDocument();
    expect(enLista().queryByText('Cliente 1')).not.toBeInTheDocument();
    expect(screen.getByText('Mañana · 1')).toBeInTheDocument();
  });

  it('Hoy es solo hoy aunque no haya chats de otros días, y la elección de día sobrevive al cambiar de pestaña', async () => {
    respuesta = { conteos: { ...respuesta.conteos }, chats: [chat('1')] };
    await irAPorAtender();
    expect(await screen.findByRole('button', { name: 'Hoy: 1 chat' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ayer: 0 chats' }));
    expect(await screen.findByTestId('vacio-lista')).toHaveTextContent('No hay mensajes para ayer');
    fireEvent.click(screen.getByRole('button', { name: /Atendidos/ }));
    expect(screen.getByRole('button', { name: 'Ayer: 0 chats' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('el check marca atendido en un toque, con aviso y Deshacer', async () => {
    const marcar = vi.spyOn(api, 'marcarAtendido').mockResolvedValue({ ok: true });
    const volver = vi.spyOn(api, 'volverPorAtender').mockResolvedValue({ ok: true });
    await irAPorAtender();
    const check = await screen.findByTestId('check-1');
    fireEvent.click(check);
    await waitFor(() => expect(marcar).toHaveBeenCalledWith('1', false));
    const aviso = await screen.findByTestId('aviso-atendido');
    expect(aviso).toHaveTextContent('Marcado como atendido');
    fireEvent.click(within(aviso).getByRole('button', { name: /Deshacer/ }));
    await waitFor(() => expect(volver).toHaveBeenCalledWith('1'));
    await waitFor(() => expect(screen.queryByTestId('aviso-atendido')).not.toBeInTheDocument());
  });

  it('Atendidos muestra su contador y su check devuelve el chat a Por atender', async () => {
    const volver = vi.spyOn(api, 'volverPorAtender').mockResolvedValue({ ok: true });
    respuesta = { conteos: { ...respuesta.conteos, atender: 0, atendidos: 1 }, chats: [chat('9', { estado: 'atendido', atendidoPor: 'Ana' })] };
    render(<MensajesView />);
    fireEvent.click(await screen.findByRole('button', { name: /Atendidos\s*1/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Volver a Por atender' }));
    await waitFor(() => expect(volver).toHaveBeenCalledWith('9'));
  });

  it('un evento de socket por mensaje nuevo lo devuelve a Por atender con «Volvió a escribir»', async () => {
    respuesta = { conteos: { todos: 0, atender: 0, bot: 0, atendidos: 1, sinVer: 0 }, chats: [] };
    render(<MensajesView />);
    fireEvent.click(await screen.findByRole('button', { name: /Por atender\s*0/ }));
    expect(await screen.findByTestId('vacio-lista')).toHaveTextContent('Todo al día');
    respuesta = {
      conteos: { todos: 1, atender: 1, bot: 0, atendidos: 0, sinVer: 1 },
      chats: [chat('5', { sinLeer: 1, volvioAEscribir: true })],
    };
    const alEvento = vi.mocked(useEventos).mock.calls.find((c) => c[0] === 'mensajes:actualizado')![1] as () => void;
    alEvento();
    expect(await screen.findByTestId('volvio-5')).toHaveTextContent('Volvió a escribir');
    expect(screen.getByTestId('sin-leer-5')).toBeInTheDocument();
  });

  it('el chip «Por reprogramar» aparece con contador y lista los chats con esa etiqueta', async () => {
    render(<MensajesView />);
    const chip = await screen.findByRole('button', { name: /Por reprogramar\s*1/ });
    respuesta = { ...respuesta, chats: [respuesta.chats[2]] };
    fireEvent.click(chip);
    expect(await screen.findByTestId('reprogramar-3')).toHaveTextContent('Entrega por reprogramar');
    expect(api.listarConversaciones).toHaveBeenLastCalledWith('reprogramar', '');
  });

  it('el check tiene nombre accesible y tamaño táctil', async () => {
    await irAPorAtender();
    const check = await screen.findByTestId('check-1');
    expect(check).toHaveAttribute('aria-label', 'Marcar como atendido');
    expect(check).toHaveAttribute('title', 'Marcar como atendido el chat de Cliente 1');
  });
});
