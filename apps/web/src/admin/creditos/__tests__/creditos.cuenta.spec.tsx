import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { CreditosView } from '../CreditosView';
import * as api from '../creditosApi';
import * as sesionModulo from '../../../comun/sesion';

const sesion = (permisos: string[]) =>
  ({
    usuario: { id: '1', partyId: '1', nombres: 'Kevin', rol: 'ADMIN' },
    permisos,
    cargando: false,
    autenticado: true,
    tiene: (c: string) => permisos.includes(c),
  }) as any;

const resumen: api.RespuestaResumenCreditos = {
  descuentoPct: 25,
  periodo: { tipo: 'semana', etiqueta: 'Lun 02/11 – Dom 08/11', desde: '2026-11-02', hasta: '2026-11-08', navegable: true },
  totales: { totalMonto: 30, totalFormateado: 's/ 30.00', totalConsumos: 2, trabajadoresConConsumo: 1, totalTrabajadores: 1, resumenTrabajadores: '1 de 1' },
  trabajadores: [
    {
      partyId: '14', nombre: 'Jorge Salas', rol: 'Reparto', total: 30, totalFormateado: 's/ 30.00', tieneConsumo: true, cantidadConsumos: 2, pendiente: 20,
      items: [
        { id: '1', pedidoId: '11', pedidoCodigo: 'CP-1', fecha: '03/11', fechaIso: '2026-11-03T00:00:00.000Z', monto: 20, montoFormateado: 's/ 20.00', lineas: ['1 × Café'], estadoPago: 'PENDIENTE' },
        { id: '2', pedidoId: '12', pedidoCodigo: 'CP-2', fecha: '04/11', fechaIso: '2026-11-04T00:00:00.000Z', monto: 10, montoFormateado: 's/ 10.00', lineas: ['1 × Té'], estadoPago: 'PAGADO', pagoModo: 'CAJA' },
      ],
    },
  ],
};

