import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { api } from '../../../comun/api';
import {
  ChatbotConfiguracionTab,
  ConfiguracionBotRespuesta,
  ConsumoIaState,
  ExportacionClienteRespuesta,
} from '../ChatbotConfiguracionTab';

// FIXTURE REAL DE LA API (GET /admin/chatbot/configuracion)
const CONFIG_API_REAL_FIXTURE: ConfiguracionBotRespuesta = {
  textos: {
    chatbot_texto_bienvenida:
      'CAPRICHOS DEL MES · Frappe Maracuyá Tropical 🍓\n\n¡Hola! ☕ Soy Capri, la asistente de Caprichos. ¿En qué te puedo ayudar hoy? 🧁',
    chatbot_texto_despedida:
      'Gracias por comunicarte con Caprichos ☕. ¡Esperamos verte pronto! 🧁',
    chatbot_texto_pase_persona:
      'Te paso con alguien del equipo. Ya les avisé con tu nombre y tu número; en unos minutos te escriben.',
    chatbot_texto_fuera_horario:
      'Ahora estamos cerrados. Nuestro horario: {horario}. No tomamos pedidos fuera de horario; escríbenos cuando abramos.',
    chatbot_texto_no_entiendo:
      'No estoy seguro de haber entendido. ¿Qué necesitas? Puedes elegir una opción o escribirme de otra forma.',
    chatbot_texto_no_entiendo_derivacion:
      'No logro entender bien tu mensaje, mejor te paso con una persona del equipo para ayudarte.',
    chatbot_texto_indicacion_pago:
      'Si pagas por Yape, Plin o transferencia, envíanos aquí la captura de tu comprobante.',
    chatbot_texto_envio_gratis: '🛵 Envío gratis por «{promo}»',
    chatbot_texto_aviso_stock: '🍩 {aviso}',
  },
  textosDefecto: {
    chatbot_texto_bienvenida:
      'CAPRICHOS DEL MES · Frappe Maracuyá Tropical 🍓\n\n¡Hola! ☕ Soy Capri, la asistente de Caprichos. ¿En qué te puedo ayudar hoy? 🧁',
    chatbot_texto_despedida:
      'Gracias por comunicarte con Caprichos ☕. ¡Esperamos verte pronto! 🧁',
    chatbot_texto_pase_persona:
      'Te paso con alguien del equipo. Ya les avisé con tu nombre y tu número; en unos minutos te escriben.',
    chatbot_texto_fuera_horario:
      'Ahora estamos cerrados. Nuestro horario: {horario}. No tomamos pedidos fuera de horario; escríbenos cuando abramos.',
    chatbot_texto_no_entiendo:
      'No estoy seguro de haber entendido. ¿Qué necesitas? Puedes elegir una opción o escribirme de otra forma.',
    chatbot_texto_no_entiendo_derivacion:
      'No logro entender bien tu mensaje, mejor te paso con una persona del equipo para ayudarte.',
    chatbot_texto_indicacion_pago:
      'Si pagas por Yape, Plin o transferencia, envíanos aquí la captura de tu comprobante.',
    chatbot_texto_envio_gratis: '🛵 Envío gratis por «{promo}»',
    chatbot_texto_aviso_stock: '🍩 {aviso}',
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
    maxPorMinuto: 10,
    maxPorHora: 60,
  },
  privacidad: {
    diasRetencion: 90,
  },
};

const CONSUMO_IA_FIXTURE: ConsumoIaState = {
  periodo: '2026-10',
  llamadasTotal: 48,
  tokensEntrada: 18000,
  tokensSalida: 13200,
  tokensTotal: 31200,
  costoUsdEstimado: 4.125,
  topeMensualUsd: 20.0,
  porcentajeConsumido: 20.6,
  topeAlcanzado: false,
  iaActiva: true,
};

