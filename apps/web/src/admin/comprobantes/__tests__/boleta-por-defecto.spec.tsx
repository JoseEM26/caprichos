import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import * as sesionModulo from '../../../comun/sesion';
import { comprobantesApi } from '../comprobantesApi';
import { ElectronicosTab } from '../ElectronicosTab';

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
    usuario: { partyId: '1', nombres: 'Test', rol: 'ADMIN' },
    permisos: [],
    tiene: vi.fn().mockReturnValue(true),
  } as any);
  vi.spyOn(comprobantesApi, 'listarElectronicos').mockResolvedValue({ total: 0, pagina: 1, limite: 20, totalPaginas: 1, elementos: [] } as any);
  vi.spyOn(comprobantesApi, 'obtenerFacturacion').mockResolvedValue({
    igvPct: 10.5,
    serieBoleta: 'B002',
    serieFactura: 'F002',
    proveedor: 'SIMULADO',
    proveedor_efectivo: 'SIMULADO',
    sunat: { ambiente: 'beta', credenciales: false, vence_certificado: null },
  } as any);
});

describe('Boleta electrónica por defecto (Electrónicos SUNAT)', () => {
  it('muestra la marca, explica que en simulado no cambia nada y cambia con Sí/No', async () => {
    vi.spyOn(comprobantesApi, 'obtenerBoletaPorDefecto').mockResolvedValue({ activo: true, aplica: false, proveedor_efectivo: 'SIMULADO' });
    const guardar = vi.spyOn(comprobantesApi, 'guardarBoletaPorDefecto').mockResolvedValue({ activo: false, aplica: false, proveedor_efectivo: 'SIMULADO' });
    render(<ElectronicosTab />);

    const seccion = await screen.findByRole('region', { name: 'Boleta electrónica por defecto' });
    expect(seccion.textContent).toMatch(/en Simulado no cambia nada/);
    expect(screen.getByRole('button', { name: 'Sí' }).getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'No' }));
    expect(guardar).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, guardar' }));
    await waitFor(() => expect(guardar).toHaveBeenCalledWith(false));
  });
});
