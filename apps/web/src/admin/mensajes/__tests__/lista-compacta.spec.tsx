import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ListaChats } from '../ListaChats';

const conteos = { todos: 4, atender: 0, bot: 4, atendidos: 0, sinVer: 0, faltanProcesar: 0 } as any;
const ahora = new Date().toISOString();
const chat = (id: string, extra: object = {}) => ({
  id, nombre: `Cliente ${id}`, telefono: '911111111', estado: 'bot', urgente: false,
  ultimo: 'hola', hora: '10:00', fecha: ahora, sinLeer: 0, atiende: 'BOT', ...extra,
});

function montar(chats: any[], extra: object = {}) {
  render(
    <ListaChats
      {...({
        conteos, busqueda: '', onBuscar: vi.fn(), filtro: 'todos', onFiltro: vi.fn(), soloBloqueados: false,
        onToggleSoloBloqueados: vi.fn(), cargando: false, chats, chatSeleccionadoId: null, onSeleccionar: vi.fn(), ...extra,
      } as any)}
    />,
  );
}

describe('fila compacta de la lista de chats', () => {
  it('2 líneas: nombre, hora, vista previa con «Nombre:» y checks, chip del pedido; sin «Atiende:» ni estado genérico', () => {
    montar([
      chat('a', {
        nombre: 'Lucía Pérez', ultimo: 'Tu pedido ya salió', ultimoAutor: 'Ana', ultimoEstado: 'LEIDO', estado: 'atencion', atiende: 'PERSONA',
        pos: { estado: 'REGISTRADO', codigo: 'CP-12', pedidoId: '9' }, atendidoPor: 'Luis',
      }),
    ]);
    expect(screen.getByText('Lucía Pérez')).toBeInTheDocument();
    expect(screen.getByTestId('hora-a')).toBeInTheDocument();
    const vista = screen.getByTestId('vista-a');
    expect(vista).toHaveTextContent('✓✓ Ana: Tu pedido ya salió');
    expect(within(vista).getByTitle('Leído')).toBeInTheDocument();
    expect(screen.getByTestId('pos-a')).toHaveTextContent('Pedido registrado');
    expect(screen.queryByText(/Atiende:/)).toBeNull();
    expect(screen.queryByText(/Atendido por/)).toBeNull();
    expect(screen.queryByText(/Usuario de WhatsApp/)).toBeNull();
    expect(screen.queryByText(/Bot reanuda/)).toBeNull();
  });

  it('el último del cliente no lleva nombre ni checks; el del bot dice «Bot:» y sin estado solo ✓', () => {
    montar([chat('c', { ultimo: 'quiero pedir' }), chat('b', { ultimo: 'Hola, soy Capri', ultimoAutor: 'Bot', ultimoEstado: 'ENVIADO' })]);
    expect(screen.getByTestId('vista-c')).toHaveTextContent(/^quiero pedir$/);
    expect(screen.getByTestId('vista-b')).toHaveTextContent('✓ Bot: Hola, soy Capri');
  });

  it('muestra máximo 2 chips de alerta y deja el resto en el title; espera ≥15 min en rojo', () => {
    montar([
      chat('x', { porResponder: true, sinRespuestaMin: 20, volvioAEscribir: true, urgente: true, numeroBloqueado: true }),
    ]);
    const chips = screen.getByTestId('esperando-x').parentElement!;
    expect(chips.querySelectorAll('.msg-chip')).toHaveLength(2);
    expect(screen.getByTestId('esperando-x')).toHaveTextContent('Esperando 20 min');
    expect(screen.getByTestId('esperando-x').getAttribute('style')).toContain('163, 38, 26');
    expect(chips.getAttribute('title')).toContain('Volvió a escribir');
    expect(chips.getAttribute('title')).toContain('Urgente');
  });

  it('el orden de la lista es el que llega (último mensaje más reciente arriba)', () => {
    montar([chat('n1', { nombre: 'Primero' }), chat('n2', { nombre: 'Segundo' })]);
    const nombres = screen.getAllByRole('listitem').map((li) => li.textContent);
    expect(nombres.findIndex((t) => t?.includes('Primero'))).toBeLessThan(nombres.findIndex((t) => t?.includes('Segundo')));
  });
});

describe('filtros rápidos de la lista', () => {
  const chats = [
    chat('1', { nombre: 'Sin leer', sinLeer: 2, tomadoPorParty: '7' }),
    chat('2', { nombre: 'Con pedido', pos: { estado: 'REGISTRADO', codigo: 'CP-1', pedidoId: '1' } }),
    chat('3', { nombre: 'Esperando', porResponder: true, sinRespuestaMin: 5, tomadoPorParty: '7' }),
    chat('4', { nombre: 'Tranquilo', pos: { estado: 'SIN_PEDIDO', codigo: null, pedidoId: null } }),
  ];
  const nombres = () => screen.getAllByRole('listitem').map((li) => li.textContent ?? '');

  it('cada chip filtra y se combinan entre sí', () => {
    montar(chats, { miPartyId: '7' });
    fireEvent.click(screen.getByTestId('rapido-noLeidos'));
    expect(nombres().join('|')).toContain('Sin leer');
    expect(nombres().join('|')).not.toContain('Tranquilo');
    fireEvent.click(screen.getByTestId('rapido-noLeidos'));
    fireEvent.click(screen.getByTestId('rapido-conPedido'));
    expect(nombres().join('|')).toContain('Con pedido');
    expect(nombres().join('|')).not.toContain('Tranquilo');
    fireEvent.click(screen.getByTestId('rapido-conPedido'));
    fireEvent.click(screen.getByTestId('rapido-esperando'));
    expect(nombres().join('|')).toContain('Esperando');
    expect(nombres().join('|')).not.toContain('Sin leer');
    fireEvent.click(screen.getByTestId('rapido-esperando'));
    fireEvent.click(screen.getByTestId('rapido-mios'));
    expect(nombres().join('|')).toContain('Sin leer');
    expect(nombres().join('|')).toContain('Esperando');
    expect(nombres().join('|')).not.toContain('Con pedido');
    // combinados: míos + esperando = solo el 3
    fireEvent.click(screen.getByTestId('rapido-esperando'));
    expect(nombres().join('|')).not.toContain('Sin leer');
    expect(nombres().join('|')).toContain('Esperando');
  });

  it('sin coincidencias avisa; sin miPartyId «Míos» no deja ninguno', () => {
    montar(chats);
    fireEvent.click(screen.getByTestId('rapido-mios'));
    expect(screen.getByText('Ningún chat cumple los filtros rápidos.')).toBeInTheDocument();
  });
});
