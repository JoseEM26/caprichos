import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { api, ErrorApi } from '../../comun/api';
import * as cuentaModulo from '../cuenta/CuentaContext';
import { CarritoProvider } from '../CarritoContext';
import { CabeceraCarta } from '../CabeceraCarta';
import { BotonReservar } from '../reservas/BotonReservar';
import { HojaReservar } from '../reservas/HojaReservar';
import type { OpcionesReserva } from '../reservas/reservasCartaApi';

// Lunes 5 de noviembre de 2026, 15:00 en Lima (20:00 UTC)
const AHORA = new Date('2026-11-05T20:00:00Z');

/** Todos los días abren de 12:00 a 23:00 */
const OPCIONES: OpcionesReserva = {
  activa: true,
  diasMax: 30,
  personasMax: 8,
  horarios: [0, 1, 2, 3, 4, 5, 6].map((dia) => ({ dia, abre: '12:00', cierra: '23:00' })),
  fechasCerradas: [],
  fechasEspeciales: [],
};

const cuentaBase = {
  panelAbierto: false, abrirPanel: vi.fn(), cerrarPanel: vi.fn(), ingresar: vi.fn(), registrar: vi.fn(),
  actualizarPerfil: vi.fn(), subirFoto: vi.fn(), quitarFoto: vi.fn(), salir: vi.fn(), refrescar: vi.fn(),
};

function sinCuenta() {
  vi.spyOn(cuentaModulo, 'useCuenta').mockReturnValue({ ...cuentaBase, cliente: null } as any);
  vi.spyOn(cuentaModulo, 'useCuentaOpcional').mockReturnValue({ ...cuentaBase, cliente: null } as any);
}

function conCuenta(cliente: Record<string, unknown>) {
  const valor = { ...cuentaBase, cliente: { partyId: '1', nombre: 'José Pérez', correo: null, telefono: '987654321', fotoUrl: null, cumpleanos: null, puntos: 3, ...cliente } };
  vi.spyOn(cuentaModulo, 'useCuenta').mockReturnValue(valor as any);
  vi.spyOn(cuentaModulo, 'useCuentaOpcional').mockReturnValue(valor as any);
}

function abrirHoja(opciones: OpcionesReserva = OPCIONES) {
  render(<HojaReservar opciones={opciones} onCerrar={() => {}} />);
  return screen.getByRole('dialog', { name: 'Reservar mesa' });
}

/** Lleva el flujo hasta el paso 3 eligiendo mañana a las 7 pm. */
async function llegarAlPaso3(personas?: string) {
  const dialogo = screen.getByRole('dialog', { name: 'Reservar mesa' });
  if (personas) fireEvent.click(within(dialogo).getByRole('button', { name: personas }));
  fireEvent.click(within(dialogo).getByRole('button', { name: 'Siguiente' }));
  fireEvent.click(within(dialogo).getByRole('button', { name: /^Mañana,/ }));
  fireEvent.click(within(dialogo).getByRole('button', { name: '7:00 pm' }));
  fireEvent.click(within(dialogo).getByRole('button', { name: 'Siguiente' }));
  await screen.findByRole('heading', { name: 'Tus datos' });
}

function escribirDatos(nombre: string, celular: string) {
  fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: nombre } });
  fireEvent.change(screen.getByLabelText(/Celular/), { target: { value: celular } });
}

describe('Reservar mesa desde la carta ▸ botón', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(AHORA);
    window.localStorage.clear();
    sinCuenta();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('se muestra con el nombre accesible «Reservar mesa» cuando el local lo tiene encendido', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(OPCIONES);
    render(<BotonReservar />);
    expect(await screen.findByRole('button', { name: 'Reservar mesa' })).toBeInTheDocument();
  });

  it('no se muestra si el local lo tiene apagado', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({ ...OPCIONES, activa: false });
    render(<BotonReservar />);
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: 'Reservar mesa' })).not.toBeInTheDocument();
  });

  it('no se muestra si la consulta de opciones falla', async () => {
    vi.spyOn(api, 'get').mockRejectedValue(new Error('red caída'));
    render(<BotonReservar />);
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: 'Reservar mesa' })).not.toBeInTheDocument();
  });

  it('la cabecera lo muestra solo si mostrarReservar no es false (la vista previa del diseñador no lo muestra)', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(OPCIONES);
    const { unmount } = render(
      <CarritoProvider>
        <CabeceraCarta busqueda="" onCambioBusqueda={() => {}} estadoLocal={{ abierta: true } as any} datosLocal={{ nombre: 'Caprichos' } as any} pagina="carta" onPagina={() => {}} categorias={[]} categoriaActivaId="todo" onCategoria={() => {}} />
      </CarritoProvider>,
    );
    expect(await screen.findByRole('button', { name: 'Reservar mesa' })).toBeInTheDocument();
    unmount();

    vi.mocked(api.get).mockClear();
    render(
      <CarritoProvider>
        <CabeceraCarta busqueda="" onCambioBusqueda={() => {}} estadoLocal={{ abierta: true } as any} datosLocal={{ nombre: 'Caprichos' } as any} pagina="carta" onPagina={() => {}} categorias={[]} categoriaActivaId="todo" onCategoria={() => {}} mostrarReservar={false} />
      </CarritoProvider>,
    );
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByRole('button', { name: 'Reservar mesa' })).not.toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalledWith('/carta/reservas/opciones');
  });
});

