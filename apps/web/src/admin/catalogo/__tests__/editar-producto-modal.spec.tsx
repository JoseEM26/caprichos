import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { EditarProductoModal, EditarProductoModalProps } from '../EditarProductoModal';

const base = (extra: Partial<EditarProductoModalProps['producto']> = {}): any => ({
  id: 'p1', nombre: 'DONA', categoriaId: 'c1', precio: 4, controlaStock: true, tamanos: [], grupos: [], sabores: [], ...extra,
});

function montar(producto: any, props: Partial<EditarProductoModalProps> = {}) {
  const todo: EditarProductoModalProps = {
    producto, categorias: [{ id: 'c1', nombre: 'Postres' } as any],
    nombre: 'DONA', setNombre: vi.fn(), categoriaId: 'c1', setCategoriaId: vi.fn(), precio: '4.00', setPrecio: vi.fn(),
    oculto: false, setOculto: vi.fn(), controlaStock: producto.controlaStock, setControlaStock: vi.fn(),
    fotoUrl: null, subiendoFoto: false, estadoFoto: 'inactivo', errorFoto: null, alReintentarFoto: vi.fn(),
    alSubirFoto: vi.fn(), alQuitarFoto: vi.fn(), sabores: producto.sabores, setSabores: vi.fn(),
    nuevoSabor: '', setNuevoSabor: vi.fn(), error: '', puedeEditar: true, resumenOpciones: '3 tamaños · 7 grupos',
    alAbrirOpciones: vi.fn(), vistaPrevia: null, guardando: false, alGuardar: vi.fn(), alCancelar: vi.fn(),
    porciones: '', setPorciones: vi.fn(), alergenos: [], setAlergenos: vi.fn(), alergenosConfirmados: false, setAlergenosConfirmados: vi.fn(), ...props,
  };
  return render(<MemoryRouter><EditarProductoModal {...todo} /></MemoryRouter>);
}

describe('EditarProductoModal', () => {
  it('Datos: nombre, categoría y precio en una fila; visibilidad como interruptor; acceso a Tamaños y opciones', () => {
    const abrir = vi.fn();
    montar(base(), { alAbrirOpciones: abrir });
    expect(screen.getByRole('dialog', { name: 'Editar: DONA' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Mostrar en la carta' })).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Tamaños y opciones · 3 tamaños · 7 grupos' }));
    expect(abrir).toHaveBeenCalled();
  });

  it('Stock: «Quedan N hoy» con apertura, y aviso con enlace si falta la apertura de hoy', () => {
    const { unmount } = montar(base({ quedan: 7, aperturaHoy: true }));
    fireEvent.click(screen.getByRole('tab', { name: /Stock y sabores/ }));
    expect(screen.getByRole('status')).toHaveTextContent('Quedan 7 hoy');
    expect(screen.getByRole('status')).not.toHaveTextContent('Sin apertura');
    unmount();
    montar(base({ quedan: 7, aperturaHoy: false }));
    fireEvent.click(screen.getByRole('tab', { name: /Stock y sabores/ }));
    expect(screen.getByRole('status')).toHaveTextContent('Sin apertura de hoy: cárgala en Apertura del día');
    expect(screen.getByRole('link', { name: 'Apertura del día' })).toHaveAttribute('href', '/admin/apertura');
  });

  it('la ayuda de «Controlar stock» está en un «?» plegable, no en un párrafo fijo', () => {
    montar(base());
    fireEvent.click(screen.getByRole('tab', { name: /Stock y sabores/ }));
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ayuda: Controlar stock' }));
    expect(screen.getByRole('note')).toHaveTextContent(/se descuenta al vender/);
  });

  it('un anfitrión de combo no muestra Controlar stock ni sabores: solo la nota del combo', () => {
    montar(base({ esAnfitrionCombo: true }));
    fireEvent.click(screen.getByRole('tab', { name: /Stock y sabores/ }));
    expect(screen.getByRole('note')).toHaveTextContent('Este producto es un combo: su disponibilidad sale de lo que lo compone');
    expect(screen.queryByRole('checkbox', { name: /Controlar stock/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Nuevo sabor')).not.toBeInTheDocument();
  });

  it('agregar sabor y marcar Agotado llaman a setSabores', () => {
    const set = vi.fn();
    montar(base({ sabores: [{ id: 's1', nombre: 'Fresa', activo: true, quedan: 3, aperturaHoy: true }] }), {
      sabores: [{ id: 's1', nombre: 'Fresa', activo: true, quedan: 3, aperturaHoy: true }], setSabores: set, nuevoSabor: 'Oreo',
    });
    fireEvent.click(screen.getByRole('tab', { name: /Stock y sabores/ }));
    fireEvent.click(screen.getByRole('button', { name: /Fresa: disponible/ }));
    expect(set).toHaveBeenLastCalledWith([expect.objectContaining({ id: 's1', activo: false })]);
    fireEvent.click(screen.getByRole('button', { name: '+ Agregar' }));
    expect(set).toHaveBeenLastCalledWith([expect.objectContaining({ id: 's1' }), { nombre: 'Oreo', activo: true }]);
  });

  it('Cancelar sin cambios cierra directo', () => {
    const cancelar = vi.fn();
    montar(base(), { alCancelar: cancelar });
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(cancelar).toHaveBeenCalled();
  });

  it('Alcanza para y alérgenos: edita porciones, marca chips y la casilla de revisión', () => {
    const setPorciones = vi.fn(); const setAlergenos = vi.fn(); const setConf = vi.fn();
    montar(base(), { setPorciones, setAlergenos, setAlergenosConfirmados: setConf, alergenos: ['MANI'] });
    fireEvent.change(screen.getByLabelText('Alcanza para'), { target: { value: '8 a 10 personas' } });
    expect(setPorciones).toHaveBeenCalledWith('8 a 10 personas');
    fireEvent.click(screen.getByRole('button', { name: 'lácteos' }));
    expect(setAlergenos).toHaveBeenCalledWith(['MANI', 'LACTEOS']);
    fireEvent.click(screen.getByRole('button', { name: 'maní' }));
    expect(setAlergenos).toHaveBeenCalledWith([]);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Revisé los alérgenos de este producto' }));
    expect(setConf).toHaveBeenCalledWith(true);
  });
});
