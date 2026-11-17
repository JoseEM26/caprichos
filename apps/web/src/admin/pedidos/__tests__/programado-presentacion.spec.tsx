import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TarjetaPedidoCaja } from '../TarjetaPedidoCaja';
import { ListaCaja } from '../ListaCaja';
import { PedidoDetalle } from '../PedidoDetalle';
import { esProgramadoOtroDia, paraCuandoDe, separarProgramadosOtrosDias, textoFaltan, textoPagoProgramado } from '../programado';
import { resumirDia, filasDePedidos } from '../resumenDia';
import type { Pedido } from '../pedidosApi';

vi.mock('../../../comun/sesion', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../comun/sesion')>()),
  useSesion: () => ({ tiene: () => true, usuario: null }),
}));
vi.mock('../../creditos/creditosApi', () => ({ listarPersonalActivo: vi.fn().mockResolvedValue([]), registrarConsumoCredito: vi.fn() }));

// Hoy lunes 16/11/2026 10:00 en Lima (15:00 UTC); el encargo es para mañana 17/11 a las 5:00 p. m. (22:00 UTC)
const AHORA = new Date('2026-11-16T15:00:00Z');
const MANANA_5PM = '2026-11-17T22:00:00Z';

const encargo = (o: Partial<Pedido> = {}) =>
  ({
    id: '7', codigo: 'CP-W100', canal: 'CAJA', modalidad: 'LLEVAR', estado: 'PROGRAMADO', pago_estado: 'PAGADO', total: 29, adelanto_total: 0,
    cliente_nombre: 'Ana', cliente_telefono: '987654321', creado_en: '2026-11-16T14:00:00Z', programado_para: MANANA_5PM,
    lineas: [{ id: '1', nombre: 'TORTA DE CHOCOLATE CORAZÓN 10CM - COLOCAR TEXTO "HB LUCÍA"', cantidad: 1, precio_unit: 29, subtotal: 29, cargoLibre: true, agregadoPor: 'Caja Rosa', agregadoEn: '2026-11-16T14:00:00Z' }],
    ...o,
  }) as unknown as Pedido;

describe('programado.ts', () => {
  it('mañana 17/11 5:00 p. m.: texto, faltan y otro día', () => {
    const pc = paraCuandoDe(encargo(), AHORA)!;
    expect(pc.cuando).toMatch(/^para mañana 17\/11 · 5:00 p\. ?m\.$/);
    expect(pc.faltan).toBe('faltan 1 d 7 h');
    expect(pc.otroDia).toBe(true);
    expect(pc.nivel).toBe('normal');
  });
  it('hoy: ámbar si falta poco, rojo si ya venció, y no es otro día', () => {
    const cerca = encargo({ programado_para: '2026-11-16T16:00:00Z' });
    expect(paraCuandoDe(cerca, AHORA)).toMatchObject({ nivel: 'cerca', otroDia: false });
    const vencido = encargo({ programado_para: '2026-11-16T14:30:00Z' });
    expect(paraCuandoDe(vencido, AHORA)).toMatchObject({ nivel: 'vencido', otroDia: false });
    expect(textoFaltan(new Date('2026-11-16T14:30:00Z'), AHORA)).toBe('vencido hace 30 min');
  });
  it('separa los de otros días al final, por fecha pactada; los de hoy y los sin fecha quedan en su lugar', () => {
    const a = encargo({ id: 'a', programado_para: '2026-11-19T20:00:00Z' });
    const b = encargo({ id: 'b', programado_para: '2026-11-17T20:00:00Z' });
    const hoy = encargo({ id: 'c', programado_para: '2026-11-16T22:00:00Z' });
    const normal = { id: 'd', estado: 'COLA', programado_para: null } as unknown as Pedido;
    const r = separarProgramadosOtrosDias([a, hoy, normal, b], AHORA);
    expect(r.normales.map((p) => p.id)).toEqual(['c', 'd']);
    expect(r.otrosDias.map((p) => p.id)).toEqual(['b', 'a']);
    expect(esProgramadoOtroDia(hoy, AHORA)).toBe(false);
  });
  it('texto de pago: completo o adelanto y saldo', () => {
    expect(textoPagoProgramado({ total: 29, pago_estado: 'PAGADO', adelanto_total: 0 })).toBe('Pagado completo S/ 29.00');
    expect(textoPagoProgramado({ total: 29, pago_estado: 'PENDIENTE', adelanto_total: 10 })).toBe('Adelanto S/ 10.00 · Saldo S/ 19.00');
  });
  it('el resumen del día no cuenta un programado como activo ni por cobrar; pagado sí suma como cobrado', () => {
    const r = resumirDia(filasDePedidos([encargo({ pago_estado: 'PENDIENTE' }), encargo({ id: '8' }), { ...encargo({ id: '9' }), estado: 'COLA', pago_estado: 'PENDIENTE' } as Pedido]));
    expect(r.activos).toBe(1);
    expect(r.porCobrar).toBe(1);
    expect(r.cobrado).toBe(29);
    expect(r.ventas).toBe(29 + 29);
  });
});

