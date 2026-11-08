import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { api } from '../../../comun/api';
import { ChatbotConfiguracionTab, CLAVES_TEXTOS_BOT } from '../ChatbotConfiguracionTab';
import { validarMensaje, vistaPreviaMensaje } from '../mensajesBot';

const DEFECTO: Record<string, string> = {
  chatbot_texto_bienvenida: '¡Hola {nombre}! Soy Capri, la asistente de {local}. ¿En qué te ayudo?',
  chatbot_texto_promos_encabezado: 'Hoy tenemos:',
  chatbot_texto_mas_descuento: 'Hay *MÁS DESCUENTO* en nuestra *CARTA VIRTUAL*: {link_carta}',
  chatbot_promos_mostrar: 'si',
  chatbot_promos_max: '3',
};
const TEXTOS = Object.fromEntries(CLAVES_TEXTOS_BOT.map((k) => [k, DEFECTO[k] ?? `texto ${k}`]));
const CONFIG = {
  textos: TEXTOS,
  textosDefecto: TEXTOS,
  funciones: { pedido: true, pago: true, reservas: true, cambios: true, ia: false, promociones: true },
  antiSpam: { maxPorMinuto: 10, maxPorHora: 60 },
  privacidad: { diasRetencion: 90 },
};

const montar = (puedeEditar = true) =>
  render(
    <MemoryRouter>
      <ChatbotConfiguracionTab puedeVer puedeEditar={puedeEditar} />
    </MemoryRouter>,
  );

describe('Mensajes del bot: bienvenida y promociones', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api, 'get').mockImplementation(async (ruta: string) => {
      if (ruta === '/admin/chatbot/configuracion') return CONFIG;
      if (ruta === '/admin/configuracion/ia-consumo') return { periodo: '2026-11', llamadasTotal: 0, tokensTotal: 0, costoUsdEstimado: 0, topeMensualUsd: 20, porcentajeConsumido: 0, topeAlcanzado: false, iaActiva: false };
      if (ruta === '/admin/chatbot/configuracion/promos-vigentes') return { lineas: ['• Dúo Irresistible — S/ 37'] };
      return {};
    });
  });

  const bienvenida = async () => {
    montar();
    return screen.findByLabelText('Mensaje de bienvenida');
  };

  it('muestra el grupo plegable con la vista previa: promociones reales, frase y enlace, sin producto del mes', async () => {
    await bienvenida();
    const grupo = screen.getByTestId('grupo-bienvenida') as HTMLDetailsElement;
    expect(grupo.open).toBe(false);
    const previa = screen.getByTestId('vista-previa-chatbot_texto_bienvenida').textContent ?? '';
    expect(previa).toContain('¡Hola Ana! Soy Capri, la asistente de Caprichos');
    expect(previa).toContain('• Dúo Irresistible — S/ 37');
    expect(previa).toContain('MÁS DESCUENTO');
    expect(previa).toContain('https://caprichos.pe');
    expect(previa).not.toMatch(/DEL MES/i);
  });

  it('los chips insertan la variable y el contador cuenta caracteres', async () => {
    const area = (await bienvenida()) as HTMLTextAreaElement;
    fireEvent.change(area, { target: { value: 'Hola ' } });
    area.setSelectionRange(5, 5);
    const chips = screen.getByTestId('variables-chatbot_texto_bienvenida');
    fireEvent.click(within(chips).getByRole('button', { name: '{nombre}' }));
    expect(area.value).toBe('Hola {nombre}');
    expect(screen.getAllByText(/\/ 1024 caracteres/).length).toBeGreaterThan(0);
  });

  it('una variable desconocida o un texto vacío muestran el error y bloquean Guardar', async () => {
    const area = await bienvenida();
    fireEvent.change(area, { target: { value: 'Hola {cliente}' } });
    expect(within(screen.getByTestId('seccion-bienvenida')).getByRole('alert')).toHaveTextContent('Variable no válida: {cliente}');
    expect(screen.getAllByText('Guardar texto')[0]).toBeDisabled();
    fireEvent.change(area, { target: { value: '   ' } });
    expect(within(screen.getByTestId('seccion-bienvenida')).getByRole('alert')).toHaveTextContent('no puede quedar vacío');
  });

  it('guarda con confirmación Sí/No: No no llama a la API, Sí envía el texto', async () => {
    const put = vi.spyOn(api, 'put').mockResolvedValue({});
    const area = await bienvenida();
    fireEvent.change(area, { target: { value: 'Hola {nombre}, bienvenida a {local}' } });
    fireEvent.click(screen.getAllByText('Guardar texto')[0]);
    fireEvent.click(await screen.findByText('No, cancelar'));
    expect(put).not.toHaveBeenCalled();
    fireEvent.click(screen.getAllByText('Guardar texto')[0]);
    fireEvent.click(await screen.findByText('Sí, confirmar'));
    await waitFor(() =>
      expect(put).toHaveBeenCalledWith('/admin/chatbot/configuracion/textos', {
        chatbot_texto_bienvenida: 'Hola {nombre}, bienvenida a {local}',
      }),
    );
    expect(await screen.findByText(/Texto "Mensaje de bienvenida" actualizado correctamente/)).toBeInTheDocument();
  });

  it('muestra el error del servidor cuando el guardado falla', async () => {
    vi.spyOn(api, 'put').mockRejectedValue(new Error('La clave de configuración no es válida'));
    const area = await bienvenida();
    fireEvent.change(area, { target: { value: 'Hola {nombre}' } });
    fireEvent.click(screen.getAllByText('Guardar texto')[0]);
    fireEvent.click(await screen.findByText('Sí, confirmar'));
    expect(await screen.findByText(/La clave de configuración no es válida/)).toBeInTheDocument();
  });

  it('«Restaurar texto original» pide confirmación y vuelve al texto de fábrica', async () => {
    const post = vi.spyOn(api, 'post').mockResolvedValue({ clave: 'chatbot_texto_bienvenida', valor: DEFECTO.chatbot_texto_bienvenida });
    const area = (await bienvenida()) as HTMLTextAreaElement;
    fireEvent.change(area, { target: { value: 'Otro saludo' } });
    fireEvent.click(screen.getAllByText('Restaurar texto original')[0]);
    fireEvent.click(await screen.findByText('Sí, restablecer'));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/admin/chatbot/configuracion/textos/restablecer', { clave: 'chatbot_texto_bienvenida' }));
    await waitFor(() => expect(area.value).toBe(DEFECTO.chatbot_texto_bienvenida));
  });

  it('el interruptor «Mostrar promociones» y el tope se guardan como los demás mensajes', async () => {
    const put = vi.spyOn(api, 'put').mockResolvedValue({});
    await bienvenida();
    fireEvent.change(screen.getByLabelText('Mostrar promociones vigentes en la bienvenida'), { target: { value: 'no' } });
    expect(screen.getByTestId('vista-previa-chatbot_promos_mostrar').textContent).not.toContain('Dúo Irresistible');
    fireEvent.change(screen.getByLabelText('Cuántas promociones mostrar'), { target: { value: '5' } });
    const guardar = screen.getAllByText('Guardar texto');
    fireEvent.click(guardar[2]);
    fireEvent.click(await screen.findByText('Sí, confirmar'));
    await waitFor(() => expect(put).toHaveBeenCalledWith('/admin/chatbot/configuracion/textos', { chatbot_promos_max: '5' }));
  });

  it('sin permiso de editar los campos y chips quedan bloqueados', async () => {
    montar(false);
    const area = await screen.findByLabelText('Mensaje de bienvenida');
    expect(area).toBeDisabled();
    expect(within(screen.getByTestId('variables-chatbot_texto_bienvenida')).getByRole('button', { name: '{nombre}' })).toBeDisabled();
  });
});

