import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CorreosAvisoTab, PARAMETROS_CORREOS } from '../CorreosAvisoTab';
import { api } from '../../../comun/api';

vi.mock('../../../comun/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  ErrorApi: class extends Error {},
}));

const TIPOS = [
  { id: 'STOCK', nombre: 'Stock bajo', ayuda: 'Insumos que se agotan.' },
  { id: 'IMPRESORA', nombre: 'Impresora sin conexión', ayuda: 'Etiquetas esperando.' },
  { id: 'PC_IMPRESION', nombre: 'Computadoras de impresión sin conectar', ayuda: 'Revisión tras abrir caja.' },
  { id: 'CHAT_SIN_RESPONDER', nombre: 'Chat de WhatsApp sin responder', ayuda: 'Cliente esperando.' },
  { id: 'COMPROBANTES', nombre: 'Certificado y comprobantes', ayuda: 'Certificado por vencer.' },
  { id: 'OTROS', nombre: 'Otros avisos', ayuda: 'Demás alertas.' },
];

const datosBase = (extra: Record<string, unknown> = {}) => ({
  maximo: 20,
  correoConfigurado: true,
  tipos: TIPOS,
  correos: [{ id: '1', correo: 'contador@prueba.test', etiqueta: 'Contador', activo: true, tipos: ['COMPROBANTES'] }],
  personasPorUsuario: [{ nombre: 'Ana Prueba', rol: 'ADMIN', correo: 'a***@prueba.test', tipos: TIPOS.map((t) => t.id), soloSiDeTurno: true }],
  ...extra,
});

const montar = () => render(<MemoryRouter><CorreosAvisoTab /></MemoryRouter>);

