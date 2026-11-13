import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DetalleCierreModal } from '../DetalleCierreModal';
import { GuiaRevision } from '../GuiaRevision';
import { cierreApi } from '../cierreApi';
import { ticketEjemplo } from './ticketCierreEjemplo';

const detalle = {
  cajaId: 5, fecha: '2026-10-21T00:00:00Z', apertura: 100, resultado: 'NO_CUADRA' as const, aprobadoPor: 1, nota: null,
  cerradaPor: 2, cerradaEn: '2026-10-21T21:00:00Z', conteo: null, medios: [], ajustesMedio: [], ticket: ticketEjemplo(),
};
const abrir = (esAdmin: boolean) =>
  render(<DetalleCierreModal cajaId={5} detalle={detalle} cargando={false} error={null} esAdmin={esAdmin} puedeImprimir={false} alCerrar={vi.fn()} />);

const analisis = {
  cajaId: 5, cerrada: true, totalDiferencia: 99.2,
  medios: [{ medio: 'EFECTIVO', sistema: 621.9, visto: 643.5, diferencia: 21.6 }, { medio: 'YAPE', sistema: 1604.2, visto: 1637.8, diferencia: 33.6 }],
  patrones: [{ codigo: 'CREDITO_PERSONAL', titulo: 'Pedidos con crédito del personal', explicacion: 'No afecta la caja.', informativo: true, montoRelacionado: 34.5, pedidos: [{ codigo: 'P-009', monto: 34.5, detalle: 'Crédito del personal' }] }, { codigo: 'ANULADOS_CON_PAGO', titulo: 'Pedidos anulados que tenían pago', explicacion: 'Posible causa de sobrante.', pedidos: [{ codigo: 'P-001', monto: 32, detalle: 'Yape · pedido anulado' }] }],
  sugerencias: [{ medio: 'YAPE', diferencia: 33.6, coincideCon: ['x'], texto: 'La diferencia de Yape coincide con P-001.' }],
  ayudaGeneral: [{ medio: 'EFECTIVO', sobrante: ['Vuelto que no se entregó'], faltante: ['Gasto sin registrar'] }],
};

describe('¿Por qué no cuadra? (administrador)', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('el administrador ve la pestaña con tabla, hallazgos con pedidos, coincidencias y ayuda general', async () => {
    vi.spyOn(cierreApi, 'obtenerAnalisis').mockResolvedValue(analisis as any);
    abrir(true);
    fireEvent.click(screen.getByRole('tab', { name: '¿Por qué no cuadra?' }));
    await waitFor(() => expect(screen.getByTestId('seccion-porque')).toBeInTheDocument());
    expect(screen.getByTestId('porque-medios')).toHaveTextContent('+S/ 99.20');
    expect(screen.getByTestId('patron-ANULADOS_CON_PAGO')).toHaveTextContent('P-001');
    expect(screen.getByTestId('patron-ANULADOS_CON_PAGO')).toHaveTextContent('Posible causa');
    // El crédito del personal no es dinero: no se presenta como causa posible
    expect(screen.getByTestId('patron-CREDITO_PERSONAL')).toHaveTextContent('No afecta la caja');
    expect(screen.getByTestId('patron-CREDITO_PERSONAL')).not.toHaveTextContent('Posible causa');
    expect(screen.getByTestId('sugerencias')).toHaveTextContent('coincide con P-001');
    expect(screen.getByTestId('ayuda-general')).toHaveTextContent('Vuelto que no se entregó');
    expect(cierreApi.obtenerAnalisis).toHaveBeenCalledWith(5);
  });

  it('quien no es administrador no ve la pestaña', () => {
    abrir(false);
    expect(screen.queryByRole('tab', { name: '¿Por qué no cuadra?' })).not.toBeInTheDocument();
  });
});

describe('Guía de revisión (caja)', () => {
  const guia = {
    cajaId: 5,
    anuladosConPago: [{ codigo: 'A-1', medio: 'YAPE', monto: 32 }],
    cobrosAnulados: [{ codigo: 'P-2', medio: 'YAPE', monto: 15, hora: '15:00' }],
    movimientos: [{ tipo: 'EGRESO', monto: 10, motivo: 'Hielo', anulado: false }],
    pendientesDeCobro: [],
    propinasPorMedio: [{ medio: 'YAPE', cantidad: 3 }],
    repartidoresPorLiquidar: [{ nombre: 'Rep Uno', pedidos: 2 }],
    lista: ['¿Contaste los billetes y las monedas dos veces?', '¿Registraste los gastos como egreso?'],
  };
  beforeEach(() => vi.restoreAllMocks());

  it('antes de cerrar: muestra los ítems del día y la lista, sin diferencias ni esperado', async () => {
    vi.spyOn(cierreApi, 'obtenerGuiaRevision').mockResolvedValue(guia as any);
    render(<GuiaRevision modo="antes" />);
    await waitFor(() => expect(screen.getByTestId('guia-lista')).toBeInTheDocument());
    expect(screen.getByText('Antes de cerrar, revisa esto')).toBeInTheDocument();
    expect(screen.getByTestId('guia-anulados')).toHaveTextContent('A-1');
    expect(screen.getByTestId('guia-cobros')).toHaveTextContent('P-2');
    expect(screen.getByTestId('guia-prop')).toHaveTextContent('3 cobros con propina');
    expect(screen.queryByTestId('guia-pend')).not.toBeInTheDocument();
    const texto = screen.getByTestId('guia-antes').textContent!.toLowerCase();
    for (const p of ['sobrante', 'faltante', 'debería', 'esperado', 'diferencia']) expect(texto).not.toContain(p);
  });

  it('tras un arqueo que no cuadra: «Algo no cuadra» sin decir medio ni cuánto', async () => {
    vi.spyOn(cierreApi, 'obtenerGuiaRevision').mockResolvedValue(guia as any);
    render(<GuiaRevision modo="no-cuadra" />);
    await waitFor(() => expect(screen.getByTestId('guia-lista')).toBeInTheDocument());
    expect(screen.getByText('Algo no cuadra: revisa estos puntos')).toBeInTheDocument();
    const texto = screen.getByTestId('guia-no-cuadra').textContent!.toLowerCase();
    for (const p of ['sobrante', 'faltante', 'esperado', 'diferencia']) expect(texto).not.toContain(p);
  });
});
