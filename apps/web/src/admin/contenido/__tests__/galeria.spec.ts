import { describe, it, expect, vi, beforeEach } from 'vitest';
import { subirImagenAlServidor } from '../../../comun/subidaImagen';
import {
  CLAVE_FOTOS_NAVEGADOR,
  cambiarActivo,
  moverFoto,
  recuperarFotosDelNavegador,
  reubicarFoto,
} from '../edicion/galeria';
import type { FotoGaleria } from '../../../carta/conocenosContenido';

vi.mock('../../../comun/subidaImagen', () => ({ subirImagenAlServidor: vi.fn() }));

const foto = (id: string, extra: Partial<FotoGaleria> = {}): FotoGaleria => ({ id, url: `/archivos/${id}.webp`, activo: true, ...extra });
const DATA = 'data:image/jpeg;base64,/9j/AA==';

describe('galería: funciones de lista', () => {
  it('mover sube y baja una foto sin salirse de la lista', () => {
    const lista = [foto('a'), foto('b'), foto('c')];
    expect(moverFoto(lista, 'b', -1).map((f) => f.id)).toEqual(['b', 'a', 'c']);
    expect(moverFoto(lista, 'a', -1).map((f) => f.id)).toEqual(['a', 'b', 'c']);
  });

  it('arrastrar una foto la deja en el lugar de otra', () => {
    const lista = [foto('a'), foto('b'), foto('c')];
    expect(reubicarFoto(lista, 'galeria:c', 'a', 'galeria:').map((f) => f.id)).toEqual(['c', 'a', 'b']);
  });

  it('quitar solo marca inactiva: la foto sigue en la lista', () => {
    const lista = cambiarActivo([foto('a'), foto('b')], 'b', false);
    expect(lista).toHaveLength(2);
    expect(lista[1].activo).toBe(false);
  });
});

describe('recuperarFotosDelNavegador', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(subirImagenAlServidor).mockReset();
  });

  it('sube solo las fotos que no tienen su lugar en la galería y limpia la clave al terminar', async () => {
    localStorage.setItem(CLAVE_FOTOS_NAVEGADOR, JSON.stringify({ Fachada: DATA, Terraza: DATA }));
    vi.mocked(subirImagenAlServidor).mockResolvedValue({ id: '5', url: '/archivos/publico/5.webp' });

    const nuevas = await recuperarFotosDelNavegador([foto('x', { origen: 'Fachada' })]);

    expect(subirImagenAlServidor).toHaveBeenCalledTimes(1);
    expect(nuevas).toHaveLength(1);
    expect(nuevas[0]).toMatchObject({ url: '/archivos/publico/5.webp', activo: true, origen: 'Terraza' });
    expect(localStorage.getItem(CLAVE_FOTOS_NAVEGADOR)).toBeNull();
  });

  it('si una subida falla conserva la clave para reintentar', async () => {
    localStorage.setItem(CLAVE_FOTOS_NAVEGADOR, JSON.stringify({ Fachada: DATA }));
    vi.mocked(subirImagenAlServidor).mockRejectedValue(new Error('sin red'));

    const nuevas = await recuperarFotosDelNavegador([]);

    expect(nuevas).toEqual([]);
    expect(localStorage.getItem(CLAVE_FOTOS_NAVEGADOR)).not.toBeNull();
  });

  it('sin nada en el navegador no hace nada', async () => {
    expect(await recuperarFotosDelNavegador([])).toEqual([]);
    expect(subirImagenAlServidor).not.toHaveBeenCalled();
  });
});
