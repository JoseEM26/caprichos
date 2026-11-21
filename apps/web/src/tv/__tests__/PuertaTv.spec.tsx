import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { PuertaTv } from '../PuertaTv';
import * as sesion from '../../comun/sesion';
import { tvApi } from '../tvApi';

const sinSesion = { usuario: null, cargando: false, tiene: () => false } as any;

const codigo = (c: string, seg = 600, llave = 'LLAVE-' + c) => ({ codigo: c, llave, expiraEn: new Date(Date.now() + seg * 1000).toISOString() });
const avanzar = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

describe('PuertaTv', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.clear();
    vi.spyOn(sesion, 'useSesion').mockReturnValue(sinSesion);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const montar = () => render(<PuertaTv vista="SALON_VIVO" permiso="salon_vivo/ver">{(a) => <div>VISTA {a.llave ?? 'sesion'}</div>}</PuertaTv>);

  it('sin sesión ni llave muestra el código grande con guion y la instrucción', async () => {
    vi.spyOn(tvApi, 'pedirCodigo').mockResolvedValue(codigo('ABC234'));
    vi.spyOn(tvApi, 'estado').mockResolvedValue({ vinculada: false, activa: false } as any);
    montar();
    await avanzar(10);
    expect(screen.getByLabelText('Código de vinculación')).toHaveTextContent('ABC-234');
    expect(screen.getByText(/caprichos.pe\/admin\/pantallas/)).toBeInTheDocument();
    expect(screen.getByRole('timer')).toHaveTextContent('10:00');
    expect(window.localStorage.getItem('caprichos_tv_llave_SALON_VIVO')).toBe('LLAVE-ABC234');
  });

  it('renueva el código solo al vencer', async () => {
    const pedir = vi.spyOn(tvApi, 'pedirCodigo').mockResolvedValueOnce(codigo('ABC234', 5)).mockResolvedValue(codigo('XYZ789'));
    vi.spyOn(tvApi, 'estado').mockResolvedValue({ vinculada: false, activa: false } as any);
    montar();
    await avanzar(10);
    expect(screen.getByLabelText('Código de vinculación')).toHaveTextContent('ABC-234');
    await avanzar(6000);
    expect(pedir).toHaveBeenCalledTimes(2);
    expect(screen.getByLabelText('Código de vinculación')).toHaveTextContent('XYZ-789');
  });

  it('entra a la vista cuando el admin lo vincula', async () => {
    vi.spyOn(tvApi, 'pedirCodigo').mockResolvedValue(codigo('ABC234'));
    const estado = vi.spyOn(tvApi, 'estado').mockResolvedValue({ vinculada: false, activa: false } as any);
    montar();
    await avanzar(10);
    estado.mockResolvedValue({ vinculada: true, activa: true, areaId: null } as any);
    await avanzar(4100);
    expect(screen.getByText('VISTA LLAVE-ABC234')).toBeInTheDocument();
  });

  it('con llave guardada y activa entra directo; revocada vuelve al código', async () => {
    window.localStorage.setItem('caprichos_tv_llave_SALON_VIVO', 'GUARDADA');
    vi.spyOn(tvApi, 'estado').mockResolvedValue({ vinculada: true, activa: true, areaId: null } as any);
    const pedir = vi.spyOn(tvApi, 'pedirCodigo').mockResolvedValue(codigo('NEW234'));
    let revocar = () => {};
    render(
      <PuertaTv vista="SALON_VIVO" permiso="salon_vivo/ver">
        {(a) => {
          revocar = a.revocada;
          return <div>VISTA {a.llave}</div>;
        }}
      </PuertaTv>,
    );
    await avanzar(10);
    expect(screen.getByText('VISTA GUARDADA')).toBeInTheDocument();
    expect(pedir).not.toHaveBeenCalled();

    act(() => revocar());
    await avanzar(10);
    expect(screen.getByLabelText('Código de vinculación')).toHaveTextContent('NEW-234');
    expect(window.localStorage.getItem('caprichos_tv_llave_SALON_VIVO')).toBe('LLAVE-NEW234');
  });

  it('con sesión y permiso entra como siempre, sin pedir código', async () => {
    vi.spyOn(sesion, 'useSesion').mockReturnValue({ usuario: { id: 1 }, cargando: false, tiene: () => true } as any);
    const pedir = vi.spyOn(tvApi, 'pedirCodigo');
    montar();
    expect(screen.getByText('VISTA sesion')).toBeInTheDocument();
    expect(pedir).not.toHaveBeenCalled();
  });
});
