import { useState } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { CuadroEscribir } from '../CuadroEscribir';
import * as api from '../mensajesApi';
import { RespuestaRapida } from '../mensajesTipos';

const plantillas: RespuestaRapida[] = [
  { id: '1', titulo: 'Saludo con nombre', texto: '¡Hola {{nombre}}! Soy {{mi_nombre}} de {{local}}.', categoria: 'SALUDO', activo: true },
  { id: '2', titulo: 'Horario de atención', texto: 'Atendemos:\n{{horario}}', categoria: 'HORARIOS', activo: true },
  { id: '3', titulo: 'Datos para Yape', texto: 'Yape:\n{{yape}}', categoria: 'PAGOS', activo: true },
];
const contexto = { local: 'Café Prueba', mi_nombre: 'Lucía', horario: '• Lunes a Domingo: 14:00 - 22:00', yape: '' };

function Montaje({ onEnviar, admin = false, nombre = 'Ana Pérez' }: { onEnviar: () => void; admin?: boolean; nombre?: string }) {
  const [texto, setTexto] = useState('');
  return (
    <CuadroEscribir
      detalle={{ id: '9', ocupado: false, telefono: '987654321', nombre } as any}
      respuestasRapidas={plantillas}
      contextoPlantillas={contexto}
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

describe('Plantillas de respuesta en el chat', () => {
  it('insertar una plantilla escribe el texto resuelto en el cuadro y NO envía', () => {
    const onEnviar = vi.fn();
    render(<Montaje onEnviar={onEnviar} />);
    fireEvent.click(screen.getByLabelText('Plantillas de respuesta'));
    fireEvent.click(screen.getByText('Saludo con nombre'));
    const caja = screen.getByLabelText('Escribe un mensaje') as HTMLTextAreaElement;
    expect(caja.value).toBe('¡Hola Ana! Soy Lucía de Café Prueba.');
    expect(onEnviar).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: 'Plantillas de respuesta' })).toBeNull();
  });

  it('el buscador y los chips de categoría filtran la lista', () => {
    render(<Montaje onEnviar={vi.fn()} />);
    fireEvent.click(screen.getByLabelText('Plantillas de respuesta'));
    const lista = () => within(screen.getByRole('list', { name: 'Plantillas' }));
    expect(lista().getAllByRole('button')).toHaveLength(3);
    fireEvent.change(screen.getByLabelText('Buscar una plantilla'), { target: { value: 'YAPE' } });
    expect(lista().getAllByRole('button')).toHaveLength(1);
    fireEvent.change(screen.getByLabelText('Buscar una plantilla'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Horarios' }));
    expect(lista().getAllByRole('button').map((b) => b.textContent)).toEqual([expect.stringContaining('Horario de atención')]);
    fireEvent.change(screen.getByLabelText('Buscar una plantilla'), { target: { value: 'zzz' } });
    expect(screen.getByText('Ninguna plantilla coincide con tu búsqueda.')).toBeTruthy();
  });

  it('una variable sin dato deja el marcador, avisa y no deja enviar hasta completarlo', async () => {
    const onEnviar = vi.fn();
    render(<Montaje onEnviar={onEnviar} />);
    fireEvent.click(screen.getByLabelText('Plantillas de respuesta'));
    fireEvent.click(screen.getByText('Datos para Yape'));
    const caja = screen.getByLabelText('Escribe un mensaje') as HTMLTextAreaElement;
    expect(caja.value).toBe('Yape:\n{{yape}}');
    expect(screen.getByTestId('plantilla-falta').textContent).toContain('{{yape}}');
    fireEvent.keyDown(caja, { key: 'Enter' });
    expect(onEnviar).not.toHaveBeenCalled();
    expect(screen.getByTestId('plantilla-pendiente').textContent).toContain('{{yape}}');
    fireEvent.change(caja, { target: { value: 'Yape:\n900000001' } });
    fireEvent.keyDown(caja, { key: 'Enter' });
    await waitFor(() => expect(onEnviar).toHaveBeenCalledTimes(1));
  });

  it('si el chat no tiene nombre (solo un número) {{nombre}} queda por completar', () => {
    render(<Montaje onEnviar={vi.fn()} nombre="+51 987 654 321" />);
    fireEvent.click(screen.getByLabelText('Plantillas de respuesta'));
    fireEvent.click(screen.getByText('Saludo con nombre'));
    expect((screen.getByLabelText('Escribe un mensaje') as HTMLTextAreaElement).value).toContain('{{nombre}}');
    expect(screen.getByTestId('plantilla-falta').textContent).toContain('{{nombre}}');
  });

  it('escribir «/» sugiere por título y Enter inserta sin enviar', () => {
    const onEnviar = vi.fn();
    render(<Montaje onEnviar={onEnviar} />);
    const caja = screen.getByLabelText('Escribe un mensaje') as HTMLTextAreaElement;
    fireEvent.change(caja, { target: { value: '/hor' } });
    expect(screen.getByRole('listbox', { name: 'Plantillas sugeridas' })).toBeTruthy();
    fireEvent.keyDown(caja, { key: 'Enter' });
    expect(onEnviar).not.toHaveBeenCalled();
    expect(caja.value).toBe('Atendemos:\n• Lunes a Domingo: 14:00 - 22:00');
  });

  it('sin permiso de administrar no aparece «Administrar plantillas»; con permiso sí', () => {
    const { unmount } = render(<Montaje onEnviar={vi.fn()} />);
    fireEvent.click(screen.getByLabelText('Plantillas de respuesta'));
    expect(screen.queryByText('Administrar plantillas')).toBeNull();
    unmount();
    render(<Montaje onEnviar={vi.fn()} admin />);
    fireEvent.click(screen.getByLabelText('Plantillas de respuesta'));
    expect(screen.getByText('Administrar plantillas')).toBeTruthy();
  });
});

describe('Administrar plantillas', () => {
  beforeEach(() => {
    vi.spyOn(api, 'listarPlantillasGestion').mockResolvedValue([
      { id: '1', titulo: 'Saludo con nombre', texto: 'Hola', categoria: 'SALUDO', activo: true },
      { id: '2', titulo: 'Horario', texto: 'Atendemos de tarde', categoria: 'HORARIOS', activo: false },
    ]);
  });
  afterEach(() => vi.restoreAllMocks());

  const abrir = async () => {
    render(<Montaje onEnviar={vi.fn()} admin />);
    fireEvent.click(screen.getByLabelText('Plantillas de respuesta'));
    fireEvent.click(screen.getByText('Administrar plantillas'));
    await screen.findByText('Horario');
  };

  it('lista con las pausadas marcadas; pausar y activar llaman al servidor y avisan el cambio', async () => {
    const editar = vi.spyOn(api, 'editarPlantilla').mockResolvedValue({} as any);
    await abrir();
    expect(screen.getByText('En pausa')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Pausar Saludo con nombre' }));
    await waitFor(() => expect(editar).toHaveBeenCalledWith('1', { activo: false }));
    fireEvent.click(screen.getByRole('button', { name: 'Activar Horario' }));
    await waitFor(() => expect(editar).toHaveBeenCalledWith('2', { activo: true }));
  });

  it('borrar pide confirmación Sí/No en la misma fila, sin otra ventana encima', async () => {
    const borrar = vi.spyOn(api, 'borrarPlantilla').mockResolvedValue({ ok: true });
    await abrir();
    fireEvent.click(screen.getByRole('button', { name: 'Borrar Horario' }));
    expect(borrar).not.toHaveBeenCalled();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'No' }));
    expect(screen.queryByText('Sí, borrar')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Borrar Horario' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, borrar' }));
    await waitFor(() => expect(borrar).toHaveBeenCalledWith('2'));
  });

  it('crea una plantilla nueva desde la pestaña Nueva y muestra la vista previa', async () => {
    const crear = vi.spyOn(api, 'crearPlantilla').mockResolvedValue({} as any);
    await abrir();
    fireEvent.click(screen.getByRole('button', { name: 'Nueva plantilla' }));
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Gracias' } });
    fireEvent.change(screen.getByLabelText('Texto del mensaje'), { target: { value: 'Gracias {{nombre}}' } });
    expect(screen.getByLabelText('Vista previa').textContent).toContain('Gracias Ana');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(crear).toHaveBeenCalledWith({ titulo: 'Gracias', texto: 'Gracias {{nombre}}', categoria: 'OTROS', activo: true }));
  });

  it('muestra el error del servidor (título repetido) sin cerrar el formulario', async () => {
    vi.spyOn(api, 'crearPlantilla').mockRejectedValue({ mensaje: 'Ya existe una plantilla con ese título' });
    await abrir();
    fireEvent.click(screen.getByRole('button', { name: 'Nueva plantilla' }));
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Horario' } });
    fireEvent.change(screen.getByLabelText('Texto del mensaje'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Ya existe una plantilla');
  });
});
