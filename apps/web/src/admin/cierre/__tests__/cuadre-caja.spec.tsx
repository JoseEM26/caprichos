import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { CuadreCaja, type CuadreCajaProps } from '../CuadreCaja';
import { HistorialCierres } from '../HistorialCierres';
import { cierreApi, type MontosEsperados } from '../cierreApi';
import * as sesionModulo from '../../../comun/sesion';
import {
  difTotal,
  estadoDif,
  leerBorrador,
  guardarBorrador,
  borradorVacio,
  parseMonto,
  reiniciarBorradores,
  textoDif,
  leyendaDifTotal,
  type FilaCuadre,
} from '../cuadre.util';

const esperado: MontosEsperados = {
  cajaId: 10,
  fecha: '2026-11-08T00:00:00.000Z',
  cobrados: [{ pedidoId: '1', codigo: 'CP-001', cliente: 'Ana', total: 90, medios: ['EFECTIVO'], en: '' }],
  movimientos: [
    { id: '1', caja_id: '10', tipo: 'INGRESO', monto: 20, motivo: 'Sencillo extra', anulado_en: null, motivo_anulacion: null },
    { id: '2', caja_id: '10', tipo: 'EGRESO', monto: 15, motivo: 'Hielo', anulado_en: null, motivo_anulacion: null },
  ],
  apertura: 50,
  efectivoEsperado: 355,
  medios: { efectivo: 355, yape: 200, plin: 0, transferencia: 50, tarjeta: 100 },
  desglose: {
    ventasEfectivo: 300,
    ingresos: 20,
    egresos: 15,
    apertura: 50,
    cobrosEfectivo: 300,
    vueltos: 10,
    esperado: 355,
  },
};

function montar(props: Partial<CuadreCajaProps> = {}) {
  const onCerrar = vi.fn().mockResolvedValue(true);
  const utils = render(
    <CuadreCaja
      esperado={esperado}
      fecha="2026-11-08"
      cajero="Ana"
      pendientesCount={0}
      repartidores={[]}
      onRecibirRepartidor={vi.fn()}
      onCerrar={onCerrar}
      onVolver={vi.fn()}
      {...props}
    />,
  );
  return { ...utils, onCerrar };
}

const cant = (d: string) => screen.getByLabelText(new RegExp(`^Cantidad de (billetes|monedas) de S/ ${d}$`));
const llenarCuentaExacta = () => {
  // 355 = 1×200 + 1×100 + 1×50 + 1×5
  fireEvent.change(cant('200'), { target: { value: '1' } });
  fireEvent.change(cant('100'), { target: { value: '1' } });
  fireEvent.change(cant('50'), { target: { value: '1' } });
  fireEvent.change(cant('5\\.00'), { target: { value: '1' } });
};

beforeEach(() => reiniciarBorradores());

describe('cuadre.util: lógica pura', () => {
  it('semáforo con texto: cuadra, sobra y falta', () => {
    expect(estadoDif(0)).toBe('cuadra');
    expect(estadoDif(0.004)).toBe('cuadra');
    expect(textoDif(0)).toBe('Cuadra ✓');
    expect(textoDif(12.5)).toBe('Sobra +S/ 12.50');
    expect(textoDif(-12.5)).toBe('Falta −S/ 12.50');
  });

  it('la diferencia total suma los medios ingresados y deja fuera los vacíos', () => {
    const filas: FilaCuadre[] = [
      { clave: 'efectivo', etiqueta: 'Efectivo', sistema: 355, visto: 350 },
      { clave: 'yape', etiqueta: 'Yape', sistema: 200, visto: 210 },
      { clave: 'plin', etiqueta: 'Plin', sistema: 0, visto: null },
      { clave: 'tarjeta', etiqueta: 'Tarjeta', sistema: 100, visto: 90 },
    ];
    expect(difTotal(filas)).toBe(-5);
    expect(leyendaDifTotal(-5)).toBe('Hay S/ 5.00 de menos en total');
    expect(leyendaDifTotal(7)).toBe('Hay S/ 7.00 de más en total');
  });

  it('parseMonto: vacío es «sin ingresar», acepta coma decimal', () => {
    expect(parseMonto('')).toBeNull();
    expect(parseMonto('12,5')).toBe(12.5);
    expect(parseMonto('abc')).toBeNull();
  });

  it('el borrador se guarda y se lee (memoria y sessionStorage)', () => {
    const b = { ...borradorVacio(), totalDirecto: '120', nota: 'x' };
    guardarBorrador(99, b);
    expect(leerBorrador(99).totalDirecto).toBe('120');
    expect(JSON.parse(sessionStorage.getItem('cuadre-caja-borrador-99') ?? '{}').nota).toBe('x');
  });
});

