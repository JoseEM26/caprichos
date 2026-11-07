import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ayudaCanales, canalesDesdeEstado, canalesPorDefecto, estadoDesdeCanales } from '../canalesPromo';
import { ModalDescuento } from '../ModalDescuento';
import { ModalEnvioGratis } from '../ModalEnvioGratis';
import { ModalCupon } from '../ModalCupon';

describe('canales de las ofertas (tres casillas: carta, local, WhatsApp)', () => {
  it('guarda CARTA, ADMIN y BOT según las casillas', () => {
    expect(canalesDesdeEstado({ carta: true, local: true, bot: false })).toEqual(['CARTA', 'ADMIN']);
    expect(canalesDesdeEstado({ carta: true, local: true, bot: true })).toEqual(['CARTA', 'ADMIN', 'BOT']);
    expect(canalesDesdeEstado({ carta: false, local: false, bot: true })).toEqual(['BOT']);
    expect(canalesDesdeEstado({ carta: true, local: true, bot: false }, 'CAJA')).toEqual(['CARTA', 'CAJA']);
  });

  it('lee el estado real guardado, incluidos TODOS, WHATSAPP y CAJA de datos viejos', () => {
    expect(estadoDesdeCanales(['CARTA', 'ADMIN'])).toEqual({ carta: true, local: true, bot: false });
    expect(estadoDesdeCanales(['CARTA', 'ADMIN', 'BOT'])).toEqual({ carta: true, local: true, bot: true });
    expect(estadoDesdeCanales(['CARTA'])).toEqual({ carta: true, local: false, bot: false });
    expect(estadoDesdeCanales(['WHATSAPP'])).toEqual({ carta: false, local: false, bot: true });
    expect(estadoDesdeCanales(['TODOS'])).toEqual({ carta: true, local: true, bot: false });
    expect(estadoDesdeCanales(['CARTA', 'CAJA'])).toEqual({ carta: true, local: true, bot: false });
  });

  it('valores por defecto: WhatsApp encendido solo donde el bot ya aplica el tipo', () => {
    expect(canalesPorDefecto('ENVIO_GRATIS')).toEqual({ carta: true, local: true, bot: true });
    expect(canalesPorDefecto('DESCUENTO').bot).toBe(true);
    expect(canalesPorDefecto('LLEVA_PAGA').bot).toBe(true);
    expect(canalesPorDefecto('COMBO')).toEqual({ carta: true, local: true, bot: true });
    expect(canalesPorDefecto('CUPON').bot).toBe(false);
  });

  it('el texto de ayuda cambia con el estado y nunca dice «no la aplica» cuando WhatsApp está encendido', () => {
    const con = ayudaCanales('ENVIO_GRATIS', { carta: true, local: true, bot: true });
    const sin = ayudaCanales('ENVIO_GRATIS', { carta: true, local: true, bot: false });
    expect(con).toMatch(/WhatsApp/);
    expect(con).not.toMatch(/no la aplica/);
    expect(sin).toMatch(/no la aplica ni la ofrece/);
    expect(ayudaCanales('DESCUENTO', { carta: true, local: false, bot: false })).toMatch(/Aplica en la carta web\./);
    expect(ayudaCanales('CUPON', { carta: true, local: true, bot: false })).toMatch(/no pide códigos/);
  });
});

const descuentoBase = {
  id: '5', tipo: 'DESCUENTO', nombre: '10% en toda la carta', descuentoTipo: 'PORCENTAJE', descuentoValor: 10, activo: true,
  dias: [], horaDesde: null, horaHasta: null, fechaDesde: null, fechaHasta: null, compraMinima: 0, orden: 0, canales: ['CARTA', 'ADMIN'],
} as any;

async function irAlPasoDeCanales(props: Record<string, unknown>) {
  render(<ModalDescuento abierto onCerrar={() => {}} onGuardar={vi.fn()} productosDisponibles={[]} categorias={[]} {...props} />);
  fireEvent.change(document.getElementById('desc-nombre')!, { target: { value: '10% de prueba' } });
  fireEvent.click(screen.getByRole('button', { name: /Siguiente/ }));
  await waitFor(() => expect(document.getElementById('desc-canal-bot')).not.toBeNull());
  return {
    carta: document.getElementById('desc-canal-carta') as HTMLInputElement,
    local: document.getElementById('desc-canal-local') as HTMLInputElement,
    bot: document.getElementById('desc-canal-bot') as HTMLInputElement,
  };
}