describe('ChatbotConfiguracionTab (Ola 4, Agente I: Configuración y Seguridad del Bot)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockApiGetExitoso = () => {
    return vi.spyOn(api, 'get').mockImplementation(async (ruta: string) => {
      if (ruta === '/admin/chatbot/configuracion') {
        return CONFIG_API_REAL_FIXTURE;
      }
      if (ruta === '/admin/configuracion/ia-consumo') {
        return CONSUMO_IA_FIXTURE;
      }
      return {};
    });
  };

  it('1. renderiza las 5 tarjetas principales con datos de configuración real de la API e IA', async () => {
    mockApiGetExitoso();

    render(<ChatbotConfiguracionTab puedeVer={true} puedeEditar={true} />);

    await waitFor(() => {
      expect(
        screen.getByText('Configuración y seguridad del bot'),
      ).toBeInTheDocument();
    });

    // Tarjeta 1: Consumo IA (vía /admin/configuracion/ia-consumo)
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

    // Tarjeta 3: Textos editables (los 7 reales, incluyendo fuera de horario e indicación de pago)
    expect(screen.getByTestId('seccion-textos')).toBeInTheDocument();
    expect(screen.getByText('Mensaje de bienvenida')).toBeInTheDocument();
    expect(screen.getByText('Mensaje de despedida')).toBeInTheDocument();
    expect(screen.getByText('Pase a asesor humano')).toBeInTheDocument();
    expect(screen.getByText('Fuera de horario')).toBeInTheDocument();
    expect(screen.getByText('Repregunta al no entender')).toBeInTheDocument();
    expect(screen.getByText('Derivación al no entender')).toBeInTheDocument();
    expect(screen.getByText('Indicación de pago')).toBeInTheDocument();

    // Tarjeta 4: los límites por minuto/hora ya NO se editan aquí (solo en Protección contra spam)
    expect(screen.queryByTestId('seccion-antispam')).not.toBeInTheDocument();
    expect(screen.queryByText('Guardar límites anti-spam')).not.toBeInTheDocument();
    expect(screen.getByTestId('tarjeta-proteccion-spam')).toBeInTheDocument();

    // Tarjeta 5: Privacidad Ley 29733
    expect(screen.getByTestId('seccion-privacidad')).toBeInTheDocument();
    expect(
      screen.getByLabelText('Días de retención de mensajes'),
    ).toHaveValue(90);
    expect(
      screen.getByText(/Gestión ARCO: Exportación y baja de cliente/i),
    ).toBeInTheDocument();
  });

  it('2. cambia el estado de un interruptor con confirmación Sí/No obligatoria', async () => {
    mockApiGetExitoso();
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
    mockApiGetExitoso();
    const spyPut = vi.spyOn(api, 'put').mockResolvedValueOnce({
      chatbot_texto_bienvenida: '¡Bienvenido a Caprichos Café! ¿Deseas delivery o recoger en tienda?',
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
          chatbot_texto_bienvenida:
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
    mockApiGetExitoso();

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
    const configModificada: ConfiguracionBotRespuesta = {
      ...CONFIG_API_REAL_FIXTURE,
      textos: {
        ...CONFIG_API_REAL_FIXTURE.textos,
        chatbot_texto_bienvenida: 'Texto modificado previo',
      },
    };
    vi.spyOn(api, 'get').mockImplementation(async (ruta: string) => {
      if (ruta === '/admin/chatbot/configuracion') return configModificada;
      if (ruta === '/admin/configuracion/ia-consumo') return CONSUMO_IA_FIXTURE;
      return {};
    });

    const spyPost = vi.spyOn(api, 'post').mockResolvedValueOnce({
      clave: 'chatbot_texto_bienvenida',
      valor: CONFIG_API_REAL_FIXTURE.textosDefecto.chatbot_texto_bienvenida,
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
        { clave: 'chatbot_texto_bienvenida' },
      );
    });

    await waitFor(() => {
      expect(
        screen.getByText(/Texto "Mensaje de bienvenida" restablecido a su valor por defecto/i),
      ).toBeInTheDocument();
    });
  });

  it('6. el anti-spam por minuto y hora se edita solo en Protección contra spam (una única tarjeta)', async () => {
    mockApiGetExitoso();
    const spyPut = vi.spyOn(api, 'put');

    render(<ChatbotConfiguracionTab puedeVer={true} puedeEditar={true} />);

    await waitFor(() => {
      expect(screen.getByTestId('tarjeta-proteccion-spam')).toBeInTheDocument();
    });
    // no hay campos duplicados de la tarjeta vieja
    expect(screen.queryByLabelText('Máximo mensajes por minuto')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Máximo mensajes por hora')).not.toBeInTheDocument();
    expect(screen.getAllByLabelText('Mensajes por minuto')).toHaveLength(1);
    expect(screen.getAllByLabelText('Mensajes por hora')).toHaveLength(1);
    expect(spyPut).not.toHaveBeenCalled();
  });

  it('7. actualiza el plazo de retención en días con confirmación', async () => {
    mockApiGetExitoso();
    const spyPut = vi.spyOn(api, 'put').mockResolvedValueOnce({
      diasRetencion: 60,
    });

    render(<ChatbotConfiguracionTab puedeVer={true} puedeEditar={true} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Días de retención de mensajes')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('Días de retención de mensajes'), {
      target: { value: '60' },
    });

    const botonGuardar = screen.getByText('Guardar plazo');
    fireEvent.click(botonGuardar);

    expect(
      screen.getByText(/¿Deseas establecer el plazo de retención en 60 días/i),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText('Sí, confirmar'));

    await waitFor(() => {
      expect(spyPut).toHaveBeenCalledWith(
        '/admin/chatbot/configuracion/retencion',
        { diasRetencion: 60 },
      );
    });

    await waitFor(() => {
      expect(
        screen.getByText(/Plazo de retención de mensajes actualizado correctamente/i),
      ).toBeInTheDocument();
    });
  });

  it('8. ejecuta anonimización de mensajes antiguos por retención Ley 29733 con campos reales de API', async () => {
    mockApiGetExitoso();
    const spyPost = vi.spyOn(api, 'post').mockResolvedValueOnce({
      anonimizados: 35,
      fechaCorte: '2026-07-28',
      diasRetencion: 90,
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

  it('9. busca y exporta datos de un cliente ARCO mostrando teléfono enmascarado (nunca completo)', async () => {
    vi.spyOn(api, 'get').mockImplementation(async (ruta: string) => {
      if (ruta === '/admin/chatbot/configuracion') {
        return CONFIG_API_REAL_FIXTURE;
      }
      if (ruta === '/admin/configuracion/ia-consumo') {
        return CONSUMO_IA_FIXTURE;
      }
      if (ruta.includes('/admin/chatbot/configuracion/privacidad/exportar')) {
        const respuestaArco: ExportacionClienteRespuesta = {
          identificadorEnmascarado: '987***321',
          nombreContacto: 'Cliente Test',
          identificadorTipo: 'TELEFONO',
          consentimiento: {
            aceptaComunicaciones: true,
            origen: 'WHATSAPP_OPTIN',
            actualizadoEn: '2026-10-01T10:00:00.000Z',
          },
          conversacion: {
            id: '123',
            estado: 'CERRADA',
            duenio: 'BOT',
            ultimaActividad: '2026-10-26T12:00:00.000Z',
          },
          totalMensajes: 24,
          mensajes: [],
          totalPedidos: 2,
          pedidos: [],
        };
        return respuestaArco;
      }
      return {};
    });

    render(<ChatbotConfiguracionTab puedeVer={true} puedeEditar={true} />);

    await waitFor(() => {
      expect(
        screen.getByLabelText('Número de teléfono o identificador'),
      ).toBeInTheDocument();
    });

    fireEvent.change(
      screen.getByLabelText('Número de teléfono o identificador'),
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
    expect(screen.getByText(/1 conversaciones/i)).toBeInTheDocument();
    expect(screen.getByText(/24 mensajes/i)).toBeInTheDocument();
    expect(screen.getByText(/2 pedidos/i)).toBeInTheDocument();
  });

  it('10. da de baja y anonimiza a un cliente con confirmación de peligro y respuesta real de API', async () => {
    mockApiGetExitoso();
    const spyPost = vi.spyOn(api, 'post').mockResolvedValueOnce({
      exito: true,
      mensaje: 'Cliente dado de baja y datos personales anonimizados conforme a la Ley 29733',
      identificador: '987***321',
    });

    render(<ChatbotConfiguracionTab puedeVer={true} puedeEditar={true} />);

    await waitFor(() => {
      expect(
        screen.getByLabelText('Número de teléfono o identificador'),
      ).toBeInTheDocument();
    });

    fireEvent.change(
      screen.getByLabelText('Número de teléfono o identificador'),
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

  it('11. en modo solo lectura (puedeEditar=false) deshabilita controles de edición y muestra aviso', async () => {
    mockApiGetExitoso();

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

    expect(screen.getByText('Guardar plazo')).toBeDisabled();
    expect(screen.getByText('Ejecutar anonimización ahora')).toBeDisabled();
    expect(screen.getByText('Dar de baja y anonimizar')).toBeDisabled();
  });

  it('12. verifica que la UI administrativa tenga CERO emojis en sus textos, títulos y botones', async () => {
    mockApiGetExitoso();

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

  it('13. maneja error de carga sin dejar pantalla en blanco (muestra EstadoError)', async () => {
    vi.spyOn(api, 'get').mockRejectedValueOnce(new Error('Fallo de red simulado'));

    render(<ChatbotConfiguracionTab puedeVer={true} puedeEditar={true} />);

    await waitFor(() => {
      expect(screen.getByText('Error al cargar configuración del chatbot')).toBeInTheDocument();
    });
    expect(screen.getByText('Fallo de red simulado')).toBeInTheDocument();
  });
});
