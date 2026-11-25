import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { GrupoCard } from '../GruposPregunta';
import { EditorOpcionesTamanos } from '../EditorOpcionesTamanos';
import { EditarProductoModal } from '../EditarProductoModal';
import { catalogoApi } from '../catalogoApi';

/** Fotos opcionales con interruptor «Mostrar imágenes» (apagado por defecto): opciones, tamaños y sabores. */
describe('Imágenes opcionales en los editores del admin', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(catalogoApi, 'listarListas').mockResolvedValue([] as any);
    vi.spyOn(catalogoApi, 'listarGrupos').mockResolvedValue([] as any);
  });

  it('grupo de opciones: apagado no pide fotos; al encender guarda mostrarImagenes y la foto de cada opción', async () => {
    const actualizar = vi.spyOn(catalogoApi, 'actualizarGrupo').mockResolvedValue({} as any);
    const editar = vi.spyOn(catalogoApi, 'editarOpcion').mockResolvedValue({} as any);
    const grupo: any = {
      id: '1', nombre: 'Leche', activo: true, obligatorio: false, minimo: 0, maximo: 1, productosCount: 1,
      opciones: [{ id: '10', nombre: 'Almendra', precioExtra: 2, activo: true, fotoArchivoId: '55', fotoUrl: '/archivos/almendra.jpg' }],
    };
    render(<GrupoCard g={grupo} enProducto onToggle={() => {}} puedeEditar alCambiar={() => {}} />);
    fireEvent.click(screen.getByRole('button', { expanded: false }));
    expect(screen.queryByRole('img', { name: 'Foto de Almendra' })).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Mostrar imágenes de las opciones' }));
    expect(screen.getByRole('img', { name: 'Foto de Almendra' })).toBeInTheDocument();
    // Quitar la foto de la opción la manda como null
    fireEvent.click(screen.getByRole('button', { name: 'Quitar foto de Almendra' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios del grupo' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, guardar' }));
    await waitFor(() => expect(actualizar).toHaveBeenCalledWith('1', expect.objectContaining({ mostrarImagenes: true })));
    expect(editar).toHaveBeenCalledWith('10', expect.objectContaining({ fotoArchivoId: null }));
  });

  it('tamaños del producto: el interruptor y la foto por tamaño viajan en editarProducto', async () => {
    const guardar = vi.spyOn(catalogoApi, 'editarProducto').mockResolvedValue({} as any);
    const producto: any = {
      id: 'p1', nombre: 'Latte', precio: 8, grupos: [], sabores: [], mostrarImagenesTamanos: false,
      tamanos: [{ id: 't1', tamanoValorId: 'v1', nombre: 'Grande', precio: 10, activo: true, unidades: 1, fotoArchivoId: '7', fotoUrl: '/archivos/grande.jpg' }],
    };
    render(<EditorOpcionesTamanos modo="guardado" producto={producto} />);
    expect(screen.queryByRole('img', { name: 'Foto de Grande' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Mostrar imágenes de los tamaños' }));
    expect(screen.getByRole('img', { name: 'Foto de Grande' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Quitar foto de Grande' }));
    fireEvent.click(screen.getByText('Guardar cambios'));
    fireEvent.click(screen.getByText('Sí, guardar'));
    await waitFor(() => expect(guardar).toHaveBeenCalledWith('p1', expect.objectContaining({
      mostrarImagenesTamanos: true,
      tamanos: [{ tamanoValorId: 'v1', precio: 10, activo: true, unidades: 1, fotoArchivoId: null }],
    })));
  });

  it('sabores del producto: el interruptor muestra la foto de cada sabor y avisa el cambio', () => {
    const setMostrar = vi.fn();
    const setSabores = vi.fn();
    const sabores: any[] = [{ id: '3', nombre: 'Vainilla', activo: true, fotoArchivoId: '9', fotoUrl: '/archivos/vainilla.jpg' }];
    const props: any = {
      producto: { id: 'p1', nombre: 'DONA', categoriaId: 'c1', precio: 4, controlaStock: false, tamanos: [], grupos: [], sabores },
      categorias: [{ id: 'c1', nombre: 'Postres' }],
      nombre: 'DONA', setNombre: vi.fn(), categoriaId: 'c1', setCategoriaId: vi.fn(), precio: '4.00', setPrecio: vi.fn(),
      oculto: false, setOculto: vi.fn(), controlaStock: false, setControlaStock: vi.fn(),
      fotoUrl: null, subiendoFoto: false, estadoFoto: 'inactivo', errorFoto: null, alReintentarFoto: vi.fn(),
      alSubirFoto: vi.fn(), alQuitarFoto: vi.fn(), sabores, setSabores,
      nuevoSabor: '', setNuevoSabor: vi.fn(), error: '', puedeEditar: true, resumenOpciones: '',
      alAbrirOpciones: vi.fn(), vistaPrevia: null, guardando: false, alGuardar: vi.fn(), alCancelar: vi.fn(),
      porciones: '', setPorciones: vi.fn(), alergenos: [], setAlergenos: vi.fn(), alergenosConfirmados: false, setAlergenosConfirmados: vi.fn(),
      mostrarImagenesSabores: false, setMostrarImagenesSabores: setMostrar,
    };
    const { rerender } = render(<MemoryRouter><EditarProductoModal {...props} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('tab', { name: /Stock y sabores/ }));
    expect(screen.queryByRole('img', { name: 'Foto de Vainilla' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Mostrar imágenes de los sabores' }));
    expect(setMostrar).toHaveBeenCalledWith(true);
    rerender(<MemoryRouter><EditarProductoModal {...props} mostrarImagenesSabores /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Quitar foto de Vainilla' }));
    expect(setSabores).toHaveBeenCalledWith([expect.objectContaining({ id: '3', fotoArchivoId: null, fotoUrl: null })]);
  });
});