describe('Panel «Cuadre de caja»', () => {
  it('muestra desde el inicio el efectivo que debería haber con su desglose en lenguaje llano', () => {
    montar();
    const caja = screen.getByTestId('cc-deberia');
    expect(caja).toHaveTextContent('Efectivo que debería haber');
    expect(caja).toHaveTextContent('S/ 355.00');
    expect(caja).toHaveTextContent('Apertura de caja');
    expect(caja).toHaveTextContent('Cobros en efectivo');
    expect(caja).toHaveTextContent('Ingresos extra');
    expect(caja).toHaveTextContent('Egresos y gastos');
    expect(caja).toHaveTextContent('= Total que debería haber');
    expect(screen.getByText(/El conteo a ciegas ya no se usa/)).toBeInTheDocument();
  });

  it('cada línea del desglose se toca y lleva al detalle de movimientos', () => {
    montar();
    fireEvent.click(screen.getByRole('button', { name: /Egresos y gastos/ }));
    expect(screen.getByText('Hielo')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Cobros en efectivo/ }));
    expect(screen.getByText(/CP-001/)).toBeInTheDocument();
    expect(screen.getByText(/ya descontados los vueltos entregados \(S\/ 10\.00\)/i)).toBeInTheDocument();
  });

  it('total y diferencia en vivo por denominación: cuadra, sobra y falta con texto', () => {
    montar();
    expect(screen.getByTestId('cc-diferencia')).toHaveTextContent('Cuenta el efectivo');
    fireEvent.change(cant('200'), { target: { value: '1' } });
    expect(screen.getByTestId('cc-contado')).toHaveTextContent('S/ 200.00');
    expect(screen.getByTestId('cc-diferencia')).toHaveTextContent('Falta −S/ 155.00');
    expect(screen.getByTestId('sub-200')).toHaveTextContent('S/ 200.00');

    llenarCuentaExacta();
    expect(screen.getByTestId('total-efectivo-vivo')).toHaveTextContent('S/ 355.00');
    expect(screen.getByTestId('cc-diferencia')).toHaveTextContent('Cuadra ✓');

    fireEvent.change(cant('0\\.50'), { target: { value: '3' } });
    expect(screen.getByTestId('cc-diferencia')).toHaveTextContent('Sobra +S/ 1.50');
    expect(screen.getByTestId('cc-diferencia').querySelector('[data-estado="sobra"]')).not.toBeNull();
  });

  it('los botones − y + de 44 px cambian la cantidad', () => {
    montar();
    fireEvent.click(screen.getByRole('button', { name: /Agregar uno de billetes de S\/ 20$/ }));
    fireEvent.click(screen.getByRole('button', { name: /Agregar uno de billetes de S\/ 20$/ }));
    expect(cant('20')).toHaveValue('2');
    fireEvent.click(screen.getByRole('button', { name: /Quitar uno de billetes de S\/ 20$/ }));
    expect(cant('20')).toHaveValue('1');
    expect(screen.getByTestId('sub-20')).toHaveTextContent('S/ 20.00');
  });

  it('modo «Ingresar total directo»: un solo campo, diferencia en vivo y coherente con los billetes', () => {
    montar();
    fireEvent.change(cant('100'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ingresar total directo' }));
    const total = screen.getByLabelText('Total de efectivo contado (S/)');
    // arranca con lo que ya se contó por billetes
    expect(total).toHaveValue('200');
    fireEvent.change(total, { target: { value: '360.50' } });
    expect(screen.getByTestId('cc-contado')).toHaveTextContent('S/ 360.50');
    expect(screen.getByTestId('cc-diferencia')).toHaveTextContent('Sobra +S/ 5.50');
    // volver a billetes no pierde lo contado
    fireEvent.click(screen.getByRole('button', { name: 'Por billetes y monedas' }));
    expect(cant('100')).toHaveValue('2');
    expect(screen.getByTestId('cc-contado')).toHaveTextContent('S/ 200.00');
  });

  it('Limpiar borra el conteo', () => {
    montar();
    fireEvent.change(cant('100'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar' }));
    expect(cant('100')).toHaveValue('');
    expect(screen.getByTestId('cc-contado')).toHaveTextContent('—');
  });

  it('medios digitales: vacíos por defecto, diferencia en vivo y atajo «Coincide con el sistema»', () => {
    montar();
    const yape = screen.getByTestId('digital-yape');
    const campo = within(yape).getByLabelText('Lo que veo en mi app/POS');
    expect(campo).toHaveValue('');
    expect(yape).toHaveTextContent('Sistema S/ 200.00');
    fireEvent.change(campo, { target: { value: '210' } });
    expect(yape).toHaveTextContent('Sobra +S/ 10.00');
    fireEvent.change(campo, { target: { value: '180' } });
    expect(yape).toHaveTextContent('Falta −S/ 20.00');
    fireEvent.click(within(yape).getByRole('button', { name: 'Coincide con el sistema: Yape' }));
    expect(campo).toHaveValue('200');
    expect(yape).toHaveTextContent('Cuadra ✓');
  });

  it('diferencia total del día suma todos los medios y muestra el avance del conteo', () => {
    montar();
    llenarCuentaExacta();
    fireEvent.change(within(screen.getByTestId('digital-yape')).getByLabelText('Lo que veo en mi app/POS'), { target: { value: '210' } });
    fireEvent.change(within(screen.getByTestId('digital-tarjeta')).getByLabelText('Lo que veo en mi app/POS'), { target: { value: '90' } });
    // +10 −10 se compensan: el total es 0 pero hay diferencias
    expect(screen.getByTestId('cc-total-dia')).toHaveTextContent('compensan');
    fireEvent.change(within(screen.getByTestId('digital-plin')).getByLabelText('Lo que veo en mi app/POS'), { target: { value: '5' } });
    expect(screen.getByTestId('cc-total-dia')).toHaveTextContent('Sobra +S/ 5.00');
    expect(screen.getByTestId('cc-total-dia')).toHaveTextContent('Hay S/ 5.00 de más en total');
    expect(screen.getByTestId('cc-progreso')).toHaveTextContent('Efectivo ✓');
    expect(screen.getByTestId('cc-progreso')).toHaveTextContent('Yape ✓');
    expect(screen.getByTestId('cc-progreso')).toHaveTextContent('Transferencia ·');
  });

  it('el botón de cerrar sigue habilitado con diferencia: «Cerrar caja con diferencia de −S/ 12.50», y el pie es fijo', () => {
    montar();
    fireEvent.change(cant('200'), { target: { value: '1' } });
    fireEvent.change(cant('100'), { target: { value: '1' } });
    fireEvent.change(cant('20'), { target: { value: '1' } });
    fireEvent.change(cant('10'), { target: { value: '1' } });
    fireEvent.change(cant('5\\.00'), { target: { value: '1' } });
    fireEvent.change(cant('2\\.00'), { target: { value: '1' } });
    fireEvent.change(cant('0\\.50'), { target: { value: '1' } });
    // 337.50 − 355 = −17.50
    const boton = screen.getByRole('button', { name: /^Cerrar caja con diferencia de −S\/ 17\.50$/ });
    expect(boton).toBeEnabled();
    expect(within(screen.getByTestId('cc-pie')).getByRole('button')).toBe(boton);
  });

  it('cuadra: botón verde «Cerrar caja»; confirmación Sí/No con nota opcional y la advertencia', async () => {
    const { onCerrar } = montar();
    llenarCuentaExacta();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar caja' }));
    const dlg = await screen.findByRole('dialog');
    expect(dlg).toHaveTextContent('¿Cerrar la caja cuadrada?');
    expect(dlg).toHaveTextContent('El cierre queda registrado con esta diferencia y no se puede editar después.');
    expect(within(dlg).getByLabelText(/recomendado, no es obligatorio/)).toBeInTheDocument();
    fireEvent.click(within(dlg).getByRole('button', { name: 'Sí, cerrar caja' }));
    await waitFor(() => expect(onCerrar).toHaveBeenCalledTimes(1));
    expect(onCerrar.mock.calls[0][0]).toMatchObject({ conteo: { '200': 1, '100': 1, '50': 1, '5': 1 }, nota: undefined });
  });

  it('con diferencia: la confirmación resume por medio y la nota opcional viaja si se escribe', async () => {
    const { onCerrar } = montar();
    fireEvent.change(cant('100'), { target: { value: '1' } });
    fireEvent.change(within(screen.getByTestId('digital-yape')).getByLabelText('Lo que veo en mi app/POS'), { target: { value: '210' } });
    fireEvent.click(screen.getByRole('button', { name: /^Cerrar caja con diferencia de/ }));
    const dlg = await screen.findByRole('dialog');
    const tabla = within(dlg).getByRole('table', { name: 'Resumen por medio' });
    expect(tabla).toHaveTextContent('Falta −S/ 255.00');
    expect(tabla).toHaveTextContent('Sobra +S/ 10.00');
    fireEvent.change(within(dlg).getByLabelText(/Nota/), { target: { value: 'Faltó sencillo' } });
    fireEvent.click(within(dlg).getByRole('button', { name: 'Sí, cerrar caja' }));
    await waitFor(() => expect(onCerrar).toHaveBeenCalled());
    expect(onCerrar.mock.calls[0][0]).toMatchObject({ conteo: { '100': 1 }, medios: { yape: 210 }, nota: 'Faltó sencillo' });
  });

  it('con total directo envía efectivoTotal en vez del conteo', async () => {
    const { onCerrar } = montar();
    fireEvent.click(screen.getByRole('button', { name: 'Ingresar total directo' }));
    fireEvent.change(screen.getByLabelText('Total de efectivo contado (S/)'), { target: { value: '355' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar caja' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Sí, cerrar caja' }));
    await waitFor(() => expect(onCerrar).toHaveBeenCalled());
    const p = onCerrar.mock.calls[0][0];
    expect(p.efectivoTotal).toBe(355);
    expect(p.conteo).toBeUndefined();
  });

  it('«No, volver» no cierra', async () => {
    const { onCerrar } = montar();
    llenarCuentaExacta();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar caja' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'No, volver' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onCerrar).not.toHaveBeenCalled();
  });

  it('pendientes de cobro bloquean el cierre y llevan a resolverlos en la misma pantalla', () => {
    montar({ pendientesCount: 2, pendientesPanel: <div>panel pendientes</div> });
    expect(screen.getByTestId('cc-estado')).toHaveTextContent('2 pedidos sin cobrar');
    const cerrar = screen.getByRole('button', { name: 'Resuelve los pendientes para cerrar' });
    expect(cerrar).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Resolver' }));
    expect(screen.getByText('panel pendientes')).toBeInTheDocument();
  });

  it('repartidores por liquidar bloquean y permiten recibir el efectivo', () => {
    const onRecibirRepartidor = vi.fn();
    const r = { repartidorPartyId: 7, nombre: 'Luis', pedidos: [], totalCobrado: 40, totalLiquidado: 0, pendiente: 40 };
    montar({ repartidores: [r], onRecibirRepartidor });
    expect(screen.getByRole('button', { name: 'Resuelve los pendientes para cerrar' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Recibir el efectivo' }));
    expect(onRecibirRepartidor).toHaveBeenCalledWith(r);
  });

  it('el borrador persiste: al volver a abrir el panel sigue lo escrito', () => {
    const { unmount } = montar();
    fireEvent.change(cant('100'), { target: { value: '3' } });
    fireEvent.change(within(screen.getByTestId('digital-yape')).getByLabelText('Lo que veo en mi app/POS'), { target: { value: '150' } });
    unmount();
    montar();
    expect(cant('100')).toHaveValue('3');
    expect(within(screen.getByTestId('digital-yape')).getByLabelText('Lo que veo en mi app/POS')).toHaveValue('150');
  });

  it('Enter pasa al siguiente campo del conteo', () => {
    montar();
    cant('200').focus();
    fireEvent.keyDown(cant('200'), { key: 'Enter' });
    expect(cant('100')).toHaveFocus();
  });

  it('si el servidor rechaza el cierre (p. ej. pagos sin cobro) deja la confirmación abierta con el error', async () => {
    const { onCerrar } = montar({ error: 'Hay 1 pedido(s) pagados sin cobro en caja' });
    onCerrar.mockResolvedValue(false);
    llenarCuentaExacta();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar caja' }));
    const dlg = await screen.findByRole('dialog');
    expect(within(dlg).getByRole('alert')).toHaveTextContent('pagados sin cobro');
    fireEvent.click(within(dlg).getByRole('button', { name: 'Sí, cerrar caja' }));
    await waitFor(() => expect(onCerrar).toHaveBeenCalled());
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

describe('Historial: «Cerrado con diferencia»', () => {
  it('muestra la etiqueta con la diferencia total, la nota y quién cerró', async () => {
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
      usuario: { partyId: '1', nombres: 'Admin', rol: 'ADMIN' }, permisos: ['caja/ver'], tiene: vi.fn().mockReturnValue(true),
    } as any);
    vi.spyOn(cierreApi, 'obtenerHistorial').mockResolvedValue({
      cierres: [
        {
          cajaId: 5, fecha: '2026-10-21T00:00:00Z', apertura: 100, cerradaPor: 2, cerradaPorNombre: 'Carmen Cajera', cerradaEn: '2026-10-21T21:00:00Z',
          cierre: {
            resultado: 'NO_CUADRA', aprobadoPor: null, nota: 'Faltó sencillo',
            medios: [
              { medio: 'EFECTIVO', sistema: 355, visto: 351, diferencia: -4 },
              { medio: 'YAPE', sistema: 200, visto: 201, diferencia: 1 },
            ],
          },
        },
        {
          cajaId: 6, fecha: '2026-10-22T00:00:00Z', apertura: 100, cerradaPor: 2, cerradaPorNombre: 'Carmen Cajera', cerradaEn: '2026-10-22T21:00:00Z',
          cierre: { resultado: 'CUADRA', aprobadoPor: null, nota: null, medios: [{ medio: 'EFECTIVO', sistema: 100, visto: 100, diferencia: 0 }] },
        },
      ],
      total: 2, pagina: 1, limite: 20, totalPaginas: 1,
    } as any);
    render(<HistorialCierres />);
    const etiqueta = await screen.findByTestId('cerrado-con-diferencia');
    expect(etiqueta).toHaveTextContent('Cerrado con diferencia: −S/ 3.00');
    expect(screen.getAllByTestId('cerrado-con-diferencia')).toHaveLength(1);
    expect(screen.getByText('Nota: Faltó sencillo')).toBeInTheDocument();
    expect(screen.getAllByText('Cerró: Carmen Cajera')).toHaveLength(2);
  });
});