describe('mensajesBot (reglas)', () => {
  it('valida vacíos, variables y los dos ajustes', () => {
    expect(validarMensaje('chatbot_texto_bienvenida', '')).toMatch(/vacío/);
    expect(validarMensaje('chatbot_texto_despedida', 'Chau {nombre}')).toMatch(/{nombre}/);
    expect(validarMensaje('chatbot_texto_bienvenida', 'Hola {nombre} {promociones}')).toBeNull();
    expect(validarMensaje('chatbot_promos_max', '6')).not.toBeNull();
    expect(validarMensaje('chatbot_promos_mostrar', 'no')).toBeNull();
  });

  it('la vista previa respeta el tope y el «no mostrar» y usa {promociones} si está', () => {
    const textos = { ...TEXTOS, chatbot_promos_max: '1' };
    const p = vistaPreviaMensaje('chatbot_texto_bienvenida', textos, ['• A', '• B']);
    expect(p).toContain('• A');
    expect(p).not.toContain('• B');
    expect(vistaPreviaMensaje('chatbot_texto_bienvenida', { ...textos, chatbot_promos_mostrar: 'no' }, ['• A'])).not.toContain('• A');
    const dentro = vistaPreviaMensaje('chatbot_texto_bienvenida', { ...textos, chatbot_texto_bienvenida: 'Hola\n{promociones}\nFin' }, ['• A']);
    expect(dentro.startsWith('Hola\nHoy tenemos:\n• A\nFin')).toBe(true);
  });
});
