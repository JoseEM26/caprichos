import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { ComandosUtiles, CLAVE_COMANDOS_ABIERTO, NOMBRE_EXE_WINDOWS } from '../ComandosUtiles';
import { PanelInstalarPrograma } from '../PanelInstalarPrograma';
import { impresionApi } from '../impresionApi';

vi.mock('../../../comun/sesion', () => ({ useSesion: () => ({ usuario: { rol: 'ADMIN' } }) }));
vi.mock('../impresionApi', () => ({
  impresionApi: { ultimaVersionPrograma: vi.fn().mockResolvedValue({ publicada: { version: '0.1.63', fecha: '2026-11-11T10:00:00Z' } }), generarCodigoVinculo: vi.fn() },
}));

const EXE = 'agente-impresion-windows.exe';

describe('ComandosUtiles', () => {
  beforeEach(() => localStorage.clear());

  it('el nombre es el que descarga la API y se muestran los comandos correctos', () => {
    expect(NOMBRE_EXE_WINDOWS).toBe(EXE);
    render(<ComandosUtiles />);
    const textos = screen.getAllByTestId('comando-util').map((e) => e.textContent);
    expect(textos).toEqual([
      `${EXE} --detener-todo`, `${EXE} --estado`, `${EXE} --copias`, `${EXE} --detener-todo`, `${EXE} --version`,
      `${EXE} autoinicio desactivar`, `${EXE} autoinicio activar`,
    ]);
    expect(screen.getByText('Actualizar la versión (3 pasos)')).toBeInTheDocument();
    expect(screen.getByText(/dos copias a la vez pueden imprimir doble/)).toBeInTheDocument();
    expect(screen.getByText(/Ábrelo UNA vez \(doble clic\)/)).toBeInTheDocument();
    expect(screen.getByText(/barra de direcciones/)).toBeInTheDocument();
  });

  it('Copiar escribe en el portapapeles y confirma de forma visible y anunciada', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<ComandosUtiles />);
    const botones = screen.getAllByRole('button', { name: /^Copiar el comando/ });
    fireEvent.click(botones[1]);
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(`${EXE} --estado`));
    expect(await screen.findByText('Copiado ✔')).toBeInTheDocument();
    expect(screen.getAllByRole('status').some((e) => e.textContent === 'Comando copiado')).toBe(true);
  });

  it('si el portapapeles falla lo dice sin romperse', async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('no')) } });
    render(<ComandosUtiles />);
    fireEvent.click(screen.getAllByRole('button', { name: /^Copiar el comando/ })[0]);
    expect(await screen.findByText(/No se pudo copiar/)).toBeInTheDocument();
  });

  it('es plegable con aria-expanded/aria-controls, abierta la primera vez, y recuerda el plegado', () => {
    const { unmount } = render(<ComandosUtiles />);
    const cab = screen.getByRole('button', { name: /Comandos útiles y cómo actualizar/ });
    expect(cab).toHaveAttribute('aria-expanded', 'true');
    const id = cab.getAttribute('aria-controls')!;
    expect(document.getElementById(id)).not.toBeNull();
    fireEvent.click(cab);
    expect(cab).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('comando-util')).toBeNull();
    expect(localStorage.getItem(CLAVE_COMANDOS_ABIERTO)).toBe('0');
    unmount();
    render(<ComandosUtiles />);
    expect(screen.getByRole('button', { name: /Comandos útiles/ })).toHaveAttribute('aria-expanded', 'false');
  });

  it('sin localStorage (bloqueado) igual funciona', () => {
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('bloqueado'); });
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('bloqueado'); });
    render(<ComandosUtiles />);
    const cab = screen.getByRole('button', { name: /Comandos útiles/ });
    expect(cab).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(cab);
    expect(cab).toHaveAttribute('aria-expanded', 'false');
    get.mockRestore();
    set.mockRestore();
  });

  it('muestra la última versión disponible y la instalada si se conoce', () => {
    render(<ComandosUtiles ultima={{ version: '0.1.63' }} instalada="0.1.60" />);
    expect(screen.getByTestId('comandos-versiones').textContent).toContain('Programa v0.1.60');
    expect(screen.getByTestId('comandos-versiones').textContent).toContain('Última disponible: v0.1.63');
    expect(screen.getByTestId('version-nueva')).toBeInTheDocument();
  });

  it('en el panel de instalación aparece junto a la descarga de Windows, reutiliza la versión ya consultada y no en Linux', async () => {
    render(<PanelInstalarPrograma alCerrar={() => {}} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Windows' }));
    expect(screen.getByTestId('comandos-utiles')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('comandos-versiones').textContent).toContain('Última disponible: v0.1.63'));
    expect((impresionApi.ultimaVersionPrograma as any).mock.calls.length).toBe(1);
    fireEvent.click(screen.getByRole('tab', { name: 'Linux' }));
    expect(screen.queryByTestId('comandos-utiles')).toBeNull();
  });

  it('a 360 px: sin ancho fijo, botones de 44 px y el comando se parte en líneas', () => {
    const css = readFileSync(resolve(__dirname, '../comandos-utiles.css'), 'utf8');
    const cola = readFileSync(resolve(__dirname, '../cola-impresion.css'), 'utf8');
    expect(css).toMatch(/overflow-wrap: anywhere/);
    expect(css).toMatch(/@media \(max-width: 480px\)/);
    expect(css).not.toMatch(/(?<!max-)(?<!min-)width: \d{3,}px/);
    expect(cola).toMatch(/\.cola-btn \{[^}]*min-height: 44px/);
  });
});