describe('tarjeta de Caja con un pedido programado', () => {
  it('muestra la franja con para cuándo, cuánto falta, el pago y el encargo aparte', () => {
    render(
      <TarjetaPedidoCaja pedido={encargo()} seleccionado={false} resaltado={false} cajaCerradaEspera={false} cambioCobroPendiente={false} alSeleccionar={vi.fn()} ahora={AHORA.getTime()} />,
    );
    const franja = screen.getByTestId('chip-programado');
    expect(franja).toHaveTextContent('PROGRAMADO');
    expect(franja).toHaveTextContent(/para mañana 17\/11 · 5:00 p\. ?m\./);
    expect(screen.getByTestId('programado-faltan')).toHaveTextContent(/faltan 1 d/);
    expect(screen.getByTestId('pago-programado')).toHaveTextContent('Pagado completo S/ 29.00');
    const bloque = screen.getByTestId('encargos-tarjeta');
    expect(bloque).toHaveTextContent('SERVICIO / ENCARGO');
    expect(screen.getByTestId('encargo-texto')).toHaveTextContent('COLOCAR TEXTO "HB LUCÍA"');
    // el encargo no se repite como producto de la carta
    expect(within(screen.getByTestId('productos-tarjeta')).queryByText(/TORTA/)).toBeNull();
  });

  it('un pedido sin fecha pactada no muestra franja', () => {
    render(
      <TarjetaPedidoCaja pedido={encargo({ estado: 'COLA', programado_para: null, lineas: [] })} seleccionado={false} resaltado={false} cajaCerradaEspera={false} cambioCobroPendiente={false} alSeleccionar={vi.fn()} />,
    );
    expect(screen.queryByTestId('chip-programado')).toBeNull();
  });
});

describe('lista de Caja con un pedido programado', () => {
  it('la fila trae la franja y el encargo', () => {
    render(
      <MemoryRouter>
        <ListaCaja filas={[encargo()]} accionDe={() => null} resaltados={new Set()} alAccion={vi.fn()} alVerDetalle={vi.fn()} alAbrir={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('chip-programado')).toHaveTextContent('PROGRAMADO');
    expect(screen.getByTestId('encargos-tarjeta')).toHaveTextContent('SERVICIO / ENCARGO');
  });
});

describe('detalle del pedido programado', () => {
  it('abre con PARA CUÁNDO (fecha larga, hora, modalidad) y Servicio / encargo completo con quién lo agregó', () => {
    render(
      <MemoryRouter>
        <PedidoDetalle pedido={encargo()} alActualizar={() => {}} />
      </MemoryRouter>,
    );
    const cuando = screen.getByTestId('bloque-para-cuando');
    expect(cuando).toHaveTextContent('PARA CUÁNDO');
    expect(screen.getByTestId('para-cuando-fecha').textContent).toMatch(/martes 17 de noviembre de 2026/i);
    expect(screen.getByTestId('para-cuando-hora')).toHaveTextContent(/5:00 p\. ?m\./);
    expect(screen.getByTestId('para-cuando-modalidad')).toHaveTextContent('Para llevar');
    expect(screen.getByTestId('para-cuando-pago')).toHaveTextContent('Pagado completo S/ 29.00');
    expect(within(cuando).getByRole('button', { name: 'Reprogramar' })).toBeInTheDocument();
    const serv = screen.getByTestId('bloque-servicio-encargo');
    expect(serv).toHaveTextContent('SERVICIO / ENCARGO');
    expect(screen.getByTestId('servicio-texto')).toHaveTextContent('TORTA DE CHOCOLATE CORAZÓN 10CM - COLOCAR TEXTO "HB LUCÍA"');
    expect(serv).toHaveTextContent('Agregado por Caja Rosa');
  });

  it('un pedido sin fecha pactada ni cargo libre no trae esos bloques', () => {
    render(
      <MemoryRouter>
        <PedidoDetalle pedido={encargo({ estado: 'COLA', programado_para: null, lineas: [] })} alActualizar={() => {}} />
      </MemoryRouter>,
    );
    expect(screen.queryByTestId('bloque-para-cuando')).toBeNull();
    expect(screen.queryByTestId('bloque-servicio-encargo')).toBeNull();
  });
});
