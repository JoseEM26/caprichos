import { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CuadroEscribir } from '../CuadroEscribir';
import { RespuestaRapida } from '../mensajesTipos';
import { tituloConNoLeidos, useAvisoMensajeNuevo, leerSonidoActivo } from '../avisoMensajes';
import { useAtajosChat } from '../atajosChat';

const plantillas: RespuestaRapida[] = [
  { id: '1', titulo: 'Datos para Yape', texto: 'Yape de {{nombre}}, pedido {{codigo}} por {{total}}', categoria: 'PAGOS', activo: true },
  { id: '2', titulo: 'Horario', texto: 'Atendemos todos los días', categoria: 'HORARIOS', activo: true },
];
const pedido = { id: '5', codigo: 'P-77', medio: 'YAPE', total: '45.00', lineas: ['2 x Dona', '1 x Café'] };

function Montaje({ onEnviar, conPedido = true, admin = false }: { onEnviar: () => void; conPedido?: boolean; admin?: boolean }) {
  const [texto, setTexto] = useState('');
  return (
    <CuadroEscribir
      detalle={{ id: '9', ocupado: false, telefono: '987654321', nombre: 'Ana Pérez', pedido: conPedido ? pedido : null } as any}
      respuestasRapidas={plantillas}
      contextoPlantillas={{ link_carta: 'https://caprichos.pe' }}
      puedeAdministrarPlantillas={admin}
      textoMensaje={texto}
      onCambiarTexto={setTexto}
      textoPulido={null}
      pulirError={null}
      mensajeCopiado={null}
      enviando={false}
      onPulir={vi.fn()}
      onUsarPulido={vi.fn()}
      onDejarPulido={vi.fn()}
      onEnviar={onEnviar}
    />
  );
}
const caja = () => screen.getByLabelText('Escribe un mensaje') as HTMLTextAreaElement;

describe('menú «/» de respuestas rápidas', () => {
  it('filtra por texto, pega con variables resueltas y no envía', () => {
    const onEnviar = vi.fn();
    render(<Montaje onEnviar={onEnviar} />);
    fireEvent.change(caja(), { target: { value: '/yape' } });
    expect(screen.getAllByRole('option')).toHaveLength(1);
    fireEvent.keyDown(caja(), { key: 'Enter' });
    expect(caja().value).toBe('Yape de Ana, pedido P-77 por S/ 45.00');
    expect(onEnviar).not.toHaveBeenCalled();
  });

  it('Esc cierra el menú sin borrar lo escrito', () => {
    render(<Montaje onEnviar={vi.fn()} />);
    fireEvent.change(caja(), { target: { value: '/' } });
    expect(screen.getAllByRole('option')).toHaveLength(2);
    fireEvent.keyDown(caja(), { key: 'Escape' });
    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(caja().value).toBe('/');
  });

  it('«Gestionar» solo aparece con permiso', () => {
    const { unmount } = render(<Montaje onEnviar={vi.fn()} />);
    fireEvent.change(caja(), { target: { value: '/' } });
    expect(screen.queryByRole('button', { name: 'Gestionar' })).toBeNull();
    unmount();
    render(<Montaje onEnviar={vi.fn()} admin />);
    fireEvent.change(caja(), { target: { value: '/' } });
    expect(screen.getByRole('button', { name: 'Gestionar' })).toBeTruthy();
  });
});

