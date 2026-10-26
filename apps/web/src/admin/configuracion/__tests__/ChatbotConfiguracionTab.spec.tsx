import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { api } from '../../../comun/api';
import {
  ChatbotConfiguracionTab,
  ConfiguracionBotRespuesta,
} from '../ChatbotConfiguracionTab';

const CONFIG_MOCK_INICIAL: ConfiguracionBotRespuesta = {
  textos: {
    bienvenida:
      '¡Hola! Te damos la bienvenida a Caprichos Café y Pasión. ¿En qué podemos ayudarte hoy?',
    despedida:
      '¡Muchas gracias por contactarnos! Que tengas un lindo día.',
    pasarAPersona:
      'Te transfiero con un asesor del equipo de Caprichos para que pueda atenderte.',
    noEntiendoRepregunta:
      'Disculpa, no logré entender tu mensaje. ¿Podrías indicarme qué necesitas?',
    noEntiendoDerivacion:
      'No logro comprender tu consulta. Te conecto de inmediato con nuestro personal.',
  },
  textosPorDefecto: {
    bienvenida:
      '¡Hola! Te damos la bienvenida a Caprichos Café y Pasión. ¿En qué podemos ayudarte hoy?',
    despedida:
      '¡Muchas gracias por contactarnos! Que tengas un lindo día.',
    pasarAPersona:
      'Te transfiero con un asesor del equipo de Caprichos para que pueda atenderte.',
    noEntiendoRepregunta:
      'Disculpa, no logré entender tu mensaje. ¿Podrías indicarme qué necesitas?',
    noEntiendoDerivacion:
      'No logro comprender tu consulta. Te conecto de inmediato con nuestro personal.',
  },
  funciones: {
    pedido: true,
    pago: true,
    reservas: true,
    cambios: true,
    ia: true,
    promociones: true,
  },
  antiSpam: {
    limiteMinuto: 10,
    limiteHora: 60,
  },
  retencion: {
    diasRetencion: 90,
  },
  consumoIa: {
    periodo: '2026-10',
    llamadasTotal: 48,
    tokensTotal: 31200,
    costoUsdEstimado: 4.125,
    topeMensualUsd: 20.0,
    porcentajeConsumido: 20.6,
    topeAlcanzado: false,
    iaActiva: true,
  },
};