describe('Créditos: cuenta del trabajador, pagar ahora y planilla', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api, 'obtenerResumenCreditos').mockResolvedValue(resumen);
    vi.spyOn(api, 'listarPersonalActivo').mockResolvedValue([]);
    vi.spyOn(api, 'obtenerCuentaCredito').mockResolvedValue({
      partyId: '14', semana: { etiqueta: '', total: 30, debe: 20 }, mes: { etiqueta: '', total: 30, debe: 20 }, debeTotal: 20,
      resumen: 'Debe esta semana: S/ 20.00 · Este mes: S/ 20.00', consumos: [],
    });
  });

  it('muestra «Debe esta semana / Este mes» y el estado de cada consumo', async () => {
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue(sesion(['creditos/ver', 'creditos/saldar']));
    render(<CreditosView />);
    fireEvent.click(await screen.findByText('Jorge Salas'));
    expect(await screen.findByText('Debe esta semana: S/ 20.00 · Este mes: S/ 20.00')).toBeInTheDocument();
    expect(screen.getByText('⏳ Pendiente')).toBeInTheDocument();
    expect(screen.getByText('✓ Cobrado')).toBeInTheDocument();
  });

  it('el check Cobrado dice quién cobró y con qué medio; el filtro Pendientes/Cobrados/Todos recorta la lista', async () => {
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue(sesion(['creditos/ver']));
    const conQuien = structuredClone(resumen);
    Object.assign(conQuien.trabajadores[0].items[1], { pagadoEn: '2026-11-04T15:30:00.000Z', pagoMedio: 'EFECTIVO', cobradoPor: 'Luis Mozo' });
    vi.spyOn(api, 'obtenerResumenCreditos').mockResolvedValue(conQuien);
    render(<CreditosView />);
    fireEvent.click(await screen.findByText('Jorge Salas'));
    expect(screen.getByText(/cobró Luis Mozo · efectivo/)).toBeInTheDocument();
    expect(screen.getByTestId('resumen-pendiente-cobrado')).toHaveTextContent('Pendiente: s/ 20.00 · Cobrado: s/ 10.00');
    fireEvent.click(screen.getByRole('button', { name: 'Pendientes' }));
    expect(screen.getByText(/CP-1/)).toBeInTheDocument();
    expect(screen.queryByText(/CP-2/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Cobrados' }));
    expect(screen.queryByText(/CP-1/)).toBeNull();
    expect(screen.getByText(/CP-2/)).toBeInTheDocument();
  });

  it('un consumo cobrado por planilla muestra a qué período pertenece y no se desmarca desde aquí', async () => {
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue(sesion(['creditos/ver', 'creditos/saldar']));
    const conPlanilla = structuredClone(resumen);
    Object.assign(conPlanilla.trabajadores[0].items[1], { pagoModo: 'PLANILLA', pagoMedio: 'PLANILLA', pagadoEn: '2026-11-09T15:30:00.000Z', planillaPeriodoId: '40', planillaPeriodo: '2026-11-02 a 2026-11-08' });
    vi.spyOn(api, 'obtenerResumenCreditos').mockResolvedValue(conPlanilla);
    render(<CreditosView />);
    fireEvent.click(await screen.findByText('Jorge Salas'));
    expect(screen.getByText(/Planilla 2026-11-02 a 2026-11-08/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Desmarcar CP-2/ })).toBeNull();
    expect(screen.getByText(/reabre ese período en Asistencia/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ya se le descontó CP-1/ })).toBeInTheDocument();
  });

  it('solo con creditos/saldar aparece «Ya se le descontó»; confirma Sí/No y llama a marcarCobrado', async () => {
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue(sesion(['creditos/ver']));
    const { unmount } = render(<CreditosView />);
    fireEvent.click(await screen.findByText('Jorge Salas'));
    expect(screen.queryByRole('button', { name: /Ya se le descontó/ })).toBeNull();
    unmount();
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue(sesion(['creditos/ver', 'creditos/saldar']));
    const marcar = vi.spyOn(api, 'marcarCobrado').mockResolvedValue({ ok: true, cobrado: true });
    render(<CreditosView />);
    fireEvent.click(await screen.findByText('Jorge Salas'));
    fireEvent.click(screen.getByRole('button', { name: /Ya se le descontó CP-1/ }));
    expect(marcar).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('button', { name: 'Sí' }));
    await waitFor(() => expect(marcar).toHaveBeenCalledWith('1', true));
  });

  it('Pagar ahora: marca los pendientes, confirma Sí/No y salda en un solo pago', async () => {
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue(sesion(['creditos/ver', 'creditos/saldar']));
    const saldar = vi.spyOn(api, 'saldarConsumos').mockResolvedValue({ ok: true, total: 20, cantidad: 1 });
    render(<CreditosView />);
    fireEvent.click(await screen.findByText('Jorge Salas'));
    expect(screen.queryByLabelText('Marcar CP-2 para pagar')).toBeNull();
    fireEvent.click(screen.getByLabelText('Marcar CP-1 para pagar'));
    fireEvent.click(screen.getByRole('button', { name: /Pagar ahora \(1\)/ }));
    expect(saldar).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, registrar pago' }));
    await waitFor(() => expect(saldar).toHaveBeenCalledWith(['1'], 'EFECTIVO'));
  });

  it('No cancela sin pagar', async () => {
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue(sesion(['creditos/ver', 'creditos/saldar']));
    const saldar = vi.spyOn(api, 'saldarConsumos').mockResolvedValue({ ok: true, total: 20, cantidad: 1 });
    render(<CreditosView />);
    fireEvent.click(await screen.findByText('Jorge Salas'));
    fireEvent.click(screen.getByLabelText('Marcar CP-1 para pagar'));
    fireEvent.click(screen.getByRole('button', { name: /Pagar ahora \(1\)/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'No, cancelar' }));
    expect(saldar).not.toHaveBeenCalled();
  });

  it('sin permiso de saldar no se ofrecen pagar ni planilla; con permiso, planilla exige motivo', async () => {
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue(sesion(['creditos/ver']));
    const { unmount } = render(<CreditosView />);
    fireEvent.click(await screen.findByText('Jorge Salas'));
    expect(screen.queryByRole('button', { name: /Marcar periodo como descontado por planilla/ })).toBeNull();
    expect(screen.queryByLabelText('Marcar CP-1 para pagar')).toBeNull();
    unmount();

    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue(sesion(['creditos/ver', 'creditos/saldar']));
    const planilla = vi.spyOn(api, 'marcarPlanilla').mockResolvedValue({ ok: true, cantidad: 1, total: 20 });
    render(<CreditosView />);
    fireEvent.click(await screen.findByRole('button', { name: /Marcar periodo como descontado por planilla/ }));
    const confirmar = (await screen.findByRole('button', { name: 'Sí, marcar como pagado' })) as HTMLButtonElement;
    expect(confirmar.disabled).toBe(true);
    fireEvent.change(screen.getByPlaceholderText(/planilla de la semana/), { target: { value: 'Planilla semana 45' } });
    fireEvent.click(confirmar);
    await waitFor(() => expect(planilla).toHaveBeenCalledWith('2026-11-02', '2026-11-08', 'Planilla semana 45'));
    expect(await within(document.body).findByText(/consumo\(s\) marcados/)).toBeTruthy();
  });
});