describe('botones de acción del chat', () => {
  it('pegan carta, resumen y voucher en el cuadro sin enviar', () => {
    const onEnviar = vi.fn();
    render(<Montaje onEnviar={onEnviar} />);
    fireEvent.click(screen.getByRole('button', { name: 'Enviar carta' }));
    expect(caja().value).toContain('https://caprichos.pe');
    fireEvent.change(caja(), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar resumen del pedido' }));
    expect(caja().value).toContain('P-77');
    expect(caja().value).toContain('2 x Dona');
    expect(caja().value).toContain('S/ 45.00');
    fireEvent.change(caja(), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pedir voucher' }));
    expect(caja().value).toContain('captura');
    expect(onEnviar).not.toHaveBeenCalled();
  });

  it('sin pedido el resumen está desactivado', () => {
    render(<Montaje onEnviar={vi.fn()} conPedido={false} />);
    expect((screen.getByRole('button', { name: 'Enviar resumen del pedido' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

function Aviso({ n, sonido }: { n: number; sonido: boolean }) {
  useAvisoMensajeNuevo(n, sonido);
  return null;
}

describe('aviso de mensaje nuevo', () => {
  beforeEach(() => {
    document.title = 'Caprichos - Panel del Local';
    try {
      localStorage.clear();
    } catch {
      /* sin almacenamiento */
    }
  });

  it('el título lleva el número y se restaura al salir', () => {
    expect(tituloConNoLeidos(3)).toBe('(3) Mensajes · Caprichos');
    const { rerender, unmount } = render(<Aviso n={3} sonido={false} />);
    expect(document.title).toBe('(3) Mensajes · Caprichos');
    rerender(<Aviso n={0} sonido={false} />);
    expect(document.title).toBe('Mensajes · Caprichos');
    unmount();
    expect(document.title).toBe('Caprichos - Panel del Local');
  });

  it('suena solo cuando el número sube y el interruptor está encendido', () => {
    const pitar = vi.fn();
    (window as any).AudioContext = function () {
      pitar();
      throw new Error('audio bloqueado'); // además comprueba que un fallo de audio no rompe
    };
    const { rerender } = render(<Aviso n={1} sonido />);
    expect(pitar).not.toHaveBeenCalled(); // la primera carga no suena
    rerender(<Aviso n={2} sonido />);
    expect(pitar).toHaveBeenCalledTimes(1);
    rerender(<Aviso n={1} sonido />);
    expect(pitar).toHaveBeenCalledTimes(1);
    delete (window as any).AudioContext;
  });

  it('el interruptor se lee de localStorage y no rompe si falla', () => {
    localStorage.setItem('caprichos.mensajes.sonido', '0');
    expect(leerSonidoActivo()).toBe(false);
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    expect(leerSonidoActivo()).toBe(true);
    get.mockRestore();
  });
});

describe('atajos de teclado', () => {
  const montar = (extra?: Partial<Parameters<typeof useAtajosChat>[0]>) => {
    const seleccionar = vi.fn();
    const cerrar = vi.fn().mockReturnValue(true);
    function H() {
      useAtajosChat({ ids: ['a', 'b', 'c'], actual: 'b', seleccionar, cerrar, ...extra });
      return (
        <>
          <input aria-label="buscar" />
          <textarea aria-label="cuadro" data-cuadro-chat="" />
        </>
      );
    }
    render(<H />);
    return { seleccionar, cerrar };
  };

  it('Alt+↓ / Alt+↑ cambian de chat', () => {
    const { seleccionar } = montar();
    fireEvent.keyDown(document.body, { key: 'ArrowDown', altKey: true });
    expect(seleccionar).toHaveBeenLastCalledWith('c');
    fireEvent.keyDown(document.body, { key: 'ArrowUp', altKey: true });
    expect(seleccionar).toHaveBeenLastCalledWith('a');
  });

  it('no interfieren al escribir en otro campo, pero sí desde el cuadro del chat', () => {
    const { seleccionar, cerrar } = montar();
    fireEvent.keyDown(screen.getByLabelText('buscar'), { key: 'ArrowDown', altKey: true });
    fireEvent.keyDown(screen.getByLabelText('buscar'), { key: 'Escape' });
    expect(seleccionar).not.toHaveBeenCalled();
    expect(cerrar).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByLabelText('cuadro'), { key: 'ArrowDown', altKey: true });
    expect(seleccionar).toHaveBeenCalledWith('c');
  });

  it('Esc cierra el chat/panel y «?» abre la ayuda', () => {
    const alternarAyuda = vi.fn();
    const { cerrar } = montar({ alternarAyuda });
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(cerrar).toHaveBeenCalled();
    fireEvent.keyDown(document.body, { key: '?' });
    expect(alternarAyuda).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(screen.getByLabelText('buscar'), { key: '?' });
    expect(alternarAyuda).toHaveBeenCalledTimes(1);
  });
});