describe('ModalDescuento: ¿Dónde aplica?', () => {
  it('en alta: carta y local marcados y WhatsApp encendido (el bot ya aplica descuentos)', async () => {
    const c = await irAlPasoDeCanales({ descuentoAEditar: null });
    expect([c.carta.checked, c.local.checked, c.bot.checked]).toEqual([true, true, true]);
  });

  it('al editar refleja el estado real: con BOT marcada, sin BOT desmarcada', async () => {
    expect((await irAlPasoDeCanales({ descuentoAEditar: { ...descuentoBase, canales: ['CARTA', 'ADMIN', 'BOT'] } })).bot.checked).toBe(true);
  });

  it('al editar una promo sin BOT: WhatsApp desmarcado y la ayuda lo dice; al marcarlo la ayuda cambia', async () => {
    const c = await irAlPasoDeCanales({ descuentoAEditar: descuentoBase });
    expect(c.bot.checked).toBe(false);
    const ayuda = screen.getByTestId('desc-canal-ayuda');
    expect(ayuda.textContent).toMatch(/no la aplica ni la ofrece/);
    fireEvent.click(c.bot);
    expect(screen.getByTestId('desc-canal-ayuda').textContent).toMatch(/aplica este descuento al total del pedido/);
  });

  it('dato viejo «Solo WhatsApp»: solo WhatsApp marcado', async () => {
    const c = await irAlPasoDeCanales({ descuentoAEditar: { ...descuentoBase, canales: ['WHATSAPP'] } });
    expect([c.carta.checked, c.local.checked, c.bot.checked]).toEqual([false, false, true]);
  });
});

const llevaPagaBase = {
  id: '9', tipo: 'LLEVA_PAGA', nombre: '2x1 en Frappes', activo: true, lleva: 2, paga: 1, dias: [], fechaDesde: null, fechaHasta: null,
  horaDesde: null, horaHasta: null, productoNombre: 'Iced Coffee', orden: 0, canales: ['CARTA', 'ADMIN'],
} as any;

describe('ModalLlevaPaga: ¿Dónde aplica?', () => {
  async function abrirCanales(oferta: unknown) {
    const { ModalLlevaPaga } = await import('../ModalLlevaPaga');
    render(<ModalLlevaPaga abierto ofertaAEditar={oferta as any} onCerrar={() => {}} onGuardar={vi.fn()} productosDisponibles={[]} categorias={[]} />);
    fireEvent.click(screen.getByRole('button', { name: /Siguiente/ }));
    await waitFor(() => expect(document.getElementById('lp-canal-bot')).not.toBeNull());
    return document.getElementById('lp-canal-bot') as HTMLInputElement;
  }

  it('refleja BOT al editar y cambia la ayuda', async () => {
    expect((await abrirCanales({ ...llevaPagaBase, canales: ['CARTA', 'ADMIN', 'BOT'] })).checked).toBe(true);
    expect(screen.getByTestId('lp-canal-ayuda').textContent).toMatch(/aplica esta promoción al total/);
  });

  it('una promo sin BOT queda desmarcada', async () => {
    expect((await abrirCanales(llevaPagaBase)).checked).toBe(false);
  });
});

const comboBase = {
  id: '4', tipo: 'COMBO', nombre: 'Dúo especial', activo: true, orden: 0, dias: [], fechaDesde: null, fechaHasta: null, horaDesde: null, horaHasta: null,
  combosPrecio: [{ tamanoValorId: '1', tamanoNombre: 'Regular', precio: 30 }],
  combosParte: [{ id: '1', tipo: 'A_ELECCION', cantidad: 2, categorias: ['2'], productos: [] }],
  canales: ['CARTA', 'ADMIN'],
} as any;

