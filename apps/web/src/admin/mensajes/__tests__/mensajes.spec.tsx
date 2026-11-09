import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MensajesView } from '../MensajesView';
import * as api from '../mensajesApi';

vi.mock('../../../comun/socket', () => ({
  useEventos: vi.fn(),
}));

describe('MensajesView (/admin/mensajes)', () => {
  const chatsMock = {
    conteos: { todos: 3, atender: 1, bot: 2, atendidos: 0 },
    chats: [
      {
        id: '1',
        nombre: 'Ana Pérez',
        telefono: '999888777',
        identificador_tipo: 'TELEFONO' as const,
        estado: 'atencion' as const,
        urgente: true,
        ultimo: 'Mi pedido llegó sin salsa',
        hora: '21:03',
        sinLeer: 1,
      },
      {
        id: '2',
        nombre: 'Rosa Díaz',
        telefono: '977666555',
        identificador_tipo: 'TELEFONO' as const,
        estado: 'validar' as const,
        urgente: false,
        ultimo: 'Foto',
        hora: '21:35',
        sinLeer: 1,
      },
      {
        id: '3',
        nombre: 'Contacto Anónimo WA',
        telefono: 'wa-user:usr_123',
        identificador_tipo: 'USUARIO_WA' as const,
        estado: 'bot' as const,
        urgente: false,
        ultimo: 'Buenas',
        hora: '21:40',
        sinLeer: 0,
      },
    ],
  };

  const detalleMock = {
    id: '1',
    nombre: 'Ana Pérez',
    telefono: '999888777',
    modalidad: 'Delivery',
    estado: 'atencion' as const,
    urgente: true,
    dueno: null,
    esMio: false,
    ocupado: false,
    mensajes: [
      {
        id: '10',
        autor: 'CLIENTE' as const,
        saliente: false,
        imagen: false,
        texto: 'Mi pedido llegó sin salsa',
        hora: '21:03',
      },
    ],
    pedido: {
      id: '50',
      codigo: 'CP-0002',
      medio: 'Yape',
      total: '34.50',
      lineas: ['1 x FRAPPE OREO Grande 16 oz · Leche entera'],
    },
    solicitud: null,
    tiempoPrometidoMin: 25,
    altaDemanda: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(api, 'listarConversaciones').mockResolvedValue(chatsMock);
    vi.spyOn(api, 'obtenerDetalleConversacion').mockResolvedValue(detalleMock);
    vi.spyOn(api, 'listarRespuestasRapidas').mockResolvedValue([
      { id: '1', titulo: 'Pedido listo', texto: 'Tu pedido ya está listo.' },
    ]);
    vi.spyOn(api, 'enviarMensaje').mockResolvedValue({ id: 'msg-new' });
    vi.spyOn(api, 'pausarBot').mockResolvedValue({ ok: true });
    vi.spyOn(api, 'aprobarPagoChat').mockResolvedValue({ ok: true });
  });

  it('1. Renderiza la lista de chats, pestañas y conteos dinámicos', async () => {
    render(<MensajesView />);
    await waitFor(() => {
      expect(screen.getByText('Ana Pérez')).toBeInTheDocument();
      expect(screen.getByText('Rosa Díaz')).toBeInTheDocument();
    });
    expect(screen.getByText('1 por atender')).toBeInTheDocument();
  });

  it('2. Muestra el detalle del chat seleccionado con mensajes y pedido', async () => {
    render(<MensajesView />);
    await waitFor(() => {
      expect(screen.getAllByText('Mi pedido llegó sin salsa').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Total s/ 34.50')).toBeInTheDocument();
    });
  });

  it('3. Permite escribir y enviar un mensaje al chat', async () => {
    render(<MensajesView />);
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Escribe un mensaje')).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText('Escribe un mensaje');
    fireEvent.change(input, { target: { value: 'Hola Ana, te enviamos la salsa' } });

    const sendBtn = screen.getByLabelText('Enviar mensaje');
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(api.enviarMensaje).toHaveBeenCalledWith('1', 'Hola Ana, te enviamos la salsa');
    });
  });

  it('4. Permite pausar el bot con confirmación Sí/No', async () => {
    render(<MensajesView />);
    // Pausar el bot está en el menú «⋯» de la cabecera
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Más opciones del chat' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Más opciones del chat' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Pausar el bot' }));

    // Diálogo de Confirmar
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Sí, pausar bot' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Sí, pausar bot' }));

    await waitFor(() => {
      expect(api.pausarBot).toHaveBeenCalledWith('1');
    });
  });

  it('5. Muestra la etiqueta Usuario de WhatsApp para remitentes sin teléfono en lista y detalle', async () => {
    render(<MensajesView />);
    await waitFor(() => {
      expect(screen.getByText('Contacto Anónimo WA')).toBeInTheDocument();
      expect(screen.getAllByText('Usuario de WhatsApp').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('6. Ofrece Editar nombre en el menú del chat y abre el modal', async () => {
    render(<MensajesView />);
    // Editar nombre está en el menú «⋯» de la cabecera
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Más opciones del chat' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Más opciones del chat' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Editar nombre' }));

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Editar nombre de contacto' })).toBeInTheDocument();
    });
  });

  it('7. En un chat sin ningún identificador muestra aviso y oculta el compositor', async () => {
    const detalleSinIdentificador = {
      ...detalleMock,
      id: '3',
      nombre: 'Contacto Sin Identificador',
      telefono: '',
      identificador_tipo: 'USUARIO_WA' as const,
    };
    vi.spyOn(api, 'obtenerDetalleConversacion').mockResolvedValue(detalleSinIdentificador);

    render(<MensajesView />);

    await waitFor(() => {
      expect(
        screen.getByText('Este contacto no tiene ningun identificador: no se puede responder'),
      ).toBeInTheDocument();
      expect(screen.queryByPlaceholderText('Escribe un mensaje')).not.toBeInTheDocument();
    });
  });

  it('7b. En un chat USUARIO_WA con BSUID permite responder y oculta opciones de llamada', async () => {
    const detalleBsuid = {
      ...detalleMock,
      id: '3',
      nombre: 'Contacto BSUID WA',
      telefono: 'wa-user:PE.1048174911395155',
      identificador_tipo: 'USUARIO_WA' as const,
    };
    vi.spyOn(api, 'obtenerDetalleConversacion').mockResolvedValue(detalleBsuid);

    render(<MensajesView />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Escribe un mensaje')).toBeInTheDocument();
      expect(screen.queryByText('Copiar celular')).not.toBeInTheDocument();
      expect(screen.queryByText('Abrir en WhatsApp')).not.toBeInTheDocument();
    });
  });

  it('8. Muestra indicadores de estado accesibles en mensajes salientes y modo simulado', async () => {
    const detalleConEstados = {
      ...detalleMock,
      simulado: true,
      mensajes: [
        {
          id: '10',
          autor: 'PERSONA' as const,
          saliente: true,
          imagen: false,
          texto: 'Mensaje leído',
          hora: '21:05',
          estado: 'LEIDO',
        },
        {
          id: '11',
          autor: 'PERSONA' as const,
          saliente: true,
          imagen: false,
          texto: 'Mensaje entregado',
          hora: '21:06',
          estado: 'ENTREGADO',
        },
        {
          id: '12',
          autor: 'PERSONA' as const,
          saliente: true,
          imagen: false,
          texto: 'Mensaje enviado',
          hora: '21:07',
          estado: 'ENVIADO',
        },
        {
          id: '13',
          autor: 'PERSONA' as const,
          saliente: true,
          imagen: false,
          texto: 'Mensaje simulado',
          hora: '21:08',
          estado: 'SIMULADO',
        },
      ],
    };
    vi.spyOn(api, 'obtenerDetalleConversacion').mockResolvedValue(detalleConEstados);

    render(<MensajesView />);

    await waitFor(() => {
      expect(screen.getAllByText('Modo simulado: no se envia a WhatsApp').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Leido')).toBeInTheDocument();
      expect(screen.getByText('Entregado')).toBeInTheDocument();
      expect(screen.getByText('Enviado')).toBeInTheDocument();
    });
  });

  it('9. Muestra motivo de fallo y botón Reintentar con confirmación Sí/No', async () => {
    const detalleConFallo = {
      ...detalleMock,
      mensajes: [
        {
          id: '20',
          autor: 'PERSONA' as const,
          saliente: true,
          imagen: false,
          texto: 'Hola, tenemos un retraso',
          hora: '21:10',
          estado: 'FALLIDO',
          errorCodigo: 'DESTINATARIO_NO_VERIFICADO',
          motivoFallo: 'Este numero no esta autorizado en el numero de prueba de Meta',
        },
      ],
    };
    vi.spyOn(api, 'obtenerDetalleConversacion').mockResolvedValue(detalleConFallo);
    const spyReintentar = vi.spyOn(api, 'reintentarMensaje').mockResolvedValue({ ok: true, id: '20' });

    render(<MensajesView />);

    await waitFor(() => {
      expect(
        screen.getByText('No se pudo enviar: Este numero no esta autorizado en el numero de prueba de Meta'),
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    // Diálogo Confirmar
    await waitFor(() => {
      expect(screen.getByText('¿Reintentar envío de mensaje?')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Sí, reintentar' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Sí, reintentar' }));

    await waitFor(() => {
      expect(spyReintentar).toHaveBeenCalledWith('1', '20');
    });
  });

  it('10. Notifica ventana de 24 horas cerrada y permite reabrir con plantilla mediante confirmación', async () => {
    const detalleVentanaCerrada = {
      ...detalleMock,
      ventanaAbierta: false,
    };
    vi.spyOn(api, 'obtenerDetalleConversacion').mockResolvedValue(detalleVentanaCerrada);
    const spyReabrir = vi.spyOn(api, 'reabrirConversacionPlantilla').mockResolvedValue({ ok: true, id: 'msg-pl' });

    render(<MensajesView />);

    await waitFor(() => {
      expect(screen.getByTestId('porque-ventana').textContent).toMatch(/nunca te ha escrito por WhatsApp|último mensaje suyo/);
      expect(screen.getByRole('button', { name: 'Reabrir con plantilla' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Reabrir con plantilla' }));

    await waitFor(() => {
      expect(screen.getByText('¿Reabrir conversación con plantilla?')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Sí, reabrir' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Sí, reabrir' }));

    await waitFor(() => {
      expect(spyReabrir).toHaveBeenCalledWith('1');
    });
  });

  it('10b. Con la ventana cerrada explica el porqué con la fecha del último mensaje del cliente', async () => {
    const msgs = [{ id: '1', autor: 'CLIENTE', saliente: false, texto: 'Hola', hora: '14:20', fecha: '2026-11-09T19:20:00.000Z' }];
    vi.spyOn(api, 'obtenerDetalleConversacion').mockResolvedValue({ ...detalleMock, ventanaAbierta: false, mensajes: msgs } as any);
    render(<MensajesView />);
    await waitFor(() => expect(screen.getByTestId('porque-ventana').textContent).toMatch(/no te escribió en las últimas 24 h \(último mensaje suyo: 9 nov 2026, 14:20\)/));
    expect(screen.getByTestId('porque-ventana').textContent).toMatch(/Cuando responda, podrás escribirle libremente/);
  });

  it('10c. Tras enviar la plantilla: botón bloqueado «Plantilla enviada · esperando respuesta» y desbloqueo con confirmación', async () => {
    const msgs = [
      { id: '1', autor: 'CLIENTE', saliente: false, texto: 'Hola', hora: '14:20', fecha: '2026-11-07T19:20:00.000Z' },
      { id: '2', autor: 'PERSONA', saliente: true, plantilla: true, estado: 'ENTREGADO', texto: '[Plantilla]', hora: '17:10', fecha: '2026-11-09T22:10:00.000Z' },
    ];
    vi.spyOn(api, 'obtenerDetalleConversacion').mockResolvedValue({ ...detalleMock, ventanaAbierta: false, mensajes: msgs } as any);
    const spyReabrir = vi.spyOn(api, 'reabrirConversacionPlantilla').mockResolvedValue({ ok: true, id: 'x' });
    render(<MensajesView />);
    const bloqueado = await screen.findByTestId('plantilla-enviada');
    expect(bloqueado).toBeDisabled();
    expect(bloqueado.textContent).toBe('Plantilla enviada 17:10 (entregada) · esperando respuesta del cliente');
    expect(screen.queryByRole('button', { name: 'Reabrir con plantilla' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Enviar otra plantilla de todos modos' }));
    await waitFor(() => expect(screen.getByText(/Meta puede cobrarla de nuevo/)).toBeInTheDocument());
    expect(spyReabrir).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Sí, enviar otra' }));
    await waitFor(() => expect(spyReabrir).toHaveBeenCalledWith('1', true));
  });

  it('11. Cuando el envío libre falla por ventana cerrada (409), ofrece diálogo para reabrir con plantilla', async () => {
    render(<MensajesView />);
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Escribe un mensaje')).toBeInTheDocument();
    });

    const error409 = {
      codigo: 'VENTANA_CERRADA',
      message:
        'Pasaron mas de 24 horas desde el ultimo mensaje del cliente. Solo se puede escribir con una plantilla aprobada',
      statusCode: 409,
    };
    vi.spyOn(api, 'enviarMensaje').mockRejectedValue(error409);
    const spyReabrir = vi.spyOn(api, 'reabrirConversacionPlantilla').mockResolvedValue({ ok: true, id: 'msg-pl-2' });

    const input = screen.getByPlaceholderText('Escribe un mensaje');
    fireEvent.change(input, { target: { value: 'Mensaje enviado tarde' } });
    fireEvent.click(screen.getByLabelText('Enviar mensaje'));

    await waitFor(() => {
      expect(screen.getByText('¿Reabrir conversación con plantilla?')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Sí, reabrir' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Sí, reabrir' }));

    await waitFor(() => {
      expect(spyReabrir).toHaveBeenCalledWith('1');
    });
  });
});