describe('Reservar mesa ▸ hoja de tres pasos', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(AHORA);
    window.localStorage.clear();
    sinCuenta();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('es un diálogo modal con el paso de personas y los chips rápidos 1 a 5 y 6+', () => {
    const dialogo = abrirHoja();
    expect(dialogo).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('heading', { name: '¿Para cuántas personas?' })).toBeInTheDocument();
    for (const n of ['1', '2', '3', '4', '5', '6+']) expect(within(dialogo).getByRole('button', { name: n })).toBeInTheDocument();
  });

  it('los botones − y + cambian el número y no pasan del tope del local', () => {
    const dialogo = abrirHoja({ ...OPCIONES, personasMax: 3 });
    const mas = within(dialogo).getByRole('button', { name: 'Agregar una persona' });
    fireEvent.click(mas);
    fireEvent.click(mas);
    expect(within(dialogo).getByText('3 personas')).toBeInTheDocument();
    expect(mas).toBeDisabled();
    expect(within(dialogo).getByRole('button', { name: '4' })).toBeDisabled();
    expect(within(dialogo).getByRole('button', { name: '6+' })).toBeDisabled();
  });

  it('el chip 6+ pone 6 personas', () => {
    const dialogo = abrirHoja();
    fireEvent.click(within(dialogo).getByRole('button', { name: '6+' }));
    expect(within(dialogo).getByText('6 personas')).toBeInTheDocument();
    expect(within(dialogo).getByRole('button', { name: '6+' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('el paso de día solo ofrece los días con atención y las horas de media en media hora', () => {
    const dialogo = abrirHoja({ ...OPCIONES, horarios: [{ dia: 2, abre: '12:00', cierra: '13:00' }], fechasCerradas: [] });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Siguiente' }));
    // Solo los martes (dia 2) aparecen como chips de día
    const chipsDia = within(dialogo).getAllByRole('button').filter((b) => /, (mar|mié|lun|jue|vie|sáb|dom)/i.test(b.getAttribute('aria-label') ?? ''));
    expect(chipsDia.length).toBeGreaterThan(0);
    for (const chip of chipsDia) expect(chip.getAttribute('aria-label')).toMatch(/mar/);
    fireEvent.click(chipsDia[0]);
    // 12:00 a 13:00 cada 30 min: 12:00, 12:30, 1:00 pm
    expect(within(dialogo).getByRole('button', { name: '12:00 pm' })).toBeInTheDocument();
    expect(within(dialogo).getByRole('button', { name: '12:30 pm' })).toBeInTheDocument();
    expect(within(dialogo).getByRole('button', { name: '1:00 pm' })).toBeInTheDocument();
    expect(within(dialogo).queryByRole('button', { name: '1:30 pm' })).not.toBeInTheDocument();
  });

  it('las horas pasadas de hoy quedan deshabilitadas', () => {
    const dialogo = abrirHoja();
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Siguiente' }));
    fireEvent.click(within(dialogo).getByRole('button', { name: /^Hoy,/ }));
    // Son las 3:00 pm en Lima: 3:00 ya pasó, 3:30 todavía no
    expect(within(dialogo).getByRole('button', { name: /^3:00 pm, ya pasó$/ })).toBeDisabled();
    expect(within(dialogo).getByRole('button', { name: /^12:00 pm, ya pasó$/ })).toBeDisabled();
    expect(within(dialogo).getByRole('button', { name: '3:30 pm' })).toBeEnabled();
  });

  it('no deja seguir al paso de datos sin día y hora', () => {
    const dialogo = abrirHoja();
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Siguiente' }));
    expect(within(dialogo).getByRole('button', { name: 'Siguiente' })).toBeDisabled();
    expect(within(dialogo).getByText('Elige un día y una hora para seguir.')).toBeInTheDocument();
  });

  it('muestra en el paso de datos el resumen «personas · día · hora»', async () => {
    const dialogo = abrirHoja();
    fireEvent.click(within(dialogo).getByRole('button', { name: '2' }));
    await llegarAlPaso3('2');
    expect(within(dialogo).getByText('2 personas · vie 6 nov · 7:00 pm')).toBeInTheDocument();
  });

  it('valida el celular: uno que no es peruano no envía nada y avisa dentro de la hoja', async () => {
    vi.spyOn(api, 'post');
    const dialogo = abrirHoja();
    await llegarAlPaso3();
    escribirDatos('Ana Quispe', '812345678');
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Enviar solicitud' }));
    expect(within(dialogo).getByText('Escribe un celular de 9 dígitos que empiece con 9.')).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('valida el nombre: menos de 2 letras no envía', async () => {
    vi.spyOn(api, 'post');
    const dialogo = abrirHoja();
    await llegarAlPaso3();
    escribirDatos('A', '987654321');
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Enviar solicitud' }));
    expect(within(dialogo).getByText('Escribe tu nombre (al menos 2 letras).')).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('envía la solicitud y muestra «Solicitud enviada» con el aviso de WhatsApp', async () => {
    vi.spyOn(api, 'post').mockResolvedValue({ ok: true, solicitudId: '5', resumen: { personas: 2, fechaTexto: 'vie, 6 nov', hora: '19:00' } });
    abrirHoja();
    await llegarAlPaso3();
    escribirDatos('Ana Quispe', '987 654 321');
    fireEvent.change(screen.getByLabelText(/Nota/), { target: { value: 'Silla para bebé' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar solicitud' }));

    expect(await screen.findByRole('heading', { name: 'Solicitud enviada' })).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith('/carta/reservas', {
      nombre: 'Ana Quispe',
      telefono: '987654321',
      personas: 2,
      fecha: '2026-11-06',
      hora: '19:00',
      nota: 'Silla para bebé',
      empresa: '',
    });
    expect(screen.getByText(/El local te confirmará por WhatsApp al 987654321/)).toBeInTheDocument();
  });

  it('muestra el error del servidor dentro de la hoja y se queda en el paso de datos', async () => {
    vi.spyOn(api, 'post').mockRejectedValue(new ErrorApi('LIMITE_PENDIENTES', 'Ya tienes 2 solicitudes esperando respuesta del local.', 400));
    const dialogo = abrirHoja();
    await llegarAlPaso3();
    escribirDatos('Ana Quispe', '987654321');
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Enviar solicitud' }));
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('Ya tienes 2 solicitudes esperando respuesta del local.');
    expect(within(dialogo).getByRole('heading', { name: 'Tus datos' })).toBeInTheDocument();
  });

  it('si el servidor dice que la hora ya pasó, vuelve al paso de día y hora con el aviso', async () => {
    vi.spyOn(api, 'post').mockRejectedValue(new ErrorApi('HORA_PASADA', 'La hora ya pasó. Elige otra hora o un día más adelante.', 400));
    const dialogo = abrirHoja();
    await llegarAlPaso3();
    escribirDatos('Ana Quispe', '987654321');
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Enviar solicitud' }));
    expect(await within(dialogo).findByRole('heading', { name: '¿Qué día?' })).toBeInTheDocument();
    expect(within(dialogo).getByRole('alert')).toHaveTextContent('La hora ya pasó');
  });

  it('Esc cierra la hoja', () => {
    const onCerrar = vi.fn();
    render(<HojaReservar opciones={OPCIONES} onCerrar={onCerrar} />);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onCerrar).toHaveBeenCalledTimes(1);
  });

  it('el foco no sale de la hoja al pulsar Tab desde el último botón', () => {
    const dialogo = abrirHoja();
    const cerrar = within(dialogo).getByRole('button', { name: 'Cerrar' });
    const siguiente = within(dialogo).getByRole('button', { name: 'Siguiente' });
    siguiente.focus();
    fireEvent.keyDown(dialogo, { key: 'Tab' });
    expect(document.activeElement).toBe(cerrar);
  });

  it('recuerda nombre y celular para la próxima vez (localStorage)', async () => {
    vi.spyOn(api, 'post').mockResolvedValue({ ok: true, solicitudId: '5', resumen: { personas: 2, fechaTexto: 'vie, 6 nov', hora: '19:00' } });
    const { unmount } = render(<HojaReservar opciones={OPCIONES} onCerrar={() => {}} />);
    await llegarAlPaso3();
    escribirDatos('Ana Quispe', '987654321');
    fireEvent.click(screen.getByRole('button', { name: 'Enviar solicitud' }));
    await screen.findByRole('heading', { name: 'Solicitud enviada' });
    unmount();

    render(<HojaReservar opciones={OPCIONES} onCerrar={() => {}} />);
    await llegarAlPaso3();
    expect(screen.getByLabelText('Nombre')).toHaveValue('Ana Quispe');
    expect(screen.getByLabelText(/Celular/)).toHaveValue('987654321');
  });

  it('con sesión, nombre y celular vienen de la cuenta', async () => {
    conCuenta({ nombre: 'José Pérez', telefono: '987654321' });
    abrirHoja();
    await llegarAlPaso3();
    expect(screen.getByLabelText('Nombre')).toHaveValue('José Pérez');
    expect(screen.getByLabelText(/Celular/)).toHaveValue('987654321');
  });

  it('el nombre del botón de cerrar es «Cerrar» y el campo de nombre tiene 16 px para no hacer zoom en iOS', async () => {
    abrirHoja();
    expect(screen.getByRole('button', { name: 'Cerrar' })).toBeInTheDocument();
    await llegarAlPaso3();
    expect(screen.getByLabelText('Nombre')).toHaveStyle({ fontSize: '16px' });
  });
});