describe('ModalCombo: ¿Dónde aplica?', () => {
  it('al editar un combo con BOT queda marcado; sin BOT, desmarcado y la ayuda lo dice', async () => {
    const { ModalCombo } = await import('../ModalCombo');
    const { unmount } = render(<ModalCombo abierto comboAEditar={{ ...comboBase, canales: ['CARTA', 'ADMIN', 'BOT'] }} onCerrar={() => {}} onGuardar={vi.fn()} productosDisponibles={[]} categorias={[]} />);
    for (let i = 0; i < 2; i++) fireEvent.click(screen.getByRole('button', { name: /Siguiente/ }));
    await waitFor(() => expect(document.getElementById('canal-combo-bot')).not.toBeNull());
    expect((document.getElementById('canal-combo-bot') as HTMLInputElement).checked).toBe(true);
    expect(screen.getByTestId('canal-combo-ayuda').textContent).toMatch(/la ofrece en sus promociones/);
    unmount();

    render(<ModalCombo abierto comboAEditar={comboBase} onCerrar={() => {}} onGuardar={vi.fn()} productosDisponibles={[]} categorias={[]} />);
    for (let i = 0; i < 2; i++) fireEvent.click(screen.getByRole('button', { name: /Siguiente/ }));
    await waitFor(() => expect(document.getElementById('canal-combo-bot')).not.toBeNull());
    expect((document.getElementById('canal-combo-bot') as HTMLInputElement).checked).toBe(false);
    expect(screen.getByTestId('canal-combo-ayuda').textContent).toMatch(/no la aplica ni la ofrece/);
  });
});

describe('ModalEnvioGratis: ¿Dónde aplica?', () => {
  it('sin la frase fija: con WhatsApp encendido dice que el bot cobra sin envío; apagado, que no la aplica', () => {
    render(<ModalEnvioGratis abierto ofertaAEditar={null} onCerrar={() => {}} onGuardar={vi.fn()} />);
    expect(document.body.textContent).not.toMatch(/El bot de WhatsApp no la aplica\.(?! ni)/);
    expect((screen.getByLabelText('WhatsApp (bot)') as HTMLInputElement).checked).toBe(true);
    expect(screen.getByTestId('envio-canal-ayuda').textContent).toMatch(/no cobra envío en el delivery/);
    fireEvent.click(screen.getByLabelText('WhatsApp (bot)'));
    expect(screen.getByTestId('envio-canal-ayuda').textContent).toMatch(/no la aplica ni la ofrece/);
  });

  it('exige al menos un canal y envía los elegidos al guardar', async () => {
    const onGuardar = vi.fn().mockResolvedValue(undefined);
    render(<ModalEnvioGratis abierto ofertaAEditar={null} onCerrar={() => {}} onGuardar={onGuardar} />);
    fireEvent.change(screen.getByLabelText(/Nombre de la promoción/), { target: { value: 'Envío gratis' } });
    for (const n of ['Carta web', 'En el local (caja y mozo)', 'WhatsApp (bot)']) fireEvent.click(screen.getByLabelText(n));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(screen.getByRole('alert').textContent).toMatch(/al menos un lugar/);
    expect(onGuardar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText('En el local (caja y mozo)'));
    fireEvent.click(screen.getByLabelText('WhatsApp (bot)'));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(onGuardar).toHaveBeenCalled());
    expect(onGuardar.mock.calls[0][0].canales).toEqual(['ADMIN', 'BOT']);
  });
});

describe('ModalCupon: ¿Dónde aplica?', () => {
  it('WhatsApp aparece apagado y deshabilitado con la razón; no se guarda BOT', () => {
    render(<ModalCupon abierto cuponAEditar={null} onCerrar={() => {}} onGuardar={vi.fn()} />);
    const bot = screen.getByLabelText('WhatsApp (bot)') as HTMLInputElement;
    expect(bot.checked).toBe(false);
    expect(bot.disabled).toBe(true);
    expect(within(screen.getByTestId('cupon-canal-canales')).getByTestId('cupon-canal-ayuda').textContent).toMatch(/no pide códigos/);
  });
});
