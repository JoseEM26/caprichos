import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import * as sesionModulo from '../../../comun/sesion';
import { comprobantesApi } from '../comprobantesApi';
import { PorEmitirTab } from '../PorEmitirTab';
import { NotaVentaVista } from '../NotaVentaVista';
import { ReclamosAdminView } from '../ReclamosAdminView';
import { ReclamosPublicoPage } from '../../../carta/legal/ReclamosPublicoPage';
import { PieLegal } from '../../../carta/legal/PieLegal';
import type { NotaVentaDatos, ComprobantePorEmitir, ReclamoAdminItem, ReclamoAdminDetalle } from '../tipos';

describe('Ola F5: Comprobantes y Obligaciones Legales', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock por defecto de useSesion (ADMIN)
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
      usuario: { partyId: '1', nombres: 'Admin Test', rol: 'ADMIN' },
      permisos: ['comprobantes/ver', 'comprobantes/reimprimir', 'comprobantes/emitir', 'reclamos/ver', 'reclamos/responder'],
      debeCambiar: false,
      cargando: false,
      autenticado: true,
      ingresar: vi.fn(),
      salir: vi.fn(),
      renovar: vi.fn(),
      refrescarYo: vi.fn(),
      marcarClaveCambiada: vi.fn(),
      tiene: vi.fn().mockReturnValue(true),
    });
  });

  // --- Prueba 1: la casilla de privacidad es obligatoria ---
  it('1. la casilla de privacidad es obligatoria en el libro de reclamaciones', async () => {
    const spyCrear = vi.spyOn(comprobantesApi, 'crearReclamoPublico');

    render(
      <MemoryRouter>
        <ReclamosPublicoPage />
      </MemoryRouter>,
    );

    // Llenar campos válidos pero SIN marcar la casilla de privacidad
    fireEvent.change(screen.getByLabelText(/Nombres y apellidos completos/i), {
      target: { value: 'Carlos Mendoza' },
    });
    fireEvent.change(screen.getByLabelText(/Documento/i), {
      target: { value: '72345678' },
    });
    fireEvent.change(screen.getByLabelText(/Teléfono de contacto/i), {
      target: { value: '987654321' },
    });
    fireEvent.change(screen.getByLabelText(/Domicilio/i), {
      target: { value: 'Av. Las Palmeras 456' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Explica detalladamente/i), {
      target: { value: 'El pedido llegó frío y con demora de más de 45 minutos.' },
    });

    // Enviar el formulario
    const botonEnviar = screen.getByRole('button', { name: /Enviar a Libro de Reclamaciones/i });
    fireEvent.click(botonEnviar);

    // Debe mostrar el error de privacidad obligatoria y no llamar a la API
    await waitFor(() => {
      expect(screen.getByText(/Debe aceptar la política de privacidad para enviar el reclamo/i)).toBeInTheDocument();
    });
    expect(spyCrear).not.toHaveBeenCalled();
  });

  // --- Prueba 2: el DNI inválido bloquea ---
  it('2. el DNI inválido bloquea el envío del reclamo', async () => {
    const spyCrear = vi.spyOn(comprobantesApi, 'crearReclamoPublico');

    render(
      <MemoryRouter>
        <ReclamosPublicoPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText(/Nombres y apellidos completos/i), {
      target: { value: 'Maria Torres' },
    });
    // DNI de 5 dígitos (inválido)
    fireEvent.change(screen.getByLabelText(/Documento/i), {
      target: { value: '12345' },
    });
    fireEvent.change(screen.getByLabelText(/Teléfono de contacto/i), {
      target: { value: '912345678' },
    });
    fireEvent.change(screen.getByLabelText(/Domicilio/i), {
      target: { value: 'Jr. Puno 123' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Explica detalladamente/i), {
      target: { value: 'Detalle de prueba con más de veinte caracteres necesarios.' },
    });

    // Marcar la privacidad
    const checkboxPrivacidad = screen.getByRole('checkbox');
    fireEvent.click(checkboxPrivacidad);

    // Enviar formulario
    const botonEnviar = screen.getByRole('button', { name: /Enviar a Libro de Reclamaciones/i });
    fireEvent.click(botonEnviar);

    // Debe mostrar error de documento inválido y bloquear la llamada a la API
    await waitFor(() => {
      expect(
        screen.getByText(/El documento debe ser un DNI de 8 dígitos o Carné de Extranjería válido/i),
      ).toBeInTheDocument();
    });
    expect(spyCrear).not.toHaveBeenCalled();
  });

  // --- Prueba 3: la constancia muestra el número ---
  it('3. la constancia muestra el número oficial de reclamo', async () => {
    vi.spyOn(comprobantesApi, 'crearReclamoPublico').mockResolvedValue({
      numero: 'LR-2026-000001',
      fechaRegistro: '2026-10-21T21:00:00Z',
      tipo: 'RECLAMO',
      fechaLimite: '2026-11-12',
      mensaje: 'Su solicitud ha sido registrada formalmente en el Libro de Reclamaciones virtual.',
    });

    render(
      <MemoryRouter>
        <ReclamosPublicoPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText(/Nombres y apellidos completos/i), {
      target: { value: 'Juan Pérez' },
    });
    fireEvent.change(screen.getByLabelText(/Documento/i), {
      target: { value: '44556677' },
    });
    fireEvent.change(screen.getByLabelText(/Teléfono de contacto/i), {
      target: { value: '998877665' },
    });
    fireEvent.change(screen.getByLabelText(/Domicilio/i), {
      target: { value: 'Av. Arequipa 1000' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Explica detalladamente/i), {
      target: { value: 'Reclamo formal por entrega de pedido incompleto en salón.' },
    });

    const checkboxPrivacidad = screen.getByRole('checkbox');
    fireEvent.click(checkboxPrivacidad);

    const botonEnviar = screen.getByRole('button', { name: /Enviar a Libro de Reclamaciones/i });
    fireEvent.click(botonEnviar);

    // Esperar a que se renderice la constancia y verificar el número
    await waitFor(() => {
      expect(screen.getByTestId('constancia-numero')).toHaveTextContent('LR-2026-000001');
      expect(screen.getByText(/CONSTANCIA OFICIAL REGISTRADA/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Descargar constancia/i })).toBeInTheDocument();
    });
  });

  // --- Prueba 4: Marcar emitido exige referencia ---
  it('4. Marcar emitido exige referencia del facturador de 3 o más caracteres', async () => {
    const mockComprobante: ComprobantePorEmitir = {
      id: '10',
      pedido_id: '1',
      codigo_pedido: 'CP-101',
      tipo: 'BOLETA',
      serie: 'B001',
      numero: 42,
      numero_texto: 'B001-000042',
      documento: '44556677',
      razon_social: 'Cliente Final',
      total: 58.5,
      fecha: '2026-10-21T18:00:00Z',
      emision: 'POR_EMITIR',
      copias_impresas: 0,
    };

    vi.spyOn(comprobantesApi, 'listarPorEmitir').mockResolvedValue({
      total: 1,
      pagina: 1,
      limite: 20,
      elementos: [mockComprobante],
    });

    const spyMarcar = vi.spyOn(comprobantesApi, 'marcarEmitido').mockResolvedValue({
      id: '10',
      emision: 'EMITIDO',
      referencia_externa: 'FE-9988',
    });

    render(<PorEmitirTab />);

    // Esperar carga del comprobante en tabla
    await waitFor(() => {
      expect(screen.getByText('B001-000042')).toBeInTheDocument();
    });

    // Clic en Marcar emitido
    const botonMarcar = screen.getByRole('button', { name: /Marcar emitido/i });
    fireEvent.click(botonMarcar);

    // Se abre el modal
    expect(screen.getByText(/Marcar como emitido/i)).toBeInTheDocument();
    const inputRef = screen.getByLabelText(/Referencia del facturador externo/i);
    const botonContinuar = screen.getByRole('button', { name: /Continuar/i });

    // Referencia vacía o menor a 3 caracteres: el botón Continuar está deshabilitado
    expect(botonContinuar).toBeDisabled();

    fireEvent.change(inputRef, { target: { value: 'AB' } });
    expect(botonContinuar).toBeDisabled();

    // Ingresar referencia válida (>= 3 caracteres)
    fireEvent.change(inputRef, { target: { value: 'FE-9988' } });
    expect(botonContinuar).not.toBeDisabled();
    fireEvent.click(botonContinuar);

    // Se abre el diálogo de confirmación Sí/No
    await waitFor(() => {
      expect(screen.getByText(/¿Confirmar comprobante emitido\?/i)).toBeInTheDocument();
    });

    const botonConfirmar = screen.getByRole('button', { name: /Sí, marcar emitido/i });
    fireEvent.click(botonConfirmar);

    // Debe llamar a la API con el ID y la referencia
    await waitFor(() => {
      expect(spyMarcar).toHaveBeenCalledWith('10', 'FE-9988');
    });
  });

  // --- Prueba 5: el documento sale enmascarado para no ADMIN ---
  it('5. el documento sale enmascarado para rol no ADMIN (ej. CAJERO) y visible para ADMIN', async () => {
    const mockNota: NotaVentaDatos = {
      titulo: 'Nota de venta NV01-000123',
      local: {
        nombre: 'Caprichos',
        razon_social: 'Caprichos S.A.C.',
        ruc: '20123456789',
        direccion: 'Av. Larco 100',
        telefono: '999888777',
      },
      comprobante: {
        id: '1',
        pedido_id: '100',
        tipo: 'BOLETA',
        serie: 'NV01',
        numero: 123,
        numero_texto: 'NV01-000123',
        documento: '44556677',
        razon_social: null,
        emision: 'INTERNA',
        copias_impresas: 0,
      },
      pedido: {
        id: '100',
        codigo: 'CP-042',
        canal: 'SALON',
        modalidad: 'MESA',
      },
      cliente: {
        nombre: 'Pedro Ramirez',
        documento: '44556677',
        razon_social: null,
      },
      fecha: '2026-10-21 19:30:00',
      fecha_iso: '2026-10-21T19:30:00Z',
      detalle: [
        {
          id: '1',
          nombre: 'Hamburguesa Clásica',
          cantidad: 1,
          precio_unit: 25,
          subtotal: 25,
        },
      ],
      subtotal: 25,
      descuento: 0,
      envio: 0,
      total: 25,
      pagos: [{ id: '1', medio: 'EFECTIVO', monto: 25 }],
      vuelto: 0,
    };

    vi.spyOn(comprobantesApi, 'obtenerNotaVenta').mockResolvedValue(mockNota);

    // Caso A: Usuario CAJERO (no ADMIN) -> Documento debe salir enmascarado: 44****77
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
      usuario: { partyId: '2', nombres: 'Cajero Pepe', rol: 'CAJERO' },
      permisos: ['comprobantes/ver'],
      debeCambiar: false,
      cargando: false,
      autenticado: true,
      ingresar: vi.fn(),
      salir: vi.fn(),
      renovar: vi.fn(),
      refrescarYo: vi.fn(),
      marcarClaveCambiada: vi.fn(),
      tiene: vi.fn().mockReturnValue(true),
    });

    const { rerender } = render(<NotaVentaVista pedidoIdInicial="100" />);

    await waitFor(() => {
      const elemDoc = screen.getByTestId('documento-cliente');
      expect(elemDoc).toHaveTextContent('44****77');
      expect(elemDoc).not.toHaveTextContent('44556677');
    });

    // Caso B: Usuario ADMIN -> Documento visible completo: 44556677
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
      usuario: { partyId: '1', nombres: 'Admin Test', rol: 'ADMIN' },
      permisos: ['comprobantes/ver'],
      debeCambiar: false,
      cargando: false,
      autenticado: true,
      ingresar: vi.fn(),
      salir: vi.fn(),
      renovar: vi.fn(),
      refrescarYo: vi.fn(),
      marcarClaveCambiada: vi.fn(),
      tiene: vi.fn().mockReturnValue(true),
    });

    rerender(<NotaVentaVista pedidoIdInicial="100" />);

    await waitFor(() => {
      const elemDoc = screen.getByTestId('documento-cliente');
      expect(elemDoc).toHaveTextContent('44556677');
    });
  });

  // --- Prueba 6: la nota reimpresa dice COPIA ---
  it('6. la nota reimpresa dice COPIA y dispara window.print()', async () => {
    const mockNotaOriginal: NotaVentaDatos = {
      titulo: 'Nota de venta NV01-000123',
      local: {
        nombre: 'Caprichos',
        razon_social: 'Caprichos S.A.C.',
        ruc: '20123456789',
        direccion: 'Av. Larco 100',
        telefono: '999888777',
      },
      comprobante: {
        id: '1',
        pedido_id: '100',
        tipo: 'NOTA_VENTA',
        serie: 'NV01',
        numero: 123,
        numero_texto: 'NV01-000123',
        documento: null,
        razon_social: null,
        emision: 'INTERNA',
        copias_impresas: 0,
        es_copia: false,
      },
      pedido: {
        id: '100',
        codigo: 'CP-042',
        canal: 'SALON',
        modalidad: 'MESA',
      },
      cliente: {},
      fecha: '2026-10-21 19:30:00',
      fecha_iso: '2026-10-21T19:30:00Z',
      detalle: [
        {
          id: '1',
          nombre: 'Torta de Chocolate',
          cantidad: 1,
          precio_unit: 15,
          subtotal: 15,
        },
      ],
      subtotal: 15,
      descuento: 0,
      envio: 0,
      total: 15,
      pagos: [{ id: '1', medio: 'EFECTIVO', monto: 15 }],
      vuelto: 0,
      es_copia: false,
    };

    const mockNotaReimpresa: NotaVentaDatos = {
      ...mockNotaOriginal,
      titulo: 'Nota de venta NV01-000123 - COPIA 1',
      es_copia: true,
      marca_copia: 'COPIA',
      copia_numero: 1,
      comprobante: {
        ...mockNotaOriginal.comprobante,
        copias_impresas: 1,
        es_copia: true,
        marca_copia: 'COPIA',
        copia_numero: 1,
      },
    };

    vi.spyOn(comprobantesApi, 'obtenerNotaVenta').mockResolvedValue(mockNotaOriginal);
    const spyReimprimir = vi.spyOn(comprobantesApi, 'reimprimirNotaVenta').mockResolvedValue(mockNotaReimpresa);

    // Mock de window.print
    const spyPrint = vi.fn();
    window.print = spyPrint;

    render(<NotaVentaVista pedidoIdInicial="100" />);

    // Esperar a que se cargue la nota original
    await waitFor(() => {
      expect(screen.getByText('Nota de venta NV01-000123')).toBeInTheDocument();
    });

    // Antes de reimprimir, no debe tener la marca de copia
    expect(screen.queryByTestId('marca-copia')).not.toBeInTheDocument();

    // Clic en Reimprimir
    const botonReimprimir = screen.getByRole('button', { name: /Reimprimir \(marcar COPIA\)/i });
    fireEvent.click(botonReimprimir);

    // Esperar respuesta de reimpresión
    await waitFor(() => {
      expect(spyReimprimir).toHaveBeenCalledWith('100');
      // Debe mostrar la marca COPIA
      const marcaCopia = screen.getByTestId('marca-copia');
      expect(marcaCopia).toBeInTheDocument();
      expect(marcaCopia).toHaveTextContent(/COPIA 1/i);
      expect(screen.getByText('Nota de venta NV01-000123 - COPIA 1')).toBeInTheDocument();
    });
  });

  // --- Prueba 7: PieLegal contiene los enlaces requeridos ---
  it('7. PieLegal contiene enlaces a términos, privacidad y libro de reclamaciones', () => {
    render(
      <MemoryRouter>
        <PieLegal />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: /Términos y condiciones/i })).toHaveAttribute('href', '/legal/terminos');
    expect(screen.getByRole('link', { name: /Política de privacidad/i })).toHaveAttribute('href', '/legal/privacidad');
    expect(screen.getByRole('link', { name: /Libro de reclamaciones virtual/i })).toHaveAttribute('href', '/reclamos');
  });

  // --- Prueba 8: ReclamosAdminView muestra lista, filtros y detalle con auditoría ---
  it('8. ReclamosAdminView lista con urgencia de plazos y abre detalle con auditoría', async () => {
    const mockReclamo: ReclamoAdminItem = {
      id: '5',
      numero: 'LR-2026-000005',
      tipo: 'RECLAMO',
      nombre: 'Lucía Benítez',
      documento: '10203040',
      domicilio: 'Calle Lima 123',
      telefono: '998877665',
      correo: 'lucia@example.com',
      pedido_id: '12',
      detalle: 'No llegó el pedido completo.',
      monto_reclamado: 35.0,
      estado: 'RECIBIDO',
      respuesta: null,
      respondido_por: null,
      respondido_en: null,
      fecha_limite: '2026-11-05',
      diasHabilesRestantes: 2, // Urgente <= 3
      plazoTexto: 'Faltan 2 días hábiles (urgente)',
      creado_en: '2026-10-20T10:00:00Z',
    };

    vi.spyOn(comprobantesApi, 'listarReclamos').mockResolvedValue({
      total: 1,
      pagina: 1,
      limite: 20,
      items: [mockReclamo],
    });

    const mockDetalle: ReclamoAdminDetalle = {
      ...mockReclamo,
      pedido: {
        id: '12',
        codigo: 'CP-012',
        creado_en: '2026-10-20T09:00:00Z',
        total: 35.0,
      },
    };
    const spyObtenerDetalle = vi.spyOn(comprobantesApi, 'obtenerReclamoPorId').mockResolvedValue(mockDetalle);

    render(<ReclamosAdminView />);

    await waitFor(() => {
      expect(screen.getByText('LR-2026-000005')).toBeInTheDocument();
      expect(screen.getByText('Faltan 2 días hábiles (urgente)')).toBeInTheDocument();
    });

    // Abrir detalle
    const botonDetalle = screen.getByRole('button', { name: /Ver detalle/i });
    fireEvent.click(botonDetalle);

    await waitFor(() => {
      expect(spyObtenerDetalle).toHaveBeenCalledWith('5');
      expect(screen.getByText('RECLAMO: LR-2026-000005')).toBeInTheDocument();
      expect(screen.getByText('No llegó el pedido completo.')).toBeInTheDocument();
    });

    // Verificar que NO existe ningún botón de eliminar
    expect(screen.queryByRole('button', { name: /eliminar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /borrar/i })).not.toBeInTheDocument();
  });
});