describe('Configuración › Correos de aviso', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockImplementation(async (url: string) => (url === '/admin/correos-aviso' ? datosBase() : [{ clave: 'aviso_chat_sin_responder_min', valor: 15 }]));
    vi.mocked(api.post).mockResolvedValue({ id: '2' });
    vi.mocked(api.patch).mockResolvedValue({});
    vi.mocked(api.put).mockResolvedValue({});
    vi.mocked(api.delete).mockResolvedValue({ ok: true });
  });

  it('lista los correos extra con su nombre, estado y tipos', async () => {
    montar();
    expect(await screen.findByText('contador@prueba.test')).toBeTruthy();
    expect(screen.getByText('Contador')).toBeTruthy();
    expect(screen.getByText('Certificado y comprobantes')).toBeTruthy();
    expect(screen.getByText('Activo')).toBeTruthy();
  });

  it('agrega un correo con casillas por tipo (normaliza el correo y lo manda al servidor)', async () => {
    montar();
    fireEvent.click(await screen.findByRole('button', { name: 'Agregar correo' }));
    const dialogo = await screen.findByRole('dialog');
    fireEvent.change(within(dialogo).getByLabelText('Correo'), { target: { value: '  Socio@Prueba.test ' } });
    fireEvent.change(within(dialogo).getByLabelText(/Nombre o rol/), { target: { value: 'Socio' } });
    fireEvent.click(within(dialogo).getByLabelText(/Stock bajo/));
    fireEvent.click(within(dialogo).getByLabelText(/Chat de WhatsApp sin responder/));
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Guardar' }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/admin/correos-aviso', { correo: 'socio@prueba.test', etiqueta: 'Socio', activo: true, tipos: ['STOCK', 'CHAT_SIN_RESPONDER'] }),
    );
  });

  it('un correo mal escrito no se envía y dice qué corregir', async () => {
    montar();
    fireEvent.click(await screen.findByRole('button', { name: 'Agregar correo' }));
    const dialogo = await screen.findByRole('dialog');
    fireEvent.change(within(dialogo).getByLabelText('Correo'), { target: { value: 'sin-arroba' } });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Guardar' }));
    expect((await within(dialogo).findByRole('alert')).textContent).toMatch(/correo válido/);
    expect(api.post).not.toHaveBeenCalled();
  });

  it('muestra el error del servidor (p. ej. duplicado) dentro del modal', async () => {
    vi.mocked(api.post).mockRejectedValueOnce(Object.assign(new Error('Ese correo ya está en la lista'), {}));
    montar();
    fireEvent.click(await screen.findByRole('button', { name: 'Agregar correo' }));
    const dialogo = await screen.findByRole('dialog');
    fireEvent.change(within(dialogo).getByLabelText('Correo'), { target: { value: 'a@prueba.test' } });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(within(dialogo).getAllByRole('alert').length).toBeGreaterThan(0));
  });

  it('edita y cierra con Escape', async () => {
    montar();
    fireEvent.click(await screen.findByRole('button', { name: 'Editar contador@prueba.test' }));
    const dialogo = await screen.findByRole('dialog');
    expect((within(dialogo).getByLabelText('Correo') as HTMLInputElement).value).toBe('contador@prueba.test');
    fireEvent.click(within(dialogo).getByLabelText(/Stock bajo/));
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Guardar' }));
    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith('/admin/correos-aviso/1', { correo: 'contador@prueba.test', etiqueta: 'Contador', activo: true, tipos: ['COMPROBANTES', 'STOCK'] }),
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Agregar correo' }));
    const otro = await screen.findByRole('dialog');
    fireEvent.keyDown(otro, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('quita solo después de confirmar «Sí»', async () => {
    montar();
    fireEvent.click(await screen.findByRole('button', { name: 'Quitar contador@prueba.test' }));
    fireEvent.click(await screen.findByRole('button', { name: 'No, dejarlo' }));
    expect(api.delete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Quitar contador@prueba.test' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, quitar' }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/admin/correos-aviso/1'));
  });

  it('pausa y activa un correo con un botón', async () => {
    montar();
    fireEvent.click(await screen.findByRole('button', { name: 'Pausar contador@prueba.test' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/admin/correos-aviso/1', { activo: false }));
  });

  it('envía un correo de prueba y confirma', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ correoConfigurado: true, fallido: false, enviado: true });
    montar();
    fireEvent.click(await screen.findByRole('button', { name: 'Enviar correo de prueba a contador@prueba.test' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/admin/correos-aviso/1/prueba'));
    expect((await screen.findByRole('status')).textContent).toMatch(/Prueba enviada/);
  });

  it('si el envío de correos no está configurado lo dice en pantalla', async () => {
    vi.mocked(api.get).mockImplementation(async (url: string) => (url === '/admin/correos-aviso' ? datosBase({ correoConfigurado: false }) : []));
    montar();
    expect((await screen.findByTestId('correo-no-configurado')).textContent).toMatch(/no está configurado/);
  });

  it('con el máximo de correos no deja agregar más', async () => {
    vi.mocked(api.get).mockImplementation(async (url: string) => (url === '/admin/correos-aviso' ? datosBase({ maximo: 1 }) : []));
    montar();
    const boton = await screen.findByRole('button', { name: 'Agregar correo' });
    expect((boton as HTMLButtonElement).disabled).toBe(true);
  });

  it('«Por su usuario» es solo lectura, con correo enmascarado y enlace a Usuarios', async () => {
    montar();
    fireEvent.click(await screen.findByRole('tab', { name: /Por su usuario/ }));
    expect(await screen.findByText('Ana Prueba')).toBeTruthy();
    expect(screen.getByText('a***@prueba.test')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Usuarios' }).getAttribute('href')).toBe('/admin/usuarios');
    const panel = screen.getByRole('tabpanel', { name: /Por su usuario/ });
    expect(within(panel).queryAllByRole('button')).toHaveLength(0);
  });

  it('las pestañas se mueven con el teclado (flechas)', async () => {
    montar();
    const t1 = await screen.findByRole('tab', { name: /Correos extra/ });
    fireEvent.keyDown(t1.parentElement!, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: /Por su usuario/ }).getAttribute('aria-selected')).toBe('true');
  });

  it('la hoja de estilos se adapta a 360 px: acciones en 2 columnas, filas que envuelven y campos de 44 px', async () => {
    const { readFileSync } = await import('fs');
    const { resolve } = await import('path');
    const css = readFileSync(resolve(__dirname, '../correos-aviso.css'), 'utf8');
    expect(css).toMatch(/@media \(max-width: 480px\)/);
    expect(css).toMatch(/\.cav-fila \{[^}]*flex-wrap: wrap/);
    expect(css).toMatch(/min-height: 44px/);
    expect(css).not.toMatch(/overflow-x:\s*scroll/);
  });

  describe('Cuándo se avisa', () => {
    const abrir = async () => {
      montar();
      fireEvent.click(await screen.findByRole('tab', { name: /Cuándo se avisa/ }));
      await screen.findByLabelText('Minutos de espera antes de avisar');
    };
    it('muestra el valor guardado o el defecto', async () => {
      await abrir();
      expect((screen.getByLabelText('Minutos de espera antes de avisar') as HTMLInputElement).value).toBe('15');
      expect((screen.getByLabelText('Minutos después de abrir la caja') as HTMLInputElement).value).toBe('20');
      expect((screen.getByLabelText('Minutos para el recordatorio') as HTMLInputElement).value).toBe('60');
    });
    it('valida mínimo y máximo antes de guardar', async () => {
      await abrir();
      const campo = screen.getByLabelText('Minutos de espera antes de avisar');
      const [min, max] = PARAMETROS_CORREOS.aviso_chat_sin_responder_min;
      for (const malo of [String(min - 1), String(max + 1), '7.5', '']) {
        fireEvent.change(campo, { target: { value: malo } });
        fireEvent.click(screen.getByRole('button', { name: 'Guardar: Minutos de espera antes de avisar' }));
        expect((await screen.findAllByRole('alert'))[0].textContent).toMatch(/entero entre 5 y 120/);
      }
      expect(api.put).not.toHaveBeenCalled();
    });
    it('guarda un valor válido', async () => {
      await abrir();
      fireEvent.change(screen.getByLabelText('Minutos de espera antes de avisar'), { target: { value: '25' } });
      fireEvent.click(screen.getByRole('button', { name: 'Guardar: Minutos de espera antes de avisar' }));
      await waitFor(() => expect(api.put).toHaveBeenCalledWith('/admin/configuracion/aviso_chat_sin_responder_min', { valor: 25 }));
    });
    it('el interruptor de cada alerta guarda si/no', async () => {
      await abrir();
      fireEvent.click(screen.getByRole('switch', { name: /Avisar de chats sin responder/ }));
      await waitFor(() => expect(api.put).toHaveBeenCalledWith('/admin/configuracion/aviso_chat_sin_responder_activo', { valor: 'no' }));
    });
  });
});