describe('ChatbotConfiguracionTab (Ola 4, Agente I: Configuración y Seguridad del Bot)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1. renderiza las 5 tarjetas principales con datos de configuración e IA', async () => {
    vi.spyOn(api, 'get').mockResolvedValueOnce(CONFIG_MOCK_INICIAL);

    render(<ChatbotConfiguracionTab puedeVer={true} puedeEditar={true} />);

    await waitFor(() => {
      expect(
        screen.getByText('Configuración y seguridad del bot'),
      ).toBeInTheDocument();
    });

    // Tarjeta 1: Consumo IA
    expect(screen.getByTestId('tarjeta-consumo-ia')).toBeInTheDocument();
    expect(screen.getByText(/Consumo y estado del motor de IA/i)).toBeInTheDocument();
    expect(screen.getByText(/48 consultas/i)).toBeInTheDocument();
    expect(screen.getByText(/31,200 tokens/i)).toBeInTheDocument();
    expect(screen.getByText('IA activa')).toBeInTheDocument();

    // Tarjeta 2: Interruptores de función (6)
    expect(screen.getByTestId('seccion-funciones')).toBeInTheDocument();
    expect(screen.getByText('Recepción de pedidos')).toBeInTheDocument();
    expect(screen.getByText('Instrucciones y cobro')).toBeInTheDocument();
    expect(screen.getByText('Reservas de mesa')).toBeInTheDocument();
    expect(screen.getByText('Cambios de pedido')).toBeInTheDocument();
    expect(screen.getByText('Asistente de Inteligencia Artificial')).toBeInTheDocument();
    expect(screen.getByText('Promociones y cupones')).toBeInTheDocument();

    // Tarjeta 3: Textos editables (5) con contadores
    expect(screen.getByTestId('seccion-textos')).toBeInTheDocument();
    expect(screen.getByText('Mensaje de bienvenida')).toBeInTheDocument();
    expect(screen.getByText('Mensaje de despedida')).toBeInTheDocument();
    expect(screen.getByText('Pase a asesor humano')).toBeInTheDocument();
    expect(screen.getByText('Repregunta al no entender')).toBeInTheDocument();
    expect(screen.getByText('Derivación al no entender')).toBeInTheDocument();

    // Tarjeta 4: Anti-spam
    expect(screen.getByTestId('seccion-antispam')).toBeInTheDocument();
    expect(
      screen.getByLabelText(/Máximo mensajes por minuto/i),
    ).toHaveValue(10);
    expect(
      screen.getByLabelText(/Máximo mensajes por hora/i),
    ).toHaveValue(60);

    // Tarjeta 5: Privacidad Ley 29733
    expect(screen.getByTestId('seccion-privacidad')).toBeInTheDocument();
    expect(
      screen.getByLabelText(/Días de retención de mensajes/i),
    ).toHaveValue(90);
    expect(
      screen.getByText(/Gestión ARCO: Exportación y baja de cliente/i),
    ).toBeInTheDocument();
  });

  it('2. cambia el estado de un interruptor con confirmación Sí/No obligatoria', async () => {
    vi.spyOn(api, 'get').mockResolvedValueOnce(CONFIG_MOCK_INICIAL);
    const spyPut = vi.spyOn(api, 'put').mockResolvedValueOnce({
      mensaje: 'Funciones actualizadas',
    });

    render(<ChatbotConfiguracionTab puedeVer={true} puedeEditar={true} />);

    await waitFor(() => {
      expect(
        screen.getByLabelText('Recepción de pedidos'),
      ).toBeInTheDocument();
    });

    const botonSwitch = screen.getByLabelText('Recepción de pedidos');
    expect(botonSwitch).toHaveAttribute('aria-checked', 'true');

    // Clic en switch abre modal Confirmar
    fireEvent.click(botonSwitch);

    expect(
      screen.getByText(/¿Deseas pausar la función "Recepción de pedidos"/i),
    ).toBeInTheDocument();

    // Confirmar en el modal
    const botonConfirmar = screen.getByText('Sí, confirmar');
    fireEvent.click(botonConfirmar);

    await waitFor(() => {
      expect(spyPut).toHaveBeenCalledWith(
        '/admin/chatbot/configuracion/funciones',
        expect.objectContaining({
          pedido: false,
          pago: true,
          reservas: true,
          cambios: true,
          ia: true,
          promociones: true,
        }),
      );
    });

    await waitFor(() => {
      expect(
        screen.getByText(/Función "Recepción de pedidos" desactivada correctamente/i),
      ).toBeInTheDocument();
    });
  });

  it('3. edita un texto del bot, respeta límite de 1024 caracteres y guarda con confirmación', async () => {
    vi.spyOn(api, 'get').mockResolvedValueOnce(CONFIG_MOCK_INICIAL);
    const spyPut = vi.spyOn(api, 'put').mockResolvedValueOnce({
      mensaje: 'Texto actualizado',
    });

    render(<ChatbotConfiguracionTab puedeVer={true} puedeEditar={true} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Mensaje de bienvenida')).toBeInTheDocument();
    });

    const textarea = screen.getByLabelText('Mensaje de bienvenida');

    // Cambiar texto
    fireEvent.change(textarea, {
      target: {
        value: '¡Bienvenido a Caprichos Café! ¿Deseas delivery o recoger en tienda?',
      },
    });

    // Guardar texto abre modal
    const botonesGuardar = screen.getAllByText('Guardar texto');
    fireEvent.click(botonesGuardar[0]);

    expect(
      screen.getByText(/¿Deseas guardar los cambios en el texto "Mensaje de bienvenida"/i),
    ).toBeInTheDocument();

    const botonConfirmar = screen.getByText('Sí, confirmar');
    fireEvent.click(botonConfirmar);

    await waitFor(() => {
      expect(spyPut).toHaveBeenCalledWith(
        '/admin/chatbot/configuracion/textos',
        {
          clave: 'bienvenida',
          texto:
            '¡Bienvenido a Caprichos Café! ¿Deseas delivery o recoger en tienda?',
        },
      );
    });

    await waitFor(() => {
      expect(
        screen.getByText(/Texto "Mensaje de bienvenida" actualizado correctamente/i),
      ).toBeInTheDocument();
    });
  });

  it('4. valida e impide guardar textos que superan el límite de WhatsApp de 1024 caracteres', async () => {
    vi.spyOn(api, 'get').mockResolvedValueOnce(CONFIG_MOCK_INICIAL);

    render(<ChatbotConfiguracionTab puedeVer={true} puedeEditar={true} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Mensaje de bienvenida')).toBeInTheDocument();
    });

    const textarea = screen.getByLabelText('Mensaje de bienvenida');
    const textoExcesivo = 'A'.repeat(1025);

    fireEvent.change(textarea, { target: { value: textoExcesivo } });

    expect(
      screen.getByText(/1025 \/ 1024 caracteres/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/El texto excede el límite de WhatsApp de 1024 caracteres/i),
    ).toBeInTheDocument();

    const botonesGuardar = screen.getAllByText('Guardar texto');
    expect(botonesGuardar[0]).toBeDisabled();
  });

  it('5. restablece un texto a su valor por defecto del mockup con confirmación', async () => {
    const configModificada = {
      ...CONFIG_MOCK_INICIAL,
      textos: {
        ...CONFIG_MOCK_INICIAL.textos,
        bienvenida: 'Texto modificado previo',
      },
    };
    vi.spyOn(api, 'get').mockResolvedValueOnce(configModificada);
    const spyPost = vi.spyOn(api, 'post').mockResolvedValueOnce({
      clave: 'bienvenida',
      texto: CONFIG_MOCK_INICIAL.textosPorDefecto.bienvenida,
      mensaje: 'Texto restablecido',
    });

    render(<ChatbotConfiguracionTab puedeVer={true} puedeEditar={true} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Mensaje de bienvenida')).toBeInTheDocument();
    });

    const botonRestablecer = screen.getAllByText('Restablecer por defecto')[0];
    expect(botonRestablecer).not.toBeDisabled();

    fireEvent.click(botonRestablecer);

    expect(
      screen.getByText(/¿Deseas restablecer el texto "Mensaje de bienvenida"/i),
    ).toBeInTheDocument();

    const botonSi = screen.getByText('Sí, restablecer');
    fireEvent.click(botonSi);

    await waitFor(() => {
      expect(spyPost).toHaveBeenCalledWith(
        '/admin/chatbot/configuracion/textos/restablecer',
        { clave: 'bienvenida' },
      );
    });

    await waitFor(() => {
      expect(
        screen.getByText(/Texto "Mensaje de bienvenida" restablecido a su valor por defecto/i),
      ).toBeInTheDocument();
    });
  });

  it('6. actualiza parámetros de control anti-spam con confirmación', async () => {
    vi.spyOn(api, 'get').mockResolvedValueOnce(CONFIG_MOCK_INICIAL);
    const spyPut = vi.spyOn(api, 'put').mockResolvedValueOnce({
      mensaje: 'Límites anti-spam guardados',
    });

    render(<ChatbotConfiguracionTab puedeVer={true} puedeEditar={true} />);

    await waitFor(() => {
      expect(screen.getByLabelText(/Máximo mensajes por minuto/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Máximo mensajes por minuto/i), {
      target: { value: '15' },
    });
    fireEvent.change(screen.getByLabelText(/Máximo mensajes por hora/i), {
      target: { value: '80' },
    });

    const botonGuardar = screen.getByText('Guardar límites anti-spam');
    fireEvent.click(botonGuardar);

    expect(
      screen.getByText(/¿Deseas actualizar los límites de frecuencia anti-spam en Redis/i),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText('Sí, confirmar'));

    await waitFor(() => {
      expect(spyPut).toHaveBeenCalledWith(
        '/admin/chatbot/configuracion/anti-spam',
        { limiteMinuto: 15, limiteHora: 80 },
      );
    });

    await waitFor(() => {
      expect(
        screen.getByText(/Parámetros de control anti-spam actualizados correctamente/i),
      ).toBeInTheDocument();
    });
  });

  it('7. ejecuta anonimización de mensajes antiguos por retención Ley 29733', async () => {
    vi.spyOn(api, 'get').mockResolvedValueOnce(CONFIG_MOCK_INICIAL);
    const spyPost = vi.spyOn(api, 'post').mockResolvedValueOnce({
      mensajesAnonimizados: 35,
      fechaCorte: '2026-07-28',
      mensaje: 'Anonimización ejecutada',
    });

    render(<ChatbotConfiguracionTab puedeVer={true} puedeEditar={true} />);

    await waitFor(() => {
      expect(screen.getByText('Ejecutar anonimización ahora')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Ejecutar anonimización ahora'));

    expect(
      screen.getByText(/¿Deseas anonimizar todos los mensajes anteriores a 90 días/i),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText('Sí, anonimizar'));

    await waitFor(() => {
      expect(spyPost).toHaveBeenCalledWith(
        '/admin/chatbot/configuracion/retencion/ejecutar',
        {},
      );
    });

    await waitFor(() => {
      expect(
        screen.getByText(/se anonimizaron 35 mensajes anteriores al 2026-07-28/i),
      ).toBeInTheDocument();
    });
  });

  it('8. busca y exporta datos de un cliente ARCO mostrando teléfono enmascarado (nunca completo)', async () => {
    vi.spyOn(api, 'get').mockImplementation(async (ruta: string) => {
      if (ruta === '/admin/chatbot/configuracion') {
        return CONFIG_MOCK_INICIAL;
      }
      if (ruta.includes('/admin/chatbot/configuracion/privacidad/exportar')) {
        return {
          solicitud: {
            solicitante: 'Admin Test',
            fecha: '2026-10-26T12:00:00.000Z',
            motivo: 'Solicitud ARCO de acceso',
          },
          identificadorEnmascarado: '987***321',
          consentimiento: {
            existe: true,
            acepta: true,
            origen: 'WHATSAPP_OPTIN',
            fechaRegistro: '2026-10-01T10:00:00.000Z',
          },
          totalConversaciones: 3,
          totalMensajes: 24,
          totalPedidos: 2,
          conversaciones: [],
          pedidos: [],
        };
      }
      return {};
    });

    render(<ChatbotConfiguracionTab puedeVer={true} puedeEditar={true} />);

    await waitFor(() => {
      expect(
        screen.getByLabelText(/Número de teléfono o identificador/i),
      ).toBeInTheDocument();
    });

    fireEvent.change(
      screen.getByLabelText(/Número de teléfono o identificador/i),
      { target: { value: '987654321' } },
    );

    const botonConsultar = screen.getByText('Consultar y exportar datos');
    fireEvent.click(botonConsultar);

    await waitFor(() => {
      expect(screen.getByTestId('resultado-arco')).toBeInTheDocument();
    });

    // Verifica que se muestra estrictamente enmascarado
    expect(screen.getByText(/987\*\*\*321/)).toBeInTheDocument();
    // Verifica que el número original NO se expone en el bloque de datos resultante
    const bloqueArco = screen.getByTestId('resultado-arco');
    expect(bloqueArco.textContent).not.toContain('987654321');
    expect(screen.getByText(/3 conversaciones/i)).toBeInTheDocument();
    expect(screen.getByText(/24 mensajes/i)).toBeInTheDocument();
  });

  it('9. da de baja y anonimiza a un cliente con confirmación de peligro', async () => {
    vi.spyOn(api, 'get').mockResolvedValueOnce(CONFIG_MOCK_INICIAL);
    const spyPost = vi.spyOn(api, 'post').mockResolvedValueOnce({
      identificadorEnmascarado: '987***321',
      conversacionesAnonimizadas: 2,
      mensajesAnonimizados: 18,
      mensaje: 'Cliente dado de baja',
    });

    render(<ChatbotConfiguracionTab puedeVer={true} puedeEditar={true} />);

    await waitFor(() => {
      expect(
        screen.getByLabelText(/Número de teléfono o identificador/i),
      ).toBeInTheDocument();
    });

    fireEvent.change(
      screen.getByLabelText(/Número de teléfono o identificador/i),
      { target: { value: '987654321' } },
    );

    const botonBaja = screen.getByText('Dar de baja y anonimizar');
    fireEvent.click(botonBaja);

    expect(
      screen.getByText(/¿Deseas dar de baja al cliente con identificador "987654321"/i),
    ).toBeInTheDocument();

    const botonConfirmarBaja = screen.getByText('Sí, dar de baja');
    fireEvent.click(botonConfirmarBaja);

    await waitFor(() => {
      expect(spyPost).toHaveBeenCalledWith(
        '/admin/chatbot/configuracion/privacidad/baja',
        {
          identificador: '987654321',
          motivo: undefined,
        },
      );
    });

    await waitFor(() => {
      expect(
        screen.getByText(/Cliente con identificador 987\*\*\*321 dado de baja exitosamente/i),
      ).toBeInTheDocument();
    });
  });

  it('10. en modo solo lectura (puedeEditar=false) deshabilita controles de edición y muestra aviso', async () => {
    vi.spyOn(api, 'get').mockResolvedValueOnce(CONFIG_MOCK_INICIAL);

    render(<ChatbotConfiguracionTab puedeVer={true} puedeEditar={false} />);

    await waitFor(() => {
      expect(screen.getByText('Sólo lectura')).toBeInTheDocument();
    });

    expect(
      screen.getByText(/Modo sólo lectura. Se requiere el permiso/i),
    ).toBeInTheDocument();

    // Interruptores deshabilitados
    const switchPedidos = screen.getByLabelText('Recepción de pedidos');
    expect(switchPedidos).toBeDisabled();

    // Inputs de texto deshabilitados
    const textarea = screen.getByLabelText('Mensaje de bienvenida');
    expect(textarea).toBeDisabled();

    // Botones de guardado deshabilitados
    const botonesGuardarTexto = screen.getAllByText('Guardar texto');
    expect(botonesGuardarTexto[0]).toBeDisabled();

    expect(screen.getByText('Guardar límites anti-spam')).toBeDisabled();
    expect(screen.getByText('Guardar plazo')).toBeDisabled();
    expect(screen.getByText('Ejecutar anonimización ahora')).toBeDisabled();
    expect(screen.getByText('Dar de baja y anonimizar')).toBeDisabled();
  });

  it('11. verifica que la UI administrativa tenga CERO emojis en sus textos, títulos y botones', async () => {
    vi.spyOn(api, 'get').mockResolvedValueOnce(CONFIG_MOCK_INICIAL);

    const { container } = render(
      <ChatbotConfiguracionTab puedeVer={true} puedeEditar={true} />,
    );

    await waitFor(() => {
      expect(
        screen.getByText('Configuración y seguridad del bot'),
      ).toBeInTheDocument();
    });

    // Regex para detectar emojis comunes en UI
    const emojiRegex =
      /[\u{1F300}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}]/u;

    // Obtener todos los títulos, botones y badges
    const elementosTexto = container.querySelectorAll(
      'h2, h3, button, span, label, p',
    );

    for (const el of Array.from(elementosTexto)) {
      // Excluir el contenido interno del textarea que sí puede tener emojis de WhatsApp
      if (el.tagName.toLowerCase() === 'textarea') continue;
      const tieneEmoji = emojiRegex.test(el.textContent || '');
      expect(tieneEmoji).toBe(false);
    }
  });
});
