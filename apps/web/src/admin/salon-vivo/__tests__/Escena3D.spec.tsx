import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { salonEjemplo } from './datosEjemplo';

const motor = { actualizar: vi.fn(), destruir: vi.fn() };
const crearMotor = vi.fn((_op: any) => motor);
vi.mock('../escena3d/motor', () => ({ crearMotor: (op: any) => crearMotor(op) }));

import Escena3D from '../Escena3D';

describe('Escena3D (con el motor simulado, sin WebGL)', () => {
  const base = () => ({ piso: salonEjemplo().pisos[0], datos: salonEjemplo(), reducir: false, ligero: false, onMotor: vi.fn(), alMeseros: vi.fn(), onError: vi.fn() });

  it('crea el motor con el plano real, le pasa los datos y lo libera al salir', () => {
    crearMotor.mockClear(); motor.actualizar.mockClear(); motor.destruir.mockClear();
    const p = base();
    const { unmount, rerender } = render(<Escena3D {...p} />);
    expect(crearMotor).toHaveBeenCalledTimes(1);
    expect(crearMotor.mock.calls[0][0]).toMatchObject({ piso: p.piso, reducir: false, ligero: false });
    expect(p.onMotor).toHaveBeenCalledWith(motor);
    expect(motor.actualizar).toHaveBeenCalledTimes(1);
    // datos nuevos: solo se actualiza, no se rehace la escena
    rerender(<Escena3D {...p} datos={{ ...p.datos }} />);
    expect(crearMotor).toHaveBeenCalledTimes(1);
    expect(motor.actualizar).toHaveBeenCalledTimes(2);
    unmount();
    expect(motor.destruir).toHaveBeenCalled();
    expect(p.onMotor).toHaveBeenLastCalledWith(null);
  });

  it('rehace la escena si cambia el plano o el modo ligero', () => {
    crearMotor.mockClear();
    const p = base();
    const { rerender } = render(<Escena3D {...p} />);
    rerender(<Escena3D {...p} ligero />);
    expect(crearMotor).toHaveBeenCalledTimes(2);
    const piso2 = { ...p.piso, elementos: [...p.piso.elementos, { id: '99', tipo: 'MESA', nombre: 'Mesa 9', x: 5, y: 5, ancho: 2, alto: 2, numero: 9, asientos: 4, activo: true }] };
    rerender(<Escena3D {...p} piso={piso2} ligero />);
    expect(crearMotor).toHaveBeenCalledTimes(3);
  });

  it('avisa si no se puede crear la escena', () => {
    crearMotor.mockImplementationOnce(() => { throw new Error('sin WebGL'); });
    const p = base();
    render(<Escena3D {...p} />);
    expect(p.onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'sin WebGL' }));
  });
});
